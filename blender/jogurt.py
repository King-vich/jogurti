"""Kelímek jogurtu s víčkem ve tvaru frisbee.

Spuštění:  blender -b -P blender/jogurt.py [-- slozka_pro_nahledy]
Výstup:    models/jogurt.glb (pro web) a models/jogurt.blend (k úpravám)
Etiketa:   blender/textury/etiketa.jpg (kreslí ji blender/etiketa.py)

Objekty, na které sahá web (js/hero.js):
  Cup     – kelímek s etiketou
  Yogurt  – hladina bílého jogurtu
  Lid     – víčko-frisbee, na spodní straně nápis JOGURTI
"""
import math
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
import spolecne as s  # noqa: E402

FONT = r"C:\Windows\Fonts\ariblk.ttf"
TEXTURA = os.path.join(s.SLOZKA, "textury", "etiketa.jpg")

# Rozměry (1 jednotka ≈ 10 cm, na velikosti nezáleží, web si model přeškáluje)
R_DNO = 0.42       # poloměr dna
R_HORNI = 0.52     # poloměr u horního okraje
VYSKA = 1.0
STENA = 0.015
R_OKRAJ = 0.565    # vyhnutý límec, na který se lepí víčko
LIMEC = 0.018
HLADINA = 0.9      # výška jogurtu
ETIKETA_OD, ETIKETA_DO = 0.06, 0.855

s.prazdna_scena()

BILA = s.material("Kelimek", "#f3f5f8", drsnost=0.3)
JOGURT = s.material("Jogurt", "#fbfbf6", drsnost=0.6)
VICKO = s.material("Frisbee", "#f7f8fa", drsnost=0.22)
NAPIS = s.material("NapisModry", "#0a4fa3", drsnost=0.45)
NAPIS2 = s.material("NapisCerveny", "#e3172f", drsnost=0.45)


def material_etiketa():
    m = bpy.data.materials.new("Etiketa")
    m.use_nodes = True
    uzly = m.node_tree.nodes
    bsdf = uzly["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.35
    obr = uzly.new("ShaderNodeTexImage")
    obr.image = bpy.data.images.load(TEXTURA)
    m.node_tree.links.new(obr.outputs["Color"], bsdf.inputs["Base Color"])
    return m


def r_venku(z):
    return R_DNO + (R_HORNI - R_DNO) * z / VYSKA


# ---------------------------------------------------------------- kelímek
profil = s.zaobli([
    (0.0, 0.0, 0),
    (R_DNO - 0.03, 0.0, 0.01),
    (R_DNO - 0.025, 0.025, 0.008),   # obvodový podstavec dna
    (R_DNO, 0.03, 0.01),
    (r_venku(0.86), 0.86, 0.01),
    (r_venku(0.86) + 0.012, 0.878, 0.008),  # stohovací prstenec
    (r_venku(VYSKA), VYSKA, 0.006),
    (R_OKRAJ, VYSKA, 0.006),
    (R_OKRAJ, VYSKA + LIMEC, 0.006),
    (r_venku(VYSKA) - STENA, VYSKA + LIMEC, 0.006),
    (R_DNO - STENA + 0.001, 0.05, 0.02),
    (0.0, 0.05, 0),
])
kelimek = s.soustruh("Cup", profil, kroky=128)
s.priradit(kelimek, BILA)
s.vyhlad(kelimek, 35)


def etiketa(z_dole, z_nahore, odsazeni, mat, kroky=160, radky=8):
    """Pruh po obvodu kelímku s UV mapou: u = úhel, v = výška."""
    me = bpy.data.meshes.new("Etiketa")
    verts, faces, uv = [], [], []
    for i in range(kroky + 1):          # o sloupec víc, ať má textura šev
        a = 2 * math.pi * i / kroky + math.pi   # šev po straně, střed panelu vpředu
        for k in range(radky + 1):
            z = z_dole + (z_nahore - z_dole) * k / radky
            r = r_venku(z) + odsazeni
            verts.append((r * math.cos(a), r * math.sin(a), z))
            uv.append((i / kroky, k / radky))
    sl = radky + 1
    for i in range(kroky):
        for k in range(radky):
            faces.append((i * sl + k, (i + 1) * sl + k, (i + 1) * sl + k + 1, i * sl + k + 1))
    me.from_pydata(verts, [], faces)
    vrstva = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices:
            vrstva.data[li].uv = uv[me.loops[li].vertex_index]
    obj = bpy.data.objects.new("Etiketa", me)
    bpy.context.collection.objects.link(obj)
    s.normaly_ven(obj)
    s.priradit(obj, mat)
    for p in me.polygons:
        p.use_smooth = True
    return obj


stitek = etiketa(ETIKETA_OD, ETIKETA_DO, 0.003, material_etiketa())
kelimek = s.spoj([kelimek, stitek], "Cup")

# ---------------------------------------------------------------- jogurt
r_jogurt = r_venku(HLADINA) - STENA - 0.002
bm = bmesh.new()
KRUHY, USEKY = 30, 128
stred = bm.verts.new((0, 0, HLADINA + 0.06))
kruhy = []
for k in range(1, KRUHY + 1):
    r = r_jogurt * k / KRUHY
    kruh = []
    for i in range(USEKY):
        a = 2 * math.pi * i / USEKY
        z = HLADINA
        z += 0.06 * math.exp(-(r / 0.2) ** 2)                       # kopeček uprostřed
        utlum = min(1.0, r / 0.08) ** 2                              # ať se střed neškrtí
        z += 0.012 * math.sin(2 * a - 18 * r) * math.exp(-(r / 0.3) ** 2) * utlum  # spirála
        z += 0.006 * math.sin(3 * a + 11 * r) * (r / r_jogurt)       # stopa po lžičce
        z += 0.012 * max(0.0, (r - r_jogurt + 0.04) / 0.04) ** 2       # menisk u stěny
        kruh.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
    kruhy.append(kruh)
for i in range(USEKY):
    bm.faces.new((stred, kruhy[0][i], kruhy[0][(i + 1) % USEKY]))
for k in range(KRUHY - 1):
    a, b = kruhy[k], kruhy[k + 1]
    for i in range(USEKY):
        i2 = (i + 1) % USEKY
        bm.faces.new((a[i], b[i], b[i2], a[i2]))
me = bpy.data.meshes.new("Yogurt")
bm.to_mesh(me)
bm.free()
jogurt = bpy.data.objects.new("Yogurt", me)
bpy.context.collection.objects.link(jogurt)
s.normaly_ven(jogurt, osa_z=True)
s.priradit(jogurt, JOGURT)
for p in me.polygons:
    p.use_smooth = True

# ---------------------------------------------------------------- víčko-frisbee
# Profil frisbee: plochý vršek s pásem jemných letových kroužků, oblé rameno,
# okraj přetažený přes límec kelímku a plochá spodní strana s nápisem.
R_VICKO = 0.6
SPODEK = 0.105   # výška spodní (vnitřní) plochy desky od spodní hrany okraje
KROUZKY = [0.36 + 0.011 * i for i in range(10)]


def vrch(r):
    z = 0.128 - 0.014 * (r / 0.55) ** 2
    for rr in KROUZKY:
        z += 0.0018 * math.exp(-((r - rr) / 0.0032) ** 2)
    return z


body = [(0.0, vrch(0.0), 0)]
body += [(0.55 * i / 220, vrch(0.55 * i / 220), 0) for i in range(1, 221)]
body += [
    (0.588, 0.108, 0.03),          # rameno
    (R_VICKO, 0.05, 0.025),
    (R_VICKO - 0.004, 0.0, 0.008),
    (R_VICKO - 0.024, 0.0, 0.008),  # spodní hrana okraje
    (R_VICKO - 0.032, 0.06, 0.012),
    (0.548, SPODEK, 0.012),         # vnitřní roh
    (0.0, SPODEK, 0),
]
profil = s.zaobli(body)
vicko = s.soustruh("Lid", profil, kroky=160)
s.priradit(vicko, VICKO)
s.vyhlad(vicko, 30)

# Nápis na spodní straně. Text se otočí o 180° kolem X, aby byl čitelný
# při pohledu zespodu (vpravo = +X, nahoru = −Y).
napisy = []
for obsah, velikost, y, mat, vytazeni in [
    ("JOGURTI", 0.2, -0.025, NAPIS, 0.004),
    ("ULTIMATE FRISBEE", 0.062, 0.13, NAPIS2, 0.0025),
    ("EST. 2026", 0.05, -0.2, NAPIS, 0.0025),
]:
    t = s.text_mesh(obsah, velikost, FONT, vytazeni=vytazeni, nazev="Napis")
    t.rotation_euler = (math.pi, 0, 0)
    t.location = (0, y, SPODEK - vytazeni + 0.0005)
    s.priradit(t, mat)
    napisy.append(t)
bpy.ops.object.select_all(action="DESELECT")
for t in napisy:
    t.select_set(True)
bpy.context.view_layer.objects.active = napisy[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

vicko = s.spoj([vicko, *napisy], "Lid")

# Víčko leží spodní hranou okraje na límci kelímku.
vicko.location = (0, 0, VYSKA + LIMEC - 0.06)

s.export_glb("jogurt")

# ---------------------------------------------------------------- náhledy
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if argv:
    slozka = argv[0]
    bpy.context.scene.display.shading.color_type = "TEXTURE"
    s.nahled(os.path.join(slozka, "jogurt_bok.png"), (0, -3.6, 0.55), (0, 0, 0.55))
    s.nahled(os.path.join(slozka, "jogurt_cely.png"), (2.2, -2.2, 2.3), (0, 0, 0.55))
    vicko.location = (0, 0, 0)
    kelimek.hide_render = True
    jogurt.hide_render = True
    bpy.context.scene.display.shading.color_type = "MATERIAL"
    s.nahled(os.path.join(slozka, "vicko_spodek.png"), (0, 0, -1.9), (0, 0, 0))
    s.nahled(os.path.join(slozka, "vicko_vrch.png"), (0, -1.5, 1.5), (0, 0, 0.06))
    vicko.location = (0, 0, VYSKA + LIMEC - 0.06)
    kelimek.hide_render = False
    jogurt.hide_render = False
    vicko.hide_render = True
    s.nahled(os.path.join(slozka, "jogurt_otevreny.png"), (1.4, -1.4, 2.4), (0, 0, 0.8))
