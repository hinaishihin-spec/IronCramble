'use strict';
/* ==========================================================================
   boss3.js : บอสด่าน 05  GIANT BOMBER + ลูกน้อง (เครื่องบินขับไล่จิ๋ว)
     เฟส 1  บินวนข้ามจอไปมา (เลยขอบจอแล้วกลับลำ) ทิ้งระเบิดลูกใหญ่เป็นพรมใส่ผู้เล่น  (ท่าเดียวกับ Bomber ทั่วไป แต่หนักกว่ามาก)
     เฟส 2  เลิกทิ้งระเบิด หันมาเปิดประตูท้องปล่อยเครื่องบินขับไล่จิ๋ว (type 'fighter') ออกมาโจมตี (ยิงกราดผ่านจอ)
   ระบบ WARNING / กล้องล็อก / ฉากพัง / รางวัล ใช้ชุดเดียวกับบอสตัวอื่น (boss.js, boss2.js)
   ========================================================================== */

// ---------- Giant Bomber ----------
function makeGiantBomber(startX, lockX) {
  return {
    type: 'boss', kind: 'bomber', phase2Hp: GB_PHASE2_HP, exp: GB_EXP, reward: GB_REWARD_GOLD,
    x: startX, y: GB_Y, w: GB_W, h: GB_H, hp: GB_HP, maxHp: GB_HP, armor: GB_ARMOR,
    dir: -1, vx: -GB_SPEED, flash: 0, phase: 0, stage: 1, mode: 'intro', modeT: 0, introT: 0,
    startX: startX, restX: lockX + W - GB_W - 30,
    glow: 0, fireFlash: 0, cd: 1.2, bay: 0, charge: 0, salvo: 0
  };
}

function updateGiantBomber(e, dt, pcx, pcy) {
  bossCommon(e, dt);
  if (e.mode === 'intro') {
    bossIntroSlide(e, dt);
    e.y = GB_Y;
    return;
  }
  bossStageCheck(e);

  const lockX = mission.lockX;
  const cx = e.x + e.w / 2;
  // บินข้ามจอไปมา เลยขอบจอไปแล้วกลับลำ (เฟส 2 เร็วขึ้น)
  if (e.dir < 0 && cx < lockX - GB_MARGIN) e.dir = 1;
  else if (e.dir > 0 && cx > lockX + W + GB_MARGIN) e.dir = -1;
  const sp = e.stage === 2 ? GB_SPEED2 : GB_SPEED;
  e.vx += clamp(e.dir * sp - e.vx, -GB_ACCEL * dt, GB_ACCEL * dt);
  e.x += e.vx * dt;
  const turning = 1 - Math.min(1, Math.abs(e.vx) / sp);
  e.y = GB_Y - turning * 10 + Math.sin(e.phase * 1.4) * 4;

  if (e.mode === 'roar') {                                  // เปลี่ยนเฟส: บินต่อแต่ยังไม่โจมตี
    e.modeT += dt;
    e.bay += (0 - e.bay) * Math.min(1, dt * 8);
    if (e.modeT >= 1.2) { e.mode = 'fight'; e.cd = 1.0; }
    return;
  }
  if (player.dead) { e.bay += (0 - e.bay) * Math.min(1, dt * 8); return; }

  e.cd -= dt;
  const onScreen = cx > cam + 10 && cx < cam + W - 10;
  if (e.stage === 1) {
    // เฟส 1: ทิ้งระเบิดใหญ่เป็นพรมเมื่อจุดตกใกล้ผู้เล่น
    const fallT = Math.sqrt(2 * Math.max(10, GROUND_Y - (e.y + e.h)) / BOMB_GRAVITY);
    const land = cx + e.vx * 0.9 * fallT;
    const inWindow = onScreen && Math.abs(e.vx) > sp * 0.6 && Math.abs(land - pcx) < GB_BOMB_WINDOW;
    e.bay += ((inWindow ? 1 : 0) - e.bay) * Math.min(1, dt * 10);
    if (inWindow && e.cd <= 0) {
      e.cd = GB_BOMB_CD;
      enemyShots.push({
        x: cx, y: e.y + e.h, vx: e.vx * 0.9, vy: 30, g: BOMB_GRAVITY,
        dmg: GB_BOMB_DMG, life: 3, r: 10, big: true, kind: 'bomb', sc: GB_BOMB_SCALE,
        splash: GB_BOMB_SPLASH, shieldCost: GB_BOMB_SHIELD_COST
      });
      e.fireFlash = 0.05;
    }
  } else {
    // เฟส 2: เปิดประตูท้อง ปล่อยเครื่องบินขับไล่จิ๋ว (ไม่เกินจำนวนสูงสุดที่อยู่พร้อมกันได้)
    const ready = e.cd < 0.6 && onScreen && bossMinions() < GB_FIGHTER_CAP;
    e.bay += ((ready ? 1 : 0) - e.bay) * Math.min(1, dt * 6);
    e.charge = ready ? clamp(1 - e.cd / 0.6, 0, 1) : 0;
    if (e.cd <= 0 && onScreen) {
      const n = Math.min(GB_LAUNCH_N, GB_FIGHTER_CAP - bossMinions());
      if (n > 0) {
        for (let i = 0; i < n; i++) enemies.push(scaleEnemyHp(makeFighter(cx + (i - (n - 1) / 2) * 30, e.y + e.h, pcx, pcy), ENEMY_HP_MULT));
        spawnSparks(cx, e.y + e.h, 8, '#8fe3b0');
        e.fireFlash = 0.1;
        e.cd = GB_LAUNCH_CD;
      } else {
        e.cd = 0.5;
      }
      e.charge = 0;
    }
  }
}

function drawGiantBomber(e, sx, sy, flash) {
  const g = e.glow || 0;
  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 110);
  const c = function (normal) { return flash ? '#ffffff' : normal; };
  const f = clamp(e.vx / GB_SPEED, -1, 1);
  ctx.save();
  ctx.translate(sx + e.w / 2, sy + e.h / 2);
  if (g > 0.02) {                                           // แสงแดงรอบตัวในเฟส 2
    const gr = ctx.createRadialGradient(0, 0, 20, 0, 0, 170);
    gr.addColorStop(0, 'rgba(255,50,30,' + (0.34 * g * pulse) + ')');
    gr.addColorStop(1, 'rgba(255,50,30,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(-190, -150, 380, 300);
  }
  ctx.scale(-f || -0.02, 1);                                // วาดหันซ้าย (จมูก -x) บินขวาจะพลิกกลับ

  // ครีบหาง + ปีกหาง
  ctx.fillStyle = c('#2f373e');
  ctx.beginPath(); ctx.moveTo(78, -8); ctx.lineTo(94, -46); ctx.lineTo(60, -10); ctx.closePath(); ctx.fill();
  ctx.fillRect(56, -3, 42, 6);

  // ปีกหลัก (ด้านล่างลำตัว) + เครื่องยนต์ใบพัด 2 ตัว
  ctx.fillStyle = c('#3d464e');
  ctx.beginPath(); ctx.moveTo(-30, 8); ctx.lineTo(34, 8); ctx.lineTo(58, 34); ctx.lineTo(-6, 34); ctx.closePath(); ctx.fill();
  for (const ex of [-32, 14]) {
    ctx.fillStyle = '#1f252a';
    ctx.fillRect(ex - 14, 26, 30, 12);
    const pr = 12 + Math.abs(Math.cos(e.phase * 30 + ex)) * 10;
    ctx.strokeStyle = 'rgba(200,208,216,0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(ex - 16, 32 - pr); ctx.lineTo(ex - 16, 32 + pr); ctx.stroke();
  }

  // ประตูท้อง (เปิดตอนทิ้งระเบิด / ปล่อยเครื่องบิน)
  const bay = e.bay || 0;
  ctx.fillStyle = '#14181c';
  ctx.fillRect(-40, 18, 60, 3 + 8 * bay);
  if (bay > 0.3) {
    if (e.stage === 2) {                                    // เครื่องบินขับไล่จิ๋วโผล่รอ
      ctx.fillStyle = c('#7d8a96');
      for (let i = 0; i < 2; i++) {
        ctx.beginPath(); ctx.moveTo(-34 + i * 28, 24); ctx.lineTo(-14 + i * 28, 24); ctx.lineTo(-24 + i * 28, 30); ctx.closePath(); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#9aa3ab';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-30 + i * 17, 25, 6, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  // ลำตัวหลัก
  ctx.fillStyle = c('#56626c');
  ctx.beginPath(); ctx.ellipse(0, 0, 96, 24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a1f24';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = c(g > 0.3 ? '#a02a1c' : '#9a6b24');       // แถบสีข้างลำตัว
  ctx.fillRect(-32, -4, 80, 8);
  ctx.fillStyle = c('#66737e');                              // แผ่นเกราะบน
  ctx.fillRect(-10, -22, 60, 7);
  // กระจกห้องนักบิน (หน้า = ซ้าย) + หน้าต่างแถว
  ctx.fillStyle = c(g > 0.3 ? '#ff6a4a' : '#8fd0ee');
  ctx.beginPath(); ctx.ellipse(-70, -5, 18, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = c('#2a3138');
  for (let i = 0; i < 5; i++) ctx.fillRect(-42 + i * 12, -12, 6, 5);
  // ป้อมปืนบนหลัง
  ctx.fillStyle = '#2a3138';
  ctx.beginPath(); ctx.arc(26, -22, 8, Math.PI, 0); ctx.fill();
  ctx.fillRect(26, -26, 16, 3);

  if (e.fireFlash > 0) {
    ctx.fillStyle = 'rgba(255,230,160,0.8)';
    ctx.beginPath(); ctx.arc(-10, 26, 14, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------- เครื่องบินขับไล่จิ๋ว (ลูกน้อง Giant Bomber เฟส 2) ----------
// state: 'launch' ตกลงจากท้องบอสสั้นๆ -> 'run' บินกราดผ่านจอพร้อมยิง -> 'away' บินพ้นจอแล้วกลับลำ รอสักครู่ -> 'run' ...
function makeFighter(x, y, pcx, pcy) {
  const fx = x - FIGHTER_W / 2;
  return {
    type: 'fighter', x: fx, y: y, w: FIGHTER_W, h: FIGHTER_H, hp: FIGHTER_HP, maxHp: FIGHTER_HP,
    homeX: fx, dir: Math.sign(pcx - x) || (Math.random() < 0.5 ? -1 : 1), flash: 0, phase: Math.random() * 6,
    minion: true, state: 'launch', stT: 0.45, vy: 120, targetY: 0,
    burst: 0, burstT: 0, fireCd: 0.6 + Math.random() * 0.6, wait: 0
  };
}

function fighterPickAltitude(e, pcy) {
  e.targetY = clamp(pcy - 30 + Math.random() * 60 - 20, 70, GROUND_Y - 50);
}

function updateFighter(e, dt, pcx, pcy) {
  if (e.state === 'launch') {                               // ร่วงออกจากท้องบอส
    e.stT -= dt;
    e.y += e.vy * dt;
    e.vy *= Math.pow(0.4, dt);
    if (e.stT <= 0) { e.state = 'run'; fighterPickAltitude(e, pcy); }
    return;
  }
  if (e.state === 'away') {                                 // พ้นจอแล้ว: รอแล้วเข้ามาใหม่จากอีกฝั่ง
    e.wait -= dt;
    e.y += (e.targetY - e.y) * Math.min(1, dt * 3);
    if (e.wait <= 0) e.state = 'run';
    return;
  }
  // run: บินตรงข้ามจอ ปรับความสูงเข้าหาระดับผู้เล่นนุ่มๆ
  e.x += e.dir * FIGHTER_SPEED * dt;
  e.y += (e.targetY - e.y) * Math.min(1, dt * 2.5);

  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  const dx = pcx - cx;
  if (!player.dead && e.burst <= 0) {
    e.fireCd -= dt;
    // ยิงเมื่อผู้เล่นอยู่ข้างหน้าในระยะ และเครื่องอยู่ในจอ
    if (e.fireCd <= 0 && dx * e.dir > 40 && Math.abs(dx) < 430 && cx > cam && cx < cam + W) {
      e.burst = 3; e.burstT = 0;
      e.fireCd = FIGHTER_BURST_CD + Math.random() * 0.8;
    }
  }
  if (e.burst > 0) {
    e.burstT -= dt;
    if (e.burstT <= 0) {
      const base = e.dir > 0 ? 0 : Math.PI;
      const want = Math.atan2(pcy - cy, pcx - cx);
      const d = Math.atan2(Math.sin(want - base), Math.cos(want - base));
      const a = base + clamp(d, -0.35, 0.35);               // ยิงไปข้างหน้า เบี่ยงเข้าหาผู้เล่นได้ไม่มาก
      enemyShots.push({
        x: cx + e.dir * 18, y: cy, vx: Math.cos(a) * FIGHTER_SHOT_SPEED, vy: Math.sin(a) * FIGHTER_SHOT_SPEED,
        dmg: FIGHTER_SHOT_DMG, life: 1.6
      });
      spawnSparks(cx + e.dir * 18, cy, 1, '#ffd36b');
      e.burst--;
      e.burstT = 0.09;
    }
  }

  // พ้นจอไปอีกฝั่งแล้ว: กลับลำ เลือกความสูงใหม่ รอสักครู่
  if ((e.dir > 0 && cx > cam + W + 140) || (e.dir < 0 && cx < cam - 140)) {
    e.dir = -e.dir;
    e.state = 'away';
    e.wait = 0.5 + Math.random() * 0.6;
    e.burst = 0;
    fighterPickAltitude(e, pcy);
  }
}

function drawFighter(e, sx, sy, flash) {
  const cx = sx + e.w / 2, cy = sy + e.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  if (e.dir < 0) ctx.scale(-1, 1);                          // วาดหันขวา (จมูก +x)
  const body = flash ? '#ffffff' : '#5f6f7c';
  const dark = flash ? '#ffffff' : '#3a444c';
  // ไอพ่นท้าย
  if (e.state === 'run') {
    ctx.fillStyle = 'rgba(255,170,70,' + (0.55 + 0.3 * Math.sin(e.phase * 50)) + ')';
    ctx.beginPath(); ctx.moveTo(-17, -2); ctx.lineTo(-27 - Math.random() * 5, 0); ctx.lineTo(-17, 2); ctx.closePath(); ctx.fill();
  }
  // ครีบหาง + ปีก
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.moveTo(-16, -3); ctx.lineTo(-21, -11); ctx.lineTo(-9, -3); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(4, 1); ctx.lineTo(-11, 7); ctx.lineTo(-4, 1); ctx.closePath(); ctx.fill();
  // ลำตัว
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(-17, -3); ctx.lineTo(8, -4); ctx.lineTo(19, 0); ctx.lineTo(8, 4); ctx.lineTo(-17, 3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1d2329';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = flash ? '#ffffff' : '#9fd6f2';            // กระจกห้องนักบิน
  ctx.beginPath(); ctx.ellipse(5, -2, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : '#c94a3a';            // แถบแดงท้ายลำ
  ctx.fillRect(-12, -1.5, 5, 3);
  ctx.restore();
}
