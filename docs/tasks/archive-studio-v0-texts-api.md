# 任务：Archive Studio Texts 受控 API

创建日期：2026-06-20
状态：后端已完成，页面待接入

## 1. 接口

- `POST /api/studio/texts/preview`
- `POST /api/studio/texts/preflight`
- `POST /api/studio/texts/create`
- `POST /api/studio/checks/texts-v2`

profiles 同时公开 article、book_note、series_note 的 create 能力，不公开 update、delete 或 publish。

## 2. 写入边界

- 只创建一个新 Texts 条目；
- 不覆盖已有目录或文件；
- preflight token 绑定 board、entry id 和完整 payload；
- token 短时有效且只能使用一次；
- book_note 接收一个 cover，其他 kind 不接受素材；
- staging、checksum、transaction manifests、写后 Texts shape 和旧源快照；
- 失败返回阶段和 rollback 状态。

## 3. 隔离验证

`node scripts/check-archive-studio-v0-texts-server.mjs` 在系统临时目录验证：

- 三个 Texts profiles；
- article preview / preflight / create；
- book_note 缺 cover 阻断；
- token 重放阻断；
- 已有目标冲突阻断；
- manifest 写入故障后完整 rollback；
- Texts v2 shape 通过；
- 源目录未变化；
- publish 路由不存在。

## 4. 禁止

- 不修改旧 OneDrive Data；
- 不编辑或删除已有 Texts；
- 不运行 `build_archive.py`；
- 不修改 public 数据；
- 不提供发布接口。

## 5. 下一步

实现独立的中文 Texts 新建页面，接入 profile、preview、preflight、create 和 Texts v2 检查。

