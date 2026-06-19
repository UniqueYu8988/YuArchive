# Archive Studio v0 Music Album Flow

创建日期：2026-06-18
状态：v0 已完成

## 1. v0 定位

Archive Studio v0 是 YuArchive 的本地可视化维护工具。

第一版只做：

- board: `music`
- kind: `album`
- 行为：新建条目

目标是减少手写 YAML、Markdown 和文件放置规则的负担，让用户通过表单、素材选择和保存前预览来维护 ArchiveData-v2。

v0 第一版不做：

- AI 自动补全；
- 自动找封面；
- 自动查外链；
- 自动分类；
- 自动生成简介；
- 自动发布；
- 编辑已有 33 个 Music 条目；
- 直接修改旧 OneDrive Data。

ArchiveData-v2 是新写入目标。旧 OneDrive Data 仍作为只读迁移来源和回退参考。

## 2. 用户流程

目标流程：

```text
进入 Archive Studio
→ 选择 board: music
→ 选择 kind: album
→ 填写表单
→ 上传 / 选择封面
→ 上传 / 选择音频
→ 填写 content.md
→ 预览将写入的文件
→ 运行 preflight
→ 保存按钮解锁
→ 保存到 ArchiveData-v2
→ 运行检查
→ 显示结果
```

当前已实现受控保存；保存仍限定为本地 `music/album/create`，不提供发布能力。

第一版的理想体验：

1. 用户打开本地 Archive Studio。
2. 页面默认展示 `Music / Album` 新建流程。
3. 用户填写最小字段。
4. 用户选择封面和音频。
5. 用户写入 Markdown 内容。
6. 用户点击 `Generate preview`。
7. 页面显示将创建的相对路径和文件角色。
8. 用户点击 `Run preflight`。
9. preflight 通过后，`Create entry` 解锁。
10. 用户确认保存。
11. 保存后运行 v2 Music 检查。
12. 页面显示通过、失败或需要人工处理。

## 3. 页面结构

页面建议分为七个区域。

### 顶部状态区

显示：

- Archive Studio v0；
- 当前模式：Local only；
- 当前目标：`music / album / create`；
- 当前保存状态；
- 最近检查结果。

不显示完整本机路径。

### board / kind 选择区

第一版只启用：

- board: `music`
- kind: `album`

其他 board / kind 可以显示为 disabled，或暂时不显示。

### Music album 表单区

填写结构化字段：

- title；
- date / year；
- url；
- note。

`id` 可由系统根据 title 生成预览，但第一版应允许用户确认或手动调整。

### 素材区

包含：

- cover 文件选择；
- audio 文件选择；
- 文件名、扩展名、大小摘要；
- 是否符合允许扩展名。

不显示完整本机路径。

### Markdown 内容区

一个多行 Markdown 文本框，对应 `content.md`。

第一版不提供复杂编辑器，不做 AI 改写，不自动生成简介。

### 写入预览区

显示将创建的文件：

- entry 目录；
- `entry.yaml`；
- `content.md`；
- cover；
- audio；
- transaction manifest。

所有路径使用相对路径或 `[ArchiveData-v2]` 占位。

### 检查结果区

显示：

- 表单校验结果；
- preview 结果；
- preflight 结果；
- 保存后 v2 Music shape 检查结果；
- 错误和警告。

### 操作按钮区

包含：

- `Reset`
- `Generate preview`
- `Run preflight`
- `Create entry`
- `Cancel`

## 4. Music album 表单字段

第一版字段保持少而稳定。

| 字段 | 必填 | 用户填写 | 说明 |
|---|---|---|---|
| `title` | 是 | 是 | 展示标题 |
| `date` / `year` | 否 | 是 | 年份或日期，不强制规范化 |
| `url` | 否 | 是 | 外部链接 |
| `note` | 否 | 是 | 用户备注或短说明 |
| cover 文件 | 是 | 选择文件 | 主封面 |
| audio 文件 | 是 | 选择文件 | 主音频 |
| `content.md` | 否 | 是 | Markdown 多行文本 |

系统生成或固定：

| 字段 | 来源 |
|---|---|
| `id` | 根据 title 生成建议，用户确认或调整 |
| `board` | 固定为 `music` |
| `kind` | 固定为 `album` |
| 目标目录 | 由 `id` 生成 |
| `entry.yaml` 路径 | 由目标目录生成 |
| `content.md` 路径 | 由目标目录生成 |
| `cover.*` 路径 | 由 cover 扩展名生成 |
| `audio.*` 路径 | 由 audio 扩展名生成 |

不出现在 v0 表单：

- `legacy`；
- `description`；
- `track_title`；
- overwrite / backup 选项；
- board / kind 的自由输入；
- 公开网页生成选项；
- Git / 发布选项。

说明：

- `legacy` 隐藏，不让用户填写。
- `description` 和 `track_title` 暂不进入第一版表单，避免表单变长；后续如果用户觉得需要，可以加入高级字段。
- 第一版只做 create，不提供编辑已有条目的覆盖选项。

## 5. 表单状态与校验

### 状态

| 状态 | 含义 |
|---|---|
| `pristine` | 用户尚未编辑 |
| `dirty` | 表单有改动 |
| `preview-ready` | 本地字段可生成 preview |
| `preflight-passed` | preflight 通过，可请求保存 |
| `saved` | 保存成功并检查通过 |
| `failed` | preview、preflight、保存或检查失败 |

### 基础校验

必须校验：

- title 不为空；
- cover 已选择；
- audio 已选择；
- cover 扩展名在允许范围；
- audio 扩展名在允许范围；
- entry id 可生成；
- entry id 是安全 slug；
- 目标路径无冲突；
- preview manifest 可生成；
- preflight 通过后才允许保存。

允许扩展名：

```text
cover: .jpg .jpeg .png .webp
audio: .mp3 .wav .flac .m4a .ogg .aac
```

## 6. 写入预览

保存前 preview 应显示：

- 将创建的条目目录；
- 将创建的 `entry.yaml`；
- 将创建的 `content.md`；
- 将复制的 cover；
- 将复制的 audio；
- 可能创建的 manifest；
- 是否会覆盖任何已有文件；
- 是否需要 rollback manifest。

路径显示规则：

```text
[ArchiveData-v2]/entries/music/album/<entry-id>/entry.yaml
[ArchiveData-v2]/entries/music/album/<entry-id>/content.md
[ArchiveData-v2]/entries/music/album/<entry-id>/cover.<ext>
[ArchiveData-v2]/entries/music/album/<entry-id>/audio.<ext>
```

preview 不显示：

- 完整本机路径；
- token、secret、账号信息；
- 大段 Markdown 正文；
- 音频或图片二进制内容。

## 7. 操作按钮

| 按钮 | v0 是否启用 | 说明 |
|---|---|---|
| `Reset` | 启用 | 清空当前未保存输入 |
| `Generate preview` | 启用 | 生成写入预览，不写文件 |
| `Run preflight` | 启用 | 调用 preflight 能力，不写文件 |
| `Create entry` | 启用 | 只在 preview 和 preflight 通过且一次性 token 有效时可用 |
| `Cancel` | 启用 | 返回初始状态或离开表单 |

第一版 UI 可以先实现前三个按钮，`Create entry` 显示为 disabled，并说明保存能力尚未启用。

## 8. 错误和提示

常见错误：

| 错误 | UI 显示方式 |
|---|---|
| 缺 title | 字段下方显示错误，preview 不可生成 |
| 缺 cover | 素材区显示错误 |
| 缺 audio | 素材区显示错误 |
| 文件类型不支持 | 显示扩展名规则 |
| entry id 冲突 | preview 区显示目标已存在 |
| preflight 失败 | 检查结果区显示失败规则名 |
| 保存失败 | 显示阶段名和摘要 |
| rollback 需要人工处理 | 显示相对路径和操作建议 |

提示原则：

- 用字段名、规则名、相对路径解释问题；
- 不输出完整本机路径；
- 不自动修复用户内容；
- 不隐藏阻断原因。

## 9. 本地 Node API 草案

本节只做接口设计，不实现代码。

| API | 输入 | 输出 | 是否读写文件 | v0 是否启用 | 是否需要 explicit execution gate |
|---|---|---|---|---|---|
| `GET /api/studio/profiles` | 无 | 可用 board/kind、能力开关 | 只读 | 启用 | 否 |
| `POST /api/studio/music/album/preview` | 表单 payload | target、summary、operations、warnings、errors | 只读 | 启用 | 否 |
| `POST /api/studio/music/album/preflight` | 表单 payload / preview id | preflight 结果、阻断规则 | 只读 | 启用 | 否 |
| `POST /api/studio/music/album/create` | confirmed payload、preflight token、cover、audio | 创建结果、manifest 摘要、检查结果 | 写 ArchiveData-v2 | 启用 | 是 |
| `POST /api/studio/checks/music-v2` | 无或检查 profile | v2 Music shape 检查摘要 | 只读 | 启用 | 否 |

API 边界：

- 只监听本地；
- 不暴露到公开部署；
- 不接受前端传入的任意本机输出路径；
- 写入 API 只允许 `music/album/create`；
- 第一版不提供 delete、bulk import、publish、Git 操作 API。

## 10. 与现有 CLI / runner 的关系

现有能力可以作为后端基础：

- preview core 可用于生成保存前 preview；
- preflight checker 可用于保存前阻断；
- smoke test runner 可用于验证真实写入链路；
- v2 Music shape check 可用于保存后检查；
- live-compatible preview generator 可用于后续公开网页生成预览。

UI 不应暴露复杂 runner 细节。

UI 只需要展示：

- preview；
- preflight；
- save；
- check。

当前不继续为底层机制加新层。只有当 UI / API 设计证明缺少能力时，才回到底层补充。

## 11. v0 不做事项

v0 第一版不做：

- AI 自动补全；
- 自动找封面；
- 自动查外链；
- 自动分类；
- 自动简介；
- 自动发布；
- 编辑已有条目；
- 批量导入；
- 多板块支持；
- Git、构建或发布操作入口。

## 12. 后续实施顺序

建议后续顺序：

1. 确认本设计文档。
2. 实现只读页面壳。
3. 实现 board / kind 选择。
4. 实现 `music/album` 表单。
5. 实现 preview API。
6. 实现 preflight API。
7. 再决定是否接入真实 create + rollback smoke test。
8. 最后才启用真实保存。

第一批前端实现仍应只读，不写 ArchiveData-v2。

## 13. v0 完成验收标准

Archive Studio v0 只有在以下条件全部满足后，才视为完成：

- 提供独立的本地 Archive Studio 页面入口；
- 第一版只支持 `music / album / create`；
- 用户可以填写 title、date/year、url、note 和 Markdown 内容；
- 用户可以选择一个封面文件和一个音频文件；
- UI 不显示完整本机路径；
- UI 可以生成 entry id 建议和目标相对路径预览；
- UI 可以预览 `entry.yaml`、`content.md`、cover、audio 和 manifest 的文件角色；
- preview 和 preflight 不写 ArchiveData-v2；
- preflight 未通过时，`Create entry` 必须保持禁用；
- 保存只允许创建一个新的 Music album 条目，不覆盖已有条目；
- 保存后运行 v2 Music shape check，并显示结果；
- 写入失败时提供可理解的失败阶段和 rollback 状态；
- 不修改旧 OneDrive Data；
- 不运行 `build_archive.py`；
- 不提供 Git、构建、发布或自动发布能力；
- 不提供 AI 自动补全、自动找封面、自动分类或自动生成简介；
- 桌面端流程完整可用，移动端至少可以查看和完成基础表单操作；
- 通过一次受控 create + check + rollback smoke test；
- 通过一次保留新条目的完整 create 验收。

当前 preview、preflight、受控 create 和写后检查已经实现。用户已通过页面使用真实素材保留一个新条目，Music v2 从 33 条增至 34 条，结构检查通过；v0 Music Album 新建闭环完成。
