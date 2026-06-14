# ARCHITECTURE.md

本文件记录 YuArchive 当前架构事实，帮助后续任务先理解系统再改动。

## 1. 项目概览

- 软件类型：个人数字收藏馆前端网站。
- 项目根目录：`C:\Users\Yu\AI\Archive`。
- 真实源数据目录：`C:\Users\Yu\OneDrive\图片\Data`。
- 主要技术：React 18、TypeScript、Vite、Tailwind CSS、React Router、React Markdown、Lucide React。
- 数据生成：Python 脚本 `build_archive.py`。
- 启动方式：`npm run dev`，`启动.bat` 等价于 `npm run dev -- --host 127.0.0.1 --port 5173`。
- 构建方式：`npm run build`，内部执行 `tsc -b && vite build`。
- 部署相关：`vercel.json` 提供静态资源缓存头和 SPA rewrite。

## 2. 目录地图

| 路径 | 职责 | 是否应直接修改 |
|---|---|---|
| `src` | React 页面、组件、hooks、类型、样式入口 | 代码任务允许时修改 |
| `src\data` | 生成后的聚合数据和站点配置 | 不手改，受控重生成 |
| `public\data` | 前端实际 fetch 的分类 JSON | 不手改，受控重生成 |
| `public\webp_cache` | OneDrive 图片转 WebP 后的缓存 | 不手改，受控重生成 |
| `public\audio_cache` | OneDrive 音频复制/转码缓存 | 不手改，受控重生成 |
| `public\media_cache` | 角色橱窗等媒体缓存 | 不手改，受控重生成 |
| `public\icons`、`public\platform-icons` | 静态图标和展示素材 | 资源任务允许时修改 |
| `reports` | 构建脚本生成的游戏元数据报告和 Steam 缓存 | 不手改，受控重生成 |
| `dist` | Vite 构建产物 | 不手改，可重新构建 |
| `node_modules` | npm 依赖 | 不手改，可重新安装 |
| `docs` | 新工作流文档、计划、任务模板 | 文档任务允许时修改 |
| `C:\Users\Yu\OneDrive\图片\Data` | 真实收藏源数据 | 默认禁止修改 |

## 3. 源数据结构

| 源目录或文件 | 类型 | 职责 |
|---|---|---|
| `Data\Games` | 图片、YAML | 游戏收藏、年份分组、平台、评分、游玩时间、完成状态、DLC、赛季 |
| `Data\Visions` | 图片、WebP、GIF、YAML | 影视收藏、时间段分组、观影标记、短摘、角色橱窗 |
| `Data\Music` | Markdown、封面、音频 | 专辑说明、曲目、代表曲、封面和音频 |
| `Data\Texts` | Markdown、图片、YAML | 文本档案、栏目、书架封面 |
| `Data\homepage.yaml` | YAML | 首页优先展示内容 |
| `Data\site-layout.yaml` | YAML | 首页数量、赛季挂载、默认栏目等布局规则 |
| `Data\site-ui.yaml` | YAML | UI 文案和全站标签 |

## 4. 数据生成关系

当前核心流程：

```text
C:\Users\Yu\OneDrive\图片\Data
→ build_archive.py
→ public\data\*.json
→ public\webp_cache / public\audio_cache / public\media_cache
→ src\data\archive_data.json / src\data\site_config.json
→ React 前端读取并展示
```

`build_archive.py` 还会写入 `reports`，并可能通过 Steam 接口补全游戏元数据缓存。

重要风险：脚本中存在写回游戏 `meta.yaml` 模板的逻辑，因此运行前必须确认 OneDrive 源数据已备份。

## 5. 前端数据读取

`src\App.tsx` 通过 `useJsonData` 分别读取：

- `/data/home.json`
- `/data/games.json`
- `/data/visions.json`
- `/data/music.json`
- `/data/texts.json`

`src\hooks\useJsonData.ts` 使用浏览器 `fetch` 和内存缓存读取 JSON。

浏览器本地写入仅观察到：

- `localStorage` 中保存主题：`yu-theme`
- `localStorage` 中保存移动端提示关闭状态

这些不是收藏源数据。

## 6. 源数据、派生数据、构建产物

| 类型 | 位置 | 说明 | 备份要求 |
|---|---|---|---|
| 源数据 | `C:\Users\Yu\OneDrive\图片\Data` | 唯一长期维护的真实收藏源 | 必须备份 |
| 派生结构数据 | `src\data`、`public\data` | 由脚本生成，前端使用 | 建议保留快照，可重生成 |
| 派生媒体缓存 | `public\webp_cache`、`public\audio_cache`、`public\media_cache` | 由源素材转换或复制 | 建议保留快照，可重生成 |
| 报告 | `reports` | 游戏元数据辅助报告和缓存 | 建议备份 |
| 构建产物 | `dist` | Vite 输出 | 可排除 |
| 依赖 | `node_modules` | npm 安装结果 | 可排除 |

## 7. 外部服务和配置

| 服务或配置 | 用途 | 配置位置 | 失败时影响 |
|---|---|---|---|
| GitHub | 远程仓库和发布脚本推送目标 | Git remote、`一键发布到云端.bat` | 无法推送或同步 |
| Vercel | 静态站点部署配置 | `vercel.json` | 部署缓存或路由行为受影响 |
| Steam Store API | 游戏元数据补全 | `build_archive.py` | 游戏英文名、价格、类型等自动补全可能失败 |
| TMDB 链接 | 影视条目的外部参考链接 | OneDrive `Visions` 元数据 | 链接失效不影响本地数据读取 |
| Spotify/GitHub 外链 | 页面导航外链 | `src\App.tsx` | 外链不可访问，不影响核心馆藏 |
| ffmpeg/JianyingPro ffmpeg | 音频转码候选工具 | `build_archive.py` | 音频转码可能回退为复制原文件 |

不要在本文档写入任何真实密码、密钥或令牌值。

## 8. 不应直接修改的目录

- `C:\Users\Yu\OneDrive\图片\Data`
- `src\data`
- `public\data`
- `public\webp_cache`
- `public\audio_cache`
- `public\media_cache`
- `reports`
- `dist`
- `node_modules`
- `.git`

如确需改变这些内容，必须通过受控任务、先备份、再运行对应生成或 Git 流程。

## 9. 当前技术债务

- 工作流刚迁移，文档仍在建立基线；
- `build_archive.py` 同时负责读取源数据、转码媒体、生成 JSON、写报告、联网补全，风险集中；
- 源数据位于项目外部，仅备份项目目录不足以恢复完整馆藏；
- 生成数据和媒体缓存已进入项目目录，需要持续区分“源”和“派生”；
- 旧 Markdown 和历史上下文尚未收束，本轮只建立计划，不进入清理。

## 10. 最近核对

- 日期：2026-06-14
- 核对方式：只读检查目录、`package.json`、`README.md`、`build_archive.py`、`src` 数据读取、`public\data` JSON 形态、OneDrive Data 分类结构和 Git 状态。
- 与当前代码是否一致：截至本次只读审计，本文档按当前文件系统和脚本事实记录。
