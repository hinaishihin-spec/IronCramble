'use strict';
/* ==========================================================================
   boss2.js : บอสของด่าน 03 และ 04 + ตัวเลือกบอสตามชนิด (kind)
     'fortress'  Mobile Fortress  (ด่าน 02, boss.js)
     'hopper'    Giant Hopper     (ด่าน 03) เฮลิคอปเตอร์โจมตียักษ์ บินสูง ตามแกน X ช้าๆ ยิงมิสไซล์ฝูงเฉียงลงทุก 3 วินาที
     'sniper'    Boss Sniper      (ด่าน 04) หุ่นสไนเปอร์ยักษ์ ยืนนิ่งขอบจอขวา เลเซอร์ไซต์ 1.5 วินาทีแล้วยิงกระสุนเร็ว
   ในด่าน: boss: { at, name, kind }  — บอสทุกตัวเป็น type 'boss' ใช้ระบบกล้องล็อก/ป้าย WARNING/ฉากพัง/รางวัลชุดเดียวกัน
   ========================================================================== */

// สร้างบอสตามชนิดที่ด่านระบุ (เรียกจาก mission.js ตอนผู้เล่นเดินถึงระยะบอส)
function makeBossFor(def, lockX) {
  const startX = lockX + W + 30;
  if (def.kind === 'hopper') return makeHopper(startX, lockX);
  if (def.kind === 'sniper') return makeBossSniper(startX, lockX);
  if (def.kind === 'bomber') return makeGiantBomber(startX, lockX);       // boss3.js
  if (def.kind === 'mimic') return makeMimic(startX, lockX);              // boss4.js
  if (def.kind === 'carrier') return makeCarrier(startX, lockX);          // boss5.js
  if (def.kind === 'megabolt') return makeMegaBolt(startX, lockX);        // boss6.js
  if (def.kind === 'acewanzer') return makeAce(startX, lockX);            // boss7.js
  if (def.kind === 'assembly') return makeAssemblyArm(startX, lockX);     // boss8.js
  return makeBoss(startX, lockX + W - BOSS_W - 24, lockX + W * 0.52);
}

function updateBoss(e, dt, pcx, pcy) {
  if (e.kind === 'hopper') updateHopper(e, dt, pcx, pcy);
  else if (e.kind === 'sniper') updateBossSniper(e, dt, pcx, pcy);
  else if (e.kind === 'bomber') updateGiantBomber(e, dt, pcx, pcy);
  else if (e.kind === 'mimic') updateMimic(e, dt, pcx, pcy);
  else if (e.kind === 'carrier') updateCarrier(e, dt, pcx, pcy);
  else if (e.kind === 'megabolt') updateMegaBolt(e, dt, pcx, pcy);
  else if (e.kind === 'acewanzer') updateAce(e, dt, pcx, pcy);
  else if (e.kind === 'assembly') updateAssemblyArm(e, dt, pcx, pcy);
  else updateFortress(e, dt, pcx, pcy);
}

function drawBoss(e, sx, sy, flash) {
  if (drawEnemyArt(e, e.kind === 'carrier' && e.lift ? sx + (Math.random() - 0.5) * 3 * e.lift : sx, sy, flash)) {    // ภาพวาด assets/enemies/boss_<kind>.png (enemyart.js)
    if (e.kind === 'carrier') drawCarrierBeams(e);
    else if (e.kind === 'megabolt') drawMegaBoltBeam(e);
    else if (e.kind === 'assembly') drawAssemblyFx(e);
    return;
  }
  if (e.kind === 'hopper') drawHopper(e, sx, sy, flash);
  else if (e.kind === 'sniper') drawBossSniper(e, sx, sy, flash);
  else if (e.kind === 'bomber') drawGiantBomber(e, sx, sy, flash);
  else if (e.kind === 'mimic') drawMimic(e, sx, sy, flash);
  else if (e.kind === 'carrier') drawCarrier(e, sx, sy, flash);
  else if (e.kind === 'megabolt') drawMegaBolt(e, sx, sy, flash);
  else if (e.kind === 'acewanzer') drawAce(e, sx, sy, flash);
  else if (e.kind === 'assembly') drawAssemblyArm(e, sx, sy, flash);
  else drawFortress(e, sx, sy, flash);
}

// ---------- ส่วนที่ใช้ร่วมกัน ----------
// ช่วงบอสเลื่อนเข้าจอระหว่างป้าย WARNING (ตอนนี้บอสยังโดนยิงไม่ได้ e.mode === 'intro') คืน true ถ้ายังเลื่อนอยู่
function bossIntroSlide(e, dt) {
  e.introT += dt;
  const p = clamp(e.introT / BOSS_WARN_TIME, 0, 1);
  e.x = e.startX + (e.restX - e.startX) * (1 - (1 - p) * (1 - p));
  if (p >= 1) { mission.bossState = 'fight'; e.mode = 'fight'; e.modeT = 0; return false; }
  return true;
}

// HP ต่ำกว่าเกณฑ์ = เฟส 2 (คำรามสั้นๆ พร้อมแสงแดง)
function bossStageCheck(e) {
  if (e.stage === 1 && e.hp <= e.phase2Hp) {
    e.stage = 2;
    e.mode = 'roar'; e.modeT = 0;
    e.sight = null; e.salvo = 0; e.charge = 0;
    addShake(9);
    popText(e.x + e.w / 2, e.y - 14, 'PHASE 2', '#ff4a30', 24);
    smallBoom(e.x + e.w / 2, e.y + e.h / 2, 40);
    spawnSparks(e.x + e.w / 2, e.y + e.h / 2, 20, '#ff4a30');
  }
}

function bossCommon(e, dt) {
  e.glow += ((e.stage === 2 ? 1 : 0) - e.glow) * Math.min(1, dt * 1.5);
  e.fireFlash = Math.max(0, (e.fireFlash || 0) - dt);
  if (e.hp < e.phase2Hp * 0.6 && Math.random() < dt * 14) {       // ควันไฟเมื่อ HP ต่ำ
    spawnSparks(e.x + Math.random() * e.w, e.y + Math.random() * e.h, 1, Math.random() < 0.5 ? '#ff6a3c' : '#8a8f98');
  }
}

// ==========================================================================
//  GIANT HOPPER (ด่าน 03)
// ==========================================================================
function makeHopper(startX, lockX) {
  return {
    type: 'boss', kind: 'hopper', phase2Hp: HOPPER_PHASE2_HP, exp: HOPPER_EXP, reward: HOPPER_REWARD_GOLD,
    x: startX, y: HOPPER_Y, w: HOPPER_W, h: HOPPER_H, hp: HOPPER_HP, maxHp: HOPPER_HP, armor: HOPPER_ARMOR,
    dir: -1, flash: 0, phase: 0, stage: 1, mode: 'intro', modeT: 0, introT: 0,
    startX: startX, restX: lockX + W - HOPPER_W - 40,
    minX: lockX + 8, maxX: lockX + W - HOPPER_W - 8,                // ขอบเขตบินในจอที่ล็อกไว้
    glow: 0, fireFlash: 0, cd: 1.6, charge: 0, salvo: 0, salvoN: 0, salvoT: 0
  };
}

function updateHopper(e, dt, pcx, pcy) {
  bossCommon(e, dt);
  e.y = HOPPER_Y + Math.sin(e.phase * 1.6) * 6;
  if (e.mode === 'intro') { bossIntroSlide(e, dt); return; }
  bossStageCheck(e);

  const cx = e.x + e.w / 2;
  e.dir = Math.sign(pcx - cx) || e.dir;

  if (e.mode === 'roar') {
    e.modeT += dt;
    if (e.modeT >= 1.2) { e.mode = 'fight'; e.cd = 1.0; }
    return;
  }

  // ตามแกน X ของผู้เล่นช้าๆ (เฟส 2 เร็วขึ้น)
  const sp = e.stage === 2 ? HOPPER_SPEED2 : HOPPER_SPEED;
  const want = clamp(player.dead ? e.x : pcx - e.w / 2, e.minX, e.maxX);
  e.x += clamp(want - e.x, -sp * dt, sp * dt);

  if (player.dead) { e.charge = 0; e.salvo = 0; return; }

  // ยิงเป็นฝูงทุก 3 วินาที: แท่นยิงเรืองแสงเตือน -> ปล่อยมิสไซล์ทีละลูกรัวๆ
  if (e.salvo <= 0) {
    e.cd -= dt;
    e.charge = e.cd < HOPPER_WINDUP ? clamp(1 - e.cd / HOPPER_WINDUP, 0, 1) : 0;
    if (e.cd <= 0) {
      e.cd = HOPPER_FIRE_CD;
      e.charge = 0;
      e.salvoN = e.salvo = e.stage === 2 ? HOPPER_SWARM2 : HOPPER_SWARM;
      e.salvoT = 0;
      addShake(4);
    }
  }
  if (e.salvo > 0) {
    e.salvoT -= dt;
    if (e.salvoT <= 0) {
      const idx = e.salvoN - e.salvo;
      const px = e.x + e.w / 2 + (idx % 2 ? 22 : -22), py = e.y + e.h - 6;
      const base = clamp(Math.atan2(pcy - py, pcx - px), 0.6, Math.PI - 0.6);         // เฉียงลงเข้าหาผู้เล่น
      const step = e.stage === 2 ? 0.2 : 0.22;
      const a = clamp(base + (idx - (e.salvoN - 1) / 2) * step, 0.3, Math.PI - 0.3);   // กางเป็นพัด
      const spd = HOPPER_MISSILE_SPEED + Math.random() * 30;
      enemyShots.push({
        x: px, y: py, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        speed: spd, dmg: HOPPER_MISSILE_DMG, life: 3.6, r: 6, big: true, kind: 'bmissile',
        shieldCost: HOPPER_MISSILE_SHIELD_COST, turn: 0.7, trackT: 1.2
      });
      spawnSparks(px, py, 3, '#e8e2c8');
      e.fireFlash = 0.06;
      e.salvo--;
      e.salvoT = 0.09;
    }
  }
}

function drawHopper(e, sx, sy, flash) {
  const g = e.glow || 0;
  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 110);
  const c = function (normal) { return flash ? '#ffffff' : normal; };
  ctx.save();
  ctx.translate(sx + e.w / 2, sy + e.h / 2);
  if (g > 0.02) {                                               // แสงแดงรอบตัวในเฟส 2
    const gr = ctx.createRadialGradient(0, 0, 20, 0, 0, 150);
    gr.addColorStop(0, 'rgba(255,50,30,' + (0.34 * g * pulse) + ')');
    gr.addColorStop(1, 'rgba(255,50,30,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(-170, -150, 340, 300);
  }
  if (e.dir < 0) ctx.scale(-1, 1);                              // วาดหันขวา (จมูก +x) แล้วกลับด้านตามทิศผู้เล่น

  // หางยาว + ใบพัดหาง
  ctx.fillStyle = c('#3d4651');
  ctx.beginPath(); ctx.moveTo(-30, -8); ctx.lineTo(-76, -4); ctx.lineTo(-76, 4); ctx.lineTo(-30, 12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c('#2c333b');
  ctx.fillRect(-80, -22, 6, 26);
  const tr = Math.sin(e.phase * 38) * 12;
  ctx.strokeStyle = 'rgba(190,200,210,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-77, -10 - tr); ctx.lineTo(-77, -10 + tr); ctx.stroke();

  // สกิด
  ctx.strokeStyle = '#1a1f24';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-34, 30); ctx.lineTo(36, 30); ctx.moveTo(-22, 14); ctx.lineTo(-22, 30); ctx.moveTo(22, 14); ctx.lineTo(22, 30); ctx.stroke();

  // ปีกกระเปาะมิสไซล์ซ้าย/ขวา (เรืองแสงเตือนก่อนยิง)
  const ch = e.charge || 0;
  for (const px of [-24, 18]) {
    ctx.fillStyle = c('#2c333b');
    ctx.fillRect(px - 2, 12, 26, 14);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = ch > 0 ? 'rgba(255,' + Math.round(200 - 130 * ch) + ',60,' + (0.55 + 0.45 * ch) + ')' : '#7a2a20';
      ctx.beginPath(); ctx.arc(px + 3 + i * 6, 19, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ลำตัวหลัก
  ctx.fillStyle = c('#4a5560');
  ctx.beginPath(); ctx.ellipse(0, 0, 54, 24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a1f24';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = c(g > 0.3 ? '#a02a1c' : '#9a6b24');            // แถบสีบนลำตัว
  ctx.fillRect(-30, -4, 50, 6);
  ctx.fillStyle = c('#5a6672');                                 // แผ่นเกราะบน
  ctx.fillRect(-26, -22, 52, 8);
  // กระจกห้องนักบิน
  ctx.fillStyle = c(g > 0.3 ? '#ff6a4a' : '#8fd0ee');
  ctx.beginPath(); ctx.ellipse(34, -4, 17, 11, -0.1, Math.PI, Math.PI * 2.2); ctx.fill();
  ctx.fillRect(18, -5, 32, 8);
  // ปืนเล็กใต้จมูก
  ctx.fillStyle = '#1a1f24';
  ctx.fillRect(40, 10, 18, 4);

  // ใบพัดหลัก 2 ชั้น
  ctx.fillStyle = '#6b7680';
  ctx.fillRect(-4, -34, 8, 12);
  const rw = 78 + Math.abs(Math.cos(e.phase * 26)) * 22;
  ctx.strokeStyle = 'rgba(200,210,220,0.5)';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-rw, -35); ctx.lineTo(rw, -35); ctx.stroke();
  ctx.strokeStyle = 'rgba(200,210,220,0.22)';
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(-rw * 0.9, -35); ctx.lineTo(rw * 0.9, -35); ctx.stroke();

  if (e.fireFlash > 0) {
    ctx.fillStyle = 'rgba(255,230,160,0.8)';
    ctx.beginPath(); ctx.arc(0, 26, 12, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ==========================================================================
//  BOSS SNIPER (ด่าน 04)
// ==========================================================================
function makeBossSniper(startX, lockX) {
  return {
    type: 'boss', kind: 'sniper', phase2Hp: BSNIPER_PHASE2_HP, exp: BSNIPER_EXP, reward: BSNIPER_REWARD_GOLD,
    x: startX, y: GROUND_Y - BSNIPER_H, w: BSNIPER_W, h: BSNIPER_H, hp: BSNIPER_HP, maxHp: BSNIPER_HP, armor: BSNIPER_ARMOR,
    dir: -1, flash: 0, phase: 0, stage: 1, mode: 'intro', modeT: 0, introT: 0,
    startX: startX, restX: lockX + W - BSNIPER_W - 20,            // ยืนนิ่งที่ขอบจอขวา
    glow: 0, fireFlash: 0, cd: 1.4, sight: null, rifle: Math.PI,
    gx: 28, gy: 46, gl: 86                                          // ไหล่ปืน + ลำกล้องยาวกว่าสไนเปอร์ทั่วไป
  };
}

function updateBossSniper(e, dt, pcx, pcy) {
  bossCommon(e, dt);
  if (e.mode === 'intro') { bossIntroSlide(e, dt); sniperTurn(e, dt, pcx, pcy, false); return; }
  bossStageCheck(e);

  if (e.mode === 'roar') {
    e.modeT += dt;
    sniperTurn(e, dt, pcx, pcy, false);
    if (e.modeT >= 1.2) { e.mode = 'fight'; e.cd = 0.8; }
    return;
  }
  if (player.dead) { e.sight = null; sniperTurn(e, dt, pcx, pcy, false); return; }

  if (e.sight) {
    e.sight.t += dt;
    sniperTurn(e, dt, pcx, pcy, e.sight.t >= SNIPER_LOCK_AT);       // 1.1 วินาทีแรกเล็งตามผู้เล่น จากนั้นล็อกเส้น
    if (e.sight.t >= SNIPER_SIGHT_TIME) {                           // ครบ 1.5 วินาที -> ยิง (เฟส 2 ยิง 2 เส้นพร้อมกัน)
      for (const off of e.sight.offs) fireSnipe(e, e.rifle + off, BSNIPER_DMG);
      e.fireFlash = 0.12;
      e.sight = null;
      e.cd = e.stage === 2 ? BSNIPER_REST2 : BSNIPER_REST;
    }
  } else {
    sniperTurn(e, dt, pcx, pcy, false);
    e.cd -= dt;
    if (e.cd <= 0) {
      const offs = e.stage === 2 ? [0, (Math.random() < 0.5 ? -1 : 1) * BSNIPER_OFFSET2] : [0];
      e.sight = { t: 0, offs: offs };
    }
  }
}

function drawBossSniper(e, sx, sy, flash) {
  const g = e.glow || 0;
  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 110);
  const c = function (normal) { return flash ? '#ffffff' : normal; };
  ctx.save();
  ctx.translate(sx, sy);
  if (g > 0.02) {
    const gr = ctx.createRadialGradient(42, 70, 20, 42, 70, 130);
    gr.addColorStop(0, 'rgba(255,50,30,' + (0.34 * g * pulse) + ')');
    gr.addColorStop(1, 'rgba(255,50,30,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(-90, -60, 270, 260);
  }
  // ขาหนาสองข้าง + เท้า
  ctx.fillStyle = c('#2c333b');
  ctx.fillRect(14, 84, 22, 40); ctx.fillRect(48, 84, 22, 40);
  ctx.fillStyle = c('#1d2329');
  ctx.fillRect(8, 120, 32, 10); ctx.fillRect(44, 120, 32, 10);
  // ลำตัว
  ctx.fillStyle = c('#4d5a66');
  ctx.beginPath();
  ctx.moveTo(10, 90); ctx.lineTo(8, 40); ctx.lineTo(22, 26); ctx.lineTo(66, 26); ctx.lineTo(78, 40); ctx.lineTo(74, 90);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1a1f24';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = c(g > 0.3 ? '#a02a1c' : '#6d7a47');           // แผงเกราะอก
  ctx.fillRect(24, 56, 36, 14);
  ctx.fillStyle = c('#5f6e7b');                                 // เกราะไหล่
  ctx.fillRect(14, 30, 24, 12);
  // หัว + ตา
  ctx.fillStyle = c('#5f6e7b');
  ctx.fillRect(28, 4, 34, 24);
  ctx.strokeStyle = '#1a1f24';
  ctx.strokeRect(28, 4, 34, 24);
  ctx.fillStyle = e.sight || g > 0.3 ? '#ff3a28' : '#e0a526';
  ctx.fillRect(32, 12, 16, 5);                                  // ดวงตา (แดงเมื่อกำลังเล็ง)
  ctx.fillStyle = '#1a1f24';
  ctx.fillRect(58, -10, 3, 14);                                 // เสาอากาศ
  // ไรเฟิลสไนเปอร์ยักษ์ หมุนตามเป้า
  ctx.save();
  ctx.translate(e.gx, e.gy);
  ctx.rotate(e.rifle);
  ctx.fillStyle = '#14181c';
  ctx.fillRect(-16, -5, e.gl + 16, 10);
  ctx.fillStyle = '#2d3a46';
  ctx.fillRect(10, -12, 28, 6);                                 // กล้องเล็ง
  ctx.fillStyle = e.sight ? '#ff3a28' : '#8a8f7a';
  ctx.fillRect(e.gl - 8, -7, 10, 14);                           // ปากกระบอก
  if (e.fireFlash > 0) {
    ctx.fillStyle = 'rgba(255,230,160,0.9)';
    ctx.beginPath(); ctx.arc(e.gl + 10, 0, 16, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}
