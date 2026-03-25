# 📖 YuArchive (v3.0) - 数字赛博避难所

**“在数据的废墟中，重建属于我的主观记录。无所谓他人的百科，只关乎我的足迹。”**

<div align="center">
  <img src="./public/archive_demo.webp" alt="YuArchive Interactive Showcase" width="800" style="border-radius: 14px; box-shadow: 0 20px 40px rgba(0,0,0,0.4);" />
</div>

YuArchive 是一座基于 React + Vite 的多维情感档案库，采用极其纯粹且解耦的前后端分离架构。前端只负责极致的皇家黑白极简与毛玻璃拟态渲染，后端由极度集成的 Python 引擎统领全量数据的“压缩脱水”。

---

## 🚀 核心飞跃：架构大重构

### 1. 终极数据引擎 (`build_archive.py`)

我们彻底清除了昔日杂乱的转换脚本。由 `build_archive.py` 全权统筹：

- **智能增量压制**：通过源文件的修改时间戳 (`st_mtime`)，完美实现只处最新的素材！
- **LANCZOS 悬停裁剪**：通过原生 Python PIL 引入最高质量等比例中心位 `600x900` 采样。强制截断多余尺寸，只填补 `(0,0,0,0)` 的透明底边，让画面纯净无拉伸。
- **静态脱水**：自动生成的 `archive_data.json` 会与所有生成的 `.webp` 并行扔进 `/public` 文件夹，实现部署的开箱即飞！

### 2. Visions (光影混合长卷)

将陈旧分类（Movies / Animes）砸碎合并，重新塑形为最自然的三维情感优先级序列：

1. **最高级**: `cinema: true` (在黑暗的电影院里，留下过实体票根和感动的心跳，必定霸屏登顶！)
2. **第二级**: 电影 (`movie`)
3. **最底层**: 番剧 (`tv`)

### 3. Yu Series 设计范式

- 拒绝粗劣明亮色系，采用 `rgba(10,10,15,0.9)` 极致赛博黑底色。
- 取消干涩的背景变色，全部更替为超逼格的 `blur(12px)` 内发紫光 (`#a855f7`) 的动态悬浮毛玻璃体验。
- Hover 图片的瞬间，那一句句深埋于 `meta.yaml` 的灵魂简评（Quote）如幽灵般浮现——这是一场极客才懂的赛博浪漫。

---

## 🛠️ 部署指南 (Netlify 专属极简版)

前端早已拔除了跨域痛点。只要你有 OneDrive 和本地 Python：

1. 往 `OneDrive/Data backup/` 丢进你的素材或改写 `meta.yaml`。
2. 运行 `build_archive.py`（或双击极乐偷懒版 `一键发布到云端.bat`）。
3. 稍等一秒钟，看到“打包脱水完成”。
4. `git push` 给云端库，完毕！Netlify 会在一分钟后为你全图点亮世界的尽头。

---

// Special thanks to my cyber sweetheart, the soul of Yu Series. 💍🚀💖
