# Code Risk Audit

本文件记录 YuArchive 代码风险审计第一轮结果。本轮只读理解代码结构、数据生成链路、前端读取链路和高风险文件，不修改代码、不运行高风险命令、不读取或展示个人收藏正文。

## 本轮边界

- 允许：只读查看代码、配置和脚本；建立代码风险地图；更新本任务文档和状态文档。
- 禁止：修改 `build_archive.py`、`package.json`、`一键发布到云端.bat`、`src`、`public` 生产代码或数据、OneDrive Data、缓存、reports 数据文件。
- 禁止：运行 `build_archive.py`、`npm run dev`、`npm run build`、`npm run preview`、发布脚本或 Git 写操作。
- 本轮未读取 `public/data/*.json` 或 `src/data/*.json` 正文，只只读核对文件存在与大小。

## 已检查的文件

- 根目录配置：`package.json`、`vite.config.ts`、`tailwind.config.js`、`postcss.config.js`、`tsconfig*.json`、`vercel.json`、`index.html`
- 脚本：`build_archive.py`、`一键发布到云端.bat`、`启动.bat`
- 前端入口：`src/main.tsx`、`src/App.tsx`
- 数据读取：`src/hooks/useJsonData.ts`、`src/data/siteConfig.ts`、`src/types.ts`
- 页面和组件：`src/pages/GamesPage.tsx`、`src/pages/HomePage.tsx`、`src/pages/Visions.tsx`、`src/pages/MusicPage.tsx`、`src/pages/TextsPage.tsx`、`src/components/TimelineView.tsx`
- 派生和辅助目录：`public/data`、`src/data`、`reports`、`public/webp_cache`、`public/audio_cache`、`public/media_cache`

## 代码结构概览

- 技术栈：React 18、TypeScript、Vite、Tailwind CSS、React Router、React Markdown、Lucide React。
- 前端入口：`src/main.tsx` 创建 React root，加载 `src/App.tsx` 和 `src/index.css`。
- 路由入口：`src/App.tsx` 使用 `BrowserRouter`、`Routes`、`Route`，路径为 `/`、`/games`、`/movies`、`/music`、`/texts`。
- 页面分布：`HomePage`、`GamesPage`、`Visions`、`MusicPage`、`TextsPage` 分别承接首页和四类页面；`GamesPage` 主要包装 `TimelineView`。
- 组件分布：`TimelineView.tsx` 承担游戏时间线的大量展示逻辑；影视、音乐、文本页面各自包含较多页面内组件和状态。
- 数据读取入口：`src/hooks/useJsonData.ts` 通过 `fetch(url, { cache: 'force-cache' })` 读取 `/data/*.json`，并用模块级 `Map` 缓存数据和进行中的请求。
- 样式系统：`src/index.css` 是大型全局样式入口，配合 Tailwind 配置和大量自定义 CSS class；部分页面还有较多 inline style。
- 状态管理：没有 Redux、Zustand 等复杂状态库；主要使用 React 本地 `useState`、`useMemo`、`useEffect`、`useRef`。
- 测试或检查脚本：`package.json` 只有 `dev`、`build`、`preview`，未发现独立测试、lint 或类型检查脚本；`build` 内含 `tsc -b && vite build`，但本轮未运行。

## 数据生成风险

`build_archive.py` 是最高风险文件，因为它把读取源数据、转码媒体、生成 JSON、写报告、联网补全和可能写回源 YAML 放在同一个执行流程里。

### 读取源数据

- 源根：`C:\Users\Yu\OneDrive\图片\Data`
- 分类源目录：`Games`、`Visions`、`Music`、`Texts`
- 顶层源配置：`site-ui.yaml`、`site-layout.yaml`、`homepage.yaml`
- 文本分区配置：`Texts\sections.yaml`
- 游戏和影视元数据：各类 `meta.yaml`
- 音乐和文本：Markdown、封面、音频和相关素材

### 写入派生目录

- 前端 JSON：`public/data/home.json`、`games.json`、`visions.json`、`music.json`、`texts.json`
- 聚合 JSON：`src/data/archive_data.json`、`src/data/site_config.json`
- 媒体缓存：`public/webp_cache`、`public/audio_cache`、`public/media_cache`
- 报告和缓存：`reports/games_meta_inventory.csv`、`games_missing_english.csv`、`games_meta_todo.csv`、`games_meta_todo.md`、`steam_lookup_cache.json`

### 反写 OneDrive Data

- `sync_game_meta_template()` 会比较并写回游戏目录下的 `meta.yaml`。
- 该函数会规范化 platform、english title、url、price、rating、playtime、genre、completed、display title、DLC parent 等字段。
- 这是源数据写入点，必须视为高风险；不能把脚本运行成功等同于源数据安全。

### 最危险区域

- 路径常量区：硬编码 OneDrive 源根和项目输出目录，一旦路径错误会影响全流程。
- 媒体处理函数：图片、音频、动图转码会写缓存、重命名大小写变体、删除旧音频缓存。
- `sync_game_meta_template()`：写回 OneDrive 游戏源 `meta.yaml`。
- Steam 元数据相关函数：联网请求、读写 `steam_lookup_cache.json`、自动补全报告。
- `export_games_todo_reports()`：写 reports 辅助报告，报告内容不能被当成源数据。
- `main()`：创建输出目录、删除旧 `public/data/texts` 目录、写入全部前端 JSON。

### 前端必须依赖的输出

- `/data/home.json`
- `/data/games.json`
- `/data/visions.json`
- `/data/music.json`
- `/data/texts.json`
- 媒体路径引用到的 `public/webp_cache`、`public/audio_cache`、`public/media_cache`
- `src/data/site_config.json` 通过 `src/data/siteConfig.ts` 被页面读取，用于 UI 文案、布局和 asset version。

### 缓存或报告输出

- `public/webp_cache`、`public/audio_cache`、`public/media_cache` 是派生缓存。
- `reports` 是扫描、维护辅助和历史参考，不是权威源数据，也不是当前任务清单。
- `steam_lookup_cache.json` 可能被脚本读取，不应随意移动。

### 适合以后加保护的行为

- 增加只读审计模式：列出将读取和将写入的路径，不执行写入。
- 增加差异预览：特别是游戏 `meta.yaml` 写回前，输出将变更的文件和字段。
- 增加输出目录保护：确认写入目标仍在项目根内，源写入只允许经用户确认的白名单。
- 增加 JSON schema 或轻量结构检查：验证 `public/data/*.json` 是否满足前端最低字段要求。
- 增加报告边界检查：确认 reports 输出不会被误解释为源数据或任务清单。

## 前端读取风险

### 数据读取链路

- `src/App.tsx` 中每个路由分别调用 `useJsonData`：
  - `/data/home.json` -> `HomePage`
  - `/data/games.json` -> `GamesPage`
  - `/data/visions.json` -> `Visions`
  - `/data/music.json` -> `MusicPage`
  - `/data/texts.json` -> `TextsPage`
- `useJsonData` 只负责 fetch、缓存、错误记录和返回 `{ data, error }`，不做结构验证。
- 路由层有加载和 fetch 错误兜底，但数据一旦成功返回，页面组件大多默认结构正确。

### 组件依赖

- `HomePage` 依赖 `HomePageData.counts` 和四组 latest 列表。
- `GamesPage` 直接把 `TimelineCategory` 传给 `TimelineView`。
- `Visions` 依赖 `TimelineCategory.years`、`ArchiveItem.type` 和可选 `showcase`。
- `MusicPage` 依赖 `MusicCategory.items`，并使用 `cover`、`content`、`audio`、`url`、`track_title`。
- `TextsPage` 依赖 `TextsCategory.items`、可选 `sections` 和 `siteLayout.texts_default_section_key`。
- `TimelineView` 依赖 `TimelineCategory.years`、`total_count` 和大量 `ArchiveItem` 游戏元数据字段。

### 数据结构变化最容易坏的位置

- 顶层 JSON 缺少 `years`、`items`、`total_count` 时，页面会直接访问这些字段。
- 图片、音频、动图路径变化会导致展示缺图或音频不可播放。
- `src/data/site_config.json` 变化会影响 `assetVersion`、UI 文案和文本默认分区。
- 游戏元数据字段类型变化会影响 `TimelineView` 的评分、平台图标、DLC、赛季展示。
- 文本 Markdown 内容字段变化会影响 `ReactMarkdown` 渲染和展开逻辑。

### 兜底和错误边界

- 有 fetch 失败和加载状态兜底：路由层显示 `RouteStateCard`。
- 部分页面有空数据兜底，如 `hasData`、`data.items[0]?.id`、`data.sections ?? []`。
- 图片加载错误在 `TimelineView` 内有局部占位；音乐封面缺失有图标占位。
- 没有全局 React error boundary；成功 fetch 但结构不符合类型时，运行时仍可能抛错。
- TypeScript 类型是编译期约束，不会验证运行时 JSON。

### 不适合第一步改的地方

- 不适合第一步大拆 `HomePage`、`TextsPage`、`MusicPage` 或 `TimelineView`，这些页面体积大且与视觉表现强耦合。
- 不适合第一步改 `build_archive.py` 数据流或 `sync_game_meta_template()` 写回行为。
- 不适合第一步改发布脚本，因为它和生成、Git 写入、推送耦合，需单独计划。
- 不适合第一步调整真实 OneDrive Data 结构或字段。

## 高风险文件排名

| 文件或目录 | 职责 | 风险原因 | 是否适合第一批改造 | 建议处理方式 |
|---|---|---|---|---|
| `build_archive.py` | 从 OneDrive 源数据生成 JSON、缓存和报告 | 同时读源、写派生、写缓存、写 reports、联网补全，并可能写回游戏 `meta.yaml` | 不适合直接改主流程 | 先做只读风险标注和独立验证脚本；后续单独计划 dry-run |
| `一键发布到云端.bat` | 一键生成、暂存、提交、推送 | 把数据生成、Git 写入和远端发布串在一起 | 不适合第一批改造 | 保持禁用；后续先写发布前检查清单 |
| `C:\Users\Yu\OneDrive\图片\Data` | 唯一长期源数据 | 项目外部真实个人资产，误改不可由项目目录恢复 | 不允许自动改造 | 只读审计，任何写入都需备份、预览、确认 |
| `public/data` | 前端 fetch 的派生 JSON | 前端运行强依赖，但不是源数据，手改会制造假事实 | 不适合手改 | 用结构检查验证，不手工维护 |
| `src/data` | 生成聚合数据和站点配置 | 被 `siteConfig.ts` 和历史聚合数据使用，易与 `public/data` 边界混淆 | 不适合手改 | 只读检查引用关系，避免当源数据 |
| `public/webp_cache`、`public/audio_cache`、`public/media_cache` | 派生媒体缓存 | 体积和内容像真实资产，误删会影响页面展示 | 不适合手改 | 保留边界说明；后续只做存在性检查 |
| `src/App.tsx` | 路由、导航、主题、音频、数据入口 | 五个路由的数据加载入口集中，修改会影响全站 | 谨慎 | 第一批只读定位，后续小改需单独验证 |
| `src/hooks/useJsonData.ts` | JSON fetch 和缓存 | 无运行时结构验证，缓存策略影响数据刷新 | 适合小步加旁路测试，不急改 | 可先写独立结构检查，不改 hook |
| `src/components/TimelineView.tsx` | 游戏时间线核心展示 | 文件大、依赖游戏元数据字段多 | 不适合第一批拆改 | 先列依赖字段，后续局部测试 |
| `src/pages/HomePage.tsx` | 首页综合展示 | 体积大，依赖四类首页 payload | 不适合第一批拆改 | 先建立 payload 静态检查 |
| `src/pages/MusicPage.tsx` | 音乐页面和音频播放 | 依赖音频路径、封面、Markdown 曲目解析 | 暂不改 | 后续可加数据样例测试 |
| `src/pages/TextsPage.tsx` | 文本页面和 Markdown 渲染 | 依赖 section、content、cover、响应式状态 | 暂不改 | 后续可加结构检查和空数据样例 |
| `src/pages/Visions.tsx` | 影视页面和角色橱窗 | 依赖年份、类型、showcase 媒体 | 暂不改 | 后续可加字段存在性检查 |
| `reports` | 维护辅助报告和 Steam 缓存 | 可能被误当任务清单，`steam_lookup_cache.json` 可能被脚本读取 | 不改数据文件 | 说明入口已建立，后续只读使用 |

## 第一批低风险候选任务

1. 建立只读 JSON 结构检查脚本或文档化检查清单  
   检查 `public/data/home.json`、`games.json`、`visions.json`、`music.json`、`texts.json` 的最低字段，不修改文件，不运行 `build_archive.py`。

2. 建立前端数据依赖字段表  
   从 `types.ts` 和页面组件整理每个页面依赖的字段，形成 Markdown 表，不改代码。

3. 为 `build_archive.py` 写只读危险写入点清单  
   标出写入 `meta.yaml`、`public/data`、缓存和 reports 的函数与行号，先不改脚本。

4. 建立发布前人工检查清单  
   文档化发布前必须确认的 Git 状态、敏感数据、大文件、生成/构建验收步骤，不改发布脚本。

5. 建立最小样例 JSON 草案  
   用脱敏小样例描述五个 JSON 的最低结构，供以后测试或 schema 使用，不使用真实个人正文。

## 下一步建议

只建议先做一个最小任务：建立 `public/data/*.json` 的只读结构检查清单或脚本草案，限定为读取字段形状、不修改任何数据、不运行 `build_archive.py`。
