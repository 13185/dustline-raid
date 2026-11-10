#!/usr/bin/env python3
"""Procedural original assets for 尘线突击 / Dustline Raid.
Run: blender --background --python art/build_assets.py
Author: Jack. No third-party / Valve / CS meshes.
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MODELS = os.path.join(ROOT, 'models')
ART = HERE
os.makedirs(MODELS, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.curves):
        for block in list(coll):
            coll.remove(block)


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_tr(obj, loc=False, rot=True, scale=True):
    select_only(obj)
    bpy.ops.object.transform_apply(location=loc, rotation=rot, scale=scale)


def add_bevel(obj, width=0.003, segments=2, angle=40):
    if width <= 0:
        return
    m = obj.modifiers.new('Bevel', 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=m.name)


def shade(obj, angle=42):
    select_only(obj)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
    except Exception:
        bpy.ops.object.shade_smooth()


def finish(obj, bevel=0.003, angle=42):
    if bevel:
        add_bevel(obj, bevel)
    shade(obj, angle)
    return obj


def new_empty(name, loc=(0.0, 0.0, 0.0)):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'PLAIN_AXES'
    e.empty_display_size = 0.03
    e.location = loc
    bpy.context.collection.objects.link(e)
    return e


def parent(child, root):
    child.parent = root


def assign(obj, mat):
    if mat is None:
        return obj
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return obj


def mesh_cube(name, loc, size, mat, bevel=0.003, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    apply_tr(obj)
    assign(obj, mat)
    return finish(obj, bevel)


def mesh_cyl(name, loc, radius, depth, mat, bevel=0.002, rot=(0, 0, 0), verts=16):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius, depth=depth, location=loc, rotation=rot, vertices=verts)
    obj = bpy.context.active_object
    obj.name = name
    apply_tr(obj)
    assign(obj, mat)
    return finish(obj, bevel)


def mesh_sphere(name, loc, radius, mat, bevel=0.0, scale=None, segs=16):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=segs, ring_count=max(8, segs // 2))
    obj = bpy.context.active_object
    obj.name = name
    if scale:
        obj.scale = scale
        apply_tr(obj)
    assign(obj, mat)
    return finish(obj, bevel, angle=50)


def mesh_torus(name, loc, major, minor, mat, rot=(0, 0, 0), major_seg=20, minor_seg=10):
    bpy.ops.mesh.primitive_torus_add(
        location=loc, rotation=rot, major_radius=major, minor_radius=minor,
        major_segments=major_seg, minor_segments=minor_seg)
    obj = bpy.context.active_object
    obj.name = name
    apply_tr(obj)
    assign(obj, mat)
    return finish(obj, 0.0, angle=50)


def cyl_between(name, a, b, radius, mat, bevel=0.002, verts=12):
    a = Vector(a)
    b = Vector(b)
    vec = b - a
    h = vec.length
    if h < 1e-6:
        h = 1e-6
    mid = (a + b) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=h, location=mid, vertices=verts)
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(vec.normalized())
    apply_tr(obj)
    assign(obj, mat)
    return finish(obj, bevel)


def hash01(x, y, s=0):
    n = int(x * 374761393 + y * 668265263 + s * 1274126177) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return (n ^ (n >> 16)) / 4294967296.0


def fbm(x, y, octaves=4, seed=1):
    v = 0.0
    a = 0.5
    f = 1.0
    s = 0.0
    for i in range(octaves):
        v += hash01(math.floor(x * f * 13.7 + seed), math.floor(y * f * 9.1 + seed * 3), seed + i) * a
        s += a
        a *= 0.5
        f *= 2.0
    return v / s


def make_image(name, size, fn):
    img = bpy.data.images.new(name, size, size, alpha=False)
    px = [0.0] * (size * size * 4)
    for y in range(size):
        v = y / size
        for x in range(size):
            u = x / size
            r, g, b = fn(u, v)
            i = (y * size + x) * 4
            px[i] = max(0, min(1, r))
            px[i + 1] = max(0, min(1, g))
            px[i + 2] = max(0, min(1, b))
            px[i + 3] = 1.0
    img.pixels = px
    img.pack()
    return img


def principled(name, color, rough=0.5, metal=0.0, img=None, emit=None, emit_str=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = True
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (color[0], color[1], color[2], 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if alpha < 1:
        bsdf.inputs['Alpha'].default_value = alpha
        mat.blend_method = 'BLEND'
        mat.shadow_method = 'NONE'
    if emit is not None:
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = (emit[0], emit[1], emit[2], 1)
        if 'Emission Strength' in bsdf.inputs:
            bsdf.inputs['Emission Strength'].default_value = emit_str
    if img is not None:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        tex.location = (-460, 220)
        mix = nt.nodes.new('ShaderNodeMixRGB')
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Fac'].default_value = 0.38
        mix.inputs['Color1'].default_value = (color[0], color[1], color[2], 1)
        mix.location = (-200, 200)
        nt.links.new(tex.outputs['Color'], mix.inputs['Color2'])
        nt.links.new(mix.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def build_textures():
    T = {}
    T['metal'] = make_image('tex_metal', 256, lambda u, v: (
        0.62 + 0.12 * fbm(u * 6, v * 18, 4, 2) + 0.06 * math.sin(v * 80),
        0.63 + 0.10 * fbm(u * 6, v * 18, 4, 3),
        0.65 + 0.09 * fbm(u * 6, v * 18, 4, 4),
    ))
    T['worn'] = make_image('tex_worn', 256, lambda u, v: (
        0.22 + 0.10 * fbm(u * 5, v * 8, 5, 7) + 0.08 * (1 if fbm(u * 9, v * 9, 3, 11) > 0.72 else 0) * 0.35,
        0.18 + 0.07 * fbm(u * 5, v * 8, 5, 8),
        0.13 + 0.05 * fbm(u * 5, v * 8, 5, 9),
    ))
    T['polymer'] = make_image('tex_polymer', 256, lambda u, v: (
        0.10 + 0.03 * fbm(u * 10, v * 10, 3, 12),
        0.09 + 0.03 * fbm(u * 10, v * 10, 3, 13),
        0.08 + 0.02 * fbm(u * 10, v * 10, 3, 14),
    ))
    T['khaki'] = make_image('tex_khaki', 256, lambda u, v: (
        0.72 + 0.12 * fbm(u * 4, v * 4, 5, 21) - 0.08 * fbm(u * 12, v * 3, 3, 22),
        0.60 + 0.10 * fbm(u * 4, v * 4, 5, 23) - 0.06 * fbm(u * 12, v * 3, 3, 24),
        0.34 + 0.08 * fbm(u * 4, v * 4, 5, 25),
    ))
    T['denim'] = make_image('tex_denim', 256, lambda u, v: (
        0.18 + 0.05 * fbm(u * 8, v * 8, 4, 31) + 0.04 * (0.5 + 0.5 * math.sin(u * 140)),
        0.28 + 0.06 * fbm(u * 8, v * 8, 4, 32) + 0.03 * (0.5 + 0.5 * math.sin(v * 90)),
        0.48 + 0.07 * fbm(u * 8, v * 8, 4, 33),
    ))
    T['knit'] = make_image('tex_knit', 256, lambda u, v: (
        0.62 + 0.10 * fbm(u * 6, v * 6, 3, 41) + 0.06 * (0.5 + 0.5 * math.sin(u * 70)),
        0.58 + 0.08 * fbm(u * 6, v * 6, 3, 42),
        0.52 + 0.07 * fbm(u * 6, v * 6, 3, 43),
    ))
    T['wood'] = make_image('tex_wood', 256, lambda u, v: (
        0.42 + 0.16 * fbm(u * 2, v * 14, 4, 51) + 0.05 * math.sin(v * 50 + fbm(u, v, 2, 5) * 4),
        0.28 + 0.10 * fbm(u * 2, v * 14, 4, 52),
        0.14 + 0.06 * fbm(u * 2, v * 14, 4, 53),
    ))
    T['canvas'] = make_image('tex_canvas', 256, lambda u, v: (
        0.78 + 0.08 * fbm(u * 5, v * 5, 4, 61) - 0.06 * fbm(u * 18, v * 2, 2, 62),
        0.70 + 0.07 * fbm(u * 5, v * 5, 4, 63),
        0.48 + 0.06 * fbm(u * 5, v * 5, 4, 64),
    ))
    T['cargo'] = make_image('tex_cargo', 256, lambda u, v: (
        0.42 + 0.10 * fbm(u * 4, v * 5, 4, 71),
        0.34 + 0.08 * fbm(u * 4, v * 5, 4, 72),
        0.20 + 0.05 * fbm(u * 4, v * 5, 4, 73),
    ))
    return T


def build_gun_mats(T):
    return {
        'metal': principled('GunMetal', (0.18, 0.19, 0.21), 0.32, 0.88, T['metal']),
        'slide': principled('GunSlide', (0.08, 0.085, 0.09), 0.22, 0.9, T['metal']),
        'worn': principled('GunWorn', (0.24, 0.19, 0.13), 0.48, 0.55, T['worn']),
        'polymer': principled('GunPolymer', (0.09, 0.08, 0.07), 0.78, 0.06, T['polymer']),
        'brass': principled('GunBrass', (0.76, 0.58, 0.22), 0.28, 0.92),
        'glass': principled('GunGlass', (0.05, 0.09, 0.07), 0.06, 0.15, alpha=0.42),
        'rust': principled('GunRust', (0.42, 0.22, 0.10), 0.72, 0.28, T['worn']),
        'tan': principled('GunTan', (0.55, 0.44, 0.26), 0.7, 0.08, T['khaki']),
        'olive': principled('GunOlive', (0.28, 0.30, 0.16), 0.74, 0.05),
    }


# Barrel along +Y so glTF Y-up export maps it to -Z (camera forward).
# Grip along -Z. Right +X.


def build_pistol(M):
    root = new_empty('FP_Pistol')
    slide = mesh_cube('PistolSlide', (0, 0.03, 0.038), (0.023, 0.172, 0.026), M['slide'], 0.0014)
    parent(slide, root)
    for i in range(8):
        y = -0.042 + i * 0.0065
        rid = mesh_cube(f'PistolSerr{i}', (0, y, 0.0505), (0.020, 0.0032, 0.004), M['slide'], 0.0004)
        parent(rid, root)
    barrel = mesh_cyl('PistolBarrel', (0, 0.138, 0.034), 0.0062, 0.058, M['metal'], 0.0006, rot=(math.pi / 2, 0, 0), verts=14)
    parent(barrel, root)
    frame = mesh_cube('PistolFrame', (0, 0.018, 0.020), (0.021, 0.138, 0.020), M['worn'], 0.0016)
    parent(frame, root)
    dust = mesh_cube('PistolDust', (0, 0.072, 0.026), (0.022, 0.036, 0.012), M['worn'], 0.001)
    parent(dust, root)
    grip = mesh_cube('PistolGrip', (0, -0.018, -0.028), (0.020, 0.030, 0.082), M['polymer'], 0.003, rot=(-0.30, 0, 0))
    parent(grip, root)
    panel_l = mesh_cube('PistolPanelL', (-0.012, -0.018, -0.028), (0.004, 0.026, 0.070), M['tan'], 0.002, rot=(-0.30, 0, 0))
    panel_r = mesh_cube('PistolPanelR', (0.012, -0.018, -0.028), (0.004, 0.026, 0.070), M['tan'], 0.002, rot=(-0.30, 0, 0))
    parent(panel_l, root)
    parent(panel_r, root)
    guard = mesh_torus('PistolGuard', (0, 0.024, 0.004), 0.016, 0.0032, M['worn'], rot=(0, math.pi / 2, 0))
    parent(guard, root)
    trig = mesh_cube('PistolTrig', (0, 0.022, -0.002), (0.006, 0.010, 0.018), M['metal'], 0.001, rot=(0.35, 0, 0))
    parent(trig, root)
    mag = mesh_cube('PistolMag', (0, -0.012, -0.062), (0.016, 0.022, 0.028), M['metal'], 0.0015, rot=(-0.30, 0, 0))
    parent(mag, root)
    hammer = mesh_cube('PistolHammer', (0, -0.052, 0.046), (0.006, 0.012, 0.014), M['metal'], 0.001, rot=(0.5, 0, 0))
    parent(hammer, root)
    rs = mesh_cube('PistolRearSight', (0, -0.044, 0.054), (0.014, 0.010, 0.008), M['slide'], 0.0006)
    notch = mesh_cube('PistolNotch', (0, -0.044, 0.058), (0.005, 0.010, 0.006), M['slide'], 0.0003)
    fs = mesh_cube('PistolFrontSight', (0, 0.102, 0.054), (0.004, 0.012, 0.010), M['slide'], 0.0005)
    parent(rs, root)
    parent(notch, root)
    parent(fs, root)
    parent(new_empty('muzzle', (0, 0.168, 0.034)), root)
    parent(new_empty('sight', (0, 0.02, 0.058)), root)
    return root


def build_smg(M):
    root = new_empty('FP_SMG')
    recv = mesh_cube('SMGRecv', (0, 0.02, 0.024), (0.028, 0.18, 0.036), M['worn'], 0.002)
    parent(recv, root)
    upper = mesh_cube('SMGUpper', (0, 0.04, 0.044), (0.024, 0.16, 0.014), M['slide'], 0.0014)
    parent(upper, root)
    barrel = mesh_cyl('SMGBarrel', (0, 0.195, 0.028), 0.007, 0.14, M['metal'], 0.0008, rot=(math.pi / 2, 0, 0), verts=14)
    parent(barrel, root)
    shroud = mesh_cyl('SMGShroud', (0, 0.168, 0.028), 0.011, 0.08, M['worn'], 0.001, rot=(math.pi / 2, 0, 0), verts=12)
    parent(shroud, root)
    rail = mesh_cube('SMGRail', (0, 0.03, 0.054), (0.016, 0.14, 0.007), M['slide'], 0.0008)
    parent(rail, root)
    for i in range(8):
        t = mesh_cube(f'SMGRailT{i}', (0, -0.03 + i * 0.018, 0.0585), (0.014, 0.007, 0.004), M['metal'], 0.0003)
        parent(t, root)
    grip = mesh_cube('SMGGrip', (0, -0.02, -0.028), (0.020, 0.028, 0.078), M['polymer'], 0.003, rot=(-0.28, 0, 0))
    parent(grip, root)
    mag = mesh_cube('SMGMag', (0, 0.012, -0.055), (0.016, 0.028, 0.10), M['metal'], 0.002, rot=(0.12, 0, 0))
    parent(mag, root)
    stock = mesh_cube('SMGStock', (0, -0.12, 0.028), (0.018, 0.10, 0.022), M['polymer'], 0.002)
    parent(stock, root)
    pad = mesh_cube('SMGPad', (0, -0.175, 0.028), (0.028, 0.016, 0.038), M['polymer'], 0.003)
    parent(pad, root)
    hg = mesh_cube('SMGHand', (0, 0.10, 0.010), (0.026, 0.08, 0.024), M['polymer'], 0.002)
    parent(hg, root)
    ch = mesh_cyl('SMGCharge', (0.016, 0.06, 0.046), 0.004, 0.034, M['metal'], 0.0005, rot=(0, math.pi / 2, 0), verts=10)
    parent(ch, root)
    # compact red-dot
    optic = mesh_cube('SMGOptic', (0, 0.02, 0.072), (0.022, 0.046, 0.024), M['slide'], 0.0015)
    parent(optic, root)
    glass = mesh_cyl('SMGGlass', (0, 0.038, 0.074), 0.009, 0.006, M['glass'], 0.0, rot=(math.pi / 2, 0, 0), verts=12)
    parent(glass, root)
    parent(new_empty('muzzle', (0, 0.268, 0.028)), root)
    parent(new_empty('sight', (0, 0.01, 0.078)), root)
    return root


def build_rifle(M):
    root = new_empty('FP_Rifle')
    recv = mesh_cube('RifleRecv', (0, 0.03, 0.022), (0.028, 0.20, 0.034), M['worn'], 0.0022)
    parent(recv, root)
    dust = mesh_cube('RifleDust', (0.012, 0.04, 0.032), (0.008, 0.07, 0.018), M['slide'], 0.001)
    parent(dust, root)
    hg = mesh_cube('RifleHG', (0, 0.20, 0.022), (0.026, 0.18, 0.030), M['worn'], 0.002)
    parent(hg, root)
    barrel = mesh_cyl('RifleBarrel', (0, 0.40, 0.022), 0.0065, 0.28, M['metal'], 0.0007, rot=(math.pi / 2, 0, 0), verts=14)
    parent(barrel, root)
    gas = mesh_cyl('RifleGas', (0, 0.30, 0.040), 0.0045, 0.16, M['metal'], 0.0005, rot=(math.pi / 2, 0, 0), verts=10)
    parent(gas, root)
    fs_block = mesh_cube('RifleFSB', (0, 0.42, 0.034), (0.014, 0.016, 0.022), M['metal'], 0.001)
    parent(fs_block, root)
    muzzle_br = mesh_cyl('RifleBrake', (0, 0.545, 0.022), 0.009, 0.028, M['metal'], 0.0006, rot=(math.pi / 2, 0, 0), verts=12)
    parent(muzzle_br, root)
    rail = mesh_cube('RifleRail', (0, 0.04, 0.042), (0.018, 0.20, 0.008), M['slide'], 0.0008)
    parent(rail, root)
    for i in range(10):
        t = mesh_cube(f'RifleRailT{i}', (0, -0.05 + i * 0.02, 0.047), (0.016, 0.007, 0.004), M['metal'], 0.0003)
        parent(t, root)
    grip = mesh_cube('RifleGrip', (0, -0.02, -0.030), (0.020, 0.028, 0.082), M['polymer'], 0.003, rot=(-0.30, 0, 0))
    parent(grip, root)
    mag = mesh_cube('RifleMag', (0, 0.03, -0.052), (0.018, 0.030, 0.10), M['metal'], 0.002, rot=(0.18, 0, 0))
    parent(mag, root)
    stock = mesh_cube('RifleStock', (0, -0.14, 0.018), (0.024, 0.14, 0.028), M['polymer'], 0.003)
    parent(stock, root)
    pad = mesh_cube('RiflePad', (0, -0.218, 0.018), (0.034, 0.018, 0.044), M['polymer'], 0.003)
    parent(pad, root)
    stock_c = mesh_cyl('RifleStockC', (0, -0.10, 0.018), 0.011, 0.08, M['polymer'], 0.001, rot=(math.pi / 2, 0, 0), verts=10)
    parent(stock_c, root)
    # readable scope
    tube = mesh_cyl('ScopeTube', (0, 0.03, 0.078), 0.016, 0.088, M['slide'], 0.0012, rot=(math.pi / 2, 0, 0), verts=18)
    parent(tube, root)
    objl = mesh_cyl('ScopeObj', (0, 0.082, 0.078), 0.021, 0.022, M['slide'], 0.0012, rot=(math.pi / 2, 0, 0), verts=18)
    parent(objl, root)
    ocu = mesh_cyl('ScopeOcu', (0, -0.022, 0.078), 0.018, 0.018, M['slide'], 0.0012, rot=(math.pi / 2, 0, 0), verts=16)
    parent(ocu, root)
    glass_f = mesh_cyl('ScopeGlassF', (0, 0.094, 0.078), 0.017, 0.004, M['glass'], 0.0, rot=(math.pi / 2, 0, 0), verts=16)
    glass_r = mesh_cyl('ScopeGlassR', (0, -0.032, 0.078), 0.014, 0.004, M['glass'], 0.0, rot=(math.pi / 2, 0, 0), verts=16)
    parent(glass_f, root)
    parent(glass_r, root)
    tur1 = mesh_cyl('ScopeTurret', (0, 0.03, 0.100), 0.007, 0.016, M['metal'], 0.0006, verts=12)
    tur2 = mesh_cyl('ScopeTurretW', (0.018, 0.03, 0.078), 0.006, 0.014, M['metal'], 0.0006, rot=(0, math.pi / 2, 0), verts=12)
    parent(tur1, root)
    parent(tur2, root)
    mount = mesh_cube('ScopeMount', (0, 0.03, 0.056), (0.016, 0.055, 0.018), M['metal'], 0.001)
    parent(mount, root)
    parent(new_empty('muzzle', (0, 0.562, 0.022)), root)
    parent(new_empty('sight', (0, -0.028, 0.078)), root)
    return root


def build_shotgun(M):
    root = new_empty('FP_Shotgun')
    recv = mesh_cube('SGRecv', (0, 0.02, 0.018), (0.030, 0.12, 0.036), M['worn'], 0.0025)
    parent(recv, root)
    barrel = mesh_cyl('SGBarrel', (0, 0.22, 0.030), 0.010, 0.32, M['metal'], 0.001, rot=(math.pi / 2, 0, 0), verts=16)
    parent(barrel, root)
    tube = mesh_cyl('SGMagTube', (0, 0.18, 0.010), 0.008, 0.22, M['metal'], 0.0008, rot=(math.pi / 2, 0, 0), verts=14)
    parent(tube, root)
    pump = mesh_cube('SGPump', (0, 0.14, 0.016), (0.032, 0.08, 0.038), M['polymer'], 0.004)
    parent(pump, root)
    rings = mesh_cyl('SGRing', (0, 0.30, 0.020), 0.014, 0.016, M['worn'], 0.001, rot=(math.pi / 2, 0, 0), verts=12)
    parent(rings, root)
    bead = mesh_sphere('SGBead', (0, 0.36, 0.044), 0.0045, M['brass'], segs=10)
    parent(bead, root)
    grip = mesh_cube('SGGrip', (0, -0.01, -0.028), (0.022, 0.030, 0.074), M['polymer'], 0.0035, rot=(-0.22, 0, 0))
    parent(grip, root)
    stock = mesh_cube('SGStock', (0, -0.12, 0.010), (0.026, 0.14, 0.036), M['polymer'], 0.004, rot=(0.08, 0, 0))
    parent(stock, root)
    pad = mesh_cube('SGPad', (0, -0.195, 0.004), (0.036, 0.02, 0.050), M['polymer'], 0.004)
    parent(pad, root)
    trigger = mesh_cube('SGTrig', (0, 0.028, -0.006), (0.006, 0.010, 0.018), M['metal'], 0.001, rot=(0.3, 0, 0))
    parent(trigger, root)
    guard = mesh_torus('SGGuard', (0, 0.030, 0.000), 0.015, 0.003, M['worn'], rot=(0, math.pi / 2, 0))
    parent(guard, root)
    parent(new_empty('muzzle', (0, 0.385, 0.030)), root)
    parent(new_empty('sight', (0, 0.05, 0.044)), root)
    return root


def build_grenade(M):
    root = new_empty('FP_Grenade')
    body = mesh_cyl('NadeBody', (0, 0, 0.012), 0.026, 0.058, M['olive'], 0.004, verts=16)
    parent(body, root)
    for i in range(5):
        ring = mesh_cyl(f'NadeRing{i}', (0, 0, -0.012 + i * 0.012), 0.0275, 0.0035, M['olive'], 0.0006, verts=14)
        parent(ring, root)
    cap = mesh_cyl('NadeCap', (0, 0, 0.046), 0.018, 0.014, M['metal'], 0.0015, verts=12)
    parent(cap, root)
    spoon = mesh_cube('NadeSpoon', (0.022, 0, 0.028), (0.006, 0.014, 0.055), M['metal'], 0.0015, rot=(0, 0.15, 0))
    parent(spoon, root)
    pin = mesh_torus('NadePin', (0.012, 0, 0.058), 0.010, 0.0018, M['brass'], rot=(0, math.pi / 2, 0.4), major_seg=14, minor_seg=8)
    parent(pin, root)
    parent(new_empty('muzzle', (0, 0, 0.06)), root)
    parent(new_empty('sight', (0, 0, 0.03)), root)
    return root


def char_mats(prefix, T, cfg):
    pants_tex = T['denim'] if cfg.get('jeans', True) else T['cargo']
    return {
        'jacket': principled(f'{prefix}_Jacket', cfg['jacket'], 0.72, 0.04, T['khaki']),
        'pants': principled(f'{prefix}_Pants', cfg['pants'], 0.78, 0.03, pants_tex),
        'vest': principled(f'{prefix}_Vest', cfg['vest'], 0.62, 0.10, T['canvas']),
        'knit': principled(f'{prefix}_Knit', cfg['knit'], 0.90, 0.02, T['knit']),
        'skin': principled(f'{prefix}_Skin', cfg['skin'], 0.62, 0.04),
        'boots': principled(f'{prefix}_Boots', cfg['boots'], 0.7, 0.08, T['worn']),
        'pouch': principled(f'{prefix}_Pouch', cfg['pouch'], 0.74, 0.06, T['canvas']),
        'metal': principled(f'{prefix}_Metal', (0.28, 0.30, 0.32), 0.36, 0.78, T['metal']),
        'strap': principled(f'{prefix}_Strap', (0.38, 0.30, 0.18), 0.8, 0.05),
        'eye': principled(f'{prefix}_Eye', (0.07, 0.06, 0.05), 0.45, 0.05),
        'helm': principled(f'{prefix}_Helm', cfg.get('helm', (0.45, 0.48, 0.30)), 0.45, 0.35, T['metal']),
        'beanie': principled(f'{prefix}_Beanie', cfg.get('beanie_col', (0.38, 0.28, 0.18)), 0.88, 0.03, T['knit']),
        'iron': principled(f'{prefix}_Iron', (0.72, 0.74, 0.76), 0.30, 0.72, T['metal']),
        'plate': principled(f'{prefix}_Plate', (0.48, 0.50, 0.46), 0.40, 0.62, T['metal']),
        'glow': principled(f'{prefix}_Glow', (1.0, 0.48, 0.16), 0.28, 0.1, emit=(1.0, 0.38, 0.08), emit_str=2.4),
        'blade': principled(f'{prefix}_Blade', (0.55, 0.56, 0.58), 0.22, 0.9, T['metal']),
    }


def tp_weapon(kind, M, root):
    # Character faces -Y; weapon points -Y, held around chest.
    if kind == 'knife':
        h = mesh_cube('TP_KnifeH', (0.16, -0.22, 1.08), (0.03, 0.08, 0.03), M['pouch'], 0.004)
        b = mesh_cube('TP_KnifeB', (0.16, -0.36, 1.08), (0.018, 0.22, 0.012), M['blade'], 0.002)
        parent(h, root)
        parent(b, root)
    elif kind == 'shotgun':
        rec = mesh_cube('TP_SG', (0.10, -0.28, 1.14), (0.05, 0.18, 0.055), M['metal'], 0.004)
        br = mesh_cyl('TP_SGBarrel', (0.10, -0.52, 1.16), 0.016, 0.32, M['metal'], 0.002, rot=(math.pi / 2, 0, 0), verts=10)
        st = mesh_cube('TP_SGStock', (0.10, -0.10, 1.12), (0.04, 0.16, 0.05), M['pouch'], 0.005)
        parent(rec, root)
        parent(br, root)
        parent(st, root)
    elif kind == 'rifle':
        rec = mesh_cube('TP_Rifle', (0.12, -0.26, 1.15), (0.045, 0.20, 0.05), M['metal'], 0.003)
        br = mesh_cyl('TP_RifleBarrel', (0.12, -0.58, 1.16), 0.012, 0.42, M['metal'], 0.0015, rot=(math.pi / 2, 0, 0), verts=10)
        mag = mesh_cube('TP_RifleMag', (0.12, -0.24, 1.08), (0.03, 0.04, 0.10), M['metal'], 0.003)
        st = mesh_cube('TP_RifleStock', (0.12, -0.06, 1.14), (0.035, 0.16, 0.04), M['pouch'], 0.004)
        parent(rec, root)
        parent(br, root)
        parent(mag, root)
        parent(st, root)
    elif kind == 'grenade':
        g = mesh_cyl('TP_Nade', (0.18, -0.22, 1.12), 0.028, 0.055, M['pouch'], 0.006, verts=12)
        parent(g, root)
        rec = mesh_cube('TP_Sidearm', (0.10, -0.30, 1.14), (0.035, 0.16, 0.04), M['metal'], 0.003)
        parent(rec, root)


def build_character(name, T, cfg):
    M = char_mats(name, T, cfg)
    root = new_empty(name)
    # hips + jacketed torso
    parent(mesh_cube(f'{name}_Hips', (0, 0.02, 0.94), (0.34, 0.20, 0.16), M['pants'], 0.035), root)
    parent(mesh_cube(f'{name}_Torso', (0, 0.015, 1.20), (0.40, 0.24, 0.36), M['jacket'], 0.042), root)
    parent(mesh_cube(f'{name}_Chest', (0, 0.03, 1.38), (0.48, 0.26, 0.18), M['jacket'], 0.038), root)
    parent(mesh_cyl(f'{name}_Neck', (0, 0.0, 1.52), 0.055, 0.10, M['knit'], 0.008, verts=12), root)
    # head / balaclava
    parent(mesh_sphere(f'{name}_Head', (0, 0.01, 1.68), 0.135, M['knit'], scale=(1.0, 1.08, 1.12), segs=18), root)
    parent(mesh_cube(f'{name}_Jaw', (0, 0.02, 1.575), (0.20, 0.20, 0.10), M['knit'], 0.028), root)
    parent(mesh_cube(f'{name}_Slit', (0, -0.128, 1.698), (0.20, 0.055, 0.055), M['skin'], 0.012), root)
    parent(mesh_cube(f'{name}_EyeL', (-0.038, -0.150, 1.700), (0.038, 0.018, 0.022), M['eye'], 0.004), root)
    parent(mesh_cube(f'{name}_EyeR', (0.038, -0.150, 1.700), (0.038, 0.018, 0.022), M['eye'], 0.004), root)
    if cfg.get('beanie'):
        parent(mesh_sphere(f'{name}_Beanie', (0, 0.0, 1.78), 0.138, M['beanie'], scale=(1.08, 1.12, 0.62), segs=16), root)
        parent(mesh_cube(f'{name}_BeanieCuff', (0, 0.0, 1.74), (0.28, 0.28, 0.055), M['beanie'], 0.018), root)
    if cfg.get('helmet'):
        parent(mesh_sphere(f'{name}_Helm', (0, 0.0, 1.76), 0.15, M['helm'], scale=(1.15, 1.18, 0.72), segs=16), root)
        parent(mesh_cube(f'{name}_Brim', (0, -0.08, 1.70), (0.28, 0.10, 0.03), M['helm'], 0.008), root)
    if cfg.get('iron_mask'):
        parent(mesh_cube(f'{name}_Mask', (0, -0.12, 1.67), (0.20, 0.05, 0.22), M['iron'], 0.012), root)
        parent(mesh_cube(f'{name}_MaskSlot', (0, -0.148, 1.70), (0.12, 0.02, 0.03), M['eye'], 0.004), root)
    if cfg.get('visor_glow'):
        parent(mesh_cube(f'{name}_Visor', (0, -0.145, 1.70), (0.16, 0.03, 0.035), M['glow'], 0.004), root)
        parent(mesh_sphere(f'{name}_HelmHeavy', (0, 0.0, 1.74), 0.155, M['plate'], scale=(1.18, 1.2, 0.78), segs=16), root)
    # shoulders + arms (right arm aims -Y)
    parent(mesh_sphere(f'{name}_ShL', (-0.27, 0.02, 1.42), 0.09, M['jacket'], segs=14), root)
    parent(mesh_sphere(f'{name}_ShR', (0.27, 0.02, 1.42), 0.09, M['jacket'], segs=14), root)
    parent(cyl_between(f'{name}_UpL', (-0.28, 0.02, 1.40), (-0.36, 0.10, 1.14), 0.055, M['jacket']), root)
    parent(cyl_between(f'{name}_LoL', (-0.36, 0.10, 1.14), (-0.24, -0.10, 1.02), 0.046, M['jacket']), root)
    parent(mesh_sphere(f'{name}_HandL', (-0.24, -0.14, 1.00), 0.055, M['knit'], segs=12), root)
    parent(cyl_between(f'{name}_UpR', (0.28, 0.02, 1.40), (0.22, -0.12, 1.20), 0.055, M['jacket']), root)
    parent(cyl_between(f'{name}_LoR', (0.22, -0.12, 1.20), (0.14, -0.30, 1.13), 0.046, M['jacket']), root)
    parent(mesh_sphere(f'{name}_HandR', (0.12, -0.34, 1.11), 0.055, M['knit'], segs=12), root)
    # legs + boots
    parent(cyl_between(f'{name}_ThL', (-0.11, 0.03, 0.88), (-0.13, 0.04, 0.50), 0.078, M['pants']), root)
    parent(cyl_between(f'{name}_ThR', (0.11, 0.03, 0.88), (0.13, 0.04, 0.50), 0.078, M['pants']), root)
    parent(cyl_between(f'{name}_CaL', (-0.13, 0.04, 0.50), (-0.13, 0.06, 0.18), 0.062, M['pants']), root)
    parent(cyl_between(f'{name}_CaR', (0.13, 0.04, 0.50), (0.13, 0.06, 0.18), 0.062, M['pants']), root)
    parent(mesh_cube(f'{name}_BootL', (-0.13, 0.05, 0.085), (0.13, 0.24, 0.12), M['boots'], 0.018), root)
    parent(mesh_cube(f'{name}_BootR', (0.13, 0.05, 0.085), (0.13, 0.24, 0.12), M['boots'], 0.018), root)
    # vest + pouches (front = -Y)
    parent(mesh_cube(f'{name}_Vest', (0, -0.015, 1.28), (0.42, 0.16, 0.30), M['vest'], 0.018), root)
    parent(mesh_cube(f'{name}_Strap', (0, 0.0, 1.42), (0.36, 0.22, 0.04), M['strap'], 0.008), root)
    for i, px in enumerate((-0.13, 0.0, 0.13)):
        parent(mesh_cube(f'{name}_Pouch{i}', (px, -0.12, 1.26), (0.10, 0.07, 0.11), M['pouch'], 0.01), root)
    parent(mesh_cube(f'{name}_PouchLowL', (-0.08, -0.12, 1.14), (0.10, 0.06, 0.08), M['pouch'], 0.01), root)
    parent(mesh_cube(f'{name}_PouchLowR', (0.08, -0.12, 1.14), (0.10, 0.06, 0.08), M['pouch'], 0.01), root)
    if cfg.get('extra_nades'):
        parent(mesh_cyl(f'{name}_NadeA', (-0.18, -0.14, 1.36), 0.028, 0.07, M['pouch'], 0.006, verts=10), root)
        parent(mesh_cyl(f'{name}_NadeB', (0.18, -0.14, 1.36), 0.028, 0.07, M['pouch'], 0.006, verts=10), root)
        parent(mesh_cyl(f'{name}_NadeC', (0.0, -0.15, 1.38), 0.028, 0.07, M['pouch'], 0.006, verts=10), root)
    if cfg.get('coat'):
        parent(mesh_cube(f'{name}_Coat', (0, 0.04, 1.08), (0.52, 0.30, 0.55), M['jacket'], 0.05), root)
        parent(mesh_cube(f'{name}_Radio', (0, 0.16, 1.32), (0.18, 0.08, 0.16), M['metal'], 0.008), root)
        parent(mesh_cyl(f'{name}_Ant', (0.08, 0.18, 1.70), 0.012, 0.55, M['metal'], 0.002, verts=8), root)
    if cfg.get('armor'):
        parent(mesh_cube(f'{name}_PlateC', (0, -0.06, 1.32), (0.38, 0.10, 0.28), M['plate'], 0.012), root)
        parent(mesh_cube(f'{name}_PadL', (-0.30, 0.02, 1.48), (0.16, 0.16, 0.14), M['plate'], 0.02), root)
        parent(mesh_cube(f'{name}_PadR', (0.30, 0.02, 1.48), (0.16, 0.16, 0.14), M['plate'], 0.02), root)
    tp_weapon(cfg.get('weapon', 'rifle'), M, root)
    return root


def build_crate(T):
    wood = principled('CrateWood', (0.48, 0.32, 0.16), 0.78, 0.04, T['wood'])
    metal = principled('CrateMetal', (0.22, 0.22, 0.22), 0.4, 0.7, T['metal'])
    root = new_empty('Prop_Crate')
    parent(mesh_cube('CrateBody', (0, 0, 0.35), (0.70, 0.70, 0.70), wood, 0.012), root)
    parent(mesh_cube('CrateLid', (0, 0, 0.70), (0.72, 0.72, 0.04), wood, 0.006), root)
    for sx, sy in ((-1, -1), (-1, 1), (1, -1), (1, 1)):
        parent(mesh_cube(f'CrateBand{sx}{sy}', (sx * 0.33, sy * 0.33, 0.35), (0.04, 0.04, 0.72), metal, 0.004), root)
    return root


def build_sandbag(T):
    canvas = principled('BagCanvas', (0.78, 0.70, 0.48), 0.92, 0.03, T['canvas'])
    root = new_empty('Prop_Sandbag')
    bag = mesh_cube('BagBody', (0, 0, 0.14), (0.72, 0.40, 0.28), canvas, 0.06)
    parent(bag, root)
    parent(mesh_cube('BagTie', (0, 0, 0.29), (0.10, 0.08, 0.06), canvas, 0.015), root)
    return root


def gather(root):
    objs = [root]
    objs.extend(list(root.children_recursive))
    return objs


def count_tris(objects):
    n = 0
    seen = set()
    for o in objects:
        if o.type != 'MESH' or o.data.name in seen:
            continue
        seen.add(o.data.name)
        me = o.data
        me.calc_loop_triangles()
        n += len(me.loop_triangles)
    return n


def export_glb(path, roots):
    bpy.ops.object.select_all(action='DESELECT')
    first = None
    for r in roots:
        for o in gather(r):
            o.select_set(True)
            if first is None:
                first = o
    bpy.context.view_layer.objects.active = first
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_animations=False,
        export_skins=False,
        export_morph=False,
    )
    size = os.path.getsize(path)
    tris = count_tris([o for r in roots for o in gather(r)])
    print(f'EXPORT {os.path.basename(path)}  {size/1024:.1f} KB  ~{tris} tris')
    return size, tris


CHAR_CFGS = {
    'Char_Rusher': dict(
        jacket=(0.82, 0.71, 0.42), pants=(0.25, 0.36, 0.55), vest=(0.58, 0.52, 0.32),
        knit=(0.48, 0.44, 0.40), skin=(0.78, 0.62, 0.40), boots=(0.34, 0.22, 0.14),
        pouch=(0.46, 0.40, 0.24), beanie_col=(0.40, 0.30, 0.22), jeans=True, beanie=True,
        weapon='knife'),
    'Char_Rifle': dict(
        jacket=(0.84, 0.74, 0.45), pants=(0.46, 0.38, 0.24), vest=(0.54, 0.50, 0.32),
        knit=(0.48, 0.44, 0.40), skin=(0.76, 0.62, 0.42), boots=(0.28, 0.20, 0.13),
        pouch=(0.42, 0.39, 0.26), helm=(0.52, 0.56, 0.34), jeans=False, helmet=True,
        weapon='rifle'),
    'Char_Shotgun': dict(
        jacket=(0.64, 0.52, 0.30), pants=(0.27, 0.38, 0.55), vest=(0.46, 0.42, 0.27),
        knit=(0.46, 0.42, 0.38), skin=(0.75, 0.62, 0.41), boots=(0.24, 0.16, 0.10),
        pouch=(0.35, 0.32, 0.20), helm=(0.40, 0.38, 0.26), jeans=True, helmet=True,
        weapon='shotgun'),
    'Char_Grenadier': dict(
        jacket=(0.86, 0.64, 0.34), pants=(0.52, 0.40, 0.24), vest=(0.66, 0.52, 0.30),
        knit=(0.50, 0.38, 0.28), skin=(0.78, 0.63, 0.42), boots=(0.34, 0.22, 0.12),
        pouch=(0.52, 0.36, 0.18), beanie_col=(0.52, 0.32, 0.16), jeans=False, beanie=True,
        extra_nades=True, weapon='grenade'),
    'Char_Midboss': dict(
        jacket=(0.70, 0.64, 0.50), pants=(0.40, 0.38, 0.34), vest=(0.52, 0.54, 0.56),
        knit=(0.48, 0.44, 0.40), skin=(0.74, 0.62, 0.42), boots=(0.22, 0.18, 0.15),
        pouch=(0.40, 0.42, 0.44), helm=(0.68, 0.70, 0.72), jeans=False, helmet=True,
        iron_mask=True, coat=True, weapon='rifle'),
    'Char_Finalboss': dict(
        jacket=(0.80, 0.66, 0.38), pants=(0.46, 0.36, 0.24), vest=(0.38, 0.42, 0.44),
        knit=(0.46, 0.40, 0.34), skin=(0.76, 0.62, 0.40), boots=(0.22, 0.16, 0.12),
        pouch=(0.52, 0.40, 0.20), jeans=False, visor_glow=True, armor=True, weapon='rifle'),
}


def main():
    clear_scene()
    print('Building textures...')
    T = build_textures()
    GM = build_gun_mats(T)
    print('Building viewmodels...')
    guns = [
        build_pistol(GM),
        build_smg(GM),
        build_rifle(GM),
        build_shotgun(GM),
        build_grenade(GM),
    ]
    print('Building characters...')
    chars = [build_character(name, T, cfg) for name, cfg in CHAR_CFGS.items()]
    print('Building props...')
    props = [build_crate(T), build_sandbag(T)]

    export_glb(os.path.join(MODELS, 'viewmodels.glb'), guns)
    export_glb(os.path.join(MODELS, 'characters.glb'), chars)
    export_glb(os.path.join(MODELS, 'props.glb'), props)

    blend_path = os.path.join(ART, 'dustline_assets.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print('Saved', blend_path)
    print('DONE')


if __name__ == '__main__':
    main()
