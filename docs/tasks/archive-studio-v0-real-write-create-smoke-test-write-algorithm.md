# 任务：Archive Studio v0 真实 v2 Music create + rollback smoke test 文件写入算法

创建日期：2026-06-17
状态：已完成

## 1. 目标

设计真实 v2 Music create + rollback smoke test 的文件写入算法。

本任务只做算法设计，不实现真实写入，不创建真实 entry，不修改 ArchiveData-v2、OneDrive Data、`public/data` 或 Git 状态。

## 2. 本次范围

- 定义真实执行时如何从 plan 生成 staging items。
- 定义 create 写入的 allowlist 和原子性边界。
- 定义 transaction manifest 内容。
- 定义 rollback 删除策略。
- 定义失败阶段和人工恢复信息。
- 继续保持计划模式，不启用真实写入。

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

## 4. 输入

真实写入算法的输入应来自：

- project-local payload JSON；
- `buildSmokeTestPlan(payload)` 的 plan；
- create preflight checker 结果；
- 当前真实 ArchiveData-v2 Music 状态；
- 用户授权和命令行 gate。

第一轮只允许默认样例：

```text
docs/examples/archive-studio-v0-music-album-payload.sample.json
```

目标 entry：

```text
archive-studio-sandbox-album
```

## 5. 输出

如果未来启用真实执行，算法只允许创建：

```text
entries/music/album/archive-studio-sandbox-album/entry.yaml
entries/music/album/archive-studio-sandbox-album/content.md
entries/music/album/archive-studio-sandbox-album/cover.jpg
entries/music/album/archive-studio-sandbox-album/audio.mp3
migration/archive-studio-v0/transactions/<transaction-id>/preview.json
migration/archive-studio-v0/transactions/<transaction-id>/write.json
migration/archive-studio-v0/transactions/<transaction-id>/rollback.json
```

本任务不创建这些文件。

## 6. Staging 算法

未来执行时，staging 应先在内存或系统临时目录中完成。

步骤：

1. 从 payload 生成 `entry.yaml` 文本。
2. 从 payload 生成 `content.md` 文本。
3. 从 payload asset metadata 生成 smoke test 用占位 cover 内容。
4. 从 payload asset metadata 生成 smoke test 用占位 audio 内容。
5. 为 4 个 staging item 计算 bytes 和 checksum。
6. 校验 staging item 的目标相对路径全部来自 plan。
7. 校验 staging item 不包含完整本机路径、token 或 secret-like marker。

第一轮 smoke test 可使用占位二进制或文本内容；不得读取旧 Music 源媒体，也不得复制 OneDrive Data 中的真实媒体。

## 7. Allowlist 算法

写入前必须构造 allowlist。

allowlist 只来自 plan：

- 4 个 entry 文件；
- 3 个 transaction manifest 文件。

算法要求：

- 每个目标路径必须是相对路径；
- 不允许 `..`；
- 不允许绝对路径；
- 不允许反斜杠逃逸；
- 解析后的真实路径必须在真实 ArchiveData-v2 根目录内；
- entry 文件必须在 `entries/music/album/<entry-id>/` 内；
- manifest 文件必须在 `migration/archive-studio-v0/transactions/<transaction-id>/` 内；
- entry id 必须与 payload id 和命令行 `--entry-id` 一致。

任何不在 allowlist 中的路径都不得写入或删除。

## 8. Apply create 算法

create 写入必须是窄范围、可回滚的。

建议顺序：

1. 确认目标 entry 目录不存在。
2. 创建目标 entry 目录。
3. 写入 `entry.yaml`。
4. 写入 `content.md`。
5. 写入 `cover.jpg`。
6. 写入 `audio.mp3`。
7. 写入 `preview.json`。
8. 写入 `write.json`。
9. 写入 `rollback.json`。
10. 逐项重新读取并校验 checksum。

如果第 2 到第 9 步任一步失败，必须输出 partial summary，并提示执行 rollback；不得继续写其他文件。

## 9. Manifest 算法

manifest 必须只记录相对路径和摘要。

`preview.json` 应记录：

- transaction id；
- mode / board / kind；
- entry id；
- scope；
- planned write file roles；
- planned transaction files；
- gate 摘要；
- post-write checks。

`write.json` 应记录：

- transaction id；
- created files；
- role；
- relative path；
- bytes；
- checksum；
- operation: `create`。

`rollback.json` 应记录：

- transaction id；
- files eligible for deletion；
- deletion order；
- empty entry directory cleanup rule；
- post-rollback check commands。

manifest 禁止记录完整本机路径、OneDrive 真实路径、账号、密钥、token 或正文。

## 10. Rollback 算法

第一轮 smoke test 必须自动 rollback。

rollback 顺序：

1. 读取 `write.json`。
2. 校验 transaction id。
3. 只选择 `operation=create` 的文件。
4. 按写入顺序的反向删除 entry 文件。
5. 删除空的目标 entry 目录。
6. 保留 transaction manifest，或写入 rollback summary。
7. 运行 v2 Music shape 检查。

rollback 禁止：

- 删除非 manifest 记录文件；
- 删除既有 Music entry；
- 删除整个 `entries/music/album`；
- 修改 OneDrive Data；
- 修改 `public/data`；
- 运行 `build_archive.py`。

## 11. 失败处理

| 阶段 | 处理 |
|---|---|
| preflight 失败 | 不写任何文件 |
| plan 失败 | 不写任何文件 |
| staging 失败 | 删除 staging，停止 |
| allowlist 失败 | 不写任何文件 |
| entry 目录已存在 | 不写任何文件 |
| 写入部分失败 | 输出 partial summary，提示 rollback |
| manifest 写入失败 | 输出已创建 entry 文件数量，提示 rollback |
| post-write check 失败 | 不自动修复，执行或提示 rollback |
| rollback 失败 | 输出残留文件相对路径和人工处理建议 |

失败输出不得包含完整本机路径或正文。

## 12. 验收方式

本设计任务的验证仍只运行计划模式：

```powershell
node scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs
node scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs --execute --entry-id archive-studio-sandbox-album
node scripts/plan-archive-studio-v0-real-write-create-smoke-test.mjs
node scripts/check-archive-data-v2-music-shape.mjs
```

期望：

- 计划模式通过；
- `--execute` 仍被阻断；
- `executeImplemented: false`；
- `writeScope: none`；
- v2 Music shape 仍通过。

## 13. 回退方式

本任务只是 Markdown 设计，回退方式：

- 删除本任务文档；
- 回退 `CURRENT_STATE.md` 和 `docs/plans/STABILIZATION_PLAN.md` 中对应状态记录。

## 14. 下一步建议

下一步只建议在 runner 中加入写入算法的 dry-run execution manifest 输出，继续保持 `executeImplemented: false`。

不得在下一步直接启用真实写入。

## 15. 2026-06-19 实现状态

本算法已在 `scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs` 中实现，并通过系统临时沙箱自检：

- create entry：1；
- post-write shape check：通过；
- rollback entry：0；
- residual files：0；
- injected partial write rollback：通过；
- source metadata：未变化；
- 错误授权：阻断。

真实 ArchiveData-v2 尚未执行。常驻保存 API 仍未启用。
