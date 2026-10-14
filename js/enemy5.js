'use strict';
/* ==========================================================================
   enemy5.js : ศัตรูใหม่ของด่าน 07  หุ่น Wanzer ฝ่ายศัตรู (วาดด้วยภาพพาร์ท Hammer ชุดเดียวกับที่ผู้เล่นวาด)
     EnemyShotWanzer   (type 'swanzer')  ถือปืนลูกซอง: เดินเข้าใกล้ ชาร์จปืนสั้นๆ แล้วยิงลูกซองกระจาย (ระยะสั้น)
     EnemyMissileWanzer(type 'mwanzer')  ถือมิสไซล์พอด: เว้นระยะ ชาร์จแล้วยิงมิสไซล์เลี้ยวตาม 2 นัดต่อเนื่อง
   หลักการเดียวกับบอส Mimic Attacker (boss4.js): เดิน/ถอย/กระโดด/แดช  แต่ละตัวมีอาวุธอย่างเดียว (อีกช่องไม่วาด)
   ภาพ: พาร์ท Hammer (assets/parts/*_hammer_1.png, ไหล่ตาม spriteUrl)  แพ็กหลังไม่มี Hammer ใช้ Basic  ไม่มีไฟล์ = ใช้ภาพ Basic แทน
   ปืนลูกซองใช้ภาพ Henry I (gun_henry.png > gun_shotgun.png)  มิสไซล์พอดใช้ภาพมิสไซล์ตั้งต้น
   ค่าตัวเลขอยู่ใน config.js (WZ_*, SW_*, MW_*)
   ========================================================================== */

// ---------- ชุดที่สวม + การซ่อนอาวุธอีกช่อง ----------
let wzHide = null;                                           // { pod: true } / { gun: true } ระหว่างวาด
(function () {
  const baseImg = weaponImage, basePod = drawMissilePod, baseVec = drawVectorGun;
  weaponImage = function (w) {
    if (wzHide && ((w.slot === 'missile' && wzHide.pod) || (w.slot === 'gun' && wzHide.gun))) return null;
    return baseImg(w);
  };
  drawMissilePod = function () { if (wzHide && wzHide.pod) return; return basePod.apply(this, arguments); };
  drawVectorGun = function () { if (wzHide && wzHide.gun) return; return baseVec.apply(this, arguments); };
})();

function wzParts() {
  const o = defaultEquippedParts();
  for (const c of PART_CATEGORIES) if (findPart(c, 'hammer_1')) o[c] = 'hammer_1';
  return o;
}

function withWanzerLoadout(e, fn) {
  const sp = profile.equippedParts, sw = profile.equippedWeapon, sc = player.crouch;
  profile.equippedParts = wzParts();
  profile.equippedWeapon = { gun: 'henry_1', missile: STARTER_WEAPONS.missile };
  player.crouch = 0;
  try { return fn(); }
  finally { profile.equippedParts = sp; profile.equippedWeapon = sw; player.crouch = sc; }
}

// ---------- สร้างตัว ----------
function makeWanzerE(type, x) {
  const shot = type === 'swanzer';
  return {
    type: type, x: x, y: GROUND_Y - WZ_H, w: WZ_W, h: WZ_H,
    hp: shot ? SW_HP : MW_HP, maxHp: shot ? SW_HP : MW_HP, armor: shot ? SW_ARMOR : MW_ARMOR,
    homeX: x, dir: -1, flash: 0, phase: Math.random() * 6,
    vx: 0, vy: 0, dashT: 0, dashDir: 1, state: 'move', act: 0.4 + Math.random() * 0.8, mvAct: 'idle', mvDir: 0,
    cd: 1.2 + Math.random() * 1.2, wt: 0, rec: 0, mq: [], aim: Math.PI, walk: Math.random() * 6, ghostT: 0, ghosts: [],
    podT: 0, podAng: 0, glow: 0
  };
}
function makeShotWanzer(x) { return makeWanzerE('swanzer', x); }
function makeMissileWanzer(x) { return makeWanzerE('mwanzer', x); }

// ---------- ตำแหน่งปืน / พอด ----------
function wzFacing(e) { return Math.cos(e.aim) >= 0 ? 1 : -1; }

function wzGunMuzzle(e) {                                    // ปากกระบอกลูกซองในพิกัดโลก
  return withWanzerLoadout(e, function () {
    const sx = e.w / 2, sy = e.h - 55 * WZ_K;
    const hand = armHandAt(sx, sy, e.aim, WZ_K, 0);
    const reach = (weaponMuzzleReach(equippedGun()) + 6) * WZ_K;
    return { x: e.x + hand.x + Math.cos(e.aim) * reach, y: e.y + hand.y + Math.sin(e.aim) * reach };
  });
}

function wzPodMuzzle(e) {
  const f = wzFacing(e);
  return { x: e.x + e.w / 2 + POD_AT.x * f * WZ_K, y: e.y + e.h - POD_AT.y * WZ_K };
}

// ---------- ยิง ----------
function fireShotWanzer(e) {
  const m = wzGunMuzzle(e);
  for (let i = 0; i < SW_PELLETS; i++) {
    const a = e.aim + SW_SPREAD * (i / (SW_PELLETS - 1) - 0.5) + (Math.random() - 0.5) * 0.05;
    const sp = SW_PELLET_SPEED * (0.94 + Math.random() * 0.12);
    enemyShots.push({ x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: SW_DMG, life: SW_PELLET_LIFE, r: 3.5, shieldCost: SW_SHIELD });
  }
  spawnSparks(m.x, m.y, 8, '#ffd9a0');
  smallBoom(m.x, m.y, 14);
  addShake(3);
  e.fireFlash = 0.1;
}

function fireWanzerMissile(e, pcx, pcy, off) {
  const m = wzPodMuzzle(e);
  let a = Math.atan2(pcy - m.y, pcx - m.x) + off;
  const f = Math.cos(a) >= 0 ? 1 : -1;
  if (f !== wzFacing(e)) a = f > 0 ? -0.3 : Math.PI + 0.3;     // ไม่ยิงย้อนหลัง
  enemyShots.push({
    x: m.x, y: m.y, vx: Math.cos(a) * MW_MISSILE_SPEED, vy: Math.sin(a) * MW_MISSILE_SPEED, speed: MW_MISSILE_SPEED,
    dmg: MW_DMG, life: 4.0, r: 6, big: true, kind: 'bmissile', shieldCost: MW_SHIELD, turn: 2.0, trackT: 1.3, sc: 0.9
  });
  e.podT = 0.5; e.podAng = a;
  spawnSparks(m.x, m.y, 5, '#e8e2c8');
  addShake(1.5);
}

// ---------- สมอง ----------
function updateWanzerE(e, dt, pcx, pcy) {
  const shot = e.type === 'swanzer';
  const speed = shot ? SW_SPEED : MW_SPEED, pmin = shot ? SW_PREF_MIN : MW_PREF_MIN, pmax = shot ? SW_PREF_MAX : MW_PREF_MAX;
  const range = shot ? SW_RANGE : MW_RANGE;
  if (e.kx) {                                                // แรงผลักจากมิสไซล์/ลูกซอง (หุ่น Hammer หนัก ถูกผลักน้อย)
    e.x = clamp(e.x + e.kx * 0.5 * dt, 0, WORLD_W - e.w);
    e.kx *= Math.pow(0.01, dt);
    if (Math.abs(e.kx) < 5) e.kx = 0;
  }
  e.podT = Math.max(0, e.podT - dt);
  e.fireFlash = Math.max(0, (e.fireFlash || 0) - dt);

  const cx = e.x + e.w / 2, dx = pcx - cx, adx = Math.abs(dx), toward = Math.sign(dx) || 1;
  const onScreen = cx > cam + 10 && cx < cam + W - 10;
  e.dir = toward;

  // หมุนปืนเข้าหาผู้เล่น
  const sy = e.y + e.h - 55 * WZ_K;
  const want = Math.atan2(pcy - sy, pcx - cx);
  const d = Math.atan2(Math.sin(want - e.aim), Math.cos(want - e.aim));
  e.aim += clamp(d, -WZ_AIM_TURN * dt, WZ_AIM_TURN * dt);

  // แรงโน้มถ่วง (กระโดดสั้นๆ)
  const floorY = GROUND_Y - e.h;
  if (e.y < floorY || e.vy < 0) { e.vy += GRAVITY * dt; e.y += e.vy * dt; if (e.y >= floorY) { e.y = floorY; e.vy = 0; } }
  else e.y = floorY;
  const air = e.y < floorY - 1;

  let tgt = 0;
  if (e.dashT > 0) {                                         // แดช
    e.dashT -= dt;
    e.vx = e.dashDir * WZ_DASH_SPEED;
    e.ghostT -= dt;
    if (e.ghostT <= 0) { e.ghostT = 0.04; e.ghosts.push({ x: e.x, y: e.y, t: 0.2, f: wzFacing(e), aim: e.aim }); if (e.ghosts.length > 6) e.ghosts.shift(); }
  } else if (e.state === 'move') {
    e.cd -= dt;
    e.act -= dt;
    if (!onScreen) { e.mvAct = 'walk'; e.mvDir = toward; e.act = 0.3; }        // อยู่นอกจอ: เดินเข้ามาก่อน ไม่ยิง
    else if (e.act <= 0) {
      const r = Math.random();
      e.act = 0.6 + Math.random() * 0.9;
      if (adx < pmin) { e.mvAct = r < 0.3 ? 'dash' : 'walk'; e.mvDir = -toward; }
      else if (adx > pmax) { e.mvAct = r < 0.2 ? 'dash' : 'walk'; e.mvDir = toward; }
      else if (r < 0.35) { e.mvAct = 'walk'; e.mvDir = Math.random() < 0.5 ? -1 : 1; }
      else if (r < 0.55) { e.mvAct = 'hop'; e.mvDir = Math.random() < 0.5 ? -1 : 1; if (!air) e.vy = -WZ_HOP_VY; }
      else if (r < 0.7) { e.mvAct = 'dash'; e.mvDir = Math.random() < 0.5 ? -1 : 1; }
      else { e.mvAct = 'idle'; e.mvDir = 0; }
      if (e.mvAct === 'dash') { e.dashT = WZ_DASH_TIME; e.dashDir = e.mvDir || -toward; spawnSparks(cx, e.y + e.h, 6, '#9fd8ff'); }
    }
    tgt = (e.mvAct === 'walk' || e.mvAct === 'hop') ? e.mvDir * speed : 0;
    if (e.cd <= 0 && onScreen && adx <= range && !air && !player.dead) { e.state = 'wind'; e.wt = 0; }
  } else if (e.state === 'wind') {                           // ยืนชาร์จ: ปากกระบอกเรืองแสงเตือน
    e.wt += dt;
    e.glow = clamp(e.wt / (shot ? SW_WINDUP : MW_WINDUP), 0, 1);
    if (e.wt >= (shot ? SW_WINDUP : MW_WINDUP)) {
      e.glow = 0;
      if (shot) { fireShotWanzer(e); e.state = 'rec'; e.rec = 0.45; }
      else { e.mq = []; for (let i = 0; i < MW_MISSILES; i++) e.mq.push(i * MW_GAP); e.mqT = 0; e.state = 'fire'; e.rec = 0.5; }
    }
  } else if (e.state === 'fire') {                           // ยิงมิสไซล์ต่อเนื่องจนครบ
    e.mqT += dt;
    while (e.mq.length && e.mqT >= e.mq[0]) { e.mq.shift(); fireWanzerMissile(e, pcx, pcy, e.mq.length ? -0.1 : 0.1); }
    if (!e.mq.length) { e.rec -= dt; if (e.rec <= 0) { e.state = 'move'; e.cd = MW_FIRE_CD * (0.9 + Math.random() * 0.3); e.act = 0.3; } }
  } else if (e.state === 'rec') {                            // หลังยิงลูกซอง
    e.rec -= dt;
    if (e.rec <= 0) { e.state = 'move'; e.cd = SW_FIRE_CD * (0.9 + Math.random() * 0.3); e.act = 0.3; }
  }

  if (e.dashT <= 0) e.vx += clamp(tgt - e.vx, -900 * dt, 900 * dt);
  e.x = clamp(e.x + e.vx * dt, 0, WORLD_W - e.w);
  if (mission.lockX >= 0) e.x = clamp(e.x, mission.lockX, mission.lockX + W - e.w);
  e.walk += Math.abs(e.vx) * dt / 38;
  for (let i = e.ghosts.length - 1; i >= 0; i--) { e.ghosts[i].t -= dt; if (e.ghosts[i].t <= 0) e.ghosts.splice(i, 1); }
}

// ---------- วาด ----------
function wzFallback(cx, feetY, e, flash) {                   // ไม่มีไฟล์ภาพ: วาดหุ่นบล็อกสีเหล็ก
  const k = WZ_K, c = flash ? '#d9694f' : '#2D3238', L = '#161a1e';
  const box = function (col, x, y, w, h) { ctx.fillStyle = col; ctx.fillRect(cx + x * k, feetY - (y + h) * k, w * k, h * k); ctx.strokeStyle = L; ctx.lineWidth = 2; ctx.strokeRect(cx + x * k, feetY - (y + h) * k, w * k, h * k); };
  box(c, -16, 0, 12, 12); box(c, 4, 0, 12, 12); box(c, -20, 12, 40, 16); box(c, -10, 28, 20, 12);
  if (e.type === 'swanzer') { ctx.save(); ctx.translate(cx, feetY - 55 * k); ctx.rotate(e.aim); ctx.fillStyle = '#6b5a3a'; ctx.fillRect(0, -3 * k, 36 * k, 6 * k); ctx.restore(); }
}

function drawWanzerE(e, sx, sy, flash) {
  const shot = e.type === 'swanzer';
  const cx = sx + e.w / 2, feetY = sy + e.h, f = wzFacing(e) > 0;
  const air = clamp((GROUND_Y - feetY) / 200, 0, 1);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,' + (0.35 - air * 0.2) + ')';
  ctx.beginPath(); ctx.ellipse(cx, GROUND_Y + 2, 24 - air * 8, 4, 0, 0, Math.PI * 2); ctx.fill();

  withWanzerLoadout(e, function () {
    wzHide = shot ? { pod: true } : { gun: true };
    try {
      const hasArt = !!equippedPartImage('BODY');
      const podRest = f ? POD_REST : Math.PI - POD_REST;
      const podAng = e.podT > 0 ? e.podAng : (e.state === 'wind' && !shot ? (f ? -0.6 : Math.PI + 0.6) : podRest);
      const bob = Math.min(1, Math.abs(e.vx) / 100) * Math.abs(Math.sin(e.walk)) * 1.4;
      const lean = clamp(e.vx / 650, -0.2, 0.2) * (e.dashT > 0 ? 1 : 0.5);
      if (hasArt) {
        for (const gh of e.ghosts) {
          ctx.globalAlpha = clamp(gh.t / 0.2, 0, 1) * 0.25;
          drawMechArt(gh.x - cam + e.w / 2, gh.y + e.h, WZ_K, gh.f > 0, gh.aim, gh.f > 0 ? POD_REST : Math.PI - POD_REST, false, false, false, 0, lean, 0);
        }
        ctx.globalAlpha = 1;
      }
      if (!flash) ctx.filter = 'drop-shadow(0 0 3px rgba(255,70,50,0.6))';        // ออร่าแดงบางๆ บอกว่าเป็นศัตรู
      if (hasArt) drawMechArt(cx, feetY, WZ_K, f, e.aim, podAng, e.podT > 0, flash, false, bob, lean, 0);
      else wzFallback(cx, feetY, e, flash);
      ctx.filter = 'none';
    } finally { wzHide = null; }
  });

  if (e.glow > 0.02 || e.fireFlash > 0) {                    // เรืองแสงเตือนก่อนยิง / แสงปากกระบอก
    const m = shot ? wzGunMuzzle(e) : wzPodMuzzle(e);
    ctx.fillStyle = e.fireFlash > 0 ? 'rgba(255,230,160,0.9)' : 'rgba(255,' + (shot ? 170 : 110) + ',80,' + (0.35 + 0.5 * e.glow) + ')';
    ctx.beginPath(); ctx.arc(m.x - cam, m.y, e.fireFlash > 0 ? 12 : 3 + 7 * e.glow, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
