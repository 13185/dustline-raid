
import * as THREE from '../vendor/three/three.module.js';
import { makeMaterial } from './textures.js';

export const SPAWN_MIN_REGULAR = 16;
export const SPAWN_MIN_RUSHER = 19;
export const SPAWN_MIN_BOSS = 19;

export function spawnMinFor(type) {
  if (type === 'rusher') return SPAWN_MIN_RUSHER;
  if (type === 'finalboss') return 20;
  if (type === 'midboss' || (type && String(type).includes('boss'))) return SPAWN_MIN_BOSS;
  return SPAWN_MIN_REGULAR;
}

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = gl_Position.w;
}`;
const SKY_FRAG = `
varying vec3 vDir;
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 groundColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
void main() {
  vec3 n = normalize(vDir);
  float h = n.y;
  vec3 col = mix(horizonColor, topColor, smoothstep(-0.02, 0.62, h));
  col = mix(groundColor, col, smoothstep(-0.35, 0.04, h));
  vec3 sd = normalize(sunDir);
  float sun = pow(max(dot(n, sd), 0.0), 64.0);
  float glow = pow(max(dot(n, sd), 0.0), 5.0);
  float haze = pow(1.0 - abs(h), 3.0);
  col += sunColor * sun * 2.2 + sunColor * glow * 0.35 + vec3(1.0, 0.75, 0.4) * haze * 0.12;
  gl_FragColor = vec4(col, 1.0);
}`;

export class World {
  constructor(scene, renderer, textures, quality, propLib = null) {
    this.scene = scene;
    this.textures = textures;
    this.quality = quality;
    this.propLib = propLib || {};
    this.colliders = [];
    this.spawns = [];
    this.geo = {
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
      plane: new THREE.PlaneGeometry(1, 1),
      sphere: new THREE.SphereGeometry(1, 12, 10)
    };
    this._makeMats();
    this._lights(renderer);
    this._sky();
    this._ground();
    this._perimeter();
    this._warehouse();
    this._westBuilding();
    this._containers();
    this._center();
    this._stall();
    this._tower();
    this._props();
    this._hills();
    this._dust();
    this._spawns();
  }

  _makeMats() {
    const t = this.textures;
    this.mats = {
      sand: makeMaterial(t.sand, { repeatX: 12, repeatY: 12, roughness: 0.9, metalness: 0.02 }),
      slab: makeMaterial(t.concrete, { repeatX: 6, repeatY: 6, roughness: 0.78 }),
      plaster: makeMaterial(t.plaster, { repeatX: 3.2, repeatY: 1.6, roughness: 0.82 }),
      plaster2: makeMaterial(t.plaster, { repeatX: 2.2, repeatY: 1.4, color: 0xe6d0a8 }),
      brick: makeMaterial(t.brick, { repeatX: 2.4, repeatY: 2.6, roughness: 0.8 }),
      teal: makeMaterial(t.metalTeal, { repeatX: 2, repeatY: 1.2, metalness: 0.72, roughness: 0.38, envMapIntensity: 1.1 }),
      rust: makeMaterial(t.metalRust, { repeatX: 2, repeatY: 1.2, metalness: 0.65, roughness: 0.46, envMapIntensity: 1.0 }),
      sandMetal: makeMaterial(t.metalSand, { repeatX: 1.6, repeatY: 1, metalness: 0.6, roughness: 0.42 }),
      wood: makeMaterial(t.wood, { repeatX: 1.2, repeatY: 1.2, roughness: 0.8 }),
      tarp: makeMaterial(t.tarp, { repeatX: 2, repeatY: 2, roughness: 0.9 }),
      bag: makeMaterial(t.sand, { repeatX: 1.6, repeatY: 1.6, color: 0xd8c896, roughness: 0.94 }),
      wet: makeMaterial(t.asphalt, { repeatX: 3, repeatY: 3, metalness: 0.22, roughness: 0.28, envMapIntensity: 1.4 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x16120e, roughness: 0.9, metalness: 0.05 })
    };
  }

  _lights(renderer) {
    this.sunDir = new THREE.Vector3(-0.82, 0.42, 0.28).normalize();
    const sun = new THREE.DirectionalLight(0xffd8b0, 2.45);
    sun.position.copy(this.sunDir.clone().multiplyScalar(55));
    sun.castShadow = this.quality !== 'low';
    if (sun.castShadow) {
      const sz = this.quality === 'high' ? 2048 : 1024;
      sun.shadow.mapSize.set(sz, sz);
      const c = sun.shadow.camera;
      c.left = c.bottom = -34; c.right = c.top = 34;
      c.near = 1; c.far = 120;
      sun.shadow.bias = -0.00035;
      sun.shadow.normalBias = 0.045;
    }
    this.scene.add(sun);
    this.sun = sun;
    this.scene.add(new THREE.HemisphereLight(0xe8eef4, 0x6a5840, 0.95));
    this.scene.add(new THREE.AmbientLight(0x4a4034, 0.34));
    const fill = new THREE.DirectionalLight(0xc0d4e8, 0.72);
    fill.position.set(30, 22, -12);
    this.scene.add(fill);
    const bay = new THREE.PointLight(0xff9a4a, 2.1, 22, 1.6);
    bay.position.set(0, 4.2, -16);
    this.scene.add(bay);
    const eaves = new THREE.PointLight(0xffc07a, 0.8, 14, 2);
    eaves.position.set(-12, 3.6, 2);
    this.scene.add(eaves);

    const envScene = new THREE.Scene();
    envScene.add(new THREE.HemisphereLight(0xffd2a8, 0x4a3018, 1.4));
    envScene.background = new THREE.Color(0xc49a62);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
    this.scene.fog = new THREE.FogExp2(0xb7aa90, this.quality === 'high' ? 0.0062 : 0.008);
    this.scene.background = new THREE.Color(0xb7aa90);
  }

  _sky() {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x7ea0bc) },
        horizonColor: { value: new THREE.Color(0xe6cda6) },
        groundColor: { value: new THREE.Color(0x8a6238) },
        sunDir: { value: this.sunDir.clone() },
        sunColor: { value: new THREE.Color(0xffd090) }
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 24, 16), mat);
    this.scene.add(sky);
  }

  box(mat, x, y, z, sx, sy, sz, collide = true, shadow = true) {
    const m = new THREE.Mesh(this.geo.box, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = shadow;
    m.receiveShadow = true;
    this.scene.add(m);
    if (collide) this.addAABB(x, y, z, sx, sy, sz);
    return m;
  }

  cyl(mat, x, y, z, r, h, collide = true) {
    const m = new THREE.Mesh(this.geo.cyl, mat);
    m.position.set(x, y, z);
    m.scale.set(r, h, r);
    m.castShadow = true; m.receiveShadow = true;
    this.scene.add(m);
    if (collide) this.addAABB(x, y, z, r * 1.6, h, r * 1.6);
    return m;
  }

  addAABB(x, y, z, sx, sy, sz) {
    this.colliders.push({
      minx: x - sx / 2, maxx: x + sx / 2,
      miny: y - sy / 2, maxy: y + sy / 2,
      minz: z - sz / 2, maxz: z + sz / 2
    });
  }

  _ground() {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), this.mats.sand);
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    this.scene.add(g);
    this.box(this.mats.slab, 0, 0.02, 2, 10, 0.05, 28, false, false);
    this.box(this.mats.slab, 0, 0.02, -8, 22, 0.05, 8, false, false);
    this.box(this.mats.wet, 3.2, 0.04, 4.5, 4.2, 0.03, 2.4, false, false);
    this.box(this.mats.wet, -5.5, 0.04, -6, 3.2, 0.03, 2.1, false, false);
    this.box(this.mats.wet, 8.5, 0.04, 11, 2.6, 0.03, 1.8, false, false);
  }

  _perimeter() {
    const w = this.mats.plaster;
    const b = this.mats.brick;
    this.box(w, 0, 2.4, 21.2, 44, 4.8, 0.7);
    this.box(b, -21.2, 2.6, 2, 0.7, 5.2, 38);
    this.box(w, 21.2, 2.4, 0, 0.7, 4.8, 42);
    this.box(w, -3.6, 1.1, 21.0, 4.2, 2.2, 0.55, false);
    const arch = this.box(this.mats.sandMetal, 0, 3.7, 21.15, 7.2, 0.45, 0.85, false);
    arch.castShadow = true;
  }

  _warehouse() {
    const w = this.mats.plaster2;
    const m = this.mats.rust;
    this.box(w, 0, 3.6, -20.6, 30, 7.2, 0.7);
    this.box(w, -14.6, 3.6, -16.4, 0.7, 7.2, 9);
    this.box(w, 14.6, 3.6, -16.4, 0.7, 7.2, 9);
    this.box(m, 0, 7.15, -16.6, 31, 0.35, 9.4);
    this.box(this.mats.slab, 0, 0.03, -16.6, 28, 0.06, 8.4, false, false);
    this.box(w, -10.4, 3.2, -12.2, 8.4, 6.4, 0.6);
    this.box(w, 10.4, 3.2, -12.2, 8.4, 6.4, 0.6);
    this.box(m, 0, 6.6, -12.15, 12.4, 0.5, 0.7);
    this.box(this.mats.sandMetal, -6.2, 3.3, -12.15, 0.45, 6.6, 0.5);
    this.box(this.mats.sandMetal, 6.2, 3.3, -12.15, 0.45, 6.6, 0.5);
    this.box(this.mats.wood, -11, 0.7, -17.4, 2.2, 1.4, 1.8);
    this.box(this.mats.wood, -8.6, 0.55, -18.6, 1.6, 1.1, 1.3);
    this.box(this.mats.teal, 10.5, 1.3, -17.8, 5.4, 2.6, 2.2);
    for (let i = 0; i < 5; i++) {
      this.cyl(this.mats.rust, -4 + i * 1.15, 0.55, -19.2, 0.32, 1.1);
    }
    const beam = this.box(this.mats.rust, 0, 5.6, -16.5, 28, 0.2, 0.2, false);
    this.box(this.mats.dark, -12.5, 3.6, -20.2, 1.6, 1.3, 0.12, false);
    this.box(this.mats.dark, 6.5, 3.6, -20.2, 1.8, 1.4, 0.12, false);
  }

  _westBuilding() {
    this.box(this.mats.plaster, -17.4, 3.1, 1.2, 7.2, 6.2, 18.5);
    this.box(this.mats.brick, -17.4, 1.5, 1.2, 7.35, 3.05, 18.6, false);
    this.box(this.mats.wood, -13.4, 3.35, 2.4, 3.6, 0.16, 8.4, false);
    this.box(this.mats.wood, -12.0, 2.45, -0.6, 0.18, 1.7, 0.18, false);
    this.box(this.mats.wood, -12.0, 2.45, 5.4, 0.18, 1.7, 0.18, false);
    this.box(this.mats.dark, -13.75, 2.3, -4.2, 0.12, 1.8, 1.2, false);
    this.box(this.mats.dark, -13.75, 4.5, 3.2, 0.12, 1.2, 1.6, false);
    this.box(this.mats.dark, -13.75, 4.5, 6.4, 0.12, 1.2, 1.4, false);
    this.box(this.mats.wood, -13.6, 1.15, -4.2, 0.3, 2.3, 1.3, false);
    this.box(this.mats.rust, -14.6, 6.4, 1.2, 8.2, 0.25, 19, false);
  }

  _containers() {
    const cols = [this.mats.teal, this.mats.rust, this.mats.sandMetal];
    const spots = [
      [16.4, 1.3, -7.2, 0], [16.4, 1.3, -3.8, 1], [16.4, 3.9, -5.6, 2],
      [16.6, 1.3, 2.2, 1], [16.6, 1.3, 5.8, 0], [16.6, 3.9, 4.0, 2],
      [16.2, 1.3, 11.4, 2]
    ];
    for (const [x, y, z, ci] of spots) {
      this.box(cols[ci], x, y, z, 6.2, 2.55, 2.45);
      this.box(this.mats.dark, x - 3.05, y, z, 0.08, 2.1, 2.15, false);
    }
    this.box(this.mats.plaster2, 19.6, 2.2, 16.5, 3.2, 4.4, 8.4);
  }

  _center() {
    this.cyl(this.mats.brick, 0, 0.42, 0, 1.35, 0.84);
    this.cyl(this.mats.concrete ? this.mats.slab : this.mats.slab, 0, 0.95, 0, 1.5, 0.18);
    this.cyl(this.mats.dark, 0, 0.55, 0, 0.95, 0.7, false);
    this.sandbags(7.2, 1.6, 0.4);
    this.sandbags(-5.2, 5.1, -0.4);
    this.sandbags(6.8, -4.2, 0.3);
    this.sandbags(-3.4, -8.4, 0.6);
  }

  sandbags(x, z, rot) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    if (this.propLib.Prop_Sandbag) {
      for (let i = 0; i < 5; i++) {
        const bag = this.propLib.Prop_Sandbag.clone(true);
        bag.position.set((i % 3) * 0.62 - 0.62, Math.floor(i / 3) * 0.28, (i % 2) * 0.08);
        bag.rotation.y = (i - 2) * 0.08;
        bag.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        g.add(bag);
      }
      this.scene.add(g);
      this.addAABB(x, 0.32, z, 2.1, 0.64, 1.1);
      return;
    }
    for (let i = 0; i < 5; i++) {
      const bag = new THREE.Mesh(this.geo.box, this.mats.bag);
      bag.scale.set(0.75, 0.28, 0.42);
      bag.position.set((i % 3) * 0.62 - 0.62, 0.18 + Math.floor(i / 3) * 0.28, (i % 2) * 0.08);
      bag.rotation.y = (i - 2) * 0.08;
      bag.castShadow = true; bag.receiveShadow = true;
      g.add(bag);
    }
    this.scene.add(g);
    this.addAABB(x, 0.32, z, 2.1, 0.64, 1.1);
  }

  _stall() {
    const x = -7.4, z = 10.2;
    for (const [px, pz] of [[-1.5, -1.1], [1.5, -1.1], [-1.5, 1.1], [1.5, 1.1]]) {
      this.cyl(this.mats.wood, x + px, 1.15, z + pz, 0.08, 2.3, false);
    }
    this.box(this.mats.tarp, x, 2.35, z, 3.6, 0.08, 2.8, false);
    this.box(this.mats.wood, x, 1.05, z, 3.1, 0.12, 1.4);
    this.box(this.mats.tarp, x - 0.6, 1.25, z, 0.7, 0.35, 0.5, false);
    this.box(this.mats.teal, x + 0.7, 1.28, z + 0.15, 0.45, 0.4, 0.35, false);
    this._sign('沙市货栈', x, 2.7, z + 1.5, 2.4, 0.55);
  }

  _sign(text, x, y, z, w, h) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 160;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#6a3a1c';
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = '#c9a066';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 496, 144);
    ctx.fillStyle = '#f0d9a8';
    ctx.font = 'bold 72px "Noto Sans SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 84);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.05 });
    const mesh = new THREE.Mesh(this.geo.box, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, 0.08);
    mesh.castShadow = true;
    this.scene.add(mesh);
  }

  _tower() {
    const x = 18.6, z = -16.8;
    for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
      this.cyl(this.mats.rust, x + dx, 3.4, z + dz, 0.1, 6.8, false);
    }
    this.cyl(this.mats.sandMetal, x, 7.4, z, 1.55, 2.2);
    this.cyl(this.mats.rust, x, 8.7, z, 0.18, 1.4, false);
    this.addAABB(x, 4, z, 2.6, 8.2, 2.6);
  }

  _props() {
    const crates = [
      [5.4, 0.45, 8.6, 1.1], [6.5, 0.35, 9.3, 0.8], [5.8, 1.15, 8.9, 0.7],
      [-9.2, 0.45, -5.4, 1.1], [-10.2, 0.35, -4.5, 0.75],
      [8.8, 0.45, -9.5, 1.05], [2.2, 0.4, -10.6, 0.9],
      [-2.4, 0.4, 14.5, 1.0], [3.1, 0.35, 15.2, 0.7]
    ];
    for (const [x, y, z, s] of crates) {
      if (this.propLib.Prop_Crate) {
        const c = this.propLib.Prop_Crate.clone(true);
        c.position.set(x, 0, z);
        c.scale.setScalar(s / 0.7);
        c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        this.scene.add(c);
        this.addAABB(x, y, z, s, s * 0.85, s);
      } else {
        this.box(this.mats.wood, x, y, z, s, s * 0.85, s);
      }
    }
    const drums = [[9.4, 12.2], [10.1, 12.8], [-11.4, 7.2], [11.8, -10.6], [-6.2, -10.8]];
    for (const [x, z] of drums) this.cyl(this.mats.rust, x, 0.5, z, 0.32, 0.95);
    this.box(this.mats.rust, -13.5, 4.7, -8.2, 0.22, 0.22, 16, false);
    this.box(this.mats.rust, -12.2, 4.7, -8.2, 0.16, 0.16, 14, false);
    this.cyl(this.mats.dark, 12.4, 0.28, 14.6, 0.52, 0.22, false);
    this.cyl(this.mats.dark, 12.5, 0.48, 14.6, 0.42, 0.18, false);
    this._decal('07', 16.4, 2.2, -5.95, this.mats.teal);
    this._paintedWall();
    this.box(this.mats.wood, -9.4, 0.42, 13.6, 1.6, 0.84, 0.7);
    this.box(this.mats.wood, -1.6, 0.42, -5.2, 2.4, 0.84, 0.7);
    this.box(this.mats.brick, -13.6, 0.35, 12.6, 1.8, 0.7, 3.2);
    this.box(this.mats.plaster2, 8.6, 1.8, 21.0, 0.2, 1.4, 0.2, false);
    for (let i = 0; i < 4; i++) {
      this.box(this.mats.dark, -13.76, 4.4, -6 + i * 3.1, 0.1, 1.15, 1.35, false);
    }
    this.box(this.mats.sandMetal, -10.2, 2.8, 21.05, 3.4, 0.18, 0.55, false);
    this.cyl(this.mats.rust, -12.6, 1.6, 16.8, 0.08, 3.2, false);
    this.cyl(this.mats.rust, 10.8, 1.6, 18.4, 0.08, 3.2, false);
    this.box(this.mats.tarp, 10.8, 3.25, 17.6, 0.05, 1.4, 2.2, false);
  }

  _decal(text, x, y, z) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(20,16,10,0.55)';
    ctx.font = 'bold 140px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 140);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(this.geo.plane, mat);
    mesh.position.set(x - 3.12, y, z);
    mesh.scale.set(1.4, 1.4, 1);
    mesh.rotation.y = Math.PI / 2;
    this.scene.add(mesh);
  }

  _paintedWall() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(90,40,20,0.0)';
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = 'rgba(90, 32, 18, 0.72)';
    ctx.font = 'bold 88px "Noto Sans SC", sans-serif';
    ctx.fillText('禁区', 70, 150);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(this.geo.plane, mat);
    mesh.position.set(-13.78, 3.4, 10.5);
    mesh.scale.set(3.2, 1.6, 1);
    mesh.rotation.y = Math.PI / 2;
    this.scene.add(mesh);
  }

  _hills() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a623c, roughness: 1, metalness: 0 });
    for (const [x, z, s] of [[-40, -30, 22], [50, -20, 26], [-30, 48, 18], [46, 40, 20]]) {
      const m = new THREE.Mesh(this.geo.sphere, mat);
      m.position.set(x, -4, z);
      m.scale.set(s, 8 + s * 0.15, s * 0.8);
      this.scene.add(m);
    }
  }

  _dust() {
    const n = this.quality === 'high' ? 420 : this.quality === 'medium' ? 180 : 0;
    if (!n) return;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 46;
      pos[i * 3 + 1] = Math.random() * 8 + 0.4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 46;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffd2a0, size: 0.045, transparent: true, opacity: 0.42,
      depthWrite: false, sizeAttenuation: true
    });
    this.dust = new THREE.Points(geo, mat);
    this.scene.add(this.dust);
  }

  _spawns() {
    // Perimeter / edge points only — never the yard center in front of the player start.
    this.spawns = [
      [0.0, -10.8], [4.4, -10.6], [-4.4, -10.6],
      [8.2, -10.2], [-8.2, -10.2],
      [0.0, -16.8], [7.5, -17.2], [-7.5, -17.2],
      [12.4, -8.8], [12.6, -2.0], [12.5, 4.0], [12.2, 10.5], [11.8, 16.8],
      [-12.4, -9.0], [-12.5, -3.0], [-12.4, 12.2], [-12.2, 17.0],
      [-11.5, 18.8], [0.0, 19.0], [11.5, 18.8], [-6.0, 19.0], [6.0, 19.0]
    ];
  }

  pickSpawn(px, pz, minDist = SPAWN_MIN_REGULAR) {
    const far = [];
    for (const [x, z] of this.spawns) {
      const placed = this._validateSpawn(x, z, px, pz, minDist);
      if (placed) far.push(placed);
    }
    if (far.length) return far[Math.floor(Math.random() * far.length)];
    const ring = this._ringSpawn(px, pz, minDist);
    if (ring) return ring;
    return this._forcedFar(px, pz, minDist);
  }

  _validateSpawn(x, z, px, pz, minDist) {
    const c = this.collide(x, 0.9, z, 0.48, 1.8);
    const slip = Math.hypot(c.x - x, c.z - z);
    if (slip > 0.9) return null;
    const d = Math.hypot(c.x - px, c.z - pz);
    if (d < minDist - 0.05) return null;
    return [c.x, c.z];
  }

  _ringSpawn(px, pz, minDist) {
    const radii = [minDist, minDist + 1.5, minDist + 3, minDist + 5];
    const n = 16;
    const off = Math.random() * Math.PI * 2;
    for (const r of radii) {
      for (let i = 0; i < n; i++) {
        const a = off + (i * Math.PI * 2) / n;
        const x = px + Math.cos(a) * r;
        const z = pz + Math.sin(a) * r;
        const placed = this._validateSpawn(x, z, px, pz, minDist);
        if (placed) return placed;
      }
    }
    return null;
  }

  _forcedFar(px, pz, minDist) {
    let best = this.spawns[0], bestD = -1;
    for (const s of this.spawns) {
      const c = this.collide(s[0], 0.9, s[1], 0.48, 1.8);
      const d = Math.hypot(c.x - px, c.z - pz);
      if (d > bestD) { best = [c.x, c.z]; bestD = d; }
    }
    if (bestD >= minDist) return best;
    let dx = best[0] - px, dz = best[1] - pz;
    let len = Math.hypot(dx, dz);
    if (len < 0.2) {
      dx = -px || 1;
      dz = -pz;
      len = Math.hypot(dx, dz) || 1;
    }
    dx /= len; dz /= len;
    const raw = this.collide(px + dx * minDist, 0.9, pz + dz * minDist, 0.48, 1.8);
    const d = Math.hypot(raw.x - px, raw.z - pz);
    if (d >= minDist - 0.05) return [raw.x, raw.z];
    if (d > bestD) return [raw.x, raw.z];
    return best;
  }

  collide(px, py, pz, radius, height) {
    let x = px, z = pz;
    const head = py + height * 0.5;
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (head < c.miny - 0.05 || py > c.maxy + 0.02) continue;
      const qx = Math.max(c.minx, Math.min(x, c.maxx));
      const qz = Math.max(c.minz, Math.min(z, c.maxz));
      const dx = x - qx, dz = z - qz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        const d = Math.sqrt(d2) || 0.0001;
        const push = (radius - d) + 0.001;
        x += (dx / d) * push;
        z += (dz / d) * push;
      }
    }
    x = Math.max(-20.4, Math.min(20.4, x));
    z = Math.max(-20.6, Math.min(20.4, z));
    return { x, z };
  }

  hitWorld(origin, dir, max = 80) {
    const ray = new THREE.Raycaster(origin, dir, 0.1, max);
    const hits = ray.intersectObjects(this.scene.children, true);
    for (const h of hits) {
      if (h.object.isPoints) continue;
      let o = h.object, skip = false;
      while (o) {
        if (o.userData && o.userData.skipHit) { skip = true; break; }
        o = o.parent;
      }
      if (skip) continue;
      return h;
    }
    return null;
  }

  update(dt) {
    if (this.dust) {
      const arr = this.dust.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += dt * 0.18;
        arr[i + 1] += dt * 0.12;
        if (arr[i] > 23) arr[i] -= 46;
        if (arr[i + 1] > 8.5) arr[i + 1] = 0.3;
      }
      this.dust.geometry.attributes.position.needsUpdate = true;
    }
  }
}
