
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

export class Loadout {
  constructor(gunScene, camera, viewmodels) {
    this.camera = camera;
    this.scene = gunScene;
    this.root = new THREE.Group();
    this.view = new THREE.Group();
    this.root.add(this.view);
    gunScene.add(this.root);
    if (!viewmodels || !viewmodels.pistol) throw new Error('武器模型未加载');
    this.models = {};
    for (const id of Object.keys(WEAPON_DEFS)) {
      const m = viewmodels[id];
      if (!m) throw new Error('武器模型未加载：' + id);
      m.visible = false;
      this.view.add(m);
      this.models[id] = m;
    }
    this.nadeModel = viewmodels.grenade || null;
    if (this.nadeModel) {
      this.nadeModel.visible = false;
      this.view.add(this.nadeModel);
    }
    this.nadeFlash = 0;
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

  flashGrenade() { this.nadeFlash = 0.38; }

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
    this.wantAds = adsHeld && this.reloading <= 0 && this.nadeFlash <= 0;
    this.ads = THREE.MathUtils.damp(this.ads, this.wantAds ? 1 : 0, 10, dt);
    if (this.nadeFlash > 0) this.nadeFlash = Math.max(0, this.nadeFlash - dt);
    const showingNade = this.nadeFlash > 0 && this.nadeModel;
    for (const k of Object.keys(this.models)) this.models[k].visible = (!showingNade && k === this.current);
    if (this.nadeModel) this.nadeModel.visible = !!showingNade;
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
    const model = showingNade ? this.nadeModel : this.models[this.current];
    const hip = model.userData.hip || this.hip;
    const aim = model.userData.aim || this.aim;
    const target = new THREE.Vector3().lerpVectors(hip, aim, showingNade ? 0 : this.ads);
    this.view.position.set(target.x + bobX * (1 - this.ads), target.y + bobY * (1 - this.ads) - reloadDip - this.recoilP * 0.35, target.z + this.recoilP * 0.25);
    this.view.rotation.set(-this.recoilP * 1.4 - reloadDip * 0.8, this.recoilY, movingSpeed * 0.01);
    this.root.position.copy(this.camera.position);
    this.root.quaternion.copy(this.camera.quaternion);
    this.flash = Math.max(0, this.flash - dt);
    model.traverse((o) => {
      if (/Stock|Pad$|RiflePad|RifleStock|SMGStock|SMGPad|SGStock|SGPad/i.test(o.name)) {
        o.visible = this.ads < 0.55;
      }
    });
    const mzLocal = model.userData.muzzle || new THREE.Vector3();
    const mz = model.localToWorld(mzLocal.clone());
    this.view.worldToLocal(mz);
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
