# STABILIZATION_PLAN.md

YuArchive 老项目稳定化计划。本计划记录阶段和边界，当前已进入系统级底层升级的保护性阶段。

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
4. 再建立数据生成、预览、构建和发布验收保护；
5. 最后才考虑维护自动化。

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

第一批升级任务继续限定为只读检查、schema、预览和差异报告，不进入自动改源数据。

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

1. 继续补充源侧 schema/check 的小型只读规则；
2. 不手改派生 JSON、不进入 `build_archive.py` 主流程大改；再次运行 `build_archive.py` 前必须得到明确授权且说明验收目的；
3. 当前仍不进入自动改源数据的维护自动化开发。
