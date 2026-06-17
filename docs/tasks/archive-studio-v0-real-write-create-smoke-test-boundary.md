# 任务：Archive Studio v0 真实 v2 Music create smoke test 执行边界

创建日期：2026-06-17
状态：已完成

## 1. 目标

定义第一轮真实 ArchiveData-v2 Music create smoke test 的执行边界。

本任务仍只做执行设计，不执行真实写入，不创建真实 entry，不修改 ArchiveData-v2、OneDrive Data、`public/data` 或 Git 状态。

## 2. 背景

当前已经具备：

- 真实 v2 写入 approval gate 设计；
- 只读 real write gate checker；
- gate checker 场景自检；
- 只读 dry-run manifest；
- dry-run manifest 场景自检；
- create preflight checklist；
- create preflight checker。

这些只能证明“可以请求进入真实写入任务”。真正写入 ArchiveData-v2 仍必须是单独授权任务。

## 3. 试点原则

第一轮真实写入必须是 smoke test，不是正式维护功能上线。

原则：

- 只允许 `mode=create`；
- 只允许 `board=music`；
- 只允许 `kind=album`；
- 一次只创建 1 个测试 entry；
- 不覆盖现有 33 个 Music 迁移条目；
- 不修改旧 OneDrive Data；
- 不修改 `public/data/music.json`；
- 不运行 `build_archive.py`；
- 不运行发布脚本；
- 不接前端 UI；
- 不自动进入 update 流程；
- 不自动把 smoke test entry 暴露到公开网页。

## 4. 推荐 smoke test payload

第一轮建议继续使用项目内样例 payload：

```text
docs/examples/archive-studio-v0-music-album-payload.sample.json
```

当前样例目标 entry id：

```text
archive-studio-sandbox-album
```

进入真实写入前必须再次确认：

- preflight checker 通过；
- 目标 entry 当前不存在；
- write scope 只包含 `entries/music/album/<entry-id>`；
- dry-run manifest 计划写入项与 create rollback 删除项数量一致；
- create 模式 backup 项为 0。

## 5. 用户授权文本

真实写入任务开始前，用户授权文本应类似：

```text
授权执行 Archive Studio v0 真实 v2 Music create smoke test，
payload 使用 docs/examples/archive-studio-v0-music-album-payload.sample.json，
只允许创建 ArchiveData-v2/entries/music/album/archive-studio-sandbox-album，
不修改 OneDrive Data，不修改 public/data，不运行 build_archive.py，不运行发布脚本，不 push。
```

如果用户希望写入后自动提交 Git，必须另行明确说明。第一轮 smoke test 默认不需要 Git 写操作，因为真实 v2 输出位于项目仓库外。

## 6. 执行前命令

真实写入前必须按顺序运行：

```powershell
git status --short --branch
node scripts/check-archive-studio-v0-real-write-create-preflight.mjs
node scripts/check-archive-studio-v0-real-write-dry-run-manifest.mjs
node scripts/dry-run-archive-studio-v0-real-write-manifest.mjs
node scripts/check-archive-data-v2-music-shape.mjs
node scripts/check-archive-studio-v0-transaction-sandbox.mjs
```

任何失败都停止，不写真实 ArchiveData-v2。

## 7. 真实写入允许范围

如果进入真实写入任务，第一轮只允许创建：

```text
entries/music/album/archive-studio-sandbox-album/entry.yaml
entries/music/album/archive-studio-sandbox-album/content.md
entries/music/album/archive-studio-sandbox-album/cover.<ext>
entries/music/album/archive-studio-sandbox-album/audio.<ext>
```

以及 transaction 记录目录中的 manifest 文件。

manifest 建议放在：

```text
migration/archive-studio-v0/transactions/<transaction-id>/
```

真实写入脚本必须只使用相对路径摘要，不在 manifest 中记录完整本机路径。

## 8. 禁止范围

真实 smoke test 禁止：

- 修改旧 OneDrive Data；
- 修改 `Covers`、`Songs` 或旧 Music Markdown；
- 修改 `public/data/*.json`；
- 修改 `src/data/*.json`；
- 修改缓存目录；
- 修改 reports；
- 修改 `build_archive.py`；
- 运行 `build_archive.py`；
- 运行发布脚本；
- 创建或修改非目标 entry；
- 删除任何既有 v2 Music entry；
- 进行 Git push，除非用户在该轮明确授权。

## 9. 写入后验收

真实写入后必须按顺序运行：

```powershell
node scripts/check-archive-data-v2-music-shape.mjs
node scripts/generate-archive-data-v2-music-live-compatible-preview.mjs
node scripts/check-generated-data-privacy.mjs
git status --short --branch
```

验收输出只汇报：

- 新增 entry 数量；
- 写入文件角色和数量；
- manifest 是否存在；
- v2 shape 是否通过；
- live-compatible preview 是否仍可生成；
- privacy 检查是否通过；
- Git 工作区是否仍只包含预期变更。

不输出完整本机路径、账号、密钥、token 或正文。

## 10. 回退边界

第一轮 smoke test 建议写入后立刻验证 rollback 路径。

rollback 只允许：

- 删除本次 create manifest 中记录的 4 个目标文件；
- 删除空的目标 entry 目录；
- 保留或记录 transaction summary；
- 再次运行 `node scripts/check-archive-data-v2-music-shape.mjs`。

rollback 禁止：

- 删除整个 `entries/music/album`；
- 删除既有 33 个 Music 迁移条目；
- 修改 OneDrive Data；
- 修改 `public/data`；
- 运行 `build_archive.py`。

## 11. 成功标准

smoke test 成功应证明：

- 真实 v2 写入 allowlist 生效；
- create 写入只落在单个目标 entry 目录；
- transaction manifest 能记录写入范围；
- create rollback 能删除本次创建内容；
- rollback 后 v2 Music shape 仍通过；
- 旧 OneDrive Data、`public/data`、`src/data` 和构建流程未被触碰。

## 12. 下一步建议

下一步只建议实现真实 create smoke test runner 的只读/计划模式，或在用户单独授权后执行一次受控真实 create + rollback smoke test。

无论选择哪条路，都不应接前端 UI，不应修改 `public/data`，不应运行 `build_archive.py`。
