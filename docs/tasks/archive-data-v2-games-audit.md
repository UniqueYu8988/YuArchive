# Archive Games 只读规则审计

创建日期：2026-06-20
状态：第一轮已完成，迁移规则已冻结

## 目标

只读确认旧 Games 的年份目录、`meta.yaml`、DLC 文件名规则、`Game-Live` 赛季聚合、当前 `games.json` 与前端依赖，为 Archive Games 规则设计提供事实基线。

## 边界

- 旧 OneDrive Data 全程只读；
- 不修改图片、YAML、首页配置或媒体文件；
- 不运行 `build_archive.py`；
- 不修改 `public/data/games.json` 或 `home.json`；
- 不创建 Archive Games 输出；
- 不接入 Archive Studio；
- 不执行 Git push 或发布。

## 已检查

- `[OneDrive Data]/Games` 的 7 个年份目录与 `Game-Live`；
- 321 张图片与 8 份 YAML 的角色分布；
- 5 份年份 `meta.yaml` 的条目和字段覆盖；
- 3 份 live game YAML、40 个赛季素材及赛季字段；
- `build_archive.py` 的元数据模板同步、DLC 拆分、赛季聚合、排序和输出逻辑；
- `public/data/games.json`、`home.json` 的数量与引用关系；
- `TimelineView.tsx` 与 `src/types.ts` 的字段依赖。

## 结构事实

### 普通游戏

- 7 个年份组共 279 张图片；
- 2020、2023、2024、2025、2026 五组有 `meta.yaml`，186 张图片与 186 个元数据条目一一匹配；
- 2010、2015 两组共 93 张图片，按旧生成器规则明确跳过元数据模板；
- managed 图片缺元数据、孤立元数据和 YAML 基础解析错误均为 0；
- 186 个增强条目都维护 `english_title`、`url`、`platform`、`price`、`rating`、`playtime`、`completed`、`genre`；
- 另有 6 个 `display_title`，3 个显式 `dlc_parent_title`。

2010 / 2015 的无元数据状态是当前兼容规则，不等于这些字段在 v2 中必需为空。迁移时应保留其“legacy 未增强”事实，不应自动补全或猜测。

### DLC

- 当前生成器把普通年份图片文件名中第一个下划线解释为本体与 DLC 标题分隔符；
- 当前有 6 个非赛季下划线候选，live JSON 也生成 6 个 DLC；
- 只有 3 个条目显式维护 `dlc_parent_title`，其余 3 个依赖文件名推断；
- v2 应使用 `kind: dlc` 与显式 `parent_id`，不再把下划线当长期数据契约。

### 长期运营游戏与赛季

- `Game-Live` 有 3 份父条目 YAML、40 个赛季图片和 2 张独立父封面；
- 40 个赛季图片由三个硬编码前缀识别，分布为 24、9、7；
- 3 份 YAML 中的 `season_entries` 与 40 个赛季图片完全匹配；
- 三类赛季子字段并不相同，当前使用 `theme / feature / period`、`champion / note`、`period / build` 等各自语义；
- live JSON 将其聚合为 3 个顶层 seasonal 条目，内部共有 40 个 `season_entries`；
- 缺独立父封面的 live game 会回退到排序最新的赛季图片。

v2 应使用 `kind: live_game` 和稳定父 ID，并为每个赛季建立稳定 season ID。父封面回退可留在生成层，不应冒充源数据事实。

## 当前 live 形态

- `games.json` 共 282 个顶层条目：279 个年份图片条目加 3 个 live game 聚合条目；
- 189 个条目启用增强游戏卡片，93 个旧年份条目保持普通海报卡；
- 3 个 seasonal、6 个 DLC、40 个赛季子条目；
- 282 个 ID 全部是 `games_<year>_<index>` 位置型 ID，新增、删除或排序会改变 ID；
- 首页配置 9 项全部能匹配，当前首页包含 3 个 seasonal 和 1 个 DLC；
- 普通条目的空 URL 会被生成器转换为 Steam 搜索链接，这属于兼容输出，不应在迁移时当作用户维护的源字段。

## 前端硬依赖

基础卡片：

- `id`、`image_path`、`title`；
- `game_meta_enabled` 决定增强游戏卡片或普通海报卡；
- `english_title`、`platform`、`price`、`rating`、`playtime`、`completed`、`genre`；
- `url` 用于卡片外链。

DLC：

- `dlc` 控制扩展标记；
- `dlc_parent` 显示所属本体。

赛季：

- `seasonal` 与 `season_entries` 控制独立赛季专区；
- `summary`、`hover_note`、`season_heading`、`season_subheading`、`season_description`；
- 子条目依赖 `id`、`title`、`image_path`、`label`，并按父游戏标题读取不同扩展字段。

## 主要风险

1. `build_archive.py` 会调用模板同步并可能重写年份 `meta.yaml`，Games 仍是四板块中源侧风险最高的生成链。
2. DLC、live game 和赛季关系依赖文件名分隔符、前缀及硬编码父标题，重命名可能改变语义。
3. 2010 / 2015 与后续年份存在两套展示契约，迁移时不能无声地统一或自动补数据。
4. live ID 与 season ID 都是位置型或标题型兼容 ID，不适合作为 v2 稳定引用。
5. 自动生成的 Steam 搜索 URL、父封面回退和赛季目标年份属于输出策略，不是源收藏事实。
6. 前端根据三个父游戏标题分支解释赛季字段，live-compatible 生成必须先保留这一行为。

## 已冻结规则

1. 当前 6 个下划线候选全部按旧 live 行为迁移为 DLC；其中 3 个缺显式父关联，只允许 planner 根据旧文件名生成一次性迁移映射并单独计数，不反写源 YAML。
2. 2010 / 2015 保持 `legacy_meta_enabled: false`，只迁移标题、年份和封面，不自动补评分、平台、链接或其他主观字段。
3. 三个 live game 的赛季扩展字段原样保留为 kind-specific legacy 字段，第一版不强行统一语义；共有字段只冻结 id、title、label、cover 和 order。
4. 自动生成的 Steam 搜索 URL、父封面回退和赛季目标年份只属于 live-compatible 输出策略，不进入 v2 源事实。

## 推荐下一步

编写 `docs/design/archive-data-v2-games.md`，随后建立只读 migration planner。第一步不要修改 `build_archive.py`，不要迁移，也不要接入 Archive Studio。

## 验证

```powershell
node scripts/audit-archive-data-v2-games.mjs
node scripts/check-source-data-shape.mjs
node scripts/check-public-data-shape.mjs
```

审计脚本只输出数量、结构和风险，不输出标题清单、评分明细或完整本机路径。

## 回退

删除本任务文档和 `scripts/audit-archive-data-v2-games.mjs`，再回退状态文档中的本轮记录即可。旧源和派生数据没有被修改。
