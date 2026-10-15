'use strict';
/* ==========================================================================
   series_special.js : พาร์ทซีรีส์พิเศษ 4 ชุด (ครบ 6 หมวด)  — รวมกับ MegaZ ใน parts.js เป็นกลุ่ม SPECIAL ใน Hangar
     MegaZ    (megaz)    สมดุลทุกด้าน (ข้อมูลอยู่ใน parts.js ของคุณ ไฟล์นี้แค่ย้ายเข้ากลุ่ม SPECIAL)
     PrirateK (prirate)  เน้นโบนัสพลังโจมตี Shotgun
     SpaceR   (spacer)   เน้นโบนัสพลังโจมตีอาวุธ Sniper (ปืนไรเฟิล + โดรน Sniper)
     MagiL    (magil)    เน้นโบนัสมิสไซล์ + ลดดาเมจที่ได้รับ (HP สูง หนัก ช้า)
     BeastE   (beaste)   เน้นโบนัสอาวุธประชิด + ความเร็ว/Boost สูง (เบา HP ต่ำ)
   หลักสมดุล: ค่าทั่วไป (HP/ความเร็ว/Boost) ต่ำกว่า MegaZ แลกกับโบนัสเฉพาะอาวุธ  โบนัสกระจายตามช่อง (แขนมากสุด) จึงผสมซีรีส์ได้
   ทุกชิ้นราคาเท่ากัน = SPECIAL_PRICE (ที่เดียว)  ฟิลด์ typeBonus / defense ดู partext.js  ค่า defense รวมกันไม่เกิน DEFENSE_CAP
   ภาพ (ถ้าวาด): assets/parts/{หมวด}_{id}.png เช่น arms_prirate.png  ขาข้างไกล: legs_prirate_far.png  ไหล่: shoulders_magil.png
   ไฟล์นี้ต้องโหลดต่อจาก parts.js / partext.js  อยากแก้สเตตัส: แก้ตัวเลขในตารางด้านล่างได้เลย
   ========================================================================== */

(function () {
  const SPECIAL_PRICE = 1000;
  const SPECIAL_TIER = 3;

  // [HP, น้ำหนัก, โบนัสชนิดอาวุธ, ลดดาเมจ]  ฯลฯ  — แถวต่อซีรีส์: prirate / spacer / magil / beaste
  const series = {
    prirate: { name: 'PrirateK', type: 'SHOTGUN' },
    spacer:  { name: 'SpaceR',   type: 'RIFLE' },
    magil:   { name: 'MagiL',    type: 'MISSILE' },
    beaste:  { name: 'BeastE',   type: 'MELEE' }
  };
  const T = function (type, v) { const o = {}; o[type] = v; return o; };
  const table = {
    HEAD: {
      prirate: { hpBonus: 65,  weight: 28, tb: 0.04 },
      spacer:  { hpBonus: 55,  weight: 22, tb: 0.05 },
      magil:   { hpBonus: 110, weight: 42, tb: 0.03, defense: 0.03 },
      beaste:  { hpBonus: 50,  weight: 20, tb: 0.03 }
    },
    BODY: {
      prirate: { hpBonus: 75,  energy: 110, maxLoad: 90,  tb: 0.03 },
      spacer:  { hpBonus: 65,  energy: 110, maxLoad: 80,  tb: 0.04 },
      magil:   { hpBonus: 140, energy: 100, maxLoad: 120, defense: 0.06 },
      beaste:  { hpBonus: 60,  energy: 120, maxLoad: 75,  tb: 0.03 }
    },
    ARMS: {
      prirate: { damageBonus: 1.15, weight: 26, tb: 0.20 },
      spacer:  { damageBonus: 1.10, weight: 24, tb: 0.30 },
      magil:   { damageBonus: 1.10, weight: 30, tb: 0.10 },
      beaste:  { damageBonus: 1.15, weight: 22, tb: 0.25 }
    },
    LEGS: {
      prirate: { speedBonus: 1.25, boostBonus: 1.15, weight: 20, maxLoad: 50 },
      spacer:  { speedBonus: 1.15, boostBonus: 1.10, weight: 17, maxLoad: 44 },
      magil:   { speedBonus: 1.15, boostBonus: 1.00, weight: 26, maxLoad: 70, defense: 0.02 },
      beaste:  { speedBonus: 1.55, boostBonus: 1.45, weight: 16, maxLoad: 40, tb: 0.08 }
    },
    SHOULDERS: {
      prirate: { hpBonus: 30, weight: 22, tb: 0.04 },
      spacer:  { hpBonus: 28, weight: 20, tb: 0.05 },
      magil:   { hpBonus: 70, weight: 32, tb: 0.10, defense: 0.04 },
      beaste:  { hpBonus: 24, weight: 18 }
    },
    BACKPACK: {
      prirate: { boostDuration: 6.5, weight: 13, maxLoad: 44, tb: 0.03 },
      spacer:  { boostDuration: 6.5, weight: 11, maxLoad: 40, tb: 0.04 },
      magil:   { boostDuration: 6.0, weight: 15, maxLoad: 56, tb: 0.06 },
      beaste:  { boostDuration: 7.0, weight: 15, maxLoad: 34, tb: 0.03 }
    }
  };

  for (const cat of Object.keys(table)) {
    for (const mz of WANZER_PARTS[cat]) if (mz.id === 'megaz') { mz.group = 'SPECIAL'; mz.compactStats = true; }   // MegaZ เข้ากลุ่ม SPECIAL ด้วย
    for (const id of Object.keys(series)) {
      const s = table[cat][id], p = {
        id: id, name: series[id].name + (cat === 'SHOULDERS' ? ' Shoulder' : ''), price: SPECIAL_PRICE,
        group: 'SPECIAL', tier: SPECIAL_TIER, compactStats: true
      };
      for (const k of Object.keys(s)) {
        if (k === 'tb') p.typeBonus = T(series[id].type, s.tb);
        else p[k] = s[k];
      }
      WANZER_PARTS[cat].push(p);
    }
  }
  if (!SERIES_COLORS.megaz) SERIES_COLORS.megaz = '#3b5ba5';          // สีโมเดลเวกเตอร์สำรองเมื่อยังไม่มีภาพ
  SERIES_COLORS.prirate = '#a8381f';
  SERIES_COLORS.spacer = '#6a4aa8';
  SERIES_COLORS.magil = '#2e7d6b';
  SERIES_COLORS.beaste = '#c28a1a';
})();
