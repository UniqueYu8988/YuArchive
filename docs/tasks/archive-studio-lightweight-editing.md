# Archive Studio 轻量编辑任务

## 目标

在现有 Music、Texts、Visions、Games 表单中增加简单、安全的已有条目修改能力，不引入复杂后台页面。

## 允许

- 读取和受控更新 Archive 普通条目；
- 保留或替换现有素材；
- 写 update transaction、backup、rollback 和 pending public update 标记；
- 显式同步对应公开 JSON / 媒体。

## 禁止

- 修改旧 OneDrive Data；
- 修改稳定 ID、board 或 kind；
- 删除或批量编辑；
- 编辑 Visions showcase、Games DLC / live game / season；
- 自动发布或 Git push。

## 验证

- 四板块临时目录 update + rollback 测试；
- keep-existing 与 replace asset 场景；
- 标题 / 年份改变后公开同步仍更新原条目；
- token 重放和 stale preview 被阻断；
- 四板块原 create API 回归；
- 桌面与移动浏览器流程验收。

## 结果

- 四板块 list / detail / preview / preflight / apply 均通过系统临时目录集成测试；
- stable public ID 替换、单素材替换并保留其他素材、token 重放阻断和故障 rollback 均通过；
- 原有四板块 create API、公开同步、首页精选、v2 shape、隐私检查和生产构建回归通过；
- Music、Texts、Visions、Games 桌面修改流程通过，五个 Studio 路由在 390px 视口无横向溢出；
- 本任务未修改旧 OneDrive Data，浏览器验收未保存真实条目，也未执行真实公开同步。

## 回退

update 失败由事务恢复；已成功更新需按 transaction backup 执行单独回退任务。代码按 Git commit 回退。
