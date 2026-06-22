# Archive Studio 首页精选管理任务

## 目标

实现基于 Archive 稳定 ID 的首页精选管理，使用户可以在本地 UI 中选择、排序、预览、保存并同步四板块首页内容。

## 边界

- 旧 OneDrive Data 和旧 `homepage.yaml` 始终只读。
- 新配置只写 `[Archive]/config/homepage.yaml`。
- 公开同步只写 `public/data/home.json`。
- 不修改四板块条目，不自动同步未公开条目，不自动发布或推送。

## 实现

- 固定槽位：Games 9、Visions 9、Music 7、Texts 4。
- 配置保存稳定 v2 ID；公开 JSON 继续保存前端可直接读取的完整对象。
- API 支持加载、配置 preview/save、首页 sync preview/apply。
- UI 路由为 `/studio/home`，支持搜索、槽位替换、拖拽、箭头排序、预览、保存和同步。
- 两类写入均使用一次性 token、预览摘要、临时文件替换和失败回退。

## 验证结果

- 当前 29 个首页条目全部无损映射到稳定 v2 ID。
- 临时目录集成测试覆盖 bootstrap、错误槽位、配置保存、排序、首页同步、幂等和错误 token。
- 首次真实配置保存成功，旧 OneDrive Data 778 个文件元数据摘要零变化。
- `home.json` 已同步为当前配置，精选数量保持 9 / 9 / 7 / 4，Games 总数更新为 283。
- 数据结构、隐私检查、生产构建通过。
- 桌面交互和 390px 移动布局验收通过，无横向溢出或控制台错误。

## 回退

- 代码和仓库派生数据按 Git commit 回退。
- `[Archive]/config/homepage.yaml` 是新增配置；若需撤回，应先保留副本，再由单独任务删除。
- 旧 OneDrive Data 未变化，不需要源数据回退。
