# 任务：Archive Studio v0 preview core 自检

创建日期：2026-06-16
状态：已完成

## 1. 目标

为 Archive Studio v0 `music/album` preview core 增加小型只读自检脚本，覆盖成功路径和关键失败路径，确保后续接 UI 或本地服务前，preview core 的基础安全边界可被快速验证。

## 2. 本次范围

- 新增 `scripts/check-archive-studio-v0-preview-core.mjs`。
- 只调用 `scripts/archive-studio-v0-music-preview-core.mjs` 导出的纯函数。
- 覆盖合法 payload、无效 id、非法媒体扩展名、缺少标题、update + keep-existing 素材和路径/敏感字段安全断言。
- 小幅修正 preview core：无效 id 的 preview target 使用固定安全占位 `invalid-id`，避免无效 id 影响目标路径。

## 3. 明确不做

- 不接 UI。
- 不写真实 Archive 输出。
- 不写 OneDrive Data。
- 不读或写 `public/data`、`src/data`。
- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不新增依赖。

## 4. 验证方式

运行：

```powershell
node scripts/check-archive-studio-v0-preview-core.mjs
node scripts/archive-studio-v0-music-preview-sandbox.mjs
node scripts/check-public-data-shape.mjs
node scripts/check-generated-data-privacy.mjs
node scripts/check-archive-data-v2-music-shape.mjs
```

期望：

- preview core self-check 通过；
- CLI sandbox preview 行为保持可用；
- 公开派生 JSON shape/privacy 检查通过；
- v2 Music 输出检查通过。

## 5. 回退方式

- 删除 `scripts/check-archive-studio-v0-preview-core.mjs`。
- 回退 `scripts/archive-studio-v0-music-preview-core.mjs` 中无效 id 安全占位的小改动。
- 回退本任务文档和状态文档更新。

## 6. 下一步建议

下一步只建议继续做 Archive Studio v0 写入事务设计：仍先设计 manifest、backup、diff preview 和 rollback，不接真实 UI，不写真实 Archive 输出。
