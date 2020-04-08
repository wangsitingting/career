// 配置文件内容
export default {
  // 配置项
  title: 'Drex Career',
  mode: 'site',
  favicon: '/logo.svg',
  logo: '/logo.svg',
  // 单语言配置方式如下
  navs: [
    null, // null 值代表保留约定式生成的导航，只做增量配置
    {
      title: 'GitHub',
      path: 'https://github.com/idrex/career',
    },
  ],
  resolve: {
    includes: ['']
  },
  extraBabelPlugins: [
    [
      'import',
      {
        libraryName: 'antd',
        libraryDirectory: 'es',
        style: 'css',
      },
    ],
  ],
};