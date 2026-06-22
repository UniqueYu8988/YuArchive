# 任务：Archive Studio v0 真实 v2 Music create 写入试点 preflight checker

创建日期：2026-06-17
状态：已完成

## 1. 目标

把 `docs/tasks/archive-studio-v0-real-write-create-preflight.md` 中的关键门槛自动化为一个只读 checker。

本任务仍不执行真实写入，只判断当前 payload 和真实 Archive Music 状态是否满足“可以请求进入真实 create 写入任务”的前置条件。

## 2. 本次范围

- 新增 `scripts/check-archive-studio-v0-real-write-create-preflight.mjs`。
- 复用真实 v2 写入 gate checker。
- 复用 dry-run manifest 生成逻辑。
- 检查 create / music / album / target missing / gate passed / dry-run passed / single entry scope / no backup / rollback draft 等条件。
- 输出外部仍需运行的验证命令清单。

## 3. 明确不做

- 不写真实 Archive 输出。
- 不写旧 OneDrive Data。
- 不写 `public/data`、`src/data`、缓存或 reports。
- 不创建 backup、write manifest 或 rollback manifest。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不接前端 UI。
- 不执行 Git 操作。

## 4. 检查规则

preflight checker 必须满足：

| 检查 | 说明 |
|---|---|
| `payload_mode_create` | payload 必须是 create |
| `payload_board_music` | board 必须是 music |
| `payload_kind_album` | kind 必须是 album |
| `target_entry_missing` | 目标 entry 当前不存在 |
| `gate_allows_request` | real write gate checker 未阻断 |
| `dry_run_passed` | dry-run manifest 状态为 passed |
| `single_entry_scope` | scope 只覆盖 `entries/music/album/<entry-id>` |
| `no_backup_for_create` | create 模式不应产生 backup 项 |
| `planned_writes_exist` | dry-run 中存在计划写入项 |
| `rollback_deletes_match_writes` | create 回滚删除数量与计划写入数量一致 |

checker 通过只表示可以请求进入真实写入任务，不等于已经执行或批准真实写入。

## 5. 输出规则

脚本只输出：

- payload 相对路径；
- entry id；
- scope；
- operation / backup / write / rollback 计数；
- blocked reason 规则名；
- 检查通过 / 失败数量；
- 失败检查名；
- 仍需人工或外部执行的验证命令。

脚本不输出完整本机路径、账号、密钥、token、正文或媒体内容。

## 6. 验证方式

运行：

```powershell
node scripts/check-archive-studio-v0-real-write-create-preflight.mjs
node scripts/check-archive-studio-v0-real-write-dry-run-manifest.mjs
node scripts/dry-run-archive-studio-v0-real-write-manifest.mjs
node scripts/check-archive-data-v2-music-shape.mjs
```

期望：

- 默认 create 样例通过 preflight；
- dry-run manifest 场景自检通过；
- 默认 dry-run manifest 通过；
- v2 Music shape 检查通过；
- 所有脚本都不写真实 v2 数据。

## 7. 回退方式

- 删除 `scripts/check-archive-studio-v0-real-write-create-preflight.mjs`。
- 删除本任务文档。
- 回退 `CURRENT_STATE.md` 和 `docs/plans/STABILIZATION_PLAN.md` 中对应状态记录。

## 8. 下一步建议

下一步只建议设计真实 create smoke test 的执行任务边界。

进入真实写入前仍必须由用户明确授权具体 payload、entry id、写入范围、验收命令和回退方式。
