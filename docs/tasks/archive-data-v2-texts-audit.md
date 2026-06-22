# 任务：Archive Texts 只读审计

创建日期：2026-06-20
状态：已完成

## 1. 目标

在设计 Texts v2 和迁移脚本前，确认旧 Texts 的栏目、Markdown frontmatter、正文存在性、日期形状、封面关系、稳定 ID 条件、当前 `texts.json` 数量和前端字段依赖。

## 2. 允许范围

- 只读旧 OneDrive Data 的 `Texts` 目录和 `sections.yaml`；
- 只读 `build_archive.py` 的 Texts 解析逻辑；
- 只读 `public/data/texts.json` 的结构与数量；
- 只读前端 `TextsPage` 和类型定义；
- 新增本任务文档和 `scripts/audit-archive-data-v2-texts.mjs`；
- 只输出字段名、栏目 key、数量、规则和错误统计。

## 3. 禁止范围

- 不输出标题清单或正文；
- 不修改旧 Texts Markdown、图片或 `sections.yaml`；
- 不创建或修改 Archive Texts 输出；
- 不运行 `build_archive.py`；
- 不修改 `public/data`、`src/data`、缓存或 reports；
- 不实现迁移、生成器或 Archive Studio Texts 写入；
- 不执行发布。

## 4. 审计规则

- Markdown 和图片数量；
- frontmatter 可解析性与字段使用数量；
- 正文是否为空；
- `sections.yaml` 的栏目 key、必要配置字段和别名映射；
- Markdown 所属栏目是否可解析；
- 当前五个栏目到 `article`、`book_note`、`series_note` 的候选映射；
- 日期为完整、部分、缺失或无效的数量；
- `source_id` 是否可作为稳定 v2 id；
- 同名和重复 `source_id` 数量；
- 书架图片按文件 stem 的匹配与孤儿数量；
- 当前 live `texts.json` 是否与源 Markdown 数量一致；
- 当前 Archive Texts 目标是否已经存在。

## 5. 验证方式

```powershell
node scripts/audit-archive-data-v2-texts.mjs
node scripts/check-source-data-shape.mjs
git diff --check
git status --short --branch
```

## 6. 回退方式

- 删除 `scripts/audit-archive-data-v2-texts.mjs`；
- 删除本任务文档；
- 回退状态文档中的本轮记录；
- 不涉及任何数据回退。

## 7. 下一步门槛

只有审计结果明确后，才设计 Texts v2 规则。稳定 ID、栏目到 kind 的映射、日期保留策略和书架图片归属必须先写入规则文档，不能由迁移脚本临时猜测。

## 8. 审计结果

- 源文件 187 个：Markdown 132、图片 54、`sections.yaml` 1；
- 132 个 Markdown 均有可解析 frontmatter，正文非空，当前 live `texts.json` 也是 132 条；
- 栏目共 5 个，引用错误 0，栏目配置缺失字段 0；
- kind 候选可确定为 `article` 15、`book_note` 54、`series_note` 63，未覆盖栏目 0；
- 日期为完整日期 78、缺失 54；缺失项与 `book_note` 数量一致，符合当前生成器对书籍笔记不强制日期的行为；
- 书架图片 54 张，按文件 stem 匹配 54，孤儿图片 0；
- 标题重复计数 2，迁移 id 不能只依赖标题；
- 旧 `source_id` 仅出现 3 次，且没有一个符合 v2 slug 规则，应保留为 legacy 字段而不是直接作为 v2 id；
- 当前 Archive 尚无 Texts 输出；
- 本轮写入动作 0。

## 9. 规则阶段结论

下一步可以进入 Texts v2 规则设计。必须明确：

- 迁移条目的确定性稳定 ID 算法；
- 五个 section key 到三个 kind 的固定映射；
- `book_note` 日期可空，其他 kind 使用完整日期；
- `book_note` 的封面归属规则；
- `source_id`、`summary_provider` 等旧字段只进入 legacy。
