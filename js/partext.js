'use strict';
/* ==========================================================================
   partext.js : ส่วนขยายระบบพาร์ท — ใช้ฟิลด์เพิ่มในข้อมูลพาร์ทได้โดยไม่ต้องแก้ parts.js
   ฟิลด์เสริมที่รองรับ (ใส่ในพาร์ทชิ้นไหนก็ได้ ทุกหมวด):
     unlock: { mission: เลขด่าน, clears: จำนวนครั้ง }   ล็อกจนกว่าจะเคลียร์ด่านนั้น (ชนะบอสด่านนั้น) ครบกี่ครั้ง จึงซื้อได้
     atkBonus: 0.05           พลังโจมตีเพิ่ม +5% (บวกรวมกับ damageBonus ของแขน ทุกชิ้นที่สวมอยู่นับรวมกัน)
     group: 'ZEUS'            จัดกลุ่มซีรีส์ ถ้าหมวดไหนมีหลายกลุ่ม Hangar จะมีปุ่มสลับกลุ่ม (Z / X)  ไม่ใส่ = กลุ่ม STD
     tier: 1                  ลำดับระดับ (ใช้กับหน้าตาโมเดลเวกเตอร์สำรอง) ไม่ใส่ = ลำดับในหมวด
     compactStats: true       การ์ดแสดงสเตตัสแบบย่อ (ATK / HP / น้ำหนัก ...) กันข้อความยาวล้นการ์ด
   จำนวนครั้งที่เคลียร์แต่ละด่านเก็บใน profile.clears { เลขด่าน: จำนวนครั้ง } (บันทึกลงเซฟ ดู save.js / mission.js)
   ไฟล์นี้ต้องโหลดต่อจาก parts.js และก่อน save.js
   ========================================================================== */

const PART_GROUP_LABEL = { STD: 'มาตรฐาน', ZEUS: 'ZEUS SERIES' };

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
    if (!p.compactStats) return baseText(cat, p);
    const t = [];
    if (cat === 'ARMS') t.push('ATK x' + p.damageBonus.toFixed(2));
    else if (p.atkBonus) t.push('ATK +' + Math.round(p.atkBonus * 100) + '%');
    if (cat !== 'ARMS' && cat !== 'LEGS' && cat !== 'BACKPACK') t.push('HP ' + (p.hpBonus >= 0 ? '+' : '') + p.hpBonus);
    if (cat === 'BODY') t.push('พลังงาน ' + p.energy);
    if (cat === 'LEGS') t.push('SPD x' + p.speedBonus.toFixed(2));
    if (cat === 'BACKPACK') t.push('Booster ' + p.boostDuration.toFixed(1) + ' วิ');
    if (cat !== 'BODY') t.push('น้ำหนัก ' + p.weight);
    if (p.maxLoad) t.push('แบก +' + p.maxLoad);
    return t.join('   ');
  };
})();
