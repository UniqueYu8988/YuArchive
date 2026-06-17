# 任务：Archive Studio v0 transaction sandbox 失败场景自检

创建日期：2026-06-16
状态：已完成

## 1. 目标

为 Archive Studio v0 transaction sandbox 增加失败场景自检，验证事务模型不仅能完成 create / update happy path，也能在危险输入或 manifest 异常时停止。

本任务仍只写系统临时目录，不写真实 ArchiveData-v2 输出，不接 UI。

## 2. 本次范围

- 新增 `scripts/check-archive-studio-v0-transaction-sandbox.mjs`。
- 将 `scripts/archive-studio-v0-music-transaction-sandbox.mjs` 调整为可导入模块，同时保留 CLI 直接运行行为。
- 覆盖 happy path、invalid payload、路径逃逸、backup 源缺失、rollback manifest transaction id 不匹配。

## 3. 明确不做

- 不写真实 ArchiveData-v2 输出。
- 不写 OneDrive Data。
- 不写 `public/data`、`src/data`、缓存或 reports。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不执行 Git 操作。
- 不接前端 UI。

## 4. 验证方式

注意：`check-archive-studio-v0-transaction-sandbox.mjs` 和 `archive-studio-v0-music-transaction-sandbox.mjs` 共享同一个系统临时 sandbox 根目录，会在启动时清理该目录；应按顺序运行，不要并行运行。

运行：

```powershell
node scripts/check-archive-studio-v0-transaction-sandbox.mjs
node scripts/archive-studio-v0-music-transaction-sandbox.mjs
node scripts/check-archive-studio-v0-preview-core.mjs
node scripts/archive-studio-v0-music-preview-sandbox.mjs
node scripts/check-public-data-shape.mjs
node scripts/check-generated-data-privacy.mjs
node scripts/check-archive-data-v2-music-shape.mjs
```

期望：

- transaction sandbox self-check 通过；
- invalid payload 停止在写入前；
- 路径逃逸被拒绝；
- backup 源缺失时不继续目标写入；
- rollback manifest 不匹配被拒绝；
- happy path sandbox 行为保持可用；
- 既有 public data 和 v2 Music 检查通过。

## 5. 回退方式

- 删除 `scripts/check-archive-studio-v0-transaction-sandbox.mjs`。
- 回退 `scripts/archive-studio-v0-music-transaction-sandbox.mjs` 的导出和 rollback manifest 校验调整。
- 回退本任务文档和状态文档更新。

## 6. 下一步建议

下一步只建议设计真实 ArchiveData-v2 写入 approval gate：明确从 sandbox 到真实 v2 Music 写入前必须增加哪些 allowlist、确认、备份和验收，不直接开始真实写入。
