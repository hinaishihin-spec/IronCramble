'use strict';
/* ==========================================================================
   enemy.js : ศัตรู (หุ่นเดินดิน Walker, โดรนบิน Drone, รถถัง Heavy Tank) — AI, ยิงตอบ, รับดาเมจ, ตาย
   อยากเพิ่มศัตรูชนิดใหม่: เพิ่มฟังก์ชัน makeXxx + เงื่อนไขใน updateEnemies/drawEnemies
   แล้วใส่ชื่อชนิดในเวฟของ missions.js และใน spawnWave() ของ mission.js
   ศัตรูถูกสร้างโดยระบบเวฟ (mission.js) ตอนผู้เล่นเดินถึงระยะที่กำหนด ไม่ได้เกิดพร้อมกันตอนเริ่มด่าน
   ========================================================================== */

let enemies = [];

const ENEMY_EXP = { walker: 30, drone: 20, tank: 60, chopper: 55, sniper: 45, bomber: 70, launcher: 60, swarmer: 55, monolet: 75, tplane: 90, swanzer: 70, mwanzer: 75 };

function resetEnemies() { enemies = []; }

function makeWalker(x) {
  return { type: 'walker', x: x, y: GROUND_Y - 46, w: 38, h: 46, hp: 60, maxHp: 60, homeX: x, dir: -1, flash: 0, fireCd: 1.2 + Math.random() * 1.5, phase: Math.random() * 6 };
}
function makeDrone(x, y) {
  return { type: 'drone', x: x, y: y, w: 34, h: 22, hp: 30, maxHp: 30, homeX: x, baseY: y, dir: 1, flash: 0, fireCd: 1.2 + Math.random() * 1.5, phase: Math.random() * 6 };
}
function makeTank(x) {
  return {
    type: 'tank', x: x, y: GROUND_Y - 36, w: 64, h: 36, hp: TANK_HP, maxHp: TANK_HP, armor: TANK_ARMOR,
    homeX: x, dir: -1, flash: 0, fireCd: 1.5 + Math.random() * 1.5, wind: 0, aim: Math.PI, phase: Math.random() * 6
  };
}

function nearestEnemy(x, y) {
  let best = null, bd = Infinity;
  for (const e of enemies) {
    let d = Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y);
    if (untargetable(e)) d *= 0.3;                      // ล็อกเป้า: มิสไซล์เลือกเครื่องล่องหนก่อน (อาวุธอื่นโดนไม่ได้)
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// ---------- รับดาเมจ / ตาย ----------
// คืนค่า true ถ้าศัตรูตายจากการโจมตีนี้
function damageEnemy(e, dmg, heavy, ignoreArmor) {
  if (e.type === 'boss' && (e.mode === 'intro' || e.mode === 'split')) return false;      // บอสกำลังเลื่อนเข้าจอ: ยังโดนไม่ได้
  // 1) สุ่มดาเมจพื้นฐาน +/- DMG_VARIANCE  2) สุ่มคริติคอล CRIT_CHANCE (x CRIT_MULT และทะลวงเกราะ)
  dmg = Math.max(1, Math.round(dmg * (1 + (Math.random() * 2 - 1) * DMG_VARIANCE)));
  const crit = Math.random() < CRIT_CHANCE;
  if (crit) dmg *= CRIT_MULT;
  // เกราะหนาลดดาเมจจากการโจมตีเบา (ปืนกล/เลเซอร์) แต่มิสไซล์ (heavy) และคริติคอลเจาะเต็มแรง
  if (e.armor && !heavy && !crit && !ignoreArmor) dmg = Math.max(1, Math.round(dmg * (1 - e.armor)));
  e.hp -= dmg;
  e.flash = 0.08;
  addDmgNum(e, dmg, heavy, crit);
  if (crit) spawnSparks(e.x + e.w / 2, e.y + e.h / 2, 6, '#ffd23f');
  if (e.hp <= 0) { killEnemy(e); return true; }
  return false;
}

function knockEnemy(e, dx, dy) {
  if (e.type === 'boss' || e.type === 'chopper' || e.type === 'sniper' || e.type === 'bomber' || e.type === 'fighter' || e.type === 'tplane') return;   // บอส/เฮลิคอปเตอร์/สไนเปอร์ไม่โดนผลัก
  const k = (e.type === 'tank' || e.type === 'launcher' || e.type === 'swarmer') ? 0.2 : 1;           // รถถังหนัก ถูกผลักได้น้อยมาก
  e.kx = dx * KNOCKBACK * k;
  if (e.type === 'drone') e.ky = dy * KNOCKBACK * 0.6;
}

function killEnemy(e) {
  if (e.type === 'boss') { bossDefeated(e); return; }   // บอสมีฉากพังของตัวเอง (boss.js)
  explode(e);
  if (e.type === 'tank') addShake(6);
  else if (e.type === 'bomber' || e.type === 'launcher' || e.type === 'swarmer' || e.type === 'tplane') addShake(4);
  if (!e.minion) run.kills++;                           // โดรนลูกน้องบอสไม่นับในยอดศัตรูของด่าน
  if (!player.dead && !e.minion) {
    const xp = ENEMY_EXP[e.type] || 20;
    popText(e.x + e.w / 2, e.y - 4, '+' + xp + ' EXP', '#5aa9ff', 13);
    gainExp(xp);
  }
  spawnDrop(e);
  const k = enemies.indexOf(e);
  if (k >= 0) enemies.splice(k, 1);
}

// ---------- AI ----------
function updateEnemies(dt) {
  const pcx = player.x + player.w / 2;
  const pcy = player.y + player.h / 2;

  for (const e of enemies) {
    e.phase += dt;
    e.flash = Math.max(0, e.flash - dt);
    if (e.type === 'boss') { updateBoss(e, dt, pcx, pcy); continue; }
    if (e.type === 'chopper') { updateChopper(e, dt, pcx, pcy); continue; }     // enemy2.js
    if (e.type === 'sniper') { updateSniper(e, dt, pcx, pcy); continue; }       // enemy2.js
    if (e.type === 'bomber') { updateBomber(e, dt, pcx, pcy); continue; }       // enemy3.js
    if (e.type === 'monolet') { updateMonolet(e, dt, pcx, pcy); continue; }     // enemy4.js
    if (e.type === 'tplane') { updateTPlane(e, dt, pcx, pcy); continue; }       // enemy4.js
    if (e.type === 'swanzer' || e.type === 'mwanzer') { updateWanzerE(e, dt, pcx, pcy); continue; }   // enemy5.js
    if (e.type === 'shwanzer') { updateShieldWanzer(e, dt, pcx, pcy); continue; }   // enemy6.js
    if (e.type === 'jammer') { updateJammer(e, dt, pcx, pcy); continue; }           // enemy6.js
    if (e.type === 'repair') { updateRepair(e, dt, pcx, pcy); continue; }           // enemy6.js
    if (e.type === 'mortar') { updateMortar(e, dt, pcx, pcy); continue; }           // enemy7.js
    if (e.type === 'gatling') { updateGatling(e, dt, pcx, pcy); continue; }         // enemy7.js
    if (e.type === 'welder') { updateWelder(e, dt, pcx, pcy); continue; }           // enemy8.js
    if (e.type === 'minelayer') { updateMineLayer(e, dt, pcx, pcy); continue; }     // enemy8.js
    if (e.type === 'dropship') { updateDropship(e, dt, pcx, pcy); continue; }       // enemy7.js
    if (e.type === 'fighter') { updateFighter(e, dt, pcx, pcy); continue; }     // boss3.js (ลูกน้อง Giant Bomber)
    if (e.type === 'launcher' || e.type === 'swarmer') { updateLauncher(e, dt, pcx, pcy); continue; }   // enemy3.js

    // แรงผลักจากมิสไซล์ (ค่อยๆ ลดลง)
    if (e.kx) {
      e.x = clamp(e.x + e.kx * dt, 0, WORLD_W - e.w);
      e.kx *= Math.pow(0.01, dt);
      if (Math.abs(e.kx) < 5) e.kx = 0;
    }
    if (e.ky) {
      e.baseY = clamp(e.baseY + e.ky * dt, 70, GROUND_Y - 60);
      e.ky *= Math.pow(0.01, dt);
      if (Math.abs(e.ky) < 5) e.ky = 0;
    }

    // e.hunt = ศัตรูจากเวฟ: มุ่งเข้าหาผู้เล่นเสมอ (ไม่งั้นจะเดินวนอยู่ใกล้จุดเกิดที่อยู่นอกจอ)
    const dx = pcx - (e.x + e.w / 2);
    let vx;
    if (e.type === 'walker') {
      if (e.hunt || Math.abs(dx) < 520) {
        vx = Math.abs(dx) > 110 ? Math.sign(dx) * 55 : 0;
        e.dir = Math.sign(dx) || e.dir;
      } else {
        if (e.x < e.homeX - 120) e.dir = 1; else if (e.x > e.homeX + 120) e.dir = -1;
        vx = e.dir * 35;
      }
      e.x = clamp(e.x + vx * dt, 0, WORLD_W - e.w);
      e.y = GROUND_Y - e.h;
    } else if (e.type === 'tank') {
      // เดินช้ามาก หยุดยืนยิงเมื่อเข้าระยะ
      vx = Math.abs(dx) > TANK_STOP_DIST ? Math.sign(dx) * TANK_SPEED : 0;
      e.dir = Math.sign(dx) || e.dir;
      e.x = clamp(e.x + vx * dt, 0, WORLD_W - e.w);
      e.y = GROUND_Y - e.h;
      e.aim = Math.atan2(pcy - (e.y + 8), pcx - (e.x + e.w / 2));     // ป้อมปืนหมุนตามผู้เล่น
    } else {
      if (e.hunt || Math.abs(dx) < 650) {
        vx = Math.abs(dx) > 150 ? Math.sign(dx) * 75 : 0;
        e.dir = Math.sign(dx) || e.dir;
      } else {
        if (e.x < e.homeX - 160) e.dir = 1; else if (e.x > e.homeX + 160) e.dir = -1;
        vx = e.dir * 45;
      }
      e.x = clamp(e.x + vx * dt, 0, WORLD_W - e.w);
      if (e.riseTo !== undefined) {                       // โดรนที่เพิ่งออกจากฮัตช์บอส ค่อยๆ บินขึ้นสู่ความสูงปกติ
        e.baseY += (e.riseTo - e.baseY) * Math.min(1, dt * 2.5);
        if (Math.abs(e.riseTo - e.baseY) < 3) delete e.riseTo;
      }
      e.y = e.baseY + Math.sin(e.phase * 2.2) * 14;
    }

    // ยิงตอบเมื่ออยู่ในจอและอยู่ในระยะ
    e.fireCd -= dt;
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
    const onScreen = ex > cam - 20 && ex < cam + W + 20;
    const range = e.type === 'tank' ? 620 : (e.type === 'walker' ? 460 : 520);
    const canShoot = !player.dead && onScreen && Math.hypot(pcx - ex, pcy - ey) < range;

    if (e.type === 'tank') {
      // ปืนใหญ่: เมื่อพร้อมยิงจะ "ชาร์จ" ก่อน (ปากกระบอกเรืองแสง) แล้วค่อยปล่อยกระสุนลูกใหญ่
      if (canShoot && e.fireCd <= 0) {
        e.wind += dt;
        if (e.wind >= TANK_WINDUP) {
          const mx = ex + Math.cos(e.aim) * 36, my = e.y + 8 + Math.sin(e.aim) * 36;
          const a = Math.atan2(pcy - my, pcx - mx);
          enemyShots.push({
            x: mx, y: my, vx: Math.cos(a) * TANK_SHELL_SPEED, vy: Math.sin(a) * TANK_SHELL_SPEED,
            dmg: TANK_SHELL_DMG, life: 3.2, r: 7, big: true, shieldCost: TANK_SHIELD_COST
          });
          e.wind = 0;
          e.fireCd = TANK_FIRE_CD + Math.random() * 0.8;
          addShake(3);
          spawnSparks(mx, my, 8, '#ffb13b');
          smallBoom(mx, my, 12);
        }
      } else if (!canShoot) {
        e.wind = 0;
      }
    } else if (canShoot && e.fireCd <= 0) {
      const a = Math.atan2(pcy - ey, pcx - ex);
      const sp = e.type === 'walker' ? 300 : 330;
      enemyShots.push({ x: ex, y: ey, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: e.type === 'walker' ? 8 : 6, life: 2 });
      e.fireCd = (e.type === 'walker' ? 2.0 : 1.6) + Math.random() * 0.8;
      spawnSparks(ex + Math.cos(a) * 14, ey + Math.sin(a) * 14, 2, '#ff8a5c');
    }
  }
}

// ---------- วาด ----------
// รถถัง Heavy Tank: ตัวถังหนา ตีนตะขาบ ป้อมปืนหมุนตามผู้เล่น ปากกระบอกเรืองแสงตอนชาร์จ
function drawTank(e, sx, sy, flash) {
  const w = e.w;
  // ตีนตะขาบ
  ctx.fillStyle = '#1e1b19';
  ctx.fillRect(sx - 2, sy + 22, w + 4, 14);
  ctx.fillStyle = '#3a342f';
  const roll = (e.phase * 12) % 10;
  for (let i = 0; i < 7; i++) {
    const wx = sx + 4 + i * 9;
    ctx.beginPath(); ctx.arc(wx, sy + 29, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#4a4239';
  for (let x = -2 + roll; x < w + 2; x += 10) ctx.fillRect(sx + x, sy + 35, 5, 2);   // ฟันตีนตะขาบเคลื่อนที่

  // ตัวถัง
  ctx.fillStyle = flash ? '#ffffff' : '#6e5a3c';
  ctx.fillRect(sx, sy + 10, w, 16);
  ctx.strokeStyle = '#2e2416';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx + 1, sy + 11, w - 2, 14);
  ctx.fillStyle = flash ? '#ffffff' : '#85704a';          // แผ่นเกราะหน้า
  const front = e.dir > 0 ? sx + w - 14 : sx;
  ctx.fillRect(front, sy + 10, 14, 16);

  // ป้อมปืน + ลำกล้อง
  const tx = sx + w / 2, ty = sy + 8;
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(e.aim);
  ctx.fillStyle = '#2b2218';
  ctx.fillRect(0, -4, 36, 8);
  const charge = clamp(e.wind / TANK_WINDUP, 0, 1);
  ctx.fillStyle = charge > 0 ? 'rgba(255,' + Math.round(200 - 120 * charge) + ',60,' + (0.5 + 0.5 * charge) + ')' : '#8a8f7a';
  ctx.fillRect(30, -5, 8, 10);                            // ปากกระบอก (เรืองแสงเมื่อกำลังชาร์จ)
  ctx.restore();
  ctx.fillStyle = flash ? '#ffffff' : '#7d6844';
  ctx.beginPath(); ctx.arc(tx, ty, 11, Math.PI, 0); ctx.lineTo(tx + 11, ty + 6); ctx.lineTo(tx - 11, ty + 6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2e2416';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (charge > 0) {                                       // วงเตือนกระสุนกำลังจะออก
    ctx.globalAlpha = 0.35 + 0.4 * charge;
    ctx.strokeStyle = '#ff6a3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tx + Math.cos(e.aim) * 36, ty + Math.sin(e.aim) * 36, 6 + 14 * (1 - charge), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawEnemies() {
  for (const e of enemies) {
    const sx = e.x - cam, sy = e.y;
    if (sx < -100 || sx > W + 100) continue;
    const flash = e.flash > 0;
    let barY;

    if (e.type !== 'boss' && drawEnemyArt(e, sx, sy, flash)) {          // มีภาพวาดใน assets/enemies/ (enemyart.js)
      barY = sy - (ENEMY_ART[e.type] && ENEMY_ART[e.type].bar || ENEMY_BAR[e.type] || 14);
    } else if (e.type === 'walker') {
      const step = Math.sin(e.phase * 8) * 3;
      ctx.fillStyle = '#3a2420';
      ctx.fillRect(sx + 6, sy + e.h - 12 - Math.max(0, step), 9, 12);
      ctx.fillRect(sx + 23, sy + e.h - 12 - Math.max(0, -step), 9, 12);
      ctx.fillStyle = flash ? '#ffffff' : '#8a4338';
      ctx.fillRect(sx, sy, e.w, e.h - 10);
      ctx.strokeStyle = '#3a1d18';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, e.w - 2, e.h - 12);
      ctx.fillStyle = '#2b1a17';
      ctx.fillRect(e.dir > 0 ? sx + e.w - 2 : sx - 10, sy + 20, 12, 6);
      ctx.fillStyle = '#ff5a3c';
      ctx.fillRect(e.dir > 0 ? sx + e.w - 16 : sx + 6, sy + 8, 10, 5);
      barY = sy - 12;
    } else if (e.type === 'tank') {
      drawTank(e, sx, sy, flash);
      barY = sy - 22;
    } else if (e.type === 'chopper') {
      drawChopper(e, sx, sy, flash);
      barY = sy - 24;
    } else if (e.type === 'sniper') {
      drawSniper(e, sx, sy, flash);
      barY = sy - 14;
    } else if (e.type === 'bomber') {
      drawBomber(e, sx, sy, flash);
      barY = sy - 18;
    } else if (e.type === 'monolet') {
      drawMonolet(e, sx, sy, flash);
      barY = sy - 12;
    } else if (e.type === 'tplane') {
      drawTPlane(e, sx, sy, flash);
      barY = sy - 18;
    } else if (e.type === 'swanzer' || e.type === 'mwanzer') {
      drawWanzerE(e, sx, sy, flash);
      barY = sy - 16;
    } else if (e.type === 'shwanzer') {
      drawShieldWanzer(e, sx, sy, flash);
      barY = sy - 16;
    } else if (e.type === 'jammer') {
      drawJammer(e, sx, sy, flash);
      barY = sy - 18;
    } else if (e.type === 'repair') {
      drawRepair(e, sx, sy, flash);
      barY = sy - 14;
    } else if (e.type === 'mortar') {
      drawMortar(e, sx, sy, flash);
      barY = sy - 18;
    } else if (e.type === 'gatling') {
      drawGatling(e, sx, sy, flash);
      barY = sy - 18;
    } else if (e.type === 'welder') {
      drawWelder(e, sx, sy, flash);
      barY = sy - 14;
    } else if (e.type === 'minelayer') {
      drawMineLayer(e, sx, sy, flash);
      barY = sy - 18;
    } else if (e.type === 'dropship') {
      drawDropship(e, sx, sy, flash);
      barY = sy - 16;
    } else if (e.type === 'fighter') {
      drawFighter(e, sx, sy, flash);
      barY = sy - 12;
    } else if (e.type === 'launcher' || e.type === 'swarmer') {
      drawLauncher(e, sx, sy, flash);
      barY = sy - 24;
    } else if (e.type === 'boss') {
      drawBoss(e, sx, sy, flash);                         // หลอด HP ของบอสอยู่ที่ HUD (drawBossHud)
      continue;
    } else {
      const cx = sx + e.w / 2, cy = sy + e.h / 2;
      ctx.strokeStyle = '#9aa5ae';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const rw = 8 + Math.abs(Math.cos(e.phase * 30)) * 10;
      ctx.moveTo(cx - rw, sy - 5); ctx.lineTo(cx + rw, sy - 5);
      ctx.stroke();
      ctx.fillStyle = '#6b7680';
      ctx.fillRect(cx - 2, sy - 5, 4, 6);
      ctx.fillStyle = flash ? '#ffffff' : '#55616d';
      ctx.beginPath();
      ctx.ellipse(cx, cy, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2a3138';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ff5a3c';
      ctx.beginPath();
      ctx.arc(cx + e.dir * 6, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      barY = sy - 18;
    }

    if (untargetable(e)) continue;                        // ล่องหนอยู่: ไม่โชว์หลอด HP
    // HP bar เหนือหัวศัตรู
    const ratio = clamp(e.hp / e.maxHp, 0, 1);
    const bx = sx + e.w / 2 - 20;
    ctx.fillStyle = '#0f1316';
    ctx.fillRect(bx - 1, barY - 1, 42, 7);
    ctx.fillStyle = hpColor(ratio);
    ctx.fillRect(bx, barY, 40 * ratio, 5);
  }
  drawSights();                                           // เลเซอร์ไซต์แดงของสไนเปอร์ (วาดทับศัตรู)
}
