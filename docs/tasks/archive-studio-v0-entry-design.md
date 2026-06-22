# 任务：Archive Studio v0 技术入口设计

创建日期：2026-06-16
状态：已完成

## 1. 目标

比较 Archive Studio v0 的技术入口方案，选择一个最小、可验证、可回退的路线，用于后续实现 `music/album` 的本地文件管理闭环。

本任务只做设计，不实现 UI，不写任何数据。

## 2. 背景

Archive Studio v0 的边界已经确定：第一版只服务 `music/album`，不写旧 OneDrive Data，不直接写 `public/data`，不自动发布。下一步需要决定“用户界面如何获得本地文件写入能力”。

浏览器前端本身不能直接写本地文件系统，因此必须明确技术入口，否则很容易做出只能展示、不能保存，或保存边界不清晰的 UI。

## 3. 方案 A：纯前端页面

### 形态

在现有 Vite / React 前端中新增一个本地管理页面，仅使用浏览器能力。

### 优点

- 与当前前端技术栈一致。
- UI 开发最快。
- 不需要新增本地服务或桌面壳。
- 适合先做只读浏览、表单原型和 preview 展示。

### 限制

- 浏览器不能稳定直接写项目外部文件夹。
- File System Access API 兼容性和授权体验有限。
- 不适合第一版承担可靠保存、覆盖预览、回退和校验闭环。
- 容易误导为“已经有 Studio”，但实际只能读或导出。

### 风险

- 写入边界不稳定。
- 用户可能以为已保存到 Archive，但实际上只是下载或浏览器缓存。
- 后续还要补本地写入层，可能返工。

### 结论

适合作为只读 UI 原型，不适合作为 v0 的正式写入入口。

## 4. 方案 B：本地 Node 服务 + React 页面

### 形态

保留 React 页面作为 UI，在本机启动一个只监听 localhost 的 Node 服务，提供受控文件 API：

- 列出 `entries/music/album`。
- 读取 `entry.yaml` 和 `content.md`。
- 生成保存预览。
- 用户确认后写入 v2 Music 条目。
- 调用现有检查脚本。

### 优点

- 与现有 Node 检查脚本和迁移脚本衔接自然。
- 文件写入可集中在少量 API 中，便于加 allowlist、dry-run、diff、backup。
- UI 仍可使用现有 React 技术栈。
- 可以先做本地-only，不引入数据库、登录或云端。
- 后续如果需要，也可以演进为 Electron/Tauri 的内部服务层。

### 限制

- 需要启动本地服务，增加运行步骤。
- 需要明确端口、CORS、仅 localhost 访问和目录 allowlist。
- 需要设计 API，而不是直接在组件里写文件。

### 风险

- 如果 API 设计过宽，可能误写非目标目录。
- 如果和现有公开站点混在一起，可能误把管理能力暴露到部署环境。

### 关键保护

- 服务默认只监听 `127.0.0.1`。
- 必须有 `ARCHIVE_STUDIO_ENABLED=1` 或显式命令才启动。
- 写入目录只允许 Archive 的 `entries/music/album`。
- 第一版不提供删除 API。
- 第一版不写 `public/data`、`src/data`、旧 OneDrive Data、缓存或 reports。
- 所有写入先返回 preview，确认请求才执行。

### 结论

推荐作为 v0 最小可行技术入口。

## 5. 方案 C：Electron / Tauri 桌面应用

### 形态

把 Archive Studio 做成桌面应用，前端 UI 通过桌面壳访问本地文件系统。

### 优点

- 本地文件能力自然。
- 用户体验更接近真正的管理工具。
- 可以封装启动、目录选择、文件权限和后续打包。

### 限制

- 引入新框架和构建链。
- 初期复杂度高。
- 需要额外维护安全模型、打包和升级。
- 当前项目还没有证明 v0 表单/保存闭环，过早上桌面壳会放大成本。

### 风险

- 技术面过大，偏离“先证明 Music v0 闭环”。
- 一旦引入桌面壳，调试、发布和依赖治理都会更重。

### 结论

适合未来成熟阶段，不适合作为第一步。

## 6. 方案 D：命令行表单脚本

### 形态

先做一个 Node CLI，通过命令行提示用户填写 Music album 字段，生成 preview，确认后写 v2 文件。

### 优点

- 最小实现成本。
- 不需要前端 UI。
- 很适合验证写入流程、字段 schema、preview、backup、检查脚本调用。
- 风险面最小，容易测试和回退。

### 限制

- 不是用户最终想要的可视化管理前端。
- 选择封面/音频的体验较弱。
- 编辑长正文不如 UI 舒服。

### 风险

- 如果 CLI 体验太差，不能验证最终使用体验。
- 后续仍要迁移到 UI。

### 结论

适合作为写入流程的前置验证任务；但 Archive Studio v0 的正式入口仍建议采用本地 Node 服务 + React 页面。

## 7. 推荐路线

推荐分两步：

### Step 1：CLI 写入流程原型

先建立一个不接 UI 的 `music/album` 写入流程原型：

- 输入一个最小 album payload。
- 只写到系统临时目录或单独 sandbox。
- 输出将写入的相对路径和字段摘要。
- 运行 v2 Music shape 检查或轻量 schema 检查。
- 不修改真实 Archive 试点输出。

目的：证明写入逻辑、preview、回退和检查顺序。

### Step 2：本地 Node 服务 + React 页面

在写入逻辑稳定后，再接 UI：

- React 负责表单、预览、确认。
- Node 服务负责读取、写入、备份、检查脚本调用。
- API 只开放 `music/album` allowlist。
- 服务默认只在本地开发模式启动。

## 8. v0 API 草案

第一版只需要这些 API：

| API | 方法 | 行为 | 是否写入 |
|---|---|---|---|
| `/api/studio/music/albums` | GET | 列出 v2 Music album 摘要 | 否 |
| `/api/studio/music/albums/:id` | GET | 读取单个 album 的字段和正文 | 否 |
| `/api/studio/music/albums/preview` | POST | 根据表单生成写入预览 | 否 |
| `/api/studio/music/albums/commit` | POST | 在确认后执行写入 | 是 |
| `/api/studio/music/check` | POST | 运行 v2 Music 检查 | 否，除非检查脚本未来另行改变 |

第一版不提供：

- 删除 API；
- 批量改名；
- 批量迁移；
- 自动写 live `public/data/music.json`；
- 自动 commit / push；
- 旧 OneDrive Data 写入。

## 9. 写入事务草案

保存一个 album 时应遵守：

1. 校验 payload 字段。
2. 计算目标相对路径。
3. 检查是否会覆盖已有文件。
4. 生成 preview。
5. 用户确认。
6. 写入前备份被覆盖文件到系统临时目录。
7. 写入 `entry.yaml`、`content.md`、`cover.*`、`audio.*`。
8. 运行 v2 Music shape 检查。
9. 如果检查失败，保留错误报告，不自动修复。
10. 提供回退指引。

## 10. 安全边界

- 写入根目录必须由配置显式指定。
- 写入目标必须位于 Archive `entries/music/album` 下。
- 任何相对路径必须规范化后检查，禁止 `..` 逃逸。
- 不接受前端传来的绝对输出路径。
- 不把本机完整路径返回给 UI。
- 不在 API 响应中返回账号、密钥、token 或系统环境变量。
- 不运行发布脚本。
- 不运行 `build_archive.py`。
- 不执行 Git 操作。

## 11. 第一批实现前置任务

进入实现前，建议先做三个小任务：

1. 设计 `music/album` payload schema 和 preview 输出格式。
2. 建立 sandbox 写入原型脚本，只写系统临时目录。
3. 建立写入事务的路径 allowlist 和回退策略测试。

## 12. 验收标准

技术入口设计完成的标准：

- [x] 比较纯前端、本地 Node 服务、Electron/Tauri、命令行表单脚本四种方案。
- [x] 明确推荐路线。
- [x] 明确 v0 API 草案。
- [x] 明确写入事务和安全边界。
- [x] 明确第一批实现前置任务。
- [x] 未实现 UI。
- [x] 未修改代码、数据、源数据或生成脚本。

## 13. 下一步建议

下一步只建议做 `music/album` payload schema 和 preview 输出格式设计；仍不实现前端，不写真实 Archive 输出，不运行发布脚本。
