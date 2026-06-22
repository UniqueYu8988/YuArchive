# Archive Studio 公开网页同步

## 目标

为 Music、Texts、Visions、Games 四个 Archive Studio 新建流程补充显式公开同步能力。条目先保存到 Archive，再由用户检查待同步数量并确认更新对应的 `public/data/*.json` 和公开媒体副本。

## 边界

- 只读取 Archive 和当前公开 JSON。
- 只写对应板块的 `public/data/<board>.json` 与 `public/studio_media/<board>/`。
- 不修改旧 OneDrive Data，不运行 `build_archive.py`，不修改首页精选，不发布、不提交、不推送。
- 只处理 v2 中存在、当前公开 JSON 尚未包含的新条目；不借同步流程批量重写已有条目。

## 安全机制

- 同步前必须生成 preview，并取得短时、一次性 token。
- apply 时重新计算计划并核对摘要，避免预览后数据漂移。
- 目标媒体文件禁止覆盖；JSON 使用临时文件替换。
- 任一步失败时恢复原 JSON，并删除本次已复制的媒体。
- 输出只包含板块、数量和相对路径，不返回本机绝对路径。

## 验证

- 四板块同步 preview 能识别 v2 与公开 JSON 的数量差。
- 临时目录集成测试覆盖 preview、apply、重复同步和失败回退。
- `node scripts/check-public-data-shape.mjs` 与 `node scripts/check-generated-data-privacy.mjs` 通过。
- TypeScript 构建通过，浏览器确认同步面板状态和操作文案。

实际结果：四板块临时目录 preview/apply/current 与错误 token 自检通过；Games 已完成一次真实同步，公开总数从 282 更新为 283，新媒体已在公开页面 DOM 中渲染。Texts、Visions 当前一致，Music 保留 1 条待用户选择是否同步。同步后 JSON 读取改为 `no-cache` 重新验证，并由“查看公开页面”附加刷新标记。

## 回退

代码可按本任务涉及文件回退。真实同步失败由事务逻辑自动恢复；已成功同步的数据若需撤回，应另立任务按 Git diff 和对应 v2 条目明确处理，不直接删除旧源数据。
