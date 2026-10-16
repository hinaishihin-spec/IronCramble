'use strict';
/* chips.js : ผลของ Chip ในเกม (passive / proc) + HUD + แผงชิปใน Hangar  ข้อมูลอยู่ที่ chipdata.js (ดูคำอธิบายทั้งหมดที่นั่น) ต้องโหลดหลังไฟล์อื่นทั้งหมด ก่อน main.js */

// ---------------------------------------------------------------- เพิ่มค่า (passive)
function chipPass(key) { const c = equippedChip(); return c && c.kind === 'pass' && c.fam === key ? c.v : 0; }

(function () {
  const baseMaxHp = maxHp, baseDef = partsDefense, baseBoost = partsBoostMult, baseAtk = atkMult;
  maxHp = function () { return baseMaxHp() + chipPass('HP'); };
  partsDefense = function () { return baseDef() + chipPass('DEF'); };          // บวกเพิ่มจากเพดานของพาร์ท (DEFENSE_CAP)
  partsBoostMult = function () { return baseBoost() * (1 + chipPass('BOOST')); };
  atkMult = function (w) {
    let m = baseAtk(w);
    if (w && w.slot === 'gun') m *= 1 + (w.type === 'MELEE' ? chipPass('SMASH') : chipPass('GUN'));
    return m;
  };
})();

// ---------------------------------------------------------------- สุ่มเกิด (proc)
let chipClock = 0, chipLast = {}, chipTimers = [], chipFlash = 0, chipFlashText = '';

function chipRoll(c) {
  if (!c || c.kind !== 'proc') return false;
  if (chipClock - (chipLast[c.fam] === undefined ? -99 : chipLast[c.fam]) < CHIP_ICD) return false;
  if (Math.random() >= c.v) return false;
  chipLast[c.fam] = chipClock;
  return true;
}
function chipProc(label) {
  chipFlash = 0.8; chipFlashText = label;
  popText(player.x + player.w / 2, player.y - 26, label, CHIP_COLOR, 14);
}
function chipLater(delay, fn) { chipTimers.push({ t: delay, fn: fn }); }
function chipTick(dt) {
  chipClock += dt;
  chipFlash = Math.max(0, chipFlash - dt);
  for (let i = chipTimers.length - 1; i >= 0; i--) {
    const q = chipTimers[i];
    q.t -= dt;
    if (q.t <= 0) { chipTimers.splice(i, 1); if (!player.dead && !player.shieldUp) q.fn(); }
  }
}
function chipPodOk() { return POD2_TYPES.indexOf(equippedMissile().type) >= 0; }
function chipFireHand(p, hand) { return hand === 'L' ? withLeftHand(p, function () { return fireWeapon(p, 0); }) : fireWeapon(p, 0); }
// ยิงมิสไซล์เพิ่ม 1 ชุดจากไหล่ข้างที่ระบุ (ไม่แตะคูลดาวน์ปกติ)  ไหล่ซ้าย: ใช้อาวุธช่อง missile2 ถ้ามี ไม่มีก็ใช้มิสไซล์ของไหล่ขวายิงจากตำแหน่งไหล่ซ้าย
function chipFirePod(p, side) {
  p.podAimT = 0.5;
  if (side === 'R') { fireWeapon(p, 1); return; }
  if (pod2Weapon()) { withPod2(function () { return fireWeapon(p, 1); }); return; }
  const prev = curPod;
  curPod = 'L';
  try { fireWeapon(p, 1); } finally { curPod = prev; }
}
// เรียกหลังยิง/ฟันด้วยปืนมือ hand ('R' | 'L')  n0 = จำนวนกระสุนในสนามก่อนยิง (ไว้ติดป้ายกระสุนนัดนั้น)
function chipOnGun(p, hand, n0) {
  const c = equippedChip();
  if (!c || c.kind !== 'proc') return;
  const g = hand === 'L' ? offGun() : equippedGun();
  if (!g) return;
  const melee = g.type === 'MELEE';
  if (c.fam === 'AP') {
    if (!melee && chipRoll(c)) { for (let i = n0; i < bullets.length; i++) bullets[i].ap = true; chipProc('PIERCE!'); }
  } else if (c.fam === 'GUN2') {
    if (!melee && g.type !== 'LASER' && chipRoll(c)) { chipProc('TWIN SHOT!'); chipLater(CHIP_TWIN_DELAY, function () { chipFireHand(p, hand); }); }
  } else if (c.fam === 'BATON2' || c.fam === 'KNUCKLE2') {
    if (melee && g.artKey === (c.fam === 'BATON2' ? 'BATON' : 'KNUCKLE') && chipRoll(c)) { chipProc(c.fam === 'BATON2' ? 'TWIN STRIKE!' : 'TWIN PUNCH!'); chipLater(CHIP_MELEE_DELAY, function () { chipFireHand(p, hand); }); }
  } else if (c.fam === 'HR' || c.fam === 'HL') {
    if (g.type !== 'LASER' && chipPodOk() && chipRoll(c)) { chipProc(c.fam === 'HR' ? 'HAND + R.POD!' : 'HAND + L.POD!'); chipFirePod(p, c.fam === 'HR' ? 'R' : 'L'); }
  }
}
// เรียกหลังยิงมิสไซล์จากไหล่ side ('R' | 'L')  ทักษะ POD2 = ยิงอีกไหล่เพิ่มทันที
function chipOnMissile(p, side) {
  const c = equippedChip();
  if (!c || c.fam !== 'POD2' || !chipPodOk()) return;
  if (chipRoll(c)) { chipProc('TWIN PODS!'); chipFirePod(p, side === 'R' ? 'L' : 'R'); }
}

(function () {
  const baseUpdate = updatePlayer, baseReset = resetPlayer;
  updatePlayer = function (dt) { baseUpdate(dt); chipTick(dt); };
  resetPlayer = function () { baseReset(); chipTimers.length = 0; chipLast = {}; chipClock = 0; chipFlash = 0; };
})();

// ---------------------------------------------------------------- HUD ในด่าน: แถบ CHIP เล็ก ๆ ใต้ช่องอาวุธ (กะพริบเมื่อทักษะเกิด)
function drawChipHud() {
  const c = equippedChip();
  if (!c) return;
  const on = chipFlash > 0;
  ctx.font = fnt(700, 10);
  ctx.textAlign = 'left';
  ctx.fillStyle = on ? '#ffffff' : '#6f7a70';
  ctx.fillText('CHIP', 262, 54);
  ctx.fillStyle = on ? CHIP_COLOR : '#8d978c';
  ctx.fillText(c.name + (c.kind === 'proc' ? '  ' + Math.round(c.v * 100) + '%' : '') + (on ? '  ' + chipFlashText : ''), 296, 54);
}

// ---------------------------------------------------------------- Hangar: แผงชิป (กดปุ่มชิป หรือ K)
const CHIP_ROW_Y = 90, CHIP_ROW_PITCH = 21, CHIP_LV_W = 36;

function chipBuildItems(items) {
  const best = function (key) { for (let l = 3; l >= 1; l--) if (chipOwned(key.toLowerCase() + '_' + l)) return key.toLowerCase() + '_' + l; return null; };
  for (let i = 0; i < CHIP_FAMILIES.length; i++) {          // ปุ่มระดับ I/II/III ใส่ก่อนแถว (เมาส์ชี้เจอปุ่มก่อน)
    const f = CHIP_FAMILIES[i], y = CHIP_ROW_Y + i * CHIP_ROW_PITCH;
    for (let l = 1; l <= 3; l++) items.push({ chip: findChip(f.key.toLowerCase() + '_' + l), x: 776 - (4 - l) * (CHIP_LV_W + 2) + 2, y: y, w: CHIP_LV_W, h: CHIP_ROW_PITCH - 3 });
  }
  for (let i = 0; i < CHIP_FAMILIES.length; i++) {
    const f = CHIP_FAMILIES[i];
    items.push({ chipfam: f, key: ROW_KEYS[i], bestId: best(f.key), x: 356, y: CHIP_ROW_Y + i * CHIP_ROW_PITCH, w: 420 - 3 * (CHIP_LV_W + 2), h: CHIP_ROW_PITCH - 3 });
  }
}
function chipPickFamily(f) {                                  // กดแถว/ปุ่มแถว: สวมระดับสูงสุดที่มี (ถอดถ้าสวมอยู่แล้ว) ยังไม่มีเลย = บอกให้กดปุ่มระดับเพื่อซื้อ
  for (let l = 3; l >= 1; l--) { const id = f.key.toLowerCase() + '_' + l; if (chipOwned(id)) return buyOrEquipChip(id); }
  return { ok: false, msg: 'ยังไม่มี ' + f.name + '  กดปุ่ม I / II / III ด้านขวาเพื่อซื้อ' };
}
function drawChipRow(c, hot) {
  const f = c.chipfam, cur = equippedChip(), here = cur && cur.fam === f.key;
  ctx.fillStyle = here ? '#1f2a1d' : (hot ? '#222a31' : '#1a2026');
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.strokeStyle = here ? '#5fd36f' : (hot ? '#59636d' : '#333c45');
  ctx.lineWidth = 1.5;
  ctx.strokeRect(c.x + 0.75, c.y + 0.75, c.w - 1.5, c.h - 1.5);
  const ty = c.y + c.h / 2 + 4;
  if (c.key) drawText('[' + c.key + ']', c.x + 6, ty, fnt(600, 9), '#6f7a70');
  drawText(f.name, c.x + 28, ty, fnt(700, 11), f.kind === 'proc' ? '#7fe8ff' : '#e0a526');
  drawFitText(f.short, c.x + 150, ty, 400, 9, '#8d978c', c.x + c.w - 4);
}
function drawChipLv(c, hot) {
  const ch = c.chip, st = chipState(ch.id);
  const col = { equipped: '#5fd36f', owned: '#d9dfd2', buy: '#ffd23f', poor: '#7d6d33', locked: '#8a4a42' }[st];
  ctx.fillStyle = st === 'equipped' ? '#1f2a1d' : (hot ? '#2a323a' : '#161c21');
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.strokeStyle = st === 'equipped' ? '#5fd36f' : (hot ? '#e0a526' : '#333c45');
  ctx.lineWidth = 1.5;
  ctx.strokeRect(c.x + 0.75, c.y + 0.75, c.w - 1.5, c.h - 1.5);
  drawText(CHIP_ROMAN[ch.lv - 1], c.x + c.w / 2, c.y + c.h / 2 + 4, fnt(700, 11), col, 'center');
  if (st === 'locked') { ctx.fillStyle = '#e0583a'; ctx.fillRect(c.x + c.w - 6, c.y + 3, 3, 3); }
}
// ป้ายอธิบายชิปที่เมาส์ชี้ (วาดทับหลังสุด)
function drawChipTip(it) {
  const ch = it && it.chip;
  if (!ch) return;
  const st = chipState(ch.id), lk = chipLock(ch.id);
  const l1 = ch.name + (ch.kind === 'proc' ? '  (สุ่มเกิดตอนโจมตี)' : '');
  const l2 = ch.text;
  const l3 = st === 'equipped' ? 'สวมอยู่ · กดอีกครั้ง = ถอด' : (st === 'owned' ? 'มีแล้ว · กดเพื่อสวม' : (st === 'locked' ? 'ล็อก: ชนะบอสด่าน ' + lk.mission + ' อีก ' + lk.left + ' ครั้ง (' + lk.have + '/' + lk.need + ')' : ch.price + ' CR' + (st === 'poor' ? '  (Credits ไม่พอ)' : '  · กดเพื่อซื้อและสวม')));
  const w = 250, h = 54;
  const x = Math.min(776 - w, Math.max(356, it.x + it.w - w)), y = it.y > 250 ? it.y - h - 2 : it.y + it.h + 2;
  ctx.fillStyle = 'rgba(8,10,12,0.96)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#59636d'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  drawText(l1, x + 8, y + 15, fnt(700, 11), CHIP_COLOR);
  drawText(l2, x + 8, y + 30, fnt(600, 10), '#d9dfd2');
  drawText(l3, x + 8, y + 45, fnt(600, 10), st === 'locked' ? '#e0583a' : (st === 'poor' ? '#a8873a' : '#8d978c'));
}
