# CURRENT_STATE.md

本文件只记录 YuArchive 现在的状态，不保存完整历史。

最后更新：2026-06-15

## 当前阶段

老项目底层工作流改造已完成本地提交，当前进入系统级底层升级的保护性第一步：建立源侧只读结构检查。

## 已完成

- 已确认项目根目录：`C:\Users\Yu\AI\Archive`。
- 已确认真实收藏源数据目录：`C:\Users\Yu\OneDrive\图片\Data`。
- 用户已完成备份。
- V2 核心工作流文件已复制到项目根目录和 `docs`。
- 已完成首次正式只读审计。
- 已将 V2 模板文档改造成本项目基线文档。
- 已将 README 收敛为简洁人类入口，明确 AI 第一入口是 `AGENTS.md`。
- 已确认旧 `public/archive_data.json` 无当前运行引用，并归档为 `docs/history/legacy-generated/public_archive_data_legacy.json`。
- 已完成网页实际维护逻辑梳理。
- 已确认 `build_archive.py` 可能反写 OneDrive 游戏源 YAML。
- 用户已补充长期方向：当前维护方式偏手动和外行友好，未来希望升级为更方便实用、可逐步自动化的维护系统。
- 独立新对话接管测试已通过：新对话已经能正确识别项目用途、真实源数据、派生数据、高风险命令和当前阶段。
- 已建立 `reports/README.md`，明确 `reports` 只是扫描、辅助和历史参考，不是权威源数据，也不是当前任务清单。
- 已将历史游戏辅助报告移动到 `reports/history/legacy-game-assist/`。
- 已将根目录旧 Vite 日志移动到 `docs/history/legacy-logs/`。
- 已完成进入代码风险审计前的最终文档一致性检查，未发现阻碍接管的正式文档冲突。
- 已完成代码风险审计第一轮，只读检查前端入口、页面组件、数据读取 hook、配置、`build_archive.py` 和发布脚本。
- 已建立 `docs/tasks/code-risk-audit.md`，记录代码结构、数据生成风险、前端读取风险、高风险文件排名和低风险候选任务。
- 已建立 `docs/tasks/protect-public-data-shape.md` 和 `scripts/check-public-data-shape.mjs`，用于只读检查 `public/data/*.json` 的最低结构。
- 已运行 `node scripts/check-public-data-shape.mjs`，当前五个前端读取 JSON 均通过最低结构检查。
- 已建立 `docs/tasks/protect-generated-data-privacy.md` 和 `scripts/check-generated-data-privacy.mjs`，用于只读扫描派生 JSON 中的本机路径、旧源路径和明显秘密字段风险。
- 已运行 `node scripts/check-generated-data-privacy.mjs`：前端读取的 `public/data/*.json` 通过检查，`src/data/archive_data.json` 存在待核对命中；本轮未输出具体命中内容，未修改任何 JSON。
- 已建立 `docs/tasks/repository-privacy-boundary.md`，记录 `src/data/archive_data.json` 的仓库隐私 / 发布卫生问题和后续处理方案设计。
- 已执行仓库边界方案 A：`src/data/archive_data.json` 已退出 Git 跟踪，本地文件仍保留，`.gitignore` 已加入对应忽略规则。
- 已建立 `docs/tasks/sanitize-generated-source-root.md`，只读定位 `metadata.source_root` 的生成逻辑并设计脱敏/相对化方案；本轮未修改 `build_archive.py`。
- 已受控完成 `metadata.source_root` 脱敏：`build_archive.py` 只改 1 行，保留字段但改为非敏感固定标识。
- 已运行 `python -X utf8 build_archive.py`，生成脚本成功完成；运行前后 OneDrive Data 中 YAML/YML/MD 文件哈希变化数量为 0。
- 已运行 `node scripts/check-public-data-shape.mjs` 和 `node scripts/check-generated-data-privacy.mjs`，均通过。
- 已按用户确认修正文档风险表述：公开展示用的收藏标题、分类、评分和描述不按高敏感信息处理，主要保护对象是密钥、token、账号凭据、本机路径、OneDrive 真实源路径、误改源数据、误发布和误推送。
- 已建立 `docs/tasks/protect-source-data-shape.md` 和 `scripts/check-source-data-shape.mjs`，用于只读检查 OneDrive Data 源目录、四个板块、顶层 YAML、Markdown frontmatter、文本栏目和首页引用形状。
- 已运行 `node scripts/check-source-data-shape.mjs`：Global、Games、Visions、Music、Texts 均通过。此前 Homepage/Games 存在 1 个近似匹配警告，已确认为脚本未把 `Game-Live` 单独 YAML 文件名纳入候选标题；检查脚本已补充该通用规则，当前检查通过。
- 已建立 `docs/tasks/protect-music-media-shape.md` 和 `scripts/check-music-media-shape.mjs`，用于只读检查 Music Markdown、Covers 封面和 Songs 音频之间的基础匹配关系。
- 已运行 `node scripts/check-music-media-shape.mjs`：33 个 Music Markdown、33 个封面文件、33 个音频文件均匹配通过，无 warning。本轮未读取音频内容，未修改源数据。

## 当前可正常使用的事实

- 项目是 Vite + React + TypeScript 前端。
- `package.json` 中有 `dev`、`build`、`preview` 脚本。
- 未发现独立测试、lint 或检查脚本；`build` 内部执行 `tsc -b && vite build`。
- `README.md` 是简洁人类入口，不再承担完整维护手册或 AI 第一入口职责。
- 前端读取 `public\data\home.json`、`games.json`、`visions.json`、`music.json`、`texts.json`。
- 公开网页继续依赖 `public\data\*.json`，当前未发现生产前端直接读取 `src\data\archive_data.json`。
- `scripts/check-public-data-shape.mjs` 只读取上述派生 JSON 并检查顶层结构、必要字段和集合数量，不修改数据。
- `scripts/check-generated-data-privacy.mjs` 只读取指定派生 JSON 并检查本机路径、旧源路径和明显秘密字段风险，不修改数据。
- `scripts/check-source-data-shape.mjs` 只读取 OneDrive Data 源目录结构、YAML 和 Markdown frontmatter，输出目录/文件/缺失数量和解析摘要，不修改源数据、不运行生成脚本。
- `scripts/check-music-media-shape.mjs` 只读取 Music 源目录、Markdown frontmatter 和媒体文件名，按 `build_archive.py` 的封面/音频匹配约定做存在性检查，不读取音频二进制内容，不修改源数据。
- `build_archive.py` 从 OneDrive Data 生成 JSON、WebP、音频缓存、媒体缓存和报告；当前已将聚合 metadata 的 source root 脱敏为非敏感固定标识。
- `build_archive.py` 不是纯只读生成器，运行时可能反写 OneDrive 游戏源 `meta.yaml`。

## Git 状态

只读检查结果：

- 当前分支：`master`
- 当前状态：`master...origin/master`
- 已修改：`.gitignore`、`AGENTS.md`、`ARCHITECTURE.md`、`CURRENT_STATE.md`、`PRODUCT.md`、`README.md`、`build_archive.py`、`docs/BASELINE_ACCEPTANCE.md`、`docs/plans/STABILIZATION_PLAN.md`、`public/data/home.json`、`public/data/texts.json`、`src/data/site_config.json`
- 已删除：`.vite-dev.err.log`、`.vite-dev.log`、`.vite-preview.err.log`、`.vite-preview.log`、`public/archive_data.json`、`reports/games_assist_batch_01.csv`、`reports/games_assist_batch_02.csv`、`reports/games_assist_manifest.md`、`reports/games_meta_todo.latest.csv`、`src/data/archive_data.json`
- 未跟踪：`docs/history/`、`docs/tasks/code-risk-audit.md`、`docs/tasks/protect-generated-data-privacy.md`、`docs/tasks/protect-public-data-shape.md`、`docs/tasks/repository-privacy-boundary.md`、`docs/tasks/sanitize-generated-source-root.md`、`reports/README.md`、`reports/history/`、`scripts/`

本轮未执行 `git add`、`git commit`、`git push`。

## 当前主要风险

| 风险 | 影响 | 当前处理 |
|---|---|---|
| 源数据位于项目外部 | 只备份项目目录无法恢复完整馆藏 | 文档明确 OneDrive Data 必须单独备份 |
| `build_archive.py` 会写多个位置 | 可能改动源数据、生成数据、缓存和报告 | 默认禁止运行，后续受控验收再运行 |
| 发布脚本会 Git 写入并推送 | 可能误提交真实数据或大文件 | 默认禁止运行 |
| 派生缓存体积较大且像真实数据 | 可能误判为唯一数据源 | 文档区分源数据和派生数据 |
| 仓库或发布泄露本机路径/秘密值 | 可能暴露本机环境、源目录或账号凭据 | 已建立只读隐私检查，`metadata.source_root` 已脱敏 |
| `build_archive.py` 风险集中 | 读源、写派生、写缓存、写 reports、联网补全和源 YAML 写回集中在单脚本 | 后续先做只读结构检查或写入点清单，不直接改主流程 |
| 前端运行时 JSON 无结构验证 | fetch 成功但字段形状错误时，页面组件可能运行时报错 | 已建立只读 JSON 结构检查，后续可继续补充纯函数保护 |
| 源侧维护规则缺少自动体检 | 用户改源文件后可能到生成阶段才发现结构问题 | 已建立源侧只读结构检查，当前检查通过 |
| Music 媒体匹配依赖文件名约定 | 封面或音频命名不一致可能导致页面缺图/缺音频 | 已建立只读 Music 媒体匹配检查，当前通过 |
| 生成脚本高风险 | 运行会写派生数据、缓存和 reports，并可能反写 OneDrive 游戏 YAML | 本轮受控运行后 OneDrive YAML/YML/MD 哈希无变化；后续仍默认禁止运行 |

## 当前下一步

只建议做一件事：继续补充源侧 schema/check 的小型只读规则，例如 Texts 日期/frontmatter 规则检查，或先提交 Music 媒体匹配检查。

## 暂时不做

- 不改代码；
- 不改 `build_archive.py`；
- 不进入 `build_archive.py` 改造；
- 不改 OneDrive 源数据；
- 不改 `public\data`、`src\data` 或派生缓存；
- 不运行构建脚本；
- 不启动开发服务器；
- 不运行发布脚本；
- 不执行一键发布或 Git 推送，直到当前工作区变更完成审查；
- 不执行 Git 写操作；
- 不进入代码改造；
- 不做代码修改；
- 不开始代码修复；
- 不进入自动改写源数据的维护自动化开发。
- 不进入数据生成或发布验收。

## 当前验证状态

- 项目能否启动：本轮未启动，因用户要求默认不要启动。
- 核心人工验收：本轮未进行页面验收。
- 自动测试：未发现独立测试脚本，本轮未运行。
- 构建：本轮未运行 `npm run build`。
- 数据生成：本轮未运行 `build_archive.py`。
- 最近一次验证日期：2026-06-15，已运行源侧只读结构检查和 Music 媒体匹配检查；两者均通过。
- 最近维护逻辑审计：2026-06-14，已确认真实维护流程、源数据/派生数据边界、`build_archive.py` 写回源 YAML 风险和发布脚本风险。

## 新对话需要知道

这是个人数字收藏馆老项目工作流迁移阶段。优先保护 `C:\Users\Yu\OneDrive\图片\Data`，不要运行生成、构建、发布或 Git 写命令。README 已收敛为人类入口；AI 第一入口是 `AGENTS.md`。旧 `public/archive_data.json` 已归档，当前前端数据入口是 `public\data\*.json`。

`reports` 只能作为辅助参考，不是权威源数据，也不是当前任务清单。`reports/README.md` 是 reports 边界说明入口；历史游戏辅助报告已收束到 `reports/history/legacy-game-assist/`，旧 Vite 日志已收束到 `docs/history/legacy-logs/`。阶段 2 已基本完成，代码风险审计第一轮也已只读完成，当前仍未做代码改造、源数据修改、派生数据生成、构建或发布。

长期方向是未来可以逐步改进维护体验和自动化能力。当前底层升级应继续从只读检查、schema、预览和差异报告开始；不做前端重构，不手改派生 JSON，不再次运行 `build_archive.py`，不自动改写 OneDrive Data，也不执行发布或推送。
