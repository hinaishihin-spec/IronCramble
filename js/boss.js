'use strict';
/* ==========================================================================
   boss.js : บอสท้ายด่าน "Mobile Fortress" (120x120, HP 500, 2 เฟส)
   - ด่านที่มี `boss: { at, name }` ใน missions.js: เมื่อผู้เล่นเดินถึงระยะ at (เมตร)
     กล้องจะถูกล็อก ผู้เล่นออกนอกจอไม่ได้ มีป้าย WARNING: BOSS APPROACHING แล้วบอสเลื่อนเข้ามา
   - เฟส 1 (HP 500-250): ยิงปืนกลหนัก สลับกับปล่อยโดรนลูกน้อง
   - เฟส 2 (HP < 250):   ตัวบอสเรืองแสงแดง ยิงมิสไซล์กระจายครั้งละ 3 ลูก (+ปืนกลสั้นๆ)
   - บอสพัง: ระเบิดต่อเนื่อง -> ระเบิดใหญ่ -> ได้ 150 Credits -> Mission Complete
   บอสเป็นศัตรูชนิดหนึ่ง (type 'boss') อยู่ในลิสต์ enemies จึงโดนปืนกล/มิสไซล์/เลเซอร์ได้เหมือนศัตรูทั่วไป
   สถานะของบอสในด่านเก็บที่ object `mission` (mission.bossState):
     'none' -> 'intro' (ป้ายเตือน บอสเลื่อนเข้า) -> 'fight' -> 'dying' (ระเบิด) -> 'done'
   ========================================================================== */

// ลำดับท่าโจมตีของแต่ละเฟส [ชื่อท่า, ระยะเวลา(วินาที)] วนซ้ำ
const BOSS_CYCLE = {
  1: [['mg', 2.4], ['pause', 0.5], ['launch', 1.4], ['pause', 0.8]],
  2: [['volley', 1.1], ['pause', 0.9], ['volley', 1.1], ['pause', 0.7], ['mg', 1.4], ['pause', 0.8]]
};

function makeBoss(startX, restX, minX) {
  return {
    type: 'boss', kind: 'fortress', phase2Hp: BOSS_PHASE2_HP, exp: BOSS_EXP, reward: BOSS_REWARD_GOLD,
    x: startX, y: GROUND_Y - BOSS_H, w: BOSS_W, h: BOSS_H,
    hp: BOSS_HP, maxHp: BOSS_HP, armor: BOSS_ARMOR,
    dir: -1, flash: 0, phase: 0,
    stage: 1,                       // เฟสการต่อสู้ 1 / 2
    mode: 'intro', modeT: 0, modeDur: BOSS_WARN_TIME, step: -1,
    startX: startX, restX: restX, minX: minX, patrolDir: -1,
    aim: Math.PI, glow: 0, hatch: 0, charge: 0, fireCd: 0, fireFlash: 0,
    fired: false, introT: 0
  };
}

function bossMinions() {
  let n = 0;
  for (const o of enemies) if (o.minion) n++;
  return n;
}

// ขึ้นท่าถัดไปในลำดับของเฟสปัจจุบัน
function bossNext(e) {
  const cyc = BOSS_CYCLE[e.stage];
  e.step = (e.step + 1) % cyc.length;
  e.mode = cyc[e.step][0];
  e.modeDur = cyc[e.step][1];
  e.modeT = 0;
  e.fired = false;
  e.fireCd = 0;
  e.charge = 0;
}

// ---------- การโจมตี ----------
function bossFireMg(e) {
  const mx = e.x + 58 + Math.cos(e.aim) * 52, my = e.y + 36 + Math.sin(e.aim) * 52;
  const a = e.aim + (Math.random() - 0.5) * 0.14;           // กระสุนกระจายนิดหน่อย
  enemyShots.push({
    x: mx, y: my, vx: Math.cos(a) * BOSS_MG_SPEED, vy: Math.sin(a) * BOSS_MG_SPEED,
    dmg: BOSS_MG_DMG, life: 2.6, r: 4, kind: 'hmg'
  });
  e.fireFlash = 0.06;
  spawnSparks(mx, my, 2, '#ffd36b');
}

function bossLaunchDrones(e) {
  const n = Math.min(2, BOSS_DRONE_CAP - bossMinions());
  for (let i = 0; i < n; i++) {
    const d = makeDrone(e.x + 82 + i * 14, e.y + 34);       // โผล่จากฮัตช์ด้านหลังบอส แล้วบินขึ้นไปที่ความสูงปกติ
    d.riseTo = 120 + Math.random() * 70;
    d.hunt = true;
    d.minion = true;                                         // ลูกน้องบอส: ไม่นับในจำนวนศัตรูของด่าน ไม่ให้ EXP
    d.homeX = d.x;
    enemies.push(d);
    spawnSparks(d.x + 17, d.y, 6, '#8fe3b0');
  }
}

function bossFireVolley(e, pcx, pcy) {
  const px = e.x + 16, py = e.y + 34;                         // ท่อยิงมิสไซล์ด้านหน้า
  const base = Math.atan2(pcy - py, pcx - px);
  for (let i = -1; i <= 1; i++) {
    const a = base + i * BOSS_MISSILE_SPREAD;
    enemyShots.push({
      x: px + Math.cos(a) * 8, y: py + Math.sin(a) * 8,
      vx: Math.cos(a) * BOSS_MISSILE_SPEED, vy: Math.sin(a) * BOSS_MISSILE_SPEED,
      speed: BOSS_MISSILE_SPEED, dmg: BOSS_MISSILE_DMG, life: 3.8, r: 6, big: true, kind: 'bmissile',
      shieldCost: BOSS_MISSILE_SHIELD_COST, turn: 0.9, trackT: 1.6      // เลี้ยวเข้าหาผู้เล่นเบาๆ ช่วง 1.6 วินาทีแรก
    });
  }
  addShake(4);
  spawnSparks(px, py, 10, '#e8e2c8');
  smallBoom(px, py, 14);
}

// ---------- อัปเดตบอส 1 เฟรม (เรียกจาก updateEnemies) ----------
function updateFortress(e, dt, pcx, pcy) {
  e.glow += ((e.stage === 2 ? 1 : 0) - e.glow) * Math.min(1, dt * 1.5);
  e.fireFlash = Math.max(0, e.fireFlash - dt);

  // ป้อมปืนหมุนตามผู้เล่น
  const tx = e.x + 58, ty = e.y + 36;
  const want = Math.atan2(pcy - ty, pcx - tx);
  const diff = Math.atan2(Math.sin(want - e.aim), Math.cos(want - e.aim));
  e.aim += clamp(diff, -3.5 * dt, 3.5 * dt);

  // ฮัตช์ปล่อยโดรน เปิด/ปิดตามท่า
  const hatchWant = e.mode === 'launch' && e.modeT > 0.1 && e.modeT < e.modeDur - 0.3 ? 1 : 0;
  e.hatch += (hatchWant - e.hatch) * Math.min(1, dt * 8);

  // ควันไฟเมื่อ HP ต่ำ
  if (e.hp < BOSS_PHASE2_HP * 0.6 && Math.random() < dt * 14) {
    spawnSparks(e.x + 20 + Math.random() * 80, e.y + 30 + Math.random() * 30, 1, Math.random() < 0.5 ? '#ff6a3c' : '#8a8f98');
  }

  if (e.mode === 'intro') {                                    // เลื่อนเข้าจอระหว่างป้าย WARNING
    e.introT += dt;
    const p = clamp(e.introT / BOSS_WARN_TIME, 0, 1);
    e.x = e.startX + (e.restX - e.startX) * (1 - (1 - p) * (1 - p));
    if (p >= 1) { mission.bossState = 'fight'; bossNext(e); }
    return;
  }

  // เปลี่ยนเฟส: HP ต่ำกว่า 250 -> คำราม (เรืองแสงแดง) แล้วเริ่มท่าของเฟส 2
  if (e.stage === 1 && e.hp <= BOSS_PHASE2_HP) {
    e.stage = 2;
    e.mode = 'roar'; e.modeT = 0; e.modeDur = 1.4; e.step = -1; e.charge = 0;
    addShake(9);
    popText(e.x + e.w / 2, e.y - 14, 'PHASE 2', '#ff4a30', 24);
    smallBoom(e.x + e.w / 2, e.y + 50, 40);
    spawnSparks(e.x + e.w / 2, e.y + 40, 20, '#ff4a30');
  }

  // เดินช้าๆ ไปมาในครึ่งขวาของจอ (ความเป็น "Mobile")
  if (e.mode !== 'roar') {
    e.x += e.patrolDir * (e.stage === 2 ? 38 : 26) * dt;
    if (e.x <= e.minX) { e.x = e.minX; e.patrolDir = 1; }
    if (e.x >= e.restX) { e.x = e.restX; e.patrolDir = -1; }
  }

  e.modeT += dt;
  if (!player.dead) {
    if (e.mode === 'mg' && e.modeT > 0.35) {                   // หน่วงเล็กน้อยให้ลำกล้องหมุนก่อนยิง
      e.fireCd -= dt;
      if (e.fireCd <= 0) { bossFireMg(e); e.fireCd = BOSS_MG_RATE; }
    } else if (e.mode === 'launch') {
      if (!e.fired && e.modeT > 0.5) { bossLaunchDrones(e); e.fired = true; }
    } else if (e.mode === 'volley') {
      e.charge = clamp(e.modeT / 0.55, 0, 1);                  // ท่อยิงเรืองแสงเตือนก่อน
      if (!e.fired && e.modeT >= 0.55) { bossFireVolley(e, pcx, pcy); e.fired = true; e.charge = 0; }
    }
  }
  if (e.modeT >= e.modeDur) bossNext(e);
}

// ---------- บอสพัง ----------
function bossDefeated(e) {
  const k = enemies.indexOf(e);
  if (k >= 0) enemies.splice(k, 1);
  if (e.kind === 'bomber') e.x = clamp(e.x, mission.lockX + 20, mission.lockX + W - e.w - 20);   // พังกลางจอ ไม่ใช่นอกจอ
  run.kills++;
  e.mode = 'dead';
  mission.boss = e;
  mission.bossState = 'dying';
  mission.deathT = 0;
  mission.deathBoomT = 0;
  mission.finalBlown = false;
  mission.endT = 0;
  enemyShots = [];                                              // กระสุนศัตรูที่ค้างอยู่หายไปทั้งหมด
  for (const o of enemies.slice()) killEnemy(o);                // ลูกน้อง/ศัตรูที่เหลือพังตามบอส
  addShake(10);
  if (!player.dead) {
    gainExp(e.exp || BOSS_EXP);
    popText(e.x + e.w / 2, e.y - 6, '+' + (e.exp || BOSS_EXP) + ' EXP', '#5aa9ff', 15);
  }
}

function bossFinalBlast(b) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  mission.finalBlown = true;
  mission.boss = null;
  mission.whiteFlash = 1;
  for (let i = 0; i < 12; i++) {                                // วงระเบิดใหญ่ซ้อนกัน
    effects.push({
      x: cx + (Math.random() - 0.5) * b.w * 1.1, y: cy + (Math.random() - 0.5) * b.h,
      maxR: 40 + Math.random() * 55, delay: i * 0.05, dur: 0.75, t: 0
    });
  }
  effects.push({ x: cx, y: cy, maxR: 240, delay: 0, dur: 0.9, t: 0, ring: '#ffd23f' });
  effects.push({ x: cx, y: cy, maxR: 160, delay: 0.1, dur: 0.8, t: 0, ring: '#ffffff' });
  effects.push({ x: cx, y: cy, maxR: 100, delay: 0.2, dur: 0.7, t: 0, ring: '#ff6a3c' });
  spawnSparks(cx, cy, 70, '#ffb13b');
  spawnSparks(cx, cy, 40, '#ff6a3c');
  spawnSparks(cx, cy, 30, '#fff2c4');
  addShake(20);

  const reward = b.reward || BOSS_REWARD_GOLD;
  profile.gold += reward;                             // รางวัลบอส
  run.gold += reward;
  mission.bossGold = reward;
  saveProfile();
  popText(cx, b.y - 8, '+' + reward + ' CR', '#ffd23f', 28);
}

// อัปเดตช่วงบอสพัง (เรียกจาก updateGame เมื่อ mission.bossState === 'dying')
function updateBossDeath(dt) {
  const m = mission;
  if (player.dead) return;
  if (!m.finalBlown) {
    m.deathT += dt;
    const prog = clamp(m.deathT / BOSS_DEATH_TIME, 0, 1);
    m.deathBoomT -= dt;
    if (m.deathBoomT <= 0 && m.boss) {                          // ระเบิดย่อยสุ่มตามตัว ถี่ขึ้นเรื่อยๆ
      m.deathBoomT = 0.2 - 0.12 * prog;
      const rx = m.boss.x + Math.random() * m.boss.w, ry = m.boss.y + Math.random() * m.boss.h;
      smallBoom(rx, ry, 16 + Math.random() * 24);
      spawnSparks(rx, ry, 7, Math.random() < 0.5 ? '#ffb13b' : '#ff6a3c');
    }
    addShake(3 + 5 * prog);
    if (m.deathT >= BOSS_DEATH_TIME && m.boss) bossFinalBlast(m.boss);
  } else {
    m.endT += dt;
    if (m.endT >= BOSS_END_DELAY) { m.bossState = 'done'; completeMission(); }
  }
}

// ---------- วาด ----------
function bossHullPath() {
  ctx.beginPath();
  ctx.moveTo(4, 92); ctx.lineTo(4, 62); ctx.lineTo(14, 46); ctx.lineTo(24, 42);
  ctx.lineTo(100, 42); ctx.lineTo(112, 60); ctx.lineTo(116, 92);
  ctx.closePath();
}

// วาดบอส (พิกัดท้องถิ่น: มุมซ้ายบนของตัว = 0,0 หันหน้าไปทางซ้าย)
function drawFortress(e, sx, sy, flash) {
  const g = e.glow || 0;
  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 110);
  const c = function (normal) { return flash ? '#ffffff' : normal; };
  ctx.save();
  ctx.translate(sx, sy);

  if (g > 0.02) {                                               // แสงแดงรอบตัวในเฟส 2
    const gr = ctx.createRadialGradient(60, 70, 20, 60, 70, 130);
    gr.addColorStop(0, 'rgba(255,50,30,' + (0.34 * g * pulse) + ')');
    gr.addColorStop(1, 'rgba(255,50,30,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(-90, -70, 300, 240);
  }

  // ตีนตะขาบ
  ctx.fillStyle = '#1b2025';
  ctx.fillRect(0, 92, 120, 28);
  ctx.strokeStyle = '#0d1012';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 93, 118, 26);
  ctx.fillStyle = '#39424b';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath(); ctx.arc(14 + i * 18.4, 106, 9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#5a6672';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath(); ctx.arc(14 + i * 18.4, 106, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#4a545e';
  const roll = (e.phase * 20) % 12;
  for (let x = -12 + roll; x < 120; x += 12) { ctx.fillRect(x, 92, 6, 3); ctx.fillRect(x, 117, 6, 3); }

  // ตัวถัง (เรืองแสงแดงในเฟส 2)
  ctx.save();
  if (g > 0.02) { ctx.shadowColor = '#ff2a1a'; ctx.shadowBlur = 26 * g * pulse; }
  ctx.fillStyle = c('#566370');
  bossHullPath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#1e252c';
  ctx.lineWidth = 3;
  bossHullPath();
  ctx.stroke();
  ctx.fillStyle = c('#47525e');                                 // แผ่นเกราะส่วนล่าง
  ctx.fillRect(10, 72, 100, 18);
  ctx.strokeStyle = '#2a323a';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 72, 100, 18);
  for (let i = 0; i < 4; i++) {                                 // หมุดเกราะ
    ctx.fillStyle = '#2a323a';
    ctx.beginPath(); ctx.arc(22 + i * 26, 81, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  if (g > 0.02) {                                               // สีแดงคลุมตัวถัง
    ctx.fillStyle = 'rgba(255,40,30,' + (0.3 * g * (0.6 + 0.4 * pulse)) + ')';
    bossHullPath();
    ctx.fill();
  }

  // ช่องมอง/เซ็นเซอร์ด้านหน้า
  ctx.fillStyle = g > 0.3 ? 'rgba(255,60,40,' + (0.6 + 0.4 * pulse) + ')' : '#ffb13b';
  ctx.fillRect(12, 60, 26, 6);
  ctx.fillStyle = '#1a1f24';
  ctx.fillRect(12, 66, 26, 2);

  // ท่อยิงมิสไซล์ด้านหน้า (3 ท่อ)
  ctx.fillStyle = c('#3c4650');
  ctx.fillRect(10, 24, 30, 22);
  ctx.strokeStyle = '#1e252c';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 24, 30, 22);
  for (let i = 0; i < 3; i++) {
    const cc = e.charge || 0;
    ctx.fillStyle = cc > 0 ? 'rgba(255,' + Math.round(200 - 140 * cc) + ',60,' + (0.55 + 0.45 * cc) + ')' : '#0d1012';
    ctx.beginPath(); ctx.arc(15, 30 + i * 6.5, 2.7, 0, Math.PI * 2); ctx.fill();
  }

  // ฮัตช์ปล่อยโดรนด้านหลัง
  ctx.fillStyle = '#0b0e10';
  ctx.fillRect(78, 40, 28, 5);
  if (e.hatch > 0.05) {
    ctx.fillStyle = 'rgba(143,227,176,' + (0.5 * e.hatch) + ')';
    ctx.fillRect(80, 41, 24, 3);
  }
  ctx.save();
  ctx.translate(106, 40);
  ctx.rotate(-e.hatch * 1.15);
  ctx.fillStyle = c('#3c4650');
  ctx.fillRect(-28, -4, 28, 5);
  ctx.restore();

  // ป้อมปืนกลหนัก + ลำกล้องคู่
  ctx.save();
  ctx.translate(58, 38);
  ctx.rotate(e.aim);
  ctx.fillStyle = '#20272e';
  ctx.fillRect(0, -8, 46, 5);
  ctx.fillRect(0, 3, 46, 5);
  ctx.fillStyle = '#7d8791';
  ctx.fillRect(38, -9, 12, 7);
  ctx.fillRect(38, 2, 12, 7);
  if (e.fireFlash > 0) {
    ctx.fillStyle = '#fff2c4';
    ctx.beginPath(); ctx.arc(54, -5, 5, 0, Math.PI * 2); ctx.arc(54, 6, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = c('#6a7885');
  ctx.beginPath(); ctx.arc(58, 42, 17, Math.PI, 0); ctx.lineTo(75, 46); ctx.lineTo(41, 46); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1e252c';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = g > 0.3 ? '#ff4a30' : '#e0a526';             // ไฟบนป้อม
  ctx.fillRect(54, 32, 8, 3);

  ctx.restore();
}

// ซากบอสระหว่างระเบิดต่อเนื่อง (บอสถูกถอดออกจาก enemies แล้ว แต่ยังต้องวาดจนถึงระเบิดใหญ่)
function drawBossWreck() {
  const b = mission.boss;
  if (!b || mission.bossState !== 'dying' || mission.finalBlown) return;
  const jx = (Math.random() - 0.5) * 4, jy = (Math.random() - 0.5) * 3;
  drawBoss(b, b.x - cam + jx, b.y + jy, Math.floor(performance.now() / 70) % 4 === 0);
}

// ป้ายเตือนใหญ่ / หลอด HP บอส / เส้นกั้นสนามต่อสู้ / แสงขาวตอนระเบิดใหญ่ (พิกัดจอ ไม่โดนจอสั่น)
function drawStripes(y, h, t) {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, y, W, h); ctx.clip();
  ctx.fillStyle = '#e0a526';
  ctx.fillRect(0, y, W, h);
  ctx.fillStyle = '#161a1e';
  const off = (t * 70) % 40;
  for (let x = -60 + off; x < W + 40; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, y + h); ctx.lineTo(x + h, y); ctx.lineTo(x + h + 14, y); ctx.lineTo(x + 14, y + h);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawBossHud() {
  const m = mission;
  const fighting = m.bossState === 'intro' || m.bossState === 'fight';

  // เส้นกั้นสนามต่อสู้ (กล้องล็อก)
  if (m.lockX >= 0 && m.bossState !== 'done') {
    const pulse = 0.45 + 0.25 * Math.sin(performance.now() / 160);
    const nearL = player.x - m.lockX < 6, nearR = m.lockX + W - (player.x + player.w) < 6;
    for (const side of [0, 1]) {
      const x = side === 0 ? 0 : W - 8;
      const hot = (side === 0 ? nearL : nearR) ? 0.45 : 0;
      ctx.fillStyle = 'rgba(255,70,50,' + (pulse * 0.5 + hot) + ')';
      ctx.fillRect(x, 46, 8, H - 46);
    }
  }

  // หลอด HP บอส
  const b = m.boss && m.bossState === 'dying' ? m.boss : enemies.find(function (o) { return o.type === 'boss'; });
  if (b && (fighting || m.bossState === 'dying')) {
    const bx = 220, by = 63, bw = 360, bh = 12;
    const r = clamp(b.hp / b.maxHp, 0, 1);
    const stage2 = b.stage === 2;
    drawText(m.def.boss.name, bx, by - 5, fnt(700, 11), stage2 ? '#ff6a4a' : '#e0a526');
    drawText(stage2 ? 'PHASE 2' : 'PHASE 1', bx + bw, by - 5, fnt(600, 10), stage2 ? '#ff6a4a' : '#8d978c', 'right');
    ctx.fillStyle = '#0f1316';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = stage2 ? '#e0402c' : '#d98a26';
    ctx.fillRect(bx, by, bw * r, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(bx, by, bw * r, 3);
    ctx.fillStyle = '#ffffff';                                  // ขีดบอกจุดเปลี่ยนเฟส
    ctx.fillRect(bx + bw * ((b.phase2Hp || BOSS_PHASE2_HP) / b.maxHp) - 1, by - 2, 2, bh + 4);
  }

  // ป้าย WARNING: BOSS APPROACHING
  if (m.bossWarn > 0) {
    const t = BOSS_WARN_TIME - m.bossWarn;
    const fade = clamp(t / 0.15, 0, 1) * clamp(m.bossWarn / 0.5, 0, 1);
    const blink = 0.65 + 0.35 * Math.sin(t * 16);
    ctx.globalAlpha = fade * 0.22 * blink;
    ctx.fillStyle = '#ff2a1a';
    ctx.fillRect(0, 46, W, H - 46);
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(15,10,10,0.75)';
    ctx.fillRect(0, 168, W, 96);
    drawStripes(160, 12, t);
    drawStripes(260, 12, -t);
    ctx.globalAlpha = fade * blink;
    ctx.save();
    ctx.shadowColor = '#ff2a1a';
    ctx.shadowBlur = 18;
    drawText('WARNING: BOSS APPROACHING', W / 2, 224, fnt(700, 36), '#ff4a30', 'center');
    ctx.restore();
    ctx.globalAlpha = fade;
    drawText(m.def.boss.name + '  กำลังเข้าสู่สนามรบ', W / 2, 248, fnt(600, 13), '#f0c9c0', 'center');
    ctx.globalAlpha = 1;
  }

  // แสงขาววาบตอนระเบิดใหญ่
  if (m.whiteFlash > 0) {
    ctx.globalAlpha = clamp(m.whiteFlash, 0, 1) * 0.85;
    ctx.fillStyle = '#fff6dc';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // ข้อความหลังบอสพัง
  if (m.bossState === 'dying' && m.finalBlown && !player.dead) {
    const a = clamp(m.endT / 0.3, 0, 1);
    ctx.globalAlpha = a;
    drawText('BOSS DESTROYED', W / 2, 150, fnt(700, 34), '#ffd23f', 'center');
    drawText('+' + m.bossGold + ' CREDITS', W / 2, 176, fnt(700, 16), '#ffd23f', 'center');
    ctx.globalAlpha = 1;
  }
}
