# CURRENT_STATE.md

本文件只记录 YuArchive 现在的状态，不保存完整历史。

最后更新：2026-06-19

## 当前阶段

ArchiveData-v2 的 Music v2 试点、live-compatible 数据替换和远端同步已完成。Archive Studio v0 UI、本地只读 API、前后端联调、真实写入前验收和 smoke runner 隔离验证已完成；真实 ArchiveData-v2 smoke test 尚待具备外部目录写权限的受控执行环境。

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
- 已建立 Archive Studio v0 transaction sandbox 失败场景自检：新建 `docs/tasks/archive-studio-v0-transaction-sandbox-check.md` 和 `scripts/check-archive-studio-v0-transaction-sandbox.mjs`，覆盖 invalid payload、路径逃逸、backup 源缺失和 rollback manifest 不匹配；相关 sandbox 脚本共享系统临时目录，需顺序运行。
- 已建立 Archive Studio v0 真实 v2 写入 approval gate 设计：新建 `docs/tasks/archive-studio-v0-real-write-approval-gate.md`，明确真实写入必须单独授权、只允许 `music/album` 单 entry、必须经过 payload/diff/backup/write/rollback gate；下一步仍只做只读 gate checker，不直接写真实 v2 数据。
- 已建立 Archive Studio v0 真实 v2 写入只读 gate checker：新建 `docs/tasks/archive-studio-v0-real-write-gate-checker.md` 和 `scripts/check-archive-studio-v0-real-write-gate.mjs`，默认读取项目内样例 payload 和真实 v2 Music 当前状态，只输出 gate 摘要，不写真实 v2 数据。
- 已建立 Archive Studio v0 real write gate 场景自检：新建 `docs/tasks/archive-studio-v0-real-write-gate-scenarios.md`、`docs/examples/archive-studio-v0-music-album-update.sample.json` 和 `scripts/check-archive-studio-v0-real-write-gate-scenarios.mjs`，覆盖 create/update 允许场景和 blocked 场景，仍只读真实 v2 状态。
- 已建立 Archive Studio v0 真实 v2 写入 dry-run manifest：新建 `docs/tasks/archive-studio-v0-real-write-dry-run-manifest.md` 和 `scripts/dry-run-archive-studio-v0-real-write-manifest.mjs`，只读输出 backup/write/rollback manifest 草案摘要，不写真实 v2 数据。
- 已建立 Archive Studio v0 real write dry-run manifest 场景自检：新建 `docs/tasks/archive-studio-v0-real-write-dry-run-manifest-check.md` 和 `scripts/check-archive-studio-v0-real-write-dry-run-manifest.mjs`，确认 blocked 场景只输出 `needs_review` 草案，不计划写入或备份。
- 已建立 Archive Studio v0 真实 v2 Music create 写入试点执行前检查清单：新建 `docs/tasks/archive-studio-v0-real-write-create-preflight.md`，明确授权文本、单 entry create 范围、执行前只读检查、阻断条件、成功标准和回退边界；本轮仍未执行真实写入。
- 已建立 Archive Studio v0 真实 v2 Music create 写入试点 preflight checker：新建 `docs/tasks/archive-studio-v0-real-write-create-preflight-checker.md` 和 `scripts/check-archive-studio-v0-real-write-create-preflight.mjs`，只读复用 gate checker 和 dry-run manifest，确认默认 create 样例可请求进入真实写入任务；本轮仍未执行真实写入。
- 已建立 Archive Studio v0 真实 v2 Music create smoke test 执行边界：新建 `docs/tasks/archive-studio-v0-real-write-create-smoke-test-boundary.md`，明确第一轮真实写入的授权文本、允许范围、禁止范围、写入后验收、rollback 边界和成功标准；本轮仍未执行真实写入。
- 已建立 Archive Studio v0 真实 v2 Music create smoke test runner 的只读计划模式：新建 `docs/tasks/archive-studio-v0-real-write-create-smoke-test-plan-runner.md` 和 `scripts/plan-archive-studio-v0-real-write-create-smoke-test.mjs`，输出计划写入文件、transaction manifest、rollback 计数和写入后检查命令；本轮仍未执行真实写入。
- 已建立 Archive Studio v0 真实 v2 Music create smoke test 显式执行 gate：新建 `docs/tasks/archive-studio-v0-real-write-create-execute-gate.md`，明确未来真实执行必须同时具备用户授权、`--execute` 参数和指定 entry id；本轮仍未执行真实写入。
- 已建立 Archive Studio v0 真实 v2 Music create + rollback smoke test runner 的默认计划模式：新建 `docs/tasks/archive-studio-v0-real-write-create-smoke-test-runner.md` 和 `scripts/run-archive-studio-v0-real-write-create-smoke-test.mjs`，默认只输出计划摘要；传入 `--execute` 时本轮明确阻断，仍不执行真实写入。
- 已为 smoke test runner 增加真实执行结构摘要：新建 `docs/tasks/archive-studio-v0-real-write-create-smoke-test-runner-execution-structure.md`，runner 输出执行 gate 和执行阶段列表；`executeImplemented` 仍为 false。
- 已完成 Archive Studio v0 真实 v2 Music create + rollback smoke test 文件写入算法设计：新建 `docs/tasks/archive-studio-v0-real-write-create-smoke-test-write-algorithm.md`，定义 staging、allowlist、apply create、manifest、rollback 和失败处理规则；本轮仍未执行真实写入。
- 已进入 Archive Studio v0 UI / 表单流程设计阶段：新建 `docs/design/archive-studio-v0-music-album-flow.md`，第一版只聚焦 `music/album` 新建流程，不编辑已有条目，不做 AI 自动化，不启用真实写入。
- 已确认 Archive Studio v0 UI 流程和完成验收标准，并提交设计阶段文档。
- 已建立 Archive Studio v0 独立 `/studio` 入口、只读页面壳和 Music Album 表单，任务记录为 `docs/tasks/archive-studio-v0-read-only-shell.md`。
- 当前页面固定为 `music / album / create`，支持 title、date/year、url、note、entry id、cover、audio 和 Markdown 输入。
- 当前页面可在浏览器内生成 entry id 建议、目标相对路径和文件角色预览；缺少必需素材时会阻断 preview。
- `Create entry` 当前始终禁用；尚未连接 Node API，尚未写 ArchiveData-v2。
- `npm run build` 已通过；桌面和 390px 移动视口浏览器验收通过，控制台错误为 0。
- 已建立 Archive Studio v0 本地只读 Node API，任务记录为 `docs/tasks/archive-studio-v0-read-only-api.md`，服务只监听 `127.0.0.1`。
- 已提供 profiles、Music Album preview、preflight 和 Music v2 shape check 四个 API；没有 create、update、delete、Git、构建或发布接口。
- Studio 页面已接入本地 API：可显示服务状态、preview 错误、目标冲突、dry-run preflight 摘要和 Music v2 检查结果。
- API 自检、静态无写入标记检查和 TypeScript 检查均通过；所有 API 响应保持 `writeEnabled: false` / `writeScope: none`。
- 前后端联调确认当前 Music v2 为 33 entries / 0 malformed，缺少 cover / audio 时 preview 正确阻断，`Create entry` 仍禁用。
- 已建立真实写入前统一只读审计，任务记录为 `docs/tasks/archive-studio-v0-real-write-readiness-audit.md`，脚本为 `scripts/check-archive-studio-v0-real-write-readiness.mjs`。
- readiness audit 15 / 15 通过：allowlist、已有目标冲突阻断、manifest / rollback、隐私规则和 runner 禁写状态均符合预期。
- 审计前后 OneDrive Data 778 个文件的元数据计数和摘要一致；本轮未写源数据。
- smoke runner 已实现 staging、allowlist、create、transaction manifest、post-write check 和 rollback，并继续要求 `--execute`、精确 entry id、授权短语和 preflight gates。
- 新增 `scripts/check-archive-studio-v0-real-write-smoke-runner.mjs`；系统临时沙箱 create 1 个 entry、rollback 后 0 个 entry、残留文件和目录 0，错误授权被阻断，注入部分写入失败也能完整 rollback。
- Music v2 shape checker 已从固定 33 条升级为“至少保留迁移基线，并要求 entry / YAML / Markdown / cover / audio 计数一致”，以支持合法新增第 34 个条目。

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
- 当前工作区因 Archive Studio v0 music/album UI 流程设计和状态文档更新而存在新的未提交变更。

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

只建议做一件事：在具备 ArchiveData-v2 外部目录写权限的受控环境中执行真实 Music Album create + rollback smoke test；执行后必须恢复到 33 个 Music v2 entries。

## 暂时不做

- 不改 `build_archive.py`；
- 不进入 `build_archive.py` 改造；
- 不改 OneDrive 源数据；
- 不改 `public\data`、`src\data` 或派生缓存；
- 不运行发布脚本；
- 不执行一键发布；
- 不进入真实写入改造；
- 不进入自动改写源数据的维护自动化开发。
- 不进入数据生成或发布验收。
- 不批量创建完整 `ArchiveData-v2` 四板块数据；
- 不继续迁移 Games、Visions、Texts 或 config；
- 不启用 Archive Studio 常驻真实保存；下一步只允许受控 smoke test 写入并立即 rollback。

## 当前验证状态

- 项目能否启动：已受控启动本地 Vite 服务，仅用于 Archive Studio 页面验收。
- 核心人工验收：已完成 `/studio` 桌面和 390px 移动视口验收；无横向溢出，保存按钮禁用，控制台错误为 0。
- 自动测试：已验证 title 到 entry id / 相对路径预览，以及缺少 cover / audio 时的阻断提示。
- 构建：`npm run build` 已通过。
- 数据生成：本轮未运行 `build_archive.py`。
- 最近一次验证日期：2026-06-19，已完成 Archive Studio v0 只读页面壳构建和浏览器验收；未写 ArchiveData-v2。
- 最近维护逻辑审计：2026-06-14，已确认真实维护流程、源数据/派生数据边界、`build_archive.py` 写回源 YAML 风险和发布脚本风险。

## 新对话需要知道

这是个人数字收藏馆老项目工作流迁移阶段。优先保护 OneDrive Data 源目录，不要运行生成、构建、发布或 Git 写命令。README 已收敛为人类入口；AI 第一入口是 `AGENTS.md`。旧 `public/archive_data.json` 已归档，当前前端数据入口是 `public\data\*.json`。

`reports` 只能作为辅助参考，不是权威源数据，也不是当前任务清单。`reports/README.md` 是 reports 边界说明入口；历史游戏辅助报告已收束到 `reports/history/legacy-game-assist/`，旧 Vite 日志已收束到 `docs/history/legacy-logs/`。阶段 2 已基本完成，代码风险审计第一轮也已完成；当前已进入 Archive Studio 前端开发，但仍未修改源数据、派生数据或发布流程。

长期方向是未来可以逐步改进维护体验和自动化能力。当前系统升级主线是 ArchiveData-v2 和 Archive Studio v0；Music v2 试点、`music/album` UI、只读 Node API、前后端联调和真实写入前验收均已完成。下一步是受控 create + rollback smoke test；常驻 create、发布和旧 OneDrive Data 修改仍保持关闭。
