# 任务：Archive Studio v0 边界设计

创建日期：2026-06-16
状态：已完成

## 1. 目标

为 Archive Studio v0 建立第一版产品和技术边界，明确它在 YuArchive 系统升级中的职责：先服务 `music/album` 的本地文件管理闭环，不进入完整前端实现，不自动改旧 OneDrive Data，不替代用户判断。

## 2. 背景

ArchiveData-v2 已完成文件规则设计、只读迁移审计、migration dry-run、Music-only 写入试点、v2 Music 输出检查、live-compatible preview 和 `public/data/music.json` 替换。下一阶段可以开始考虑 Archive Studio v0，但应先定义安全边界，避免直接进入功能开发或自动化写源数据。

## 3. 本次范围

- 只设计 Archive Studio v0 的职责、非目标和安全边界。
- 只覆盖 `music/album` 作为第一批试点。
- 明确读取、预览、保存、校验和生成的顺序。
- 明确哪些行为必须用户确认。
- 明确哪些行为不进入 v0。

## 4. 明确不做

- 不实现前端页面。
- 不修改 `src` 代码。
- 不修改 `build_archive.py`。
- 不修改 OneDrive Data。
- 不修改 `ArchiveData-v2` 试点输出。
- 不修改 `public/data` 或 `src/data`。
- 不运行 `build_archive.py`。
- 不运行 npm dev/build/preview。
- 不运行发布脚本。
- 不做 AI 自动补全、自动找封面、自动查外链、自动分类或自动生成简介。

## 5. v0 只支持的对象

Archive Studio v0 只支持：

```text
board: music
kind: album
```

原因：

- Music 字段少，适合作为最小闭环。
- 当前 Music 33 个条目、封面、音频已经通过源侧媒体匹配检查。
- v2 Music 试点输出已经通过 `check-archive-data-v2-music-shape`。
- live-compatible preview 已证明可以复用当前 live ID 和公开媒体路径。

## 6. 用户可见工作流

v0 的目标工作流：

1. 打开本地 Archive Studio。
2. 选择 `Music / Album`。
3. 查看现有 v2 Music album 条目列表。
4. 新建或编辑一个 album 条目。
5. 填写结构化字段。
6. 编辑 `content.md` 的正文或说明。
7. 选择或替换封面和音频。
8. 保存前显示文件写入预览。
9. 用户确认后写入 v2 文件结构。
10. 保存后运行 v2 Music 检查。
11. 需要更新公开网页时，单独运行 preview / live-compatible 生成流程。

## 7. v0 表单字段

第一版表单只覆盖 `music/album`：

| 字段 | 来源 | 必需性 | 说明 |
|---|---|---|---|
| `id` | 用户或自动建议后用户确认 | 必需 | 稳定标识，创建后不应随标题变化 |
| `board` | 固定值 | 必需 | 固定为 `music` |
| `kind` | 固定值 | 必需 | 固定为 `album` |
| `title` | 用户填写 | 必需 | 展示标题 |
| `description` | 用户填写 | 建议 | 短描述或展示说明 |
| `track_title` | 用户填写 | 建议 | 音频标题 |
| `url` | 用户填写 | 可选 | 外部链接 |
| `note` | 用户填写 | 可选 | 用户备注 |
| `legacy` | 迁移或兼容层维护 | 可选 | v0 不要求用户直接编辑 |
| `content.md` | 用户编辑 | 可选 | 长说明、曲目列表或短评 |
| `cover.*` | 用户选择 | 建议 | 主封面 |
| `audio.*` | 用户选择 | 建议 | 主音频 |

## 8. 保存前预览

任何写入前必须展示：

- 将创建或修改的条目目录。
- 将写入的 `entry.yaml`。
- 将写入的 `content.md`。
- 将复制或替换的 `cover.*`。
- 将复制或替换的 `audio.*`。
- 是否会覆盖已有文件。
- 必需字段是否缺失。
- 文件扩展名是否在允许列表中。

预览只显示相对路径和字段名，不显示本机完整路径。

## 9. 写入边界

v0 只能写入 ArchiveData-v2 输出目录，不能写旧 OneDrive Data。

允许的写入：

- 新建 `entries/music/album/<entry-id>/`。
- 写入 `entry.yaml`。
- 写入 `content.md`。
- 写入或替换 `cover.*`。
- 写入或替换 `audio.*`。

禁止的写入：

- 不写旧 OneDrive Data。
- 不写 `public/data`。
- 不写 `src/data`。
- 不写缓存目录。
- 不写 reports 数据文件。
- 不改 `build_archive.py`。
- 不自动运行发布脚本。

## 10. 保存后验收

保存后应按顺序运行：

```powershell
node scripts/check-archive-data-v2-music-shape.mjs
node scripts/generate-archive-data-v2-music-live-compatible-preview.mjs
```

如果要替换 live `public/data/music.json`，必须进入单独任务，并再次明确授权。v0 保存条目不等于更新公开网页。

## 11. 生成与发布边界

Archive Studio v0 不直接发布。

推荐顺序：

1. 用户在 v0 中保存 v2 Music 条目。
2. 运行 v2 Music shape 检查。
3. 运行 live-compatible preview。
4. 用户审查 preview 和 diff。
5. 单独授权后替换 `public/data/music.json`。
6. 运行 public data shape 和 generated data privacy 检查。
7. 单独授权后 Git commit。
8. 单独授权后 push。

## 12. 失败与回退

如果保存失败：

- 不应产生半写入条目；如果无法避免，应记录 partial 状态。
- 用户应能删除本次创建的条目目录。
- 对已有条目的修改应先备份旧文件到系统临时目录或显示 diff 后再写入。
- 检查失败时不自动修复，只报告字段、文件和规则。

## 13. 后续实现前置条件

进入前端实现前，应先完成：

- 明确 Archive Studio 是本地工具、开发模式页面，还是独立脚本/小应用。
- 明确文件写入由哪一层执行：Node 脚本、本地服务、Electron/Tauri 或其他方式。
- 明确 v0 是否允许编辑已有 33 个 Music 条目，还是只允许新建。
- 明确是否需要独立备份策略。
- 明确是否需要用户确认每一次覆盖。

## 14. 下一步建议

下一步只建议做 Archive Studio v0 技术入口设计：比较“纯前端不可写文件”、“本地 Node 服务”、“Electron/Tauri”、“命令行表单脚本”四种方式，选择最小可验证路线。暂不实现 UI。
