# 任务：Archive Studio v0 变更范围 review 和 Git 提交计划

创建日期：2026-06-16
状态：待用户确认提交

## 1. 目标

整理 Archive Studio v0 边界设计、技术入口设计、payload schema 和 CLI sandbox preview 原型的当前变更范围，确认验证结果，并给出本地提交方案。

本任务不执行 Git 写操作。

## 2. 当前变更

已修改：

- `CURRENT_STATE.md`
- `docs/plans/STABILIZATION_PLAN.md`

新增：

- `docs/tasks/archive-studio-v0-boundary-design.md`
- `docs/tasks/archive-studio-v0-entry-design.md`
- `docs/tasks/archive-studio-v0-music-payload-schema.md`
- `docs/tasks/archive-studio-v0-cli-sandbox-preview.md`
- `docs/examples/archive-studio-v0-music-album-payload.sample.json`
- `scripts/archive-studio-v0-music-preview-sandbox.mjs`

## 3. 验证结果

通过 Node REPL 运行以下检查：

- `node scripts/check-public-data-shape.mjs`：通过。
- `node scripts/check-generated-data-privacy.mjs`：通过。
- `node scripts/check-archive-data-v2-music-shape.mjs`：通过。
- `node scripts/archive-studio-v0-music-preview-sandbox.mjs`：通过。

CLI sandbox preview 结果：

- `ok: true`
- operations：6
- warnings：0
- errors：0
- writeScope：system-temp-only

## 4. 安全边界

本轮变更：

- 不写 OneDrive Data。
- 不写真实 ArchiveData-v2 输出。
- 不写 `public/data`。
- 不写 `src/data`。
- 不写缓存或 reports。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不执行 Git push。

CLI sandbox 脚本只写系统临时目录下的 preview JSON，并且 preview 只包含相对目标路径。

## 5. 建议提交

建议只做 1 个本地 commit：

```text
Add Archive Studio v0 sandbox preview design
```

建议包含：

- `CURRENT_STATE.md`
- `docs/plans/STABILIZATION_PLAN.md`
- `docs/tasks/archive-studio-v0-boundary-design.md`
- `docs/tasks/archive-studio-v0-entry-design.md`
- `docs/tasks/archive-studio-v0-music-payload-schema.md`
- `docs/tasks/archive-studio-v0-cli-sandbox-preview.md`
- `docs/examples/archive-studio-v0-music-album-payload.sample.json`
- `scripts/archive-studio-v0-music-preview-sandbox.mjs`

## 6. 不建议本轮提交的内容

当前未发现其他应提交的文件。实际提交前仍应再运行：

```powershell
git status --short --branch
```

并使用明确路径 `git add`，不要使用无脑 `git add -A`。

## 7. 提交后验证

提交后建议运行：

```powershell
git status --short --branch
node scripts/check-public-data-shape.mjs
node scripts/check-generated-data-privacy.mjs
node scripts/check-archive-data-v2-music-shape.mjs
node scripts/archive-studio-v0-music-preview-sandbox.mjs
```

## 8. 下一步

等待用户明确授权后执行本地 commit；不 push。提交后再由用户单独决定是否 push。
