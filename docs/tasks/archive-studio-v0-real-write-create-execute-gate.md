# 任务：Archive Studio v0 真实 v2 Music create smoke test 显式执行 gate

创建日期：2026-06-17
状态：已完成

## 1. 目标

定义从只读计划模式进入真实 create + rollback smoke test 前必须满足的显式执行 gate。

本任务只做 gate 设计，不实现真实写入脚本，不执行真实写入，不创建真实 entry，不修改 ArchiveData-v2、OneDrive Data、`public/data` 或 Git 状态。

## 2. 背景

当前已具备：

- create preflight checklist；
- create preflight checker；
- smoke test 执行边界；
- smoke test 只读计划 runner；
- transaction sandbox 和失败场景自检；
- v2 Music shape 检查；
- dry-run manifest 和 blocked 场景自检。

下一步如果要进入真实写入，必须有一个硬性的 `--execute` gate，避免计划脚本或普通检查脚本误写真实 ArchiveData-v2。

## 3. Gate 总则

真实执行必须同时满足三个条件：

1. 用户在当前任务中明确授权真实 create + rollback smoke test；
2. 命令显式包含 `--execute`；
3. 命令显式包含与授权一致的 entry id。

缺少任一条件，脚本必须只输出计划或直接停止，不得写真实 ArchiveData-v2。

## 4. 授权文本

真实执行前，用户授权文本应包含：

```text
授权执行 Archive Studio v0 真实 v2 Music create + rollback smoke test，
payload 使用 docs/examples/archive-studio-v0-music-album-payload.sample.json，
entry id 为 archive-studio-sandbox-album，
允许写入并随后回滚 ArchiveData-v2/entries/music/album/archive-studio-sandbox-album，
不修改 OneDrive Data，不修改 public/data，不运行 build_archive.py，不运行发布脚本。
```

如果用户没有明确允许 rollback，不应执行真实写入。

如果用户要求保留 smoke test entry，应另立任务，不使用本 gate。

## 5. 推荐命令形态

未来真实执行脚本建议使用新的脚本名，不复用只读 plan runner：

```powershell
node scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs --execute --entry-id archive-studio-sandbox-album
```

建议默认 payload：

```text
docs/examples/archive-studio-v0-music-album-payload.sample.json
```

如果允许自定义 payload，payload 路径必须是项目内 JSON，且 entry id 必须与 payload id 一致。

## 6. 执行前强制检查

真实执行脚本在写入前必须按顺序执行或复核：

1. `git status --short --branch`
2. `node scripts/check-archive-studio-v0-real-write-create-preflight.mjs`
3. `node scripts/plan-archive-studio-v0-real-write-create-smoke-test.mjs`
4. `node scripts/check-archive-data-v2-music-shape.mjs`
5. `node scripts/check-archive-studio-v0-transaction-sandbox.mjs`

任何一项失败，停止。

如果 Git 状态有未提交变更，必须判断是否为本轮预期变更。无法解释时停止。

## 7. 允许写入范围

第一轮真实执行只允许写：

```text
entries/music/album/archive-studio-sandbox-album/entry.yaml
entries/music/album/archive-studio-sandbox-album/content.md
entries/music/album/archive-studio-sandbox-album/cover.jpg
entries/music/album/archive-studio-sandbox-album/audio.mp3
migration/archive-studio-v0/transactions/<transaction-id>/preview.json
migration/archive-studio-v0/transactions/<transaction-id>/write.json
migration/archive-studio-v0/transactions/<transaction-id>/rollback.json
```

所有路径必须按真实 ArchiveData-v2 根目录计算，并通过 allowlist 校验。

manifest 中只能保存相对路径、角色、操作、字节数、checksum 和命令摘要，不得保存完整本机路径。

## 8. 禁止范围

真实执行 gate 必须阻止：

- 任何非 `create` mode；
- 任何非 `music/album` board/kind；
- 任何非指定 entry id；
- 目标 entry 已存在时继续写入；
- 覆盖现有文件；
- 修改旧 OneDrive Data；
- 修改 `public/data`；
- 修改 `src/data`；
- 修改缓存或 reports；
- 运行 `build_archive.py`；
- 运行发布脚本；
- Git add / commit / push；
- 写入后自动保留 smoke test entry；
- rollback 时删除 manifest 以外的文件。

## 9. 写入过程要求

真实执行应分为：

1. preflight；
2. plan；
3. stage in memory 或系统临时目录；
4. apply create；
5. 写 transaction manifest；
6. 运行验收；
7. rollback；
8. rollback 后再次验收；
9. 输出 summary。

每一步失败都必须停止，并输出：

- 阶段名；
- 失败规则；
- 已写入文件数量；
- 是否需要人工 rollback；
- 不输出完整本机路径或正文。

## 10. 回滚要求

第一轮 smoke test 必须自动 rollback，除非用户另立任务明确要求保留。

rollback 只允许删除本次 write manifest 中 `operation=create` 的目标文件。

rollback 后允许删除空的目标 entry 目录。

rollback 后必须运行：

```powershell
node scripts/check-archive-data-v2-music-shape.mjs
```

如果 rollback 后检查失败，停止并汇报，不自动二次修复。

## 11. 写入后验收

真实执行完成并 rollback 后，必须运行：

```powershell
node scripts/check-archive-data-v2-music-shape.mjs
node scripts/generate-archive-data-v2-music-live-compatible-preview.mjs
node scripts/check-generated-data-privacy.mjs
git status --short --branch
```

验收只汇报：

- create 写入数量；
- manifest 写入数量；
- rollback 删除数量；
- rollback 恢复数量；
- shape / preview / privacy 检查结果；
- Git 状态。

## 12. 成功标准

一次真实 create + rollback smoke test 成功应证明：

- `--execute` gate 生效；
- entry id gate 生效；
- allowlist 生效；
- create 写入只进入一个新 entry；
- transaction manifest 记录完整；
- rollback 删除本次创建内容；
- rollback 后 v2 Music shape 仍通过；
- OneDrive Data、`public/data`、`src/data`、`build_archive.py` 和发布流程未被触碰。

## 13. 回退方式

本任务只是 Markdown 设计，回退方式：

- 删除本任务文档；
- 回退 `CURRENT_STATE.md` 和 `docs/plans/STABILIZATION_PLAN.md` 中对应状态记录。

## 14. 下一步建议

下一步只建议实现真实 create + rollback smoke test runner，但默认仍必须停在计划模式。

只有在命令包含 `--execute` 且用户在当前任务中明确授权时，才允许执行真实 create + rollback。
