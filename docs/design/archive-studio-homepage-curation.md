# Archive Studio 首页精选管理

## 定位

首页精选管理用于选择和排序已经存在于 Archive、并已同步到公开板块 JSON 的条目。它不创建收藏条目，不修改旧 OneDrive Data 的 `homepage.yaml`，也不触发发布。

## v0 槽位

| 板块 | 配置键 | 固定数量 | 顺序含义 |
|---|---|---:|---|
| Games | `games_ids` | 9 | 从左到右、从上到下 |
| Visions | `visions_ids` | 9 | 从左到右、从上到下 |
| Music | `music_ids` | 7 | 第 1 项为主展示，其余为列表 |
| Texts | `texts_ids` | 4 | 第 1 项为主展示，其余为列表 |

第一版固定数量，避免改变现有首页构图。后续如需改变槽位数量，应先做响应式页面验收。

## 配置文件

新配置位于 `[Archive]/config/homepage.yaml`：

```yaml
version: 1
games_ids: ["stable-v2-id", "..."]
visions_ids: ["stable-v2-id", "..."]
music_ids: ["stable-v2-id", "..."]
texts_ids: ["stable-v2-id", "..."]
```

- ID 必须是 Archive 条目目录的稳定 ID。
- 同一板块不允许重复 ID。
- ID 必须能映射到当前公开板块 JSON；尚未执行板块公开同步的条目不能进入首页。
- `public/data/home.json` 仍保存完整公开条目对象，运行时前端无需读取 v2 配置。

## 用户流程

```text
打开 /studio/home
→ 加载四板块候选和当前选择
→ 搜索并替换槽位内容
→ 上移 / 下移调整顺序
→ 预览四板块首页结果
→ 运行 preflight
→ 保存 homepage.yaml
→ 显式同步 public/data/home.json
→ 打开首页验收
```

## 写入边界

保存配置只写 `[Archive]/config/homepage.yaml`。公开同步只写 `public/data/home.json`。两步均使用 preview 摘要、一次性 token、临时文件替换和失败回退。

不会修改：

- 旧 OneDrive Data 与旧 `homepage.yaml`；
- 四个板块的 v2 条目；
- `public/data/games.json`、`visions.json`、`music.json`、`texts.json`；
- 公开媒体；
- Git、发布脚本或远端部署。

## 验收

- 当前首页 29 个选择可无损映射到稳定 v2 ID。
- 配置保存后重新读取完全一致。
- 首页 JSON 的 counts 来自四个公开板块总数，精选对象来自对应公开 JSON。
- 重复同步为 already-current。
- 无效、重复、未公开或数量错误的 ID 被 preflight 阻断。
- 失败写入恢复原配置或原 `home.json`。
