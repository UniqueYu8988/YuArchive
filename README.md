# YuArchive

YuArchive 是一个以个人记忆、兴趣轨迹和主观注释为核心的数字档案网站。  
它不是把内容直接写死在前端里，而是把 `OneDrive` 中长期维护的原始素材，经过本地构建脚本转译成静态网页可消费的数据，再同步到 GitHub 并触发部署。

## 项目定位

这个项目的目标不是做一个“百科式资料库”，而是做一座属于 Yu 自己的数字避难所：

- 记录游戏、影视、音乐、文本等长期兴趣轨迹
- 让内容维护和前端展示彼此解耦
- 让新增内容的成本尽量接近“往 OneDrive 丢素材”
- 通过一次构建，把原始素材转成网页可直接使用的静态资源

## 当前网页特色

### 1. 首页不是普通导航页，而是滚动海报墙

首页 [`src/pages/HomePage.tsx`](./src/pages/HomePage.tsx) 采用多行横向滚动的游戏海报阵列，营造一种“记忆流不断掠过”的视觉感。  
最近两年的内容会被自动优先放到前排，这样每次补档后首页都会自然显得更新鲜，不需要手动调整年份逻辑。

### 2. 四大内容板块已经形成稳定结构

- `Games`：按年份/阶段组织的时间线收藏
- `Visions`：融合电影与番剧的统一光影长卷
- `Music`：以 Markdown 为源的专辑与曲目档案
- `Texts`：以 Markdown 为源的短文、摘录与思考记录

这四个板块共用一份结构化数据源 [`src/data/archive_data.json`](./src/data/archive_data.json)，前端只负责展示，不直接参与原始内容维护。

### 3. 视觉语言统一且有辨识度

当前站点延续了 YuArchive 的核心美学：

- 黑白极简为主，辅以克制的霓虹感高光
- 固定导航栏 + 毛玻璃质感
- 大量使用卡片、海报、时间线、渐隐动效
- 亮暗主题切换
- 首页与各内容页都强调“沉浸感优先，而不是信息面板化”

对应的全局样式集中在 [`src/index.css`](./src/index.css)。

### 4. Visions 板块具备内容优先级系统

[`build_archive.py`](./build_archive.py) 会读取 `Visions` 下的 YAML 元数据，并在前端 [`src/pages/Visions.tsx`](./src/pages/Visions.tsx) 中实现更细腻的排序和展示：

- `cinema: true` 的作品优先级最高
- `movie` 高于 `tv`
- `quote` 会作为悬停文案显示
- `url` 作为外部跳转入口

这意味着 Visions 不是单纯图片陈列，而是一套“带情绪标记的观看档案”。

### 5. Music 与 Texts 已经支持从原始文档自动构建

目前 `Music` 和 `Texts` 都是从 Markdown 直接生成：

- `Music` 会解析 frontmatter 和正文曲目列表
- `Texts` 会解析标题、日期、标签和正文内容
- 构建脚本会把这些内容转成前端页面能直接消费的 JSON

也就是说，后续大部分内容更新都不需要改 React 代码，优先改 OneDrive 中的源文件即可。

## 项目文件管理规则

这是当前项目最重要的一条规则：

### 唯一内容源

真正的源文件都放在：

`C:\Users\Yu\OneDrive\图片\Data`

这里是整个项目的内容主仓，不是 GitHub 仓库。

它下面目前有四个主目录：

- `Games`
- `Visions`
- `Music`
- `Texts`

你真正日常维护的是这里面的图片、Markdown、YAML 等文件。

### 网页仓库的职责

当前仓库：

`C:\Users\Yu\AI\Archive`

不是原始素材库，而是“构建层 + 展示层”。

它负责：

1. 读取 OneDrive 中的内容源
2. 对图片做压缩 / 转码 / 标准化输出
3. 把元数据整理成结构化 JSON
4. 用 React + Vite 渲染为最终网页
5. 通过 GitHub 推送触发远端部署

### 关键结论

可以把整个系统理解成下面这条单向流水线：

`OneDrive 原始档案 -> build_archive.py 构建 -> archive_data.json + webp_cache -> React 前端展示 -> git push -> GitHub/Netlify 部署`

所以：

- OneDrive 管内容
- Python 管转译
- React 管展示
- GitHub 管发布

## 当前更新逻辑

### 1. 在 OneDrive 中维护原始内容

你新增或修改的第一现场始终是：

`C:\Users\Yu\OneDrive\图片\Data`

典型操作包括：

- 给 `Games` 某个年份目录新增海报图
- 在 `Visions` 中新增图片并更新 `meta.yaml`
- 在 `Music` 中新增 Markdown 和封面
- 在 `Texts` 中新增 Markdown 文章

### 2. 运行构建脚本

核心脚本是：

[`build_archive.py`](./build_archive.py)

它会做几件关键事情：

- 扫描 `Games / Visions / Music / Texts`
- 将图片转为 `.webp`
- 把结果输出到 `public/webp_cache`
- 生成最新的 [`src/data/archive_data.json`](./src/data/archive_data.json)
- 记录校验信息，例如：
  - Music 是否缺封面
  - Texts 日期是否仍是非标准格式
  - Visions 是否存在孤儿元数据

### 3. 一键更新脚本负责本地发布动作

当前一键脚本是：

[`一键发布到云端.bat`](./一键发布到云端.bat)

它的思路是：

1. 运行 `build_archive.py`
2. `git add` 生成后的静态资源和数据文件
3. 自动提交
4. 执行 `git push`

也就是说，这个 bat 本质上是把“构建 + 提交 + 推送”串起来。

### 4. GitHub 只承接发布结果

GitHub 仓库保存的是网页项目本身，以及经过构建后可以部署的静态结果。  
真正的内容原稿仍然在 OneDrive。

这就是为什么后续新增内容时，优先思路应该始终是：

先改 `OneDrive/Data`，再运行构建，再推送 GitHub。

## OneDrive 目录建议约定

为了让后续更新更稳定，建议保持下面这些规则。

### Games

- 每个年份或阶段一个文件夹，例如 `Game-2026`、`Game-Season`
- 文件夹里主要放一级图片文件
- 文件名直接作为作品标题来源

### Visions

- 按年份区间分目录
- 图片文件名要和 YAML 顶层标题尽量一致
- `quote / url / cinema / type` 通过 YAML 提供
- 避免标题末尾多空格，否则容易出现“孤儿元数据”

### Music

- 每张专辑/主题内容使用一个 Markdown 文件
- frontmatter 中可写 `title / cover / description`
- 封面建议放在 `Music/Covers/`，并尽量使用与 Markdown 同名的图片

### Texts

- 每篇文章一个 Markdown 文件
- frontmatter 建议至少包含：
  - `title`
  - `date`
  - `tags`
- 推荐将 `date` 统一成 `YYYY-MM-DD`

目前脚本已经兼容部分旧格式，但统一后续维护会更稳。

## 当前构建层能力

截至目前，构建层已经支持：

- 增量跳过未变化图片
- 自动输出 `webp`
- 从旧路径或 `Music/Covers/` 智能找回封面
- 规范化 `Texts` 排序日期
- 在 JSON 中生成校验摘要
- 自动清除构建前遗留的异常文本项影响

这意味着现在项目已经不只是“能生成页面”，而是开始具备“内容校验器”的能力。

## 本地开发

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

### 重新构建归档数据

```bash
python -X utf8 build_archive.py
```

### 构建前端

```bash
npm run build
```

## 推荐维护习惯

后续继续迭代时，建议始终按这个顺序工作：

1. 在 `OneDrive\Data` 中维护内容
2. 运行 `build_archive.py`
3. 本地预览网页是否正常
4. 再提交并推送 GitHub
5. 最后继续做前端功能更新

这样可以避免“前端改好了，但底层内容组织越来越乱”的问题。

## 下一阶段功能方向

基于当前结构，后续很适合继续做这些增强：

- Texts 标签筛选 / 全文搜索
- Music 的专辑筛选、封面聚合视图
- 首页最近更新摘要
- 可视化展示构建校验报告
- 更完整的内容维护说明页

---

YuArchive 的核心不是“网页本身”，而是这套能长期维护的个人数字档案工作流。  
只要 `OneDrive -> 构建 -> GitHub -> 部署` 这条链路继续稳定，这个站就会越来越像你自己的记忆操作系统。
