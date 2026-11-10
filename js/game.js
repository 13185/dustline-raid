
import * as THREE from '../vendor/three/three.module.js';
import { generateTextures } from './textures.js';
import { PostFX } from './postfx.js';
import { AudioBus } from './audio.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Loadout, WEAPON_DEFS } from './weapons.js';
import { Combat } from './enemies.js';
import { Player } from './player.js';
import { WaveDirector, WAVES } from './waves.js';
import { HUD } from './hud.js';

function $(id) { return document.getElementById(id); }

export function pickQuality(pref) {
  if (pref && pref !== 'auto') return pref;
  const glc = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
  const info = glc && glc.getExtension('WEBGL_debug_renderer_info');
  const gpu = info ? glc.getParameter(info.UNMASKED_RENDERER_WEBGL) : '';
  const low = /intel|mali|adreno 3|apple gpu/i.test(gpu) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  const mobile = matchMedia('(pointer: coarse)').matches && innerWidth < 900;
  if (mobile || low) return 'medium';
  return 'high';
}

export class Game {
  constructor(canvas, quality) {
    this.canvas = canvas;
    this.quality = quality;
    this.mode = 'boot';
    this.clock = new THREE.Clock();
    this.audio = new AudioBus();
    this.input = new Input(canvas);
    this.hud = new HUD();
    this.stats = this._freshStats();
    this._shotMode = new URLSearchParams(location.search).get('shot');
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: quality === 'high', powerPreference: 'high-performance', alpha: false
    });
    const cap = quality === 'high' ? 1.75 : quality === 'medium' ? 1.25 : 1;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, cap));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0xc49a62);
    this.scene = new THREE.Scene();
    this.gunScene = new THREE.Scene();
    const gunKey = new THREE.DirectionalLight(0xffecd0, 2.1);
    gunKey.position.set(0.4, 0.95, 0.55);
    this.gunScene.add(gunKey);
    const gunRim = new THREE.DirectionalLight(0xffd2a8, 0.42);
    gunRim.position.set(-0.85, 0.25, -0.45);
    this.gunScene.add(gunRim);
    const gunFill = new THREE.PointLight(0x9ab4d0, 0.55, 5);
    gunFill.position.set(-0.28, 0.12, 0.35);
    this.gunScene.add(gunFill);
    this.gunScene.add(new THREE.AmbientLight(0x2c241c, 0.4));
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 220);
    this.baseFov = 72;
    this.titleT = 0;
    this._bindUI();
  }

  _freshStats() {
    return { score: 0, kills: 0, shots: 0, hits: 0, deaths: 0, startedAt: 0, waveReached: 1 };
  }

  async boot(onProgress) {
    onProgress(0.05, '扬起沙尘');
    const texSize = this.quality === 'low' ? 256 : this.quality === 'high' ? 512 : 384;
    this.textures = await generateTextures(texSize, (p, name) => onProgress(0.08 + p * 0.7, '绘制地表 · ' + name));
    onProgress(0.82, '搭建货栈');
    this.world = new World(this.scene, this.renderer, this.textures, this.quality);
    this.gunScene.environment = this.scene.environment;
    this.player = new Player(this.camera, this.world, this.input);
    this.loadout = new Loadout(this.gunScene, this.camera);
    this.combat = new Combat(this.scene, this.world, this.audio);
    this.waves = new WaveDirector(this.combat, this.world);
    this.fx = new PostFX(this.renderer, { quality: this.quality });
    onProgress(0.95, '校正准星');
    addEventListener('resize', () => this._resize());
    this.input.onWheel = (d) => { if (this.mode === 'play') this.loadout.cycle(d > 0 ? 1 : -1); };
    this.input.onTouchAct = (act, down) => this._touch(act, down);
    addEventListener('keydown', (e) => this._keydown(e));
    this.mode = 'title';
    this._show('title');
    if (this.input.isTouch) this.input.showTouch(true);
    onProgress(1, '就绪');
    this._expose();
    this._applyShot();
    this.loop();
  }

  _resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.fx.setSize(innerWidth, innerHeight);
  }

  _bindUI() {
    $('btnStart').onclick = () => { this.audio.ui(); this.startRun(); };
    $('btnResume').onclick = () => this.resume();
    $('btnToTitle').onclick = () => this.toTitle();
    $('btnRetry').onclick = () => this.retryWave();
    $('btnDeadTitle').onclick = () => this.toTitle();
    $('btnAgain').onclick = () => this.startRun();
    $('btnResTitle').onclick = () => this.toTitle();
    const syncMute = (v) => {
      this.audio.setMute(v);
      $('chkMute').checked = v;
      $('chkMute2').checked = v;
    };
    $('chkMute').onchange = () => syncMute($('chkMute').checked);
    $('chkMute2').onchange = () => syncMute($('chkMute2').checked);
    const applyQ = (v) => {
      this.setQuality(v);
      $('selQuality').value = v;
      $('selQuality2').value = v;
    };
    $('selQuality').onchange = () => applyQ($('selQuality').value);
    $('selQuality2').onchange = () => applyQ($('selQuality2').value);
  }

  setQuality(q) {
    if (q === 'auto') q = pickQuality('auto');
    this.quality = q;
    this.fx.applyQuality(q);
    const cap = q === 'high' ? 1.75 : q === 'medium' ? 1.25 : 1;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, cap));
    this.renderer.shadowMap.enabled = q !== 'low';
    this._resize();
  }

  _show(which) {
    for (const id of ['boot', 'title', 'upgrade', 'pause', 'dead', 'results']) {
      $(id).classList.toggle('hidden', id !== which);
    }
    this.hud.show(which === null);
  }

  startRun() {
    this.audio.resume();
    this.stats = this._freshStats();
    this.stats.startedAt = performance.now();
    this.player.maxHp = 100;
    this.player.armor = 0;
    this.player.dmgMul = 1;
    this.player.rpmMul = 1;
    this.player.reset(true);
    this.loadout.owned = ['pistol'];
    this.loadout.select('pistol');
    this.loadout.refill();
    this.loadout.grenades = 0;
    this.combat.clearAll();
    this.waves.index = 0;
    this._enterPlay();
    this._beginWave();
  }

  _enterPlay() {
    this.mode = 'play';
    this._show(null);
    this.hud.show(true);
    if (this.input.isTouch) this.input.showTouch(true);
    else this.input.requestLock();
    this.canvas.focus?.();
  }

  _beginWave() {
    const w = this.waves.current();
    if (!w) { this.showResults(true); return; }
    this.waves.begin(this.player);
    this.stats.waveReached = w.id;
    const boss = w.boss === 'midboss' ? '中场头目 · 铁罩督战' : w.boss === 'finalboss' ? '最终头目 · 砂喉重甲' : null;
    this.hud.banner(boss || `第 ${w.id} 波  ${w.name}`, !!boss);
    if (boss) this.audio.boss();
    this.objective = boss ? `击败${boss.split(' · ')[1]}` : `清剿本波敌军`;
  }

  _keydown(e) {
    if (this.mode === 'play') {
      if (e.code === 'Escape') { this.pause(); return; }
      if (e.code === 'KeyR') { if (this.loadout.startReload()) this.audio.reload(); }
      if (e.code === 'KeyG') this._throwNade();
      if (e.code === 'Digit1') this.loadout.select(this.loadout.owned[0]);
      if (e.code === 'Digit2') this.loadout.select(this.loadout.owned[1]);
      if (e.code === 'Digit3') this.loadout.select(this.loadout.owned[2]);
      if (e.code === 'Digit4') this.loadout.select(this.loadout.owned[3]);
    } else if (this.mode === 'pause' && e.code === 'Escape') this.resume();
  }

  _touch(act, down) {
    if (act === 'reload' && down && this.loadout.startReload()) this.audio.reload();
    if (act === 'jump') this.input.keys.Space = down;
    if (act === 'swap' && down) this.loadout.cycle(1);
  }

  pause() {
    if (this.mode !== 'play') return;
    this.mode = 'pause';
    this.input.exitLock();
    this._show('pause');
    $('selQuality2').value = this.quality;
  }

  resume() {
    if (this.mode !== 'pause') return;
    this._enterPlay();
  }

  toTitle() {
    this.mode = 'title';
    this.combat.clearAll();
    this.input.exitLock();
    this.input.showTouch(this.input.isTouch);
    this._show('title');
    this.hud.show(false);
  }

  retryWave() {
    this.player.reset(false);
    this.player.heal(999);
    this.loadout.refill();
    this.waves.retry();
    this._enterPlay();
    const w = this.waves.current();
    this.hud.banner(`重试第 ${w.id} 波`);
  }

  _throwNade() {
    if (this.loadout.grenades <= 0 || this.mode !== 'play') return;
    this.loadout.grenades -= 1;
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.combat.playerGrenade(origin, dir, this.player);
    this.hud.toast('手雷已投出');
  }

  applyReward(id) {
    const L = this.loadout, P = this.player;
    if (id === 'gun_smg') { L.unlock('smg'); L.select('smg'); }
    if (id === 'gun_rifle') { L.unlock('rifle'); L.select('rifle'); }
    if (id === 'gun_shotgun') { L.unlock('shotgun'); L.select('shotgun'); }
    if (id === 'heal') { P.maxHp += 20; P.heal(50); }
    if (id === 'ammo') {
      L.refill();
      for (const k of Object.keys(L.state)) L.state[k].reserve += 40;
    }
    if (id === 'nades') L.grenades += 3;
    if (id === 'other_gun') {
      if (!L.owned.includes('rifle')) { L.unlock('rifle'); L.select('rifle'); }
      else if (!L.owned.includes('shotgun')) { L.unlock('shotgun'); L.select('shotgun'); }
      L.grenades += 2;
    }
    if (id === 'vest') { P.armor = Math.max(P.armor, 0.25); P.heal(999); }
    if (id === 'dmg') P.dmgMul += 0.22;
    if (id === 'rpm') P.rpmMul += 0.2;
    if (id === 'fullkit') {
      P.heal(999);
      L.refill();
      L.grenades = Math.max(L.grenades, 3);
      P.armor = Math.min(0.45, P.armor + 0.1);
    }
    this.hud.toast('补给已装备');
  }

  openUpgrade(wave) {
    if (!wave.reward) { this._advance(); return; }
    this.mode = 'upgrade';
    this.input.exitLock();
    this._show('upgrade');
    $('upTitle').textContent = `第 ${wave.id} 波完成 — ${wave.reward.title}`;
    $('upSub').textContent = wave.name + ' 已肃清。下一波会更密。';
    const box = $('upCards');
    box.innerHTML = '';
    wave.reward.items.forEach((it) => {
      const el = document.createElement('button');
      el.className = 'card';
      el.innerHTML = `<h3>${it.name}</h3><p>${it.desc}</p>`;
      el.onclick = () => {
        this.audio.ui();
        this.applyReward(it.id);
        this._advance();
      };
      box.appendChild(el);
    });
  }

  _advance() {
    const more = this.waves.next();
    if (!more) { this.showResults(true); return; }
    this._enterPlay();
    this._beginWave();
  }

  showResults(won) {
    this.mode = 'results';
    this.input.exitLock();
    this._show('results');
    this.hud.show(false);
    const t = (performance.now() - this.stats.startedAt) / 1000;
    const acc = this.stats.shots ? (this.stats.hits / this.stats.shots) : 0;
    let grade = 'C';
    if (won && this.stats.deaths === 0 && acc >= 0.28) grade = 'S';
    else if (won && this.stats.deaths <= 1) grade = 'A';
    else if (won) grade = 'B';
    else grade = 'D';
    $('resGrade').textContent = grade;
    $('resStats').innerHTML = [
      ['结果', won ? '货栈夺回' : '突击中断'],
      ['用时', `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`],
      ['波次', `${this.stats.waveReached} / 8`],
      ['击杀', this.stats.kills],
      ['分数', this.stats.score],
      ['命中率', `${Math.round(acc * 100)}%`],
      ['倒下次数', this.stats.deaths]
    ].map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('');
  }

  _tryFire() {
    const r = this.loadout.fire();
    if (r === 'reload') { this.audio.reload(); return; }
    if (r !== 'shot') return;
    this.loadout.cooldown /= this.player.rpmMul;
    const d = this.loadout.def();
    this.audio.gun(d.id);
    this.stats.shots += d.pellets;
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    this.camera.getWorldDirection(dir);
    const hs = this.combat.hitscan(origin, dir, this.loadout.currentSpread(this._moving > 1.4), d.pellets, d.damage * this.player.dmgMul);
    this.stats.hits += hs.hits;
    this.stats.score += hs.score;
    this.stats.kills += hs.killed.length;
    if (hs.hits) { this.hud.hitmarker(); this.audio.hit(); }
  }

  loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.world.update(dt);
    if (this.mode === 'title' || this._shotMode === 'yard' || this._shotMode === 'title') {
      this._titleCam(dt);
    } else if (this.mode === 'play') {
      this._play(dt);
    } else if (this.mode === 'upgrade' || this.mode === 'pause' || this.mode === 'dead' || this.mode === 'results') {
      this.loadout.update(dt, 0, false);
    }
    this.fx.updateSun(this.camera, this.world.sunDir);
    const showGun = this.mode === 'play' || this.mode === 'pause' || this._shotMode === 'gun' || this._shotMode === 'ads';
    this.fx.render(this.scene, this.camera, showGun ? this.gunScene : null);
  };

  _titleCam(dt) {
    this.titleT += dt;
    const t = this.titleT * 0.14;
    this.camera.position.set(7.8 + Math.sin(t) * 3.2, 2.85 + Math.sin(t * 0.65) * 0.2, 11.6 + Math.cos(t) * 2.4);
    this.camera.lookAt(-1.2, 1.35, -7.5);
    this.camera.fov = 58;
    this.camera.updateProjectionMatrix();
  }

  _play(dt) {
    this.camera.fov = THREE.MathUtils.lerp(this.baseFov, this.loadout.def().adsFov, this.loadout.ads);
    this.camera.updateProjectionMatrix();
    const st = this.player.update(dt);
    this._moving = st.moving || 0;
    if (st.foot) this.audio.foot();
    this.loadout.update(dt, (st.moving || 0) / 5.2, this.input.adsHeld || !!this.input.keys.MouseRight);
    if (this.input.fireHeld) this._tryFire();
    this.combat.update(dt, this.player);
    const cleared = this.waves.update(dt, this.player);
    if (!this.player.alive) {
      this.stats.deaths += 1;
      this.mode = 'dead';
      this.input.exitLock();
      this._show('dead');
      this.audio.hurt();
      return;
    }
    if (this.player.hurtFlash > 0 && Math.random() < 0.05) this.audio.hurt();
    if (cleared === 'cleared') {
      const w = this.waves.current();
      this.player.heal(18);
      if (w.id === 8) this.showResults(true);
      else this.openUpgrade(w);
    }
    const living = this.combat.living().length;
    const left = living + this.waves.remainingToSpawn();
    this.hud.update(dt, {
      wave: this.waves.current()?.id || 8,
      obj: left ? `${this.objective}（剩余 ${left}）` : this.objective,
      kills: this.stats.kills,
      score: this.stats.score,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      weapon: this.loadout.def().name,
      ammo: this.loadout.ammo().mag,
      reserve: this.loadout.ammo().reserve,
      nades: this.loadout.grenades,
      hurt: this.player.hurtFlash,
      spread: this.loadout.currentSpread(this._moving > 1.4)
    });
  }

  _applyShot() {
    const s = this._shotMode;
    if (!s) return;
    document.getElementById('boot').classList.add('hidden');
    if (s === 'title' || s === 'yard') {
      this.mode = 'title';
      this._show(s === 'title' ? 'title' : 'idlehide');
      if (s === 'yard') {
        this._show(null);
        this.hud.show(false);
        ['title', 'boot', 'upgrade', 'pause', 'dead', 'results'].forEach((id) => $(id).classList.add('hidden'));
      }
    }
    if (s === 'gun' || s === 'ads' || s === 'wave' || s === 'boss' || s === 'upgrade') {
      this.startRun();
      this.player.position.set(2.2, 0, 8.5);
      this.player.yaw = -0.15;
      this.player.pitch = -0.04;
      if (s === 'ads' || s === 'gun') {
        this.loadout.unlock('rifle'); this.loadout.select(s === 'ads' ? 'rifle' : 'pistol');
        if (s === 'ads') { this.input.adsHeld = true; this.loadout.ads = 1; }
      }
      if (s === 'wave') {
        this.combat.clearAll();
        this.waves.queue = [];
        this.waves.doneSpawning = false;
        [['rusher', -2, 2], ['rifle', 2.4, 0.6], ['shotgun', -0.4, -3.2], ['grenadier', 4.5, -5]].forEach(([t, x, z]) => this.combat.spawn(t, x, z));
      }
      if (s === 'boss') {
        this.combat.clearAll();
        this.waves.queue = [];
        this.combat.spawn('midboss', 0.6, -2.2);
        this.combat.spawn('rusher', -3, -1);
        this.hud.banner('中场头目 · 铁罩督战', true);
      }
      if (s === 'upgrade') {
        this.openUpgrade(WAVES[2]);
      }
    }
    setTimeout(() => { window.__dustline.shotReady = true; }, 400);
  }

  _expose() {
    const self = this;
    window.__dustline = {
      ready: true,
      shotReady: !this._shotMode,
      state: () => ({
        mode: self.mode,
        hp: self.player.hp,
        wave: self.waves.current()?.id || 0,
        score: self.stats.score,
        kills: self.stats.kills,
        weapon: self.loadout.current,
        owned: self.loadout.owned.slice(),
        ammo: self.loadout.ammo().mag,
        living: self.combat.living().length,
        pos: { x: self.player.position.x, z: self.player.position.z }
      }),
      start: () => self.startRun(),
      spawnEnemy: (type, x, z) => self.combat.spawn(type || 'rusher', x ?? 0, z ?? 6),
      forceUpgrade: (id) => self.applyReward(id || 'gun_smg'),
      setWave: (n) => { self.waves.index = Math.max(0, n - 1); self.combat.clearAll(); self._beginWave(); },
      killNearest: () => {
        const e = self.combat.living()[0];
        if (!e) return 0;
        return e.applyDamage(9999);
      },
      god: () => { self.player.invuln = 9999; }
    };
  }
}
