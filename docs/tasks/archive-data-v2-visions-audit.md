# Archive Visions 只读审计

创建日期：2026-06-20
状态：已完成

## 目标

只读确认旧 Visions 的分组、海报、`meta.yaml`、角色橱窗、当前 live JSON 和前端依赖，为 Archive Visions 规则设计提供事实基线。

## 边界

- 只读旧 OneDrive Data；
- 不修改海报、GIF、头像或 YAML；
- 不运行 `build_archive.py`；
- 不修改 `public/data/visions.json`；
- 不创建 Archive Visions 输出；
- 不接入 Archive Studio 写入；
- 不发布。

## 已检查

- `[OneDrive Data]/Visions` 的 5 个普通分组和角色橱窗；
- 6 份 `meta.yaml`；
- 111 张普通海报；
- 20 个角色、20 个 GIF 和 20 个头像；
- `build_archive.py` 的 Visions 元数据、showcase 和 live JSON 生成逻辑；
- `public/data/visions.json` 的聚合形状；
- `src/pages/Visions.tsx` 与 `src/types.ts` 的字段依赖。

## 结构结论

### 普通影视条目

- 5 个分组：`开端`、`前尘`、`旧影`、`未远`、`此岸`；
- 每个分组包含海报和一份 `meta.yaml`；
- 图片文件名提供 title；
- 每个元数据条目都维护 `url`、`quote`、`cinema`、`type`；
- 111 张海报与 111 个元数据条目一一匹配；
- orphan metadata、缺元数据图片和 YAML 基础解析错误均为 0；
- 源 `type` 为 movie 71、tv 40；
- `cinema` 为 true 27、false 84。

这些分组不是自然年份。生成器把分组映射成 2017、2020、2023、2025、2026，仅用于当前时间线排序和前端标题映射。v2 应保存稳定 `period`，不要把合成年份当作收藏事实。

### 角色橱窗

- 角色橱窗是独立专题，不是普通影视条目；
- 顶层维护 title、description；
- 20 个角色都维护 gif、avatar、caption；
- 20 个 GIF 与 20 个头像引用全部存在；
- 生成器为每个角色输出 id、title、caption、gif_path、avatar_path。

## 已确认风险

### 全局标题覆盖

有 2 个标题跨分组重复。旧生成器先把所有 `meta.yaml` 合并成只以 title 为键的全局字典，因此后分组同名条目会覆盖前分组元数据。

当前结果是：

- 标准源 YAML：movie 71、tv 40；
- 当前 live JSON：movie 69、tv 42；
- 2 个前分组条目的 `quote`、`url`、`type` 被同名后分组条目覆盖；
- 共 6 个字段差异：quote 2、url 2、type 2，cinema 0。

迁移器必须按 `period + source relative path` 关联海报和元数据，不能全局按标题匹配。live-compatible 生成阶段需要单独决定是保留当前 live 行为，还是以源 YAML 修正类型。

### 不稳定 live ID

111 个普通条目当前全部使用 `type_year_index` 位置型 ID。新增、删除、改变 type 或排序都可能改变后续 ID，不适合作为 v2 稳定 ID。

### type 与 kind 语义

旧源只有 `movie` 和 `tv`。当前前端也只筛选这两个值；通用 v2 文档预留的是 `movie` 和 `series`。需要明确：

- v2 kind 是否使用 `movie / series`；
- legacy `type: tv` 是否只在兼容输出层恢复；
- 动画与真人剧是否继续合并为 series，不在 v1 增加第三种 kind。

## 前端硬依赖

普通条目：

- `id`、`image_path`、`title`；
- `cinema` 控制院线标记与排序；
- `quote` 用于 hover 短句；
- `url` 用作外链；
- `type` 控制图标、筛选和 movie 优先排序。

聚合：

- `years[].year`、`years[].folder`、`years[].items`；
- `total_count`；
- `showcase.entries`。

角色：

- `id`、`title`、`gif_path`、`avatar_path`；
- `caption` 当前进入数据契约，但页面暂未显示。

## 验证

```powershell
node scripts/audit-archive-data-v2-visions.mjs
node scripts/check-source-data-shape.mjs
node scripts/check-public-data-shape.mjs
```

审计脚本只输出数量、字段和风险类别，不输出标题清单或完整本机路径。

## 回退

删除本任务文档和 `scripts/audit-archive-data-v2-visions.mjs`，再回退状态文档中的本轮记录即可。旧源和派生数据没有被修改。
