
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
      cross: document.getElementById('crosshair')
    };
    this.bannerT = 0;
    this.toastT = 0;
    this.hitT = 0;
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
    if (!info) return;
    this.els.wave.textContent = `${info.wave} / 8`;
    this.els.obj.textContent = info.obj;
    this.els.kills.textContent = String(info.kills);
    this.els.score.textContent = String(info.score);
    this.els.hp.textContent = String(Math.ceil(info.hp));
    this.els.hpMax.textContent = '/ ' + info.maxHp;
    this.els.hpFill.style.width = `${Math.max(0, info.hp / info.maxHp * 100)}%`;
    this.els.weapon.textContent = info.weapon;
    this.els.ammo.textContent = String(info.ammo);
    this.els.reserve.textContent = '/ ' + info.reserve + (info.nades ? `  ·  雷 ${info.nades}` : '');
    this.els.hurt.style.opacity = String(Math.max(0, info.hurt));
    const spread = 7 + info.spread * 520;
    const ch = this.els.cross.querySelectorAll('.ch');
    ch[0].style.right = spread + 'px';
    ch[1].style.left = spread + 'px';
    ch[2].style.bottom = spread + 'px';
    ch[3].style.top = spread + 'px';
  }
}
