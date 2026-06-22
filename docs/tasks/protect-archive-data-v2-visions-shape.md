# Protect Archive Visions Shape

创建日期：2026-06-20
状态：检查器与临时目录自检已建立

## 目标

为未来 Visions v2 迁移和 Archive Studio 写入建立最低结构保护，不尝试完整 schema。

## 检查范围

- movie / series：`entry.yaml` 和唯一 poster；
- showcase：`entry.yaml` 与显式 `character_order`；
- character：`character.yaml`、唯一 avatar、唯一 clip；
- 五个 period 配置及兼容合成年份；
- entry / character 稳定 ID；
- migration manifest、unmapped 和 legacy report；
- 本机路径、OneDrive、旧路径和秘密字段。

## 边界

- 默认检查真实 Archive，但当前尚无 Visions v2 时预期失败；
- 自检只在系统临时目录创建样例；
- 不读取或修改旧 Visions 源；
- 不自动修复；
- 不运行 `build_archive.py`；
- 不生成或替换 `public/data/visions.json`。

## 验证

```powershell
node scripts/check-archive-data-v2-visions-shape-selftest.mjs
node scripts/check-archive-data-v2-visions-shape.mjs
```

在真实迁移前，第一条应通过，第二条应明确报告 Visions v2 尚不存在。迁移后第二条必须通过。

## 回退

删除 shape checker、自检脚本和本任务文档。系统临时目录由自检 `finally` 自动清理。
