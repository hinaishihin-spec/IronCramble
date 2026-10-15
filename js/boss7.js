'use strict';
/* ==========================================================================
   boss7.js : บอสด่าน 09  ACE WANZER  (หุ่นคู่ปรับ ตัวเท่าผู้เล่น ไม่ใช่ยักษ์)
     วาดด้วยภาพพาร์ท Hammer (หุ่น Wanzer ศัตรู enemy5.js) ย้อมสีม่วงเข้ม + ออร่า  ขยับเร็วเหมือนผู้เล่น: เดิน/ถอย/กระโดด/แดช
     เฟส 1 (ปืน)   วนท่า: ยิงชุด 5 นัด > พุ่งฟัน (RUSH) > มิสไซล์ 2 นัด > กระโดดยิงเป็นพัด > ยิงชุด > พุ่งฟัน
     เฟส 2 (ดาบพลังงาน)  ไวขึ้น วนท่า: PHANTOM STEP (หายตัวไปโผล่ด้านหลังแล้วฟัน) > ยิงชุดเบิ้ล > SHOCKWAVE (ฟันปล่อยคลื่นเลียพื้น ต้องกระโดดข้าม)
                       > พุ่งฟัน 2 ครั้งติด > มิสไซล์ 4 นัด > กระโดดยิง
     ทุกท่าฟัน/พุ่งมีช่วงเตือน (เส้นแดง / ตัวกะพริบ / ดาบเรืองแสง) และหลังฟันบอสยืนพักให้โต้กลับ
   ใช้ระบบ WARNING / กล้องล็อก / เฟส / รางวัล ชุดเดียวกับบอสอื่น  ค่าตัวเลขด้านล่างของไฟล์นี้ (ACE_*)
   ภาพวาดเอง: assets/enemies/boss_acewanzer.png (กรอบโดนประมาณ 47 x 83)
   ========================================================================== */

const ACE_K = 1.3;
const ACE_W = Math.round(PLAYER_BOX.w * ACE_K), ACE_H = Math.round(PLAYER_BOX.h * ACE_K);
const ACE_HP = 1100, ACE_PHASE2_HP = 550, ACE_ARMOR = 0.15, ACE_EXP = 1200, ACE_REWARD_GOLD = 1000;
const ACE_SPEED = 150, ACE_SPEED2 = 190, ACE_DASH_SPEED = 700, ACE_DASH_TIME = 0.16, ACE_HOP_VY = 640;
const ACE_REST = 0.9, ACE_REST2 = 0.55;                                       // พักระหว่างท่า (เฟส 1 / เฟส 2)
const ACE_MG_DMG = 5, ACE_MG_SPEED = 470, ACE_MG_PER = 5, ACE_MG_GAP = 0.085, ACE_MG_TELE = 0.5, ACE_MG_SPREAD = 0.2;
const ACE_MISSILE_DMG = 8, ACE_MISSILE_SPEED = 260, ACE_MISSILE_SHIELD = 8;
const ACE_RUSH_TELE = 0.55, ACE_RUSH_TELE2 = 0.35, ACE_RUSH_SPEED = 800, ACE_RUSH_MAX = 0.45, ACE_RUSH_REC = 0.6;   // พุ่งฟัน: เวลาเตือน / ความเร็วพุ่ง / เวลาพักหลังฟัน
const ACE_SLASH_DMG = 18, ACE_SLASH_SHIELD = 14, ACE_SLASH_REACH = 82, ACE_SLASH_TIME = 0.2;
const ACE_PHANTOM_FADE = 0.28, ACE_PHANTOM_TELE = 0.45, ACE_PHANTOM_GAP = 150;
const ACE_WAVE_TELE = 0.6, ACE_WAVE_DMG = 16, ACE_WAVE_SPEED = 430;
const ACE_JUMP_SHOTS = 3, ACE_JUMP_SHOTS2 = 5;
const ACE_ROAR_TIME = 1.2;

function withAceLoadout(e, fn) {
  const sp = profile.equippedParts, sw = profile.equippedWeapon, sc = player.crouch;
  profile.equippedParts = wzParts();
  profile.equippedWeapon = { gun: 'ak_1', missile: STARTER_WEAPONS.missile };
  player.crouch = 0;
  try { return fn(); }
  finally { profile.equippedParts = sp; profile.equippedWeapon = sw; player.crouch = sc; }
}

function makeAce(startX, lockX) {
  return {
    type: 'boss', kind: 'acewanzer', phase2Hp: ACE_PHASE2_HP, exp: ACE_EXP, reward: ACE_REWARD_GOLD,
    x: startX, y: GROUND_Y - ACE_H, w: ACE_W, h: ACE_H, hp: ACE_HP, maxHp: ACE_HP, armor: ACE_ARMOR,
    dir: -1, flash: 0, phase: 0, stage: 1, mode: 'intro', modeT: 0, introT: 0,
    startX: startX, restX: lockX + W - ACE_W - 90,
    glow: 0, fireFlash: 0, cd: 1.2, cycle: 0, act: null, aim: Math.PI, face: -1,
    vx: 0, vy: 0, mv: { act: 'idle', dir: 0, t: 0.6 }, dashT: 0, dashDir: 1, walk: 0, ghostT: 0, ghosts: [],
    podT: 0, podAng: 0, slashT: 0, slashDir: 1, alpha: 1, tele: 0, teleLine: null, blade: 0
  };
}

function aceFacing(e) { return e.face >= 0 ? 1 : -1; }

function aceMuzzle(e) {                                         // ปากกระบอกปืน (พิกัดโลก)
  return withAceLoadout(e, function () {
    const hand = armHandAt(e.w / 2, e.h - 55 * ACE_K, e.aim, ACE_K, 0);
    const reach = (weaponMuzzleReach(equippedGun()) + 6) * ACE_K;
    return { x: e.x + hand.x + Math.cos(e.aim) * reach, y: e.y + hand.y + Math.sin(e.aim) * reach, hx: e.x + hand.x, hy: e.y + hand.y };
  });
}
function acePodMuzzle(e) {
  const f = aceFacing(e);
  return { x: e.x + e.w / 2 + POD_AT.x * f * ACE_K, y: e.y + e.h - POD_AT.y * ACE_K };
}

// ---------- กระสุน ----------
function aceBullet(e, pcx, pcy, spread, speed) {
  const m = aceMuzzle(e);
  const a = Math.atan2(pcy - m.y, pcx - m.x) + (Math.random() - 0.5) * spread;
  const sp = speed * (0.94 + Math.random() * 0.12);
  enemyShots.push({ x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: ACE_MG_DMG, life: 2.2, r: 4, kind: 'hmg' });
  e.fireFlash = 0.05; e.aim += (a - e.aim) * 0.0;
  spawnSparks(m.x, m.y, 2, '#ffd36b');
}

function aceMissile(e, pcx, pcy, off) {
  const m = acePodMuzzle(e);
  let a = Math.atan2(pcy - m.y, pcx - m.x) + off;
  const f = Math.cos(a) >= 0 ? 1 : -1;
  if (f !== aceFacing(e)) a = f > 0 ? -0.3 : Math.PI + 0.3;     // ไม่ยิงย้อนหลัง
  enemyShots.push({
    x: m.x, y: m.y, vx: Math.cos(a) * ACE_MISSILE_SPEED, vy: Math.sin(a) * ACE_MISSILE_SPEED, speed: ACE_MISSILE_SPEED,
    dmg: ACE_MISSILE_DMG, life: 4.2, r: 6, big: true, kind: 'bmissile', shieldCost: ACE_MISSILE_SHIELD, turn: 2.2, trackT: 1.5, sc: 1
  });
  e.podT = 0.5; e.podAng = a;
  spawnSparks(m.x, m.y, 5, '#e8e2c8'); addShake(1.5);
}

// ---------- ฟัน ----------
function aceSlashHit(e, dir, reach) {                           // กล่องฟันด้านหน้าตัวบอท โดนผู้เล่นครั้งเดียวต่อการฟัน
  if (player.dead) return;
  const cx = e.x + e.w / 2, x0 = dir > 0 ? cx : cx - reach, x1 = dir > 0 ? cx + reach : cx;
  if (player.x + player.w >= x0 && player.x <= x1 && player.y + player.h >= e.y - 10 && player.y <= e.y + e.h + 10) {
    damagePlayer(ACE_SLASH_DMG, ACE_SLASH_SHIELD);
    spawnSparks(player.x + player.w / 2, player.y + player.h / 2, 10, player.shieldUp ? '#4fc3f7' : '#ff8a5c');
    addShake(6);
    return true;
  }
  return false;
}

function aceStartSlash(e, dir) {
  e.slashT = ACE_SLASH_TIME; e.slashDir = dir; e.face = dir;
  addShake(3);
  spawnSparks(e.x + e.w / 2 + dir * 40, e.y + e.h * 0.5, 8, e.stage === 2 ? '#7fe8ff' : '#ffffff');
}

function aceShockwave(e, dir) {
  enemyShots.push({ x: e.x + e.w / 2 + dir * 30, y: GROUND_Y - 14, vx: dir * ACE_WAVE_SPEED, vy: 0, dmg: ACE_WAVE_DMG, life: 2.4, r: 11, big: true, shieldCost: 14 });
  addShake(4);
}

// ---------- เคลื่อนที่ (เหมือนผู้เล่น) ----------
// mode: 'free' เดิน/ถอย/กระโดด/แดชเอง  'frozen' ยืนนิ่ง  'none' ไม่ยุ่งความเร็ว (ท่าพุ่งคุมเอง)
function aceMove(e, dt, pcx, mode) {
  const lo = mission.lockX + 14, hi = mission.lockX + W - e.w - 14;
  const cx = e.x + e.w / 2, dist = Math.abs(pcx - cx), toward = Math.sign(pcx - cx) || 1;
  const sp = e.stage === 2 ? ACE_SPEED2 : ACE_SPEED, mv = e.mv, floorY = GROUND_Y - e.h;
  if (e.y < floorY || e.vy < 0) { e.vy += GRAVITY * dt; e.y += e.vy * dt; if (e.y >= floorY) { e.y = floorY; e.vy = 0; spawnSparks(cx, GROUND_Y, 4, '#b8b0a0'); } }
  else e.y = floorY;
  const air = e.y < floorY - 1;
  if (mode === 'none') { /* ความเร็วคุมโดยท่า */ }
  else if (e.dashT > 0) {
    e.dashT -= dt; e.vx = e.dashDir * ACE_DASH_SPEED;
    e.ghostT -= dt;
    if (e.ghostT <= 0) { e.ghostT = 0.03; e.ghosts.push({ x: e.x, y: e.y, t: 0.22, f: aceFacing(e) }); if (e.ghosts.length > 8) e.ghosts.shift(); }
  } else if (mode === 'frozen') {
    e.vx *= Math.pow(0.0005, dt);
  } else {
    mv.t -= dt;
    if (mv.t <= 0) {
      const r = Math.random();
      mv.t = 0.5 + Math.random() * 0.7;
      const cornered = (toward > 0 && e.x <= lo + 4) || (toward < 0 && e.x >= hi - 4);
      if (dist < 170 && cornered) { e.vy = -ACE_HOP_VY * 1.15; mv.act = 'over'; mv.dir = toward; mv.t = 0.9; }
      else if (dist < 200) { mv.act = r < 0.45 ? 'dash' : 'walk'; mv.dir = -toward; }
      else if (dist > 440) { mv.act = r < 0.3 ? 'dash' : 'walk'; mv.dir = toward; }
      else if (r < 0.3) { mv.act = 'walk'; mv.dir = Math.random() < 0.5 ? -1 : 1; }
      else if (r < 0.52) { mv.act = 'hop'; mv.dir = Math.random() < 0.5 ? -1 : 1; if (!air) e.vy = -ACE_HOP_VY; }
      else if (r < 0.74) { mv.act = 'dash'; mv.dir = Math.random() < 0.5 ? -1 : 1; }
      else { mv.act = 'idle'; mv.dir = 0; }
      if (mv.act === 'dash') { e.dashT = ACE_DASH_TIME; e.dashDir = mv.dir || -toward; spawnSparks(cx, e.y + e.h, 8, '#c59aff'); }
    }
    const tgt = (mv.act === 'walk' || mv.act === 'hop') ? mv.dir * sp : (mv.act === 'over' ? mv.dir * 340 : 0);
    e.vx += clamp(tgt - e.vx, -950 * dt, 950 * dt);
  }
  e.x = clamp(e.x + e.vx * dt, lo, hi);
  e.walk += Math.abs(e.vx) * dt / 38;
  for (let i = e.ghosts.length - 1; i >= 0; i--) { e.ghosts[i].t -= dt; if (e.ghosts[i].t <= 0) e.ghosts.splice(i, 1); }
}

// ---------- ท่าต่างๆ ----------
function aceEnd(e) { e.act = null; e.cd = e.stage === 2 ? ACE_REST2 : ACE_REST; e.tele = 0; e.teleLine = null; e.blade = e.stage === 2 ? 0.35 : 0; }

function aceStartAct(e, name) {
  const s2 = e.stage === 2;
  if (name === 'burst') e.act = { name: name, t: 0, sets: s2 ? 2 : 1, n: ACE_MG_PER, gap: 0, pause: 0, started: false, mode: 'frozen' };
  else if (name === 'missiles') e.act = { name: name, t: 0, q: s2 ? [0.3, 0.45, 0.95, 1.1] : [0.3, 0.5], mode: 'free' };
  else if (name === 'jump') { e.act = { name: name, t: 0, fired: false, mode: 'free' }; e.vy = -ACE_HOP_VY * 1.45; e.dashT = 0; }
  else if (name === 'rush') e.act = { name: name, ph: 'tele', t: 0, combo: s2 ? 2 : 1, dir: 1, tx: 0, hit: false, mode: 'frozen', tele: ACE_RUSH_TELE };
  else if (name === 'phantom') e.act = { name: name, ph: 'fade', t: 0, dir: 1, hit: false, mode: 'frozen' };
  else if (name === 'wave') e.act = { name: name, ph: 'tele', t: 0, dir: 1, hit: false, mode: 'frozen' };
}

function aceAct(e, dt, pcx, pcy) {
  const a = e.act, cx = e.x + e.w / 2;
  a.t += dt;
  if (a.name === 'burst') {
    if (!a.started) {
      e.tele = clamp(a.t / ACE_MG_TELE, 0, 1);
      if (a.t >= ACE_MG_TELE) { a.started = true; e.tele = 0; }
      return;
    }
    if (a.end !== undefined) { if (a.t >= a.end) aceEnd(e); return; }      // ยิงครบแล้ว: ยืนพักสั้นๆ
    if (a.pause > 0) { a.pause -= dt; return; }
    a.gap -= dt;
    if (a.gap <= 0) {
      aceBullet(e, pcx, pcy, ACE_MG_SPREAD, ACE_MG_SPEED);
      a.n--; a.gap = ACE_MG_GAP;
      if (a.n <= 0) { a.sets--; if (a.sets <= 0) { a.mode = 'free'; a.end = a.t + 0.25; } else { a.n = ACE_MG_PER; a.pause = 0.3; } }
    }
    return;
  }
  if (a.name === 'missiles') {
    while (a.q.length && a.t >= a.q[0]) { a.q.shift(); aceMissile(e, pcx, pcy, a.q.length % 2 ? 0.08 : -0.08); }
    if (!a.q.length && a.t > 1.4) aceEnd(e);
    return;
  }
  if (a.name === 'jump') {
    if (!a.fired && e.vy > -80) {                               // ถึงจุดสูงสุด: ยิงเป็นพัดลงหาผู้เล่น
      a.fired = true;
      const n = e.stage === 2 ? ACE_JUMP_SHOTS2 : ACE_JUMP_SHOTS, m = aceMuzzle(e);
      const base = Math.atan2(pcy - m.y, pcx - m.x);
      for (let i = 0; i < n; i++) {
        const ang = base + (i - (n - 1) / 2) * 0.22;
        enemyShots.push({ x: m.x, y: m.y, vx: Math.cos(ang) * 430, vy: Math.sin(ang) * 430, dmg: ACE_MG_DMG + 1, life: 2.0, r: 4, kind: 'hmg' });
      }
      e.fireFlash = 0.1; spawnSparks(m.x, m.y, 6, '#ffd36b');
    }
    if (a.t > 0.25 && e.y >= GROUND_Y - e.h - 1) aceEnd(e);
    return;
  }
  if (a.name === 'rush' || a.name === 'phantom') { aceRushLike(e, dt, pcx, a); return; }
  if (a.name === 'wave') {
    if (a.ph === 'tele') {
      if (a.t < 0.05) a.dir = Math.sign(pcx - cx) || 1;
      e.face = a.dir; e.blade = clamp(a.t / ACE_WAVE_TELE, 0, 1);
      if (a.t >= ACE_WAVE_TELE) { a.ph = 'slash'; a.t = 0; aceStartSlash(e, a.dir); aceShockwave(e, a.dir); aceSlashHit(e, a.dir, ACE_SLASH_REACH * 0.8); }
    } else if (a.ph === 'slash') { if (a.t >= 0.25) { a.ph = 'rec'; a.t = 0; } }
    else if (a.t >= ACE_RUSH_REC) aceEnd(e);
  }
}

// พุ่งฟัน (rush) และ PHANTOM STEP (phantom = หายตัวไปโผล่ด้านหลังผู้เล่นแล้วฟันเลย ไม่พุ่ง)
function aceRushLike(e, dt, pcx, a) {
  const cx = e.x + e.w / 2, phantom = a.name === 'phantom';
  if (a.ph === 'fade') {                                        // หายตัว
    e.alpha = Math.max(0.12, 1 - a.t / ACE_PHANTOM_FADE);
    if (a.t >= ACE_PHANTOM_FADE) {
      const side = -(Math.sign(cx - pcx) || 1);                 // โผล่อีกฝั่งของผู้เล่น
      const lo = mission.lockX + 14, hi = mission.lockX + W - e.w - 14;
      let nx = clamp(pcx + side * ACE_PHANTOM_GAP - e.w / 2, lo, hi);
      if (Math.abs(nx + e.w / 2 - pcx) < 90) nx = clamp(pcx - side * ACE_PHANTOM_GAP - e.w / 2, lo, hi);    // ติดขอบ: โผล่ฝั่งตรงข้ามแทน
      smallBoom(cx, e.y + e.h / 2, 24); spawnSparks(cx, e.y + e.h / 2, 12, '#c59aff');
      e.x = nx; e.vx = 0; e.alpha = 1; a.ph = 'tele'; a.t = 0; a.tele = ACE_PHANTOM_TELE;
      smallBoom(e.x + e.w / 2, e.y + e.h / 2, 24); spawnSparks(e.x + e.w / 2, e.y + e.h / 2, 12, '#c59aff');
    }
    return;
  }
  if (a.ph === 'tele') {
    const dur = a.tele;
    e.tele = clamp(a.t / dur, 0, 1);
    if (a.t < dur * 0.6 || phantom) { a.dir = Math.sign(pcx - (e.x + e.w / 2)) || 1; a.tx = pcx; }       // เล็งตามแล้วล็อกตำแหน่ง
    e.face = a.dir;
    e.blade = e.stage === 2 ? Math.max(e.blade, e.tele) : 0;
    e.teleLine = phantom ? null : { x0: e.x + e.w / 2, x1: a.tx, y: GROUND_Y - 4 };
    if (a.t >= dur) {
      e.tele = 0; e.teleLine = null; a.t = 0;
      if (phantom) { a.ph = 'slash'; aceStartSlash(e, a.dir); a.hit = aceSlashHit(e, a.dir, ACE_SLASH_REACH); }
      else { a.ph = 'dash'; a.mode = 'none'; spawnSparks(e.x + e.w / 2, e.y + e.h, 10, '#c59aff'); }
    }
    return;
  }
  if (a.ph === 'dash') {
    e.vx = a.dir * ACE_RUSH_SPEED;
    e.ghostT -= dt;
    if (e.ghostT <= 0) { e.ghostT = 0.03; e.ghosts.push({ x: e.x, y: e.y, t: 0.22, f: a.dir }); if (e.ghosts.length > 8) e.ghosts.shift(); }
    const reached = (a.dir > 0 ? cx >= a.tx : cx <= a.tx), lo = mission.lockX + 14, hi = mission.lockX + W - e.w - 14;
    // ถึงจุดล็อก / ชนขอบ / เกินเวลา = ฟัน  (ถ้าผู้เล่นอยู่ใกล้ระหว่างพุ่งก็ฟันทันที)
    if (reached || a.t >= ACE_RUSH_MAX || e.x <= lo || e.x >= hi || Math.abs(pcx - cx) < 60) {
      e.vx = 0; a.ph = 'slash'; a.t = 0; a.mode = 'frozen';
      aceStartSlash(e, a.dir); a.hit = aceSlashHit(e, a.dir, ACE_SLASH_REACH);
    }
    return;
  }
  if (a.ph === 'slash') {                                       // ช่วงฟัน: เช็กโดนซ้ำเฉพาะกรณียังไม่โดน
    if (!a.hit && a.t < ACE_SLASH_TIME) a.hit = aceSlashHit(e, a.dir, ACE_SLASH_REACH);
    if (a.t >= ACE_SLASH_TIME) { a.ph = 'rec'; a.t = 0; }
    return;
  }
  if (a.ph === 'rec') {                                         // พักหลังฟัน (โอกาสโต้กลับ)
    if (a.t >= ACE_RUSH_REC) {
      if (a.combo > 1 && !phantom) { a.combo--; a.ph = 'tele'; a.t = 0; a.hit = false; a.tele = ACE_RUSH_TELE2; a.mode = 'frozen'; }
      else aceEnd(e);
    }
  }
}

// ---------- สมอง ----------
const ACE_SEQ1 = ['burst', 'rush', 'missiles', 'jump', 'burst', 'rush'];
const ACE_SEQ2 = ['phantom', 'burst', 'wave', 'rush', 'missiles', 'jump'];

function updateAce(e, dt, pcx, pcy) {
  bossCommon(e, dt);
  e.podT = Math.max(0, e.podT - dt);
  e.slashT = Math.max(0, e.slashT - dt);
  if (!e.act || e.act.ph !== 'fade') e.alpha += (1 - e.alpha) * Math.min(1, dt * 10);
  if (!e.act) e.blade = Math.max(0, e.blade - dt * 1.5);
  const cx = e.x + e.w / 2;
  if (!(e.act && (e.act.name === 'rush' || e.act.name === 'phantom' || e.act.name === 'wave') && e.act.ph !== 'fade')) {   // ท่าฟันล็อกทิศเอง
    e.face = Math.sign(pcx - cx) || e.face;
  }
  e.dir = e.face;
  const want = Math.atan2(pcy - (e.y + e.h * 0.4), pcx - cx);
  e.aim += clamp(Math.atan2(Math.sin(want - e.aim), Math.cos(want - e.aim)), -7 * dt, 7 * dt);

  if (e.mode === 'intro') { bossIntroSlide(e, dt); e.y = GROUND_Y - e.h; return; }
  const was = e.stage;
  bossStageCheck(e);
  if (e.stage !== was) { e.act = null; e.tele = 0; e.teleLine = null; e.alpha = 1; e.cycle = 0; }
  if (e.mode === 'roar') {
    e.modeT += dt;
    aceMove(e, dt, pcx, 'frozen');
    e.blade = Math.min(1, e.modeT / 0.8);
    if (e.modeT >= ACE_ROAR_TIME) { e.mode = 'fight'; e.cd = 0.7; }
    return;
  }
  if (player.dead) { e.act = null; e.tele = 0; e.teleLine = null; aceMove(e, dt, pcx, 'frozen'); return; }

  if (e.act) { aceAct(e, dt, pcx, pcy); if (e.act) aceMove(e, dt, pcx, e.act.mode); else aceMove(e, dt, pcx, 'free'); return; }
  aceMove(e, dt, pcx, 'free');
  e.cd -= dt;
  if (e.cd > 0) return;
  const seq = e.stage === 2 ? ACE_SEQ2 : ACE_SEQ1;
  aceStartAct(e, seq[e.cycle++ % seq.length]);
}

// ---------- วาด ----------
function aceFallback(cx, feetY, e, flash) {
  const k = ACE_K, c = flash ? '#d9694f' : '#4b2f66', L = '#161a1e';
  const box = function (col, x, y, w, h) { ctx.fillStyle = col; ctx.fillRect(cx + x * k, feetY - (y + h) * k, w * k, h * k); ctx.strokeStyle = L; ctx.lineWidth = 2; ctx.strokeRect(cx + x * k, feetY - (y + h) * k, w * k, h * k); };
  box(c, -16, 0, 12, 12); box(c, 4, 0, 12, 12); box(c, -20, 12, 40, 16); box(c, -10, 28, 20, 12);
}

function drawAce(e, sx, sy, flash) {
  const g = e.glow || 0, pulse = 0.65 + 0.35 * Math.sin(performance.now() / 100), t = performance.now();
  const cx = sx + e.w / 2, feetY = sy + e.h, f = aceFacing(e) > 0;

  // เส้นเตือนพุ่ง (พื้น) / วงเตือน
  if (e.teleLine) {
    const l = e.teleLine, k = e.tele, blink = Math.floor(t / 60) % 2 ? 1 : 0.5;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,40,60,' + (0.2 + 0.3 * k) * blink + ')'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(l.x0 - cam, l.y); ctx.lineTo(l.x1 - cam, l.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,120,120,' + (0.5 + 0.5 * k) * blink + ')'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(l.x0 - cam, l.y); ctx.lineTo(l.x1 - cam, l.y); ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  if (g > 0.02) {
    const gr = ctx.createRadialGradient(cx, sy + e.h / 2, 16, cx, sy + e.h / 2, 130);
    gr.addColorStop(0, 'rgba(170,60,255,' + (0.36 * g * pulse) + ')');
    gr.addColorStop(1, 'rgba(170,60,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(cx - 140, sy - 50, 280, 230);
  }
  const air = clamp((GROUND_Y - feetY) / 200, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,' + (0.35 - air * 0.2) + ')';
  ctx.beginPath(); ctx.ellipse(cx, GROUND_Y + 2, 30 - air * 10, 4, 0, 0, Math.PI * 2); ctx.fill();

  ctx.globalAlpha = e.alpha;
  withAceLoadout(e, function () {
    wzHide = e.stage === 2 ? { gun: true } : null;                // เฟส 2 ใช้ดาบแทนปืน
    try {
      const hasArt = !!equippedPartImage('BODY');
      const podRest = f ? POD_REST : Math.PI - POD_REST;
      const podAng = e.podT > 0 ? e.podAng : podRest;
      const bob = Math.min(1, Math.abs(e.vx) / 100) * Math.abs(Math.sin(e.walk)) * 1.4;
      const lean = clamp(e.vx / 650, -0.2, 0.2) * ((e.dashT > 0 || (e.act && e.act.ph === 'dash')) ? 1 : 0.5);
      if (hasArt) {
        for (const gh of e.ghosts) {
          ctx.globalAlpha = clamp(gh.t / 0.22, 0, 1) * 0.3 * e.alpha;
          drawMechArt(gh.x - cam + e.w / 2, gh.y + e.h, ACE_K, gh.f > 0, gh.f > 0 ? 0 : Math.PI, gh.f > 0 ? POD_REST : Math.PI - POD_REST, false, false, false, 0, lean, 0);
        }
        ctx.globalAlpha = e.alpha;
      }
      const tint = flash ? '' : 'hue-rotate(205deg) saturate(1.25) brightness(0.88) ';
      const blink = e.tele > 0 && Math.floor(t / 70) % 2 === 0;
      if (!flash) ctx.filter = tint + 'drop-shadow(0 0 ' + (4 + 4 * g) + 'px rgba(' + (blink ? '255,70,70,0.95' : '180,70,255,' + (0.6 + 0.3 * g)) + '))';
      if (hasArt) drawMechArt(cx, feetY, ACE_K, f, e.aim, podAng, e.podT > 0, flash, false, bob, lean, 0);
      else aceFallback(cx, feetY, e, flash);
      ctx.filter = 'none';
    } finally { wzHide = null; }
  });
  ctx.globalAlpha = 1;

  // ปืน: แสงปากกระบอก / เรืองแสงตอนเตรียมยิงชุด
  if (e.stage === 1 && (e.fireFlash > 0 || (e.act && e.act.name === 'burst' && !e.act.started))) {
    const m = aceMuzzle(e);
    ctx.fillStyle = e.fireFlash > 0 ? 'rgba(255,230,160,0.9)' : 'rgba(255,90,70,' + (0.3 + 0.6 * e.tele) + ')';
    ctx.beginPath(); ctx.arc(m.x - cam, m.y, e.fireFlash > 0 ? 11 : 3 + 8 * e.tele, 0, Math.PI * 2); ctx.fill();
  }
  // ดาบพลังงาน (เฟส 2): ยกขึ้นตอนเตือน ฟาดตอนฟัน
  if (e.stage === 2 && (e.blade > 0.02 || e.slashT > 0)) {
    const m = aceMuzzle(e), hx = m.hx - cam, hy = m.hy, d = e.slashDir || aceFacing(e);
    let ang, len = 62 * ACE_K * 0.9;
    if (e.slashT > 0) { const p = 1 - e.slashT / ACE_SLASH_TIME; ang = d > 0 ? -1.9 + p * 2.5 : Math.PI + 1.9 - p * 2.5; len *= 1.25; }
    else ang = d > 0 ? -1.15 - 0.4 * (1 - e.blade) : Math.PI + 1.15 + 0.4 * (1 - e.blade);
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(120,230,255,' + (0.3 + 0.3 * e.blade) + ')'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(ang) * len, hy + Math.sin(ang) * len); ctx.stroke();
    ctx.strokeStyle = '#e8fdff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(ang) * len, hy + Math.sin(ang) * len); ctx.stroke();
    if (e.slashT > 0) {                                           // เส้นโค้งตามรอยฟัน
      ctx.strokeStyle = 'rgba(200,250,255,' + (e.slashT / ACE_SLASH_TIME) * 0.8 + ')'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(hx, hy, len * 0.95, d > 0 ? -1.9 : Math.PI - 0.6, d > 0 ? 0.6 : Math.PI + 1.9); ctx.stroke();
    }
    ctx.restore();
  } else if (e.stage === 1 && e.slashT > 0) {                    // เฟส 1: พุ่งชนด้วยไหล่/มือ (เส้นขาวสั้นๆ)
    const d = e.slashDir, p = e.slashT / ACE_SLASH_TIME;
    ctx.strokeStyle = 'rgba(255,255,255,' + p + ')'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, sy + e.h * 0.5, 50, d > 0 ? -0.9 : Math.PI - 0.9, d > 0 ? 0.9 : Math.PI + 0.9); ctx.stroke();
  }
  ctx.restore();
}
