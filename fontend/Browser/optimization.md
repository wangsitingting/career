# 性能优化

## 加载过程

![Load](./load.png)

> 重定向 => 检查缓存 => DNS解析 => TCP连接 => 发请求 => 得到响应 => 浏览器处理 => 最后onload

- 首先检查是否重定向，但是也可能没有

- 接着我们就到了`cache`缓存，查询本地是否有域名缓存，如果有，则不需要进行`DNS`解析，否则就要对域名进行解析

- 然后 `DNS` 查询，如果这一步做了智能 `DNS` 解析的话，会提供访问速度最快的 `IP` 地址回来

- 接下来是 `TCP` 握手，应用层会下发数据给传输层，这里 `TCP` 协议会指明两端的端口号，然后下发给网络层。网络层中的 `IP` 协议会确定 `IP` 地址，并且指示了数据传输中如何跳转路由器。然后包会再被封装到数据链路层的数据帧结构中，最后就是物理层面的传输了

- `TCP` 握手结束后会进行 `TLS` 握手，然后就开始正式的传输数据

- 数据在进入服务端之前，可能还会先经过负责负载均衡的服务器，它的作用就是将请求合理的分发到多台服务器上，这时假设服务端会响应一个 `HTML` 文件

- 首先浏览器会判断状态码是什么，如果是 `200` 那就继续解析，如果 `400` 或 `500` 的话就会报错，如果 300 的话会进行重定向，这里会有个重定向计数器，避免过多次的重定向，超过次数也会报错

- 浏览器开始解析文件，如果是 `gzip` 格式的话会先解压一下，然后通过文件的编码格式知道该如何去解码文件

- 文件解码成功后会正式开始渲染流程，先会根据 `HTML` 构建 `DOM` 树，有 `CSS` 的话会去构建 `CSSOM` 树。如果遇到 `script` 标签的话，会判断是否存在 `async` 或者 `defer` ，前者会并行进行下载并执行 `JS`，后者会先下载文件，然后等待 `HTML` 解析完成后顺序执行，如果以上都没有，就会阻塞住渲染流程直到 `JS` 执行完毕。遇到文件下载的会去下载文件，这里如果使用 `HTTP 2.0` 协议的话会极大的提高多图的下载效率。

- 初始的 `HTML` 被完全加载和解析后会触发 `DOMContentLoaded` 事件

- `CSSOM` 树和 `DOM` 树构建完成后会开始生成 `Render` 树，这一步就是确定页面元素的布局、样式等等诸多方面的东西

- 在生成 `Render` 树的过程中，浏览器就开始调用 `GPU` 绘制，合成图层，将内容显示在屏幕上了，触发 `onLoad` 事件

**常用的统计数据**

1. `First Paint` 和 `First Contentful Paint` 第一次渲染

2. `First Meaningful Paint` 首次有效绘制时间

3. `Perceptual Speed Index` 视觉感知指数

## 缓存策略

浏览器缓存机制有四个方面，它们按照获取资源时请求的优先级依次排列如下：

> 1. Memory Cache
> 2. Service Worker Cache
> 3. HTTP Cache
> 4. Push Cache

一般样式表会缓存在磁盘中，不会缓存到内存中，因为css样式加载一次即可渲染出页面。但是脚本可能会随时执行，如果把脚本存在磁盘中，在执行时会把该脚本从磁盘中提取到缓存中来，这样的IO开销比较大，有可能会导致浏览器失去响应。

### MemoryCache

MemoryCache，是指存在内存中的缓存。从优先级上来说，它是浏览器最先尝试去命中的一种缓存。从效率上来说，它是响应速度最快的一种缓存。浏览器秉承的是“节约原则”，我们发现，Base64 格式的图片，几乎永远可以被塞进 memory cache，这可以视作浏览器为节省渲染开销的“自保行为”；此外，体积不大的 JS、CSS 文件，也有较大地被写入内存的几率——相比之下，较大的 JS、CSS 文件就没有这个待遇了，内存资源是有限的，它们往往被直接甩进磁盘。

### Service Worker Cache

Service Worker 是一种独立于主线程之外的 Javascript 线程。它脱离于浏览器窗体，因此无法直接访问 DOM。这样独立的个性使得 Service Worker 的“个人行为”无法干扰页面的性能，这个“幕后工作者”可以帮我们实现离线缓存、消息推送和网络代理等功能。我们借助 Service worker 实现的离线缓存就称为 Service Worker Cache。

### HTTP Cache

它又分为强缓存和协商缓存。优先级较高的是强缓存，在命中强缓存失败的情况下，才会走协商缓存。

对一条 http get 报文的基本缓存处理过程包括 7 个步骤：

1. 接收

2. 解析

3. 查询，缓存查看是否有本地副本可用，如果没有，就获取一份副本

4. 新鲜度检测， 缓存查看已缓存副本是否足够新鲜，如果不是，就询问服务器是否有任何更新。

5. 创建响应，缓存会用新的首部和已缓存的主体来构建一条响应报文。

6. 发送，缓存通过网络将响应发回给客服端。

7. 日志

图片描述

#### 强缓存

强缓存是利用 http 头中的 Expires 和 Cache-Control 两个字段来控制的。强缓存中，当请求再次发出时，浏览器会根据其中的 expires 和 cache-control 判断目标资源是否“命中”强缓存，若命中则直接从缓存中获取资源，不会再与服务端发生通信。

是否足够新鲜时期：

通过 Expires: XXXX XXX XXX GMT （绝对日期时间，http/1.0） 或者 Cache-Control:max-age=XXXX （相对日期时间，http/1.1）在文档标明过期日期。

Cache-Control 相对于 expires 更加准确，它的优先级也更高。当 Cache-Control 与 expires 同时出现时，我们以 Cache-Control 为准。

关键字理解

public 与 private 是针对资源是否能够被代理服务缓存而存在的一组对立概念。如果我们为资源设置了 public，那么它既可以被浏览器缓存，也可以被代理服务器缓存；如果我们设置了 private，则该资源只能被浏览器缓存。private 为默认值。

no-store 与 no-cache，no-cache 绕开了浏览器：我们为资源设置了 no-cache 后，每一次发起请求都不会再去询问浏览器的缓存情况，而是直接向服务端去确认该资源是否过期（即走我们下文即将讲解的协商缓存的路线）。no-store 比较绝情，顾名思义就是不使用任何缓存策略。在 no-cache 的基础上，它连服务端的缓存确认也绕开了，只允许你直接向服务端发送请求、并下载完整的响应。

#### 协商缓存

协商缓存依赖于服务端与浏览器之间的通信。协商缓存机制下，浏览器需要向服务器去询问缓存的相关信息，进而判断是重新发起请求、下载完整的响应，还是从本地获取缓存的资源。如果服务端提示缓存资源未改动（Not Modified），资源会被重定向到浏览器缓存，这种情况下网络请求对应的状态码是 304。

协商缓存的实现：从 Last-Modified 到 Etag，详细自己百度，这里不再详细展开。

HTTP 缓存决策

图片描述

当我们的资源内容不可复用时，直接为 Cache-Control 设置 no-store，拒绝一切形式的缓存；否则考虑是否每次都需要向服务器进行缓存有效确认，如果需要，那么设 Cache-Control 的值为 no-cache；否则考虑该资源是否可以被代理服务器缓存，根据其结果决定是设置为 private 还是 public；然后考虑该资源的过期时间，设置对应的 max-age 和 s-maxage 值；最后，配置协商缓存需要用到的 Etag、Last-Modified 等参数。

### Push Cachae

Push Cache 是指 HTTP2 在 server push 阶段存在的缓存。

Push Cache 是缓存的最后一道防线。浏览器只有在 Memory Cache、HTTP Cache 和 Service Worker Cache 均未命中的情况下才会去询问 Push Cache。

Push Cache 是一种存在于会话阶段的缓存，当 session 终止时，缓存也随之释放。

不同的页面只要共享了同一个 HTTP2 连接，那么它们就可以共享同一个 Push Cache。

CDN 了解一番

CDN 的核心点有两个，一个是缓存，一个是回源。

“缓存”就是说我们把资源 copy 一份到 CDN 服务器上这个过程，“回源”就是说 CDN 发现自己没有这个资源（一般是缓存的数据过期了），转头向根服务器（或者它的上层服务器）去要这个资源的过程。

CDN 往往被用来存放静态资源。所谓“静态资源”，就是像 JS、CSS、图片等不需要业务服务器进行计算即得的资源。而“动态资源”，顾名思义是需要后端实时动态生成的资源，较为常见的就是 JSP、ASP 或者依赖服务端渲染得到的 HTML 页面。

那“非纯静态资源”呢？它是指需要服务器在页面之外作额外计算的 HTML 页面。具体来说，当我打开某一网站之前，该网站需要通过权限认证等一系列手段确认我的身份、进而决定是否要把 HTML 页面呈现给我。这种情况下 HTML 确实是静态的，但它和业务服务器的操作耦合，我们把它丢到 CDN 上显然是不合适的。

另外，CDN 的域名必须和主业务服务器的域名不一样，要不，同一个域名下面的 Cookie 各处跑，浪费了性能流量的开销，CDN 域名放在不同的域名下，可以完美地避免了不必要的 Cookie 的出现！

## 加载优化

我们从输入 `URL` 到显示页面这个过程中，涉及到网络层面的，有三个主要过程：

1. DNS 解析
2. TCP 连接
3. HTTP 请求/响应

对于 DNS 解析和 TCP 连接两个步骤，我们前端可以做的努力非常有限。相比之下，HTTP 连接这一层面的优化才是我们网络优化的核心。

### HTTP资源优化：

- 减少请求次数
- 减少单次请求所花费的时间


### 图片优化

二进制位数与色彩的关系

在计算机中，像素用二进制数来表示。不同的图片格式中像素与二进制位数之间的对应关系是不同的。一个像素对应的二进制位数越多，它可以表示的颜色种类就越多，成像效果也就越细腻，文件体积相应也会越大。

一个二进制位表示两种颜色（0|1 对应黑|白），如果一种图片格式对应的二进制位数有 n 个，那么它就可以呈现 2^n 种颜色。

计算图片大小

对于一张 100 100 像素的图片来说，图像上有 10000 个像素点，如果每个像素的值是 RGBA 存储的话，那么也就是说每个像素有 4 个通道，每个通道 1 个字节（8 位 = 1 个字节），所以该图片大小大概为 39KB（10000 1 \* 4 / 1024）。

但是在实际项目中，一张图片可能并不需要使用那么多颜色去显示，我们可以通过减少每个像素的调色板来相应缩小图片的大小。
了解了如何计算图片大小的知识，那么对于如何优化图片，想必大家已经有 2 个思路了：

减少像素点

减少每个像素点能够显示的颜色

图片类型要点

- JPEG/JPG 特点：有损压缩、体积小、加载快、不支持透明,JPG 最大的特点是有损压缩。这种高效的压缩算法使它成为了一种非常轻巧的图片格式。另一方面，即使被称为“有损”压缩，JPG 的压缩方式仍然是一种高质量的压缩方式：当我们把图片体积压缩至原有体积的 50% 以下时，JPG 仍然可以保持住 60% 的品质。但当它处理矢量图形和 Logo 等线条感较强、颜色对比强烈的图像时，人为压缩导致的图片模糊会相当明显。

- PNG 特点：无损压缩、质量高、体积大、支持透明，PNG（可移植网络图形格式）是一种无损压缩的高保真的图片格式。8 和 24，这里都是二进制数的位数。按照我们前置知识里提到的对应关系，8 位的 PNG 最多支持 256 种颜色，而 24 位的可以呈现约 1600 万种颜色。PNG 图片具有比 JPG 更强的色彩表现力，对线条的处理更加细腻，对透明度有良好的支持。它弥补了上文我们提到的 JPG 的局限性，唯一的 BUG 就是体积太大。

- SVG 特点：文本文件、体积小、不失真、兼容性好，SVG（可缩放矢量图形）是一种基于 XML 语法的图像格式。它和本文提及的其它图片种类有着本质的不同：SVG 对图像的处理不是基于像素点，而是是基于对图像的形状描述。

- Base64 特点：文本文件、依赖编码、小图标解决方案，Base64 并非一种图片格式，而是一种编码方式。Base64 和雪碧图一样，是作为小图标解决方案而存在的。

- WebP 特点：年轻的全能型选手，WebP 像 JPEG 一样对细节丰富的图片信手拈来，像 PNG 一样支持透明，像 GIF 一样可以显示动态图片——它集多种图片文件格式的优点于一身。但是毕竟年轻，兼容性存在一些问题。

## 渲染优化

### 客户端渲染

在客户端渲染模式下，服务端会把渲染需要的静态文件发送给客户端，客户端加载过来之后，自己在浏览器里跑一遍 JS，根据 JS 的运行结果，生成相应的 DOM。页面上呈现的内容，你在 html 源文件里里找不到——这正是它的特点。

### 服务端渲染

在服务端渲染的模式下，当用户第一次请求页面时，由服务器把需要的组件或页面渲染成 HTML 字符串，然后把它返回给客户端。页面上呈现的内容，我们在 html 源文件里也能找到。服务端渲染解决了一个非常关键的性能问题——首屏加载速度过慢，也解决了 SEO 搜索引擎的问题。

浏览器渲染过程解析

浏览器的渲染机制一般分为以下几个步骤：

1. 处理 HTML 并构建 DOM 树。
2. 处理 CSS 构建 CSSOM 树
3. 将 DOM 与 CSSOM 合并成一个渲染树。
4. 根据渲染树来布局，计算每个节点的位置。
5. 调用 GPU 绘制，合成图层，显示在屏幕上。
6. 在渲染 DOM 的时候，浏览器所做的工作实际上是：
7. 获取 DOM 后分割为多个图层
8. 对每个图层的节点计算样式结果（Recalculate style–样式重计算）
9. 为每个节点生成图形和位置（Layout–回流和重布局）
10. 将每个节点绘制填充到图层位图中（Paint Setup 和 Paint–重绘）
11. 图层作为纹理上传至 GPU
12. 复合多个图层到页面上生成最终屏幕图像（Composite Layers–图层重组）

基于渲染流程的 CSS 优化建议

- CSS 选择符是从右到左进行匹配的，比如 #myList li {}实际开销相当高。
- 避免使用通配符，只对需要用到的元素进行选择。
- 关注可以通过继承实现的属性，避免重复匹配重复定义。
- 少用标签选择器。如果可以，用类选择器替代。错误：#dataList li{} 正确：.dataList{}
- 不要画蛇添足，id 和 class 选择器不应该被多余的标签选择器拖后腿。错误：.dataList#title 正确：#title
- 减少嵌套。后代选择器的开销是最高的，因此我们应该尽量将选择器的深度降到最低（最高不要超过三层），尽可能使用类来关联每一个标签元素。

### CSS 的阻塞

CSS 是阻塞的资源。浏览器在构建 CSSOM 的过程中，不会渲染任何已处理的内容。即便 DOM 已经解析完毕了，只要 CSSOM 不 OK，那么渲染这个事情就不 OK。我们将 CSS 放在 head 标签里 和尽快 启用 CDN 实现静态资源加载速度的优化。

### JS 的阻塞

JS 引擎是独立于渲染引擎存在的。我们的 JS 代码在文档的何处插入，就在何处执行。当 HTML 解析器遇到一个 script 标签时，它会暂停渲染过程，将控制权交给 JS 引擎。JS 引擎对内联的 JS 代码会直接执行，对外部 JS 文件还要先获取到脚本、再进行执行。等 JS 引擎运行完毕，浏览器又会把控制权还给渲染引擎，继续 CSSOM 和 DOM 的构建。

### DOM 渲染优化

先了解回流和重绘

回流：当我们对 DOM 的修改引发了 DOM 几何尺寸的变化（比如修改元素的宽、高或隐藏元素等）时，浏览器需要重新计算元素的几何属性（其他元素的几何属性和位置也会因此受到影响），然后再将计算的结果绘制出来。这个过程就是回流（也叫重排）。

重绘：当我们对 DOM 的修改导致了样式的变化、却并未影响其几何属性（比如修改了颜色或背景色）时，浏览器不需重新计算元素的几何属性、直接为该元素绘制新的样式（跳过了上图所示的回流环节）。这个过程叫做重绘。

重绘不一定导致回流，回流一定会导致重绘。回流比重绘做的事情更多，带来的开销也更大。在开发中，要从代码层面出发，尽可能把回流和重绘的次数最小化。

例子剖析

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="ie=edge" />
    <title>DOM操作测试</title>
  </head>
  <body>
    <div id="container"></div>
  </body>
</html>
```

```js
for (var count = 0; count < 10000; count++) {
  document.getElementById("container").innerHTML +=
    "<span>我是一个小测试</span>"; //我们每一次循环都调用 DOM 接口重新获取了一次 container 元素，额外开销
}
```

进化一：

```js
// 只获取一次 container
let container = document.getElementById("container");
for (let count = 0; count < 10000; count++) {
  container.innerHTML += "<span>我是一个小测试</span>";
}
```

进化二：

```js
//减少不必要的 DOM 更改
let container = document.getElementById("container");
let content = "";
for (let count = 0; count < 10000; count++) {
  // 先对内容进行操作
  content += "<span>我是一个小测试</span>";
}
// 内容处理好了,最后再触发 DOM 的更改
container.innerHTML = content;
```

事实上，考虑 JS 的运行速度，比 DOM 快得多这个特性。我们减少 DOM 操作的核心思路，就是让 JS 去给 DOM 分压。

在 DOM Fragment 中，DocumentFragment 接口表示一个没有父级文件的最小文档对象。它被当做一个轻量版的 Document 使用，用于存储已排好版的或尚未打理好格式的 XML 片段。因为 DocumentFragment 不是真实 DOM 树的一部分，它的变化不会引起 DOM 树的重新渲染的操作（reflow），且不会导致性能等问题。

进化三：

```js
let container = document.getElementById("container");
// 创建一个 DOM Fragment 对象作为容器
let content = document.createDocumentFragment();
for (let count = 0; count < 10000; count++) {
  // span 此时可以通过 DOM API 去创建
  let oSpan = document.createElement("span");
  oSpan.innerHTML = "我是一个小测试";
  // 像操作真实 DOM 一样操作 DOM Fragment 对象
  content.appendChild(oSpan);
}
// 内容处理好了,最后再触发真实 DOM 的更改
container.appendChild(content);
```

进化四：

当涉及到过万调数据进行渲染，而且要求不卡住画面，如何解决？
如何在不卡住页面的情况下渲染数据，也就是说不能一次性将几万条都渲染出来，而应该一次渲染部分 DOM，那么就可以通过 requestAnimationFrame 来每 16 ms 刷新一次。

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="ie=edge" />
    <title>Document</title>
  </head>
  <body>
    <ul>
      控件
    </ul>
    <script>
      setTimeout(() => {
        // 插入十万条数据
        const total = 100000;
        // 一次插入 20 条，如果觉得性能不好就减少
        const once = 20;
        // 渲染数据总共需要几次
        const loopCount = total / once;
        let countOfRender = 0;
        let ul = document.querySelector("ul");
        function add() {
          // 优化性能，插入不会造成回流
          const fragment = document.createDocumentFragment();
          for (let i = 0; i < once; i++) {
            const li = document.createElement("li");
            li.innerText = Math.floor(Math.random() * total);
            fragment.appendChild(li);
          }
          ul.appendChild(fragment);
          countOfRender += 1;
          loop();
        }
        function loop() {
          if (countOfRender < loopCount) {
            window.requestAnimationFrame(add);
          }
        }
        loop();
      }, 0);
    </script>
  </body>
</html>
```

window.requestAnimationFrame() 方法告诉浏览器您希望执行动画并请求浏览器在下一次重绘之前调用指定的函数来更新动画。该方法使用一个回调函数作为参数，这个回调函数会在浏览器重绘之前调用。

注意：若您想要在下次重绘时产生另一个动画画面，您的回调例程必须调用

```js
requestAnimationFrame()。
```

### Event Loop

我们先了解 javascript 运行机制，对渲染是大有帮助的。

事件循环中的异步队列有两种：macro（宏任务）队列和 micro（微任务）队列。

常见的 macro-task 比如：setTimeout、setInterval、 setImmediate、script（整体代码）、 I/O 操作、UI 渲染等。
常见的 micro-task 比如: process.nextTick、Promise、MutationObserver 等。

例子分析：

// task 是一个用于修改 DOM 的回调
setTimeout(task, 0)

上面代码，现在 task 被推入的 macro 队列。但因为 script 脚本本身是一个 macro 任务，所以本次执行完 script 脚本之后，下一个步骤就要去处理 micro 队列了，再往下就去执行了一次 render,必须等待下一次的 loop。

Promise.resolve().then(task)

上面代码，我们结束了对 script 脚本的执行，是不是紧接着就去处理 micro-task 队列了？micro-task 处理完，DOM 修改好了，紧接着就可以走 render 流程了——不需要再消耗多余的一次渲染，不需要再等待一轮事件循环，直接为用户呈现最即时的更新结果。

上面说了重绘与回流，Event loop，但很多人不知道的是，重绘和回流其实和 Event loop 有关。

当 Event loop 执行完 Microtasks 后，会判断 document 是否需要更新。因为浏览器是 60Hz 的刷新率，每 16ms 才会更新一次。

然后判断是否有 resize 或者 scroll ，有的话会去触发事件，所以 resize 和 scroll 事件也是至少 16ms 才会触发一次，并且自带节流功能。

判断是否触发了 media query

更新动画并且发送事件

判断是否有全屏操作事件

执行 requestAnimationFrame 回调

执行 IntersectionObserver 回调，该方法用于判断元素是否可见，可以用于懒加载上，但是兼容性不好

更新界面

以上就是一帧中可能会做的事情。如果在一帧中有空闲时间，就会去执行 requestIdleCallback 回调。

## 项目性能优化

### 1. 编码优化

编码优化，指的就是 在代码编写时的，通过一些 **最佳实践**，提升代码的执行性能。通常这并不会带来非常大的收益，但这属于 **程序猿的自我修养**，而且这也是面试中经常被问到的一个方面，考察自我管理与细节的处理。

- **数据读取**:

  - 通过作用域链 / 原型链 读取变量或方法时，需要更多的耗时，且越长越慢；
  - 对象嵌套越深，读取值也越慢； - **最佳实践**:
  - 尽量在局部作用域中进行 **变量缓存**；
  - 避免嵌套过深的数据结构，**数据扁平化** 有利于数据的读取和维护；

- **循环**: 循环通常是编码性能的关键点；

  - 代码的性能问题会再循环中被指数倍放大；
  - **最佳实践**:

    - 尽可能 **减少循环次数**；
    - 减少遍历的数据量；
    - 完成目的后马上结束循环；
    - 避免在循环中执行大量的运算，避免重复计算，相同的执行结果应该使用缓存；
    - js 中使用 **倒序循环** 会略微提升性能；
    - 尽量避免使用 for-in 循环，因为它会枚举原型对象，耗时大于普通循环；
- **条件流程性能**: Map / Object > switch > if-else

```js
// 使用 if-else
if (type === 1) {
} else if (type === 2) {
} else if (type === 3) {
}

// 使用 switch
switch (type) {
  case 1:
    break;
    4;
  case 2:
    break;
  case 3:
    break;
  default:
    break;
}

// 使用 Map
const map = new Map([
  [1, () => {}],
  [2, () => {}],
  [3, () => {}],
]);
map.get(type)();

// 使用 Objext
const obj = {
  1: () => {},
  2: () => {},
  3: () => {},
};
obj[type]();
```

- **减少 cookie 体积**: 能有效减少每次请求的体积和响应时间；
  - 去除不必要的 cookie；
  - 压缩 cookie 大小；
  - 设置 domain 与 过期时间；

- **dom 优化**:
  - **减少访问 dom 的次数**，如需多次，将 dom 缓存于变量中；
  - **减少重绘与回流**:
    - 多次操作合并为一次；
    - 减少对计算属性的访问；
      - 例如 offsetTop， getComputedStyle 等
      - 因为浏览器需要获取最新准确的值，因此必须立即进行重排，这样会破坏了浏览器的队列整合，尽量将值进行缓存使用；
    - 大量操作时，可将 dom 脱离文档流或者隐藏，待操作完成后再重新恢复；
  - 使用`DocumentFragment / cloneNode / replaceChild`进行操作； - 使用事件委托，避免大量的事件绑定；

- **css 优化**:
  - **层级扁平**，避免过于多层级的选择器嵌套；
  - **特定的选择器** 好过一层一层查找: .xxx-child-text{} 优于 .xxx .child .text{}
  - **减少使用通配符与属性选择器**；
  - **减少不必要的多余属性**；
  - 使用 **动画属性** 实现动画，动画时脱离文档流，开启硬件加速，优先使用 css 动画；
  - 使用 `<link>` 替代原生 @import；

- **html 优化**: - **减少 dom 数量**，避免不必要的节点或嵌套； - **避免`<img src="" />`空标签**，能减少服务器压力，因为 src 为空时，浏览器仍然会发起请求 - IE 向页面所在的目录发送请求； - Safari、Chrome、Firefox 向页面本身发送请求； - Opera 不执行任何操作。 - 图片提前 **指定宽高** 或者 **脱离文档流**，能有效减少因图片加载导致的页面回流； - **语义化标签** 有利于 SEO 与浏览器的解析时间；
  - 减少使用 table 进行布局，避免使用`<br />`与`<hr />`；

### 2. 页面基础优化

- **引入位置**: css 文件`<head>`中引入， js 文件`<body>`底部引入； - 影响首屏的，优先级很高的 js 也可以头部引入，甚至内联；
- **减少请求** (http 1.0 - 1.1)，合并请求，正确设置 http 缓存；
- **减少文件体积**:
  - **删除多余代码**:
    - tree-shaking
    - UglifyJs
    - code-spliting
  - **混淆 / 压缩代码**，开启 gzip 压缩；
  - **多份编译文件按条件引入**:
    - 针对现代浏览器直接给 ES6 文件，只针对低端浏览器引用编译后的 ES5 文件；
    - 可以利用`<script type="module"> / <script type="module">`进行条件引入用
  - **动态 polyfill**，只针对不支持的浏览器引入 polyfill；

- **图片优化**:
  - 根据业务场景，与 UI 探讨选择 **合适质量，合适尺寸**；
  - 根据需求和平台，选择 **合适格式**，例如非透明时可用 jpg；非苹果端，使用 webp；
  - 小图片合成 **雪碧图**，低于 5K 的图片可以转换成 **base64** 内嵌；
  - 合适场景下，使用 **iconfont** 或者 **svg**；

- **使用缓存**:
  - **浏览器缓存**: 通过设置请求的过期时间，合理运用浏览器缓存；
  - **CDN 缓存**: 静态文件合理使用 CDN 缓存技术；
  - HTML 放于自己的服务器上；
  - 打包后的图片 / js / css 等资源上传到 CDN 上，文件带上 hash 值；
  - 由于浏览器对单个域名请求的限制，可以将资源放在多个不同域的 CDN 上，可以绕开该限制；
  - **服务器缓存**: 将不变的数据、页面缓存到 内存 或 远程存储(redis 等) 上；
  - **数据缓存**: 通过各种存储将不常变的数据进行缓存，缩短数据的获取时间；

### 3. 首屏渲染优化

- **css / js 分割**，使首屏依赖的文件体积最小，内联首屏关键 css / js；
- 非关键性的文件尽可能的 **异步加载和懒加载**，避免阻塞首页渲染；
- 使用`dns-prefetch / preconnect / prefetch / preload`等浏览器提供的资源提示，加快文件传输；
- 谨慎控制好 **Web 字体**，一个大字体包足够让你功亏一篑； - 控制字体包的加载时机； - 如果使用的字体有限，那尽可能只将使用的文字单独打包，能有效减少体积；
- 合理利用 Localstorage / server-worker 等存储方式进行 **数据与资源缓存**；
- **分清轻重缓急**:
  - 重要的元素优先渲染；
  - 视窗内的元素优先渲染；
- **服务端渲染(SSR)**:
  - 减少首屏需要的数据量，剔除冗余数据和请求；
  - 控制好缓存，对数据/页面进行合理的缓存；
  - 页面的请求使用流的形式进行传递；
- **优化用户感知**:
  - 利用一些动画 **过渡效果**，能有效减少用户对卡顿的感知；
  - 尽可能利用 **骨架屏(Placeholder) / Loading** 等减少用户对白屏的感知；
  - 动画帧数尽量保证在 **30 帧** 以上，低帧数、卡顿的动画宁愿不要；
  - js 执行时间避免超过 **100ms**，超过的话就需要做:
  - 寻找可 缓存 的点；
  - 任务的 分割异步 或 web worker 执行；

参考
[浏览器工作原理-渲染流程篇](https://juejin.im/post/6847902222349500430#heading-8)
[如何记录加载一个页面的时间](https://www.jianshu.com/p/5b16732ab68f)
[Chrome First Point](http://eux.baidu.com/blog/fe/Chrome%E7%9A%84First%20Paint)
[](https://www.cnblogs.com/wangyongjie/p/chrome-devtools-mian-ban-quan-gong-lue.html)