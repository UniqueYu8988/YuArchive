# 任务：Archive Studio v0 真实 v2 Music create 写入试点执行前检查清单

创建日期：2026-06-17
状态：已完成

## 1. 目标

在执行任何真实 Archive Music create 写入前，建立一份可复核的 preflight checklist。

本任务只做执行前清单，不执行真实写入，不创建真实 entry，不修改 Archive、OneDrive Data、`public/data` 或 Git 状态。

## 2. 本次范围

- 明确真实 create 写入试点的授权文本。
- 明确试点只能创建 1 个新的 `music/album` entry。
- 明确执行前必须通过的只读 gate、dry-run manifest 和现有结构检查。
- 明确阻断条件、成功标准和失败处理。
- 明确第一轮仍应先实现自动化 preflight checker，再进入真实写入。

## 3. 明确不做

- 不写真实 Archive 输出。
- 不修改旧 OneDrive Data。
- 不修改 `public/data`、`src/data`、缓存或 reports。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不接 Archive Studio UI。
- 不执行真实 backup、write 或 rollback。
- 不执行 Git 操作。

## 4. 试点授权要求

真实 create 写入试点必须由用户单独授权。授权文本至少应包含：

```text
授权执行 Archive Studio v0 真实 v2 Music create 写入试点，只允许写 Archive/entries/music/album/<entry-id>，只创建一个新测试 entry，不修改 OneDrive Data、不修改 public/data、不运行 build_archive.py、不发布。
```

如果授权缺少以下任一项，应停止：

- mode: `create`
- board: `music`
- kind: `album`
- entry id
- 写入范围只限单个 entry 目录
- 不修改 OneDrive Data
- 不修改 `public/data`
- 不运行 `build_archive.py`
- 不发布

## 5. 推荐试点 entry

第一轮建议使用一个明确为 smoke test 的新 id，例如：

```text
archive-studio-real-write-smoke-test
```

要求：

- id 必须是安全 slug；
- 目标目录当前必须不存在；
- payload 中只使用项目内样例或用户明确提供的素材引用；
- 不覆盖现有 33 个 Music 迁移条目；
- 不作为正式收藏条目进入公开网页。

## 6. 执行前 checklist

执行真实 create 写入前，按顺序完成：

1. 确认 Git 状态，记录是否有未提交变更。
2. 确认真实 Archive Music 输出目录存在。
3. 确认目标 entry 目录不存在。
4. 确认 payload 通过 preview core 校验。
5. 运行只读 gate checker，确认 `allowedToRequestWrite` 为 true。
6. 运行 dry-run manifest，确认计划写入项数量符合预期，backup 项数量为 0。
7. 运行 v2 Music shape 检查，确认当前基线通过。
8. 运行 transaction sandbox 自检，确认事务模型仍通过。
9. 确认不需要运行 `build_archive.py`。
10. 确认不需要修改 `public/data/music.json`。
11. 确认 rollback 策略：create 失败或试点结束时，只删除 manifest 记录范围内创建的文件。

## 7. 推荐命令

只读 preflight 阶段可运行：

```powershell
git status --short --branch
node scripts/check-archive-studio-v0-real-write-gate.mjs
node scripts/dry-run-archive-studio-v0-real-write-manifest.mjs
node scripts/check-archive-data-v2-music-shape.mjs
node scripts/check-archive-studio-v0-transaction-sandbox.mjs
```

如果使用非默认 payload，应把同一个 payload 显式传给 gate checker 和 dry-run manifest：

```powershell
node scripts/check-archive-studio-v0-real-write-gate.mjs <project-local-payload.json>
node scripts/dry-run-archive-studio-v0-real-write-manifest.mjs <project-local-payload.json>
```

输出只应使用摘要、计数、相对路径和规则名，不输出完整本机路径、密钥、token 或正文。

## 8. 阻断条件

出现任一情况时，不得进入真实写入：

| 条件 | 处理 |
|---|---|
| 用户授权缺失或范围不清 | 停止，要求补充授权 |
| payload 不在项目内或不是 JSON | 停止 |
| payload 校验失败 | 停止 |
| mode 不是 `create` | 停止 |
| board/kind 不是 `music/album` | 停止 |
| 目标 entry 已存在 | 停止，不覆盖 |
| gate checker blocked | 停止 |
| dry-run manifest 状态为 `needs_review` | 停止 |
| dry-run 计划写入范围超出单 entry | 停止 |
| v2 Music shape 检查失败 | 停止 |
| transaction sandbox 自检失败 | 停止 |
| Git 状态存在不明变更 | 先解释范围，再决定是否继续 |
| 需要运行 `build_archive.py` 才能继续 | 停止，另立任务 |
| 需要修改 `public/data` 才能继续 | 停止，另立任务 |

## 9. 成功标准

preflight 通过只表示可以请求进入真实写入任务，不等于已经允许写入。

preflight 成功应满足：

- 用户授权完整；
- payload create 意图明确；
- 目标 entry 不存在；
- gate checker 允许请求写入；
- dry-run manifest 计划 1 个 entry scope 内的写入；
- create 模式 backup 项为 0；
- v2 Music shape 当前通过；
- transaction sandbox 自检通过；
- 未运行 `build_archive.py`；
- 未修改 OneDrive Data、`public/data` 或 `src/data`；
- 未执行发布。

## 10. 真实写入任务的执行边界

preflight 通过后，下一轮真实写入任务仍必须单独声明：

- 要写入的 payload；
- 要创建的 entry id；
- 写入前基线；
- 实际写入文件角色；
- write manifest 位置；
- rollback 方式；
- 写入后检查命令；
- 是否保留或删除 smoke test entry。

真实写入任务不应顺手替换 `public/data/music.json`。如果需要让公开网页展示新 entry，应另立 live-compatible 生成和替换任务。

## 11. 回退方式

本清单是 Markdown 文档，回退方式：

- 删除本任务文档；
- 回退 `CURRENT_STATE.md` 和 `docs/plans/STABILIZATION_PLAN.md` 中对应状态记录。

由于本任务不执行真实写入，不涉及数据回滚。

## 12. 下一步建议

下一步只建议实现一个只读 preflight checker，把本清单中的关键条件自动化为摘要检查。

该 checker 仍不应写真实 Archive 输出，不应修改 OneDrive Data，不应修改 `public/data`，不应运行 `build_archive.py`。
