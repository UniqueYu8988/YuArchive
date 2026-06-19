# 任务：Archive Studio Texts preview core

创建日期：2026-06-20
状态：已完成

## 目标

在接入 API 和页面前，建立 Texts 三个 kind 的纯 preview 规则、规范化字段、目标相对路径和安全断言。

## 检查

- mode / board / kind；
- `text-YYYYMMDD-xxxxxxxx` id；
- title 和非空 content；
- section-kind 固定映射；
- article / series_note 完整日期；
- book_note 日期可空且 cover 必需；
- cover 扩展名；
- tags 去空去重；
- 只允许 create，不允许覆盖；
- 目标路径不得逃逸 `entries/texts/`。

## 验证

```powershell
node scripts/check-archive-studio-v0-texts-preview-core.mjs
```

覆盖 article、book_note、series_note、非法 payload 和路径安全。脚本不写文件。

验证结果：三个 kind 的合法 payload 通过；非法 id、缺标题、空正文、section-kind 不匹配、非法日期和缺 book cover 均正确阻断。

## 回退

删除 preview core、自检和 Texts Studio 设计文档；不涉及数据回退。
