# 任务：Archive Studio v0 transaction sandbox

创建日期：2026-06-16
状态：已完成

## 1. 目标

实现一个只写系统临时目录的 Archive Studio v0 `music/album` transaction sandbox，用于验证 create / update / rollback 的写入事务模型。

本任务不写真实 Archive 输出，不接 UI，不修改 OneDrive Data。

## 2. 本次范围

- 新增 `scripts/archive-studio-v0-music-transaction-sandbox.mjs`。
- 复用 `scripts/archive-studio-v0-music-preview-core.mjs` 生成 preview 和基础安全断言。
- 在系统临时目录创建模拟的 `Archive` 写入根。
- 模拟 create 事务。
- 模拟 update 事务。
- 为覆盖项生成 backup manifest。
- 为写入项生成 write manifest。
- 执行 rollback，并输出删除 / 恢复计数。

## 3. 明确不做

- 不写真实 Archive 输出。
- 不写 OneDrive Data。
- 不写 `public/data`、`src/data`、缓存或 reports。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不执行 Git 操作。
- 不接前端 UI。
- 不读取真实封面或音频二进制内容。

## 4. 脚本行为

运行：

```powershell
node scripts/archive-studio-v0-music-transaction-sandbox.mjs
```

脚本会：

1. 清理并重建系统临时 sandbox 根。
2. 创建模拟的 `Archive` 写入根。
3. 运行 create payload：
   - 生成 diff preview；
   - 写 staging；
   - 应用写入；
   - 生成 write manifest；
   - rollback 删除本事务新增文件。
4. 运行 update payload：
   - 预置一个模拟旧条目；
   - 生成 diff preview；
   - 生成 backup manifest；
   - 写 staging；
   - 应用覆盖；
   - rollback 恢复备份文件。
5. 控制台只输出计数和系统临时目录标签，不输出完整本机路径。

## 5. 验收方式

注意：transaction sandbox 会清理并重建同一个系统临时 sandbox 根目录；如同时运行自检脚本，应按顺序运行，不要并行运行。

运行：

```powershell
node scripts/archive-studio-v0-music-transaction-sandbox.mjs
node scripts/check-archive-studio-v0-preview-core.mjs
node scripts/archive-studio-v0-music-preview-sandbox.mjs
node scripts/check-public-data-shape.mjs
node scripts/check-generated-data-privacy.mjs
node scripts/check-archive-data-v2-music-shape.mjs
```

期望：

- transaction sandbox 通过；
- create 事务有新增写入并可 rollback 删除；
- update 事务有覆盖、backup，并可 rollback 恢复；
- preview core self-check 通过；
- CLI sandbox preview 行为保持可用；
- 公开派生 JSON shape/privacy 检查通过；
- v2 Music 输出检查通过。

## 6. 回退方式

- 删除 `scripts/archive-studio-v0-music-transaction-sandbox.mjs`。
- 删除本任务文档。
- 回退 `CURRENT_STATE.md` 和 `docs/plans/STABILIZATION_PLAN.md` 的状态更新。
- 系统临时 sandbox 目录可直接删除，不影响项目仓库、OneDrive Data 或真实 Archive。

## 7. 下一步建议

下一步只建议增加 transaction sandbox 自检覆盖失败场景，例如 invalid payload、路径逃逸、backup 失败前停止、rollback manifest 不匹配；仍不写真实 Archive 输出，不接 UI。
