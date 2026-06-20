# ArchiveData-v2 Visions Live-Compatible Preview

创建日期：2026-06-20
状态：隔离预览已通过

## 目标

从 Visions v2 生成当前前端可直接读取的 `visions.json` 隔离预览，不修改 live JSON。

## 兼容策略

- 复用当前普通条目 live ID；
- 复用当前 `webp_cache` poster 路径；
- `kind: movie` 输出 `type: movie`；
- `kind: series` 输出 `type: tv`；
- period 映射为当前 folder 与 synthetic year；
- 保持当前 period 和条目顺序；
- 角色按 v2 `character_order` 输出；
- 复用当前角色 ID、gif_path 和 avatar_path；
- 以源 YAML 修正 2 个旧全局标题覆盖造成的 quote、url、type 偏移。

## 验收

```powershell
node scripts/generate-archive-data-v2-visions-live-compatible-preview.mjs
```

要求：

- 普通条目 111/111；
- 角色 20/20；
- missing mapping 0；
- live ID、poster、角色媒体路径全部复用；
- period / 条目 / 角色顺序差异 0；
- 预期 source metadata correction entry 2；
- item field differences 恰好为 6：quote 2、url 2、type 2；
- privacy hit 0；
- `public/data/visions.json` 未修改。

## 回退

预览只写系统临时目录。删除生成器和本任务文档即可，不需要恢复仓库数据或源数据。

## 验证结果

- 普通条目 111/111，角色 20/20；
- missing mapping 0；
- live ID、poster、角色 ID、GIF 和 avatar 路径全部复用；
- period、条目和角色顺序差异 0；
- source metadata correction entries 2；
- item field differences 6：quote 2、url 2、type 2、cinema 0；
- showcase field differences 0；
- privacy hit 0；
- `public/data/visions.json` 未修改。
