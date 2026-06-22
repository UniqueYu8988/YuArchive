# 任务：Archive Texts live-compatible 隔离预览

创建日期：2026-06-20
状态：已完成

## 1. 目标

从 Texts v2 生成与当前前端 `TextsCategory` 兼容的 `texts.json` 预览，只写系统临时目录，不修改 live 数据。

## 2. 映射策略

- 使用 title、section、date 和 content 的组合 fingerprint 映射 v2 与 live；
- 组合 fingerprint 解决当前同名标题；
- 复用当前 live id 和条目顺序；
- 复用当前书架 cover public path；
- `entry.yaml` 提供 title、date、section、author、summary、tags；
- `content.md` 提供 content；
- 兼容层暂时复用 live excerpt；
- v2 栏目配置提供 title、description、icon；
- live 栏目提供现有 showcase public paths。

## 3. 验收

- v2 132、live 132、mapped 132；
- unmapped / ambiguous 0；
- reused live id 132；
- reused cover path 54；
- item 和 section 顺序差异 0；
- 必需字段缺失 0；
- 隐私命中 0；
- `public/data/texts.json` 未修改。

## 4. 验证

```powershell
node scripts/generate-archive-data-v2-texts-live-compatible-preview.mjs
node scripts/check-archive-data-v2-texts-shape.mjs
node scripts/check-public-data-shape.mjs
```

## 5. 回退

删除系统临时 preview 和本任务脚本/文档；不涉及 live 或源数据回退。

## 6. 验证结果

- v2 entries 132、live items 132、mapped 132；
- unmapped live 0、unmapped v2 0、ambiguous 0；
- reused live id 132、cover public path 54；
- 必需字段缺失 0；
- item field difference 0；
- item order difference 0、section order difference 0；
- privacy hit 0；
- preview 与当前 live JSON 深度结构相等；
- `public/data/texts.json` 未修改。

因为 preview 与 live 深度相等，本阶段无需执行一次无意义的 live JSON 替换。后续新建条目加入 v2 后，再设计增量条目和新封面的公开媒体输出。
