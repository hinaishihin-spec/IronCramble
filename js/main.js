'use strict';
/* ==========================================================================
   main.js : จุดเริ่มต้นของเกม — เปิดฉากแรก และวนลูปเกม (game loop)
   ไฟล์นี้ต้องถูกโหลดเป็นไฟล์สุดท้ายใน index.html

   ตัวกันค้าง: ถ้าโค้ดส่วนไหน error เกมจะไม่หยุดวนลูปอีกต่อไป แต่แสดงแถบแดงบอกชื่อ error ที่ด้านบนจอ
   และตัวตรวจไฟล์: ตอนเปิดเกมจะเช็กว่าไฟล์ .js สำคัญครบไหม (กรณีอัปโหลดแพตช์ไม่ครบ) แล้วบอกชื่อไฟล์ที่ขาด
   ========================================================================== */

let lastTime = performance.now();

// สิ่งที่ต้องมี: [ไฟล์, ชื่อที่ไฟล์นั้นประกาศไว้]  ขาดอันไหน = ไฟล์นั้นไม่ได้โหลด (ไม่อยู่ใน index.html / ไม่ได้อัปโหลด / เป็นรุ่นเก่า)
const REQUIRED_SYMBOLS = [
  ['config.js', 'TPLANE_REVEAL'], ['config.js', 'MONO_W'], ['parts.js', 'WANZER_PARTS'], ['partext.js', 'partLock'], ['series_zeus.js', 'WANZER_PARTS'],
  ['crouch.js', 'updateCrouch'], ['weapondb.js', 'WEAPON_DATABASE'], ['save.js', 'Save'], ['input.js', 'keys'],
  ['player.js', 'updatePlayer'], ['enemy.js', 'updateEnemies'], ['enemy2.js', 'updateSniper'], ['enemy3.js', 'updateBomber'],
  ['enemy4.js', 'makeMonolet'], ['enemy5.js', 'makeShotWanzer'], ['enemy4.js', 'untargetable'], ['boss3.js', 'makeGiantBomber'], ['boss4.js', 'makeMimic'], ['boss5.js', 'makeCarrier'], ['boss6.js', 'makeMegaBolt'], ['drone.js', 'updateDrones'], ['enemyart.js', 'drawEnemyArt'], ['scenery.js', 'sceneImage'],
  ['weapons.js', 'fireWeapon'], ['strike.js', 'startStrike'], ['missions.js', 'MISSIONS'], ['mission.js', 'updateGame'], ['ui.js', 'drawHUD'],
  ['hangar.js', 'HangarScene'], ['saves.js', 'SaveScene'], ['scenes.js', 'Scenes'], ['gamepad.js', 'pollGamepad'], ['audio.js', 'sfxUpdate']
];
const problems = [];
for (const r of REQUIRED_SYMBOLS) {
  let t = 'undefined';
  try { t = new Function('return typeof ' + r[1])(); } catch (e) { }
  if (t === 'undefined' && problems.indexOf(r[0]) < 0) problems.push(r[0]);
}
if (!problems.length) {                                    // ไฟล์ครบ แต่ยังเป็นรุ่นเก่า: เช็กว่า missions.js มีด่าน 6 หรือไม่
  try { if (MISSIONS.length < 8 || !MISSIONS[5].boss) problems.push('missions.js (รุ่นเก่า ไม่มีด่าน 8/บอสด่าน 6)'); } catch (e) { }
}

let lastErr = null, errT = 0;
function guard(name, fn, a) {
  try { fn(a); } catch (e) {
    lastErr = name + ': ' + (e && e.message ? e.message : e); errT = 4;
    if (!guard.logged || guard.logged !== lastErr) { guard.logged = lastErr; console.error(e); }
  }
}

function drawProblems() {
  const lines = [];
  if (problems.length) {
    lines.push('ไฟล์เกมไม่ครบ/ไม่ใช่รุ่นล่าสุด: ' + problems.join(', '));
    lines.push('ตรวจว่าอัปโหลดแพตช์ครบ และ index.html มี <script src="js/…"> ของไฟล์เหล่านี้');
  }
  if (errT > 0 && lastErr) lines.push('ERROR  ' + lastErr + '   (กด F12 ดู Console)');
  if (!lines.length) return;
  ctx.save();
  ctx.fillStyle = 'rgba(120,20,20,0.92)';
  ctx.fillRect(0, 0, W, 14 + lines.length * 16);
  ctx.fillStyle = '#ffffff';
  ctx.font = "12px 'Chakra Petch', 'Noto Sans Thai', sans-serif";
  ctx.textAlign = 'left';
  lines.forEach(function (s, i) { ctx.fillText(s.length > 130 ? s.slice(0, 127) + '...' : s, 8, 18 + i * 16); });
  ctx.restore();
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);   // จำกัด dt กันเกมกระโดดเมื่อแท็บถูกพักไว้
  lastTime = now;
  if (errT > 0) errT -= dt;
  guard('tickFps', tickFps, dt);
  if (typeof pollGamepad === 'function') guard('pollGamepad', pollGamepad, dt);   // จอยเกมแพด: เขียนสถานะลง keys/mouse ก่อนอัปเดตฉาก
  guard('update', function (d) { Scenes.update(d); }, dt);
  if (typeof sfxUpdate === 'function') guard('sfxUpdate', sfxUpdate, dt);        // ระบบเสียง (audio.js)
  guard('render', function () { Scenes.render(); });
  drawProblems();
  requestAnimationFrame(frame);
}

Scenes.go('menu');
requestAnimationFrame(frame);
