"""Hráč ultimate frisbee postavený z figuríny BodyKun / BodyChan (vinchau, CC0).

Spuštění (soubor figuríny se otevře jako scéna, skripty v něm se nespouští):
  blender -b --disable-autoexec blender/stazene/bodychan/bodychan.blend
          -P blender/hrac.py -- muz|zena [slozka_pro_nahledy]
Výstup:  models/hrac_muz.glb nebo models/hrac_zena.glb (+ .blend)

Z figuríny se převezme tělo, obličej a váhy kostí Rigify. Skript z ní udělá
hráče s kostrou, kterou používá web (js/hraci.js):
  panev, pater, hrudnik, krk, hlava, stehno_L/R, lytko_L/R, chodidlo_L/R,
  rameno_L/R, predlokti_L/R, dlan_L/R
Materiály (web je přebarvuje): Dres, Lem, Rukav, LemRukavu, Kratasy, Stulpny,
  Boty, Podrazka, Kuze, Oci, Duhovka, Zornice, Vlasy, Ksiltovka a doplňky
Doplňky (web je zapíná podle hráče): Vlasy_*, Strniste, Vousy, Ksiltovka, Kselt,
  Bryle, Celenka, Masle, Hvezdy, Barva, Tejp, Potitko, Naramky
Hráč stojí na zemi v počátku a dívá se do −Y (ve webu do +Z). Levá strana je +X.
"""
import math
import re
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector, noise  # noqa: E402
from mathutils.kdtree import KDTree  # noqa: E402

import hlava as hl  # noqa: E402
import spolecne as s  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
DRUH = argv[0] if argv else "muz"
SLOZKA_NAHLEDU = argv[1] if len(argv) > 1 else None
FIGURINA = {"muz": "body_kun_rig", "zena": "rig"}[DRUH]
DIL_HLAVY = {"muz": "head", "zena": "Head"}[DRUH]
VYSKA = {"muz": 1.82, "zena": 1.70}[DRUH]
PAZE_DOLU = math.radians(28)    # figurína má paže víc od těla, než s jakými počítají pózy webu

# ---------------------------------------------------------------- figurína ze souboru
rig = bpy.data.objects[FIGURINA]
dily = [o for o in bpy.data.objects if o.type == "MESH" and o.parent == rig]

# oči jsou v hlavě samostatné díly – označíme je atributem, ať je po spojení najdeme
# díl hlavy se označí taky: nepřepočítává se s tělem, aby neztratil rysy obličeje
for o in dily:
    attr = o.data.attributes.new("oko", "INT", "FACE")
    hlava_attr = o.data.attributes.new("hlava_dil", "INT", "FACE")
    if o.name != DIL_HLAVY:
        continue
    for h in hlava_attr.data:
        h.value = 1
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.faces.ensure_lookup_table()
    videno = set()
    casti = []
    for f in bm.faces:
        if f.index in videno:
            continue
        zasobnik, cast = [f], []
        videno.add(f.index)
        while zasobnik:
            x = zasobnik.pop()
            cast.append(x.index)
            for e in x.edges:
                for g in e.link_faces:
                    if g.index not in videno:
                        videno.add(g.index)
                        zasobnik.append(g)
        casti.append(cast)
    bm.free()
    casti.sort(key=len)
    for cast in casti[:-1]:                 # vše kromě největšího dílu jsou oči
        for i in cast:
            attr.data[i].value = 1

# kopie dílů v klidové poloze, spojené do jednoho těla
kopie = []
for o in dily:
    data = o.data.copy()
    data.transform(o.matrix_world)
    k = bpy.data.objects.new("Telo_" + o.name, data)
    bpy.context.collection.objects.link(k)
    for g in o.vertex_groups:
        k.vertex_groups.new(name=g.name)
    kopie.append(k)
telo = s.spoj(kopie, "Telo")
me = telo.data
me.materials.clear()

dno = min(v.co.z for v in me.vertices)
K = VYSKA / (max(v.co.z for v in me.vertices) - dno)
PREVOD = Matrix.Scale(K, 4) @ Matrix.Translation((0, 0, -dno))
me.transform(PREVOD)


def p(nazev, ocas=False):
    b = rig.data.bones[nazev]
    return PREVOD @ (rig.matrix_world @ (b.tail_local if ocas else b.head_local))


# ---------------------------------------------------------------- kostra pro web
BODY = {
    "P": p("DEF-spine"), "W": p("DEF-spine.001"), "C": p("DEF-spine.002"),
    "S": p("DEF-spine.004"), "Hb": p("DEF-spine.006"), "Ht": p("DEF-spine.006", True),
}
for st in ("L", "R"):
    BODY.update({
        f"kycel_{st}": p(f"DEF-thigh.{st}"), f"koleno_{st}": p(f"DEF-shin.{st}"),
        f"kotnik_{st}": p(f"DEF-foot.{st}"), f"spicka_{st}": p(f"DEF-toe.{st}", True),
        f"rameno_{st}": p(f"DEF-upper_arm.{st}"), f"loket_{st}": p(f"DEF-forearm.{st}"),
        f"zapesti_{st}": p(f"DEF-hand.{st}"),
    })
    # prsty: čtyři prsty se ohýbají společně (dva články), palec zvlášť
    PRSTY4 = ("f_index", "f_middle", "f_ring", "f_pinky")
    BODY[f"klouby_{st}"] = sum((p(f"DEF-{f}.01.{st}") for f in PRSTY4), Vector()) / 4
    BODY[f"clanky_{st}"] = sum((p(f"DEF-{f}.02.{st}") for f in PRSTY4), Vector()) / 4
    BODY[f"konecky_{st}"] = sum((p(f"DEF-{f}.03.{st}", True) for f in PRSTY4), Vector()) / 4
    BODY[f"palec_{st}"] = p(f"DEF-thumb.01.{st}")
    BODY[f"palec2_{st}"] = p(f"DEF-thumb.02.{st}")
    BODY[f"palecK_{st}"] = p(f"DEF-thumb.03.{st}", True)

KOSTI = {
    "panev": ("P", "W", None), "pater": ("W", "C", "panev"), "hrudnik": ("C", "S", "pater"),
    "krk": ("S", "Hb", "hrudnik"), "hlava": ("Hb", "Ht", "krk"),
}
for st in ("L", "R"):
    KOSTI.update({
        f"stehno_{st}": (f"kycel_{st}", f"koleno_{st}", "panev"),
        f"lytko_{st}": (f"koleno_{st}", f"kotnik_{st}", f"stehno_{st}"),
        f"chodidlo_{st}": (f"kotnik_{st}", f"spicka_{st}", f"lytko_{st}"),
        f"rameno_{st}": (f"rameno_{st}", f"loket_{st}", "hrudnik"),
        f"predlokti_{st}": (f"loket_{st}", f"zapesti_{st}", f"rameno_{st}"),
        f"dlan_{st}": (f"zapesti_{st}", f"klouby_{st}", f"predlokti_{st}"),
        f"prst1_{st}": (f"klouby_{st}", f"clanky_{st}", f"dlan_{st}"),
        f"prst2_{st}": (f"clanky_{st}", f"konecky_{st}", f"prst1_{st}"),
        f"palec1_{st}": (f"palec_{st}", f"palec2_{st}", f"dlan_{st}"),
        f"palec2_{st}": (f"palec2_{st}", f"palecK_{st}", f"palec1_{st}"),
    })
RUKA = {f"{k}_{st}" for k in ("dlan", "prst1", "prst2", "palec1", "palec2") for st in ("L", "R")}

# Natočení kostí ruky (roll) podle Rigify: prsty i palec se ohýbají kolem své lokální osy X.
ROLL_ZDROJ = {"dlan": "DEF-hand", "prst1": "DEF-f_middle.01", "prst2": "DEF-f_middle.02",
              "palec1": "DEF-thumb.01", "palec2": "DEF-thumb.02"}


def osa_z_rigify(nazev):
    b = rig.data.bones[nazev]
    return (rig.matrix_world.to_3x3() @ b.matrix_local.to_3x3()).col[2].normalized()


ROLL = {f"{k}_{st}": osa_z_rigify(f"{zdroj}.{st}") for k, zdroj in ROLL_ZDROJ.items() for st in ("L", "R")}


def nase_kost(skupina):
    """Kost Rigify (DEF-…) → naše kost, nebo None."""
    # tvary názvů: DEF-spine, DEF-spine.004, DEF-thigh.L, DEF-thigh.L.001, DEF-f_index.02.R
    shoda = re.match(r"DEF-([a-z_]+)(?:\.(\d+))?(?:\.([LR]))?(?:\.\d+)?$", skupina)
    if not shoda:
        return None
    zaklad, cislo, st = shoda.group(1), int(shoda.group(2) or 0), shoda.group(3)
    if zaklad == "spine":
        return ["panev", "pater", "hrudnik", "hrudnik", "krk", "krk", "hlava"][min(cislo, 6)]
    mapa = {"pelvis": "panev", "breast": "hrudnik", "shoulder": "hrudnik", "thigh": "stehno", "shin": "lytko",
            "foot": "chodidlo", "toe": "chodidlo", "heel": "chodidlo", "upper_arm": "rameno",
            "forearm": "predlokti", "hand": "dlan", "palm": "dlan"}
    if zaklad == "thumb":
        cil = "palec1" if cislo <= 1 else "palec2"
    elif zaklad in ("f_index", "f_middle", "f_ring", "f_pinky"):
        cil = "prst1" if cislo <= 1 else "prst2"
    else:
        cil = mapa.get(zaklad)
    if cil is None:
        return None
    return cil if cil in ("panev", "hrudnik") else f"{cil}_{st}"


# váhy Rigify sečtené do našich kostí
stare = {g.index: nase_kost(g.name) for g in telo.vertex_groups}
VAHY = []
for v in me.vertices:
    w = {}
    for g in v.groups:
        cil = stare.get(g.group)
        if cil and g.weight > 0:
            w[cil] = w.get(cil, 0) + g.weight
    soucet = sum(w.values()) or 1
    VAHY.append({k: x / soucet for k, x in w.items()})
telo.vertex_groups.clear()


# ---------------------------------------------------------------- paže dolů (postoj, se kterým počítají pózy)
def otoc_bod(bod_, stred, rot):
    return stred + rot @ (bod_ - stred)


for st, zn in (("L", 1), ("R", -1)):
    stred = BODY[f"rameno_{st}"].copy()
    rot = Matrix.Rotation(zn * PAZE_DOLU, 3, "Y")
    pazni = {f"rameno_{st}", f"predlokti_{st}"} | {k for k in RUKA if k.endswith(st)}
    for v, w in zip(me.vertices, VAHY):
        podil = sum(x for kk, x in w.items() if kk in pazni)
        if podil > 0:
            v.co = v.co.lerp(otoc_bod(v.co, stred, rot), podil)
    for n in (f"loket_{st}", f"zapesti_{st}", f"klouby_{st}", f"clanky_{st}", f"konecky_{st}",
              f"palec_{st}", f"palec2_{st}", f"palecK_{st}"):
        BODY[n] = otoc_bod(BODY[n], stred, rot)
    for k in [k for k in RUKA if k.endswith(st)]:
        ROLL[k] = rot @ ROLL[k]


def bod(n):
    return BODY[n]


def vzdalenost_k_usecce(pt, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (pt - a).dot(ab) / ab.length_squared))
    return (pt - (a + ab * t)).length, t


def nejblizsi_kost(pt, kandidati=None):
    nej, nej_d, nej_t = None, 1e9, 0
    for k, (h, o, _) in KOSTI.items():
        if kandidati and k not in kandidati:
            continue
        d, t = vzdalenost_k_usecce(pt, bod(h), bod(o))
        if d < nej_d:
            nej, nej_d, nej_t = k, d, t
    return nej, nej_d, nej_t


# ---------------------------------------------------------------- spojité tělo bez švů figuríny
# Figurína je z dílů jako kloubová panenka (švy na kolenou, loktech, krku…).
# Postup: díly se zjemní (figurína je hrubá síť, hladká jen díky stínování – bez
# zjemnění by se hrany „zapekly“ do povrchu), nafouknou o UZAVRENI, přetaví voxelovým
# remeshem do jednoho povrchu, zjednoduší a zase splasknou. Úzké drážky švů se tím
# zaplní (morfologické uzavření). Hlava a ruce se nenafukují, ať se neslijí prsty
# a nezmizí rysy obličeje. Oči zůstanou samostatné. Váhy kostí se přenesou z původních vrcholů.
VOXEL = 0.0016          # 1,6 mm – zachová rysy obličeje i mezery mezi prsty
UZAVRENI = 0.006        # zaplní drážky užší než 12 mm
CIL_PLOSEK = 26000      # čtyřúhelníků před zjednodušením → asi 52 tisíc trojúhelníků

maska = telo.vertex_groups.new(name="Uzavreni")
for i, w in enumerate(VAHY):
    mimo = w.get("hlava", 0) + sum(w.get(k, 0) for k in RUKA)
    maska.add([i], max(0.0, 1 - 1.5 * mimo), "REPLACE")
stare_co = [v.co.copy() for v in me.vertices]
stare_vahy = VAHY
bm = bmesh.new()
bm.from_mesh(me)
bm.faces.ensure_lookup_table()
oko_vrstva = bm.faces.layers.int["oko"]
hlava_vrstva = bm.faces.layers.int["hlava_dil"]
ocni_plosky = [f for f in bm.faces if f[oko_vrstva] or f[hlava_vrstva]]   # oči a hlava zůstanou, jak jsou
# švy = místa, kde se dotýká bod jednoho dílu s bodem jiného dílu
bm.verts.ensure_lookup_table()
dil = [-1] * len(bm.verts)
for v0 in bm.verts:
    if dil[v0.index] >= 0:
        continue
    zasobnik = [v0]
    dil[v0.index] = v0.index
    while zasobnik:
        x = zasobnik.pop()
        for e in x.link_edges:
            w = e.other_vert(x)
            if dil[w.index] < 0:
                dil[w.index] = v0.index
                zasobnik.append(w)
strom_dilu = KDTree(len(bm.verts))
for v in bm.verts:
    strom_dilu.insert(v.co, v.index)
strom_dilu.balance()
hranicni = [v.co.copy() for v in bm.verts
            if not any(f[oko_vrstva] for f in v.link_faces)
            and any(dil[j] != dil[v.index] for _, j, _ in strom_dilu.find_range(v.co, 0.012))]
# oči zvlášť
bm_oci = bm.copy()
bm_oci.faces.ensure_lookup_table()
vrstvy = (bm_oci.faces.layers.int["oko"], bm_oci.faces.layers.int["hlava_dil"])
bmesh.ops.delete(bm_oci, geom=[f for f in bm_oci.faces if not (f[vrstvy[0]] or f[vrstvy[1]])], context="FACES")
bmesh.ops.delete(bm, geom=ocni_plosky, context="FACES")
bm.to_mesh(me)
bm.free()
me_oci = bpy.data.meshes.new("Oci")
bm_oci.to_mesh(me_oci)
bm_oci.free()



def aplikuj(typ, **nastaveni):
    mod = telo.modifiers.new(typ, typ)
    for klic, hodnota in nastaveni.items():
        setattr(mod, klic, hodnota)
    bpy.context.view_layer.objects.active = telo
    bpy.ops.object.select_all(action="DESELECT")
    telo.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return telo.data


me = aplikuj("SUBSURF", levels=2)
idx_masky = telo.vertex_groups["Uzavreni"].index
pred_remeshem = [(v.co.copy(), next((g.weight for g in v.groups if g.group == idx_masky), 0.0))
                 for v in me.vertices]
me = aplikuj("DISPLACE", strength=UZAVRENI, mid_level=0, direction="NORMAL", vertex_group="Uzavreni")
me = aplikuj("REMESH", mode="VOXEL", voxel_size=VOXEL, adaptivity=0)
me = aplikuj("DECIMATE", decimate_type="COLLAPSE", ratio=min(1.0, CIL_PLOSEK / max(1, len(me.polygons))))
strom_masky = KDTree(len(pred_remeshem))
for i, (c, _) in enumerate(pred_remeshem):
    strom_masky.insert(c, i)
strom_masky.balance()
bm = bmesh.new()
bm.from_mesh(me)
bm.normal_update()
for v in bm.verts:
    _, j, _ = strom_masky.find(v.co)
    v.co -= v.normal * UZAVRENI * pred_remeshem[j][1]
bm.to_mesh(me)
bm.free()
del pred_remeshem, strom_masky
me = aplikuj("CORRECTIVE_SMOOTH", factor=0.8, iterations=6, smooth_type="LENGTH_WEIGHTED", use_only_smooth=True)
telo.vertex_groups.clear()

# vyhlazení zbytků švů: vrcholy blízko původních okrajů dílů
print("Bodů na švech:", len(hranicni))
strom_sev = KDTree(len(hranicni))
for i, c in enumerate(hranicni):
    strom_sev.insert(c, i)
strom_sev.balance()
bm = bmesh.new()
bm.from_mesh(me)
# kulové klouby loktů a zápěstí mají širší drážky – vyhlazuje se v pásmu 1,6 cm,
# nejsilněji přímo na švu
pasma = [(0.026, 6), (0.016, 10), (0.008, 8)]
for polomer, opakovani in pasma:
    u_svu = [v for v in bm.verts if strom_sev.find(v.co)[2] < polomer]
    for _ in range(opakovani):
        bmesh.ops.smooth_vert(bm, verts=u_svu, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.to_mesh(me)
bm.free()

# váhy: vážený průměr čtyř nejbližších původních vrcholů
strom = KDTree(len(stare_co))
for i, c in enumerate(stare_co):
    strom.insert(c, i)
strom.balance()
VAHY = []
for v in me.vertices:
    w = {}
    for _, j, d in strom.find_n(v.co, 4):
        vaha = 1 / max(d, 1e-4) ** 2
        for k, x in stare_vahy[j].items():
            w[k] = w.get(k, 0) + x * vaha
    soucet = sum(w.values()) or 1
    VAHY.append({k: x / soucet for k, x in w.items()})

# oči zpátky (na konec seznamu vrcholů), označené atributem
me.attributes.new("oko", "INT", "FACE")
oci_obj = bpy.data.objects.new("Oci", me_oci)
bpy.context.collection.objects.link(oci_obj)
for v in me_oci.vertices:
    _, j, _ = strom.find(v.co)
    VAHY.append(dict(stare_vahy[j]))
telo = s.spoj([telo, oci_obj], "Telo")
me = telo.data
print("Spojité tělo:", len(me.vertices), "vrcholů,", len(me.polygons), "plošek")

# ---------------------------------------------------------------- boty místo bosých nohou
# prsty se vyhladí a chodidlo se trochu nafoukne, aby vypadalo jako kopačka
BOTY = max(bod("kotnik_L").z, bod("kotnik_R").z) + 0.012
bm = bmesh.new()
bm.from_mesh(me)
noha = [v for v in bm.verts if v.co.z < BOTY + 0.01 and abs(v.co.x) > 0.02]
for _ in range(90):                     # obyčejné vyhlazení smaže prsty (chodidlo se zúží)
    bmesh.ops.smooth_vert(bm, verts=noha, factor=0.6, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.normal_update()
for v in noha:                          # … a nafouknutím se vrátí objem boty
    if v.co.z > 0.004:
        v.co += v.normal * 0.01
    v.co.z = max(v.co.z, 0.0)          # rovná podrážka
bm.to_mesh(me)
bm.free()

# ---------------------------------------------------------------- materiály
MAT = {
    "Dres": s.material("Dres", "#f5f7fa", drsnost=0.75),
    "Lem": s.material("Lem", "#0a4fa3", drsnost=0.7),
    "Rukav": s.material("Rukav", "#f5f7fa", drsnost=0.75),
    "LemRukavu": s.material("LemRukavu", "#0a4fa3", drsnost=0.7),
    "Kratasy": s.material("Kratasy", "#16325c", drsnost=0.7),
    "Stulpny": s.material("Stulpny", "#ffffff", drsnost=0.85),
    "Boty": s.material("Boty", "#1d1f24", drsnost=0.45),
    "Podrazka": s.material("Podrazka", "#f2f2f2", drsnost=0.6),
    "Kuze": s.material("Kuze", "#e2b48f", drsnost=0.55),
    "Oci": s.material("Oci", "#f2eee6", drsnost=0.15),
    "Duhovka": s.material("Duhovka", "#4a6a8a", drsnost=0.15),
    "Zornice": s.material("Zornice", "#0b0b0d", drsnost=0.1),
    "Strniste": s.material("Strniste", "#8a6a55", drsnost=0.9),
    "Vlasy": s.material("Vlasy", "#4a3222", drsnost=0.8),
    "Ksiltovka": s.material("Ksiltovka", "#6d6259", drsnost=0.75),
    "Celenka": s.material("Celenka", "#d9d4c4", drsnost=0.25, kov=0.85),
    "Bryle": s.material("Bryle", "#1a1a1e", drsnost=0.3),
    "Tejp": s.material("Tejp", "#f4f4f2", drsnost=0.9),
    "Potitko": s.material("Potitko", "#f7f7f7", drsnost=0.95),
    "Naramky": s.material("Naramky", "#c8323c", drsnost=0.6),
    "Naramky2": s.material("Naramky2", "#2f6fd0", drsnost=0.6),
    "MasleModra": s.material("MasleModra", "#1f4fb5", drsnost=0.5),
    "MasleCervena": s.material("MasleCervena", "#d6283a", drsnost=0.5),
    "Hvezda": s.material("Hvezda", "#ffffff", drsnost=0.4),
    "Barva": s.material("Barva", "#8fc3ee", drsnost=0.6),
}

# --- řezy oblečení (relativně ke kloubům figuríny, aby seděly i pro ženskou postavu)
KYCEL = (bod("kycel_L").z + bod("kycel_R").z) / 2
KOLENO = (bod("koleno_L").z + bod("koleno_R").z) / 2
LEM_DRESU = KYCEL + 0.045
LEM_KRATASU = KYCEL - 0.22
STULPNY = KOLENO - 0.19
RUKAV = (0.47, 0.54)       # konec rukávu jako podíl délky ramene
RAMENO_DRESU = 0.17        # do této délky ramene sahá dres i u verze bez rukávů

bm = bmesh.new()
bm.from_mesh(me)


def rez(bod_roviny, normala, jen_kosti):
    steny = [f for f in bm.faces if nejblizsi_kost(f.calc_center_median())[0] in jen_kosti]
    hrany = list({e for f in steny for e in f.edges})
    vrcholy = list({v for f in steny for v in f.verts})
    bmesh.ops.bisect_plane(bm, geom=vrcholy + hrany + steny, plane_co=bod_roviny, plane_no=normala)


NAHORU = Vector((0, 0, 1))
rez(Vector((0, 0, LEM_DRESU)), NAHORU, {"panev", "pater", "stehno_L", "stehno_R"})
rez(Vector((0, 0, LEM_KRATASU)), NAHORU, {"stehno_L", "stehno_R"})
rez(Vector((0, 0, STULPNY)), NAHORU, {"lytko_L", "lytko_R"})
rez(Vector((0, 0, BOTY)), NAHORU, {"lytko_L", "lytko_R", "chodidlo_L", "chodidlo_R"})
rez(Vector((0, 0, 0.016)), NAHORU, {"lytko_L", "lytko_R", "chodidlo_L", "chodidlo_R"})
for st in ("L", "R"):
    a, b = bod(f"rameno_{st}"), bod(f"loket_{st}")
    for t in (RAMENO_DRESU, *RUKAV):
        rez(a + (b - a) * t, (b - a).normalized(), {f"rameno_{st}"})
bm.to_mesh(me)
bm.free()

# řezy přidaly vrcholy – váhy jim dáme podle nejbližšího původního vrcholu
puvodni = len(VAHY)
if puvodni < len(me.vertices):
    strom = KDTree(puvodni)
    for i in range(puvodni):
        strom.insert(me.vertices[i].co, i)
    strom.balance()
    for i in range(puvodni, len(me.vertices)):
        _, j, _ = strom.find(me.vertices[i].co)
        VAHY.append(dict(VAHY[j]))

# osa a poloměr krku (výstřih a límec)
osa_krku = (bod("S") + bod("Hb")) / 2
_krk = sorted(math.hypot(v.co.x - osa_krku.x, v.co.y - osa_krku.y) for v, w in zip(me.vertices, VAHY)
              if abs(v.co.z - osa_krku.z) < 0.012 and w.get("krk", 0) > 0.5)
R_KRKU = _krk[len(_krk) // 2]
_koren = sorted(v.co.z for v in me.vertices
                if bod("S").z - 0.06 < v.co.z < osa_krku.z
                and R_KRKU + 0.004 < math.hypot(v.co.x - osa_krku.x, v.co.y - osa_krku.y) < R_KRKU + 0.014)
LIMEC_Z = _koren[len(_koren) // 2] if _koren else bod("S").z

for m in MAT.values():
    me.materials.append(m)
INDEX = {n: i for i, n in enumerate(MAT)}
oko = me.attributes["oko"].data
for poly in me.polygons:
    c = Vector(poly.center)
    if oko[poly.index].value:
        # oko: dopředu mířící plošky jsou duhovka, úplný střed zornice
        do_predu = -poly.normal.y
        nazev = "Zornice" if do_predu > 0.98 else ("Duhovka" if do_predu > 0.88 else "Oci")
        poly.material_index = INDEX[nazev]
        continue
    # komu ploška patří, říkají váhy figuríny (spolehlivější než vzdálenost od kostí:
    # ruce visí těsně u trupu)
    soucet = {}
    for vi in poly.vertices:
        for kk, x in VAHY[vi].items():
            soucet[kk] = soucet.get(kk, 0) + x
    k = max(soucet, key=soucet.get) if soucet else nejblizsi_kost(c)[0]
    _, t = vzdalenost_k_usecce(c, bod(KOSTI[k][0]), bod(KOSTI[k][1]))
    nazev = "Kuze"
    od_krku = math.hypot(c.x - osa_krku.x, c.y - osa_krku.y)
    if k in ("panev", "pater", "hrudnik", "krk"):
        nazev = "Dres" if c.z >= LEM_DRESU else "Kratasy"
        if (od_krku < R_KRKU + 0.006 and c.z > LIMEC_Z - 0.01) or (k == "krk" and c.z > LIMEC_Z):
            nazev = "Kuze"      # krk je kůže, přechod zakryje límec
    elif k.startswith("stehno"):
        if c.z >= LEM_DRESU:
            nazev = "Dres"
        elif c.z > LEM_KRATASU:
            nazev = "Kratasy"
    elif k.startswith("rameno"):
        if t < RAMENO_DRESU:
            nazev = "Dres"
        elif t < RUKAV[0]:
            nazev = "Rukav"
        elif t < RUKAV[1]:
            nazev = "LemRukavu"
    elif k.startswith(("lytko", "chodidlo")):
        # hranice bota/štulpna jde podle výšky (řez BOTY), ne podle kosti
        if c.z < BOTY:
            nazev = "Boty"
        elif c.z < STULPNY:
            nazev = "Stulpny"
    if nazev == "Boty" and c.z < 0.016:
        nazev = "Podrazka"
    poly.material_index = INDEX[nazev]
me.attributes.remove(me.attributes["oko"])
if "hlava_dil" in me.attributes:
    me.attributes.remove(me.attributes["hlava_dil"])

# --- UV mapa dresu: válec kolem svislé osy (přední střed u = 0,25, zadní 0,75),
#     v od výstřihu (0) k lemu dresu (1). Web na ni kreslí čísla a nápisy.
DRES_OD, DRES_DO = LEM_DRESU - 0.025, LIMEC_Z + 0.02
for vrstva in list(me.uv_layers):
    me.uv_layers.remove(vrstva)
uv = me.uv_layers.new(name="UVMap")
for poly in me.polygons:
    stred_u = ((math.atan2(poly.center.x, -poly.center.y) + math.pi / 2) / (2 * math.pi)) % 1
    for li in poly.loop_indices:
        co = me.vertices[me.loops[li].vertex_index].co
        u = ((math.atan2(co.x, -co.y) + math.pi / 2) / (2 * math.pi)) % 1
        if u - stred_u > 0.5:
            u -= 1
        elif stred_u - u > 0.5:
            u += 1
        uv.data[li].uv = (u, (co.z - DRES_OD) / (DRES_DO - DRES_OD))
for poly in me.polygons:
    poly.use_smooth = True

# --- límec: prstenec kolem kořene krku
bpy.ops.mesh.primitive_torus_add(major_segments=64, minor_segments=12, major_radius=R_KRKU + 0.006,
                                 minor_radius=0.0075, location=(osa_krku.x, osa_krku.y, LIMEC_Z))
limec = bpy.context.active_object
limec.name = "Limec"
limec.scale = (1.0, 1.06, 1.0)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
s.priradit(limec, MAT["Lem"])
for poly in limec.data.polygons:
    poly.use_smooth = True

# ---------------------------------------------------------------- vlasy a doplňky hlavy
# Staví se přímo na povrchu hlavy figuríny (hlava.py): síť hlavy bez očí a polohy očí.
OCI = {}
for st, zn in (("L", 1), ("R", -1)):
    plosky = [pl for pl in me.polygons if pl.center.x * zn > 0
              and pl.material_index in (INDEX["Oci"], INDEX["Duhovka"], INDEX["Zornice"])]
    stred_oka = sum((Vector(pl.center) for pl in plosky), Vector()) / len(plosky)
    OCI[st] = (stred_oka, min(pl.center.y for pl in plosky))

hlava_sit = me.copy()
bm = bmesh.new()
bm.from_mesh(hlava_sit)
bm.verts.ensure_lookup_table()
oci_indexy = {INDEX["Oci"], INDEX["Duhovka"], INDEX["Zornice"]}
ocni = {v for f in bm.faces if f.material_index in oci_indexy for v in f.verts}
bmesh.ops.delete(bm, geom=[bm.verts[i] for i, w in enumerate(VAHY)
                           if w.get("hlava", 0) < 0.5 or bm.verts[i] in ocni], context="VERTS")
# hlava figuríny je hrubá síť – pro jemné obrysy (barva na tváři, linie vlasů) se zjemní
bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True, smooth=0.0)
bm.to_mesh(hlava_sit)
bm.free()
# vlasy a čepice se odsazují podél normál – ty musí být hladké (průměr okolí 1,5 cm),
# jinak jsou ve vlasech díry; tvar hlavy se přitom nemění
strom_hlavy = KDTree(len(hlava_sit.vertices))
for v in hlava_sit.vertices:
    strom_hlavy.insert(v.co, v.index)
strom_hlavy.balance()
hladke = []
for v in hlava_sit.vertices:
    n = sum((hlava_sit.vertices[j].normal for _, j, _ in strom_hlavy.find_range(v.co, 0.015)), Vector())
    hladke.append(n.normalized() if n.length > 0 else v.normal.copy())
hl.nastav_hlavu(hlava_sit, OCI, hladke)

doplnky = [*hl.vytvor_vlasy(MAT), *hl.vytvor_doplnky(MAT)]


# ---------------------------------------------------------------- pásky na těle
def pasek(nazev, kost_, t, delka, mat, pridat=0.004):
    """Prstenec kolem končetiny (tejp, potítko, náramek), obtisknutý na tělo."""
    h, o, _ = KOSTI[kost_]
    a, b = bod(h), bod(o)
    osa = (b - a).normalized()
    stred = a + (b - a) * t
    rez_ = [v.co.copy() for v, w in zip(me.vertices, VAHY)
            if w.get(kost_, 0) + w.get(KOSTI[kost_][2] or "", 0) > 0.3
            and abs((v.co - stred).dot(osa)) < delka / 2
            and ((v.co - stred) - osa * (v.co - stred).dot(osa)).length < 0.09]
    # kost neprochází středem končetiny – střed pásku je těžiště průřezu
    if rez_:
        stred = sum(rez_, Vector()) / len(rez_)
        stred -= osa * (stred - a).dot(osa) - osa * ((a + (b - a) * t) - a).dot(osa)
    r = max(((c - stred) - osa * (c - stred).dot(osa)).length for c in rez_) + 0.01 if rez_ else 0.06
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=r, depth=delka, end_fill_type="NOTHING", location=stred)
    o = bpy.context.active_object
    o.name = nazev
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(osa).to_euler()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obtisk = o.modifiers.new("Obtisk", "SHRINKWRAP")
    obtisk.target = telo
    obtisk.wrap_method = "NEAREST_SURFACEPOINT"
    obtisk.offset = pridat
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier="Obtisk")
    hl.ztlustit(o, -0.0015)
    s.priradit(o, mat)
    for poly in o.data.polygons:
        poly.use_smooth = True
    o.vertex_groups.new(name=kost_).add([v.index for v in o.data.vertices], 1.0, "REPLACE")
    return o


telesne = [
    s.spoj([pasek("Tejp", "lytko_L", 0.2, 0.04, MAT["Tejp"], 0.001),
            pasek("Tejp_R", "lytko_R", 0.2, 0.04, MAT["Tejp"], 0.001)],
           "Tejp"),
    pasek("Potitko", "predlokti_R", 0.84, 0.055, MAT["Potitko"], 0.006),
    s.spoj([pasek("Naramky", "predlokti_L", 0.9, 0.007, MAT["Naramky"], 0.003),
            pasek("Naramky2", "predlokti_L", 0.95, 0.007, MAT["Naramky2"], 0.003),
            pasek("Naramky3", "predlokti_L", 0.86, 0.006, MAT["Hvezda"], 0.003)], "Naramky"),
]

# ---------------------------------------------------------------- barvy vrcholů: stínování a odstíny
# Do barvy vrcholů (COLOR_0, web ji násobí s barvou materiálu) se zapeče:
#  - okluze (Cycles AO): podpaží, mezi prsty, pod bradou, oční důlky, záhyby dresu
#  - odstíny pleti: do červena tváře, nos, uši, rty, kolena, lokty a klouby
#  - u vlasů světlejší a tmavší pramínky
SILA_OKLUZE = 0.6


def zapec_okluzi(objekt, viditelne):
    """AO do barvy vrcholů objektu; stíní jen objekty v seznamu viditelne."""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 48
    sc.cycles.device = "CPU"
    sc.render.bake.target = "VERTEX_COLORS"
    sc.world = sc.world or bpy.data.worlds.new("Svet")
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.hide_render = o not in viditelne and o is not objekt
    data = objekt.data
    if "Okluze" not in data.color_attributes:
        data.color_attributes.new("Okluze", "BYTE_COLOR", "POINT")
    data.color_attributes.active_color = data.color_attributes["Okluze"]
    bpy.ops.object.select_all(action="DESELECT")
    objekt.select_set(True)
    bpy.context.view_layer.objects.active = objekt
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    return [c.color[0] for c in data.color_attributes["Okluze"].data]


def zapis_barvy(objekt, barvy):
    data = objekt.data
    vrstva = data.color_attributes.get("Col") or data.color_attributes.new("Col", "BYTE_COLOR", "POINT")
    for c, b in zip(vrstva.data, barvy):
        c.color = (*b, 1.0)
    data.color_attributes.active_color = vrstva
    data.color_attributes.render_color_index = list(data.color_attributes).index(vrstva)
    if "Okluze" in data.color_attributes:
        data.color_attributes.remove(data.color_attributes["Okluze"])


def stin(ao):
    return 1 - SILA_OKLUZE * (1 - ao) ** 1.2


# --- tělo
ao = zapec_okluzi(telo, [telo, limec])
kuze_index = INDEX["Kuze"]
kuze_vrcholy = set()
for poly in me.polygons:
    if poly.material_index == kuze_index:
        kuze_vrcholy.update(poly.vertices)
oci_m = (OCI["L"][0] + OCI["R"][0]) / 2
RUMENEC = Vector((1.0, 0.86, 0.84))
barvy = []
for i, v in enumerate(me.vertices):
    t = stin(ao[i])
    b = Vector((t, t, t))
    if i in kuze_vrcholy:
        co = v.co
        w = VAHY[i] if i < len(VAHY) else {}
        rel = co - oci_m
        cerven = 0.0
        if w.get("hlava", 0) > 0.5 and co.y < oci_m.y + 0.03:
            cerven += 0.8 * math.exp(-((abs(rel.x) - 0.035) / 0.018) ** 2 - ((rel.z + 0.03) / 0.02) ** 2)  # tváře
            cerven += 0.6 * math.exp(-(rel.x / 0.01) ** 2 - ((rel.z + 0.035) / 0.012) ** 2)               # špička nosu
            rty = math.exp(-(rel.x / 0.022) ** 2 - ((rel.z + 0.072) / 0.007) ** 2)
            b = Vector((b.x * (1 - 0.12 * rty), b.y * (1 - 0.38 * rty), b.z * (1 - 0.36 * rty)))
        if w.get("hlava", 0) > 0.5 and abs(rel.x) > 0.06:
            cerven += 0.5                                                                                   # uši
        for kloub in ("koleno_L", "koleno_R", "loket_L", "loket_R"):
            cerven += 0.5 * math.exp(-((co - BODY[kloub]).length / 0.045) ** 2)
        if sum(w.get(k, 0) for k in RUKA) > 0.5:
            cerven += 0.35                                                                                  # ruce
        cerven = min(1.0, cerven)
        b = Vector((b.x * (1 + (RUMENEC.x - 1) * cerven), b.y * (1 + (RUMENEC.y - 1) * cerven),
                    b.z * (1 + (RUMENEC.z - 1) * cerven)))
    barvy.append(tuple(min(1.0, x) for x in b))
zapis_barvy(telo, barvy)
zapis_barvy(limec, [(1.0, 1.0, 1.0)] * len(limec.data.vertices))

# --- vlasy, čepice a doplňky: okluze od hlavy, vlasy navíc pramínky
for o in [*doplnky, *telesne]:
    ao = zapec_okluzi(o, [telo])
    vlasy = o.name.startswith("Vlasy") or o.name in ("Vousy", "Strniste")
    barvy = []
    for i, v in enumerate(o.data.vertices):
        t = stin(ao[i])
        if vlasy:
            d = v.co - hl._H["stred"]
            delka_ = math.atan2(d.x, -d.y)                 # pramínky běží od čela dozadu
            pramen = noise.noise(Vector((delka_ * 9, d.z * 2.5, 0))) + 0.5 * noise.noise(Vector((delka_ * 26, d.z * 6, 1)))
            t *= 0.86 + 0.24 * (0.5 + 0.5 * pramen)
        barvy.append((min(1.0, t),) * 3)
    zapis_barvy(o, barvy)
for o in bpy.data.objects:
    if o.type == "MESH":
        o.hide_render = False
bpy.context.scene.render.engine = "BLENDER_WORKBENCH"

# ---------------------------------------------------------------- armatura a váhy
arm_data = bpy.data.armatures.new("Kostra")
armatura = bpy.data.objects.new("Kostra", arm_data)
bpy.context.collection.objects.link(armatura)
bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active = armatura
armatura.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
for nazev, (h, o, _) in KOSTI.items():
    b = arm_data.edit_bones.new(nazev)
    b.head = bod(h)
    b.tail = bod(o)
    if nazev in ROLL:
        b.align_roll(ROLL[nazev])
for nazev, (_, _, rodic) in KOSTI.items():
    if rodic:
        arm_data.edit_bones[nazev].parent = arm_data.edit_bones[rodic]
bpy.ops.object.mode_set(mode="OBJECT")

skupiny = {k: telo.vertex_groups.new(name=k) for k in KOSTI}
for i, w in enumerate(VAHY):
    for k, x in w.items():
        if x > 0.01:
            skupiny[k].add([i], x, "REPLACE")
for o in doplnky:
    o.vertex_groups.new(name="hlava").add([v.index for v in o.data.vertices], 1.0, "REPLACE")
for nazev_kosti, w in (("hrudnik", 0.65), ("krk", 0.35)):
    limec.vertex_groups.new(name=nazev_kosti).add([v.index for v in limec.data.vertices], w, "REPLACE")

nase_objekty = [telo, limec, *doplnky, *telesne]
for o in nase_objekty:
    o.parent = armatura
    o.modifiers.new("Kostra", "ARMATURE").object = armatura

# všechno ostatní z figuríny pryč (rigy, widgety, druhá postava, světla, kamera)
for o in list(bpy.data.objects):
    if o not in nase_objekty and o != armatura:
        bpy.data.objects.remove(o)
for t in list(bpy.data.texts):
    bpy.data.texts.remove(t)

# ---------------------------------------------------------------- export
for o in nase_objekty:
    o.data.validate()           # spojování a řezy občas nechají zdvojené hrany
bpy.ops.object.select_all(action="DESELECT")
cesta = os.path.join(s.MODELY, f"hrac_{DRUH}.glb")
bpy.ops.export_scene.gltf(filepath=cesta, export_format="GLB", export_yup=True,
                          export_skins=True, export_animations=False, export_apply=True,
                          export_vertex_color="ACTIVE", export_draco_color_quantization=8, **s.DRACO)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(s.MODELY, f"hrac_{DRUH}.blend"))
print("Uloženo:", cesta, "výška", VYSKA, "vrcholů", len(me.vertices), "krk", round(R_KRKU, 3))

# ---------------------------------------------------------------- náhledy
if SLOZKA_NAHLEDU:
    vse = ["Vlasy_kratke", "Vlasy_kudrnate", "Vlasy_ofina", "Vlasy_culik", "Strniste", "Vousy", "Ksiltovka",
           "Kselt", "Bryle", "Celenka", "Masle", "Hvezdy", "Barva", "Tejp", "Potitko", "Naramky"]

    def jen(*viditelne):
        for n in vse:
            bpy.data.objects[n].hide_render = n not in viditelne

    z = bod("Hb").z + 0.07
    jen("Vlasy_kratke", "Strniste", "Tejp")
    s.nahled(os.path.join(SLOZKA_NAHLEDU, f"f_{DRUH}_cely.png"), (0.9, -3.6, 1.1), (0, 0, VYSKA / 2),
             rozliseni=(600, 800))
    s.nahled(os.path.join(SLOZKA_NAHLEDU, f"f_{DRUH}_oblicej.png"), (0.15, -0.62, z + 0.02), (0, 0, z),
             rozliseni=(500, 500), objektiv=60)
    jen("Vlasy_culik", "Masle", "Hvezdy", "Barva", "Naramky")
    s.nahled(os.path.join(SLOZKA_NAHLEDU, f"f_{DRUH}_culik.png"), (-0.45, -0.5, z + 0.05), (0, 0, z - 0.02),
             rozliseni=(500, 500), objektiv=60)
    jen("Vlasy_kudrnate", "Celenka")
    s.nahled(os.path.join(SLOZKA_NAHLEDU, f"f_{DRUH}_kudrny.png"), (0.5, -0.5, z + 0.08), (0, 0, z),
             rozliseni=(500, 500), objektiv=60)
    jen("Ksiltovka", "Bryle", "Vlasy_kratke")
    s.nahled(os.path.join(SLOZKA_NAHLEDU, f"f_{DRUH}_bryle.png"), (0.25, -0.62, z + 0.04), (0, 0, z),
             rozliseni=(500, 500), objektiv=60)
