# CURRENT_STATE.md

本文件只记录 YuArchive 现在的状态，不保存完整历史。

最后更新：2026-06-16

## 当前阶段

ArchiveData-v2 的 Music v2 试点、live-compatible 数据替换和远端同步已完成，当前进入 Archive Studio v0 写入事务 sandbox 阶段。

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
- 已提交并推送 `499f084 Add source data shape check` 和 `8e31161 Add music media shape check`。
- 已进入 ArchiveData-v2 文件规则设计阶段，新建 `docs/design/archive-data-v2.md`，只设计规则，不迁移数据，不创建 `ArchiveData-v2` 目录。
- 已进入 ArchiveData-v2 阶段 2：只读迁移审计。已新建 `docs/tasks/archive-data-v2-migration-audit.md` 和 `scripts/audit-archive-data-v2-migration.mjs`。
- 已运行 `node scripts/audit-archive-data-v2-migration.mjs`：旧 Data 四个 board 共 774 个源文件，解析错误 0，人工确认计数 218；本轮只输出统计、字段名和数量，不输出条目标题清单，不写迁移结果。
- 已进入 ArchiveData-v2 阶段 3：migration dry-run。已新建 `docs/tasks/archive-data-v2-migration-dry-run.md` 和 `scripts/dry-run-archive-data-v2-migration.mjs`。
- 已运行 `node scripts/dry-run-archive-data-v2-migration.mjs`：共考虑 778 个源文件，checksum 文件 778 个，checksum 错误 0，计划条目 559 个，未映射文件 0，忽略系统文件 1，人工确认计数 223，写入动作 0；本轮未创建 `ArchiveData-v2` 目录，未修改 OneDrive Data 或生成数据。
- 已进入 ArchiveData-v2 阶段 4 的前置设计：新建 `docs/tasks/archive-data-v2-music-pilot-boundary.md`，定义 Music v2 试点迁移边界、允许/禁止范围、目标结构、验收标准和回退方式；本轮仍未创建 `ArchiveData-v2` 目录，未迁移数据。
- 已建立 Music v2 试点迁移 planner：新建 `docs/tasks/archive-data-v2-music-pilot-planner.md` 和 `scripts/plan-archive-data-v2-music-pilot.mjs`。
- 已运行 `node scripts/plan-archive-data-v2-music-pilot.mjs`：计划 Music album 条目 33 个，目标目录 33 个，目标角色 132 个（`entry_yaml`、`content_md`、`cover`、`audio` 各 33 个），ID 冲突 0，缺失封面 0，缺失音频 0，人工确认 0，写入动作 0；本轮未创建 `ArchiveData-v2` 目录，未复制文件。
- 已建立 Music v2 写入型试点迁移任务设计：新建 `docs/tasks/archive-data-v2-music-pilot-write-design.md`，明确未来若获授权只能创建局部 `ArchiveData-v2` 输出、必须做源哈希基线、manifest、回退删除和验收检查；本轮未执行写入。
- 用户已授权 Music v2 写入型试点迁移。已新建 `scripts/migrate-archive-data-v2-music-pilot.mjs` 并受控运行，创建新的 Music-only `ArchiveData-v2` 试点输出。
- 写入型试点迁移结果：源基线文件 99 个，运行后源变更 0、源缺失 0；创建 Music album 目录 33 个、`entry.yaml` 33 个、`content.md` 33 个、封面 33 个、音频 33 个、manifest 记录 99 条、unmapped 0。未运行 `build_archive.py`，未运行发布脚本。
- 首次迁移尝试因 Markdown checksum 校验口径不正确而停止；已按回退方案删除部分试点输出，修正为 Markdown 转换记录与媒体逐字节复制校验后重新运行成功。
- 已建立 `docs/tasks/protect-archive-data-v2-music-shape.md` 和 `scripts/check-archive-data-v2-music-shape.mjs`，用于只读检查生成后的 v2 Music 试点输出。
- 已运行 `node scripts/check-archive-data-v2-music-shape.mjs`：v2 Music 输出通过，33 个 entry 目录、33 个 `entry.yaml`、33 个 `content.md`、33 个封面、33 个音频、99 条 manifest、0 个 unmapped、隐私/路径规则命中 0。
- 已完成 Music v2 试点输出验收与 Git 边界整理：新建 `docs/tasks/archive-data-v2-music-pilot-acceptance.md`，确认生成的 `ArchiveData-v2` 试点输出位于项目 Git 工作树外，当前不会被普通项目提交包含。
- 当前建议：`ArchiveData-v2` 试点输出先作为本地/OneDrive 迁移产物保留，不复制进项目仓库；后续如需版本化，应单独设计数据仓库或 Git/LFS/忽略策略。
- 已完成 v2 Music 生成器试点设计：新建 `docs/tasks/archive-data-v2-music-generator-pilot-design.md`，定义生成器应读取 v2 Music album 输出，写入隔离临时 preview `music.json`，并只用计数方式对比当前 `public/data/music.json`。
- 已实现 v2 Music preview 生成器：新建 `scripts/generate-archive-data-v2-music-preview.mjs`，读取 `ArchiveData-v2/entries/music/album`，只写系统临时目录 preview `music.json`，不修改当前 `public/data/music.json`。
- 已运行 `node scripts/generate-archive-data-v2-music-preview.mjs`：preview 条目 33，当前 live Music 条目 33，顶层 key 匹配，item 字段集合匹配，必需字段缺失 0，content/cover/audio 均为 33，隐私/路径规则命中 0；未运行 `build_archive.py`。
- 已确认 preview 与当前 live Music 的 ID overlap 为 0、顺序差异 33；这不阻塞隔离 preview，但后续若要替换 live Music 数据，需要单独设计 ID 兼容/映射和媒体 URL 策略。
- 已完成 v2 Music live 替换前的 ID 兼容和媒体 URL 策略设计：新建 `docs/tasks/archive-data-v2-music-live-compat-strategy.md`。
- 当前策略结论：不直接替换 `public/data/music.json`；下一步应先做只读 v2-to-live 兼容映射，优先证明 33/33 条目可映射，并在第一版 live-compatible preview 中复用当前 live ID、`webp_cache` 和 `audio_cache` 路径。
- 已实现只读 Music v2-to-live 兼容映射脚本：新建 `docs/tasks/archive-data-v2-music-live-compat-mapper.md` 和 `scripts/map-archive-data-v2-music-live-compat.mjs`。
- 已运行 `node scripts/map-archive-data-v2-music-live-compat.mjs`：v2 条目 33、live 条目 33、映射成功 33、未映射 v2 0、未映射 live 0、歧义 0、重复候选 0，可复用 live ID 33、可复用 live cover 路径 33、可复用 live audio 路径 33，写入动作 0。
- 已实现 live-compatible v2 Music preview 生成器：新建 `docs/tasks/archive-data-v2-music-live-compatible-preview.md` 和 `scripts/generate-archive-data-v2-music-live-compatible-preview.mjs`。
- 已运行 `node scripts/generate-archive-data-v2-music-live-compatible-preview.mjs`：v2 条目 33、live 条目 33、映射成功 33、preview 条目 33，复用 live ID 33、live cover 路径 33、live audio 路径 33，必需字段缺失 0，顺序差异 0，隐私/路径规则命中 0；未修改 `public/data/music.json`，未运行 `build_archive.py`。
- 已完成 Music v2 替换 live 数据前的最终验收与提交边界设计：新建 `docs/tasks/archive-data-v2-music-live-replacement-gate.md`。
- 当前结论：仍不替换 `public/data/music.json`；如后续替换，必须单独授权，只替换 Music JSON，并运行 v2 输出检查、映射检查、live-compatible preview、public data shape 和 diff 审查。
- 用户已授权执行 Music v2 live-compatible JSON 替换，范围限定为只修改 `public/data/music.json`，不运行 `build_archive.py`，不 push。
- 已完成 Music v2 live-compatible JSON 替换：`public/data/music.json` 已由 live-compatible preview 替换，仍为 33 条，字段集合不变，cover 继续使用 `webp_cache`，audio 继续使用 `audio_cache`。
- 已建立替换验收记录：新建 `docs/tasks/archive-data-v2-music-live-replacement-acceptance.md`。替换后 `node scripts/check-public-data-shape.mjs`、`node scripts/check-generated-data-privacy.mjs` 和 live-compatible preview generator 均通过；diff 为 33 行新增、33 行删除。
- 已建立仓库范围变更 review 和 Git 提交计划：新建 `docs/tasks/archive-data-v2-change-review-and-commit-plan.md`，记录当前变更分组、验证结果和建议提交拆分；本轮未执行 Git 写操作。
- 已按计划完成并推送 ArchiveData-v2 本轮 4 个提交：`a6c87aa`、`6d12e58`、`8a5bffd`、`01962ad`。
- 已建立 Archive Studio v0 边界设计：新建 `docs/tasks/archive-studio-v0-boundary-design.md`，明确 v0 只先服务 `music/album`，先设计本地文件管理闭环，不实现前端、不自动改旧 OneDrive Data、不直接发布。
- 已建立 Archive Studio v0 技术入口设计：新建 `docs/tasks/archive-studio-v0-entry-design.md`，比较纯前端、本地 Node 服务、Electron/Tauri、命令行表单脚本四种方案，推荐先做 CLI 写入流程原型，再进入本地 Node 服务 + React 页面。
- 已建立 Archive Studio v0 `music/album` payload schema 和 preview 输出格式设计：新建 `docs/tasks/archive-studio-v0-music-payload-schema.md`，明确 create/update payload、字段规则、素材规则、preview operations、warnings/errors 和 sandbox 原型验收。
- 已建立 Archive Studio v0 CLI sandbox preview 原型：新建 `docs/tasks/archive-studio-v0-cli-sandbox-preview.md`、`docs/examples/archive-studio-v0-music-album-payload.sample.json` 和 `scripts/archive-studio-v0-music-preview-sandbox.mjs`，脚本读取项目内样例 JSON，只写系统临时目录的 preview JSON，不写真实 ArchiveData-v2 输出。
- 已建立 Archive Studio v0 变更范围 review 和 Git 提交计划：新建 `docs/tasks/archive-studio-v0-change-review-and-commit-plan.md`，建议将本轮 v0 设计和 sandbox preview 原型作为 1 个本地 commit 提交，暂不 push。
- 已拆分 Archive Studio v0 preview core 模块：新建 `docs/tasks/archive-studio-v0-preview-core-module.md` 和 `scripts/archive-studio-v0-music-preview-core.mjs`，CLI sandbox 继续只写系统临时目录。
- 已建立 Archive Studio v0 preview core 自检：新建 `docs/tasks/archive-studio-v0-preview-core-check.md` 和 `scripts/check-archive-studio-v0-preview-core.mjs`，覆盖合法 payload、无效 id、非法媒体扩展名、缺少标题、keep-existing 更新和安全断言；同时让无效 id 的 preview target 固定使用安全占位目录。
- 已建立 Archive Studio v0 写入事务设计：新建 `docs/tasks/archive-studio-v0-write-transaction-design.md`，定义 create/update、diff preview、backup manifest、write manifest、rollback、失败分类和后续 sandbox 路线；本轮仍未写真实 ArchiveData-v2 输出。
- 已建立 Archive Studio v0 transaction sandbox：新建 `docs/tasks/archive-studio-v0-transaction-sandbox.md` 和 `scripts/archive-studio-v0-music-transaction-sandbox.mjs`，只写系统临时目录，模拟 create / update / rollback，不写真实 ArchiveData-v2 输出。

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
- ArchiveData-v2 已完成 Music 试点闭环和 live-compatible 数据替换；目标是未来支持 Archive Studio 管理前端，旧 OneDrive Data 仍是迁移来源和回退备份。
- `scripts/audit-archive-data-v2-migration.mjs` 是只读迁移审计脚本，只统计旧条目、文件、字段键和可能的 v2 kind 映射，不创建 `ArchiveData-v2` 目录，不写 manifest、checksum 或迁移结果。
- `scripts/dry-run-archive-data-v2-migration.mjs` 是只读迁移 dry-run 脚本，只在内存中规划 v2 目标角色并计算 checksum 覆盖，不输出 checksum 明细，不创建 `ArchiveData-v2` 目录，不写 manifest、checksum 或迁移结果。
- `scripts/plan-archive-data-v2-music-pilot.mjs` 是只读 Music v2 试点迁移 planner，只在内存中规划 `music/album` 目标目录和文件角色，不创建 `ArchiveData-v2` 目录，不写 `entry.yaml`、`content.md`、manifest、checksum 或迁移结果。
- `scripts/migrate-archive-data-v2-music-pilot.mjs` 是受控写入型 Music-only 迁移脚本，只创建新的 `ArchiveData-v2` Music 试点输出，不修改旧 OneDrive Data，不运行 `build_archive.py`。
- `scripts/check-archive-data-v2-music-shape.mjs` 是只读 v2 Music 输出检查脚本，检查生成后的 entry 目录、manifest、unmapped 和隐私/路径规则，不修改 v2 输出。
- `scripts/generate-archive-data-v2-music-preview.mjs` 是隔离 preview 生成器，只写系统临时目录，不修改当前 live `public/data/music.json`。
- `scripts/generate-archive-data-v2-music-live-compatible-preview.mjs` 是 live-compatible 隔离 preview 生成器，只写系统临时目录，复用 live ID 和 public media path，不修改当前 live `public/data/music.json`。
- `ArchiveData-v2` 试点输出当前位于项目仓库外，不属于本项目 Git 工作树。

## Git 状态

最近只读检查结果：

- 当前分支：`master`
- 当前状态：`master...origin/master`。
- ArchiveData-v2 Music 试点和 live-compatible 替换相关提交已推送到远端。
- 当前工作区因 Archive Studio v0 transaction sandbox 和状态文档更新而存在新的未提交变更。

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
| ArchiveData-v2 迁移范围大 | 如果直接迁移或自动整理，可能误改源数据或丢失历史字段 | 当前已完成 Music-only 写入试点、live-compatible preview 和 Music live JSON 替换；后续扩展其他 board 仍需单独任务 |
| Archive Studio v0 可能变成过早前端开发 | 如果直接实现 UI，容易跳过写入边界、回退和验收设计 | 已先建立 v0 边界设计，下一步只做技术入口比较，不直接实现 |
| v2 Music ID 与 live Music ID 不兼容 | 直接使用 raw v2 preview 替换 `public/data/music.json` 可能导致选择状态、首页引用或未来链接不稳定 | 已实现 live-compatible preview，证明可复用 33 个 live ID；禁止用 raw v2 preview 直接替换 |
| v2 Music 媒体路径不是 live 公共路径 | 当前 preview 使用 `v2-preview` 路径，部署环境不会直接服务这些外部源文件 | live-compatible preview 已复用 33 个 `webp_cache` 和 33 个 `audio_cache` 路径；v2-native 媒体 serving 以后再设计 |

## 当前下一步

只建议做一件事：提交并推送 Archive Studio v0 transaction sandbox；下一步增加失败场景自检，仍不接 UI，不写真实 ArchiveData-v2 输出，不运行发布脚本，不运行 `build_archive.py`。

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
- 不执行 Git 写操作，除非用户再次明确授权；
- 不进入代码改造；
- 不做代码修改；
- 不开始代码修复；
- 不进入自动改写源数据的维护自动化开发。
- 不进入数据生成或发布验收。
- 不批量创建完整 `ArchiveData-v2` 四板块数据；
- 不继续迁移 Games、Visions、Texts 或 config；
- 不进入 Archive Studio 前端开发；当前只做 schema、preview 和写入事务前置设计。

## 当前验证状态

- 项目能否启动：本轮未启动，因用户要求默认不要启动。
- 核心人工验收：本轮未进行页面验收。
- 自动测试：未发现独立测试脚本，本轮未运行。
- 构建：本轮未运行 `npm run build`。
- 数据生成：本轮未运行 `build_archive.py`。
- 最近一次验证日期：2026-06-16，已只读核对旧 Data 结构和 `build_archive.py` 四板块解析逻辑，完成 ArchiveData-v2 文件规则设计文档，并运行 ArchiveData-v2 只读迁移审计、migration dry-run、Music v2 试点 planner、Music-only 写入型试点迁移、v2 Music 输出检查、Git 边界验收、v2 Music preview、live-compatible preview、公开 JSON shape/privacy 检查和远端同步验收。
- 最近维护逻辑审计：2026-06-14，已确认真实维护流程、源数据/派生数据边界、`build_archive.py` 写回源 YAML 风险和发布脚本风险。

## 新对话需要知道

这是个人数字收藏馆老项目工作流迁移阶段。优先保护 OneDrive Data 源目录，不要运行生成、构建、发布或 Git 写命令。README 已收敛为人类入口；AI 第一入口是 `AGENTS.md`。旧 `public/archive_data.json` 已归档，当前前端数据入口是 `public\data\*.json`。

`reports` 只能作为辅助参考，不是权威源数据，也不是当前任务清单。`reports/README.md` 是 reports 边界说明入口；历史游戏辅助报告已收束到 `reports/history/legacy-game-assist/`，旧 Vite 日志已收束到 `docs/history/legacy-logs/`。阶段 2 已基本完成，代码风险审计第一轮也已只读完成，当前仍未做代码改造、源数据修改、派生数据生成、构建或发布。

长期方向是未来可以逐步改进维护体验和自动化能力。当前系统升级主线是 ArchiveData-v2 文件规则、只读迁移审计、migration dry-run、Music 试点迁移和 Archive Studio v0；当前已完成文件规则设计、只读迁移审计、migration dry-run、Music v2 试点边界设计、只读 planner、写入型试点任务设计、Music-only 写入试点、Git 边界验收、v2 Music preview 生成器、live 兼容策略设计、只读 v2-to-live 映射、live-compatible preview 生成器、replacement gate、live Music JSON 替换、仓库范围变更 review 计划、本地提交、push、Archive Studio v0 边界设计、技术入口设计、`music/album` payload schema 设计、CLI sandbox preview 原型、项目内样例 payload、preview core 模块拆分、preview core 自检、写入事务设计和 transaction sandbox。下一步是为 transaction sandbox 增加失败场景自检，不做前端实现，不写真实 ArchiveData-v2 输出，不再次运行 `build_archive.py`，不自动改写旧 OneDrive Data。
