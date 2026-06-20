# ArchiveData-v2 Visions 受控迁移

创建日期：2026-06-20
状态：迁移器隔离验证已通过，真实执行待验收

## 目标

把旧 Visions 只读迁移为 ArchiveData-v2 Visions，不覆盖 Music 或 Texts，不修改旧 OneDrive Data，不生成 live JSON。

## 唯一写入范围

- `ArchiveData-v2/entries/visions/`；
- `ArchiveData-v2/config/visions-periods.yaml`；
- `ArchiveData-v2/migration/visions/`。

目标已存在时默认阻断。

## 安全流程

1. 重新运行只读 planner；
2. 对旧 Visions 157 个文件建立内存 SHA-256 基线；
3. 在系统临时目录生成完整 v2 Visions；
4. 在临时目录运行 Visions shape checker；
5. 通过后逐文件复制到三个限定目标；
6. 在真实 v2 再运行 shape checker；
7. 对比旧 Visions 前后 SHA-256；
8. 任一步失败，只删除本轮三个 Visions 目标。

## 执行 gate

默认仅计划：

```powershell
node scripts/migrate-archive-data-v2-visions.mjs
```

真实执行：

```powershell
node scripts/migrate-archive-data-v2-visions.mjs --execute --authorization "I authorize ArchiveData-v2 Visions migration"
```

## 验收标准

- entries 112：movie 71、series 40、showcase 1；
- posters 111；
- characters、avatars、clips 各 20；
- manifest 157、unmapped 0；
- malformed、invalid ID、period、角色顺序、privacy hit 均为 0；
- 旧 Visions changed 0、missing 0；
- Music 与 Texts v2 继续通过。

## 回退

只删除本轮三个 Visions 目标，不删除 ArchiveData-v2 根目录、Music、Texts 或其他 config / migration 记录。

## 隔离验证结果

- 计划模式通过，write scope 为 none；
- 错误授权被阻断；
- 系统临时目录生成 entries 112、characters 20、manifest 157；
- shape checker 通过；
- 旧源 changed 0；
- 临时目录已清理。
