
import * as THREE from '../vendor/three/three.module.js';

export class Player {
  constructor(camera, world, input) {
    this.camera = camera;
    this.world = world;
    this.input = input;
    this.position = new THREE.Vector3(0, 0, 16.4);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.06;
    this.maxHp = 100;
    this.hp = 100;
    this.armor = 0;
    this.dmgMul = 1;
    this.rpmMul = 1;
    this.invuln = 0;
    this.hurtFlash = 0;
    this.crouching = false;
    this.grounded = true;
    this.alive = true;
    this.eye = 1.64;
    this.radius = 0.38;
    this.footT = 0;
  }

  reset(full = true) {
    this.position.set(0, 0, 16.4);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.06;
    this.hp = this.maxHp;
    this.alive = true;
    this.invuln = 1.2;
    if (full) {
      this.maxHp = 100;
      this.hp = 100;
      this.armor = 0;
      this.dmgMul = 1;
      this.rpmMul = 1;
    }
  }

  hurt(amt) {
    if (!this.alive || this.invuln > 0) return;
    const taken = amt * (1 - Math.min(0.45, this.armor));
    this.hp -= taken;
    this.hurtFlash = 0.45;
    this.invuln = 0.25;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
    return taken;
  }

  heal(n) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    return this.hp - before;
  }

  update(dt) {
    if (!this.alive) return { moving: 0 };
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    const look = this.input.consumeLook();
    const adsSlow = this.input.adsHeld ? 0.52 : 1;
    this.yaw -= look.x * this.input.sensitivity * adsSlow;
    this.pitch -= look.y * this.input.sensitivity * adsSlow;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));

    this.crouching = !!(this.input.keys.ControlLeft || this.input.keys.ControlRight);
    const walking = !!(this.input.keys.ShiftLeft || this.input.keys.ShiftRight);
    const speed = this.crouching ? 1.7 : walking ? 2.2 : 5.2;
    const axis = this.input.axis();
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const wishX = axis.x * cy + axis.z * sy;
    const wishZ = -axis.x * sy + axis.z * cy;
    this.vel.x = wishX * speed;
    this.vel.z = wishZ * speed;

    if (this.grounded && (this.input.keys.Space || this.input.keys.Numpad0)) {
      this.vel.y = 6.15;
      this.grounded = false;
    }
    this.vel.y -= 20 * dt;
    this.position.y += this.vel.y * dt;
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.vel.y = 0;
      this.grounded = true;
    }

    const next = this.world.collide(
      this.position.x + this.vel.x * dt,
      this.position.y + 0.9,
      this.position.z + this.vel.z * dt,
      this.radius,
      this.crouching ? 1.15 : 1.7
    );
    this.position.x = next.x;
    this.position.z = next.z;

    this.eye = THREE.MathUtils.damp(this.eye, this.crouching ? 1.08 : 1.64, 12, dt);
    this.camera.position.set(this.position.x, this.position.y + this.eye, this.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    const moving = Math.hypot(this.vel.x, this.vel.z);
    if (moving > 1.2 && this.grounded) {
      this.footT += dt * (walking ? 1.6 : 2.6);
      if (this.footT > 1) { this.footT = 0; return { moving, foot: true }; }
    }
    return { moving, foot: false };
  }
}
