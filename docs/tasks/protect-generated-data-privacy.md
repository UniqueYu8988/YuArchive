# Protect Generated Data Privacy

本任务建立当前派生 JSON 的隐私与本地路径泄露只读检查。

## 本轮目标

- 新增一个只读检查脚本，扫描当前前端读取和生成聚合 JSON 中是否包含本机绝对路径、旧源路径或明显秘密字段。
- 不修改任何数据，不运行 `build_archive.py`。
- 检查输出只包含文件名、规则名称、大致 JSON 路径和命中次数，不输出命中的原文内容。

## 允许范围

- 新建 `docs/tasks/protect-generated-data-privacy.md`。
- 新建 `scripts/check-generated-data-privacy.mjs`。
- 只读读取：
  - `public/data/home.json`
  - `public/data/games.json`
  - `public/data/visions.json`
  - `public/data/music.json`
  - `public/data/texts.json`
  - `src/data/archive_data.json`
  - `src/data/site_config.json`
- 更新 `CURRENT_STATE.md` 和 `docs/plans/STABILIZATION_PLAN.md`。

## 禁止范围

- 不修改 OneDrive Data、Games、Visions、Music、Texts 或任何 YAML / Markdown / 媒体源数据。
- 不修改 `build_archive.py`、`一键发布到云端.bat`、`package.json`。
- 不修改 `public/data/*.json`、`src/data/*.json` 或任何媒体缓存。
- 不修改 reports 数据文件。
- 不运行 `build_archive.py`、`npm run dev`、`npm run build`、`npm run preview` 或发布脚本。
- 不执行 Git 写操作。
- 不输出个人收藏正文、评分明细、标题清单、文本正文、路径明细或其他隐私内容。
- 不做前端重构，不开始自动化源数据修改。

## 验证方式

运行：

```powershell
node scripts/check-generated-data-privacy.mjs
```

同时静态检查脚本中不包含：

- `writeFile`
- `rm`
- `unlink`
- `mkdir`
- `rename`
- `fetch`
- `http`
- `https`
- `child_process`
- `build_archive.py`
- 发布脚本调用

## 本轮结果

- 静态安全检查通过，脚本未命中禁止调用关键词。
- `node scripts/check-generated-data-privacy.mjs` 已运行。
- `public/data/home.json`、`games.json`、`visions.json`、`music.json`、`texts.json` 通过检查。
- `src/data/site_config.json` 通过检查。
- `src/data/archive_data.json` 存在待核对命中。脚本仅报告文件名、规则名称、大致 JSON 路径和命中次数，未输出命中的原文内容。
- 本轮不修改任何 JSON 或源数据。

## 回退方式

- 删除 `scripts/check-generated-data-privacy.mjs`。
- 删除本任务文件。
- 从 `CURRENT_STATE.md` 和 `docs/plans/STABILIZATION_PLAN.md` 移除本任务状态记录。

该回退不涉及源数据、派生 JSON、缓存或 reports 数据文件。
