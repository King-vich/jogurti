"""Vykreslí texturu etikety kelímku (blender/textury/etiketa.jpg).

Spuštění obyčejným Pythonem s Pillow:  python blender/etiketa.py
Etiketa se ovine kolem kelímku dvakrát, proto se kreslí dva stejné panely.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SLOZKA = os.path.dirname(os.path.abspath(__file__))
VYSTUP = os.path.join(SLOZKA, "textury", "etiketa.jpg")
F = r"C:\Windows\Fonts"

# Poměr stran odpovídá ploše etikety na kelímku (obvod ≈ 2,95 : výška 0,8).
W, H = 4096, 1112
PANEL = W // 2

MODRA_TMAVA = (10, 79, 163)
MODRA_SVETLA = (41, 182, 246)
CERVENA = (227, 23, 47)
BILA = (255, 255, 255)


def font(nazev, velikost):
    return ImageFont.truetype(os.path.join(F, nazev), velikost)


def prechod():
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        for x in range(W):
            # v každém panelu je střed světlejší, k okrajům tmavne (jako lesk na kelímku)
            u = (x % PANEL) / PANEL
            okraj = abs(u - 0.5) * 2
            k = min(1.0, 0.25 + t * 0.75 + okraj * 0.35)
            px[x, y] = tuple(int(MODRA_SVETLA[i] * (1 - k) + MODRA_TMAVA[i] * k) for i in range(3))
    return img


def smetana(img):
    """Bílá smetanová vlna ve spodní části s jemným stínováním."""
    maska = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(maska)
    body = [(0, H)]
    for x in range(0, W + 1, 8):
        u = x / PANEL * 2 * math.pi
        y = H * 0.66 + 34 * math.sin(u) + 22 * math.sin(2.3 * u + 1.1) + 14 * math.sin(5 * u)
        body.append((x, y))
    body.append((W, H))
    d.polygon(body, fill=255)
    maska = maska.filter(ImageFilter.GaussianBlur(2))

    krem = Image.new("RGB", (W, H), (250, 251, 252))
    stin = Image.new("L", (W, H), 0)
    ds = ImageDraw.Draw(stin)
    for p in range(2):
        ox = p * PANEL
        for i, (cx, cy, rx, ry) in enumerate([(0.30, 0.86, 0.22, 0.07), (0.62, 0.80, 0.25, 0.06),
                                              (0.48, 0.95, 0.30, 0.05)]):
            ds.ellipse([ox + (cx - rx) * PANEL, (cy - ry) * H, ox + (cx + rx) * PANEL, (cy + ry) * H],
                       outline=70, width=10 + i * 4)
    stin = stin.filter(ImageFilter.GaussianBlur(14))
    sedy = Image.new("RGB", (W, H), (196, 210, 226))
    krem = Image.composite(sedy, krem, stin)
    img.paste(krem, (0, 0), maska)


def stit(d, ox):
    """Odznak vlevo nahoře: rok založení a druh sportu."""
    cx, cy = ox + PANEL * 0.5, 140
    sirka, vyska = 470, 230
    obrys = [(cx - sirka / 2, cy - vyska / 2 + 30), (cx, cy - vyska / 2), (cx + sirka / 2, cy - vyska / 2 + 30),
             (cx + sirka / 2, cy + vyska / 2 - 20), (cx, cy + vyska / 2 + 18), (cx - sirka / 2, cy + vyska / 2 - 20)]
    d.polygon(obrys, fill=MODRA_TMAVA, outline=BILA, width=10)
    d.rounded_rectangle([cx - 90, cy - 104, cx + 90, cy - 56], radius=14, fill=BILA)
    d.text((cx, cy - 80), "2026", font=font("georgiab.ttf", 40), fill=MODRA_TMAVA, anchor="mm")
    d.text((cx, cy - 4), "Ultimate", font=font("georgiab.ttf", 50), fill=BILA, anchor="mm")
    d.text((cx, cy + 54), "frisbee oddíl", font=font("georgiab.ttf", 44), fill=BILA, anchor="mm")


def panel(img, ox):
    d = ImageDraw.Draw(img)
    stit(d, ox)
    cx = ox + PANEL * 0.5
    # velký červený nápis s bílým obrysem a stínem
    titulek = "JOGURTI"
    f = font("ariblk.ttf", 210)
    stin = Image.new("L", (W, H), 0)
    ImageDraw.Draw(stin).text((cx + 8, 418), titulek, font=f, fill=150, anchor="mm", stroke_width=16)
    stin = stin.filter(ImageFilter.GaussianBlur(10))
    img.paste((6, 40, 92), (0, 0), stin)
    d.text((cx, 410), titulek, font=f, fill=CERVENA, anchor="mm", stroke_width=16, stroke_fill=BILA)
    d.text((cx, 590), "Choceň", font=font("segoeprb.ttf", 150), fill=BILA, anchor="mm")
    d.text((cx + 330, 830), "neoficiální", font=font("segoeprb.ttf", 92), fill=MODRA_SVETLA, anchor="mm")


def slozeni(img):
    """Svislý pruh se „složením“ na švu etikety."""
    pruh = Image.new("RGBA", (H, 110), (0, 0, 0, 0))
    d = ImageDraw.Draw(pruh)
    d.text((430, 20), "Složení: 7 hráčů, 1 disk, 100 % spirit.",
           font=font("verdanab.ttf", 22), fill=(255, 255, 255, 230))
    d.text((430, 62), "Skladujte v pohybu. Spotřebujte na hřišti.",
           font=font("verdanab.ttf", 20), fill=(255, 255, 255, 190))
    pruh = pruh.rotate(90, expand=True)
    img.paste(pruh, (PANEL - 130, 0), pruh)


img = prechod()
smetana(img)
for p in range(2):
    panel(img, p * PANEL)
slozeni(img)
os.makedirs(os.path.dirname(VYSTUP), exist_ok=True)
img.save(VYSTUP, quality=88)
print("Uloženo:", VYSTUP)
