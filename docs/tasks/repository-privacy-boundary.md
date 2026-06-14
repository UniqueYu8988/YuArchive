# Repository Privacy Boundary

本任务设计用于处理 `src/data/archive_data.json` 的仓库隐私与生成物边界问题。本轮只做只读检查和方案记录，不修改数据、生成脚本、Git 跟踪状态或发布流程。

## 问题背景

生成数据隐私检查发现 `src/data/archive_data.json` 存在待核对命中。命中集中在 `metadata.source_root`，属于本机路径 / OneDrive 源路径相关规则；未发现明显秘密字段名命中。

当前公开网页主要读取 `public/data/*.json`。只读搜索未发现前端生产代码直接读取或打包 `src/data/archive_data.json`，但该文件已被 Git 跟踪，因此存在仓库隐私和发布卫生风险。

## 已确认事实

- `.gitignore` 当前忽略 `node_modules`、`dist`、`dist-ssr`、本地环境文件、系统文件、Python 缓存和部分 AI 本地目录。
- `.gitignore` 当前未忽略 `src/data/archive_data.json`。
- `.gitignore` 当前未忽略 `public/data`、`public/webp_cache`、`public/audio_cache`、`public/media_cache` 或 `reports`。
- `public/data/*.json` 当前被 Git 跟踪。
- `src/data/archive_data.json` 当前被 Git 跟踪。
- `package.json` 只有 `dev`、`build`、`preview`，未发现会间接运行 `build_archive.py` 或发布脚本的 npm script。
- `vite.config.ts` 只配置 React 插件和 manual chunks；未发现显式把 `src/data/archive_data.json` 打进前端包的配置。
- 前端实际路由数据读取入口是 `/data/home.json`、`/data/games.json`、`/data/visions.json`、`/data/music.json`、`/data/texts.json`。
- `src/data/site_config.json` 会通过 `src/data/siteConfig.ts` 被页面使用；`src/data/archive_data.json` 当前未发现生产代码直接引用。
- `一键发布到云端.bat` 会运行数据生成，然后执行 `git add -A`、commit 和 push。
- `build_archive.py` 会写入 `src/data/archive_data.json`，并在聚合 metadata 中记录源根信息。

## 当前风险

- 运行时风险：当前不构成公开网页运行时阻碍，因为页面主要读取 `public/data/*.json`。
- 仓库风险：`src/data/archive_data.json` 已被 Git 跟踪，可能把本机路径元数据和较大的聚合派生数据带入提交。
- 发布风险：一键发布脚本会执行 `git add -A`、commit、push；在边界问题处理前，存在把未审查生成物推送到远端的风险。
- 复现风险：如果只手改 JSON，下次运行 `build_archive.py` 可能再次生成同类字段。

## 不立即手改 JSON 的原因

- `src/data/archive_data.json` 是派生生成物，不是权威源数据。
- 手改 JSON 不能解决生成源头，后续运行生成脚本可能复现。
- 手改容易制造“当前文件看似安全、生成流程仍不安全”的假象。
- 当前任务没有授权修改派生数据。

## 不立即修改 `build_archive.py` 的原因

- `build_archive.py` 是高风险集中脚本：读取 OneDrive Data、写派生 JSON、写缓存、写 reports，并可能反写游戏源 YAML。
- 修改生成逻辑属于更高风险任务，需要单独计划、备份、差异预览和受控验收。
- 当前已经有明确仓库边界问题，宜先用 Git 跟踪和发布边界处理降低外泄风险，再考虑生成逻辑脱敏。

## 方案比较

| 方案 | 内容 | 优点 | 风险 | 是否需要 `.gitignore` | 是否影响前端 |
|---|---|---|---|---|---|
| A | 仅从 Git 跟踪中移除 `src/data/archive_data.json` | 小步、可验证；不改数据和生成脚本；降低远端仓库泄露风险 | 本地文件仍会被生成；若不加忽略规则，后续可能再次被加入 Git | 建议需要，防止重新跟踪 | 当前看不影响前端，因为生产代码未直接读取该文件 |
| B | 修改 `build_archive.py`，让 `metadata.source_root` 脱敏或相对化 | 从生成源头解决路径字段；保留聚合 JSON 时更干净 | 触碰高风险脚本；需要受控生成验收；可能影响依赖 metadata 的历史或工具 | 不一定，但仍需评估聚合 JSON 是否应被跟踪 | 理论上不影响当前前端，但需验证没有隐藏依赖 |
| C | 同时移除 Git 跟踪并改生成逻辑 | 同时降低仓库风险和源头复现风险 | 涉及 Git 边界和生成脚本两类风险，变更面更大 | 需要 | 当前前端大概率不受影响，但必须拆分验收 |

## 推荐方案

推荐下一步采用方案 A 的小步版本：

1. 先只读复核 `src/data/archive_data.json` 没有生产运行引用；
2. 制定 Git 边界变更：从 Git 跟踪中移除该聚合生成物；
3. 同步更新 `.gitignore`，防止后续重新加入；
4. 保持 `public/data/*.json` 的处理不变，因为当前公开网页依赖它们；
5. 再运行隐私检查脚本确认仓库待提交范围是否仍包含相关风险。

方案 B 可作为后续独立任务，在 Git 边界稳定后再计划。方案 C 不建议一步完成，除非已有完整备份、差异预览和受控生成验收安排。

## 方案 A 执行记录

- 已在 `.gitignore` 增加 `src/data/archive_data.json`。
- 已执行 `git rm --cached -- src/data/archive_data.json`；最终 Git 状态确认该文件已以 staged deletion 形式退出跟踪。
- 本地 `src/data/archive_data.json` 文件仍保留。
- `public/data/*.json` 仍被 Git 跟踪，公开网页继续依赖这些 JSON。
- 未修改 `src/data/archive_data.json` 内容。
- 未修改 `public/data/*.json`。
- 未修改 `build_archive.py`。
- 未运行 `build_archive.py`。
- 未执行 commit 或 push。
- `node scripts/check-public-data-shape.mjs` 通过。
- `node scripts/check-generated-data-privacy.mjs` 仍会在本地未跟踪的 `src/data/archive_data.json` 中报告待核对命中；这说明生成源头仍未脱敏，后续如要彻底消除 `metadata.source_root`，需要单独处理 `build_archive.py` 脱敏或调整隐私检查范围。

## 验收方式

方案 A 的后续验收应包括：

- `git status --short --branch`
- `git ls-files src/data/archive_data.json public/data/*.json`
- 只读搜索前端生产代码中是否引用 `src/data/archive_data.json`
- 运行 `node scripts/check-generated-data-privacy.mjs`，确认结果和待核对命中范围
- 确认未修改 OneDrive Data、`public/data/*.json`、`build_archive.py` 或发布脚本

如后续涉及方案 B，还必须单独增加：

- 运行前确认 OneDrive Data 已备份
- 预览 `build_archive.py` 变更
- 受控运行数据生成
- 检查生成前后 diff
- 解释任何 OneDrive Data 改动

## 回退方式

方案 A 的回退：

- 恢复 Git 跟踪 `src/data/archive_data.json`
- 移除对应 `.gitignore` 规则
- 重新运行只读隐私检查确认状态

方案 B 的回退：

- 回退 `build_archive.py` 变更
- 使用备份和 Git diff 核对生成物
- 如曾运行生成脚本，必须检查 OneDrive Data 是否出现预期外修改

## 本轮未执行

- 已执行 `git rm --cached -- src/data/archive_data.json`
- 未删除本地 `src/data/archive_data.json`
- 未修改 `src/data/archive_data.json`
- 未修改 `public/data/*.json`
- 未修改 `build_archive.py`
- 未运行 `build_archive.py`
- 未执行 `git add`、`git commit`、`git push`
