"""Melting clock shown while an event loads.

Builds the clock in Blender and saves melting-clock.blend next to this file.
The melting runs in a geometry nodes modifier ("Soft Melt") on the clock, so
the .blend plays in the viewport and its sliders (sag, drip length, spin
speeds) can be tweaked there. With --render it also renders the loop to
frames/.

    blender -b --factory-startup -P build.py -- [--render]

make.sh runs this and encodes the frames into the WebP files in public/.
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
RENDER = "--render" in sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else False

LOOP_FRAMES = 48
FPS = 16
RESOLUTION = (320, 480)  # 2x the 160x240 size in MeltingClock.tsx
TAU = 2 * math.pi

# Clock space: the face is a unit disc in the XZ plane, facing the camera at -Y.
BEZEL_RADIUS, BEZEL_TUBE, BEZEL_DEPTH, BEZEL_Y = 1.0, 0.065, 0.075, 0.02
# Drips along the bottom edge: (x, length, width, loop phase when the drop falls).
# Drops fall halfway between frames so motion blur never smears a drip snapping back.
DRIPS = [(-0.2, 0.75, 0.12, 0.5 / LOOP_FRAMES), (0.26, 0.55, 0.09, 24.5 / LOOP_FRAMES)]
# Which way each part turns per loop. The face turns backwards while the hands race forwards.
PARTS = {"face": 0, "hour": 1, "minute": 2, "second": 3}
TURNS = {"face": -1.0, "hour": 1.0, "minute": 2.0, "second": 4.0}

scene = bpy.context.scene
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)


# ------------------------------------------------------------------ materials

def principled(name, color, metallic=0.0, rough=0.4, film=0.0, sss=0.0):
    mat = bpy.data.materials.new(name)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Subsurface Weight"].default_value = sss
    if film:
        # Thin film thickness varies with a world-space noise, so a faint rainbow
        # sheen slides across the gold as the clock turns through it.
        nt = mat.node_tree
        coords = nt.nodes.new("ShaderNodeTexCoord")
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 2.5
        thickness = nt.nodes.new("ShaderNodeMapRange")
        thickness.inputs["To Min"].default_value = film * 0.4
        thickness.inputs["To Max"].default_value = film * 1.6
        nt.links.new(coords.outputs["Object"], noise.inputs["Vector"])
        nt.links.new(noise.outputs["Fac"], thickness.inputs["Value"])
        nt.links.new(thickness.outputs["Result"], bsdf.inputs["Thin Film Thickness"])
    return mat


MATERIALS = [
    principled("Face", (0.98, 0.91, 0.74), rough=0.3, sss=0.15),
    principled("Gold", (1.0, 0.68, 0.26), metallic=1.0, rough=0.2, film=520),
    principled("Ink", (0.015, 0.012, 0.02), rough=0.35),
    principled("Second Hand", (0.93, 0.36, 0.0), rough=0.3),  # the app's --primary orange
]
FACE, GOLD, INK, ACCENT = range(len(MATERIALS))


# ------------------------------------------------------------------ geometry
# Each builder returns (verts, faces) in clock space. Faces wind so the front
# of the clock faces -Y.

def disc(radius, rings, segs):
    verts = [(0, 0, 0)]
    for i in range(1, rings + 1):
        r = radius * i / rings
        verts += [(r * math.cos(TAU * j / segs), 0, r * math.sin(TAU * j / segs)) for j in range(segs)]
    faces = [(0, 1 + j, 1 + (j + 1) % segs) for j in range(segs)]
    for i in range(rings - 1):
        inner, outer = 1 + i * segs, 1 + (i + 1) * segs
        faces += [(inner + j, outer + j, outer + (j + 1) % segs, inner + (j + 1) % segs) for j in range(segs)]
    return np.array(verts, float), faces


def torus(radius, tube, depth, segs, tube_segs, center=(0, 0, 0)):
    verts = []
    for j in range(segs):
        out = np.array([math.cos(TAU * j / segs), 0, math.sin(TAU * j / segs)])
        for k in range(tube_segs):
            p = TAU * k / tube_segs
            verts.append(out * (radius + tube * math.cos(p)) + (0, depth * math.sin(p), 0) + np.array(center))
    faces = [(j * tube_segs + k, j * tube_segs + (k + 1) % tube_segs,
              (j + 1) % segs * tube_segs + (k + 1) % tube_segs, (j + 1) % segs * tube_segs + k)
             for j in range(segs) for k in range(tube_segs)]
    return np.array(verts, float), faces


def cylinder(radius, z0, z1, segs, rings, y=0.0):
    """Capped cylinder standing along Z."""
    verts = [(radius * math.cos(TAU * j / segs), y + radius * math.sin(TAU * j / segs), z0 + (z1 - z0) * i / rings)
             for i in range(rings + 1) for j in range(segs)]
    faces = [(i * segs + j, i * segs + (j + 1) % segs, (i + 1) * segs + (j + 1) % segs, (i + 1) * segs + j)
             for i in range(rings) for j in range(segs)]
    for z, ring in ((z0, 0), (z1, rings)):
        faces += [(len(verts), ring * segs + j, ring * segs + (j + 1) % segs) for j in range(segs)]
        verts.append((0, y, z))
    return np.array(verts, float), faces


def box(sx, sy, sz):
    verts = np.array([(x, y, z) for x in (-sx, sx) for y in (-sy, sy) for z in (-sz, sz)], float)
    return verts, [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]


def hand(length, tail, width, segs, y):
    """Flat tapered hand pointing at 12, three vertices across so it bends smoothly."""
    verts = []
    for z in np.linspace(-tail, length, segs + 1):
        half = width * (1 - (z + tail) / (length + tail)) ** 0.55 + 0.004
        verts += [(-half, y, z), (0, y, z), (half, y, z)]
    faces = [(i * 3 + c, i * 3 + c + 1, (i + 1) * 3 + c + 1, (i + 1) * 3 + c) for i in range(segs) for c in range(2)]
    return np.array(verts, float), faces


def numeral(text, size, depth):
    curve = bpy.data.curves.new("numeral", "FONT")
    curve.body, curve.size, curve.extrude = text, size, depth
    curve.align_x, curve.align_y = "CENTER", "CENTER"
    ob = bpy.data.objects.new("numeral", curve)
    scene.collection.objects.link(ob)
    mesh = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(curve)
    # Split the long font triangles so numerals bend with the face instead of cutting through it
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=2, use_grid_fill=True)
    verts = np.array([v.co[:] for v in bm.verts], float)
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    bpy.data.meshes.remove(mesh)
    # Fonts lie in XY facing +Z: stand them up in the face plane
    return np.stack([verts[:, 0], -verts[:, 2], verts[:, 1]], 1), faces


def spin(verts, angle):
    """Rotate clockwise (as the camera sees it) around the clock's axis."""
    c, s = math.cos(angle), math.sin(angle)
    x, y, z = verts.T
    return np.stack([x * c + z * s, y, -x * s + z * c], 1)


def merge(*pieces):
    verts, faces, offset = [], [], 0
    for v, f in pieces:
        verts.append(v)
        faces += [tuple(i + offset for i in face) for face in f]
        offset += len(v)
    return np.concatenate(verts), faces


class ClockMesh:
    """Collects every part into one mesh, tagging vertices with which way they turn."""

    def __init__(self):
        self.verts, self.faces, self.materials, self.smooth, self.parts = [], [], [], [], []
        self.count = 0

    def add(self, piece, materials, part="face", smooth=True, thickness=0.0, closed=False):
        verts, faces = piece
        mesh = bpy.data.meshes.new("piece")
        mesh.from_pydata([tuple(v) for v in verts], [], faces)
        if closed:
            bm = bmesh.new()
            bm.from_mesh(mesh)
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            bm.to_mesh(mesh)
            bm.free()
        if thickness:
            # Solidify grows the back (and its rim) behind the front, using the second material
            ob = bpy.data.objects.new("piece", mesh)
            scene.collection.objects.link(ob)
            mod = ob.modifiers.new("solidify", "SOLIDIFY")
            mod.thickness, mod.offset, mod.use_even_offset = thickness, -1, True
            mod.material_offset = mod.material_offset_rim = 1 if len(materials) > 1 else 0
            solid = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
            bpy.data.objects.remove(ob)
            bpy.data.meshes.remove(mesh)
            mesh = solid
        co = np.empty(len(mesh.vertices) * 3)
        mesh.vertices.foreach_get("co", co)
        index = np.empty(len(mesh.polygons), int)
        mesh.polygons.foreach_get("material_index", index)
        self.verts.append(co.reshape(-1, 3))
        self.faces += [tuple(i + self.count for i in p.vertices) for p in mesh.polygons]
        self.materials += [materials[min(i, len(materials) - 1)] for i in index]
        self.smooth += [smooth] * len(mesh.polygons)
        self.parts += [PARTS[part]] * len(mesh.vertices)
        self.count += len(mesh.vertices)
        bpy.data.meshes.remove(mesh)

    def build(self, name):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([tuple(v) for v in np.concatenate(self.verts)], [], self.faces)
        mesh.polygons.foreach_set("material_index", self.materials)
        mesh.polygons.foreach_set("use_smooth", self.smooth)
        mesh.attributes.new("part", "FLOAT", "POINT").data.foreach_set("value", [float(p) for p in self.parts])
        for mat in MATERIALS:
            mesh.materials.append(mat)
        mesh.update()
        return mesh


clock = ClockMesh()
clock.add(disc(1.0, 28, 160), [FACE, GOLD], thickness=0.05)
clock.add(torus(BEZEL_RADIUS, BEZEL_TUBE, BEZEL_DEPTH, 220, 18, center=(0, BEZEL_Y, 0)), [GOLD], closed=True)
ticks = []
for i in range(60):
    big = i % 5 == 0
    v, f = box(0.016 if big else 0.007, 0.006, 0.055 if big else 0.03)
    ticks.append((spin(v + (0, -0.006, 0.87 if big else 0.885), TAU * i / 60), f))
clock.add(merge(*ticks), [INK], smooth=False, closed=True)
numerals = []
for hour in range(1, 13):
    v, f = numeral(str(hour), 0.19, 0.006)
    a = TAU * hour / 12
    numerals.append((v + (0.69 * math.sin(a), -0.008, 0.69 * math.cos(a)), f))
clock.add(merge(*numerals), [INK], smooth=False)
# Pocket watch crown and bow at 12
clock.add(merge(cylinder(0.075, 1.04, 1.16, 24, 4, y=BEZEL_Y),
                torus(0.115, 0.024, 0.024, 48, 10, center=(0, BEZEL_Y, 1.29))), [GOLD], closed=True)
clock.add(hand(0.48, 0.1, 0.045, 24, -0.025), [INK], part="hour", smooth=False, thickness=0.012)
clock.add(hand(0.78, 0.12, 0.034, 36, -0.042), [INK], part="minute", smooth=False, thickness=0.012)
clock.add(hand(0.86, 0.2, 0.011, 40, -0.058), [ACCENT], part="second", smooth=False, thickness=0.008)
cap_v, cap_f = cylinder(0.055, -0.01, 0.01, 24, 1)
clock.add((np.stack([cap_v[:, 0], -cap_v[:, 2] - 0.07, cap_v[:, 1]], 1), cap_f), [GOLD], closed=True)

clock_ob = bpy.data.objects.new("Melting Clock", clock.build("Melting Clock"))
scene.collection.objects.link(clock_ob)


# ------------------------------------------------------------------ geometry nodes
# A tiny expression builder so the melt reads as math rather than node wiring.

class Graph:
    def __init__(self, tree):
        self.tree, self.count = tree, 0

    def node(self, kind, *inputs, **props):
        node = self.tree.nodes.new(kind)
        for key, value in props.items():
            setattr(node, key, value)
        node.location = (220 * (self.count // 10), -170 * (self.count % 10))
        self.count += 1
        for socket, value in zip(node.inputs, inputs):
            if value is not None:
                self.feed(socket, value)
        return node

    def feed(self, socket, value):
        if isinstance(value, Val):
            value = value.socket
        if isinstance(value, bpy.types.NodeSocket):
            self.tree.links.new(value, socket)
        else:
            socket.default_value = value

    def math(self, op, *args):
        return Val(self, self.node("ShaderNodeMath", *args, operation=op).outputs[0])

    def xyz(self, vector):
        node = self.node("ShaderNodeSeparateXYZ", vector)
        return [Val(self, s) for s in node.outputs]

    def vec(self, x, y, z):
        return Val(self, self.node("ShaderNodeCombineXYZ", x, y, z).outputs[0])

    def smoothstep(self, edge0, edge1, x):
        node = self.node("ShaderNodeMapRange", x, edge0, edge1, 0.0, 1.0, interpolation_type="SMOOTHSTEP", clamp=True)
        return Val(self, node.outputs[0])


class Val:
    def __init__(self, graph, socket):
        self.g, self.socket = graph, socket

    def __add__(self, o): return self.g.math("ADD", self, o)
    def __radd__(self, o): return self.g.math("ADD", o, self)
    def __sub__(self, o): return self.g.math("SUBTRACT", self, o)
    def __rsub__(self, o): return self.g.math("SUBTRACT", o, self)
    def __mul__(self, o): return self.g.math("MULTIPLY", self, o)
    def __rmul__(self, o): return self.g.math("MULTIPLY", o, self)
    def __truediv__(self, o): return self.g.math("DIVIDE", self, o)
    def __pow__(self, o): return self.g.math("POWER", self, o)
    def sin(self): return self.g.math("SINE", self)
    def cos(self): return self.g.math("COSINE", self)
    def exp(self): return self.g.math("EXPONENT", self)
    def fract(self): return self.g.math("FRACT", self)
    def max(self, o): return self.g.math("MAXIMUM", self, o)
    def less(self, o): return self.g.math("LESS_THAN", self, o)
    def equals(self, o): return self.g.math("COMPARE", self, o, 0.5)


def node_group(name, inputs, outputs):
    tree = bpy.data.node_groups.new(name, "GeometryNodeTree")
    for sock_name, kind, default in inputs:
        sock = tree.interface.new_socket(sock_name, in_out="INPUT", socket_type=kind)
        if default is not None:
            sock.default_value = default
    for sock_name, kind in outputs:
        tree.interface.new_socket(sock_name, in_out="OUTPUT", socket_type=kind)
    g = Graph(tree)
    ins = g.node("NodeGroupInput")
    out = g.node("NodeGroupOutput")
    return tree, g, {s.name: Val(g, s) for s in ins.outputs if s.name}, out


SLIDERS = [
    ("Sag", "NodeSocketFloat", 0.85),
    ("Narrow", "NodeSocketFloat", 0.3),
    ("Drape Back", "NodeSocketFloat", 0.45),
    ("Wobble", "NodeSocketFloat", 0.1),
    ("Drip Length", "NodeSocketFloat", 1.0),
]

# Melt Field: where a point of the (already turned) clock ends up at loop time T.
# Gravity sags everything below the crown, pinching it narrower and draping it
# back, while drips grow from the bottom edge until the drop falls.
melt_tree, g, i, out = node_group(
    "Melt Field",
    [("Position", "NodeSocketVector", None), ("T", "NodeSocketFloat", 0.0)] + SLIDERS,
    [("Position", "NodeSocketVector")])
x, y, z = g.xyz(i["Position"])
t = i["T"]
s = ((1.1 - z) / 2.2).max(0.0)
wobble = 1.0 + i["Wobble"] * (TAU * 2 * t).sin()
z2 = z - i["Sag"] * wobble * s * s
x2 = x * (1.0 - i["Narrow"] * s ** 1.6) + 0.05 * (TAU * t).sin() * s * s
for drip_x, length, width, phase in DRIPS:
    grow = (t - phase).fract()
    d = (x - drip_x) / width
    reach = (0.0 - d * d).exp() * g.smoothstep(0.62, 1.0, s)
    z2 = z2 - reach * (length * i["Drip Length"]) * (0.3 + grow)
y2 = y + i["Drape Back"] * s ** 2.2
g.feed(out.inputs[0], g.vec(x2, y2, z2))


def melt(g, position, t, sliders):
    node = g.node("GeometryNodeGroup", node_tree=melt_tree)
    g.feed(node.inputs["Position"], position)
    g.feed(node.inputs["T"], t)
    for name, *_ in SLIDERS:
        g.feed(node.inputs[name], sliders[name])
    return Val(g, node.outputs[0])


# Soft Melt: the modifier. Turns each part, melts it, and drops the falling drips.
soft_tree, g, i, out = node_group(
    "Soft Melt",
    [("Geometry", "NodeSocketGeometry", None),
     ("Loop Frames", "NodeSocketFloat", float(LOOP_FRAMES)),
     ("Face Turns", "NodeSocketFloat", TURNS["face"]),
     ("Hour Turns", "NodeSocketFloat", TURNS["hour"]),
     ("Minute Turns", "NodeSocketFloat", TURNS["minute"]),
     ("Second Turns", "NodeSocketFloat", TURNS["second"])] + SLIDERS,
    [("Geometry", "NodeSocketGeometry")])
soft_tree.is_modifier = True
frame = Val(g, g.node("GeometryNodeInputSceneTime").outputs["Frame"])
t = ((frame - 1.0) / i["Loop Frames"]).fract()
part = Val(g, g.node("GeometryNodeInputNamedAttribute", "part", data_type="FLOAT").outputs["Attribute"])
turns = (part.equals(PARTS["face"]) * i["Face Turns"] + part.equals(PARTS["hour"]) * i["Hour Turns"]
         + part.equals(PARTS["minute"]) * i["Minute Turns"] + part.equals(PARTS["second"]) * i["Second Turns"])
angle = TAU * turns * t
px, py, pz = g.xyz(Val(g, g.node("GeometryNodeInputPosition").outputs[0]))
turned = g.vec(px * angle.cos() + pz * angle.sin(), py, 0.0 - px * angle.sin() + pz * angle.cos())
melted = g.node("GeometryNodeSetPosition", i["Geometry"], None, melt(g, turned, t, i))
join = g.node("GeometryNodeJoinGeometry")
g.feed(join.inputs[0], melted.outputs[0])
sphere = g.node("GeometryNodeMeshUVSphere", 24, 16, 1.0)
for drip_x, length, width, phase in DRIPS:
    # The drop starts where its drip's tip was just before it let go, then falls away
    tip = melt(g, (drip_x, BEZEL_Y, -math.sqrt((BEZEL_RADIUS + BEZEL_TUBE) ** 2 - drip_x ** 2)), phase - 1e-4, i)
    tx, ty, tz = g.xyz(tip)
    age = (t - phase).fract()
    radius = (0.05 + 0.2 * width) * age.less(0.45)
    drop = g.node("GeometryNodeTransform", sphere.outputs[0])
    g.feed(drop.inputs["Translation"], g.vec(tx, ty, tz - 0.03 - 14.0 * age * age))
    g.feed(drop.inputs["Scale"], g.vec(radius, radius, radius * (1.2 + 3.0 * age)))
    drop = g.node("GeometryNodeSetMaterial", drop.outputs[0], None, MATERIALS[GOLD])
    g.feed(join.inputs[0], g.node("GeometryNodeSetShadeSmooth", drop.outputs[0]).outputs[0])
g.feed(out.inputs[0], join.outputs[0])

clock_ob.modifiers.new("Soft Melt", "NODES").node_group = soft_tree


# ------------------------------------------------------------------ camera, lights, render

def aim(ob, at):
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = (Vector(at) - ob.location).to_track_quat("-Z", "Y")


cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
cam.data.lens = 52
cam.location = (0.0, -7.5, 0.7)
aim(cam, (0, 0, -0.5))
scene.collection.objects.link(cam)
scene.camera = cam

for name, loc, power, color, size in [
    ("Key", (-3.5, -4.5, 5.0), 1300, (1.0, 0.93, 0.82), 4),
    ("Rim", (3.5, 4.0, 2.5), 900, (1.0, 0.35, 0.75), 3),
    ("Fill", (-4.0, -2.0, -3.0), 500, (0.25, 0.8, 1.0), 4),
]:
    light = bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA"))
    light.data.energy, light.data.color, light.data.size = power, color, size
    light.location = loc
    aim(light, (0, 0, 0))
    scene.collection.objects.link(light)

world = bpy.data.worlds.new("Sunset")
scene.world = world
env = world.node_tree.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(os.path.join(
    bpy.utils.system_resource("DATAFILES"), "studiolights", "world", "sunset.exr"))
world.node_tree.links.new(env.outputs["Color"], world.node_tree.nodes["Background"].inputs["Color"])
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9

scene.frame_start, scene.frame_end = 1, LOOP_FRAMES
render = scene.render
render.fps = FPS
render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 64
render.use_motion_blur = True
render.motion_blur_shutter = 0.2
render.film_transparent = True
render.resolution_x, render.resolution_y = RESOLUTION
render.image_settings.file_format = "PNG"
render.image_settings.color_mode = "RGBA"
render.filepath = os.path.join(HERE, "frames", "")
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Punchy"

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "melting-clock.blend"))
if RENDER:
    bpy.ops.render.render(animation=True)
