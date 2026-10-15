'use strict';
/* ==========================================================================
   partext.js : ส่วนขยายระบบพาร์ท — ใช้ฟิลด์เพิ่มในข้อมูลพาร์ทได้โดยไม่ต้องแก้ parts.js
   ฟิลด์เสริมที่รองรับ (ใส่ในพาร์ทชิ้นไหนก็ได้ ทุกหมวด):
     unlock: { mission: เลขด่าน, clears: จำนวนครั้ง }   ล็อกจนกว่าจะเคลียร์ด่านนั้น (ชนะบอสด่านนั้น) ครบกี่ครั้ง จึงซื้อได้
     atkBonus: 0.05           พลังโจมตีเพิ่ม +5% (บวกรวมกับ damageBonus ของแขน ทุกชิ้นที่สวมอยู่นับรวมกัน)
     group: 'ZEUS'            จัดกลุ่มซีรีส์ ถ้าหมวดไหนมีหลายกลุ่ม Hangar จะมีปุ่มสลับกลุ่ม (Z / X)  ไม่ใส่ = กลุ่ม STD
     tier: 1                  ลำดับระดับ (ใช้กับหน้าตาโมเดลเวกเตอร์สำรอง) ไม่ใส่ = ลำดับในหมวด
     typeBonus: { SHOTGUN: 0.20 }  โบนัสพลังโจมตีเฉพาะตอนถืออาวุธชนิดนั้น (ทุกชิ้นที่สวมอยู่บวกกัน)  ชนิด: SHOTGUN / RIFLE / MISSILE / MELEE
                              RIFLE = ปืนไรเฟิล + โดรน Sniper   MISSILE = อาวุธช่องมิสไซล์ทุกแบบ (รวม Einshander / Sweihander / Strike)   MELEE = อาวุธประชิด
     defense: 0.06            ลดดาเมจที่ผู้เล่นได้รับ 6% (ทุกชิ้นบวกกัน รวมไม่เกิน DEFENSE_CAP) ใช้ก่อนคิดโล่
     compactStats: true       การ์ดแสดงสเตตัสแบบย่อ (ATK / HP / น้ำหนัก ...) กันข้อความยาวล้นการ์ด
   จำนวนครั้งที่เคลียร์แต่ละด่านเก็บใน profile.clears { เลขด่าน: จำนวนครั้ง } (บันทึกลงเซฟ ดู save.js / mission.js)
   ไฟล์นี้ต้องโหลดต่อจาก parts.js และก่อน save.js
   ========================================================================== */

const PART_GROUP_LABEL = { STD: 'มาตรฐาน', ZEUS: 'ZEUS SERIES', SPECIAL: 'SPECIAL' };
const DEFENSE_CAP = 0.20;                           // ค่าลดดาเมจรวมสูงสุด (ทุกพาร์ทรวมกัน)
const TYPE_BONUS_LABEL = { SHOTGUN: 'Shotgun', RIFLE: 'Rifle', MISSILE: 'Missile', MELEE: 'Melee' };

// ชนิดโบนัสของอาวุธ (ใช้จับคู่กับ typeBonus ของพาร์ท) ไม่เข้าข่ายใดเลย = null
function weaponBonusKey(w) {
  if (!w) return null;
  if (w.slot === 'missile') return 'MISSILE';
  if (w.slot === 'drone') return w.kind === 'sniper' ? 'RIFLE' : null;
  if (w.type === 'SHOTGUN' || w.type === 'RIFLE' || w.type === 'MELEE') return w.type;
  return null;
}
function partsTypeBonus(key) {                      // โบนัสรวมของชนิดนี้จากทุกชิ้นที่สวมอยู่ (0.30 = +30%)
  if (!key) return 0;
  let m = 0;
  for (const c of PART_CATEGORIES) { const tb = equippedPart(c).typeBonus; if (tb && tb[key]) m += tb[key]; }
  return m;
}
function partsDefense() {
  let d = 0;
  for (const c of PART_CATEGORIES) d += equippedPart(c).defense || 0;
  return Math.min(DEFENSE_CAP, d);
}
function partsBonusText() {                         // สรุปโบนัสพิเศษสำหรับ Hangar เช่น "Shotgun +34%   DEF 6%"
  const t = [];
  for (const k of Object.keys(TYPE_BONUS_LABEL)) { const b = partsTypeBonus(k); if (b > 0) t.push(TYPE_BONUS_LABEL[k] + ' +' + Math.round(b * 100) + '%'); }
  const d = partsDefense();
  if (d > 0) t.push('DEF ' + Math.round(d * 100) + '%' + (d >= DEFENSE_CAP ? ' (MAX)' : ''));
  return t.join('   ');
}
function partBonusTokens(p) {                       // ข้อความโบนัสพิเศษของพาร์ทชิ้นเดียว
  const t = [];
  if (p.typeBonus) for (const k of Object.keys(p.typeBonus)) t.push((TYPE_BONUS_LABEL[k] || k) + ' +' + Math.round(p.typeBonus[k] * 100) + '%');
  if (p.defense) t.push('DEF ' + Math.round(p.defense * 100) + '%');
  return t;
}

function clearsOf(missionId) { return (profile.clears && profile.clears[missionId]) || 0; }
function partGroupOf(p) { return p.group || 'STD'; }
function partGroups(cat) {                          // กลุ่มที่มีในหมวด ตามลำดับที่เจอ (STD มาก่อนเสมอถ้ามี)
  const g = [];
  for (const p of WANZER_PARTS[cat]) if (g.indexOf(partGroupOf(p)) < 0) g.push(partGroupOf(p));
  return g;
}

// ถ้าพาร์ทนี้ยังล็อกอยู่ คืน { mission, need, have, left } / ปลดแล้วหรือไม่มีเงื่อนไข = null
function partLock(cat, id) {
  const p = findPart(cat, id);
  if (!p || !p.unlock) return null;
  const need = p.unlock.clears || 1, have = clearsOf(p.unlock.mission);
  return have >= need ? null : { mission: p.unlock.mission, need: need, have: have, left: need - have };
}

(function () {
  const baseState = partState, baseBuy = buyOrEquipPart, baseText = partStatsText, baseTier = partTier;

  // พาร์ทที่ยังไม่ได้ซื้อและยังล็อก = สถานะ 'locked' (พาร์ทที่ซื้อ/สวมอยู่แล้วไม่โดนล็อกย้อนหลัง)
  partState = function (cat, id) {
    const s = baseState(cat, id);
    return (s === 'buy' || s === 'poor') && partLock(cat, id) ? 'locked' : s;
  };

  buyOrEquipPart = function (cat, id) {
    const lk = partLock(cat, id);
    if (lk && !partOwned(cat, id)) {
      return { ok: false, msg: 'ยังล็อก: ต้องชนะบอสด่าน ' + lk.mission + ' อีก ' + lk.left + ' ครั้ง (' + lk.have + ' / ' + lk.need + ')' };
    }
    return baseBuy(cat, id);
  };

  // พลังโจมตีรวม = โบนัสแขน + atkBonus ของทุกชิ้นที่สวมอยู่
  partsDamageMult = function () {
    let m = equippedPart('ARMS').damageBonus;
    for (const c of PART_CATEGORIES) m += equippedPart(c).atkBonus || 0;
    return m;
  };

  partTier = function (cat, id) {
    const p = findPart(cat, id);
    return p && p.tier !== undefined ? p.tier : baseTier(cat, id);
  };

  partStatsText = function (cat, p) {
    const extra = partBonusTokens(p);
    if (!p.compactStats && !extra.length) return baseText(cat, p);
    if (!p.compactStats) {                          // พาร์ทมีโบนัสพิเศษ: ใช้ข้อความย่อ (การ์ดแคบ ข้อความยาวจะล้น)
      const t = [];
      if (cat === 'ARMS') t.push('ATK x' + p.damageBonus.toFixed(2));
      if (cat === 'HEAD' || cat === 'BODY' || cat === 'SHOULDERS') t.push('HP +' + p.hpBonus);
      if (cat === 'BODY') t.push('EN ' + p.energy);
      if (cat === 'LEGS') t.push('SPD x' + p.speedBonus.toFixed(2) + ' BST x' + p.boostBonus.toFixed(2));
      if (cat === 'BACKPACK') t.push('บิน ' + p.boostDuration.toFixed(1) + ' วิ');
      if (cat !== 'BODY') t.push('นน. ' + p.weight);
      if (p.maxLoad) t.push('แบก +' + p.maxLoad);
      return t.concat(extra).join('  ');
    }
    const t = [];
    if (cat === 'ARMS') t.push('ATK x' + p.damageBonus.toFixed(2));
    else if (p.atkBonus) t.push('ATK +' + Math.round(p.atkBonus * 100) + '%');
    if (cat !== 'ARMS' && cat !== 'LEGS' && cat !== 'BACKPACK') t.push('HP ' + (p.hpBonus >= 0 ? '+' : '') + p.hpBonus);
    if (cat === 'BODY') t.push('พลังงาน ' + p.energy);
    if (cat === 'LEGS') t.push('SPD x' + p.speedBonus.toFixed(2));
    if (cat === 'BACKPACK') t.push('Booster ' + p.boostDuration.toFixed(1) + ' วิ');
    if (cat !== 'BODY') t.push('น้ำหนัก ' + p.weight);
    if (p.maxLoad) t.push('แบก +' + p.maxLoad);
    return t.concat(extra).join('   ');
  };
})();
