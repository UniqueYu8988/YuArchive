# ArchiveData-v2 Visions 规则草案

创建日期：2026-06-20
状态：只读审计后草案，迁移前需确认 type / kind 兼容策略

## 1. 定位

Visions v2 保存影视条目和角色橱窗的可维护源结构。旧 OneDrive Data 继续只读保留；本草案不授权迁移、写入、live JSON 替换或 Archive Studio 接入。

## 2. kind

建议第一版只使用：

| board | kind | 用途 |
|---|---|---|
| visions | movie | 单部电影、电影短片 |
| visions | series | 旧 `type: tv` 的剧集与动画 |
| visions | showcase | 角色橱窗专题 |

第一版不拆 `anime` 与真人剧。当前源数据没有足够字段稳定支持更细分类；未来如需要，可新增 display subtype，不应改动稳定 kind。

## 3. 普通条目目录

```text
entries/visions/<kind>/<entry-id>/
├─ entry.yaml
├─ content.md
└─ poster.<ext>
```

`content.md` 第一版可为空或不创建。旧 Visions 当前只有 quote，没有独立正文；不要为了统一形式自动生成描述。

## 4. 普通条目字段

```yaml
id:
board: visions
kind: movie | series
title:
period:
cinema: false
quote:
url:
legacy:
  type:
  synthetic_year:
  source_group:
```

规则：

- `id` 必须稳定，迁移阶段按源相对路径生成短哈希；新建阶段使用日期加随机短 ID；
- `period` 必须保留 `开端 / 前尘 / 旧影 / 未远 / 此岸`，这是用户维护的展示分组；
- `cinema`、`quote`、`url` 继续由用户维护；
- `poster` 必填；
- v2 `kind: series` 对应旧 `type: tv`；
- 旧 `type` 和当前合成年份只进入 legacy 或兼容生成层；
- 关联元数据时使用分组和源相对路径，禁止全局 title join。

## 5. showcase 目录

```text
entries/visions/showcase/<showcase-id>/
├─ entry.yaml
└─ characters/
   └─ <character-id>/
      ├─ character.yaml
      ├─ avatar.<ext>
      └─ clip.<ext>
```

showcase `entry.yaml`：

```yaml
id:
board: visions
kind: showcase
title:
description:
```

`character.yaml`：

```yaml
id:
title:
caption:
```

规则：

- 角色 ID 必须稳定，不能只依赖数组位置；
- avatar 和 clip 都是必填媒体；
- 原始 GIF 应逐字节保留，live-compatible 层可以继续生成缓存媒体；
- 角色顺序必须由 manifest 或显式 order 保存，不能依赖目录枚举顺序；
- showcase 与普通影视条目分别检查和生成。

## 6. live-compatible 输出

第一版输出继续保持当前契约：

- 普通条目输出 `id`、`image_path`、`title`、`cinema`、`quote`、`url`、`type`；
- `kind: movie` 输出 `type: movie`；
- `kind: series` 输出 `type: tv`；
- `period` 映射为当前 `years[].folder`；
- 合成年份仅用于兼容当前页面排序；
- showcase 输出 title、description 和 entries；
- 角色输出 id、title、caption、gif_path、avatar_path。

迁移 preview 必须同时报告：

- 111/111 普通条目映射；
- 20/20 角色映射；
- 重复标题跨分组数量；
- 源 type 与当前 live type 差异；
- ID、字段、分组顺序、角色顺序和媒体路径差异。

## 7. 用户确认项

迁移前只需确认三个问题：

1. v2 是否采用 `movie / series`，兼容输出再映射为 `movie / tv`；
2. 当前 2 个同名跨分组条目的 live 类型偏移，是保留现网页行为，还是以各自源 YAML 修正；
3. `period` 是否继续固定为五个叙事分组，并允许未来新增分组而不要求真实年份。

## 8. 下一步

下一任务只建立 Visions planner 和 shape checker：

- 只读规划 111 个普通条目、1 个 showcase、20 个角色及 151 个媒体文件；
- 不创建真实 v2 输出；
- 不修改旧源；
- 不替换 `public/data/visions.json`；
- 在用户确认三项规则前不执行迁移。
