
import * as THREE from '../vendor/three/three.module.js';

function hash2(x, y) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function noise2(x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y, oct = 5) {
  let v = 0, a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) {
    v += noise2(x * f, y * f) * a;
    s += a; a *= 0.5; f *= 2;
  }
  return v / s;
}

function clamp(v, a = 0, b = 1) { return v < a ? a : v > b ? b : v; }

function makeMaps(size, sample) {
  const albedo = new Uint8ClampedArray(size * size * 4);
  const roughA = new Uint8ClampedArray(size * size * 4);
  const normal = new Uint8ClampedArray(size * size * 4);
  const aoA = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const s = sample(u, v);
      const i = (y * size + x);
      height[i] = s.h;
      const o = i * 4;
      albedo[o] = s.r; albedo[o + 1] = s.g; albedo[o + 2] = s.b; albedo[o + 3] = 255;
      const rk = clamp(s.rough) * 255;
      roughA[o] = rk; roughA[o + 1] = rk; roughA[o + 2] = rk; roughA[o + 3] = 255;
      const ao = clamp(s.ao) * 255;
      aoA[o] = ao; aoA[o + 1] = ao; aoA[o + 2] = ao; aoA[o + 3] = 255;
    }
  }
  const strength = 2.4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xm = (x + size - 1) % size, xp = (x + 1) % size;
      const ym = (y + size - 1) % size, yp = (y + 1) % size;
      const dx = height[y * size + xp] - height[y * size + xm];
      const dy = height[yp * size + x] - height[ym * size + x];
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv; ny *= inv; nz *= inv;
      const o = (y * size + x) * 4;
      normal[o] = (nx * 0.5 + 0.5) * 255;
      normal[o + 1] = (ny * 0.5 + 0.5) * 255;
      normal[o + 2] = (nz * 0.5 + 0.5) * 255;
      normal[o + 3] = 255;
    }
  }
  return { albedo, roughA, normal, aoA };
}

function toTex(data, size, srgb = false) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  t.flipY = false;
  return t;
}

function pbrFrom(size, sample) {
  const m = makeMaps(size, sample);
  return {
    map: toTex(m.albedo, size, true),
    roughnessMap: toTex(m.roughA, size),
    normalMap: toTex(m.normal, size),
    aoMap: toTex(m.aoA, size)
  };
}

function sampleSand(u, v) {
  const n = fbm(u * 6, v * 6, 5);
  const fine = fbm(u * 22, v * 22, 3);
  const peb = hash2(Math.floor(u * 140), Math.floor(v * 140));
  const dirt = fbm(u * 2.4 + 8, v * 2.4 + 2, 3);
  let h = n * 0.28 + fine * 0.08 + (peb > 0.97 ? 0.12 : 0);
  let r = 186 + n * 18 + fine * 8 - dirt * 14;
  let g = 152 + n * 14 + fine * 6 - dirt * 12;
  let b = 108 + n * 10 - dirt * 10;
  if (peb > 0.978) { r = 142; g = 128; b = 108; }
  return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), rough: 0.86 - n * 0.08, h, ao: 0.8 + n * 0.14 };
}

function sampleConcrete(u, v) {
  const n = fbm(u * 5, v * 5, 4);
  const fine = fbm(u * 18, v * 18, 3);
  const stain = fbm(u * 1.8 + 4, v * 1.8, 3);
  let r = 176 + n * 14 + fine * 7 - stain * 10;
  let g = 164 + n * 12 + fine * 6 - stain * 9;
  let b = 146 + n * 10 - stain * 8;
  const h = n * 0.18 + fine * 0.06;
  return { r: clamp(r,0,255), g: clamp(g,0,255), b: clamp(b,0,255), rough: 0.68, h, ao: 0.82 + n * 0.12 };
}

function samplePlaster(u, v) {
  const n = fbm(u * 4.5, v * 4.5, 5);
  const peel = fbm(u * 6 + 3, v * 5 + 11, 4);
  const streak = Math.pow(fbm(u * 10, v * 1.8, 3), 2.4);
  const grime = fbm(u * 2.2, v * 7, 3);
  let r = 214 + n * 12 - peel * 10;
  let g = 196 + n * 10 - peel * 12;
  let b = 168 + n * 8 - peel * 14;
  if (peel > 0.72) { r = 188 + n * 8; g = 168; b = 138; }
  r -= streak * 10 + grime * 10; g -= streak * 9 + grime * 9; b -= streak * 8 + grime * 8;
  const h = n * 0.18 + (peel > 0.72 ? 0.08 : 0) - streak * 0.05;
  return { r: clamp(r,0,255), g: clamp(g,0,255), b: clamp(b,0,255), rough: 0.8 + peel * 0.05, h, ao: 0.82 + n * 0.12 - streak * 0.06 };
}

function sampleBrick(u, v) {
  const bu = 8, bv = 14;
  const row = Math.floor(v * bv);
  const off = (row % 2) * 0.5;
  const bx = (u * bu + off) % 1;
  const by = (v * bv) % 1;
  const mx = Math.min(bx, 1 - bx);
  const my = Math.min(by, 1 - by);
  const mortar = mx < 0.07 || my < 0.1;
  const n = fbm(u * 18, v * 18, 4);
  const id = hash2(Math.floor(u * bu + off), row);
  let r = 148 + id * 40 + n * 16;
  let g = 78 + id * 16 + n * 10;
  let b = 52 + id * 10;
  if (mortar) { r = 168 + n * 10; g = 150; b = 126; }
  const h = mortar ? 0.05 : 0.35 + n * 0.15;
  return { r: clamp(r,0,255), g: clamp(g,0,255), b: clamp(b,0,255), rough: mortar ? 0.88 : 0.74, h, ao: mortar ? 0.92 : 0.7 + n * 0.1 };
}

function sampleMetal(u, v, tint) {
  const n = fbm(u * 7, v * 7, 5);
  const scratch = Math.pow(Math.abs(fbm(u * 30, v * 2.2, 3) - 0.5) * 2, 6);
  const rust = Math.pow(fbm(u * 6 + 9, v * 6 + 2, 4), 2.2);
  const panel = (((Math.floor(u * 4) + Math.floor(v * 2)) % 2) ? 1 : 0) * 0.04;
  let r = tint[0] * (0.55 + n * 0.28) + scratch * 70;
  let g = tint[1] * (0.55 + n * 0.28) + scratch * 70;
  let b = tint[2] * (0.55 + n * 0.28) + scratch * 66;
  if (rust > 0.42) {
    const k = (rust - 0.42) / 0.58;
    r = r * (1 - k) + (140 + n * 30) * k;
    g = g * (1 - k) + (68 + n * 16) * k;
    b = b * (1 - k) + (32 + n * 8) * k;
  }
  r += panel * 40; g += panel * 40; b += panel * 30;
  const rough = clamp(0.32 + rust * 0.5 - scratch * 0.35);
  const h = n * 0.18 + rust * 0.12 - scratch * 0.08;
  return { r: clamp(r,0,255), g: clamp(g,0,255), b: clamp(b,0,255), rough, h, ao: 0.72 + n * 0.18 - rust * 0.1 };
}

function sampleWood(u, v) {
  const grain = fbm(u * 3, v * 22, 4);
  const ring = Math.sin((u * 14 + grain * 3) * Math.PI * 2) * 0.5 + 0.5;
  const knot = hash2(Math.floor(u * 6), Math.floor(v * 3));
  let r = 118 + ring * 28 + grain * 12;
  let g = 86 + ring * 18 + grain * 8;
  let b = 58 + ring * 10;
  if (knot > 0.93) { r -= 20; g -= 16; b -= 10; }
  const h = grain * 0.22 + ring * 0.08;
  return { r: clamp(r,0,255), g: clamp(g,0,255), b: clamp(b,0,255), rough: 0.76, h, ao: 0.78 + grain * 0.12 };
}

function sampleTarp(u, v) {
  const weave = ((Math.floor(u * 64) + Math.floor(v * 64)) % 2) * 8;
  const n = fbm(u * 4, v * 4, 4);
  const fade = fbm(u * 2 + 3, v * 2, 3);
  let r = 170 + weave - fade * 30 + n * 10;
  let g = 92 + weave * 0.5 - fade * 18;
  let b = 58 - fade * 10;
  return { r: clamp(r,0,255), g: clamp(g,0,255), b: clamp(b,0,255), rough: 0.86, h: n * 0.15 + weave * 0.004, ao: 0.8 };
}

function sampleAsphalt(u, v) {
  const n = fbm(u * 10, v * 10, 5);
  const oil = Math.pow(fbm(u * 3 + 2, v * 3 + 7, 4), 3);
  let r = 78 + n * 16 + oil * 14;
  let g = 70 + n * 14 + oil * 12;
  let b = 62 + n * 12 + oil * 16;
  return { r: clamp(r,0,255), g: clamp(g,0,255), b: clamp(b,0,255), rough: 0.55 - oil * 0.35, h: n * 0.12, ao: 0.7 + n * 0.15 };
}

export async function generateTextures(size, onProgress) {
  const jobs = [
    ['sand', sampleSand],
    ['concrete', sampleConcrete],
    ['plaster', samplePlaster],
    ['brick', sampleBrick],
    ['metalTeal', (u, v) => sampleMetal(u, v, [46, 92, 98])],
    ['metalRust', (u, v) => sampleMetal(u, v, [92, 58, 40])],
    ['metalSand', (u, v) => sampleMetal(u, v, [168, 138, 78])],
    ['wood', sampleWood],
    ['tarp', sampleTarp],
    ['asphalt', sampleAsphalt]
  ];
  const out = {};
  for (let i = 0; i < jobs.length; i++) {
    const [name, fn] = jobs[i];
    out[name] = pbrFrom(size, fn);
    if (onProgress) onProgress((i + 1) / jobs.length, name);
    await new Promise((r) => requestAnimationFrame(r));
  }
  return out;
}

export function applyPBR(mat, maps, repeatX = 1, repeatY = 1) {
  const set = (tex) => {
    if (!tex) return;
    tex.repeat.set(repeatX, repeatY);
    tex.needsUpdate = true;
  };
  mat.map = maps.map; set(mat.map);
  mat.roughnessMap = maps.roughnessMap; set(mat.roughnessMap);
  mat.normalMap = maps.normalMap; set(mat.normalMap);
  mat.normalScale = new THREE.Vector2(0.85, 0.85);
  mat.aoMap = maps.aoMap; set(mat.aoMap);
  mat.aoMapIntensity = 0.85;
  mat.needsUpdate = true;
  return mat;
}

export function makeMaterial(maps, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: opts.color ?? 0xffffff,
    metalness: opts.metalness ?? 0.04,
    roughness: opts.roughness ?? 0.7,
    envMapIntensity: opts.envMapIntensity ?? 0.85
  });
  applyPBR(mat, maps, opts.repeatX ?? 2, opts.repeatY ?? 2);
  if (opts.metalness != null) mat.metalness = opts.metalness;
  return mat;
}
