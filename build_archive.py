#!/usr/bin/env python3
"""
build_archive.py — Yu Archive 终极静默构建脚本
=============================================
功能：
1. 画像转换引擎：增量读取 OneDrive，将其等比缩放、透明留白为标准海报尺寸 (600x900)，输出为 WEBP。
2. 数据抽水池：解析分类下的 Markdown/YAML 元数据，生成前端完全依赖的 archive_data.json。
3. 结构脱水：全部提取并输出至 public/ 目录下，实现部署和源文件的彻底无损分离。
"""

import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
try:
    from PIL import Image
    # 屏蔽 PIL 内部的最大图片像素警告
    Image.MAX_IMAGE_PIXELS = None
except ImportError:
    print("❌ 错误：缺少 PIL 库。请先执行 `pip install Pillow`")
    sys.exit(1)

# ── 核心常量配置区 ─────────────────────────────────────────────────────
ONEDRIVE_DATA_ROOT = Path(r"C:\Users\Yu\OneDrive\图片\Data backup")
PUBLIC_ROOT = Path(r"C:\Users\Yu\AI\Archive\public")
WEBP_CACHE_DIR = PUBLIC_ROOT / "webp_cache"
JSON_OUTPUT_PATH = Path(r"C:\Users\Yu\AI\Archive\src\data\archive_data.json")

WEBP_QUALITY = 90
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}
TEXT_EXTENSIONS = {".md", ".txt"}

CATEGORIES = {
    "games": "Games",
    "visions": "Visions",
    "music": "Music",
    "texts": "Texts",
}
# ──────────────────────────────────────────────────────────────────────


def is_image(path: Path) -> bool:
    return path.suffix.lower() in IMAGE_EXTENSIONS

def human_size(bytes_: int) -> str:
    for unit in ('B', 'KB', 'MB', 'GB'):
        if bytes_ < 1024: return f"{bytes_:.1f} {unit}"
        bytes_ /= 1024
    return f"{bytes_:.1f} GB"

def process_and_get_webp_path(src_img_path: Path, category_key: str) -> str:
    """
    智能图像处理管道：增量判断，若需处理则执行转码及留白裁剪。
    返回能够被前端直接使用的从 public/ 开始的相对路径，如 'webp_cache/Games/...webp'。
    """
    if not src_img_path.exists():
        return ""
        
    rel_path = src_img_path.relative_to(ONEDRIVE_DATA_ROOT)
    dst_webp_path = WEBP_CACHE_DIR / rel_path.with_suffix('.webp')
    
    needs_crop = category_key in ("games", "visions")
    
    # 智能跳过验证：目标文件存在 && 非空 && 目标文件的修改时间没落后于源文件
    if dst_webp_path.exists() and dst_webp_path.stat().st_size > 0:
        if dst_webp_path.stat().st_mtime >= src_img_path.stat().st_mtime:
            return f"webp_cache/{rel_path.with_suffix('.webp').as_posix()}"
            
    # 执行深度转码
    dst_webp_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with Image.open(src_img_path) as img:
            # 透明通道处理
            img = img.convert('RGBA')
            
            if needs_crop:
                target_w, target_h = 600, 900
                img_w, img_h = img.size
                scale = min(target_w / img_w, target_h / img_h)
                new_w, new_h = int(img_w * scale), int(img_h * scale)
                
                # 双线性或 Lanczos 重采样
                img_resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                
                # 生成透明纯净大底画框
                new_img = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
                
                paste_x, paste_y = (target_w - new_w) // 2, (target_h - new_h) // 2
                new_img.paste(img_resized, (paste_x, paste_y))
                img = new_img
                
            img.save(dst_webp_path, 'WEBP', quality=WEBP_QUALITY, method=6)
            
            # 手游：盖下原图的时间戳戳记，断点续传完美免疫
            stat = src_img_path.stat()
            os.utime(dst_webp_path, (stat.st_atime, stat.st_mtime))
            print(f"      🖨️  [压制成功] {rel_path.name} -> .webp")
    except Exception as e:
        print(f"      ⚠️  [压制抛错] {src_img_path.name}: {e}")
        
    return f"webp_cache/{rel_path.with_suffix('.webp').as_posix()}"


# ─────────────────────────────────────────────────────────────
# 📦 Markdown / YAML 纯原生引擎
# ─────────────────────────────────────────────────────────────

def extract_year_from_folder(folder_name: str) -> int | None:
    match = re.search(r'\b(19|20)\d{2}\b', folder_name)
    return int(match.group(0)) if match else None

def scan_images_in_folder(folder: Path) -> list:
    """搜寻该文件夹内部的一级文件，并将图像文件剥离出来"""
    if not folder.exists(): return []
    return [p for p in sorted(folder.iterdir()) if p.is_file() and is_image(p)]


def parse_markdown_with_frontmatter(file_path: Path) -> dict:
    metadata = {"title": file_path.stem, "date": "1970-01-01", "tags": []}
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except Exception as e:
        return {"metadata": metadata, "content": ""}

    in_frontmatter, body_start_idx = False, 0
    if lines and lines[0].strip() == "---":
        in_frontmatter = True
        body_start_idx = 1
        for i in range(1, len(lines)):
            line = lines[i].strip()
            if line == "---":
                in_frontmatter = False
                body_start_idx = i + 1
                break
            if in_frontmatter and ":" in line:
                key, val = [x.strip() for x in line.split(":", 1)]
                key = key.lower()
                if (val.startswith("'") and val.endswith("'")) or (val.startswith('"') and val.endswith('"')):
                    val = val[1:-1]
                if key == "tags":
                    if val.startswith("[") and val.endswith("]"): val = val[1:-1]
                    metadata["tags"] = [t.strip() for t in val.split(",") if t.strip()]
                else:
                    metadata[key] = val

    if in_frontmatter: body_start_idx = 0
    return {"metadata": metadata, "content": "".join(lines[body_start_idx:]).strip()}


def parse_visions_meta_yamls(visions_root: Path) -> dict:
    result = {}
    if not visions_root.exists(): return result

    for meta_file in visions_root.rglob("*.yaml"):
        current_title = None
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                for line in f.readlines():
                    stripped = line.rstrip()
                    if not stripped or stripped.startswith("#"): continue

                    if not line.startswith(" ") and not line.startswith("\t"):
                        current_title = stripped.rstrip(":")
                        if (current_title.startswith('"') and current_title.endswith('"')) or \
                           (current_title.startswith("'") and current_title.endswith("'")):
                            current_title = current_title[1:-1]
                        result[current_title] = {"cinema": False, "quote": "", "url": "", "type": "movie"}
                    elif current_title and ":" in stripped:
                        key, _, val = stripped.lstrip().partition(":")
                        key, val = key.strip().lower(), val.strip()
                        if (val.startswith("'") and val.endswith("'")) or (val.startswith('"') and val.endswith('"')):
                            val = val[1:-1]

                        if key == "cinema": result[current_title]["cinema"] = val.lower() in ("true", "yes", "1")
                        elif key == "quote": result[current_title]["quote"] = val
                        elif key == "url": result[current_title]["url"] = val
                        elif key == "type": result[current_title]["type"] = val
        except Exception:
            pass
    return result


# ─────────────────────────────────────────────────────────────
# 🚀 四大类别深库扫描
# ─────────────────────────────────────────────────────────────

def process_timeline_category(root: Path, category_key: str) -> dict:
    category_name = CATEGORIES[category_key]
    category_root = root / category_name
    print(f"\n📂 [1/4] 扫描 {category_name} (时间线架构)...")

    if not category_root.exists():
        return {"key": category_key, "display_name": category_name, "total_count": 0, "sort_mode": "timeline", "years": []}

    year_map = {}
    for sub_folder in sorted(category_root.iterdir()):
        if not sub_folder.is_dir(): continue
        year = extract_year_from_folder(sub_folder.name) or 0
        images = scan_images_in_folder(sub_folder)
        if not images: continue

        if year not in year_map:
            year_map[year] = {"year": year, "folder": sub_folder.name, "items": []}

        for img_path in images:
            file_stem = img_path.stem
            # 在这里处理转码压缩逻辑
            webp_url = process_and_get_webp_path(img_path, category_key)
            
            year_map[year]["items"].append({
                "id": f"{category_key}_{year}_{len(year_map[year]['items'])}",
                "image_path": webp_url,
                "title": file_stem,
                "cinema": False,
                "quote": "",
                "url": "",
                "type": "game"
            })

    sorted_years = sorted(year_map.values(), key=lambda y: y["year"] if y["year"] != 0 else -1, reverse=True)
    return {
        "key": category_key, "display_name": category_name,
        "total_count": sum(len(y["items"]) for y in sorted_years),
        "sort_mode": "timeline", "years": sorted_years
    }


def process_visions_category(root: Path) -> dict:
    print(f"\n📂 [2/4] 扫描 Visions (光影混合架构)...")
    visions_root = root / "Visions"
    
    if not visions_root.exists():
        return {"key": "visions", "display_name": "Visions", "total_count": 0, "sort_mode": "timeline", "years": []}

    year_map = {}
    meta_map = parse_visions_meta_yamls(visions_root)
    
    for sub_folder in sorted(visions_root.iterdir()):
        if not sub_folder.is_dir(): continue

        year = extract_year_from_folder(sub_folder.name) or 0
        images = scan_images_in_folder(sub_folder)
        if not images: continue

        if year not in year_map:
            year_map[year] = {"year": year, "folder": sub_folder.name, "items": []}

        for img_path in images:
            file_stem = img_path.stem
            meta_entry = meta_map.get(file_stem, {})
            item_type = meta_entry.get("type", "movie")
            
            webp_url = process_and_get_webp_path(img_path, "visions")
            
            year_map[year]["items"].append({
                "id": f"{item_type}_{year}_{len(year_map[year]['items'])}",
                "image_path": webp_url,
                "title": file_stem,
                "cinema": meta_entry.get("cinema", False),
                "quote":  meta_entry.get("quote", ""),
                "url":    meta_entry.get("url", ""),
                "type":   item_type,
            })

    sorted_years = sorted(year_map.values(), key=lambda y: y["year"] if y["year"] != 0 else -1, reverse=True)
    return {
        "key": "visions", "display_name": "Visions",
        "total_count": sum(len(y["items"]) for y in sorted_years),
        "sort_mode": "timeline", "years": sorted_years
    }


def process_music_category(root: Path) -> dict:
    """处理律动板块。虽然不带年份，但也会提取所有 Cover，并将封面转 WebP 压缩"""
    print(f"\n📂 [3/4] 扫描 Music (黑胶原声排版)...")
    cat_root = root / CATEGORIES["music"]

    if not cat_root.exists():
        return {"key": "music", "display_name": "Music", "total_count": 0, "sort_mode": "music", "items": []}

    items = []
    for item in cat_root.rglob("*"):
        if item.is_file() and item.suffix.lower() in TEXT_EXTENSIONS:
            meta = parse_markdown_with_frontmatter(item)
            cover_url = ""
            cover_filename = meta["metadata"].get("cover", "")
            
            if cover_filename:
                possible_cover = item.parent / cover_filename
                if possible_cover.exists():
                    cover_url = process_and_get_webp_path(possible_cover, "music")

            items.append({
                "id": f"music_{len(items)}",
                "title": meta["metadata"].get("title", item.stem),
                "cover": cover_url,
                "description": meta["metadata"].get("description", ""),
                "content": meta["content"]
            })

    return {
        "key": "music", "display_name": "Music",
        "total_count": len(items), "sort_mode": "music", "items": items
    }


def process_texts_category(root: Path) -> dict:
    print(f"\n📂 [4/4] 扫描 Texts (纯文本解析引擎)...")
    cat_root = root / CATEGORIES["texts"]

    if not cat_root.exists():
        return {"key": "texts", "display_name": "Texts", "total_count": 0, "sort_mode": "text", "items": []}

    items = []
    for item in cat_root.rglob("*"):
        if item.is_file() and item.suffix.lower() in TEXT_EXTENSIONS:
            parsed = parse_markdown_with_frontmatter(item)
            items.append({
                "id": f"text_{len(items)}",
                "title": parsed["metadata"].get("title", item.stem),
                "date": parsed["metadata"].get("date", "1970-01-01"),
                "tags": parsed["metadata"].get("tags", []),
                "content": parsed["content"]
            })
            
    items.sort(key=lambda x: x["date"], reverse=True)
    return {
        "key": "texts", "display_name": "Texts",
        "total_count": len(items), "sort_mode": "text", "items": items
    }


# ─────────────────────────────────────────────────────────────
# 🚀 点火执行
# ─────────────────────────────────────────────────────────────

def main():
    print("=" * 65)
    print("  YuArchive 九九归一：极简数据引擎 (v3.0) 启动！")
    print(f"  根只读源：{ONEDRIVE_DATA_ROOT}")
    print(f"  前端靶区：{PUBLIC_ROOT}")
    print("=" * 65)

    if not ONEDRIVE_DATA_ROOT.exists():
        print(f"\n❌ [致命] 找不到源目录：{ONEDRIVE_DATA_ROOT}")
        sys.exit(1)

    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    WEBP_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    start_time = time.time()

    # 1. Pipeline 全部交由四大函数驱动
    data = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "version": "3.0.0",
            "source_root": str(ONEDRIVE_DATA_ROOT),
        },
        "categories": {
            "games":   process_timeline_category(ONEDRIVE_DATA_ROOT, "games"),
            "visions": process_visions_category(ONEDRIVE_DATA_ROOT),
            "music":   process_music_category(ONEDRIVE_DATA_ROOT),
            "texts":   process_texts_category(ONEDRIVE_DATA_ROOT),
        }
    }

    # 2. 将最终注入好的纯净态数据写入目标点
    JSON_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(JSON_OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"❌ [致命] 写入 {JSON_OUTPUT_PATH.name} 全盘失败：{e}")
        sys.exit(1)

    total_time = time.time() - start_time
    total_items = sum(c["total_count"] for c in data["categories"].values())
    
    print("\n" + "=" * 65)
    print("  🎉 打包脱水完成，所有数据已绝对硬塞入前端！")
    print(f"  📌 WebP 转码区: {WEBP_CACHE_DIR}")
    print(f"  📌 结构输出区: {JSON_OUTPUT_PATH}")
    print(f"  📊 总项目数：{total_items} 项")
    print(f"  ⏱  总耗时：{total_time:.2f} 秒")
    print("=" * 65)


if __name__ == '__main__':
    main()
