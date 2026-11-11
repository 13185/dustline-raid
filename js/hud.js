
export class HUD {
  constructor() {
    this.els = {
      wave: document.getElementById('hudWave'),
      obj: document.getElementById('hudObj'),
      kills: document.getElementById('hudKills'),
      score: document.getElementById('hudScore'),
      hp: document.getElementById('hudHp'),
      hpMax: document.getElementById('hudHpMax'),
      hpFill: document.getElementById('hpFill'),
      weapon: document.getElementById('hudWeapon'),
      ammo: document.getElementById('hudAmmo'),
      reserve: document.getElementById('hudReserve'),
      banner: document.getElementById('waveBanner'),
      toast: document.getElementById('pickupToast'),
      hit: document.getElementById('hitmarker'),
      hurt: document.getElementById('hurt'),
      cross: document.getElementById('crosshair'),
      lowHp: document.getElementById('lowHpWarn'),
      healPop: document.getElementById('healPop'),
      hpBox: document.querySelector('.hpbox'),
      bossBar: document.getElementById('bossBar'),
      bossName: document.getElementById('bossName'),
      bossFill: document.getElementById('bossFill'),
      bossHp: document.getElementById('bossHpText'),
      reloadHint: document.getElementById('reloadHint'),
      reloadBar: document.getElementById('reloadBar'),
      reloadFill: document.getElementById('reloadFill'),
      lowAmmo: document.getElementById('lowAmmoHint'),
      weapBox: document.querySelector('.weapbox')
    };
    this.bannerT = 0;
    this.toastT = 0;
    this.hitT = 0;
    this.healPopT = 0;
  }

  show(v) { document.getElementById('hud').classList.toggle('hidden', !v); }

  banner(text, boss = false) {
    const el = this.els.banner;
    el.textContent = text;
    el.classList.add('show');
    el.classList.toggle('boss', boss);
    this.bannerT = 2.4;
  }

  toast(text) {
    this.els.toast.textContent = text;
    this.els.toast.classList.add('show');
    this.toastT = 2.2;
  }

  hitmarker() {
    this.els.hit.classList.add('on');
    this.hitT = 0.12;
  }

  healPop(n) {
    if (!this.els.healPop || !(n > 0)) return;
    this.els.healPop.textContent = `+${Math.round(n)} 生命`;
    this.els.healPop.classList.add('show');
    this.healPopT = 1.15;
  }

  update(dt, info) {
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.els.banner.classList.remove('show');
    }
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.els.toast.classList.remove('show');
    }
    if (this.hitT > 0) {
      this.hitT -= dt;
      if (this.hitT <= 0) this.els.hit.classList.remove('on');
    }
    if (this.healPopT > 0) {
      this.healPopT -= dt;
      if (this.healPopT <= 0) this.els.healPop?.classList.remove('show');
    }
    if (!info) return;
    this.els.wave.textContent = `${info.wave} / 8`;
    this.els.obj.textContent = info.obj;
    this.els.kills.textContent = String(info.kills);
    this.els.score.textContent = String(info.score);
    const hp = Math.max(0, info.hp);
    const maxHp = Math.max(1, info.maxHp);
    const pct = hp / maxHp;
    this.els.hp.textContent = String(Math.ceil(hp));
    this.els.hpMax.textContent = '/ ' + maxHp;
    this.els.hpFill.style.width = `${Math.max(0, pct * 100)}%`;
    if (this.els.hpBox) {
      this.els.hpBox.classList.toggle('hp-ok', pct >= 0.55);
      this.els.hpBox.classList.toggle('hp-mid', pct >= 0.3 && pct < 0.55);
      this.els.hpBox.classList.toggle('hp-low', pct < 0.3);
    }
    if (this.els.lowHp) this.els.lowHp.classList.toggle('show', pct < 0.3 && hp > 0);
    const flash = Math.max(0, info.hurt || 0) / 0.45;
    const lowPulse = (pct < 0.3 && hp > 0)
      ? 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(performance.now() * 0.008))
      : 0;
    this.els.hurt.style.opacity = String(Math.min(0.92, Math.max(flash * 0.9, lowPulse)));
    if (info.boss && info.boss.hp > 0 && this.els.bossBar) {
      this.els.bossBar.classList.remove('hidden');
      this.els.bossName.textContent = info.boss.name;
      this.els.bossFill.style.width = `${Math.max(0, info.boss.hp / info.boss.maxHp * 100)}%`;
      this.els.bossHp.textContent = `${Math.ceil(info.boss.hp)} / ${info.boss.maxHp}`;
    } else if (this.els.bossBar) {
      this.els.bossBar.classList.add('hidden');
    }
    this.els.weapon.textContent = info.weapon;
    this.els.ammo.textContent = String(info.ammo);
    this.els.reserve.textContent = '/ ' + info.reserve + (info.nades ? `  ·  雷 ${info.nades}` : '');
    const reloading = !!info.reloading;
    if (this.els.reloadBar) {
      this.els.reloadBar.classList.toggle('hidden', !reloading);
      if (this.els.reloadFill) this.els.reloadFill.style.width = `${Math.round((info.reloadProgress || 0) * 100)}%`;
    }
    if (this.els.reloadHint) {
      let hint = '';
      if (!reloading && info.ammo === 0 && info.reserve > 0) hint = '按 R 换弹';
      else if (!reloading && info.ammo === 0 && info.reserve <= 0) hint = '弹药耗尽';
      this.els.reloadHint.textContent = hint;
      this.els.reloadHint.classList.toggle('show', !!hint);
    }
    if (this.els.weapBox) this.els.weapBox.classList.toggle('low-ammo-on', !!info.lowAmmo && !reloading);
    const spread = 7 + info.spread * 520;
    const ch = this.els.cross.querySelectorAll('.ch');
    ch[0].style.right = spread + 'px';
    ch[1].style.left = spread + 'px';
    ch[2].style.bottom = spread + 'px';
    ch[3].style.top = spread + 'px';
    this.els.cross.style.opacity = (info.ads || 0) > 0.62 ? '0.15' : '1';
  }
}
