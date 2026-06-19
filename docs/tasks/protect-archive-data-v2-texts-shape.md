# 任务：保护 ArchiveData-v2 Texts 结构

创建日期：2026-06-20
状态：已完成并通过真实迁移输出

## 1. 目标

建立 Texts v2 的只读 shape checker，在迁移和 Archive Studio 保存后检查目录、字段、正文、封面、栏目、日期、迁移报告和隐私边界。

## 2. 检查范围

- `entries/texts/article`、`book_note`、`series_note`；
- 每条一个 `entry.yaml` 和非空 `content.md`；
- book_note 恰好一个 cover，其他 kind 第一版不允许 cover；
- id、board、kind、title、section、tags 和日期策略；
- `config/texts-sections.yaml` 的五个栏目和 kind；
- Texts 专用 migration manifest、unmapped 和 legacy report；
- entry / config / migration 元数据中的本机路径和秘密字段。

正文不参与秘密关键词扫描，避免公开文章内容产生误报。

## 3. 验证

真实 Texts v2 尚不存在，因此先运行系统临时目录自检：

```powershell
node scripts/check-archive-data-v2-texts-shape-selftest.mjs
```

自检必须证明合法的三个 kind 通过、缺少 book_note cover 时被阻断。

真实迁移完成后运行：

```powershell
node scripts/check-archive-data-v2-texts-shape.mjs
```

## 4. 回退

删除 checker、自检和本任务文档；不涉及源数据或 v2 数据回退。

## 5. 自检结果

- 合法 article、book_note、series_note 样例通过；
- 三个 kind 的字段、栏目、日期和正文通过；
- book_note 单封面规则通过；
- 删除 book_note cover 后检查正确失败；
- 自检只写系统临时目录并已清理。

## 6. 真实输出结果

- total entries 132；
- entry YAML 132、content 132、cover 54；
- article 15、book_note 54、series_note 63；
- malformed、invalid id、section-kind mismatch、日期策略错误均为 0；
- 栏目配置 5 个且 kind 全部匹配；
- manifest 187、unmapped 0、legacy report 存在；
- privacy hit 0。
