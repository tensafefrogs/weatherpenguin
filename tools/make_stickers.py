"""Builds the iMessage stickers from the original drawings in web/app/images.

Crops all eight to one shared frame so the penguin is the same size in every
sticker, scales down to 408×408 (Messages' regular grid), and adds a white
die-cut border so the black outlines stay visible on dark backgrounds. The
drawings themselves aren't altered.

Usage: python3 -I tools/make_stickers.py [--no-border]
"""
import json
import pathlib
import sys

from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
ART = ROOT / "web/app/images"
PACK = ROOT / "app/ios/Stickers/Stickers.xcassets/Sticker Pack.stickerpack"

SIZE = 408
BORDER = 7  # px at 408

# (sticker folder, drawing, VoiceOver label), in the order Messages shows them.
STICKERS = [
    ("Naked Penguin", "naked", "Penguin"),
    ("Cold Penguin", "cold", "Penguin in a sweater, scarf and hat"),
    ("Jacket Penguin", "jacket", "Penguin in a jacket"),
    ("Raincoat Penguin", "jacket_rain", "Penguin in a raincoat"),
    ("Warm Penguin", "warm", "Penguin in a T-shirt"),
    ("Warm Rain Penguin", "warm_rain", "Penguin in a rain poncho"),
    ("Bikini Penguin", "hot", "Penguin in a bikini"),
    ("Bikini Rain Penguin", "hot_rain", "Penguin in a bikini and swim cap"),
]


def main(border: bool) -> None:
    drawings = {d: Image.open(ART / f"{d}.png").convert("RGBA") for _, d, _ in STICKERS}
    boxes = [im.getchannel("A").getbbox() for im in drawings.values()]
    frame = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    fw, fh = frame[2] - frame[0], frame[3] - frame[1]
    pad = BORDER + 3 if border else 4
    scale = (SIZE - 2 * pad) / max(fw, fh)
    w, h = round(fw * scale), round(fh * scale)

    for old in PACK.glob("*.sticker"):
        for f in old.iterdir():
            f.unlink()
        old.rmdir()

    for folder, drawing, label in STICKERS:
        art = drawings[drawing].crop(frame).resize((w, h), Image.LANCZOS)
        canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        canvas.alpha_composite(art, ((SIZE - w) // 2, (SIZE - h) // 2))
        if border:
            alpha = canvas.getchannel("A").point(lambda a: 255 if a > 40 else 0)
            outline = alpha.filter(ImageFilter.MaxFilter(2 * BORDER + 1)).filter(ImageFilter.GaussianBlur(1))
            white = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
            white.putalpha(outline)
            white.alpha_composite(canvas)
            canvas = white
        out = PACK / f"{folder}.sticker"
        out.mkdir()
        name = f"{drawing}.png"
        canvas.save(out / name, optimize=True)
        (out / "Contents.json").write_text(json.dumps({
            "info": {"author": "xcode", "version": 1},
            "properties": {"filename": name, "accessibility-label": label},
        }, indent=2) + "\n")

    (PACK / "Contents.json").write_text(json.dumps({
        "info": {"author": "xcode", "version": 1},
        "properties": {"grid-size": "regular"},
        "stickers": [{"filename": f"{folder}.sticker"} for folder, _, _ in STICKERS],
    }, indent=2) + "\n")
    print(f"{len(STICKERS)} stickers, frame {frame}, penguin {w}×{h} px")


if __name__ == "__main__":
    main(border="--no-border" not in sys.argv)
