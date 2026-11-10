
import * as THREE from '../vendor/three/three.module.js';

export const ENEMY_DEFS = {
  rusher: { name: '面罩突袭兵', hp: 48, speed: 3.7, damage: 12, range: 1.55, interval: 0.7, score: 80, kind: 'melee' },
  rifle: { name: '钢盔火枪手', hp: 70, speed: 2.25, damage: 9, range: 16, interval: 0.95, score: 110, kind: 'gun' },
  shotgun: { name: '短管清场手', hp: 88, speed: 2.7, damage: 18, range: 6.5, interval: 1.25, score: 130, kind: 'gun' },
  grenadier: { name: '投弹手', hp: 76, speed: 2.05, damage: 28, range: 17, interval: 2.6, score: 150, kind: 'nade' },
  midboss: { name: '铁罩督战', hp: 560, speed: 2.35, damage: 16, range: 14, interval: 0.85, score: 900, kind: 'boss', scale: 1.38 },
  finalboss: { name: '砂喉重甲', hp: 1180, speed: 1.85, damage: 18, range: 16, interval: 0.7, score: 2000, kind: 'boss', scale: 1.72 }
};

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
const sph = new THREE.SphereGeometry(1, 10, 8);

function mesh(parent, geo, mat, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function makeChar(type) {
  const g = new THREE.Group();
  const pal = {
    rusher: { jacket: 0x4d542c, pants: 0x3a3428, vest: 0x2c2a22, head: 0x3a3028, helm: null, accent: 0x1a1a18 },
    rifle: { jacket: 0x8a7548, pants: 0x4a4634, vest: 0x2e3228, head: 0x3a3028, helm: 0x3a4a30, accent: 0x222 },
    shotgun: { jacket: 0x2a2e2a, pants: 0x242018, vest: 0x3a3428, head: 0x2e2822, helm: 0x1c1c1c, accent: 0x111 },
    grenadier: { jacket: 0x6a4030, pants: 0x3a2c22, vest: 0x4a3020, head: 0x3a3028, helm: 0x4a3a28, accent: 0x8a4a20 },
    midboss: { jacket: 0x2a2622, pants: 0x1c1a18, vest: 0x3a3c40, head: 0x2a2824, helm: 0x4a4c50, accent: 0x222 },
    finalboss: { jacket: 0x6a5434, pants: 0x3a3224, vest: 0x2a2c2e, head: 0x2a2620, helm: 0x2c2e30, accent: 0xff7a30 }
  }[type];
  const jacket = new THREE.MeshStandardMaterial({ color: pal.jacket, roughness: 0.78, metalness: 0.08 });
  const pants = new THREE.MeshStandardMaterial({ color: pal.pants, roughness: 0.82, metalness: 0.05 });
  const vest = new THREE.MeshStandardMaterial({ color: pal.vest, roughness: 0.7, metalness: type.includes('boss') ? 0.55 : 0.15 });
  const skin = new THREE.MeshStandardMaterial({ color: pal.head, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: pal.accent, roughness: 0.55, metalness: 0.2 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.35, metalness: 0.8 });

  const torso = mesh(g, box, jacket, 0, 1.22, 0, 0.52, 0.62, 0.3);
  mesh(g, box, vest, 0, 1.24, 0.04, 0.56, 0.42, 0.22);
  mesh(g, box, pants, -0.14, 0.52, 0, 0.2, 0.7, 0.22);
  mesh(g, box, pants, 0.14, 0.52, 0, 0.2, 0.7, 0.22);
  mesh(g, box, dark, -0.14, 0.14, 0.04, 0.22, 0.12, 0.28);
  mesh(g, box, dark, 0.14, 0.14, 0.04, 0.22, 0.12, 0.28);
  const armL = mesh(g, box, jacket, -0.38, 1.18, 0, 0.16, 0.55, 0.16);
  const armR = mesh(g, box, jacket, 0.38, 1.18, 0, 0.16, 0.55, 0.16);
  const head = mesh(g, sph, skin, 0, 1.68, 0, 0.18, 0.2, 0.18);
  mesh(head, box, dark, 0, 0.05, 0.85, 1.05, 0.7, 0.25);
  mesh(head, box, dark, 0, -0.35, 0.2, 0.95, 0.45, 0.9);
  if (pal.helm) {
    const helm = new THREE.MeshStandardMaterial({ color: pal.helm, roughness: 0.45, metalness: 0.55 });
    mesh(head, sph, helm, 0, 0.25, 0, 1.15, 0.75, 1.15);
  }
  if (type === 'rusher') {
    mesh(armR, box, metal, 0, -0.65, 0.4, 0.25, 0.15, 1.1);
  } else {
    const gun = mesh(armR, box, metal, 0.1, -0.45, 0.55, 0.18, 0.16, 1.3);
    mesh(gun, cyl, metal, 0, 0, -0.7, 0.25, 0.7, 0.25);
  }
  if (type === 'grenadier') {
    mesh(g, cyl, new THREE.MeshStandardMaterial({ color: 0x6a3a18, roughness: 0.6 }), -0.22, 1.35, 0.2, 0.07, 0.18, 0.07);
    mesh(g, cyl, new THREE.MeshStandardMaterial({ color: 0x6a3a18, roughness: 0.6 }), -0.08, 1.35, 0.22, 0.07, 0.18, 0.07);
  }
  if (type === 'midboss') {
    const iron = new THREE.MeshStandardMaterial({ color: 0x5a5c60, metalness: 0.75, roughness: 0.35 });
    mesh(head, box, iron, 0, 0.05, 0.95, 1.3, 1.1, 0.35);
    mesh(g, box, iron, 0, 1.35, -0.28, 0.5, 0.45, 0.25);
    mesh(g, cyl, metal, 0.18, 1.7, -0.32, 0.04, 0.9, 0.04);
    mesh(g, box, dark, 0, 1.05, 0.05, 0.72, 0.9, 0.38);
  }
  if (type === 'finalboss') {
    const plate = new THREE.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.7, roughness: 0.4 });
    const glow = new THREE.MeshStandardMaterial({ color: 0xff7a30, emissive: 0xff5510, emissiveIntensity: 1.4, roughness: 0.3 });
    mesh(g, box, plate, -0.48, 1.5, 0, 0.42, 0.28, 0.42);
    mesh(g, box, plate, 0.48, 1.5, 0, 0.42, 0.28, 0.42);
    mesh(head, box, glow, 0, 0.1, 0.95, 0.9, 0.18, 0.2);
    mesh(g, cyl, plate, -0.2, 1.55, -0.32, 0.08, 0.55, 0.08);
    mesh(g, cyl, plate, 0.2, 1.55, -0.32, 0.08, 0.55, 0.08);
    mesh(g, box, metal, 0.55, 1.15, 0.35, 0.22, 0.22, 0.9);
  }
  g.userData.bodyMats = [jacket, vest, pants, skin];
  g.userData.torso = torso;
  g.userData.armR = armR;
  return g;
}

export class Enemy {
  constructor(type, x, z, scene) {
    this.type = type;
    this.def = ENEMY_DEFS[type];
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.root = makeChar(type);
    const sc = this.def.scale || 1;
    this.root.scale.setScalar(sc);
    this.height = 1.8 * sc;
    this.radius = 0.38 * sc;
    this.root.position.set(x, 0, z);
    scene.add(this.root);
    this.alive = true;
    this.state = 'spawn';
    this.age = 0;
    this.cd = 0.4 + Math.random() * 0.4;
    this.flash = 0;
    this.yaw = 0;
    this.speedMul = 1;
    this.telegraph = 0;
    this.chargeT = 0;
    this.deadT = 0;
    this.warn = null;
    this.strafe = Math.random() > 0.5 ? 1 : -1;
    this.root.traverse((o) => { o.userData.skipHit = true; });
  }

  pos() { return this.root.position; }

  hitbox() {
    const p = this.root.position;
    return { x: p.x, y: p.y + this.height * 0.52, z: p.z, r: this.radius, h: this.height };
  }

  applyDamage(amt) {
    if (!this.alive) return 0;
    this.hp -= amt;
    this.flash = 0.12;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.state = 'dead';
      this.deadT = 0;
      return this.def.score;
    }
    return 0;
  }

  update(dt, player, world, combat) {
    this.age += dt;
    if (this.flash > 0) {
      this.flash -= dt;
      const em = this.flash > 0 ? 0.55 : 0;
      for (const m of this.root.userData.bodyMats) m.emissive = new THREE.Color(em, 0.05, 0.02);
    }
    if (this.state === 'dead') {
      this.deadT += dt;
      this.root.rotation.z = Math.min(1.4, this.deadT * 3);
      this.root.position.y = -this.deadT * 0.6;
      this.root.scale.multiplyScalar(1 - dt * 0.2);
      return this.deadT > 1.3;
    }
    if (this.state === 'spawn') {
      const k = Math.min(1, this.age / 0.35);
      this.root.scale.setScalar((this.def.scale || 1) * k);
      if (k >= 1) this.state = 'chase';
      return false;
    }

    const pp = player.position;
    const me = this.root.position;
    const dx = pp.x - me.x, dz = pp.z - me.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const dirx = dx / dist, dirz = dz / dist;
    this.yaw = Math.atan2(dx, dz);
    this.root.rotation.y = this.yaw;

    if (this.cd > 0) this.cd -= dt;
    if (this.telegraph > 0) this.telegraph -= dt;

    let pref = this.def.range * 0.75;
    if (this.def.kind === 'melee') pref = 1.2;
    if (this.def.kind === 'nade') pref = 13;
    if (this.type === 'rifle') pref = 12;

    let mx = 0, mz = 0;
    if (this.chargeT > 0) {
      this.chargeT -= dt;
      mx = dirx * 8.5; mz = dirz * 8.5;
    } else if (dist > pref + 0.6) {
      mx = dirx * this.def.speed; mz = dirz * this.def.speed;
    } else if (dist < pref - 1.6 && this.def.kind !== 'melee') {
      mx = -dirx * this.def.speed * 0.7; mz = -dirz * this.def.speed * 0.7;
    } else {
      mx = -dirz * this.strafe * this.def.speed * 0.55;
      mz = dirx * this.strafe * this.def.speed * 0.55;
    }

    const next = world.collide(me.x + mx * dt, 0.9, me.z + mz * dt, this.radius, this.height);
    me.x = next.x; me.z = next.z; me.y = 0;
    this.root.position.y = Math.abs(Math.sin(this.age * 8)) * 0.03;

    if (this.type === 'midboss' && this.cd <= 0 && dist < 11 && Math.random() < 0.35) {
      this.telegraph = 0.7;
      this.chargeT = 0;
      this.cd = 3.2;
      combat.markTelegraph(me.x, me.z, 1.4, 0.7, 0xff6622);
      setTimeout(() => { if (this.alive) this.chargeT = 0.7; }, 700);
    }
    if (this.type === 'finalboss' && this.cd <= 0 && Math.random() < 0.28) {
      const sx = pp.x, sz = pp.z;
      combat.markTelegraph(sx, sz, 2.6, 0.85, 0xff9933);
      this.cd = 2.8;
      setTimeout(() => {
        if (!this.alive) return;
        const d = Math.hypot(player.position.x - sx, player.position.z - sz);
        if (d < 2.7) player.hurt(this.def.damage + 10);
        combat.explodeFx(sx, 0.2, sz);
      }, 850);
    }

    if (this.telegraph > 0) return false;

    if (this.cd <= 0) {
      if (this.def.kind === 'melee' && dist < this.def.range) {
        player.hurt(this.def.damage);
        this.cd = this.def.interval;
      } else if (this.def.kind === 'gun' && dist < this.def.range + 4) {
        combat.enemyShoot(this, player);
        this.cd = this.def.interval + Math.random() * 0.25;
      } else if (this.def.kind === 'nade' && dist < 20) {
        combat.enemyGrenade(this, player);
        this.cd = this.def.interval;
      } else if (this.def.kind === 'boss' && dist < this.def.range + 5) {
        combat.enemyShoot(this, player);
        this.cd = this.def.interval;
      }
    }
    return false;
  }
}


function rayCapsule(origin, dir, x, z, y0, y1, r) {
  const ox = origin.x - x, oz = origin.z - z;
  const a = dir.x * dir.x + dir.z * dir.z;
  if (a < 1e-8) {
    if (ox * ox + oz * oz > r * r) return null;
    if (dir.y > 0) return y0 > origin.y ? (y0 - origin.y) / dir.y : 0;
    if (dir.y < 0) return y1 < origin.y ? (y1 - origin.y) / dir.y : 0;
    return 0;
  }
  const b = 2 * (ox * dir.x + oz * dir.z);
  const c = ox * ox + oz * oz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0) return null;
  const y = origin.y + dir.y * t;
  if (y < y0 - 0.12 || y > y1 + 0.12) return null;
  return t;
}

export class Combat {
  constructor(scene, world, audio) {
    this.scene = scene;
    this.world = world;
    this.audio = audio;
    this.enemies = [];
    this.fx = [];
    this.ray = new THREE.Raycaster();
    this._n = new THREE.Vector3();
  }

  spawn(type, x, z) {
    const e = new Enemy(type, x, z, this.scene);
    this.enemies.push(e);
    this.audio.spawn();
    return e;
  }

  living() { return this.enemies.filter((e) => e.alive); }

  hitscan(origin, dir, spread, pellets, damage) {
    let hits = 0, score = 0, killed = [];
    for (let p = 0; p < pellets; p++) {
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * spread * 2;
      d.y += (Math.random() - 0.5) * spread * 2;
      d.z += (Math.random() - 0.5) * spread * 2;
      d.normalize();
      this.ray.set(origin, d);
      this.ray.far = 90;
      let best = null, bestDist = 90;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const hb = e.hitbox();
        const tHit = rayCapsule(origin, d, hb.x, hb.z, e.root.position.y + 0.15, e.root.position.y + hb.h, hb.r + 0.18);
        if (tHit != null && tHit > 0.05 && tHit < bestDist) {
          best = e; bestDist = tHit;
        }
      }
      const wh = this.world.hitWorld(origin, d, bestDist);
      if (wh && wh.distance < bestDist) {
        this.spark(wh.point);
        continue;
      }
      if (best) {
        const head = origin.y + d.y * bestDist > best.root.position.y + best.height * 0.78;
        const dmg = damage * (head ? 1.45 : 1);
        const sc = best.applyDamage(dmg);
        score += sc;
        hits += 1;
        if (sc > 0) killed.push(best);
        this.spark(origin.clone().addScaledVector(d, bestDist), true);
      }
    }
    return { hits, score, killed };
  }

  enemyShoot(e, player) {
    const origin = e.root.position.clone();
    origin.y += e.height * 0.72;
    const target = player.position.clone();
    target.y += player.crouching ? 0.9 : 1.45;
    target.x += (Math.random() - 0.5) * 1.4;
    target.y += (Math.random() - 0.5) * 0.8;
    const dir = target.sub(origin).normalize();
    const wh = this.world.hitWorld(origin, dir, 40);
    const pdist = player.position.clone().setY(origin.y).distanceTo(e.root.position);
    const hitDist = origin.distanceTo(new THREE.Vector3(player.position.x, origin.y, player.position.z));
    if (wh && wh.distance + 0.4 < hitDist) return;
    const aim = Math.hypot(player.position.x - (origin.x + dir.x * hitDist), player.position.z - (origin.z + dir.z * hitDist));
    if (aim < 0.85 + (e.def.kind === 'boss' ? 0.3 : 0)) player.hurt(e.def.damage);
    this.spark(origin.clone().addScaledVector(dir, 1.2));
  }

  enemyGrenade(e, player) {
    const tx = player.position.x, tz = player.position.z;
    this.markTelegraph(tx, tz, 2.3, 1.0, 0xffaa33);
    setTimeout(() => {
      this.explodeFx(tx, 0.3, tz);
      this.audio.explode();
      const d = Math.hypot(player.position.x - tx, player.position.z - tz);
      if (d < 2.4) player.hurt(e.def.damage);
      for (const o of this.living()) {
        const dd = Math.hypot(o.pos().x - tx, o.pos().z - tz);
        if (dd < 2.2) o.applyDamage(20);
      }
    }, 1000);
  }

  playerGrenade(origin, dir, player) {
    const dest = origin.clone().addScaledVector(dir, 11);
    dest.y = 0;
    const tx = dest.x, tz = dest.z;
    this.markTelegraph(tx, tz, 2.6, 0.85, 0x88ffcc);
    setTimeout(() => {
      this.explodeFx(tx, 0.3, tz);
      this.audio.explode();
      let score = 0;
      for (const e of this.living()) {
        const dd = Math.hypot(e.pos().x - tx, e.pos().z - tz);
        if (dd < 3.1) score += e.applyDamage(90 * (1 - dd / 3.1));
      }
      const pd = Math.hypot(player.position.x - tx, player.position.z - tz);
      if (pd < 2.4) player.hurt(35);
      return score;
    }, 850);
  }

  markTelegraph(x, z, r, dur, color) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false });
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.72, r, 28), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.08, z);
    this.scene.add(m);
    this.fx.push({ mesh: m, t: dur, max: dur, kind: 'ring' });
  }

  explodeFx(x, y, z) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.8, depthWrite: false });
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), mat);
    m.position.set(x, y, z);
    this.scene.add(m);
    this.fx.push({ mesh: m, t: 0.35, max: 0.35, kind: 'boom' });
  }

  spark(p, blood = false) {
    const mat = new THREE.MeshBasicMaterial({ color: blood ? 0x8a2010 : 0xffd090, transparent: true, opacity: 0.9 });
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), mat);
    m.position.copy(p);
    this.scene.add(m);
    this.fx.push({ mesh: m, t: 0.18, max: 0.18, kind: 'spark' });
  }

  update(dt, player) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const gone = this.enemies[i].update(dt, player, this.world, this);
      if (gone) {
        this.scene.remove(this.enemies[i].root);
        this.enemies.splice(i, 1);
      }
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t -= dt;
      if (f.kind === 'boom') f.mesh.scale.setScalar(1 + (1 - f.t / f.max) * 6);
      f.mesh.material.opacity = Math.max(0, f.t / f.max * (f.kind === 'ring' ? 0.4 : 0.85));
      if (f.t <= 0) { this.scene.remove(f.mesh); this.fx.splice(i, 1); }
    }
  }

  clearAll() {
    for (const e of this.enemies) this.scene.remove(e.root);
    this.enemies.length = 0;
    for (const f of this.fx) this.scene.remove(f.mesh);
    this.fx.length = 0;
  }
}
