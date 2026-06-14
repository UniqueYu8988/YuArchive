# reports

`reports` 保存脚本生成或人工辅助整理的扫描、维护参考和历史记录。

本目录不是权威源数据，也不是当前任务清单。权威源数据仍是：

```text
C:\Users\Yu\OneDrive\图片\Data
```

当前前端读取的分类数据入口仍是项目内的派生 JSON：

```text
public/data/*.json
```

## 使用边界

- `reports` 中的 CSV、Markdown 和缓存文件只能作为辅助参考，可能过期。
- 收藏标题、分类、评分和展示描述是网页展示资产，不按高敏感信息处理；但不要根据 `reports` 直接改写真实收藏内容、笔记或媒体选择。
- 不要把 `reports` 当成 OneDrive Data 的替代备份。
- `steam_lookup_cache.json` 可能被 `build_archive.py` 读取，不要随意移动、删除或重命名。
- `games_meta_inventory.csv`、`games_meta_todo.csv`、`games_meta_todo.md`、`games_missing_english.csv` 是辅助/派生报告，不是源数据。

任何根据 `reports` 修改 OneDrive 源数据的行为，都必须单独立任务，先确认备份，再预览差异，最后由用户明确确认。
