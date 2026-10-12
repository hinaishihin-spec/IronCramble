'use strict';
/* ==========================================================================
   series_zeus.js : พาร์ทซีรีส์ ZEUS (I / II / III) ครบทั้ง 6 หมวด — จุดเด่น: พลังโจมตีสูง พลังป้องกัน (HP) ต่ำ
   ทุกชิ้นราคา 2000 CR และปลดล็อกเมื่อชนะบอสด่าน 5 ครบ 10 ครั้ง (ฟิลด์ unlock ดู partext.js)
   ระดับ I ต่ำสุด -> III สูงสุด  พลังโจมตีรวมเมื่อสวมครบชุด: I = x1.32 / II = x1.53 / III = x1.75 (ชุดเริ่มต้น = x1.00, Hammer ทั้งชุดแขน = x1.15)
   HP ของ Zeus ต่ำกว่าซีรีส์อื่นมากทุกชิ้น (ลำตัว/หัว/ไหล่ติดลบหรือใกล้ 0 ในระดับ I)
   ไฟล์ภาพ (ถ้าวาด): assets/parts/{หมวด}_zeus_1.png ... เช่น head_zeus_1.png, body_zeus_2.png, legs_zeus_3.png, shoulders_zeus_1.png
   ขาข้างไกล: legs_zeus_1_far.png  (ยังไม่มีภาพ = ใช้ภาพพาร์ทตั้งต้นของหมวดแทน)
   อยากแก้สเตตัส: แก้ตัวเลขในตารางด้านล่างได้เลย
   ========================================================================== */

(function () {
  const ZEUS_PRICE = 2000;
  const ZEUS_UNLOCK = { mission: 5, clears: 10 };
  const roman = ['I', 'II', 'III'];
  // [HP, ATK โบนัส, น้ำหนัก, ...ค่าเฉพาะหมวด]  แถวละ 1 ระดับ (I, II, III)
  const table = {
    HEAD:      [{ hpBonus: -5,  atkBonus: 0.02, weight: 4 },
                { hpBonus: 0,   atkBonus: 0.04, weight: 5 },
                { hpBonus: 5,   atkBonus: 0.06, weight: 6 }],
    BODY:      [{ hpBonus: -10, atkBonus: 0.02, energy: 100, maxLoad: 55 },
                { hpBonus: 0,   atkBonus: 0.04, energy: 105, maxLoad: 65 },
                { hpBonus: 10,  atkBonus: 0.06, energy: 110, maxLoad: 75 }],
    ARMS:      [{ damageBonus: 1.22, weight: 12 },
                { damageBonus: 1.33, weight: 14 },
                { damageBonus: 1.45, weight: 16 }],
    LEGS:      [{ speedBonus: 1.05, boostBonus: 1.05, atkBonus: 0.02, weight: 12, maxLoad: 6 },
                { speedBonus: 1.08, boostBonus: 1.08, atkBonus: 0.04, weight: 14, maxLoad: 9 },
                { speedBonus: 1.12, boostBonus: 1.12, atkBonus: 0.06, weight: 16, maxLoad: 12 }],
    BACKPACK:  [{ boostDuration: 3.5, atkBonus: 0.02, weight: 8,  maxLoad: 10 },
                { boostDuration: 4.0, atkBonus: 0.04, weight: 10, maxLoad: 14 },
                { boostDuration: 4.5, atkBonus: 0.06, weight: 12, maxLoad: 18 }],
    SHOULDERS: [{ hpBonus: 0, atkBonus: 0.02, weight: 3 },
                { hpBonus: 3, atkBonus: 0.04, weight: 4 },
                { hpBonus: 6, atkBonus: 0.06, weight: 5 }]
  };
  for (const cat of Object.keys(table)) {
    table[cat].forEach(function (stats, i) {
      WANZER_PARTS[cat].push(Object.assign({
        id: 'zeus_' + (i + 1), name: 'Zeus ' + roman[i], price: ZEUS_PRICE,
        group: 'ZEUS', tier: i + 1, unlock: ZEUS_UNLOCK, compactStats: true
      }, stats));
    });
  }
  SERIES_COLORS.zeus = '#8a2b2f';             // สีแดงเลือดหมู (โมเดลเวกเตอร์สำรองเมื่อยังไม่มีภาพ)
})();
