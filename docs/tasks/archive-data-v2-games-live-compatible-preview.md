# Archive Games Live-Compatible Preview

创建日期：2026-06-20
状态：隔离 preview 已通过

## 目标

从 Games v2 在系统临时目录生成当前前端可读取的 `games.json`，证明能够保持 live ID、媒体路径、年份/条目/赛季顺序和首页引用边界。

## 边界

- 只读 Archive Games；
- 只读当前 `public/data/games.json` 和 `home.json`；
- 只写系统临时 preview；
- 不修改 public JSON、缓存、reports 或旧 OneDrive Data；
- 不运行 `build_archive.py`；
- 不发布。

## 兼容策略

- normal_game / dlc 使用 kind + year + title 映射；
- live_game 使用 stable kind + title 映射；
- season 在各自父条目内按 title 唯一映射；
- 复用当前 282 个 live ID、282 个顶层媒体路径和 40 个 season 媒体路径；
- 保持年份、条目和 season 顺序；
- 2010 / 2015 的 Steam 搜索 URL与默认 platform 只从当前 live 兼容继承，不写回 v2；
- live parent 的缺封面回退继续复用当前 public 媒体路径；
- 首页只做 9 项引用差异统计，不修改 `home.json`。

## 验证

```powershell
node scripts/generate-archive-data-v2-games-live-compatible-preview.mjs
```

必须报告：282/282 映射、40/40 season、缺失 0、ID/媒体复用、字段差异、顺序差异、首页差异和隐私命中。

## 回退

删除系统临时 preview 目录即可。当前 public JSON 不会被修改。

## 验证结果

- v2 / live / preview 均为 282 个顶层条目；
- 282/282 映射，40/40 season 映射，required missing 0；
- 282 个 live ID、282 个顶层媒体路径、40 个 season 媒体路径全部复用；
- 字段、年份顺序、条目顺序、媒体路径差异均为 0；
- 首页 9 项 missing 0、字段差异 0；
- 隐私命中 0；
- `public/data/games.json` 与 `home.json` 均未修改。
