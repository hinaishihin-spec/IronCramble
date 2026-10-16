'use strict';
/* ==========================================================================
   missile2.js : ช่องมิสไซล์ที่สอง (พอดไหล่ซ้าย)  equippedWeapon.missile2
   - ใส่ช่องที่สองแล้วกดปุ่มมิสไซล์เดิม (คลิกขวา / F) ยิงสองพอดสลับกันอัตโนมัติ ไม่มีปุ่มเพิ่ม  แต่ละพอดมีคูลดาวน์ของตัวเอง
   - ไม่ใส่ช่องที่สอง = เล่นเหมือนเดิมทุกอย่าง (เซฟเก่าใช้ได้)
   - น้ำหนักของพอดที่สองรวมเข้าน้ำหนักรวมตามปกติ  อาวุธชิ้นเดียวใส่สองไหล่ไม่ได้ (ต้องเป็นคนละชิ้น)
   - ใช้ได้เฉพาะมิสไซล์ชนิด POD2_TYPES (ยิงเป็นลูกกระสุน)  BEAM / ORBITAL / NAPALM มีสถานะแยกของตัวเอง จึงอยู่ไหล่ซ้ายไม่ได้
     และถ้าไหล่ขวาถืออาวุธชนิดเหล่านี้ ช่องที่สองจะไม่ทำงาน
   - Hangar แท็บมิสไซล์: ปุ่ม G (หรือปุ่ม "ไหล่ขวา/ไหล่ซ้าย") สลับไหล่ที่แก้ไข
   ไฟล์นี้ต้องโหลดต่อจาก dualhand.js
   ========================================================================== */

const POD2_TYPES = ['SINGLE', 'DUAL', 'SWARM'];   // ชนิดมิสไซล์ที่ใส่ช่องที่สองได้ (และไหล่ขวาต้องเป็นชนิดเหล่านี้ด้วยช่องที่สองจึงทำงาน)
const POD2_BACK = 7;           // พอดซ้ายอยู่ถัดหลังพอดขวากี่พิกเซล (ถอยหลังตามทิศหัน) ใช้ทั้งจุดยิงและภาพ
const POD2_UP = -2;            // เลื่อนขึ้น (+) / ลง (-) เป็นพิกเซลเกม
const POD2_SHADE = 0.62;       // ความสว่างของพอดซ้ายที่อยู่หลังลำตัว (1 = เท่าเดิม)
const POD2_STAGGER = 0.5;      // ยิงพอดหนึ่งแล้ว อีกพอดที่พร้อมอยู่จะรอเท่านี้ของคูลดาวน์ (0.5 = ยิงสลับกึ่งกลางพอดี, 0 = ยิงพร้อมกัน)

let curPod = 'R';              // พอดที่กำลังประมวลผลอยู่ (ใช้ตอนสลับไปยิงพอดซ้าย)

function pod2Weapon() {
  const eq = profile.equippedWeapon, id = eq && eq.missile2;
  const w = id ? findWeapon(id) : null;
  return w && w.slot === 'missile' && POD2_TYPES.indexOf(w.type) >= 0 ? w : null;
}
function hasPod2() { return !!pod2Weapon() && POD2_TYPES.indexOf(equippedMissile().type) >= 0; }

// ทำ fn โดยให้ "มิสไซล์ที่ถืออยู่" เป็นของพอดซ้ายชั่วคราว: ฟังก์ชันยิงเดิมใช้ได้เลย ลูกที่ยิงออกมาถูกติดป้ายอาวุธ (m.wpn) ไว้คิดดาเมจ
function withPod2(fn) {
  const w = pod2Weapon();
  if (!w) return undefined;
  const eq = profile.equippedWeapon, main = eq.missile, prev = curPod, n0 = missiles.length;
  eq.missile = w.id; curPod = 'L';
  try { return fn(); }
  finally {
    eq.missile = main; curPod = prev;
    for (let i = n0; i < missiles.length; i++) missiles[i].wpn = w;
  }
}

(function () {
  const basePivot = podPivotWorld, baseWeight = weaponsWeight, baseEquipped = weaponEquipped, baseBuy = buyOrEquipWeapon;

  podPivotWorld = function (p) {
    const pv = basePivot(p);
    if (curPod !== 'L') return pv;
    return { x: pv.x - (p.facing === 1 ? 1 : -1) * POD2_BACK, y: pv.y - POD2_UP };
  };
  weaponsWeight = function (eq) {
    const e = eq || profile.equippedWeapon, m2 = e && e.missile2 ? findWeapon(e.missile2) : null;
    return baseWeight(eq) + (m2 ? m2.weight : 0);
  };
  weaponEquipped = function (id) { return baseEquipped(id) || profile.equippedWeapon.missile2 === id; };

  function equipPod2(w) {
    const eq = profile.equippedWeapon, id = w.id;
    if (eq.missile2 === id) { eq.missile2 = null; saveProfile(); return { ok: true, msg: 'ถอด ' + w.name + ' ออกจากไหล่ซ้ายแล้ว' }; }
    if (POD2_TYPES.indexOf(w.type) < 0) return { ok: false, msg: w.name + ' ใส่ไหล่ซ้ายไม่ได้ (ไหล่ซ้ายใช้ได้เฉพาะมิสไซล์ Single / Dual / Swarm)' };
    if (POD2_TYPES.indexOf(equippedMissile().type) < 0) return { ok: false, msg: 'ไหล่ขวาถือ ' + equippedMissile().name + ' อยู่ (ชนิดนี้ใช้คู่กับไหล่ซ้ายไม่ได้)' };
    if (eq.missile === id) return { ok: false, msg: w.name + ' ถืออยู่ที่ไหล่ขวาแล้ว (อาวุธชิ้นเดียวใส่สองไหล่ไม่ได้)' };
    const owned = weaponOwned(id);
    if (!owned) {
      const lk = weaponLock(id);
      if (lk) return { ok: false, msg: 'ยังล็อก: ต้องชนะบอสด่าน ' + lk.mission + ' อีก ' + lk.left + ' ครั้ง' };
      if (profile.gold < w.price) return { ok: false, msg: 'Credits ไม่พอ ต้องการอีก ' + (w.price - profile.gold) };
      profile.gold -= w.price;
      profile.ownedWeapons.push(id);
    }
    eq.missile2 = id;
    saveProfile();
    return { ok: true, msg: (owned ? 'สวม ' : 'ซื้อและสวม ') + w.name + ' ที่ไหล่ซ้ายแล้ว' + (owned ? '' : '  (-' + w.price + ' CR)') + '  ปุ่มมิสไซล์ยิงสลับสองพอด' };
  }

  // hand: 'L' = ไหล่ซ้าย (เฉพาะอาวุธช่องมิสไซล์)  อย่างอื่น = ไหล่ขวา (ช่องเดิม)
  buyOrEquipWeapon = function (id, hand) {
    const w = findWeapon(id);
    if (!w || w.slot !== 'missile') return baseBuy(id, hand);
    if (hand === 'L') return equipPod2(w);
    if (profile.equippedWeapon.missile2 === id) return { ok: false, msg: w.name + ' ถืออยู่ที่ไหล่ซ้ายแล้ว (อาวุธชิ้นเดียวใส่สองไหล่ไม่ได้)' };
    const res = baseBuy(id, hand);
    if (res.ok && profile.equippedWeapon.missile2 && POD2_TYPES.indexOf(w.type) < 0) {   // ไหล่ขวาเปลี่ยนเป็นชนิดที่ใช้คู่ไม่ได้ = ถอดไหล่ซ้ายออกให้
      profile.equippedWeapon.missile2 = null;
      saveProfile();
      res.msg += '  (ถอดไหล่ซ้ายออกให้ เพราะชนิดนี้ใช้คู่ไม่ได้)';
    }
    return res;
  };
})();
