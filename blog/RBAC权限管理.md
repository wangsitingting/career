# RBAC权限管理(Resource-Based Access Control)

当说到程序的权限管理时，人们往往想到角色这一概念。角色是代表一系列可执行的操作或责任的实体，用于限定你在软件系统中能做什么、不能做什么。用户帐号往往与角色相关联，因此，一个用户在软件系统中能做什么取决于与之关联的各个角色。

例如，一个用户以关联了”项目管理员”角色的帐号登录系统，那这个用户就可以做项目管理员能做的所有事情――如列出项目中的应用、管理项目组成员、产生项目报表等。

从这个意义上来说，角色更多的是一种行为的概念：它表示用户能在系统中进行的操作。

既然角色代表了可执行的操作这一概念，一个合乎逻辑的做法是在软件开发中使用角色来控制对软件功能和数据的访问。你可能已经猜到，这种权限控制方法就叫基于角色的访问控制(Role-Based Access Control)，或简称为RBAC。


[参考](https://my.oschina.net/zjllovecode/blog/1601157)
