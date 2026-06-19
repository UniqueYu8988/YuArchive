# 任务：Archive Studio v0 Music Album 受控创建 API

创建日期：2026-06-20
状态：实现完成，最终验收待完成

## 1. 目标

把已验证的 Music Album preview、preflight、transaction 和 Music v2 shape check 接成一个本地创建闭环，使 Archive Studio 可以创建单个 `music/album` 条目。

## 2. 范围

- 只支持 `music / album / create`；
- 只写 ArchiveData-v2；
- 使用一次性、短时有效且绑定 payload 的 preflight token；
- 通过 multipart 接收一个 cover 和一个 audio；
- 创建 `entry.yaml`、`content.md`、cover、audio 和 transaction manifests；
- 所有条目文件使用 create-only 写入，不覆盖已有文件；
- 写后运行 Music v2 shape check，并确认旧 OneDrive Data 元数据快照未变化；
- 失败时自动清理本次创建内容，并向 UI 返回失败阶段和 rollback 状态。

## 3. 明确不做

- 不编辑或删除已有条目；
- 不写旧 OneDrive Data；
- 不运行 `build_archive.py`；
- 不提供 Git、构建、发布或自动发布接口；
- 不做 AI 补全、素材搜索、自动分类或简介生成。

## 4. 接口

- `GET /api/studio/profiles`
- `POST /api/studio/music/album/preview`
- `POST /api/studio/music/album/preflight`
- `POST /api/studio/music/album/create`
- `POST /api/studio/checks/music-v2`

服务只监听 `127.0.0.1`。create 必须携带同一 payload 的有效 preflight token 和与 preview 文件名一致的素材。

## 5. 验证

`node scripts/check-archive-studio-v0-server.mjs` 在系统临时目录验证：

- profiles 只开放 create，不开放 publish；
- preview 和 preflight 通过；
- multipart create 创建四个条目文件和三个 transaction 文件；
- 素材字节与提交内容一致；
- token 重放被阻断；
- 已有目标冲突被阻断；
- 注入 manifest 路径故障后，条目写入被完整 rollback；
- 源目录基线未变化；
- Music v2 shape check 通过；
- publish 路由不存在。

同时运行 `npm run build`，验证 React 页面类型检查和生产构建。

## 6. 回退

- 回退 create core、server、server checker 和 Studio 页面改动；
- 删除本任务文档；
- 已成功创建的正式条目不通过代码回退自动删除，应按对应 transaction rollback manifest 单独审查处理。

## 7. 剩余验收

- 在可用的应用内浏览器环境复核桌面和移动布局、按钮状态和控制台；
- 使用用户确认的真实 title、cover、audio 和 content 完成一次保留新条目的完整 create 验收。

