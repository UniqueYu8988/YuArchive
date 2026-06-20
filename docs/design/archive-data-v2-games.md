# ArchiveData-v2 Games 文件规则

创建日期：2026-06-20
状态：规则已冻结，planner 待实现

## 1. 定位

Games v2 保存普通游戏、DLC 和长期运营游戏的可维护源结构。旧 OneDrive Data 始终只读；迁移不得调用 `build_archive.py`，不得反写 `meta.yaml`，不得自动补全平台、评分、链接或赛季描述。

第一版目标是把旧生成器依赖的年份目录、下划线、赛季前缀和父标题分支转换成显式字段，同时继续支持当前 `games.json` 和首页展示契约。

## 2. kind

| board | kind | 用途 | 当前预期 |
|---|---|---|---:|
| games | `normal_game` | 普通游戏 | 273 |
| games | `dlc` | DLC 或扩展内容 | 6 |
| games | `live_game` | 长期运营游戏与赛季聚合 | 3 |

`season` 不是顶层 kind。它只存在于 `live_game/seasons/` 下，不进入 `entries/games/season/`。

## 3. 普通游戏目录

```text
entries/games/normal_game/<game-id>/
├─ entry.yaml
└─ cover.<ext>
```

`entry.yaml`：

```yaml
id: game-xxxxxxxxxxxx
board: games
kind: normal_game
title: ""
year: 2026
metadata_enabled: true
english_title: ""
url: ""
platform: steam
price: ""
rating: 0
playtime: ""
completed: false
genre: ""
summary: ""
hover_note: ""
legacy: {}
```

规则：

- `title` 是当前展示标题；旧图片 stem 和 `display_title` 的关系写入 legacy；
- `year` 来自旧年份目录，是当前时间线分组事实；
- `metadata_enabled` 必填，决定兼容页面使用增强游戏卡片还是普通海报卡；
- `cover` 必填，迁移时逐字节复制，不转码；
- `rating` 允许空值或 0–5 整数；
- `platform` 和 `genre` 使用现有枚举，但旧空值不自动猜测；
- `url` 只保存源 YAML 的显式值，生成的 Steam 搜索 URL不写入 v2；
- `summary`、`hover_note` 只在源中存在时保留，不自动生成。

### 2010 / 2015

这两个年份组固定迁移为：

```yaml
metadata_enabled: false
```

仅保存 id、board、kind、title、year、cover 和 legacy。不得从 Steam、文件名或当前 live JSON 自动补全 english title、platform、URL、评分、时长、价格、完成状态或分类。

## 4. DLC 目录

```text
entries/games/dlc/<game-id>/
├─ entry.yaml
└─ cover.<ext>
```

在普通游戏字段基础上增加：

```yaml
parent_id: game-xxxxxxxxxxxx
parent_title: ""
```

规则：

- 当前 6 个旧下划线候选全部迁移为 DLC；
- `parent_id` 是长期关联，必须指向 v2 中存在的 `normal_game` 或 `live_game`；
- `parent_title` 只用于兼容和人工检查，不替代 `parent_id`；
- 3 个已有 `dlc_parent_title` 的条目优先使用显式源字段；
- 另 3 个只允许 planner 按旧文件名生成一次性候选，并必须报告 `inferred_parent`；
- planner 若不能唯一匹配父条目必须阻断，禁止把下划线继续带入 v2 运行时规则。

## 5. live_game 目录

```text
entries/games/live_game/<game-id>/
├─ entry.yaml
├─ cover.<ext>                 # 可选
└─ seasons/
   └─ <season-id>/
      ├─ season.yaml
      └─ cover.<ext>
```

父 `entry.yaml`：

```yaml
id: game-xxxxxxxxxxxx
board: games
kind: live_game
title: ""
metadata_enabled: true
english_title: ""
url: ""
platform: ""
price: ""
rating: 0
playtime: ""
completed: false
genre: ""
summary: ""
hover_note: ""
season_heading: ""
season_subheading: ""
season_description: ""
legacy: {}
```

规则：

- 当前迁移 3 个 live game；
- 父 `cover` 可选，当前只有 2 个父条目拥有独立封面；
- 缺父封面时，live-compatible 生成器可使用排序最后的 season cover，但不得复制成伪造的 v2 父源资产；
- 当前页面把 live game 放入可配置的赛季目标年份，该年份属于 layout，不写入父条目事实；
- `url` 只保存源 YAML 的显式值；当前兼容输出继续保持 live game URL 为空，除非后续单独改变产品行为。

## 6. season 目录与字段

`season.yaml` 共有字段：

```yaml
id: season-xxxxxxxxxxxx
title: ""
label: ""
order: 0
legacy: {}
```

可选扩展字段：

```yaml
period: ""
theme: ""
feature: ""
champion: ""
note: ""
build: ""
```

规则：

- 当前迁移 40 个 season；
- 每个 season 必须有 `season.yaml` 和 `cover.<ext>`；
- `id` 稳定，不使用数组位置；
- `order` 由旧规则解析结果迁移，用于复现当前顺序；
- `label` 保留当前父类对应的展示标签；
- 三组扩展字段原样保留，第一版不强行统一语义；
- 兼容页面仍可按父条目解释扩展字段，但 v2 检查器只验证允许字段和类型，不按中文父标题硬编码 schema。

## 7. 稳定 ID

### 迁移条目

```text
game-<sha256(规范化源相对角色路径) 前 12 位>
season-<sha256(规范化赛季源相对路径) 前 12 位>
```

- 普通游戏与 DLC 使用图片相对于旧 Games 根目录的路径；
- live game 使用其 YAML 相对路径；
- season 使用赛季图片相对路径；
- 哈希输入统一 `/` 分隔，不包含本机绝对路径；
- 相同输入重复规划必须生成相同 ID；
- 标题、排序、评分变化不得改变 ID。

### Archive Studio 新建条目

```text
game-YYYYMMDD-<8 位随机十六进制>
```

第一版 Studio 只新建 `normal_game`。DLC 与 live game 的创建需要父关联和 season 编辑流程，留到后续。

## 8. legacy

允许保存：

```yaml
legacy:
  source_relative_path: ""
  source_folder: ""
  source_stem: ""
  source_live_id: ""
  metadata_enabled: true
  display_title: ""
  dlc_parent_title: ""
  inferred_parent: false
  season_prefix: ""
```

- 所有路径必须相对于旧 Games 根目录；
- 不保存完整本机路径、OneDrive 字样或派生缓存路径；
- legacy 不进入公开 JSON，除非 live-compatible 映射明确需要；
- 自动生成的 Steam 搜索 URL不进入 legacy。

## 9. 配置

建议创建：

```text
config/games.yaml
```

```yaml
season_target_year: 2026
season_priority:
  - <stable-game-id>
```

该配置从旧 `site-layout.yaml` 迁移当前展示策略。优先级必须引用稳定 game ID，不再用父标题作为主键。

## 10. live-compatible 输出

第一版继续生成当前 `TimelineCategory`：

- 顶层：`key`、`display_name`、`total_count`、`sort_mode`、`years`；
- 普通与 DLC：保持当前字段、年份分组和排序；
- `normal_game` 输出 `dlc: false`，`dlc` 输出 `dlc: true` 与 `dlc_parent`；
- `live_game` 输出 `seasonal: true` 和 `season_entries`；
- `metadata_enabled: false` 映射为 `game_meta_enabled: false`；
- 兼容 preview 第一版复用当前 282 个 live ID、public media path、年份顺序、条目顺序与首页引用；
- Steam 搜索 URL、父封面回退和 season target year 在兼容层派生；
- 替换前必须报告字段差异、顺序差异、ID 差异、媒体差异与首页影响。

## 11. 迁移验收

预期：

- 顶层 entry 282：normal_game 273、dlc 6、live_game 3；
- 普通 / DLC cover 279；
- live parent cover 2；
- season 40，season cover 40；
- 5 份年份 `meta.yaml`、3 份 live YAML 和 321 张图片全部进入 manifest；
- managed 元数据映射 186/186；
- 旧年份未增强 93；
- DLC 6，其中 inferred parent 3；
- season 40/40，媒体缺失 0；
- unmapped 0、duplicate ID 0、隐私命中 0；
- 旧 OneDrive Data 前后文件快照不变。

## 12. 第一版 Archive Studio 范围

只支持 `games/normal_game` 新建：

- title、year、metadata_enabled；
- metadata_enabled 开启后显示 english_title、url、platform、price、rating、playtime、completed、genre；
- cover 必填；
- preview、preflight、create、Games v2 shape check；
- 不自动查询 Steam，不自动生成链接，不创建 DLC，不创建 live game，不编辑 season，不发布。

## 13. 下一步

实现只读 migration planner，验证 279 个普通年份图片、6 个 DLC、3 个 live game、40 个 season、全部父关联、稳定 ID 和目标文件角色。planner 不创建 ArchiveData-v2 文件。
