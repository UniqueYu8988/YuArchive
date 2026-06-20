# Archive Studio Texts 新建流程

创建日期：2026-06-20
状态：第一版闭环已完成

## 1. 定位

Archive Studio Texts 第一版只新建 ArchiveData-v2 文本，不编辑旧条目，不写旧 OneDrive Data，不生成或发布网页数据。

支持：

- board：`texts`；
- kind：`article`、`book_note`、`series_note`；
- preview、preflight、create-only、写后 Texts v2 检查。

## 2. 用户流程

```text
选择 Texts
→ 选择 kind
→ 选择对应 section
→ 填写标题和 kind 字段
→ 填写 Markdown 正文
→ book_note 选择封面
→ 生成预览
→ 运行预检
→ 创建条目
→ 显示 Texts v2 检查结果
```

## 3. kind 表单

### article

- title：必填；
- section：`reference-info` 或 `miscellany`；
- date：必填，`YYYY-MM-DD`；
- summary：可选；
- tags：可选；
- content：必填。

### series_note

- title：必填；
- section：`headline` 或 `bedtime-news`；
- date：必填，`YYYY-MM-DD`；
- summary：可选；
- tags：可选；
- content：必填。

### book_note

- title：必填；
- section：固定 `book-reviews`；
- date：可选；
- author：可选；
- summary：可选；
- cover：必填；
- content：必填。

## 4. 系统生成

- board 固定为 `texts`；
- id 为 `text-YYYYMMDD-xxxxxxxx`，草稿创建时生成一次；
- 目标目录由 kind 和 id 生成；
- 不允许覆盖；
- tags 去空和去重；
- legacy 对新建条目默认为空。

## 5. 按钮状态

- `生成预览`：本地校验后调用 preview API；
- `运行预检`：preview 通过后可用；
- `创建条目`：preflight token 有效时可用；
- 修改任意字段后旧 preview 和 token 立即失效；
- create 成功后显示相对路径、总数、结构检查、旧源状态和未发布状态。

## 6. 不做

- 编辑、删除、批量导入；
- AI 摘要、改写、分类或标签建议；
- 自动封面搜索；
- 自动生成 public JSON；
- Git、构建或发布。

## 7. 后端草案

- `POST /api/studio/texts/preview`
- `POST /api/studio/texts/preflight`
- `POST /api/studio/texts/create`
- `POST /api/studio/checks/texts-v2`

接口只监听本机，create 需要一次性 preflight token。book_note 使用 multipart cover；其他 kind 不接受素材。

## 8. 页面验收

- `/studio/texts` 已接入音乐 / 文本板块切换；
- article、book_note、series_note 三种表单按 kind 显示对应字段和栏目；
- 文章表单已在浏览器完成 preview 和 preflight，未执行真实 create；
- preflight 通过前创建按钮保持禁用，修改表单后旧 token 会失效；
- 390px 移动视口无横向溢出，kind 选择器切换为单列；
- `npm run build`、Texts API 检查和既有 Music API 回归均通过。
- 真实 create + rollback runner 已通过，临时条目从 132 增至 133 后恢复 132；
- 真实中文页面已完成 preview、preflight、create 和成功反馈端到端验收；
- UI 验收条目已按事务清单回退，条目与事务残留为 0，ArchiveData-v2 和旧源快照恢复一致。
