# 任务：Archive Studio v0 写入事务设计

创建日期：2026-06-16
状态：已完成

## 1. 目标

为 Archive Studio v0 `music/album` 写入流程设计第一版事务边界，明确 diff preview、backup manifest、写入顺序、失败处理和 rollback 规则。

本任务只做设计，不写真实 ArchiveData-v2 输出，不接 UI，不修改 OneDrive Data。

## 2. 背景

Archive Studio v0 已完成：

- `music/album` 边界设计；
- 技术入口设计；
- payload schema 和 preview 输出格式；
- CLI sandbox preview；
- preview core 模块拆分；
- preview core 自检。

下一步如果直接实现真实写入，很容易出现半写入、覆盖不可恢复、检查失败后状态不清楚等问题。因此在实现 commit 脚本或本地 Node 服务前，需要先定义写入事务的固定顺序和可验证产物。

## 3. 本次范围

- 设计 `music/album` create / update 的事务阶段。
- 设计保存前 diff preview。
- 设计 backup manifest。
- 设计写入 manifest。
- 设计 rollback 输入和行为。
- 设计失败分类和停止点。
- 设计后续实现的验收标准。

## 4. 明确不做

- 不实现写入脚本。
- 不实现本地 Node 服务。
- 不实现前端 UI。
- 不写真实 ArchiveData-v2 输出。
- 不写 OneDrive Data。
- 不写 `public/data`、`src/data`、缓存或 reports。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不执行 Git 操作。

## 5. 术语

| 术语 | 含义 |
|---|---|
| payload | Archive Studio 表单或 CLI 输入的 `music/album` 数据 |
| preview | 写入前生成的操作计划，只包含相对路径和摘要 |
| diff preview | 针对将写入文件的新增、覆盖、保留和跳过摘要 |
| backup manifest | 覆盖前备份的文件清单和校验信息 |
| write manifest | 本次写入实际创建或修改的文件清单 |
| transaction id | 单次保存的稳定标识，用于关联 preview、backup、write 和 rollback |
| rollback | 根据 manifest 删除本次新增文件、恢复本次覆盖文件 |

## 6. 事务阶段

Archive Studio v0 保存一次 `music/album` 应拆成以下阶段：

1. **Validate payload**
   - 校验 `mode`、`board`、`kind`、`id`、必要字段和素材扩展名。
   - 校验所有相对路径不能逃逸 `entries/music/album`。
   - 校验不包含本机完整路径、token、secret 等敏感标记。

2. **Resolve target**
   - 计算目标条目目录。
   - 计算 `entry.yaml`、`content.md`、`cover.*`、`audio.*` 的目标相对路径。
   - 不接受 payload 传入的绝对输出路径。

3. **Read current state**
   - 读取目标文件是否存在。
   - 只读取将要比较或覆盖的目标文件。
   - 对已存在文件计算 checksum 和大小。

4. **Build diff preview**
   - 标记每个文件是 `create`、`overwrite`、`keep`、`skip` 还是 `blocked`。
   - 只输出相对路径、文件角色、是否覆盖、大小变化、checksum 是否变化。
   - 不输出完整本机路径，不输出大段正文。

5. **User confirmation gate**
   - preview 中存在 `blocked` 时不能进入写入。
   - `overwrite` 必须由用户确认。
   - update 模式下若没有 backup 计划，不能进入写入。

6. **Prepare backup**
   - 对将被覆盖的文件复制到系统临时 backup 目录。
   - 记录 backup manifest。
   - backup manifest 只记录相对目标路径、backup 标签、checksum、大小和角色。

7. **Write to staging**
   - 先在系统临时 staging 目录生成目标文件内容。
   - `entry.yaml` 和 `content.md` 先写 staging。
   - 素材先复制到 staging。
   - 对 staging 文件计算 checksum。

8. **Apply write**
   - 创建目标目录。
   - 将 staging 文件移动或复制到目标位置。
   - 逐项记录 write manifest。
   - 不删除旧的无关文件。

9. **Run checks**
   - 运行 `node scripts/check-archive-data-v2-music-shape.mjs`。
   - 可选运行 `node scripts/generate-archive-data-v2-music-live-compatible-preview.mjs`。
   - 检查失败时不自动改数据。

10. **Finalize**
    - 保存 transaction summary。
    - 输出写入数量、覆盖数量、检查结果和 rollback 指引。

## 7. Create 模式规则

`create` 用于新增条目。

必须满足：

- `entries/music/album/<entry-id>/` 不存在，或存在但为空且由本事务创建；
- 不覆盖已有 `entry.yaml`、`content.md`、`cover.*`、`audio.*`；
- `title` 存在；
- id 合法且不与现有条目冲突。

create 模式允许：

- 创建条目目录；
- 写入 `entry.yaml`；
- 写入 `content.md`；
- 复制 `cover.*`；
- 复制 `audio.*`。

create 模式失败回退：

- 删除本事务创建的文件；
- 如果条目目录由本事务创建且回退后为空，可以删除该目录；
- 不删除本事务之前已经存在的目录或文件。

## 8. Update 模式规则

`update` 用于编辑已有条目。

必须满足：

- 目标条目目录存在；
- `entry.yaml` 存在；
- 覆盖项已经进入 diff preview；
- 所有覆盖项已经有 backup manifest；
- 用户已确认覆盖。

update 模式允许：

- 覆盖 `entry.yaml`；
- 覆盖 `content.md`；
- 在用户明确选择新素材时覆盖 `cover.*` 或 `audio.*`；
- 对 `keep-existing` 素材保持原文件不动。

update 模式禁止：

- 自动删除未被新素材替代的旧素材；
- 自动重命名条目 id；
- 自动移动条目目录；
- 自动修改 live `public/data/music.json`。

update 模式失败回退：

- 对本事务覆盖的文件，从 backup 恢复；
- 对本事务新增的文件，删除新增文件；
- 不自动恢复或删除本事务未触碰的文件。

## 9. Diff preview 结构草案

保存前 diff preview 可附加到现有 preview：

```json
{
  "transaction": {
    "id": "studio-preview-20260616-000001",
    "mode": "create",
    "writeRootLabel": "ArchiveData-v2",
    "scope": "entries/music/album"
  },
  "diff": [
    {
      "role": "entry_yaml",
      "operation": "create",
      "relativePath": "entries/music/album/example/entry.yaml",
      "exists": false,
      "willOverwrite": false,
      "requiresBackup": false,
      "contentChanged": true
    }
  ],
  "confirmation": {
    "required": true,
    "reasons": ["create_entry"],
    "blocked": false
  }
}
```

规则：

- `relativePath` 必须是相对路径。
- `writeRootLabel` 不能包含本机完整路径。
- `operation` 只允许 `create`、`overwrite`、`keep`、`skip`、`blocked`。
- 正文只输出字符数、行数和 checksum，不输出完整正文。
- 素材只输出扩展名、大小和 checksum，不读取或输出二进制内容。

## 10. Backup manifest 结构草案

backup manifest 只在会覆盖已有文件时生成：

```json
{
  "transactionId": "studio-preview-20260616-000001",
  "createdAt": "2026-06-16T00:00:00.000Z",
  "scope": "entries/music/album",
  "items": [
    {
      "role": "entry_yaml",
      "targetRelativePath": "entries/music/album/example/entry.yaml",
      "backupLabel": "system-temp/archive-studio-v0/backups/<transaction-id>/entry.yaml",
      "sha256": "sha256-redacted-in-doc",
      "bytes": 1234
    }
  ]
}
```

规则：

- manifest 不记录完整本机路径。
- `backupLabel` 使用标签，不使用真实临时目录路径。
- checksum 用于回退前确认备份文件未损坏。
- 如果 backup 失败，写入必须停止。

## 11. Write manifest 结构草案

write manifest 记录实际落盘结果：

```json
{
  "transactionId": "studio-preview-20260616-000001",
  "mode": "create",
  "scope": "entries/music/album",
  "items": [
    {
      "role": "content_md",
      "operation": "create",
      "targetRelativePath": "entries/music/album/example/content.md",
      "sha256": "sha256-redacted-in-doc",
      "bytes": 456
    }
  ],
  "checks": [
    {
      "command": "node scripts/check-archive-data-v2-music-shape.mjs",
      "exitCode": 0
    }
  ]
}
```

规则：

- write manifest 是 rollback 的输入之一。
- `operation` 只记录实际发生的创建或覆盖，不记录未触碰文件。
- 检查失败也应记录 manifest，方便用户判断回退或保留。

## 12. Rollback 规则

rollback 必须显式执行，不能在检查失败时悄悄自动回滚。

rollback 输入：

- write manifest；
- backup manifest；
- 当前目标文件状态。

rollback 行为：

1. 校验 transaction id。
2. 读取 write manifest。
3. 对本事务创建的新文件执行删除。
4. 对本事务覆盖的文件，从 backup 恢复。
5. 对恢复后的文件重新计算 checksum。
6. 如果目录由本事务创建且为空，删除该目录。
7. 输出 rollback summary。

rollback 禁止：

- 删除 manifest 中没有记录的文件。
- 删除整个 `entries/music/album`。
- 修改旧 OneDrive Data。
- 修改 `public/data` 或 `src/data`。
- 执行 Git 操作。

## 13. 失败分类

| 阶段 | 失败类型 | 是否写入目标 | 处理 |
|---|---|---|---|
| validate | payload 错误 | 否 | 返回 errors，停止 |
| resolve target | 路径逃逸或冲突 | 否 | 返回 blocked，停止 |
| read current state | 目标不可读 | 否 | 返回 errors，停止 |
| build diff preview | preview 不安全 | 否 | 返回 errors，停止 |
| backup | 备份失败 | 否 | 停止，不写目标 |
| staging | staging 写入失败 | 否 | 删除 staging，停止 |
| apply write | 部分写入失败 | 可能 | 记录 partial，提示 rollback |
| run checks | 检查失败 | 是 | 不自动修复，输出 rollback 指引 |

## 14. 后续实现建议

第一批实现仍应保持小步：

1. 新建只写系统临时目录的 transaction sandbox。
2. 在 sandbox 中实现 diff preview、backup manifest 和 write manifest。
3. 增加 rollback sandbox 自检。
4. 仍不写真实 ArchiveData-v2 输出。
5. sandbox 通过后，再设计真实 v2 Music 写入 approval gate。

## 15. 验收标准

本设计完成的标准：

- [x] 明确 create / update 的写入规则。
- [x] 明确 diff preview 结构。
- [x] 明确 backup manifest 和 write manifest。
- [x] 明确 rollback 输入、行为和禁止范围。
- [x] 明确失败分类和停止点。
- [x] 明确后续仍先做 sandbox，不直接写真实 ArchiveData-v2。
- [x] 未修改 OneDrive Data、真实 ArchiveData-v2、`public/data`、`src/data`、缓存或 reports。

## 16. 下一步建议

下一步只建议实现 Archive Studio v0 transaction sandbox：仍只写系统临时目录，模拟 create / update / rollback，不写真实 ArchiveData-v2 输出，不接 UI。
