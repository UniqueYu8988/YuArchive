# Archive Studio 轻量编辑设计

## 用户流程

每个板块沿用现有单页表单，仅增加紧凑的 `新建 / 修改` 切换。

```text
选择“修改”
→ 搜索已有条目
→ 选择条目并回填原表单
→ 修改字段或选择替换素材
→ 生成差异预览
→ 运行 preflight
→ 保存到 Archive
→ 显式同步到公开网页
```

## 不可修改

- 稳定 entry ID；
- board 与 kind；
- 旧 OneDrive Data；
- Visions showcase、Games DLC / live game / season；
- 删除、批量编辑或自动发布。

## 素材规则

- 修改模式默认保留现有素材，不要求重新选择文件；
- 选择新文件时只替换对应角色；
- 扩展名变化时，旧素材进入事务备份，新素材使用标准角色名；
- UI 不显示本机完整路径。

## 差异预览

预览只显示：

- 修改了哪些字段；
- Markdown 是否改变；
- 哪些素材保持或替换；
- 目标相对路径；
- 是否存在待公开同步。

## 事务

更新事务必须：

1. 读取并校验当前条目；
2. 锁定 stable ID / board / kind；
3. 备份所有将覆盖或删除的文件；
4. staging 新内容并校验 checksum；
5. 写入条目；
6. 运行对应 v2 shape check；
7. 确认旧 OneDrive Data 摘要不变；
8. 写入 pending public update 标记；
9. 失败时恢复全部备份。

公开同步使用 pending 标记定位原公开条目，因此标题、年份改变也不会被误判为新增。
