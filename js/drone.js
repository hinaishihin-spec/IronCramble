'use strict';
/* ==========================================================================
   drone.js : ระบบโดรนซัพพอร์ต (ช่องที่ 3 ใน Hangar แท็บ DRONE เลือกใช้ได้ทีละ 1 ตัว)
     โดรนบิน (FLY)  ลอยตามเหนือไหล่ ศัตรูยิงไม่โดน
        Striker I   ยิงปืนกลอัตโนมัติใส่ศัตรูที่ใกล้ที่สุด
        Sniper I    ยิงสไนป์นัดแรงทุก 3 วินาที เลือกเป้าที่ HP เยอะสุดในระยะ
        Recovery I  ฟื้น HP ให้ผู้เล่นทีละนิด (หยุดชั่วคราวหลังโดนยิง)
     โดรนบอท (BOT)  เดินตามหลังบนพื้น กระสุนศัตรูยิงโดนได้ HP หมด = พัง แล้วกลับมาเองหลัง DRONE_BOT_RESPAWN วินาที
        Shooter I   ยิงเลเซอร์ (ทะลวงเกราะ)
        Assaulter I ยิงมิสไซล์ล็อกเป้า
        Charger I   ขยายเกจโล่ของผู้เล่น x1.3 ตราบใดที่ตัวบอทยังไม่พัง
   ดาเมจโดรน = ค่าพื้นฐาน x atkMult() (เลเวล/แขนผู้เล่น) และลดเหลือ x DRONE_BOSS_MULT เมื่อยิงบอส
   ข้อมูลรุ่น/ราคา/เงื่อนไขปลดล็อกอยู่ weapondb.js (WEAPON_DATABASE.DRONES)  ค่าการยิงอยู่ DRONE_CFG ด้านล่าง
   ========================================================================== */

const DRONE_BOSS_MULT = 0.5;
const DRONE_BOT_HP = 80, DRONE_BOT_RESPAWN = 18;           // HP ของโดรนบอท / วินาทีที่พังแล้วกลับมา
const DRONE_CFG = {
  striker:   { dmg: 5,  gap: 0.18, range: 430, speed: 760 },
  sniper:    { dmg: 70, gap: 3.0,  range: 760 },
  recovery:  { heal: 2, quiet: 2.5 },                      // HP ต่อวินาที / หยุดฟื้นกี่วินาทีหลังโดนยิง
  shooter:   { dmg: 20, gap: 0.9,  range: 420 },
  assaulter: { dmg: 20, gap: 2.6,  range: 620 },
  charger:   { shieldMult: 1.3 }
};
// รุ่น II / III: ค่าที่ทับค่าพื้นฐานของรุ่น I (ไม่ใส่ = ใช้ค่าเดิม)  burst = ยิงเป็นชุดกี่นัด (gap = ห่างในชุด rest = พักระหว่างชุด)  pierce = ทะลุ
// beams = จำนวนเส้นเลเซอร์  n = จำนวนมิสไซล์ต่อชุด  shieldRegen = ฟื้นโล่/วินาที  hp / respawn = HP และเวลากลับมาของโดรนบอท
const DRONE_TIER = {
  striker:   [{}, { gap: 0.13 }, { dmg: 7, gap: 0.06, burst: 3, rest: 0.28 }],
  sniper:    [{}, { dmg: 85, gap: 2.4 }, { dmg: 100, gap: 2.4, pierce: true }],
  recovery:  [{}, { heal: 3 }, { heal: 3.5, quiet: 1.2, shieldRegen: 4 }],
  shooter:   [{}, { dmg: 15, beams: 2 }, { dmg: 15, beams: 2, pierce: true }],
  assaulter: [{}, { dmg: 17, n: 2 }, { dmg: 15, n: 3 }],
  charger:   [{}, { shieldMult: 1.5 }, { shieldMult: 1.5, hp: 120, respawn: 12 }]
};
function droneCfg(kind, tier) { return Object.assign({ hp: DRONE_BOT_HP, respawn: DRONE_BOT_RESPAWN }, DRONE_CFG[kind], (DRONE_TIER[kind] || [])[(tier || 1) - 1]); }
const DRONE_COLOR = { striker: '#ff9a3c', sniper: '#ffe27a', recovery: '#5fd36f', shooter: '#4fd0ff', assaulter: '#ff5a4a', charger: '#5a8dff' };

// ภาพวาดโดรน: assets/drones/<kind>.png  kind = striker sniper recovery shooter assaulter charger  (PNG โปร่งใส วาดหันซ้าย)
// เฟรมแอนิเมชันไม่บังคับ <kind>_2.png ... _6.png  ไม่มีไฟล์ = ใช้ภาพโค้ดเดิม  DRONE_ART_H = ความสูงภาพที่วางในเกม (px) ภาพควรวาดใหญ่กว่านี้ 3-4 เท่าให้คม
const DRONE_ART_H = { FLY: 30, BOT: 40 };
const DRONE_ART_FPS = 8;

function droneArtImage(d) {
  let key = d.tier > 1 ? d.kind + '_t' + d.tier : d.kind;                 // รุ่น II/III: <kind>_t2.png / _t3.png ไม่มี = ใช้ภาพรุ่น I
  let base = partImage('assets/drones/' + key + '.png');
  if (!base) { key = d.kind; base = partImage('assets/drones/' + key + '.png'); }
  if (!base) return null;
  const imgs = [base];
  for (let i = 2; i <= 6; i++) { const f = partImage('assets/drones/' + key + '_' + i + '.png'); if (!f) break; imgs.push(f); }
  return imgs.length === 1 ? base : imgs[Math.floor(d.t * DRONE_ART_FPS) % imgs.length];
}

let drone = null;          // โดรนที่ออกรบอยู่ { kind, bot, x, y, cd, hp, down, downT, quiet, t, aim, face, flash }
let droneShots = [];       // กระสุนของ Striker
let droneFx = [];          // เส้นยิงชั่วคราว (สไนป์/เลเซอร์) { x0,y0,x1,y1,t,dur,col,w }

function equippedDrone() { return findWeapon(profile.equippedWeapon.drone); }

// เกจโล่สูงสุดของผู้เล่น: Charger ที่ยังไม่พังให้ x1.3
function shieldMax() { return SHIELD_MAX * (drone && drone.kind === 'charger' && !drone.down ? drone.cfg.shieldMult : 1); }

function resetDrones() {
  droneShots = []; droneFx = [];
  const w = equippedDrone();
  drone = null;
  if (!w) return;
  const sgn = Math.cos(player.angle) >= 0 ? 1 : -1;
  drone = {
    kind: w.kind, tier: w.tier || 1, cfg: droneCfg(w.kind, w.tier), name: w.name, bot: w.type === 'BOT', x: player.x - sgn * 40, y: player.y - 20, cd: 1.0, hp: 0, maxHp: 0, burstN: 0,
    down: false, downT: 0, quiet: 0, t: 0, aim: 0, face: 1, flash: 0, fx: 0
  };
  drone.hp = drone.maxHp = drone.cfg.hp;
  if (drone.bot) drone.y = GROUND_Y - 26;
  player.shield = shieldMax();                                  // Charger: เริ่มด่านด้วยเกจเต็มที่ขยายแล้ว
}

// ---------- เป้าหมาย ----------
function droneOnScreen(e) { const cx = e.x + e.w / 2; return cx >= cam - 10 && cx <= cam + W + 10; }
function droneValid(e) { return !untargetable(e) && !(e.type === 'boss' && (e.mode === 'intro' || e.mode === 'split')) && droneOnScreen(e); }

function droneTarget(x, y, range, strongest) {
  let best = null, bs = Infinity;
  for (const e of enemies) {
    if (!droneValid(e)) continue;
    const d = Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y);
    if (d > range) continue;
    const score = strongest ? -e.hp : d;
    if (score < bs) { bs = score; best = e; }
  }
  return best;
}

function droneDmg(base, e) { return base * atkMult() * (e.type === 'boss' ? DRONE_BOSS_MULT : 1); }

function droneLine(x0, y0, x1, y1, col, w, dur) { droneFx.push({ x0: x0, y0: y0, x1: x1, y1: y1, t: 0, dur: dur, col: col, w: w }); }

// ---------- อัปเดต ----------
function updateDrones(dt) {
  for (let i = droneFx.length - 1; i >= 0; i--) { droneFx[i].t += dt; if (droneFx[i].t >= droneFx[i].dur) droneFx.splice(i, 1); }
  updateDroneShots(dt);
  const d = drone;
  if (!d) return;
  d.t += dt; d.flash = Math.max(0, d.flash - dt);
  const cfg = d.cfg, pcx = player.x + player.w / 2, sgn = Math.cos(player.angle) >= 0 ? 1 : -1;

  if (d.bot && d.down) {                                      // โดรนบอทพัง: นับเวลากลับมา
    d.downT -= dt;
    if (d.downT <= 0 && !player.dead) {
      d.down = false; d.hp = d.maxHp; d.x = pcx - sgn * 70; d.cd = 1.0;
      smallBoom(d.x + 11, GROUND_Y - 14, 18);
      popText(d.x + 11, GROUND_Y - 44, d.name.toUpperCase() + ' READY', DRONE_COLOR[d.kind], 12);
    }
    return;
  }

  // ตำแหน่ง: บินลอยตามหลังไหล่ / บอทเดินตามบนพื้น
  const w = d.bot ? 22 : 24, h = d.bot ? 26 : 14;
  if (d.bot) {
    const tx = pcx - sgn * 62 - w / 2, dx = tx - d.x;
    if (Math.abs(dx) > 420) d.x = tx;
    else if (Math.abs(dx) > 6) d.x += Math.sign(dx) * Math.min(Math.abs(dx), 280 * dt);
    d.y = GROUND_Y - h;
  } else {
    const tx = pcx - sgn * 34 - w / 2, ty = player.y - 16 + Math.sin(d.t * 3.2) * 4;
    d.x += (tx - d.x) * Math.min(1, dt * 6);
    d.y += (ty - d.y) * Math.min(1, dt * 6);
  }
  const cx = d.x + w / 2, cy = d.y + h / 2;
  d.face = sgn;

  if (d.bot) droneBotHits(d, w, h);
  if (player.dead) return;

  if (d.kind === 'charger') { if (player.shield > shieldMax()) player.shield = shieldMax(); return; }

  if (d.kind === 'recovery') {                                // ฟื้น HP ทีละนิด (ไม่ฟื้นช่วงโดนยิงอยู่)
    if (player.hurtFlash > 0.05) d.quiet = cfg.quiet;
    d.quiet = Math.max(0, d.quiet - dt);
    if (d.quiet <= 0 && player.hp < maxHp()) {
      player.hp = Math.min(maxHp(), player.hp + cfg.heal * dt);
      d.fx -= dt;
      if (d.fx <= 0) { d.fx = 0.45; sparks.push({ x: player.x + player.w / 2 + (Math.random() - 0.5) * 24, y: player.y + player.h * 0.6, vx: 0, vy: -50, life: 0.5, color: '#5fd36f' }); }
    }
    if (d.quiet <= 0 && cfg.shieldRegen && !player.shieldUp && player.shield < shieldMax()) player.shield = Math.min(shieldMax(), player.shield + cfg.shieldRegen * dt);   // รุ่น III: ฟื้นโล่ด้วย
    return;
  }

  d.cd -= dt;
  const tg = droneTarget(cx, cy, cfg.range, d.kind === 'sniper');
  if (tg) d.aim = Math.atan2(tg.y + tg.h / 2 - cy, tg.x + tg.w / 2 - cx);
  if (!tg || d.cd > 0) return;
  if (cfg.burst) { d.burstN++; d.cd = d.burstN >= cfg.burst ? cfg.rest : cfg.gap; if (d.burstN >= cfg.burst) d.burstN = 0; }
  else d.cd = cfg.gap;
  const tx = tg.x + tg.w / 2, ty = tg.y + tg.h / 2;
  if (d.kind === 'striker') {
    const a = d.aim + (Math.random() - 0.5) * 0.08;
    droneShots.push({ x: cx, y: cy, vx: Math.cos(a) * cfg.speed, vy: Math.sin(a) * cfg.speed, life: 0.7, dmg: cfg.dmg });
    Sfx.play('enemy_shot', { vol: 0.18, rate: 1.5 });
  } else if (d.kind === 'sniper') {
    droneLine(cx, cy, tx, ty, '#ffe27a', 2, 0.25);
    spawnSparks(cx, cy, 3, '#ffe27a');
    if (cfg.pierce) droneBeamHit(cx, cy, d.aim, cfg.range + 200, cfg.dmg, true, true, true);
    else damageEnemy(tg, droneDmg(cfg.dmg, tg), true, true);
    Sfx.play('snipe_shot', { vol: 0.45, rate: 1.2 });
  } else if (d.kind === 'shooter') {
    const nb = cfg.beams || 1;
    for (let k = 0; k < nb; k++) {
      const off = nb === 1 ? 0 : (k - 0.5) * 8, ox = -Math.sin(d.aim) * off, oy = Math.cos(d.aim) * off;
      if (cfg.pierce) { droneLine(cx + ox, cy + oy, cx + ox + Math.cos(d.aim) * cfg.range, cy + oy + Math.sin(d.aim) * cfg.range, '#4fd0ff', 3, 0.12); droneBeamHit(cx + ox, cy + oy, d.aim, cfg.range, cfg.dmg, false, true, true); }
      else { droneLine(cx + ox, cy + oy, tx, ty, '#4fd0ff', 3, 0.12); damageEnemy(tg, droneDmg(cfg.dmg, tg), false, true); }
    }
    spawnSparks(tx, ty, 3, '#9fe8ff');
    Sfx.play('enemy_laser', { vol: 0.3, rate: 1.2 });
  } else if (d.kind === 'assaulter') {
    const n = cfg.n || 1;
    for (let k = 0; k < n; k++) {
      missiles.push({ x: cx, y: cy - 6, ang: -Math.PI / 2 + (n === 1 ? 0 : (k - (n - 1) / 2) * 0.55) + (Math.random() - 0.5) * 0.3, speed: MISSILE_SPEED * 0.7, life: MISSILE_LIFE, target: tg, dmg: cfg.dmg });
    }
    spawnSparks(cx, cy - 6, 4, '#e8e2c8');
    Sfx.play('missile', { vol: 0.5, rate: 1.1 });
  }
}

// เส้นยิงทะลุ: ไล่จุดตามเส้นแล้วทำดาเมจศัตรูทุกตัวที่เส้นผ่าน (ตัวละ 1 ครั้ง)
function droneBeamHit(x, y, ang, len, dmg, heavy, ignoreArmor) {
  const hit = [], c = Math.cos(ang), s = Math.sin(ang);
  for (let t = 0; t <= len; t += 8) {
    const px = x + c * t, py = y + s * t;
    for (const e of enemies) {
      if (hit.indexOf(e) >= 0 || !droneValid(e)) continue;
      if (px >= e.x && px <= e.x + e.w && py >= e.y && py <= e.y + e.h) hit.push(e);
    }
  }
  for (const e of hit) damageEnemy(e, droneDmg(dmg, e), heavy, ignoreArmor);
}

// กระสุนศัตรูที่โดนโดรนบอท: หักเลือด (ยิงแล้วหายไป) HP หมด = พัง
function droneBotHits(d, w, h) {
  if (d.down) return;
  for (let i = enemyShots.length - 1; i >= 0; i--) {
    const s = enemyShots[i];
    if (s.kind === 'snipe') continue;
    const r = s.r || 3.5;
    if (s.x >= d.x - r && s.x <= d.x + w + r && s.y >= d.y - r && s.y <= d.y + h + r) {
      d.hp -= s.dmg; d.flash = 0.12;
      spawnSparks(s.x, s.y, 4, '#ff8a5c');
      enemyShots.splice(i, 1);
      if (d.hp <= 0) {
        d.down = true; d.downT = d.cfg.respawn; d.hp = 0;
        smallBoom(d.x + w / 2, d.y + h / 2, 34); addShake(4);
        popText(d.x + w / 2, d.y - 14, d.name.toUpperCase() + ' DOWN', '#ff6a4a', 12);
        if (d.kind === 'charger' && player.shield > SHIELD_MAX) player.shield = SHIELD_MAX;
        return;
      }
    }
  }
}

function updateDroneShots(dt) {
  for (let i = droneShots.length - 1; i >= 0; i--) {
    const b = droneShots[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let hit = false;
    for (const e of enemies) {
      if (untargetable(e)) continue;
      if (b.x >= e.x && b.x <= e.x + e.w && b.y >= e.y && b.y <= e.y + e.h) {
        damageEnemy(e, droneDmg(b.dmg, e), false, false);
        spawnSparks(b.x, b.y, 2, '#ffb13b');
        hit = true; break;
      }
    }
    if (hit || b.life <= 0 || b.y >= GROUND_Y) droneShots.splice(i, 1);
  }
}

// ---------- วาด ----------
function drawDrones() {
  ctx.lineCap = 'round';
  for (const f of droneFx) {
    const k = 1 - f.t / f.dur;
    ctx.strokeStyle = f.col; ctx.globalAlpha = 0.35 * k; ctx.lineWidth = f.w * 3;
    ctx.beginPath(); ctx.moveTo(f.x0 - cam, f.y0); ctx.lineTo(f.x1 - cam, f.y1); ctx.stroke();
    ctx.globalAlpha = k; ctx.lineWidth = f.w;
    ctx.beginPath(); ctx.moveTo(f.x0 - cam, f.y0); ctx.lineTo(f.x1 - cam, f.y1); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const b of droneShots) {
    const m = Math.hypot(b.vx, b.vy) || 1;
    ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(b.x - cam - b.vx / m * 9, b.y - b.vy / m * 9); ctx.lineTo(b.x - cam, b.y); ctx.stroke();
  }
  const d = drone;
  if (!d || (d.bot && d.down) || player.dead) return;
  const col = DRONE_COLOR[d.kind], f = d.face, sx = d.x - cam, flash = d.flash > 0;
  const img = droneArtImage(d);
  if (img) {                                                   // ภาพวาดของผู้เล่น (assets/drones/<kind>.png) แทนภาพโค้ด
    const bw = d.bot ? 22 : 24, bh = d.bot ? 26 : 14, dh = DRONE_ART_H[d.bot ? 'BOT' : 'FLY'], dw = img.naturalWidth * dh / img.naturalHeight;
    const cx = sx + bw / 2, y = d.y + bh - dh + (d.bot ? 0 : (dh - bh) / 2);       // บอท: ชิดพื้น / บิน: กึ่งกลางตัว
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.translate(cx, 0);
    if (f > 0) ctx.scale(-1, 1);                               // ภาพวาดให้หันซ้าย
    ctx.drawImage(img, -dw / 2, y, dw, dh);
    if (flash) ctx.drawImage(artWhite(img), -dw / 2, y, dw, dh);
    ctx.restore();
    if (d.bot && d.hp < d.maxHp) {
      ctx.fillStyle = '#0f1316'; ctx.fillRect(cx - 11, y - 6, 22, 3);
      ctx.fillStyle = d.hp / d.maxHp > 0.35 ? '#5fd36f' : '#e0583a'; ctx.fillRect(cx - 11, y - 6, 22 * d.hp / d.maxHp, 3);
    }
    return;
  }
  ctx.save();
  if (!d.bot) {                                                // ---- โดรนบิน ----
    ctx.translate(sx + 12, d.y + 7);
    ctx.fillStyle = flash ? '#fff' : '#3c4650'; ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#161a1e'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = col; ctx.fillRect(-6, -1.5, 12, 3);
    ctx.fillStyle = '#9fd3ea'; ctx.beginPath(); ctx.ellipse(f * 5, -1, 3.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    const pr = 9 * Math.abs(Math.cos(performance.now() / 30));
    ctx.strokeStyle = 'rgba(210,218,226,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-pr, -8); ctx.lineTo(pr, -8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-pr, 8); ctx.lineTo(pr, 8); ctx.stroke();
    if (d.kind === 'striker' || d.kind === 'sniper') {         // ลำกล้องชี้ไปทางเป้า
      const a = d.cd < 0.3 || d.kind === 'striker' ? d.aim : (f > 0 ? 0 : Math.PI);
      ctx.strokeStyle = '#14181c'; ctx.lineWidth = d.kind === 'sniper' ? 3 : 2.5;
      const len = d.kind === 'sniper' ? 15 : 10;
      ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(Math.cos(a) * len, 3 + Math.sin(a) * len); ctx.stroke();
    } else if (d.kind === 'recovery') {                         // กากบาทเขียว (กะพริบตอนกำลังฟื้น)
      const on = d.quiet <= 0 && player.hp < maxHp();
      ctx.fillStyle = on ? 'rgba(95,211,111,' + (0.6 + 0.4 * Math.sin(d.t * 8)) + ')' : '#2f6a39';
      ctx.fillRect(-1.5, -5, 3, 10); ctx.fillRect(-5, -1.5, 10, 3);
    }
  } else {                                                     // ---- โดรนบอท ----
    ctx.translate(sx + 11, d.y);
    const walk = Math.sin(d.t * 12) * 3 * (Math.abs(player.vx) > 20 ? 1 : 0.2);
    ctx.fillStyle = '#20262c';
    ctx.fillRect(-7, 17, 5, 9 + walk * 0.4); ctx.fillRect(2, 17, 5, 9 - walk * 0.4);
    ctx.fillStyle = flash ? '#fff' : '#4a5560'; ctx.fillRect(-9, 6, 18, 13);
    ctx.strokeStyle = '#161a1e'; ctx.lineWidth = 1.5; ctx.strokeRect(-9, 6, 18, 13);
    ctx.fillStyle = col; ctx.fillRect(-9, 12, 18, 3);
    ctx.fillStyle = flash ? '#fff' : '#5c6874'; ctx.fillRect(-6, -2, 12, 9);
    ctx.fillStyle = col; ctx.fillRect(f > 0 ? 0 : -5, 0, 5, 3);                        // ตา
    if (d.kind === 'shooter') { ctx.fillStyle = '#14181c'; ctx.fillRect(f > 0 ? 6 : -16, 9, 10, 3); }
    else if (d.kind === 'assaulter') { ctx.fillStyle = '#14181c'; ctx.fillRect(-9, 2, 7, 5); ctx.fillRect(2, 2, 7, 5); ctx.fillStyle = '#d9d4b8'; ctx.fillRect(-7, 0, 3, 3); ctx.fillRect(4, 0, 3, 3); }
    else if (d.kind === 'charger') {
      ctx.strokeStyle = 'rgba(90,141,255,' + (0.35 + 0.25 * Math.sin(d.t * 4)) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 10, 19, 0, Math.PI * 2); ctx.stroke();
    }
    if (d.hp < d.maxHp) {                                                         // แถบ HP เล็กเหนือหัวเมื่อเริ่มเสียหาย
      ctx.fillStyle = '#0f1316'; ctx.fillRect(-11, -9, 22, 3);
      ctx.fillStyle = d.hp / d.maxHp > 0.35 ? '#5fd36f' : '#e0583a'; ctx.fillRect(-11, -9, 22 * d.hp / d.maxHp, 3);
    }
  }
  ctx.restore();
}

// HUD เล็กมุมซ้ายล่าง: ชื่อโดรน + สถานะ
function drawDroneHud() {
  const d = drone;
  if (!d) return;
  const col = DRONE_COLOR[d.kind];
  ctx.textAlign = 'left';
  ctx.font = "600 10px 'Chakra Petch', monospace";
  ctx.fillStyle = col; ctx.fillText('DRONE  ' + d.name, 26, 230);
  ctx.fillStyle = '#b3bbb0';
  let st = 'READY';
  if (d.bot && d.down) { st = 'REPAIR ' + Math.ceil(d.downT) + 's'; ctx.fillStyle = '#e0583a'; }
  else if (d.kind === 'recovery') st = d.quiet > 0 ? 'PAUSED' : (player.hp < maxHp() ? 'HEALING' : 'READY');
  else if (d.kind === 'charger') st = 'SHIELD x' + d.cfg.shieldMult;
  else if (d.bot) st = 'HP ' + Math.ceil(d.hp);
  ctx.fillText(st, 26, 242);
}
