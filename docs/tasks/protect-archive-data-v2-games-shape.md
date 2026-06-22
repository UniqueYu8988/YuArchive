# Protect Archive Games Shape

创建日期：2026-06-20
状态：checker 与临时目录自检已建立

## 目标

只读验证 Games v2 的 kind、entry、cover、DLC 父关联、live season、配置、migration baseline 和隐私边界。

## 检查范围

- `normal_game / dlc / live_game` 目录与稳定 ID；
- `entry.yaml` 的 board、kind、title、year 和 metadata_enabled 基础形状；
- normal_game / dlc 必需 cover，live_game 最多一个父 cover；
- DLC `parent_id` 必须引用现存 game；
- season ID、`season.yaml`、title、label、order 和 cover；
- `config/games.yaml`；
- 329 条迁移 manifest、空 unmapped 和 legacy report；
- 本机路径、OneDrive 路径、旧 Data backup 和秘密字段。

## 边界

- checker 只读；
- self-test 只写系统临时目录；
- 不写旧 OneDrive Data；
- 不创建真实 Archive Games；
- 不运行 `build_archive.py`；
- 不修改 public JSON、缓存或 reports。

## 验证

```powershell
node scripts/check-archive-data-v2-games-shape-selftest.mjs
node scripts/check-archive-data-v2-games-shape.mjs
```

真实 Games v2 尚未迁移时，第二条命令应按预期失败；self-test 必须证明合法结构通过，缺 cover、错误父关联、缺 season cover 和私有路径均被阻断。

## 回退

删除 checker、self-test 和本任务文档即可。临时目录由 self-test 的 `finally` 清理。
