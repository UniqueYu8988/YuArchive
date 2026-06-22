# 任务：Archive Studio v0 real write gate 场景自检

创建日期：2026-06-17
状态：已完成

## 1. 目标

为真实 v2 Music 写入 gate checker 增加 update payload 和 blocked 场景自检，确认 checker 能区分允许进入写入申请和必须阻断的情况。

本任务只读真实 Archive Music 当前状态，不执行真实写入。

## 2. 本次范围

- 新增 `docs/examples/archive-studio-v0-music-album-update.sample.json`。
- 新增 `scripts/check-archive-studio-v0-real-write-gate-scenarios.mjs`。
- 覆盖 create allowed、update allowed、create existing blocked、update missing blocked、invalid id blocked。

## 3. 明确不做

- 不写真实 Archive 输出。
- 不写 OneDrive Data。
- 不写 `public/data`、`src/data`、缓存或 reports。
- 不创建 backup。
- 不创建 manifest。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不执行 Git 操作。
- 不接前端 UI。

## 4. 验证方式

运行：

```powershell
node scripts/check-archive-studio-v0-real-write-gate-scenarios.mjs
node scripts/check-archive-studio-v0-real-write-gate.mjs
node scripts/check-archive-studio-v0-transaction-sandbox.mjs
node scripts/check-archive-data-v2-music-shape.mjs
```

期望：

- create 样例允许进入写入申请；
- update 样例允许进入写入申请且需要 backup；
- 对已存在 entry 执行 create 被阻断；
- 对不存在 entry 执行 update 被阻断；
- invalid id 被阻断；
- 所有脚本都只输出摘要，不写真实数据。

## 5. 回退方式

- 删除 `docs/examples/archive-studio-v0-music-album-update.sample.json`。
- 删除 `scripts/check-archive-studio-v0-real-write-gate-scenarios.mjs`。
- 删除本任务文档。
- 回退 `scripts/check-archive-studio-v0-real-write-gate.mjs` 的导出调整和状态文档更新。

## 6. 下一步建议

下一步只建议设计真实 v2 Music 写入 dry-run manifest：仍只读真实 v2 状态，只输出将写入的 manifest 草案，不执行真实写入。
