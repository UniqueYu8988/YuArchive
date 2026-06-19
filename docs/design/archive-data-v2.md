# ArchiveData-v2 文件规则设计

本文档定义 YuArchive 下一代源数据目录 `ArchiveData-v2` 的文件组织规则。当前阶段只做规则设计，不迁移数据，不创建 `ArchiveData-v2` 真实目录，不修改旧 OneDrive Data。

## 1. 设计目标

- 降低日常维护成本，减少“记住旧脚本隐含规则”的负担。
- 支持未来 Archive Studio 可视化管理，让管理前端直接服务新结构。
- 一个条目一个文件夹，条目的结构化信息、正文和媒体资产有稳定位置。
- 旧 Data 只读迁移，不直接覆盖；旧目录继续作为迁移来源和回退备份。
- 管理前端 v0 只做表单化录入、预览和保存，不做 AI 自动补全。
- 尽量让用户只填写主观信息和必要字段，例如标题、评分、笔记、分类、日期、展示描述和素材选择。
- 保留文件系统可备份、可手动检查、可 diff、可回退的优点。

## 2. 非目标

第一版不做：

- AI 自动补全；
- 自动找封面；
- 自动查外链；
- 自动分类；
- 自动生成简介；
- 自动发布；
- 完整 CMS；
- 多用户后台；
- 数据库替代文件系统；
- 直接覆盖旧 OneDrive Data。

## 3. 顶层目录草案

建议目录：

```text
ArchiveData-v2/
├─ config/
│  ├─ homepage.yaml
│  ├─ layout.yaml
│  └─ ui.yaml
├─ entries/
│  ├─ games/
│  ├─ visions/
│  ├─ music/
│  └─ texts/
└─ migration/
   ├─ migration-manifest.json
   ├─ unmapped-files.json
   └─ legacy-field-report.md
```

说明：

- `config/` 保存全站配置和首页编排，替代旧顶层 `homepage.yaml`、`site-layout.yaml`、`site-ui.yaml` 的角色。
- `entries/` 保存四个 board 的条目目录。
- `migration/` 只服务迁移过程，记录旧文件、旧字段和无法自动映射的内容。
- 第一版不设计数据库、服务端上传目录或云端同步目录。

## 4. board / kind 设计

四个 board 固定为：

| board | 含义 | v0 优先级 |
|---|---|---|
| `games` | 游戏收藏 | 后续，复杂度最高 |
| `visions` | 影视、剧集、动画、角色橱窗 | 后续 |
| `music` | 专辑、原声、音频条目 | 优先试点 |
| `texts` | 文章、书籍笔记、系列文本 | Music 后 |

初版 kind：

| board | kind | 用途 | v0 优先级 |
|---|---|---|---|
| `games` | `normal_game` | 普通游戏条目 | 预留 |
| `games` | `dlc` | DLC 或扩展内容 | 预留 |
| `games` | `live_game` | 长期运营游戏、赛季聚合内容 | 预留 |
| `visions` | `movie` | 单部电影或短片 | 预留 |
| `visions` | `series` | 剧集、动画、系列影视 | 预留 |
| `visions` | `showcase` | 角色橱窗或专题展示 | 预留 |
| `music` | `album` | 专辑、原声集、游戏/影视音乐合集 | v0 优先 |
| `music` | `track` | 单曲或独立音频条目 | 预留 |
| `texts` | `article` | 普通文章、短文、参考信息 | 后续 |
| `texts` | `book_note` | 书籍笔记、听书笔记 | 后续 |
| `texts` | `series_note` | 栏目或系列文本 | 后续 |

v0 建议只实现 `music/album`，先证明“表单录入 -> 文件结构 -> 检查 -> 生成器试点”的闭环。

## 5. 条目目录规则

每个条目一个文件夹：

```text
entries/<board>/<kind>/<entry-id>/
├─ entry.yaml
├─ content.md
└─ assets/
```

通用规则：

- `entry.yaml` 放结构化字段，供检查脚本、生成器和 Archive Studio 表单读取。
- `content.md` 放正文、说明、个人观点、长笔记或曲目清单。
- 主封面固定命名为 `cover.*`，允许扩展名为 `.jpg`、`.jpeg`、`.png`、`.webp`。
- Music 音频固定命名为 `audio.*`，允许扩展名为 `.mp3`、`.wav`、`.flac`、`.m4a`、`.ogg`、`.aac`。
- 多媒体、截图、GIF、头像、额外封面放入 `assets/`。
- `live_game` 的赛季资料可放入 `seasons/`，每个赛季可以有自己的 `season.yaml` 和素材。
- `showcase` 可放 `characters/` 或 `assets/characters/`，每个角色有稳定 id、头像和 GIF。

建议示例：

```text
entries/music/album/hades/
├─ entry.yaml
├─ content.md
├─ cover.jpg
└─ audio.mp3
```

```text
entries/games/live_game/teamfight-tactics/
├─ entry.yaml
├─ content.md
├─ cover.png
└─ seasons/
   └─ s17/
      ├─ season.yaml
      └─ cover.png
```

## 6. 最小共有字段

`entry.yaml` 的共有字段保持少而稳定：

```yaml
id:
board:
kind:
title:
date:
url:
note:
legacy:
```

字段说明：

| 字段 | 用途 | 必需性 |
|---|---|---|
| `id` | 稳定标识，生成路径、引用和迁移映射使用 | 必需 |
| `board` | 大板块：`games`、`visions`、`music`、`texts` | 必需 |
| `kind` | 小类型，由 board 决定 | 必需 |
| `title` | 展示标题 | 必需 |
| `date` | 年份、日期或排序时间，具体格式由 kind 解释 | 建议 |
| `url` | 外部链接 | 可选 |
| `note` | 短说明、短评、展示描述 | 可选 |
| `legacy` | 迁移阶段保留旧字段、旧文件名、旧路径相对信息 | 可选但迁移期建议保留 |

不要把 `rating`、`audio`、`section`、`showcase`、`season_entries` 放进共有字段。这些属于具体 kind。

## 7. 各 kind 字段草案

### games / normal_game

v0 表单字段：

```yaml
platform:
rating:
playtime:
completed:
genre:
price:
```

兼容或可选字段：

```yaml
english_title:
display_title:
hover_note:
summary:
```

说明：

- 评分只属于 games。
- `rating` 建议仍为 0-5 整数或空值。
- `platform`、`genre` 后续应建立枚举，但不要在第一步强行清洗旧值。

### games / dlc

v0 表单字段：

```yaml
parent_id:
parent_title:
platform:
rating:
playtime:
completed:
genre:
```

兼容字段：

```yaml
dlc_parent_title:
legacy_title_split:
```

说明：

- 旧结构中 DLC 可能依赖文件名下划线拆分；v2 应显式记录本体关联。

### games / live_game

v0 暂不实现，仅设计字段：

```yaml
platform:
rating:
playtime:
completed:
genre:
season_heading:
season_subheading:
season_description:
```

赛季资料建议放入：

```text
seasons/<season-id>/season.yaml
```

`season.yaml` 草案：

```yaml
id:
title:
label:
period:
champion:
theme:
feature:
build:
note:
source_year:
```

说明：

- `season_entries` 只属于 `live_game`。
- 旧 `Game-Live` 的单独 YAML 和 `TFT_`、`LOL_`、`D4_` 前缀规则应在迁移 dry-run 中显式映射。

### visions / movie

v0 暂不实现，仅设计字段：

```yaml
type: movie
cinema:
quote:
url:
```

说明：

- `quote` 是展示短句，不进入共有字段。
- `cinema` 是影视板块专用标记。

### visions / series

v0 暂不实现，仅设计字段：

```yaml
type: series
cinema:
quote:
url:
season:
episode_count:
```

说明：

- 旧结构里 `type` 常用于前端筛选；v2 应用 `kind` 表达主类型，保留 `type` 到 legacy 或生成兼容层。

### visions / showcase

v0 暂不实现，仅设计字段：

```yaml
showcase_title:
description:
```

角色资料建议：

```text
characters/<character-id>/
├─ character.yaml
├─ avatar.*
└─ clip.gif
```

`character.yaml` 草案：

```yaml
id:
title:
caption:
```

说明：

- `showcase` / `characters` 只属于 visions。
- 角色 GIF、头像等素材不应混在普通影视条目根目录。

### music / album

v0 优先字段：

```yaml
description:
track_title:
url:
```

文件规则：

```text
cover.*
audio.*
content.md
```

说明：

- 音频只属于 music。
- `content.md` 可保存曲目列表、专辑说明或用户短评。
- `description` 可继续承担首页和 Music 页面短描述。

### music / track

v0 暂不实现，仅设计字段：

```yaml
artist:
album:
track_title:
url:
```

说明：

- 适合未来单曲条目，不强迫旧 album 数据拆分。

### texts / article

v0 暂不实现，仅设计字段：

```yaml
section:
date:
author:
summary:
tags:
```

说明：

- `section` 只属于 texts。
- `content.md` 保存正文。

### texts / book_note

v0 暂不实现，仅设计字段：

```yaml
section:
date:
author:
summary:
tags:
book_title:
```

说明：

- 旧“每天听本书”等栏目可迁移为 `book_note` 或 `series_note`，不确定时进入人工确认报告。

### texts / series_note

v0 暂不实现，仅设计字段：

```yaml
section:
series:
date:
summary:
tags:
```

说明：

- 用于栏目/系列文本，避免把栏目逻辑埋在目录名和 `sections.yaml` 别名中。

Texts 的审计后正式规则已拆分到 `docs/design/archive-data-v2-texts.md`，其中冻结了五个 section 到三个 kind 的映射、稳定 ID、日期、封面、legacy、迁移验收和 live-compatible 输出规则。后续 Texts 实现以该专用文档为准。

## 8. 文件命名与媒体规则

### entry-id 生成原则

- 使用小写、短横线分隔的稳定 id。
- 优先基于英文名或已有稳定 slug；没有英文名时可使用拼音/人工指定 id。
- 一旦生成并被首页或迁移 manifest 引用，不应随标题变化而改变。
- 同名冲突时加年份或短后缀，例如 `hades-2018`。

### 文件夹命名原则

- 条目文件夹名等于 `entry-id`。
- 文件夹名不承载评分、分类、日期等业务信息。
- 旧原始文件名不强制丢弃，迁移期写入 `legacy` 或 `migration-manifest.json`。

### cover 文件规则

- 主封面固定为 `cover.*`。
- 一个条目最多一个主封面。
- 额外截图、角色图、海报变体放入 `assets/`。
- 第一版不要求自动寻找封面，Archive Studio v0 由用户选择或上传。

### content.md 规则

- 长正文、曲目列表、个人观点、引用摘录、笔记正文放入 `content.md`。
- `entry.yaml` 中只保留短字段，不塞大段正文。
- 迁移时旧 Markdown 正文应原样进入 `content.md`，除非用户另行确认清洗。

### audio 文件规则

- Music 主音频固定为 `audio.*`。
- 不校验音频内容质量，只校验存在、扩展名和引用关系。
- 多音频条目可放入 `assets/audio/`，但 v0 不优先支持。

### assets 目录规则

- `assets/` 保存非主封面、非主音频的条目附属素材。
- 复杂结构可以按 kind 细分，例如 `assets/characters/`、`assets/screenshots/`。
- 不要求第一版自动改名所有历史文件，但 v2 新写入应使用稳定规则。

## 9. 旧数据迁移原则

- 旧 OneDrive Data 只读，不在迁移中覆盖、重命名或删除。
- 迁移输出写到新的 `ArchiveData-v2`，且必须能安全删除后重跑。
- 所有旧文件必须有去向：映射为条目文件、条目 assets、config、migration 报告，或进入 unmapped。
- 所有旧字段必须映射、保留到 `legacy`，或进入人工确认报告。
- 不确定内容不由 AI 猜测，例如评分含义、分类归属、封面选择、媒体选择、文本摘要。
- 无法分类的文件进入 `migration/unmapped-files.json`。
- 无法映射字段进入 `migration/legacy-field-report.md`。
- 迁移 manifest 必须记录旧相对位置、新相对位置、文件类型、checksum 和处理状态。

## 10. 无损迁移验收标准

迁移成功必须能用证据证明：

- 条目数量一致，或差异有明确解释。
- 文件数量一致，或差异有明确解释。
- 媒体文件 checksum 可核对。
- 旧字段 100% 有去向：映射、保留到 `legacy`，或列入人工确认报告。
- 首页引用可以映射到 v2 `entry-id`。
- 生成后的 `public/data` 数量可与旧生成结果对比。
- 旧 Data 保留不动。
- 人工确认项清单明确，且不被“生成成功”替代。
- 迁移 dry-run 可以在不写 v2 的情况下输出预计条目、文件、字段和风险数量。

## 11. Archive Studio v0 适配原则

Archive Studio v0 只做清楚、可预览、可回退的文件管理：

- 用户选择 board。
- 用户选择 kind。
- 前端显示对应表单。
- 用户手动填写字段。
- 用户上传或选择素材。
- 保存为 v2 文件结构。
- 保存前预览将写入哪些文件、是否覆盖、是否缺必需字段。
- 保存后运行 v2 检查脚本。
- 不做 AI 自动补全。
- 不做自动找封面。
- 不做自动查外链。
- 不做自动生成简介。
- 不做自动发布。

v0 的理想试点是 `music/album`：字段少、媒体规则清楚、现有 33 个条目已经通过封面/音频匹配检查。

## 12. 分阶段实施建议

建议路线：

1. 完成本设计文档。
2. 做只读迁移审计：不写 `ArchiveData-v2`，只列出旧条目、旧文件、旧字段和可映射关系。
3. 做 migration dry-run：输出将创建的目录、文件、字段映射、checksum 和未映射报告。
4. 以 Music v2 试点迁移，仍不覆盖旧 Data。
5. 建立 v2 检查脚本，验证 `entry.yaml`、`content.md`、`cover.*`、`audio.*`。
6. 建立 v2 Music 生成器试点，将 v2 Music 生成到独立临时输出或受控派生目录。
7. Archive Studio v0 只支持 Music，新建/编辑 `music/album`。
8. Music 闭环稳定后，再扩展 Texts、Visions、Games。

## 13. 旧结构审计摘要

本设计基于当前只读审计：

- Games：按 `Game-年份` 目录组织普通游戏图片，存在 DLC 文件名规则；`Game-Live` 承载长期赛季内容，包含代表项 YAML、代表图和赛季图片；普通目录可能有 `meta.yaml`。
- Visions：按分组目录组织海报，分组 `meta.yaml` 提供 `cinema`、`quote`、`url`、`type`；角色橱窗是特殊目录，包含 GIF、头像和 `meta.yaml`。
- Music：根目录 Markdown 表示专辑/原声条目，`Covers` 保存封面，`Songs` 保存音频；当前 33 个 Markdown、33 个封面、33 个音频匹配通过。
- Texts：按栏目目录组织 Markdown，`sections.yaml` 定义栏目、描述和别名；部分栏目含展示图片目录。
- 顶层配置：`homepage.yaml` 做首页优先条目编排；`site-layout.yaml` 做首页数量、游戏赛季挂载年份和文本默认栏目；`site-ui.yaml` 做全站 fallback 文案。
