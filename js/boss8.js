'use strict';
/* ==========================================================================
   boss8.js : บอสด่าน 10  ASSEMBLY ARM  (แขนกลสายพานประกอบหุ่น กลางโรงงานอาวุธ)
     ตัวเครื่องยืนนิ่งที่ขอบจอขวา มีแขนกลยาวพร้อมหัวกด/หัวเชื่อม และสายพานประกอบหุ่นทางซ้าย
     ท่า (วนสลับ ทุบ > ประกายเชื่อม > ทุบ > ประกายเชื่อม)
       ทุบพื้น (SLAM)   แขนยกขึ้นเหนือหัว มีเส้นแดง+วงเตือนที่พื้นตามตัวผู้เล่น (ล็อกก่อนทุบ AS_LOCK วินาที) แล้วทุบลง
                        เกิดคลื่นกระแทกวิ่งไปตามพื้นทั้งซ้ายและขวา  กระโดดข้ามคลื่นได้ (โดนเฉพาะคนที่เท้าอยู่ใกล้พื้น)
       ประกายเชื่อม (TORCH)  แขนถอยมาลอยกลางจอ ชาร์จหัวเชื่อม แล้วยิงประกายเป็นชุดๆ พัดมาทางผู้เล่น
     สายพานประกอบหุ่น (ทำงานคู่ไปกับท่าข้างบน)  ประกอบหุ่น 1 ตัว ใช้เวลา AS_BUILD วินาที (แถบความคืบหน้าบนสายพาน)
                        เสร็จแล้วปล่อยลงพื้นทางซ้ายของเครื่อง  ลูกน้องที่ยังอยู่ไม่เกิน AS_CAP ตัว (เฟส 2 AS_CAP2)
                        เฟส 1 ประกอบ Walker  เฟส 2 สลับ Shotgun Wanzer / Welder Bot  — ยิงทำลายตอนกำลังประกอบไม่ได้ ต้องจัดการหลังปล่อย
     เฟส 2 (HP <= phase2Hp)  ทุบสองครั้งติด (จุดที่ 2 ล็อกใหม่ตามตัวผู้เล่น) / ประกายเชื่อมยิงถี่และกว้างขึ้น / พักสั้นลง
   ค่าตัวเลขอยู่ด้านล่างของไฟล์นี้ (AS_*) ไม่ต้องแก้ config.js
   ภาพวาด: assets/enemies/boss_assembly.png (วาดทั้งเครื่อง แขนกลจะไม่ขยับ ถ้าอยากให้แขนขยับใช้ภาพโค้ดนี้ไปก่อน)
   ========================================================================== */

const AS_W = 230, AS_H = 190;
const AS_HP = 1400, AS_PHASE2_HP = 700, AS_ARMOR = 0.25;
const AS_EXP = 1100, AS_REWARD_GOLD = 1000;
const AS_REST = 1.3, AS_REST2 = 0.9, AS_ROAR_TIME = 1.4;
const AS_WIND = 0.95, AS_WIND2 = 0.6, AS_LOCK = 0.35, AS_DROP = 0.16, AS_SLAM_REC = 0.7;           // ทุบ: เวลายกแขน / ยกแขนครั้งที่ 2 / ล็อกเป้าก่อนทุบ / ทุบลง / ค้างหลังทุบ
const AS_WAVE_SPEED = 330, AS_WAVE_SPEED2 = 400, AS_WAVE_DMG = 14, AS_WAVE_HALF = 16, AS_CRUSH_DMG = 24, AS_CRUSH_HALF = 28;
const AS_TORCH_CHARGE = 0.7, AS_TORCH_VOL = 3, AS_TORCH_VOL2 = 4, AS_TORCH_GAP = 0.26;                 // ประกายเชื่อม: ชาร์จ / จำนวนชุด / ห่างระหว่างชุด
const AS_TORCH_N = 3, AS_TORCH_N2 = 5, AS_TORCH_SPREAD = 0.4, AS_TORCH_SPEED = 360, AS_TORCH_DMG = 7;
const AS_BUILD = 4.5, AS_BUILD_REST = 2.0, AS_CAP = 2, AS_CAP2 = 3;

function makeAssemblyArm(startX, lockX) {
  const restX = lockX + W - AS_W - 10;
  return {
    type: 'boss', kind: 'assembly', phase2Hp: AS_PHASE2_HP, exp: AS_EXP, reward: AS_REWARD_GOLD,
    x: startX, y: GROUND_Y - AS_H, w: AS_W, h: AS_H, hp: AS_HP, maxHp: AS_HP, armor: AS_ARMOR,
    dir: -1, flash: 0, phase: 0, stage: 1, mode: 'intro', modeT: 0, introT: 0,
    startX: startX, restX: restX, glow: 0, fireFlash: 0, cd: 1.8, cycle: 0,
    act: null, waves: [], clawX: restX - 80, clawY: GROUND_Y - 120, clawGlow: 0,
    asm: null, asmCd: 1.0, nth: 0, charge: 0
  };
}

function asShoulder(e) { return { x: e.x + 150, y: e.y + 62 }; }

// ---------- คลื่นกระแทก ----------
function asImpact(e, tx) {
  addShake(9);
  mission.whiteFlash = Math.max(mission.whiteFlash || 0, 0.08);
  smallBoom(tx, GROUND_Y - 8, 34); spawnSparks(tx, GROUND_Y - 6, 16, '#ffb13b');
  const v = e.stage === 2 ? AS_WAVE_SPEED2 : AS_WAVE_SPEED;
  e.waves.push({ x: tx, dir: -1, v: v, hit: false, age: 0 }, { x: tx, dir: 1, v: v, hit: false, age: 0 });
  if (!player.dead && Math.abs(player.x + player.w / 2 - tx) < AS_CRUSH_HALF && player.y + player.h >= GROUND_Y - 40) {
    damagePlayer(AS_CRUSH_DMG, 25);
    spawnSparks(player.x + player.w / 2, player.y + player.h / 2, 10, '#ff8a5c');
  }
}

function asUpdateWaves(e, dt) {
  for (let i = e.waves.length - 1; i >= 0; i--) {
    const w = e.waves[i];
    w.age += dt; w.x += w.dir * w.v * dt;
    if (Math.random() < dt * 40) spawnSparks(w.x, GROUND_Y - 4, 1, '#ffb13b');
    if (!w.hit && !player.dead && player.y + player.h >= GROUND_Y - 26 && player.x < w.x + AS_WAVE_HALF && player.x + player.w > w.x - AS_WAVE_HALF) {
      w.hit = true; damagePlayer(AS_WAVE_DMG, 12);
      spawnSparks(player.x + player.w / 2, player.y + player.h / 2, 8, player.shieldUp ? '#4fc3f7' : '#ff8a5c');
    }
    if (w.x < mission.lockX - 40 || w.x > mission.lockX + W + 40) e.waves.splice(i, 1);
  }
}

// ---------- สายพานประกอบ ----------
function asMinions() { let n = 0; for (const o of enemies) if (o.minion && o.type !== 'boss') n++; return n; }

function asUpdateBuild(e, dt) {
  const cap = e.stage === 2 ? AS_CAP2 : AS_CAP;
  if (e.asm) {
    e.asm.t += dt;
    if (e.asm.t >= AS_BUILD) {
      if (asMinions() < cap) asSpawn(e);
      e.asm = null; e.asmCd = AS_BUILD_REST;
    }
    return;
  }
  e.asmCd -= dt;
  if (e.asmCd <= 0 && asMinions() < cap) {
    const kind = e.stage === 2 ? (e.nth % 2 ? 'welder' : 'swanzer') : 'walker';
    e.asm = { t: 0, kind: kind }; e.nth++;
  }
}
function asSpawn(e) {
  const k = e.asm.kind, x = e.x - 28;
  const u = k === 'welder' ? makeWelder(x) : k === 'swanzer' ? makeShotWanzer(x) : makeWalker(x);
  u.x = clamp(u.x, mission.lockX + 4, mission.lockX + W - u.w - 4); u.homeX = u.x; u.hunt = true; u.minion = true;      // ไม่นับในยอดศัตรูด่าน
  scaleEnemyHp(u, ENEMY_HP_MULT);
  enemies.push(u);
  spawnSparks(u.x + u.w / 2, GROUND_Y - 6, 10, '#ffd23f'); addShake(2);
}

// ---------- สมอง ----------
function asClawGoal(e) {
  const a = e.act;
  if (!a) return { x: e.x - 60 + Math.sin(e.phase * 1.3) * 12, y: GROUND_Y - 135 + Math.sin(e.phase * 2) * 7, r: 3 };
  if (a.k === 'slam') {
    if (a.st === 'wind') return { x: a.tx, y: GROUND_Y - 205, r: 6 };
    if (a.st === 'drop') return { x: a.tx, y: GROUND_Y - 18, r: 40 };
    return { x: a.tx, y: GROUND_Y - 18, r: 4 };
  }
  return { x: e.x - 70, y: GROUND_Y - 150, r: 5 };
}

function asClampTx(x) { return clamp(x, mission.lockX + 30, mission.lockX + W - 30); }

function asStartSlam(e, pcx) { e.act = { k: 'slam', st: 'wind', t: AS_WIND, tx: asClampTx(pcx), n: e.stage === 2 ? 2 : 1, locked: false }; }
function asStartTorch(e) { e.act = { k: 'torch', st: 'charge', t: AS_TORCH_CHARGE, vol: e.stage === 2 ? AS_TORCH_VOL2 : AS_TORCH_VOL, gap: 0 }; }

function asUpdateAct(e, dt, pcx, pcy) {
  const a = e.act;
  a.t -= dt;
  if (a.k === 'slam') {
    if (a.st === 'wind') {
      if (a.t > AS_LOCK) a.tx = asClampTx(pcx); else a.locked = true;                 // ตามผู้เล่นก่อน แล้วล็อกก่อนทุบ
      if (a.t <= 0) { a.st = 'drop'; a.t = AS_DROP; }
    } else if (a.st === 'drop') {
      if (a.t <= 0) {
        e.clawX = a.tx; e.clawY = GROUND_Y - 18;
        asImpact(e, a.tx);
        a.n--;
        if (a.n > 0) { a.st = 'wind'; a.t = AS_WIND2; a.locked = false; a.tx = asClampTx(pcx); }
        else { a.st = 'rec'; a.t = AS_SLAM_REC; }
      }
    } else if (a.t <= 0) e.act = null;
    return;
  }
  // ประกายเชื่อม
  e.clawGlow = a.st === 'charge' ? clamp(1 - a.t / AS_TORCH_CHARGE, 0, 1) : 1;
  if (a.st === 'charge') {
    if (a.t <= 0) { a.st = 'fire'; a.gap = 0; }
    return;
  }
  a.gap -= dt;
  if (a.gap <= 0) {
    const n = e.stage === 2 ? AS_TORCH_N2 : AS_TORCH_N, x0 = e.clawX - 14, y0 = e.clawY + 6;
    const base = Math.atan2(pcy - y0, pcx - x0);
    for (let i = 0; i < n; i++) {
      const a2 = base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * AS_TORCH_SPREAD);
      enemyShots.push({ x: x0, y: y0, vx: Math.cos(a2) * AS_TORCH_SPEED, vy: Math.sin(a2) * AS_TORCH_SPEED, dmg: AS_TORCH_DMG, life: 2.2, r: 3.5 });
    }
    e.fireFlash = 0.08; spawnSparks(x0, y0, 5, '#9fd8ff');
    a.vol--; a.gap = AS_TORCH_GAP;
    if (a.vol <= 0) { e.act = null; e.clawGlow = 0; }
  }
}

function updateAssemblyArm(e, dt, pcx, pcy) {
  bossCommon(e, dt);
  e.y = GROUND_Y - e.h;
  if (e.mode === 'intro') { bossIntroSlide(e, dt); e.clawX = e.x - 80; return; }
  e.clawGlow = Math.max(0, e.clawGlow - dt * 3);

  const g = asClawGoal(e), k = Math.min(1, dt * g.r);                                   // แขนเลื่อนตามเป้า
  e.clawX += (g.x - e.clawX) * k; e.clawY += (g.y - e.clawY) * k;
  asUpdateWaves(e, dt);

  if (e.mode === 'roar') {
    e.modeT += dt; addShake(2);
    if (Math.random() < dt * 20) smallBoom(e.x + Math.random() * e.w, e.y + Math.random() * e.h * 0.6, 12 + Math.random() * 12);
    if (e.modeT >= AS_ROAR_TIME) { e.mode = 'fight'; e.cd = 0.6; }
    return;
  }
  if (e.stage === 1 && e.hp <= e.phase2Hp) {
    e.stage = 2; e.mode = 'roar'; e.modeT = 0; e.act = null; e.asm = null; e.asmCd = 3.0;
    addShake(9);
    popText(e.x + e.w / 2, e.y - 14, 'PHASE 2', '#ff4a30', 24);
    smallBoom(e.x + e.w / 2, e.y + 60, 40); spawnSparks(e.x + e.w / 2, e.y + 50, 20, '#ff4a30');
    return;
  }
  if (player.dead) { e.act = null; return; }

  asUpdateBuild(e, dt);
  if (e.act) { asUpdateAct(e, dt, pcx, pcy); if (!e.act) e.cd = e.stage === 2 ? AS_REST2 : AS_REST; return; }
  e.cd -= dt;
  if (e.cd > 0) return;
  if (e.cycle++ % 2 === 0) asStartSlam(e, pcx); else asStartTorch(e);
}

// ---------- วาด ----------
function drawAssemblyFx(e) {
  if (e.mode === 'dead') return;
  const t = performance.now();
  const a = e.act;
  if (a && a.k === 'slam' && (a.st === 'wind' || a.st === 'drop')) {                    // เส้น + วงเตือนจุดทุบ
    const x = a.tx - cam, blink = a.locked ? (Math.floor(t / 45) % 2 ? 1 : 0.4) : 1;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,60,40,' + 0.55 * blink + ')'; ctx.lineWidth = a.locked ? 3 : 2; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, GROUND_Y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,40,30,' + (a.locked ? 0.4 : 0.2) * blink + ')';
    ctx.beginPath(); ctx.ellipse(x, GROUND_Y + 1, AS_CRUSH_HALF + 6, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  for (const w of e.waves) {                                                            // คลื่นกระแทกบนพื้น
    const x = w.x - cam, fade = clamp(1 - w.age / 1.8, 0.25, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(255,150,50,' + 0.85 * fade + ')';
    ctx.beginPath(); ctx.moveTo(x - 22 * w.dir * -1, GROUND_Y); ctx.lineTo(x + w.dir * 2, GROUND_Y - 30 - Math.random() * 6); ctx.lineTo(x + w.dir * 14, GROUND_Y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,235,170,' + 0.9 * fade + ')';
    ctx.beginPath(); ctx.moveTo(x - w.dir * 4, GROUND_Y); ctx.lineTo(x + w.dir * 2, GROUND_Y - 16); ctx.lineTo(x + w.dir * 8, GROUND_Y); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawAssemblyArm(e, sx, sy, flash) {
  const g = e.glow || 0, t = performance.now(), c = function (n) { return flash ? '#ffffff' : n; };
  drawAssemblyFx(e);
  const hot = g > 0.3;

  // ---- สายพานประกอบ (ซ้ายของเครื่อง) ----
  ctx.save();
  ctx.translate(sx, sy);
  ctx.fillStyle = '#171b1f'; ctx.fillRect(0, 168, 100, 22);
  ctx.strokeStyle = '#0b0d0f'; ctx.lineWidth = 2; ctx.strokeRect(1, 169, 98, 20);
  ctx.fillStyle = '#c7a53a';
  const mv = (e.mode === 'fight' ? (t / 25) % 16 : 0);
  for (let i = -1; i < 7; i++) ctx.fillRect(2 + i * 16 + mv, 172, 8, 3);
  ctx.fillStyle = '#323b44';
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(10 + i * 20, 184, 5, 0, Math.PI * 2); ctx.fill(); }
  if (e.asm) {                                                                          // หุ่นที่กำลังประกอบ
    const p = clamp(e.asm.t / AS_BUILD, 0, 1), wz = e.asm.kind === 'swanzer', wd = e.asm.kind === 'welder';
    const bw = wz || wd ? 26 : 30, bh = wz ? 46 : wd ? 40 : 38, bx = 40 - bw / 2, by = 168 - bh;
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.65 * p;
    ctx.fillStyle = wd ? '#d7a21f' : '#7d8a96'; ctx.fillRect(bx, by + bh * (1 - p), bw, bh * p);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,230,120,0.85)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.strokeRect(bx, by, bw, bh);
    ctx.restore();
    ctx.fillStyle = '#0b0d0f'; ctx.fillRect(10, 156 - bh - 14, 60, 7);                    // แถบความคืบหน้า
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(11, 157 - bh - 14, 58 * p, 5);
    if (Math.random() < 0.5) { ctx.fillStyle = '#ffe9a0'; ctx.fillRect(bx + Math.random() * bw, by + bh * (1 - p), 2, 2); }   // ประกายเชื่อม
  }

  // ---- ตัวเครื่อง ----
  ctx.fillStyle = c('#b8921f'); ctx.fillRect(96, 74, 134, 116);
  ctx.strokeStyle = '#3d2f08'; ctx.lineWidth = 3; ctx.strokeRect(97, 75, 132, 114);
  ctx.fillStyle = c('#8a6e14'); ctx.fillRect(96, 168, 134, 22);
  ctx.fillStyle = '#1b1d20';
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(98 + i * 15, 190); ctx.lineTo(108 + i * 15, 190); ctx.lineTo(120 + i * 15, 168); ctx.lineTo(110 + i * 15, 168); ctx.closePath(); ctx.fill(); }   // ลายเตือนเหลืองดำ
  ctx.fillStyle = c('#4a525a'); ctx.fillRect(110, 86, 60, 42); ctx.fillRect(180, 86, 40, 70);
  ctx.strokeStyle = '#1a1f24'; ctx.lineWidth = 2; ctx.strokeRect(110, 86, 60, 42); ctx.strokeRect(180, 86, 40, 70);
  const fa = hot ? 0.6 + 0.4 * Math.sin(t / 90) : 0.35;                                  // เตาหลอมเรืองแสง
  ctx.fillStyle = 'rgba(255,' + (hot ? 90 : 150) + ',40,' + fa + ')'; ctx.fillRect(118, 94, 44, 26);
  ctx.fillStyle = '#14181c'; for (let i = 0; i < 4; i++) ctx.fillRect(184, 92 + i * 15, 32, 8);
  ctx.fillStyle = e.fireFlash > 0 ? '#ffffff' : (hot ? '#ff3b2a' : '#5fd36f'); ctx.beginPath(); ctx.arc(210, 80, 4, 0, Math.PI * 2); ctx.fill();   // ไฟสถานะ
  // เสากันสาดบนยอด + คานรางแขน
  ctx.fillStyle = c('#6b7078'); ctx.fillRect(70, 38, 160, 16);
  ctx.strokeStyle = '#1a1f24'; ctx.lineWidth = 2; ctx.strokeRect(70, 38, 160, 16);
  ctx.fillStyle = c('#6b7078'); ctx.fillRect(210, 54, 14, 22);
  ctx.restore();

  // ---- แขนกล (IK 2 ท่อน ศอกชี้ขึ้น) ----
  const sh = asShoulder(e), shx = sh.x - cam, shy = sh.y;
  const cx = e.clawX - cam, cy = e.clawY;
  const dx = cx - shx, dy = cy - shy, d = Math.max(20, Math.hypot(dx, dy));
  const L = Math.max(105, d * 0.56), hh = Math.sqrt(Math.max(0, L * L - (d / 2) * (d / 2)));
  let nx = dy / d, ny = -dx / d; if (ny > 0) { nx = -nx; ny = -ny; }                    // เลือกด้านที่ศอกชี้ขึ้น
  const ex = shx + dx / 2 + nx * hh, ey = shy + dy / 2 + ny * hh;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass === 0 ? '#14181c' : c('#7a828a'); ctx.lineWidth = pass === 0 ? 20 : 14;
    ctx.beginPath(); ctx.moveTo(shx, shy); ctx.lineTo(ex, ey); ctx.lineTo(cx, cy - 10); ctx.stroke();
  }
  ctx.fillStyle = '#c7a53a'; ctx.beginPath(); ctx.arc(shx, shy, 14, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#3d2f08'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#c7a53a'; ctx.beginPath(); ctx.arc(ex, ey, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // หัวกด / หัวเชื่อม
  const cg = e.clawGlow || 0, a = e.act, wind = a && a.k === 'slam' && a.st === 'wind';
  ctx.fillStyle = c('#4a525a'); ctx.fillRect(cx - 22, cy - 14, 44, 18);
  ctx.strokeStyle = '#1a1f24'; ctx.lineWidth = 2; ctx.strokeRect(cx - 22, cy - 14, 44, 18);
  ctx.fillStyle = c('#2b2f33'); ctx.fillRect(cx - 18, cy + 4, 12, 12); ctx.fillRect(cx + 6, cy + 4, 12, 12);   // ง่ามกด
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(cx - 22, cy - 6, 44, 3);
  if (wind && a.locked) { ctx.fillStyle = 'rgba(255,60,40,' + (Math.floor(t / 45) % 2 ? 0.9 : 0.3) + ')'; ctx.fillRect(cx - 22, cy - 14, 44, 18); }
  ctx.fillStyle = '#3a3f45'; ctx.fillRect(cx - 38, cy - 8, 18, 8);                       // หัวเชื่อมชี้ซ้าย
  if (cg > 0.05) { ctx.fillStyle = 'rgba(170,225,255,' + (0.4 + 0.5 * cg) + ')'; ctx.beginPath(); ctx.arc(cx - 40, cy - 4, 4 + 9 * cg, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
