# Archive Texts 文件规则

创建日期：2026-06-20
状态：规则草案已形成，迁移尚未执行

## 1. 定位

本规则定义 Texts 从旧 OneDrive Data 迁移到 Archive，以及未来由 Archive Studio 新建文本条目的稳定文件结构。

边界：

- 旧 OneDrive Data 始终只读；
- 一条文本一个目录；
- frontmatter 进入 `entry.yaml`，正文进入 `content.md`；
- 书架封面进入条目目录；
- 不自动摘要、不自动改写正文、不自动分类、不自动发布；
- 不把完整本机路径写入 v2 或派生 JSON。

## 2. 目录结构

```text
Archive/
├─ config/
│  └─ texts-sections.yaml
└─ entries/
   └─ texts/
      ├─ article/
      │  └─ <entry-id>/
      │     ├─ entry.yaml
      │     └─ content.md
      ├─ book_note/
      │  └─ <entry-id>/
      │     ├─ entry.yaml
      │     ├─ content.md
      │     └─ cover.<ext>
      └─ series_note/
         └─ <entry-id>/
            ├─ entry.yaml
            └─ content.md
```

`cover.*` 第一版只用于 `book_note`。`article` 和 `series_note` 以后如需媒体，应另行设计，不在迁移时猜测。

## 3. section 与 kind

固定映射：

| section | kind | 当前条目数 | 日期规则 | 封面规则 |
|---|---|---:|---|---|
| `book-reviews` | `book_note` | 54 | 可空 | 必需 |
| `headline` | `series_note` | 16 | 必须为 `YYYY-MM-DD` | 无 |
| `bedtime-news` | `series_note` | 47 | 必须为 `YYYY-MM-DD` | 无 |
| `reference-info` | `article` | 2 | 必须为 `YYYY-MM-DD` | 无 |
| `miscellany` | `article` | 13 | 必须为 `YYYY-MM-DD` | 无 |

该映射来自现有 `sections.yaml`、目录结构和前端栏目行为。迁移脚本不得根据标题重新分类。

## 4. entry.yaml

通用形状：

```yaml
id: text-xxxxxxxxxxxx
board: texts
kind: article
title: ""
section: miscellany
date: "2026-06-20"
author: ""
summary: ""
tags: []
legacy: {}
```

字段规则：

| 字段 | 必需 | 说明 |
|---|---|---|
| `id` | 是 | 稳定路径标识，保存后不随标题变化 |
| `board` | 是 | 固定为 `texts` |
| `kind` | 是 | `article`、`book_note`、`series_note` |
| `title` | 是 | 展示标题 |
| `section` | 是 | 必须是 `texts-sections.yaml` 中的 key |
| `date` | 分 kind | `book_note` 可空；其他 kind 必须完整日期 |
| `author` | 否 | 现有书籍笔记使用 |
| `summary` | 否 | 短摘要；不从正文自动生成 |
| `tags` | 否 | 字符串数组，默认空数组 |
| `legacy` | 否 | 只保存迁移兼容字段和旧相对信息 |

不得把正文、完整本机路径或派生的 `excerpt` 写入 `entry.yaml`。

## 5. content.md

- 保存旧 Markdown frontmatter 之后的正文；
- 正文不做 AI 改写、摘要或格式清洗；
- 迁移时保留换行和 Markdown 语义；
- 新建时由用户直接填写 Markdown；
- 第一版要求正文非空。

源 Markdown 本身不会逐字节复制为 `content.md`，因为 frontmatter 会拆到 `entry.yaml`。迁移 manifest 必须同时记录源文件 checksum 和转换后正文 checksum。

## 6. 稳定 ID

### 迁移条目

迁移 id 使用：

```text
text-<sha256(规范化源相对路径) 的前 12 位小写十六进制>
```

规则：

- 哈希输入只使用相对于旧 Texts 根目录的 `/` 分隔路径；
- 不使用完整本机路径；
- 不只依赖标题，因此可处理当前 2 组同名标题；
- 同一迁移输入重复运行必须得到相同 id；
- manifest 保存旧相对路径到新 id 的映射。

旧 frontmatter 的 `source_id` 不直接作为 v2 id。当前仅 3 条存在该字段，且均不符合 v2 slug；原值只进入 `legacy.source_id`。

### Archive Studio 新建条目

新建 id 使用：

```text
text-YYYYMMDD-<8 位随机十六进制>
```

- 在草稿创建时生成一次；
- preview、preflight 和 create 使用同一个 id；
- 保存后不因标题修改而变化；
- 不做中文转拼音，不依赖 AI。

## 7. 栏目配置

`config/texts-sections.yaml` 从旧 `sections.yaml` 迁移，按 section key 保存：

```yaml
book-reviews:
  title: ""
  description: ""
  icon: ""
  aliases: []
  kind: book_note
  cover_policy: required
```

迁移保留现有 title、description、icon 和 aliases，不自动改写展示文案。

## 8. 封面规则

- 当前 54 个 `book_note` 均有同 stem 书架图片，匹配率 54/54；
- 迁移时逐字节复制为对应条目的 `cover.<原扩展名>`；
- 记录源和目标 checksum；
- 不转换格式，不调用图片压缩；
- 孤儿封面、重复匹配或缺失封面均阻断迁移；
- `article` 和 `series_note` 第一版不迁移封面。

## 9. legacy 规则

允许的 legacy 字段：

```yaml
legacy:
  source_relative_path: ""
  source_id: ""
  summary_provider: ""
  original_frontmatter: {}
```

- `source_relative_path` 只能是 `[Texts]` 内相对路径；
- `source_id` 和 `summary_provider` 原样保留，但不影响 v2 行为；
- 未进入正式字段的旧 frontmatter key 放入 `original_frontmatter`；
- legacy 不进入公开 `texts.json`，除非未来另有明确映射。

## 10. 迁移验收

预期迁移结果：

- entry 目录 132；
- `entry.yaml` 132；
- `content.md` 132；
- `cover.*` 54；
- 栏目配置 1；
- kind 计数：article 15、book_note 54、series_note 63；
- 源 Markdown 132、图片 54、栏目配置 1 均进入 manifest；
- unmapped 0；
- duplicate id 0；
- 空正文 0；
- 缺失封面 0；
- 本机路径和秘密字段命中 0；
- 旧 OneDrive Data 前后 checksum / metadata 不变。

## 11. live-compatible 生成

第一版 mapper 必须生成当前 `TextsCategory` 形状：

- 顶层：`key`、`display_name`、`total_count`、`sort_mode`、`sections`、`items`；
- item：`id`、`title`、`date`、`sort_date`、`section`、`section_title`、`cover`、`author`、`summary`、`excerpt`、`tags`、`content`；
- section：`key`、`title`、`description`、`icon`、`showcase_images`、`count`。

替换 live 前先做隔离 preview：

- v2 与 live 都为 132 条；
- 用 section、title、date 和旧相对映射消除同名歧义；
- 第一版复用当前 live id、cover public path 和顺序；
- `excerpt` 由兼容 mapper 按现有规则派生，不写回 v2；
- 不直接修改 `public/data/texts.json`。

## 12. Archive Studio 范围

Texts 第一版新建流程支持三个 kind，但按 kind 显示最少字段：

- `article`：title、section、date、summary、tags、content；
- `series_note`：title、section、date、summary、tags、content；
- `book_note`：title、section、author、summary、cover、content，date 可选。

保存前必须 preview 和 preflight；create-only，不覆盖已有条目。保存后运行 Texts v2 shape check。不提供编辑、删除、批量导入、AI 自动生成或发布。

## 13. 实施顺序

1. 建立 Texts v2 schema / shape checker；
2. 建立只读迁移 planner；
3. dry-run 验证 132 个 id、kind、正文和 54 个封面映射；
4. 单独授权后受控迁移；
5. 验证旧 OneDrive Data 不变；
6. 实现 live-compatible preview；
7. 单独验收后再决定是否替换 live `texts.json`；
8. 最后接 Archive Studio Texts 新建流程。

