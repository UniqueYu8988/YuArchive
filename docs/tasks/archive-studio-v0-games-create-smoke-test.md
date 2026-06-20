# Archive Studio Games Create + Rollback Smoke Test

创建日期：2026-06-20
状态：真实 API create + rollback 已通过

## 目标

通过真实本机 Archive Studio API，在 ArchiveData-v2 中临时创建一个 `games/normal_game`，运行 Games v2 检查，再根据事务回退清单删除临时条目和事务文件。

## 边界

- 只写一个唯一临时 normal_game 和对应事务目录；
- 测试 cover 使用仓库内已有的通用 WebP fixture；
- 旧 OneDrive Data 全程只读，并比较前后文件快照；
- 不运行 `build_archive.py`；
- 不生成或修改 public JSON；
- 不发布，不执行 Git push；
- 不保留 smoke test 条目。

## 安全门槛

- 默认运行只输出计划，写入范围为 none；
- 真实执行需要 `--execute` 与精确授权短语；
- 执行前要求 Games v2 基线恰好为 282；
- 必须依次通过真实 API preview、preflight、一次性 token create 与写后 shape check；
- create 后必须为 283，且发布未触发；
- rollback 必须读取本次事务 `rollback.json`；
- 回退后必须恢复为 282，条目与事务残留均为 0；
- ArchiveData-v2 与旧源文件快照必须恢复一致。

## 验证

```powershell
node scripts/run-archive-studio-v0-games-create-smoke-test.mjs
node scripts/run-archive-studio-v0-games-create-smoke-test.mjs --execute --authorization "I authorize Archive Studio Games create rollback smoke test"
node scripts/check-archive-data-v2-games-shape.mjs
```

## 回退

runner 在 `finally` 阶段关闭临时 API 服务并读取事务回退清单。任何条目、事务、shape、旧源或 ArchiveData-v2 快照残留都视为失败。

## 执行结果

- 真实 API preview、preflight、一次性 token create 与写后 Games shape check 通过；
- 临时 normal_game 创建 2 个条目文件和 3 个事务文件，条目数 282 → 283；
- 回退后恢复为 282，临时条目残留 0、事务残留 0；
- ArchiveData-v2 文件快照恢复一致；
- 旧源侧核对 778 个文件，前后无变化；
- 发布未触发，未运行 `build_archive.py`，未修改 public JSON。
