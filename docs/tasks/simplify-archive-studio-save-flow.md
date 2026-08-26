# 简化 Archive Studio 保存流程

## 目标

- 修复新建成功后表单、素材和条目 ID 仍停留在上一条目的问题。
- 创建成功后自动进入一张全新草稿，并保留刚才的成功结果供确认。
- 新建模式允许调整系统建议的条目 ID；修改模式继续锁定原 ID。
- 移除底部“生成预览”和“运行预检”两个手动步骤。
- “创建条目 / 保存修改”在后台依次执行 preview、preflight 和 apply。

## 安全边界

- 不绕过 preview、preflight、一次性 token、写后检查或 rollback。
- 不改变 API、Archive 文件结构、公开 JSON 同步或发布流程。
- 不修改 Archive、旧 Data、缓存、reports 或生成器。

## 验证

- 四板块新建按钮均会自动完成 preview 与 preflight。
- 表单不完整时不写入，并显示原有校验结果。
- 新建成功后表单和素材清空，条目 ID 更新为新草稿 ID。
- 修改模式保留当前条目 ID，不允许改名。
- TypeScript、Studio 临时目录事务检查和浏览器流程通过。

## 实施结果

- Music、Texts、Visions、Games 底部均只保留“重置”和“创建条目 / 保存修改”。
- 单次保存会依次调用原 preview、preflight 和 apply 接口；任何一步失败都会停止，不会继续写入。
- 四板块新建模式的条目 ID 均可调整，修改模式继续只读锁定。
- 新建成功后立即清空表单与素材，并生成下一张草稿的条目 ID；成功摘要和写后结构检查结果仍保留。
- 空表单浏览器验证会被前端校验阻断，未触发写入。
- `npx tsc --noEmit` 与 `node scripts/check-archive-studio-updates.mjs` 通过。

## 回退

- 回退四个 Archive Studio 页面中的合并保存流程和按钮调整。
- 本任务不改变数据格式，不需要迁移或回退现有条目。
