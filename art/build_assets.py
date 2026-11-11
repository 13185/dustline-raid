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


def parent_keep(child, par):
    bpy.context.view_layer.update()
    mw = child.matrix_world.copy()
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()
    child.matrix_world = mw


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
        0.58 + 0.10 * fbm(u * 4, v * 4, 5, 21) - 0.08 * fbm(u * 12, v * 3, 3, 22),
        0.52 + 0.09 * fbm(u * 4, v * 4, 5, 23) - 0.05 * fbm(u * 12, v * 3, 3, 24),
        0.34 + 0.07 * fbm(u * 4, v * 4, 5, 25),
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
    T['ash'] = make_image('tex_ash', 256, lambda u, v: (
        0.52 + 0.08 * fbm(u * 5, v * 5, 5, 81) - 0.12 * (1.0 if fbm(u * 13, v * 9, 3, 82) > 0.70 else 0.0),
        0.54 + 0.07 * fbm(u * 5, v * 5, 5, 83) - 0.06 * fbm(u * 11, v * 8, 3, 84),
        0.48 + 0.06 * fbm(u * 5, v * 5, 5, 85),
    ))
    return T


def build_gun_mats(T):
    M = {
        'metal': principled('GunMetal', (0.18, 0.19, 0.21), 0.32, 0.88, T['metal']),
        'slide': principled('GunSlide', (0.08, 0.085, 0.09), 0.22, 0.9, T['metal']),
        'worn': principled('GunWorn', (0.24, 0.19, 0.13), 0.48, 0.55, T['worn']),
        'polymer': principled('GunPolymer', (0.09, 0.08, 0.07), 0.78, 0.06, T['polymer']),
        'brass': principled('GunBrass', (0.76, 0.58, 0.22), 0.28, 0.92),
        'glass': principled('GunGlass', (0.05, 0.09, 0.07), 0.06, 0.15, alpha=0.42),
        'rust': principled('GunRust', (0.42, 0.22, 0.10), 0.72, 0.28, T['worn']),
        'tan': principled('GunTan', (0.55, 0.44, 0.26), 0.7, 0.08, T['khaki']),
        'olive': principled('GunOlive', (0.28, 0.30, 0.16), 0.74, 0.05),
        'scope': principled('GunScope', (0.08, 0.085, 0.09), 0.26, 0.88, T['metal']),
        'hood': principled('GunHood', (0.012, 0.012, 0.014), 0.62, 0.08),
        'lens': principled('GunLens', (0.04, 0.08, 0.06), 0.03, 0.08, alpha=0.07),
        'skin': principled('FPSkin', (0.64, 0.44, 0.30), 0.64, 0.04),
        'glove': principled('FPGlove', (0.22, 0.14, 0.09), 0.82, 0.04),
        'sleeve': principled('FPSleeve', (0.30, 0.28, 0.18), 0.84, 0.04, T['khaki']),
        'reticle': None,
    }
    M['reticle'] = make_reticle_mat()
    return M



def make_reticle_mat():
    size = 256
    img = bpy.data.images.new('tex_reticle', size, size, alpha=True)
    px = [0.0] * (size * size * 4)
    cx = cy = size * 0.5
    for y in range(size):
        for x in range(size):
            dx, dy = x - cx, y - cy
            r = math.hypot(dx, dy)
            i = (y * size + x) * 4
            on = False
            if (abs(dx) < 2.0 and 5 < abs(dy) < 72) or (abs(dy) < 2.0 and 5 < abs(dx) < 72):
                on = True
            if 80 < r < 88:
                on = True
            if on:
                px[i:i + 4] = [0.25, 1.0, 0.38, 0.92]
    img.pixels = px
    img.pack()
    mat = bpy.data.materials.new('GunReticle')
    mat.use_nodes = True
    mat.blend_method = 'BLEND'
    mat.shadow_method = 'NONE'
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    if 'Emission Color' in bsdf.inputs:
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = 1.8
    bsdf.inputs['Roughness'].default_value = 0.35
    return mat


def add_fp_hands(root, M, kind='rifle'):
    """FPS arms come up from the bottom of the frame, not down the camera axis."""
    glove, skin, sleeve = M['glove'], M['skin'], M['sleeve']
    rh = new_empty('FPHandR', (0.026, -0.014, -0.030))
    parent(rh, root)
    parent_keep(mesh_cube('FPPalmR', (0.024, -0.014, -0.034), (0.024, 0.048, 0.042), glove, 0.006), rh)
    for i, (fy, fz) in enumerate(((-0.024, -0.052), (-0.010, -0.056), (0.004, -0.054), (0.016, -0.048))):
        parent_keep(mesh_cube(f'FPFingerR{i}', (0.004, fy, fz), (0.034, 0.012, 0.016), glove, 0.003, rot=(0.2, 0.45, 0.12)), rh)
    parent_keep(mesh_cube('FPThumbR', (0.016, 0.012, -0.014), (0.014, 0.032, 0.014), glove, 0.003, rot=(0.4, 0.75, 0.08)), rh)
    parent_keep(cyl_between('FPArmR', (0.030, -0.028, -0.032), (0.078, -0.085, -0.205), 0.022, skin, 0.003, verts=14), rh)
    parent_keep(cyl_between('FPSleeveR', (0.052, -0.055, -0.11), (0.090, -0.11, -0.27), 0.032, sleeve, 0.005, verts=14), rh)
    if kind == 'grenade':
        return
    if kind == 'pistol':
        palm = (-0.016, 0.030, 0.000)
        wrist = (-0.018, 0.028, -0.004)
        elbow = (-0.075, -0.04, -0.16)
    elif kind == 'shotgun':
        palm = (-0.026, 0.132, 0.010)
        wrist = (-0.028, 0.128, 0.006)
        elbow = (-0.085, 0.03, -0.15)
    else:
        palm = (-0.028, 0.148, 0.010)
        wrist = (-0.030, 0.140, 0.006)
        elbow = (-0.088, 0.035, -0.155)
    lh = new_empty('FPHandL', palm)
    parent(lh, root)
    parent_keep(mesh_cube('FPPalmL', palm, (0.024, 0.044, 0.036), glove, 0.006), lh)
    px, py, pz = palm
    for i, fy in enumerate((-0.014, 0.000, 0.012, 0.022)):
        parent_keep(mesh_cube(f'FPFingerL{i}', (px + 0.014, py + fy, pz - 0.018), (0.026, 0.011, 0.016), glove, 0.003, rot=(0.12, -0.4, -0.18)), lh)
    parent_keep(cyl_between('FPArmL', wrist, elbow, 0.022, skin, 0.003, verts=14), lh)
    sleeve_a = (wrist[0] * 0.4 + elbow[0] * 0.6, wrist[1] * 0.4 + elbow[1] * 0.6, wrist[2] * 0.4 + elbow[2] * 0.6)
    sleeve_b = (elbow[0] - 0.015, elbow[1] - 0.03, elbow[2] - 0.08)
    parent_keep(cyl_between('FPSleeveL', sleeve_a, sleeve_b, 0.032, sleeve, 0.005, verts=14), lh)


def add_screws(root, M, spots):
    for i, (x, y, z) in enumerate(spots):
        parent(mesh_cyl(f'Screw{i}_{root.name}', (x, y, z), 0.0024, 0.004, M['metal'], 0.0003, verts=8), root)

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
    parent(new_empty('muzzle_Pistol', (0, 0.168, 0.034)), root)
    parent(new_empty('sight_Pistol', (0, 0.02, 0.058)), root)
    add_screws(root, M, [(0.011, 0.04, 0.030), (-0.011, 0.04, 0.030), (0.011, -0.02, 0.030)])
    add_fp_hands(root, M, 'pistol')
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
    parent(new_empty('muzzle_SMG', (0, 0.268, 0.028)), root)
    parent(new_empty('sight_SMG', (0, 0.01, 0.078)), root)
    add_screws(root, M, [(0.012, 0.05, 0.038), (-0.012, -0.02, 0.038)])
    add_fp_hands(root, M, 'smg')
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
    # real optic: dark metal hood, clear lens, green reticle
    parent(mesh_cyl('ScopeTube', (0, 0.03, 0.078), 0.017, 0.090, M['scope'], 0.0014, rot=(math.pi / 2, 0, 0), verts=24), root)
    parent(mesh_cyl('ScopeObj', (0, 0.084, 0.078), 0.022, 0.024, M['scope'], 0.0014, rot=(math.pi / 2, 0, 0), verts=24), root)
    parent(mesh_cyl('ScopeOcu', (0, -0.024, 0.078), 0.019, 0.020, M['scope'], 0.0014, rot=(math.pi / 2, 0, 0), verts=20), root)
    parent(mesh_torus('ScopeHood', (0, -0.034, 0.078), 0.0165, 0.0034, M['hood'], rot=(math.pi / 2, 0, 0), major_seg=22, minor_seg=8), root)
    parent(mesh_cyl('ScopeGlassF', (0, 0.096, 0.078), 0.0175, 0.003, M['lens'], 0.0, rot=(math.pi / 2, 0, 0), verts=20), root)
    parent(mesh_cyl('ScopeGlassR', (0, -0.016, 0.078), 0.013, 0.002, M['lens'], 0.0, rot=(math.pi / 2, 0, 0), verts=20), root)
    bpy.ops.mesh.primitive_plane_add(size=0.024, location=(0, -0.020, 0.078), rotation=(math.pi / 2, 0, 0))
    ret = bpy.context.active_object
    ret.name = 'ScopeReticle'
    apply_tr(ret)
    assign(ret, M['reticle'])
    parent(ret, root)
    parent(mesh_cyl('ScopeTurret', (0, 0.03, 0.102), 0.0075, 0.017, M['metal'], 0.0006, verts=12), root)
    parent(mesh_cyl('ScopeTurretW', (0.020, 0.03, 0.078), 0.0065, 0.015, M['metal'], 0.0006, rot=(0, math.pi / 2, 0), verts=12), root)
    parent(mesh_cube('ScopeMount', (0, 0.03, 0.056), (0.016, 0.055, 0.018), M['metal'], 0.001), root)
    add_screws(root, M, [(0.012, 0.08, 0.038), (-0.012, -0.01, 0.038), (0.012, 0.22, 0.036)])
    parent(new_empty('muzzle_Rifle', (0, 0.562, 0.022)), root)
    parent(new_empty('sight_Rifle', (0, -0.022, 0.078)), root)
    add_fp_hands(root, M, 'rifle')
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
    parent(new_empty('muzzle_Shotgun', (0, 0.385, 0.030)), root)
    parent(new_empty('sight_Shotgun', (0, 0.05, 0.044)), root)
    add_fp_hands(root, M, 'shotgun')
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
    parent(new_empty('muzzle_Nade', (0, 0, 0.06)), root)
    parent(new_empty('sight_Nade', (0, 0, 0.03)), root)
    add_fp_hands(root, M, 'grenade')
    return root


def zomb_mats(prefix, T, cfg):
    return {
        'cloth': principled(f'{prefix}_Cloth', cfg['cloth'], 0.84, 0.03, T['khaki']),
        'cloth2': principled(f'{prefix}_Cloth2', cfg.get('cloth2', cfg['cloth']), 0.86, 0.03, T['cargo']),
        'pants': principled(f'{prefix}_Pants', cfg['pants'], 0.82, 0.03, T['cargo']),
        'vest': principled(f'{prefix}_Vest', cfg.get('vest', cfg['cloth']), 0.78, 0.06, T['canvas']),
        'skin': principled(f'{prefix}_Skin', cfg['skin'], 0.84, 0.02, T['ash']),
        'wound': principled(f'{prefix}_Wound', (0.34, 0.09, 0.07), 0.90, 0.02),
        'blood': principled(f'{prefix}_Blood', (0.44, 0.13, 0.09), 0.88, 0.02),
        'teeth': principled(f'{prefix}_Teeth', (0.82, 0.78, 0.66), 0.52, 0.04),
        'eye': principled(f'{prefix}_Eye', (0.90, 0.92, 0.80), 0.26, 0.02,
                          emit=(0.80, 0.84, 0.66), emit_str=0.62),
        'boots': principled(f'{prefix}_Boots', cfg['boots'], 0.76, 0.06, T['worn']),
        'rust': principled(f'{prefix}_Rust', (0.42, 0.22, 0.11), 0.76, 0.22, T['worn']),
        'scrap': principled(f'{prefix}_Scrap', (0.26, 0.25, 0.23), 0.62, 0.38, T['metal']),
        'nail': principled(f'{prefix}_Nail', (0.30, 0.28, 0.25), 0.55, 0.42, T['metal']),
        'bile': principled(f'{prefix}_Bile', (0.52, 0.60, 0.18), 0.52, 0.04,
                           emit=(0.55, 0.64, 0.16), emit_str=0.95),
        'sand': principled(f'{prefix}_Sand', (0.46, 0.36, 0.22), 0.88, 0.06, T['worn']),
        'pouch': principled(f'{prefix}_Pouch', cfg.get('pouch', (0.52, 0.44, 0.28)), 0.80, 0.05, T['canvas']),
        'strap': principled(f'{prefix}_Strap', (0.48, 0.40, 0.26), 0.84, 0.04),
        'metal': principled(f'{prefix}_Metal', (0.32, 0.30, 0.28), 0.48, 0.55, T['metal']),
    }


def add_teeth_row(name, origin, parent_obj, mat, count=5, width=0.12, z_off=0.0):
    for i in range(count):
        t = (i / max(1, count - 1) - 0.5) * width
        parent_keep(mesh_cube(
            f'{name}_{i}', (origin[0] + t, origin[1], origin[2] + z_off),
            (0.016, 0.012, 0.026), mat, 0.0008), parent_obj)


def add_wound(name, loc, size, parent_obj, M, rot=(0, 0, 0)):
    parent_keep(mesh_cube(name, loc, size, M['wound'], 0.008, rot=rot), parent_obj)
    rim = (size[0] + 0.03, size[1] * 0.45, size[2] + 0.02)
    parent_keep(mesh_cube(name + 'Rim', (loc[0], loc[1] - size[1] * 0.35, loc[2]), rim, M['blood'], 0.006, rot=rot), parent_obj)


def tp_zombie_weapon(kind, M, attach, name):
    if kind == 'knife':
        parent_keep(mesh_cube(f'{name}_TP_KnifeH', (0.20, -0.48, 1.08), (0.034, 0.09, 0.034), M['pouch'], 0.004), attach)
        parent_keep(mesh_cube(f'{name}_TP_KnifeB', (0.20, -0.64, 1.08), (0.018, 0.24, 0.014), M['scrap'], 0.002), attach)
    elif kind == 'shotgun':
        parent_keep(mesh_cube(f'{name}_TP_SG', (0.14, -0.30, 1.14), (0.07, 0.20, 0.07), M['rust'], 0.004), attach)
        parent_keep(mesh_cyl(f'{name}_TP_SGBarrel', (0.14, -0.52, 1.16), 0.02, 0.24, M['rust'], 0.002, rot=(math.pi / 2, 0, 0), verts=10), attach)
        parent_keep(mesh_cube(f'{name}_TP_SGBreak', (0.16, -0.66, 1.17), (0.036, 0.05, 0.03), M['scrap'], 0.003), attach)
        parent_keep(mesh_cube(f'{name}_TP_SGStock', (0.14, -0.12, 1.12), (0.05, 0.16, 0.06), M['pouch'], 0.005), attach)
    elif kind == 'rifle':
        parent_keep(mesh_cube(f'{name}_TP_Rifle', (0.15, -0.28, 1.15), (0.055, 0.24, 0.06), M['rust'], 0.003), attach)
        parent_keep(mesh_cyl(f'{name}_TP_RifleBarrel', (0.15, -0.66, 1.16), 0.015, 0.48, M['rust'], 0.0015, rot=(math.pi / 2, 0, 0), verts=10), attach)
        parent_keep(mesh_cube(f'{name}_TP_RifleMag', (0.15, -0.26, 1.06), (0.036, 0.05, 0.12), M['scrap'], 0.003), attach)
        parent_keep(mesh_cube(f'{name}_TP_RifleStock', (0.15, -0.04, 1.13), (0.042, 0.18, 0.05), M['pouch'], 0.004), attach)
    elif kind in ('bile', 'grenade'):
        parent_keep(mesh_sphere(f'{name}_TP_BileFlask', (0.20, -0.26, 1.12), 0.042, M['bile'], segs=12), attach)
        parent_keep(mesh_cube(f'{name}_TP_Sidearm', (0.10, -0.30, 1.14), (0.032, 0.14, 0.036), M['rust'], 0.003), attach)


def build_zombie(name, T, cfg):
    M = zomb_mats(name, T, cfg)
    root = new_empty(name)
    w = cfg.get('wide', 1.0)
    hunch = cfg.get('hunch', 0.16)
    loll = cfg.get('head_loll', (0.16, 0.0, 0.10))
    pose = cfg.get('pose', 'aim')

    # planted lower body (does not follow spine hunch)
    parent(mesh_cube(f'{name}_Hips', (0, 0.02, 0.94), (0.34 * w, 0.20, 0.16), M['pants'], 0.032), root)
    parent(mesh_cube(f'{name}_Belt', (0, 0.02, 0.97), (0.38 * w, 0.22, 0.055), M['strap'], 0.01), root)
    parent(mesh_cube(f'{name}_Hem', (0, 0.04, 1.00), (0.40 * w, 0.24, 0.08), M['cloth'], 0.024), root)

    jhipL = new_empty(f'{name}_JHipL', (-0.11 * w, 0.03, 0.88)); parent(jhipL, root)
    jhipR = new_empty(f'{name}_JHipR', (0.11 * w, 0.03, 0.88)); parent(jhipR, root)
    jkL = new_empty(f'{name}_JKneeL', (-0.13 * w, 0.04, 0.50)); parent_keep(jkL, jhipL)
    jkR = new_empty(f'{name}_JKneeR', (0.13 * w, 0.04, 0.50)); parent_keep(jkR, jhipR)
    parent_keep(cyl_between(f'{name}_ThL', (-0.11 * w, 0.03, 0.88), (-0.13 * w, 0.04, 0.50), 0.078 * (0.7 + 0.3 * w), M['pants'], verts=12), jhipL)
    parent_keep(cyl_between(f'{name}_ThR', (0.11 * w, 0.03, 0.88), (0.13 * w, 0.04, 0.50), 0.078 * (0.7 + 0.3 * w), M['pants'], verts=12), jhipR)
    parent_keep(cyl_between(f'{name}_CaL', (-0.13 * w, 0.04, 0.50), (-0.13 * w, 0.06, 0.18), 0.062, M['pants'], verts=12), jkL)
    parent_keep(cyl_between(f'{name}_CaR', (0.13 * w, 0.04, 0.50), (0.13 * w, 0.06, 0.18), 0.062, M['pants'], verts=12), jkR)
    parent_keep(mesh_cube(f'{name}_KneeL', (-0.13 * w, 0.05, 0.50), (0.12, 0.10, 0.10), M['vest'], 0.012), jkL)
    parent_keep(mesh_cube(f'{name}_KneeR', (0.13 * w, 0.05, 0.50), (0.12, 0.10, 0.10), M['vest'], 0.012), jkR)
    # torn calf showing skin
    parent_keep(mesh_cube(f'{name}_TearL', (-0.13 * w, 0.00, 0.32), (0.08, 0.04, 0.10), M['skin'], 0.01), jkL)
    parent_keep(mesh_cube(f'{name}_BootL', (-0.13 * w, 0.05, 0.085), (0.13, 0.24, 0.12), M['boots'], 0.016), jkL)
    parent_keep(mesh_cube(f'{name}_BootR', (0.13 * w, 0.05, 0.085), (0.13, 0.24, 0.12), M['boots'], 0.016), jkR)
    toe_ly = 0.08 if cfg.get('drag_foot') == 'L' else -0.04
    toe_ry = 0.08 if cfg.get('drag_foot') == 'R' else -0.04
    parent_keep(mesh_cube(f'{name}_ToeL', (-0.13 * w, toe_ly, 0.055), (0.11, 0.11, 0.07), M['boots'], 0.01), jkL)
    parent_keep(mesh_cube(f'{name}_ToeR', (0.13 * w, toe_ry, 0.055), (0.11, 0.11, 0.07), M['boots'], 0.01), jkR)

    # hunched spine: upper body rotates around the waist
    jspine = new_empty(f'{name}_JSpine', (0.0, 0.02, 0.98))
    parent(jspine, root)

    parent_keep(mesh_cube(f'{name}_Torso', (0, 0.02, 1.20), (0.36 * w, 0.22, 0.34), M['skin'], 0.038), jspine)
    parent_keep(mesh_cube(f'{name}_Chest', (0, 0.04, 1.38), (0.44 * w, 0.24, 0.18), M['skin'], 0.034), jspine)
    parent_keep(mesh_cyl(f'{name}_Neck', (0, 0.0, 1.52), 0.058, 0.10, M['skin'], 0.008, verts=12), jspine)

    # torn cloth remnants (not a full jacket — dusk-readable khaki/olive)
    parent_keep(mesh_cube(f'{name}_Collar', (0, 0.02, 1.48), (0.28 * w, 0.20, 0.07), M['cloth'], 0.02), jspine)
    parent_keep(mesh_cube(f'{name}_ShirtR', (0.12 * w, 0.04, 1.24), (0.22, 0.16, 0.30), M['cloth'], 0.03), jspine)
    if cfg.get('missing_sleeve') != 'L':
        parent_keep(mesh_cube(f'{name}_ShirtL', (-0.12 * w, 0.04, 1.22), (0.20, 0.14, 0.26), M['cloth2'], 0.028), jspine)
    parent_keep(mesh_cube(f'{name}_FlapA', (0.16 * w, 0.10, 1.08), (0.12, 0.05, 0.22), M['cloth'], 0.016, rot=(0.45, 0.15, 0.25)), jspine)
    parent_keep(mesh_cube(f'{name}_FlapB', (-0.10 * w, 0.12, 1.10), (0.10, 0.04, 0.20), M['cloth2'], 0.014, rot=(0.55, -0.2, -0.3)), jspine)
    parent_keep(mesh_cube(f'{name}_VestRem', (0.02, -0.02, 1.30), (0.30 * w, 0.12, 0.22), M['vest'], 0.016), jspine)
    parent_keep(mesh_cube(f'{name}_Strap', (0, 0.0, 1.40), (0.32 * w, 0.18, 0.035), M['strap'], 0.006), jspine)

    add_wound(f'{name}_WoundArm', (-0.08 * w, -0.12, 1.26), (0.10, 0.05, 0.12), jspine, M)
    add_wound(f'{name}_WoundSide', (0.14 * w, -0.10, 1.18), (0.09, 0.04, 0.10), jspine, M)

    if cfg.get('torn_shirt'):
        parent_keep(mesh_cube(f'{name}_Cavity', (-0.10 * w, -0.13, 1.28), (0.14, 0.05, 0.16), M['wound'], 0.01), jspine)
        for i in range(3):
            z = 1.22 + i * 0.05
            parent_keep(mesh_cyl(f'{name}_Rib{i}', (-0.10 * w, -0.15, z), 0.011, 0.13, M['teeth'], 0.001, rot=(0, math.pi / 2, 0.18), verts=8), jspine)

    if cfg.get('bile_sac'):
        parent_keep(mesh_sphere(f'{name}_BileSac', (0.0, -0.08, 1.10), 0.20, M['bile'], scale=(1.18, 1.02, 0.92), segs=16), jspine)
        parent_keep(mesh_sphere(f'{name}_BileLump', (0.09, -0.18, 1.04), 0.075, M['bile'], segs=10), jspine)
        parent_keep(mesh_cube(f'{name}_BileStrap', (0.0, -0.02, 1.18), (0.46 * w, 0.08, 0.055), M['strap'], 0.01), jspine)
        parent_keep(mesh_cube(f'{name}_BileVest', (0.0, 0.06, 1.14), (0.50 * w, 0.10, 0.16), M['vest'], 0.02), jspine)

    if cfg.get('coat'):
        parent_keep(mesh_cube(f'{name}_Coat', (0, 0.10, 1.12), (0.50 * w, 0.22, 0.48), M['cloth2'], 0.045), jspine)
        parent_keep(mesh_cube(f'{name}_CoatFlap', (0.18 * w, 0.16, 0.98), (0.14, 0.06, 0.28), M['cloth'], 0.02, rot=(0.35, 0.1, 0.2)), jspine)

    if cfg.get('nail_plates'):
        plates = [
            (f'{name}_ChestPlate', (0.0, -0.14, 1.32), (0.34 * w, 0.08, 0.22), (0.1, 0, 0.06), 3),
            (f'{name}_ChestPlate2', (0.12 * w, -0.16, 1.18), (0.20, 0.07, 0.14), (-0.12, 0, -0.08), 2),
            (f'{name}_ShoulderPlateL', (-0.30 * w, 0.00, 1.46), (0.20, 0.12, 0.14), (0.18, 0, 0.28), 2),
            (f'{name}_ShoulderPlateR', (0.30 * w, 0.00, 1.46), (0.20, 0.12, 0.14), (0.14, 0, -0.22), 2),
        ]
        for pname, loc, size, rot, nn in plates:
            parent_keep(mesh_cube(pname, loc, size, M['scrap'], 0.008, rot=rot), jspine)
            for i in range(nn):
                ox = (i - (nn - 1) * 0.5) * size[0] * 0.32
                parent_keep(mesh_cyl(
                    f'{pname}_Nail{i}', (loc[0] + ox, loc[1] - size[1] * 0.85, loc[2] + 0.02),
                    0.01, 0.07, M['nail'], 0.0, rot=(math.pi / 2, 0.12, 0), verts=6), jspine)

    if cfg.get('sand_plates'):
        for i, (loc, size, rot) in enumerate((
            ((0.0, -0.14, 1.34), (0.40 * w, 0.12, 0.24), (0.08, 0, 0.05)),
            ((-0.16 * w, -0.10, 1.20), (0.22, 0.10, 0.16), (0.1, 0, 0.2)),
            ((0.18 * w, -0.12, 1.16), (0.24, 0.10, 0.18), (-0.12, 0, -0.15)),
            ((-0.32 * w, 0.00, 1.46), (0.22, 0.16, 0.16), (0.15, 0, 0.25)),
            ((0.32 * w, 0.00, 1.46), (0.22, 0.16, 0.16), (0.12, 0, -0.2)),
            ((0.0, -0.08, 1.06), (0.36 * w, 0.10, 0.14), (0.2, 0, 0)),
        )):
            parent_keep(mesh_cube(f'{name}_SandPlate{i}', loc, size, M['sand'], 0.012, rot=rot), jspine)
        parent_keep(mesh_cube(f'{name}_SandPadL', (-0.13 * w, 0.04, 0.70), (0.16, 0.12, 0.14), M['sand'], 0.014), jhipL)
        parent_keep(mesh_cube(f'{name}_SandPadR', (0.13 * w, 0.04, 0.70), (0.16, 0.12, 0.14), M['sand'], 0.014), jhipR)

    if cfg.get('throat'):
        parent_keep(mesh_cyl(f'{name}_Throat', (0.0, -0.16, 1.50), 0.072, 0.10, M['wound'], 0.01, rot=(math.pi / 2, 0, 0), verts=12), jspine)
        parent_keep(mesh_torus(f'{name}_ThroatRim', (0.0, -0.18, 1.50), 0.082, 0.02, M['sand'], rot=(math.pi / 2, 0, 0), major_seg=12, minor_seg=6), jspine)
        parent_keep(mesh_cube(f'{name}_ThroatBlood', (0.0, -0.14, 1.46), (0.10, 0.04, 0.08), M['blood'], 0.008), jspine)

    # head on its own joint (lolls independently)
    jhead = new_empty(f'{name}_JHead', (0.0, 0.01, 1.56))
    parent_keep(jhead, jspine)
    parent_keep(mesh_sphere(f'{name}_Head', (0.0, 0.02, 1.68), 0.132, M['skin'], scale=(1.02, 1.08, 1.10), segs=18), jhead)
    parent_keep(mesh_cube(f'{name}_Brow', (0.0, -0.10, 1.74), (0.18, 0.05, 0.04), M['skin'], 0.01), jhead)
    parent_keep(mesh_cube(f'{name}_SocketL', (-0.045, -0.12, 1.70), (0.055, 0.04, 0.04), M['wound'], 0.006), jhead)
    parent_keep(mesh_cube(f'{name}_SocketR', (0.045, -0.12, 1.70), (0.055, 0.04, 0.04), M['wound'], 0.006), jhead)
    parent_keep(mesh_sphere(f'{name}_EyeL', (-0.045, -0.135, 1.702), 0.022, M['eye'], segs=12), jhead)
    parent_keep(mesh_sphere(f'{name}_EyeR', (0.045, -0.135, 1.702), 0.022, M['eye'], segs=12), jhead)
    parent_keep(mesh_cube(f'{name}_MouthCav', (0.0, -0.12, 1.60), (0.12, 0.08, 0.07), M['wound'], 0.01), jhead)
    parent_keep(mesh_cube(f'{name}_MouthBlood', (0.0, -0.14, 1.58), (0.16, 0.04, 0.08), M['blood'], 0.008), jhead)
    add_teeth_row(f'{name}_ToothU', (0.0, -0.125, 1.625), jhead, M['teeth'], 5, 0.11)
    parent_keep(new_empty(f'{name}_HeadTop', (0.0, 0.00, 1.80)), jhead)

    if cfg.get('hanging_jaw'):
        parent_keep(mesh_cube(f'{name}_Jaw', (0.0, -0.02, 1.52), (0.15, 0.13, 0.08), M['skin'], 0.016, rot=(0.62, 0.0, 0.08)), jhead)
        add_teeth_row(f'{name}_ToothL', (0.0, -0.10, 1.54), jhead, M['teeth'], 4, 0.09, z_off=-0.01)
    if cfg.get('split_jaw'):
        parent_keep(mesh_cube(f'{name}_JawL', (-0.06, -0.02, 1.52), (0.10, 0.12, 0.07), M['skin'], 0.014, rot=(0.55, 0.0, 0.48)), jhead)
        parent_keep(mesh_cube(f'{name}_JawR', (0.06, -0.02, 1.52), (0.10, 0.12, 0.07), M['skin'], 0.014, rot=(0.55, 0.0, -0.48)), jhead)
        add_teeth_row(f'{name}_ToothL', (-0.05, -0.08, 1.54), jhead, M['teeth'], 3, 0.06)
        add_teeth_row(f'{name}_ToothR', (0.05, -0.08, 1.54), jhead, M['teeth'], 3, 0.06)

    if cfg.get('helmet'):
        hx = 0.05 if cfg.get('helmet_lopsided') else 0.0
        helm = mesh_sphere(f'{name}_Helm', (hx, 0.02, 1.78), 0.148, M['scrap'], scale=(1.14, 1.16, 0.68), segs=16)
        if cfg.get('helmet_lopsided'):
            helm.rotation_euler = (0.22, 0.12, 0.42)
            apply_tr(helm)
        parent_keep(helm, jhead)
        parent_keep(mesh_cube(f'{name}_Brim', (hx * 0.5, -0.06, 1.70), (0.26, 0.10, 0.03), M['scrap'], 0.006), jhead)
        if cfg.get('helmet_lopsided'):
            parent_keep(mesh_cube(f'{name}_HelmCrack', (0.02, -0.04, 1.80), (0.04, 0.22, 0.03), M['wound'], 0.004, rot=(0.2, 0.4, 0.3)), jhead)

    if cfg.get('nail_plates'):
        parent_keep(mesh_cube(f'{name}_FacePlate', (0.05, -0.16, 1.66), (0.18, 0.06, 0.20), M['scrap'], 0.008, rot=(0.08, 0, 0.12)), jhead)
        parent_keep(mesh_cyl(f'{name}_FaceNail0', (0.00, -0.20, 1.70), 0.011, 0.07, M['nail'], 0.0, rot=(math.pi / 2, 0.15, 0), verts=6), jhead)
        parent_keep(mesh_cyl(f'{name}_FaceNail1', (0.09, -0.20, 1.60), 0.011, 0.07, M['nail'], 0.0, rot=(math.pi / 2, -0.12, 0), verts=6), jhead)
        parent_keep(mesh_cyl(f'{name}_FaceNail2', (0.04, -0.20, 1.74), 0.01, 0.06, M['nail'], 0.0, rot=(math.pi / 2, 0.05, 0), verts=6), jhead)
        parent_keep(mesh_cube(f'{name}_FacePlate2', (-0.08, -0.12, 1.74), (0.12, 0.05, 0.10), M['scrap'], 0.006, rot=(0.18, 0, -0.28)), jhead)

    # jointed arms
    shL = (-0.28 * w, 0.02, 1.40)
    shR = (0.28 * w, 0.02, 1.40)
    parent_keep(mesh_sphere(f'{name}_ShL', shL, 0.085, M['skin'], segs=12), jspine)
    parent_keep(mesh_sphere(f'{name}_ShR', shR, 0.085, M['cloth'], segs=12), jspine)
    jshL = new_empty(f'{name}_JShL', shL); parent_keep(jshL, jspine)
    jshR = new_empty(f'{name}_JShR', shR); parent_keep(jshR, jspine)

    if pose == 'reach':
        upL, loL, hdL = (-0.34 * w, -0.30, 1.24), (-0.30 * w, -0.56, 1.12), (-0.28 * w, -0.66, 1.08)
        upR, loR, hdR = (0.30 * w, -0.24, 1.22), (0.24 * w, -0.48, 1.08), (0.22 * w, -0.58, 1.04)
    else:
        upL, loL, hdL = (-0.32 * w, -0.10, 1.18), (-0.22 * w, -0.24, 1.10), (-0.16 * w, -0.32, 1.08)
        upR, loR, hdR = (0.26 * w, -0.20, 1.22), (0.16 * w, -0.38, 1.16), (0.14 * w, -0.46, 1.14)

    sleeve_l = M['skin'] if cfg.get('missing_sleeve') == 'L' else M['cloth']
    parent_keep(cyl_between(f'{name}_UpL', shL, upL, 0.052, sleeve_l, verts=12), jshL)
    parent_keep(cyl_between(f'{name}_LoL', upL, loL, 0.044, M['skin'], verts=12), jshL)
    parent_keep(mesh_sphere(f'{name}_HandL', hdL, 0.052, M['skin'], segs=12), jshL)
    parent_keep(cyl_between(f'{name}_UpR', shR, upR, 0.052, M['cloth'], verts=12), jshR)
    parent_keep(cyl_between(f'{name}_LoR', upR, loR, 0.044, M['cloth2'], verts=12), jshR)
    parent_keep(mesh_sphere(f'{name}_HandR', hdR, 0.052, M['skin'], segs=12), jshR)
    parent_keep(mesh_cube(f'{name}_ElbowL', upL, (0.08, 0.07, 0.07), M['vest'], 0.008), jshL)
    parent_keep(mesh_cube(f'{name}_ElbowR', upR, (0.08, 0.07, 0.07), M['vest'], 0.008), jshR)

    tp_zombie_weapon(cfg.get('weapon', 'rifle'), M, jspine, name)

    bpy.context.view_layer.update()
    jspine.rotation_euler.x = hunch
    jhead.rotation_euler.x = loll[0]
    jhead.rotation_euler.y = loll[1]
    jhead.rotation_euler.z = loll[2]
    bpy.context.view_layer.update()
    return root


CHAR_CFGS = {
    'Char_Rusher': dict(
        cloth=(0.62, 0.54, 0.34), cloth2=(0.50, 0.48, 0.30),
        pants=(0.46, 0.42, 0.30), vest=(0.56, 0.50, 0.32),
        skin=(0.58, 0.56, 0.50), boots=(0.38, 0.28, 0.18),
        pouch=(0.54, 0.46, 0.30),
        hunch=0.50, head_loll=(0.24, 0.0, 0.16), pose='reach',
        torn_shirt=True, hanging_jaw=True, missing_sleeve='L',
        drag_foot='L', weapon='knife', wide=1.0,
    ),
    'Char_Rifle': dict(
        cloth=(0.46, 0.48, 0.30), cloth2=(0.42, 0.44, 0.28),
        pants=(0.44, 0.42, 0.30), vest=(0.50, 0.48, 0.32),
        skin=(0.52, 0.56, 0.52), boots=(0.34, 0.26, 0.16),
        pouch=(0.48, 0.44, 0.28),
        hunch=0.16, head_loll=(0.10, 0.0, 0.08), pose='aim',
        helmet=True, helmet_lopsided=True, hanging_jaw=True,
        weapon='rifle', wide=1.02,
    ),
    'Char_Shotgun': dict(
        cloth=(0.54, 0.46, 0.30), cloth2=(0.48, 0.42, 0.28),
        pants=(0.42, 0.40, 0.28), vest=(0.50, 0.44, 0.28),
        skin=(0.56, 0.52, 0.48), boots=(0.32, 0.22, 0.14),
        pouch=(0.46, 0.40, 0.26),
        hunch=0.18, head_loll=(0.12, 0.0, 0.06), pose='aim',
        split_jaw=True, weapon='shotgun', wide=1.22,
    ),
    'Char_Grenadier': dict(
        cloth=(0.58, 0.50, 0.32), cloth2=(0.50, 0.44, 0.28),
        pants=(0.46, 0.42, 0.28), vest=(0.56, 0.46, 0.26),
        skin=(0.52, 0.56, 0.46), boots=(0.36, 0.26, 0.16),
        pouch=(0.56, 0.42, 0.22),
        hunch=0.20, head_loll=(0.14, 0.0, 0.10), pose='aim',
        hanging_jaw=True, bile_sac=True, weapon='bile', wide=1.10,
    ),
    'Char_Midboss': dict(
        cloth=(0.54, 0.50, 0.36), cloth2=(0.48, 0.46, 0.34),
        pants=(0.44, 0.42, 0.34), vest=(0.46, 0.44, 0.40),
        skin=(0.56, 0.54, 0.50), boots=(0.30, 0.24, 0.18),
        pouch=(0.48, 0.46, 0.40),
        hunch=0.22, head_loll=(0.10, 0.0, 0.08), pose='aim',
        hanging_jaw=True, nail_plates=True, coat=True,
        weapon='rifle', wide=1.14,
    ),
    'Char_Finalboss': dict(
        cloth=(0.52, 0.46, 0.32), cloth2=(0.46, 0.40, 0.28),
        pants=(0.44, 0.38, 0.28), vest=(0.42, 0.40, 0.30),
        skin=(0.56, 0.50, 0.44), boots=(0.32, 0.24, 0.16),
        pouch=(0.54, 0.42, 0.24),
        hunch=0.12, head_loll=(0.08, 0.0, 0.05), pose='aim',
        hanging_jaw=True, sand_plates=True, throat=True,
        weapon='rifle', wide=1.28,
    ),
}


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
    canvas = principled('BagCanvas', (0.58, 0.52, 0.36), 0.92, 0.03, T['canvas'])
    root = new_empty('Prop_Sandbag')
    bag = mesh_cube('BagBody', (0, 0, 0.14), (0.72, 0.40, 0.28), canvas, 0.06)
    parent(bag, root)
    parent(mesh_cube('BagTie', (0, 0, 0.29), (0.10, 0.08, 0.06), canvas, 0.015), root)
    return root


def build_pallet(T):
    wood = principled('PalletWood', (0.46, 0.34, 0.18), 0.8, 0.04, T['wood'])
    root = new_empty('Prop_Pallet')
    parent(mesh_cube('PalletDeck', (0, 0, 0.08), (1.16, 0.92, 0.06), wood, 0.008), root)
    for i, x in enumerate((-0.46, 0.0, 0.46)):
        parent(mesh_cube(f'PalletBeam{i}', (x, 0, 0.035), (0.10, 0.92, 0.07), wood, 0.006), root)
    for i, z in enumerate((-0.38, 0.0, 0.38)):
        parent(mesh_cube(f'PalletSlat{i}', (0, z, 0.12), (1.16, 0.12, 0.03), wood, 0.004), root)
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



def main():
    chars_only = '--chars-only' in sys.argv
    clear_scene()
    print('Building textures...')
    T = build_textures()
    print('Building characters...')
    chars = [build_zombie(name, T, cfg) for name, cfg in CHAR_CFGS.items()]
    for name, root in zip(CHAR_CFGS, chars):
        print(f'  {name}  ~{count_tris(gather(root))} tris')
    export_glb(os.path.join(MODELS, 'characters.glb'), chars)
    if not chars_only:
        GM = build_gun_mats(T)
        print('Building viewmodels...')
        guns = [
            build_pistol(GM),
            build_smg(GM),
            build_rifle(GM),
            build_shotgun(GM),
            build_grenade(GM),
        ]
        print('Building props...')
        props = [build_crate(T), build_sandbag(T), build_pallet(T)]
        export_glb(os.path.join(MODELS, 'viewmodels.glb'), guns)
        export_glb(os.path.join(MODELS, 'props.glb'), props)
    blend_path = os.path.join(ART, 'dustline_assets.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print('Saved', blend_path)
    print('DONE')


if __name__ == '__main__':
    main()
