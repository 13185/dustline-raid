
import * as THREE from '../vendor/three/three.module.js';

export const WEAPON_DEFS = {
  pistol: {
    id: 'pistol', name: '锈鹰手枪',
    damage: 30, rpm: 300, mag: 12, reserve: 84, reload: 1.25,
    spread: 0.011, adsSpread: 0.0035, moveSpread: 0.018, recoil: 0.016,
    pellets: 1, automatic: false, adsFov: 52, kick: 0.034
  },
  smg: {
    id: 'smg', name: '沙暴冲锋枪',
    damage: 16, rpm: 780, mag: 30, reserve: 150, reload: 1.55,
    spread: 0.016, adsSpread: 0.007, moveSpread: 0.024, recoil: 0.011,
    pellets: 1, automatic: true, adsFov: 50, kick: 0.02
  },
  rifle: {
    id: 'rifle', name: '尘脊步枪',
    damage: 24, rpm: 620, mag: 30, reserve: 120, reload: 1.85,
    spread: 0.01, adsSpread: 0.0026, moveSpread: 0.02, recoil: 0.014,
    pellets: 1, automatic: true, adsFov: 42, kick: 0.026
  },
  shotgun: {
    id: 'shotgun', name: '巷口霰弹',
    damage: 12, rpm: 72, mag: 6, reserve: 36, reload: 2.4,
    spread: 0.055, adsSpread: 0.036, moveSpread: 0.03, recoil: 0.045,
    pellets: 8, automatic: false, adsFov: 54, kick: 0.07
  }
};

function mats() {
  return {
    metal: new THREE.MeshStandardMaterial({ color: 0x2c3034, metalness: 0.88, roughness: 0.32, envMapIntensity: 1.25 }),
    worn: new THREE.MeshStandardMaterial({ color: 0x3a342c, metalness: 0.72, roughness: 0.52, envMapIntensity: 1.0 }),
    slide: new THREE.MeshStandardMaterial({ color: 0x1c1e20, metalness: 0.9, roughness: 0.24, envMapIntensity: 1.35 }),
    polymer: new THREE.MeshStandardMaterial({ color: 0x1a1816, metalness: 0.08, roughness: 0.78, envMapIntensity: 0.4 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x3e2a1c, metalness: 0.06, roughness: 0.72, envMapIntensity: 0.3 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc2a24a, metalness: 0.92, roughness: 0.28, envMapIntensity: 1.3 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x142018, metalness: 0.2, roughness: 0.06, transparent: true, opacity: 0.45, envMapIntensity: 1.6 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x8a4a28, metalness: 0.35, roughness: 0.74 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x151617, metalness: 0.8, roughness: 0.4 }),
    tracer: new THREE.MeshBasicMaterial({ color: 0xffc878 })
  };
}

function part(parent, geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz);
  m.castShadow = false;
  parent.add(m);
  return m;
}

export function buildWeapons() {
  const M = mats();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 16);
  const tube = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
  const weapons = {};

  const pistol = new THREE.Group();
  part(pistol, box, M.slide, 0.00, 0.036, -0.01, 0.022, 0.030, 0.168);
  part(pistol, cyl, M.metal, 0.00, 0.034, -0.118, 0.007, 0.055, 0.007, Math.PI / 2, 0, 0);
  part(pistol, box, M.worn, 0.00, 0.014, 0.012, 0.020, 0.018, 0.125);
  part(pistol, box, M.polymer, 0.00, -0.048, 0.048, 0.020, 0.078, 0.032, 0.28, 0, 0);
  part(pistol, box, M.metal, 0.00, -0.006, -0.018, 0.016, 0.022, 0.042);
  part(pistol, box, M.metal, 0.00, -0.022, -0.042, 0.015, 0.007, 0.038);
  part(pistol, box, M.brass, 0.00, -0.014, -0.016, 0.005, 0.016, 0.009);
  part(pistol, box, M.worn, 0.00, -0.042, 0.046, 0.016, 0.042, 0.014);
  part(pistol, box, M.slide, 0.00, 0.056, -0.086, 0.005, 0.010, 0.010);
  part(pistol, box, M.slide, 0.00, 0.055, 0.068, 0.012, 0.012, 0.010);
  pistol.userData.muzzle = new THREE.Vector3(0, 0.034, -0.155);
  pistol.userData.hip = new THREE.Vector3(0.16, -0.145, -0.28);
  pistol.userData.aim = new THREE.Vector3(0.0, -0.052, -0.26);
  weapons.pistol = pistol;

  const smg = new THREE.Group();
  part(smg, box, M.worn, 0.00, 0.016, 0.01, 0.026, 0.034, 0.16);
  part(smg, box, M.slide, 0.00, 0.022, -0.12, 0.024, 0.026, 0.14);
  part(smg, cyl, M.metal, 0.00, 0.022, -0.24, 0.008, 0.13, 0.008, Math.PI / 2, 0, 0);
  part(smg, box, M.rail, 0.00, 0.042, -0.07, 0.016, 0.008, 0.16);
  for (let i = 0; i < 6; i++) part(smg, box, M.metal, 0, 0.048, -0.13 + i * 0.024, 0.014, 0.006, 0.008);
  part(smg, box, M.polymer, 0.00, -0.048, 0.05, 0.018, 0.078, 0.028, 0.26, 0, 0);
  part(smg, box, M.worn, 0.00, -0.062, -0.02, 0.016, 0.07, 0.022);
  part(smg, box, M.polymer, 0.00, 0.016, 0.14, 0.016, 0.022, 0.11);
  part(smg, box, M.polymer, 0.00, 0.032, 0.20, 0.014, 0.038, 0.016);
  part(smg, box, M.slide, 0.00, 0.066, -0.02, 0.022, 0.024, 0.042);
  part(smg, cyl, M.glass, 0.00, 0.066, -0.044, 0.009, 0.016, 0.009, Math.PI / 2, 0, 0);
  part(smg, box, M.brass, 0.00, 0.082, -0.02, 0.003, 0.003, 0.003);
  smg.userData.muzzle = new THREE.Vector3(0, 0.022, -0.31);
  smg.userData.hip = new THREE.Vector3(0.155, -0.14, -0.30);
  smg.userData.aim = new THREE.Vector3(0.0, -0.066, -0.25);
  weapons.smg = smg;

  const rifle = new THREE.Group();
  part(rifle, box, M.worn, 0.00, 0.012, 0.02, 0.026, 0.032, 0.20);
  part(rifle, box, M.rail, 0.00, 0.032, -0.10, 0.020, 0.012, 0.24);
  part(rifle, cyl, M.metal, 0.00, 0.014, -0.36, 0.007, 0.30, 0.007, Math.PI / 2, 0, 0);
  part(rifle, cyl, M.worn, 0.00, 0.014, -0.22, 0.012, 0.10, 0.012, Math.PI / 2, 0, 0);
  for (let i = 0; i < 7; i++) part(rifle, box, M.rail, 0, 0.042, -0.20 + i * 0.028, 0.016, 0.007, 0.010);
  part(rifle, box, M.polymer, 0.00, -0.052, 0.06, 0.018, 0.082, 0.028, 0.28, 0, 0);
  part(rifle, box, M.worn, 0.00, -0.07, -0.015, 0.016, 0.078, 0.022);
  part(rifle, box, M.polymer, 0.00, 0.008, 0.13, 0.018, 0.024, 0.08);
  part(rifle, box, M.polymer, 0.00, 0.014, 0.18, 0.016, 0.030, 0.022);
  part(rifle, tube, M.slide, 0.00, 0.072, -0.04, 0.016, 0.058, 0.016, Math.PI / 2, 0, 0);
  part(rifle, cyl, M.glass, 0.00, 0.072, -0.068, 0.014, 0.004, 0.014, Math.PI / 2, 0, 0);
  part(rifle, cyl, M.glass, 0.00, 0.072, -0.012, 0.014, 0.004, 0.014, Math.PI / 2, 0, 0);
  part(rifle, box, M.slide, 0.00, 0.052, -0.04, 0.010, 0.018, 0.016);
  part(rifle, box, M.brass, 0.00, 0.092, -0.04, 0.004, 0.004, 0.004);
  rifle.userData.muzzle = new THREE.Vector3(0, 0.014, -0.52);
  rifle.userData.hip = new THREE.Vector3(0.16, -0.15, -0.32);
  rifle.userData.aim = new THREE.Vector3(0.0, -0.072, -0.24);
  weapons.rifle = rifle;

  const shotgun = new THREE.Group();
  part(shotgun, cyl, M.metal, 0.00, 0.032, -0.20, 0.010, 0.38, 0.010, Math.PI / 2, 0, 0);
  part(shotgun, cyl, M.worn, 0.00, 0.008, -0.14, 0.008, 0.26, 0.008, Math.PI / 2, 0, 0);
  part(shotgun, box, M.polymer, 0.00, 0.004, 0.04, 0.026, 0.034, 0.12);
  part(shotgun, box, M.polymer, 0.00, -0.012, 0.14, 0.022, 0.040, 0.10, 0.12, 0, 0);
  part(shotgun, box, M.polymer, 0.00, 0.012, 0.20, 0.020, 0.034, 0.028);
  part(shotgun, box, M.worn, 0.00, 0.014, -0.06, 0.030, 0.028, 0.08);
  part(shotgun, box, M.polymer, 0.00, -0.046, 0.07, 0.018, 0.07, 0.024, 0.2, 0, 0);
  for (let i = 0; i < 5; i++) part(shotgun, box, M.rust, 0, 0.048, -0.26 + i * 0.036, 0.02, 0.006, 0.024);
  part(shotgun, box, M.slide, 0.00, 0.048, -0.36, 0.006, 0.01, 0.01);
  shotgun.userData.muzzle = new THREE.Vector3(0, 0.032, -0.40);
  shotgun.userData.hip = new THREE.Vector3(0.15, -0.15, -0.30);
  shotgun.userData.aim = new THREE.Vector3(0.0, -0.048, -0.26);
  weapons.shotgun = shotgun;

  return { weapons, mats: M };
}

export class Loadout {
  constructor(gunScene, camera) {
    this.camera = camera;
    this.scene = gunScene;
    this.root = new THREE.Group();
    this.view = new THREE.Group();
    this.root.add(this.view);
    gunScene.add(this.root);
    const built = buildWeapons();
    this.models = built.weapons;
    this.mats = built.mats;
    for (const k of Object.keys(this.models)) {
      this.models[k].visible = false;
      this.view.add(this.models[k]);
    }
    this.owned = ['pistol'];
    this.current = 'pistol';
    this.models.pistol.visible = true;
    this.state = {};
    for (const id of Object.keys(WEAPON_DEFS)) {
      const d = WEAPON_DEFS[id];
      this.state[id] = { mag: d.mag, reserve: d.reserve };
    }
    this.reloading = 0;
    this.cooldown = 0;
    this.ads = 0;
    this.wantAds = false;
    this.recoilP = 0;
    this.recoilY = 0;
    this.spreadExtra = 0;
    this.bob = 0;
    this.flash = 0;
    this.muzzleLight = new THREE.PointLight(0xffc070, 0, 4, 2);
    this.view.add(this.muzzleLight);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0, depthWrite: false });
    this.flashMesh = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 8), flashMat);
    this.flashMesh.rotation.x = -Math.PI / 2;
    this.view.add(this.flashMesh);
    this.hip = new THREE.Vector3(0.16, -0.145, -0.30);
    this.aim = new THREE.Vector3(0.0, -0.06, -0.26);
    this.grenades = 0;
  }

  def() { return WEAPON_DEFS[this.current]; }
  ammo() { return this.state[this.current]; }

  unlock(id) {
    if (!this.owned.includes(id) && WEAPON_DEFS[id]) this.owned.push(id);
  }

  select(id) {
    if (!this.owned.includes(id) || this.reloading > 0) return false;
    if (id === this.current) return false;
    this.current = id;
    for (const k of Object.keys(this.models)) this.models[k].visible = k === id;
    return true;
  }

  cycle(dir) {
    const i = this.owned.indexOf(this.current);
    const n = this.owned[(i + dir + this.owned.length) % this.owned.length];
    this.select(n);
  }

  startReload() {
    const a = this.ammo(); const d = this.def();
    if (this.reloading > 0 || a.mag >= d.mag || a.reserve <= 0) return false;
    this.reloading = d.reload;
    return true;
  }

  finishReload() {
    const a = this.ammo(); const d = this.def();
    const need = d.mag - a.mag;
    const take = Math.min(need, a.reserve);
    a.mag += take; a.reserve -= take;
  }

  canFire() { return this.reloading <= 0 && this.cooldown <= 0 && this.ammo().mag > 0; }

  fire() {
    if (!this.canFire()) {
      if (this.ammo().mag <= 0) return this.startReload() ? 'reload' : 'empty';
      return null;
    }
    const d = this.def();
    this.ammo().mag -= 1;
    this.cooldown = 60 / d.rpm;
    this.recoilP += d.kick;
    this.recoilY += (Math.random() - 0.5) * d.kick * 0.45;
    this.spreadExtra = Math.min(0.045, this.spreadExtra + d.recoil);
    this.flash = 0.045;
    return 'shot';
  }

  currentSpread(moving) {
    const d = this.def();
    const base = THREE.MathUtils.lerp(d.spread, d.adsSpread, this.ads);
    return base + (moving ? d.moveSpread * (1 - this.ads * 0.6) : 0) + this.spreadExtra;
  }

  update(dt, movingSpeed, adsHeld) {
    this.wantAds = adsHeld && this.reloading <= 0;
    this.ads = THREE.MathUtils.damp(this.ads, this.wantAds ? 1 : 0, 10, dt);
    for (const k of Object.keys(this.models)) this.models[k].visible = (k === this.current);
    this.flashMesh.visible = this.flash > 0;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { this.reloading = 0; this.finishReload(); }
    }
    this.recoilP = THREE.MathUtils.damp(this.recoilP, 0, 8, dt);
    this.recoilY = THREE.MathUtils.damp(this.recoilY, 0, 8, dt);
    this.spreadExtra = THREE.MathUtils.damp(this.spreadExtra, 0, 4, dt);
    this.bob += dt * (2.5 + movingSpeed * 6);
    const bobX = Math.sin(this.bob) * 0.008 * Math.min(1, movingSpeed);
    const bobY = Math.abs(Math.cos(this.bob * 2)) * 0.006 * Math.min(1, movingSpeed);
    const reloadDip = this.reloading > 0 ? Math.sin((1 - this.reloading / this.def().reload) * Math.PI) * 0.12 : 0;
    const model = this.models[this.current];
    const hip = model.userData.hip || this.hip;
    const aim = model.userData.aim || this.aim;
    const target = new THREE.Vector3().lerpVectors(hip, aim, this.ads);
    this.view.position.set(target.x + bobX * (1 - this.ads), target.y + bobY * (1 - this.ads) - reloadDip - this.recoilP * 0.35, target.z + this.recoilP * 0.25);
    this.view.rotation.set(-this.recoilP * 1.4 - reloadDip * 0.8, this.recoilY, movingSpeed * 0.01);
    this.root.position.copy(this.camera.position);
    this.root.quaternion.copy(this.camera.quaternion);
    this.flash = Math.max(0, this.flash - dt);
    const mz = this.models[this.current].userData.muzzle;
    this.muzzleLight.position.copy(mz);
    this.muzzleLight.intensity = this.flash > 0 ? 6 : 0;
    this.flashMesh.position.set(mz.x, mz.y, mz.z - 0.02);
    this.flashMesh.material.opacity = this.flash > 0 ? 0.9 : 0;
  }

  refill() {
    for (const id of Object.keys(WEAPON_DEFS)) {
      const d = WEAPON_DEFS[id];
      this.state[id].mag = d.mag;
      this.state[id].reserve = d.reserve;
    }
  }
}
