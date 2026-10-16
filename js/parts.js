'use strict';
/* ==========================================================================
   parts.js : ระบบชิ้นส่วนหุ่น (Wanzer Parts) — ข้อมูลพาร์ท + การคำนวณสเตตัสรวม
   - WANZER_PARTS  ข้อมูลพาร์ทแยกหมวด หัว/ลำตัว/แขน/ขา/แพ็กหลัง
     (ไอดีซ้ำข้ามหมวดได้ เช่น zeriot_1 มีทั้งหัวและลำตัว จึงอ้างอิงด้วย "หมวด + ไอดี" เสมอ)
     ตัวแรกของทุกหมวด (id "basic") คือพาร์ทสี่เหลี่ยมธรรมดาที่สวมอยู่ตั้งแต่เริ่มเกม ราคา 0 โบนัสกลางๆ
   - player.equippedParts  พาร์ทที่สวมอยู่ { HEAD: id, BODY: id, ARMS: id, LEGS: id, BACKPACK: id }
     (เป็นออบเจกต์เดียวกับ profile.equippedParts จึงถูกเซฟลง LocalStorage ทุกครั้งที่สวมใส่/ซื้อ)
   - profile.ownedParts    พาร์ทที่ซื้อแล้ว { HEAD: [id...], ... }
   ========================================================================== */

const WANZER_PARTS = {
  HEAD: [
    { id: "basic", name: "Basic Block", price: 0, hpBonus: 0, weight: 0 },
    { id: "zeriot_1", name: "Zeriot I", price: 150, hpBonus: 10, weight: 5 },
    { id: "zeriot_2", name: "Zeriot II", price: 300, hpBonus: 25, weight: 8 },
    { id: "hammer_1", name: "Hammer I", price: 200, hpBonus: 40, weight: 20, spriteUrl: "assets/parts/head_hammer.png" },
	{ id: "megaz", name: "MegaZ", price: 1000, hpBonus: 100, weight: 40, spriteUrl: "assets/parts/head_megaz.png" }
  ],
  BODY: [
    { id: "basic", name: "Basic Block", price: 0, hpBonus: 0, energy: 100, maxLoad: 30 },
    { id: "zeriot_1", name: "Zeriot I", price: 250, hpBonus: 30, energy: 100, maxLoad: 50 },
    { id: "hammer_1", name: "Hammer I", price: 350, hpBonus: 70, energy: 70, maxLoad: 80, spriteUrl: "assets/parts/body_hammer.png" },
	{ id: "megaz", name: "MegaZ", price: 1000, hpBonus: 100, energy: 130, maxLoad: 100, spriteUrl: "assets/parts/body_megaz.png" }
  ],
  ARMS: [
    { id: "basic", name: "Basic Block", price: 0, damageBonus: 1.0, weight: 0 },
    { id: "zeriot_1", name: "Zeriot I", price: 150, damageBonus: 1.05, weight: 8 },
    { id: "hammer_1", name: "Hammer I", price: 200, damageBonus: 1.15, weight: 15, spriteUrl: "assets/parts/arms_hammer.png" },
	{ id: "megaz", name: "MegaZ", price: 1000, damageBonus: 1.4, weight: 30, spriteUrl: "assets/parts/arms_megaz.png" }
  ],
  LEGS: [
    { id: "basic", name: "Basic Block", price: 0, speedBonus: 1.0, boostBonus: 1.0, weight: 0,  maxLoad: 0 },
    { id: "zeriot_1", name: "Zeriot I", price: 150, speedBonus: 1.1, boostBonus: 1.1, weight: 5,  maxLoad: 8 },
    { id: "hammer_1", name: "Hammer I", price: 200, speedBonus: 0.9, boostBonus: 0.8, weight: 13,  maxLoad: 30, spriteUrl: "assets/parts/legs_hammer.png" },
	{ id: "megaz", name: "MegaZ", price: 1000, speedBonus: 1.4, boostBonus: 1.3, weight: 25,  maxLoad: 60, spriteUrl: "assets/parts/legs_megaz.png" }
  ],
  SHOULDERS: [
    { id: "basic", name: "Basic Block", price: 0, hpBonus: 10, weight: 0, spriteUrl: "assets/parts/basic_shoulder.png" },
    { id: "zeriot_1", name: "Zeriot Shoulder I", price: 100, hpBonus: 18, weight: 4, spriteUrl: "assets/parts/shoulder_zeriot.png" },
    { id: "hammer_1", name: "Hammer I", price: 180, hpBonus: 25, weight: 12, spriteUrl: "assets/parts/shoulder_hammer.png" },
	{ id: "megaz", name: "MegaZ Shoulder", price: 1000, hpBonus: 50, weight: 30, spriteUrl: "assets/parts/shoulder_megaz.png" }
  ],
  BACKPACK: [
    { id: "basic", name: "Basic Block", price: 0, boostDuration: 3.0, weight: 0, maxLoad: 0 },
    { id: "vernier_1", name: "Vernier I", price: 200, boostDuration: 4.0, weight: 4, maxLoad: 15 },
    { id: "turbo_1", name: "Turbo I", price: 350, boostDuration: 5.5, weight: 7, maxLoad: 25 },
	{ id: "hammer_1", name: "Hammer", price: 400, boostDuration: 6.5, weight: 12, maxLoad: 30, spriteUrl: "assets/parts/backpack_hammer.png" },
	{ id: "megaz", name: "MegaZ", price: 1000, boostDuration: 7.5, weight: 15, maxLoad: 50 }
  ]
};

const PART_CATEGORIES = ['HEAD', 'BODY', 'ARMS', 'LEGS', 'BACKPACK', 'SHOULDERS'];   // ไหล่เป็นหมวดที่ 6 (ตัวแรกของหมวด = ชิ้นเริ่มต้นที่มีให้ฟรี)
const PART_CAT_LABEL = { HEAD: 'หัว', BODY: 'ลำตัว', ARMS: 'แขน', LEGS: 'ขา', BACKPACK: 'แพ็กหลัง', SHOULDERS: 'ไหล่' };

// ---------- ค่าที่ใช้คำนวณสเตตัสรวม (ปรับสมดุลที่นี่) ----------
const WEIGHT_SPEED_PENALTY = 0.003;   // น้ำหนักรวม 1 หน่วย ลดความเร็วเดิน 0.3% (น้ำหนัก 50 = -15%)
const WEIGHT_FUEL_PENALTY = 0.002;    // น้ำหนักรวม 1 หน่วย ลดเกจไอพ่น 0.2% (น้ำหนัก 50 = -10%)

// สีประจำซีรีส์ของพาร์ท (ซีรีส์ = ส่วนหน้าของ id ก่อน "_") ใช้วาดตัวหุ่นในด่านและโมเดลใน Hangar
const SERIES_COLORS = {
  basic:   '#6d7a47',   // สี่เหลี่ยมธรรมดา (สีเดิมของหุ่น)
  zeriot:  '#4A5D4E',   // เขียวขี้ม้าทหาร
  hammer:  '#2D3238',   // เทาเกราะเหล็กเหลว
  vernier: '#4a7f8c',   // แพ็กหลังไอพ่นฟ้าอมเขียว
  turbo:   '#a8552a'    // แพ็กหลังเทอร์โบส้มสนิม
};
function partColor(cat) {
  const series = String(profile.equippedParts[cat]).split('_')[0];
  return SERIES_COLORS[series] || SERIES_COLORS.basic;
}
const ENERGY_BASE = 100;              // พลังงานลำตัวมาตรฐาน: energy 100 = รีชาร์จ Booster 100%, energy 70 = 70%

// ---------- รูปภาพของพาร์ท (spriteUrl) ----------
// โหลดครั้งแรกที่ถูกเรียก ถ้ายังไม่มีไฟล์/โหลดไม่สำเร็จจะคืน null เพื่อให้ผู้เรียกวาดแบบเวกเตอร์สำรองแทน
// ไฟล์ในโฟลเดอร์ assets/ ถูกฝังเป็น data URI ใน EMBEDDED_ASSETS ตอน build (python3 build.py) จึงยังเป็นไฟล์เดียว
const PART_IMAGES = {};
function partImage(url) {
  if (!url) return null;
  let e = PART_IMAGES[url];
  if (!e) {
    e = PART_IMAGES[url] = { img: new Image(), ok: false };
    e.img.onload = function () { e.ok = e.img.naturalWidth > 0; };
    e.img.onerror = function () { e.ok = false; };
    e.img.src = (typeof EMBEDDED_ASSETS !== 'undefined' && EMBEDDED_ASSETS[url]) || url;
  }
  return e.ok ? e.img : null;
}
// ไว้เช็กใน Console ของเบราว์เซอร์ (F12): missingAssets() = รายชื่อไฟล์ภาพที่เกมพยายามโหลดแต่ไม่เจอ (ชื่อไฟล์/โฟลเดอร์ไม่ตรง)
function missingAssets() { return Object.keys(PART_IMAGES).filter(function (u) { return !PART_IMAGES[u].ok; }); }

// ---------- ชิ้นส่วนหุ่นแบบ "ชิ้นขนาดอิสระ + จุดต่อ" (Rig) ----------
// แต่ละชิ้นเป็น PNG ขนาดเท่าไหร่ก็ได้ (ตัดขอบชิดชิ้นงาน ความละเอียดเท่าไหร่ก็ได้) โค้ดย่อให้สูงตาม SPRITE_H แล้ววางตามจุดต่อ
// at = จุดบนตัวหุ่นในพิกเซลเกม (x = ไปข้างหน้า, y = สูงจากเท้า) / a = จุดต่อบนภาพชิ้นนั้น เป็นสัดส่วน 0..1 ของภาพที่วาดไว้
const ART_FACES_LEFT = true;       // ภาพที่วาดหันซ้าย (โค้ดพลิกให้เอง)  ถ้าวาดหันขวาเปลี่ยนเป็น false
const SPRITE_H = { LEGS: 45, BODY: 31, HEAD: 8, SHOULDERS: 13.5, ARMS: 37, BACKPACK: 27 };   // ความสูงของแต่ละชิ้นในเกม (พิกเซลเกม)
const RIG = {
  LEGS:      { a: [0.5, 1.0],   at: [0, 0] },        // กึ่งกลางเท้า ชิดพื้น
  BODY:      { a: [0.58, 0.97], at: [0, 33] },       // กึ่งกลางสะโพก ที่ขอบบนของขา
  HEAD:      { a: [0.6, 0.9],   at: [-2, 63] },      // คางหัว ที่คอ
  SHOULDERS: { a: [0.5, 0.5],   at: [0, 55] },       // กลางไหล่ ที่ข้างอกลำตัว
  ARMS:      { a: [0.5, 0.12],  at: [0, 55], hand: [0.28, 0.95] },   // hand = ปลายมือบนภาพแขน (จุดที่อาวุธจับ)       // กลางข้อต่อไหล่บนแขน = จุดหมุนเล็งปืน (ภาพแขนวาดห้อยลง)
  BACKPACK:  { a: [0.2, 0.35],  at: [-9, 58] }       // จุดยึดบนแพ็กหลัง ที่หลังลำตัว
};
// ขารูปแบบพิเศษ (ขาสั้น ขาแมงมุม ตีนตะขาบ สี่ขา): ใส่ rig:{...} ในข้อมูลขาแต่ละชิ้น ช่องที่ไม่ใส่ใช้ค่าตั้งต้น
//   h = ความสูงภาพขา (พิกเซลเกม)   hip = สูงจากพื้นถึงสะโพกที่ลำตัววาง (ตั้งต้น 33; ขาสั้นลดลง = ลำตัว/หัว/แขน/พอด/ตำแหน่งยิงลดตาม)
//   hipX = เลื่อนลำตัวไปข้างหน้า (+) หรือหลัง (-) จากกึ่งกลางภาพขา (ขาม้า)   bob = ความแรงท่าย่อ/เด้ง/หายใจ (0 = ไม่เด้ง ขาแมงมุม)
// ใช้เฉพาะเมื่อมีภาพของขาชิ้นนั้นแล้ว (ยังไม่วาดภาพ = ใช้ค่าตั้งต้นกับภาพขาตั้งต้น)
const LEG_RIG_DEFAULT = { h: SPRITE_H.LEGS, hip: 33, hipX: 0, bob: 1 };
function legRig() {
  const id = profile.equippedParts.LEGS, part = findPart('LEGS', id);
  if (!part || !part.rig || !partImage(partSpriteUrl('LEGS', id))) return LEG_RIG_DEFAULT;
  return Object.assign({}, LEG_RIG_DEFAULT, part.rig);
}
const POD_AT = { x: -13, y: 62 };                      // จุดหมุนมิสไซล์พอดบนหลังคาไหล่
const ARM_REACH = 16;                                // ระยะจากหัวไหล่ถึงมือที่ถือปืน (พิกเซลเกม)
// ภาพอาวุธ: ขนาดอิสระ วาดหันซ้าย (ปากกระบอกอยู่ซ้าย) ย่อให้ยาว len พิกเซลเกม วางจุด grip (สัดส่วนบนภาพ = ด้ามจับที่มือกำ) ไว้ที่ปลายมือ ปากกระบอกที่ x = muzzle
const WEAPON_ART = {
  MACHINE_GUN: { len: 30, grip: [0.85, 0.50], muzzle: 0.02, name: 'machine_gun' },
  SHOTGUN:     { len: 50, grip: [0.65, 0.42], muzzle: 0.01, name: 'shotgun' },
  RIFLE:       { len: 60, grip: [0.73, 0.45], muzzle: 0.00, name: 'rifle' },
  LASER:       { len: 22, grip: [0.55, 0.50], muzzle: 0.03, name: 'laser' },
  BATON:       { len: 40, grip: [0.85, 0.50], muzzle: 0.00, name: 'baton', rot: 90 },       // กระบอง: หัวกระบองซ้าย ด้ามขวา จับที่ด้าม
  KNUCKLE:     {   len: 17, grip: [0.85, 0.40], muzzle: 0.00, name: 'knuckle', front: true, rot: 0 },     // สนับมือ: ชิ้นเล็กติดที่กำปั้น
  POD:         { len: 12, grip: [0.50, 0.50], muzzle: 0.00, name: 'pod' }
};
function weaponArt(w) { return w.slot === 'gun' ? (WEAPON_ART[w.artKey] || WEAPON_ART[w.type]) : WEAPON_ART.POD; }

// ชื่อไฟล์ภาพของพาร์ท: ใช้ spriteUrl ในข้อมูลก่อน (ไหล่) ไม่มีก็ assets/parts/หมวด_ไอดี.png  suffix เช่น '_far' (ขาข้างไกล)
function partSpriteUrl(cat, id, suffix) {
  const p = findPart(cat, id);
  suffix = suffix || '';
  if (p && p.spriteUrl) return p.spriteUrl.replace(/\.png$/, suffix + '.png');
  return 'assets/parts/' + cat.toLowerCase() + '_' + id + suffix + '.png';
}
// ภาพของพาร์ทที่สวมอยู่ ถ้ารุ่นนั้นยังไม่มีภาพ ใช้ภาพของพาร์ทตั้งต้นของหมวดแทน (หุ่นจะไม่กลับเป็นสี่เหลี่ยมเวลาสลับไปรุ่นที่ยังไม่ได้วาด)
function equippedPartImage(cat, suffix) {
  return partImage(partSpriteUrl(cat, profile.equippedParts[cat], suffix)) ||
         partImage(partSpriteUrl(cat, WANZER_PARTS[cat][0].id, suffix));
}
// โหมดภาพ = มีภาพลำตัวที่สวมอยู่ (ไม่มีก็ใช้หุ่นเวกเตอร์ชั่วคราว) ที่เหลือชิ้นไหนไม่มีภาพจะไม่ถูกวาดในโหมดภาพ
function artMode() { return !!equippedPartImage('BODY'); }
// ภาพอาวุธ: ลองตามไอดี (gun_ak_3.png) > ซีรีส์ (gun_ak.png) > ประเภท (gun_machine_gun.png / missile_pod.png)
function weaponImage(w) {
  const gun = w.slot === 'gun', base = 'assets/weapons/' + (gun ? 'gun_' : 'missile_');
  const series = gun ? w.id.split('_')[0] : w.type.toLowerCase();
  return partImage(base + w.id + '.png') || partImage(base + series + '.png') || partImage(base + weaponArt(w).name + '.png');
}
// ระยะจากมือถึงปากกระบอกของอาวุธ (พิกเซลเกม) ใช้คำนวณจุดที่กระสุนออก
function weaponMuzzleReach(w) { const a = weaponArt(w); return (a.grip[0] - a.muzzle) * a.len; }

function partList(cat) { return WANZER_PARTS[cat]; }
function findPart(cat, id) {
  const list = WANZER_PARTS[cat];
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
function partTier(cat, id) {                      // ลำดับของพาร์ทในหมวด (0 = Basic) ใช้เลือกรูปร่างโมเดลใน Hangar
  const list = WANZER_PARTS[cat];
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return i;
  return 0;
}

function defaultEquippedParts() {
  const o = {};
  for (const c of PART_CATEGORIES) o[c] = WANZER_PARTS[c][0].id;
  return o;
}
function defaultOwnedParts() {
  const o = {};
  for (const c of PART_CATEGORIES) o[c] = [WANZER_PARTS[c][0].id];
  return o;
}

function partOwned(cat, id) { return profile.ownedParts[cat].indexOf(id) >= 0; }
function partEquipped(cat, id) { return profile.equippedParts[cat] === id; }
function equippedPart(cat) { return findPart(cat, profile.equippedParts[cat]) || WANZER_PARTS[cat][0]; }

// ---------- สเตตัสรวมจากพาร์ททั้งหมดที่สวมอยู่ ----------
// สเตตัสในด่านทุกตัวอ่านจากฟังก์ชันเหล่านี้ (เรียกใหม่ทุกครั้ง จึงเปลี่ยนพาร์ทแล้วมีผลทันทีในด่านถัดไป)
function partsHpBonus() { return equippedPart('HEAD').hpBonus + equippedPart('BODY').hpBonus + equippedPart('SHOULDERS').hpBonus; }
// ---------- น้ำหนัก (Weight & Load) ----------
// น้ำหนักรวม = weight ของหัว + แขน + ขา + แพ็กหลัง (ไม่นับลำตัว) ส่วนลำตัวกำหนด maxLoad ที่รับได้
// + น้ำหนักอาวุธที่ติดตั้ง (ปืน + มิสไซล์ ดู weapondb.js)
// parts = { HEAD: id, ... }, weapons = { gun: id, missile: id } (ไม่ใส่ = ที่สวมอยู่ตอนนี้) ใช้ลองคำนวณก่อนสวมได้
function calculateTotalWeight(parts, weapons) {
  parts = parts || profile.equippedParts;
  let total = weaponsWeight(weapons);
  for (const c of ['HEAD', 'ARMS', 'LEGS', 'BACKPACK', 'SHOULDERS']) {
    const p = findPart(c, parts[c]);
    total += p ? p.weight : 0;
  }
  return total;
}
// น้ำหนักที่รับได้รวม = maxLoad ของลำตัว + maxLoad ของแพ็กหลัง (แพ็กหลังช่วยแบกด้วย แต่ตัวมันเองก็มี weight)
function partsMaxLoad(parts) {
  parts = parts || profile.equippedParts;
  let total = 0;
  for (const c of ['BODY', 'LEGS', 'BACKPACK']) {
    const p = findPart(c, parts[c]);
    total += p && p.maxLoad ? p.maxLoad : 0;
  }
  return total;
}
function isOverweight(parts, weapons) { return calculateTotalWeight(parts, weapons) > partsMaxLoad(parts); }   // เกิน = กด LAUNCH ไม่ได้
function partsWeight() { return calculateTotalWeight(); }
function partsFuelWeightMult() { return Math.max(0.3, 1 - calculateTotalWeight() * WEIGHT_FUEL_PENALTY); }
function partsSpeedMult() { return Math.max(0.3, equippedPart('LEGS').speedBonus * (1 - calculateTotalWeight() * WEIGHT_SPEED_PENALTY)); }
function partsBoostMult() { return equippedPart('LEGS').boostBonus; }            // แรงพุ่ง Dash (ขา)
function partsDamageMult() { return equippedPart('ARMS').damageBonus; }          // พลังโจมตี (แขน)
function partsBoostSeconds() { return equippedPart('BACKPACK').boostDuration; }  // เวลาบินของ Booster (แพ็กหลัง)
function partsEnergyMult() { return equippedPart('BODY').energy / ENERGY_BASE; } // ความเร็วชาร์จ Booster (ลำตัว)

// ---------- ซื้อ / สวมใส่ ----------
// คืน { ok, msg }  ซื้อ = หักเงินจริง + สวมใส่ทันที + เซฟลง LocalStorage  /  พาร์ทที่มีแล้ว = สลับมาสวมฟรี
function partState(cat, id) {
  if (partEquipped(cat, id)) return 'equipped';
  if (partOwned(cat, id)) return 'owned';
  return profile.gold >= findPart(cat, id).price ? 'buy' : 'poor';
}

function buyOrEquipPart(cat, id) {
  const part = findPart(cat, id);
  if (!part) return { ok: false, msg: 'ไม่พบชิ้นส่วนนี้' };
  const st = partState(cat, id);
  if (st === 'equipped') return { ok: false, msg: 'สวม ' + part.name + ' (' + PART_CAT_LABEL[cat] + ') อยู่แล้ว' };
  if (st === 'poor') return { ok: false, msg: 'Credits ไม่พอ ต้องการอีก ' + (part.price - profile.gold) };
  let msg;
  if (st === 'buy') {
    profile.gold -= part.price;                       // หักเงินจริง
    profile.ownedParts[cat].push(id);
    msg = 'ซื้อและสวม ' + part.name + ' (' + PART_CAT_LABEL[cat] + ') แล้ว  (-' + part.price + ' CR)';
  } else {
    msg = 'สวม ' + part.name + ' (' + PART_CAT_LABEL[cat] + ') แล้ว';
  }
  profile.equippedParts[cat] = id;                    // player.equippedParts ชี้ออบเจกต์เดียวกัน
  saveProfile();                                      // เซฟทันที
  return { ok: true, msg: msg };
}

// ข้อความสเตตัสของพาร์ท 1 ชิ้นสำหรับการ์ดใน Hangar
function partStatsText(cat, p) {
  if (cat === 'SHOULDERS') return 'HP +' + p.hpBonus + '   น้ำหนัก ' + p.weight;
  if (cat === 'HEAD') return 'HP +' + p.hpBonus + '   น้ำหนัก ' + p.weight;
  if (cat === 'BODY') return 'HP +' + p.hpBonus + '   พลังงาน ' + p.energy + '   รับน้ำหนักได้ ' + p.maxLoad;
  if (cat === 'ARMS') return 'พลังโจมตี x' + p.damageBonus.toFixed(2) + '   น้ำหนัก ' + p.weight;
  if (cat === 'LEGS') return 'ความเร็ว x' + p.speedBonus.toFixed(2) + '   Boost x' + p.boostBonus.toFixed(2) + '   น้ำหนัก ' + p.weight+ '   รับน้ำหนักได้ ' + p.maxLoad;
  return 'Booster บินได้ ' + p.boostDuration.toFixed(1) + ' วิ   น้ำหนัก ' + p.weight + '   รับน้ำหนัก +' + p.maxLoad;
}
