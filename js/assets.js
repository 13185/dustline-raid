import * as THREE from '../vendor/three/three.module.js';
import { GLTFLoader } from '../vendor/three/GLTFLoader.js';

const VIEW_NAMES = {
  pistol: 'FP_Pistol',
  smg: 'FP_SMG',
  rifle: 'FP_Rifle',
  shotgun: 'FP_Shotgun',
  grenade: 'FP_Grenade'
};

const CHAR_NAMES = {
  rusher: 'Char_Rusher',
  rifle: 'Char_Rifle',
  shotgun: 'Char_Shotgun',
  grenadier: 'Char_Grenadier',
  midboss: 'Char_Midboss',
  finalboss: 'Char_Finalboss'
};

const HIP_AIM = {
  pistol: { hip: [0.165, -0.142, -0.28], aimZ: -0.14 },
  smg: { hip: [0.16, -0.138, -0.30], aimZ: -0.15 },
  rifle: { hip: [0.162, -0.148, -0.34], aimZ: -0.12 },
  shotgun: { hip: [0.155, -0.15, -0.32], aimZ: -0.18 },
  grenade: { hip: [0.14, -0.16, -0.26], aimZ: -0.22 }
};

function take(root, name) {
  const obj = root.getObjectByName(name);
  if (!obj) throw new Error('缺少模型：' + name);
  obj.removeFromParent();
  return obj;
}

function findPrefixed(model, base) {
  let found = null;
  model.traverse((o) => {
    if (found || !o.name) return;
    if (o.name === base || o.name.startsWith(base)) found = o;
  });
  return found;
}

function localOf(model, name) {
  const node = findPrefixed(model, name);
  if (!node) return null;
  model.updateMatrixWorld(true);
  const w = new THREE.Vector3();
  node.getWorldPosition(w);
  return model.worldToLocal(w);
}

function attachAnchors(model, id) {
  const cfg = HIP_AIM[id] || HIP_AIM.pistol;
  const mz = localOf(model, 'muzzle') || new THREE.Vector3(0, 0.03, -0.25);
  const sight = localOf(model, 'sight') || new THREE.Vector3(0, 0.05, 0);
  model.userData.fromGltf = true;
  model.userData.muzzle = mz;
  model.userData.sight = sight;
  model.userData.hip = new THREE.Vector3(cfg.hip[0], cfg.hip[1], cfg.hip[2]);
  model.userData.aim = new THREE.Vector3(-sight.x, -sight.y, cfg.aimZ - sight.z);
}

function loadOne(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      resolve,
      undefined,
      (err) => reject(new Error('无法加载 ' + url + '：' + (err && err.message ? err.message : err)))
    );
  });
}

export async function loadGameModels(onProgress) {
  const loader = new GLTFLoader();
  onProgress?.(0.15, '装箱械模型');
  const viewG = await loadOne(loader, './models/viewmodels.glb');
  onProgress?.(0.5, '装丧尸模型');
  const charG = await loadOne(loader, './models/characters.glb');
  onProgress?.(0.78, '装货栈道具');
  let propG = null;
  try {
    propG = await loadOne(loader, './models/props.glb');
  } catch (err) {
    console.warn(err);
  }

  const viewmodels = {};
  for (const [id, name] of Object.entries(VIEW_NAMES)) {
    const model = take(viewG.scene, name);
    attachAnchors(model, id);
    viewmodels[id] = model;
  }

  const characters = {};
  for (const [id, name] of Object.entries(CHAR_NAMES)) {
    const model = take(charG.scene, name);
    model.visible = false;
    model.userData.fromGltf = true;
    characters[id] = model;
  }

  const props = {};
  if (propG) {
    for (const name of ['Prop_Crate', 'Prop_Sandbag', 'Prop_Pallet']) {
      const obj = propG.scene.getObjectByName(name);
      if (obj) {
        obj.removeFromParent();
        props[name] = obj;
      }
    }
  }
  return { viewmodels, characters, props };
}

export function instantiateCharacter(type, catalog) {
  const src = catalog && catalog[type];
  if (!src) throw new Error('角色模型未加载：' + type);
  const root = src.clone(true);
  root.visible = true;
  const bodyMats = [];
  root.traverse((o) => {
    o.userData.skipHit = true;
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      const srcMats = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = srcMats.map((m) => {
        const c = m.clone();
        if (/Jacket|Pants|Vest|Knit|Skin|Coat|Cloth|Wound|Bile|Sand/i.test(c.name || o.name || '')) bodyMats.push(c);
        return c;
      });
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
    }
  });
  root.userData.bodyMats = bodyMats;
  root.userData.fromGltf = true;
  const findJoint = (suffix) => {
    let f = null;
    root.traverse((o) => { if (!f && o.name && o.name.endsWith(suffix)) f = o; });
    return f;
  };
  root.userData.joints = {
    hipL: findJoint('_JHipL'),
    hipR: findJoint('_JHipR'),
    kneeL: findJoint('_JKneeL'),
    kneeR: findJoint('_JKneeR'),
    shL: findJoint('_JShL'),
    shR: findJoint('_JShR'),
    spine: findJoint('_JSpine'),
    head: findJoint('_JHead')
  };
  root.userData.headTop = findJoint('_HeadTop');
  return root;
}

export function countTriangles(root) {
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    n += g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
  });
  return n;
}
