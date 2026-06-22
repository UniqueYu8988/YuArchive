# 任务：Archive Studio v0 真实 v2 写入 approval gate

创建日期：2026-06-17
状态：已完成

## 1. 目标

设计 Archive Studio v0 从 transaction sandbox 进入真实 Archive Music 写入前必须满足的 approval gate。

本任务只做设计，不实现真实写入脚本，不写真实 Archive 输出，不接 UI。

## 2. 背景

当前已完成：

- Archive Studio v0 `music/album` 边界设计；
- 技术入口设计；
- payload schema 和 preview 输出格式；
- CLI sandbox preview；
- preview core 模块拆分和自检；
- 写入事务设计；
- transaction sandbox；
- transaction sandbox 失败场景自检。

transaction sandbox 证明 create / update / rollback 的模型可以在系统临时目录中运行。但真实 Archive 输出位于项目 Git 工作树外，且包含迁移后的 Music 条目与媒体文件。进入真实写入前必须单独建立 gate，避免 sandbox 逻辑直接碰真实数据。

## 3. 本次范围

- 定义从 sandbox 到真实 v2 Music 写入的前置条件。
- 定义允许的真实写入范围。
- 定义禁止范围。
- 定义用户确认内容。
- 定义运行前基线。
- 定义写入后验收。
- 定义失败和回退要求。
- 定义下一步实现任务的边界。

## 4. 明确不做

- 不实现真实写入脚本。
- 不接前端 UI。
- 不写真实 Archive 输出。
- 不写 OneDrive Data。
- 不写 `public/data`、`src/data`、缓存或 reports。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不执行 Git 操作。
- 不发布网页。

## 5. Approval gate 总则

真实 v2 Music 写入必须是单独任务，且必须明确授权。

授权文本至少应包含：

```text
授权执行 Archive Studio v0 真实 v2 Music 写入试点，只允许写 Archive/entries/music/album，允许创建/更新一个指定 entry，不修改 OneDrive Data、不修改 public/data、不运行 build_archive.py、不发布。
```

如果授权没有指定 entry id、mode 和写入范围，应停止并要求补充。

## 6. 允许范围

第一轮真实写入只允许：

- board: `music`
- kind: `album`
- mode: `create` 或 `update`
- entry 数量：一次只处理 1 个 entry
- 写入根：真实 Archive 输出目录
- 写入 scope：`entries/music/album/<entry-id>/`

允许写入文件：

- `entry.yaml`
- `content.md`
- `cover.*`
- `audio.*`
- transaction manifest
- backup manifest
- rollback manifest 或 rollback summary

manifest 应放在真实 v2 输出目录的管理子目录中，建议：

```text
migration/archive-studio-v0/transactions/<transaction-id>/
```

如果真实 v2 输出当前没有该目录，可由真实写入任务单独创建。

## 7. 禁止范围

真实 v2 Music 写入任务禁止：

- 修改旧 OneDrive Data；
- 修改旧 `Music` Markdown、Covers 或 Songs；
- 修改 `public/data/music.json`；
- 修改 `public/data/*.json`；
- 修改 `src/data/*.json`；
- 修改缓存目录；
- 修改 reports 数据文件；
- 修改 `build_archive.py`；
- 运行 `build_archive.py`；
- 运行发布脚本；
- 执行 Git add / commit / push，除非任务另行授权；
- 自动删除不在 transaction manifest 中的文件；
- 批量迁移其他 board；
- 自动生成简介、自动找封面、自动分类或自动查外链。

## 8. 运行前基线

真实写入前必须建立基线。

最小基线：

- 当前 Git 状态；
- 真实 Archive Music 输出目录是否存在；
- 目标 entry 目录是否存在；
- 目标 entry 下相关文件的存在性、大小和 checksum；
- `migration-manifest.json`、`unmapped-files.json`、`legacy-field-report.md` 是否存在；
- `node scripts/check-archive-data-v2-music-shape.mjs` 是否通过；
- `node scripts/check-archive-studio-v0-transaction-sandbox.mjs` 是否通过。

基线输出只能包含：

- 文件角色；
- 相对路径；
- 文件数量；
- checksum；
- 是否存在；
- 是否会覆盖。

基线输出禁止包含：

- 完整本机路径；
- 大段正文；
- token、secret、账号凭据。

## 9. Payload gate

payload 必须通过已有 preview core 校验。

必须满足：

- `mode` 是 `create` 或 `update`；
- `board` 是 `music`；
- `kind` 是 `album`；
- `id` 是安全 slug；
- `title` 非空；
- cover 扩展名在允许列表；
- audio 扩展名在允许列表；
- preview target 全部是相对路径；
- preview 不包含本机完整路径或 secret-like marker。

create 额外要求：

- 目标 entry 目录不存在；
- 不覆盖已有文件；
- 用户确认创建新 entry。

update 额外要求：

- 目标 entry 目录存在；
- `entry.yaml` 存在；
- 所有覆盖项进入 diff preview；
- 所有覆盖项都有 backup manifest；
- 用户确认覆盖。

## 10. Diff approval

真实写入前必须展示 diff approval。

diff approval 至少包含：

| 字段 | 说明 |
|---|---|
| `transactionId` | 本次写入事务 id |
| `mode` | create / update |
| `entryId` | 目标 entry id |
| `scope` | `entries/music/album/<entry-id>` |
| `operations` | create / overwrite / keep / skip / blocked 计数 |
| `files` | 每个文件角色和相对路径 |
| `backupRequired` | 是否需要备份 |
| `blocked` | 是否存在阻断项 |
| `checks` | 写入后要运行的检查 |

diff approval 中存在 `blocked` 时不能写入。

用户确认应明确：

```text
确认本次 transaction preview，可以写入 Archive Music entry <entry-id>
```

## 11. Backup gate

update 或任何覆盖写入必须先通过 backup gate。

backup gate 要求：

- 覆盖项数量与 backup manifest 项数一致；
- backup 文件已写入；
- backup checksum 可读取；
- backup manifest transaction id 与 write transaction id 一致；
- backup manifest 不包含完整本机路径；
- backup 失败时停止，不写目标。

create 模式如果完全不覆盖，可允许 backup manifest 为空。

## 12. Write gate

真实写入只能在以下条件都满足时执行：

- payload gate 通过；
- diff approval 通过；
- backup gate 通过；
- 用户明确确认；
- 写入 scope 在 `entries/music/album/<entry-id>/` 内；
- staging 文件已生成；
- staging checksum 已计算；
- 未运行 `build_archive.py`；
- 未修改 `public/data`。

真实写入后必须保存 write manifest。

write manifest 必须记录：

- transaction id；
- mode；
- entry id；
- 每个实际创建或覆盖的相对路径；
- role；
- operation；
- checksum；
- bytes；
- checks 结果；
- rollback 指引。

## 13. 写入后验收

真实写入后必须按顺序运行：

```powershell
node scripts/check-archive-data-v2-music-shape.mjs
node scripts/generate-archive-data-v2-music-live-compatible-preview.mjs
node scripts/check-generated-data-privacy.mjs
```

说明：

- `check-archive-data-v2-music-shape` 验证 v2 Music 输出结构；
- live-compatible preview 只写系统临时目录，不替换 `public/data/music.json`；
- privacy 检查用于确认派生 JSON 边界仍无本机路径或 secret-like marker。

如果后续要替换 `public/data/music.json`，必须进入单独任务。

## 14. 失败处理

失败时按阶段处理：

| 阶段 | 处理 |
|---|---|
| payload gate 失败 | 不写目标，返回 errors |
| diff approval 失败 | 不写目标，停止 |
| backup gate 失败 | 不写目标，停止 |
| staging 失败 | 删除 staging，停止 |
| apply write 部分失败 | 保存 partial manifest，提示 rollback |
| v2 shape 检查失败 | 不自动修复，用户决定 rollback 或保留 |
| live-compatible preview 失败 | 不替换 public/data，保留 write manifest |

任何失败都不得自动修改 OneDrive Data、`public/data` 或 Git。

## 15. Rollback gate

rollback 必须是显式动作。

执行 rollback 前必须确认：

- write manifest 存在；
- backup manifest 存在或 create 模式无覆盖；
- transaction id 一致；
- rollback 目标只包含 manifest 中记录的文件；
- 不删除整个 `entries/music/album`；
- 不修改 OneDrive Data；
- 不修改 `public/data`。

rollback 后必须运行：

```powershell
node scripts/check-archive-data-v2-music-shape.mjs
```

如果 rollback 后检查失败，只报告问题，不自动二次修复。

## 16. 推荐第一轮真实写入试点

第一轮真实写入不建议直接更新已有 33 个迁移条目。

推荐顺序：

1. 选择一个全新的测试 entry id；
2. mode 使用 `create`；
3. 写入真实 Archive Music 输出；
4. 验收通过后立即执行 rollback；
5. 验证 rollback 后 v2 Music shape 仍通过；
6. 再决定是否允许保留测试 entry 或进入 update 试点。

这样可以验证真实目录 allowlist、manifest、backup/rollback 机制，而不影响已有 Music 试点数据。

## 17. 下一步实现边界

下一步只建议实现真实 v2 Music 写入 gate checker。

该 checker 应只读：

- payload；
-真实 Archive Music 输出；
- 目标 entry 文件状态；
- 现有检查脚本输出。

该 checker 输出：

- payload gate 结果；
- diff approval 摘要；
- backup gate 需求；
- 是否允许进入真实写入。

该 checker 不应：

- 写真实 Archive；
- 写 OneDrive Data；
- 写 `public/data`；
- 运行 `build_archive.py`；
- 执行 Git 操作。

## 18. 验收标准

本设计完成的标准：

- [x] 明确真实写入必须单独授权。
- [x] 明确只允许 `music/album` 单 entry。
- [x] 明确允许和禁止范围。
- [x] 明确 payload / diff / backup / write / rollback gates。
- [x] 明确写入前基线和写入后验收。
- [x] 明确第一轮真实写入仍应先做 gate checker，不直接写数据。
- [x] 未写真实 Archive、OneDrive Data、`public/data` 或 `src/data`。

## 19. 下一步建议

下一步只建议实现只读的真实 v2 Music 写入 gate checker：读取 payload 和真实 v2 Music 当前状态，输出是否允许进入真实写入；仍不执行真实写入。
