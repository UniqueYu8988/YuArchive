# 任务：ArchiveData-v2 Texts 只读迁移 planner

创建日期：2026-06-20
状态：已完成

## 1. 目标

根据已确认的 Texts v2 规则，在内存中规划 132 个条目、稳定 ID、kind、正文、封面和栏目配置目标，不写 ArchiveData-v2。

## 2. 输出

- 源 Markdown、图片和栏目配置数量；
- article / book_note / series_note 数量；
- `entry_yaml`、`content_md`、cover 和 config 目标数量；
- manifest 记录数量；
- ID 冲突、目标路径冲突、缺封面、孤儿图片和日期策略错误；
- blocked reason 数量；
- `writeActions: 0`。

不输出标题、正文、完整路径、checksum 或 ID 清单。

## 3. 验证

```powershell
node scripts/plan-archive-data-v2-texts-migration.mjs
```

预期：132 个条目、319 个目标、187 个源 manifest 记录、0 冲突、0 blocked reason、0 写入。

## 4. 回退

删除 planner 和共享 Texts core；不涉及数据回退。

## 5. 验证结果

- 源文件 187：Markdown 132、图片 54、栏目配置 1；
- 计划条目 132：article 15、book_note 54、series_note 63；
- 计划目标 319：entry YAML 132、content 132、cover 54、栏目配置 1；
- manifest 源记录 187；
- duplicate id 0、duplicate target 0；
- 缺封面 0、孤儿图片 0、日期策略错误 0；
- blocked reason 0、写入动作 0。
