# 任务：Archive Studio v0 真实 v2 Music create + rollback smoke test runner 执行结构

创建日期：2026-06-17
状态：已完成

## 1. 目标

在继续保持计划模式的前提下，为 smoke test runner 增加真实执行结构的摘要输出。

本任务不启用真实写入，只让 runner 明确未来执行必须经过哪些 gate 和阶段。

## 2. 本次范围

- 更新 `scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs`。
- 增加执行 gate 列表。
- 增加执行阶段列表。
- 继续保持 `executeImplemented: false`。
- 传入 `--execute` 时仍阻断，不写真实 Archive。

## 3. 明确不做

- 不写真实 Archive 输出。
- 不创建或删除真实 entry。
- 不创建 transaction manifest。
- 不创建 backup、staging 或 rollback 文件。
- 不修改 OneDrive Data。
- 不修改 `public/data`、`src/data`、缓存或 reports。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不执行 Git 操作。
- 不接前端 UI。

## 4. 执行 gate

runner 输出以下 gate：

| gate | 说明 |
|---|---|
| `current_task_user_authorized_execute` | 当前任务必须明确授权真实执行 |
| `execute_flag_present` | 命令必须包含 `--execute` |
| `entry_id_matches_payload` | 命令 entry id 必须与 payload id 一致 |
| `preflight_ready` | preflight 必须通过 |
| `target_entry_missing` | 目标 entry 必须不存在 |
| `write_scope_allowlisted` | 写入范围必须在单 entry allowlist 内 |

当前这些 gate 只作为计划输出；真实执行仍未启用。

## 5. 执行阶段

runner 输出以下阶段：

1. `preflight`
2. `plan`
3. `stage`
4. `apply_create`
5. `write_transaction_manifest`
6. `post_write_checks`
7. `rollback_created_files`
8. `post_rollback_checks`
9. `summary`

真实执行实现必须按该顺序推进，任一阶段失败都停止。

## 6. 验证方式

运行：

```powershell
node scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs
node scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs --entry-id archive-studio-sandbox-album
node scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs --execute --entry-id archive-studio-sandbox-album
node scripts/plan-archive-studio-v0-real-write-create-smoke-test.mjs
```

期望：

- 默认计划模式通过；
- 指定正确 entry id 时通过；
- `--execute` 仍被阻断；
- 输出 `executionGates` 和 `executionPhases`；
- `executeImplemented: false`；
- `writeScope: none`。

## 7. 回退方式

- 回退 `scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs` 中新增的 gate / phase 输出。
- 删除本任务文档。
- 回退 `CURRENT_STATE.md` 和 `docs/plans/STABILIZATION_PLAN.md` 中对应状态记录。

## 8. 下一步建议

下一步只建议设计真实执行实现的文件写入算法，仍先停留在文档或计划输出层。

在任务完全结束前继续保持计划模式；不得因为 runner 结构已存在就启用真实写入。
