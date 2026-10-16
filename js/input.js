'use strict';
/* ==========================================================================
   input.js : คีย์บอร์ดและเมาส์
   ไฟล์นี้เก็บแค่ "สถานะปุ่ม" และส่งเหตุการณ์กดปุ่มต่อให้ฉากปัจจุบัน (Scenes)
   ========================================================================== */

const keys = Object.create(null);
const mouse = { x: 520, y: 225, down: false, rightDown: false };   // down = ปุ่มซ้าย (ยิงปืน), rightDown = ปุ่มขวา (ยิงมิสไซล์)

const GAME_KEYS = new Set(['KeyA', 'KeyD', 'KeyW', 'KeyR', 'KeyN', 'KeyQ', 'KeyE', 'KeyF', 'Space', 'Enter',
  'ShiftLeft', 'ShiftRight', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyS']);

window.addEventListener('keydown', function (e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;     // ไม่แย่ง Ctrl+R (รีเฟรช) และคีย์ลัดของเบราว์เซอร์
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (!e.repeat) Scenes.keydown(e);
});
window.addEventListener('keyup', function (e) { keys[e.code] = false; });
window.addEventListener('blur', function () {
  for (const k in keys) keys[k] = false;
  mouse.down = false; mouse.rightDown = false;
});

function updateMouse(e) {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (W / r.width);
  mouse.y = (e.clientY - r.top) * (H / r.height);
}
canvas.addEventListener('mousemove', updateMouse);
canvas.addEventListener('mousedown', function (e) {
  if (e.button === 2) { updateMouse(e); mouse.rightDown = true; e.preventDefault(); return; }   // คลิกขวา = ยิงมิสไซล์
  if (e.button !== 0) return;
  updateMouse(e);
  mouse.down = true;
  canvas.focus({ preventScroll: true });
  e.preventDefault();
  Scenes.mousedown();
});
window.addEventListener('mouseup', function (e) { if (e.button === 0) mouse.down = false; else if (e.button === 2) mouse.rightDown = false; });
// ยิงมิสไซล์: คลิกขวาค้าง หรือปุ่ม F (สำรองสำหรับทัชแพด/เมาส์ที่ไม่มีปุ่มขวา)
function missileHeld() { return (mouse.rightDown && !hasOffGun()) || !!keys.KeyF; }   // ใส่อาวุธมือซ้ายแล้ว คลิกขวายิงมือซ้าย มิสไซล์เหลือแค่ F
canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
