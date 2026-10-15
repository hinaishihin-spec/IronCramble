'use strict';
/* ==========================================================================
   boss6.js : บอสด่าน 08  MEGA BOLT  (หุ่นตีนตะขาบหลากอาวุธ)
     อาวุธ 3 ชุด ทำงานเป็น "ช่อง" แยกกัน (e.hmg / e.msl / e.las) เพื่อให้ Full Blast สาดพร้อมกันได้
       ปืนกลหนักหน้าตัว  ยิงรัวทีละ 5 นัด สลับ 2 กระบอก ทิศสุ่มรอบตัวผู้เล่น (เหมือนเลเซอร์ 2 สายของ Carrier แต่เป็นกระสุน)
       มิสไซล์ที่ไหล่     ยิงขึ้นฟ้าแล้วโค้งกลับมาตามตัว   (อาวุธรอง)
       เลเซอร์ที่ไหล่     เล็งตาม > ล็อกเส้น > ยิง (เส้นแดงบอกทาง)   (อาวุธรอง)  ท่าเฟส 1 วนเป็น ปืนกล > มิสไซล์ > ปืนกล > เลเซอร์
     เฟส 2 (HP <= phase2Hp)  ทุกอาวุธยิง "ดับเบิ้ลช็อต" (ยิงซ้ำ 2 ชุดติด)
     FULL BLAST  ในเฟส 2 เมื่อ HP ต่ำกว่า 20% ของหลอด: ชาร์จ 1.3 วิ แล้วสาดทั้ง 3 อาวุธพร้อมกัน 1 ครั้ง
                 แล้วซ้ำทุก MB_FB_EVERY วินาที จนกว่าบอสจะตาย
   ค่าตัวเลขอยู่ด้านล่างของไฟล์นี้ (MB_*) ไม่ต้องแก้ config.js
   ========================================================================== */

const MB_W = 250, MB_H = 150;
const MB_HP = 1500, MB_PHASE2_HP = 750, MB_ARMOR = 0.25;
const MB_EXP = 1000, MB_REWARD_GOLD = 900;
const MB_REST = 1.2;                                  // พักระหว่างท่า (วินาที)
const MB_HMG_PER = 5, MB_HMG_GAP = 0.085, MB_HMG_SPREAD = 0.5, MB_HMG_SPEED = 430, MB_HMG_DMG = 5;   // 5 นัด/ชุด  กระจายมุม ±0.25 rad
const MB_MSL_N = 6, MB_MSL_GAP = 0.11, MB_MSL_CHARGE = 0.6, MB_MSL_DMG = 8, MB_MSL_SPEED = 250, MB_MSL_SHIELD = 6;
const MB_LAS_SIGHT = 1.1, MB_LAS_LOCK = 0.7, MB_LAS_SIGHT2 = 0.6, MB_LAS_LOCK2 = 0.3;              // เลเซอร์: เวลาเล็ง/ล็อก (ชุดแรก / ชุดที่ 2 ของดับเบิ้ล)
const MB_LAS_TIME = 0.35, MB_LAS_TICK = 0.16, MB_LAS_DMG = 14, MB_LAS_SHIELD = 12, MB_LAS_HALF = 9;
const MB_DOUBLE_PAUSE = 0.3;                          // เว้นระหว่างช็อตแรกกับช็อตที่สองของดับเบิ้ลช็อต
const MB_ROAR_TIME = 1.4;
const MB_FB_HP = 0.20, MB_FB_EVERY = 20, MB_FB_CHARGE = 1.3;   // Full Blast: เริ่มเมื่อ HP < 20% / ซ้ำทุกกี่วินาที / เวลาชาร์จ
const MB_FB_HMG_SETS = 4, MB_FB_MSL_N = 10;                   // Full Blast: ปืนกลกี่ชุด (ชุดละ 5 นัด) / มิสไซล์ต่อรอบ (เลเซอร์ยิง 2 เส้นต่อเนื่อง)

function makeMegaBolt(startX, lockX) {
  return {
    type: 'boss', kind: 'megabolt', phase2Hp: MB_PHASE2_HP, exp: MB_EXP, reward: MB_REWARD_GOLD,
    x: startX, y: GROUND_Y - MB_H, w: MB_W, h: MB_H, hp: MB_HP, maxHp: MB_HP, armor: MB_ARMOR,
    dir: -1, flash: 0, phase: 0, stage: 1, mode: 'intro', modeT: 0, introT: 0,
    startX: startX, restX: lockX + W - MB_W - 20,
    glow: 0, fireFlash: 0, cd: 1.6, cycle: 0, hmg: null, msl: null, las: null, was: false,
    fbCd: 0, fbCharge: 0, fbCount: 0, charge: 0, recoil: 0, pod: 0
  };
}

// จุดกำเนิดอาวุธ (พิกัดโลก)
function mbHmgPos(e, i) { return { x: e.x - 12, y: e.y + 92 + i * 14 }; }
function mbLaserPos(e) { return { x: e.x + 30, y: e.y + 30 }; }
function mbPodPos(e) { return { x: e.x + 150, y: e.y + 24 }; }

// ---------- ปืนกลหนัก ----------
function mbStartHmg(e, sets) { e.hmg = { n: MB_HMG_PER, per: MB_HMG_PER, sets: sets, gap: 0.05, idx: 0, pause: 0 }; }

function mbFireHmg(e, pcx, pcy, i) {
  const p = mbHmgPos(e, i);
  const a = Math.atan2(pcy - p.y, pcx - p.x) + (Math.random() - 0.5) * MB_HMG_SPREAD;      // สุ่มมุมรอบตัวผู้เล่น
  const spd = MB_HMG_SPEED * (0.92 + Math.random() * 0.16);
  enemyShots.push({ x: p.x, y: p.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg: MB_HMG_DMG, life: 2.4, r: 4, kind: 'hmg' });
  e.fireFlash = 0.05; e.recoil = 1;
  spawnSparks(p.x, p.y, 2, '#ffd36b');
}

function mbUpdateHmg(e, dt, pcx, pcy) {
  const h = e.hmg;
  if (!h) return;
  if (h.pause > 0) { h.pause -= dt; return; }
  h.gap -= dt;
  if (h.gap > 0) return;
  mbFireHmg(e, pcx, pcy, h.idx); h.idx ^= 1; h.n--; h.gap = MB_HMG_GAP;
  if (h.n <= 0) {
    h.sets--;
    if (h.sets <= 0) e.hmg = null;
    else { h.n = h.per; h.pause = MB_DOUBLE_PAUSE; }
  }
}

// ---------- มิสไซล์ไหล่ ----------
function mbStartMsl(e, n, salvos) { e.msl = { t: 0, n: n, per: n, salvos: salvos, gap: 0, pause: 0 }; }

function mbMissile(e) {
  const p = mbPodPos(e);
  const x = p.x + Math.random() * 40 - 10, y = p.y;
  const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
  const spd = MB_MSL_SPEED * (0.9 + Math.random() * 0.25);
  enemyShots.push({
    x: x, y: y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, speed: spd,
    dmg: MB_MSL_DMG, life: 4.2, r: 5, big: false, kind: 'bmissile', shieldCost: MB_MSL_SHIELD,
    turn: 1.8 + Math.random() * 1.0, trackT: 1.0 + Math.random() * 0.9, sc: 0.8
  });
  e.pod = 1;
  spawnSparks(x, y, 2, '#e8e2c8');
}

function mbUpdateMsl(e, dt) {
  const m = e.msl;
  if (!m) return;
  m.t += dt;
  if (m.t < MB_MSL_CHARGE) return;
  if (m.pause > 0) { m.pause -= dt; return; }
  m.gap -= dt;
  if (m.gap > 0) return;
  mbMissile(e); m.n--; m.gap = MB_MSL_GAP; e.fireFlash = 0.04;
  if (m.n <= 0) {
    m.salvos--;
    if (m.salvos <= 0) e.msl = null;
    else { m.n = m.per; m.pause = MB_DOUBLE_PAUSE; }
  }
}

// ---------- เลเซอร์ไหล่ ----------
function mbLaserAngle(e, pcx, pcy) { const p = mbLaserPos(e); return Math.atan2(pcy - p.y, pcx - p.x); }

function mbStartLaser(e, shots, pcx, pcy) {
  e.las = { t: 0, ang: mbLaserAngle(e, pcx, pcy), shots: shots, first: true, firing: false, tick: 0, sight: MB_LAS_SIGHT, lock: MB_LAS_LOCK };
}

function mbBeamLen(p, ang) {
  const dy = Math.sin(ang);
  let len = 1600;
  if (dy > 0.001) len = Math.min(len, (GROUND_Y - p.y) / dy);
  return len;
}

function mbBeamTick(p, ang) {
  const len = mbBeamLen(p, ang), h = MB_LAS_HALF, c = Math.cos(ang), s = Math.sin(ang);
  if (player.dead) return;
  for (let d = 0; d <= len; d += 8) {
    const x = p.x + c * d, y = p.y + s * d;
    if (x >= player.x - h && x <= player.x + player.w + h && y >= player.y - h && y <= player.y + player.h + h) {
      damagePlayer(MB_LAS_DMG, MB_LAS_SHIELD);
      spawnSparks(player.x + player.w / 2, player.y + player.h / 2, 8, player.shieldUp ? '#4fc3f7' : '#ff8a5c');
      return;
    }
  }
}

function mbUpdateLaser(e, dt, pcx, pcy) {
  const l = e.las;
  if (!l) return;
  const p = mbLaserPos(e);
  l.t += dt;
  if (l.t < l.lock) l.ang = mbLaserAngle(e, pcx, pcy);                       // เล็งตามแล้วล็อกเส้น
  if (l.t >= l.sight) {
    l.firing = true;
    l.tick -= dt;
    if (l.tick <= 0) { mbBeamTick(p, l.ang); l.tick = MB_LAS_TICK; addShake(2); }
    if (l.t >= l.sight + MB_LAS_TIME) {
      l.shots--;
      if (l.shots <= 0) { e.las = null; return; }
      l.t = 0; l.firing = false; l.tick = 0; l.first = false; l.sight = MB_LAS_SIGHT2; l.lock = MB_LAS_LOCK2;   // ช็อตที่ 2: เล็งไวขึ้น
      l.ang = mbLaserAngle(e, pcx, pcy);
    }
  }
}

// ---------- FULL BLAST ----------
function mbLaunchFullBlast(e, pcx, pcy) {
  e.fbCharge = 0; e.fbCount++;
  mbStartHmg(e, MB_FB_HMG_SETS);
  mbStartMsl(e, MB_FB_MSL_N, 1);
  e.msl.t = MB_MSL_CHARGE;                                  // ชาร์จมาแล้ว
  mbStartLaser(e, 2, pcx, pcy);
  addShake(10);
  mission.whiteFlash = Math.max(mission.whiteFlash || 0, 0.25);
  popText(e.x + e.w / 2, e.y - 28, 'FULL BLAST!!', '#ff4a30', 26);
}

// ---------- สมอง ----------
function updateMegaBolt(e, dt, pcx, pcy) {
  bossCommon(e, dt);
  e.recoil = Math.max(0, e.recoil - dt * 8);
  e.pod = Math.max(0, e.pod - dt * 3);
  if (e.mode === 'intro') { bossIntroSlide(e, dt); e.y = GROUND_Y - e.h; return; }

  if (e.mode === 'roar') {                                   // เข้าเฟส 2: คำรามแล้วเริ่มดับเบิ้ลช็อต
    e.modeT += dt;
    addShake(2);
    if (Math.random() < dt * 20) smallBoom(e.x + Math.random() * e.w, e.y + Math.random() * e.h * 0.6, 12 + Math.random() * 12);
    if (e.modeT >= MB_ROAR_TIME) { e.mode = 'fight'; e.cd = 0.6; }
    return;
  }
  if (e.stage === 1 && e.hp <= e.phase2Hp) {
    e.stage = 2; e.mode = 'roar'; e.modeT = 0; e.hmg = e.msl = e.las = null; e.fbCharge = 0; e.charge = 0;
    addShake(9);
    popText(e.x + e.w / 2, e.y - 14, 'PHASE 2', '#ff4a30', 24);
    smallBoom(e.x + e.w / 2, e.y + 50, 40);
    spawnSparks(e.x + e.w / 2, e.y + 40, 20, '#ff4a30');
    return;
  }
  if (player.dead) { e.hmg = e.msl = e.las = null; e.fbCharge = 0; e.charge = 0; return; }

  const fbOn = e.stage === 2 && e.hp < e.maxHp * MB_FB_HP;    // เงื่อนไข Full Blast
  if (fbOn && e.fbCd > 0) e.fbCd -= dt;

  if (e.fbCharge > 0) {                                      // กำลังชาร์จ Full Blast (ยืนนิ่ง เรืองแสง)
    e.fbCharge -= dt;
    e.charge = clamp(1 - e.fbCharge / MB_FB_CHARGE, 0, 1);
    if (Math.random() < dt * 40) spawnSparks(e.x + Math.random() * e.w, e.y + Math.random() * 40, 1, '#ffb13b');
    if (e.fbCharge <= 0) { e.charge = 0; mbLaunchFullBlast(e, pcx, pcy); e.fbCd = MB_FB_EVERY - MB_FB_CHARGE; e.was = true; }   // นับให้ยิงห่างกัน MB_FB_EVERY วินาทีพอดี (หักเวลาชาร์จ)
    return;
  }

  if (fbOn && e.fbCd <= 0) {                                 // ถึงเวลา Full Blast (ครั้งแรกทันทีที่ HP < 20% แล้วซ้ำทุก 20 วิ) ตัดท่าที่ค้างอยู่ทันที
    e.hmg = e.msl = e.las = null; e.fbCharge = MB_FB_CHARGE;
    popText(e.x + e.w / 2, e.y - 14, 'FULL BLAST', '#ffb13b', 18);
    return;
  }
  mbUpdateHmg(e, dt, pcx, pcy); mbUpdateMsl(e, dt); mbUpdateLaser(e, dt, pcx, pcy);
  e.charge = e.las ? clamp(e.las.t / e.las.sight, 0, 1) : (e.msl ? clamp(e.msl.t / MB_MSL_CHARGE, 0, 1) : 0);

  const busy = !!(e.hmg || e.msl || e.las);
  if (busy) { e.was = true; return; }
  if (e.was) { e.was = false; e.cd = MB_REST; }
  e.cd -= dt;
  if (e.cd > 0) return;

  const dbl = e.stage === 2 ? 2 : 1;
  const pat = e.cycle++ % 4;                                 // ปืนกล > มิสไซล์ > ปืนกล > เลเซอร์
  if (pat === 0 || pat === 2) mbStartHmg(e, dbl);
  else if (pat === 1) mbStartMsl(e, MB_MSL_N, dbl);
  else mbStartLaser(e, dbl, pcx, pcy);
}

// ---------- วาด ----------
function drawMegaBoltBeam(e) {
  const l = e.las;
  if (!l) return;
  const p = mbLaserPos(e), a = l.ang, len = mbBeamLen(p, a);
  const x0 = p.x - cam, y0 = p.y, x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
  ctx.lineCap = 'round';
  if (!l.firing) {
    const locked = l.t >= l.lock, blink = locked ? (Math.floor(l.t * 24) % 2 ? 1 : 0.45) : 1, urg = clamp(l.t / l.sight, 0, 1);
    ctx.strokeStyle = 'rgba(255,40,30,' + (0.16 + 0.2 * urg) * blink + ')'; ctx.lineWidth = locked ? 7 : 5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,80,60,' + (0.5 + 0.5 * urg) * blink + ')'; ctx.lineWidth = locked ? 2.5 : 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  } else {
    const k = 1 - clamp((l.t - l.sight) / MB_LAS_TIME, 0, 1) * 0.5;
    ctx.strokeStyle = 'rgba(255,60,40,' + 0.35 * k + ')'; ctx.lineWidth = 3 + MB_LAS_HALF * 2 * k;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,210,180,' + 0.9 * k + ')'; ctx.lineWidth = 4 * k + 1;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
}

function drawMegaBolt(e, sx, sy, flash) {
  const g = e.glow || 0, t = performance.now(), ch = e.charge || 0, fb = e.fbCharge > 0;
  const c = function (normal) { return flash ? '#ffffff' : normal; };
  drawMegaBoltBeam(e);

  ctx.save();
  ctx.translate(sx, sy);
  const rc = e.recoil || 0;

  // ตีนตะขาบ (รางโซ่ยาว)
  ctx.fillStyle = '#171b1f'; ctx.fillRect(0, 112, 250, 38);
  ctx.strokeStyle = '#0b0d0f'; ctx.lineWidth = 2; ctx.strokeRect(1, 113, 248, 36);
  ctx.fillStyle = '#323b44';
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(18 + i * 27, 131, 12, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#566370';
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(18 + i * 27, 131, 5, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#0b0d0f';
  for (let i = 0; i < 25; i++) ctx.fillRect(4 + i * 10 + (Math.floor(t / 90) % 2) * 2, 112, 3, 3);     // ลายโซ่

  // ฐานลำตัว
  ctx.fillStyle = c('#4d5a43');
  ctx.beginPath(); ctx.moveTo(8, 114); ctx.lineTo(0, 88); ctx.lineTo(26, 72); ctx.lineTo(226, 72); ctx.lineTo(248, 92); ctx.lineTo(240, 114); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1a2016'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = c(g > 0.3 ? '#b02a1c' : '#d9a21e'); ctx.fillRect(30, 100, 190, 7);                  // แถบสีข้างลำตัว
  ctx.fillStyle = c('#62704f'); ctx.fillRect(36, 77, 60, 9); ctx.fillRect(140, 77, 80, 9);

  // สายฟ้าบนลำตัว (ตราประจำตัว Mega Bolt)
  ctx.fillStyle = c(g > 0.3 ? '#ff6a3c' : '#ffd23f');
  ctx.beginPath(); ctx.moveTo(122, 80); ctx.lineTo(108, 96); ctx.lineTo(118, 96); ctx.lineTo(110, 110); ctx.lineTo(134, 91); ctx.lineTo(123, 91); ctx.lineTo(132, 80); ctx.closePath(); ctx.fill();

  // ปืนกลหนัก 2 กระบอกหน้าตัว (ถอยหลังนิดตอนยิง)
  for (let i = 0; i < 2; i++) {
    const ly = 92 + i * 14, k = rc * (e.hmg && e.hmg.idx === i ? 0 : 1) * 3;
    ctx.fillStyle = '#14181c'; ctx.fillRect(-14 + k, ly - 4, 44, 8);
    ctx.fillStyle = '#2d3a46'; ctx.fillRect(2 + k, ly - 6, 20, 3);
    ctx.fillStyle = '#0b0d0f'; ctx.fillRect(-18 + k, ly - 5, 6, 10);
    if (e.fireFlash > 0 && e.hmg) { ctx.fillStyle = 'rgba(255,220,120,0.9)'; ctx.beginPath(); ctx.arc(-18, ly, 6, 0, Math.PI * 2); ctx.fill(); }
  }

  // ลำตัวบน / ห้องนักบิน
  ctx.fillStyle = c('#58664c');
  ctx.beginPath(); ctx.moveTo(60, 74); ctx.lineTo(70, 36); ctx.lineTo(176, 36); ctx.lineTo(196, 74); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1a2016'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = fb ? 'rgb(255,' + Math.floor(120 - 90 * ch) + ',60)' : c(g > 0.3 ? '#ff6a3c' : '#8fd0ee');   // กระจก/ตาเซนเซอร์
  ctx.fillRect(78, 46, 52, 12);
  ctx.fillStyle = '#2a3138'; for (let i = 0; i < 4; i++) ctx.fillRect(138 + i * 12, 44, 7, 20);

  // เลเซอร์ที่ไหล่หน้า
  const lp = mbLaserPos(e), lx = lp.x - e.x, ly = lp.y - e.y, lch = e.las ? e.charge : 0;
  ctx.fillStyle = c('#4d5a43'); ctx.fillRect(lx - 14, ly - 12, 54, 24);
  ctx.strokeStyle = '#1a2016'; ctx.lineWidth = 2; ctx.strokeRect(lx - 14, ly - 12, 54, 24);
  ctx.fillStyle = '#14181c'; ctx.fillRect(lx - 34, ly - 5, 32, 10);
  ctx.fillStyle = e.las ? 'rgb(255,' + Math.floor(120 - 80 * lch) + ',' + Math.floor(80 - 60 * lch) + ')' : '#7a2a20';
  ctx.fillRect(lx - 40, ly - 6, 7, 12);
  if (lch > 0.05 || fb) {
    const k = fb ? ch : lch;
    ctx.fillStyle = 'rgba(255,90,60,' + (0.3 + 0.6 * k) + ')';
    ctx.beginPath(); ctx.arc(lx - 40, ly, 3 + 10 * k, 0, Math.PI * 2); ctx.fill();
  }

  // แท่นมิสไซล์ที่ไหล่หลัง
  const pp = mbPodPos(e), px = pp.x - e.x, py = pp.y - e.y, open = e.msl ? Math.min(1, e.msl.t / MB_MSL_CHARGE) : 0;
  ctx.fillStyle = c('#3f4a37'); ctx.fillRect(px - 8, py - 6, 70, 28);
  ctx.strokeStyle = '#1a2016'; ctx.lineWidth = 2; ctx.strokeRect(px - 8, py - 6, 70, 28);
  ctx.fillStyle = '#0b0d0f';
  for (let i = 0; i < 4; i++) { ctx.fillRect(px - 2 + i * 16, py - 6 - 4 * open, 11, 5 + 4 * open); }
  if (open > 0.5) {
    ctx.fillStyle = '#d9d4b8';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(px - 1 + i * 16, py - 5); ctx.lineTo(px + 10 + i * 16, py - 5); ctx.lineTo(px + 4.5 + i * 16, py - 14); ctx.closePath(); ctx.fill(); }
  }
  if (e.pod > 0) { ctx.fillStyle = 'rgba(255,230,160,' + e.pod * 0.8 + ')'; ctx.beginPath(); ctx.arc(px + 20, py - 8, 8 * e.pod + 3, 0, Math.PI * 2); ctx.fill(); }

  // ออร่า Full Blast
  if (fb) {
    ctx.fillStyle = 'rgba(255,120,40,' + (0.12 + 0.28 * ch) * (0.7 + 0.3 * Math.sin(t / 40)) + ')';
    ctx.fillRect(-20, 20, 290, 130);
  }
  ctx.restore();
}
