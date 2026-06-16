# 任务：Archive Studio v0 CLI sandbox preview 原型

创建日期：2026-06-16
状态：已完成

## 1. 目标

建立一个只写系统临时目录的 CLI sandbox preview 脚本，用于验证 Archive Studio v0 `music/album` payload schema、路径 allowlist 和 preview 输出格式。

本任务不写真实 ArchiveData-v2 输出，不接 UI，不修改公开网页数据。

## 2. 背景

Archive Studio v0 已完成边界设计、技术入口设计、`music/album` payload schema 和 preview 输出格式设计。推荐路线是先用 CLI 原型验证写入事务，再进入本地 Node 服务 + React 页面。

## 3. 本次范围

- 新增 `scripts/archive-studio-v0-music-preview-sandbox.mjs`。
- 脚本内置一个示例 `music/album` payload。
- 只在系统临时目录生成 preview JSON。
- 输出 preview 摘要和临时输出位置标签。
- 校验 id、字段、素材扩展名、相对路径和 operation allowlist。

## 4. 明确不做

- 不读取 OneDrive Data。
- 不写旧 OneDrive Data。
- 不写真实 ArchiveData-v2 输出。
- 不写 `public/data`。
- 不写 `src/data`。
- 不写缓存或 reports。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不执行 Git 操作。
- 不接前端 UI。

## 5. 脚本行为

脚本运行后：

1. 构造一个示例 `music/album` create payload。
2. 校验 payload 的 board、kind、mode、id、字段和素材扩展名。
3. 生成保存前 preview。
4. 确认 preview 中只包含相对路径。
5. 确认 operations 只包含允许类型。
6. 写入系统临时目录下的 preview JSON。
7. 控制台只输出计数、状态和系统临时目录标签，不输出本机完整路径。

## 6. 验收标准

- [x] 脚本只写系统临时目录。
- [x] 脚本不读取或写入 OneDrive Data。
- [x] 脚本不读取或写入 `public/data`、`src/data`、缓存或 reports。
- [x] preview 中所有目标路径都是相对路径。
- [x] preview operations 不包含删除、改名、Git、生成或发布操作。
- [x] preview 不包含本机完整路径、token、secret 或账号凭据。

## 7. 回退方式

删除 `scripts/archive-studio-v0-music-preview-sandbox.mjs` 和本任务文档即可回退。脚本生成的 preview 位于系统临时目录，可直接删除，不影响项目仓库和真实数据。

## 8. 下一步建议

下一步只建议把 sandbox preview 从内置示例扩展为读取项目内样例 JSON 文件，仍只写系统临时目录，不接 UI、不写真实 ArchiveData-v2。
