# Archive Studio Texts Create + Rollback Smoke Test

创建日期：2026-06-20
状态：真实 create + rollback 已通过

## 目标

在真实 Archive 中临时创建一个 `texts/article`，运行 Texts v2 检查，再根据事务回退清单完整删除临时条目和事务文件。

## 边界

- 只写一个唯一的临时 Texts 条目和对应事务目录；
- 不修改旧 OneDrive Data；
- 不运行 `build_archive.py`；
- 不生成 `public/data`；
- 不发布，不执行 Git push；
- 不保留 smoke test 收藏内容。

## 安全门槛

- 默认运行仅输出计划，写入范围为 `none`；
- 真实执行需要 `--execute` 和精确授权短语；
- 执行前要求真实 Texts v2 基线恰好为 132 个条目；
- create 复用 Archive Studio Texts create core；
- rollback 读取本次事务的 `rollback.json`；
- 回退后 Texts 必须恢复到 132 个条目；
- 回退后 Archive 文件快照和旧源文件快照必须与执行前一致。

## 验证

```powershell
node scripts/run-archive-studio-v0-texts-create-smoke-test.mjs
node scripts/run-archive-studio-v0-texts-create-smoke-test.mjs --execute --authorization "I authorize Archive Studio Texts create rollback smoke test"
node scripts/check-archive-data-v2-texts-shape.mjs
```

输出只包含文件数量、条目数量、回退状态和边界检查结果，不输出收藏正文或完整本机路径。

## 回退

runner 会在 `finally` 阶段读取本次事务回退清单并删除临时条目；若 OneDrive 同步短暂恢复文件，会再次清理并复核。任何回退残留都视为失败，停止后续任务并人工检查。

## 执行结果

- 临时 article 创建成功，Texts 条目数从 132 变为 133；
- 创建 2 个条目文件和 3 个事务文件；
- rollback 完成后 Texts 恢复为 132 个条目；
- Archive 文件快照恢复一致；
- 旧源侧核对 778 个文件，前后无变化；
- 未运行 `build_archive.py`，未生成 public JSON，未发布。

## UI 端到端补充验收

- 真实 `/studio/texts` 中文页面完成 article 表单、preview、preflight 和 create；
- 页面成功反馈确认创建 2 个条目文件、Texts 总数 133、结构检查通过、旧源未变化、发布未触发；
- 临时 UI 条目随后按本次事务 `rollback.json` 回退；
- 回退后 Texts 为 132，条目残留 0、事务残留 0；
- Archive 文件快照与旧源 778 个文件快照均恢复为执行前状态。
