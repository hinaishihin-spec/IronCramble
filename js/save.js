'use strict';
/* ==========================================================================
   save.js : เซฟ/โหลดความคืบหน้าด้วย LocalStorage
   เก็บเฉพาะข้อมูลถาวร (เลเวล, EXP, เงิน, จำนวนภารกิจที่ผ่าน)
   ส่วนข้อมูลชั่วคราวในด่าน (ตำแหน่งหุ่น, ศัตรู) ไม่เก็บ
   ========================================================================== */

const Save = (function () {
  let usable = true;

  function storage() {
    try { return window.localStorage; } catch (e) { return null; }   // บางเบราว์เซอร์/โหมดส่วนตัวจะ throw
  }

  function toInt(v, min, max) {
    v = Math.floor(Number(v));
    if (!isFinite(v)) v = min;
    return Math.max(min, Math.min(max, v));
  }

  // กันข้อมูลเสีย/ถูกแก้มือ: บังคับให้เป็นตัวเลขในช่วงที่เกมรับได้เสมอ
  function sanitize(o) {
    o = (o && typeof o === 'object') ? o : {};
    const level = toInt(o.level, 1, 99);
    // ชิ้นส่วนหุ่น: ตรวจทุกไอดีกับ WANZER_PARTS (ไอดีแปลกปลอม/เซฟพัง = กลับเป็นพาร์ทเริ่มต้น) และพาร์ทที่สวมต้องเป็นของที่ซื้อแล้ว
    const ownedParts = defaultOwnedParts(), equippedParts = defaultEquippedParts();
    for (const c of PART_CATEGORIES) {
      const ol = o.ownedParts && Array.isArray(o.ownedParts[c]) ? o.ownedParts[c] : [];
      for (const id of ol) if (findPart(c, id) && ownedParts[c].indexOf(id) < 0) ownedParts[c].push(id);
      const eq = o.equippedParts ? o.equippedParts[c] : null;
      if (findPart(c, eq) && ownedParts[c].indexOf(eq) >= 0) equippedParts[c] = eq;
    }
    // เซฟเก่า (ระบบอัปเกรดเกราะ/ไอพ่นแบบรวม): คืน Credits ที่เคยจ่ายไปทั้งหมด แล้วให้ไปซื้อชิ้นส่วนใหม่ (เซฟใหม่ไม่มีฟิลด์เหล่านี้ จึงไม่คืนซ้ำ)
    let refund = 0;
    const oldArmor = toInt(o.armorLv, 0, 5), oldVernier = toInt(o.vernierLv, 0, 5);
    for (let i = 0; i < oldArmor; i++) refund += 100 + 50 * i;
    for (let i = 0; i < oldVernier; i++) refund += 100 + 50 * i;
    // อาวุธ 2 ช่อง: เซฟเก่าที่ซื้อ Laser/Shotgun/Dual Missile ไว้ -> ได้อาวุธรุ่นใกล้เคียงให้ฟรี, Dual MG (ไม่มีแล้ว) -> คืน Credits
    const ownedWeapons = defaultOwnedWeapons();
    const addW = function (id) { if (findWeapon(id) && ownedWeapons.indexOf(id) < 0) ownedWeapons.push(id); };
    if (Array.isArray(o.ownedWeapons)) o.ownedWeapons.forEach(addW);
    if (o.laser === true || o.laser === 1) addW('laser_1');
    if (o.shotgun === true || o.shotgun === 1) addW('henry_1');
    if (o.dualMissile === true || o.dualMissile === 1) addW('dual_1');
    if (o.dualMg === true || o.dualMg === 1) refund += DUAL_MG_COST;
    const equippedWeapon = defaultEquippedWeapon();
    for (const slot of WEAPON_SLOTS_LIST) {
      const eq = o.equippedWeapon ? o.equippedWeapon[slot] : null;
      const w = findWeapon(eq);
      if (w && w.slot === slot && ownedWeapons.indexOf(eq) >= 0) equippedWeapon[slot] = eq;
    }
    return {
      level: level,
      exp: toInt(o.exp, 0, expToNext(level) - 1),
      gold: toInt(toInt(o.gold, 0, 999999999) + refund, 0, 999999999),
      missions: toInt(o.missions, 0, 999999),
      // ฟิลด์จากอู่ซ่อม: เซฟเก่าที่ไม่มีฟิลด์เหล่านี้จะได้ค่าเริ่มต้น 0 (เซฟเดิมใช้ต่อได้)
      ownedParts: ownedParts,
      equippedParts: equippedParts,
      ownedWeapons: ownedWeapons,
      equippedWeapon: equippedWeapon
    };
  }

  function probe() {
    const s = storage();
    if (!s) return false;
    try { s.setItem(SAVE_KEY + '.probe', '1'); s.removeItem(SAVE_KEY + '.probe'); return true; } catch (e) { return false; }
  }

  function load() {
    usable = probe();
    if (!usable) return sanitize(null);
    try {
      const raw = storage().getItem(SAVE_KEY);
      return sanitize(raw ? JSON.parse(raw) : null);
    } catch (e) {
      return sanitize(null);                                          // JSON พัง -> เริ่มใหม่
    }
  }

  function write(p) {
    if (!usable) return false;
    try {
      storage().setItem(SAVE_KEY, JSON.stringify({
        v: 1, level: p.level, exp: p.exp, gold: p.gold, missions: p.missions,
        ownedParts: p.ownedParts, equippedParts: p.equippedParts,
        ownedWeapons: p.ownedWeapons, equippedWeapon: p.equippedWeapon
      }));
      return true;
    } catch (e) {
      usable = false;
      return false;
    }
  }

  function reset(p) { Object.assign(p, sanitize(null)); write(p); }

  return { load: load, write: write, reset: reset, get usable() { return usable; } };
})();

// ข้อมูลผู้เล่นถาวร: ใช้อ้างอิงจากทุกไฟล์ ถ้าเปลี่ยนค่าให้เรียก saveProfile() ต่อ
const profile = Save.load();
function saveProfile() { Save.write(profile); }
