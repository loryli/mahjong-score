# -*- coding: utf-8 -*-
"""生成 PWA 图标：深绿底 + 麻将牌 + 紅色「發」"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "icons")
os.makedirs(OUT, exist_ok=True)

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\simhei.ttf",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simsun.ttc",
]

def load_font(size):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def make(size, path, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, size, size], fill=(11, 61, 46, 255))
    else:
        r = int(size * 0.22)
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=(11, 61, 46, 255))

    # 白色麻将牌
    m = int(size * 0.26)
    card = [m, int(size * 0.18), size - m, int(size * 0.82)]
    d.rounded_rectangle(card, radius=int(size * 0.06), fill=(245, 245, 238, 255))

    # 「發」
    font = load_font(int(size * 0.4))
    text = "\u767c"
    tb = d.textbbox((0, 0), text, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    cx, cy = (card[0] + card[2]) / 2, (card[1] + card[3]) / 2
    d.text((cx - tw / 2 - tb[0], cy - th / 2 - tb[1]), text, fill=(201, 48, 37, 255), font=font)

    img.save(path)

make(192, os.path.join(OUT, "icon-192.png"))
make(512, os.path.join(OUT, "icon-512.png"))
print("icons done:", os.listdir(OUT))
