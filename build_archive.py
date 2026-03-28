#!/usr/bin/env python3
"""
build_archive.py — Yu Archive 终极静默构建脚本
=============================================
功能：
1. 画像转换引擎：增量读取 OneDrive，将其等比缩放、透明留白为标准海报尺寸 (600x900)，输出为 WEBP。
2. 数据抽水池：解析分类下的 Markdown/YAML 元数据，生成前端完全依赖的 archive_data.json。
3. 结构脱水：全部提取并输出至 public/ 目录下，实现部署和源文件的彻底无损分离。
"""

import csv
import html
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import quote_plus
from urllib.request import Request, urlopen
try:
    from PIL import Image, ImageOps
    # 屏蔽 PIL 内部的最大图片像素警告
    Image.MAX_IMAGE_PIXELS = None
except ImportError:
    print("❌ 错误：缺少 PIL 库。请先执行 `pip install Pillow`")
    sys.exit(1)

# ── 核心常量配置区 ─────────────────────────────────────────────────────
ONEDRIVE_DATA_ROOT = Path(r"C:\Users\Yu\OneDrive\图片\Data")
PUBLIC_ROOT = Path(r"C:\Users\Yu\AI\Archive\public")
WEBP_CACHE_DIR = PUBLIC_ROOT / "webp_cache"
JSON_OUTPUT_PATH = Path(r"C:\Users\Yu\AI\Archive\src\data\archive_data.json")
REPORTS_ROOT = Path(r"C:\Users\Yu\AI\Archive\reports")
GAMES_INVENTORY_CSV_PATH = REPORTS_ROOT / "games_meta_inventory.csv"
GAMES_MISSING_ENGLISH_CSV_PATH = REPORTS_ROOT / "games_missing_english.csv"
GAMES_TODO_CSV_PATH = REPORTS_ROOT / "games_meta_todo.csv"
GAMES_TODO_MD_PATH = REPORTS_ROOT / "games_meta_todo.md"
STEAM_LOOKUP_CACHE_PATH = REPORTS_ROOT / "steam_lookup_cache.json"

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

DEFAULT_TEXT_DATE = "1970-01-01"
GAME_META_FILENAME = "meta.yaml"
GAME_META_SKIP_FOLDERS = {"Game-2010", "Game-2015", "Game-Season"}
GAME_PLATFORM_CHOICES = ("steam", "xbox", "riotgame", "battlenet", "playstation", "switch")
GAME_PLAYTIME_CHOICES = ("<1h", "<10h", "<50h", "<100h", ">100h")
GAME_GENRE_CHOICES = ("action", "rpg", "strategy", "shooter", "simulation", "sports", "racing", "puzzle", "casual")
GAME_TITLE_ALIASES = {
    "哈迪斯": "Hades",
    "哈迪斯2": "Hades II",
    "背包乱斗": "Backpack Battles",
    "霍格沃兹之遗": "Hogwarts Legacy",
    "恶意不息": "No Rest for the Wicked",
    "取景器": "Viewfinder",
    "小丑牌": "Balatro",
    "杀戮尖塔": "Slay the Spire",
    "星露谷物语": "Stardew Valley",
    "潜水员戴夫": "Dave the Diver",
    "空洞骑士": "Hollow Knight",
    "双人成行": "It Takes Two",
    "极限竞速：地平线 5": "Forza Horizon 5",
    "极限竞速：地平线 4": "Forza Horizon 4",
    "赛博朋克 2077": "Cyberpunk 2077",
    "赛博朋克 2077：往日之影": "Cyberpunk 2077",
    "女神异闻录 5 皇家版": "Persona 5 Royal",
    "女神异闻录 3 重制版": "Persona 3 Reload",
    "黑神话：悟空": "Black Myth: Wukong",
    "双影奇境": "Split Fiction",
    "禁闭求生": "Grounded",
    "火山的女儿": "Volcano Princess",
    "最终幻想 VII：重制版": "FINAL FANTASY VII REMAKE INTERGRADE",
    "最终幻想 VII：重生": "FINAL FANTASY VII REBIRTH",
}


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
                img = ImageOps.fit(img, (target_w, target_h), method=Image.Resampling.LANCZOS)
                
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

def extract_year_from_folder(folder_name: str) -> float | None:
    """
    从文件夹名称中提取年份。
    加入特判魔法：处理赛季/持续运营的特殊分类！
    """
    # 👑 特判：捕捉 Season 文件夹
    if "Season" in folder_name or "season" in folder_name:
        # 返回 9999 会让它永远在最顶端。
        # 如果你想让它视觉上排在 2026 年的正下方，请把这里改成返回 2025.5 
        return 2025.5

    match = re.search(r'(\d{4})', folder_name)
    if match:
        year = int(match.group(1))
        # 稍微放宽一点对未来年份的限制
        if 1970 <= year <= 2050:
            return float(year)
    return None

def scan_images_in_folder(folder: Path) -> list:
    """搜寻该文件夹内部的一级文件，并将图像文件剥离出来"""
    if not folder.exists(): return []
    return [p for p in sorted(folder.iterdir()) if p.is_file() and is_image(p)]


def normalize_title(value: str) -> str:
    return value.strip()


def unquote_yaml_value(value: str) -> str:
    if (value.startswith("'") and value.endswith("'")) or (value.startswith('"') and value.endswith('"')):
        return value[1:-1]
    return value


def yaml_string(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def parse_bool(value: str) -> bool:
    return value.strip().lower() in {"true", "yes", "1"}


def parse_game_rating(value: str) -> int | None:
    stripped = (value or "").strip()
    if not stripped:
        return None
    try:
        rating = int(float(stripped))
    except ValueError:
        return None
    if 0 <= rating <= 5:
        return rating
    return None


def looks_like_english_title(value: str) -> bool:
    stripped = normalize_title(value)
    return bool(stripped) and bool(re.fullmatch(r"[A-Za-z0-9 '&:!?.,+\-/()_]+", stripped))


def contains_cjk(value: str) -> bool:
    return bool(re.search(r"[\u3400-\u9fff]", value))


def guess_game_english_title(title: str) -> str:
    if title in GAME_TITLE_ALIASES:
        return GAME_TITLE_ALIASES[title]
    if looks_like_english_title(title):
        return title
    return ""


def load_steam_lookup_cache() -> dict:
    if not STEAM_LOOKUP_CACHE_PATH.exists():
        return {}
    try:
        return json.loads(STEAM_LOOKUP_CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_steam_lookup_cache(cache: dict):
    REPORTS_ROOT.mkdir(parents=True, exist_ok=True)
    STEAM_LOOKUP_CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def resolve_report_output_path(target: Path, report: dict) -> Path:
    try:
        if target.exists():
            with open(target, "a", encoding="utf-8"):
                pass
        return target
    except PermissionError:
        fallback = target.with_name(f"{target.stem}.latest{target.suffix}")
        report.setdefault("games_report_fallback_paths", {})[str(target)] = str(fallback)
        return fallback


def http_get_text(url: str) -> str:
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=12) as resp:
        return resp.read().decode("utf-8", "ignore")


def map_steam_genre(raw_genres: list[str]) -> str:
    normalized = [g.lower() for g in raw_genres]
    if any("rpg" in g or "role-playing" in g for g in normalized):
        return "rpg"
    if any("strategy" in g for g in normalized):
        return "strategy"
    if any("racing" in g for g in normalized):
        return "racing"
    if any("sports" in g for g in normalized):
        return "sports"
    if any("simulation" in g for g in normalized):
        return "simulation"
    if any("shooter" in g or "fps" in g for g in normalized):
        return "shooter"
    if any("puzzle" in g for g in normalized):
        return "puzzle"
    if any("casual" in g for g in normalized):
        return "casual"
    if any("action" in g or "adventure" in g for g in normalized):
        return "action"
    return ""


def fetch_steam_metadata(query: str, cache: dict, report: dict) -> dict | None:
    cache_key = query.strip().lower()
    if not cache_key:
        return None
    if cache_key in cache:
        return cache[cache_key] or None

    try:
        suggest_url = f"https://store.steampowered.com/search/suggest?term={quote_plus(query)}&f=games&cc=cn&realm=1&l=english"
        suggest_html = http_get_text(suggest_url)
        app_match = re.search(r'data-ds-appid="(\d+)"', suggest_html)
        name_match = re.search(r'<div class="match_name">(.*?)</div>', suggest_html)
        if not app_match:
            cache[cache_key] = None
            return None

        app_id = app_match.group(1)
        fallback_name = html.unescape(name_match.group(1)).strip() if name_match else query
        details_url = f"https://store.steampowered.com/api/appdetails?appids={app_id}&cc=cn&l=english"
        details = json.loads(http_get_text(details_url))
        data = details.get(app_id, {}).get("data", {})
        if not data:
            cache[cache_key] = None
            return None

        price = ""
        if data.get("is_free"):
            price = "Free"
        elif data.get("price_overview"):
            price = data["price_overview"].get("initial_formatted") or data["price_overview"].get("final_formatted") or ""

        genres = [genre.get("description", "") for genre in data.get("genres", []) if genre.get("description")]
        result = {
            "english_title": data.get("name") or fallback_name,
            "url": f"https://store.steampowered.com/app/{app_id}/",
            "price": price,
            "genre": map_steam_genre(genres),
            "steam_appid": app_id,
        }
        cache[cache_key] = result
        report["games_steam_autofill_hits"] += 1
        return result
    except Exception:
        cache[cache_key] = None
        report["games_steam_autofill_misses"] += 1
        return None


def default_game_meta() -> dict:
    return {
        "english_title": "",
        "url": "",
        "platform": "steam",
        "price": "",
        "rating": "",
        "playtime": "",
        "completed": False,
        "genre": "",
    }


def parse_game_meta_yaml(meta_file: Path) -> dict:
    result = {}
    if not meta_file.exists():
        return result

    current_title = None
    try:
        with open(meta_file, "r", encoding="utf-8") as f:
            for raw_line in f.readlines():
                line = raw_line.rstrip()
                stripped = line.strip()
                if not stripped or stripped.startswith("#"):
                    continue

                if not line.startswith((" ", "\t")) and stripped.endswith(":"):
                    current_title = normalize_title(unquote_yaml_value(stripped[:-1].strip()))
                    result[current_title] = default_game_meta()
                    continue

                if current_title and ":" in stripped:
                    key, _, value = stripped.partition(":")
                    key = key.strip().lower()
                    value = unquote_yaml_value(value.strip())
                    if key == "completed":
                        result[current_title]["completed"] = parse_bool(value)
                    else:
                        result[current_title][key] = value
    except Exception:
        return {}

    return result


def build_game_meta_template_content(image_titles: list[str], meta_map: dict) -> str:
    lines = [
        "# YuArchive Games 元数据模板",
        "# 可选 platform: steam / xbox / riotgame / battlenet / playstation / switch",
        "# 可选 playtime: <1h / <10h / <50h / <100h / >100h",
        "# 可选 genre: action / rpg / strategy / shooter / simulation / sports / racing / puzzle / casual",
        "",
    ]

    ordered_titles = []
    seen = set()
    for title in image_titles:
        if title not in seen:
            ordered_titles.append(title)
            seen.add(title)
    for title in sorted(meta_map):
        if title not in seen:
            ordered_titles.append(title)
            seen.add(title)

    for title in ordered_titles:
        entry = default_game_meta()
        entry.update(meta_map.get(title, {}))
        lines.extend([
            f"{yaml_string(title)}:",
            f"  english_title: {yaml_string(str(entry.get('english_title', '')))}",
            f"  url: {yaml_string(str(entry.get('url', '')))}",
            f"  platform: {yaml_string(str(entry.get('platform', 'steam') or 'steam'))}",
            f"  price: {yaml_string(str(entry.get('price', '')))}",
            f"  rating: {yaml_string(str(entry.get('rating', '')))}",
            f"  playtime: {yaml_string(str(entry.get('playtime', '')))}",
            f"  completed: {'true' if entry.get('completed') else 'false'}",
            f"  genre: {yaml_string(str(entry.get('genre', '')))}",
            "",
        ])

    return "\n".join(lines).rstrip() + "\n"


def sync_game_meta_template(folder: Path, image_titles: list[str], report: dict, steam_cache: dict) -> dict:
    meta_file = folder / GAME_META_FILENAME
    existing = parse_game_meta_yaml(meta_file)
    merged = {}

    for title in image_titles:
        entry = default_game_meta()
        entry.update(existing.get(title, {}))
        platform = str(entry.get("platform", "steam") or "steam").strip().lower()
        entry["platform"] = platform if platform in GAME_PLATFORM_CHOICES else "steam"
        entry["english_title"] = normalize_title(str(entry.get("english_title", "")))
        entry["url"] = str(entry.get("url", "")).strip()
        entry["price"] = str(entry.get("price", "")).strip()
        rating = parse_game_rating(str(entry.get("rating", "")))
        entry["rating"] = "" if rating is None else rating
        playtime = str(entry.get("playtime", "")).strip()
        entry["playtime"] = playtime if playtime in GAME_PLAYTIME_CHOICES else ""
        genre = str(entry.get("genre", "")).strip().lower()
        entry["genre"] = genre if genre in GAME_GENRE_CHOICES else ""
        entry["completed"] = bool(entry.get("completed"))

        if title not in GAME_TITLE_ALIASES and not looks_like_english_title(title) and contains_cjk(entry["english_title"]):
            entry["english_title"] = ""
            entry["url"] = ""
            entry["price"] = ""
            entry["genre"] = ""

        suggested_english_title = guess_game_english_title(title)

        if entry["platform"] == "steam":
            steam_query = entry["english_title"] or (title if looks_like_english_title(title) else "")
            steam_meta = fetch_steam_metadata(steam_query, steam_cache, report) if steam_query else None
            if steam_meta:
                if not entry["url"]:
                    entry["url"] = steam_meta.get("url", "")
                if not entry["price"]:
                    entry["price"] = steam_meta.get("price", "")
                if not entry["genre"]:
                    entry["genre"] = steam_meta.get("genre", "")

        merged[title] = entry
        report["games_meta_inventory"].append({
            "folder": folder.name,
            "title": title,
            "english_title": entry["english_title"],
            "suggested_english_title": suggested_english_title,
            "platform": entry["platform"],
            "genre": entry["genre"],
            "rating": entry["rating"],
            "playtime": entry["playtime"],
            "price": entry["price"],
            "completed": entry["completed"],
            "url": entry["url"],
            "has_english_title": bool(entry["english_title"]),
            "has_url": bool(entry["url"]),
            "has_price": bool(entry["price"]),
            "has_genre": bool(entry["genre"]),
            "has_rating": entry["rating"] not in ("", None),
            "has_playtime": bool(entry["playtime"]),
            "has_completed": True,
        })

        missing = []
        for field in ("english_title", "price", "rating", "playtime", "genre"):
            if entry[field] in ("", None):
                missing.append(field)
        if not entry["url"]:
            missing.append("url")
        if missing:
            report["games_meta_todo"].append({
                "folder": folder.name,
                "title": title,
                "english_title": entry["english_title"],
                "platform": entry["platform"],
                "genre": entry["genre"],
                "rating": entry["rating"],
                "playtime": entry["playtime"],
                "price": entry["price"],
                "completed": entry["completed"],
                "url": entry["url"],
                "suggested_english_title": suggested_english_title,
                "search_hint": f"https://store.steampowered.com/search/?term={quote_plus(entry['english_title'] or title)}",
                "missing": missing,
            })

    content = build_game_meta_template_content(image_titles, merged)
    previous = meta_file.read_text(encoding="utf-8") if meta_file.exists() else None
    if previous != content:
        meta_file.write_text(content, encoding="utf-8")
        report["games_meta_templates_updated"].append(str(meta_file))

    return merged


def resolve_game_url(title: str, meta_entry: dict) -> str:
    explicit_url = str(meta_entry.get("url", "")).strip()
    if explicit_url:
        return explicit_url

    if meta_entry.get("platform") == "steam":
        query = meta_entry.get("english_title") or title
        return f"https://store.steampowered.com/search/?term={quote_plus(str(query))}"

    return ""


def export_games_todo_reports(report: dict):
    REPORTS_ROOT.mkdir(parents=True, exist_ok=True)
    inventory_items = sorted(report["games_meta_inventory"], key=lambda item: (item["folder"], item["title"]))
    todo_items = sorted(report["games_meta_todo"], key=lambda item: (item["folder"], item["title"]))
    inventory_csv_path = resolve_report_output_path(GAMES_INVENTORY_CSV_PATH, report)
    missing_english_csv_path = resolve_report_output_path(GAMES_MISSING_ENGLISH_CSV_PATH, report)
    todo_csv_path = resolve_report_output_path(GAMES_TODO_CSV_PATH, report)
    todo_md_path = resolve_report_output_path(GAMES_TODO_MD_PATH, report)
    report["games_report_outputs"] = {
        "inventory_csv": str(inventory_csv_path),
        "missing_english_csv": str(missing_english_csv_path),
        "todo_csv": str(todo_csv_path),
        "todo_md": str(todo_md_path),
    }

    with open(inventory_csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "folder",
                "title",
                "english_title",
                "suggested_english_title",
                "platform",
                "genre",
                "rating",
                "playtime",
                "price",
                "completed",
                "url",
                "has_english_title",
                "has_url",
                "has_price",
                "has_genre",
                "has_rating",
                "has_playtime",
                "missing_fields",
            ],
        )
        writer.writeheader()
        for item in inventory_items:
            missing_fields = []
            if not item["has_english_title"]:
                missing_fields.append("english_title")
            if not item["has_url"]:
                missing_fields.append("url")
            if not item["has_price"]:
                missing_fields.append("price")
            if not item["has_genre"]:
                missing_fields.append("genre")
            if not item["has_rating"]:
                missing_fields.append("rating")
            if not item["has_playtime"]:
                missing_fields.append("playtime")
            writer.writerow({
                "folder": item["folder"],
                "title": item["title"],
                "english_title": item["english_title"],
                "suggested_english_title": item["suggested_english_title"],
                "platform": item["platform"],
                "genre": item["genre"],
                "rating": item["rating"],
                "playtime": item["playtime"],
                "price": item["price"],
                "completed": "true" if item["completed"] else "false",
                "url": item["url"],
                "has_english_title": "yes" if item["has_english_title"] else "no",
                "has_url": "yes" if item["has_url"] else "no",
                "has_price": "yes" if item["has_price"] else "no",
                "has_genre": "yes" if item["has_genre"] else "no",
                "has_rating": "yes" if item["has_rating"] else "no",
                "has_playtime": "yes" if item["has_playtime"] else "no",
                "missing_fields": ", ".join(missing_fields),
            })

    missing_english = [item for item in inventory_items if not item["has_english_title"]]
    with open(missing_english_csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["folder", "title", "suggested_english_title", "platform", "url", "search_hint"],
        )
        writer.writeheader()
        for item in missing_english:
            writer.writerow({
                "folder": item["folder"],
                "title": item["title"],
                "suggested_english_title": item["suggested_english_title"],
                "platform": item["platform"],
                "url": item["url"],
                "search_hint": f"https://store.steampowered.com/search/?term={quote_plus(item['suggested_english_title'] or item['title'])}",
            })

    with open(todo_csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "folder",
                "title",
                "english_title",
                "suggested_english_title",
                "platform",
                "genre",
                "rating",
                "playtime",
                "price",
                "completed",
                "url",
                "search_hint",
                "missing_fields",
            ],
        )
        writer.writeheader()
        for item in todo_items:
            writer.writerow({
                "folder": item["folder"],
                "title": item["title"],
                "english_title": item["english_title"],
                "suggested_english_title": item["suggested_english_title"],
                "platform": item["platform"],
                "genre": item["genre"],
                "rating": item["rating"],
                "playtime": item["playtime"],
                "price": item["price"],
                "completed": "true" if item["completed"] else "false",
                "url": item["url"],
                "search_hint": item["search_hint"],
                "missing_fields": ", ".join(item["missing"]),
            })

    folder_summary: dict[str, dict[str, int]] = {}
    field_summary: dict[str, int] = {}
    for item in todo_items:
        folder_info = folder_summary.setdefault(item["folder"], {"count": 0})
        folder_info["count"] += 1
        for field in item["missing"]:
            folder_info[field] = folder_info.get(field, 0) + 1
            field_summary[field] = field_summary.get(field, 0) + 1

    lines = [
        "# Games Metadata TODO",
        "",
        f"- Total tracked items: {len(inventory_items)}",
        f"- Total pending items: {len(todo_items)}",
        f"- Missing english titles: {len(missing_english)}",
        f"- Skipped folders: {', '.join(report['games_meta_skipped_folders']) if report['games_meta_skipped_folders'] else 'None'}",
        f"- Inventory export: `{inventory_csv_path}`",
        f"- Missing english export: `{missing_english_csv_path}`",
        f"- CSV export: `{todo_csv_path}`",
        "",
        "## Missing Fields",
        "",
    ]

    for field, count in sorted(field_summary.items(), key=lambda entry: (-entry[1], entry[0])):
        lines.append(f"- `{field}`: {count}")

    lines.extend([
        "",
        "## By Folder",
        "",
    ])

    for folder, info in sorted(folder_summary.items()):
        lines.append(f"### {folder}")
        lines.append("")
        lines.append(f"- Pending games: {info['count']}")
        for field, count in sorted(((k, v) for k, v in info.items() if k != "count"), key=lambda entry: (-entry[1], entry[0])):
            lines.append(f"- `{field}`: {count}")
        lines.append("")

    lines.extend([
        "## First 20 Pending Entries",
        "",
    ])

    for item in todo_items[:20]:
        lines.append(
            f"- `{item['folder']}` | {item['title']} | missing: {', '.join(item['missing'])} | search: {item['search_hint']}"
        )

    todo_md_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def parse_markdown_with_frontmatter(file_path: Path) -> dict:
    metadata = {"title": file_path.stem, "date": DEFAULT_TEXT_DATE, "tags": []}
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
    metadata["title"] = normalize_title(str(metadata.get("title", file_path.stem) or file_path.stem))
    if isinstance(metadata.get("tags"), list):
        metadata["tags"] = [t.strip() for t in metadata["tags"] if t and t.strip()]
    return {"metadata": metadata, "content": "".join(lines[body_start_idx:]).strip()}


def normalize_text_date(raw_date: str, file_path: Path) -> tuple[str, str]:
    value = (raw_date or "").strip()
    if not value:
        return DEFAULT_TEXT_DATE, "missing"

    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            dt = datetime.strptime(value, fmt)
            return dt.strftime("%Y-%m-%d"), "full"
        except ValueError:
            pass

    for fmt in ("%m-%d", "%m/%d"):
        try:
            dt = datetime.strptime(value, fmt)
            year = datetime.fromtimestamp(file_path.stat().st_mtime).year
            normalized = datetime(year, dt.month, dt.day)
            return normalized.strftime("%Y-%m-%d"), "partial"
        except ValueError:
            pass

    return DEFAULT_TEXT_DATE, "invalid"


def find_music_cover(markdown_path: Path, cover_value: str, cat_root: Path) -> tuple[Path | None, str]:
    raw_value = (cover_value or "").strip()
    candidates: list[Path] = []

    if raw_value:
        raw_path = Path(raw_value)
        if raw_path.is_absolute():
            candidates.append(raw_path)
        else:
            candidates.append(markdown_path.parent / raw_value)
            candidates.append(cat_root / raw_value)
            candidates.append(cat_root / "Covers" / raw_value)

        if raw_path.name:
            candidates.append(markdown_path.parent / raw_path.name)
            candidates.append(cat_root / raw_path.name)
            candidates.append(cat_root / "Covers" / raw_path.name)

    stem = markdown_path.stem
    for ext in IMAGE_EXTENSIONS:
        candidates.append(markdown_path.with_suffix(ext))
        candidates.append(cat_root / "Covers" / f"{stem}{ext}")

    seen = set()
    for candidate in candidates:
        try:
            resolved = candidate.resolve(strict=False)
        except OSError:
            resolved = candidate
        normalized = str(resolved).lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        if candidate.exists() and candidate.is_file() and is_image(candidate):
            return candidate, raw_value

    return None, raw_value


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
                        current_title = normalize_title(stripped.rstrip(":"))
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

def process_timeline_category(root: Path, category_key: str, report: dict, steam_cache: dict | None = None) -> dict:
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
        image_titles = [normalize_title(img.stem) for img in images]
        game_meta = {}
        game_meta_enabled = False

        if category_key == "games":
            if sub_folder.name in GAME_META_SKIP_FOLDERS:
                report["games_meta_skipped_folders"].append(sub_folder.name)
            else:
                game_meta = sync_game_meta_template(sub_folder, image_titles, report, steam_cache or {})
                game_meta_enabled = True

        if year not in year_map:
            year_map[year] = {"year": year, "folder": sub_folder.name, "items": []}

        for img_path in images:
            file_stem = normalize_title(img_path.stem)
            # 在这里处理转码压缩逻辑
            webp_url = process_and_get_webp_path(img_path, category_key)
            meta_entry = game_meta.get(file_stem, default_game_meta()) if category_key == "games" else {}
            
            year_map[year]["items"].append({
                "id": f"{category_key}_{year}_{len(year_map[year]['items'])}",
                "image_path": webp_url,
                "title": file_stem,
                "cinema": False,
                "quote": "",
                "url": resolve_game_url(file_stem, meta_entry) if category_key == "games" else "",
                "type": "game",
                "game_meta_enabled": game_meta_enabled,
                "english_title": meta_entry.get("english_title", ""),
                "platform": meta_entry.get("platform", ""),
                "price": meta_entry.get("price", ""),
                "rating": meta_entry.get("rating", ""),
                "playtime": meta_entry.get("playtime", ""),
                "completed": meta_entry.get("completed", False),
                "genre": meta_entry.get("genre", ""),
            })

        if category_key == "games" and sub_folder.name not in GAME_META_SKIP_FOLDERS:
            year_map[year]["items"].sort(
                key=lambda item: (
                    not bool(item.get("completed")),
                    -(item.get("rating") or 0),
                    item["title"].lower(),
                )
            )

    sorted_years = sorted(year_map.values(), key=lambda y: y["year"] if y["year"] != 0 else -1, reverse=True)
    return {
        "key": category_key, "display_name": category_name,
        "total_count": sum(len(y["items"]) for y in sorted_years),
        "sort_mode": "timeline", "years": sorted_years
    }


def process_visions_category(root: Path, report: dict) -> dict:
    print(f"\n📂 [2/4] 扫描 Visions (光影混合架构)...")
    visions_root = root / "Visions"
    
    if not visions_root.exists():
        return {"key": "visions", "display_name": "Visions", "total_count": 0, "sort_mode": "timeline", "years": []}

    year_map = {}
    meta_map = parse_visions_meta_yamls(visions_root)
    used_meta_titles = set()
    
    for sub_folder in sorted(visions_root.iterdir()):
        if not sub_folder.is_dir(): continue

        year = extract_year_from_folder(sub_folder.name) or 0
        images = scan_images_in_folder(sub_folder)
        if not images: continue

        if year not in year_map:
            year_map[year] = {"year": year, "folder": sub_folder.name, "items": []}

        for img_path in images:
            file_stem = normalize_title(img_path.stem)
            meta_entry = meta_map.get(file_stem, {})
            if meta_entry:
                used_meta_titles.add(file_stem)
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

    orphan_titles = sorted(set(meta_map) - used_meta_titles)
    if orphan_titles:
        report["visions_orphan_meta"].extend(orphan_titles)

    sorted_years = sorted(year_map.values(), key=lambda y: y["year"] if y["year"] != 0 else -1, reverse=True)
    return {
        "key": "visions", "display_name": "Visions",
        "total_count": sum(len(y["items"]) for y in sorted_years),
        "sort_mode": "timeline", "years": sorted_years
    }


def process_music_category(root: Path, report: dict) -> dict:
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
            cover_path, raw_cover = find_music_cover(item, cover_filename, cat_root)

            if cover_path:
                try:
                    if cover_path.is_relative_to(ONEDRIVE_DATA_ROOT):
                        cover_url = process_and_get_webp_path(cover_path, "music")
                    else:
                        report["music_external_covers"].append(str(cover_path))
                except ValueError:
                    report["music_external_covers"].append(str(cover_path))
            else:
                report["music_missing_covers"].append({
                    "title": meta["metadata"].get("title", item.stem),
                    "file": str(item),
                    "cover": raw_cover,
                })

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


def process_texts_category(root: Path, report: dict) -> dict:
    print(f"\n📂 [4/4] 扫描 Texts (纯文本解析引擎)...")
    cat_root = root / CATEGORIES["texts"]

    if not cat_root.exists():
        return {"key": "texts", "display_name": "Texts", "total_count": 0, "sort_mode": "text", "items": []}

    items = []
    for item in cat_root.rglob("*"):
        if item.is_file() and item.suffix.lower() in TEXT_EXTENSIONS:
            parsed = parse_markdown_with_frontmatter(item)
            title = parsed["metadata"].get("title", item.stem)
            sort_date, date_status = normalize_text_date(parsed["metadata"].get("date", DEFAULT_TEXT_DATE), item)
            if date_status != "full":
                report["texts_date_issues"].append({
                    "title": title,
                    "file": str(item),
                    "raw_date": parsed["metadata"].get("date", ""),
                    "normalized_date": sort_date,
                    "status": date_status,
                })
            items.append({
                "id": f"text_{len(items)}",
                "title": title,
                "date": parsed["metadata"].get("date", DEFAULT_TEXT_DATE),
                "sort_date": sort_date,
                "tags": parsed["metadata"].get("tags", []),
                "content": parsed["content"]
            })

    items.sort(key=lambda x: (x["sort_date"], x["title"]), reverse=True)
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
    steam_cache = load_steam_lookup_cache()
    report = {
        "games_meta_skipped_folders": [],
        "games_meta_templates_updated": [],
        "games_meta_inventory": [],
        "games_meta_todo": [],
        "games_steam_autofill_hits": 0,
        "games_steam_autofill_misses": 0,
        "music_missing_covers": [],
        "music_external_covers": [],
        "texts_date_issues": [],
        "visions_orphan_meta": [],
    }

    # 1. Pipeline 全部交由四大函数驱动
    data = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "version": "3.0.0",
            "source_root": str(ONEDRIVE_DATA_ROOT),
            "validation": report,
        },
        "categories": {
            "games":   process_timeline_category(ONEDRIVE_DATA_ROOT, "games", report, steam_cache),
            "visions": process_visions_category(ONEDRIVE_DATA_ROOT, report),
            "music":   process_music_category(ONEDRIVE_DATA_ROOT, report),
            "texts":   process_texts_category(ONEDRIVE_DATA_ROOT, report),
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

    export_games_todo_reports(report)
    save_steam_lookup_cache(steam_cache)

    total_time = time.time() - start_time
    total_items = sum(c["total_count"] for c in data["categories"].values())
    
    print("\n" + "=" * 65)
    print("  🎉 打包脱水完成，所有数据已绝对硬塞入前端！")
    print(f"  📌 WebP 转码区: {WEBP_CACHE_DIR}")
    print(f"  📌 结构输出区: {JSON_OUTPUT_PATH}")
    report_outputs = report.get("games_report_outputs", {})
    print(f"  📌 Games 总览清单: {report_outputs.get('inventory_csv', GAMES_INVENTORY_CSV_PATH)}")
    print(f"  📌 Games 英文名缺失: {report_outputs.get('missing_english_csv', GAMES_MISSING_ENGLISH_CSV_PATH)}")
    print(f"  📌 Games 待补清单: {report_outputs.get('todo_csv', GAMES_TODO_CSV_PATH)}")
    print(f"  📊 总项目数：{total_items} 项")
    print(f"  🧪 校验摘要：Games 待补元数据 {len(report['games_meta_todo'])} 项 | Steam 自动补全 {report['games_steam_autofill_hits']} 项 | 模板更新 {len(report['games_meta_templates_updated'])} 个 | Music 缺封面 {len(report['music_missing_covers'])} 项 | Text 日期告警 {len(report['texts_date_issues'])} 项 | Visions 孤儿元数据 {len(report['visions_orphan_meta'])} 项")
    if report.get("games_report_fallback_paths"):
        print("  ⚠️  检测到报表文件被占用，已写入 .latest 备用文件：")
        for original, fallback in report["games_report_fallback_paths"].items():
            print(f"     - {original} -> {fallback}")
    print(f"  ⏱  总耗时：{total_time:.2f} 秒")
    print("=" * 65)


if __name__ == '__main__':
    main()
