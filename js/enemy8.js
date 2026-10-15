'use strict';
/* ==========================================================================
   enemy8.js : ศัตรูใหม่ของด่าน 10 โรงงานอาวุธ (WEAPONS FACTORY)
     Welder Bot (type 'welder')  หุ่นช่างเชื่อม วิ่งเข้าหาผู้เล่น พอใกล้จะยกหัวเชื่อมเรืองแสง (WLD_WIND วินาที = สัญญาณเตือน)
        แล้วพุ่งฟันด้วยเปลวไฟ 1 ครั้ง  แดช/กระโดดหนีทันถ้าเห็นหัวเชื่อมเรือง  หลังพุ่งจะเปิดช่องให้ตอบโต้
     Mine Layer (type 'minelayer')  รถวางทุ่นระเบิด เดินวนห่างผู้เล่น วางทุ่นลงพื้นเรื่อยๆ (ทุ่นอยู่ MINE_LIFE วินาที)
        ทุ่นระเบิดเมื่อผู้เล่นเดินทับ (เท้าอยู่ใกล้พื้น) — กระโดดข้ามได้ ปลอดภัย  ยิงโดนทุ่นจะจุดระเบิดทิ้ง (กระสุนที่ระดับพื้น/มิสไซล์)
   ค่าตัวเลขอยู่ด้านล่างของไฟล์นี้ (ไม่ต้องแก้ config.js)  ภาพวาด: assets/enemies/welder.png minelayer.png
   ========================================================================== */

const WLD_HP = 120, WLD_ARMOR = 0.1, WLD_W = 38, WLD_H = 46, WLD_SPEED = 105;
const WLD_TRIGGER = 150, WLD_WIND = 0.55, WLD_LUNGE_T = 0.32, WLD_LUNGE_V = 300, WLD_REACH = 54, WLD_REC = 0.9, WLD_CD = 1.2, WLD_DMG = 16;
const MLY_HP = 90, MLY_ARMOR = 0.1, MLY_W = 46, MLY_H = 28, MLY_SPEED = 70, MLY_PATROL = 40;
const MLY_KEEP_MIN = 260, MLY_KEEP_MAX = 460, MLY_DROP_CD = 2.2;
const MINE_ARM = 0.7, MINE_LIFE = 16, MINE_MAX = 8, MINE_TRIGGER = 26, MINE_FOOT = 18, MINE_DMG = 14, MINE_SPLASH_R = 40;

ENEMY_EXP.welder = 70; ENEMY_EXP.minelayer = 65;
ENEMY_BAR.welder = 14; ENEMY_BAR.minelayer = 18;

let mines = [];

function makeWelder(x) {
  return { type: 'welder', x: x, y: GROUND_Y - WLD_H, w: WLD_W, h: WLD_H, hp: WLD_HP, maxHp: WLD_HP, armor: WLD_ARMOR, homeX: x, dir: -1, flash: 0, phase: Math.random() * 6, vx: 0, st: 'run', t: 0, cd: 0.6 + Math.random() * 0.8, hit: false, walk: Math.random() * 6 };
}
function makeMineLayer(x) {
  return { type: 'minelayer', x: x, y: GROUND_Y - MLY_H, w: MLY_W, h: MLY_H, hp: MLY_HP, maxHp: MLY_HP, armor: MLY_ARMOR, homeX: x, dir: -1, flash: 0, phase: Math.random() * 6, vx: 0, dropCd: 1.0 + Math.random() * 0.8, pdir: -1, patT: 1.5 + Math.random() * 1.5 };
}

// ---------- ทุ่นระเบิด ----------
function mineExplode(m, harmless) {
  smallBoom(m.x, GROUND_Y - 6, 26); spawnSparks(m.x, GROUND_Y - 4, 8, '#ffb13b'); addShake(3);
  if (!harmless && !player.dead && Math.abs(player.x + player.w / 2 - m.x) < MINE_SPLASH_R && player.y + player.h >= GROUND_Y - 34) {
    damagePlayer(MINE_DMG);
    spawnSparks(player.x + player.w / 2, player.y + player.h / 2, 8, player.shieldUp ? '#4fc3f7' : '#ff8a5c');
  }
}
function layMine(x) {
  mines.push({ x: x, arm: MINE_ARM, life: MINE_LIFE, ph: Math.random() * 6 });
  if (mines.length > MINE_MAX) mines.shift();
}
function updateMines(dt) {
  if (mission.bossState === 'dying' || mission.bossState === 'done') mines = [];
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i];
    m.arm -= dt; m.life -= dt; m.ph += dt;
    if (m.life <= 0) { mines.splice(i, 1); continue; }
    if (m.arm > 0) continue;
    let boom = false, harmless = false;
    if (!player.dead && Math.abs(player.x + player.w / 2 - m.x) < MINE_TRIGGER && player.y + player.h >= GROUND_Y - MINE_FOOT) boom = true;
    else if (typeof bullets !== 'undefined') {                    // ยิงทุ่นทิ้งได้ (กระสุนผ่านระดับพื้น)
      for (const b of bullets) if (b && Math.abs(b.x - m.x) < 14 && b.y > GROUND_Y - 22 && b.y < GROUND_Y + 4) { boom = harmless = true; break; }
    }
    if (boom) { mineExplode(m, harmless); mines.splice(i, 1); }
  }
}
function drawMines() {
  const t = performance.now() / 1000;
  for (const m of mines) {
    const sx = m.x - cam;
    if (sx < -30 || sx > W + 30) continue;
    const armed = m.arm <= 0, blink = armed && Math.floor((t + m.ph) * (m.life < 4 ? 8 : 3)) % 2;
    ctx.save();
    ctx.fillStyle = '#2b2f33'; ctx.beginPath(); ctx.ellipse(sx, GROUND_Y - 3, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#454c52'; ctx.beginPath(); ctx.ellipse(sx, GROUND_Y - 6, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#15181b'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = armed ? (blink ? '#ff3b2a' : '#7a1d16') : '#c9b13a';
    ctx.beginPath(); ctx.arc(sx, GROUND_Y - 8, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ---------- ต่อเข้าวงจรหลัก (ไม่ต้องแก้ enemy.js) ----------
(function () {
  const baseUpd = updateEnemies, baseDraw = drawEnemies, baseReset = resetEnemies;
  updateEnemies = function (dt) { updateMines(dt); return baseUpd.call(this, dt); };
  drawEnemies = function () { drawMines(); return baseDraw.apply(this, arguments); };
  resetEnemies = function () { mines = []; return baseReset.apply(this, arguments); };
})();

// ---------- Welder Bot ----------
function updateWelder(e, dt, pcx, pcy) {
  if (e.kx) { e.x = clamp(e.x + e.kx * dt, 0, WORLD_W - e.w); e.kx *= Math.pow(0.01, dt); if (Math.abs(e.kx) < 5) e.kx = 0; }
  const cx = e.x + e.w / 2, dx = pcx - cx, adx = Math.abs(dx), toward = Math.sign(dx) || 1;
  const onScreen = cx > cam - 10 && cx < cam + W + 10;
  e.y = GROUND_Y - e.h;
  if (e.st === 'run') {
    e.dir = toward;
    const tgt = adx > 60 ? toward * WLD_SPEED * (onScreen ? 1 : 1.5) : 0;
    e.vx += clamp(tgt - e.vx, -700 * dt, 700 * dt);
    e.cd -= dt;
    if (e.cd <= 0 && adx < WLD_TRIGGER && onScreen && !player.dead) { e.st = 'wind'; e.t = WLD_WIND; e.vx = 0; }
  } else if (e.st === 'wind') {                                   // หัวเชื่อมเรืองแสง = เตือน
    e.vx = 0; e.t -= dt;
    if (Math.random() < dt * 30) spawnSparks(cx + e.dir * 26, e.y + 22, 1, '#9fd8ff');
    if (e.t <= 0) { e.st = 'lunge'; e.t = WLD_LUNGE_T; e.hit = false; }
  } else if (e.st === 'lunge') {
    e.t -= dt; e.vx = e.dir * WLD_LUNGE_V;
    if (!e.hit && !player.dead) {
      const x0 = e.dir > 0 ? cx : cx - WLD_REACH - e.w / 2, x1 = x0 + WLD_REACH + e.w / 2;
      if (player.x + player.w > x0 && player.x < x1 && player.y + player.h > e.y && player.y < e.y + e.h) {
        e.hit = true; damagePlayer(WLD_DMG);
        spawnSparks(player.x + player.w / 2, player.y + player.h / 2, 8, '#ffb13b');
      }
    }
    if (e.t <= 0) { e.st = 'rec'; e.t = WLD_REC; e.vx = 0; }
  } else {
    e.t -= dt; e.vx = 0;
    if (e.t <= 0) { e.st = 'run'; e.cd = WLD_CD * (0.8 + Math.random() * 0.5); }
  }
  e.x += e.vx * dt;
  enemyLimit(e);
  e.walk += Math.abs(e.vx) * dt / 24;
}

function drawWelder(e, sx, sy, flash) {
  const f = e.dir > 0 ? 1 : -1, cx = sx + e.w / 2, w = e.w, h = e.h;
  const wind = e.st === 'wind', lunge = e.st === 'lunge', sw = Math.sin(e.walk) * 5;
  ctx.save();
  ctx.translate(cx, 0); ctx.scale(f, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, GROUND_Y + 2, 20, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2b2f33'; ctx.lineWidth = 5; ctx.lineCap = 'round';                         // ขา
  ctx.beginPath(); ctx.moveTo(-5, sy + h - 18); ctx.lineTo(-5 + sw, sy + h - 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, sy + h - 18); ctx.lineTo(6 - sw, sy + h - 2); ctx.stroke();
  ctx.fillStyle = flash ? '#fff' : '#d7a21f'; ctx.fillRect(-w / 2 + 3, sy + 14, w - 6, h - 30);   // ลำตัวเหลืองอุตสาหกรรม
  ctx.strokeStyle = '#4a3a0c'; ctx.lineWidth = 2; ctx.strokeRect(-w / 2 + 3, sy + 14, w - 6, h - 30);
  ctx.fillStyle = '#2b2f33'; for (let i = 0; i < 3; i++) ctx.fillRect(-w / 2 + 5 + i * 9, sy + h - 22, 5, 4);   // ลายเตือน
  ctx.fillStyle = flash ? '#fff' : '#9aa3ab'; ctx.fillRect(-9, sy + 2, 18, 13);                  // หมวกเชื่อม
  ctx.fillStyle = wind || lunge ? '#ffe9a0' : '#0e1417'; ctx.fillRect(1, sy + 5, 8, 5);           // กระจกหน้ากาก
  const ax = 8, ay = sy + 22;                                                                    // แขน + หัวเชื่อม
  ctx.strokeStyle = '#6b7078'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(ax - 2, ay); ctx.lineTo(ax + 16, ay + (wind ? -6 : 2)); ctx.stroke();
  ctx.fillStyle = '#3a3f45'; ctx.fillRect(ax + 14, ay - (wind ? 9 : 1), 12, 5);
  const tx = ax + 27, ty = ay - (wind ? 6.5 : 1) + 2;
  if (wind) { ctx.fillStyle = 'rgba(160,220,255,' + (0.5 + 0.5 * Math.sin(performance.now() / 30)) + ')'; ctx.beginPath(); ctx.arc(tx, ty, 4 + (1 - e.t / WLD_WIND) * 6, 0, Math.PI * 2); ctx.fill(); }
  if (lunge) {                                                                                   // เปลวไฟพุ่ง
    const fl = WLD_REACH + Math.random() * 10;
    ctx.fillStyle = 'rgba(255,120,40,0.85)'; ctx.beginPath(); ctx.moveTo(tx, ty - 8); ctx.lineTo(tx + fl, ty); ctx.lineTo(tx, ty + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(190,235,255,0.95)'; ctx.beginPath(); ctx.moveTo(tx, ty - 4); ctx.lineTo(tx + fl * 0.6, ty); ctx.lineTo(tx, ty + 4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ---------- Mine Layer ----------
function updateMineLayer(e, dt, pcx, pcy) {
  if (e.kx) { e.x = clamp(e.x + e.kx * dt, 0, WORLD_W - e.w); e.kx *= Math.pow(0.01, dt); if (Math.abs(e.kx) < 5) e.kx = 0; }
  const cx = e.x + e.w / 2, dx = pcx - cx, adx = Math.abs(dx), toward = Math.sign(dx) || 1;
  const onScreen = cx > cam + 10 && cx < cam + W - 10;
  e.y = GROUND_Y - e.h;
  let tgt;
  if (!onScreen) tgt = toward * MLY_SPEED * 1.4;
  else if (adx < MLY_KEEP_MIN) tgt = -toward * MLY_SPEED;
  else if (adx > MLY_KEEP_MAX) tgt = toward * MLY_SPEED;
  else {                                                         // อยู่ในระยะ: เดินวนไปมา
    e.patT -= dt; if (e.patT <= 0) { e.pdir = -e.pdir; e.patT = 1.5 + Math.random() * 1.8; }
    tgt = e.pdir * MLY_PATROL;
  }
  e.vx += clamp(tgt - e.vx, -400 * dt, 400 * dt);
  e.x += e.vx * dt;
  enemyLimit(e);
  if (Math.abs(e.vx) > 5) e.dir = Math.sign(e.vx);
  e.dropCd -= dt;
  if (e.dropCd <= 0 && onScreen && !player.dead) { layMine(cx - e.dir * 20); e.dropCd = MLY_DROP_CD * (0.9 + Math.random() * 0.3); e.dropFlash = 0.25; }
  if (e.dropFlash) e.dropFlash = Math.max(0, e.dropFlash - dt);
}

function drawMineLayer(e, sx, sy, flash) {
  const f = e.dir > 0 ? 1 : -1, cx = sx + e.w / 2, w = e.w, h = e.h;
  ctx.save();
  ctx.translate(cx, 0); ctx.scale(f, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, GROUND_Y + 2, w * 0.5, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1e1b19'; ctx.fillRect(-w / 2 - 1, sy + h - 10, w + 2, 10);                    // ตีนตะขาบ
  ctx.fillStyle = '#3a342f';
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-w / 2 + 6 + i * 8.5, sy + h - 5, 3.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = flash ? '#fff' : '#8a5a2b'; ctx.fillRect(-w / 2, sy + 6, w, h - 15);            // ตัวถังสีสนิม
  ctx.strokeStyle = '#2e1c0a'; ctx.lineWidth = 2; ctx.strokeRect(-w / 2 + 1, sy + 7, w - 2, h - 17);
  ctx.fillStyle = flash ? '#fff' : '#a8733a'; ctx.fillRect(w / 2 - 14, sy + 2, 14, 10);           // ห้องควบคุม
  ctx.fillStyle = '#ffe04a'; ctx.fillRect(w / 2 - 8, sy + 5, 5, 3);
  ctx.fillStyle = '#2b2f33'; ctx.fillRect(-w / 2 - 6, sy + h - 14, 10, 8);                         // ท่อปล่อยทุ่นท้ายรถ
  ctx.fillStyle = '#454c52';                                                                     // ทุ่นสำรองบนหลังรถ
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-w / 2 + 10 + i * 9, sy + 5, 4.5, 2.2, 0, 0, Math.PI * 2); ctx.fill(); }
  if (e.dropFlash > 0) { ctx.fillStyle = 'rgba(255,200,120,' + e.dropFlash * 3 + ')'; ctx.beginPath(); ctx.arc(-w / 2 - 6, sy + h - 10, 5, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
