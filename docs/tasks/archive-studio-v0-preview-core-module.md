# 任务：Archive Studio v0 preview core 模块拆分

创建日期：2026-06-16
状态：已完成

## 1. 目标

将 Archive Studio v0 `music/album` sandbox preview 的核心逻辑拆分为可复用纯函数模块，为后续 payload schema 校验脚本、本地 Node 服务或 UI preview 复用做准备。

## 2. 本次范围

- 新增 `scripts/archive-studio-v0-music-preview-core.mjs`。
- 保留 `scripts/archive-studio-v0-music-preview-sandbox.mjs` 的 CLI 行为。
- 将 payload 校验、preview 构建、路径规范化和 preview 安全断言移入 core 模块。
- 继续只写系统临时目录 preview。

## 3. 明确不做

- 不接 UI。
- 不写真实 Archive 输出。
- 不写 OneDrive Data。
- 不写 `public/data` 或 `src/data`。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不执行 Git 操作。

## 4. 模块职责

`archive-studio-v0-music-preview-core.mjs` 导出：

- `allowedCoverExtensions`
- `allowedAudioExtensions`
- `allowedOperations`
- `normalizeRelativePath`
- `countLines`
- `validatePayload`
- `buildMusicAlbumPreview`
- `assertPreviewSafe`

CLI 脚本继续负责：

- 解析项目内 payload JSON 路径。
- 读取 payload。
- 调用 core 生成 preview。
- 写入系统临时目录。
- 输出摘要。

## 5. 验收方式

运行：

```powershell
node scripts/archive-studio-v0-music-preview-sandbox.mjs
node scripts/check-public-data-shape.mjs
node scripts/check-generated-data-privacy.mjs
node scripts/check-archive-data-v2-music-shape.mjs
```

期望：

- sandbox preview 通过；
- preview 仍只写系统临时目录；
- public data shape 通过；
- generated data privacy 通过；
- v2 Music shape 通过。

## 6. 下一步建议

下一步只建议为 core 模块增加小型只读自检脚本，覆盖 invalid id、非法扩展名、项目外 payload 路径等失败场景；仍不接 UI、不写真实 Archive。
