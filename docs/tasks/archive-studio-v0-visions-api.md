# Archive Studio Visions API

创建日期：2026-06-20
状态：已完成

## 目标

为普通 movie / series 新建提供本机 preview、preflight、create 和 shape check API。

## 安全边界

- 只监听 localhost；
- profiles 明确 publish=false、update=false；
- create 需要一次性、限时、绑定 payload 的 token；
- 只接受 poster multipart；
- 写入范围限定为一个新条目和一个事务目录；
- 不覆盖目标；
- 写后检查 Visions v2；
- 旧源快照变化时失败；
- create 失败自动回退；
- 不提供发布路由。

## 验证

```powershell
node scripts/check-archive-studio-v0-visions-preview-core.mjs
node scripts/check-archive-studio-v0-visions-server.mjs
```

测试只写系统临时目录。

## 结果

- movie / series preview 通过；
- 缺 poster 和非法 period 正确阻断；
- profiles、preflight token、multipart create 通过；
- token replay、目标冲突正确阻断；
- manifest 写入故障触发完整 rollback；
- Visions v2 写后检查与旧源不变检查通过；
- Music 与 Texts API 回归通过；
- publish route 不存在。
