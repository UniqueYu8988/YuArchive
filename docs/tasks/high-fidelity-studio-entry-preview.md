# Archive Studio 高保真条目预览

## 目标

- 将 Archive Studio 中的模拟预览替换为公开网站实际使用的展示组件。
- 第一轮覆盖 Visions、Games、Music、Texts 四个板块。
- 表单与本地素材变化应即时反映在预览中。
- 提供轻量放大查看，不把完整公开页面嵌入管理工具。

## 设计边界

- 公开网站与 Archive Studio 继续保持独立入口和独立构建边界。
- 只共享条目级展示组件，不把 Studio 路由重新放回公开站。
- Visions 与 Games 复用实际海报卡；Music 默认复用当前专辑展示，放大时补充专辑卡；Texts 根据条目类型复用普通条目卡或书架卡。
- 本地待上传素材只通过浏览器临时 URL 预览，不写入 Archive、旧 Data 或派生 JSON。

## 禁止范围

- 不修改 `C:\Users\Yu\OneDrive\图片\Archive` 或旧 `Data`。
- 不运行生成、发布或 Git 写入流程。
- 不修改 `public/data`、`src/data`、缓存或 reports。
- 不借本任务扩展 Studio 的写入机制、数据规则或自动化能力。

## 验证

- TypeScript 类型检查通过。
- 公开 Games、Visions、Music、Texts 页面仍使用共享后的实际组件。
- Studio 四板块在桌面和窄屏下无横向溢出，预览不会撑高主要表单。
- 本地图片和音频选择后可以即时预览；预览交互不会触发保存或外部跳转。
- 放大层可通过按钮和 Escape 关闭。

## 回退

- 回退共享展示组件的导出与 Studio 引用。
- 删除本任务新增的预览容器与放大层组件。
- 恢复 Studio 原有模拟预览标记和局部样式；数据与源文件无需回退。

## 实施结果

- Games / Visions 已直接复用公开站海报组件，并兼容 Studio 的本地临时图片地址。
- Music 已建立实际当前专辑展示组件和共享专辑卡；侧栏按真实宽度缩放，放大层同时展示两种形态并保留音频试听。
- Texts 已将公开条目头部和书架封面抽成共享组件，Studio 按 `book_note` / 其他类型自动选择预览。
- 所有板块统一使用轻量放大层；放大层覆盖固定顶栏和底部操作栏，可通过 Escape 关闭。
- 修改模式的只读详情补充公开缩略图引用，不传递本机路径，也不扩大写入能力。
- `npx tsc --noEmit`、`node scripts/check-archive-studio-updates.mjs` 和桌面 / 390px 浏览器验收通过；未运行生成或发布流程。
