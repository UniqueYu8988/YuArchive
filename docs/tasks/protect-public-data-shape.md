# Protect Public Data Shape

本任务建立 `public/data/*.json` 的只读结构检查，作为代码风险审计后的第一个低风险保护任务。

## 本轮目标

- 新增一个只读检查脚本，验证当前前端读取的派生 JSON 具备最低结构。
- 防止明显错误进入后续页面验收，例如文件不存在、JSON 解析失败、顶层类型错误、核心字段缺失或核心集合为空。
- 不建立完整 schema，不校验个人收藏内容，不输出具体条目。

## 允许范围

- 新建 `docs/tasks/protect-public-data-shape.md`。
- 新建 `scripts/check-public-data-shape.mjs`。
- 只读读取：
  - `public/data/home.json`
  - `public/data/games.json`
  - `public/data/visions.json`
  - `public/data/music.json`
  - `public/data/texts.json`
- 必要时只读查看前端数据读取代码。
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
node scripts/check-public-data-shape.mjs
```

预期结果：

- 脚本只输出每个 JSON 文件的结构检查通过 / 失败、顶层类型、必要字段状态和数组或集合数量。
- 检查失败时只输出缺失字段或类型错误，不输出数据正文。
- 静态检查脚本中不包含写文件、删除、网络、子进程、OneDrive 路径、`build_archive.py` 或发布脚本调用。

## 回退方式

- 删除 `scripts/check-public-data-shape.mjs`。
- 删除本任务文件。
- 从 `CURRENT_STATE.md` 和 `docs/plans/STABILIZATION_PLAN.md` 移除本任务状态记录。

该回退不涉及源数据、派生 JSON、缓存或 reports 数据文件。
