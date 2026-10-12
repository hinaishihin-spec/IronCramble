'use strict';
/* ==========================================================================
   save.js : ระบบเซฟ 3 ช่อง (SLOT 1-3) + เซฟอัตโนมัติ + ส่งออก/นำเข้าไฟล์เซฟ
   เก็บเฉพาะข้อมูลถาวร (เลเวล, EXP, เงิน, ภารกิจที่ผ่าน, พาร์ท, อาวุธ) ส่วนข้อมูลชั่วคราวในด่านไม่เก็บ

   ที่เก็บข้อมูล (Backend) แยกจากตรรกะเซฟ: ปกติใช้ LocalStorage ของเบราว์เซอร์
   ถ้าเอาไปทำเป็นแอปเดสก์ท็อป (Electron/Tauri) หรือขึ้น Steam ให้เตรียมออบเจกต์ window.WanzerHost.storage
     { get(key) -> string|null,  set(key, string),  remove(key) }   (ต้องเป็นฟังก์ชันซิงก์)
   แล้วเกมจะเซฟลงไฟล์ในโฟลเดอร์ของแอป (หรือ Steam Cloud) แทน LocalStorage โดยไม่ต้องแก้ไฟล์นี้
   ซองเซฟ: { format:'wanzer-save', v:2, savedAt:เวลา(ms), data:{...} }  เซฟรุ่นเก่า (ไม่มีซอง / v1) ยังอ่านได้
   ========================================================================== */

const Save = (function () {
  const SLOTS = 3;
  const SLOT_KEY = 'wanzer.save.slot';          // + เลขช่อง (1-3)
  const LAST_KEY = 'wanzer.save.last';          // ช่องที่เล่นล่าสุด
  const FORMAT = 'wanzer-save';
  let usable = true;
  let active = 1;

  // ---- Backend: LocalStorage (ค่าเริ่มต้น) หรือ window.WanzerHost.storage (แอปเดสก์ท็อป/Steam) ----
  function backend() {
    try {
      if (window.WanzerHost && window.WanzerHost.storage) return window.WanzerHost.storage;
      const ls = window.localStorage;                                  // บางเบราว์เซอร์/โหมดส่วนตัวจะ throw
      return { get: function (k) { return ls.getItem(k); }, set: function (k, v) { ls.setItem(k, v); }, remove: function (k) { ls.removeItem(k); } };
    } catch (e) { return null; }
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
    const b = backend();
    if (!b) return false;
    try { b.set(SLOT_KEY + '.probe', '1'); b.remove(SLOT_KEY + '.probe'); return true; } catch (e) { return false; }
  }

  function pack(p) {
    return JSON.stringify({
      format: FORMAT, v: 2, savedAt: Date.now(),
      data: {
        level: p.level, exp: p.exp, gold: p.gold, missions: p.missions,
        ownedParts: p.ownedParts, equippedParts: p.equippedParts,
        ownedWeapons: p.ownedWeapons, equippedWeapon: p.equippedWeapon
      }
    });
  }

  // แกะซองเซฟ (รองรับเซฟรุ่นเก่าที่ไม่มีซอง) คืน { data, savedAt } หรือ null ถ้าอ่านไม่ได้
  function unpack(raw) {
    try {
      const o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return null;
      if (o.format === FORMAT && o.data && typeof o.data === 'object') return { data: o.data, savedAt: toInt(o.savedAt, 0, 8.64e15) };
      if (o.format === undefined && (o.level !== undefined || o.gold !== undefined)) return { data: o, savedAt: 0 };   // เซฟ v1 เดิม
      return null;
    } catch (e) { return null; }
  }

  function readSlot(n) {
    const b = backend();
    if (!b || !usable) return null;
    for (const key of [SLOT_KEY + n, SLOT_KEY + n + '.bak']) {       // ไฟล์หลักเสีย -> ลองสำรอง
      try {
        const raw = b.get(key);
        const r = raw ? unpack(raw) : null;
        if (r) return r;
      } catch (e) { /* ลองคีย์ถัดไป */ }
    }
    return null;
  }

  function writeSlot(n, p) {
    const b = backend();
    if (!b || !usable) return false;
    try {
      const old = b.get(SLOT_KEY + n);
      if (old && unpack(old)) b.set(SLOT_KEY + n + '.bak', old);      // เก็บเซฟก่อนหน้าไว้ 1 ชุดเผื่อไฟล์เสีย
      b.set(SLOT_KEY + n, pack(p));
      b.set(LAST_KEY, String(n));
      return true;
    } catch (e) {
      usable = false;
      return false;
    }
  }

  // เซฟรุ่นเก่า (ช่องเดียว wanzer.save.v1) ย้ายเข้า SLOT 1 ครั้งเดียว
  function migrateLegacy() {
    const b = backend();
    if (!b) return;
    try {
      const raw = b.get(SAVE_KEY);
      if (raw && !readSlot(1) && unpack(raw)) { b.set(SLOT_KEY + '1', pack(sanitize(unpack(raw).data))); b.remove(SAVE_KEY); }
    } catch (e) { /* ไม่เป็นไร */ }
  }

  // เริ่มเกม: โหลดช่องที่เล่นล่าสุด (ไม่มีเซฟเลย = เกมใหม่ใน SLOT 1)
  function boot() {
    usable = probe();
    if (!usable) return sanitize(null);
    migrateLegacy();
    let n = 1;
    try { n = toInt(backend().get(LAST_KEY) || 1, 1, SLOTS); } catch (e) { n = 1; }
    active = n;
    const r = readSlot(n);
    return sanitize(r ? r.data : null);
  }

  // ข้อมูลสรุปของช่อง (ใช้แสดงในหน้าเลือกเซฟ) null = ว่าง
  function info(n) {
    const r = readSlot(n);
    if (!r) return null;
    const d = sanitize(r.data);
    return { level: d.level, gold: d.gold, missions: d.missions, savedAt: r.savedAt };
  }

  function write(p) { return writeSlot(active, p); }

  // เลือกช่อง: มีเซฟ = โหลดเข้า profile / ว่าง = เริ่มเกมใหม่และสร้างเซฟทันที
  function select(n, p) {
    n = toInt(n, 1, SLOTS);
    const r = readSlot(n);
    Object.assign(p, sanitize(r ? r.data : null));
    active = n;
    writeSlot(n, p);
    return !!r;
  }

  // ลบช่อง: ถ้าเป็นช่องที่เล่นอยู่ ข้อมูลในหน่วยความจำจะรีเซ็ตเป็นเกมใหม่ (แต่ยังไม่สร้างเซฟจนกว่าจะเล่น/ซื้ออะไรสักอย่าง)
  function remove(n, p) {
    const b = backend();
    if (!b || !usable) return false;
    try { b.remove(SLOT_KEY + n); b.remove(SLOT_KEY + n + '.bak'); } catch (e) { return false; }
    if (n === active) Object.assign(p, sanitize(null));
    return true;
  }

  function reset(p) { Object.assign(p, sanitize(null)); write(p); }

  // ส่งออกช่องเป็นไฟล์ .json ให้ดาวน์โหลด (ย้ายเครื่อง/สำรองเซฟ)
  function exportSlot(n, p) {
    const r = readSlot(n);
    if (!r && !(n === active && p)) return { ok: false, msg: 'ช่องนี้ว่าง ไม่มีอะไรให้ส่งออก' };
    const text = n === active && p ? pack(p) : JSON.stringify({ format: FORMAT, v: 2, savedAt: r.savedAt, data: sanitize(r.data) });
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'wanzer-slot' + n + '.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      return { ok: true, msg: 'ส่งออก SLOT ' + n + ' แล้ว (wanzer-slot' + n + '.json)' };
    } catch (e) {
      return { ok: false, msg: 'ส่งออกไม่ได้ในสภาพแวดล้อมนี้ (เบราว์เซอร์บล็อกการดาวน์โหลด)' };
    }
  }

  // นำเข้าไฟล์เซฟลงช่อง n (ตรวจรูปแบบ + ล้างค่าให้ปลอดภัยก่อนใช้) text = เนื้อไฟล์
  function importInto(n, text, p) {
    const r = unpack(text);
    if (!r) return { ok: false, msg: 'ไฟล์นี้ไม่ใช่ไฟล์เซฟของ Wanzer' };
    const clean = sanitize(r.data);
    if (n === active) Object.assign(p, clean);
    const tmp = n === active ? p : clean;
    if (!writeSlot(n, tmp)) return { ok: false, msg: 'เขียนเซฟไม่ได้ (เบราว์เซอร์ไม่อนุญาตให้เก็บข้อมูล)' };
    return { ok: true, msg: 'นำเข้า SLOT ' + n + ' สำเร็จ  LV ' + clean.level };
  }

  return {
    SLOTS: SLOTS, boot: boot, info: info, write: write, select: select, remove: remove, reset: reset,
    exportSlot: exportSlot, importInto: importInto,
    get usable() { return usable; }, get slot() { return active; }
  };
})();

// ข้อมูลผู้เล่นถาวร: ใช้อ้างอิงจากทุกไฟล์ ถ้าเปลี่ยนค่าให้เรียก saveProfile() ต่อ
const profile = Save.boot();
function saveProfile() { Save.write(profile); }
