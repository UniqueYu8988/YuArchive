# PRODUCT.md

本文件只记录 YuArchive 当前产品事实和边界，不记录新功能设想。

## 产品一句话说明

YuArchive 是一个个人数字收藏馆，用网页方式展示用户长期整理的游戏、影视、音乐、文本收藏。

## 核心用途

- 汇总并展示个人收藏记录；
- 按游戏、影视、音乐、文本四类组织内容；
- 通过 Archive 的 YAML / Markdown / 媒体文件维护新工作流数据；
- 通过 Archive Studio 显式生成前端可读取的数据和公开媒体，旧构建脚本保留兼容用途。

## 四类收藏

| 分类 | 当前含义 | 主要源数据 |
|---|---|---|
| 游戏 | 游戏、平台、评分、游玩时间、完成状态、DLC、长期赛季内容 | `Archive/entries/games`；旧 `Data/Games` 只读 |
| 影视 | 电影、剧集、动画、观影标记、短摘、角色橱窗 | `Archive/entries/visions`；旧 `Data/Visions` 只读 |
| 音乐 | 专辑、代表曲、曲目、封面、音频 | `Archive/entries/music`；旧 `Data/Music` 只读 |
| 文本 | 书籍笔记、得到头条、睡前消息、参考信息、拾遗等文本档案 | `Archive/entries/texts`；旧 `Data/Texts` 只读 |

## 当前真实功能

- React 前端展示首页和四个分类页面；
- 前端读取 `public\data\home.json`、`games.json`、`visions.json`、`music.json`、`texts.json`；
- `build_archive.py` 从 OneDrive 源目录读取素材和 Markdown/YAML，生成 JSON、WebP、音频缓存和报告；
- Archive Studio 提供四板块新建、公开同步和首页精选管理；所有写入均为本地显式操作，不自动发布；
- 页面提供主题切换、背景音乐入口、移动端提示等轻量交互；
- `README.md` 是简洁人类入口，AI 第一入口是 `AGENTS.md`。

## 当前阶段目标

当前目标是稳定 Archive + Archive Studio 工作流，让条目创建、公开同步和首页精选形成可预览、可校验、可回退的本地闭环。

当前仍不做：

- 重新设计产品；
- 扩展新功能；
- 重构前端；
- 重写构建脚本；
- 清理或迁移真实收藏数据。

## 维护体验长期方向

旧 OneDrive Data + `build_archive.py` 继续作为只读兼容与回退链路。新的日常维护逐步迁移到 Archive + Archive Studio：用户通过本地表单创建条目、预览文件、校验后保存，并显式同步公开 JSON；数据仍是可理解、可备份的 YAML / Markdown / 媒体文件，不依赖数据库。

未来可以逐步把维护体验提升到更方便、更实用，并支持部分自动化。自动化的目标是减少重复劳动、降低出错率、提供只读检查、差异预览、校验和受控验收，而不是替代用户对收藏内容、评分、笔记、分类和媒体选择的判断。

任何自动化都必须保持数据可理解、可备份、可回退。旧 OneDrive Data 保持只读迁移来源，Archive 承接新工作流维护；自动化不能在未确认的情况下批量改写收藏内容、评分、笔记、分类或媒体文件。

## 不可破坏的行为

- OneDrive 源数据不能丢失、覆盖或被误清理；
- 四类收藏仍应能被 `build_archive.py` 读取；
- 前端仍应从 `public\data` 读取生成后的分类数据；
- 派生缓存不能被误认为唯一数据源；
- 发布脚本不能被误运行；
- 收藏标题、分类、评分和展示描述是网页展示资产，不按高敏感信息处理；
- 密钥、token、账号凭据、本机绝对路径、OneDrive 真实源目录路径和大型媒体不应被无意上传到 GitHub。

## 核心数据边界

| 数据 | 用途 | 仓库/发布边界 | 是否允许删除 |
|---|---|---|---|
| `C:\Users\Yu\OneDrive\图片\Data` | 旧版收藏源数据和源配置 | 只读迁移来源与回退备份，默认不进入 Git | 否 |
| `C:\Users\Yu\OneDrive\图片\Archive` | 当前新工作流维护数据 | Archive Studio 受控写入，默认不进入 Git | 仅按事务回退 |
| `C:\Users\Yu\AI\Archive\public\data` | 前端运行读取的生成 JSON | 公开网页派生数据，可受控进入 Git | 仅受控重生成 |
| `C:\Users\Yu\AI\Archive\src\data` | 生成聚合数据和站点配置 | 派生数据；不得包含本机路径、真实源路径或秘密值 | 仅受控重生成 |
| `C:\Users\Yu\AI\Archive\public\webp_cache` | 图片转码缓存 | 派生媒体缓存，按体积和发布策略单独判断 | 源数据完整时可重生成 |
| `C:\Users\Yu\AI\Archive\public\audio_cache` | 音频缓存 | 派生媒体缓存，按体积和发布策略单独判断 | 源数据完整时可重生成 |
| `C:\Users\Yu\AI\Archive\dist` | 构建产物 | 不提交 | 可重生成 |
| `C:\Users\Yu\AI\Archive\node_modules` | npm 依赖 | 不提交 | 可重装 |

## 当前完成标准

当前阶段完成标准是：新工作流文档能让一个新对话在不依赖历史上下文的情况下，准确识别项目根目录、真实数据目录、启动/构建/生成方式、禁止事项和下一步。
