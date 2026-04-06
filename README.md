# YuArchive

YuArchive 是一套以 `OneDrive` 为唯一内容源、本地脚本负责构建、前端只负责展示的个人档案系统。

它的维护逻辑可以概括成一句话：

**往源目录丢素材 -> 改对应 md / yaml -> 跑一次 `build_archive.py` -> 网页自动更新。**

---

## 1. 总体结构

### 内容源目录

真正长期维护的内容都在：

`C:\Users\Yu\OneDrive\图片\Data`

目前分成四个主板块：

- `Games`
- `Visions`
- `Music`
- `Texts`

### 网页项目目录

前端与构建层在：

`C:\Users\Yu\AI\Archive`

它的职责是：

1. 扫描 `OneDrive` 中的原始素材
2. 把图片转成网页使用的 `.webp`
3. 把 Markdown / YAML 转成结构化数据
4. 输出到：
   - [`C:\Users\Yu\AI\Archive\public\webp_cache`](C:\Users\Yu\AI\Archive\public\webp_cache)
   - [`C:\Users\Yu\AI\Archive\public\audio_cache`](C:\Users\Yu\AI\Archive\public\audio_cache)
   - [`C:\Users\Yu\AI\Archive\src\data\archive_data.json`](C:\Users\Yu\AI\Archive\src\data\archive_data.json)
5. 由 React 页面直接消费生成后的数据

### 当前构建入口

核心脚本：

[`C:\Users\Yu\AI\Archive\build_archive.py`](C:\Users\Yu\AI\Archive\build_archive.py)

---

## 2. 每日更新流程

以后你日常更新，默认按这套顺序即可：

1. 在 `OneDrive\Data` 中新增图片、Markdown、YAML 或音频
2. 运行：

```powershell
cd C:\Users\Yu\AI\Archive
python -X utf8 build_archive.py
```

3. 本地预览：

```powershell
npm run dev
```

4. 确认页面没问题后，再按需提交 / 推送 GitHub

如果只是改内容，不需要直接改 React 代码。

---

## 3. Games 维护规则

### 目录结构

`Games` 当前有这些目录：

- `Game-2010`
- `Game-2015`
- `Game-2020`
- `Game-2023`
- `Game-2024`
- `Game-2025`
- `Game-2026`
- `Game-Live`

其中：

- 普通游戏维护在各年份目录
- 长期更新 / 赛季型内容维护在 `Game-Live`

### 3.1 普通年份游戏

示例目录：

`C:\Users\Yu\OneDrive\图片\Data\Games\Game-2024`

你要做的事：

1. 把封面图放进年份目录
2. 打开同目录下的 [`meta.yaml`](C:\Users\Yu\OneDrive\图片\Data\Games\Game-2024\meta.yaml)
3. 补这一条的字段
4. 运行构建脚本

### 普通游戏支持字段

在各年份 `meta.yaml` 里，每条游戏现在支持：

- `english_title`
- `url`
- `platform`
- `price`
- `rating`
- `playtime`
- `completed`
- `genre`
- `display_title`
- `dlc_parent_title`

含义：

- `display_title`
  覆盖网页显示标题，不改原始图片文件名
- `dlc_parent_title`
  只给 DLC 用，用来指定“扩展所属”的显示名

### 示例

```yaml
"地平线5_风火轮":
  english_title: "Forza Horizon 5"
  url: "https://store.steampowered.com/app/1551360/"
  platform: "xbox"
  price: "¥ 139"
  rating: "5"
  playtime: ">100h"
  completed: true
  genre: "racing"
  display_title: "风火轮"
  dlc_parent_title: "极限竞速：地平线 5"
```

### 文件命名规则

#### 普通本体

直接用游戏名：

- `哈迪斯.png`
- `最终幻想 VII：重制版.png`

#### DLC

使用 `_` 分隔：

- `地平线5_风火轮.png`
- `女神异闻录3_Episode Aegis.png`
- `暗黑破坏神4_憎恨之王.png`

现在 DLC 仍然作为独立条目显示，但标题和所属本体由 `display_title` / `dlc_parent_title` 控制。

### 3.2 Game-Live：长期更新 / 赛季内容

路径：

`C:\Users\Yu\OneDrive\图片\Data\Games\Game-Live`

这里维护三类长期更新内容：

- [`英雄联盟.yaml`](C:\Users\Yu\OneDrive\图片\Data\Games\Game-Live\英雄联盟.yaml)
- [`云顶之弈.yaml`](C:\Users\Yu\OneDrive\图片\Data\Games\Game-Live\云顶之弈.yaml)
- [`暗黑破坏神 IV.yaml`](C:\Users\Yu\OneDrive\图片\Data\Games\Game-Live\暗黑破坏神%20IV.yaml)

同时目录里还放：

- 主封面，例如 `英雄联盟.png`
- 各赛季图，例如 `LOL_Worlds 2024.png`、`TFT_S16传世之说.png`

### Game-Live 顶层字段

每份 yaml 顶层支持：

- `english_title`
- `url`
- `platform`
- `price`
- `rating`
- `playtime`
- `completed`
- `genre`
- `summary`
- `hover_note`
- `season_heading`
- `season_subheading`
- `season_description`

### Game-Live 赛季条目字段

在 `season_entries:` 下面维护每一个赛季：

#### LOL

- `champion`
- `note`

#### 云顶之弈

- `period`
- `theme`
- `feature`

#### 暗黑破坏神 IV

- `period`
- `build`

### 示例

```yaml
season_entries:
  Worlds 2025:
    champion: "T1"
    note: "当所有人都在等新王加冕时，最后举起奖杯的还是那个最熟悉的名字。"
```

### 重要说明

现在赛季可见内容已经优先从这 3 份 yaml 读取。  
也就是说，后续赛季更新请直接改这些 yaml，不需要再碰脚本。

---

## 4. Visions 维护规则

### 目录结构

当前按时间段分目录：

- `开端`
- `前尘`
- `旧影`
- `未远`
- `此岸`

每个分段目录中：

- 放海报图
- 放一个统一命名的 `meta.yaml`

### 维护方式

1. 把新海报图放进对应分段目录
2. 打开该目录下的 `meta.yaml`
3. 确保图片标题和 yaml 顶层标题一致
4. 补字段

### Visions 支持字段

- `cinema`
- `quote`
- `url`
- `type`

### 示例

```yaml
双城之战:
  cinema: false
  quote: "有些命运并不是为了被纠正，而是为了被看见。"
  url: "https://www.themoviedb.org/"
  type: "tv"
```

### 说明

- `quote` 是 hover 里显示的短摘
- `url` 一般导向 TMDB
- `type` 当前用于电影 / TV / 动画筛选与图标区分
- `cinema: true` 会显示院线观影标识

---

## 5. Music 维护规则

### 目录结构

路径：

`C:\Users\Yu\OneDrive\图片\Data\Music`

里面当前有：

- `Covers`
- `Songs`
- 一批专辑 Markdown 文件

### 维护方式

每张专辑一份 md，例如：

[`C:\Users\Yu\OneDrive\图片\Data\Music\Arcane.md`](C:\Users\Yu\OneDrive\图片\Data\Music\Arcane.md)

支持的 frontmatter 目前是：

- `Description`
- `Cover`（可选，仅在你想手动指定封面时需要）
- `Audio`（可选，仅在你想手动指定音频时需要）

### 推荐维护规则

#### 封面

- 优先放在 `Covers`
- 推荐封面文件名和 md 文件名保持一致
- 如果同名，`Cover` 可以完全不写，脚本会自动匹配

#### 音频

- 一张专辑只对应一首代表曲
- 把音频放在：
  [`C:\Users\Yu\OneDrive\图片\Data\Music\Songs`](C:\Users\Yu\OneDrive\图片\Data\Music\Songs)
- 推荐音频文件名与专辑 md 同名

例如：

- `Arcane.md`
- `Songs\Arcane.mp3`

这样 `Audio` 可以完全不写，脚本会自动匹配同名音频。

### 当前音频规则

如果 `Audio` 不写：

- 脚本会自动尝试匹配 `Songs/专辑同名.{mp3,m4a,wav,ogg,flac,aac}`

如果你手动填写 `Audio`：

- 脚本优先使用你写的路径

### 曲目标题规则

网页展示的 `track_title` 会优先取：

1. frontmatter 里的 `track_title`
2. 如果没有，则自动取正文曲目列表的第一首

所以后续你只要把“你想默认听的那首歌”放在第一首即可。

### 当前最简维护规则

如果你想把 `Music` 维护到最简单，直接遵守这一条就够了：

- `md` 文件名 = 页面标题
- `Covers` 里的封面文件名 = `md` 文件名
- `Songs` 里的音频文件名 = `md` 文件名

这样你通常只需要写：

- `Description`
- 曲目列表正文

### 示例

```md
---
Description: 这张原声像夜色里仍在发烫的霓虹。
---

1. What Could Have Been
2. Enemy
3. Guns for Hire
```

---

## 6. Texts 维护规则

### 目录结构

路径：

`C:\Users\Yu\OneDrive\图片\Data\Texts`

现在它支持：

- `每天听本书`
- `得到头条`
- `睡前消息`
- `参考信息`
- `拾遗`
- 栏目定义在：
  [`C:\Users\Yu\OneDrive\图片\Data\Texts\sections.yaml`](C:\Users\Yu\OneDrive\图片\Data\Texts\sections.yaml)

### sections.yaml 的作用

这里定义的是：

- 栏目 `key`
- 栏目标题
- 栏目说明
- 栏目别名

例如：

```yaml
book-reviews:
  title: "每天听本书"
  description: "把一本书留下一个入口、一段印象，像搭起一排可以反复回望的书架。"
  aliases: "每天听本书,书评,book-review,book-reviews"
  icon: "icons/texts-dedao.png"

headline:
  title: "得到"
  description: "把每天值得留下的一点观察、判断与信息浓缩，整理成可以回看的文字切片。"
  aliases: "得到头条,得到,headline,头条"
```

### 文章归类规则

优先级如下：

1. frontmatter 里的 `section`
2. 所在子文件夹名（例如 `每天听本书` / `得到头条` / `睡前消息` / `参考信息` / `拾遗`）
3. 默认归到 `book-reviews`

### 每天听本书的书架展示位

如果你想把 `Texts` 顶部做成书架视觉，请把书封放到：

`C:\Users\Yu\OneDrive\图片\Data\Texts\每天听本书\书架`

支持常见图片格式，构建时会自动转成网页用的 `.webp`，并在 `Texts` 顶部展示。

### Texts 单篇文章支持字段

- `title`
- `date`
- `tags`
- `section`

### 示例

```md
---
Title: 你好世界 — 全能档案馆的起点
Date: 2026-01-01
Tags: [随笔, 起点]
Section: notes
---
```

### 日期说明

`Texts` 目前仍建议你逐步统一成：

`YYYY-MM-DD`

因为脚本虽然能兼容旧格式，但仍会在构建摘要里提示日期告警。

---

## 7. 已经做到“所见即所得”的部分

当前这些可见内容，已经不再靠脚本常量硬编码，而是回填到源文件维护：

- `Texts` 的栏目标题和介绍
- `Games` 的显示名覆盖
- `Games` 的 DLC 显示标题和所属本体标题
- `Game-Live` 的赛季条目内容
- `Music` 的默认曲名推断
- `Games` 的 `playtime` 显示文本

也就是说，现在真正影响页面内容展示的那一层，已经基本回到 `OneDrive` 源目录维护。

---

## 8. 仍然属于“逻辑层”的固定规则

现在这批全站级文案与逻辑，已经额外拆到源目录两份配置里：

- [`C:\Users\Yu\OneDrive\图片\Data\site-ui.yaml`](C:\Users\Yu\OneDrive\图片\Data\site-ui.yaml)
- [`C:\Users\Yu\OneDrive\图片\Data\site-layout.yaml`](C:\Users\Yu\OneDrive\图片\Data\site-layout.yaml)
- [`C:\Users\Yu\OneDrive\图片\Data\homepage.yaml`](C:\Users\Yu\OneDrive\图片\Data\homepage.yaml)

### site-ui.yaml

适合维护：

- `Current Album`
- `Selected Section`
- `未分类`
- `未知`
- `未评分`
- `赛季旅程`

### site-layout.yaml

适合维护：

- 首页各板块最新内容抽取数量
- `Game-Live` 挂到哪一年
- 赛季旅程优先级
- `Texts` 默认栏目 key

### homepage.yaml

适合维护：

- 首页各板块想优先展示的内容顺序
- `Games / Visions / Music / Texts` 的钦点展示项

规则：

- 按标题精确匹配
- 优先展示 `homepage.yaml` 里列出的内容
- 如果某个板块没写满，剩余位置会自动补最新项

还有一些东西仍在代码里，但它们主要是展示逻辑，不是档案内容本身：

- `Game-Live` 统一展示到 `2026`
- 赛季旅程内部顺序
- 首页各板块最新内容的抽取数量
- 一些 UI 标签，如：
  - `Current Album`
  - `Selected Section`
  - `未分类`
  - `未知`
  - `未评分`

这些不影响你日常补内容，但后续如果你也想把它们全部源文件化，可以继续做。

---

## 9. 本地常用命令

### 重建数据

```powershell
cd C:\Users\Yu\AI\Archive
python -X utf8 build_archive.py
```

### 本地开发预览

```powershell
npm run dev
```

### 生产构建检查

```powershell
npm run build
```

---

## 10. 最推荐的维护习惯

后面新增内容时，按这套最省心：

1. 先往 `OneDrive\Data` 丢素材
2. 再改对应 md / yaml
3. 跑 `build_archive.py`
4. 本地看页面
5. 最后再决定要不要提交代码 / 推 GitHub

如果没有改前端交互或样式，优先不要碰 React 文件。

---

## 11. 一句话版本

### Games

丢图片进年份目录，改同目录 `meta.yaml`；赛季改 `Game-Live` 那 3 份 yaml。

### Visions

丢海报进对应时间段目录，改该目录 `meta.yaml`。

### Music

加专辑 md、封面、同名音频进 `Songs`，第一首歌放想默认展示的曲目。

### Texts

写 md 即可，栏目配置改 `sections.yaml`，文章可用 `section` 或文件夹归类。
