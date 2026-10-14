'use strict';
/* ==========================================================================
   boss4.js : บอสด่าน 06  MIMIC ATTACKER I
     หุ่นเลียนแบบผู้เล่น วาดด้วย sprite พาร์ท Basic ชุดตั้งต้น (ไม่ขึ้นกับพาร์ทที่ผู้เล่นสวม) ใหญ่ 1.5 เท่า
     อาวุธ: ไรเฟิลสไนเปอร์ตัวแรก (sniper_1) + มิสไซล์พอดตั้งต้น (single_1)  ขยับ/แดช/กระโดดเหมือนผู้เล่น
     เฟส 1  สลับ: สไนเปอร์ (เลเซอร์ไซต์ล็อกเส้นแล้วยิง) <-> มิสไซล์เดี่ยว/คู่ที่เลี้ยวตามเบาๆ
     เฟส 2  สไนเปอร์ยิงเบิ้ล 2 นัดทุกครั้ง (เส้นเดิม) + สแปมฝูงมิสไซล์ทุก 5 วินาที (ยิงแยกอิสระจากสไนเปอร์)
   ใช้ระบบ WARNING / กล้องล็อก / เฟส / รางวัล ชุดเดียวกับบอสอื่น (boss.js, boss2.js) และเลเซอร์ไซต์ของ enemy2.js
   ========================================================================== */

// สวมชุดตั้งต้นชั่วคราวระหว่างเรียกฟังก์ชันวาด/คำนวณที่อ่านจาก profile (ผู้เล่นไม่เห็นผล เพราะทำงานแบบซิงโครนัส)
function withMimicLoadout(fn) {
  const sp = profile.equippedParts, sw = profile.equippedWeapon, sc = player.crouch;
  profile.equippedParts = defaultEquippedParts();
  profile.equippedWeapon = { gun: 'sniper_1', missile: STARTER_WEAPONS.missile };
  player.crouch = 0;
  try { return fn(); }
  finally { profile.equippedParts = sp; profile.equippedWeapon = sw; player.crouch = sc; }
}

function makeMimic(startX, lockX) {
  return {
    type: 'boss', kind: 'mimic', phase2Hp: MIM_PHASE2_HP, exp: MIM_EXP, reward: MIM_REWARD_GOLD,
    x: startX, y: GROUND_Y - MIM_H, w: MIM_W, h: MIM_H, hp: MIM_HP, maxHp: MIM_HP, armor: MIM_ARMOR,
    dir: -1, flash: 0, phase: 0, stage: 1, mode: 'intro', modeT: 0, introT: 0,
    startX: startX, restX: lockX + W - MIM_W - 70,
    glow: 0, fireFlash: 0, cd: 1.4, sight: null, rifle: Math.PI, gx: 0, gy: 0, gl: 0,
    vx: 0, vy: 0, mv: { act: 'idle', dir: 0, t: 0.6 }, dashT: 0, dashDir: 1, walk: 0, ghostT: 0, ghosts: [],
    mq: [], cycle: 0, podT: 0, podAng: 0, salvo: 0, salvoT: 0, swarmT: MIM_SWARM_CD
  };
}

// ---------- ตำแหน่งปืน/มิสไซล์ (คำนวณจากชุดตั้งต้นเดียวกับที่วาด) ----------
function mimicFacing(e) { return Math.cos(e.rifle) >= 0 ? 1 : -1; }

function mimicPivot(e) {                                    // อัปเดตจุดจับปืน (gx,gy) และระยะปากกระบอก (gl) ให้ sniperMuzzle/fireSnipe/drawSights ใช้ได้
  withMimicLoadout(function () {
    const sx = e.w / 2, sy = e.h - 55 * MIM_K;              // หัวไหล่ (RIG.ARMS.at.y = 55 สูงจากเท้า)
    const hand = armHandAt(sx, sy, e.rifle, MIM_K, 0);
    e.gx = hand.x; e.gy = hand.y;
    e.gl = (weaponMuzzleReach(equippedGun()) + 6) * MIM_K;
  });
}

function mimicPodMuzzle(e) {
  const f = mimicFacing(e);
  const px = e.x + e.w / 2 + POD_AT.x * f * MIM_K, py = e.y + e.h - POD_AT.y * MIM_K;
  return { x: px, y: py };
}

// ---------- มิสไซล์ ----------
function mimicAimedMissile(e, pcx, pcy, off) {
  const m = mimicPodMuzzle(e);
  let ang = Math.atan2(pcy - m.y, pcx - m.x) + (off || 0);
  const f = Math.cos(ang) >= 0 ? 1 : -1;
  if (f !== mimicFacing(e)) ang = f > 0 ? -0.3 : Math.PI + 0.3;     // ไม่ยิงย้อนหลัง
  enemyShots.push({
    x: m.x, y: m.y, vx: Math.cos(ang) * MIM_MISSILE_SPEED, vy: Math.sin(ang) * MIM_MISSILE_SPEED, speed: MIM_MISSILE_SPEED,
    dmg: MIM_MISSILE_DMG, life: 4.2, r: 6, big: true, kind: 'bmissile', shieldCost: MIM_MISSILE_SHIELD_COST,
    turn: 2.2, trackT: 1.7, sc: 1
  });
  e.podT = 0.5; e.podAng = ang;
  spawnSparks(m.x, m.y, 6, '#e8e2c8');
  smallBoom(m.x, m.y, 12);
  addShake(2);
}

function mimicSwarmMissile(e) {                             // สแปมฝูง: ยิงเงยขึ้นเป็นพัด แล้วเลี้ยวไล่ผู้เล่น
  const m = mimicPodMuzzle(e), f = mimicFacing(e);
  const ang = (f > 0 ? POD_REST : Math.PI - POD_REST) + (Math.random() - 0.5) * 1.1;
  const spd = MIM_SWARM_SPEED * (0.9 + Math.random() * 0.25);
  enemyShots.push({
    x: m.x, y: m.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, speed: spd,
    dmg: MIM_SWARM_DMG, life: 4.0, r: 5, big: false, kind: 'bmissile', shieldCost: MIM_SWARM_SHIELD_COST,
    turn: 1.6 + Math.random() * 1.0, trackT: 0.9 + Math.random() * 0.9, sc: 0.8
  });
  e.podT = 0.25; e.podAng = ang;
  spawnSparks(m.x, m.y, 3, '#e8e2c8');
}

// ---------- เคลื่อนที่: เดิน / ถอย / กระโดด / แดช ----------
function mimicMove(e, dt, pcx, frozen) {
  const lo = mission.lockX + 14, hi = mission.lockX + W - e.w - 14;
  const cx = e.x + e.w / 2, dist = Math.abs(pcx - cx), toward = Math.sign(pcx - cx) || 1;
  const sp = e.stage === 2 ? MIM_SPEED2 : MIM_SPEED;
  const mv = e.mv;
  const floorY = GROUND_Y - e.h;
  if (e.y < floorY || e.vy < 0) { e.vy += GRAVITY * dt; e.y += e.vy * dt; if (e.y >= floorY) { e.y = floorY; e.vy = 0; spawnSparks(cx, GROUND_Y, 4, '#b8b0a0'); } }
  else e.y = floorY;
  const air = e.y < floorY - 1;

  if (e.dashT > 0) {                                        // แดช: พุ่งเร็วแล้วหยุด
    e.dashT -= dt;
    e.vx = e.dashDir * MIM_DASH_SPEED;
    e.ghostT -= dt;
    if (e.ghostT <= 0) { e.ghostT = 0.03; e.ghosts.push({ x: e.x, y: e.y, t: 0.22, f: mimicFacing(e) }); }
  } else if (frozen) {
    e.vx *= Math.pow(0.0005, dt);                           // เล็งสไนเปอร์: ยืนนิ่ง
  } else {
    mv.t -= dt;
    if (mv.t <= 0) {
      const r = Math.random();
      mv.t = 0.6 + Math.random() * 0.8;
      const cornered = (toward > 0 && e.x <= lo + 4) || (toward < 0 && e.x >= hi - 4);
      if (dist < 190 && cornered) {                         // ถูกต้อนที่ขอบ: กระโดดข้ามหัวผู้เล่น
        e.vy = -MIM_HOP_VY * 1.15; mv.act = 'over'; mv.dir = toward; mv.t = 0.9;
      } else if (dist < 220) { mv.act = r < 0.4 ? 'dash' : 'walk'; mv.dir = -toward; }
      else if (dist > 470) { mv.act = 'walk'; mv.dir = toward; }
      else if (r < 0.30) { mv.act = 'walk'; mv.dir = Math.random() < 0.5 ? -1 : 1; }
      else if (r < 0.52) { mv.act = 'hop'; mv.dir = Math.random() < 0.5 ? -1 : 1; if (!air) e.vy = -MIM_HOP_VY; }
      else if (r < 0.74) { mv.act = 'dash'; mv.dir = Math.random() < 0.5 ? -1 : 1; }
      else { mv.act = 'idle'; mv.dir = 0; }
      if (mv.act === 'dash') { e.dashT = MIM_DASH_TIME; e.dashDir = mv.dir || -toward; spawnSparks(cx, e.y + e.h, 8, '#9fd8ff'); }
    }
    const tgt = (mv.act === 'walk' || mv.act === 'hop') ? mv.dir * sp : (mv.act === 'over' ? mv.dir * 330 : 0);
    e.vx += clamp(tgt - e.vx, -900 * dt, 900 * dt);
  }
  e.x = clamp(e.x + e.vx * dt, lo, hi);
  e.walk += Math.abs(e.vx) * dt / 38;
  for (let i = e.ghosts.length - 1; i >= 0; i--) { e.ghosts[i].t -= dt; if (e.ghosts[i].t <= 0) e.ghosts.splice(i, 1); }
}

// ---------- สมอง ----------
function updateMimic(e, dt, pcx, pcy) {
  bossCommon(e, dt);
  e.podT = Math.max(0, e.podT - dt);
  mimicPivot(e);
  if (e.mode === 'intro') {
    bossIntroSlide(e, dt);
    e.y = GROUND_Y - e.h;
    sniperTurn(e, dt, pcx, pcy, false);
    return;
  }
  bossStageCheck(e);
  if (e.stage === 2 && e.swarmT > MIM_SWARM_CD) e.swarmT = MIM_SWARM_CD;

  if (e.mode === 'roar') {
    e.modeT += dt;
    mimicMove(e, dt, pcx, true);
    sniperTurn(e, dt, pcx, pcy, false);
    e.mq = [];
    if (e.modeT >= 1.2) { e.mode = 'fight'; e.cd = 0.8; e.swarmT = 3.0; }
    return;
  }
  if (player.dead) { e.sight = null; e.mq = []; mimicMove(e, dt, pcx, true); sniperTurn(e, dt, pcx, pcy, false); return; }

  mimicMove(e, dt, pcx, !!e.sight);

  // สแปมฝูงมิสไซล์ (เฟส 2): ทุก 5 วินาที ยิงต่อเนื่อง แยกอิสระจากสไนเปอร์
  if (e.stage === 2) {
    e.swarmT -= dt;
    if (e.swarmT <= 0 && e.salvo <= 0) { e.salvo = MIM_SWARM_N; e.salvoT = 0.25; e.swarmT = MIM_SWARM_CD; popText(e.x + e.w / 2, e.y - 12, 'MISSILE SWARM', '#ff9a5a', 13); }
    if (e.salvo > 0) {
      e.salvoT -= dt;
      if (e.salvoT <= 0) { mimicSwarmMissile(e); e.salvo--; e.salvoT = MIM_SWARM_GAP; }
    }
  }

  // คิวมิสไซล์เดี่ยว/คู่ (เฟส 1)
  if (e.mq.length) {
    for (let i = e.mq.length - 1; i >= 0; i--) {
      e.mq[i] -= dt;
      if (e.mq[i] <= 0) { e.mq.splice(i, 1); mimicAimedMissile(e, pcx, pcy, e.mq.length ? 0.07 : -0.07 * (i % 2)); }
    }
    sniperTurn(e, dt, pcx, pcy, false);
    if (!e.mq.length) e.cd = MIM_REST;
    return;
  }

  if (e.sight) {
    const s = e.sight;
    if (s.hold > 0) {                                       // รอนัดที่สอง (เส้นเดิม ล็อกอยู่)
      s.hold -= dt;
      if (s.hold <= 0) { fireSnipe(e, e.rifle, MIM_SNIPE_DMG); e.fireFlash = 0.1; e.sight = null; e.cd = MIM_REST2; }
      return;
    }
    s.t += dt;
    sniperTurn(e, dt, pcx, pcy, s.t >= MIM_LOCK_AT);
    if (s.t >= MIM_SIGHT_TIME) {
      fireSnipe(e, e.rifle, MIM_SNIPE_DMG);
      e.fireFlash = 0.12;
      if (s.shots > 1) { s.hold = MIM_DOUBLE_GAP; s.t = SNIPER_SIGHT_TIME; }      // เฟส 2: เบิ้ล (เส้นไซต์ค้างกะพริบรอนัดสอง)
      else { e.sight = null; e.cd = MIM_REST; }
    }
    return;
  }

  sniperTurn(e, dt, pcx, pcy, false);
  e.cd -= dt;
  if (e.cd > 0) return;
  if (e.stage === 2) { e.sight = { t: 0, offs: [0], shots: 2 }; return; }
  const pat = e.cycle++ % 4;                                // เฟส 1: สไนเปอร์ > มิสไซล์เดี่ยว > สไนเปอร์ > มิสไซล์คู่
  if (pat === 0 || pat === 2) e.sight = { t: 0, offs: [0], shots: 1 };
  else e.mq = pat === 1 ? [0.35] : [0.35, 0.6];
}

// ---------- วาด ----------
function mimicFallback(cx, feetY, f, e, flash) {            // ไม่มีไฟล์ภาพ Basic: วาดหุ่นบล็อกแทน
  const k = MIM_K, c = flash ? '#d9694f' : '#6d7a47', L = '#161a1e';
  const box = function (col, x, y, w, h) { ctx.fillStyle = col; ctx.fillRect(cx + x * k, feetY - (y + h) * k, w * k, h * k); ctx.strokeStyle = L; ctx.lineWidth = 2; ctx.strokeRect(cx + x * k, feetY - (y + h) * k, w * k, h * k); };
  box(c, -16, 0, 12, 12); box(c, 4, 0, 12, 12);                     // ขา
  box(c, -20, 12, 40, 16);                                          // ลำตัว
  box(c, -10, 28, 20, 12);                                          // หัว
  const sx = cx, sy = feetY - 55 * k;
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(e.rifle); ctx.fillStyle = '#2a2f33'; ctx.fillRect(0, -3 * k, 56 * k, 6 * k); ctx.restore();
}

function drawMimic(e, sx, sy, flash) {
  const g = e.glow || 0, pulse = 0.65 + 0.35 * Math.sin(performance.now() / 110);
  const cx = sx + e.w / 2, feetY = sy + e.h;
  const f = mimicFacing(e) > 0;
  ctx.save();
  if (g > 0.02) {                                           // แสงแดงรอบตัวในเฟส 2
    const gr = ctx.createRadialGradient(cx, sy + e.h / 2, 20, cx, sy + e.h / 2, 150);
    gr.addColorStop(0, 'rgba(255,50,30,' + (0.34 * g * pulse) + ')');
    gr.addColorStop(1, 'rgba(255,50,30,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(cx - 160, sy - 60, 320, 260);
  }
  const air = clamp((GROUND_Y - feetY) / 200, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,' + (0.35 - air * 0.2) + ')';
  ctx.beginPath(); ctx.ellipse(cx, GROUND_Y + 2, 36 - air * 12, 5, 0, 0, Math.PI * 2); ctx.fill();

  withMimicLoadout(function () {
    const hasArt = !!equippedPartImage('BODY');
    const podRest = f ? POD_REST : Math.PI - POD_REST;
    const podAng = e.podT > 0 ? e.podAng : podRest;
    const bob = Math.min(1, Math.abs(e.vx) / 100) * Math.abs(Math.sin(e.walk)) * 1.6;
    const lean = clamp(e.vx / 650, -0.2, 0.2) * (e.dashT > 0 ? 1 : 0.5);
    for (const gh of e.ghosts) {                            // ภาพติดตาตอนแดช
      if (!hasArt) break;
      ctx.globalAlpha = clamp(gh.t / 0.22, 0, 1) * 0.28;
      drawMechArt(gh.x - cam + e.w / 2, gh.y + e.h, MIM_K, gh.f > 0, gh.f > 0 ? 0 : Math.PI, gh.f > 0 ? POD_REST : Math.PI - POD_REST, false, false, false, 0, lean, 0);
    }
    ctx.globalAlpha = 1;
    if (!flash) ctx.filter = 'drop-shadow(0 0 ' + (4 + 4 * g) + 'px rgba(255,64,44,' + (0.55 + 0.35 * g) + '))';   // ออร่าแดงบางๆ แยกจากผู้เล่น
    if (hasArt) drawMechArt(cx, feetY, MIM_K, f, e.rifle, podAng, e.podT > 0, flash, false, bob, lean, 0);
    else mimicFallback(cx, feetY, f, e, flash);
    ctx.filter = 'none';
  });
  if (e.fireFlash > 0) {                                    // แสงปากกระบอก
    const mx = e.x + e.gx + Math.cos(e.rifle) * e.gl - cam, my = e.y + e.gy + Math.sin(e.rifle) * e.gl;
    ctx.fillStyle = 'rgba(255,230,160,0.9)';
    ctx.beginPath(); ctx.arc(mx, my, 14, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
