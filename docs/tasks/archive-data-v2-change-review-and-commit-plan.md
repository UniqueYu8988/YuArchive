# 任务：ArchiveData-v2 变更范围 review 和 Git 提交计划

创建日期：2026-06-16
状态：待用户确认提交

## 1. 目标

在不执行 Git 写操作、不发布、不运行 `build_archive.py` 的前提下，整理 ArchiveData-v2 当前工作区变更范围，确认验证结果，并给出后续提交拆分方案。

## 2. 背景

Music v2 live-compatible JSON 替换已完成：`public/data/music.json` 已由 live-compatible preview 替换，条目数量保持 33，字段集合保持兼容，媒体路径继续复用当前公开缓存路径。

当前仍有多份 ArchiveData-v2 设计文档、任务记录和脚本处于未提交状态。正式提交前需要先确认哪些文件属于同一意图，哪些文件不应进入本轮提交，以及是否仍存在隐私或发布边界风险。

## 3. 本次范围

- 只读核对 Git 状态、diff 统计和文件分组。
- 运行现有只读检查脚本。
- 整理建议提交分组和提交顺序。
- 不执行 `git add`、`git commit`、`git push`。

## 4. 明确不做

- 不运行 `build_archive.py`。
- 不运行发布脚本。
- 不运行 npm dev/build/preview。
- 不修改 OneDrive 源数据。
- 不修改 `ArchiveData-v2` 试点输出。
- 不继续扩展 Games、Visions、Texts 迁移。
- 不进入 Archive Studio 前端开发。

## 5. 当前变更概览

已跟踪文件存在变更：

- `CURRENT_STATE.md`
- `docs/plans/STABILIZATION_PLAN.md`
- `public/data/music.json`

未跟踪新增主要分组：

- 设计文档：`docs/design/archive-data-v2.md`
- ArchiveData-v2 迁移审计和 dry-run 任务记录
- Music v2 试点边界、planner、写入迁移、验收任务记录
- v2 Music 输出检查、preview 生成器、live 兼容映射、live-compatible preview 任务记录
- Music live replacement gate 和 replacement acceptance 任务记录
- 对应只读脚本和受控迁移脚本

## 6. 验证结果

本轮只读验证结果：

- `node scripts/check-public-data-shape.mjs`：通过。
- `node scripts/check-generated-data-privacy.mjs`：通过。
- `node scripts/check-archive-data-v2-music-shape.mjs`：通过。
- `node scripts/generate-archive-data-v2-music-live-compatible-preview.mjs`：通过。
- 当前 `public/data/music.json` 与 live-compatible preview 的 SHA256 哈希一致。

## 7. 建议提交拆分

### Commit 1：ArchiveData-v2 规则设计和全局审计

目的：提交规则设计、迁移审计和 dry-run 基础能力。

建议包含：

- `docs/design/archive-data-v2.md`
- `docs/tasks/archive-data-v2-migration-audit.md`
- `docs/tasks/archive-data-v2-migration-dry-run.md`
- `scripts/audit-archive-data-v2-migration.mjs`
- `scripts/dry-run-archive-data-v2-migration.mjs`

建议 message：

```text
Design ArchiveData v2 migration foundation
```

### Commit 2：Music v2 试点迁移和输出验收

目的：提交 Music-only 写入型试点迁移、v2 输出检查和 Git 边界验收。

建议包含：

- `docs/tasks/archive-data-v2-music-pilot-boundary.md`
- `docs/tasks/archive-data-v2-music-pilot-planner.md`
- `docs/tasks/archive-data-v2-music-pilot-write-design.md`
- `docs/tasks/protect-archive-data-v2-music-shape.md`
- `docs/tasks/archive-data-v2-music-pilot-acceptance.md`
- `scripts/plan-archive-data-v2-music-pilot.mjs`
- `scripts/migrate-archive-data-v2-music-pilot.mjs`
- `scripts/check-archive-data-v2-music-shape.mjs`

建议 message：

```text
Add ArchiveData v2 music pilot migration
```

### Commit 3：Music v2 live-compatible preview 和映射

目的：提交隔离 preview、live ID / media path 映射和正式替换前的 gate。

建议包含：

- `docs/tasks/archive-data-v2-music-generator-pilot-design.md`
- `docs/tasks/archive-data-v2-music-live-compat-strategy.md`
- `docs/tasks/archive-data-v2-music-live-compat-mapper.md`
- `docs/tasks/archive-data-v2-music-live-compatible-preview.md`
- `docs/tasks/archive-data-v2-music-live-replacement-gate.md`
- `scripts/generate-archive-data-v2-music-preview.mjs`
- `scripts/map-archive-data-v2-music-live-compat.mjs`
- `scripts/generate-archive-data-v2-music-live-compatible-preview.mjs`

建议 message：

```text
Add ArchiveData v2 music live compatibility checks
```

### Commit 4：Music live 数据替换和状态记录

目的：提交用户已授权的 `public/data/music.json` 替换，以及当前状态文档。

建议包含：

- `public/data/music.json`
- `docs/tasks/archive-data-v2-music-live-replacement-acceptance.md`
- `CURRENT_STATE.md`
- `docs/plans/STABILIZATION_PLAN.md`

建议 message：

```text
Replace music data with ArchiveData v2 compatible output
```

## 8. 不建议本轮提交的内容

当前未发现项目工作树内有应明确排除的新数据目录。生成的 `ArchiveData-v2` 试点输出位于项目 Git 工作树外，当前不会被普通项目提交包含。

后续实际提交前仍应再次运行：

```powershell
git status --short --branch
git diff --stat
```

并确认没有误添加外部迁移产物、缓存、reports 数据文件或本机路径。

## 9. 风险

| 风险 | 影响 | 处理方式 |
|---|---|---|
| 未跟踪文件较多 | 容易漏提或错提 | 按明确路径分批 `git add`，不使用无脑 `git add -A` |
| `public/data/music.json` 已替换 | 若未单独审查，可能混入脚本提交 | 将 live 数据替换单独放在最后一个提交 |
| 外部 v2 输出不在仓库内 | 代码提交不能代表外部数据已版本化 | 文档明确它是本地/OneDrive 迁移产物，提交只包含脚本和记录 |
| 发布边界 | 提交后仍不代表可发布 | 不 push，不运行发布脚本，发布需单独验收 |

## 10. 验收标准

- [x] 当前只读检查脚本通过。
- [x] Music live-compatible preview 生成器通过。
- [x] 当前 live Music JSON 与 preview 哈希一致。
- [x] 提交拆分方案已记录。
- [ ] 用户确认后再执行 Git add / commit。

## 11. 完成记录

2026-06-16：完成只读 review 和提交计划记录。本轮未执行 Git 写操作，未运行 `build_archive.py`，未运行发布脚本。
