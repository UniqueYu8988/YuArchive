# Archive Studio Games 新建流程

创建日期：2026-06-20
状态：preview core 与受控 API 已完成，中文页面待接入

## 1. 第一版范围

- 只新建 `normal_game`；
- 不创建 DLC、live game 或 season；
- 不编辑、删除已有条目；
- 不自动查询 Steam；
- 不自动生成 english title、链接、价格或分类；
- 不生成 public JSON；
- 不发布，不写旧 OneDrive Data。

## 2. 用户流程

```text
选择 Games
→ 填写 title 与 year
→ 选择是否启用增强元数据
→ 可选填写 english title、url、platform、price、rating、playtime、completed、genre
→ 选择 cover
→ 生成 preview
→ 运行 preflight
→ 创建 entry.yaml + cover
→ 运行 Games v2 shape check
→ 显示结果
```

## 3. 表单字段

| 字段 | 要求 |
|---|---|
| title | 必填 |
| year | 必填，1900–2100 整数 |
| metadata enabled | 默认开启 |
| english title | metadata 开启时可选 |
| url | 可选；填写时必须 HTTP(S) |
| platform | metadata 开启时必选现有枚举 |
| price | 可选文本 |
| rating | 可选，0–5 整数 |
| playtime | 可选文本 |
| completed | 布尔开关 |
| genre | 可选现有枚举 |
| cover | 必填；JPG、PNG、WebP 或 AVIF |

系统生成 id、board、kind、目标路径和事务 manifest。metadata 关闭时不保存增强字段。

## 4. API

- `POST /api/studio/games/preview`
- `POST /api/studio/games/preflight`
- `POST /api/studio/games/create`
- `POST /api/studio/checks/games-v2`

create 只接受一次性 preflight token 和与 preview 一致的 cover 文件名。

## 5. 写入范围

```text
entries/games/normal_game/<game-id>/
├─ entry.yaml
└─ cover.<ext>
```

另创建本次事务的 preview、write 和 rollback manifest。任何冲突都阻断，不允许覆盖。

## 6. 后续顺序

1. preview core 自检；（已完成）
2. API 临时目录集成测试；（已完成）
3. 中文页面与 board tab；
4. 真实 create + rollback smoke test；
5. 页面与 API 链路验收；
6. 最后才讨论是否保留用户真实新条目。
