# ArchiveData-v2 Games Migration Planner

创建日期：2026-06-20
状态：只读 planner 已建立

## 目标

在内存中把旧 Games 的普通游戏、DLC、live game 和 season 映射到 Games v2 文件角色，验证稳定 ID、DLC 父关联、源文件覆盖和隐私边界。

## 边界

- 只读旧 OneDrive Data；
- 只读当前项目代码和 live JSON；
- 不创建 ArchiveData-v2 Games；
- 不写 manifest、entry、season、config 或媒体；
- 不运行 `build_archive.py`；
- 不修改 public JSON、缓存或 reports；
- 不发布。

## 计划规则

- 279 个年份图片映射为 273 个 normal_game 与 6 个 DLC；
- 3 份 Game-Live YAML 映射为 3 个 live_game；
- 40 个赛季图片和元数据映射为 40 个稳定 season；
- 6 个 DLC 都必须唯一关联父 game，其中 3 个记录为 inferred parent；
- 2010 / 2015 的 93 个条目保持 metadata_enabled false；
- 2 个独立 live parent cover 复制，缺失父封面不伪造；
- 329 个旧源文件必须全部进入覆盖清单；
- 所有目标路径只能位于 `entries/games`、`config/games.yaml` 和 `migration/games`。

## 验证

```powershell
node scripts/plan-archive-data-v2-games-migration.mjs
```

脚本只输出数量、角色、关联和错误计数，不输出收藏标题、评分、路径明细或正文。

## 回退

删除 planner、core 和本任务文档即可。脚本没有写入行为，不产生外部残留。
