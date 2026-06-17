# 任务：Archive Studio v0 真实 v2 Music create smoke test runner 只读计划模式

创建日期：2026-06-17
状态：已完成

## 1. 目标

实现真实 v2 Music create smoke test runner 的只读计划模式。

本任务仍不执行真实写入，只输出如果进入真实 create smoke test 将会写入哪些相对路径、创建哪些 transaction manifest、如何 rollback，以及写入后应运行哪些验收命令。

## 2. 本次范围

- 新增 `scripts/plan-archive-studio-v0-real-write-create-smoke-test.mjs`。
- 复用 create preflight checker。
- 复用真实 v2 写入 gate checker。
- 复用 dry-run manifest。
- 输出计划写入文件、transaction 文件、rollback 计数和写入后检查命令。

## 3. 明确不做

- 不写真实 ArchiveData-v2 输出。
- 不创建 entry。
- 不创建 transaction manifest。
- 不创建 backup、staging 或 rollback 文件。
- 不修改 OneDrive Data。
- 不修改 `public/data`、`src/data`、缓存或 reports。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不执行 Git 操作。
- 不接前端 UI。

## 4. 输出内容

计划模式输出：

- payload 相对路径；
- mode / board / kind；
- entry id；
- scope；
- transaction id；
- 计划写入的相对路径和角色；
- 计划创建的 transaction manifest 相对路径；
- rollback 删除 / 恢复计数；
- 写入后验收命令；
- blocked reason 规则名；
- `readyToRequestWrite`；
- `writeScope: none`。

脚本不输出完整本机路径、账号、密钥、token、正文或媒体内容。

## 5. 验证方式

运行：

```powershell
node scripts/plan-archive-studio-v0-real-write-create-smoke-test.mjs
node scripts/check-archive-studio-v0-real-write-create-preflight.mjs
node scripts/check-archive-studio-v0-real-write-dry-run-manifest.mjs
node scripts/check-archive-data-v2-music-shape.mjs
node scripts/check-archive-studio-v0-transaction-sandbox.mjs
```

期望：

- 默认 smoke test plan 通过；
- 计划写入文件为 4 个；
- transaction manifest 计划为 3 个；
- rollback 删除数为 4，恢复数为 0；
- 所有输出均为摘要和相对路径；
- 不写真实 v2 数据。

## 6. 回退方式

- 删除 `scripts/plan-archive-studio-v0-real-write-create-smoke-test.mjs`。
- 删除本任务文档。
- 回退 `CURRENT_STATE.md` 和 `docs/plans/STABILIZATION_PLAN.md` 中对应状态记录。

## 7. 下一步建议

下一步只建议在用户单独授权后执行一次受控真实 create + rollback smoke test，或先为该真实写入脚本增加显式 `--execute` gate。

真实执行前必须再次确认：不修改 OneDrive Data、不修改 `public/data`、不运行 `build_archive.py`、不运行发布脚本。
