# Archive Studio 新建游戏赛季

## 目标

为现有 `games/live_game` 父条目增加轻量的赛季新建流程：选择父游戏、填写赛季字段、选择封面、受控写入 Archive，并通过现有同步入口更新本地公开网页。

## 范围

- 只新建 `live_game/seasons/<season-id>/season.yaml + cover.<ext>`；
- 只允许选择 Archive 中已经存在且已同步到本地公开网页的 `live_game`；
- 系统生成稳定格式的 season ID，并根据现有赛季建议下一个顺序值；
- 表单只显示父游戏现有赛季实际使用的扩展字段；
- 写入经过 preview、preflight token、结构检查、旧 Data 只读边界检查和事务回退；
- 保存后建立待同步标记，由现有“同步到网页”按钮更新 `public/data/games.json` 和赛季封面派生文件。

## 不做

- 不创建或修改 `live_game` 父条目；
- 不编辑、删除或重排已有赛季；
- 不修改旧 OneDrive Data；
- 不运行 `build_archive.py`；
- 不自动发布或推送；
- 不自动生成标题、标签、说明或素材。

## 验证

1. 临时 Archive 沙箱中完成 season preview、preflight、create 和 rollback 失败保护测试；
2. Games v2 结构检查在新增前后通过，赛季数量只增加 1；
3. 旧 Data 元数据摘要保持不变；
4. 公开同步预览只替换对应 live game，并只新增该赛季封面；
5. TypeScript 检查和 Studio 桌面、移动端浏览器流程通过。

## 回退

创建失败时删除本次新建的 `season.yaml`、封面、空目录、待同步标记和不完整事务目录。同步失败时恢复原 `games.json`，并删除本次新建的公开媒体文件。

## 后续修正

- 2026-08-25：修复服务端把赛季总数固定为 40 的过期基线问题。
- 正式 Studio 现在会在每次 Games 预检和检查时只读计算 Archive 当前 `season.yaml` 数量；新增赛季后，下一次预检自动使用新的数量。
- 临时测试仍可显式指定预期赛季数，保留固定夹具的严格校验。
- 已在 41 个既有赛季的真实环境中确认下一赛季预检通过，未执行真实创建。
