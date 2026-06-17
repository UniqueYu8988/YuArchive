# 任务：Archive Studio v0 真实 v2 写入 gate checker

创建日期：2026-06-17
状态：已完成

## 1. 目标

实现一个只读 gate checker，用于读取 Archive Studio v0 `music/album` payload 和真实 ArchiveData-v2 Music 当前状态，输出是否允许进入真实写入申请。

本任务不执行真实写入，不创建备份，不修改任何数据。

## 2. 本次范围

- 新增 `scripts/check-archive-studio-v0-real-write-gate.mjs`。
- 默认读取项目内样例 payload。
- 只读读取真实 ArchiveData-v2 Music 输出目录的目标 entry 状态。
- 复用 preview core 校验 payload 和 target 相对路径。
- 输出 payload gate、目标 entry 存在性、operation 计数、backup 需求和 blocked reason。

## 3. 明确不做

- 不写真实 ArchiveData-v2 输出。
- 不写 OneDrive Data。
- 不写 `public/data`、`src/data`、缓存或 reports。
- 不创建 backup。
- 不创建 manifest。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不执行 Git 操作。
- 不接前端 UI。

## 4. 脚本行为

运行：

```powershell
node scripts/check-archive-studio-v0-real-write-gate.mjs
```

脚本会：

1. 读取 `docs/examples/archive-studio-v0-music-album-payload.sample.json`。
2. 校验 payload 的 mode、board、kind、id、title 和素材扩展名。
3. 只读检查真实 ArchiveData-v2 Music 根目录。
4. 只读检查目标 entry 目录和目标文件是否存在。
5. 输出 create / overwrite / keep / blocked 计数。
6. 输出是否需要 backup。
7. 输出是否允许进入“真实写入申请”。

脚本输出不包含完整本机路径、不输出正文、不输出秘密值。

## 5. 验证方式

运行：

```powershell
node scripts/check-archive-studio-v0-real-write-gate.mjs
node scripts/check-archive-studio-v0-transaction-sandbox.mjs
node scripts/check-archive-studio-v0-preview-core.mjs
node scripts/check-archive-data-v2-music-shape.mjs
```

期望：

- real write gate checker 可运行；
- 默认样例 payload 只输出 gate 摘要；
- transaction sandbox self-check 通过；
- preview core self-check 通过；
- v2 Music shape 检查通过。

## 6. 回退方式

- 删除 `scripts/check-archive-studio-v0-real-write-gate.mjs`。
- 删除本任务文档。
- 回退 `CURRENT_STATE.md` 和 `docs/plans/STABILIZATION_PLAN.md` 的状态更新。

## 7. 下一步建议

下一步只建议为 real write gate checker 增加 update payload 样例和 blocked 场景自检；仍不执行真实写入。
