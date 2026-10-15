'use strict';
/* ==========================================================================
   weapons.js : กระสุนปืนกล, ขีปนาวุธนำวิถี, กระสุนศัตรู (การยิง การชน การวาด)
   ========================================================================== */

let bullets = [];
let missiles = [];
let enemyShots = [];

let beamCharge = null;    // กำลังชาร์จเลเซอร์ไหล่ { t } (null = ไม่ได้ชาร์จ)
let beamShots = [];       // ลำแสงช็อตของเลเซอร์ไหล่ (Einshander) ที่ยังค้างจางอยู่
let slashes = [];         // เอฟเฟกต์รอยฟันของอาวุธประชิด
function resetWeapons() { bullets = []; missiles = []; enemyShots = []; beam = null; laserTick = 0; slashes = []; beamShots = []; beamCharge = null; resetStrikes(); resetDrones(); }

// ยิงอาวุธช่อง slot (0 = ปืน คลิกซ้าย, 1 = มิสไซล์ คลิกขวา/F) ตามข้อมูลใน player.equippedWeapon / WEAPON_DATABASE
// ดาเมจ = damage ของอาวุธ x atkMult() (เลเวล + แขน)  คูลดาวน์ = fireRate (มิลลิวินาที) หรือ MISSILE_DELAYS ตามประเภท
// คืนค่าเวลาคูลดาวน์ (วินาที) ก่อนยิงได้อีกครั้ง (ปืนเลเซอร์ไม่ผ่านฟังก์ชันนี้ ดู updateLaser)
function fireWeapon(p, slot) {
  const a = p.angle;
  const apv = gunOriginWorld(p);                       // ปืนยิงจากจุดที่มือจับ
  const cx = apv.x, cy = apv.y;
  const mx = cx + Math.cos(a) * muzzleDist();
  const my = cy + Math.sin(a) * muzzleDist();
  const px = -Math.sin(a), py = Math.cos(a);        // เวกเตอร์ตั้งฉากกับทิศยิง (ไว้เยื้องซ้าย/ขวา)

  if (slot === 1) {                                  // ---------- ช่องมิสไซล์ (ยิงจากพอดบนหลังคาไหล่)
    const pv = podPivotWorld(p);
    const mx = pv.x + Math.cos(a) * podMuzzleDist(), my = pv.y + Math.sin(a) * podMuzzleDist();
    const w = equippedMissile();
    const dmg = w.damage;                            // คูณ atkMult ตอนชน (updateMissiles)
    if (w.type === 'DUAL') {                         // 2 ลูก เฉียงออกซ้าย/ขวา แล้วเลี้ยวล็อกเป้า
      for (const side of [-1, 1]) {
        missiles.push({
          x: mx + px * 8 * side, y: my + py * 8 * side, ang: a + side * DUAL_MISSILE_ANGLE,
          speed: MISSILE_SPEED * 0.7, life: MISSILE_LIFE, target: nearestEnemy(mx, my), dmg: dmg
        });
      }
      addShake(6);
      spawnSparks(mx, my, 6, '#e8e2c8');
    } else if (w.type === 'SWARM') {                 // ฝูงเล็ก w.count ลูก แผ่เป็นพัด สุ่มความเร็วเล็กน้อย ระเบิดเล็ก
      const n = w.count || 6;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * SWARM_SPREAD;
        missiles.push({
          x: mx + px * off * 14, y: my + py * off * 14, ang: a + off, small: true,
          speed: MISSILE_SPEED * (0.5 + Math.random() * 0.3), life: MISSILE_LIFE, target: nearestEnemy(mx, my), dmg: dmg
        });
      }
      addShake(7);
      spawnSparks(mx, my, 9, '#e8e2c8');
    } else if (w.type === 'ORBITAL' || w.type === 'NAPALM') {   // อาวุธโจมตีจากฟ้า: ล็อกเป้าตามเมาส์ แล้วรอตก (strike.js)
      return startStrike(p, w);
    } else if (w.type === 'BEAM') {                  // เลเซอร์ไหล่: ชาร์จที่ไหล่ BEAM_CHARGE วินาที แล้วยิง (ดู releaseEinshander)
      if (!beamCharge) beamCharge = { t: 0, dur: w.charge || BEAM_CHARGE };
      addShake(1.5);
      return beamCharge.dur + (w.cd || MISSILE_DELAYS.BEAM);
    } else {                                         // SINGLE: 1 ลูก นำวิถี
      missiles.push({ x: mx, y: my, ang: a, speed: MISSILE_SPEED * 0.7, life: MISSILE_LIFE, target: nearestEnemy(mx, my), dmg: dmg });
      addShake(5);
      spawnSparks(mx, my, 5, '#e8e2c8');
    }
    return MISSILE_DELAYS[w.type] || MISSILE_DELAY;
  }

  const g = equippedGun();                           // ---------- ช่องปืน
  const dmg = Math.max(1, Math.round(g.damage * atkMult()));
  if (g.type === 'MELEE') return meleeSwing(p, g, dmg);
  if (g.type === 'SHOTGUN') {                        // g.pellets เม็ด กระจายเป็นรูปพัดรอบทิศเมาส์ อายุสั้น
    const n = g.pellets || 5;
    const step = g.id.indexOf('fostech') === 0 ? FOSTECH_STEP : SHOTGUN_STEP;   // Fostech: กระจายวงกว้าง
    const kb = SHOTGUN_KNOCKBACK * (g.id.indexOf('winchester') === 0 ? WINCHESTER_KB_MULT : 1);   // Winchester: แรงผลัก x1.5
    for (let i = 0; i < n; i++) {
      const ang = a + (i - (n - 1) / 2) * step;
      bullets.push({ x: mx, y: my, vx: Math.cos(ang) * SHOTGUN_SPEED, vy: Math.sin(ang) * SHOTGUN_SPEED, life: SHOTGUN_LIFE, dmg: dmg, kb: kb });
    }
    addShake(kb > 1 ? 6 : 4);
    spawnSparks(mx, my, 8, '#ffb13b');
    return g.fireRate / 1000;
  }
  if (g.type === 'RIFLE') {                          // นัดเดียวแรงมาก เร็ว ทะลุศัตรูได้
    bullets.push({ x: mx, y: my, vx: Math.cos(a) * RIFLE_SPEED, vy: Math.sin(a) * RIFLE_SPEED, life: RIFLE_LIFE, dmg: dmg, rifle: true, pierce: RIFLE_PIERCE });
    addShake(3);
    spawnSparks(mx, my, 6, '#bfe8ff');
    return g.fireRate / 1000;
  }
  // MACHINE_GUN
  const ap = g.id.indexOf('borz') === 0;              // ซีรีส์ BORZ: กระสุนทะลวงเกราะ (ไม่โดนลดดาเมจจากเกราะ)
  bullets.push({ x: mx, y: my, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, life: BULLET_LIFE, dmg: dmg, ap: ap });
  spawnSparks(mx, my, 2, ap ? '#ffffff' : '#ffd36b');
  return g.fireRate / 1000;
}

// ---------- อาวุธประชิด ----------
// ฟันครั้งเดียวโดนทุกตัวที่อยู่ในเขตรูปพัด: ระยะไม่เกิน reach จากมือ และอยู่ในมุม arc รอบทิศเมาส์ แล้วผลักศัตรูถอยตามทิศฟัน
function meleeSwing(p, g, dmg) {
  const thrust = !!g.thrust, dir = p.facing === 1 ? 1 : -1;
  const a = thrust ? (dir === 1 ? 0 : Math.PI) : p.angle, ca = Math.cos(a), sa = Math.sin(a);   // ชก = ตรงไปข้างหน้า ฟัน = ตามเมาส์
  const ap0 = armPivotWorld(p), o = thrust && artMode() ? armHandAt(ap0.x, ap0.y, a, 1) : (thrust ? ap0 : gunOriginWorld(p));
  const half = (g.arc || 90) * Math.PI / 360, reach = g.reach || 40;
  if (thrust) {                                      // ชก: กล่องหน้ามือ ยาว reach สูง hitH
    const bx0 = Math.min(o.x - dir * 6, o.x + dir * reach), bx1 = Math.max(o.x - dir * 6, o.x + dir * reach);
    const by0 = o.y - (g.hitH || 36) / 2, by1 = o.y + (g.hitH || 36) / 2;
    for (const e of enemies.slice()) {
      if (untargetable(e)) continue;
      if (e.x > bx1 || e.x + e.w < bx0 || e.y > by1 || e.y + e.h < by0) continue;
      impact(Math.max(bx0, Math.min(e.x + e.w / 2, bx1)), Math.max(by0, Math.min(e.y + e.h / 2, by1)), -ca, -sa);
      const killed = damageEnemy(e, dmg, false);
      if (!killed) knockEnemy(e, dir * (g.kb || 1), 0);
      addShake(4);
    }
  }
  for (const e of thrust ? [] : enemies.slice()) {
    if (untargetable(e)) continue;
    const nx = Math.max(e.x, Math.min(o.x, e.x + e.w)), ny = Math.max(e.y, Math.min(o.y, e.y + e.h));   // จุดบนกรอบศัตรูที่ใกล้มือที่สุด
    const d = Math.hypot(nx - o.x, ny - o.y);
    if (d > reach) continue;
    const da = Math.abs(Math.atan2(Math.sin(Math.atan2(e.y + e.h / 2 - o.y, e.x + e.w / 2 - o.x) - a), Math.cos(Math.atan2(e.y + e.h / 2 - o.y, e.x + e.w / 2 - o.x) - a)));
    if (d > 1 && da > half) continue;                // อยู่ติดมือ (d ~ 0) ถือว่าโดนเสมอ
    impact(nx, ny, -ca, -sa);
    const killed = damageEnemy(e, dmg, false);
    if (!killed) knockEnemy(e, ca * (g.kb || 1), sa * (g.kb || 1));
    addShake(3);
  }
  const dur = g.fireRate / 1000 * 0.55;              // ท่าสะบัดแขนใช้เวลาราวครึ่งหนึ่งของคูลดาวน์
  p.swingT = p.swingDur = dur;
  p.swingArc = half * 2;
  p.swingThrust = thrust; p.swingAng = a;
  slashes.push({ x: o.x, y: o.y, ang: a, reach: reach, half: half, t: 0, dur: dur, style: g.artKey, thrust: thrust });
  return g.fireRate / 1000;
}

function drawSlashes() {
  for (const s of slashes) {
    const k = s.t / s.dur, al = 1 - k;
    ctx.save();
    ctx.translate(s.x - cam, s.y);
    ctx.lineCap = 'round';
    if (s.thrust) {                                  // ชก: เส้นพุ่งตรงไปข้างหน้า + วงกระแทกที่ปลายหมัด
      const c = Math.cos(s.ang), sn = Math.sin(s.ang), tip = s.reach * (0.7 + 0.5 * k);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 * al) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(c * s.reach * 0.2, sn * s.reach * 0.2); ctx.lineTo(c * tip, sn * tip); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,200,255,' + (0.5 * al) + ')'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(c * s.reach * 0.4, sn * s.reach * 0.4); ctx.lineTo(c * tip, sn * tip); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * al) + ')';
      ctx.beginPath(); ctx.arc(c * tip, sn * tip, 6 + 10 * k, 0, Math.PI * 2); ctx.stroke();
      ctx.restore(); continue;
    }
    const r0 = s.reach * (0.55 + 0.45 * k), a0 = s.ang - s.half, a1 = s.ang + s.half;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * al) + ')';
    ctx.lineWidth = s.style === 'KNUCKLE' ? 5 : 3;
    ctx.beginPath(); ctx.arc(0, 0, r0, a0, a1); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,200,255,' + (0.45 * al) + ')';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.arc(0, 0, r0 - 3, a0 + 0.08, a1 - 0.08); ctx.stroke();
    ctx.restore();
  }
}

// ---------- Laser Beam ----------
let beam = null;          // { x0, y0, x1, y1 } ลำแสงเฟรมนี้ (null = ไม่ได้ยิง)
let laserTick = 0;

// ระยะบนลำแสง b ที่ชนศัตรู e (ไม่ชนคืน -1) ใช้การสุ่มจุดตามแนวลำแสง
function beamHitDist(b, e, len, ca, sa) {
  for (let d = 0; d <= len; d += 6) {
    const x = b.x0 + ca * d, y = b.y0 + sa * d;
    if (x >= e.x - 5 && x <= e.x + e.w + 5 && y >= e.y - 5 && y <= e.y + e.h + 5) return d;
  }
  return -1;
}

function updateLaser(dt) {
  if (!player.beamOn) { beam = null; laserTick = 0; return; }
  const p = player;
  const ap = gunOriginWorld(p);
  const cx = ap.x, cy = ap.y;
  const lg = equippedGun();
  const n = lg.beams || 1, spread = (lg.spread || 0) * Math.PI / 180, gap = lg.gap || 0;
  const bx = cx + Math.cos(p.angle) * muzzleDist(), by = cy + Math.sin(p.angle) * muzzleDist();
  beam = [];                                       // ลำแสงหลายเส้น: ขนาน (gap) หรือกางพัด (spread) จากปากกระบอกเดียวกัน
  for (let i = 0; i < n; i++) {
    const t = i - (n - 1) / 2, ang = p.angle + t * spread, ca = Math.cos(ang), sa = Math.sin(ang);
    const x0 = bx - Math.sin(p.angle) * t * gap, y0 = by + Math.cos(p.angle) * t * gap;
    let len = LASER_LEN, hitsGround = false;
    if (sa > 0.001 && (GROUND_Y - y0) / sa < len) { len = Math.max(0, (GROUND_Y - y0) / sa); hitsGround = true; }
    beam.push({ x0: x0, y0: y0, x1: x0 + ca * len, y1: y0 + sa * len, ca: ca, sa: sa, len: len, ground: hitsGround });
  }
  addShake(1.2 + 0.15 * (n - 1));

  laserTick -= dt;
  if (laserTick > 0) return;
  laserTick += LASER_TICK;

  // damage ของเลเซอร์ในฐานข้อมูล = ต่อ 1 pulse (ทุก fireRate ms) แต่ใช้ผลทีละ LASER_TICK เพื่อไม่ให้เลขดาเมจรัวทุกเฟรม
  // จึงคูณชดเชยให้ DPS เท่ากัน: damage x (LASER_TICK / (fireRate/1000))
  const dmg = Math.max(1, Math.round(lg.damage * (LASER_TICK / (lg.fireRate / 1000)) * atkMult()));
  for (const b of beam) {
    for (const e of enemies.slice()) {           // ลำแสงทะลุ โดนทุกตัวบนเส้น (แต่ละเส้นทำดาเมจแยกกัน)
      if (untargetable(e)) continue;               // เครื่องล่องหน: ลำแสงทะลุผ่าน
      const d = beamHitDist(b, e, b.len, b.ca, b.sa);
      if (d >= 0) {
        impact(b.x0 + b.ca * d, b.y0 + b.sa * d, -b.ca, -b.sa);
        damageEnemy(e, dmg, false);
      }
    }
    if (b.ground) impact(b.x1, b.y1, -b.ca, -1);
  }
}


// จุดเริ่มลำแสงของเลเซอร์ไหล่แต่ละเส้น (หลายเส้น = ขนานกัน ห่าง gap พิกเซล จัดกึ่งกลางที่ปากพอด) [{x,y}] พิกัดโลก
function beamOrigins(p, w) {
  const a = p.angle, pv = podPivotWorld(p), n = w.beams || 1, gap = w.gap || 0;
  const mx = pv.x + Math.cos(a) * podMuzzleDist(), my = pv.y + Math.sin(a) * podMuzzleDist();
  const out = [];
  for (let i = 0; i < n; i++) { const t = i - (n - 1) / 2; out.push({ x: mx - Math.sin(a) * t * gap, y: my + Math.cos(a) * t * gap }); }
  return out;
}

// ปล่อยเลเซอร์ไหล่: เส้นตรง (1 หรือ 2 เส้นขนานตามรุ่น) ทะลุศัตรูทุกตัว (ทะลวงเกราะ) โดนทันที ใช้ทิศเมาส์และตำแหน่งพอด ณ ตอนปล่อย
// แต่ละเส้นทำดาเมจแยกกัน (ศัตรูตัวใหญ่ที่โดนทั้งสองเส้นเจ็บสองเท่า)
function releaseEinshander(p) {
  const w = equippedMissile();
  if (w.type !== 'BEAM') return;
  const a = p.angle, ca = Math.cos(a), sa = Math.sin(a);
  const bdmg = Math.max(1, Math.round(w.damage * atkMult()));
  for (const o of beamOrigins(p, w)) {
    let len = BEAM_SHOT_LEN;
    if (sa > 0.001 && (GROUND_Y - o.y) / sa < len) len = Math.max(0, (GROUND_Y - o.y) / sa);
    const b = { x0: o.x, y0: o.y, ca: ca, sa: sa, len: len };
    for (const e of enemies.slice()) {
      if (untargetable(e)) continue;
      const d = beamHitDist(b, e, len, ca, sa);
      if (d >= 0) {
        impact(o.x + ca * d, o.y + sa * d, -ca, -sa);
        damageEnemy(e, bdmg, true);
      }
    }
    beamShots.push({ x0: o.x, y0: o.y, x1: o.x + ca * len, y1: o.y + sa * len, t: 0, thin: (w.beams || 1) > 1 });
    spawnSparks(o.x, o.y, 8, '#9fe8ff');
  }
  addShake(7 + 2 * ((w.beams || 1) - 1));
  try { Sfx.play('beam_shot'); } catch (e) {}
}

// แสงชาร์จ + เส้นไกด์บางๆ ที่ปากพอดไหล่ระหว่างชาร์จ (หลายเส้น = ทุกกระบอกชาร์จพร้อมกัน)
function drawBeamCharge() {
  if (!beamCharge) return;
  const p = player, w = equippedMissile(), k = clamp(beamCharge.t / beamCharge.dur, 0, 1), a = p.angle;
  const ca = Math.cos(a), sa = Math.sin(a), tt = performance.now() / 1000;
  ctx.save();
  ctx.lineCap = 'round';
  for (const o of beamOrigins(p, w)) {
    const mx = o.x - cam, my = o.y;
    let len = BEAM_SHOT_LEN;
    if (sa > 0.001 && (GROUND_Y - my) / sa < len) len = Math.max(0, (GROUND_Y - my) / sa);
    ctx.strokeStyle = 'rgba(120,220,255,' + (0.06 + 0.3 * k) + ')';                 // เส้นไกด์ทิศยิง จางๆ แล้วชัดขึ้น
    ctx.lineWidth = 1 + k;
    ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + ca * len, my + sa * len); ctx.stroke();
    ctx.setLineDash([]);
    const r = 3 + 15 * k + Math.random() * 2;                                        // ก้อนแสงที่ปากพอด
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, r * 1.8);
    g.addColorStop(0, 'rgba(255,255,255,' + (0.7 + 0.3 * k) + ')');
    g.addColorStop(0.35, 'rgba(140,230,255,' + (0.5 + 0.4 * k) + ')');
    g.addColorStop(1, 'rgba(60,170,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(mx, my, r * 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(190,240,255,' + (0.8 * (1 - k) + 0.2) + ')';            // ประกายพุ่งเข้าหาปากพอด
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const ang = tt * 6 + i * Math.PI / 3, d0 = (26 - 20 * k) + (i % 2) * 6, d1 = d0 - 7;
      ctx.beginPath(); ctx.moveTo(mx + Math.cos(ang) * d0, my + Math.sin(ang) * d0); ctx.lineTo(mx + Math.cos(ang) * d1, my + Math.sin(ang) * d1); ctx.stroke();
    }
  }
  ctx.restore();
}

function updateWeapons(dt) {
  if (beamCharge) {                                // ชาร์จเลเซอร์ไหล่: ตายหรือกางโล่ = ยกเลิก  ครบเวลา = ปล่อย
    if (player.dead || player.shieldUp) beamCharge = null;
    else { beamCharge.t += dt; if (beamCharge.t >= beamCharge.dur) { beamCharge = null; releaseEinshander(player); } }
  }
  for (let i = slashes.length - 1; i >= 0; i--) { slashes[i].t += dt; if (slashes[i].t >= slashes[i].dur) slashes.splice(i, 1); }
  for (let i = beamShots.length - 1; i >= 0; i--) { beamShots[i].t += dt; if (beamShots[i].t >= BEAM_SHOT_LIFE) beamShots.splice(i, 1); }
  updateStrikes(dt);
  updateDrones(dt);
  updateLaser(dt);
  updateBullets(dt);
  updateMissiles(dt);
  updateEnemyShots(dt);
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const x0 = b.x, y0 = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    // ตรวจการชนแบบแบ่งช่วง กันกระสุนทะลุตัวเมื่อเฟรมช้า
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - x0, b.y - y0) / 10));
    let hit = false;
    for (let s = 1; s <= steps && !hit; s++) {
      const sx = x0 + (b.x - x0) * s / steps;
      const sy = y0 + (b.y - y0) * s / steps;
      for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        if (untargetable(e)) continue;                                   // เครื่องล่องหน: กระสุนทะลุผ่าน
        if (b.hitList && b.hitList.indexOf(e) >= 0) continue;           // กระสุนทะลุ: ไม่โดนตัวเดิมซ้ำ
        if (sx >= e.x && sx <= e.x + e.w && sy >= e.y && sy <= e.y + e.h) {
          const bl = Math.hypot(b.vx, b.vy) || 1;
          impact(sx, sy, -b.vx / bl, -b.vy / bl);
          e.hitX = sx; e.hitY = sy;                                      // จุดที่โดน (Shield Wanzer ใช้ตัดสินว่าโล่กันไหม enemy6.js)
          const killed = damageEnemy(e, b.dmg || mgDamage(), !!b.rifle, !!b.ap);
          if (b.kb && !killed) { const bl2 = Math.hypot(b.vx, b.vy) || 1; knockEnemy(e, b.vx / bl2 * b.kb, b.vy / bl2 * b.kb); }   // แรงผลักเม็ดลูกซอง (Winchester x1.5)
          if (b.pierce > 0) { b.pierce--; (b.hitList = b.hitList || []).push(e); continue; }
          hit = true;
          break;
        }
      }
    }

    if (hit) {
      bullets.splice(i, 1);
    } else if (b.y >= GROUND_Y) {
      impact(b.x, GROUND_Y, 0, -1);
      bullets.splice(i, 1);
    } else if (b.life <= 0 || b.x < -50 || b.x > WORLD_W + 50 || b.y < -400) {
      bullets.splice(i, 1);
    }
  }
}

function updateMissiles(dt) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    if (!m.target || enemies.indexOf(m.target) < 0) m.target = nearestEnemy(m.x, m.y);
    if (m.target) {
      const t = m.target;
      const desired = Math.atan2(t.y + t.h / 2 - m.y, t.x + t.w / 2 - m.x);
      const diff = Math.atan2(Math.sin(desired - m.ang), Math.cos(desired - m.ang));
      const maxTurn = MISSILE_TURN * dt;
      m.ang += clamp(diff, -maxTurn, maxTurn);
    }
    m.speed = Math.min(MISSILE_SPEED * 1.5, m.speed + 450 * dt);
    const ca = Math.cos(m.ang), sa = Math.sin(m.ang);
    const x0 = m.x, y0 = m.y;
    m.x += ca * m.speed * dt;
    m.y += sa * m.speed * dt;
    m.life -= dt;
    sparks.push({
      x: m.x - ca * 9, y: m.y - sa * 9,
      vx: -ca * 30 + (Math.random() - 0.5) * 40, vy: -sa * 30 + (Math.random() - 0.5) * 40,
      life: 0.3, color: '#e8e2c8'
    });

    let done = false;
    const steps = Math.max(1, Math.ceil(Math.hypot(m.x - x0, m.y - y0) / 8));
    for (let s = 1; s <= steps && !done; s++) {
      const sx = x0 + (m.x - x0) * s / steps;
      const sy = y0 + (m.y - y0) * s / steps;
      for (const e of enemies) {
        if (sx >= e.x - 4 && sx <= e.x + e.w + 4 && sy >= e.y - 4 && sy <= e.y + e.h + 4) {
          spawnSparks(sx, sy, 5, '#ffd36b');
          const killed = damageEnemy(e, Math.max(1, Math.round((m.dmg || MISSILE_DMG) * atkMult())), true);
          if (!killed) knockEnemy(e, ca, sa);          // Knockback ตามทิศของมิสไซล์
          addShake(3);
          smallBoom(sx, sy, m.small ? 15 : 22);
          done = true;
          break;
        }
      }
    }
    if (!done && m.y >= GROUND_Y) {
      smallBoom(m.x, GROUND_Y, m.small ? 14 : 20);
      spawnSparks(m.x, GROUND_Y, 8, '#e0a526');
      done = true;
    }
    if (done || m.life <= 0 || m.x < -50 || m.x > WORLD_W + 50 || m.y < -400) missiles.splice(i, 1);
  }
}

function updateEnemyShots(dt) {
  updateSnipeShots(dt);                                // กระสุนสไนเปอร์เร็วมาก แยกจัดการใน enemy2.js
  for (let i = enemyShots.length - 1; i >= 0; i--) {
    const s = enemyShots[i];
    if (s.kind === 'snipe') continue;
    if (s.turn && s.trackT > 0 && !player.dead) {        // มิสไซล์บอส: เลี้ยวเข้าหาผู้เล่นเบาๆ ช่วงแรก
      s.trackT -= dt;
      const want = Math.atan2(player.y + player.h / 2 - s.y, player.x + player.w / 2 - s.x);
      const cur = Math.atan2(s.vy, s.vx);
      const d = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
      const na = cur + clamp(d, -s.turn * dt, s.turn * dt);
      s.vx = Math.cos(na) * s.speed; s.vy = Math.sin(na) * s.speed;
    }
    if (s.kind === 'bmissile') {
      const m = Math.hypot(s.vx, s.vy) || 1;
      sparks.push({ x: s.x - s.vx / m * 10, y: s.y - s.vy / m * 10, vx: -s.vx * 0.1 + (Math.random() - 0.5) * 40, vy: -s.vy * 0.1 + (Math.random() - 0.5) * 40, life: 0.3, color: '#ff9a5a' });
    }
    if (s.g) s.vy += s.g * dt;                         // ระเบิดตกตามแรงโน้มถ่วง
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    const r = s.r || 3.5;                              // กระสุนปืนใหญ่ (big) ใหญ่กว่า โดนง่ายกว่า
    if (!player.dead && s.x >= player.x - r && s.x <= player.x + player.w + r && s.y >= player.y - r && s.y <= player.y + player.h + r) {
      damagePlayer(s.dmg, s.shieldCost);
      spawnSparks(s.x, s.y, s.big ? 14 : 6, player.shieldUp ? '#4fc3f7' : '#ff8a5c');
      if (s.big) smallBoom(s.x, s.y, 28);
      enemyShots.splice(i, 1);
    } else if (s.y >= GROUND_Y) {
      spawnSparks(s.x, GROUND_Y, s.big ? 10 : 4, '#ff8a5c');
      if (s.splash) { bombSplash(s); addShake(3); }     // ระเบิด: แรงระเบิดกระจาย (enemy3.js)
      else if (s.big) { smallBoom(s.x, GROUND_Y, 26); addShake(2); }
      enemyShots.splice(i, 1);
    } else if (s.life <= 0 || s.x < -50 || s.x > WORLD_W + 50) {
      enemyShots.splice(i, 1);
    }
  }
}

function drawBeamShots() {
  drawBeamCharge();
  ctx.lineCap = 'round';
  for (const s of beamShots) {
    const k = 1 - s.t / BEAM_SHOT_LIFE, x0 = s.x0 - cam, x1 = s.x1 - cam;
    ctx.strokeStyle = 'rgba(80,200,255,' + 0.3 * k + ')';
    ctx.lineWidth = (3 + 18 * k) * (s.thin ? 0.7 : 1);
    ctx.beginPath(); ctx.moveTo(x0, s.y0); ctx.lineTo(x1, s.y1); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,235,255,' + 0.9 * k + ')';
    ctx.lineWidth = (1 + 7 * k) * (s.thin ? 0.7 : 1);
    ctx.beginPath(); ctx.moveTo(x0, s.y0); ctx.lineTo(x1, s.y1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,' + k + ')';
    ctx.lineWidth = 1 + 2.5 * k;
    ctx.beginPath(); ctx.moveTo(x0, s.y0); ctx.lineTo(x1, s.y1); ctx.stroke();
  }
}

function drawBeam() {
  drawStrikes();
  drawDrones();
  drawBeamShots();
  if (!beam) return;
  const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 35);
  const k = beam.length > 1 ? 0.7 : 1;             // หลายเส้น = เส้นบางลงไม่ให้ทึบจอ
  ctx.lineCap = 'round';
  for (const b of beam) {
    const x0 = b.x0 - cam, x1 = b.x1 - cam;
    ctx.strokeStyle = 'rgba(255,80,200,0.28)';
    ctx.lineWidth = 12 * pulse * k;
    ctx.beginPath(); ctx.moveTo(x0, b.y0); ctx.lineTo(x1, b.y1); ctx.stroke();
    ctx.strokeStyle = '#ff6ad5';
    ctx.lineWidth = 5 * pulse * k;
    ctx.beginPath(); ctx.moveTo(x0, b.y0); ctx.lineTo(x1, b.y1); ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.moveTo(x0, b.y0); ctx.lineTo(x1, b.y1); ctx.stroke();
  }
}

function drawBullets() {
  ctx.lineCap = 'round';
  for (const b of bullets) {
    const sx = b.x - cam;
    const mag = Math.hypot(b.vx, b.vy);
    const len = b.rifle ? 46 : 16;                     // ไรเฟิล: เส้นยาวสีฟ้าขาว
    const tx = sx - (b.vx / mag) * len;
    const ty = b.y - (b.vy / mag) * len;
    ctx.strokeStyle = b.rifle ? 'rgba(120, 200, 255, 0.5)' : 'rgba(255, 211, 107, 0.45)';
    ctx.lineWidth = b.rifle ? 7 : 4;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(sx, b.y); ctx.stroke();
    ctx.strokeStyle = b.rifle ? '#eaf8ff' : '#fff2c4';
    ctx.lineWidth = b.rifle ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(sx - (b.vx / mag) * len / 2, b.y - (b.vy / mag) * len / 2); ctx.lineTo(sx, b.y); ctx.stroke();
  }
}

function drawMissiles() {
  for (const m of missiles) {
    ctx.save();
    ctx.translate(m.x - cam, m.y);
    ctx.rotate(m.ang);
    ctx.fillStyle = '#ffd36b';
    ctx.fillRect(-14, -2, 6, 4);
    ctx.fillStyle = '#c9ccc0';
    ctx.fillRect(-8, -3, 14, 6);
    ctx.fillStyle = '#d9462f';
    ctx.beginPath();
    ctx.moveTo(6, -3); ctx.lineTo(12, 0); ctx.lineTo(6, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawEnemyShots() {
  for (const s of enemyShots) {
    const sx = s.x - cam;
    if (s.kind === 'bomb') {                           // ระเบิดทิ้ง: ลูกกลมยาวหัวทิ่มลงตามทิศตก มีครีบท้าย
      ctx.save();
      ctx.translate(sx, s.y);
      ctx.rotate(Math.atan2(s.vy, s.vx));
      ctx.scale(1.3 * (s.sc || 1), 1.3 * (s.sc || 1));
      ctx.fillStyle = '#2d343a';
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c94a3a';
      ctx.fillRect(-1, -5, 3, 10);
      ctx.fillStyle = '#4b555d';
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-14, -5); ctx.lineTo(-11, 0); ctx.lineTo(-14, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
      continue;
    }
    if (s.kind === 'bmissile') {                       // มิสไซล์บอส: ตัวหมุนตามทิศ มีเปลวท้าย
      ctx.save();
      ctx.translate(sx, s.y);
      ctx.rotate(Math.atan2(s.vy, s.vx));
      if (s.sc) ctx.scale(s.sc, s.sc);
      ctx.fillStyle = 'rgba(255,120,50,0.5)';
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-20 - Math.random() * 6, -3); ctx.lineTo(-20 - Math.random() * 6, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c9ccc0';
      ctx.fillRect(-9, -3.5, 16, 7);
      ctx.fillStyle = '#d9462f';
      ctx.beginPath(); ctx.moveTo(7, -3.5); ctx.lineTo(14, 0); ctx.lineTo(7, 3.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7a2a20';
      ctx.fillRect(-9, -5, 4, 2); ctx.fillRect(-9, 3, 4, 2);
      ctx.restore();
      continue;
    }
    if (s.kind === 'snipe') {                          // กระสุนสไนเปอร์: เส้นขาว-แดงยาว เร็วมาก
      const mag = Math.hypot(s.vx, s.vy) || 1;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,60,40,0.35)';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(sx - s.vx / mag * 70, s.y - s.vy / mag * 70); ctx.lineTo(sx, s.y); ctx.stroke();
      ctx.strokeStyle = '#fff2ee';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx - s.vx / mag * 36, s.y - s.vy / mag * 36); ctx.lineTo(sx, s.y); ctx.stroke();
      continue;
    }
    if (s.kind === 'laser') {                          // เลเซอร์ Monolet: เส้นสั้นสีเขียวมิ้นต์ (ต่างจากเลเซอร์ผู้เล่นสีชมพู)
      const mag = Math.hypot(s.vx, s.vy) || 1;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(80,255,210,0.35)';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(sx - s.vx / mag * 34, s.y - s.vy / mag * 34); ctx.lineTo(sx, s.y); ctx.stroke();
      ctx.strokeStyle = '#eafff9';
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(sx - s.vx / mag * 22, s.y - s.vy / mag * 22); ctx.lineTo(sx, s.y); ctx.stroke();
      continue;
    }
    if (s.kind === 'hmg') {                            // ปืนกลหนักของบอส: กระสุนเส้นยาวสีส้ม
      const mag = Math.hypot(s.vx, s.vy) || 1;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,150,60,0.4)';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(sx - s.vx / mag * 20, s.y - s.vy / mag * 20); ctx.lineTo(sx, s.y); ctx.stroke();
      ctx.strokeStyle = '#ffe2a0';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx - s.vx / mag * 10, s.y - s.vy / mag * 10); ctx.lineTo(sx, s.y); ctx.stroke();
      continue;
    }
    if (s.big) {                                       // กระสุนปืนใหญ่: ลูกใหญ่ มีหางควัน
      const mag = Math.hypot(s.vx, s.vy) || 1;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,120,50,0.35)';
      ctx.lineWidth = s.r * 1.6;
      ctx.beginPath(); ctx.moveTo(sx - (s.vx / mag) * 26, s.y - (s.vy / mag) * 26); ctx.lineTo(sx, s.y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,106,60,0.4)';
      ctx.beginPath(); ctx.arc(sx, s.y, s.r * 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb13b';
      ctx.beginPath(); ctx.arc(sx, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff2c4';
      ctx.beginPath(); ctx.arc(sx, s.y, s.r * 0.45, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.fillStyle = 'rgba(255,138,92,0.35)';
    ctx.beginPath(); ctx.arc(sx, s.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff8a5c';
    ctx.beginPath(); ctx.arc(sx, s.y, 3.5, 0, Math.PI * 2); ctx.fill();
  }
}
