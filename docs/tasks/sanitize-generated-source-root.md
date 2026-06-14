# Sanitize Generated Source Root

本任务设计用于处理 `build_archive.py` 生成聚合 JSON 时写入 `metadata.source_root` 的本机路径问题。本轮只做只读定位和方案设计，不修改代码、数据、脚本或 Git 状态。

## 已定位生成逻辑

`metadata.source_root` 在 `build_archive.py` 的 `main()` 中生成：

- 脚本先构造 `categories`，包含 `games`、`visions`、`music`、`texts`。
- 随后构造聚合对象 `data`。
- `data.metadata.source_root` 当前由 `ONEDRIVE_DATA_ROOT` 转成字符串得到。
- `data` 最终写入 `JSON_OUTPUT_PATH`，即 `src/data/archive_data.json`。

本文件不记录本机路径原文。

## 影响范围判断

只读检查显示：

- `src/data/archive_data.json` 顶层包含 `metadata` 和 `categories`。
- `metadata` 中包含 `source_root`。
- `src/data/site_config.json` 顶层只包含站点配置相关字段，不包含 `source_root`。
- `public/data/home.json` 顶层是首页 payload，不包含聚合 metadata。
- `public/data/games.json`、`visions.json`、`music.json`、`texts.json` 由各分类 payload 单独写出，不直接包含聚合 `data.metadata`。

因此，当前 `metadata.source_root` 的直接影响范围应是 `src/data/archive_data.json`。公开网页目前主要读取 `public/data/*.json`，未发现生产前端直接读取 `src/data/archive_data.json`。

## 方案比较

| 方案 | 内容 | 优点 | 风险 | 验证重点 |
|---|---|---|---|---|
| A | 移除 `metadata.source_root` 字段 | 最小化泄露面；不会再生成本机路径字段 | 若有隐藏工具依赖该字段，会失去来源提示 | 搜索引用；生成后确认字段不存在；前端数据检查通过 |
| B | 改成固定占位符 | 保留字段形状，避免隐藏依赖因字段缺失失败 | 字段仍表示“有源信息”，语义较弱；需选择不会触发隐私规则的占位符 | 隐私检查通过；字段存在但不含本机信息 |
| C | 改成相对标识 | 保留“来源类型”语义，如表示来自本地源目录 | 若标识设计不清，后续维护者可能误解为真实路径 | 隐私检查通过；文档说明含义 |
| D | 改成不含本机路径的 source label | 保留来源说明，例如表明是 OneDrive 源数据的抽象标签 | 如果 label 包含被隐私规则扫描的敏感片段，仍可能触发检查；命名需谨慎 | 隐私检查通过；不包含本机路径或 OneDrive 字样 |

## 推荐方案

推荐下一步采用方案 B 或 C 的小步版本：保留 `source_root` 字段，但将值改为不含本机路径、不含 OneDrive 字样、不含源目录名称的固定非敏感标识。

推荐理由：

- 比直接删除字段更保守，避免潜在隐藏依赖因字段缺失失败。
- 比保留真实路径安全。
- 改动点集中在 `build_archive.py` 中构造 `data.metadata` 的一行。
- 验证方式清晰：重新生成后运行隐私检查，字段不应再触发本机路径或源路径规则。

建议标识示例应在实施任务中再确定，要求是 ASCII、短字符串、不包含本机路径、OneDrive、源数据目录名称或真实个人信息。

## 实施记录

- 已最小修改 `build_archive.py`：只替换 `metadata.source_root` 的生成值，保留字段存在。
- `git diff --numstat -- build_archive.py` 显示 1 行新增、1 行删除。
- 已受控运行 `python -X utf8 build_archive.py`，退出码为 0。
- 运行后检查 `src/data/archive_data.json`，`metadata.source_root` 已为非敏感固定标识；未输出完整 JSON。
- 运行前后对 OneDrive Data 中 YAML/YML/MD 文件做哈希比较，变化数量为 0。
- 已运行 `node scripts/check-public-data-shape.mjs`，通过。
- 已运行 `node scripts/check-generated-data-privacy.mjs`，通过。
- 生成脚本更新了派生输出；本轮未手工修改派生 JSON。
- 本轮未运行发布脚本，未执行 `git add`、`git commit`、`git push`。

## 为什么此前规划阶段不直接修改

- `build_archive.py` 是高风险生成脚本，会读取 OneDrive Data、写派生 JSON、写缓存、写 reports，并可能反写游戏源 YAML。
- 修改后要验证效果，需要受控运行 `build_archive.py`，因此必须等用户明确授权。
- 生成脚本修改和数据重生成应单独开任务，先说明预期 diff、备份状态和回退方式。

## 后续同类任务验证

后续实施任务应至少验证：

1. 修改前只读记录 Git 状态。
2. 搜索前端和脚本中 `source_root` 的引用。
3. 小范围修改 `build_archive.py` 中 `metadata.source_root` 的生成值。
4. 在用户明确授权后受控运行 `python -X utf8 build_archive.py`。
5. 运行 `node scripts/check-public-data-shape.mjs`。
6. 运行 `node scripts/check-generated-data-privacy.mjs`。
7. 检查 `git status --short --branch` 和 diff。
8. 确认没有 OneDrive Data 非预期修改。
9. 确认 `public/data/*.json` 仍可通过结构检查。

## 回退方式

- 回退 `build_archive.py` 的一行 metadata 修改。
- 如已运行生成脚本，使用 Git diff 检查并恢复派生 JSON。
- 如发现 OneDrive Data 改动，必须按备份和 diff 单独处理。
- 重新运行只读检查脚本确认恢复状态。

## 本轮未执行

- 未手工修改 `src/data/archive_data.json`
- 未手工修改 `public/data/*.json`
- 未修改 OneDrive Data
- 未运行 `npm run dev`、`npm run build`、`npm run preview`
- 未运行发布脚本
- 未执行 `git add`、`git commit`、`git push`
