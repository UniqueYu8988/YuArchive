# BASELINE_ACCEPTANCE.md

本文件记录 YuArchive 在工作流改造前后都必须守住的第一版验收基线。

## 1. 数据安全基线

- [ ] `C:\Users\Yu\OneDrive\图片\Data` 未丢失、未覆盖、未移动、未被清理。
- [ ] `Games`、`Visions`、`Music`、`Texts` 四类源目录仍存在。
- [ ] 顶层配置 `homepage.yaml`、`site-layout.yaml`、`site-ui.yaml` 仍存在。
- [ ] `Texts\sections.yaml` 仍存在。
- [ ] 不把 OneDrive 源数据全文复制进项目 Markdown。
- [ ] 不展示或提交秘密值、账号、令牌、隐私正文。

## 2. 构建脚本读取基线

在受控验收阶段，允许运行前必须确认已有备份。

- [ ] `build_archive.py` 中的 `ONEDRIVE_DATA_ROOT` 指向 `C:\Users\Yu\OneDrive\图片\Data`。
- [ ] 脚本仍能识别四类分类：`games`、`visions`、`music`、`texts`。
- [ ] 脚本输出目标仍是项目内 `public\data`、`public\webp_cache`、`public\audio_cache`、`public\media_cache`、`src\data`、`reports`。
- [ ] 运行后不应意外删除或损坏 OneDrive 源数据。
- [ ] 如脚本写回游戏 `meta.yaml`，必须出现在预期 diff 中并可解释。

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
- [ ] 不误运行 `一键发布到云端.bat`。
- [ ] 发布前必须检查 `git status` 和 diff。

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

## 8. 当前无法验证的事项

- 本轮未启动开发服务器。
- 本轮未运行 `build_archive.py`。
- 本轮未运行 `npm run build`。
- 本轮未做浏览器页面验收。

原因：本轮目标是首次正式审计和 Markdown 基线文档更新，用户明确禁止运行会写入或高风险命令。

## 9. 最近一次基线更新

- 日期：2026-06-14
- 执行方式：只读审计 + Markdown 文档更新
- 结果：已建立第一版验收基线，未执行构建、启动、数据生成或 Git 写操作。
