# Archive Studio v0 Games API

创建日期：2026-06-20
状态：临时目录集成测试已通过

## 目标

为 Games `normal_game` 新建提供本机 preview、preflight、一次性 token create 和写后 shape check。

## 安全边界

- 服务只监听本机；
- profile 只声明 normal_game create；
- 不提供 DLC、live game、season、update、delete 或 publish；
- cover 必须 multipart 上传且文件名与 preview payload 一致；
- preflight token 与 payload 指纹绑定并只可使用一次；
- 目标冲突时阻断，不覆盖；
- create 失败自动删除本次文件和事务目录；
- 写后核对 Games v2 shape 和旧源快照。

## 验证覆盖

- profile 与 publish false；
- preview 与缺 cover 阻断；
- token create 与重放阻断；
- 目标冲突阻断；
- 注入 manifest 写入故障后的 rollback；
- Games v2 写后检查；
- 旧源不变；
- publish 路由不存在；
- Music、Texts、Visions API 回归。

## 回退

删除 Games preview、gate、create、server check 与 server 中 Games 路由；不影响现有三个 board 的 API。
