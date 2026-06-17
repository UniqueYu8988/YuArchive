# 任务：Archive Studio v0 真实 v2 Music create + rollback smoke test runner 默认计划模式

创建日期：2026-06-17
状态：已完成

## 1. 目标

建立真实 v2 Music create + rollback smoke test 的 runner 入口，但本轮只启用默认计划模式。

该 runner 用于统一未来真实执行入口；当前不会写真实 ArchiveData-v2，不会创建 entry，不会创建 transaction manifest。

## 2. 本次范围

- 新增 `scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs`。
- 默认复用 `scripts/plan-archive-studio-v0-real-write-create-smoke-test.mjs` 的计划结果。
- 支持 `--payload` 和 `--entry-id` 参数用于计划核对。
- 如果传入 `--execute`，本轮明确阻断并输出 `execute_mode_not_enabled_in_plan_runner`。

## 3. 明确不做

- 不写真实 ArchiveData-v2 输出。
- 不创建或删除真实 entry。
- 不创建 transaction manifest。
- 不创建 backup、staging 或 rollback 文件。
- 不修改 OneDrive Data。
- 不修改 `public/data`、`src/data`、缓存或 reports。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不执行 Git 操作。
- 不接前端 UI。

## 4. 使用方式

默认计划模式：

```powershell
node scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs
```

带 entry id 核对：

```powershell
node scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs --entry-id archive-studio-sandbox-album
```

传入 `--execute` 时，本轮仍会阻断：

```powershell
node scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs --execute --entry-id archive-studio-sandbox-album
```

期望输出 `executeImplemented: false` 和 `writeScope: none`。

## 5. 输出规则

runner 只输出：

- 模式；
- payload 相对路径；
- entry id；
- requested entry id；
- scope；
- transaction id；
- 计划写入文件数量；
- 计划 transaction 文件数量；
- rollback 计数；
- 写入后检查数量；
- blocked reason 规则名；
- `executeImplemented: false`；
- `writeScope: none`。

不输出完整本机路径、账号、密钥、token、正文或媒体内容。

## 6. 验证方式

运行：

```powershell
node scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs
node scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs --entry-id archive-studio-sandbox-album
node scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs --execute --entry-id archive-studio-sandbox-album
node scripts/plan-archive-studio-v0-real-write-create-smoke-test.mjs
node scripts/check-archive-studio-v0-real-write-create-preflight.mjs
```

期望：

- 默认计划模式通过；
- 指定正确 entry id 时通过；
- `--execute` 被阻断且不写真实数据；
- plan runner 和 preflight checker 仍通过。

## 7. 回退方式

- 删除 `scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs`。
- 删除本任务文档。
- 回退 `CURRENT_STATE.md` 和 `docs/plans/STABILIZATION_PLAN.md` 中对应状态记录。

## 8. 下一步建议

下一步只建议为该 runner 增加真实执行实现，但仍必须保持三重 gate：

- 当前任务用户明确授权；
- 命令包含 `--execute`；
- 命令指定的 entry id 与 payload id 一致。

真实执行实现完成前，runner 必须继续保持 `executeImplemented: false`。
