# 任务：Archive Studio v0 真实写入前验收

创建日期：2026-06-19
状态：已完成

## 1. 目标

在实现或运行真实 create 之前，用统一只读审计确认当前 Music Album 写入边界足够明确。

## 2. 检查范围

- payload / preview 基础校验；
- 目标路径 allowlist；
- create 目标不存在场景；
- create 目标已存在时的冲突阻断；
- dry-run write / backup / rollback manifest 关系；
- preview、gate 和 manifest 中的本机路径 / OneDrive / secret marker；
- runner 仍保持 `executeImplemented: false` / `writeScope: none`；
- OneDrive Data 文件元数据快照在审计前后不变。

## 3. 安全边界

- 只读旧 OneDrive Data 文件元数据，不读取收藏正文；
- 只读 Archive 当前目录状态；
- 不创建测试 entry；
- 不复制素材；
- 不写 manifest；
- 不运行 `build_archive.py`；
- 不运行发布或 Git 命令；
- 输出只包含检查名和计数，不输出完整路径或条目 id。

## 4. 通过条件

- 合法 create 样例 preview 通过；
- 所有目标路径位于单个 `entries/music/album/<entry-id>` scope；
- 已有 entry 的 create 请求被阻断；
- create dry-run 不要求 backup；
- rollback 删除数与计划写入数一致；
- 隐私规则命中为 0；
- runner 真实执行仍关闭；
- OneDrive Data 前后快照一致。

## 5. 验证命令

```powershell
node scripts/check-archive-studio-v0-real-write-readiness.mjs
node scripts/check-archive-studio-v0-transaction-sandbox.mjs
node scripts/check-archive-data-v2-music-shape.mjs
```

## 6. 回退方式

删除本任务文档和对应只读审计脚本即可，不涉及数据回退。

## 7. 验证结果

- readiness checks：15 / 15 通过；
- OneDrive Data 文件元数据快照：778 个文件，前后计数和摘要一致；
- 新 create 样例通过 gate；
- 已有目标 create 冲突被阻断；
- allowlist scope 和目标路径检查通过；
- planned writes：4；
- create backup items：0；
- rollback deletes：4，与 planned writes 一致；
- 隐私规则命中：0；
- transaction sandbox 成功和失败场景自检通过；
- Music v2 shape check 通过；
- runner 默认计划模式保持 `writeScope: none`，真实执行必须通过 authorization、entry id 和 preflight gates。

## 8. 结论

当前只读边界足以进入一次受控 Music Album create + rollback smoke test。runner 已在系统临时沙箱完成 create / check / rollback 验证；真实执行仍需外部目录写权限和执行后回退验收。
