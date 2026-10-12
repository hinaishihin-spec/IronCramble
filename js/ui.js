'use strict';
/* ==========================================================================
   ui.js : ทุกอย่างที่เป็น "หน้าจอ UI" — HUD ระหว่างเล่น, หน้าเมนู, หน้าสรุปผล, ปุ่ม, เป้าเล็ง
   ไฟล์นี้วาดอย่างเดียว ไม่มีตรรกะเกม (ตรรกะอยู่ใน scenes.js และไฟล์อื่น)
   ========================================================================== */

const Fps = { count: 0, timer: 0, shown: 60 };
function tickFps(dt) {
  Fps.count++; Fps.timer += dt;
  if (Fps.timer >= 0.5) { Fps.shown = Math.round(Fps.count / Fps.timer); Fps.count = 0; Fps.timer = 0; }
}

function drawText(s, x, y, font, color, align) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.fillText(s, x, y);
  ctx.textAlign = 'left';
}

// ---------- เป้าเล็ง ----------
function drawCrosshair() {
  const x = mouse.x, y = mouse.y;
  ctx.strokeStyle = '#e0a526';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.moveTo(x - 15, y); ctx.lineTo(x - 5, y);
  ctx.moveTo(x + 5, y); ctx.lineTo(x + 15, y);
  ctx.moveTo(x, y - 15); ctx.lineTo(x, y - 5);
  ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 15);
  ctx.stroke();
}

// ---------- ปุ่ม (ใช้ทั้งหน้าเมนูและหน้าสรุปผล) ----------
function pointInRect(px, py, r) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }

function drawButton(b, hot) {
  const label = typeof b.label === 'function' ? b.label() : b.label;
  const off = typeof b.disabled === 'function' ? b.disabled() : b.disabled;
  if (off) {                                         // ปุ่มที่กดไม่ได้ (เช่น LAUNCH ของด่านที่ยังล็อก) สีหม่น
    ctx.fillStyle = '#171c21';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = hot ? '#59636d' : '#2a323a';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    drawText(label, b.x + b.w / 2, b.y + b.h / 2 + (b.primary ? 8 : 6), fnt(700, b.primary ? 22 : 16), '#56606a', 'center');
    return;
  }
  if (b.primary) {                                   // ปุ่มหลัก (เช่น LAUNCH) เติมสีเหลืองอำพัน
    ctx.fillStyle = hot ? '#f2b83a' : '#e0a526';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    drawText(label, b.x + b.w / 2, b.y + b.h / 2 + 8, fnt(700, 22), '#161a1e', 'center');
    if (b.hint) drawText(b.hint, b.x + b.w - 10, b.y + 15, fnt(600, 10), '#5a4710', 'right');
    return;
  }
  ctx.fillStyle = hot ? '#2b333b' : '#20262c';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = hot ? '#e0a526' : '#333c45';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  drawText(label, b.x + b.w / 2, b.y + b.h / 2 + (b.small ? 4 : 6), fnt(700, b.small ? 12 : 16), hot ? '#e0a526' : '#d9dfd2', 'center');
  if (b.hint && !b.small) drawText(b.hint, b.x + b.w - 10, b.y + 15, fnt(600, 10), '#8d978c', 'right');
}

// ---------- HUD ระหว่างเล่น ----------
function drawHUD() {
  ctx.font = "600 12px 'Chakra Petch', monospace";
  ctx.fillStyle = 'rgba(15,19,22,0.7)';
  ctx.fillRect(10, 10, 190, 62);
  ctx.fillStyle = '#e0a526';
  ctx.fillText('WANZER  UNIT-01', 20, 28);
  ctx.fillStyle = '#d9dfd2';
  ctx.fillText('DIST ' + Math.floor(player.x / 10) + ' m   ATK x' + atkMult().toFixed(2), 20, 46);
  ctx.fillText('SHOTS ' + run.shots + '   FPS ' + Fps.shown, 20, 62);

  // level progress bar
  const prog = player.x / (WORLD_W - player.w);
  ctx.fillStyle = 'rgba(15,19,22,0.7)';
  ctx.fillRect(W - 210, 10, 200, 14);
  ctx.fillStyle = '#6d7a47';
  ctx.fillRect(W - 207, 13, 194 * clamp(prog, 0, 1), 8);

  // จุดที่เวฟศัตรูจะโผล่: ขีดสีแดง = มีรถถัง, ขีดสีเหลือง = เวฟทั่วไป, ขีดหม่น = ออกมาแล้ว
  const waves = mission.def ? mission.def.waves : [];
  for (let i = 0; i < waves.length; i++) {
    const wx = W - 207 + 194 * clamp(waves[i].at * 10 / (WORLD_W - player.w), 0, 1);
    const hasTank = waves[i].units.some(function (u) { return u[0] === 'tank'; });
    ctx.fillStyle = i < mission.nextWave ? '#4a525a' : (hasTank ? '#e0583a' : '#e0a526');
    ctx.fillRect(wx - 1, 9, 2, 16);
  }
  if (mission.def && mission.def.boss) {              // จุดบอส: ขีดแดงหนา
    const bxp = W - 207 + 194 * clamp(mission.def.boss.at * 10 / (WORLD_W - player.w), 0, 1);
    ctx.fillStyle = '#ff4a30';
    ctx.fillRect(bxp - 2, 7, 4, 20);
  }
}

function drawBooster() {
  ctx.fillStyle = 'rgba(15,19,22,0.7)';
  ctx.fillRect(10, 78, 190, equippedGun().type === 'LASER' ? 78 : 58);
  ctx.font = "600 12px 'Chakra Petch', monospace";
  ctx.fillStyle = '#d9dfd2';
  ctx.fillText('BOOSTER', 20, 94);
  if (player.fuel <= 0.5) {
    ctx.fillStyle = '#e0583a';
    ctx.textAlign = 'right';
    ctx.fillText('EMPTY', 190, 94);
    ctx.textAlign = 'left';
  }
  ctx.fillStyle = '#0f1316';
  ctx.fillRect(20, 99, 170, 11);
  ctx.fillStyle = '#3fd16f';
  ctx.fillRect(21, 100, 168 * clamp(player.fuel / maxFuel(), 0, 1), 9);

  ctx.fillStyle = '#d9dfd2';
  ctx.fillText('DASH', 20, 126);
  ctx.fillStyle = '#0f1316';
  ctx.fillRect(58, 118, 132, 8);
  ctx.fillStyle = player.dashCd <= 0 ? '#e0a526' : '#6b6a52';
  ctx.fillRect(59, 119, 130 * (1 - clamp(player.dashCd / DASH_COOLDOWN, 0, 1)), 6);

  if (equippedGun().type === 'LASER') {              // เกจความร้อนของปืนเลเซอร์
    ctx.fillStyle = player.overheated ? '#e0583a' : '#d9dfd2';
    ctx.fillText(player.overheated ? 'OVERHEAT' : 'HEAT', 20, 146);
    ctx.fillStyle = '#0f1316';
    ctx.fillRect(90, 138, 100, 8);
    ctx.fillStyle = player.overheated ? '#e0583a' : '#ff6ad5';
    ctx.fillRect(91, 139, 98 * (player.heat / HEAT_MAX), 6);
  }
}

function drawObjective() {
  ctx.font = "600 12px 'Chakra Petch', monospace";
  ctx.textAlign = 'right';
  ctx.fillStyle = '#d9dfd2';
  ctx.fillText('ENEMY ' + run.kills + ' / ' + run.total + '  (เหลือ ' + enemies.length + ')', W - 12, 42);
  const nw = nextWaveDistance();
  const bossDef = mission.def.boss;
  let objLine, objColor = '#8d978c';
  if (mission.bossState !== 'none') { objLine = 'BOSS FIGHT'; objColor = '#ff6a4a'; }
  else if (nw >= 0) { objLine = 'NEXT WAVE ' + (mission.nextWave + 1) + ' / ' + mission.def.waves.length + '  @ ' + nw + ' m'; objColor = '#e0a526'; }
  else if (bossDef) { objLine = 'BOSS  @ ' + bossDef.at + ' m'; objColor = '#ff6a4a'; }
  else objLine = 'ALL WAVES SPAWNED';
  ctx.fillStyle = objColor;
  ctx.fillText(objLine, W - 12, 58);
  ctx.textAlign = 'left';

  if (mission.cleared && !player.dead) {
    drawText('AREA CLEAR', W / 2, 86, fnt(700, 22), '#e0a526', 'center');
    drawText('กำลังสรุปผลภารกิจ...', W / 2, 108, fnt(400, 13), '#d9dfd2', 'center');
  } else if (mission.banner > 0 && !player.dead) {        // ป้ายเตือนตอนเวฟใหม่โผล่
    const a = clamp(mission.banner / 0.4, 0, 1) * (0.7 + 0.3 * Math.sin(performance.now() / 70));
    ctx.globalAlpha = a;
    drawText(mission.bannerText, W / 2, 86, fnt(700, 20), '#e0583a', 'center');
    drawText('ศัตรูกำลังเข้ามาจากทางขวา', W / 2, 106, fnt(400, 12), '#d9dfd2', 'center');
    ctx.globalAlpha = 1;
  }
}

function drawTopBar() {
  const bh = 44;
  ctx.fillStyle = 'rgba(15,19,22,0.9)';
  ctx.fillRect(0, 0, W, bh);
  ctx.fillStyle = '#333c45';
  ctx.fillRect(0, bh, W, 1);
  ctx.font = "600 11px 'Chakra Petch', monospace";
  ctx.textAlign = 'left';

  // Player HP + Level + EXP
  const hpR = clamp(player.hp / maxHp(), 0, 1);
  ctx.fillStyle = '#8d978c';
  ctx.fillText('HP', 14, 16);
  ctx.fillStyle = '#e0a526';
  ctx.fillText('LV ' + profile.level, 36, 16);
  ctx.fillStyle = '#5aa9ff';
  ctx.fillText('EXP ' + profile.exp + '/' + expToNext(profile.level), 80, 16);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#d9dfd2';
  ctx.fillText(Math.ceil(player.hp) + ' / ' + maxHp(), 244, 16);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f1316';
  ctx.fillRect(14, 23, 230, 13);
  ctx.fillStyle = hpColor(hpR);
  ctx.fillRect(15, 24, 228 * hpR, 11);
  const xpR = clamp(profile.exp / expToNext(profile.level), 0, 1);
  ctx.fillStyle = '#0f1316';
  ctx.fillRect(14, 38, 230, 4);
  ctx.fillStyle = '#3d9bff';
  ctx.fillRect(14, 38, 230 * xpR, 4);

  // ช่องอาวุธ 2 ช่อง: คลิกซ้าย = ปืน, คลิกขวา (หรือ F) = มิสไซล์ ช่องที่กำลังยิงอยู่ไฮไลท์เขียว/ขาว
  const slotDefs = [
    { key: 'LMB', label: 'GUN', w: equippedGun(), sel: mouse.down && !player.shieldUp && !player.dead, x: 262 },
    { key: 'RMB', label: 'MISSILE  (F)', w: equippedMissile(), sel: missileHeld() && !player.shieldUp && !player.dead, x: 418 }
  ];
  for (const d of slotDefs) {
    ctx.fillStyle = d.sel ? '#2f8a4a' : '#20262c';
    ctx.fillRect(d.x, 8, 150, 32);
    ctx.strokeStyle = d.sel ? '#ffffff' : '#333c45';
    ctx.lineWidth = d.sel ? 2 : 1;
    ctx.strokeRect(d.x + 0.5, 8.5, 149, 31);
    ctx.fillStyle = d.sel ? '#ffffff' : '#161a1e';
    ctx.fillRect(d.x + 6, 14, 28, 20);
    ctx.fillStyle = d.sel ? '#1d5a30' : '#8d978c';
    ctx.textAlign = 'center';
    ctx.font = "700 10px 'Chakra Petch', monospace";
    ctx.fillText(d.key, d.x + 20, 28);
    ctx.textAlign = 'left';
    ctx.font = "600 9px 'Chakra Petch', monospace";
    ctx.fillStyle = d.sel ? '#d6f5de' : '#6f7a70';
    ctx.fillText(d.label + (d.key === 'LMB' ? '  ' + (WEAPON_TYPE_LABEL[d.w.type] || '') : ''), d.x + 40, 20);   // ช่องมิสไซล์ไม่ต้องบอกประเภทซ้ำ (ชื่อรุ่นบอกอยู่แล้ว)
    ctx.font = "700 11px 'Chakra Petch', monospace";
    ctx.fillStyle = d.sel ? '#ffffff' : '#8d978c';
    ctx.fillText(d.w.name, d.x + 40, 35);
  }

  // Shield gauge: กดค้างปุ่ม Q เพื่อกางโล่ (ไม่ใช่ช่องอาวุธ)
  ctx.fillStyle = player.shieldUp ? '#4fc3f7' : '#8d978c';
  ctx.font = "600 10px 'Chakra Petch', monospace";
  ctx.fillText('[Q] SHIELD', 578, 16);
  ctx.textAlign = 'right';
  ctx.fillStyle = player.shieldBroken ? '#e0583a' : '#d9dfd2';
  ctx.fillText(player.shieldBroken ? 'BROKEN' : Math.round(player.shield) + '%', 698, 16);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f1316';
  ctx.fillRect(578, 23, 120, 13);
  ctx.fillStyle = player.shieldBroken ? '#7b8794' : '#4fc3f7';
  ctx.fillRect(579, 24, 118 * (player.shield / SHIELD_MAX), 11);

  // Credits
  ctx.textAlign = 'right';
  ctx.font = "600 11px 'Chakra Petch', monospace";
  ctx.fillStyle = '#8d978c';
  ctx.fillText('CREDITS', W - 12, 16);
  ctx.font = "700 15px 'Chakra Petch', monospace";
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(String(profile.gold), W - 12, 35);
  ctx.textAlign = 'left';
}

function drawDeadOverlay() {
  ctx.fillStyle = 'rgba(15,19,22,0.6)';
  ctx.fillRect(0, 45, W, H);
  drawText('UNIT DESTROYED', W / 2, H / 2 - 4, fnt(700, 28), '#d9462f', 'center');
  drawText('กด R เพื่อลองภารกิจใหม่    Esc กลับเมนูหลัก', W / 2, H / 2 + 26, fnt(400, 14), '#d9dfd2', 'center');
}

// ---------- หน้าเมนูหลัก ----------
function drawMenuScreen(buttons, hover) {
  ctx.fillStyle = 'rgba(15,19,22,0.55)';
  ctx.fillRect(0, 0, W, H);

  drawText('WANZER', W / 2, 118, fnt(700, 64), '#e0a526', 'center');
  drawText('SIDE-SCROLLING MECHA ACTION', W / 2, 146, fnt(600, 13), '#8d978c', 'center');

  // การ์ดข้อมูลนักบิน (ข้อมูลจากเซฟ)
  const px = 200, py = 172, pw = 400, ph = 76;
  ctx.fillStyle = 'rgba(15,19,22,0.85)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#333c45';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  drawText('PILOT   SLOT ' + Save.slot, px + 16, py + 22, fnt(600, 11), '#8d978c');
  drawText('LV ' + profile.level, px + 16, py + 52, fnt(700, 26), '#e0a526');
  const need = expToNext(profile.level);
  drawText('EXP ' + profile.exp + ' / ' + need, px + 100, py + 40, fnt(600, 11), '#5aa9ff');
  ctx.fillStyle = '#0f1316';
  ctx.fillRect(px + 100, py + 46, 150, 6);
  ctx.fillStyle = '#3d9bff';
  ctx.fillRect(px + 100, py + 46, 150 * clamp(profile.exp / need, 0, 1), 6);
  drawText('CREDITS', px + pw - 16, py + 22, fnt(600, 11), '#8d978c', 'right');
  drawText(String(profile.gold), px + pw - 16, py + 46, fnt(700, 22), '#ffd23f', 'right');
  drawText('MISSIONS CLEARED ' + profile.missions, px + pw - 16, py + 66, fnt(600, 10), '#8d978c', 'right');

  const m = currentMission();                         // ด่านที่จะได้เล่นต่อ (ด่านล่าสุดที่ปลดล็อก)
  drawText('NEXT: ' + m.name, W / 2, 280, fnt(600, 13), '#d9dfd2', 'center');
  drawText('ทำลายศัตรูทั้งหมด (' + missionSummaryText(m) + ')  |  ความยาว ' + m.lengthM + ' m', W / 2, 298, fnt(400, 12), '#8d978c', 'center');

  for (let i = 0; i < buttons.length; i++) drawButton(buttons[i], i === hover);

  if (!Save.usable) {
    drawText('เบราว์เซอร์นี้เซฟอัตโนมัติไม่ได้ ความคืบหน้าจะหายเมื่อรีเฟรชหน้า', W / 2, 438, fnt(400, 12), '#e0583a', 'center');
  } else {
    drawText('เซฟอัตโนมัติลง SLOT ' + Save.slot + '  (เปลี่ยนช่อง/สำรองไฟล์ที่ SAVE SLOTS)', W / 2, 438, fnt(400, 12), '#8d978c', 'center');
  }
}

// ---------- หน้าสรุปผลภารกิจ ----------
function formatTime(sec) {
  const s = Math.floor(sec);
  return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
}

function drawCompleteScreen(sum, t, buttons, hover) {
  ctx.fillStyle = 'rgba(15,19,22,0.78)';
  ctx.fillRect(0, 0, W, H);

  const px = 150, py = 18, pw = 500, ph = 346;
  ctx.fillStyle = 'rgba(22,26,30,0.95)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#e0a526';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);

  drawText('MISSION COMPLETE', W / 2, py + 44, fnt(700, 30), '#e0a526', 'center');
  drawText(sum.name + (sum.bossName ? '   |   BOSS DEFEATED: ' + sum.bossName : ''), W / 2, py + 66, fnt(600, 11), sum.bossName ? '#e0a526' : '#8d978c', 'center');

  const leveled = sum.levelTo > sum.levelFrom;
  const rows = [
    ['ENEMIES DESTROYED', sum.kills + ' / ' + sum.total, null],
    ['CLEAR TIME', formatTime(sum.time), null],
    ['EXP GAINED', '+' + countUp(sum.exp, t, 2), '(รวมโบนัสจบภารกิจ +' + sum.bonusExp + ')'],
    ['CREDITS GAINED', '+' + countUp(sum.gold, t, 3), '(รวมโบนัสจบภารกิจ +' + sum.bonusGold + (sum.bossGold ? '  /  รางวัลบอส +' + sum.bossGold : '') + ')'],
    ['LEVEL', leveled ? 'LV ' + sum.levelFrom + '  >  LV ' + sum.levelTo : 'LV ' + sum.levelTo, leveled ? 'LEVEL UP!' : null],
    ['TOTAL CREDITS', String(profile.gold), null]
  ];
  for (let i = 0; i < rows.length; i++) {
    const start = 0.3 + i * 0.22;
    if (t < start) break;
    ctx.globalAlpha = clamp((t - start) / 0.2, 0, 1);
    const y = py + 96 + i * 35;
    drawText(rows[i][0], px + 36, y, fnt(600, 12), '#8d978c');
    const vColor = i === 2 ? '#5aa9ff' : (i === 3 || i === 5 ? '#ffd23f' : '#d9dfd2');
    drawText(rows[i][1], px + pw - 36, y, fnt(700, 16), vColor, 'right');
    if (rows[i][2]) {
      const sub = rows[i][2];
      drawText(sub, px + 36, y + 14, fnt(400, 10), sub === 'LEVEL UP!' ? '#ffd23f' : '#6f7a70');
    }
    ctx.globalAlpha = 1;
  }

  // แถบ EXP ปัจจุบัน
  if (t > 0.3 + rows.length * 0.22) {
    const need = expToNext(profile.level);
    const by = py + ph - 22;
    drawText('EXP ' + profile.exp + ' / ' + need, px + 36, by - 6, fnt(600, 10), '#5aa9ff');
    ctx.fillStyle = '#0f1316';
    ctx.fillRect(px + 36, by, pw - 72, 6);
    ctx.fillStyle = '#3d9bff';
    ctx.fillRect(px + 36, by, (pw - 72) * clamp(profile.exp / need, 0, 1), 6);
  }

  // แจ้งเมื่อการเคลียร์ครั้งนี้ปลดล็อกด่านใหม่
  if (sum.unlockedName && t > 0.3 + rows.length * 0.22) {
    const pulse = 0.75 + 0.25 * Math.sin(t * 6);
    ctx.globalAlpha = pulse;
    drawText('NEW MISSION UNLOCKED  >  ' + sum.unlockedName, W / 2, py + ph + 18, fnt(700, 13), '#5fd36f', 'center');
    ctx.globalAlpha = 1;
  }

  for (let i = 0; i < buttons.length; i++) drawButton(buttons[i], i === hover);
}

// ตัวเลขวิ่งขึ้นจาก 0 ถึงค่าจริง (rowIndex ใช้หาเวลาเริ่มของแถวนั้น)
function countUp(v, t, rowIndex) {
  const start = 0.3 + rowIndex * 0.22 + 0.1;
  return Math.round(v * clamp((t - start) / 0.7, 0, 1));
}

// ---------- หน้า Hangar (อู่ซ่อม / ร้านค้า) ----------
// โมเดลหุ่นขนาดใหญ่: s = ขนาด (1 = เท่าในเกม) หน้าตาเปลี่ยนตามเลเวลอัปเกรดที่ซื้อไว้
function drawMechModel(cx, cy, s, angle, t) {
  const bare = HangarScene.hideWeapons;               // ปุ่ม 'ถอดอาวุธ': ดูหุ่นเปล่า แขนห้อยลง ไม่มีปืนและพอด
  if (bare) angle = Math.PI / 2;
  if (artMode()) {                                    // โหมดภาพ: วางเท้าที่แท่น (y=268) ขยาย 2.4 เท่า
    const k = 2.4, feetY = 266;
    const lr = legRig(), ap = { x: cx + (RIG.ARMS.at[0] + lr.hipX) * k, y: feetY - (RIG.ARMS.at[1] + lr.hip - 33) * k };
    drawMechArt(cx, feetY, k, true, bare ? Math.PI / 2 : Math.atan2(mouse.y - ap.y, mouse.x - ap.x), POD_REST, false, false, bare);
    return;
  }
  const bw = 40 * s, bh = 40 * s;
  const x = cx - bw / 2, y = cy - bh / 2;
  // หน้าตาโมเดลตามระดับพาร์ทที่สวม: ลำตัว+หัว -> แผ่นเกราะเสริม, แพ็กหลัง -> ถังไอพ่นและเปลวไฟ
  const al = partTier('HEAD', profile.equippedParts.HEAD) + partTier('BODY', profile.equippedParts.BODY);
  const vl = partTier('BACKPACK', profile.equippedParts.BACKPACK) * 2;

  // เปลวไอพ่นใต้เครื่อง (ยิ่งอัปเกรด Vernier ยิ่งยาว)
  const flick = 0.8 + 0.2 * Math.sin(t * 22);
  const flameH = (3 + 0.9 * vl) * s * flick;
  const nozzleY = y + bh + 5 * s;
  for (const nx of [x + 6 * s, x + 25 * s]) {
    const g = ctx.createLinearGradient(0, nozzleY, 0, nozzleY + flameH);
    g.addColorStop(0, 'rgba(143,227,176,0.9)');
    g.addColorStop(1, 'rgba(143,227,176,0)');
    ctx.fillStyle = g;
    ctx.fillRect(nx + 1 * s, nozzleY, 7 * s, flameH);
  }
  ctx.fillStyle = '#2b3022';
  ctx.fillRect(x + 6 * s, y + bh, 9 * s, 5 * s);
  ctx.fillRect(x + 25 * s, y + bh, 9 * s, 5 * s);

  // ตัวหุ่น 4 ส่วน สีตามซีรีส์ของพาร์ทที่สวม (เลย์เอาต์เดียวกับ drawPlayer ในด่าน หันขวา)
  const box = function (c, bx, by, w, h) {
    ctx.fillStyle = c; ctx.fillRect(x + bx * s, y + by * s, w * s, h * s);
    ctx.strokeStyle = '#161a1e'; ctx.lineWidth = 2 * s;
    ctx.strokeRect(x + (bx + 1) * s, y + (by + 1) * s, (w - 2) * s, (h - 2) * s);
  };
  box(partColor('BACKPACK'), -9 - vl * 0.6, 10, 9 + vl * 0.6, 20);
  box(partColor('LEGS'), 4, 28, 12, 12);
  box(partColor('LEGS'), 24, 28, 12, 12);
  box(partColor('BODY'), 0, 12, 40, 16);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x + 5 * s, y + 19 * s, 30 * s, 6 * s);
  box(partColor('HEAD'), 10, 0, 20, 12);
  ctx.fillStyle = '#e0a526';
  ctx.fillRect(x + 19 * s, y + 4 * s, 10 * s, 3 * s);

  // แขนปืน ชี้ตามเมาส์
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = partColor('ARMS');
  ctx.fillRect(0, -5 * s, GUN_LEN * s, 10 * s);
  ctx.strokeStyle = '#161a1e'; ctx.lineWidth = 1.5 * s; ctx.strokeRect(0, -5 * s, GUN_LEN * s, 10 * s);
  ctx.fillStyle = '#8a8f7a';
  ctx.fillRect((GUN_LEN - 8) * s, -3 * s, 8 * s, 6 * s);
  if (!bare && equippedGun().type === 'LASER') {     // ติดลำกล้องเลเซอร์เมื่อสวมปืนเลเซอร์
    ctx.fillStyle = '#ff6ad5';
    ctx.fillRect((GUN_LEN - 16) * s, -3.5 * s, 7 * s, 7 * s);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect((GUN_LEN - 3) * s, -1.5 * s, 3 * s, 3 * s);
  }
  ctx.restore();
  ctx.fillStyle = partColor('ARMS');
  ctx.beginPath();
  ctx.arc(cx, cy, 6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#161a1e'; ctx.lineWidth = 2 * s; ctx.stroke();
  drawShoulder(x, y, s, 1, false);                    // เกราะไหล่ + มิสไซล์พอดบนหลังคาไหล่ (ท่าพัก)
  if (!bare) drawMissilePod(podPivot(x, y, s, 1), s, POD_REST, false, false);
}

function drawHangarBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0e1317');
  g.addColorStop(1, '#1b232a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#141b21';                          // เสาโครงอู่
  for (let i = 0; i < 6; i++) ctx.fillRect(40 + i * 150, 46, 8, 290);
  ctx.fillStyle = '#0b0f12';                          // พื้นอู่ + เส้นตาราง
  ctx.fillRect(0, 336, W, H - 336);
  ctx.strokeStyle = 'rgba(224,165,38,0.12)';
  ctx.lineWidth = 1;
  for (const gy of [346, 360, 380, 408]) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
}

// ปุ่มเลือกประเภทปืนในแท็บปืน (จุดเหลืองหน้าชื่อ = ประเภทที่มีปืนสวมอยู่)
function drawSubChip(t, hot, active) {
  ctx.fillStyle = active ? '#5a4710' : (hot ? '#2b333b' : '#1a2026');
  ctx.fillRect(t.x, t.y, t.w, t.h);
  ctx.strokeStyle = active ? '#e0a526' : (hot ? '#59636d' : '#333c45');
  ctx.lineWidth = 1.5;
  ctx.strokeRect(t.x + 1, t.y + 1, t.w - 2, t.h - 2);
  drawText('[' + t.key + '] ' + WEAPON_TYPE_LABEL[t.sub], t.x + t.w / 2, t.y + 14, fnt(700, 10), active ? '#ffd23f' : '#d9dfd2', 'center');
  if (equippedGun().type === t.sub) { ctx.fillStyle = '#5fd36f'; ctx.fillRect(t.x + t.w - 9, t.y + 6, 4, 4); }
}

// แถวอาวุธ 1 กระบอกแบบกะทัดรัด (กล่อง h=22): ชื่อ + ประเภท + สเตตัส + สถานะ (สวมอยู่ / มีแล้ว / ราคา)
function drawWeaponRow(c, hot) {
  const w = c.wp, st = weaponState(w.id);
  const canAct = st === 'buy' || st === 'owned';
  ctx.fillStyle = st === 'equipped' ? '#1f2a1d' : (hot ? '#222a31' : '#1a2026');
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.strokeStyle = st === 'equipped' ? '#5fd36f' : (hot ? (canAct ? '#e0a526' : '#59636d') : '#333c45');
  ctx.lineWidth = 2;
  ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
  const ty = c.y + c.h / 2 + 4;
  if (c.key) drawText('[' + c.key + ']', c.x + 8, ty, fnt(600, 10), '#6f7a70');
  drawText(w.name, c.x + 32, ty, fnt(700, 12), st === 'poor' ? '#a8873a' : '#e0a526');
  drawText(weaponTypeText(w), c.x + 138, ty, fnt(600, 10), w.id.indexOf('borz') === 0 ? '#ffd23f' : '#8d978c');
  drawText(weaponStatsText(w), c.x + 190, ty, fnt(400, 10), '#b3bbb0');
  const rx = c.x + c.w - 10;
  if (st === 'equipped') drawText('EQUIPPED', rx, ty, fnt(700, 11), '#5fd36f', 'right');
  else if (st === 'owned') drawText('OWNED · สวม', rx, ty, fnt(700, 11), '#d9dfd2', 'right');
  else drawText(w.price + ' CR', rx, ty, fnt(700, 12), st === 'buy' ? '#ffd23f' : '#7d6d33', 'right');
}

// แท็บหมวดชิ้นส่วน (หัว/ลำตัว/แขน/ขา/แพ็กหลัง/อาวุธ)
function drawPartTab(t, hot, active) {
  ctx.fillStyle = active ? '#e0a526' : (hot ? '#2b333b' : '#1a2026');
  ctx.fillRect(t.x, t.y, t.w, t.h);
  ctx.strokeStyle = active ? '#e0a526' : (hot ? '#59636d' : '#333c45');
  ctx.lineWidth = 2;
  ctx.strokeRect(t.x + 1, t.y + 1, t.w - 2, t.h - 2);
  const label = t.tab === 'GUN' ? 'ปืน' : (t.tab === 'MISSILE' ? 'มิสไซล์' : PART_CAT_LABEL[t.tab]);
  drawText(label, t.x + t.w / 2, t.y + 19, fnt(700, 10), active ? '#161a1e' : '#d9dfd2', 'center');
  drawText(t.key, t.x + 6, t.y + 10, fnt(600, 8), active ? '#5a4710' : '#6f7a70');
}

// การ์ดชิ้นส่วน 1 ชิ้น: ชื่อ + สเตตัส + สถานะ (สวมอยู่ / มีแล้ว กดเพื่อสวม / ราคา)
function drawPartCard(c, hot) {
  const st = partState(c.cat, c.part.id);
  const canAct = st === 'buy' || st === 'owned';
  ctx.fillStyle = st === 'equipped' ? '#1f2a1d' : (hot ? '#222a31' : '#1a2026');
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.strokeStyle = st === 'equipped' ? '#5fd36f' : (hot ? (canAct ? '#e0a526' : '#59636d') : '#333c45');
  ctx.lineWidth = 2;
  ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
  drawText('[' + c.key + ']', c.x + 12, c.y + 19, fnt(600, 11), '#6f7a70');
  drawText(PART_CAT_LABEL[c.cat] + '  ' + c.part.name, c.x + 36, c.y + 19, fnt(700, 13), st === 'poor' ? '#a8873a' : '#e0a526');
  drawText(partStatsText(c.cat, c.part), c.x + 36, c.y + 36, fnt(400, 11), '#b3bbb0');
  const rx = c.x + c.w - 14;
  if (st === 'equipped') drawText('EQUIPPED', rx, c.y + 27, fnt(700, 14), '#5fd36f', 'right');
  else if (st === 'owned') {
    drawText('OWNED', rx, c.y + 19, fnt(700, 14), '#d9dfd2', 'right');
    drawText('คลิกเพื่อสวม', rx, c.y + 35, fnt(600, 10), '#5fd36f', 'right');
  } else {
    drawText(c.part.price + ' CR', rx, c.y + 19, fnt(700, 15), st === 'buy' ? '#ffd23f' : '#7d6d33', 'right');
    drawText(st === 'buy' ? 'คลิกเพื่อซื้อและสวม' : 'ขาดอีก ' + (c.part.price - profile.gold), rx, c.y + 35, fnt(600, 10), st === 'buy' ? '#5fd36f' : '#e0583a', 'right');
  }
}

function drawHangarScreen(h) {
  drawHangarBackground();

  // หัวหน้าจอ
  ctx.fillStyle = 'rgba(15,19,22,0.92)';
  ctx.fillRect(0, 0, W, 46);
  ctx.fillStyle = '#333c45';
  ctx.fillRect(0, 46, W, 1);
  drawText('HANGAR', 24, 33, fnt(700, 24), '#e0a526');
  drawText('อู่ซ่อมและร้านค้า  |  PILOT LV ' + profile.level, 148, 31, fnt(400, 12), '#8d978c');
  drawText('CREDITS', W - 24, 18, fnt(600, 10), '#8d978c', 'right');
  drawText(String(profile.gold), W - 24, 38, fnt(700, 20), '#ffd23f', 'right');

  // โมเดลหุ่น
  const mx = 24, my = 58, mw = 316, mh = 268;
  ctx.fillStyle = 'rgba(15,19,22,0.85)';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#333c45';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);
  drawText('WANZER  UNIT-01', mx + 14, my + 22, fnt(700, 12), '#e0a526');
  const mcx = mx + mw / 2, mcy = 160 + Math.sin(h.t * 2) * 3;
  const glow = ctx.createRadialGradient(mcx, mcy, 10, mcx, mcy, 130);
  glow.addColorStop(0, 'rgba(224,165,38,0.16)');
  glow.addColorStop(1, 'rgba(224,165,38,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#242c33';                          // แท่นวางหุ่น
  ctx.fillRect(mcx - 100, 268, 200, 8);
  ctx.fillStyle = '#1a2026';
  ctx.fillRect(mcx - 120, 276, 240, 8);
  drawMechModel(mcx, mcy, 3.2, Math.atan2(mouse.y - mcy, mouse.x - mcx), h.t);
  if (h.flash > 0) {                                  // วงแหวนตอนซื้อสำเร็จ
    ctx.globalAlpha = h.flash / 0.5;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mcx, mcy, 70 + (1 - h.flash / 0.5) * 60, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  drawText('MAX HP ' + maxHp() + '   ATK x' + partsDamageMult().toFixed(2) + '   SPEED x' + partsSpeedMult().toFixed(2), mx + 14, my + mh - 50, fnt(600, 11), '#d9dfd2');
  drawText('BOOST x' + partsBoostMult().toFixed(2) + '   บินได้ ' + flightSeconds().toFixed(1) + ' วิ   รีชาร์จ x' + partsEnergyMult().toFixed(2) + '', mx + 14, my + mh - 37, fnt(400, 10), '#8d978c');
  const ow = isOverweight();
  drawText('น้ำหนัก ' + calculateTotalWeight() + ' / ' + partsMaxLoad() + (ow ? '  OVERWEIGHT' : ''), mx + mw - 14, my + 22, fnt(700, 11), ow ? '#e0583a' : '#8d978c', 'right');
  // อาวุธที่ติดตั้ง 2 ช่อง
  drawText('1 ปืน: ' + equippedGun().name + '   2 มิสไซล์: ' + equippedMissile().name, mx + 14, my + mh - 21, fnt(600, 10), '#d9dfd2');
  drawText('น้ำหนักอาวุธ ' + weaponsWeight(), mx + 14, my + mh - 8, fnt(400, 10), '#8d978c');

  // การ์ดอัปเกรด + ปุ่ม
  for (let i = 0; i < h.items.length; i++) {
    const it = h.items[i];
    if (it.tab) drawPartTab(it, i === h.hover, it.tab === h.tab);
    else if (it.part) drawPartCard(it, i === h.hover);
    else if (it.wp) drawWeaponRow(it, i === h.hover);
    else if (it.sub) drawSubChip(it, i === h.hover, it.sub === h.sub);
    else drawButton(it, i === h.hover);
  }
  drawMissionSelector(214, 346, 276, 50);

  // ข้อมูลด่านที่เลือก
  const sm = MISSIONS[selectedMission];
  const unlocked = missionUnlocked(selectedMission);
  if (isOverweight()) {
    drawText('OVERWEIGHT: น้ำหนักรวม ' + calculateTotalWeight() + ' เกินที่รับได้ ' + partsMaxLoad() + '  เปลี่ยนลำตัว/ขา/แพ็กหลังหรือถอดพาร์ทก่อนออกรบ', W / 2, 411, fnt(700, 11), '#e0583a', 'center');
  } else if (unlocked) {
    drawText('ศัตรู: ' + missionSummaryText(sm) + '    รางวัลจบด่าน +' + sm.bonusExp + ' EXP  +' + sm.bonusGold + ' CR', W / 2, 411, fnt(400, 11), '#8d978c', 'center');
  } else {
    drawText('ปลดล็อกเมื่อเคลียร์ภารกิจครบ ' + sm.unlockAt + ' ครั้ง (ตอนนี้ ' + profile.missions + ')', W / 2, 411, fnt(600, 11), '#e0583a', 'center');
  }

  if (h.msgT > 0) {
    ctx.globalAlpha = clamp(h.msgT / 0.5, 0, 1);
    drawText(h.msg, W / 2, 427, fnt(700, 13), h.msgOk ? '#5fd36f' : '#e0583a', 'center');
    ctx.globalAlpha = 1;
  }
  drawText('1-8 เปลี่ยนหมวด   Q W E R T Y U I O P / คลิก = ซื้อและสวม   Z X C V = ประเภทปืน   H = ถอด/ใส่อาวุธ (ดูหุ่นเปล่า)   A / D เลือกด่าน   Enter = LAUNCH   Esc = เมนูหลัก', W / 2, 442, fnt(400, 11), '#6f7a70', 'center');
}

// ตัวเลือกด่านระหว่างปุ่มลูกศรสองข้าง (ปุ่ม < > เป็นรายการใน HangarScene.items)
function drawMissionSelector(x, y, w, h) {
  const m = MISSIONS[selectedMission];
  const unlocked = missionUnlocked(selectedMission);
  const ax = x + 38, aw = w - 76;                       // พื้นที่ตรงกลางระหว่างลูกศร
  ctx.fillStyle = '#1a2026';
  ctx.fillRect(ax, y, aw, h);
  ctx.strokeStyle = unlocked ? '#333c45' : '#4a2a26';
  ctx.lineWidth = 2;
  ctx.strokeRect(ax + 1, y + 1, aw - 2, h - 2);
  drawText('MISSION ' + ('0' + m.id).slice(-2), ax + aw / 2, y + 20, fnt(700, 14), unlocked ? '#e0a526' : '#8a6a5f', 'center');
  drawText(unlocked ? m.title + '   ' + m.lengthM + ' m' : 'LOCKED', ax + aw / 2, y + 38, fnt(600, 11), unlocked ? '#d9dfd2' : '#e0583a', 'center');
  for (let i = 0; i < MISSIONS.length; i++) {            // จุดบอกลำดับด่าน
    ctx.fillStyle = i === selectedMission ? '#e0a526' : (missionUnlocked(i) ? '#59636d' : '#2a323a');
    ctx.fillRect(ax + aw / 2 - MISSIONS.length * 7 + i * 14 + 1, y + h - 8, 10, 3);
  }
}
