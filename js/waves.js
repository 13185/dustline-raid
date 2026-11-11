import { spawnMinFor } from './world.js';

export const WAVES = [
  {
    id: 1, name: '货栈警戒',
    spawns: [{ type: 'rusher', count: 4, gap: 1.1 }],
    reward: { title: '缴获武器', items: [{ id: 'gun_smg', name: '沙暴冲锋枪', desc: '射速极快，适合清理蜂拥而来的扑咬者。' }] }
  },
  {
    id: 2, name: '两侧夹击',
    spawns: [{ type: 'rusher', count: 3, gap: 0.8 }, { type: 'rifle', count: 3, gap: 1.3 }],
    reward: {
      title: '选择补给',
      items: [
        { id: 'heal', name: '战地包扎', desc: '恢复 50 生命，并提升 20 生命上限。' },
        { id: 'ammo', name: '满载弹药', desc: '所有武器弹药补满，再额外多带一组备弹。' }
      ]
    }
  },
  {
    id: 3, name: '巷口清场',
    spawns: [{ type: 'rusher', count: 4, gap: 0.7 }, { type: 'rifle', count: 2, gap: 1.1 }, { type: 'shotgun', count: 2, gap: 1.4 }],
    reward: {
      title: '选择主武器',
      items: [
        { id: 'gun_rifle', name: '尘脊步枪', desc: '中远距离稳定输出，后坐可控。' },
        { id: 'gun_shotgun', name: '巷口霰弹', desc: '近身喷子清场，一泵一片。' }
      ]
    }
  },
  {
    id: 4, name: '交叉火力',
    spawns: [{ type: 'rifle', count: 4, gap: 0.9 }, { type: 'shotgun', count: 2, gap: 1.2 }, { type: 'rusher', count: 4, gap: 0.6 }],
    reward: { title: '爆破许可', items: [{ id: 'nades', name: '破片手雷 x3', desc: '按 G 投掷。落地有预警圈，注意别炸到自己。' }] }
  },
  {
    id: 5, name: '钉板降临',
    boss: 'midboss',
    spawns: [{ type: 'rusher', count: 3, gap: 1.6 }, { type: 'rifle', count: 2, gap: 2.0 }],
    reward: {
      title: '钉板缴获',
      items: [
        { id: 'other_gun', name: '补齐全套枪械', desc: '获得你还没选的那把主武器，并补充两枚手雷。' },
        { id: 'vest', name: '防爆背心', desc: '永久减伤 25%，并立刻回满生命。' }
      ]
    }
  },
  {
    id: 6, name: '沙暴加码',
    spawns: [
      { type: 'rusher', count: 5, gap: 0.55 },
      { type: 'rifle', count: 4, gap: 0.9 },
      { type: 'shotgun', count: 2, gap: 1.2 },
      { type: 'grenadier', count: 1, gap: 2.2 }
    ],
    reward: {
      title: '武器强化',
      items: [
        { id: 'dmg', name: '穿甲弹头', desc: '所有武器伤害 +22%。' },
        { id: 'rpm', name: '快机改造', desc: '射速 +20%，换弹稍稍更快。' }
      ]
    }
  },
  {
    id: 7, name: '人潮决堤',
    spawns: [
      { type: 'rusher', count: 6, gap: 0.45 },
      { type: 'rifle', count: 4, gap: 0.8 },
      { type: 'shotgun', count: 3, gap: 1.0 },
      { type: 'grenadier', count: 2, gap: 1.8 }
    ],
    reward: { title: '最后整备', items: [{ id: 'fullkit', name: '全副武装', desc: '回满生命与弹药，手雷补到 3 枚，护甲再加一层。' }] }
  },
  {
    id: 8, name: '砂喉尸甲',
    boss: 'finalboss',
    spawns: [{ type: 'rusher', count: 6, gap: 4.5 }, { type: 'rifle', count: 3, gap: 6.0 }],
    reward: null
  }
];

export class WaveDirector {
  constructor(combat, world) {
    this.combat = combat;
    this.world = world;
    this.index = 0;
    this.queue = [];
    this.timer = 0;
    this.started = false;
    this.doneSpawning = false;
    this.cleared = false;
    this.totalInWave = 0;
    this.spawned = 0;
  }

  current() { return WAVES[this.index] || null; }

  begin(player) {
    const w = this.current();
    this.queue = [];
    this.timer = 0.6;
    this.started = true;
    this.doneSpawning = false;
    this.cleared = false;
    this.spawned = 0;
    this.totalInWave = 0;
    if (w.boss) {
      this.queue.push({ type: w.boss, delay: 0.2 });
      this.totalInWave += 1;
    }
    let acc = w.boss ? 1.4 : 0.2;
    for (const s of w.spawns) {
      for (let i = 0; i < s.count; i++) {
        this.queue.push({ type: s.type, delay: acc });
        acc += s.gap;
        this.totalInWave += 1;
      }
    }
    this._player = player;
  }

  remainingEnemies() { return this.combat.living().length; }

  remainingToSpawn() { return this.queue.length; }

  update(dt, player) {
    if (!this.started || this.cleared) return null;
    this.timer += dt;
    const cap = 12;
    while (this.queue.length && this.timer >= this.queue[0].delay && this.combat.living().length < cap) {
      const job = this.queue.shift();
      const [x, z] = this.world.pickSpawn(player.position.x, player.position.z, spawnMinFor(job.type));
      this.combat.spawn(job.type, x, z);
      this.spawned += 1;
    }
    if (!this.queue.length) this.doneSpawning = true;
    if (this.doneSpawning && this.combat.living().length === 0) {
      this.cleared = true;
      return 'cleared';
    }
    return null;
  }

  next() {
    this.index += 1;
    this.started = false;
    return this.current();
  }

  retry() {
    this.combat.clearAll();
    this.begin(this._player);
  }
}
