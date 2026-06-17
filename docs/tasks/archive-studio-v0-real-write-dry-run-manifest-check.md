# 任务：Archive Studio v0 real write dry-run manifest 场景自检

创建日期：2026-06-17
状态：已完成

## 1. 目标

为真实 v2 Music 写入 dry-run manifest 增加场景自检，确认允许场景会生成 planned manifest，阻断场景只生成 `needs_review` 草案，不计划写入或备份。

本任务仍只读真实 v2 Music 状态，不执行真实写入。

## 2. 本次范围

- 新增 `scripts/check-archive-studio-v0-real-write-dry-run-manifest.mjs`。
- 调整 `scripts/dry-run-archive-studio-v0-real-write-manifest.mjs`，导出 `buildDryRunManifest`。
- 覆盖 create allowed、update allowed、create existing blocked、update missing blocked。

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
node scripts/check-archive-studio-v0-real-write-dry-run-manifest.mjs
node scripts/dry-run-archive-studio-v0-real-write-manifest.mjs
node scripts/dry-run-archive-studio-v0-real-write-manifest.mjs docs/examples/archive-studio-v0-music-album-update.sample.json
node scripts/check-archive-data-v2-music-shape.mjs
```

期望：

- create allowed 生成 4 个 planned write item，0 个 backup item；
- update allowed 生成 4 个 planned write item，4 个 backup item；
- create existing blocked 输出 `needs_review`，不计划 write/backup；
- update missing blocked 输出 `needs_review`，不计划 write/backup；
- 所有脚本都只输出摘要，不写真实数据。

## 5. 回退方式

- 删除 `scripts/check-archive-studio-v0-real-write-dry-run-manifest.mjs`。
- 回退 `scripts/dry-run-archive-studio-v0-real-write-manifest.mjs` 的导出和 blocked 行为调整。
- 删除本任务文档。
- 回退状态文档更新。

## 6. 下一步建议

下一步只建议设计真实 v2 Music create 写入试点的执行前检查清单；仍不直接执行真实写入。
