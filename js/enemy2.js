'use strict';
/* ==========================================================================
   enemy2.js : ศัตรูใหม่ของด่าน 03-04
     EnemyChopper  (type 'chopper')  เฮลิคอปเตอร์โจมตี บินสูง ตามแกน X ช้าๆ ยิงมิสไซล์เฉียงลงทุก 3 วินาที
     EnemySniper   (type 'sniper')   หุ่นสไนเปอร์เกราะบาง ยืนนิ่งชิดขอบจอขวา เลเซอร์ไซต์แดง 1.5 วินาที แล้วยิงกระสุนเร็ว
   ทุกตัวถูกเรียกจาก enemy.js:  makeXxx() สร้างตัว / updateXxx() AI 1 เฟรม / drawXxx() วาด
   (บอส Giant Hopper และ Boss Sniper อยู่ใน boss2.js และใช้ฟังก์ชันเลเซอร์ไซต์/กระสุนสไนเปอร์ร่วมกับไฟล์นี้)
   ========================================================================== */

// ---------- สร้างตัว ----------
function makeChopper(x) {
  return {
    type: 'chopper', x: x, y: CHOPPER_Y, w: CHOPPER_W, h: CHOPPER_H, hp: CHOPPER_HP, maxHp: CHOPPER_HP,
    homeX: x, dir: -1, flash: 0, phase: Math.random() * 6,
    fireCd: CHOPPER_FIRE_CD, charge: 0
  };
}

function makeSniper(x) {
  return {
    type: 'sniper', x: x, y: GROUND_Y - SNIPER_H, w: SNIPER_W, h: SNIPER_H, hp: SNIPER_HP, maxHp: SNIPER_HP,
    homeX: x, dir: -1, flash: 0, phase: Math.random() * 6,
    slot: 0,                                   // เลื่อนตำแหน่งเข้าซ้ายจากขอบจอ (กรณีมีสไนเปอร์หลายตัวในเวฟเดียว)
    fireCd: 1.0 + Math.random() * 1.2, sight: null, rifle: Math.PI,
    gx: 12, gy: 18, gl: 34                      // จุดไหล่ปืน (พิกัดท้องถิ่น) และความยาวลำกล้อง
  };
}

// ---------- ส่วนที่ใช้ร่วมกับ Boss Sniper: ปืนไรเฟิล + เลเซอร์ไซต์ + กระสุน ----------
function sniperMuzzle(e) {
  return { x: e.x + e.gx + Math.cos(e.rifle) * e.gl, y: e.y + e.gy + Math.sin(e.rifle) * e.gl };
}

// หมุนลำกล้องเข้าหาผู้เล่น (จำกัดความเร็วหมุน) — ไม่หมุนถ้า frozen (เลเซอร์ล็อกเส้นแล้ว)
function sniperTurn(e, dt, pcx, pcy, frozen) {
  if (frozen) return;
  const want = Math.atan2(pcy - (e.y + e.gy), pcx - (e.x + e.gx));
  const d = Math.atan2(Math.sin(want - e.rifle), Math.cos(want - e.rifle));
  e.rifle += clamp(d, -SNIPER_TURN * dt, SNIPER_TURN * dt);
}

function fireSnipe(e, ang, dmg) {
  const ox = e.x + e.gx + Math.cos(ang) * e.gl, oy = e.y + e.gy + Math.sin(ang) * e.gl;
  enemyShots.push({
    x: ox, y: oy, vx: Math.cos(ang) * SNIPER_BULLET_SPEED, vy: Math.sin(ang) * SNIPER_BULLET_SPEED,
    dmg: dmg, life: 1.4, r: 5, kind: 'snipe', shieldCost: SNIPER_SHIELD_COST
  });
  spawnSparks(ox, oy, 8, '#ffd0c0');
  smallBoom(ox, oy, 12);
  addShake(3);
}

// กระสุนสไนเปอร์เร็วมาก: แบ่งก้าวย่อยๆ ตรวจชนทุก ~12 px กันทะลุตัวผู้เล่น
function updateSnipeShots(dt) {
  for (let i = enemyShots.length - 1; i >= 0; i--) {
    const s = enemyShots[i];
    if (s.kind !== 'snipe') continue;
    const n = Math.max(1, Math.ceil(Math.hypot(s.vx, s.vy) * dt / 12));
    let gone = false;
    for (let k = 0; k < n && !gone; k++) {
      s.x += s.vx * dt / n;
      s.y += s.vy * dt / n;
      if (!player.dead && s.x >= player.x - s.r && s.x <= player.x + player.w + s.r && s.y >= player.y - s.r && s.y <= player.y + player.h + s.r) {
        damagePlayer(s.dmg, s.shieldCost);
        spawnSparks(s.x, s.y, 12, player.shieldUp ? '#4fc3f7' : '#ff8a5c');
        smallBoom(s.x, s.y, 22);
        gone = true;
      } else if (s.y >= GROUND_Y) {
        spawnSparks(s.x, GROUND_Y, 8, '#ffd0c0');
        gone = true;
      }
    }
    s.life -= dt;
    if (gone || s.life <= 0 || s.x < cam - 80 || s.x > cam + W + 80 || s.y < -80) enemyShots.splice(i, 1);
  }
}

// ---------- AI ----------
function updateChopper(e, dt, pcx, pcy) {
  const cx = e.x + e.w / 2;
  const entering = cx > cam + W - 24;                       // ยังอยู่ริมขอบจอขวา: บินเข้าเร็วๆ ก่อน
  const sp = entering ? CHOPPER_ENTER_SPEED : CHOPPER_SPEED;
  const want = player.dead ? e.x : pcx - e.w / 2;           // ตามแกน X ของผู้เล่นช้าๆ
  e.x = clamp(e.x + clamp(want - e.x, -sp * dt, sp * dt), 0, WORLD_W - e.w);
  e.dir = Math.sign(pcx - cx) || e.dir;
  e.y = CHOPPER_Y + Math.sin(e.phase * 2) * 6;

  const onScreen = cx > cam + 10 && cx < cam + W - 10;
  if (player.dead || !onScreen) { e.charge = 0; return; }

  e.fireCd -= dt;
  e.charge = e.fireCd < CHOPPER_WINDUP ? clamp(1 - e.fireCd / CHOPPER_WINDUP, 0, 1) : 0;
  if (e.fireCd <= 0) {
    e.fireCd = CHOPPER_FIRE_CD;
    e.charge = 0;
    const px = cx, py = e.y + e.h;
    const sgn = Math.sign(pcx - px) || e.dir;
    const base = clamp(Math.atan2(pcy - py, Math.abs(pcx - px)), 0.5, 1.25);   // เฉียงลงเข้าหาผู้เล่น 29-72 องศา
    for (let i = -1; i <= 1; i += 2) {
      const a = clamp(base + i * 0.13, 0.4, 1.35);
      const vx = sgn * Math.cos(a), vy = Math.sin(a);
      enemyShots.push({
        x: px + vx * 10, y: py + vy * 10, vx: vx * CHOPPER_MISSILE_SPEED, vy: vy * CHOPPER_MISSILE_SPEED,
        speed: CHOPPER_MISSILE_SPEED, dmg: CHOPPER_MISSILE_DMG, life: 3.4, r: 6, big: true, kind: 'bmissile',
        shieldCost: CHOPPER_MISSILE_SHIELD_COST, turn: 0.6, trackT: 1.0
      });
    }
    spawnSparks(px, py, 6, '#e8e2c8');
    smallBoom(px, py, 10);
  }
}

function updateSniper(e, dt, pcx, pcy) {
  // ยืนนิ่งชิดขอบจอขวา (ตามกล้องไป) ไม่เดินเข้าหาผู้เล่น
  const tx = clamp(cam + W - e.w - SNIPER_EDGE - e.slot, 0, WORLD_W - e.w);
  e.x += (tx - e.x) * Math.min(1, dt * 4);
  e.y = GROUND_Y - e.h;
  e.dir = -1;

  if (player.dead) { e.sight = null; return; }
  const ready = Math.abs(tx - e.x) < 24;                    // เข้าประจำตำแหน่งแล้วถึงจะเล็ง
  const dist = Math.hypot(pcx - (e.x + e.w / 2), pcy - (e.y + e.gy));

  if (e.sight) {
    e.sight.t += dt;
    const locked = e.sight.t >= SNIPER_LOCK_AT;
    sniperTurn(e, dt, pcx, pcy, locked);
    if (e.sight.t >= SNIPER_SIGHT_TIME) {                   // เลเซอร์ครบ 1.5 วินาที -> ยิง
      fireSnipe(e, e.rifle, SNIPER_DMG);
      e.sight = null;
      e.fireCd = SNIPER_FIRE_CD + Math.random() * 0.8;
    }
  } else {
    sniperTurn(e, dt, pcx, pcy, false);
    e.fireCd -= dt;
    if (ready && e.fireCd <= 0 && dist < SNIPER_RANGE) e.sight = { t: 0, offs: [0] };
  }
}

// ---------- วาด ----------
function drawChopper(e, sx, sy, flash) {
  const cx = sx + e.w / 2, cy = sy + e.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  if (e.dir < 0) ctx.scale(-1, 1);                          // วาดหันขวาเป็นหลัก แล้วกลับด้านเมื่อหันซ้าย
  const body = flash ? '#ffffff' : '#56654a';
  // หางและใบพัดหาง
  ctx.fillStyle = flash ? '#ffffff' : '#46533c';
  ctx.fillRect(-34, -3, 22, 5);
  ctx.fillRect(-36, -11, 4, 12);
  ctx.strokeStyle = '#9aa5ae';
  ctx.lineWidth = 2;
  const tr = Math.sin(e.phase * 40) * 6;
  ctx.beginPath(); ctx.moveTo(-34, -5 - tr); ctx.lineTo(-34, -5 + tr); ctx.stroke();
  // สกิด
  ctx.strokeStyle = '#2a3138';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-14, 13); ctx.lineTo(20, 13); ctx.moveTo(-8, 7); ctx.lineTo(-8, 13); ctx.moveTo(12, 7); ctx.lineTo(12, 13); ctx.stroke();
  // ลำตัว
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(2, 0, 24, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#26301f';
  ctx.stroke();
  // กระจกห้องนักบิน
  ctx.fillStyle = flash ? '#ffffff' : '#9fd6f2';
  ctx.beginPath(); ctx.ellipse(14, -2, 9, 6, 0, Math.PI, Math.PI * 2.15); ctx.fill();
  ctx.fillRect(6, -3, 16, 4);
  // แท่นมิสไซล์ใต้ท้อง (เรืองแสงเตือนตอนใกล้ยิง)
  const c = e.charge || 0;
  ctx.fillStyle = c > 0 ? 'rgba(255,' + Math.round(190 - 120 * c) + ',60,' + (0.55 + 0.45 * c) + ')' : '#2a3138';
  ctx.fillRect(-6, 9, 8, 5);
  ctx.fillRect(6, 9, 8, 5);
  // ใบพัดหลัก
  ctx.fillStyle = '#6b7680';
  ctx.fillRect(-2, -17, 4, 7);
  const rw = 30 + Math.abs(Math.cos(e.phase * 28)) * 10;
  ctx.strokeStyle = 'rgba(190,200,210,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-rw, -17); ctx.lineTo(rw, -17); ctx.stroke();
  ctx.restore();
}

function drawSniper(e, sx, sy, flash) {
  // วาดหันซ้ายเสมอ (ยืนขอบขวาจอเล็งเข้าหาผู้เล่น)
  const body = flash ? '#ffffff' : '#4d5a66';
  ctx.fillStyle = '#262d33';                                // ขาเรียว 2 ข้าง
  ctx.fillRect(sx + 7, sy + 34, 5, 16);
  ctx.fillRect(sx + 18, sy + 34, 5, 16);
  ctx.fillStyle = body;                                     // ลำตัวผอมเกราะบาง
  ctx.fillRect(sx + 6, sy + 12, 18, 24);
  ctx.strokeStyle = '#1d2329';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx + 7, sy + 13, 16, 22);
  ctx.fillStyle = flash ? '#ffffff' : '#5f6e7b';            // หัว + เลนส์เล็ง
  ctx.fillRect(sx + 8, sy + 2, 14, 11);
  ctx.fillStyle = e.sight ? '#ff3a28' : '#ff8a5c';
  ctx.fillRect(sx + 9, sy + 6, 7, 3);
  // ไรเฟิลยาว หมุนตามเป้า
  ctx.save();
  ctx.translate(sx + e.gx, sy + e.gy);
  ctx.rotate(e.rifle);
  ctx.fillStyle = '#1a1f24';
  ctx.fillRect(-6, -2.5, e.gl + 6, 5);
  ctx.fillStyle = '#8a8f7a';
  ctx.fillRect(e.gl - 4, -3.5, 6, 7);
  ctx.fillStyle = '#2d3a46';
  ctx.fillRect(8, -6, 12, 3);                               // กล้องเล็ง
  ctx.restore();
}

// เส้นเลเซอร์ไซต์สีแดง: ของสไนเปอร์ทั่วไปและ Boss Sniper (e.sight = { t, offs:[มุมเบี่ยง...] })
function drawSights() {
  for (const e of enemies) {
    if (!e.sight) continue;
    const m = sniperMuzzle(e);
    const t = e.sight.t;
    const locked = t >= SNIPER_LOCK_AT;
    const blink = locked ? (Math.floor(t * 24) % 2 ? 1 : 0.45) : 1;
    const urgency = clamp(t / SNIPER_SIGHT_TIME, 0, 1);
    for (const off of e.sight.offs) {
      const a = e.rifle + off;
      const dx = Math.cos(a), dy = Math.sin(a);
      let len = 1500;
      if (dy > 0.001) len = Math.min(len, (GROUND_Y - m.y) / dy);   // เส้นหยุดที่พื้น
      const x0 = m.x - cam, y0 = m.y, x1 = x0 + dx * len, y1 = y0 + dy * len;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,40,30,' + (0.18 + 0.2 * urgency) * blink + ')';
      ctx.lineWidth = locked ? 7 : 5;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,70,50,' + (0.55 + 0.45 * urgency) * blink + ')';
      ctx.lineWidth = locked ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      if (dy > 0.001) {                                             // จุดแดงตรงที่เส้นไปตกพื้น
        ctx.fillStyle = 'rgba(255,60,40,' + 0.7 * blink + ')';
        ctx.beginPath(); ctx.arc(x1, y1, 3 + 3 * urgency, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}
