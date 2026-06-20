# ArchiveData-v2 Visions Migration Planner

创建日期：2026-06-20
状态：已建立，只读

## 目标

把已确认的 Visions v2 规则转为可重复验证的迁移计划，但不创建真实 v2 文件。

## 固定规则

- v2 kind：`movie`、`series`、`showcase`；
- 旧 `type: movie` 映射为 `kind: movie`；
- 旧 `type: tv` 映射为 `kind: series`；
- live-compatible 输出再映射回 `movie / tv`；
- 迁移以各分组源 YAML 为准，2 个条目、6 个旧 live 元数据偏移作为兼容差异报告；
- `开端 / 前尘 / 旧影 / 未远 / 此岸` 保存为可扩展 period；
- 合成年份只用于当前 live 兼容排序；
- 普通条目按源海报相对路径生成稳定 ID；
- 角色按源 GIF 相对路径生成稳定 ID；
- 禁止全局按 title 关联元数据。

## 计划范围

- 111 个普通影视条目；
- 1 个 showcase；
- 20 个角色；
- 151 个媒体文件；
- 6 份源 `meta.yaml`；
- 157 条 source manifest；
- 284 个目标文件角色。

## 验证

```powershell
node scripts/plan-archive-data-v2-visions-migration.mjs
```

预期：

- movie 71、series 40、showcase 1；
- duplicate ID 0；
- duplicate target 0；
- blocked reason 0；
- write action 0；
- 2 个跨 period 重复标题、2 个差异条目和 6 个字段差异只作为已知风险报告，不阻断按源事实迁移。

## 回退

删除 planner、共享 core 和本任务文档即可。脚本不写 OneDrive Data、ArchiveData-v2、public JSON、缓存或 reports。
