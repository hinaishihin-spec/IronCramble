'use strict';
/* ==========================================================================
   gamepad.js : จอยเกมแพด (Gamepad API, มาตรฐาน Xbox / PlayStation / Steam Deck)
   หลักการ: จอยไม่แตะโค้ดเกมเลย แต่ "เขียนสถานะลง keys / mouse" ตัวเดียวกับที่คีย์บอร์ดและเมาส์ใช้
   และส่ง Scenes.keydown / Scenes.mousedown ให้เหมือนกดปุ่มจริง  จึงเล่นสลับคีย์บอร์ด+เมาส์ได้ทันที

   ปุ่มระหว่างเล่น
     สติ๊กซ้าย / D-pad ซ้าย-ขวา  เดิน        สติ๊กขวา  เล็ง 360°
     A (หรือ D-pad ขึ้น)         กระโดด / กดค้างเพื่อบิน
     B หรือ RB                   พุ่งตัว Dash (ดันสติ๊กซ้ายไปทิศที่จะพุ่งด้วย)
     LB                          กางโล่ (กดค้าง)
     RT                          ยิงปืน         LT หรือ X  ยิงมิสไซล์
     Y / A (ตอนหุ่นพัง)          ลองใหม่        Back/Select  กลับเมนู
   ปุ่มในเมนู / Hangar / เซฟ
     สติ๊กซ้าย  ขยับเคอร์เซอร์   D-pad  กระโดดไปปุ่มถัดไปตามทิศ   A  คลิก
     B  ย้อนกลับ (Esc)   Start  ยืนยัน (Enter / LAUNCH)
     LB / RB  เปลี่ยนหมวดใน Hangar   LT / RT  เลือกด่าน   Y  ถอด/ใส่อาวุธพรีวิว
   ========================================================================== */

const PAD = {
  DEAD: 0.25,            // โซนไม่ตอบสนองของสติ๊ก (กันสติ๊กดริฟต์)
  AIM_R: 160,            // ระยะเป้าเล็งจากหัวไหล่หุ่น (พิกเซล)
  CURSOR_SPEED: 430,     // ความเร็วเคอร์เซอร์ในเมนู (พิกเซล/วินาที)
  active: false,         // เคยมีจอยต่อและกดอยู่
  prev: [],              // สถานะปุ่มเฟรมก่อน (ไว้จับจังหวะกด)
  held: {},              // keys ที่จอยเป็นคนกดอยู่ (ปล่อยเองเมื่อจอยปล่อย ไม่ไปลบของคีย์บอร์ด)
  fire: false, missile: false,
  aimX: 1, aimY: 0, aiming: false,
  lastScene: null,
  toast: '', toastT: 0,
  err: '', id: '', mapping: '', lastBtn: -1, lastBtnT: 0
};

function padGet() {
  if (!navigator.getGamepads) { PAD.err = 'no-api'; return null; }
  let list;
  try { list = navigator.getGamepads(); } catch (e) { PAD.err = 'blocked'; return null; }   // อยู่ใน iframe ที่ไม่อนุญาตจอย
  PAD.err = '';
  for (let i = 0; i < list.length; i++) if (list[i] && list[i].connected) return list[i];
  return null;
}
window.addEventListener('gamepadconnected', function (e) { PAD.toast = 'GAMEPAD  ' + (e.gamepad.id || '').slice(0, 34); PAD.toastT = 2.5; });
window.addEventListener('gamepaddisconnected', function () { PAD.toast = 'GAMEPAD ถูกถอด'; PAD.toastT = 2; padRelease(); });
canvas.addEventListener('mousemove', function () { PAD.aiming = false; });   // ขยับเมาส์จริง = เมาส์ชิงการเล็งคืน

function padSetKey(code, on) {
  if (on) { keys[code] = true; PAD.held[code] = true; }
  else if (PAD.held[code]) { keys[code] = false; delete PAD.held[code]; }
}
function padRelease() {
  for (const c in PAD.held) keys[c] = false;
  PAD.held = {};
  if (PAD.fire) mouse.down = false;
  if (PAD.missile) mouse.rightDown = false;
  PAD.fire = PAD.missile = false;
}

// ย้ายเคอร์เซอร์ไปปุ่มที่ใกล้ที่สุดในทิศที่กด (ใช้ items/buttons ของฉากปัจจุบัน)
function padSnap(dx, dy) {
  const sc = Scenes.current;
  const list = (sc.items || sc.buttons || []).filter(function (r) { return r && r.w > 0; });
  if (!list.length) return;
  const hot = hoverIndex(list);
  const ox = hot >= 0 ? list[hot].x + list[hot].w / 2 : mouse.x;
  const oy = hot >= 0 ? list[hot].y + list[hot].h / 2 : mouse.y;
  let best = null, bs = Infinity;
  for (let i = 0; i < list.length; i++) {
    if (i === hot) continue;
    const cx = list[i].x + list[i].w / 2 - ox, cy = list[i].y + list[i].h / 2 - oy;
    const along = cx * dx + cy * dy, perp = Math.abs(cx * dy - cy * dx);
    if (along <= 2) continue;
    const s = along + perp * 2.2;
    if (s < bs) { bs = s; best = list[i]; }
  }
  if (!best) { if (hot < 0) best = list[0]; else return; }
  mouse.x = best.x + best.w / 2; mouse.y = best.y + best.h / 2;
}

function padAxis(v) { return Math.abs(v) < PAD.DEAD ? 0 : v; }

function pollGamepad(dt) {
  if (PAD.toastT > 0) PAD.toastT -= dt;
  const gp = padGet();
  if (gp && gp.id !== PAD.id) { PAD.id = gp.id; PAD.mapping = gp.mapping; PAD.toast = 'GAMEPAD  ' + (gp.id || '').slice(0, 34); PAD.toastT = 2.5; }
  if (!gp) { PAD.id = ''; if (PAD.active) { PAD.active = false; padRelease(); } PAD.prev = []; return; }
  const b = gp.buttons, n = b.length;
  const down = function (i) { return i < n && (b[i].pressed || b[i].value > 0.5); };
  const trig = function (i) { return i < n && (b[i].pressed || b[i].value > 0.35); };
  const edge = function (i) { return down(i) && !PAD.prev[i]; };
  const lx = padAxis(gp.axes[0] || 0), ly = padAxis(gp.axes[1] || 0);
  const rx = padAxis(gp.axes[2] || 0), ry = padAxis(gp.axes[3] || 0);
  const dUp = down(12), dDown = down(13), dLeft = down(14), dRight = down(15);
  const anyInput = lx || ly || rx || ry || b.some(function (x) { return x.pressed; });
  if (anyInput) PAD.active = true;
  for (let i = 0; i < n; i++) if (down(i) && !PAD.prev[i]) { PAD.lastBtn = i; PAD.lastBtnT = 2; }
  if (PAD.lastBtnT > 0) PAD.lastBtnT -= dt;
  const sc = Scenes.current;
  if (sc !== PAD.lastScene) {                         // เปลี่ยนฉาก: ปล่อยปุ่มค้างและตั้งทิศเล็งเริ่มต้นตามทิศหุ่น
    padRelease();
    PAD.lastScene = sc;
    PAD.aimX = player.facing >= 0 ? 1 : -1; PAD.aimY = 0;
  }

  if (sc === PlayScene) {
    // ----- เดิน / กระโดด / โล่ -----
    padSetKey('KeyD', lx > 0.35 || dRight);
    padSetKey('KeyA', lx < -0.35 || dLeft);
    padSetKey('KeyW', down(0) || dUp);
    padSetKey('KeyQ', down(4));
    // ----- Dash (ต้องดันทิศเดินค้างไว้ด้วย เหมือน Shift + A/D) -----
    if (edge(1) || edge(5)) player.dashBuffer = 0.15;
    // ----- เล็ง: สติ๊กขวา ตั้งเป้าที่ระยะคงที่รอบหัวไหล่ -----
    if (rx || ry) { const m = Math.hypot(rx, ry); PAD.aimX = rx / m; PAD.aimY = ry / m; PAD.aiming = true; }
    else if (!PAD.aiming && PAD.active && (lx || dLeft || dRight)) { PAD.aimX = (lx || (dRight ? 1 : -1)) > 0 ? 1 : -1; PAD.aimY = 0; PAD.aiming = true; }
    if (PAD.aiming && !player.dead) {
      const ap = armPivotWorld(player);
      mouse.x = Math.max(0, Math.min(W, ap.x - cam + PAD.aimX * PAD.AIM_R));
      mouse.y = Math.max(0, Math.min(H, ap.y + PAD.aimY * PAD.AIM_R));
    }
    // ----- ยิง -----
    const f = trig(7), m = trig(6) || down(2);
    if (f !== PAD.fire) { PAD.fire = f; mouse.down = f; }
    if (m !== PAD.missile) { PAD.missile = m; mouse.rightDown = m; }
    // ----- ปุ่มระบบ -----
    if (player.dead && (edge(3) || edge(0) || edge(9))) Scenes.keydown({ code: 'KeyR' });
    else if (edge(8) || (player.dead && edge(1))) Scenes.keydown({ code: 'Escape' });
  } else {
    // ----- เมนู: เคอร์เซอร์ + กระโดดตามทิศ -----
    if (PAD.fire || PAD.missile) padRelease();
    padSetKey('KeyD', false); padSetKey('KeyA', false); padSetKey('KeyW', false); padSetKey('KeyQ', false);
    if (lx || ly) {
      mouse.x = Math.max(0, Math.min(W, mouse.x + lx * PAD.CURSOR_SPEED * dt));
      mouse.y = Math.max(0, Math.min(H, mouse.y + ly * PAD.CURSOR_SPEED * dt));
    }
    if (edge(12)) padSnap(0, -1);
    if (edge(13)) padSnap(0, 1);
    if (edge(14)) padSnap(-1, 0);
    if (edge(15)) padSnap(1, 0);
    if (edge(0)) Scenes.mousedown();                                   // A = คลิกตรงเคอร์เซอร์
    if (edge(1) || edge(8)) Scenes.keydown({ code: 'Escape' });        // B / Back = ย้อนกลับ
    if (edge(9)) Scenes.keydown({ code: 'Enter' });                    // Start = ยืนยัน / LAUNCH
    if (sc === HangarScene) {
      const ti = HANGAR_TABS.indexOf(sc.tab);
      if (edge(4)) sc.setTab(HANGAR_TABS[(ti + HANGAR_TABS.length - 1) % HANGAR_TABS.length]);
      if (edge(5)) sc.setTab(HANGAR_TABS[(ti + 1) % HANGAR_TABS.length]);
      if (edge(6)) sc.pickMission(-1);
      if (edge(7)) sc.pickMission(1);
      if (edge(3)) Scenes.keydown({ code: 'KeyH' });
      if (edge(2)) sc.launch();
    }
  }
  PAD.prev = b.map(function (x) { return x.pressed || x.value > 0.5; });
}

// แจ้งเตือนมุมจอเมื่อจอยเชื่อมต่อ
function drawGamepadStatus() {                        // แถบสถานะจอยมุมซ้ายล่าง แสดงเฉพาะในเมนู (ไว้ตรวจว่าเบราว์เซอร์เห็นจอยไหม)
  if (Scenes.current === PlayScene) return;
  let t, c = '#8d978c';
  if (PAD.err === 'blocked') { t = 'จอยถูกบล็อก: เปิดเกมในแท็บเต็ม/ไฟล์ html ของคุณเอง (ไม่ใช่ใน iframe)'; c = '#e0583a'; }
  else if (PAD.err === 'no-api') { t = 'เบราว์เซอร์นี้ไม่รองรับจอย'; c = '#e0583a'; }
  else if (!PAD.id) t = 'ไม่พบจอย: กดปุ่มบนจอยหนึ่งครั้ง (ถ้ายังไม่ขึ้น ลองเสียบใหม่/ปิดโปรแกรมอื่นที่ใช้จอย)';
  else {
    t = 'จอย: ' + PAD.id.slice(0, 40) + (PAD.mapping === 'standard' ? '' : '  [ไม่ใช่มาตรฐาน ปุ่มอาจเพี้ยน]') + (PAD.lastBtnT > 0 ? '   ปุ่ม ' + PAD.lastBtn : '');
    c = PAD.mapping === 'standard' ? '#5fd36f' : '#e0a526';
  }
  drawText(t, 8, H - 8, fnt(400, 10), c, 'left');
}

function drawGamepadToast() {
  drawGamepadStatus();
  if (PAD.toastT <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, PAD.toastT);
  ctx.fillStyle = 'rgba(15,19,22,0.9)';
  ctx.fillRect(W - 270, H - 34, 262, 26);
  ctx.strokeStyle = '#e0a526'; ctx.lineWidth = 1;
  ctx.strokeRect(W - 269.5, H - 33.5, 261, 25);
  drawText(PAD.toast, W - 139, H - 16, fnt(600, 11), '#e0a526', 'center');
  ctx.restore();
}
