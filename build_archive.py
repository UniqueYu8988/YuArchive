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
import shutil
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import quote_plus
from urllib.request import Request, urlopen
try:
    from PIL import Image, ImageChops, ImageOps
    # 屏蔽 PIL 内部的最大图片像素警告
    Image.MAX_IMAGE_PIXELS = None
except ImportError:
    print("❌ 错误：缺少 PIL 库。请先执行 `pip install Pillow`")
    sys.exit(1)

# ── 核心常量配置区 ─────────────────────────────────────────────────────
ONEDRIVE_DATA_ROOT = Path(r"C:\Users\Yu\OneDrive\图片\Data")
PUBLIC_ROOT = Path(r"C:\Users\Yu\AI\Archive\public")
WEBP_CACHE_DIR = PUBLIC_ROOT / "webp_cache"
AUDIO_CACHE_DIR = PUBLIC_ROOT / "audio_cache"
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
AUDIO_EXTENSIONS = {".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac"}

CATEGORIES = {
    "games": "Games",
    "visions": "Visions",
    "music": "Music",
    "texts": "Texts",
}
# ──────────────────────────────────────────────────────────────────────

DEFAULT_TEXT_DATE = "1970-01-01"
TEXT_SECTION_DEFAULT_KEY = "headline"
TEXT_SECTION_CONFIG_FILENAME = "sections.yaml"
GAME_META_FILENAME = "meta.yaml"
VISIONS_META_FILENAME = "meta.yaml"
SITE_UI_CONFIG_FILENAME = "site-ui.yaml"
SITE_LAYOUT_CONFIG_FILENAME = "site-layout.yaml"
HOMEPAGE_CONFIG_FILENAME = "homepage.yaml"
VISION_FOLDER_YEAR_MAP = {
    "此岸": 2026.0,
    "未远": 2025.0,
    "旧影": 2023.0,
    "前尘": 2020.0,
    "开端": 2017.0,
    "2026": 2026.0,
    "2024-2025": 2025.0,
    "2021-2023": 2023.0,
    "2018-2020": 2020.0,
    "2017": 2017.0,
}
GAME_LIVE_FOLDER = "Game-Live"
GAME_META_SKIP_FOLDERS = {"Game-2010", "Game-2015", "Game-Season", GAME_LIVE_FOLDER}
GAME_SEASON_FOLDER = "Game-Season"
GAME_PLATFORM_CHOICES = ("steam", "xbox", "riotgame", "battlenet", "playstation", "switch")
GAME_GENRE_CHOICES = ("action", "rpg", "strategy", "shooter", "simulation", "sports", "racing", "puzzle", "casual")
GAME_SEASON_RULES = [
    {"title": "云顶之弈", "prefix": "TFT_", "label": "赛季"},
    {"title": "英雄联盟", "prefix": "LOL_", "label": "全球总决赛"},
    {"title": "暗黑破坏神 IV", "prefix": "D4_", "label": "赛季"},
]
GAME_SEASON_TARGET_YEAR = 2026.0
GAME_SEASON_PRIORITY = {
    "英雄联盟": 0,
    "云顶之弈": 1,
    "暗黑破坏神 IV": 2,
}
DEFAULT_SITE_UI = {
    "current_album": "Current Album",
    "selected_section": "Selected Section",
    "unclassified": "未分类",
    "unknown": "未知",
    "unrated": "未评分",
    "season_journey": "赛季旅程",
    "season_special": "SEASON / 赛季专区",
}
DEFAULT_SITE_LAYOUT = {
    "home_latest_games_count": 9,
    "home_latest_visions_count": 9,
    "home_latest_music_count": 7,
    "home_latest_texts_count": 4,
    "games_season_target_year": 2026,
    "games_season_priority": {
        "英雄联盟": 0,
        "云顶之弈": 1,
        "暗黑破坏神 IV": 2,
    },
    "texts_default_section_key": "headline",
}
DEFAULT_HOMEPAGE_CONFIG = {
    "games": [],
    "visions": [],
    "music": [],
    "texts": [],
}
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


def trim_transparent_padding(img: Image.Image) -> Image.Image:
    """
    对带透明边的海报做自动裁切，避免透明像素把卡片底色露出来。
    仅在存在 alpha 且有效内容区域明显小于整张图时生效。
    """
    if "A" not in img.getbands():
        return img

    alpha = img.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return img

    full_bbox = (0, 0, img.width, img.height)
    if bbox == full_bbox:
        return img

    left, top, right, bottom = bbox
    trimmed_w = right - left
    trimmed_h = bottom - top
    # 只有当透明留白比较明显时才裁，避免误伤轻微半透明边缘。
    if trimmed_w < img.width - 4 or trimmed_h < img.height - 4:
        return img.crop(bbox)

    return img


def estimate_alpha_matte_color(img: Image.Image) -> tuple[int, int, int]:
    """
    为带透明角/透明边的海报估一个接近原图边缘的铺底色，
    避免透明区域直接露出页面底色。
    """
    if "A" not in img.getbands():
        return (15, 16, 21)

    width, height = img.size
    rgba = img.load()
    edge_samples: list[tuple[int, int, int]] = []
    sample_step_x = max(1, width // 24)
    sample_step_y = max(1, height // 24)

    def add_sample(x: int, y: int):
        r, g, b, a = rgba[x, y]
        if a >= 32:
            edge_samples.append((r, g, b))

    for x in range(0, width, sample_step_x):
        add_sample(x, 0)
        add_sample(x, height - 1)
    for y in range(0, height, sample_step_y):
        add_sample(0, y)
        add_sample(width - 1, y)

    if not edge_samples:
        for y in range(0, height, sample_step_y):
            for x in range(0, width, sample_step_x):
                r, g, b, a = rgba[x, y]
                if a >= 64:
                    edge_samples.append((r, g, b))

    if not edge_samples:
        return (15, 16, 21)

    r = sum(color[0] for color in edge_samples) // len(edge_samples)
    g = sum(color[1] for color in edge_samples) // len(edge_samples)
    b = sum(color[2] for color in edge_samples) // len(edge_samples)
    return (r, g, b)


def flatten_alpha_to_edge_matte(img: Image.Image) -> Image.Image:
    """
    把透明区压到接近海报边缘的底色上，解决透明圆角露底的问题。
    """
    if "A" not in img.getbands():
        return img

    alpha = img.getchannel("A")
    if alpha.getbbox() == (0, 0, img.width, img.height):
        return img

    matte = estimate_alpha_matte_color(img)
    base = Image.new("RGBA", img.size, matte + (255,))
    return Image.alpha_composite(base, img)


def trim_uniform_matte_border(img: Image.Image) -> Image.Image:
    """
    识别海报四周接近同色的留白/外框，并自动裁掉。
    主要用于影视海报里常见的白边、浅灰边、印刷式边框。
    """
    rgb = img.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    border_samples: list[tuple[int, int, int]] = []

    def add_sample(x: int, y: int):
        border_samples.append(pixels[x, y])

    step_x = max(1, width // 24)
    step_y = max(1, height // 24)

    for x in range(0, width, step_x):
        add_sample(x, 0)
        add_sample(x, min(2, height - 1))
        add_sample(x, height - 1)
        add_sample(x, max(0, height - 3))
    for y in range(0, height, step_y):
        add_sample(0, y)
        add_sample(min(2, width - 1), y)
        add_sample(width - 1, y)
        add_sample(max(0, width - 3), y)

    if not border_samples:
        return img

    matte = tuple(sum(color[i] for color in border_samples) // len(border_samples) for i in range(3))
    bg = Image.new("RGB", rgb.size, matte)
    diff = ImageChops.difference(rgb, bg).convert("L")
    mask = diff.point(lambda value: 255 if value > 18 else 0)
    bbox = mask.getbbox()

    if not bbox:
        return img

    left, top, right, bottom = bbox
    if left <= 6 and top <= 6 and (width - right) <= 6 and (height - bottom) <= 6:
        return img

    # 只裁较明显的统一边框，避免误伤内容本身贴边的海报。
    if left < 10 and top < 10 and (width - right) < 10 and (height - bottom) < 10:
        return img

    cropped = img.crop(bbox)
    if cropped.width < width * 0.72 or cropped.height < height * 0.72:
        return img

    return cropped


def find_case_variant_path(target_path: Path) -> Path | None:
    parent = target_path.parent
    if not parent.exists():
        return None

    target_name = target_path.name.lower()
    for child in parent.iterdir():
        if child.is_file() and child.name.lower() == target_name:
            return child
    return None


def normalize_case_variant(existing_path: Path, target_path: Path) -> Path:
    if existing_path.name == target_path.name:
        return target_path

    target_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = existing_path.with_name(f"__casefix__{existing_path.name}")
    if temp_path.exists():
        temp_path.unlink()
    existing_path.rename(temp_path)
    temp_path.rename(target_path)
    return target_path

def process_and_get_webp_path(src_img_path: Path, category_key: str) -> str:
    """
    智能图像处理管道：增量判断，若需处理则执行转码及留白裁剪。
    返回能够被前端直接使用的从 public/ 开始的相对路径，如 'webp_cache/Games/...webp'。
    """
    if not src_img_path.exists():
        return ""
        
    rel_path = src_img_path.relative_to(ONEDRIVE_DATA_ROOT)
    dst_webp_path = WEBP_CACHE_DIR / rel_path.with_suffix('.webp')
    existing_variant = find_case_variant_path(dst_webp_path)
    if existing_variant and existing_variant.name != dst_webp_path.name:
        dst_webp_path = normalize_case_variant(existing_variant, dst_webp_path)
    
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

            if category_key == "visions":
                img = trim_transparent_padding(img)
                img = flatten_alpha_to_edge_matte(img)
                img = trim_uniform_matte_border(img)
            
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


def process_and_get_audio_path(src_audio_path: Path) -> str:
    if not src_audio_path.exists():
        return ""

    rel_path = src_audio_path.relative_to(ONEDRIVE_DATA_ROOT)
    dst_audio_path = AUDIO_CACHE_DIR / rel_path

    if dst_audio_path.exists() and dst_audio_path.stat().st_size > 0:
        if dst_audio_path.stat().st_mtime >= src_audio_path.stat().st_mtime:
            return f"audio_cache/{rel_path.as_posix()}"

    dst_audio_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src_audio_path, dst_audio_path)
    return f"audio_cache/{rel_path.as_posix()}"


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

    mapped_year = VISION_FOLDER_YEAR_MAP.get(folder_name)
    if mapped_year is not None:
        return mapped_year

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


def slugify_section_key(value: str) -> str:
    normalized = normalize_title(value).lower()
    normalized = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", normalized).strip("-")
    return normalized or "misc"


def resolve_text_section(item_path: Path, cat_root: Path, metadata: dict, default_section_key: str = TEXT_SECTION_DEFAULT_KEY) -> tuple[str, str, str]:
    config_map, alias_map = load_text_section_config(cat_root)
    explicit_section = normalize_title(str(metadata.get("section", "")))
    relative_parts = item_path.relative_to(cat_root).parts
    folder_section = normalize_title(relative_parts[0]) if len(relative_parts) > 1 else ""
    section_source = explicit_section or folder_section

    if not section_source:
        key = default_section_key
    else:
        key = alias_map.get(section_source, slugify_section_key(section_source))

    config = config_map.get(key)
    if config:
        title = config["title"]
        description = config.get("description", "")
    else:
        title = section_source or key
        description = f"这里收纳的是「{title}」这一栏下持续积累的文本与记录。"

    return key, title, description


def unquote_yaml_value(value: str) -> str:
    if (value.startswith("'") and value.endswith("'")) or (value.startswith('"') and value.endswith('"')):
        return value[1:-1]
    return value


def yaml_string(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def parse_bool(value: str) -> bool:
    return value.strip().lower() in {"true", "yes", "1"}


def parse_scalar_value(value: str):
    raw = unquote_yaml_value(value.strip())
    lowered = raw.lower()
    if lowered in {"true", "yes"}:
        return True
    if lowered in {"false", "no"}:
        return False
    if re.fullmatch(r"-?\d+", raw):
        try:
            return int(raw)
        except ValueError:
            return raw
    if re.fullmatch(r"-?\d+\.\d+", raw):
        try:
            return float(raw)
        except ValueError:
            return raw
    return raw


def parse_flat_yaml_config(path: Path) -> dict:
    result: dict[str, object] = {}
    if not path.exists():
        return result

    try:
        with open(path, "r", encoding="utf-8") as f:
            for raw_line in f.readlines():
                stripped = raw_line.strip()
                if not stripped or stripped.startswith("#") or ":" not in stripped:
                    continue
                key, _, value = stripped.partition(":")
                result[key.strip()] = parse_scalar_value(value)
    except Exception:
        return {}

    return result


def load_site_ui_config(root: Path) -> dict:
    config = DEFAULT_SITE_UI.copy()
    config.update(parse_flat_yaml_config(root / SITE_UI_CONFIG_FILENAME))
    return config


def load_site_layout_config(root: Path) -> dict:
    raw = parse_flat_yaml_config(root / SITE_LAYOUT_CONFIG_FILENAME)
    layout = {
        **DEFAULT_SITE_LAYOUT,
        **{k: v for k, v in raw.items() if not k.startswith("games_season_priority_")},
    }
    priorities = dict(DEFAULT_SITE_LAYOUT["games_season_priority"])
    for key, value in raw.items():
        if key.startswith("games_season_priority_"):
            title = key.replace("games_season_priority_", "", 1)
            try:
                priorities[title] = int(value)
            except (TypeError, ValueError):
                continue
    layout["games_season_priority"] = priorities
    return layout


def load_homepage_config(root: Path) -> dict:
    config = {
        key: list(value)
        for key, value in DEFAULT_HOMEPAGE_CONFIG.items()
    }
    config_path = root / HOMEPAGE_CONFIG_FILENAME
    if not config_path.exists():
        return config

    current_key = None
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            for raw_line in f.readlines():
                line = raw_line.rstrip("\n")
                stripped = line.strip()
                if not stripped or stripped.startswith("#"):
                    continue

                indent = len(line) - len(line.lstrip(" "))
                if indent == 0 and stripped.endswith(":"):
                    key = normalize_title(stripped[:-1])
                    current_key = key if key in config else None
                    continue

                if current_key and stripped.startswith("- "):
                    value = unquote_yaml_value(stripped[2:].strip())
                    if value:
                        config[current_key].append(value)
    except Exception:
        return {
            key: list(value)
            for key, value in DEFAULT_HOMEPAGE_CONFIG.items()
        }

    return config


def load_text_section_config(cat_root: Path) -> tuple[dict[str, dict], dict[str, str]]:
    config_file = cat_root / TEXT_SECTION_CONFIG_FILENAME
    config_map: dict[str, dict] = {}
    alias_map: dict[str, str] = {}
    current_key = None

    if not config_file.exists():
        return config_map, alias_map

    try:
        with open(config_file, "r", encoding="utf-8") as f:
            for raw_line in f.readlines():
                line = raw_line.rstrip("\n")
                stripped = line.strip()
                if not stripped or stripped.startswith("#"):
                    continue

                indent = len(line) - len(line.lstrip(" "))
                if indent == 0 and stripped.endswith(":"):
                    current_key = normalize_title(unquote_yaml_value(stripped[:-1].strip()))
                    config_map[current_key] = {"title": current_key, "description": "", "aliases": []}
                    alias_map[current_key] = current_key
                    continue

                if current_key and indent >= 2 and ":" in stripped:
                    key, _, value = stripped.partition(":")
                    key = key.strip().lower()
                    value = unquote_yaml_value(value.strip())
                    if key == "aliases":
                        aliases = [normalize_title(part) for part in re.split(r"[,\|]", value) if normalize_title(part)]
                        config_map[current_key]["aliases"] = aliases
                        for alias in aliases:
                            alias_map[alias] = current_key
                    else:
                        config_map[current_key][key] = value
    except Exception:
        return {}, {}

    return config_map, alias_map


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
        "display_title": "",
        "dlc_parent_title": "",
    }


def canonicalize_game_title_for_match(value: str) -> str:
    normalized = normalize_title(value).lower()
    return re.sub(r"[\s_\-—:：·'\".!！?？\[\]\(\)]", "", normalized)


def get_game_display_title(title: str, meta_entry: dict | None = None) -> str:
    explicit = normalize_title(str((meta_entry or {}).get("display_title", "")))
    return explicit or title


def season_order_value(title: str) -> float:
    worlds_match = re.search(r"Worlds\s+(\d{4})", title, re.IGNORECASE)
    if worlds_match:
        return float(worlds_match.group(1))

    season_match = re.search(r"S(\d+(?:\.\d+)?)", title, re.IGNORECASE)
    if season_match:
        try:
            return float(season_match.group(1))
        except ValueError:
            return 0.0
    return 0.0


def season_source_year(folder_name: str) -> float:
    return extract_year_from_folder(folder_name) or 0.0


def get_game_sort_title(item: dict) -> str:
    english_title = str(item.get("english_title", "") or "").strip()
    if english_title:
        return english_title.lower()
    return str(item.get("title", "") or "").lower()


def split_game_dlc_title(title: str) -> tuple[str, str] | None:
    if "_" not in title:
        return None
    base_title, dlc_title = title.split("_", 1)
    return normalize_title(base_title), normalize_title(dlc_title)


def load_live_game_meta(root: Path) -> dict:
    live_root = root / CATEGORIES["games"] / GAME_LIVE_FOLDER
    if not live_root.exists():
        return {}

    def parse_live_yaml(meta_file: Path) -> dict:
        entry = default_game_meta()
        entry["season_entries_meta"] = {}
        current_section = None
        current_item = None
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                for raw_line in f.readlines():
                    line = raw_line.rstrip("\n")
                    stripped = line.strip()
                    if not stripped or stripped.startswith("#") or ":" not in stripped:
                        continue

                    indent = len(line) - len(line.lstrip(" "))

                    if indent == 0 and stripped.endswith(":"):
                        key = stripped[:-1].strip().lower()
                        current_section = key
                        current_item = None
                        continue

                    if current_section == "season_entries":
                        if indent == 2 and stripped.endswith(":"):
                            current_item = normalize_title(unquote_yaml_value(stripped[:-1].strip()))
                            entry["season_entries_meta"][current_item] = {}
                            continue
                        if current_item and indent >= 4 and ":" in stripped:
                            key, _, value = stripped.partition(":")
                            entry["season_entries_meta"][current_item][key.strip().lower()] = unquote_yaml_value(value.strip())
                            continue

                    if indent == 0:
                        key, _, value = stripped.partition(":")
                        key = key.strip().lower()
                        value = unquote_yaml_value(value.strip())
                        if key == "completed":
                            entry["completed"] = parse_bool(value)
                        else:
                            entry[key] = value
        except Exception:
            return {}
        return entry

    per_file_meta = {}
    for meta_file in sorted(live_root.glob("*.yaml")):
        if meta_file.name.lower() == GAME_META_FILENAME:
            continue
        title = normalize_title(meta_file.stem)
        parsed = parse_live_yaml(meta_file)
        if parsed:
            per_file_meta[title] = parsed

    if per_file_meta:
        return per_file_meta

    legacy_meta_file = live_root / GAME_META_FILENAME
    if legacy_meta_file.exists():
        return parse_game_meta_yaml(legacy_meta_file)
    return {}


def find_live_game_cover(root: Path, title: str) -> str:
    live_root = root / CATEGORIES["games"] / GAME_LIVE_FOLDER
    if not live_root.exists():
        return ""

    for ext in IMAGE_EXTENSIONS:
        candidate = live_root / f"{title}{ext}"
        if candidate.exists() and candidate.is_file():
            return process_and_get_webp_path(candidate, "games")
    return ""


def build_game_season_map(root: Path, live_game_meta: dict | None = None) -> tuple[dict[str, list[dict]], set[str], dict[str, dict]]:
    games_root = root / CATEGORIES["games"]
    season_map: dict[str, list[dict]] = {}
    season_stems: set[str] = set()
    representative_map: dict[str, dict] = {}
    live_game_meta = live_game_meta or {}
    if not games_root.exists():
        return season_map, season_stems, representative_map

    for sub_folder in sorted(games_root.iterdir()):
        if not sub_folder.is_dir():
            continue
        for img_path in scan_images_in_folder(sub_folder):
            title = normalize_title(img_path.stem)
            for rule in GAME_SEASON_RULES:
                if title.startswith(rule["prefix"]):
                    season_stems.add(title)
                    season_title = title[len(rule["prefix"]):].strip()
                    order = season_order_value(season_title)
                    source_year = season_source_year(sub_folder.name)
                    image_path = process_and_get_webp_path(img_path, "games")
                    display_title = get_game_display_title(season_title)
                    entry_meta = (
                        live_game_meta.get(rule["title"], {}).get("season_entries_meta", {}).get(display_title, {})
                    )
                    season_map.setdefault(rule["title"], []).append({
                        "id": f"season_{rule['title']}_{len(season_map.get(rule['title'], []))}",
                        "title": display_title,
                        "image_path": image_path,
                        "label": rule["label"],
                        "champion": entry_meta.get("champion", ""),
                        "note": entry_meta.get("note", ""),
                        "period": entry_meta.get("period", ""),
                        "theme": entry_meta.get("theme", ""),
                        "feature": entry_meta.get("feature", ""),
                        "build": entry_meta.get("build", ""),
                        "icon_path": entry_meta.get("icon_path", ""),
                        "order": order,
                        "source_year": source_year,
                    })
                    current_rep = representative_map.get(rule["title"])
                    if current_rep is None or order > current_rep["order"]:
                        representative_map[rule["title"]] = {
                            "image_path": image_path,
                            "order": order,
                            "year": source_year,
                        }
                    break

    for title, items in season_map.items():
        items.sort(key=lambda item: item["order"])

    return season_map, season_stems, representative_map


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
        "# playtime 为所见即所得：YAML 中写什么，前端就显示什么",
        "# 可选 genre: action / rpg / strategy / shooter / simulation / sports / racing / puzzle / casual",
        "# 可选 display_title: 覆盖网页显示标题，不改原文件名",
        "# 可选 dlc_parent_title: DLC 所属本体显示名，仅 DLC 条目需要",
        "",
    ]

    ordered_titles = []
    seen = set()
    for title in image_titles:
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
            *([f"  display_title: {yaml_string(str(entry.get('display_title', '')))}"] if entry.get("display_title") else []),
            *([f"  dlc_parent_title: {yaml_string(str(entry.get('dlc_parent_title', '')))}"] if entry.get("dlc_parent_title") else []),
            "",
        ])

    return "\n".join(lines).rstrip() + "\n"


def sync_game_meta_template(folder: Path, image_titles: list[str], report: dict, steam_cache: dict) -> dict:
    meta_file = folder / GAME_META_FILENAME
    existing = parse_game_meta_yaml(meta_file)
    canonical_existing: dict[str, list[str]] = {}
    for existing_title in existing:
        canonical_existing.setdefault(canonicalize_game_title_for_match(existing_title), []).append(existing_title)

    remapped_existing = {}
    for title in image_titles:
        if title in existing:
            remapped_existing[title] = existing[title]
            continue
        candidates = canonical_existing.get(canonicalize_game_title_for_match(title), [])
        if len(candidates) == 1:
            remapped_existing[title] = existing[candidates[0]]

    merged = {}

    for title in image_titles:
        entry = default_game_meta()
        entry.update(remapped_existing.get(title, {}))
        platform = str(entry.get("platform", "steam") or "steam").strip().lower()
        entry["platform"] = platform if platform in GAME_PLATFORM_CHOICES else "steam"
        entry["english_title"] = normalize_title(str(entry.get("english_title", "")))
        entry["url"] = str(entry.get("url", "")).strip()
        entry["price"] = str(entry.get("price", "")).strip()
        rating = parse_game_rating(str(entry.get("rating", "")))
        entry["rating"] = "" if rating is None else rating
        playtime = str(entry.get("playtime", "")).strip()
        entry["playtime"] = playtime
        genre = str(entry.get("genre", "")).strip().lower()
        entry["genre"] = genre if genre in GAME_GENRE_CHOICES else ""
        entry["completed"] = bool(entry.get("completed"))
        entry["display_title"] = normalize_title(str(entry.get("display_title", "")))
        entry["dlc_parent_title"] = normalize_title(str(entry.get("dlc_parent_title", "")))

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


def find_music_audio(markdown_path: Path, audio_value: str, cat_root: Path) -> tuple[Path | None, str]:
    raw_value = (audio_value or "").strip()
    candidates: list[Path] = []
    stem = markdown_path.stem

    songs_root = cat_root / "Songs"

    if raw_value:
        raw_path = Path(raw_value)
        if raw_path.is_absolute():
            candidates.append(raw_path)
        else:
            candidates.append(markdown_path.parent / raw_value)
            candidates.append(cat_root / raw_value)
            candidates.append(songs_root / raw_value)
            for ext in AUDIO_EXTENSIONS:
                candidates.append(markdown_path.parent / f"{raw_value}{ext}")
                candidates.append(cat_root / f"{raw_value}{ext}")
                candidates.append(songs_root / f"{raw_value}{ext}")
    else:
        for ext in AUDIO_EXTENSIONS:
            candidates.append(markdown_path.with_suffix(ext))
            candidates.append(songs_root / f"{stem}{ext}")

    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate, raw_value

    return None, raw_value


def extract_music_primary_track(content: str, fallback: str) -> str:
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        numbered = re.match(r"^\d+\.\s+(.*)$", line)
        if numbered:
            return numbered.group(1).strip()
        bullet = re.match(r"^[-*]\s+(.*)$", line)
        if bullet:
            return bullet.group(1).strip()
    return fallback


def parse_visions_meta_yamls(visions_root: Path) -> dict:
    result = {}
    if not visions_root.exists(): return result

    meta_files = []
    for period_dir in sorted([p for p in visions_root.iterdir() if p.is_dir()]):
        preferred_meta = period_dir / VISIONS_META_FILENAME
        legacy_meta = period_dir / f"{period_dir.name}.yaml"
        if preferred_meta.exists():
            meta_files.append(preferred_meta)
        elif legacy_meta.exists():
            meta_files.append(legacy_meta)

    for meta_file in meta_files:
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

def process_timeline_category(root: Path, category_key: str, report: dict, steam_cache: dict | None = None, site_layout: dict | None = None) -> dict:
    category_name = CATEGORIES[category_key]
    category_root = root / category_name
    print(f"\n📂 [1/4] 扫描 {category_name} (时间线架构)...")
    site_layout = site_layout or DEFAULT_SITE_LAYOUT
    season_target_year = float(site_layout.get("games_season_target_year", GAME_SEASON_TARGET_YEAR))
    season_priority = site_layout.get("games_season_priority", GAME_SEASON_PRIORITY)

    if not category_root.exists():
        return {"key": category_key, "display_name": category_name, "total_count": 0, "sort_mode": "timeline", "years": []}

    year_map = {}
    live_game_meta = load_live_game_meta(root) if category_key == "games" else {}
    game_season_map, game_season_stems, game_season_representatives = build_game_season_map(root, live_game_meta) if category_key == "games" else ({}, set(), {})
    for sub_folder in sorted(category_root.iterdir()):
        if not sub_folder.is_dir(): continue
        if category_key == "games" and sub_folder.name == GAME_SEASON_FOLDER:
            continue
        if category_key == "games" and sub_folder.name == GAME_LIVE_FOLDER:
            continue
        year = extract_year_from_folder(sub_folder.name) or 0
        images = scan_images_in_folder(sub_folder)
        if category_key == "games":
            images = [img for img in images if normalize_title(img.stem) not in game_season_stems]
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
            season_entry_list = game_season_map.get(file_stem, []) if category_key == "games" else []
            dlc_split = split_game_dlc_title(file_stem) if category_key == "games" else None
            cover_path = webp_url
            display_title = (
                get_game_display_title(dlc_split[1], meta_entry) if dlc_split
                else (get_game_display_title(file_stem, meta_entry) if category_key == "games" else file_stem)
            )
            if category_key == "games" and file_stem in game_season_representatives and file_stem != "英雄联盟":
                cover_path = game_season_representatives[file_stem]["image_path"]

            target_year = season_target_year if category_key == "games" and season_entry_list else year
            if target_year not in year_map:
                year_map[target_year] = {"year": target_year, "folder": sub_folder.name if target_year == year else f"Seasonal-{int(target_year)}", "items": []}

            year_map[target_year]["items"].append({
                "id": f"{category_key}_{target_year}_{len(year_map[target_year]['items'])}",
                "image_path": cover_path,
                "title": display_title,
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
                "seasonal": bool(season_entry_list),
                "dlc": bool(dlc_split),
                "dlc_parent": normalize_title(str(meta_entry.get("dlc_parent_title", ""))) or (get_game_display_title(dlc_split[0]) if dlc_split else ""),
                "summary": meta_entry.get("summary", ""),
                "hover_note": meta_entry.get("hover_note", ""),
                "season_heading": meta_entry.get("season_heading", ""),
                "season_subheading": meta_entry.get("season_subheading", ""),
                "season_description": meta_entry.get("season_description", ""),
                "season_entries": season_entry_list,
            })

    if category_key == "games":
        existing_titles = {item["title"] for year_info in year_map.values() for item in year_info["items"]}
        for title, season_entries in game_season_map.items():
            if title in existing_titles:
                continue
            representative = game_season_representatives.get(title)
            if not representative:
                continue
            year = season_target_year
            if year not in year_map:
                year_map[year] = {"year": year, "folder": f"Seasonal-{int(year) if year else 'Misc'}", "items": []}
            meta_entry = default_game_meta()
            meta_entry.update(live_game_meta.get(title, {}))
            rating = parse_game_rating(str(meta_entry.get("rating", "")))
            meta_entry["rating"] = "" if rating is None else rating
            playtime = str(meta_entry.get("playtime", "")).strip()
            meta_entry["playtime"] = playtime
            meta_entry["completed"] = bool(meta_entry.get("completed"))
            live_cover_path = find_live_game_cover(root, title)
            year_map[year]["items"].append({
                "id": f"{category_key}_{year}_{len(year_map[year]['items'])}",
                "image_path": live_cover_path or representative["image_path"],
                "title": get_game_display_title(title, meta_entry),
                "cinema": False,
                "quote": "",
                "url": "",
                "type": "game",
                "game_meta_enabled": True,
                "english_title": meta_entry.get("english_title", ""),
                "platform": meta_entry.get("platform", ""),
                "price": meta_entry.get("price", ""),
                "rating": meta_entry.get("rating", ""),
                "playtime": meta_entry.get("playtime", ""),
                "completed": meta_entry.get("completed", False),
                "genre": meta_entry.get("genre", ""),
                "seasonal": True,
                "dlc": False,
                "dlc_parent": "",
                "summary": meta_entry.get("summary", ""),
                "hover_note": meta_entry.get("hover_note", ""),
                "season_heading": meta_entry.get("season_heading", ""),
                "season_subheading": meta_entry.get("season_subheading", ""),
                "season_description": meta_entry.get("season_description", ""),
                "season_entries": season_entries,
            })

    if category_key == "games":
        for year_info in year_map.values():
            year_info["items"].sort(
                key=lambda item: (
                    not bool(item.get("seasonal")),
                    not bool(item.get("dlc")),
                    season_priority.get(item["title"], 999),
                    not bool(item.get("completed")),
                    -(item.get("rating") or 0),
                    get_game_sort_title(item),
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
            audio_url = ""
            audio_value = meta["metadata"].get("audio", "")
            cover_path, raw_cover = find_music_cover(item, cover_filename, cat_root)
            audio_path, _ = find_music_audio(item, audio_value, cat_root)

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
                    "title": item.stem,
                    "file": str(item),
                    "cover": raw_cover,
                })

            if audio_path:
                try:
                    if audio_path.is_relative_to(ONEDRIVE_DATA_ROOT):
                        audio_url = process_and_get_audio_path(audio_path)
                except ValueError:
                    audio_url = ""

            items.append({
                "id": f"music_{len(items)}",
                "title": item.stem,
                "cover": cover_url,
                "description": meta["metadata"].get("description", ""),
                "content": meta["content"],
                "audio": audio_url,
                "track_title": normalize_title(str(meta["metadata"].get("track_title", "")).strip()) or extract_music_primary_track(meta["content"], item.stem),
            })

    return {
        "key": "music", "display_name": "Music",
        "total_count": len(items), "sort_mode": "music", "items": items
    }


def process_texts_category(root: Path, report: dict, site_layout: dict | None = None) -> dict:
    print(f"\n📂 [4/4] 扫描 Texts (纯文本解析引擎)...")
    cat_root = root / CATEGORIES["texts"]
    site_layout = site_layout or DEFAULT_SITE_LAYOUT
    default_section_key = str(site_layout.get("texts_default_section_key", TEXT_SECTION_DEFAULT_KEY))

    if not cat_root.exists():
        return {"key": "texts", "display_name": "Texts", "total_count": 0, "sort_mode": "text", "items": []}

    items = []
    section_counts: dict[str, int] = {}
    section_titles: dict[str, str] = {}
    section_descriptions: dict[str, str] = {}
    section_config_map, _ = load_text_section_config(cat_root)
    for item in cat_root.rglob("*"):
        if item.is_file() and item.suffix.lower() in TEXT_EXTENSIONS:
            parsed = parse_markdown_with_frontmatter(item)
            title = parsed["metadata"].get("title", item.stem)
            sort_date, date_status = normalize_text_date(parsed["metadata"].get("date", DEFAULT_TEXT_DATE), item)
            section_key, section_title, section_description = resolve_text_section(item, cat_root, parsed["metadata"], default_section_key)
            section_counts[section_key] = section_counts.get(section_key, 0) + 1
            section_titles[section_key] = section_title
            section_descriptions[section_key] = section_description
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
                "section": section_key,
                "section_title": section_title,
                "tags": parsed["metadata"].get("tags", []),
                "content": parsed["content"]
            })

    items.sort(key=lambda x: (x["sort_date"], x["title"]), reverse=True)
    section_order = list(section_config_map.keys())
    dynamic_keys = [key for key in section_counts.keys() if key not in section_order]
    ordered_keys = [key for key in section_order if key in section_counts] + sorted(dynamic_keys)
    sections = [
        {
            "key": key,
            "title": section_titles.get(key, section_config_map.get(key, {}).get("title", key)),
            "description": section_descriptions.get(key, section_config_map.get(key, {}).get("description", "")),
            "count": section_counts.get(key, 0),
        }
        for key in ordered_keys
    ]
    return {
        "key": "texts", "display_name": "Texts",
        "total_count": len(items), "sort_mode": "text", "sections": sections, "items": items
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
    site_ui = load_site_ui_config(ONEDRIVE_DATA_ROOT)
    site_layout = load_site_layout_config(ONEDRIVE_DATA_ROOT)
    homepage_config = load_homepage_config(ONEDRIVE_DATA_ROOT)
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
            "site_ui": site_ui,
            "site_layout": site_layout,
            "homepage": homepage_config,
            "validation": report,
        },
        "categories": {
            "games":   process_timeline_category(ONEDRIVE_DATA_ROOT, "games", report, steam_cache, site_layout),
            "visions": process_visions_category(ONEDRIVE_DATA_ROOT, report),
            "music":   process_music_category(ONEDRIVE_DATA_ROOT, report),
            "texts":   process_texts_category(ONEDRIVE_DATA_ROOT, report, site_layout),
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
