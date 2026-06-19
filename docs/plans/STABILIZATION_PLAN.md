# STABILIZATION_PLAN.md

YuArchive 老项目稳定化计划。本计划记录阶段和边界，当前已进入 ArchiveData-v2 系统升级设计阶段。

## 当前情况

YuArchive 是长期开发的个人数字收藏馆项目。真实收藏源数据位于 `C:\Users\Yu\OneDrive\图片\Data`，前端和构建层位于 `C:\Users\Yu\AI\Archive`。

当前已经完成：

- 用户已完成备份；
- V2 核心工作流文件已复制到项目；
- 首次正式只读审计已完成；
- 项目基线文档已建立；
- README 已完成第一轮收敛；
- 旧 `public/archive_data.json` 已归档；
- 网页实际维护逻辑已梳理，`build_archive.py` 可能反写 OneDrive 游戏源 YAML 的风险已确认。
- 独立接管中途测试已通过：新对话能识别项目用途、真实源数据、派生数据、高风险命令和当前阶段。该结果不是最终结项，后续仍需继续旧上下文和辅助文件收束。
- `reports/README.md` 已建立，旧游戏辅助报告和旧 Vite 日志已开始收束到历史目录。
- 进入代码风险审计前的最终文档一致性检查已完成，未发现阻碍接管的正式文档冲突。
- 代码风险审计第一轮已完成，结果记录在 `docs/tasks/code-risk-audit.md`。
- 第一个低风险保护任务已开始并完成：`scripts/check-public-data-shape.mjs` 只读检查 `public/data/*.json` 的最低结构。
- 第二个低风险保护任务已完成：`scripts/check-generated-data-privacy.mjs` 只读扫描派生 JSON 的本机路径、旧源路径和明显秘密字段风险，并发现一个待核对命中。
- `src/data/archive_data.json` 已确认为阶段 3 优先仓库边界问题，应先于任何发布操作处理；任务设计记录在 `docs/tasks/repository-privacy-boundary.md`。
- 仓库边界方案 A 已执行：`src/data/archive_data.json` 已退出 Git 跟踪，本地文件仍保留，`.gitignore` 已加入对应忽略规则。
- `metadata.source_root` 脱敏/相对化方案已完成只读设计，记录在 `docs/tasks/sanitize-generated-source-root.md`。
- 已完成一次受控高风险生成脚本小改：`build_archive.py` 仅修改 `metadata.source_root` 生成值，并受控运行数据生成；OneDrive Data 中 YAML/YML/MD 文件未发生哈希变化。
- Vibe Coding 底层改造已完成本地提交，未执行 push。
- 系统级底层升级已从保护性任务开始：`scripts/check-source-data-shape.mjs` 只读检查 OneDrive Data 源侧结构，不运行生成脚本、不写源数据。
- 第二个保护性任务已建立：`scripts/check-music-media-shape.mjs` 只读检查 Music Markdown、Covers 和 Songs 的基础匹配关系，不读取音频内容、不写源数据。
- 保护性检查已完成本地提交，当前进入 ArchiveData-v2 文件规则设计；设计文档为 `docs/design/archive-data-v2.md`。
- ArchiveData-v2 只读迁移审计已建立，任务记录为 `docs/tasks/archive-data-v2-migration-audit.md`，脚本为 `scripts/audit-archive-data-v2-migration.mjs`。
- ArchiveData-v2 migration dry-run 已建立，任务记录为 `docs/tasks/archive-data-v2-migration-dry-run.md`，脚本为 `scripts/dry-run-archive-data-v2-migration.mjs`；dry-run 只在内存中规划目标角色和 checksum 覆盖，不创建真实 v2 数据目录，不写迁移结果。
- ArchiveData-v2 Music 试点迁移边界已建立，任务记录为 `docs/tasks/archive-data-v2-music-pilot-boundary.md`；该文档只定义未来试点写入范围、验收和回退，不创建真实 v2 数据目录。
- ArchiveData-v2 Music 试点迁移 planner 已建立，任务记录为 `docs/tasks/archive-data-v2-music-pilot-planner.md`，脚本为 `scripts/plan-archive-data-v2-music-pilot.mjs`；planner 只读输出 Music 目标目录和文件角色统计，不创建真实 v2 数据目录。
- ArchiveData-v2 Music 写入型试点迁移任务设计已建立，任务记录为 `docs/tasks/archive-data-v2-music-pilot-write-design.md`；该文档是执行前 approval gate，本身不迁移数据。
- 用户已授权并完成 ArchiveData-v2 Music-only 写入型试点迁移，脚本为 `scripts/migrate-archive-data-v2-music-pilot.mjs`；旧 Music 源基线 99 个文件变更 0，生成 v2 Music album 输出 33 个。
- v2 Music 输出检查已建立，任务记录为 `docs/tasks/protect-archive-data-v2-music-shape.md`，脚本为 `scripts/check-archive-data-v2-music-shape.mjs`；当前检查通过。
- Music v2 试点输出验收与 Git 边界整理已完成，任务记录为 `docs/tasks/archive-data-v2-music-pilot-acceptance.md`；生成的 `ArchiveData-v2` 试点输出位于项目 Git 工作树外，当前不进入普通项目提交。
- v2 Music 生成器试点设计已完成，任务记录为 `docs/tasks/archive-data-v2-music-generator-pilot-design.md`；设计要求生成隔离 preview JSON，不替换当前 `public/data/music.json`。
- v2 Music preview 生成器已实现，脚本为 `scripts/generate-archive-data-v2-music-preview.mjs`；当前生成隔离 preview JSON 成功，未修改 `public/data/music.json`。
- v2 Music live 替换前的 ID 兼容和媒体 URL 策略已完成，任务记录为 `docs/tasks/archive-data-v2-music-live-compat-strategy.md`；当前不直接替换 live Music 数据。
- 只读 Music v2-to-live 兼容映射已完成，任务记录为 `docs/tasks/archive-data-v2-music-live-compat-mapper.md`，脚本为 `scripts/map-archive-data-v2-music-live-compat.mjs`；当前 33/33 条目可映射，live ID 和 live 媒体路径均可复用。
- live-compatible v2 Music preview 生成器已完成，任务记录为 `docs/tasks/archive-data-v2-music-live-compatible-preview.md`，脚本为 `scripts/generate-archive-data-v2-music-live-compatible-preview.mjs`；当前可生成复用 live ID 和 public media path 的隔离 preview JSON。
- Music v2 live replacement gate 已完成，任务记录为 `docs/tasks/archive-data-v2-music-live-replacement-gate.md`；正式替换 `public/data/music.json` 前需要用户单独授权。
- 用户已授权并完成 Music v2 live-compatible JSON 替换，只修改 `public/data/music.json`，任务记录为 `docs/tasks/archive-data-v2-music-live-replacement-acceptance.md`；替换后 shape/privacy/preview 检查通过。
- ArchiveData-v2 当前变更范围 review 和 Git 提交计划已建立，任务记录为 `docs/tasks/archive-data-v2-change-review-and-commit-plan.md`；已按计划完成本地 commit 并 push 到远端。
- Archive Studio v0 边界设计已建立，任务记录为 `docs/tasks/archive-studio-v0-boundary-design.md`；当前只设计本地文件管理边界，不实现前端、不自动改旧 OneDrive Data。
- Archive Studio v0 技术入口设计已建立，任务记录为 `docs/tasks/archive-studio-v0-entry-design.md`；推荐先做 CLI 写入流程原型，再进入本地 Node 服务 + React 页面。
- Archive Studio v0 `music/album` payload schema 和 preview 输出格式已建立，任务记录为 `docs/tasks/archive-studio-v0-music-payload-schema.md`；下一步可做只写系统临时目录的 CLI sandbox preview 脚本。
- Archive Studio v0 CLI sandbox preview 原型已建立，任务记录为 `docs/tasks/archive-studio-v0-cli-sandbox-preview.md`，样例 payload 为 `docs/examples/archive-studio-v0-music-album-payload.sample.json`，脚本为 `scripts/archive-studio-v0-music-preview-sandbox.mjs`；脚本读取项目内样例，只写系统临时目录，不写真实 ArchiveData-v2 输出。
- Archive Studio v0 变更范围 review 和 Git 提交计划已建立，任务记录为 `docs/tasks/archive-studio-v0-change-review-and-commit-plan.md`；下一步等待用户确认后做 1 个本地 commit，不 push。
- Archive Studio v0 preview core 模块已拆分，任务记录为 `docs/tasks/archive-studio-v0-preview-core-module.md`，模块为 `scripts/archive-studio-v0-music-preview-core.mjs`；CLI sandbox 行为保持不变。
- Archive Studio v0 preview core 自检已建立，任务记录为 `docs/tasks/archive-studio-v0-preview-core-check.md`，脚本为 `scripts/check-archive-studio-v0-preview-core.mjs`；当前仍不接 UI、不写真实 ArchiveData-v2 输出。
- Archive Studio v0 写入事务设计已建立，任务记录为 `docs/tasks/archive-studio-v0-write-transaction-design.md`；当前只定义 diff preview、backup manifest、write manifest 和 rollback 边界，不写真实 ArchiveData-v2 输出。
- Archive Studio v0 transaction sandbox 已建立，任务记录为 `docs/tasks/archive-studio-v0-transaction-sandbox.md`，脚本为 `scripts/archive-studio-v0-music-transaction-sandbox.mjs`；当前只写系统临时目录，模拟 create / update / rollback。
- Archive Studio v0 transaction sandbox 失败场景自检已建立，任务记录为 `docs/tasks/archive-studio-v0-transaction-sandbox-check.md`，脚本为 `scripts/check-archive-studio-v0-transaction-sandbox.mjs`；当前只写系统临时目录，不写真实 ArchiveData-v2 输出。
- Archive Studio v0 真实 v2 写入 approval gate 设计已建立，任务记录为 `docs/tasks/archive-studio-v0-real-write-approval-gate.md`；当前只定义进入真实 v2 Music 写入前的 gates，不执行真实写入。
- Archive Studio v0 真实 v2 写入只读 gate checker 已建立，任务记录为 `docs/tasks/archive-studio-v0-real-write-gate-checker.md`，脚本为 `scripts/check-archive-studio-v0-real-write-gate.mjs`；当前只读输出 gate 摘要，不执行真实写入。
- Archive Studio v0 real write gate 场景自检已建立，任务记录为 `docs/tasks/archive-studio-v0-real-write-gate-scenarios.md`，脚本为 `scripts/check-archive-studio-v0-real-write-gate-scenarios.mjs`；当前覆盖 create/update 允许场景和 blocked 场景，不执行真实写入。
- Archive Studio v0 真实 v2 写入 dry-run manifest 已建立，任务记录为 `docs/tasks/archive-studio-v0-real-write-dry-run-manifest.md`，脚本为 `scripts/dry-run-archive-studio-v0-real-write-manifest.mjs`；当前只读输出 backup/write/rollback manifest 草案，不执行真实写入。
- Archive Studio v0 real write dry-run manifest 场景自检已建立，任务记录为 `docs/tasks/archive-studio-v0-real-write-dry-run-manifest-check.md`，脚本为 `scripts/check-archive-studio-v0-real-write-dry-run-manifest.mjs`；当前确认 blocked 场景不计划写入或备份。
- Archive Studio v0 真实 v2 Music create 写入试点执行前检查清单已建立，任务记录为 `docs/tasks/archive-studio-v0-real-write-create-preflight.md`；当前只定义授权文本、单 entry create 范围、只读检查顺序、阻断条件和成功标准，不执行真实写入。
- Archive Studio v0 真实 v2 Music create 写入试点 preflight checker 已建立，任务记录为 `docs/tasks/archive-studio-v0-real-write-create-preflight-checker.md`，脚本为 `scripts/check-archive-studio-v0-real-write-create-preflight.mjs`；当前只读复用 gate checker 和 dry-run manifest，不执行真实写入。
- Archive Studio v0 真实 v2 Music create smoke test 执行边界已建立，任务记录为 `docs/tasks/archive-studio-v0-real-write-create-smoke-test-boundary.md`；当前只定义第一轮真实写入的授权文本、允许范围、禁止范围、验收和 rollback 边界，不执行真实写入。
- Archive Studio v0 真实 v2 Music create smoke test runner 只读计划模式已建立，任务记录为 `docs/tasks/archive-studio-v0-real-write-create-smoke-test-plan-runner.md`，脚本为 `scripts/plan-archive-studio-v0-real-write-create-smoke-test.mjs`；当前只输出计划写入文件、transaction manifest、rollback 计数和写入后检查命令，不执行真实写入。
- Archive Studio v0 真实 v2 Music create smoke test 显式执行 gate 已建立，任务记录为 `docs/tasks/archive-studio-v0-real-write-create-execute-gate.md`；当前只定义用户授权、`--execute` 参数和 entry id 三重 gate，不执行真实写入。
- Archive Studio v0 真实 v2 Music create + rollback smoke test runner 已建立；默认计划模式不写数据，真实执行要求 `--execute`、精确 entry id 和授权短语。
- Archive Studio v0 smoke runner 已实现 staging、allowlist、apply create、transaction manifests、写后检查和 rollback。
- Archive Studio v0 真实 v2 Music create + rollback 文件写入算法已落地并通过真实 smoke test。
- Archive Studio v0 UI / 表单流程设计和验收标准已确认，设计文档为 `docs/design/archive-studio-v0-music-album-flow.md`。
- Archive Studio v0 页面壳已完成，当前已有独立 `/studio` 入口、Music Album 表单、素材选择、浏览器内校验、相对路径预览和受控保存。
- Archive Studio v0 本地 API 已完成 profiles、preview、preflight、create 和 Music v2 check；服务只监听本机，不提供发布能力。
- Archive Studio v0 真实写入前统一只读验收已完成，任务记录为 `docs/tasks/archive-studio-v0-real-write-readiness-audit.md`；15 / 15 检查通过，OneDrive Data 778 个文件元数据快照前后一致。
- Archive Studio v0 smoke runner 已实现并通过系统临时沙箱和真实 ArchiveData-v2 create / check / rollback 验证；真实执行写入后为 34 个 entry，rollback 后恢复 33 个，旧 OneDrive Data 未变化。
- Archive Studio v0 受控 create API 和前端保存已接入；临时目录 API 集成测试覆盖成功创建、一次性 token、冲突阻断、故障 rollback、Music v2 检查和无发布路由。
- 用户已通过 Archive Studio 页面完成一次保留真实条目的 create，Music v2 从 33 条增至 34 条，结构检查通过；页面已补充中文界面和明确的创建成功摘要。
- Texts 板块升级已开始；专用只读审计确认 132 个 Markdown、5 个栏目和 54 张书架图片结构完整，当前 live 数量一致，旧 OneDrive Data 未修改。
- Texts v2 专用规则已形成：固定 section-kind 映射、稳定 ID、日期、封面、legacy、迁移验收和 live-compatible 输出边界；当前尚未迁移。
- Texts 只读 planner 和 v2 shape checker 已建立：132 个条目、319 个目标、187 个源记录，0 冲突、0 缺失封面、0 日期策略错误；临时目录 shape 自检通过。
- Texts v2 已受控迁移并通过：132 个条目、54 个封面、187 条 manifest、0 unmapped、0 隐私命中；旧 Texts 187 个源文件 checksum 未变化，Music v2 未受影响。
- Texts v2 live-compatible 隔离 preview 已通过：132/132 映射、0 歧义、字段与顺序差异 0，并与当前 live JSON 深度相等；未修改 public 数据。
- Archive Studio Texts 流程和 preview core 已建立，三个 kind 的字段、section、日期、封面和路径安全自检通过；真实 create 尚未接入。
- Archive Studio Texts 受控 API 已完成并通过临时目录集成测试；一次性 token、create-only、故障 rollback、源边界和无发布路由均通过。

## 稳定化目标

- 让新对话不依赖历史对话也能安全接管；
- 明确源数据、派生数据、构建产物和可排除目录；
- 建立受控启动、构建、数据生成和发布验收；
- 在不破坏现有馆藏展示的前提下，逐步降低代码和脚本风险。
- 为未来更方便、更实用的维护体验打基础，但不牺牲源数据可理解性、可备份性和可回退性。

## 明确不做

- 不重新设计产品；
- 不扩展新功能；
- 不迁移 OneDrive 源数据；
- 不清理真实收藏数据；
- 不重写 `build_archive.py`；
- 不引入后端、数据库、登录或云存储；
- 不在未建立验收前做大重构；
- 不在工作流接管和验收保护完成前开发维护自动化。

## 后续演进原则

1. 先完成工作流接管；
2. 再做旧上下文和误导性辅助文件收束；
3. 再做代码风险审计，识别适合小步稳定化的风险点；
4. 再建立源侧和派生数据只读保护；
5. 再进入 ArchiveData-v2 文件规则、只读迁移审计和 dry-run；
6. 最后才考虑 Archive Studio 管理前端和维护自动化。

维护自动化应优先从只读检查、结构校验、差异预览、验收脚本和发布前检查开始。任何会修改 OneDrive Data 的自动化，都必须先展示变更范围，得到用户明确确认，并保留可回退路径。

风险表述以仓库和发布安全为准：收藏标题、分类、评分和展示描述是网页展示资产，不按高敏感信息处理；主要保护对象是密钥、token、账号凭据、本机绝对路径、OneDrive 真实源目录路径、源数据不被误改，以及生成、发布、Git push 不被误运行。

## 阶段 1：开发工作流接管

### 目标

- 建立 AI 第一入口；
- 明确事实来源；
- 明确高风险命令；
- 明确任务规模和固定流程；
- 让独立新对话能够读文档后安全复述项目边界。

### 完成标准

- [x] `AGENTS.md` 适配 YuArchive；
- [x] `PRODUCT.md` 只记录当前产品事实；
- [x] `ARCHITECTURE.md` 记录数据流和风险区域；
- [x] `CURRENT_STATE.md` 记录当前阶段和下一步；
- [x] `docs/BASELINE_ACCEPTANCE.md` 建立第一版验收基线；
- [x] 本计划文件建立；
- [x] 独立接管中途测试已通过。

说明：该测试通过表示新对话可以安全理解项目边界，但不代表稳定化工作最终结项。

## 阶段 2：旧 Markdown、历史上下文和辅助文件收束

状态：基本完成。

### 目标

- 盘点旧 Markdown、报告和历史上下文入口；
- 判断哪些是长期文档、哪些是一次性报告、哪些应归档；
- 旧文件清理前，先保留并固化真实维护逻辑；
- 不删除数据，只建立收束清单和保留策略。

### 完成标准

- [x] 列出所有旧 Markdown 和上下文文件；
- [x] 标记保留、归档、迁移、暂不处理；
- [x] 明确 README 与新工作流文档的关系；
- [x] 收敛 README 为简洁人类入口；
- [x] 归档旧 `public/archive_data.json` 生成物；
- [x] 固化实际维护逻辑和 `build_archive.py` 写回源 YAML 风险；
- [x] 建立 `reports/README.md`，明确 `reports` 不是 AI 第一入口、权威源数据或当前任务清单；
- [x] 移动明确历史性质的游戏辅助报告到 `reports/history/legacy-game-assist/`；
- [x] 移动根目录旧 Vite 日志到 `docs/history/legacy-logs/`；
- [x] 不复制 OneDrive 源数据正文。
- [x] 完成进入代码风险审计前的最终文档一致性检查。

`reports` 和旧日志不再作为 AI 第一入口。下一阶段是代码风险审计，第一轮只读，不重构、不运行高风险命令、不碰 OneDrive Data。

## 阶段 3：代码风险审计

状态：第一轮只读审计已完成，并已完成两个低风险保护任务。

### 目标

- 审计前端数据读取、路由、页面、类型和样式边界；
- 审计 `build_archive.py` 的读写位置、联网行为、写回源数据行为；
- 识别适合小步稳定化的风险点；
- 不修改代码、不运行高风险命令、不碰 OneDrive Data。

### 完成标准

- [x] 列出高风险代码区域；
- [x] 列出无需立即处理的技术债；
- [x] 形成小任务候选，不直接大改。
- [x] 将结果记录到 `docs/tasks/code-risk-audit.md`。
- [x] 建立 `public/data/*.json` 只读结构检查，结果记录到 `docs/tasks/protect-public-data-shape.md`。
- [x] 建立生成数据隐私与本地路径只读检查，结果记录到 `docs/tasks/protect-generated-data-privacy.md`。
- [x] 建立仓库隐私与生成物边界任务设计，结果记录到 `docs/tasks/repository-privacy-boundary.md`。
- [x] 执行仓库边界方案 A，从 Git 跟踪中移除 `src/data/archive_data.json` 并加入忽略规则。
- [x] 建立 `metadata.source_root` 脱敏/相对化任务设计，结果记录到 `docs/tasks/sanitize-generated-source-root.md`。
- [x] 完成一次受控高风险生成脚本小改，两个只读检查脚本均通过。

下一步应做本轮变更验收和 Git 边界整理，不直接进入功能开发。

## 系统级底层升级：保护性阶段

状态：已开始。

### 目标

- 先建立源侧只读检查、schema、预览和差异报告；
- 让用户在运行 `build_archive.py` 之前发现目录、YAML、Markdown frontmatter 和首页引用形状问题；
- 不自动改写 OneDrive Data，不替代用户对收藏内容、评分、分类、笔记和媒体选择的判断。

### 完成标准

- [x] 建立 `docs/tasks/protect-source-data-shape.md`。
- [x] 建立 `scripts/check-source-data-shape.mjs`。
- [x] 检查 OneDrive Data 根目录、四个板块、顶层 YAML、Texts sections、Markdown frontmatter 和 homepage 引用形状。
- [x] 验证脚本不需要新增依赖，不运行 `build_archive.py`，不写任何源数据。
- [x] 核对 Homepage/Games 近似匹配警告：原因是检查脚本未把 `Game-Live` 单独 YAML 文件名纳入候选标题，已补充通用匹配规则。
- [x] 建立 `docs/tasks/protect-music-media-shape.md`。
- [x] 建立 `scripts/check-music-media-shape.mjs`。
- [x] 检查 Music Markdown、Covers 封面和 Songs 音频之间的基础匹配关系，当前通过且无 warning。

第一批升级任务继续限定为只读检查、schema、预览和差异报告，不进入自动改源数据。

## 系统升级主线：ArchiveData-v2

状态：Archive Studio v0 UI、只读 API、联调、readiness audit 和 smoke runner 隔离验证已完成；当前等待受控真实 ArchiveData-v2 smoke test。

### 目标

- 设计新的文件组织规则，降低维护成本；
- 支持未来 Archive Studio 可视化管理；
- 将旧 OneDrive Data 作为只读迁移来源和回退备份；
- 通过只读迁移审计和 dry-run 证明迁移不会丢字段、丢文件、误改源数据。

### 非目标

- 不直接覆盖旧 OneDrive Data；
- 不创建真实 `ArchiveData-v2` 数据目录，除非进入单独迁移任务；
- 不在 v0 做 AI 自动补全、自动找封面、自动查外链、自动分类、自动生成简介或自动发布；
- 不用数据库替代文件系统；
- 不进入多用户后台或完整 CMS。

### 建议阶段

1. ArchiveData-v2 文件规则设计；
2. 只读迁移审计；
3. migration dry-run；
4. Music v2 试点迁移；
5. v2 检查脚本；
6. v2 Music 生成器试点；
7. Archive Studio v0 只支持 Music；
8. 再扩展 Texts / Visions / Games。

### 当前完成标准

- [x] 新建 `docs/design/archive-data-v2.md`。
- [x] 设计 board / kind / entry.yaml / content.md / assets 规则。
- [x] 设计旧字段迁移原则和无损迁移验收标准。
- [x] 明确 Archive Studio v0 不做 AI 自动补全或自动发布。
- [x] 进入阶段 2：只读迁移审计。
- [x] 新建 `docs/tasks/archive-data-v2-migration-audit.md`。
- [x] 新建 `scripts/audit-archive-data-v2-migration.mjs`。
- [x] 只读统计旧 Data 四个 board 的源文件、字段键、可能 kind 映射和人工确认计数。
- [x] 审计结果：774 个源文件，解析错误 0，人工确认计数 218。
- [x] 进入阶段 3：migration dry-run。
- [x] 新建 `docs/tasks/archive-data-v2-migration-dry-run.md`。
- [x] 新建 `scripts/dry-run-archive-data-v2-migration.mjs`。
- [x] dry-run 结果：考虑 778 个源文件，checksum 文件 778 个，checksum 错误 0，计划条目 559 个，未映射文件 0，忽略系统文件 1，人工确认计数 223，写入动作 0。
- [x] 验证未创建真实 `ArchiveData-v2` 数据目录，未写 manifest、checksum 或迁移结果。
- [x] 进入阶段 4：Music v2 试点迁移边界设计。
- [x] 新建 `docs/tasks/archive-data-v2-music-pilot-boundary.md`。
- [x] 明确 Music 试点只覆盖 `music/album`，未来写入也不得覆盖旧 OneDrive Data。
- [x] 明确验收必须包含源哈希不变、33 个 Music 条目/封面/音频关系可核对、checksum 可验证和可删除回退。
- [x] 建立 Music v2 试点迁移 planner，先只读输出目标目录、文件角色、冲突和人工确认数量。
- [x] planner 结果：计划 Music album 条目 33 个，目标目录 33 个，目标角色 132 个，ID 冲突 0，缺失封面 0，缺失音频 0，人工确认 0，写入动作 0。
- [x] 设计 Music v2 写入型试点迁移任务。
- [x] 明确未来写入试点只能创建局部 `ArchiveData-v2` 输出，旧 OneDrive Data 必须保持哈希不变。
- [x] 用户确认后实现并执行 Music-only 写入试点。
- [x] 新建 `scripts/migrate-archive-data-v2-music-pilot.mjs`。
- [x] 迁移结果：源基线文件 99 个，源变更 0，源缺失 0，生成 33 个 Music album 目录、33 个 `entry.yaml`、33 个 `content.md`、33 个封面、33 个音频、99 条 manifest 记录，unmapped 0。
- [x] 新建 `docs/tasks/protect-archive-data-v2-music-shape.md`。
- [x] 新建 `scripts/check-archive-data-v2-music-shape.mjs`。
- [x] v2 Music 输出检查通过，隐私/路径规则命中 0。
- [x] 做 Music v2 试点输出验收与 Git 边界整理。
- [x] 新建 `docs/tasks/archive-data-v2-music-pilot-acceptance.md`。
- [x] 确认生成的 `ArchiveData-v2` 试点输出位于项目仓库外，当前不被 `git status` 纳入。
- [x] 设计 v2 Music 生成器试点。
- [x] 新建 `docs/tasks/archive-data-v2-music-generator-pilot-design.md`。
- [x] 明确生成器试点只输出隔离 preview JSON，不修改当前 `public/data/music.json`。
- [x] 实现 v2 Music preview 生成器。
- [x] 新建 `scripts/generate-archive-data-v2-music-preview.mjs`。
- [x] preview 生成结果：33 个条目，顶层 key 和 item 字段集合匹配当前 `public/data/music.json`，必需字段缺失 0，隐私/路径规则命中 0。
- [x] 发现兼容问题：v2 preview 与当前 live Music 的 ID overlap 为 0，不能直接替换 live 数据。
- [x] 设计 v2 Music live 替换前的 ID 兼容和媒体 URL 策略。
- [x] 新建 `docs/tasks/archive-data-v2-music-live-compat-strategy.md`。
- [x] 明确第一版 live-compatible preview 应优先复用当前 live ID、`webp_cache` 和 `audio_cache` 路径。
- [x] 实现只读 Music v2-to-live 兼容映射脚本。
- [x] 新建 `docs/tasks/archive-data-v2-music-live-compat-mapper.md`。
- [x] 新建 `scripts/map-archive-data-v2-music-live-compat.mjs`。
- [x] 映射结果：v2 33 条、live 33 条、映射成功 33、未映射 0、歧义 0、可复用 live ID/cover/audio 均为 33。
- [x] 实现 live-compatible v2 Music preview 生成器。
- [x] 新建 `docs/tasks/archive-data-v2-music-live-compatible-preview.md`。
- [x] 新建 `scripts/generate-archive-data-v2-music-live-compatible-preview.mjs`。
- [x] live-compatible preview 结果：33/33 映射，复用 33 个 live ID、33 个 cover path、33 个 audio path，顺序差异 0，隐私/路径规则命中 0。
- [x] 做 Music v2 替换 live 数据前的最终验收与提交边界设计。
- [x] 新建 `docs/tasks/archive-data-v2-music-live-replacement-gate.md`。
- [x] 用户明确授权后执行 Music v2 live-compatible JSON 替换。
- [x] 新建 `docs/tasks/archive-data-v2-music-live-replacement-acceptance.md`。
- [x] 仅修改 `public/data/music.json`，替换后 33 条、字段集合不变、cover/audio 仍使用 live cache 路径。
- [x] 替换后 `check-public-data-shape`、`check-generated-data-privacy` 和 live-compatible preview generator 均通过。
- [x] 做仓库范围变更 review 和 Git 提交计划。
- [x] 用户确认后按提交计划执行本地 commit。
- [x] 用户确认后 push 到远端。
- [x] 建立 Archive Studio v0 边界设计。
- [x] 做 Archive Studio v0 技术入口设计。
- [x] 设计 `music/album` payload schema 和 preview 输出格式。
- [x] 实现只写系统临时目录的 CLI sandbox preview 脚本。
- [x] 将 CLI sandbox preview 扩展为读取项目内样例 payload。
- [x] 运行 CLI sandbox preview 验证并整理提交计划。
- [x] 用户确认后提交 Archive Studio v0 设计和 sandbox preview 原型。
- [x] 拆分 Archive Studio v0 preview core 模块。
- [x] 验证并提交 Archive Studio v0 preview core 模块拆分。
- [x] 建立 Archive Studio v0 preview core 自检。
- [x] 设计 Archive Studio v0 写入事务、diff preview、backup manifest 和 rollback 边界。
- [x] 实现只写系统临时目录的 Archive Studio v0 transaction sandbox。
- [x] 增加 Archive Studio v0 transaction sandbox 失败场景自检。
- [x] 设计真实 ArchiveData-v2 写入 approval gate。
- [x] 实现只读真实 v2 Music 写入 gate checker。
- [x] 增加真实 v2 Music 写入 gate checker 的 update payload 和 blocked 场景自检。
- [x] 设计真实 v2 Music 写入 dry-run manifest。
- [x] 增加真实 v2 Music 写入 dry-run manifest blocked 场景自检。
- [x] 设计真实 v2 Music create 写入试点执行前检查清单。
- [x] 实现真实 v2 Music create 写入试点 preflight checker。
- [x] 设计真实 v2 Music create smoke test 执行任务边界。
- [x] 实现真实 v2 Music create smoke test runner 的只读/计划模式。
- [x] 设计真实 v2 Music create smoke test 的显式执行 gate。
- [x] 实现真实 v2 Music create + rollback smoke test runner，默认停在计划模式。
- [x] 为真实 v2 Music create + rollback smoke test runner 增加执行结构摘要，继续保持计划模式。
- [x] 设计真实 v2 Music create + rollback smoke test 的文件写入算法。
- [x] 暂停继续扩展底层 gate / runner / manifest / rollback 机制，转向 UI / 表单流程设计。
- [x] 设计 Archive Studio v0 `music/album` 新建流程。
- [x] 确认 UI / 表单流程设计。
- [x] 实现 Archive Studio v0 只读页面壳。
- [x] 实现 `music/album` 表单、素材选择、dirty/reset 状态和浏览器内校验。
- [x] 实现 entry id 建议、相对目标路径和文件角色预览。
- [x] 实现 preview / preflight API。
- [x] 实现 profiles 和 Music v2 shape check API。
- [x] 完成前后端只读联调和浏览器验收。
- [x] 完成真实写入前 allowlist、冲突、manifest / rollback、隐私和源数据边界验收。
- [x] 实现受控 create + rollback smoke runner。
- [x] 在系统临时沙箱验证 create / check / rollback 且无残留。
- [x] 在真实 ArchiveData-v2 执行 create + rollback smoke test。
- [x] 接入受控 Music Album create API。
- [x] 接入 v0 前端保存和写后 Music v2 检查。
- [x] 用户通过桌面页面完成完整表单、preview、preflight 和 create 流程。
- [x] 使用用户确认的真实素材保留一个新条目，完成最终 create 验收。
- [x] 完成 Studio 中文化和创建成功结果反馈。

## 阶段 4：核心数据与构建验收

### 目标

- 在已备份前提下受控运行数据生成；
- 确认四类源数据仍能被读取；
- 确认 `public\data` 可供前端读取；
- 记录生成前后变动范围。

### 完成标准

- [ ] 运行前记录 Git 状态；
- [ ] 确认 OneDrive Data 备份可用；
- [ ] 受控运行 `python -X utf8 build_archive.py`；
- [ ] 检查 `src\data`、`public\data`、缓存和 `reports` 的预期变动；
- [ ] 如出现 OneDrive 源数据改动，必须逐项解释。

## 阶段 5：小步稳定化任务

### 目标

- 一次只处理一个低风险问题；
- 每步都能验证和回退；
- 优先整理文档、常量、只读校验、脚本保护和验收脚本。

### 候选方向

1. 为 `build_archive.py` 增加 dry-run 或只读审计模式；
2. 把危险写入点集中标记和保护；
3. 明确生成数据与源数据的 Git 策略；
4. 建立最小浏览器验收清单；
5. 建立发布前检查清单。

## 未来阶段：维护自动化候选

### 目标

在工作流接管、旧上下文收束和验收保护完成后，再考虑提升日常维护体验。

### 原则

- OneDrive Data 仍然是唯一长期源数据；
- 自动化先做只读检查、校验、预览和差异报告；
- 一键发布不能和数据源修改混在一起；
- 自动化不能替代用户对收藏内容、评分、分类、笔记和媒体选择的判断；
- 任何源数据写入都必须有备份、计划、差异预览、用户确认和回退方式。

## 阶段 6：独立新对话接管测试

### 目标

确认新对话只依赖当前文档和只读检查，就能安全理解项目。

### 完成标准

- [x] 新对话能准确说出项目根目录；
- [x] 新对话能准确说出真实源数据目录；
- [x] 新对话能区分源数据、派生缓存、构建产物；
- [x] 新对话知道默认禁止运行哪些命令；
- [x] 新对话知道下一步不是改代码，而是验证接管和收束旧上下文。

## 风险

| 风险 | 影响 | 处理方式 | 回退方式 |
|---|---|---|---|
| 误运行构建脚本 | 改动源数据、生成数据、缓存或报告 | 默认禁止，受控任务才运行 | 用备份和 Git diff 对照恢复 |
| 误运行发布脚本 | 自动提交并推送不该上传内容 | 默认禁止，发布单独计划 | 停止推送，必要时撤销远端提交 |
| 把派生缓存当源数据 | 丢失原始素材和 Markdown/YAML | 文档明确 OneDrive Data 是源 | 从 OneDrive 备份恢复 |
| 旧上下文散落 | 新对话误读项目状态 | 阶段 2 小步收束 | 回到 `AGENTS.md` 和 `CURRENT_STATE.md` |

## 当前只执行的下一步

实现 Archive Studio Texts 中文页面和 board/kind 切换，接入已完成的 preview、preflight、create 和 Texts v2 check。
