
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.look = { x: 0, y: 0 };
    this.fireHeld = false;
    this.adsHeld = false;
    this.locked = false;
    this.sensitivity = 0.00215;
    this.isTouch = false;
    this.lockCalls = 0;
    this.onLockChange = null;
    this._bind();
    const touch = document.getElementById('touch');
    if (touch) touch.classList.add('hidden');
  }

  _bind() {
    addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    const onDown = (e) => {
      if (e.button === 0) {
        if (!this.locked) {
          this.requestLock();
          return;
        }
        this.fireHeld = true;
      }
      if (e.button === 2) {
        e.preventDefault();
        if (this.locked) this.adsHeld = true;
      }
    };
    const onUp = (e) => {
      if (e.button === 0) this.fireHeld = false;
      if (e.button === 2) this.adsHeld = false;
    };
    this.canvas.addEventListener('mousedown', onDown);
    addEventListener('mousedown', (e) => {
      if (e.button === 2 && this.locked) this.adsHeld = true;
    });
    addEventListener('mouseup', onUp);
    addEventListener('blur', () => {
      this.fireHeld = false;
      this.adsHeld = false;
    });
    const blockMenu = (e) => e.preventDefault();
    this.canvas.addEventListener('contextmenu', blockMenu);
    document.addEventListener('contextmenu', blockMenu);

    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.look.x += e.movementX || 0;
      this.look.y += e.movementY || 0;
    });

    document.addEventListener('pointerlockchange', () => {
      const next = document.pointerLockElement === this.canvas;
      this.locked = next;
      if (!next) {
        this.fireHeld = false;
        this.adsHeld = false;
      }
      if (this.onLockChange) this.onLockChange(next);
    });

    addEventListener('wheel', (e) => {
      if (this.locked && this.onWheel) {
        e.preventDefault();
        this.onWheel(Math.sign(e.deltaY));
      } else if (this.onWheel) {
        this.onWheel(Math.sign(e.deltaY));
      }
    }, { passive: false });
  }

  requestLock() {
    this.lockCalls += 1;
    if (!this.canvas.requestPointerLock) return null;
    try {
      const p = this.canvas.requestPointerLock();
      return p;
    } catch (err) {
      return null;
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
    this.locked = document.pointerLockElement === this.canvas;
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
    const m = Math.hypot(x, z);
    if (m > 1) { x /= m; z /= m; }
    return { x, z };
  }

  showTouch() {
    const touch = document.getElementById('touch');
    if (touch) touch.classList.add('hidden');
  }
}
