import argparse
import json
from pathlib import Path

from PIL import Image, ImageOps


def flatten(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    background.alpha_composite(rgba)
    return background.convert("RGB")


def trim_transparent(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    return rgba.crop(bbox) if bbox else rgba


def optimize(source: Path, target: Path, profile: str) -> dict:
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        input_width, input_height = image.size

        if profile == "visions-poster":
            image = trim_transparent(image)
            image = ImageOps.fit(image, (600, 900), method=Image.Resampling.LANCZOS)
        elif profile == "games-cover":
            image = ImageOps.fit(image, (600, 900), method=Image.Resampling.LANCZOS)
        elif profile in {"music-cover", "texts-cover"}:
            image = image.copy()
            image.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
        else:
            raise ValueError("unsupported_image_profile")

        image = flatten(image)
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, "WEBP", quality=86, method=6)
        return {
            "inputWidth": input_width,
            "inputHeight": input_height,
            "outputWidth": image.width,
            "outputHeight": image.height,
            "outputBytes": target.stat().st_size,
            "format": "webp",
            "profile": profile,
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--profile", required=True)
    args = parser.parse_args()
    result = optimize(Path(args.source), Path(args.target), args.profile)
    print(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__":
    main()
