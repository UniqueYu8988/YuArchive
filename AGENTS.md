# AGENTS.md

本文件是 AI 进入 YuArchive 项目后的第一入口。它说明怎样安全工作，不重复保存完整产品、架构和进度信息。

## 1. 项目是什么

YuArchive 是一个个人数字收藏馆，用来展示和管理游戏、影视、音乐、文本四类收藏信息。

项目根目录：

`C:\Users\Yu\AI\Archive`

旧版收藏源数据目录（只读迁移来源与回退备份）：

`C:\Users\Yu\OneDrive\图片\Data`

当前维护数据目录：

`C:\Users\Yu\OneDrive\图片\ArchiveData-v2`

当前阶段已进入 ArchiveData-v2 + Archive Studio 本地可视化维护。旧 OneDrive Data 保持只读；新建条目、首页精选和公开 JSON 同步必须通过受控 preview / token / rollback 流程，不自动发布。

## 2. 事实来源

开始任务前，按需要阅读：

- 当前工作规则：`AGENTS.md`
- 产品事实和边界：`PRODUCT.md`
- 技术结构和数据流：`ARCHITECTURE.md`
- 当前状态和下一步：`CURRENT_STATE.md`
- 验收基线：`docs/BASELINE_ACCEPTANCE.md`
- 稳定化计划：`docs/plans/STABILIZATION_PLAN.md`
- 旧项目维护说明：`README.md`
- 构建脚本事实：`build_archive.py`
- 前端入口和数据读取：`src\App.tsx`、`src\hooks\useJsonData.ts`
- 当前生成数据形态：`public\data\*.json`、`src\data\archive_data.json`

如果文档和代码、脚本、目录事实冲突，先报告冲突，不要擅自重写代码或数据。

## 3. 任务规模划分

### 小型任务

只改少量 Markdown、样式或局部 UI，并且不影响数据生成、部署、真实收藏数据。可以直接完成，但仍需汇报验证方式。

### 中型任务

符合任一条件时，应先建立或更新 `docs/tasks/` 下的任务文档：

- 涉及多个前端页面或构建脚本行为；
- 改变用户可观察行为；
- 需要运行构建或浏览器验收；
- 影响 `public\data`、缓存目录或 `reports`；
- 需要跨对话继续。

### 大型任务

符合任一条件时，必须先写计划，不直接动手：

- 修改 `build_archive.py` 的数据流；
- 修改 OneDrive 源数据结构；
- 自动修改 OneDrive 源数据；
- 迁移、导入、导出或清理收藏数据；
- 改变 GitHub 发布流程；
- 引入数据库、后端、登录、云存储或新依赖；
- 删除或重生成大量缓存、媒体或 JSON。

## 4. 个人数据安全红线

`C:\Users\Yu\OneDrive\图片\Data` 是 YuArchive 的旧版收藏源数据、迁移来源和回退备份。AI 默认只能只读分析，不得自动修改、整理、迁移、导入、导出或清理其中任何内容。`ArchiveData-v2` 是当前新工作流的维护数据目录；写入它仍必须来自明确任务，并具备预览、校验和回退，不能使用临时脚本随意改写。

绝对不要在未经明确许可时修改：

- `C:\Users\Yu\OneDrive\图片\Data`
- `C:\Users\Yu\OneDrive\图片\Data\Games`
- `C:\Users\Yu\OneDrive\图片\Data\Visions`
- `C:\Users\Yu\OneDrive\图片\Data\Music`
- `C:\Users\Yu\OneDrive\图片\Data\Texts`
- OneDrive 顶层配置：`homepage.yaml`、`site-layout.yaml`、`site-ui.yaml`

不要把 OneDrive 源数据全文复制进 Markdown。文档里只记录目录、类型、职责、风险和备份要求。

游戏、影视、音乐、文本的标题、分类、评分和展示描述是网页展示资产，不按高敏感信息处理。仍需保护密码、密钥、令牌、账号凭据、本机绝对路径、OneDrive 真实源目录路径、隐私正文和未公开个人数据。

`reports` 只能作为扫描结果、辅助参考或历史记录，不是权威任务清单，也不能替代 OneDrive 源数据。

修改源数据、运行数据生成脚本、运行发布脚本都必须得到用户明确授权。

AI 可以提出维护自动化建议，但不能直接执行会写入 OneDrive Data 的自动化。任何自动修改 OneDrive Data 的任务都必须判定为大型或高风险任务，并且先具备备份、计划、差异预览和用户明确确认。

## 5. 高风险命令

默认禁止运行，除非当前任务明确允许并说明验收目的：

```powershell
python -X utf8 build_archive.py
npm run build
npm run dev
npm run preview
.\一键发布到云端.bat
git add
git commit
git push
```

原因：

- `build_archive.py` 是高风险数据生成命令。它会读取 OneDrive 源数据，写入 `src\data`、`public\data`、`public\webp_cache`、`public\audio_cache`、`public\media_cache`、`reports`，并可能反写 OneDrive 游戏源 `meta.yaml`；
- `一键发布到云端.bat` 是极高风险命令。它会先运行 `build_archive.py` 生成数据，再执行 Git 暂存、提交并推送；
- `npm run dev` 和 `npm run preview` 会启动服务，本轮工作流接管阶段默认不启动；
- Git 写操作会改变工作区状态。

只读 Git 命令可以使用，例如：

```powershell
git status --short --branch
git remote -v
git log -1 --oneline --decorate
```

## 6. 修改原则

- 一次只解决一个主要问题；
- 优先最小、可验证、可回退的改动；
- 不顺手重构；
- 不把派生缓存当成唯一数据源；
- 不把密钥、token、账号凭据、本机绝对路径或 OneDrive 真实源目录路径上传到 GitHub；
- 不修改生成文件，除非任务明确要求并允许运行对应生成流程；
- 不让自动化替代用户对收藏内容、评分、笔记、分类和媒体选择的判断；
- 不新增依赖，除非有单独计划和许可；
- 不删除旧上下文文件，除非已有备份和明确任务。

## 7. 修改后如何验证

验证强度按风险递增：

- Markdown 文档任务：检查 Markdown 文件内容和 Git 状态；
- 前端代码任务：先读数据入口，再在受控条件下运行类型检查、构建或浏览器验收；
- 数据构建任务：先备份 OneDrive 源数据，再运行 `build_archive.py`，随后检查 `public\data`、缓存、报告和页面；
- 发布任务：单独确认 Git diff、远端、分支、敏感数据和大文件。

如果任务禁止运行某些命令，必须在最终报告中说明“未运行”的验证项。

## 8. 每次任务固定流程

1. 确认当前工作目录是 `C:\Users\Yu\AI\Archive`；
2. 阅读相关文档和 README；
3. 只读检查目录结构和 Git 状态；
4. 明确本轮允许和禁止范围；
5. 找到事实来源，不凭记忆改文档或代码；
6. 修改前说明将改哪些文件；
7. 只改任务允许的文件；
8. 做允许范围内的验证；
9. 汇报修改文件、当前事实、风险、未执行验证和下一步。

## 9. 完成报告

报告应包含：

- 修改了哪些文件；
- 当前项目事实是否有变化；
- 源数据和派生数据边界；
- 未运行哪些高风险命令；
- 是否发现阻碍接管的问题；
- 下一步只建议做什么。
