# 任务：ArchiveData-v2 Texts 受控迁移

创建日期：2026-06-20
状态：已完成

## 1. 目标

把旧 Texts 只读迁移为 ArchiveData-v2 Texts，不覆盖 Music，不修改旧 OneDrive Data，不生成 live JSON。

## 2. 写入范围

只允许创建：

- `ArchiveData-v2/entries/texts/`；
- `ArchiveData-v2/config/texts-sections.yaml`；
- `ArchiveData-v2/migration/texts/`。

任一目标已存在时拒绝执行。

## 3. 安全流程

1. 重新运行只读 planner；
2. 对旧 Texts 187 个文件建立内存 SHA-256 基线；
3. 在系统临时目录生成完整 v2 Texts；
4. 在临时目录运行 Texts v2 shape checker；
5. 通过后复制到 ArchiveData-v2 的限定范围；
6. 在真实 v2 运行 shape checker；
7. 对比旧 Texts 前后 SHA-256；
8. 任一步失败，只删除本轮三个 Texts 目标。

## 4. 执行 gate

默认仅计划：

```powershell
node scripts/migrate-archive-data-v2-texts.mjs
```

真实执行同时要求：

```powershell
node scripts/migrate-archive-data-v2-texts.mjs --execute --authorization "I authorize ArchiveData-v2 Texts migration"
```

## 5. 禁止

- 不修改、移动、删除旧 Texts；
- 不修改 Music v2；
- 不运行 `build_archive.py`；
- 不修改 `public/data`、`src/data`、缓存或 reports；
- 不运行发布脚本或 Git push；
- 不输出标题清单、正文、完整路径或 checksum。

## 6. 验收

- entries 132；
- article 15、book_note 54、series_note 63；
- entry YAML 132、content 132、cover 54；
- manifest 187、unmapped 0；
- malformed 0、privacy hit 0；
- 源 changed 0、missing 0；
- Music v2 shape 继续通过。

## 7. 回退

只删除：

- `ArchiveData-v2/entries/texts/`；
- `ArchiveData-v2/config/texts-sections.yaml`；
- `ArchiveData-v2/migration/texts/`。

不删除 ArchiveData-v2 根目录、Music、其他 config 或其他 migration 记录。

## 8. 执行结果

最终受控迁移通过：

- entries 132；
- article 15、book_note 54、series_note 63；
- entry YAML 132、content 132、cover 54；
- manifest 187、unmapped 0；
- malformed 0、invalid id 0；
- section-kind mismatch 0、日期策略错误 0；
- privacy hit 0；
- 旧 Texts baseline 187，changed 0、missing 0；
- Music v2 检查继续通过；
- 未运行 `build_archive.py`，未运行发布。

第一次真实复制在最终 shape 阶段停止并触发回退。OneDrive 同步客户端短暂恢复了刚删除的生成配置文件，暴露出同步竞态。处理方式：

- 回退增加删除后存在性复核和重试；
- 写入后增加稳定等待；
- 增加显式 `--resume-identical-residuals`；
- 恢复模式只接受与本次 staging checksum 完全一致的残留；
- 任意额外或不同文件仍阻断；
- 复制改为逐文件幂等校验。

最终恢复执行通过，三个 Texts 目标均为本次生成结果，没有覆盖非本次文件。
