'use strict';
/* ==========================================================================
   enemy3.js : ศัตรูใหม่ของด่าน 05
     EnemyBomber    (type 'bomber')    เครื่องบินทิ้งระเบิด บินผ่านเหนือผู้เล่นพร้อมหย่อนระเบิด
                                       บินเลยไปแล้วกลับลำ บินกลับมาใหม่ วนไปเรื่อยๆ จนกว่าจะถูกทำลาย
     EnemyLauncher  (type 'launcher')  รถยิงมิสไซล์ลูกเดียว: ชาร์จแล้วยิงมิสไซล์ตามหัวลูกใหญ่ 1 ลูก
     EnemySwarmer   (type 'swarmer')   รถยิงมิสไซล์ฝูง: ยิงมิสไซล์ลูกเล็กรัวเป็นฝูง (ช่วงแรกเลี้ยวตามผู้เล่น)
   ทุกตัวถูกเรียกจาก enemy.js:  makeXxx() สร้างตัว / updateXxx() AI 1 เฟรม / drawXxx() วาด
   ระเบิด (kind 'bomb') ตกตามแรงโน้มถ่วงและมีระเบิดแรงกระจายตอนถึงพื้น: วิ่งใน updateEnemyShots (weapons.js)
   ========================================================================== */

// ---------- สร้างตัว ----------
function makeBomber(x, y) {
  return {
    type: 'bomber', x: x, y: y, w: BOMBER_W, h: BOMBER_H, hp: BOMBER_HP, maxHp: BOMBER_HP,
    homeX: x, baseY: y, dir: -1, vx: -BOMBER_SPEED, flash: 0, phase: Math.random() * 6,
    bombCd: 0.4, bay: 0
  };
}

// swarm = true: รถยิงมิสไซล์ฝูง / false: รถยิงมิสไซล์ลูกเดียว
function makeLauncher(x, swarm) {
  return {
    type: swarm ? 'swarmer' : 'launcher', x: x, y: GROUND_Y - LAUNCHER_H, w: LAUNCHER_W, h: LAUNCHER_H,
    hp: swarm ? SWARMER_HP : LAUNCHER_HP, maxHp: swarm ? SWARMER_HP : LAUNCHER_HP,
    armor: swarm ? SWARMER_ARMOR : LAUNCHER_ARMOR,
    homeX: x, dir: -1, flash: 0, phase: Math.random() * 6, roll: 0,
    fireCd: 1.8 + Math.random() * 1.5, wind: 0, salvo: 0, salvoCd: 0
  };
}

// ---------- เครื่องบินทิ้งระเบิด ----------
function dropBomb(e) {
  const cx = e.x + e.w / 2;
  enemyShots.push({
    x: cx, y: e.y + e.h, vx: e.vx * 0.9, vy: 30, g: BOMB_GRAVITY,
    dmg: BOMB_DMG, life: 3, r: 7, big: true, kind: 'bomb', splash: BOMB_SPLASH, shieldCost: BOMB_SHIELD_COST
  });
}

function updateBomber(e, dt, pcx, pcy) {
  const cx = e.x + e.w / 2;
  // กลับลำเมื่อบินเลยผู้เล่นไปไกลพอ (หรือใกล้ขอบโลก) แล้ววนไปมาเรื่อยๆ
  if (e.dir < 0 && (cx < pcx - BOMBER_OVERSHOOT || cx < -60)) e.dir = 1;
  else if (e.dir > 0 && (cx > pcx + BOMBER_OVERSHOOT || cx > WORLD_W + 60)) e.dir = -1;
  e.vx += clamp(e.dir * BOMBER_SPEED - e.vx, -BOMBER_ACCEL * dt, BOMBER_ACCEL * dt);   // ค่อยๆ เร่ง/เบรก = วงเลี้ยวโค้ง
  e.x += e.vx * dt;
  const turning = 1 - Math.abs(e.vx) / BOMBER_SPEED;                                   // 0 = บินตรง, 1 = หยุดกลับลำ
  e.y = e.baseY - turning * 14 + Math.sin(e.phase * 3) * 3;                           // ลำเลี้ยวยกสูงขึ้นเล็กน้อย

  e.bombCd -= dt;
  const onScreen = cx > cam - 10 && cx < cam + W + 10;
  const fallT = Math.sqrt(2 * Math.max(10, GROUND_Y - (e.y + e.h)) / BOMB_GRAVITY);
  const land = cx + e.vx * 0.9 * fallT;                                                // จุดที่ระเบิดจะตก
  const inWindow = !player.dead && onScreen && Math.abs(e.vx) > BOMBER_SPEED * 0.6 && Math.abs(land - pcx) < BOMBER_BOMB_WINDOW;
  e.bay += ((inWindow ? 1 : 0) - e.bay) * Math.min(1, dt * 10);                        // ประตูใต้ท้องเปิด/ปิด
  if (inWindow && e.bombCd <= 0) {
    dropBomb(e);
    e.bombCd = BOMBER_BOMB_CD;
  }
}

// ระเบิดตกพื้น: แรงระเบิดกระจายซ้าย-ขวา (โดนเมื่อผู้เล่นอยู่ใกล้พื้น) — เรียกจาก updateEnemyShots
function bombSplash(s) {
  smallBoom(s.x, GROUND_Y - 6, 30);
  smallBoom(s.x + 14, GROUND_Y - 2, 20);
  spawnSparks(s.x, GROUND_Y, 10, '#ffb13b');
  if (player.dead) return;
  if (s.x >= player.x - s.splash && s.x <= player.x + player.w + s.splash && player.y + player.h >= GROUND_Y - 34) {
    damagePlayer(s.dmg, s.shieldCost);
    spawnSparks(player.x + player.w / 2, player.y + player.h / 2, 8, player.shieldUp ? '#4fc3f7' : '#ff8a5c');
  }
}

// ---------- รถยิงมิสไซล์ ----------
const LAUNCH_PIVOT = { x: -10, y: -3 };     // จุดหมุนแท่นยิง (พิกัดท้องถิ่น หันขวา ศูนย์กลาง = กลางตัวรถ)
const LAUNCH_ELEV = -1.05;                  // แท่นยกขึ้น ~60 องศา
const LAUNCH_LEN = 34;

// ปากท่อยิงในพิกัดโลก + ทิศพุ่งออก
function launcherMuzzle(e) {
  const face = e.dir < 0 ? -1 : 1;
  const lx = LAUNCH_PIVOT.x + Math.cos(LAUNCH_ELEV) * LAUNCH_LEN;
  const ly = LAUNCH_PIVOT.y + Math.sin(LAUNCH_ELEV) * LAUNCH_LEN;
  return {
    x: e.x + e.w / 2 + face * lx, y: e.y + e.h / 2 + ly,
    ang: Math.atan2(Math.sin(LAUNCH_ELEV), face * Math.cos(LAUNCH_ELEV))
  };
}

function launchMissile(e, swarm) {
  const m = launcherMuzzle(e);
  let ang = m.ang, spd = swarm ? SWARMER_MISSILE_SPEED : LAUNCHER_MISSILE_SPEED;
  if (swarm) { ang += (Math.random() - 0.5) * 0.9; spd *= 0.9 + Math.random() * 0.25; }
  enemyShots.push({
    x: m.x, y: m.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, speed: spd,
    dmg: swarm ? SWARMER_MISSILE_DMG : LAUNCHER_MISSILE_DMG,
    life: swarm ? 3.8 : 4.4, r: swarm ? 5 : 6, big: !swarm, kind: 'bmissile',
    shieldCost: swarm ? SWARMER_MISSILE_SHIELD_COST : LAUNCHER_MISSILE_SHIELD_COST,
    turn: swarm ? 1.5 + Math.random() * 1.0 : 2.4,           // เลี้ยวตามผู้เล่น (rad/s)
    trackT: swarm ? 0.8 + Math.random() * 0.8 : 1.8,         // เลี้ยวตามแค่ช่วงแรก แล้วพุ่งตรง = หลบได้
    sc: swarm ? 0.8 : 1
  });
  spawnSparks(m.x, m.y, swarm ? 3 : 7, '#e8e2c8');
  if (!swarm) { smallBoom(m.x, m.y, 12); addShake(2); }
}

function updateLauncher(e, dt, pcx, pcy) {
  const swarm = e.type === 'swarmer';
  const cx = e.x + e.w / 2, dx = pcx - cx;
  if (e.kx) {                                                // แรงผลักจากมิสไซล์ผู้เล่น (ผลักได้น้อย)
    e.x = clamp(e.x + e.kx * dt, 0, WORLD_W - e.w);
    e.kx *= Math.pow(0.01, dt);
    if (Math.abs(e.kx) < 5) e.kx = 0;
  }
  const stop = swarm ? SWARMER_STOP_DIST : LAUNCHER_STOP_DIST;
  const vx = Math.abs(dx) > stop ? Math.sign(dx) * LAUNCHER_SPEED : 0;
  e.dir = Math.sign(dx) || e.dir;
  e.x = clamp(e.x + vx * dt, 0, WORLD_W - e.w);
  e.y = GROUND_Y - e.h;
  e.roll += vx * dt;

  // ฝูงที่กำลังรัวอยู่ ยิงต่อจนครบ
  if (swarm && e.salvo > 0) {
    e.salvoCd -= dt;
    if (e.salvoCd <= 0) {
      launchMissile(e, true);
      e.salvo--;
      e.salvoCd = SWARMER_GAP;
      if (e.salvo === 0) e.fireCd = SWARMER_FIRE_CD + Math.random() * 1.2;
    }
    return;
  }

  const onScreen = cx > cam + 20 && cx < cam + W - 10;
  const canShoot = !player.dead && onScreen && Math.abs(dx) < 800;
  e.fireCd -= dt;
  if (canShoot && e.fireCd <= 0) {
    e.wind += dt;                                            // ชาร์จ (ท่อเรืองแสงเตือน)
    if (e.wind >= (swarm ? SWARMER_WINDUP : LAUNCHER_WINDUP)) {
      e.wind = 0;
      if (swarm) { e.salvo = SWARMER_COUNT; e.salvoCd = 0; }
      else { launchMissile(e, false); e.fireCd = LAUNCHER_FIRE_CD + Math.random() * 1.0; }
    }
  } else if (!canShoot) {
    e.wind = 0;
  }
}

// ---------- วาด ----------
function drawBomber(e, sx, sy, flash) {
  const cx = sx + e.w / 2, cy = sy + e.h / 2;
  const f = clamp(e.vx / BOMBER_SPEED, -1, 1);               // บินซ้าย = -1, บินขวา = +1, ตอนกลับลำค่อยๆ พลิกผ่าน 0
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(-f || -0.02, 1);                                 // วาดหันซ้ายเป็นหลัก
  const body = flash ? '#ffffff' : '#5b6670';
  const dark = flash ? '#ffffff' : '#3d464e';
  // ครีบหาง + ปีกหาง
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.moveTo(34, -2); ctx.lineTo(40, -17); ctx.lineTo(25, -2); ctx.closePath(); ctx.fill();
  ctx.fillRect(22, -1, 18, 3);
  // ท้องเครื่องบิน + ประตูระเบิด
  const bay = e.bay || 0;
  ctx.fillStyle = '#1b2025';
  ctx.fillRect(-12, 6, 24, 4 + 2 * bay);
  if (bay > 0.3) {
    ctx.fillStyle = '#7d868e';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-7 + i * 7, 10, 3, 2, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  // ลำตัว
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, 0, 38, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#272e34';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = flash ? '#ffffff' : '#c94a3a';             // แถบแดงข้างลำตัว
  ctx.fillRect(2, -4, 8, 8);
  // กระจกหน้า (ด้านหน้า = ซ้าย)
  ctx.fillStyle = flash ? '#ffffff' : '#9fd6f2';
  ctx.beginPath(); ctx.ellipse(-26, -2, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
  // ปีกหลัก + เครื่องยนต์ใบพัด
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.moveTo(-6, 2); ctx.lineTo(16, 2); ctx.lineTo(26, 13); ctx.lineTo(4, 13); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a3138';
  ctx.fillRect(-12, 7, 12, 7);
  const pr = 8 + Math.abs(Math.cos(e.phase * 34)) * 8;
  ctx.strokeStyle = 'rgba(200,208,216,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-14, 10.5 - pr); ctx.lineTo(-14, 10.5 + pr); ctx.stroke();
  ctx.restore();
}

function drawLauncher(e, sx, sy, flash) {
  const swarm = e.type === 'swarmer';
  ctx.save();
  ctx.translate(sx + e.w / 2, sy + e.h / 2);
  if (e.dir < 0) ctx.scale(-1, 1);                           // วาดหันขวาเป็นหลัก แล้วกลับด้านเมื่อหันซ้าย
  const body = flash ? '#ffffff' : (swarm ? '#7a5d3a' : '#5d6a4f');
  const trim = flash ? '#ffffff' : (swarm ? '#c8742a' : '#8d9a74');
  // ล้อ 3 เพลา
  ctx.fillStyle = '#1b1e20';
  for (let i = 0; i < 3; i++) {
    const wx = -24 + i * 22;
    ctx.beginPath(); ctx.arc(wx, 13, 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#6b7276';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const wx = -24 + i * 22, a = e.roll / 7;
    ctx.beginPath(); ctx.moveTo(wx + Math.cos(a) * 5, 13 + Math.sin(a) * 5); ctx.lineTo(wx - Math.cos(a) * 5, 13 - Math.sin(a) * 5); ctx.stroke();
  }
  // แชสซี + ห้องคนขับ (หน้า = ขวา)
  ctx.fillStyle = body;
  ctx.fillRect(-38, 0, 76, 11);
  ctx.strokeStyle = '#22261d';
  ctx.lineWidth = 2;
  ctx.strokeRect(-37, 1, 74, 9);
  ctx.fillStyle = trim;
  ctx.fillRect(-38, 4, 52, 2);
  ctx.fillStyle = flash ? '#ffffff' : '#46523a';
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(20, -12); ctx.lineTo(36, -12); ctx.lineTo(38, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : '#9fd6f2';
  ctx.fillRect(25, -10, 9, 6);
  // เสาค้ำ + แท่นยิง (หมุนที่จุด pivot ยกขึ้น 60 องศา)
  ctx.strokeStyle = '#2a3138';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(LAUNCH_PIVOT.x + 12, -14); ctx.stroke();
  ctx.save();
  ctx.translate(LAUNCH_PIVOT.x, LAUNCH_PIVOT.y);
  ctx.rotate(LAUNCH_ELEV);
  const charge = clamp(e.wind / (swarm ? SWARMER_WINDUP : LAUNCHER_WINDUP), 0, 1);
  const glow = 'rgba(255,' + Math.round(190 - 120 * charge) + ',60,' + (0.55 + 0.45 * charge) + ')';
  if (swarm) {
    ctx.fillStyle = '#2b2d2a';
    ctx.fillRect(0, -9, LAUNCH_LEN, 18);                     // กล่องท่อยิงหลายท่อ
    ctx.fillStyle = '#3d4036';
    for (let i = 0; i < 3; i++) ctx.fillRect(2, -7 + i * 5.5, LAUNCH_LEN - 4, 3.5);
    ctx.fillStyle = charge > 0 || e.salvo > 0 ? glow : '#8a8f7a';
    ctx.fillRect(LAUNCH_LEN - 4, -9, 4, 18);
  } else {
    ctx.fillStyle = '#2b2d2a';
    ctx.fillRect(0, -5, LAUNCH_LEN, 10);                     // ท่อยิงเดี่ยว
    ctx.fillStyle = trim;
    ctx.fillRect(6, -6, 4, 12);
    ctx.fillStyle = charge > 0 ? glow : '#8a8f7a';
    ctx.fillRect(LAUNCH_LEN - 5, -6, 6, 12);
    if (charge < 1 && e.wind === 0) {                        // มิสไซล์โผล่หัวรอยิง
      ctx.fillStyle = '#d9462f';
      ctx.beginPath(); ctx.moveTo(LAUNCH_LEN - 4, -3); ctx.lineTo(LAUNCH_LEN + 5, 0); ctx.lineTo(LAUNCH_LEN - 4, 3); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  ctx.restore();
}
