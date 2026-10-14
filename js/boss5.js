'use strict';
/* ==========================================================================
   boss5.js : บอสด่าน 07  GIANT CARRIER  (รถถังที่มีเครื่องบินจอดอยู่ด้านบน)
     เฟส 1  ยิงเลเซอร์ 2 เส้น (เล็งตามผู้เล่นแล้วล็อกเส้น เส้นที่สองเบี่ยงไปดักทางหลบ) สลับกับมิสไซล์ถล่มจากเครื่องบินบนหลัง
     เฟส 2  แยกร่าง: รถถัง = Mobile Fortress (บอสด่าน 2) + เครื่องบิน = Giant Bomber (บอสด่าน 5)
            สองตัวสู้พร้อมกัน ใช้ "ท่าเฟส 1" ของตัวเองเท่านั้น (ไม่เข้าเฟส 2 ของตัวมันเอง)  ต้องเอาลงทั้งคู่ถึงจะชนะ
            HP ของสองชิ้นรวมกัน = CARRIER_PHASE2_HP หลอดบอสบนจอจึงไหลต่อจากเฟส 1
   ใช้ระบบ WARNING / กล้องล็อก / รางวัล ชุดเดียวกับบอสอื่น  ค่าตัวเลขอยู่ใน config.js (CARRIER_*)
   ========================================================================== */

function makeCarrier(startX, lockX) {
  return {
    type: 'boss', kind: 'carrier', phase2Hp: CARRIER_PHASE2_HP, exp: CARRIER_EXP, reward: CARRIER_REWARD_GOLD,
    x: startX, y: GROUND_Y - CARRIER_H, w: CARRIER_W, h: CARRIER_H, hp: CARRIER_HP, maxHp: CARRIER_HP, armor: CARRIER_ARMOR,
    dir: -1, flash: 0, phase: 0, stage: 1, mode: 'intro', modeT: 0, introT: 0,
    startX: startX, restX: lockX + W - CARRIER_W - 20,
    glow: 0, fireFlash: 0, cd: 1.5, cycle: 0, beam: null, bar: null, bay: 0, charge: 0, lift: 0, split: false
  };
}

// ปากกระบอกเลเซอร์ 2 กระบอกที่หน้ารถ (พิกัดโลก)
function carrierEmitters(e) {
  return [{ x: e.x - 8, y: e.y + 82 }, { x: e.x - 8, y: e.y + 102 }];
}

// มุมเลเซอร์ 2 เส้นจากตำแหน่งผู้เล่นตอนนี้: เส้น A เล็งตรงที่ตัว  เส้น B ดักทางหลบ (ผู้เล่นอยู่พื้น -> ดักด้านบนเผื่อกระโดด  ลอยอยู่ -> ดักที่พื้น)
function carrierBeamAngles(e, pcx, pcy) {
  const em = carrierEmitters(e);
  const a = Math.atan2(pcy - em[0].y, pcx - em[0].x);
  const ty = player.onGround ? pcy - 100 : GROUND_Y - 10;
  const b = Math.atan2(ty - em[1].y, pcx - em[1].x);
  return [a, b];
}

function carrierBeamLen(m, ang) {
  const dy = Math.sin(ang);
  let len = 1600;
  if (dy > 0.001) len = Math.min(len, (GROUND_Y - m.y) / dy);       // ลำแสงหยุดที่พื้น
  return len;
}

// ลำแสงโดนผู้เล่นไหม: ไล่จุดตามเส้น เช็กกับกรอบหุ่นที่ขยายตามความหนาลำแสง
function carrierBeamHits(m, ang, len) {
  const h = CARRIER_BEAM_HALF, c = Math.cos(ang), s = Math.sin(ang);
  for (let d = 0; d <= len; d += 8) {
    const x = m.x + c * d, y = m.y + s * d;
    if (x >= player.x - h && x <= player.x + player.w + h && y >= player.y - h && y <= player.y + player.h + h) return true;
  }
  return false;
}

function carrierBeamTick(m, ang) {
  const len = carrierBeamLen(m, ang);
  if (!player.dead && carrierBeamHits(m, ang, len)) {
    damagePlayer(CARRIER_BEAM_DMG, CARRIER_BEAM_SHIELD);
    spawnSparks(player.x + player.w / 2, player.y + player.h / 2, 8, player.shieldUp ? '#4fc3f7' : '#ff8a5c');
  }
}

function carrierMissile(e) {
  const x = e.x + 60 + Math.random() * 110, y = e.y + 44;
  const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
  const spd = CARRIER_MISSILE_SPEED * (0.9 + Math.random() * 0.25);
  enemyShots.push({
    x: x, y: y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, speed: spd,
    dmg: CARRIER_MISSILE_DMG, life: 4.2, r: 5, big: false, kind: 'bmissile', shieldCost: CARRIER_MISSILE_SHIELD,
    turn: 1.8 + Math.random() * 1.0, trackT: 1.0 + Math.random() * 0.9, sc: 0.8
  });
  spawnSparks(x, y, 2, '#e8e2c8');
}

// ---------- แยกร่าง ----------
function carrierSplit(e) {
  if (e.split) return;
  e.split = true;
  const k = enemies.indexOf(e);
  if (k >= 0) enemies.splice(k, 1);
  const cx = e.x + e.w / 2, lockX = mission.lockX;

  const f = makeBoss(e.x, lockX + W - BOSS_W - 24, lockX + W * 0.52);                 // Mobile Fortress (บอสด่าน 2) boss.js
  f.hp = f.maxHp = CARRIER_FORT_HP; f.phase2Hp = 0;                                    // ไม่เข้าเฟส 2 ของตัวเอง
  f.mode = 'fight'; f.step = -1; bossNext(f);
  f.x = clamp(e.x + 30, lockX + 10, lockX + W - f.w - 10);
  f.group = 'carrier'; f.exp = 0; f.reward = 0;

  const b = makeGiantBomber(e.x, lockX);                                               // Giant Bomber (บอสด่าน 5) boss3.js
  b.hp = b.maxHp = CARRIER_BOMBER_HP; b.phase2Hp = 0;
  b.mode = 'fight'; b.x = clamp(e.x, lockX + 10, lockX + W - b.w - 10); b.y = GB_Y;
  b.dir = -1; b.vx = -GB_SPEED; b.cd = 1.2;
  b.group = 'carrier'; b.exp = 0; b.reward = 0;

  scaleEnemyHp(f, BOSS_HP_MULT); scaleEnemyHp(b, BOSS_HP_MULT);
  enemies.push(f, b);
  addShake(12);
  mission.whiteFlash = Math.max(mission.whiteFlash || 0, 0.5);
  smallBoom(cx, e.y + 40, 60); smallBoom(cx - 60, e.y + 70, 40); smallBoom(cx + 60, e.y + 70, 40);
  spawnSparks(cx, e.y + 50, 40, '#ffb13b');
  popText(cx, e.y - 20, 'SEPARATED!', '#ff4a30', 26);
}

// ---------- สมอง ----------
function updateCarrier(e, dt, pcx, pcy) {
  bossCommon(e, dt);
  e.bay += ((e.bar && e.bar.t > 0.15 ? 1 : 0) - e.bay) * Math.min(1, dt * 7);
  if (e.mode === 'intro') { bossIntroSlide(e, dt); e.y = GROUND_Y - e.h; return; }

  if (e.mode === 'split') {                                  // เครื่องบินยกตัวออก ตัวรถสั่น แล้วแยกร่างจริง
    e.modeT += dt;
    e.lift = clamp(e.modeT / CARRIER_SPLIT_TIME, 0, 1);
    if (Math.random() < dt * 30) { smallBoom(e.x + Math.random() * e.w, e.y + Math.random() * e.h, 14 + Math.random() * 14); }
    addShake(3);
    if (e.modeT >= CARRIER_SPLIT_TIME) carrierSplit(e);
    return;
  }
  if (e.stage === 1 && e.hp <= e.phase2Hp) {                 // HP ถึงเกณฑ์: เริ่มแยกร่าง (ช่วงนี้โดนไม่ได้ ดู damageEnemy)
    e.stage = 2; e.mode = 'split'; e.modeT = 0; e.beam = null; e.bar = null; e.charge = 0;
    addShake(9);
    popText(e.x + e.w / 2, e.y - 14, 'PHASE 2', '#ff4a30', 24);
    return;
  }
  if (player.dead) { e.beam = null; e.bar = null; e.charge = 0; return; }

  if (e.beam) {                                              // ---- เลเซอร์ 2 เส้น ----
    const b = e.beam, em = carrierEmitters(e);
    b.t += dt;
    e.charge = clamp(b.t / CARRIER_SIGHT_TIME, 0, 1);
    if (b.t < CARRIER_LOCK_AT) b.ang = carrierBeamAngles(e, pcx, pcy);          // เล็งตามผู้เล่น แล้วล็อกเส้น
    if (b.t >= CARRIER_SIGHT_TIME) {
      b.firing = true;
      b.tick -= dt;
      if (b.tick <= 0) { for (let i = 0; i < 2; i++) carrierBeamTick(em[i], b.ang[i]); b.tick = CARRIER_BEAM_TICK; addShake(2); }
      if (b.t >= CARRIER_SIGHT_TIME + CARRIER_BEAM_TIME) { e.beam = null; e.charge = 0; e.cd = CARRIER_REST; }
    }
    return;
  }
  if (e.bar) {                                               // ---- มิสไซล์ถล่ม ----
    const m = e.bar;
    m.t += dt;
    e.charge = clamp(m.t / CARRIER_BARRAGE_CHARGE, 0, 1);
    if (m.t >= CARRIER_BARRAGE_CHARGE) {
      m.gap -= dt;
      if (m.gap <= 0 && m.n < CARRIER_BARRAGE_N) { carrierMissile(e); m.n++; m.gap = CARRIER_BARRAGE_GAP; e.fireFlash = 0.05; }
      if (m.n >= CARRIER_BARRAGE_N && m.gap <= -0.3) { e.bar = null; e.charge = 0; e.cd = CARRIER_REST + 0.3; }
    }
    return;
  }
  e.cd -= dt;
  if (e.cd <= 0) {
    const pat = e.cycle++ % 4;                               // เลเซอร์ > มิสไซล์ > เลเซอร์ > มิสไซล์
    if (pat % 2 === 0) e.beam = { t: 0, ang: carrierBeamAngles(e, pcx, pcy), tick: 0, firing: false };
    else e.bar = { t: 0, n: 0, gap: 0 };
  }
}

// ---------- ส่วนเชื่อมกับระบบบอส ----------
// หลอด HP บนจอตอนแยกร่าง: รวม HP ของทุกชิ้นเป็นหลอดเดียว (ดู boss.js drawBossHud)
function carrierHudBoss() {
  let hp = 0, any = false;
  for (const o of enemies) if (o.type === 'boss' && o.group === 'carrier') { hp += Math.max(0, o.hp); any = true; }
  return any ? { hp: hp, maxHp: CARRIER_HP * BOSS_HP_MULT, stage: 2, phase2Hp: CARRIER_PHASE2_HP * BOSS_HP_MULT } : null;
}

(function () {
  const baseDefeated = bossDefeated;
  bossDefeated = function (e) {
    if (e.kind === 'carrier') { carrierSplit(e); return; }                  // ตายตอนเฟส 1 (โดนแรงเกิน) = แยกร่างทันที ไม่จบด่าน
    if (e.group === 'carrier') {
      const others = enemies.filter(function (o) { return o !== e && o.type === 'boss' && o.group === 'carrier'; });
      if (others.length) {                                                    // ชิ้นแรกพัง: ยังไม่จบด่าน
        const k = enemies.indexOf(e);
        if (k >= 0) enemies.splice(k, 1);
        const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        addShake(9);
        for (let i = 0; i < 6; i++) smallBoom(cx + (Math.random() - 0.5) * e.w, cy + (Math.random() - 0.5) * e.h, 22 + Math.random() * 26);
        spawnSparks(cx, cy, 40, '#ffb13b');
        popText(cx, e.y - 10, e.kind === 'bomber' ? 'BOMBER DOWN' : 'FORTRESS DOWN', '#ffd23f', 18);
        if (!player.dead) { gainExp(CARRIER_PART_EXP); popText(cx, e.y - 32, '+' + CARRIER_PART_EXP + ' EXP', '#5aa9ff', 14); }
        return;
      }
      e.exp = CARRIER_EXP - CARRIER_PART_EXP; e.reward = CARRIER_REWARD_GOLD;   // ชิ้นสุดท้าย: จบด่าน ได้ EXP ส่วนที่เหลือ + รางวัลเต็ม
    }
    baseDefeated(e);
  };
})();

// ---------- วาด ----------
// ลำแสงเลเซอร์ + เส้นเล็ง (พิกัดจอ) แยกจากตัวถังเพื่อให้ใช้ร่วมกับภาพวาดได้
function drawCarrierBeams(e) {
  if (e.beam) {
    const b = e.beam, em = carrierEmitters(e);
    for (let i = 0; i < 2; i++) {
      const a = b.ang[i], m = em[i], len = carrierBeamLen(m, a);
      const x0 = m.x - cam, y0 = m.y, x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
      ctx.lineCap = 'round';
      if (!b.firing) {
        const locked = b.t >= CARRIER_LOCK_AT, blink = locked ? (Math.floor(b.t * 24) % 2 ? 1 : 0.45) : 1, urg = clamp(b.t / CARRIER_SIGHT_TIME, 0, 1);
        ctx.strokeStyle = 'rgba(255,40,30,' + (0.16 + 0.2 * urg) * blink + ')'; ctx.lineWidth = locked ? 7 : 5;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,80,60,' + (0.5 + 0.5 * urg) * blink + ')'; ctx.lineWidth = locked ? 2.5 : 1.5;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      } else {
        const k = 1 - clamp((b.t - CARRIER_SIGHT_TIME) / CARRIER_BEAM_TIME, 0, 1) * 0.5;
        ctx.strokeStyle = 'rgba(255,60,40,' + 0.35 * k + ')'; ctx.lineWidth = 3 + CARRIER_BEAM_HALF * 2 * k;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,210,180,' + 0.9 * k + ')'; ctx.lineWidth = 4 * k + 1;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    }
  }

}

function drawCarrier(e, sx, sy, flash) {
  const g = e.glow || 0, t = performance.now();
  const c = function (normal) { return flash ? '#ffffff' : normal; };
  const lift = e.lift || 0;

  drawCarrierBeams(e);

  ctx.save();
  ctx.translate(sx, sy);
  if (lift > 0) ctx.translate((Math.random() - 0.5) * 3 * lift, (Math.random() - 0.5) * 2 * lift);   // ตัวสั่นตอนแยกร่าง

  // ตีนตะขาบ
  ctx.fillStyle = '#1b2025'; ctx.fillRect(0, 106, 230, 28);
  ctx.strokeStyle = '#0d1012'; ctx.lineWidth = 2; ctx.strokeRect(1, 107, 228, 26);
  ctx.fillStyle = '#39424b';
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(14 + i * 25.2, 120, 10, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#5a6672';
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(14 + i * 25.2, 120, 4, 0, Math.PI * 2); ctx.fill(); }

  // ตัวถังรถ
  ctx.fillStyle = c('#4a5560');
  ctx.beginPath(); ctx.moveTo(10, 106); ctx.lineTo(4, 76); ctx.lineTo(22, 58); ctx.lineTo(208, 58); ctx.lineTo(226, 76); ctx.lineTo(222, 106); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1a1f24'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = c(g > 0.3 ? '#a02a1c' : '#9a6b24'); ctx.fillRect(30, 92, 170, 8);              // แถบสีข้างรถ
  ctx.fillStyle = c('#5f6e7b'); ctx.fillRect(22, 62, 70, 10); ctx.fillRect(130, 62, 80, 10);      // แผ่นเกราะหลังคา

  // ปืนเลเซอร์ 2 กระบอกหน้ารถ
  const em = carrierEmitters(e), charge = e.beam ? e.charge : 0;
  for (let i = 0; i < 2; i++) {
    const ly = em[i].y - e.y;
    ctx.fillStyle = '#14181c'; ctx.fillRect(-4, ly - 5, 34, 10);
    ctx.fillStyle = '#2d3a46'; ctx.fillRect(8, ly - 8, 18, 4);
    ctx.fillStyle = e.beam ? 'rgb(255,' + Math.floor(120 - 80 * charge) + ',' + Math.floor(80 - 60 * charge) + ')' : '#7a2a20';
    ctx.fillRect(-9, ly - 6, 7, 12);
    if (charge > 0.05) {
      ctx.fillStyle = 'rgba(255,90,60,' + (0.3 + 0.6 * charge) + ')';
      ctx.beginPath(); ctx.arc(-9, ly, 3 + 9 * charge, 0, Math.PI * 2); ctx.fill();
    }
  }

  // เครื่องบินบนหลังรถ (หน้า = ซ้าย) ตอนแยกร่างยกตัวขึ้น
  ctx.save();
  ctx.translate(0, -lift * 46);
  ctx.translate(115, 36);
  const bay = e.bay || 0;
  ctx.fillStyle = c('#2f373e');                                                    // ครีบหาง
  ctx.beginPath(); ctx.moveTo(78, -6); ctx.lineTo(92, -34); ctx.lineTo(62, -8); ctx.closePath(); ctx.fill();
  ctx.fillRect(58, -2, 38, 5);
  ctx.fillStyle = c('#3d464e');                                                    // ปีกล่าง + เครื่องยนต์
  ctx.beginPath(); ctx.moveTo(-30, 6); ctx.lineTo(32, 6); ctx.lineTo(54, 26); ctx.lineTo(-8, 26); ctx.closePath(); ctx.fill();
  for (const ex of [-28, 14]) {
    ctx.fillStyle = '#1f252a'; ctx.fillRect(ex - 12, 20, 26, 10);
    ctx.strokeStyle = 'rgba(200,208,216,0.7)'; ctx.lineWidth = 3;
    const pr = 10 + Math.abs(Math.cos(t / 40 + ex)) * 9;
    ctx.beginPath(); ctx.moveTo(ex - 14, 25 - pr); ctx.lineTo(ex - 14, 25 + pr); ctx.stroke();
  }
  if (lift > 0.2) {                                                                // ไอพ่นท้ายตอนแยกร่าง
    ctx.fillStyle = 'rgba(255,170,70,' + 0.7 * lift + ')';
    ctx.beginPath(); ctx.moveTo(98, -2); ctx.lineTo(98 + 30 * lift + Math.random() * 8, 1); ctx.lineTo(98, 5); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#14181c'; ctx.fillRect(-34, 14, 58, 3 + 7 * bay);              // ท้องเปิดตอนยิงมิสไซล์
  if (bay > 0.4) {
    ctx.fillStyle = '#c9ccc0';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-28 + i * 14, 16); ctx.lineTo(-18 + i * 14, 16); ctx.lineTo(-23 + i * 14, 8); ctx.closePath(); ctx.fill(); }
  }
  ctx.fillStyle = c('#56626c');                                                    // ลำตัวเครื่องบิน
  ctx.beginPath(); ctx.ellipse(0, 0, 90, 17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a1f24'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = c(g > 0.3 ? '#a02a1c' : '#9a6b24'); ctx.fillRect(-30, -3, 78, 6);
  ctx.fillStyle = c('#8fd0ee'); ctx.beginPath(); ctx.ellipse(-66, -4, 16, 9, 0, 0, Math.PI * 2); ctx.fill();   // ห้องนักบิน
  ctx.fillStyle = '#2a3138'; for (let i = 0; i < 5; i++) ctx.fillRect(-40 + i * 12, -9, 6, 4);
  ctx.restore();

  ctx.restore();
}
