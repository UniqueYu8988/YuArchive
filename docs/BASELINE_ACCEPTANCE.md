# BASELINE_ACCEPTANCE.md

本文件记录 YuArchive 在工作流改造前后都必须守住的第一版验收基线。

## 1. 数据安全基线

- [ ] `C:\Users\Yu\OneDrive\图片\Data` 未丢失、未覆盖、未移动、未被清理。
- [ ] `Games`、`Visions`、`Music`、`Texts` 四类源目录仍存在。
- [ ] 顶层配置 `homepage.yaml`、`site-layout.yaml`、`site-ui.yaml` 仍存在。
- [ ] `Texts\sections.yaml` 仍存在。
- [ ] 不把 OneDrive 源数据全文复制进项目 Markdown。
- [ ] 收藏标题、分类、评分和展示描述可作为网页展示资产处理。
- [ ] 不展示或提交秘密值、账号、令牌、本机绝对路径、OneDrive 真实源目录路径或隐私正文。

## 2. 构建脚本读取基线

在受控验收阶段，允许运行前必须确认已有备份，或用户已明确授权承担本次数据生成风险。

- [ ] `build_archive.py` 中的 `ONEDRIVE_DATA_ROOT` 指向 `C:\Users\Yu\OneDrive\图片\Data`。
- [ ] 脚本仍能识别四类分类：`games`、`visions`、`music`、`texts`。
- [ ] 脚本输出目标仍是项目内 `public\data`、`public\webp_cache`、`public\audio_cache`、`public\media_cache`、`src\data`、`reports`。
- [ ] 运行后不应意外删除或损坏 OneDrive 源数据。
- [ ] 如脚本写回游戏 `meta.yaml`，必须出现在预期 diff 中并可解释。
- [ ] 运行后必须检查 OneDrive Data 是否发生预期或意外修改。
- [ ] 不得把 `public\data`、`src\data`、`reports` 或缓存当成唯一源数据。

## 3. 前端读取基线

- [ ] 首页读取 `/data/home.json`。
- [ ] 游戏页读取 `/data/games.json`。
- [ ] 影视页读取 `/data/visions.json`。
- [ ] 音乐页读取 `/data/music.json`。
- [ ] 文本页读取 `/data/texts.json`。
- [ ] `public\data\*.json` 不是手工维护源数据，而是构建输出。
- [ ] 派生缓存不被误当成唯一数据源。

## 4. 命令安全基线

默认不得误运行：

```powershell
python -X utf8 build_archive.py
npm run build
npm run dev
npm run preview
.\一键发布到云端.bat
git add
git commit
git push
```

验收时如确需运行，必须先说明目的、风险、预期写入位置和回退方式。

## 5. Git 和发布基线

- [ ] 不把真实源数据目录直接加入 Git。
- [ ] 不把秘密配置加入 Git。
- [ ] 不无意上传大型媒体、数据库或真实用户数据。
- [ ] 不把密钥、token、账号凭据、本机绝对路径或 OneDrive 真实源目录路径上传到公开仓库。
- [ ] 不把公开展示用的收藏标题、分类、评分和描述误判为高敏感信息；是否提交由派生数据策略和隐私检查结果决定。
- [ ] 不误运行 `一键发布到云端.bat`。
- [ ] 发布前必须检查 `git status` 和 diff。

本地预览、生产构建、数据生成、远端发布必须分开验收，不得用一键发布脚本替代前置检查。

## 6. 后续受控启动验收

当任务允许启动时，按以下顺序做：

1. 只读检查 `git status --short --branch`；
2. 确认不需要运行 `build_archive.py`；
3. 启动 `npm run dev` 或 `启动.bat`；
4. 打开首页和四类页面；
5. 检查浏览器控制台是否有阻塞错误；
6. 关闭服务；
7. 再次检查 Git 状态，确认没有意外写入。

## 7. 后续受控构建/数据生成验收

当任务允许构建或数据生成时，按以下顺序做：

1. 确认 OneDrive Data 已备份；
2. 记录运行前 Git 状态；
3. 运行 `python -X utf8 build_archive.py`；
4. 检查 `src\data`、`public\data`、缓存和 `reports` 的变动；
5. 运行受控页面验收；
6. 如需生产构建，再运行 `npm run build`；
7. 审核 diff，确认没有秘密值和不应上传的数据。

如果需要远端发布，必须在数据生成和生产构建均已单独验收后，再单独确认发布脚本或 Git 推送步骤。

## 8. 未来自动化验收原则

- [ ] 自动化写入源数据前，必须能展示将修改的文件、字段和变更范围。
- [ ] 自动化必须能区分 OneDrive 源数据、项目内派生数据、缓存、reports 和发布产物。
- [ ] 自动化写入必须有可执行的回退方式，不能只依赖“重新生成成功”。
- [ ] 不能把 `build_archive.py` 或发布脚本执行成功当成 OneDrive 源数据安全。
- [ ] 一键发布不能和源数据修改混在同一个未经拆分的验收流程中。

## 9. 当前无法验证的事项

- 本轮未启动开发服务器。
- 本轮未运行 `build_archive.py`。
- 本轮未运行 `npm run build`。
- 本轮未做浏览器页面验收。

原因：本轮目标是首次正式审计和 Markdown 基线文档更新，用户明确禁止运行会写入或高风险命令。

## 10. 最近一次基线更新

- 日期：2026-06-14
- 执行方式：只读审计 + Markdown 文档更新
- 结果：已建立第一版验收基线，并补充未来自动化验收原则；未执行构建、启动、数据生成或 Git 写操作。
