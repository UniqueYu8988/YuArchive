# ArchiveData-v2 Visions Live JSON Replacement

创建日期：2026-06-20
状态：执行门槛已建立，真实替换待验收

## 目标

把已通过的 Visions live-compatible preview 受控写入当前公开派生 JSON。

## 必须同时更新

- `public/data/visions.json`：2 个条目、6 个字段；
- `public/data/home.json`：其中 1 个首页引用、3 个字段。

仅替换 `visions.json` 会让首页继续显示旧元数据，因此两者属于同一个一致性事务。

## 固定门槛

- 普通条目 111/111，角色 20/20；
- ID、媒体路径和所有顺序完全复用；
- Visions 差异恰好为 quote 2、url 2、type 2；
- Home 差异恰好为 quote 1、url 1、type 1；
- 其他字段、showcase、数量和隐私检查无变化；
- 旧 Visions 157 个源文件前后不变。

## 执行

计划模式：

```powershell
node scripts/replace-archive-data-v2-visions-live-compatible.mjs
```

真实替换：

```powershell
node scripts/replace-archive-data-v2-visions-live-compatible.mjs --execute --authorization "I authorize Visions live-compatible JSON replacement"
```

执行前在系统临时目录备份两个 JSON。任一写入或验证失败会自动恢复。

## 写后验证

- `node scripts/check-public-data-shape.mjs`
- `node scripts/check-generated-data-privacy.mjs`
- `npm run build`
- Git diff 只能包含两个派生 JSON 的预期字段修正。

## 回退

提交前可用 Git 恢复两个派生 JSON；脚本也保留系统临时备份。不得修改旧 OneDrive Data。
