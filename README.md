# YuArchive

YuArchive 是一个个人数字收藏馆，用网页方式展示和管理游戏、影视、音乐、文本四类收藏信息。

## 当前正式工作流入口

AI 进入本项目时，第一入口是：

- `AGENTS.md`

然后按任务需要读取：

- `PRODUCT.md`
- `ARCHITECTURE.md`
- `CURRENT_STATE.md`
- `docs/BASELINE_ACCEPTANCE.md`
- `docs/plans/STABILIZATION_PLAN.md`

README 只作为人类快速入口，不再承担完整维护手册、历史上下文或 AI 第一入口职责。

## 重要目录

项目根目录：

```text
C:\Users\Yu\AI\Archive
```

真实收藏源数据目录：

```text
C:\Users\Yu\OneDrive\图片\Data
```

源数据目录保存长期维护的收藏源文件。网页公开展示的标题、分类、评分和描述不按高敏感信息处理，但源目录本身默认不要修改、移动、清理或批量生成。

## 数据边界

- `C:\Users\Yu\OneDrive\图片\Data` 是真实源数据。
- `public\data\*.json` 是当前前端读取的生成数据。
- `src\data\archive_data.json` 和 `src\data\site_config.json` 是生成聚合数据。
- `public\webp_cache`、`public\audio_cache`、`public\media_cache` 是派生媒体缓存。
- `dist`、`node_modules`、`__pycache__` 是可重新生成或重新安装的产物。

不要把派生数据或缓存误当成唯一源数据。

## 常用命令

以下命令存在写入或运行风险，只能在明确任务允许、已说明目的和回退方式时运行：

```powershell
python -X utf8 build_archive.py
npm run dev
npm run build
npm run preview
.\一键发布到云端.bat
git add
git commit
git push
```

风险说明：

- `build_archive.py` 会读取 OneDrive 源数据，并写入 `src\data`、`public\data`、缓存目录和 `reports`，还可能写回游戏 `meta.yaml`。
- `npm run dev` / `npm run preview` 会启动本地服务。
- `npm run build` 会生成 `dist`。
- `一键发布到云端.bat` 会构建、暂存、提交并推送。
- Git 写操作会改变仓库状态。

只读检查通常可以使用：

```powershell
git status --short --branch
git remote -v
git log -1 --oneline --decorate
```

## 维护原则

- 修改前先确认任务范围和安全红线。
- 先保护 OneDrive 源数据，再考虑构建或发布。
- 不在 README 中复制账号、令牌、密钥、本机绝对路径、OneDrive 真实源目录路径或隐私正文。
- 需要理解项目时，优先阅读 `AGENTS.md` 和当前工作流文档。
