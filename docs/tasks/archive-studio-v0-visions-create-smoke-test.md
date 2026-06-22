# Archive Studio Visions Create + Rollback Smoke Test

创建日期：2026-06-20
状态：真实 API create + rollback 已通过

## 目标

通过真实本机 Archive Studio API，在 Archive 中临时创建一个 `visions/movie`，运行 Visions v2 检查，再根据事务回退清单删除临时条目与事务文件。

## 边界

- 只写一个唯一临时 Visions movie 和对应事务目录；
- 测试 poster 使用仓库内已有的通用 Visions 图标；
- 旧 OneDrive Data 全程只读，并比较前后文件快照；
- 不运行 `build_archive.py`；
- 不生成或修改 `public/data`；
- 不发布，不执行 Git push；
- 不保留 smoke test 条目。

## 安全门槛

- 默认运行只输出计划，写入范围为 `none`；
- 真实执行需要 `--execute` 与精确授权短语；
- 执行前要求真实 Visions v2 基线恰好为 112 个条目、20 个 showcase 角色；
- 必须依次通过真实 API preview、preflight、一次性 token create 与写后 shape check；
- create 后必须为 113 个条目，且发布未触发；
- rollback 必须读取本次事务的 `rollback.json`；
- 回退后必须恢复为 112 个条目，条目与事务残留均为 0；
- 回退后 Archive 与旧源文件快照必须和执行前一致。

## 验证

```powershell
node scripts/run-archive-studio-v0-visions-create-smoke-test.mjs
node scripts/run-archive-studio-v0-visions-create-smoke-test.mjs --execute --authorization "I authorize Archive Studio Visions create rollback smoke test"
node scripts/check-archive-data-v2-visions-shape.mjs
```

输出只包含文件数量、条目数量、回退状态与边界检查结果，不输出收藏正文或完整本机路径。

## 回退

runner 在 `finally` 阶段关闭临时 API 服务，读取本次事务 `rollback.json`，删除其列出的两个条目文件、空条目目录和事务目录。任何条目、事务、shape、旧源或 Archive 快照残留都视为失败并停止后续任务。

## 执行结果

- 真实 API preview、preflight、一次性 token create 与写后 Visions shape check 通过；
- 临时 movie 创建 2 个条目文件和 3 个事务文件，条目数由 112 变为 113；
- 回退后恢复为 112，临时条目残留 0、事务残留 0；
- Archive 文件快照恢复一致；
- 旧源侧核对 778 个文件，前后无变化；
- 发布未触发，未运行 `build_archive.py`，未修改 `public/data`。

## UI 验收边界

- `/studio/visions` 中文页面、movie / series 切换、字段校验、缺 poster 阻断、API 在线状态、桌面与 390px 移动布局已验收；
- 当前内置浏览器测试接口不能注入本地文件选择，因此真实 multipart create 由页面使用的同一 API 路由完成；
- 没有为测试加入文件选择后门或绕过 preflight gate。
