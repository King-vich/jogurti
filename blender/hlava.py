"""Vlasy, vousy a doplňky hlavy postavené přímo na povrchu hlavy figuríny.

Používá ho blender/hrac.py: nejdřív zavolá nastav_hlavu() se sítí hlavy figuríny
(bez očí) a polohami očí, pak vytvor_vlasy() a vytvor_doplnky().

Vlasy a pokrývky hlavy jsou „slupky“: kus povrchu hlavy vybraný maskou
a odsazený podél normál. Maska dostává směr d od středu hlavy (v souřadnicích,
kde je hlava koule o poloměru 1) a skutečnou polohu bodu co.
Obličej míří do −Y, nahoru je +Z, levá strana hráče je +X.
"""
import math

import bmesh
import bpy
from mathutils import Euler, Vector, noise

import spolecne as s

_H = {}   # sit, stred, polomery, oko_L, oko_R (střed oka), predek_L/R (y přední plochy oka)


def nastav_hlavu(sit, oci, normaly):
    """sit: bpy Mesh jen s hlavou v metrech; oci: {'L': (střed, y_přední), 'R': …};
    normaly: vyhlazené normály vrcholů sítě (podél nich se odsazují vlasy)."""
    co = [v.co for v in sit.vertices]
    mn = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
    mx = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
    _H.update(sit=sit, stred=(mn + mx) / 2, polomery=(mx - mn) / 2, mn=mn, mx=mx, normaly=normaly)
    for st in ("L", "R"):
        _H["oko_" + st], _H["predek_" + st] = oci[st]


def smer(co):
    d = co - _H["stred"]
    p = _H["polomery"]
    return Vector((d.x / p.x, d.y / p.y, d.z / p.z)).normalized()


def bod_povrchu(d, odsazeni=0.0):
    """Bod na povrchu hlavy ve směru d (a jeho normála), odsazený ven."""
    d = d.normalized()
    nej = max(_H["sit"].vertices, key=lambda v: smer(v.co).dot(d))
    n = _H["normaly"][nej.index]
    return nej.co + n * odsazeni, n.copy()


def zvon(x, stred, sirka):
    return math.exp(-((x - stred) / sirka) ** 2)


def objekt(nazev, bm, mat=None):
    m = bpy.data.meshes.new(nazev)
    bm.to_mesh(m)
    bm.free()
    o = bpy.data.objects.new(nazev, m)
    bpy.context.collection.objects.link(o)
    if mat:
        s.priradit(o, mat)
    for p in m.polygons:
        p.use_smooth = True
    return o


def elipsoid(nazev, stred, polomery, mat, segmenty=(24, 16), natoceni=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segmenty[0], v_segments=segmenty[1], radius=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * polomery[0], v.co.y * polomery[1], v.co.z * polomery[2]))
        if natoceni:
            v.co.rotate(natoceni)
        v.co += stred
    return objekt(nazev, bm, mat)


def retez(nazev, body, mat, uroven=2):
    """Plynulá „hadice“ přes body [(pozice, poloměr), ...] (modifikátor Skin)."""
    m = bpy.data.meshes.new(nazev)
    m.from_pydata([b for b, _ in body], [(i, i + 1) for i in range(len(body) - 1)], [])
    o = bpy.data.objects.new(nazev, m)
    bpy.context.collection.objects.link(o)
    o.modifiers.new("Skin", "SKIN")
    for i, (_, r) in enumerate(body):
        m.skin_vertices[0].data[i].radius = (r, r)
    m.skin_vertices[0].data[0].use_root = True
    o.modifiers.new("Hladke", "SUBSURF").levels = uroven
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier="Skin")
    bpy.ops.object.modifier_apply(modifier="Hladke")
    s.priradit(o, mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def ztlustit(o, tloustka):
    mod = o.modifiers.new("Tloustka", "SOLIDIFY")
    mod.thickness = tloustka
    mod.offset = -1
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier="Tloustka")


def skorepina(nazev, ponechat, odsazeni, mat, tloustka):
    """Kus povrchu hlavy vybraný maskou ponechat(d, co), odsazený o odsazeni(d, co) podél normál.

    Okrajové body se posunou přesně na hranici masky (půlením hrany k sousedovi
    venku), takže okraj vlasů je plynulá křivka, ne schody po ploškách sítě.
    """
    bm = bmesh.new()
    bm.from_mesh(_H["sit"])
    bm.verts.ensure_lookup_table()
    maska = lambda co: ponechat(smer(co), co)  # noqa: E731
    uvnitr = {v: maska(v.co) for v in bm.verts}
    nove = {}
    for v in bm.verts:
        if not uvnitr[v]:
            continue
        hranice = []
        for w in {w for f in v.link_faces for w in f.verts}:
            if uvnitr[w]:
                continue
            a, b = v.co.copy(), w.co.copy()
            for _ in range(10):
                stred = (a + b) / 2
                if maska(stred):
                    a = stred
                else:
                    b = stred
            hranice.append(a)
        if hranice:
            nove[v] = sum(hranice, Vector()) / len(hranice)
    normaly = {v: _H["normaly"][v.index] for v in bm.verts}
    for v, co in nove.items():
        v.co = co
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not uvnitr[v]], context="VERTS")
    for v in bm.verts:
        v.co = v.co + normaly[v] * odsazeni(smer(v.co), v.co)
    o = objekt(nazev, bm, mat)
    if tloustka:
        ztlustit(o, tloustka)
    return o


# ---------------------------------------------------------------- vlasy a vousy
def nad_vlasovou_cari(d, celo=0.48, strany=0.14, tyl=-0.55):
    f = -d.y
    if f > 0.3:
        prah = strany + (celo - strany) * min(1.0, (f - 0.3) / 0.5)
    else:
        prah = strany + (tyl - strany) * min(1.0, (0.3 - f) / 0.9)
    ucho = Vector((math.copysign(0.97, d.x), 0.1, -0.18)).normalized()
    if (d - ucho).length < 0.52:
        return False                              # oválný výřez kolem ucha
    return d.z > prah


def oci_stred():
    return (_H["oko_L"] + _H["oko_R"]) / 2


def vytvor_vlasy(MAT):
    vl = MAT["Vlasy"]
    ucesy = []

    # krátký sestřih, po stranách zastřižený
    ucesy.append(skorepina(
        "Vlasy_kratke", lambda d, co: nad_vlasovou_cari(d),
        lambda d, co: 0.0025 + 0.005 * max(0.0, d.z) + 0.0012 * noise.noise(co * 160),
        vl, 0.0025))

    # kudrnaté: objem nahoře, chomáčky
    ucesy.append(skorepina(
        "Vlasy_kudrnate", lambda d, co: nad_vlasovou_cari(d, celo=0.42, tyl=-0.62),
        lambda d, co: 0.012 + 0.016 * max(0.0, d.z) + 0.006 * max(0.0, d.y)
        + 0.007 * abs(noise.noise(co * 75)) + 0.003 * noise.noise(co * 160),
        vl, 0.004))

    # delší vlasy s ofinou do čela, pramínky
    def ofina_odsazeni(d, co):
        pramen = 0.0025 * noise.noise(Vector((co.x * 45, co.y * 45, co.z * 9)))
        cela = 0.006 * max(0.0, -d.y - 0.5) * zvon(d.z, 0.4, 0.15)
        return 0.008 + 0.011 * max(0.0, d.z) + pramen + cela

    ucesy.append(skorepina("Vlasy_ofina", lambda d, co: nad_vlasovou_cari(d, celo=0.3, tyl=-0.62),
                           ofina_odsazeni, vl, 0.003))

    # uhlazené vlasy sčesané do dlouhého culíku (až mezi lopatky)
    hlavni = skorepina(
        "Vlasy_culik", lambda d, co: nad_vlasovou_cari(d, celo=0.46, tyl=-0.6),
        lambda d, co: 0.003 + 0.004 * max(0.0, d.z) + 0.0008 * noise.noise(Vector((co.x * 60, co.y * 60, co.z * 15))),
        vl, 0.0025)
    zadek, _ = bod_povrchu(Vector((0, 1, 0.35)), 0.006)
    culik = retez("Culik", [
        (zadek, 0.02), (zadek + Vector((0, 0.032, -0.03)), 0.024), (zadek + Vector((0, 0.05, -0.09)), 0.021),
        (zadek + Vector((0, 0.052, -0.16)), 0.017), (zadek + Vector((0, 0.045, -0.23)), 0.012),
        (zadek + Vector((0, 0.036, -0.29)), 0.006),
    ], vl, 2)
    gumicka = elipsoid("Gumicka", zadek + Vector((0, 0.022, -0.016)), (0.019, 0.012, 0.019), MAT["Lem"],
                       (16, 10), Euler((0.9, 0, 0)))
    ucesy.append(s.spoj([hlavni, culik, gumicka], "Vlasy_culik"))

    # vousy: krátké strniště a plnovous (obrys se počítá od očí, ať sedí na obličej)
    m = oci_stred()

    def vousy_ponechat(d, co):
        if d.y > 0.45 or co.z > m.z - 0.035:
            return False
        rel = co - m
        rty = (rel.x / 0.026) ** 2 + ((rel.z + 0.07) / 0.013) ** 2 < 1 and co.y < m.y
        nos = abs(rel.x) < 0.02 and rel.z > -0.06 and co.y < m.y
        strana = min(1.0, max(0.0, (abs(d.x) - 0.3) / 0.55))
        linie = -0.06 + 0.04 * strana ** 1.3
        return rel.z < linie and d.y < 0.32 and not rty and not nos

    strniste = skorepina("Strniste", vousy_ponechat, lambda d, co: 0.0011, MAT["Strniste"], 0)
    plnovous = skorepina("Vousy", vousy_ponechat,
                         lambda d, co: 0.003 + 0.004 * max(0.0, -d.z - 0.5) + 0.0018 * noise.noise(co * 140),
                         vl, 0.0025)
    return ucesy + [strniste, plnovous]


# ---------------------------------------------------------------- doplňky na hlavě
def hvezda(nazev, stred, normala, velikost, mat):
    """Plochá pěticípá hvězdička (sponka do vlasů) natočená podle povrchu."""
    bm = bmesh.new()
    body = []
    for i in range(10):
        u = math.pi / 2 + i * math.pi / 5
        r = velikost if i % 2 == 0 else velikost * 0.45
        body.append(bm.verts.new((r * math.cos(u), r * math.sin(u), 0)))
    stredovy = bm.verts.new((0, 0, 0))
    for i in range(10):
        bm.faces.new((stredovy, body[i], body[(i + 1) % 10]))
    ext = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.z += velikost * 0.25
    natoceni = Vector((0, 0, 1)).rotation_difference(normala)
    for v in bm.verts:
        v.co.rotate(natoceni)
        v.co += stred
    o = objekt(nazev, bm, mat)
    for p in o.data.polygons:
        p.use_smooth = False
    return o


def kselt(nazev, mat):
    """Štítek čepice nad čelem: zploštělý disk mírně skloněný dopředu."""
    # nejpřednější bod čela na ose obličeje, ve výšce okraje čepice
    d = Vector((0, -0.85, 0.42)).normalized()
    stredove = [v for v in _H["sit"].vertices if abs(v.co.x - _H["stred"].x) < 0.01]
    celo = max(stredove, key=lambda v: smer(v.co).dot(d)).co.copy()
    celo.x = _H["stred"].x
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=1, depth=0.006,
                                        location=celo + Vector((0, -0.042, 0.004)))
    stit = bpy.context.active_object
    stit.name = nazev
    stit.scale = (0.078, 0.06, 1)
    stit.rotation_euler = (math.radians(-12), 0, 0)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    s.priradit(stit, mat)
    return stit


def vytvor_doplnky(MAT):
    """Brýle, čepice, čelenka, mašle a hvězdičky do culíku, barva na tvář."""
    vysledek = []
    sx = _H["polomery"].x

    # brýle: obroučky před očima, můstek a nožičky k uším
    casti = []
    for st, zn in (("L", 1), ("R", -1)):
        oko = _H["oko_" + st]
        stred = Vector((oko.x, _H["predek_" + st] - 0.012, oko.z))
        bpy.ops.mesh.primitive_torus_add(major_segments=40, minor_segments=8, major_radius=0.019,
                                         minor_radius=0.0014, location=stred, rotation=(math.pi / 2, 0, 0))
        obroucka = bpy.context.active_object
        obroucka.scale = (1.0, 0.78, 1.0)
        casti.append(obroucka)
        venku = stred + Vector((zn * 0.019, 0, 0.002))
        za_uchem = Vector((zn * (sx - 0.006), _H["stred"].y + 0.01, stred.z - 0.004))
        casti.append(retez("Nozicka", [(venku, 0.0013), (venku + Vector((zn * 0.006, 0.02, 0)), 0.0013),
                                        (za_uchem, 0.0013)], MAT["Bryle"], 1))
    mustek_r = Vector((_H["oko_R"].x + 0.019, _H["predek_R"] - 0.012, _H["oko_R"].z + 0.002))
    mustek_l = Vector((_H["oko_L"].x - 0.019, _H["predek_L"] - 0.012, _H["oko_L"].z + 0.002))
    casti.append(retez("Mustek", [(mustek_r, 0.0013), ((mustek_r + mustek_l) / 2 + Vector((0, -0.005, 0.003)), 0.0013),
                                   (mustek_l, 0.0013)], MAT["Bryle"], 1))
    bryle = s.spoj(casti, "Bryle")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    s.priradit(bryle, MAT["Bryle"])
    vysledek.append(bryle)

    # kšiltovka: kopule přes vlasy (nad krátkým sestřihem) a štítek
    def kopule(d, co):
        ucho = Vector((math.copysign(0.97, d.x), 0.1, -0.18)).normalized()
        return d.z > 0.1 - 0.17 * d.y and (d - ucho).length > 0.5

    ksiltovka = skorepina("Ksiltovka", kopule, lambda d, co: 0.013, MAT["Ksiltovka"], 0.004)
    vysledek.append(s.spoj([ksiltovka, kselt("Stitek", MAT["Ksiltovka"])], "Ksiltovka"))

    # samotný kšilt na čelence (sluneční kšilt bez temene)
    def pasek_kseltu(d, co):
        ucho = Vector((math.copysign(0.97, d.x), 0.1, -0.18)).normalized()
        return abs(d.z - (0.36 - 0.06 * d.y)) < 0.1 and (d - ucho).length > 0.5

    pasek = skorepina("Kselt", pasek_kseltu, lambda d, co: 0.01, MAT["Ksiltovka"], 0.004)
    vysledek.append(s.spoj([pasek, kselt("Stitek", MAT["Ksiltovka"])], "Kselt"))

    # třpytivá čelenka přes kudrnaté vlasy: vpředu nad čelem, vzadu výš na temeni
    vysledek.append(skorepina(
        "Celenka", lambda d, co: abs(d.z - (0.44 + 0.2 * max(0.0, d.y))) < 0.06,
        # těsně nad nejvyššími kudrnami (stejný tvar jako Vlasy_kudrnate + rezerva)
        lambda d, co: 0.024 + 0.016 * max(0.0, d.z) + 0.006 * max(0.0, d.y),
        MAT["Celenka"], 0.0025))

    # mašle u gumičky culíku a hvězdičky ve vlasech
    zadek, _ = bod_povrchu(Vector((0, 1, 0.35)), 0.006)
    masle = []
    for posun_x, mat in ((-0.012, MAT["MasleModra"]), (0.012, MAT["MasleCervena"])):
        start = zadek + Vector((posun_x, 0.03, -0.016))
        stuha = retez("Masle", [(start, 0.008), (start + Vector((posun_x * 1.6, 0.014, -0.06)), 0.009),
                                (start + Vector((posun_x * 2.4, 0.008, -0.13)), 0.007)], mat, 1)
        for v in stuha.data.vertices:          # stuha je plochá (tenká dozadu, široká do strany)
            v.co.y = start.y + (v.co.y - start.y) * 0.25 + (v.co.z - start.z) * -0.05
        masle.append(stuha)
    vysledek.append(s.spoj(masle, "Masle"))
    hvezdy = []
    for d, mat in (((0.42, -0.5, 0.76), MAT["Hvezda"]), ((0.6, -0.32, 0.73), MAT["MasleCervena"]),
                   ((0.7, -0.12, 0.7), MAT["MasleModra"])):
        bod, normala = bod_povrchu(Vector(d), 0.01)
        hvezdy.append(hvezda("Hvezda", bod, normala, 0.0085, mat))
    vysledek.append(s.spoj(hvezdy, "Hvezdy"))

    # barva na pravé tváři (−X): modrý pruh s bílým pruhem uvnitř, pod okem
    lic = _H["oko_R"] + Vector((-0.006, 0, -0.034))

    def barva(sirka):
        return lambda d, co: (co.y < _H["oko_R"].y + 0.01
                              and ((co.x - lic.x) / 0.024) ** 2 + ((co.z - lic.z) / sirka) ** 2 < 1)

    modra = skorepina("Barva", barva(0.011), lambda d, co: 0.0005, MAT["Barva"], 0)
    bila = skorepina("Barva2", barva(0.0035), lambda d, co: 0.0009, MAT["Hvezda"], 0)
    vysledek.append(s.spoj([modra, bila], "Barva"))
    return vysledek
