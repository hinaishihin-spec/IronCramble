'use strict';
/* ==========================================================================
   player.js : หุ่นของผู้เล่น (Wanzer) — การเคลื่อนที่ Dash/Jetpack โล่ ดาเมจ EXP/เลเวล
   ข้อมูลชั่วคราวในด่านอยู่ที่ object `player`
   ข้อมูลถาวร (เลเวล/EXP/เงิน) อยู่ที่ `profile` ใน save.js
   ========================================================================== */

// ท่าเดิน (ปรับได้): WALK_BOB = ย่อลงสูงสุดกี่พิกเซลเกม, WALK_CYCLE_SPEED = ความเร็วจังหวะ (รอบ/วินาที x 2π)
const WALK_BOB = 3, WALK_CYCLE_SPEED = 11;
// ท่าเพิ่มเติม (ปรับได้): BREATH_BOB = หายใจตอนยืนนิ่ง (พิกเซล), LAND_DIP_MAX = ย่อสูงสุดตอนลงพื้น, DASH_LEAN/WALK_LEAN = มุมโน้มตัว (เรเดียน) ตอนแดช/เดิน
const BREATH_BOB = 0.8, LAND_DIP_MAX = 4.5, DASH_LEAN = 0.3, WALK_LEAN = 0.05;
function walkBob(phase, amt) { return Math.abs(Math.sin(phase)) * WALK_BOB * amt; }

function freshPlayer() {
  return {
    x: 120, y: GROUND_Y - PLAYER_BOX.h, w: PLAYER_BOX.w, h: PLAYER_BOX.h, vx: 0, vy: 0, onGround: true, facing: 1, angle: 0,
    hp: maxHp(), dead: false, hurtFlash: 0,
    equippedParts: profile.equippedParts,   // พาร์ทที่สวมอยู่ (ออบเจกต์เดียวกับในเซฟ)
    equippedWeapon: profile.equippedWeapon,   // { gun: id, missile: id } อาวุธ 2 ช่อง (ออบเจกต์เดียวกับในเซฟ)
    walkPhase: 0, walkAmt: 0, bob: 0, breathPhase: 0, land: 0, lean: 0,   // จังหวะเดิน (ใช้ในโหมดภาพ: ตัวย่อลง bob พิกเซลเกม)
    swingT: 0, swingDur: 0, swingArc: 0, swingThrust: false, swingAng: 0,   // ท่าฟันของอาวุธประชิด (วินาทีที่เหลือ / ทั้งหมด / มุมกว้าง)
    gunCd: 0, missileCd: 0,         // คูลดาวน์แยกกัน: ปืน (คลิกซ้าย) / มิสไซล์ (คลิกขวา หรือ F)
    podAimT: 0,                      // เวลาที่พอดยังเงยชี้ตามเมาส์หลังยิงมิสไซล์ (วินาที)
    beamOn: false, heat: 0, overheated: false,
    fuel: maxFuel(), thrusting: false, prevJumpHeld: false,
    dashT: 0, dashCd: 0, dashDir: 1, dashBuffer: 0, afterTimer: 0,
    shield: SHIELD_MAX, shieldUp: false, shieldBroken: false, shieldIdle: 0, shieldFlash: 0
  };
}
const player = freshPlayer();
function resetPlayer() { Object.assign(player, freshPlayer()); }

// ---------- สเตตัสที่ผูกกับเลเวล ----------
function atkMult() { return Math.pow(LEVEL_ATK_BONUS, profile.level - 1) * partsDamageMult(); }   // เลเวล x โบนัสแขน
function mgDamage() { return Math.max(1, Math.round(MG_DMG * atkMult())); }

function levelUpFx() {
  const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
  effects.push({ x: cx, y: cy, maxR: 60, delay: 0, dur: 0.55, t: 0, ring: '#ffd23f' });
  effects.push({ x: cx, y: cy, maxR: 40, delay: 0.12, dur: 0.5, t: 0, ring: '#ffffff' });
  spawnSparks(cx, player.y, 18, '#ffd23f');
  popText(cx, player.y - 30, 'LEVEL UP!  LV ' + profile.level, '#ffd23f', 20);
  addShake(3);
}

// silent = true: ไม่เล่นเอฟเฟกต์ (ใช้ตอนรับโบนัสบนหน้าสรุปผล)
function gainExp(n, silent) {
  profile.exp += n;
  run.exp += n;
  let leveled = false;
  while (profile.exp >= expToNext(profile.level)) {
    profile.exp -= expToNext(profile.level);
    profile.level++;
    leveled = true;
  }
  if (leveled) {
    player.hp = maxHp();                  // เลเวลอัป ฟื้น HP เต็ม
    if (!silent) levelUpFx();
  }
  saveProfile();
}

// ---------- รับดาเมจ ----------
// shieldCost = เกจโล่ที่เสียเมื่อรับกระสุนนี้ขณะกางโล่ (ไม่ใส่ = ค่าปกติ ส่วนกระสุนปืนใหญ่จะส่งค่ามากกว่า)
function damagePlayer(dmg, shieldCost) {
  if (player.dead) return;
  if (player.shieldUp) {
    dmg *= (1 - SHIELD_REDUCE);
    player.shield = Math.max(0, player.shield - (shieldCost === undefined ? SHIELD_HIT_COST : shieldCost));
    player.shieldFlash = 0.15;
  }
  player.hp = Math.max(0, player.hp - dmg);
  player.hurtFlash = 0.15;
  addShake(Math.min(10, 2 + dmg));
  if (player.hp <= 0) {
    player.dead = true;
    mouse.down = false; mouse.rightDown = false;
    addShake(14);
    explode({ x: player.x, y: player.y, w: player.w, h: player.h, type: 'walker' });
  }
}

// ---------- อัปเดตทุกเฟรม ----------
function updatePlayer(dt) {
  const p = player;
  const dir = p.dead ? 0 : ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0);
  const jumpHeld = !p.dead && !!(keys.KeyW || keys.Space || keys.ArrowUp);
  const jumpPressed = jumpHeld && !p.prevJumpHeld;   // กระโดดจากพื้นต้องกดใหม่ทุกครั้ง
  p.prevJumpHeld = jumpHeld;
  const pcx = p.x + p.w / 2;

  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.shieldFlash = Math.max(0, p.shieldFlash - dt);

  // Shield: กดค้างปุ่ม Q (ไม่ใช่ช่องอาวุธ ใช้ควบคู่กับปืน/มิสไซล์ได้)
  if (p.shield <= 0) p.shieldBroken = true;
  else if (p.shield >= SHIELD_UNLOCK) p.shieldBroken = false;
  const shieldHeld = !!keys.KeyQ;
  p.shieldUp = !p.dead && shieldHeld && !p.shieldBroken && p.shield > 0;
  if (p.shieldUp) {
    p.shield = Math.max(0, p.shield - SHIELD_DRAIN * dt);
    p.shieldIdle = 0;
  } else {
    p.shieldIdle += dt;
    if (p.shieldIdle > 0.5) p.shield = Math.min(SHIELD_MAX, p.shield + SHIELD_REGEN * dt);
  }

  // Dash / Boost: กด E + ทิศทาง A/D (dashBuffer ถูกตั้งจาก GameScene เมื่อกด E)
  p.dashCd -= dt;
  p.dashBuffer -= dt;
  if (p.dashBuffer > 0 && dir !== 0 && p.dashCd <= 0 && p.dashT <= 0 && !p.shieldUp) {
    p.dashT = DASH_TIME;
    p.dashCd = DASH_COOLDOWN;
    p.dashDir = dir;
    p.dashBuffer = 0;
    p.afterTimer = 0;
    spawnSparks(pcx - dir * 20, p.y + p.h, 8, '#8fe3b0');
  }
  const dashing = p.dashT > 0;
  if (dashing) {
    p.dashT -= dt;
    p.vx = p.dashDir * DASH_SPEED * partsBoostMult();
    p.vy = 0;
    p.afterTimer -= dt;
    if (p.afterTimer <= 0) { afterimages.push({ x: p.x, y: p.y, life: 0.22 }); p.afterTimer = 0.03; }
  } else {
    p.vx = dir * MOVE_SPEED * partsSpeedMult() * (p.shieldUp ? SHIELD_SLOW : 1);
  }
  p.x = clamp(p.x + p.vx * dt, 0, WORLD_W - p.w);

  // Jump
  if (jumpPressed && p.onGround) {
    p.vy = -JUMP_SPEED;
    p.onGround = false;
  }

  // Jetpack: กดค้างกลางอากาศเพื่อบิน
  p.thrusting = !dashing && !p.onGround && jumpHeld && p.fuel > 0 && p.vy > -JET_ENGAGE_VY;
  if (p.thrusting) {
    p.fuel = Math.max(0, p.fuel - FUEL_DRAIN * dt);
    p.vy += (-JET_RISE_VY - p.vy) * Math.min(1, dt * 10);
    for (let i = 0; i < 2; i++) {
      sparks.push({
        x: pcx + (Math.random() - 0.5) * 14, y: p.y + p.h,
        vx: (Math.random() - 0.5) * 50, vy: 160 + Math.random() * 140,
        life: 0.18 + Math.random() * 0.12, color: Math.random() < 0.5 ? '#8fe3b0' : '#ffd36b'
      });
    }
  } else if (!dashing) {
    p.vy += GRAVITY * dt;
  }
  if (p.onGround) p.fuel = Math.min(maxFuel(), p.fuel + fuelRechargeRate() * dt);

  // Position + ground collision
  p.y += p.vy * dt;
  if (p.y < 6) { p.y = 6; if (p.vy < 0) p.vy = 0; }
  if (p.y + p.h >= GROUND_Y) {
    if (!p.onGround && p.vy > 200) p.land = Math.min(LAND_DIP_MAX, p.vy / 220);   // ลงพื้นแรง = ย่อตัวแรง แล้วค่อยๆ คืน
    if (!p.onGround && p.vy > 300) spawnSparks(p.x + p.w / 2, GROUND_Y, 6, '#b9b29a');
    p.y = GROUND_Y - p.h;
    p.vy = 0;
    p.onGround = true;
  }

  // จังหวะเดิน: เดินบนพื้น = ตัวย่อลงยืดขึ้นตามก้าว (walkAmt ค่อยๆ เพิ่ม/ลด ไม่กระตุกตอนเริ่ม/หยุด)
  const walking = p.onGround && !dashing && dir !== 0 && !p.dead;
  p.walkAmt += ((walking ? 1 : 0) - p.walkAmt) * Math.min(1, dt * 14);
  if (walking) p.walkPhase += dt * WALK_CYCLE_SPEED * (p.shieldUp ? 0.5 : 1);
  p.breathPhase += dt * 2.2;
  p.land *= Math.exp(-dt * 11);
  const idleK = p.onGround && !dashing && !p.dead ? 1 - p.walkAmt : 0;   // หายใจเฉพาะตอนยืนนิ่ง
  p.bob = (walkBob(p.walkPhase, p.walkAmt) + (0.5 - 0.5 * Math.cos(p.breathPhase)) * BREATH_BOB * idleK + p.land) * (artMode() ? legRig().bob : 1);
  const leanT = p.dead ? 0 : dashing ? p.dashDir * DASH_LEAN : walking ? dir * WALK_LEAN : 0;   // โน้มไปทางที่เคลื่อนที่ (ทิศโลก ไม่ใช่ทิศหัน)
  p.lean += (leanT - p.lean) * Math.min(1, dt * (dashing ? 18 : 10));

  // Aim 360° (แปลงตำแหน่งเมาส์เป็นพิกัดโลก)
  const mx = mouse.x + cam, my = mouse.y;
  p.facing = mx >= p.x + p.w / 2 ? 1 : -1;
  const ap = armPivotWorld(p);                          // เล็งจากหัวไหล่ (จุดหมุนแขน)
  p.angle = Math.atan2(my - ap.y, mx - ap.x);

  // ยิงอาวุธที่ถืออยู่ (ปืน/มิสไซล์ตามที่ติดตั้งจาก Hangar) เลเซอร์ยิงต่อเนื่องผ่าน beamOn แทน
  // ปืนกับมิสไซล์ยิงแยกกัน พร้อมกันได้: ซ้าย = ปืน / ขวา (หรือ F) = มิสไซล์ กางโล่อยู่ยิงไม่ได้ทั้งคู่
  p.swingT = Math.max(0, p.swingT - dt);
  p.gunCd -= dt; p.missileCd -= dt; p.podAimT = Math.max(0, p.podAimT - dt);
  const holdingLaser = equippedGun().type === 'LASER';
  if (mouse.down && !p.dead && !holdingLaser && !p.shieldUp && p.gunCd <= 0) {
    p.gunCd = fireWeapon(p, 0);
    run.shots++;
  }
  if (missileHeld() && !p.dead && !p.shieldUp) {
    p.podAimT = 0.5;
    if (p.missileCd <= 0) { p.missileCd = fireWeapon(p, 1); run.shots++; }
  }

  // Laser Beam (ปืนประเภท LASER): ยิงต่อเนื่องตราบที่กดเมาส์ ความร้อนเต็มจะ OVERHEAT
  p.beamOn = holdingLaser && mouse.down && !p.dead && !p.shieldUp && !p.overheated;
  if (p.beamOn) {
    p.heat = Math.min(HEAT_MAX, p.heat + LASER_HEAT_RATE * (equippedGun().heatMult || 1) * dt);
    if (p.heat >= HEAT_MAX) p.overheated = true;
  } else {
    p.heat = Math.max(0, p.heat - LASER_COOL_RATE * dt);
    if (p.overheated && p.heat <= LASER_UNLOCK_HEAT) p.overheated = false;
  }
}

// ---------- ไหล่ (Shoulders) + มิสไซล์พอด ----------
// พิกัดทั้งหมดเป็นพิกเซลสัมพัทธ์จากมุมซ้ายบนของกรอบหุ่น 40x40 (หันขวา) ใช้ร่วมกันทั้งในด่านและตัวอย่างใน Hangar
const SHOULDER_JOINT = { x: 24, y: 15 };   // จุดกึ่งกลางเกราะไหล่ = หัวไหล่ (จุดต่อลำตัวกับแขน) เยื้องมาด้านหน้าลำตัว 4px
const POD_LEN = 18;                        // ความยาวพอดจากจุดหมุนถึงปากท่อยิง (px)
const POD_REST = -1.1;                     // มุมพักของพอดตอนยังไม่ได้ถือมิสไซล์ (เงยขึ้นด้านหน้า, เรเดียน หันขวา)

function shoulderGeom() { return { w: 18, h: 14, top: SHOULDER_JOINT.y - 7 }; }   // เกราะไหล่เวกเตอร์ 18x14
// แปลงพิกัดสัมพัทธ์ -> พิกัดจอ: ox,oy = มุมซ้ายบนของกรอบหุ่นบนจอ, s = สเกล, f = ทิศที่หัน (1 ขวา / -1 ซ้าย)
function relX(ox, s, f, rx) { return f === 1 ? ox + rx * s : ox + (40 - rx) * s; }

// จุดหมุนของมิสไซล์พอด 'บนหลังคาเกราะไหล่' (โหมดเวกเตอร์: ox,oy = มุมซ้ายบนของหุ่นเวกเตอร์ 40x40)
function podPivot(ox, oy, s, f) {
  return { x: relX(ox, s, f, SHOULDER_JOINT.x), y: oy + (shoulderGeom().top + 1) * s };
}

// จุดหมุนแขน/พอดในพิกัดโลก ตามโหมดภาพ (RIG) หรือโหมดเวกเตอร์ (กลางหุ่น 40x40 / บนหลังคาไหล่)
function rigWorld(p, at) {
  const f = p.facing === 1 ? 1 : -1;
  const lr = artMode() ? legRig() : LEG_RIG_DEFAULT;     // ขาสั้น/ขาพิเศษ: ลำตัวและส่วนบนทั้งหมดเลื่อนตามสะโพก
  const pt = { x: p.x + p.w / 2 + (at[0] + lr.hipX) * f, y: p.y + p.h - at[1] - (lr.hip - 33) + (artMode() ? p.bob || 0 : 0) };   // ตัวย่อลง = จุดหมุนแขน/พอดลงตาม
  if (artMode() && p.lean) {                            // โน้มตัว = หมุนจุดรอบสะโพก
    const hx = p.x + p.w / 2 + lr.hipX * f, hy = p.y + p.h - (lr.hip - 3), c = Math.cos(p.lean), sn = Math.sin(p.lean), dx = pt.x - hx, dy = pt.y - hy;
    return { x: hx + dx * c - dy * sn, y: hy + dx * sn + dy * c };
  }
  return pt;
}
function armPivotWorld(p) {
  if (artMode()) return rigWorld(p, RIG.ARMS.at);
  return { x: p.x + p.w / 2, y: p.y + p.h - 20 };
}
function podPivotWorld(p) {
  if (artMode()) return rigWorld(p, [POD_AT.x, POD_AT.y]);
  return podPivot(p.x + p.w / 2 - 20, p.y + p.h - 40, 1, p.facing === 1 ? 1 : -1);
}
// ระยะจากจุดหมุนแขนถึงปากกระบอกที่กระสุนออก (โหมดภาพมีท่อนแขนเพิ่ม)
// ระยะจากจุดหมุนพอดถึงปากท่อยิง (โหมดภาพ = ครึ่งความยาวภาพพอด)
function podMuzzleDist() { return artMode() && weaponImage(equippedMissile()) ? WEAPON_ART.POD.len * WEAPON_ART.POD.grip[0] : POD_LEN; }
function muzzleDist() { return artMode() && weaponImage(equippedGun()) ? weaponMuzzleReach(equippedGun()) + 6 : GUN_LEN + 6; }

// วาดเกราะไหล่แบบเวกเตอร์สำรอง (โหมดเวกเตอร์เท่านั้น) สีตามซีรีส์
function drawShoulder(ox, oy, s, f, flash) {
  const cx = relX(ox, s, f, SHOULDER_JOINT.x), cy = oy + SHOULDER_JOINT.y * s;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(f * s, s);
  ctx.fillStyle = flash ? '#d9694f' : partColor('SHOULDERS');
  ctx.strokeStyle = '#161a1e'; ctx.lineWidth = 2;
  ctx.beginPath();                                    // เกราะไหล่ทรงปีกตัดมุม
  ctx.moveTo(-9, -4); ctx.lineTo(-5, -7); ctx.lineTo(5, -7); ctx.lineTo(9, -3); ctx.lineTo(9, 7); ctx.lineTo(-9, 7);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-6, 1, 12, 3);
  ctx.restore();
}

// วาดมิสไซล์พอดแบบเวกเตอร์ที่จุดหมุน pv (หมุนตามมุม ang, sel = ถืออยู่ ไฮไลต์ปลายท่อ)
function drawMissilePod(pv, s, ang, sel, flash) {
  ctx.save();
  ctx.translate(pv.x, pv.y);
  ctx.rotate(ang);
  ctx.scale(s, s);
  ctx.fillStyle = flash ? '#d9694f' : '#c9ccc0';
  ctx.strokeStyle = '#161a1e'; ctx.lineWidth = 1.5;
  ctx.fillRect(-4, -4, POD_LEN + 2, 8); ctx.strokeRect(-4, -4, POD_LEN + 2, 8);
  ctx.fillStyle = '#6f7a70'; ctx.fillRect(-4, -1, POD_LEN + 2, 2);     // ร่องระหว่างท่อ 2 ช่อง
  ctx.fillStyle = sel ? '#d9462f' : '#7a2a20'; ctx.fillRect(POD_LEN - 3, -4, 5, 8);   // ปลายท่อ
  ctx.fillStyle = '#2b3022'; ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2); ctx.fill();   // ข้อต่อ
  ctx.restore();
}

// วาดภาพอาวุธที่จุดจับ (x,y) หมุนตามมุม ang: ความยาวภาพ = art.len * k, ภาพวาดหันซ้ายจึงพลิกให้ชี้ไปทางมุมเล็ง, เล็งไปซ้ายพลิกแนวตั้งไม่ให้กลับหัว
function drawHeldSprite(img, x, y, ang, k, art) {
  const sc = art.len * k / img.width;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (Math.cos(ang) < 0) ctx.scale(1, -1);
  if (ART_FACES_LEFT) ctx.scale(-1, 1);
  ctx.scale(sc, sc);
  if (art.rot) ctx.rotate(art.rot * Math.PI / 180);      // rot (องศา) หมุนภาพรอบจุดจับ: + = ตามเข็มนาฬิกาตามที่เห็นในไฟล์ภาพ (ไว้แก้ภาพที่วาดไม่ตรงทิศหันซ้าย)
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, -art.grip[0] * img.width, -art.grip[1] * img.height);
  ctx.restore();
}

// ปืนเวกเตอร์สำรอง (ตรงกับตำแหน่งปากกระบอกที่กระสุนออก: GUN_LEN + 6 จากจุดหมุน)
function drawVectorGun(x, y, ang, col, flash, k) {
  const gunType = equippedGun().type;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (k && k !== 1) ctx.scale(k, k);                 // โหมดภาพที่ขยาย (Hangar) ปืนเวกเตอร์สำรองต้องขยายตาม
  if (gunType === 'MELEE') {                          // อาวุธประชิดเวกเตอร์: กระบองเป็นแท่งยาว / สนับมือเป็นก้อนเล็กที่หน้ามือ
    const baton = equippedGun().artKey === 'BATON';
    ctx.fillStyle = flash ? '#d9694f' : (baton ? '#9aa3a8' : '#c9ccc0');
    ctx.strokeStyle = '#161a1e'; ctx.lineWidth = 1.5;
    if (baton) { ctx.fillRect(0, -2.5, 36, 5); ctx.strokeRect(0, -2.5, 36, 5); ctx.fillStyle = '#e0a526'; ctx.fillRect(26, -3, 10, 6); }
    else {                                           // สนับมือ: แผ่นเหล็กคลุมกำปั้น มีปุ่มนูน 4 ปุ่มที่หน้าหมัด (วาดทับหน้าแขน)
      ctx.fillRect(-4, -10, 19, 20); ctx.strokeRect(-4, -10, 19, 20);
      ctx.fillStyle = '#8a8f7a'; ctx.fillRect(-4, -10, 5, 20);
      ctx.fillStyle = '#e8e2c8';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(15, -6.5 + i * 4.3, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
    ctx.restore();
    return;
  }
  ctx.fillStyle = flash ? '#d9694f' : col;
  ctx.fillRect(0, -5, GUN_LEN, 10);
  ctx.strokeStyle = '#161a1e'; ctx.lineWidth = 1.5; ctx.strokeRect(0, -5, GUN_LEN, 10);
  ctx.fillStyle = '#8a8f7a';
  ctx.fillRect(GUN_LEN - 8, -3, 8, 6);
  if (gunType === 'SHOTGUN') { ctx.fillStyle = '#6b5a3a'; ctx.fillRect(GUN_LEN - 14, -7, 14, 14); }        // ลูกซอง: ปากกระบอกบาน
  else if (gunType === 'RIFLE') { ctx.fillStyle = '#8a8f7a'; ctx.fillRect(GUN_LEN, -2, 12, 4); }          // ไรเฟิล: ลำกล้องยาวบาง
  else if (gunType === 'LASER') { ctx.fillStyle = '#ff6ad5'; ctx.fillRect(GUN_LEN - 14, -3.5, 7, 7); }    // เลเซอร์: ตัวปล่อยชมพู
  ctx.restore();
}

// ตำแหน่งปลายมือ (RIG.ARMS.hand บนภาพแขน) หลังหมุนแขนไปตามมุม ang รอบหัวไหล่ (px,py)  k = สเกล  คืนค่าหน่วยเดียวกับ px,py
// ไม่มีภาพแขน = ใช้ระยะ ARM_REACH ตามแนวเล็งแทน
function armHandAt(px, py, ang, k, ext) {
  const img = equippedPartImage('ARMS');
  if (!img) return { x: px + Math.cos(ang) * ARM_REACH * k, y: py + Math.sin(ang) * ARM_REACH * k };
  const A = RIG.ARMS.a, Hh = RIG.ARMS.hand, sc = SPRITE_H.ARMS * k / img.height;
  let vx = (Hh[0] - A[0]) * img.width * sc, vy = (Hh[1] - A[1]) * img.height * sc * (1 + (ext || 0));   // ext = แขนยืดตอนชก
  if (ART_FACES_LEFT) vx = -vx;
  const sx = Math.cos(ang) >= 0 ? 1 : -1, a2 = sx === 1 ? ang : Math.PI - ang, th = a2 - Math.PI / 2;
  const rx = vx * Math.cos(th) - vy * Math.sin(th), ry = vx * Math.sin(th) + vy * Math.cos(th);
  return { x: px + rx * sx, y: py + ry };
}
// จุดที่อาวุธปืนจับ (กระสุนออกจากตรงนี้ + ระยะ muzzleDist)
function gunOriginWorld(p) {
  const ap = armPivotWorld(p);
  return artMode() ? armHandAt(ap.x, ap.y, p.angle, 1) : ap;
}

// วาดหุ่นโหมดภาพ: cxS = กึ่งกลางเท้าบนจอ, feetY = พื้นใต้เท้า, k = สเกล (1 = ขนาดในเกม), f = ทิศหัน
// ลำดับ: แพ็กหลัง > ลำตัว > ขา > หัว > มิสไซล์พอด > แขน+ปืน (หมุนตามเมาส์) > ไหล่  ชิ้นที่ไม่มีภาพจะข้าม
function drawMechArt(cxS, feetY, k, f, gunAng, podAng, podSel, flash, noWeapons, bob, lean, ext) {
  bob = bob || 0; lean = lean || 0; ext = ext || 0;   // ext = สัดส่วนที่แขนยืดออกตอนชก (0 = ปกติ)                       // lean = โน้มตัว (เรเดียน, + = ไปทางขวาของจอ) หมุนทุกชิ้นยกเว้นขารอบสะโพก                                       // ย่อตัวตอนเดิน: ทุกชิ้นยกเว้นขาเลื่อนลง bob พิกเซลเกม ขาหดสูงเท่ากันเท้าจึงติดพื้น
  ctx.save();
  if (flash) ctx.filter = 'brightness(1.7) sepia(1) saturate(3) hue-rotate(-25deg)';   // แฟลชแดงตอนโดนยิง (เบราว์เซอร์ที่ไม่รองรับจะไม่แฟลง)
  ctx.imageSmoothingEnabled = false;
  const fwd = f ? 1 : -1;
  const lr = legRig(), upY = lr.hip - 33;                // ส่วนบนเลื่อนตามสะโพกของขาที่สวม (ขาสั้น = ต่ำลง)
  const hipX = cxS + lr.hipX * fwd * k, hipY = feetY - (lr.hip - 3) * k;
  const leanPt = function (x, y) {
    if (!lean) return { x: x, y: y };
    const c = Math.cos(lean), sn = Math.sin(lean), dx = x - hipX, dy = y - hipY;
    return { x: hipX + dx * c - dy * sn, y: hipY + dx * sn + dy * c };
  };
  const place = function (cat) {
    if (cat === 'LEGS') return { x: cxS, y: feetY };
    return leanPt(cxS + (RIG[cat].at[0] + lr.hipX) * fwd * k, feetY - (RIG[cat].at[1] + upY) * k + bob * k);
  };
  const flipArt = ART_FACES_LEFT === f;                 // ภาพหันซ้าย + หุ่นหันขวา (หรือกลับกัน) = ต้องพลิกภาพ
  const layer = function (cat) {
    const img = equippedPartImage(cat);
    if (!img) return;
    const H = cat === 'LEGS' ? lr.h : SPRITE_H[cat], sc = H * k / img.height, pt = place(cat), A = RIG[cat].a;
    ctx.save(); ctx.translate(pt.x, pt.y);
    if (cat !== 'LEGS') ctx.rotate(lean);
    if (flipArt) ctx.scale(-1, 1);
    ctx.scale(sc, cat === 'LEGS' ? sc * Math.max(0.3, (lr.h - bob) / lr.h) : sc);
    ctx.drawImage(img, -A[0] * img.width, -A[1] * img.height);
    ctx.restore();
  };
  layer('BACKPACK'); layer('BODY'); layer('LEGS'); layer('HEAD');

  const pp = leanPt(cxS + (POD_AT.x + lr.hipX) * fwd * k, feetY - (POD_AT.y + upY) * k + bob * k);
  const podImg = noWeapons ? null : weaponImage(equippedMissile());
  if (noWeapons) { /* ถอดอาวุธ: ไม่วาดพอด */ }
  else if (podImg) drawHeldSprite(podImg, pp.x, pp.y, podAng, k, WEAPON_ART.POD);
  else drawMissilePod(pp, k, podAng, podSel, flash);

  const ap = place('ARMS');
  const hand = armHandAt(ap.x, ap.y, gunAng, k, ext);        // อาวุธจับที่ปลายมือ และวาดก่อนแขน = อยู่หลังมือ
  const gunImg = noWeapons ? null : weaponImage(equippedGun());
  const gunFront = !noWeapons && !!weaponArt(equippedGun()).front;   // front = วาดทับหน้าแขน (สนับมือคลุมหมัด) ทั้งภาพจริงและภาพเวกเตอร์สำรอง
  if (noWeapons) { /* ถอดอาวุธ: ไม่วาดปืน */ }
  else if (!gunFront) {
    if (gunImg) drawHeldSprite(gunImg, hand.x, hand.y, gunAng, k, weaponArt(equippedGun()));
    else drawVectorGun(hand.x, hand.y, gunAng, partColor('ARMS'), flash, k);
  }

  const armImg = equippedPartImage('ARMS');
  if (armImg) {                                         // ภาพแขนวาดห้อยลง หมุนรอบข้อต่อไหล่ตามมุมเล็ง (ชี้ซ้ายพลิกซ้ายขวา)
    const sx = Math.cos(gunAng) >= 0 ? 1 : -1, a2 = sx === 1 ? gunAng : Math.PI - gunAng;
    const sc = SPRITE_H.ARMS * k / armImg.height, A = RIG.ARMS.a;
    ctx.save(); ctx.translate(ap.x, ap.y); ctx.scale(sx, 1); ctx.rotate(a2 - Math.PI / 2);
    if (ART_FACES_LEFT) ctx.scale(-1, 1);
    ctx.scale(sc, sc * (1 + ext)); ctx.drawImage(armImg, -A[0] * armImg.width, -A[1] * armImg.height);
    ctx.restore();
  }

  layer('SHOULDERS');
  if (gunFront) {                                       // สนับมือวาดเป็นชั้นสุดท้าย: ทับทั้งแขนและไหล่ เห็นนอกแขนเสมอ
    if (gunImg) drawHeldSprite(gunImg, hand.x, hand.y, gunAng, k, weaponArt(equippedGun()));
    else drawVectorGun(hand.x, hand.y, gunAng, partColor('ARMS'), flash, k);
  }
  ctx.restore();
}

function drawPlayer() {
  const cxS = player.x - cam + player.w / 2;
  const hit = player.hurtFlash > 0, HIT = '#d9694f', LINE = '#161a1e';
  const f = player.facing === 1;

  // ground shadow
  const air = clamp((GROUND_Y - (player.y + player.h)) / 200, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,' + (0.35 - air * 0.2) + ')';
  ctx.beginPath();
  ctx.ellipse(cxS, GROUND_Y + 2, 24 - air * 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // มุมของปืน (ถือมิสไซล์อยู่ = ปืนลดลงท่าพัก) และของมิสไซล์พอด (ถือปืนอยู่ = พอดเงยพัก)
  const podAimed = player.podAimT > 0;                 // ปืนชี้ตามเมาส์ตลอด พอดเงยชี้เมาส์เฉพาะตอนยิงมิสไซล์ นอกนั้นเงยพัก
  let gunAng = player.angle, swingExt = 0;
  if (player.swingT > 0 && player.swingDur > 0) {      // ท่าฟัน: แขนสะบัดจากยกขึ้นลงมา (หันซ้ายต้องกลับทิศ)
    const prog = 1 - player.swingT / player.swingDur, s = Math.cos(player.angle) >= 0 ? 1 : -1;
    if (player.swingThrust) { gunAng = player.swingAng; swingExt = 0.4 * Math.sin(prog * Math.PI); }   // ชก: แขนชี้ตรงไปข้างหน้าแล้วยืดออก
    else gunAng += s * player.swingArc * (prog - 0.5);
  }
  const podAng = podAimed ? player.angle : (f ? POD_REST : Math.PI - POD_REST);

  if (artMode()) {                                    // โหมดภาพซ้อนชั้น 128x160 (2 เท่าของพิกเซลเกม)
    drawMechArt(cxS, player.y + player.h, 1, f, gunAng, podAng, podAimed, hit, false, player.bob, player.lean, swingExt);
    return;
  }

  // โหมดเวกเตอร์สำรอง: หุ่นสี่เหลี่ยม 40x40 ชิดเท้าและกึ่งกลางกรอบชน สีตามซีรีส์ของพาร์ทที่สวมอยู่
  const px = cxS - 20, py = player.y + player.h - 40;
  const cx = px + 20, cy = py + 20;
  const cHead = hit ? HIT : partColor('HEAD'), cBody = hit ? HIT : partColor('BODY');
  const cArms = hit ? HIT : partColor('ARMS'), cLegs = hit ? HIT : partColor('LEGS');
  const cPack = hit ? HIT : partColor('BACKPACK');
  const box = function (c, x, y, w, h) {
    ctx.fillStyle = c; ctx.fillRect(px + x, py + y, w, h);
    ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.strokeRect(px + x + 1, py + y + 1, w - 2, h - 2);
  };
  box(cPack, f ? -9 : 40, 10, 9, 20);                 // แพ็กหลัง: กล่องไอพ่นด้านหลัง
  ctx.fillStyle = '#e0a526';
  ctx.fillRect(px + (f ? -7 : 42), py + 27, 5, 3);    // หัวฉีดไอพ่น
  box(cLegs, 4, 28, 12, 12);                          // ขา 2 ข้าง
  box(cLegs, 24, 28, 12, 12);
  box(cBody, 0, 12, 40, 16);                          // ลำตัว + แผ่นเกราะเข้ม
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(px + 5, py + 19, 30, 6);
  box(cHead, 10, 0, 20, 12);                          // หัว + ช่องมอง
  ctx.fillStyle = '#e0a526';
  ctx.fillRect(px + (f ? 19 : 11), py + 4, 10, 3);

  drawVectorGun(cx, cy, gunAng, cArms, hit);
  ctx.fillStyle = cArms;
  ctx.strokeStyle = LINE; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  drawShoulder(px, py, 1, f ? 1 : -1, hit);           // เกราะไหล่ + มิสไซล์พอดบนหลังคาไหล่
  drawMissilePod(podPivot(px, py, 1, f ? 1 : -1), 1, podAng, podAimed, hit);
}

function drawShield() {
  if (!player.shieldUp || player.dead) return;
  const cx = player.x - cam + player.w / 2, cy = player.y + player.h / 2;
  const r = 40 * (1 + Math.sin(performance.now() / 90) * 0.03);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = player.shieldFlash > 0 ? 'rgba(200,240,255,0.5)' : 'rgba(79,195,247,0.18)';
  ctx.fill();
  ctx.strokeStyle = player.shieldFlash > 0 ? '#ffffff' : '#4fc3f7';
  ctx.lineWidth = 2;
  ctx.stroke();
}
