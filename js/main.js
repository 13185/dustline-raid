
import { Game, pickQuality } from './game.js';

const bootFill = document.getElementById('bootFill');
const bootText = document.getElementById('bootText');
const params = new URLSearchParams(location.search);
const qSel = document.getElementById('selQuality');
const pref = params.get('quality') || qSel.value || 'medium';
qSel.value = pref === 'auto' ? 'auto' : pref;
const quality = pickQuality(pref);

const canvas = document.getElementById('gl');
const game = new Game(canvas, quality);

function onProgress(p, msg) {
  bootFill.style.width = Math.round(p * 100) + '%';
  if (msg) bootText.textContent = msg;
}

game.boot(onProgress).catch((err) => {
  console.error(err);
  bootText.textContent = '加载失败：' + (err && err.message ? err.message : err);
});

window.__game = game;
