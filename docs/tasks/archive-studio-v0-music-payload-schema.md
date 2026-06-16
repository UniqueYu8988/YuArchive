# 任务：Archive Studio v0 music/album payload schema 和 preview 输出格式

创建日期：2026-06-16
状态：已完成

## 1. 目标

为 Archive Studio v0 的 `music/album` 写入流程定义第一版 payload schema 和 preview 输出格式。该 schema 用于后续 CLI 写入流程原型和本地 Node 服务，不直接实现 UI，不写真实数据。

## 2. 背景

Archive Studio v0 已确定第一阶段只支持 `music/album`。技术入口设计建议先做 CLI 写入流程原型，再接本地 Node 服务 + React 页面。本任务把“用户提交什么数据”和“保存前预览返回什么结构”先稳定下来，避免后续实现时把写入规则散落在 UI 或脚本里。

## 3. 本次范围

- 定义 `music/album` create / update payload。
- 定义字段校验规则。
- 定义素材引用规则。
- 定义保存前 preview 输出。
- 定义 preview 的风险和操作摘要。
- 定义后续 sandbox 原型的验收方式。

## 4. 明确不做

- 不实现脚本。
- 不实现前端。
- 不写 ArchiveData-v2 输出。
- 不改 OneDrive Data。
- 不改 `public/data` 或 `src/data`。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不执行 Git 写操作。

## 5. Payload 顶层结构

第一版 payload 使用单一对象：

```json
{
  "mode": "create",
  "board": "music",
  "kind": "album",
  "id": "example-album",
  "fields": {},
  "content": {},
  "assets": {},
  "options": {}
}
```

字段说明：

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `mode` | string | 是 | `create` 或 `update` |
| `board` | string | 是 | v0 固定为 `music` |
| `kind` | string | 是 | v0 固定为 `album` |
| `id` | string | 是 | 稳定 entry id，只允许安全 slug |
| `fields` | object | 是 | 写入 `entry.yaml` 的结构化字段 |
| `content` | object | 是 | 写入 `content.md` 的正文信息 |
| `assets` | object | 是 | 封面和音频素材引用 |
| `options` | object | 否 | 覆盖、备份、检查等行为选项 |

## 6. mode 规则

### create

`create` 表示创建新条目。

要求：

- 目标 entry 目录不存在。
- 不允许覆盖已有 `entry.yaml`、`content.md`、`cover.*`、`audio.*`。
- 必须提供 `title`。

### update

`update` 表示编辑已有条目。

要求：

- 目标 entry 目录已存在。
- 必须先生成覆盖 preview。
- 默认不允许覆盖素材，除非 `options.allowOverwriteAssets` 为 `true`。
- 必须备份将被覆盖的文件。

## 7. id 规则

`id` 是稳定标识。

允许：

- 小写英文字母；
- 数字；
- 短横线；
- 长度 2 到 80。

禁止：

- 空格；
- 下划线；
- 中文；
- 路径分隔符；
- `..`；
- Windows 保留字符；
- 以短横线开头或结尾。

正则草案：

```text
^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$
```

## 8. fields 结构

`fields` 写入 `entry.yaml`。

```json
{
  "title": "Album title",
  "date": "2026",
  "description": "Short display description",
  "track_title": "Track title",
  "url": "https://example.com",
  "note": "Optional private working note",
  "legacy": {}
}
```

字段规则：

| 字段 | 类型 | 必需 | 写入位置 | 说明 |
|---|---|---|---|---|
| `title` | string | 是 | `entry.yaml` | 展示标题 |
| `date` | string | 否 | `entry.yaml` | 年份或日期，不强制规范化 |
| `description` | string | 否 | `entry.yaml` | 短描述 |
| `track_title` | string | 否 | `entry.yaml` | 音频标题 |
| `url` | string | 否 | `entry.yaml` | 外部链接 |
| `note` | string | 否 | `entry.yaml` | 用户备注 |
| `legacy` | object | 否 | `entry.yaml` | 迁移兼容信息，v0 默认只读 |

自动写入字段：

```yaml
id:
board: music
kind: album
```

这些字段由 payload 顶层生成，不由用户在 `fields` 中重复填写。

## 9. content 结构

`content` 写入 `content.md`。

```json
{
  "markdown": "Long note, track list, or description."
}
```

规则：

- `markdown` 可以为空字符串。
- 不在 preview 中输出大段正文，只输出字符数、行数和是否为空。
- 写入时保留用户输入，不自动生成简介。
- 不做 AI 改写。

## 10. assets 结构

`assets` 只描述封面和音频。

```json
{
  "cover": {
    "source": "selected-file",
    "originalName": "cover.jpg",
    "extension": ".jpg"
  },
  "audio": {
    "source": "selected-file",
    "originalName": "audio.mp3",
    "extension": ".mp3"
  }
}
```

第一版只允许两类 source：

| source | 说明 |
|---|---|
| `selected-file` | 用户选择的新文件，后续实现负责临时路径 |
| `keep-existing` | update 时保留已有素材 |

封面扩展名允许：

```text
.jpg .jpeg .png .webp
```

音频扩展名允许：

```text
.mp3 .wav .flac .m4a .ogg .aac
```

preview 不返回素材本机完整路径，只返回原始文件名、扩展名、目标相对文件名和是否会覆盖。

## 11. options 结构

```json
{
  "allowOverwriteEntry": false,
  "allowOverwriteAssets": false,
  "runCheckAfterWrite": true,
  "backupBeforeOverwrite": true
}
```

默认值：

| 字段 | 默认 | 说明 |
|---|---|---|
| `allowOverwriteEntry` | `false` | 是否允许覆盖 `entry.yaml` / `content.md` |
| `allowOverwriteAssets` | `false` | 是否允许覆盖 `cover.*` / `audio.*` |
| `runCheckAfterWrite` | `true` | 写入后是否运行 v2 Music 检查 |
| `backupBeforeOverwrite` | `true` | 覆盖前是否备份 |

## 12. Preview 顶层结构

保存前 preview 使用以下结构：

```json
{
  "ok": true,
  "mode": "create",
  "target": {},
  "summary": {},
  "operations": [],
  "warnings": [],
  "errors": [],
  "checks": []
}
```

字段说明：

| 字段 | 类型 | 说明 |
|---|---|---|
| `ok` | boolean | 没有阻断错误时为 true |
| `mode` | string | `create` 或 `update` |
| `target` | object | 目标条目相对路径摘要 |
| `summary` | object | 字段、正文、素材数量摘要 |
| `operations` | array | 将执行的文件操作 |
| `warnings` | array | 可继续但需要确认的风险 |
| `errors` | array | 阻断保存的问题 |
| `checks` | array | 保存后建议运行的检查 |

## 13. target 结构

```json
{
  "entryId": "example-album",
  "entryRelativeDir": "entries/music/album/example-album",
  "entryYaml": "entries/music/album/example-album/entry.yaml",
  "contentMd": "entries/music/album/example-album/content.md",
  "cover": "entries/music/album/example-album/cover.jpg",
  "audio": "entries/music/album/example-album/audio.mp3"
}
```

规则：

- 只使用相对路径。
- 不返回本机完整路径。
- 路径分隔符统一为 `/`。
- preview 生成时必须确认路径没有逃逸目标目录。

## 14. summary 结构

```json
{
  "titlePresent": true,
  "descriptionChars": 28,
  "contentChars": 120,
  "contentLines": 8,
  "hasCover": true,
  "hasAudio": true,
  "legacyKeys": 0
}
```

规则：

- 不输出正文内容。
- 不输出完整标题清单。
- 只输出布尔值和计数。

## 15. operations 结构

```json
[
  {
    "type": "write_yaml",
    "relativePath": "entries/music/album/example-album/entry.yaml",
    "willOverwrite": false,
    "requiresBackup": false
  },
  {
    "type": "write_markdown",
    "relativePath": "entries/music/album/example-album/content.md",
    "willOverwrite": false,
    "requiresBackup": false
  },
  {
    "type": "copy_asset",
    "role": "cover",
    "relativePath": "entries/music/album/example-album/cover.jpg",
    "willOverwrite": false,
    "requiresBackup": false
  }
]
```

允许的 operation type：

- `create_directory`
- `write_yaml`
- `write_markdown`
- `copy_asset`
- `backup_file`
- `run_check`

第一版不允许：

- `delete_file`
- `rename_file`
- `git_add`
- `git_commit`
- `git_push`
- `run_build_archive`
- `run_release_script`

## 16. warnings 和 errors

warning 示例：

```json
{
  "code": "content_empty",
  "message": "content.md is empty",
  "path": "content.markdown"
}
```

error 示例：

```json
{
  "code": "invalid_entry_id",
  "message": "entry id must be a lowercase slug",
  "path": "id"
}
```

规则：

- message 不包含本机完整路径。
- path 使用 payload JSON 路径或目标相对路径。
- error 出现时 `ok` 必须为 `false`。

## 17. checks 结构

保存后建议检查：

```json
[
  {
    "command": "node scripts/check-archive-data-v2-music-shape.mjs",
    "required": true
  },
  {
    "command": "node scripts/generate-archive-data-v2-music-live-compatible-preview.mjs",
    "required": false
  }
]
```

第一版 preview 只列命令，不自动执行。

## 18. Sandbox 原型验收

后续 CLI sandbox 原型应满足：

- 只写系统临时目录或项目外的明确 sandbox。
- 不写真实 ArchiveData-v2 输出。
- 不写旧 OneDrive Data。
- 不写 `public/data`。
- 不运行 `build_archive.py`。
- 输入一个示例 payload 后输出 preview JSON。
- preview 中所有路径都是相对路径。
- 无本机完整路径、token、secret 命中。

## 19. 下一步建议

下一步只建议实现一个只写系统临时目录的 CLI sandbox preview 脚本，用于验证 schema、preview 和路径 allowlist；不接 UI，不写真实数据。
