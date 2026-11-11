
import * as THREE from '../vendor/three/three.module.js';
import { instantiateCharacter } from './assets.js';

function makeEnemyHealthBar() {
  const g = new THREE.Group();
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(0.74, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x120c08, transparent: true, opacity: 0.88, depthWrite: false })
  );
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x3dcc55, transparent: true, opacity: 0.96, depthWrite: false })
  );
  fill.scale.set(0.68, 0.058, 1);
  fill.position.z = 0.002;
  g.add(back);
  g.add(fill);
  g.userData.fill = fill;
  g.userData.skipHit = true;
  g.traverse((o) => { o.userData.skipHit = true; o.renderOrder = 2; });
  g.visible = false;
  return g;
}

export const ENEMY_DEFS = {
  rusher: { name: '腐衣扑咬者', hp: 48, speed: 3.7, damage: 12, range: 1.55, interval: 0.7, score: 80, kind: 'melee' },
  rifle: { name: '锈枪丧尸', hp: 70, speed: 2.25, damage: 9, range: 16, interval: 0.95, score: 110, kind: 'gun' },
  shotgun: { name: '裂颚清场尸', hp: 88, speed: 2.7, damage: 18, range: 6.5, interval: 1.25, score: 130, kind: 'gun' },
  grenadier: { name: '胀袋投掷尸', hp: 76, speed: 2.05, damage: 28, range: 17, interval: 2.6, score: 150, kind: 'nade' },
  midboss: { name: '钉板督尸', hp: 560, speed: 2.35, damage: 16, range: 14, interval: 0.85, score: 900, kind: 'boss', scale: 1.38 },
  finalboss: { name: '砂喉尸甲', hp: 1180, speed: 1.85, damage: 18, range: 16, interval: 0.7, score: 2000, kind: 'boss', scale: 1.72 }
};

export class Enemy {
  constructor(type, x, z, scene, catalog) {
    this.type = type;
    this.def = ENEMY_DEFS[type];
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.root = instantiateCharacter(type, catalog);
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
    this.spawnGrace = (this.def.kind === 'melee' || this.def.kind === 'boss') ? 0.9 : 0.45;
    this.wasHit = false;
    this.justDied = false;
    this.hpBar = makeEnemyHealthBar();
    scene.add(this.hpBar);
  }

  pos() { return this.root.position; }

  hitbox() {
    const p = this.root.position;
    return { x: p.x, y: p.y + this.height * 0.52, z: p.z, r: this.radius, h: this.height };
  }

  applyDamage(amt) {
    if (!this.alive) return 0;
    this.hp -= amt;
    this.flash = 0.18;
    this.wasHit = true;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.state = 'dead';
      this.deadT = 0;
      this.justDied = true;
      if (this.hpBar) this.hpBar.visible = false;
      return this.def.score;
    }
    return 0;
  }

  updateHealthBar(camera, player) {
    if (!this.hpBar) return;
    if (!this.alive) {
      this.hpBar.visible = false;
      return;
    }
    const dist = this.root.position.distanceTo(player.position);
    this.hpBar.visible = !!(this.wasHit || dist < 30);
    if (!this.hpBar.visible) return;
    const tip = this.root.userData.headTop;
    if (tip) {
      tip.getWorldPosition(this._barPos || (this._barPos = new THREE.Vector3()));
      this.hpBar.position.set(this._barPos.x, this._barPos.y + 0.20, this._barPos.z);
    } else {
      this.hpBar.position.set(this.root.position.x, this.root.position.y + this.height + 0.36, this.root.position.z);
    }
    this.hpBar.quaternion.copy(camera.quaternion);
    const pct = Math.max(0, this.hp / this.maxHp);
    const fill = this.hpBar.userData.fill;
    fill.scale.x = 0.68 * Math.max(0.03, pct);
    fill.position.x = -0.34 * (1 - pct);
    fill.material.color.set(pct > 0.55 ? 0x3dcc55 : pct > 0.3 ? 0xe8b02a : 0xd42a1c);
  }

  update(dt, player, world, combat) {
    this.age += dt;
    if (this.flash > 0) {
      this.flash -= dt;
      const em = this.flash > 0 ? 0.9 : 0;
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
      const k = Math.min(1, this.age / 0.55);
      this.root.scale.setScalar((this.def.scale || 1) * k);
      if (k >= 1) this.state = 'chase';
      return false;
    }
    if (this.hold) return false;

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
    const spd = Math.hypot(mx, mz);
    this.walkT = (this.walkT || 0) + dt * (2.4 + spd * 1.7);
    const amp = THREE.MathUtils.clamp(spd / 3.4, 0.12, 1);
    const s = Math.sin(this.walkT);
    const c = Math.cos(this.walkT);
    const isRusher = this.type === 'rusher';
    this.root.position.y = Math.abs(s) * (isRusher ? 0.024 : 0.038) * amp;
    const j = this.root.userData.joints || {};
    if (!this._jointRest) {
      this._jointRest = {};
      for (const [k, node] of Object.entries(j)) {
        if (node) this._jointRest[k] = { x: node.rotation.x, y: node.rotation.y, z: node.rotation.z };
      }
    }
    const rest = this._jointRest;
    const drag = isRusher ? 0.42 : 1;
    if (j.hipL) j.hipL.rotation.x = (rest.hipL?.x || 0) + s * 0.52 * amp * drag;
    if (j.hipR) j.hipR.rotation.x = (rest.hipR?.x || 0) + -s * 0.70 * amp;
    if (j.kneeL) j.kneeL.rotation.x = (rest.kneeL?.x || 0) + Math.max(0, -s) * (isRusher ? 0.22 : 0.5) * amp;
    if (j.kneeR) j.kneeR.rotation.x = (rest.kneeR?.x || 0) + Math.max(0, s) * 0.52 * amp;
    if (j.shL) j.shL.rotation.x = (rest.shL?.x || 0) + -s * (isRusher ? 0.18 : 0.26) * amp;
    if (j.shR) j.shR.rotation.x = (rest.shR?.x || 0) + s * (isRusher ? 0.14 : 0.26) * amp;
    if (j.head && rest.head) {
      j.head.rotation.x = rest.head.x + c * 0.07;
      j.head.rotation.z = rest.head.z + s * 0.09;
    }
    if (j.spine && rest.spine) {
      j.spine.rotation.z = rest.spine.z + s * 0.03;
    }

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
    if (this.age < this.spawnGrace) return false;

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
  constructor(scene, world, audio, catalog, loot = null) {
    this.scene = scene;
    this.world = world;
    this.audio = audio;
    this.catalog = catalog;
    this.loot = loot;
    this.enemies = [];
    this.fx = [];
    this.ray = new THREE.Raycaster();
    this._n = new THREE.Vector3();
    this.casingGeo = new THREE.CylinderGeometry(0.004, 0.0045, 0.016, 6);
    this.casingMat = new THREE.MeshStandardMaterial({ color: 0xc4a04a, metalness: 0.85, roughness: 0.32 });
    this.decalGeo = new THREE.CircleGeometry(0.07, 10);
  }

  spawn(type, x, z) {
    const e = new Enemy(type, x, z, this.scene, this.catalog);
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
        this.impact(wh.point, wh.normal || (wh.face && wh.face.normal) || new THREE.Vector3(0, 1, 0), false);
        this.tracer(origin, d, wh.distance);
        continue;
      }
      if (best) {
        const head = origin.y + d.y * bestDist > best.root.position.y + best.height * 0.78;
        const dmg = damage * (head ? 1.45 : 1);
        const sc = best.applyDamage(dmg);
        score += sc;
        hits += 1;
        if (sc > 0) killed.push(best);
        const hp = origin.clone().addScaledVector(d, bestDist);
        this.spark(hp, true);
        this.impact(hp, d.clone().multiplyScalar(-1), true);
        this.tracer(origin, d, bestDist);
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
    const mat = new THREE.MeshBasicMaterial({ color: blood ? 0x8a2010 : 0xffd090, transparent: true, opacity: 0.95 });
    const m = new THREE.Mesh(new THREE.SphereGeometry(blood ? 0.07 : 0.055, 6, 5), mat);
    m.position.copy(p);
    this.scene.add(m);
    this.fx.push({ mesh: m, t: 0.22, max: 0.22, kind: 'spark' });
  }

  impact(point, normal, blood) {
    const n = (normal || new THREE.Vector3(0, 1, 0)).clone().normalize();
    const mat = new THREE.MeshBasicMaterial({
      color: blood ? 0x5a1210 : 0x2a2218,
      transparent: true,
      opacity: blood ? 0.72 : 0.62,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });
    const m = new THREE.Mesh(this.decalGeo, mat);
    m.scale.setScalar(blood ? 0.72 : 1);
    m.position.copy(point).addScaledVector(n, 0.014);
    m.lookAt(point.clone().add(n));
    this.scene.add(m);
    this.fx.push({ mesh: m, t: 7.5, max: 7.5, kind: 'decal' });
  }

  tracer(origin, dir, dist) {
    const len = Math.min(dist, 16);
    if (len < 0.4) return;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd090, transparent: true, opacity: 0.55, depthWrite: false });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, len), mat);
    m.position.copy(origin).addScaledVector(dir, len * 0.5);
    m.lookAt(origin.clone().add(dir));
    this.scene.add(m);
    this.fx.push({ mesh: m, t: 0.055, max: 0.055, kind: 'tracer' });
  }

  ejectCasing(origin, right, up) {
    const m = new THREE.Mesh(this.casingGeo, this.casingMat);
    m.position.copy(origin);
    m.castShadow = false;
    this.scene.add(m);
    const vel = right.clone().multiplyScalar(1.5 + Math.random() * 0.9)
      .add(up.clone().multiplyScalar(2.4 + Math.random() * 0.8))
      .add(new THREE.Vector3((Math.random() - 0.5) * 0.35, 0, (Math.random() - 0.5) * 0.3));
    this.fx.push({
      mesh: m, t: 1.5, max: 1.5, kind: 'casing', vel,
      spin: new THREE.Vector3(8 + Math.random() * 10, 4, 6 + Math.random() * 8)
    });
  }

  syncBars(camera, player) {
    for (const e of this.enemies) e.updateHealthBar(camera, player);
  }

  disposeEnemy(e) {
    this.scene.remove(e.root);
    if (e.hpBar) this.scene.remove(e.hpBar);
  }

  update(dt, player) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.justDied) {
        e.justDied = false;
        this.loot?.spawnFrom(e, player);
      }
      const gone = e.update(dt, player, this.world, this);
      e.updateHealthBar(player.camera, player);
      if (gone) {
        this.disposeEnemy(e);
        this.enemies.splice(i, 1);
      }
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t -= dt;
      if (f.kind === 'casing') {
        f.vel.y -= 16 * dt;
        f.mesh.position.addScaledVector(f.vel, dt);
        if (f.mesh.position.y < 0.015) {
          f.mesh.position.y = 0.015;
          f.vel.y *= -0.22;
          f.vel.x *= 0.55;
          f.vel.z *= 0.55;
        }
        f.mesh.rotation.x += f.spin.x * dt;
        f.mesh.rotation.z += f.spin.z * dt;
      } else if (f.kind === 'decal') {
        f.mesh.material.opacity = Math.max(0, Math.min(0.68, f.t * 0.35));
      } else if (f.kind === 'tracer') {
        f.mesh.material.opacity = Math.max(0, f.t / f.max * 0.55);
      } else {
        if (f.kind === 'boom') f.mesh.scale.setScalar(1 + (1 - f.t / f.max) * 6);
        if (f.mesh.material && f.mesh.material.opacity != null) {
          f.mesh.material.opacity = Math.max(0, f.t / f.max * (f.kind === 'ring' ? 0.42 : 0.88));
        }
      }
      if (f.t <= 0) { this.scene.remove(f.mesh); this.fx.splice(i, 1); }
    }
  }

  clearAll() {
    for (const e of this.enemies) this.disposeEnemy(e);
    this.enemies.length = 0;
    for (const f of this.fx) this.scene.remove(f.mesh);
    this.fx.length = 0;
    this.loot?.clear();
  }
}
