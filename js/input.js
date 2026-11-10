
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.look = { x: 0, y: 0 };
    this.fireHeld = false;
    this.adsHeld = false;
    this.locked = false;
    this.sensitivity = 0.0022;
    this.touchMove = { x: 0, y: 0 };
    this.touchLook = { x: 0, y: 0 };
    this.isTouch = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0 || innerWidth <= 820;
    this._bind();
  }

  _bind() {
    addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.fireHeld = true;
      if (e.button === 2) this.adsHeld = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fireHeld = false;
      if (e.button === 2) this.adsHeld = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.look.x += e.movementX;
        this.look.y += e.movementY;
      } else if (e.buttons === 1 && !this.isTouch) {
        this.look.x += e.movementX;
        this.look.y += e.movementY;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    addEventListener('wheel', (e) => {
      if (this.onWheel) this.onWheel(Math.sign(e.deltaY));
    }, { passive: true });
    this._setupTouch();
  }

  requestLock() {
    if (this.isTouch) return;
    this.canvas.requestPointerLock?.();
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  consumeLook() {
    const x = this.look.x, y = this.look.y;
    this.look.x = 0; this.look.y = 0;
    return { x, y };
  }

  axis() {
    let x = 0, z = 0;
    if (this.keys.KeyA || this.keys.ArrowLeft) x -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) x += 1;
    if (this.keys.KeyW || this.keys.ArrowUp) z -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown) z += 1;
    x += this.touchMove.x;
    z += this.touchMove.y;
    const m = Math.hypot(x, z);
    if (m > 1) { x /= m; z /= m; }
    return { x, z };
  }

  _setupTouch() {
    const stick = document.getElementById('stick');
    const knob = document.getElementById('stickKnob');
    const look = document.getElementById('lookZone');
    const touch = document.getElementById('touch');
    if (!stick || !look) return;
    const setStick = (cx, cy, px, py) => {
      const dx = px - cx, dy = py - cy;
      const max = 46;
      const m = Math.hypot(dx, dy) || 1;
      const k = Math.min(m, max) / m;
      const sx = dx * k, sy = dy * k;
      knob.style.transform = `translate(${sx}px, ${sy}px)`;
      this.touchMove.x = sx / max;
      this.touchMove.y = sy / max;
    };
    let sid = null, lid = null, lx = 0, ly = 0;
    stick.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      sid = t.identifier;
      const r = stick.getBoundingClientRect();
      setStick(r.left + r.width / 2, r.top + r.height / 2, t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });
    look.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      lid = t.identifier; lx = t.clientX; ly = t.clientY;
      e.preventDefault();
    }, { passive: false });
    addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === sid) {
          const r = stick.getBoundingClientRect();
          setStick(r.left + r.width / 2, r.top + r.height / 2, t.clientX, t.clientY);
        } else if (t.identifier === lid) {
          this.look.x += (t.clientX - lx) * 1.6;
          this.look.y += (t.clientY - ly) * 1.6;
          lx = t.clientX; ly = t.clientY;
        }
      }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === sid) {
          sid = null; this.touchMove.x = 0; this.touchMove.y = 0;
          knob.style.transform = '';
        }
        if (t.identifier === lid) lid = null;
      }
    };
    addEventListener('touchend', end);
    addEventListener('touchcancel', end);
    document.querySelectorAll('#touch [data-act]').forEach((btn) => {
      const act = btn.dataset.act;
      const down = (e) => {
        e.preventDefault();
        if (act === 'fire') this.fireHeld = true;
        if (act === 'ads') this.adsHeld = !this.adsHeld;
        if (this.onTouchAct) this.onTouchAct(act, true);
      };
      const up = (e) => {
        e.preventDefault();
        if (act === 'fire') this.fireHeld = false;
        if (this.onTouchAct) this.onTouchAct(act, false);
      };
      btn.addEventListener('touchstart', down, { passive: false });
      btn.addEventListener('touchend', up, { passive: false });
    });
    this.touchRoot = touch;
  }

  showTouch(v) {
    if (!this.touchRoot) return;
    this.touchRoot.classList.toggle('hidden', !v);
  }
}
