"""Společné pomocné funkce pro skripty modelů (spouští se uvnitř Blenderu)."""
import math
import os

import bmesh
import bpy
from mathutils import Vector

SLOZKA = os.path.dirname(os.path.abspath(__file__))
MODELY = os.path.normpath(os.path.join(SLOZKA, "..", "models"))


def prazdna_scena():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def hex_na_linear(hex_barva):
    """'#ff3e6c' -> lineární RGB, jak ho čeká Principled BSDF i glTF."""
    h = hex_barva.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


def material(nazev, hex_barva, drsnost=0.5, kov=0.0):
    m = bpy.data.materials.new(nazev)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*hex_na_linear(hex_barva), 1)
    b.inputs["Roughness"].default_value = drsnost
    b.inputs["Metallic"].default_value = kov
    m.diffuse_color = (*hex_na_linear(hex_barva), 1)  # barva i ve Workbench náhledu
    return m


def zaobli(body, kroky=6):
    """Zaoblí rohy uzavřeného profilu. body = [(r, z, polomer_zaobleni), ...]."""
    out = []
    n = len(body)
    for i, (r, z, rad) in enumerate(body):
        p = Vector((r, z))
        if rad <= 0:
            out.append((r, z))
            continue
        a = Vector(body[i - 1][:2])
        c = Vector(body[(i + 1) % n][:2])
        da, dc = a - p, c - p
        rr = min(rad, da.length * 0.45, dc.length * 0.45)
        p0 = p + da.normalized() * rr
        p2 = p + dc.normalized() * rr
        for k in range(kroky + 1):
            t = k / kroky
            q = (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p + t ** 2 * p2
            out.append((q.x, q.y))
    return out


def soustruh(nazev, profil, kroky=128, uzavreny=True):
    """Orotuje profil [(r, z), ...] kolem osy Z a vrátí objekt."""
    me = bpy.data.meshes.new(nazev)
    n = len(profil)
    verts, faces = [], []
    for i in range(kroky):
        a = 2 * math.pi * i / kroky
        ca, sa = math.cos(a), math.sin(a)
        verts += [(r * ca, r * sa, z) for r, z in profil]
    segmenty = n if uzavreny else n - 1
    for i in range(kroky):
        i2 = (i + 1) % kroky
        for j in range(segmenty):
            j2 = (j + 1) % n
            faces.append((i * n + j, i * n + j2, i2 * n + j2, i2 * n + j))
    me.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new(nazev, me)
    bpy.context.collection.objects.link(obj)
    uklid_mesh(obj, prepocitat_normaly=uzavreny)
    return obj


def uklid_mesh(obj, prepocitat_normaly=True):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6)
    if prepocitat_normaly:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()


def normaly_ven(obj, osa_z=False):
    """Otočí stěny otevřené plochy tak, aby mířily od osy (nebo nahoru při osa_z)."""
    for p in obj.data.polygons:
        if osa_z:
            spatne = p.normal.z < 0
        else:
            radial = Vector((p.center.x, p.center.y, 0))
            spatne = p.normal.dot(radial) < 0
        if spatne:
            p.flip()
    obj.data.update()


def vyhlad(obj, uhel=40):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(uhel))


def priradit(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def spoj(objekty, nazev):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objekty:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objekty[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = nazev
    obj.data.name = nazev
    return obj


def text_mesh(obsah, velikost, font_cesta, vytazeni=0.003, nazev="Text"):
    krivka = bpy.data.curves.new(nazev, "FONT")
    krivka.body = obsah
    krivka.size = velikost
    krivka.extrude = vytazeni
    krivka.align_x = "CENTER"
    krivka.align_y = "CENTER"
    if font_cesta and os.path.exists(font_cesta):
        krivka.font = bpy.data.fonts.load(font_cesta)
    obj = bpy.data.objects.new(nazev, krivka)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    return bpy.context.view_layer.objects.active


# Komprese Draco zmenší soubory s jemnou geometrií (kroužky frisbee, nápisy)
# zhruba desetkrát. Web ji rozbaluje přes DRACOLoader.
DRACO = dict(export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)


def export_glb(nazev, draco=True, **dalsi):
    cesta = os.path.join(MODELY, nazev + ".glb")
    bpy.ops.export_scene.gltf(filepath=cesta, export_format="GLB", export_yup=True,
                              export_apply=True, **(DRACO if draco else {}), **dalsi)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(MODELY, nazev + ".blend"))
    print("Uloženo:", cesta)


def nahled(cesta_png, poloha_kamery, cil, rozliseni=(900, 700), objektiv=50, dutiny=True):
    """Rychlý náhledový render (Workbench) pro kontrolu modelu."""
    sc = bpy.context.scene
    cam_data = bpy.data.cameras.new("NahledKamera")
    cam_data.lens = objektiv
    cam = bpy.data.objects.new("NahledKamera", cam_data)
    sc.collection.objects.link(cam)
    cam.location = poloha_kamery
    smer = Vector(cil) - Vector(poloha_kamery)
    cam.rotation_euler = smer.to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.display.shading.show_shadows = True
    sc.display.shading.show_cavity = dutiny   # zvýraznění záhybů (přehání drobné nerovnosti)
    sc.render.resolution_x, sc.render.resolution_y = rozliseni
    sc.render.filepath = cesta_png
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
