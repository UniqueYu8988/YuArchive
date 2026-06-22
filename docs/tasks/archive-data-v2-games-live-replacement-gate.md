# Archive Games Live Replacement Gate

创建日期：2026-06-20
状态：already-current gate 已建立

## 目标

确认 Games v2 live-compatible preview 是否需要修改当前 `games.json` 或 `home.json`。零差异时明确返回 already-current，不重写文件。

## Gate

必须同时满足：

- 282 个条目与 40 个 season 全映射；
- required missing、字段、顺序、媒体和首页差异均为 0；
- 隐私命中 0；
- preview 与当前 `games.json` 语义相同；
- 首页 9 个 Games 引用与 preview 对应条目语义相同；
- 检查前后两个 public JSON 的 SHA-256 不变。

## 行为

- 全部满足：`gateState: already-current`、`allowedToWrite: false`、`writeScope: none`；
- 任一不满足：`blocked-review-required`；
- 本 gate 永不写 public JSON；
- 如果未来出现真实差异，必须先单独 review，再设计最小替换，不允许整文件静默重写。

## 验证

```powershell
node scripts/check-archive-data-v2-games-live-replacement-gate.mjs
```

## 回退

删除 gate 脚本和本任务文档即可。当前 public JSON 没有变化。
