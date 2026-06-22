# 任务：Archive Studio v0 只读页面壳

创建日期：2026-06-19
状态：已完成

## 1. 目标

实现 Archive Studio v0 的第一版用户可见页面，只支持 `music / album / create`。

本任务建立独立入口、表单、素材选择、Markdown 输入和写入预览，但不连接真实写入。

## 2. 允许范围

- 新增 Archive Studio React 页面和局部样式；
- 在现有路由中增加 `/studio`；
- 增加进入 Studio 的导航按钮；
- 在浏览器内完成字段校验、entry id 建议和相对路径预览；
- 读取用户主动选择的文件名、扩展名和大小摘要；
- 更新当前状态和稳定化计划；
- 运行 TypeScript / Vite 构建和浏览器验收。

## 3. 禁止范围

- 不写 Archive；
- 不修改旧 OneDrive Data；
- 不运行 `build_archive.py`；
- 不修改 `public/data`、`src/data` 或缓存；
- 不实现真实 create；
- 不实现发布或 Git API；
- 不上传素材到网络；
- 不显示完整本机路径；
- 不做 AI 自动补全。

## 4. 页面能力

- 固定 profile：`music / album / create`；
- 字段：title、date/year、url、note、entry id、content Markdown；
- 素材：cover、audio；
- 状态：pristine、dirty、preview-ready；
- 校验：必填项、entry id、文件扩展名；
- 预览：目标相对目录、文件角色、覆盖状态和待接入检查；
- `Create entry` 按钮保持禁用。

## 5. 验证方式

```powershell
npm run build
```

随后在桌面和移动视口检查：

- `/studio` 可访问；
- 页面无横向溢出或内容重叠；
- 表单输入、Reset 和 Generate preview 可用；
- 未选择必需素材时显示错误；
- preview 只显示相对路径；
- `Create entry` 始终禁用；
- 浏览器控制台无错误。

## 6. 回退方式

- 删除新增的 Archive Studio 页面和样式；
- 回退 `src/App.tsx` 的路由和导航入口；
- 回退状态文档；
- 不涉及任何数据回退。

## 7. 验证结果

- `npm run build` 通过；
- `/studio` 桌面视口显示双栏编辑器和 sticky preview；
- 390px 移动视口无横向溢出；
- 移动端公开展馆提示不会覆盖 Studio；
- title 输入可生成 entry id 建议和相对目标路径；
- 缺少 cover / audio 时 preview 正确阻断；
- `Create entry` 始终禁用；
- 浏览器控制台错误为 0；
- 未写 Archive，未修改 OneDrive Data、`public/data` 或 `src/data`。

## 8. 下一步建议

下一步实现只监听本机的 Archive Studio Node 服务，先提供 profiles、preview、preflight 和 Music v2 shape check API。真实 create 继续保持关闭。
