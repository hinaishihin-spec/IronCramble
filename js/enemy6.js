'use strict';
/* ==========================================================================
   enemy6.js : ศัตรูใหม่ของด่าน 09 (ธีมศึกคู่ปรับ)
     Shield Wanzer (type 'shwanzer')  หุ่น Hammer ถือโล่ใหญ่บังด้านหน้า เดินเข้าหา ยิงปืนสั้นเป็นชุด 3 นัด
        โล่กันกระสุน/ปืนกล/เลเซอร์ (ลดดาเมจเหลือ SHW_BLOCK) ยกเว้น: ยิงโดนหัว (บน SHW_HEAD ของตัว), ยิงจากด้านหลังโล่
        (มันหันตามผู้เล่นช้า SHW_TURN วินาที กระโดดข้ามหัวแล้วยิงได้), และอาวุธหนัก/ทะลวงเกราะ (มิสไซล์ เลเซอร์ไหล่ ฟ้า สไนป์)
     Jammer Drone (type 'jammer')  โดรนรบกวน ลอยเว้นระยะ ยิงช้าๆ  ตราบที่อยู่ในจอและห่างผู้เล่นไม่เกิน JAM_RADIUS
        โดรนซัพพอร์ตของผู้เล่นจะหยุดทำงาน (ดู drone.js drone.jam)  ต้องยิงทิ้งก่อน
     Repair Unit (type 'repair')  หุ่นซ่อมภาคพื้น อยู่หลังเพื่อน ไม่โจมตี ซ่อมศัตรูรอบตัวทีละ REP_HEAL ของเลือดเต็มทุก REP_CD วินาที
        หนีผู้เล่น (วิ่งช้ากว่าผู้เล่น) เป็นเป้าที่ควรไล่ก่อน
   ค่าตัวเลขอยู่ด้านล่างของไฟล์นี้ (ไม่ต้องแก้ config.js)  ภาพวาด: assets/enemies/shwanzer.png jammer.png repair.png
   ========================================================================== */

const SHW_HP = 150, SHW_SPEED = 62, SHW_STOP = 150, SHW_RANGE = 430;
const SHW_BLOCK = 0.12, SHW_BLOCK_NOPOS = 0.5, SHW_HEAD = 0.3, SHW_TURN = 0.7;     // ดาเมจที่ทะลุโล่ (กระสุน / ไม่รู้จุดโดน เช่นเลเซอร์) / สัดส่วนหัวที่ไม่มีโล่ / เวลาหันตามผู้เล่น
const SHW_CD = 2.0, SHW_BURST = 3, SHW_BURST_GAP = 0.14, SHW_DMG = 6, SHW_BULLET_SPEED = 340;
const JAM_HP = 45, JAM_RADIUS = 460, JAM_SHOT_CD = 2.6, JAM_DMG = 5, JAM_SPEED = 90;
const REP_HP = 80, REP_SPEED = 60, REP_HEAL = 0.1, REP_CD = 2.6, REP_RANGE = 320, REP_KEEP = 360;

ENEMY_EXP.shwanzer = 90; ENEMY_EXP.jammer = 60; ENEMY_EXP.repair = 70;
ENEMY_BAR.shwanzer = 16; ENEMY_BAR.jammer = 18; ENEMY_BAR.repair = 14;

// ---------- โล่: ครอบ damageEnemy ----------
// ตำแหน่งที่กระสุนโดน (e.hitX, e.hitY) ถูกตั้งโดย updateBullets / กระสุนโดรน ก่อนเรียก damageEnemy
(function () {
  const base = damageEnemy;
  damageEnemy = function (e, dmg, heavy, ignoreArmor) {
    if (e.type === 'shwanzer' && !heavy && !ignoreArmor) {
      const cx = e.x + e.w / 2;
      let k = 1, front = true;
      if (e.hitY === undefined) k = SHW_BLOCK_NOPOS;
      else {
        front = (e.hitX - cx) * e.face > 0;                          // โดนจากด้านหน้า (ฝั่งโล่)
        if (front && e.hitY > e.y + e.h * SHW_HEAD) k = SHW_BLOCK;   // โดนตัว (ไม่ใช่หัว) = โล่กัน
      }
      if (k < 1) {
        dmg = Math.max(1, Math.round(dmg * k));
        e.shieldFlash = 0.12;
        spawnSparks(cx + e.face * 20, (e.hitY !== undefined ? e.hitY : e.y + e.h * 0.5), 3, '#9fd8ff');
      }
    }
    e.hitX = e.hitY = undefined;
    return base.call(this, e, dmg, heavy, ignoreArmor);
  };
})();

// ---------- สร้างตัว ----------
function makeShieldWanzer(x) {
  return {
    type: 'shwanzer', x: x, y: GROUND_Y - WZ_H, w: WZ_W, h: WZ_H, hp: SHW_HP, maxHp: SHW_HP, armor: 0,
    homeX: x, dir: -1, face: -1, turnT: 0, flash: 0, phase: Math.random() * 6, vx: 0, aim: Math.PI, walk: Math.random() * 6,
    cd: 1.4 + Math.random() * 1.2, burst: 0, bGap: 0, shieldFlash: 0, fireFlash: 0
  };
}
function makeJammer(x, y) {
  return { type: 'jammer', x: x, y: y, w: 38, h: 24, hp: JAM_HP, maxHp: JAM_HP, homeX: x, baseY: y, dir: -1, flash: 0, fireCd: 1.5 + Math.random() * 1.2, phase: Math.random() * 6 };
}
function makeRepair(x) {
  return { type: 'repair', x: x, y: GROUND_Y - 30, w: 34, h: 30, hp: REP_HP, maxHp: REP_HP, homeX: x, dir: -1, flash: 0, phase: Math.random() * 6, cd: 1.5, beamT: 0, beamTo: null, vx: 0 };
}

function enemyLimit(e) {                                       // ขอบเขตที่ขยับได้ (ล็อกกล้องบอสแล้วอยู่ในจอ)
  if (mission.lockX >= 0) e.x = clamp(e.x, mission.lockX, mission.lockX + W - e.w);
  else e.x = clamp(e.x, 0, WORLD_W - e.w);
}

// ---------- Shield Wanzer ----------
function updateShieldWanzer(e, dt, pcx, pcy) {
  e.shieldFlash = Math.max(0, e.shieldFlash - dt);
  e.fireFlash = Math.max(0, e.fireFlash - dt);
  if (e.kx) { e.x = clamp(e.x + e.kx * 0.3 * dt, 0, WORLD_W - e.w); e.kx *= Math.pow(0.01, dt); if (Math.abs(e.kx) < 5) e.kx = 0; }
  const cx = e.x + e.w / 2, dx = pcx - cx, adx = Math.abs(dx), toward = Math.sign(dx) || 1;
  const onScreen = cx > cam + 10 && cx < cam + W - 10;
  if (toward !== e.face) { e.turnT += dt; if (e.turnT >= SHW_TURN) { e.face = toward; e.turnT = 0; } } else e.turnT = 0;   // หันตามผู้เล่นช้า = จังหวะโจมตีด้านหลัง
  e.dir = e.face;
  e.aim = Math.atan2(pcy - (e.y + e.h * 0.4), pcx - cx);
  const tgt = adx > SHW_STOP || !onScreen ? toward * SHW_SPEED : 0;
  e.vx += clamp(tgt - e.vx, -600 * dt, 600 * dt);
  e.x += e.vx * dt;
  enemyLimit(e);
  e.walk += Math.abs(e.vx) * dt / 38;
  if (e.burst > 0) {                                             // กำลังยิงชุด
    e.bGap -= dt;
    if (e.bGap <= 0) {
      const m = wzGunMuzzle(e), a = Math.atan2(pcy - m.y, pcx - m.x) + (Math.random() - 0.5) * 0.1;
      enemyShots.push({ x: m.x, y: m.y, vx: Math.cos(a) * SHW_BULLET_SPEED, vy: Math.sin(a) * SHW_BULLET_SPEED, dmg: SHW_DMG, life: 1.8, r: 3.5 });
      e.fireFlash = 0.06; spawnSparks(m.x, m.y, 2, '#ffd9a0');
      e.burst--; e.bGap = SHW_BURST_GAP;
      if (e.burst <= 0) e.cd = SHW_CD * (0.9 + Math.random() * 0.3);
    }
    return;
  }
  e.cd -= dt;
  if (e.cd <= 0 && onScreen && adx <= SHW_RANGE && toward === e.face && !player.dead) { e.burst = SHW_BURST; e.bGap = 0.25; }
}

function drawShieldWanzer(e, sx, sy, flash) {
  const cx = sx + e.w / 2, feetY = sy + e.h, f = e.face > 0;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(cx, GROUND_Y + 2, 24, 4, 0, 0, Math.PI * 2); ctx.fill();
  withWanzerLoadout(e, function () {
    wzHide = { pod: true };
    try {
      const hasArt = !!equippedPartImage('BODY');
      const bob = Math.min(1, Math.abs(e.vx) / 100) * Math.abs(Math.sin(e.walk)) * 1.2;
      if (!flash) ctx.filter = 'drop-shadow(0 0 3px rgba(255,70,50,0.6))';
      if (hasArt) drawMechArt(cx, feetY, WZ_K, f, e.aim, f ? POD_REST : Math.PI - POD_REST, false, flash, false, bob, 0, 0);
      else wzFallback(cx, feetY, e, flash);
      ctx.filter = 'none';
    } finally { wzHide = null; }
  });
  // โล่ใหญ่ด้านหน้า (ครอบลำตัว เว้นหัว)
  const sh = e.shieldFlash > 0;
  const top = sy + e.h * SHW_HEAD, bot = sy + e.h - 4, fx = cx + e.face * (e.w / 2 + 2), sw = 11;
  ctx.fillStyle = sh ? '#e8fbff' : '#4b5d70';
  ctx.beginPath();
  ctx.moveTo(fx - e.face * 2, top); ctx.lineTo(fx + e.face * sw, top + 8); ctx.lineTo(fx + e.face * sw, bot - 8); ctx.lineTo(fx - e.face * 2, bot);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = sh ? '#ffffff' : '#9fb4c8'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = sh ? '#ffffff' : '#c7a53a'; ctx.fillRect(Math.min(fx, fx + e.face * sw), (top + bot) / 2 - 2, sw, 4);
  if (e.fireFlash > 0) { const m = wzGunMuzzle(e); ctx.fillStyle = 'rgba(255,230,160,0.9)'; ctx.beginPath(); ctx.arc(m.x - cam, m.y, 9, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// ---------- Jammer Drone ----------
function updateJammer(e, dt, pcx, pcy) {
  if (e.kx) { e.x = clamp(e.x + e.kx * dt, 0, WORLD_W - e.w); e.kx *= Math.pow(0.01, dt); if (Math.abs(e.kx) < 5) e.kx = 0; }
  if (e.ky) { e.baseY = clamp(e.baseY + e.ky * dt, 70, GROUND_Y - 60); e.ky *= Math.pow(0.01, dt); if (Math.abs(e.ky) < 5) e.ky = 0; }
  const cx = e.x + e.w / 2, dx = pcx - cx, side = dx > 0 ? -1 : 1;
  const want = pcx + side * 300, mv = want - cx;                 // ลอยเว้นระยะ ~300 px
  e.x += clamp(mv, -JAM_SPEED * dt, JAM_SPEED * dt);
  e.dir = Math.sign(dx) || e.dir;
  e.y = e.baseY + Math.sin(e.phase * 2.2) * 10;
  enemyLimit(e);
  const ex = e.x + e.w / 2, ey = e.y + e.h / 2, onScreen = ex > cam - 20 && ex < cam + W + 20;
  e.jamming = false;
  if (onScreen && !player.dead && Math.hypot(pcx - ex, pcy - ey) < JAM_RADIUS) {
    e.jamming = true;
    if (typeof drone !== 'undefined' && drone) drone.jam = Math.max(drone.jam || 0, 0.6);          // รบกวนโดรนซัพพอร์ต
  }
  e.fireCd -= dt;
  if (onScreen && !player.dead && e.fireCd <= 0 && Math.hypot(pcx - ex, pcy - ey) < 520) {
    const a = Math.atan2(pcy - ey, pcx - ex);
    enemyShots.push({ x: ex, y: ey, vx: Math.cos(a) * 280, vy: Math.sin(a) * 280, dmg: JAM_DMG, life: 2.2 });
    e.fireCd = JAM_SHOT_CD + Math.random() * 0.8;
    spawnSparks(ex + Math.cos(a) * 14, ey + Math.sin(a) * 14, 2, '#d08aff');
  }
}

function drawJammer(e, sx, sy, flash) {
  const cx = sx + e.w / 2, cy = sy + e.h / 2, t = performance.now() / 1000;
  ctx.save();
  if (e.jamming) {                                               // คลื่นรบกวนแผ่ออกเป็นวง
    for (let i = 0; i < 3; i++) {
      const p = ((t * 0.9 + i / 3) % 1);
      ctx.strokeStyle = 'rgba(190,100,255,' + 0.35 * (1 - p) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 20 + p * 70, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.strokeStyle = '#9aa5ae'; ctx.lineWidth = 3;
  const rw = 8 + Math.abs(Math.cos(e.phase * 30)) * 10;
  ctx.beginPath(); ctx.moveTo(cx - rw, sy - 5); ctx.lineTo(cx + rw, sy - 5); ctx.stroke();
  ctx.fillStyle = '#6b7680'; ctx.fillRect(cx - 2, sy - 5, 4, 6);
  ctx.fillStyle = flash ? '#ffffff' : '#3e3550';                 // จานรบกวนสีม่วงเข้ม
  ctx.beginPath(); ctx.ellipse(cx, cy, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1c1628'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#9a6bd0'; ctx.lineWidth = 2;                // เสาอากาศ
  ctx.beginPath(); ctx.moveTo(cx, sy + 2); ctx.lineTo(cx, sy - 12); ctx.stroke();
  ctx.fillStyle = e.jamming && Math.floor(t * 10) % 2 ? '#ffffff' : '#c58aff';
  ctx.beginPath(); ctx.arc(cx, sy - 13, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff5a3c'; ctx.beginPath(); ctx.arc(cx + e.dir * 6, cy, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------- Repair Unit ----------
function updateRepair(e, dt, pcx, pcy) {
  if (e.kx) { e.x = clamp(e.x + e.kx * dt, 0, WORLD_W - e.w); e.kx *= Math.pow(0.01, dt); if (Math.abs(e.kx) < 5) e.kx = 0; }
  e.beamT = Math.max(0, e.beamT - dt);
  const cx = e.x + e.w / 2, dp = pcx - cx, toward = Math.sign(dp) || 1;
  let ally = null, ad = Infinity;
  for (const o of enemies) {                                     // เพื่อนที่ใกล้ที่สุด (ไม่นับบอส / ตัวซ่อมด้วยกัน)
    if (o === e || o.type === 'boss' || o.type === 'repair') continue;
    const d = Math.abs(o.x + o.w / 2 - cx);
    if (d < ad) { ad = d; ally = o; }
  }
  let tgt = 0;
  if (Math.abs(dp) < REP_KEEP) tgt = -toward * REP_SPEED;        // ผู้เล่นเข้าใกล้: ถอยหนี
  else if (ally && ad > 90) tgt = Math.sign(ally.x + ally.w / 2 - cx) * REP_SPEED;   // อยู่หลังเพื่อน
  else if (!ally && Math.abs(dp) > REP_KEEP + 40) tgt = toward * REP_SPEED * 0.8;   // ไม่มีเพื่อนเหลือ: เดินเข้าหา (ไม่ให้หนีจนด่านไม่จบ)
  e.vx += clamp(tgt - e.vx, -500 * dt, 500 * dt);
  e.x += e.vx * dt;
  if (tgt !== 0) e.dir = Math.sign(tgt);
  enemyLimit(e);
  e.cd -= dt;
  const onScreen = cx > cam - 20 && cx < cam + W + 20;
  if (e.cd <= 0 && onScreen) {
    let best = null, br = 0.95;
    for (const o of enemies) {
      if (o === e || o.type === 'boss' || o.type === 'repair') continue;
      const r = o.hp / o.maxHp;
      if (r < br && Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - (e.y + e.h / 2)) < REP_RANGE) { br = r; best = o; }
    }
    if (best) {
      const n = Math.round(best.maxHp * REP_HEAL);
      best.hp = Math.min(best.maxHp, best.hp + n);
      e.beamT = 0.4; e.beamTo = best; e.cd = REP_CD;
      popText(best.x + best.w / 2, best.y - 8, '+' + n, '#5fd36f', 12);
      spawnSparks(best.x + best.w / 2, best.y + best.h / 2, 5, '#5fd36f');
    } else e.cd = 0.5;
  }
}

function drawRepair(e, sx, sy, flash) {
  const cx = sx + e.w / 2, f = e.dir > 0 ? 1 : -1;
  ctx.save();
  if (e.beamT > 0 && e.beamTo) {                                 // ลำแสงซ่อม
    const b = e.beamTo, k = e.beamT / 0.4;
    ctx.strokeStyle = 'rgba(95,211,111,' + 0.8 * k + ')'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + f * 8, sy + 2); ctx.lineTo(b.x + b.w / 2 - cam, b.y + b.h / 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,255,225,' + k + ')'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx + f * 8, sy + 2); ctx.lineTo(b.x + b.w / 2 - cam, b.y + b.h / 2); ctx.stroke();
  }
  ctx.fillStyle = '#1e1b19'; ctx.fillRect(sx + 2, sy + e.h - 9, e.w - 4, 9);        // ล้อตีนตะขาบเล็ก
  ctx.fillStyle = '#3a342f';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(sx + 7 + i * 7, sy + e.h - 4.5, 3.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = flash ? '#ffffff' : '#5c6b4e'; ctx.fillRect(sx + 3, sy + 8, e.w - 6, e.h - 17);   // ตัวถัง
  ctx.strokeStyle = '#1f2a1b'; ctx.lineWidth = 2; ctx.strokeRect(sx + 3, sy + 8, e.w - 6, e.h - 17);
  ctx.fillStyle = '#e9f5e6'; ctx.fillRect(cx - 2, sy + 12, 4, 12); ctx.fillRect(cx - 6, sy + 16, 12, 4);   // กากบาทซ่อม
  ctx.fillStyle = flash ? '#fff' : '#7d8f6c'; ctx.fillRect(cx - 7, sy + 2, 14, 7);
  ctx.fillStyle = '#5fd36f'; ctx.fillRect(cx + (f > 0 ? 1 : -6), sy + 4, 5, 3);       // ตา
  ctx.strokeStyle = '#9aa5ae'; ctx.lineWidth = 2;                                      // แขนจานซ่อม
  ctx.beginPath(); ctx.moveTo(cx + f * 6, sy + 8); ctx.lineTo(cx + f * 12, sy + 1); ctx.stroke();
  ctx.fillStyle = e.beamT > 0 ? '#e9ffe9' : '#5fd36f'; ctx.beginPath(); ctx.arc(cx + f * 12, sy + 1, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
