# CURRENT_STATE.md

本文件只记录 YuArchive 现在的状态，不保存完整历史。

最后更新：2026-06-14

## 当前阶段

老项目底层工作流改造：从长期依赖历史对话，迁移到 V2 文档化工作流。

## 已完成

- 已确认项目根目录：`C:\Users\Yu\AI\Archive`。
- 已确认真实收藏源数据目录：`C:\Users\Yu\OneDrive\图片\Data`。
- 用户已完成备份。
- V2 核心工作流文件已复制到项目根目录和 `docs`。
- 已完成首次正式只读审计。
- 已将 V2 模板文档改造成本项目基线文档。

## 当前可正常使用的事实

- 项目是 Vite + React + TypeScript 前端。
- `package.json` 中有 `dev`、`build`、`preview` 脚本。
- `README.md` 记录旧日常流程：改 OneDrive 源数据，运行 `build_archive.py`，再本地预览。
- 前端读取 `public\data\home.json`、`games.json`、`visions.json`、`music.json`、`texts.json`。
- `build_archive.py` 从 OneDrive Data 生成 JSON、WebP、音频缓存、媒体缓存和报告。

## Git 状态

只读检查结果：

- 当前分支：`master`
- 远端：`origin https://github.com/UniqueYu8988/YuArchive.git`
- 最近提交：`c6e05df Improve mobile layouts and split archive data loading`
- 当前状态：`master...origin/master [ahead 1]`
- 新复制的 V2 文档当前为未跟踪文件：`AGENTS.md`、`PRODUCT.md`、`ARCHITECTURE.md`、`CURRENT_STATE.md`、`docs/`

本轮未执行 `git add`、`git commit`、`git push`。

## 当前主要风险

| 风险 | 影响 | 当前处理 |
|---|---|---|
| 源数据位于项目外部 | 只备份项目目录无法恢复完整馆藏 | 文档明确 OneDrive Data 必须单独备份 |
| `build_archive.py` 会写多个位置 | 可能改动源数据、生成数据、缓存和报告 | 默认禁止运行，后续受控验收再运行 |
| 发布脚本会 Git 写入并推送 | 可能误提交真实数据或大文件 | 默认禁止运行 |
| 派生缓存体积较大且像真实数据 | 可能误判为唯一数据源 | 文档区分源数据和派生数据 |
| 旧 Markdown 和历史上下文尚未收束 | 新对话可能仍需读取多个入口 | 已建立计划，下一阶段再处理 |

## 当前下一步

只建议做一件事：在新的独立对话中测试接管能力，让新对话只依赖这些基线文档和只读检查，复述项目事实、数据边界、禁止命令和下一步计划。

## 暂时不做

- 不改代码；
- 不改 `build_archive.py`；
- 不改 OneDrive 源数据；
- 不运行构建脚本；
- 不启动开发服务器；
- 不清理旧 Markdown 或历史上下文；
- 不执行 Git 写操作；
- 不进入稳定化计划第 2 阶段。

## 当前验证状态

- 项目能否启动：本轮未启动，因用户要求默认不要启动。
- 核心人工验收：本轮未进行页面验收。
- 自动测试：未发现独立测试脚本，本轮未运行。
- 构建：本轮未运行 `npm run build`。
- 数据生成：本轮未运行 `build_archive.py`。
- 最近一次验证日期：2026-06-14，只读审计和 Markdown 内容更新。

## 新对话需要知道

这是个人数字收藏馆老项目工作流迁移阶段。优先保护 `C:\Users\Yu\OneDrive\图片\Data`，不要运行生成、构建、发布或 Git 写命令。下一步不是改代码，而是验证新工作流文档是否足以让独立新对话接管。
