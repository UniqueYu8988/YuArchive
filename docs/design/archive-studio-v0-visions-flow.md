# Archive Studio Visions 新建流程

创建日期：2026-06-20
状态：preview core 与受控 API 已完成，中文页面待接入

## 1. 第一版范围

- 只新建普通 `movie` 或 `series`；
- 不编辑、删除已有条目；
- 不创建或编辑 showcase；
- 不自动查询影视元数据；
- 不自动寻找 poster；
- 不自动生成 quote；
- 不自动生成 public JSON；
- 不发布，不写旧 OneDrive Data。

## 2. 用户流程

```text
选择 Visions
→ 选择 movie / series
→ 选择 period
→ 填写 title、cinema、quote、url
→ 选择 poster
→ 生成 preview
→ 运行 preflight
→ 创建 entry.yaml + poster
→ 运行 Visions v2 shape check
→ 显示结果
```

## 3. 表单字段

| 字段 | 要求 |
|---|---|
| title | 必填 |
| kind | movie / series，必填 |
| period | 五个现有 period 之一，必填 |
| cinema | 布尔开关 |
| quote | 可选 |
| url | 可选；填写时必须为 HTTP(S) |
| poster | 必填；JPG、PNG、WebP 或 AVIF |

系统生成 id、board、目标路径和事务 manifest。新建条目不填写 legacy。

## 4. API

- `POST /api/studio/visions/preview`
- `POST /api/studio/visions/preflight`
- `POST /api/studio/visions/create`
- `POST /api/studio/checks/visions-v2`

create 只接受一次性 preflight token 和与 preview 一致的 poster 文件名。

## 5. 写入范围

```text
entries/visions/<movie|series>/<vision-id>/
├─ entry.yaml
└─ poster.<ext>
```

另创建本次事务的 preview、write 和 rollback manifest。任何冲突都阻断，不允许覆盖。

## 6. 后续顺序

1. preview core 自检；
2. API 临时目录集成测试；
3. 中文页面与 board tab；
4. 真实 create + rollback smoke test；
5. 真实 UI create + rollback；
6. 最后才讨论是否保留用户真实新条目。
