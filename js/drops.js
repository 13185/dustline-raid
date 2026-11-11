
import * as THREE from '../vendor/three/three.module.js';

export const MEDKIT_HEAL = 25;
export const PICKUP_RADIUS = 1.4;
export const LOOT_TTL = 25;
export const LOOT_BLINK = 4;
export const MAX_LOOT = 20;
export const MEDKIT_CHANCE = 0.18;
export const MEDKIT_LOW_CHANCE = 0.32;
export const AMMO_CHANCE = 0.25;

function markSkip(root) {
  root.traverse((o) => { o.userData.skipHit = true; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

function makeMedkit() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.52, metalness: 0.04, emissive: 0x221010, emissiveIntensity: 0.18 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc41818, roughness: 0.4, metalness: 0.08, emissive: 0x7a0808, emissiveIntensity: 0.45 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.24), white);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.16), red);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.07), red);
  crossV.position.y = 0.095;
  crossH.position.y = 0.095;
  g.add(box, crossV, crossH);
  markSkip(g);
  return g;
}

function makeAmmo() {
  const g = new THREE.Group();
  const olive = new THREE.MeshStandardMaterial({ color: 0x6a7c30, roughness: 0.55, metalness: 0.1, emissive: 0x3a4a12, emissiveIntensity: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a3216, roughness: 0.55, metalness: 0.18, emissive: 0x152008, emissiveIntensity: 0.2 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.22), olive);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.24), dark);
  lid.position.y = 0.085;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.17, 0.23), dark);
  g.add(box, lid, stripe);
  markSkip(g);
  return g;
}

export class LootField {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.items = [];
  }

  spawnFrom(enemy, player) {
    if (!enemy || !enemy.root) return;
    const isBoss = enemy.def && enemy.def.kind === 'boss';
    const low = player && player.maxHp > 0 && player.hp / player.maxHp < 0.4;
    const medP = isBoss ? 1 : (low ? MEDKIT_LOW_CHANCE : MEDKIT_CHANCE);
    const ammoP = isBoss ? 1 : AMMO_CHANCE;
    const x = enemy.root.position.x;
    const z = enemy.root.position.z;
    if (Math.random() < medP) this.spawn('medkit', x + (isBoss ? -0.38 : (Math.random() - 0.5) * 0.45), z + (isBoss ? 0.18 : (Math.random() - 0.5) * 0.45));
    if (Math.random() < ammoP) this.spawn('ammo', x + (isBoss ? 0.38 : (Math.random() - 0.5) * 0.45), z + (isBoss ? -0.16 : (Math.random() - 0.5) * 0.45));
  }

  spawn(kind, x, z) {
    if (kind !== 'medkit' && kind !== 'ammo') return null;
    while (this.items.length >= MAX_LOOT) this._remove(this.items[0]);
    const mesh = kind === 'medkit' ? makeMedkit() : makeAmmo();
    mesh.position.set(x, 0.14, z);
    mesh.scale.setScalar(1.55);
    this.scene.add(mesh);
    const item = { kind, mesh, age: 0, x, z };
    this.items.push(item);
    return item;
  }

  _remove(item) {
    if (!item) return;
    const i = this.items.indexOf(item);
    if (i < 0) return;
    this.scene.remove(item.mesh);
    this.items.splice(i, 1);
  }

  update(dt, player, loadout, hud) {
    const px = player.position.x, pz = player.position.z;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      const bob = 0.11 + Math.sin(it.age * 2.6) * 0.04;
      it.mesh.position.y = bob;
      it.mesh.rotation.y += dt * 1.35;
      if (it.age > LOOT_TTL - LOOT_BLINK) {
        it.mesh.visible = Math.sin(it.age * 22) > 0;
      } else {
        it.mesh.visible = true;
      }
      if (it.age >= LOOT_TTL) {
        this._remove(it);
        continue;
      }
      const dist = Math.hypot(it.x - px, it.z - pz);
      if (dist > PICKUP_RADIUS) continue;
      if (it.kind === 'medkit') {
        if (player.hp >= player.maxHp - 0.01) continue;
        const gained = player.heal(MEDKIT_HEAL);
        if (gained <= 0) continue;
        hud.toast(`+${Math.round(gained)} 生命`);
        hud.healPop(gained);
        this.audio.pickup(true);
        this._remove(it);
      } else {
        const added = loadout.addAmmoChunk();
        if (added <= 0) continue;
        hud.toast('+弹药');
        this.audio.pickup(false);
        this._remove(it);
      }
    }
  }

  clear() {
    while (this.items.length) this._remove(this.items[0]);
  }
}
