# 任务：Archive Studio v0 真实 v2 写入 dry-run manifest

创建日期：2026-06-17
状态：已完成

## 1. 目标

实现一个只读 dry-run manifest 脚本，在不写真实 ArchiveData-v2 的前提下，基于 real write gate checker 输出将要写入、备份和回滚的 manifest 草案。

## 2. 本次范围

- 新增 `scripts/dry-run-archive-studio-v0-real-write-manifest.mjs`。
- 复用 `scripts/check-archive-studio-v0-real-write-gate.mjs` 的 gate 结果。
- 输出 transaction id、operation 计数、backup manifest 草案、write manifest 草案和 rollback 草案摘要。
- 支持默认 create 样例和显式传入项目内 update 样例。

## 3. 明确不做

- 不写真实 ArchiveData-v2 输出。
- 不写 OneDrive Data。
- 不写 `public/data`、`src/data`、缓存或 reports。
- 不创建 backup。
- 不创建 manifest 文件。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不执行 Git 操作。
- 不接前端 UI。

## 4. 验证方式

运行：

```powershell
node scripts/dry-run-archive-studio-v0-real-write-manifest.mjs
node scripts/dry-run-archive-studio-v0-real-write-manifest.mjs docs/examples/archive-studio-v0-music-album-update.sample.json
node scripts/check-archive-studio-v0-real-write-gate-scenarios.mjs
node scripts/check-archive-data-v2-music-shape.mjs
```

期望：

- create dry-run 生成 4 个 planned write item，0 个 backup item；
- update dry-run 生成 4 个 planned write item，4 个 backup item；
- 所有输出只包含相对路径摘要和计数；
- 不写真实数据。

## 5. 回退方式

- 删除 `scripts/dry-run-archive-studio-v0-real-write-manifest.mjs`。
- 回退 `scripts/check-archive-studio-v0-real-write-gate.mjs` 中导出更完整 gate 结果的调整。
- 删除本任务文档。
- 回退状态文档更新。

## 6. 下一步建议

下一步只建议为 dry-run manifest 增加 blocked 场景自检，确认被阻断 payload 只生成 `needs review` 草案，不进入真实写入。
