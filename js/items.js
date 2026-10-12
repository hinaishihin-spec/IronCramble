'use strict';
/* ==========================================================================
   items.js : ไอเทมดรอป (กล่องเขียว = HP, ฟ้า = เติมโล่/บูสเตอร์, เหลือง = เงิน)
   ========================================================================== */

let items = [];

const ITEM_COLOR = { hp: '#5fd36f', refill: '#4fc3f7', gold: '#ffd23f' };
const ITEM_RGB = { hp: '95,211,111', refill: '79,195,247', gold: '255,210,63' };

function resetItems() { items = []; }

function spawnDrop(e) {
  // รถถังเป็นศัตรูหนัก: ดรอปแน่นอน 2 กล่อง (ตัวอื่นมีโอกาส DROP_CHANCE ดรอป 1 กล่อง)
  const n = e.type === 'tank' ? 2 : 1;
  for (let k = 0; k < n; k++) {
    if (e.type !== 'tank' && Math.random() >= DROP_CHANCE) return;
    const r = Math.random();
    items.push({
      type: r < 0.3 ? 'hp' : (r < 0.6 ? 'refill' : 'gold'),
      x: e.x + e.w / 2 - ITEM_SIZE / 2, y: e.y + e.h / 2 - ITEM_SIZE / 2,
      vx: (Math.random() - 0.5) * 160, vy: -180 - k * 40,
      landed: false, age: 0, life: 25,
      amount: 10 + 5 * ((Math.random() * 7) | 0)
    });
  }
}

function collectItem(it) {
  const cx = player.x + player.w / 2;
  if (it.type === 'hp') {
    player.hp = Math.min(maxHp(), player.hp + 25);
    popText(cx, player.y - 14, '+25 HP', '#5fd36f', 15);
    spawnSparks(cx, player.y + 10, 8, '#5fd36f');
  } else if (it.type === 'refill') {
    player.shield = SHIELD_MAX;
    player.shieldBroken = false;
    player.fuel = maxFuel();
    popText(cx, player.y - 14, 'SHIELD / BOOSTER FULL', '#4fc3f7', 13);
    spawnSparks(cx, player.y + 10, 8, '#4fc3f7');
  } else {
    profile.gold += it.amount;
    run.gold += it.amount;
    saveProfile();
    popText(cx, player.y - 14, '+' + it.amount + ' G', '#ffd23f', 15);
    spawnSparks(cx, player.y + 10, 8, '#ffd23f');
  }
}

function updateItems(dt) {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.age += dt;
    if (!it.landed) {
      it.vy += 900 * dt;
      it.x = clamp(it.x + it.vx * dt, 0, WORLD_W - ITEM_SIZE);
      it.y += it.vy * dt;
      it.vx *= Math.pow(0.2, dt);
      if (it.y + ITEM_SIZE >= GROUND_Y) { it.y = GROUND_Y - ITEM_SIZE; it.landed = true; it.vx = 0; }
    }
    if (!player.dead &&
        it.x + ITEM_SIZE + 6 > player.x && it.x - 6 < player.x + player.w &&
        it.y + ITEM_SIZE + 6 > player.y && it.y - 6 < player.y + player.h) {
      collectItem(it);
      items.splice(i, 1);
    } else if (it.age > it.life) {
      items.splice(i, 1);
    }
  }
}

function drawItems() {
  const t = performance.now() / 1000;
  for (const it of items) {
    const sx = it.x - cam;
    if (sx < -40 || sx > W + 40) continue;
    if (it.life - it.age < 5 && Math.floor(it.age * 8) % 2 === 0) continue;   // กะพริบก่อนหายไป
    const sy = it.y + (it.landed ? Math.sin(t * 3 + it.x) * 2 - 3 : 0);
    const pulse = 0.5 + 0.5 * Math.sin(t * 5 + it.x);
    const cx = sx + ITEM_SIZE / 2, cy = sy + ITEM_SIZE / 2;

    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22);
    g.addColorStop(0, 'rgba(' + ITEM_RGB[it.type] + ',' + (0.5 + 0.3 * pulse) + ')');
    g.addColorStop(1, 'rgba(' + ITEM_RGB[it.type] + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 22, cy - 22, 44, 44);

    ctx.fillStyle = ITEM_COLOR[it.type];
    ctx.fillRect(sx, sy, ITEM_SIZE, ITEM_SIZE);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx + 0.75, sy + 0.75, ITEM_SIZE - 1.5, ITEM_SIZE - 1.5);

    ctx.fillStyle = '#161a1e';
    if (it.type === 'hp') {
      ctx.fillRect(cx - 1.5, sy + 3, 3, ITEM_SIZE - 6);
      ctx.fillRect(sx + 3, cy - 1.5, ITEM_SIZE - 6, 3);
    } else if (it.type === 'refill') {
      ctx.strokeStyle = '#161a1e';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 4, sy + 4, ITEM_SIZE - 8, ITEM_SIZE - 8);
    } else {
      ctx.font = "700 10px 'Chakra Petch', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('G', cx, sy + 11);
      ctx.textAlign = 'left';
    }
  }
}
