# 任务：Archive Studio v0 本地只读 API

创建日期：2026-06-19
状态：已完成

## 1. 目标

为 Archive Studio v0 提供第一版本地 Node 服务，使前端能够调用现有 preview、preflight 和 Music v2 检查能力。

## 2. 接口

- `GET /api/studio/profiles`
- `POST /api/studio/music/album/preview`
- `POST /api/studio/music/album/preflight`
- `POST /api/studio/checks/music-v2`

## 3. 安全边界

- 只监听 `127.0.0.1`；
- 只接受 JSON；
- 限制请求体大小；
- 不返回完整本机路径；
- 不提供 create、update、delete、Git、构建或发布接口；
- preview 不写文件；
- preflight 只读检查 Archive 目标状态；
- Music v2 check 只返回结构计数和规则结果；
- 不读取或修改旧 OneDrive Data。

## 4. 前端联调

- Vite 将 `/api/studio` 代理到本地 Node 服务；
- Studio 页面启动时读取 profiles；
- Generate preview 调用 preview API；
- Run preflight 调用 preflight API；
- 检查结果显示在页面中；
- `Create entry` 继续保持禁用。

## 5. 验证方式

- preview core 自检；
- API profiles / preview / preflight / music-v2 请求；
- 非法 payload 返回安全错误；
- 不存在的路由返回 404；
- `npm run build`；
- 浏览器完成表单到 preview / preflight 的只读流程；
- 对 Archive 和 OneDrive Data 做运行前后只读基线核对。

## 6. 回退方式

- 删除本地 API 服务脚本；
- 回退 Vite proxy 和 package scripts；
- 回退 Studio 页面的 API 接入；
- 不涉及数据回退。

## 7. 验证结果

- preview core 自检通过；
- profiles、合法 preview、非法 preview、preflight、Music v2 check 和 404 场景均通过；
- API 静态写入标记检查通过；
- 服务只监听 `127.0.0.1`，所有响应保持 `writeEnabled: false` / `writeScope: none`；
- Music v2 shape check 通过：33 个 entry，0 malformed，0 privacy rule hit；
- TypeScript app / node 配置检查通过；
- 浏览器确认本地 API online；
- 浏览器确认缺 cover / audio 时 preview 阻断；
- 浏览器确认 Music v2 check 为 33 entries / 0 malformed；
- 390px 移动视口无横向溢出，控制台错误为 0；
- `Create entry` 仍保持禁用；
- 未写 Archive，未读取或修改旧 OneDrive Data。

## 8. 下一步建议

下一步进入真实写入前验收，复核 allowlist、冲突阻断、manifest / rollback、隐私规则和旧 OneDrive Data 只读边界；仍不立即启用 create。

## 9. 后续状态

本任务记录的是只读 API 阶段。2026-06-20 已在通过真实 create + rollback smoke test 后，按 `docs/tasks/archive-studio-v0-create-api.md` 将本地服务扩展为受控 `music/album/create`；本任务原有“无 create 接口”结论不再代表当前运行状态。
