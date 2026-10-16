'use strict';
/* ==========================================================================
   dualhand.js : อาวุธสองมือ (ปืน/อาวุธประชิดได้ทั้งมือขวาและมือซ้าย)
   - มือขวา = ช่องปืนเดิม (equippedWeapon.gun) ยิงด้วยคลิกซ้าย   มือซ้าย = ช่องใหม่ equippedWeapon.gun2 ยิงด้วยคลิกขวา
   - มิสไซล์ย้ายไปปุ่ม F เมื่อใส่อาวุธมือซ้าย (ไม่ใส่อาวุธมือซ้าย = คลิกขวายังยิงมิสไซล์เหมือนเดิม เซฟเก่าเล่นได้เหมือนเดิมทุกอย่าง)
   - ถือสองมือพร้อมกัน ดาเมจปืนทั้งสองมือคูณ DUAL_PENALTY   น้ำหนักอาวุธมือซ้ายรวมเข้าน้ำหนักรวมตามปกติ
   - อาวุธตัวเดียวกันถือสองมือไม่ได้ (ต้องเป็นคนละชิ้น)

   ฟิลด์ hand ในข้อมูลอาวุธ (weapondb.js, เฉพาะอาวุธช่องปืน):  hand: 'R' = ถือมือขวาเท่านั้น / 'L' = มือซ้ายเท่านั้น / ไม่ใส่ = ได้ทั้งสองมือ ('ANY')
     ปืนเลเซอร์ (LASER) บังคับมือขวาเท่านั้น (ลำแสงต่อเนื่อง+ความร้อนมีชุดเดียว)
   ไฟล์นี้ต้องโหลดต่อจาก weapondb.js (ครอบ weaponsWeight / weaponEquipped / buyOrEquipWeapon)
   ========================================================================== */

const DUAL_PENALTY = 0.8;          // ดาเมจของปืนแต่ละกระบอกตอนถือสองมือ (0.8 = ลด 20%) ปรับได้ที่ค่าเดียว
const DUAL_OFF_DX = 7;             // แขนซ้ายอยู่ถัดหลังแขนขวากี่พิกเซล (ถอยหลังตามทิศหัน) ใช้ทั้งจุดยิงและภาพ
const DUAL_OFF_DY = -1;            // เลื่อนขึ้น/ลง (พิกเซล)
const DUAL_FAR_SHADE = 0.62;       // ความสว่างของแขน/ปืนมือซ้ายที่อยู่หลังลำตัว (1 = เท่าเดิม)
const HAND_LABEL = { R: 'มือขวา', L: 'มือซ้าย', ANY: 'ได้ทั้งสองมือ' };

let curHand = 'R';                 // มือที่กำลังประมวลผลอยู่ (ใช้ตอนสลับไปยิง/วาดมือซ้าย)

function weaponHand(w) {
  if (!w) return 'ANY';
  if (w.type === 'LASER') return 'R';
  return w.hand === 'R' || w.hand === 'L' ? w.hand : 'ANY';
}
function handOk(w, h) { const wh = weaponHand(w); return wh === 'ANY' || wh === h; }
function offGun() {
  const eq = profile.equippedWeapon, id = eq && eq.gun2;
  const w = id ? findWeapon(id) : null;
  return w && w.slot === 'gun' ? w : null;
}
function hasOffGun() { return !!offGun(); }
function dualActive() { return hasOffGun(); }

// ทำ fn โดยให้ "ปืนที่ถืออยู่" (equippedGun) เป็นปืนมือซ้ายชั่วคราว: ฟังก์ชันยิง/วาด/ระยะเดิมทั้งหมดจึงใช้ได้กับมือซ้ายเลย
function withOffGun(fn) {
  const g = offGun();
  if (!g) return undefined;
  const eq = profile.equippedWeapon, main = eq.gun, prev = curHand;
  eq.gun = g.id; curHand = 'L';
  try { return fn(); } finally { eq.gun = main; curHand = prev; }
}
// เหมือน withOffGun แต่สลับค่าท่าฟัน (swing*) ของผู้เล่นเป็นของมือซ้ายด้วย (เก็บเป็น swingT2 ...)
const HAND_FIELDS = ['swingT', 'swingDur', 'swingArc', 'swingThrust', 'swingAng'];
function withLeftHand(p, fn) {
  if (!offGun()) return undefined;
  const saved = {};
  for (const f of HAND_FIELDS) { saved[f] = p[f]; p[f] = p[f + '2']; }
  try { return withOffGun(fn); }
  finally { for (const f of HAND_FIELDS) { p[f + '2'] = p[f]; p[f] = saved[f]; } }
}
// จุดหมุนแขนของมือที่กำลังใช้ (มือซ้ายถอยหลังจากแขนขวาเล็กน้อย)
function handPivotWorld(p) {
  const ap = armPivotWorld(p);
  if (curHand !== 'L') return ap;
  return { x: ap.x - (p.facing === 1 ? 1 : -1) * DUAL_OFF_DX, y: ap.y + DUAL_OFF_DY };
}

// ---- ครอบฟังก์ชันของระบบอาวุธเดิม
(function () {
  const baseWeight = weaponsWeight, baseEquipped = weaponEquipped, baseBuy = buyOrEquipWeapon;

  weaponsWeight = function (eq) {
    const e = eq || profile.equippedWeapon, g2 = e && e.gun2 ? findWeapon(e.gun2) : null;
    return baseWeight(eq) + (g2 ? g2.weight : 0);
  };
  weaponEquipped = function (id) { return baseEquipped(id) || profile.equippedWeapon.gun2 === id; };

  function equipOff(w) {
    const eq = profile.equippedWeapon, id = w.id;
    if (eq.gun2 === id) { eq.gun2 = null; saveProfile(); return { ok: true, msg: 'ถอด ' + w.name + ' ออกจากมือซ้ายแล้ว' }; }
    if (!handOk(w, 'L')) return { ok: false, msg: w.name + ' ถือได้เฉพาะมือขวา' + (w.type === 'LASER' ? ' (ปืนเลเซอร์)' : '') };
    if (eq.gun === id) return { ok: false, msg: w.name + ' ถืออยู่ที่มือขวาแล้ว (อาวุธชิ้นเดียวถือสองมือไม่ได้)' };
    const owned = weaponOwned(id);
    if (!owned) {
      const lk = weaponLock(id);
      if (lk) return { ok: false, msg: 'ยังล็อก: ต้องชนะบอสด่าน ' + lk.mission + ' อีก ' + lk.left + ' ครั้ง' };
      if (profile.gold < w.price) return { ok: false, msg: 'Credits ไม่พอ ต้องการอีก ' + (w.price - profile.gold) };
      profile.gold -= w.price;
      profile.ownedWeapons.push(id);
    }
    eq.gun2 = id;
    saveProfile();
    return { ok: true, msg: (owned ? 'สวม ' : 'ซื้อและสวม ') + w.name + ' ที่มือซ้ายแล้ว' + (owned ? '' : '  (-' + w.price + ' CR)') + '  ถือสองมือ: ดาเมจปืน x' + DUAL_PENALTY };
  }

  // hand: 'R' | 'L' (เฉพาะอาวุธช่องปืน)  ไม่ใส่ = มือขวา
  buyOrEquipWeapon = function (id, hand) {
    const w = findWeapon(id);
    if (!w || w.slot !== 'gun') return baseBuy(id);
    if (hand === 'L') return equipOff(w);
    if (!handOk(w, 'R')) return { ok: false, msg: w.name + ' ถือได้เฉพาะมือซ้าย (สลับไปแก้ไขมือซ้ายด้วยปุ่ม G)' };
    if (profile.equippedWeapon.gun2 === id) return { ok: false, msg: w.name + ' ถืออยู่ที่มือซ้ายแล้ว (อาวุธชิ้นเดียวถือสองมือไม่ได้)' };
    return baseBuy(id);
  };
})();
