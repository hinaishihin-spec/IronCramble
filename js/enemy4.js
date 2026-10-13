'use strict';
/* ==========================================================================
   enemy4.js : ศัตรูใหม่ของด่าน 06
     EnemyMonolet   (type 'monolet')  หุ่นสองขาคล้ายนกกระจอกเทศ หัวคือปืนเลเซอร์ วิ่งเว้นระยะจากผู้เล่น
                                      สลับ 2 ท่า: ยืนชาร์จแล้วยิงเลเซอร์ต่อเนื่อง / กระโดดแล้วยิงกลางอากาศ
     EnemyTPlane    (type 'tplane')   เครื่องบินปีกบินล่องหน (Tactical Plane) โฉบทิ้งระเบิดเป็นรอบๆ
                                      ล่องหนเป็นปกติ: กระสุน/เลเซอร์/อาวุธประชิดทะลุผ่าน มีแต่ "มิสไซล์ล็อกเป้า" ที่โดนได้
                                      ตอนเปิดช่องระเบิดจะเผยตัว (TPLANE_REVEAL วินาที) ยิงปืนโดนได้ในช่วงนั้น
   ทุกตัวถูกเรียกจาก enemy.js:  makeXxx() สร้างตัว / updateXxx() AI 1 เฟรม / drawXxx() วาด
   ค่าตัวเลขอยู่ใน config.js (MONO_*, TPLANE_*)
   ========================================================================== */

// ---------- Monolet Bot ----------
const MONO_HEAD = { y: 10, len: 40 };       // ปากกระบอกอยู่ห่างกึ่งกลางตัวไปข้างหน้า len สูงจากหัวตัว y

function makeMonolet(x) {
  return {
    type: 'monolet', x: x, y: GROUND_Y - MONO_H, w: MONO_W, h: MONO_H, hp: MONO_HP, maxHp: MONO_HP, armor: MONO_ARMOR,
    homeX: x, dir: -1, flash: 0, phase: Math.random() * 6, vx: 0, vy: 0, state: 'run',
    act: 1.0 + Math.random() * 1.2, wind: 0, glow: 0, burst: 0, burstCd: 0, apex: false, stride: Math.random() * 6
  };
}

function monoMuzzle(e) {
  const face = e.dir < 0 ? -1 : 1;
  return { x: e.x + e.w / 2 + face * MONO_HEAD.len, y: e.y + MONO_HEAD.y };
}

function fireMonoLaser(e, pcx, pcy) {
  const m = monoMuzzle(e);
  const a = Math.atan2(pcy - m.y, pcx - m.x) + (Math.random() - 0.5) * 0.07;
  enemyShots.push({
    x: m.x, y: m.y, vx: Math.cos(a) * MONO_LASER_SPEED, vy: Math.sin(a) * MONO_LASER_SPEED,
    dmg: MONO_LASER_DMG, life: 1.8, r: 4, kind: 'laser', shieldCost: MONO_LASER_SHIELD
  });
  spawnSparks(m.x, m.y, 4, '#7dffe0');
}

function updateMonolet(e, dt, pcx, pcy) {
  const cx = e.x + e.w / 2, dx = pcx - cx, adx = Math.abs(dx);
  if (e.kx) {                                                // แรงผลักจากมิสไซล์/ลูกซอง
    e.x = clamp(e.x + e.kx * dt, 0, WORLD_W - e.w);
    e.kx *= Math.pow(0.01, dt);
    if (Math.abs(e.kx) < 5) e.kx = 0;
  }
  e.dir = Math.sign(dx) || e.dir;
  const onScreen = cx > cam + 10 && cx < cam + W - 10;
  const toward = Math.sign(dx) || 1;
  let mv = 0;

  if (e.state === 'hop') {                                   // ท่ากระโดดยิง: โค้งขึ้น ยิงที่จุดสูงสุด แล้วตกลงมา
    e.vy += MONO_GRAV * dt;
    e.y += e.vy * dt;
    e.x = clamp(e.x + e.vx * dt, 0, WORLD_W - e.w);
    if (!e.apex && e.vy >= -40) { e.apex = true; if (!player.dead) { e.burst = MONO_HOP_SHOTS; e.burstCd = 0; } }
    if (e.y >= GROUND_Y - e.h) {
      e.y = GROUND_Y - e.h; e.vy = 0; e.state = 'run';
      e.act = 1.2 + Math.random() * 1.3;
      spawnSparks(cx, GROUND_Y, 5, '#b9b29a');
    }
  } else {
    e.y = GROUND_Y - e.h;
    if (e.state === 'aim') {                                 // ท่ายืนชาร์จ: ปากกระบอกเรืองแสง แล้วยิงต่อเนื่อง
      e.wind += dt;
      e.glow = clamp(e.wind / MONO_WINDUP, 0, 1);
      if (e.wind >= MONO_WINDUP) {
        e.state = 'run'; e.glow = 0; e.burst = MONO_BURST; e.burstCd = 0;
        e.act = MONO_ACT_MIN + Math.random() * (MONO_ACT_MAX - MONO_ACT_MIN);
      }
    } else {
      if (adx > MONO_PREF_MAX) mv = toward * MONO_SPEED;     // ไกลไป: วิ่งเข้าหา
      else if (adx < MONO_PREF_MIN) mv = -toward * MONO_SPEED * 0.8;   // ใกล้ไป: ถอยหลังเว้นระยะ
      e.act -= dt;
      if (e.act <= 0 && onScreen && !player.dead) {
        if (Math.random() < 0.5) {
          e.state = 'hop'; e.vy = -MONO_JUMP_VY; e.apex = false;
          const pick = adx > MONO_PREF_MAX ? 1 : adx < MONO_PREF_MIN ? -1 : (Math.random() < 0.5 ? 1 : -1);
          e.vx = toward * pick * MONO_JUMP_VX;
        } else { e.state = 'aim'; e.wind = 0; }
      }
    }
    e.x = clamp(e.x + mv * dt, 0, WORLD_W - e.w);
  }
  e.stride += Math.abs(mv) * dt * 0.16;

  if (e.burst > 0) {                                         // ยิงเลเซอร์ทีละนัดตามจังหวะ
    if (player.dead || cx < cam - 40 || cx > cam + W + 40) e.burst = 0;
    else {
      e.burstCd -= dt;
      if (e.burstCd <= 0) { fireMonoLaser(e, pcx, pcy); e.burst--; e.burstCd = MONO_BURST_GAP; e.glow = 0.8; }
    }
  }
  if (e.state !== 'aim') e.glow = Math.max(0, e.glow - dt * 4);
}

function drawMonolet(e, sx, sy, flash) {
  const face = e.dir < 0 ? -1 : 1, air = e.state === 'hop';
  ctx.save();
  ctx.translate(sx + e.w / 2, sy);
  ctx.scale(face, 1);
  const body = flash ? '#ffffff' : '#5a6b7a', dark = flash ? '#ffffff' : '#323d48', legC = flash ? '#ffffff' : '#c9a24a';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // ขา 2 ข้าง (ข้อต่อพับไปข้างหลังแบบนกกระจอกเทศ) ท่าลอยตัว = พับขาเก็บ
  ctx.strokeStyle = legC; ctx.lineWidth = 3.2;
  for (let i = 0; i < 2; i++) {
    const hx = -2 + i * 6, hy = 46;
    let fx, fy, kx, ky;
    if (air) { fx = hx + (i ? -8 : 10); fy = 62 + (i ? 3 : 0); kx = hx - 5; ky = 55; }
    else {
      const ph = e.stride + i * Math.PI, sw = Math.sin(ph) * 10, lift = Math.max(0, Math.cos(ph)) * 7;
      fx = hx + sw; fy = e.h - 1 - lift; kx = hx + sw * 0.4 - 6; ky = (hy + fy) / 2 + 1;
    }
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.lineTo(fx + 5, fy); ctx.stroke();
  }

  // ขนหาง + ลำตัว + ปีก
  ctx.fillStyle = dark;
  for (let i = -1; i <= 1; i++) { ctx.save(); ctx.translate(-17, 33 + i * 3); ctx.rotate(-0.5 + i * 0.35); ctx.beginPath(); ctx.ellipse(-6, 0, 11, 3.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, 38, 20, 13, -0.12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1f272f'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.ellipse(-3, 38, 12, 7, -0.2, 0, Math.PI * 2); ctx.fill();

  // คอยาว (โค้งรูปตัว S)
  ctx.strokeStyle = '#1f272f'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(10, 32); ctx.quadraticCurveTo(21, 26, 13, 14); ctx.stroke();
  ctx.strokeStyle = body; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(10, 32); ctx.quadraticCurveTo(21, 26, 13, 14); ctx.stroke();

  // หัว = ปืนเลเซอร์ (กล่องหัว + ลำกล้อง + เลนส์)
  ctx.fillStyle = dark;
  ctx.fillRect(6, 4, 20, 11);
  ctx.strokeStyle = '#161c22'; ctx.lineWidth = 1.5; ctx.strokeRect(6, 4, 20, 11);
  ctx.fillStyle = flash ? '#ffffff' : '#46535f';
  ctx.fillRect(26, 8, MONO_HEAD.len - 26, 4);
  const g = e.glow || 0;
  ctx.fillStyle = flash ? '#ffffff' : (g > 0.05 ? '#7dffe0' : '#ff5a3c');
  ctx.beginPath(); ctx.arc(16, 10, 3.2, 0, Math.PI * 2); ctx.fill();
  if (g > 0.05) {                                            // เลเซอร์กำลังชาร์จ/ยิง: วงเรืองแสงที่ปลายกระบอก
    ctx.globalAlpha = 0.35 + 0.5 * g;
    ctx.fillStyle = '#7dffe0';
    ctx.beginPath(); ctx.arc(MONO_HEAD.len, 10, 3 + 7 * g, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------- Tactical Plane ----------
function makeTPlane(x, y) {
  return {
    type: 'tplane', x: x, y: y, w: TPLANE_W, h: TPLANE_H, hp: TPLANE_HP, maxHp: TPLANE_HP,
    homeX: x, baseY: y, dir: -1, vx: -TPLANE_SPEED, flash: 0, phase: Math.random() * 6,
    bombCd: 0.4, bay: 0, cloak: 1, reveal: 0
  };
}

// ล่องหนอยู่ = กระสุน เลเซอร์ และอาวุธประชิดทะลุผ่านตัว (มิสไซล์ล็อกเป้าโดนได้เสมอ)
function untargetable(e) { return e.type === 'tplane' && e.cloak > 0.5; }

function updateTPlane(e, dt, pcx, pcy) {
  const cx = e.x + e.w / 2;
  if (e.dir < 0 && (cx < pcx - TPLANE_OVERSHOOT || cx < -60)) e.dir = 1;
  else if (e.dir > 0 && (cx > pcx + TPLANE_OVERSHOOT || cx > WORLD_W + 60)) e.dir = -1;
  e.vx += clamp(e.dir * TPLANE_SPEED - e.vx, -TPLANE_ACCEL * dt, TPLANE_ACCEL * dt);
  e.x += e.vx * dt;
  const near = clamp(1 - Math.abs(cx - pcx) / 260, 0, 1);                   // โฉบลงต่ำเมื่อผ่านเหนือผู้เล่น
  const turning = 1 - Math.abs(e.vx) / TPLANE_SPEED;
  e.y = e.baseY + near * TPLANE_DIVE - turning * 10 + Math.sin(e.phase * 3) * 2;

  e.bombCd -= dt;
  const onScreen = cx > cam - 10 && cx < cam + W + 10;
  const fallT = Math.sqrt(2 * Math.max(10, GROUND_Y - (e.y + e.h)) / BOMB_GRAVITY);
  const land = cx + e.vx * 0.9 * fallT;
  const inWindow = !player.dead && onScreen && Math.abs(e.vx) > TPLANE_SPEED * 0.6 && Math.abs(land - pcx) < BOMBER_BOMB_WINDOW;
  e.bay += ((inWindow ? 1 : 0) - e.bay) * Math.min(1, dt * 10);
  if (inWindow) e.reveal = TPLANE_REVEAL;                                   // เปิดช่องระเบิด = เผยตัว
  if (inWindow && e.bombCd <= 0) { dropBomb(e); e.bombCd = TPLANE_BOMB_CD; }
  if (e.flash > 0.05) e.reveal = Math.max(e.reveal, 0.6);                   // โดนโจมตี = เห็นตัวแวบหนึ่ง
  e.reveal = Math.max(0, e.reveal - dt);
  e.cloak += ((e.reveal > 0 ? 0 : 1) - e.cloak) * Math.min(1, dt * (e.reveal > 0 ? 12 : 2.5));
}

function drawTPlane(e, sx, sy, flash) {
  const cx = sx + e.w / 2, cy = sy + e.h / 2;
  const f = clamp(e.vx / TPLANE_SPEED, -1, 1);
  const vis = 0.1 + 0.9 * (1 - e.cloak);                                    // 0.1 = ล่องหนเกือบมองไม่เห็น
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(-f || -0.02, 1);                                                 // วาดหันซ้ายเป็นหลัก
  const body = flash ? '#ffffff' : '#39424a', dark = flash ? '#ffffff' : '#262d33';
  const wing = function () {                                                 // ปีกบินรูปลิ่มปลายหยักแบบ B-2
    ctx.beginPath();
    ctx.moveTo(-46, 3); ctx.lineTo(-14, -8); ctx.lineTo(34, -10); ctx.lineTo(42, -1);
    ctx.lineTo(30, 1); ctx.lineTo(22, -2); ctx.lineTo(14, 3); ctx.lineTo(6, -1); ctx.lineTo(-4, 5); ctx.lineTo(-22, 9);
    ctx.closePath();
  };
  ctx.globalAlpha = vis;
  const bay = e.bay || 0;
  if (bay > 0.2) {                                                           // ประตูระเบิดใต้ท้อง
    ctx.fillStyle = '#12171b'; ctx.fillRect(-14, 7, 26, 3 + 3 * bay);
    ctx.fillStyle = '#7d868e';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-8 + i * 8, 11, 3, 2, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.fillStyle = body; wing(); ctx.fill();
  ctx.strokeStyle = '#161b1f'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(30, -8); ctx.lineTo(14, 1); ctx.lineTo(-10, 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : '#9fd6f2';
  ctx.fillRect(-30, -2, 8, 2.5);                                             // กระจกหน้าแคบๆ
  ctx.fillStyle = flash ? '#ffffff' : '#c94a3a';
  ctx.fillRect(-4, -1, 5, 3);
  ctx.globalAlpha = 1;

  if (e.cloak > 0.05) {                                                      // ล่องหน: เส้นขอบเรืองจางๆ + แสงไหลผ่านตัว (ให้ผู้เล่นพอเห็นแนวบิน)
    const pulse = 0.6 + 0.4 * Math.sin(e.phase * 9);
    ctx.globalAlpha = 0.4 * e.cloak * pulse;
    ctx.strokeStyle = '#8ff0ff'; ctx.lineWidth = 1.2; wing(); ctx.stroke();
    ctx.globalAlpha = 0.18 * e.cloak;
    ctx.strokeStyle = '#8ff0ff'; ctx.lineWidth = 1;
    const k = (e.phase * 70) % 90 - 46;
    ctx.beginPath(); ctx.moveTo(k, -9); ctx.lineTo(k - 10, 6); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
