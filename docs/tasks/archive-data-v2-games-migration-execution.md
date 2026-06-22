# Archive Games 受控迁移

创建日期：2026-06-20
状态：真实迁移已完成

## 目标

把旧 Games 只读迁移为 Archive Games，不覆盖 Music、Texts 或 Visions，不修改旧 OneDrive Data，不生成 live JSON。

## 唯一写入范围

- `Archive/entries/games/`；
- `Archive/config/games.yaml`；
- `Archive/migration/games/`。

目标已存在时默认阻断。

## 安全流程

1. 重新运行只读 planner；
2. 对旧 Games 329 个文件建立内存 SHA-256 基线；
3. 在系统临时目录生成完整 Games v2；
4. 在临时目录运行 Games shape checker；
5. 通过后才复制到三个限定目标；
6. 在目标 v2 再运行 shape checker；
7. 对比旧 Games 前后 SHA-256；
8. 任一步失败，只删除本轮三个 Games 目标。

## 执行 gate

默认仅计划：

```powershell
node scripts/migrate-archive-data-v2-games.mjs
```

真实执行需要精确授权：

```powershell
node scripts/migrate-archive-data-v2-games.mjs --execute --authorization "I authorize Archive Games migration"
```

## 验收标准

- entries 282：normal_game 273、dlc 6、live_game 3；
- ordinary / DLC cover 279，live parent cover 2；
- season YAML 与 cover 各 40；
- manifest 329、unmapped 0；
- malformed、invalid ID、DLC parent、privacy hit 均为 0；
- 旧 Games changed 0、missing 0；
- Music、Texts、Visions v2 继续通过。

## 回退

只删除本轮三个 Games 目标，不删除 Archive 根目录或其他 board 数据。

## 隔离验证结果

- 计划模式通过，write scope 为 none；
- 错误授权被阻断；
- 系统临时目录生成 entries 282、seasons 40、manifest 329；
- Games v2 shape checker 通过；
- 旧源 329 个文件 changed 0；
- 临时目录已清理。

## 真实执行结果

- entries 282：normal_game 273、dlc 6、live_game 3；
- ordinary / DLC cover 279，live parent cover 2；
- season YAML 与 cover 各 40；
- manifest 329、unmapped 0；
- malformed、invalid ID、DLC parent、unexpected file 和 privacy hit 均为 0；
- metadata_disabled 93，保留 2010 / 2015 未增强边界；
- 旧 Games baseline 329，changed 0、missing 0；
- Music、Texts、Visions v2 检查继续通过；
- 未运行 `build_archive.py`，未修改 public JSON，未发布。
