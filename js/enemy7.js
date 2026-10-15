'use strict';
/* ==========================================================================
   enemy7.js : ศัตรูใหม่ของด่าน 08 IRON THUNDER (กองทัพตีนตะขาบหนัก นำทางไปหาบอส Mega Bolt)
     Mortar Crawler  (type 'mortar')   ปืนครกตีนตะขาบ เว้นระยะ ยิงกระสุนโค้งตกที่จุดที่ผู้เล่นยืนตอนยิง
        มีวงแดงเตือนบนพื้นจนกระสุนตก (MOR_FLIGHT วินาที)  ระเบิดโดนเฉพาะคนที่อยู่ใกล้พื้น = กระโดด/แดชหนีได้
        เข้าใกล้เกินไปมันจะถอย  เกราะบาง
     Gatling Crawler (type 'gatling')  ตัวเตี้ย เลือดเยอะ เกราะหนา เดินเข้าหา หยุด หมุนลำกล้อง GAT_SPIN วินาที (เตือน)
        แล้วสาดกระสุนเป็นพัดต่อเนื่อง GAT_FIRE วินาที  (ต้นแบบเล็กของ Mega Bolt)
     Dropship        (type 'dropship') เครื่องบินขนส่ง บินเข้ากลางจอ เปิดท้อง ปล่อยทหาร 2 ตัวลงพื้น แล้วบินหนีออกขวา
        ยิงตกก่อนปล่อย = ทหารหายไปด้วย  ใน missions.js ใช้ 'dropship' (ปล่อย Walker) / 'dropshipw' (ปล่อย Shot Wanzer)
   ค่าตัวเลขอยู่ด้านล่างของไฟล์นี้ (ไม่ต้องแก้ config.js)
   ภาพวาด: assets/enemies/mortar.png gatling.png dropship.png (ภาพหันซ้าย, เฟรมเพิ่ม _2.._6 ได้ตามระบบ enemyart.js)
   ========================================================================== */

const MOR_HP = 100, MOR_ARMOR = 0.2, MOR_W = 62, MOR_H = 34, MOR_SPEED = 48;
const MOR_MIN = 230, MOR_MAX = 450, MOR_RANGE = 620, MOR_FIRE_MIN = 100;      // ถอยถ้าใกล้กว่า MIN  เดินเข้าถ้าไกลกว่า MAX  ยิงเมื่อ MIN_FIRE < ระยะ < RANGE
const MOR_CD = 3.4, MOR_FLIGHT = 1.15, MOR_G = 900, MOR_DMG = 18, MOR_SPLASH = 58;
const GAT_HP = 230, GAT_ARMOR = 0.4, GAT_W = 70, GAT_H = 38, GAT_SPEED = 40, GAT_STOP = 280, GAT_RANGE = 540;
const GAT_CD = 2.8, GAT_SPIN = 1.0, GAT_FIRE = 2.0, GAT_RATE = 0.085, GAT_FAN = 0.2, GAT_BULLET = 400, GAT_DMG = 4;
const DSH_HP = 150, DSH_ARMOR = 0.2, DSH_W = 96, DSH_H = 34, DSH_Y = 92, DSH_SPEED = 150, DSH_OUT_SPEED = 190, DSH_STOP = 0.6, DSH_BAY = 0.9, DSH_CARGO = 2;

ENEMY_EXP.mortar = 80; ENEMY_EXP.gatling = 100; ENEMY_EXP.dropship = 85;
ENEMY_BAR.mortar = 18; ENEMY_BAR.gatling = 18; ENEMY_BAR.dropship = 20;

// ---------- ผลักได้น้อย / เครื่องบินไม่โดนผลัก ----------
(function () {
  const base = knockEnemy;
  knockEnemy = function (e, dx, dy) {
    if (e.type === 'dropship') return;
    if (e.type === 'mortar' || e.type === 'gatling') dx *= (e.type === 'gatling' ? 0.15 : 0.3);
    return base.call(this, e, dx, dy);
  };
})();

// ---------- วงเตือนกระสุนครก (ผูกกับกระสุน จึงอยู่ต่อแม้ตัวยิงตายแล้ว) ----------
(function () {
  const baseUpd = updateEnemyShots, baseDraw = drawEnemyShots;
  updateEnemyShots = function (dt) {
    for (const s of enemyShots) if (s.warnT !== undefined) s.warnT -= dt;
    return baseUpd.call(this, dt);
  };
  drawEnemyShots = function () {
    const t = performance.now() / 1000;
    for (const s of enemyShots) {
      if (s.warnT === undefined) continue;
      const p = clamp(1 - s.warnT / MOR_FLIGHT, 0, 1), x = s.warnX - cam;
      ctx.save();
      ctx.fillStyle = 'rgba(255,40,30,' + (0.12 + 0.28 * p) + ')';
      ctx.beginPath(); ctx.ellipse(x, GROUND_Y + 1, MOR_SPLASH * p, 8 * p + 1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,70,50,' + (0.55 + 0.35 * Math.abs(Math.sin(t * 14))) + ')'; ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.ellipse(x, GROUND_Y + 1, MOR_SPLASH, 9, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    return baseDraw.apply(this, arguments);
  };
})();

// ---------- สร้างตัว ----------
function makeMortar(x) {
  return { type: 'mortar', x: x, y: GROUND_Y - MOR_H, w: MOR_W, h: MOR_H, hp: MOR_HP, maxHp: MOR_HP, armor: MOR_ARMOR, homeX: x, dir: -1, flash: 0, phase: Math.random() * 6, vx: 0, cd: 1.6 + Math.random() * 1.2, recoil: 0 };
}
function makeGatling(x) {
  return { type: 'gatling', x: x, y: GROUND_Y - GAT_H, w: GAT_W, h: GAT_H, hp: GAT_HP, maxHp: GAT_HP, armor: GAT_ARMOR, homeX: x, dir: -1, flash: 0, phase: Math.random() * 6, vx: 0, cd: 1.5 + Math.random() * 1.2, st: 'idle', t: 0, rot: 0, rate: 0, aim: Math.PI, fireFlash: 0 };
}
function makeDropship(x, cargo, y) {
  return { type: 'dropship', x: x, y: y || DSH_Y, w: DSH_W, h: DSH_H, hp: DSH_HP, maxHp: DSH_HP, armor: DSH_ARMOR, homeX: x, baseY: y || DSH_Y, dir: -1, flash: 0, phase: Math.random() * 6, vx: 0, st: 'in', t: 0, bay: 0, cargo: cargo || 'walker', loaded: true, rotor: 0 };
}

// ---------- Mortar Crawler ----------
function updateMortar(e, dt, pcx, pcy) {
  if (e.kx) { e.x = clamp(e.x + e.kx * dt, 0, WORLD_W - e.w); e.kx *= Math.pow(0.01, dt); if (Math.abs(e.kx) < 5) e.kx = 0; }
  e.recoil = Math.max(0, e.recoil - dt * 4);
  const cx = e.x + e.w / 2, dx = pcx - cx, adx = Math.abs(dx), toward = Math.sign(dx) || 1;
  const onScreen = cx > cam + 10 && cx < cam + W - 10;
  e.dir = toward;
  let tgt = 0;
  if (!onScreen) tgt = toward * MOR_SPEED * 1.4;
  else if (adx < MOR_MIN) tgt = -toward * MOR_SPEED;
  else if (adx > MOR_MAX) tgt = toward * MOR_SPEED;
  e.vx += clamp(tgt - e.vx, -400 * dt, 400 * dt);
  e.x += e.vx * dt;
  enemyLimit(e);
  e.y = GROUND_Y - e.h;
  e.cd -= dt;
  if (e.cd <= 0 && onScreen && !player.dead && adx < MOR_RANGE && adx > MOR_FIRE_MIN) {
    const x0 = cx + toward * 14, y0 = e.y + 2, tx = clamp(pcx, cam + 16, cam + W - 16);
    const vx = (tx - x0) / MOR_FLIGHT, vy = (GROUND_Y - y0 - 0.5 * MOR_G * MOR_FLIGHT * MOR_FLIGHT) / MOR_FLIGHT;
    enemyShots.push({ x: x0, y: y0, vx: vx, vy: vy, g: MOR_G, dmg: MOR_DMG, life: MOR_FLIGHT + 1, r: 6, big: true, kind: 'bomb', splash: MOR_SPLASH, sc: 0.8, warnX: tx, warnT: MOR_FLIGHT });
    e.recoil = 1; e.cd = MOR_CD * (0.9 + Math.random() * 0.3);
    spawnSparks(x0, y0, 6, '#ffd9a0'); addShake(1.5);
  }
}

function drawMortar(e, sx, sy, flash) {
  const f = e.dir > 0 ? 1 : -1, cx = sx + e.w / 2, w = e.w, h = e.h;
  ctx.save();
  ctx.translate(cx, 0); ctx.scale(f, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, GROUND_Y + 2, w * 0.5, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1e1b19'; ctx.fillRect(-w / 2 - 2, sy + h - 13, w + 4, 13);                    // ตีนตะขาบ
  ctx.fillStyle = '#3a342f';
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-w / 2 + 6 + i * 10, sy + h - 6.5, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#4a4239'; const roll = (e.phase * 10 * Math.sign(e.vx || 1)) % 10;
  for (let x = -w / 2 - 2 + roll; x < w / 2 + 2; x += 10) if (x > -w / 2 - 4) ctx.fillRect(x, sy + h - 1, 5, 2);
  ctx.fillStyle = flash ? '#fff' : '#5a604a'; ctx.fillRect(-w / 2, sy + h - 24, w, 12);          // ตัวถัง
  ctx.strokeStyle = '#242a1c'; ctx.lineWidth = 2; ctx.strokeRect(-w / 2 + 1, sy + h - 23, w - 2, 10);
  ctx.fillStyle = flash ? '#fff' : '#737a5d'; ctx.fillRect(-w / 2 + 2, sy + h - 24, 12, 12);
  ctx.fillStyle = flash ? '#fff' : '#6a7054'; ctx.fillRect(-12, sy + h - 32, 26, 9);              // ฐานป้อม
  ctx.save();                                                                                    // ลำกล้องครกเงยขึ้น
  ctx.translate(2, sy + h - 28); ctx.rotate(-1.15);
  const rc = e.recoil * 6;
  ctx.fillStyle = flash ? '#fff' : '#7c858e'; ctx.fillRect(-rc, -5, 32, 10);
  ctx.fillStyle = '#b0b8c0'; ctx.fillRect(26 - rc, -6, 6, 12);
  if (e.recoil > 0.7) { ctx.fillStyle = 'rgba(255,220,150,0.9)'; ctx.beginPath(); ctx.arc(36, 0, 9 * (e.recoil - 0.5) * 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = '#ff5a3c'; ctx.fillRect(w / 2 - 12, sy + h - 20, 5, 3);                         // ตา
  ctx.restore();
}

// ---------- Gatling Crawler ----------
function updateGatling(e, dt, pcx, pcy) {
  if (e.kx) { e.x = clamp(e.x + e.kx * dt, 0, WORLD_W - e.w); e.kx *= Math.pow(0.01, dt); if (Math.abs(e.kx) < 5) e.kx = 0; }
  e.fireFlash = Math.max(0, e.fireFlash - dt);
  const cx = e.x + e.w / 2, dx = pcx - cx, adx = Math.abs(dx), toward = Math.sign(dx) || 1;
  const onScreen = cx > cam + 10 && cx < cam + W - 10;
  e.y = GROUND_Y - e.h;
  let tgt = 0;
  if (e.st === 'idle') {
    e.dir = toward;
    if (adx > GAT_STOP || !onScreen) tgt = toward * GAT_SPEED * (onScreen ? 1 : 1.5);
    e.rot += e.rate * dt; e.rate = Math.max(0, e.rate - 40 * dt);
    e.cd -= dt;
    if (e.cd <= 0 && onScreen && adx < GAT_RANGE && !player.dead) { e.st = 'spin'; e.t = GAT_SPIN; }
  } else if (e.st === 'spin') {                                  // หมุนลำกล้องไล่ความเร็ว = สัญญาณเตือน
    e.t -= dt; e.rate = 8 + 36 * (1 - e.t / GAT_SPIN); e.rot += e.rate * dt;
    if (e.t <= 0) { e.st = 'fire'; e.t = GAT_FIRE; e.rate = 44; e.bGap = 0; e.aim = Math.atan2(pcy - (e.y + 16), pcx - cx); e.fireDir = e.dir; }
  } else {                                                       // สาดกระสุนเป็นพัด
    e.t -= dt; e.rot += e.rate * dt; e.bGap -= dt;
    const want = Math.atan2(pcy - (e.y + 16), pcx - cx), d = Math.atan2(Math.sin(want - e.aim), Math.cos(want - e.aim));
    if (Math.sign(Math.cos(want)) === e.fireDir) e.aim += clamp(d, -0.5 * dt, 0.5 * dt);   // ตามผู้เล่นช้าๆ
    while (e.bGap <= 0 && e.t > 0) {
      const m = gatMuzzle(e), a = e.aim + GAT_FAN * Math.sin((GAT_FIRE - e.t) * 6) + (Math.random() - 0.5) * 0.06;
      enemyShots.push({ x: m.x, y: m.y, vx: Math.cos(a) * GAT_BULLET, vy: Math.sin(a) * GAT_BULLET, dmg: GAT_DMG, life: 1.5, r: 3 });
      e.fireFlash = 0.05; e.bGap += GAT_RATE;
    }
    if (e.t <= 0) { e.st = 'idle'; e.cd = GAT_CD * (0.9 + Math.random() * 0.3); }
  }
  e.vx += clamp(tgt - e.vx, -500 * dt, 500 * dt);
  e.x += e.vx * dt;
  enemyLimit(e);
}
function gatMuzzle(e) {
  const d = e.fireDir || e.dir || -1;
  return { x: e.x + e.w / 2 + d * 44, y: e.y + 16 };
}

function drawGatling(e, sx, sy, flash) {
  const f = e.dir > 0 ? 1 : -1, cx = sx + e.w / 2, w = e.w, h = e.h;
  ctx.save();
  ctx.translate(cx, 0); ctx.scale(f, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, GROUND_Y + 2, w * 0.52, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1e1b19'; ctx.fillRect(-w / 2 - 2, sy + h - 14, w + 4, 14);
  ctx.fillStyle = '#3a342f';
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(-w / 2 + 6 + i * 9.5, sy + h - 7, 4.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#4a4239'; const roll = (e.phase * 10 * Math.sign(e.vx || 1)) % 10;
  for (let x = -w / 2 - 2 + roll; x < w / 2 + 2; x += 10) if (x > -w / 2 - 4) ctx.fillRect(x, sy + h - 1, 5, 2);
  ctx.fillStyle = flash ? '#fff' : '#4d5560'; ctx.fillRect(-w / 2, sy + 12, w, h - 24);          // ตัวถังเตี้ย
  ctx.strokeStyle = '#1d2228'; ctx.lineWidth = 2; ctx.strokeRect(-w / 2 + 1, sy + 13, w - 2, h - 26);
  ctx.fillStyle = flash ? '#fff' : '#6c7684';                                                    // แผ่นเกราะหน้าหนา
  ctx.beginPath(); ctx.moveTo(w / 2 - 22, sy + 6); ctx.lineTo(w / 2 + 4, sy + 12); ctx.lineTo(w / 2 + 4, sy + h - 10); ctx.lineTo(w / 2 - 22, sy + h - 10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2a323a'; ctx.stroke();
  ctx.fillStyle = '#c7a53a'; ctx.fillRect(w / 2 - 14, sy + 16, 12, 3); ctx.fillRect(w / 2 - 14, sy + 22, 12, 3);
  ctx.fillStyle = flash ? '#fff' : '#59626d'; ctx.fillRect(-12, sy + 3, 28, 12);                // ป้อม
  const by = sy + 16, spinning = e.st !== 'idle' || e.rate > 1;                                  // ลำกล้อง 3 อันหมุน
  const ang = e.st === 'fire' ? e.aim : (e.fireDir ? 0 : 0);
  ctx.save(); ctx.translate(12, by);
  if (e.st === 'fire') ctx.rotate(f > 0 ? e.aim : Math.PI - e.aim);
  ctx.fillStyle = '#2a2f35'; ctx.fillRect(0, -7, 8, 14);
  for (let i = 0; i < 3; i++) {
    const o = Math.sin(e.rot + i * 2.094) * (spinning ? 5 : 3);
    ctx.fillStyle = i === 0 ? '#8d99a6' : '#6a7480'; ctx.fillRect(8, o - 1.6, 28, 3.2);
  }
  ctx.fillStyle = '#20252a'; ctx.fillRect(34, -7, 4, 14);
  if (e.st === 'spin') { ctx.fillStyle = 'rgba(255,120,60,' + (0.2 + 0.5 * (1 - e.t / GAT_SPIN)) + ')'; ctx.beginPath(); ctx.arc(38, 0, 5, 0, Math.PI * 2); ctx.fill(); }
  if (e.fireFlash > 0) { ctx.fillStyle = 'rgba(255,230,160,0.95)'; ctx.beginPath(); ctx.arc(42, 0, 8, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = e.st === 'spin' ? '#ffe04a' : '#ff5a3c'; ctx.fillRect(-4, sy + 6, 6, 3);        // ตา (เหลือง = กำลังจะยิง)
  ctx.restore();
}

// ---------- Dropship ----------
function updateDropship(e, dt, pcx, pcy) {
  e.rotor += dt * 40;
  const cx = e.x + e.w / 2;
  e.y = e.baseY + Math.sin(e.phase * 2.4) * 4;
  if (e.st === 'in') {
    e.dir = -1; e.vx = -DSH_SPEED; e.x += e.vx * dt;
    if (cx <= cam + W * 0.62) { e.st = 'hold'; e.t = DSH_STOP; e.vx = 0; }
  } else if (e.st === 'hold') {                                   // เบรกแล้วเปิดช่องท้อง
    e.t -= dt; e.bay = clamp(e.bay + dt / DSH_BAY, 0, 1);
    if (e.t <= -DSH_BAY && e.loaded) { dropCargo(e); e.loaded = false; e.t = 0.5; }
    else if (!e.loaded) { if (e.t <= 0) e.st = 'out'; }
  } else {
    e.dir = 1; e.bay = Math.max(0, e.bay - dt * 2); e.vx = Math.min(DSH_OUT_SPEED, e.vx + 260 * dt); e.x += e.vx * dt;
    if (e.x > cam + W + 160) { const k = enemies.indexOf(e); if (k >= 0) enemies.splice(k, 1); }   // หนีออกจอ ถือว่าไม่นับเป้า
  }
}
function dropCargo(e) {
  const cx = e.x + e.w / 2;
  for (let i = 0; i < DSH_CARGO; i++) {
    const x = cx - 28 + i * 56 - 20;
    const u = e.cargo === 'swanzer' ? makeShotWanzer(x) : makeWalker(x);
    u.x = clamp(u.x, 0, WORLD_W - u.w - 10); u.homeX = u.x; u.hunt = true; u.minion = true;      // ไม่นับในยอดศัตรูด่าน
    scaleEnemyHp(u, ENEMY_HP_MULT);
    enemies.push(u);
    spawnSparks(u.x + u.w / 2, GROUND_Y, 8, '#c9c2b0');
  }
  addShake(2);
}

function drawDropship(e, sx, sy, flash) {
  const f = e.dir > 0 ? 1 : -1, cx = sx + e.w / 2, w = e.w;
  ctx.save();
  ctx.translate(cx, 0); ctx.scale(f, 1);
  ctx.strokeStyle = '#9aa5ae'; ctx.lineWidth = 3;                                                // ใบพัดคู่
  for (const px of [-26, 26]) {
    const rw = 12 + Math.abs(Math.cos(e.rotor + px)) * 16;
    ctx.beginPath(); ctx.moveTo(px - rw, sy - 3); ctx.lineTo(px + rw, sy - 3); ctx.stroke();
    ctx.fillStyle = '#6b7680'; ctx.fillRect(px - 2, sy - 3, 4, 8);
  }
  if (e.bay > 0.05 && e.loaded) {                                                                // ทหารที่ห้อยท้อง
    ctx.fillStyle = '#3a4046';
    for (let i = 0; i < DSH_CARGO; i++) ctx.fillRect(-28 + i * 36, sy + e.h - 2, 20, 12 * e.bay);
  }
  ctx.fillStyle = flash ? '#fff' : '#58606a';                                                    // ลำตัว
  ctx.beginPath(); ctx.moveTo(-w / 2, sy + 12); ctx.quadraticCurveTo(-w / 2 + 6, sy + 2, -w / 2 + 24, sy + 4);
  ctx.lineTo(w / 2 - 6, sy + 4); ctx.lineTo(w / 2 + 4, sy + 16); ctx.lineTo(w / 2 - 10, sy + e.h); ctx.lineTo(-w / 2 + 16, sy + e.h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#242a31'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = flash ? '#fff' : '#3d444c'; ctx.fillRect(-w / 2 + 28, sy + 6, w - 56, 6);
  ctx.fillStyle = flash ? '#fff' : '#9fd8ff'; ctx.beginPath(); ctx.ellipse(w / 2 - 14, sy + 14, 9, 5, 0, 0, Math.PI * 2); ctx.fill();   // กระจกหน้า
  ctx.fillStyle = '#ff5a3c'; ctx.fillRect(-w / 2 + 6, sy + 12, 5, 3);
  const bw = 40 * e.bay;                                                                         // ประตูท้องเปิด
  ctx.fillStyle = '#14181c'; ctx.fillRect(-bw / 2 - 4, sy + e.h - 3, bw, 4);
  ctx.restore();
}
