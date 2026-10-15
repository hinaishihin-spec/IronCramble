'use strict';
/* ==========================================================================
   weapondb.js : ฐานข้อมูลอาวุธ + การซื้อ/สวมใส่ (ระบบ 2 ช่อง: ปืน Handheld / มิสไซล์ Backpack)
   - WEAPON_DATABASE   ข้อมูลอาวุธทุกกระบอก แยกตามช่อง (GUNS / MISSILES) และประเภท
       fireRate = เวลาระหว่างนัดเป็นมิลลิวินาที (น้อย = ยิงเร็ว)   weight = น้ำหนักที่นับรวมใน calculateTotalWeight()
   - player.equippedWeapon = { gun: id, missile: id }  (ออบเจกต์เดียวกับ profile.equippedWeapon จึงถูกเซฟลง LocalStorage)
   - profile.ownedWeapons  = [id, ...] อาวุธที่ซื้อแล้ว  ผู้เล่นสวมได้ช่องละ 1 กระบอกเท่านั้น
   ========================================================================== */

const WEAPON_DATABASE = {
  GUNS: {
    MACHINE_GUN: [
      // ซีรีส์ AK - เน้นสมดุล (fireRate คือมิลลิวินาทีต่อการยิง 1 นัด)
      { id: "ak_1", name: "AK I", price: 150, damage: 8, fireRate: 100, weight: 10 },
      { id: "ak_2", name: "AK II", price: 300, damage: 14, fireRate: 90, weight: 12 },
      { id: "ak_3", name: "AK III", price: 500, damage: 22, fireRate: 85, weight: 15 },

      // ซีรีส์ Ares - เน้นยิงรัวเร็วกระสุนท่วมฉาก น้ำหนักเบา
      { id: "ares_1", name: "Ares I", price: 200, damage: 6, fireRate: 60, weight: 7 },
      { id: "ares_2", name: "Ares II", price: 380, damage: 11, fireRate: 50, weight: 9 },
      { id: "ares_3", name: "Ares III", price: 580, damage: 18, fireRate: 45, weight: 11 },

      // ซีรีส์ BORZ - เน้นดาเมจหนัก ยิงทะลวงเกราะ แต่ปืนหนักมาก
      { id: "borz_1", name: "BORZ I", price: 250, damage: 12, fireRate: 140, weight: 16 },
      { id: "borz_2", name: "BORZ II", price: 420, damage: 20, fireRate: 130, weight: 20 },
      { id: "borz_3", name: "BORZ III", price: 650, damage: 32, fireRate: 120, weight: 25 }
    ],
    SHOTGUN: [
      // ซีรีส์ Henry - ราคาประหยัด น้ำหนักเบา
      { id: "henry_1", name: "Henry I", price: 180, damage: 5, pellets: 5, fireRate: 600, weight: 9 },
      { id: "henry_2", name: "Henry II", price: 290, damage: 9, pellets: 5, fireRate: 550, weight: 11 },
      { id: "henry_3", name: "Henry III", price: 450, damage: 15, pellets: 5, fireRate: 500, weight: 13 },

      // ซีรีส์ Winchester - ดาเมจต่อนัดและแรงผลัก (Knockback) สูงสุด
      { id: "winchester_1", name: "Winchester I", price: 240, damage: 7, pellets: 5, fireRate: 700, weight: 14 },
      { id: "winchester_2", name: "Winchester II", price: 380, damage: 13, pellets: 5, fireRate: 650, weight: 18 },
      { id: "winchester_3", name: "Winchester III", price: 550, damage: 22, pellets: 6, fireRate: 600, weight: 22 },

      // ซีรีส์ Benelli - ลูกซองกึ่งอัตโนมัติ ยิงรัวสะใจ
      { id: "benelli_1", name: "Benelli I", price: 260, damage: 6, pellets: 5, fireRate: 400, weight: 12 },
      { id: "benelli_2", name: "Benelli II", price: 400, damage: 11, pellets: 5, fireRate: 350, weight: 15 },
      { id: "benelli_3", name: "Benelli III", price: 580, damage: 18, pellets: 5, fireRate: 300, weight: 19 },

      // ซีรีส์ Fostech - กระสุนกระจายวงกว้าง จำนวนเม็ดเยอะที่สุด
      { id: "fostech_1", name: "Fostech I", price: 300, damage: 5, pellets: 6, fireRate: 500, weight: 15 },
      { id: "fostech_2", name: "Fostech II", price: 460, damage: 9, pellets: 7, fireRate: 450, weight: 19 },
      { id: "fostech_3", name: "Fostech III", price: 620, damage: 14, pellets: 8, fireRate: 400, weight: 24 }
    ],
    RIFLE: [
      { id: "sniper_1", name: "Rifle I", price: 300, damage: 45, fireRate: 1000, weight: 18 }
    ],
    LASER: [
      // beams = จำนวนเส้นลำแสง (damage = ต่อเส้น)  gap = ระยะห่างเส้นขนาน (px)  spread = มุมกางระหว่างเส้นข้างเคียง (องศา)  heatMult = ความร้อนที่เพิ่มเร็วขึ้นกี่เท่า
      { id: "laser_1", name: "Laser I", price: 600, damage: 3, fireRate: 16, weight: 22 },
      { id: "laser_2", name: "Twin Laser", price: 900, damage: 2.4, fireRate: 16, weight: 28, beams: 2, gap: 12, heatMult: 1.15 },
      { id: "laser_3", name: "Triple Laser", price: 1400, damage: 1.8, fireRate: 16, weight: 34, beams: 3, spread: 7, heatMult: 1.3 },
      { id: "laser_5", name: "Penta Laser", price: 2000, damage: 1.3, fireRate: 16, weight: 42, beams: 5, spread: 6, heatMult: 1.6 }
    ],
    MELEE: [
      // อาวุธประชิด (ใช้ช่องปืนเดียวกัน เลือกอย่างใดอย่างหนึ่งที่ Hangar)  คลิกซ้ายฟัน/ต่อยไปทางเมาส์
      // reach = ระยะจากมือ (px)  arc = มุมกว้างของการฟันรวม (องศา)  kb = แรงผลัก (x KNOCKBACK)  artKey = ชื่อตัวตั้งค่าภาพใน WEAPON_ART
      // thrust: true = ชกตรงไปข้างหน้าตามทิศที่หุ่นหัน (ไม่ตามเมาส์) โซนโดนเป็นกล่อง ยาว reach x สูง hitH (แทนรูปพัด arc)
      { id: "baton_1", name: "Stun Baton", price: 250, damage: 42, fireRate: 380, weight: 6, reach: 46, arc: 110, kb: 2.5, artKey: "BATON" },
      { id: "knuckle_1", name: "Knuckle I", price: 200, damage: 34, fireRate: 260, weight: 5, reach: 32, hitH: 36, kb: 2.0, thrust: true, artKey: "KNUCKLE" }
    ]
  },
  MISSILES: {
    SINGLE: [{ id: "single_1", name: "Single Missile I", price: 150, damage: 30, weight: 12 }],
    DUAL: [{ id: "dual_1", name: "Dual Missile I", price: 350, damage: 25, weight: 18 }],
    SWARM: [{ id: "swarm_1", name: "Swarm Missile I", price: 600, damage: 15, count: 6, weight: 25 }],
    // เลเซอร์ติดไหล่: ยิงเป็นช็อตเส้นตรงเส้นเดียว ทะลุศัตรูทุกตัวบนเส้น (ทะลวงเกราะเหมือนมิสไซล์) คูลดาวน์ตาม MISSILE_DELAYS.BEAM
    BEAM: [
      // beams = จำนวนเส้น (damage = ต่อเส้น)  charge/cd = เวลาชาร์จ/คูลดาวน์ของรุ่นนี้ (ไม่ใส่ = BEAM_CHARGE / MISSILE_DELAYS.BEAM)  gap = ระยะห่างเส้นขนาน (px)  unlock = ล็อกจนกว่าชนะบอสด่านนั้นครบกี่ครั้ง (ดู weaponLock)
      { id: "einshander_1", name: "Einshander I", price: 1200, damage: 60, weight: 20 },
      { id: "sweihander_1", name: "Sweihander I", price: 2200, damage: 50, beams: 2, gap: 16, weight: 30, charge: 0.45, cd: 1.8, unlock: { mission: 5, clears: 5 } }
    ],
    // อาวุธโจมตีเป็นจุดจากฟ้า (ดู strike.js)  cd = คูลดาวน์ (วินาที) ยิ่งรุ่นสูงยิ่งสั้น: รุ่น I = 25 / II = 20 / III = 15  delay = เวลาหน่วงก่อนตก
    // ORBITAL: damage ต่อติ๊ก (3 ติ๊ก) radius = ครึ่งความกว้างเสาแสง   NAPALM: damage = แรงระเบิด burn = ดาเมจไฟต่อติ๊ก (ทุก NAPALM_TICK วินาที) fireLife = ไฟลุกกี่วินาที
    ORBITAL: [
      { id: "xbreaker_1", name: "X-Breaker I", price: 3000, damage: 90, radius: 38, cd: 15, delay: 1.3, weight: 28, unlock: { mission: 8, clears: 5 } }
    ],
    NAPALM: [
      { id: "burningrave_1", name: "Burning Rave", price: 2400, damage: 60, burn: 14, fireLife: 6, cd: 20, delay: 1.2, weight: 26, unlock: { mission: 8, clears: 5 } }
    ]
  },
  // โดรนซัพพอร์ต (ช่องที่ 3 เลือกได้ทีละตัว ถอดได้ด้วยการกดตัวที่สวมอยู่) พฤติกรรมอยู่ drone.js  kind = ชนิดการทำงาน  desc = คำอธิบายสั้นในแถว
  DRONES: {
    FLY: [
      { id: "striker_d1", name: "Striker I", kind: "striker", tier: 1, price: 800, weight: 6, desc: "ปืนกลอัตโนมัติ", unlock: { mission: 5, clears: 5 } },
      { id: "striker_d2", name: "Striker II", kind: "striker", tier: 2, price: 1400, weight: 7, desc: "ยิงถี่ขึ้น", unlock: { mission: 8, clears: 5 } },
      { id: "striker_d3", name: "Striker III", kind: "striker", tier: 3, price: 2100, weight: 8, desc: "ยิงเป็นชุด 3 นัด", unlock: { mission: 9, clears: 5 } },
      { id: "sniper_d1", name: "Sniper I", kind: "sniper", tier: 1, price: 1400, weight: 7, desc: "สไนป์นัดแรง ทุก 3 วิ", unlock: { mission: 6, clears: 5 } },
      { id: "sniper_d2", name: "Sniper II", kind: "sniper", tier: 2, price: 2400, weight: 8, desc: "แรงขึ้น ยิงถี่ขึ้น", unlock: { mission: 8, clears: 5 } },
      { id: "sniper_d3", name: "Sniper III", kind: "sniper", tier: 3, price: 3600, weight: 9, desc: "กระสุนทะลุหลายตัว", unlock: { mission: 9, clears: 5 } },
      { id: "recovery_d1", name: "Recovery I", kind: "recovery", tier: 1, price: 1600, weight: 8, desc: "ฟื้น HP ทีละนิด", unlock: { mission: 7, clears: 5 } },
      { id: "recovery_d2", name: "Recovery II", kind: "recovery", tier: 2, price: 2700, weight: 9, desc: "ฟื้น HP เร็วขึ้น", unlock: { mission: 8, clears: 5 } },
      { id: "recovery_d3", name: "Recovery III", kind: "recovery", tier: 3, price: 4200, weight: 10, desc: "ฟื้น HP+โล่ หยุดฟื้นสั้นลง", unlock: { mission: 9, clears: 5 } }
    ],
    BOT: [
      { id: "shooter_d1", name: "Shooter I", kind: "shooter", tier: 1, price: 1000, weight: 10, desc: "ยิงเลเซอร์", unlock: { mission: 5, clears: 5 } },
      { id: "shooter_d2", name: "Shooter II", kind: "shooter", tier: 2, price: 1700, weight: 11, desc: "เลเซอร์ 2 เส้น", unlock: { mission: 8, clears: 5 } },
      { id: "shooter_d3", name: "Shooter III", kind: "shooter", tier: 3, price: 2600, weight: 12, desc: "เลเซอร์ 2 เส้นทะลุ", unlock: { mission: 9, clears: 5 } },
      { id: "assaulter_d1", name: "Assaulter I", kind: "assaulter", tier: 1, price: 1600, weight: 12, desc: "ยิงมิสไซล์ล็อกเป้า", unlock: { mission: 6, clears: 5 } },
      { id: "assaulter_d2", name: "Assaulter II", kind: "assaulter", tier: 2, price: 2700, weight: 13, desc: "มิสไซล์ 2 นัด", unlock: { mission: 8, clears: 5 } },
      { id: "assaulter_d3", name: "Assaulter III", kind: "assaulter", tier: 3, price: 4200, weight: 14, desc: "มิสไซล์ 3 นัด", unlock: { mission: 9, clears: 5 } },
      { id: "charger_d1", name: "Charger I", kind: "charger", tier: 1, price: 1800, weight: 12, desc: "โล่หนาขึ้น x1.3", unlock: { mission: 7, clears: 5 } },
      { id: "charger_d2", name: "Charger II", kind: "charger", tier: 2, price: 3100, weight: 13, desc: "โล่หนาขึ้น x1.5", unlock: { mission: 8, clears: 5 } },
      { id: "charger_d3", name: "Charger III", kind: "charger", tier: 3, price: 4700, weight: 14, desc: "โล่ x1.5 บอทอึดขึ้น ฟื้นไว", unlock: { mission: 9, clears: 5 } }
    ]
  }
};

// ---------- ค่าที่ใช้ยิงจริง (ปรับสมดุลที่นี่) ----------
const WEAPON_SLOTS_LIST = ['gun', 'missile', 'drone'];             // ปุ่ม 1 = ปืน, ปุ่ม 2 = มิสไซล์, ช่องที่ 3 = โดรน (ไม่มีปุ่มยิง ทำงานเอง)
const WEAPON_SLOT_LABEL = { gun: 'ปืน', missile: 'มิสไซล์', drone: 'โดรน' };
const WEAPON_TYPE_LABEL = { MACHINE_GUN: 'ปืนกล', SHOTGUN: 'ลูกซอง', RIFLE: 'ไรเฟิล', LASER: 'เลเซอร์', MELEE: 'ประชิด', SINGLE: 'Single', DUAL: 'Dual', SWARM: 'Swarm', BEAM: 'Beam', ORBITAL: 'Orbital', NAPALM: 'Napalm', FLY: 'โดรนบิน', BOT: 'โดรนบอท' };
const MISSILE_DELAYS = { SINGLE: 0.9, DUAL: 1.1, SWARM: 1.5, BEAM: 1.4 };       // วินาที (ฐานข้อมูลมิสไซล์ไม่มี fireRate)
const RIFLE_SPEED = 1700;       // px/s กระสุนไรเฟิลเร็วกว่าปืนกลเกือบสองเท่า
const RIFLE_LIFE = 0.9;
const RIFLE_PIERCE = 2;         // ทะลุศัตรูได้เพิ่มอีก 2 ตัว (โดนรวม 3 ตัว)
const FOSTECH_STEP = 7 * Math.PI / 180;   // Fostech กระจายกว้างกว่าลูกซองทั่วไป (7° ต่อเม็ด)
// อาวุธโจมตีจากฟ้า (strike.js): ดาเมจใส่บอสคูณ STRIKE_BOSS_MULT / ทำร้ายผู้เล่นที่ยืนในจุดตก (STRIKE_SELF_DMG, กางโล่ลดได้)
const STRIKE_BOSS_MULT = 0.4;
const STRIKE_SELF_DMG = 22, STRIKE_SELF_SHIELD = 14;
const ORBITAL_TICKS = 3, ORBITAL_TICK_GAP = 0.2;                       // เสาแสงโดน 3 ติ๊ก ห่างกัน 0.2 วินาที
const NAPALM_SPREAD = 85, NAPALM_BOMB_GAP = 0.15;                       // ระเบิด 3 ลูกห่างกัน (px) / ตกต่างกันกี่วินาที
const NAPALM_BLAST_R = 55, NAPALM_PATCH_HW = 55;                        // รัศมีระเบิด / ครึ่งความกว้างกองไฟ
const NAPALM_TICK = 0.25, NAPALM_SELF_DMG = 6, NAPALM_SELF_SHIELD = 3;  // ไฟเผาทุกกี่วินาที / ดาเมจต่อติ๊กที่ผู้เล่น (กระโดดข้ามไฟได้)
const BEAM_SHOT_LEN = 780;       // ระยะเลเซอร์ไหล่ (px) ยาวข้ามจอ
const BEAM_CHARGE = 0.35;        // วินาทีที่ชาร์จแสงที่ไหล่ก่อนยิง (คูลดาวน์นับต่อจากตอนปล่อย)
const BEAM_SHOT_LIFE = 0.28;     // วินาทีที่ลำแสงค้างจางหายบนจอ (ดาเมจโดนทีเดียวตอนยิง)
const SWARM_SPREAD = 0.2;       // เรเดียนระหว่างลูกในฝูง
const STARTER_WEAPONS = { gun: 'ak_1', missile: 'single_1' };        // ติดตัวตั้งแต่เริ่มเกม (ฟรี)

// รายการแบนของอาวุธทั้งหมด: { slot:'gun'|'missile', type:'MACHINE_GUN'..., ...ข้อมูลเดิม }
const WEAPON_FLAT = (function () {
  const out = [];
  const groups = { gun: WEAPON_DATABASE.GUNS, missile: WEAPON_DATABASE.MISSILES, drone: WEAPON_DATABASE.DRONES };
  for (const slot of WEAPON_SLOTS_LIST) {
    for (const type in groups[slot]) for (const w of groups[slot][type]) out.push(Object.assign({ slot: slot, type: type }, w));
  }
  return out;
})();

function weaponList(slot) { return WEAPON_FLAT.filter(function (w) { return w.slot === slot; }); }
function findWeapon(id) {
  for (let i = 0; i < WEAPON_FLAT.length; i++) if (WEAPON_FLAT[i].id === id) return WEAPON_FLAT[i];
  return null;
}
function defaultOwnedWeapons() { return [STARTER_WEAPONS.gun, STARTER_WEAPONS.missile]; }
function defaultEquippedWeapon() { return { gun: STARTER_WEAPONS.gun, missile: STARTER_WEAPONS.missile, drone: null }; }

function weaponOwned(id) { return profile.ownedWeapons.indexOf(id) >= 0; }
function weaponEquipped(id) { return profile.equippedWeapon.gun === id || profile.equippedWeapon.missile === id || profile.equippedWeapon.drone === id; }
function equippedGun() { return findWeapon(profile.equippedWeapon.gun) || findWeapon(STARTER_WEAPONS.gun); }
function equippedMissile() { return findWeapon(profile.equippedWeapon.missile) || findWeapon(STARTER_WEAPONS.missile); }

// น้ำหนักอาวุธทั้ง 2 ช่อง (eq = { gun, missile } ไม่ใส่ = ที่สวมอยู่ตอนนี้) ถูกรวมเข้า calculateTotalWeight() ใน parts.js
function weaponsWeight(eq) {
  eq = eq || profile.equippedWeapon;
  const g = findWeapon(eq.gun), m = findWeapon(eq.missile), d = findWeapon(eq.drone);
  return (g ? g.weight : 0) + (m ? m.weight : 0) + (d ? d.weight : 0);
}

// ถ้าอาวุธนี้ยังล็อกอยู่ คืน { mission, need, have, left } / ไม่มีเงื่อนไขหรือปลดแล้ว = null (ซื้อแล้วไม่โดนล็อกย้อนหลัง)
function weaponLock(id) {
  const w = findWeapon(id);
  if (!w || !w.unlock) return null;
  const need = w.unlock.clears || 1, have = clearsOf(w.unlock.mission);
  return have >= need ? null : { mission: w.unlock.mission, need: need, have: have, left: need - have };
}

// 'equipped' | 'owned' | 'locked' | 'buy' | 'poor'
function weaponState(id) {
  if (weaponEquipped(id)) return 'equipped';
  if (weaponOwned(id)) return 'owned';
  if (weaponLock(id)) return 'locked';
  return profile.gold >= findWeapon(id).price ? 'buy' : 'poor';
}

// ซื้อ (หักเงินจริง) แล้วสวมลงช่องของอาวุธนั้นทันที ของเดิมในช่องถูกถอดออก (ยังเป็นของผู้เล่น) / ถ้ามีแล้วคือสลับมาสวมฟรี
function buyOrEquipWeapon(id) {
  const w = findWeapon(id);
  if (!w) return { ok: false, msg: 'ไม่พบอาวุธนี้' };
  const st = weaponState(id);
  if (st === 'equipped' && w.slot === 'drone') {      // โดรน: กดตัวที่สวมอยู่ = ถอดออก (ไม่ใช้โดรน)
    profile.equippedWeapon.drone = null;
    saveProfile();
    return { ok: true, msg: 'ถอด ' + w.name + ' แล้ว (ไม่ใช้โดรน)' };
  }
  if (st === 'equipped') return { ok: false, msg: 'สวม ' + w.name + ' อยู่แล้ว' };
  if (st === 'locked') { const lk = weaponLock(id); return { ok: false, msg: 'ยังล็อก: ต้องชนะบอสด่าน ' + lk.mission + ' อีก ' + lk.left + ' ครั้ง (' + lk.have + ' / ' + lk.need + ')' }; }
  if (st === 'poor') return { ok: false, msg: 'Credits ไม่พอ ต้องการอีก ' + (w.price - profile.gold) };
  let msg;
  if (st === 'buy') {
    profile.gold -= w.price;
    profile.ownedWeapons.push(id);
    msg = 'ซื้อและสวม ' + w.name + ' (ช่อง' + WEAPON_SLOT_LABEL[w.slot] + ') แล้ว  (-' + w.price + ' CR)';
  } else {
    msg = 'สวม ' + w.name + ' (ช่อง' + WEAPON_SLOT_LABEL[w.slot] + ') แล้ว';
  }
  profile.equippedWeapon[w.slot] = id;               // player.equippedWeapon ชี้ออบเจกต์เดียวกัน
  saveProfile();
  return { ok: true, msg: msg };
}

function weaponTypeText(w) { return (WEAPON_TYPE_LABEL[w.type] || '') + (w.id.indexOf('borz') === 0 ? ' AP' : '') + (w.id.indexOf('winchester') === 0 ? ' KB' : ''); }   // AP = ทะลวงเกราะ

// สเตตัสสั้นๆ ของอาวุธ 1 กระบอกสำหรับแถวใน Hangar
function weaponStatsText(w) {
  if (w.type === 'SHOTGUN') return 'DMG ' + w.damage + 'x' + w.pellets + '   ' + w.fireRate + ' ms   น้ำหนัก ' + w.weight;
  if (w.type === 'MELEE') return 'DMG ' + w.damage + ' / ' + w.fireRate + 'ms  ระยะ ' + w.reach + '  นน. ' + w.weight;
  if (w.type === 'LASER') return 'DMG ' + w.damage + (w.beams ? 'x' + w.beams : '') + ' / ' + w.fireRate + 'ms   น้ำหนัก ' + w.weight;
  if (w.slot === 'drone') return w.desc + '   นน. ' + w.weight;
  if (w.slot === 'gun') return 'DMG ' + w.damage + '   ' + w.fireRate + ' ms   น้ำหนัก ' + w.weight;
  if (w.type === 'ORBITAL') return 'DMG ' + w.damage + 'x' + ORBITAL_TICKS + '  CD ' + w.cd + 's  นน. ' + w.weight;
  if (w.type === 'NAPALM') return 'DMG ' + w.damage + ' +ไฟ ' + w.burn + '/' + NAPALM_TICK + 's  CD ' + w.cd + 's  นน. ' + w.weight;
  if (w.type === 'BEAM') return 'DMG ' + w.damage + (w.beams ? 'x' + w.beams : '') + ' ทะลุ  CD ' + (w.cd || MISSILE_DELAYS.BEAM) + 's  นน. ' + w.weight;
  return 'DMG ' + w.damage + (w.count ? 'x' + w.count : '') + '   น้ำหนัก ' + w.weight;
}
