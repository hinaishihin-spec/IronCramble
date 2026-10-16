'use strict';
/* ==========================================================================
   chipdata.js + chips.js : Chip ทักษะ (ติดตั้งได้ 1 ชิ้น ไม่มีน้ำหนัก)  profile.equippedChip / profile.ownedChips
   - Chip แบบ "สุ่มเกิด" (proc): ตอนโจมตีมีโอกาสเกิดทักษะพิเศษ เปอร์เซ็นต์ขึ้นกับระดับ I / II / III
       AP        ยิงทะลุเกราะ (กระสุนนัดนั้นไม่โดนเกราะลดดาเมจ)      GUN2      ยิงคู่ด้วยปืนในมือ (ยิงซ้ำอีกนัด)
       BATON2    ตีคู่ (เฉพาะกระบอง)   KNUCKLE2  ต่อยคู่ (เฉพาะสนับมือ)
       POD2      ยิงมิสไซล์คู่สองไหล่  HR / HL   ยิงปืน + มิสไซล์ไหล่ขวา / ไหล่ซ้ายพร้อมกัน
     ทักษะมิสไซล์ใช้ได้เมื่อไหล่ขวาถือมิสไซล์ชนิด POD2_TYPES (missile2.js) เท่านั้น
   - Chip แบบเพิ่มค่า (passive): ปืนแรงขึ้น GUN / ทุบแรงขึ้น SMASH (อาวุธประชิด) / HP / ลดดาเมจ DEF / Boost (แรงพุ่ง Dash)
   - แต่ละทักษะมีช่วงพักภายใน CHIP_ICD วินาที กันปืนกลเกิดทักษะรัว ๆ  เกิดแล้วขึ้นข้อความ + แถบ CHIP บน HUD กะพริบ
   - ซื้อ/ปลดล็อกแบบอาวุธ: ราคา + ต้องชนะบอสด่าน unlock.mission ตามจำนวนครั้ง (ระดับ II / III ต้องเคลียร์มากขึ้น)
   chipdata.js = ข้อมูล/การซื้อ-สวม (โหลดก่อน save.js เพราะเซฟต้องรู้จักชิป)  chips.js = ผลของชิปในเกม+UI Hangar (โหลดหลังไฟล์อื่นทั้งหมดก่อน main.js เพราะครอบฟังก์ชันของ player/upgrades/partext/parts)
   ========================================================================== */

const CHIP_ICD = 0.8;               // ช่วงพักของแต่ละทักษะหลังเกิด (วินาที)
const CHIP_TWIN_DELAY = 0.09;       // ยิงคู่: นัดที่สองตามหลังนัดแรกกี่วินาที
const CHIP_MELEE_DELAY = 0.18;      // ตี/ต่อยคู่: ครั้งที่สองตามหลังกี่วินาที
const CHIP_LV_CLEARS = [1, 3, 6];   // จำนวนครั้งที่ต้องชนะบอสของด่านปลดล็อก สำหรับระดับ I / II / III
const CHIP_PRICE_PASSIVE = [400, 900, 1800];
const CHIP_PRICE_PROC = [600, 1400, 2800];
const CHIP_COLOR = '#7fe8ff';

// kind: 'proc' (vals = โอกาส 0-1) / 'pass' (vals = ค่าที่เพิ่ม)  mission = ด่านของบอสที่ปลดล็อก
const CHIP_FAMILIES = [
  { key: 'HP',      name: 'Vital Chip',    kind: 'pass', mission: 1, short: 'เพิ่ม Max HP', vals: [15, 30, 45],       desc: function (v) { return 'Max HP +' + v; } },
  { key: 'GUN',     name: 'Gun Power',     kind: 'pass', mission: 2, short: 'ปืนแรงขึ้น', vals: [0.08, 0.12, 0.16], desc: function (v) { return 'ดาเมจปืน +' + Math.round(v * 100) + '%'; } },
  { key: 'SMASH',   name: 'Smash Power',   kind: 'pass', mission: 2, short: 'ทุบแรงขึ้น (ประชิด)', vals: [0.10, 0.15, 0.20], desc: function (v) { return 'ดาเมจกระบอง/สนับมือ +' + Math.round(v * 100) + '%'; } },
  { key: 'DEF',     name: 'Plating Chip',  kind: 'pass', mission: 3, short: 'ลดดาเมจที่ได้รับ', vals: [0.03, 0.05, 0.07], desc: function (v) { return 'ลดดาเมจที่ได้รับ ' + Math.round(v * 100) + '%'; } },
  { key: 'BOOST',   name: 'Boost Core',    kind: 'pass', mission: 3, short: 'เพิ่มแรงพุ่ง', vals: [0.06, 0.10, 0.14], desc: function (v) { return 'แรงพุ่ง Boost +' + Math.round(v * 100) + '%'; } },
  { key: 'AP',      name: 'Pierce Shot',   kind: 'proc', mission: 4, short: 'ยิงทะลุเกราะ', vals: [0.10, 0.15, 0.20], desc: function (v) { return 'ยิงทะลุเกราะ ' + Math.round(v * 100) + '% / นัด'; } },
  { key: 'GUN2',    name: 'Twin Shot',     kind: 'proc', mission: 5, short: 'ยิงคู่ปืนในมือ', vals: [0.10, 0.15, 0.20], desc: function (v) { return 'ยิงคู่ปืนในมือ ' + Math.round(v * 100) + '%'; } },
  { key: 'POD2',    name: 'Twin Pods',     kind: 'proc', mission: 6, short: 'มิสไซล์คู่สองไหล่', vals: [0.10, 0.15, 0.20], desc: function (v) { return 'มิสไซล์คู่สองไหล่ ' + Math.round(v * 100) + '%'; } },
  { key: 'BATON2',  name: 'Twin Baton',    kind: 'proc', mission: 7, short: 'ตีคู่ (กระบอง)', vals: [0.10, 0.15, 0.20], desc: function (v) { return 'ตีคู่ (กระบอง) ' + Math.round(v * 100) + '%'; } },
  { key: 'KNUCKLE2', name: 'Twin Fist',    kind: 'proc', mission: 7, short: 'ต่อยคู่ (สนับมือ)', vals: [0.10, 0.15, 0.20], desc: function (v) { return 'ต่อยคู่ (สนับมือ) ' + Math.round(v * 100) + '%'; } },
  { key: 'HR',      name: 'Hand+R.Pod',    kind: 'proc', mission: 8, short: 'ปืน + มิสไซล์ไหล่ขวา', vals: [0.10, 0.15, 0.20], desc: function (v) { return 'ปืน+มิสไซล์ไหล่ขวา ' + Math.round(v * 100) + '%'; } },
  { key: 'HL',      name: 'Hand+L.Pod',    kind: 'proc', mission: 9, short: 'ปืน + มิสไซล์ไหล่ซ้าย', vals: [0.10, 0.15, 0.20], desc: function (v) { return 'ปืน+มิสไซล์ไหล่ซ้าย ' + Math.round(v * 100) + '%'; } }
];
const CHIP_ROMAN = ['I', 'II', 'III'];

// ขยายเป็นรายชิ้น: id = key ตัวเล็ก + _ + ระดับ (เช่น ap_2)
const CHIP_LIST = [];
for (const f of CHIP_FAMILIES) {
  for (let i = 0; i < 3; i++) {
    CHIP_LIST.push({
      id: f.key.toLowerCase() + '_' + (i + 1), fam: f.key, kind: f.kind, lv: i + 1, v: f.vals[i],
      name: f.name + ' ' + CHIP_ROMAN[i], text: f.desc(f.vals[i]),
      price: (f.kind === 'proc' ? CHIP_PRICE_PROC : CHIP_PRICE_PASSIVE)[i],
      unlock: { mission: f.mission, clears: CHIP_LV_CLEARS[i] }
    });
  }
}

function findChip(id) { for (let i = 0; i < CHIP_LIST.length; i++) if (CHIP_LIST[i].id === id) return CHIP_LIST[i]; return null; }
function chipFamily(key) { for (let i = 0; i < CHIP_FAMILIES.length; i++) if (CHIP_FAMILIES[i].key === key) return CHIP_FAMILIES[i]; return null; }
function equippedChip() { return findChip(profile.equippedChip); }
function chipOwned(id) { return !!profile.ownedChips && profile.ownedChips.indexOf(id) >= 0; }
function chipLock(id) {
  const c = findChip(id);
  if (!c || !c.unlock) return null;
  const have = clearsOf(c.unlock.mission);
  return have >= c.unlock.clears ? null : { mission: c.unlock.mission, need: c.unlock.clears, have: have, left: c.unlock.clears - have };
}
// 'equipped' | 'owned' | 'locked' | 'buy' | 'poor'
function chipState(id) {
  if (profile.equippedChip === id) return 'equipped';
  if (chipOwned(id)) return 'owned';
  if (chipLock(id)) return 'locked';
  return profile.gold >= findChip(id).price ? 'buy' : 'poor';
}
// กดชิป: ซื้อ (ถ้ายังไม่มี) แล้วสวม / สวมอยู่แล้วกดซ้ำ = ถอด (ช่องเดียว)
function buyOrEquipChip(id) {
  const c = findChip(id);
  if (!c) return { ok: false, msg: 'ไม่พบชิปนี้' };
  const st = chipState(id);
  if (st === 'equipped') { profile.equippedChip = null; saveProfile(); return { ok: true, msg: 'ถอด ' + c.name + ' แล้ว' }; }
  if (st === 'locked') { const lk = chipLock(id); return { ok: false, msg: 'ยังล็อก: ต้องชนะบอสด่าน ' + lk.mission + ' อีก ' + lk.left + ' ครั้ง (' + lk.have + ' / ' + lk.need + ')' }; }
  if (st === 'poor') return { ok: false, msg: 'Credits ไม่พอ ต้องการอีก ' + (c.price - profile.gold) };
  let msg;
  if (st === 'buy') { profile.gold -= c.price; profile.ownedChips.push(id); msg = 'ซื้อและสวม ' + c.name + ' แล้ว  (-' + c.price + ' CR)'; }
  else msg = 'สวม ' + c.name + ' แล้ว';
  profile.equippedChip = id;
  saveProfile();
  return { ok: true, msg: msg + '  ' + c.text };
}

