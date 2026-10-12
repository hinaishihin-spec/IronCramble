'use strict';
/* ==========================================================================
   missions.js : ข้อมูลของแต่ละด่าน (Mission Progression) + การเลือกด่าน
   อยากเพิ่มด่านใหม่: เพิ่ม object ต่อท้ายลิสต์ MISSIONS ด้านล่าง ไม่ต้องแก้ไฟล์อื่น

   ความยาวฉาก  lengthM  หน่วยเมตร (10 พิกเซล = 1 เมตร ตรงกับตัวเลข DIST ใน HUD)
   unlockAt    ปลดล็อกเมื่อ profile.missions (Missions Cleared ในเซฟ) >= ค่านี้
   waves       ศัตรูไม่เกิดพร้อมกัน แต่ละเวฟจะโผล่ "ตอนผู้เล่นเดินถึงระยะ at (เมตร)"
               units = [ [ชนิด, ระยะห่างจากขอบจอขวา(px), ความสูง(เฉพาะ drone)], ... ]
               ชนิด: 'walker' | 'drone' | 'tank' | 'chopper' | 'sniper'
               | 'bomber' (ตัวเลขที่ 3 = ความสูงบิน) | 'launcher' (รถมิสไซล์ลูกเดียว) | 'swarmer' (รถมิสไซล์ฝูง)
               (sniper: ตัวเลขที่ 2 = เยื้องเข้าซ้ายจากขอบจอขวา เมื่อมีสไนเปอร์หลายตัวในเวฟเดียว)
   boss        (ไม่บังคับ) บอสท้ายด่าน { at: ระยะ(เมตร) ที่ล็อกกล้องแล้วบอสเข้า, name, kind: 'fortress'|'hopper'|'sniper'|'bomber' }
               ด่านที่มีบอส: จบเมื่อกำจัดบอสได้ (เวฟทั้งหมดต้องอยู่ก่อนระยะ at)
   ด่านจบเมื่อ: ทุกเวฟโผล่ครบแล้ว และกำจัดศัตรูหมดทุกตัว (หรือกำจัดบอสได้ ถ้าด่านมีบอส)
   ========================================================================== */

const MISSIONS = [
  {
    id: 1, title: 'CLEAR THE ZONE', name: 'MISSION 01  CLEAR THE ZONE',
    lengthM: 600, unlockAt: 0, bonusExp: 50, bonusGold: 100,
    waves: [
      { at: 150, units: [['walker', 0], ['drone', 110, 190]] },
      { at: 330, units: [['walker', 0]] },
      { at: 480, units: [['drone', 0, 150]] }
    ]
  },
  {
    id: 2, title: 'IRON CORRIDOR', name: 'MISSION 02  IRON CORRIDOR',
    lengthM: 1200, unlockAt: 1, bonusExp: 120, bonusGold: 250,
    boss: { at: 1000, name: 'MOBILE FORTRESS' },       // เดินถึง 1000 m = ล็อกกล้อง + บอสเข้า
    waves: [
      { at: 80,   units: [['walker', 0], ['walker', 110]] },
      { at: 200,  units: [['drone', 0, 170], ['drone', 140, 125], ['walker', 60]] },
      { at: 330,  units: [['tank', 0]] },
      { at: 450,  units: [['walker', 0], ['walker', 100], ['drone', 60, 150]] },
      { at: 580,  units: [['drone', 0, 160], ['drone', 120, 120], ['walker', 80], ['walker', 190]] },
      { at: 720,  units: [['tank', 0], ['walker', 130]] },
      { at: 860,  units: [['drone', 0, 190], ['drone', 110, 140], ['drone', 220, 110], ['walker', 40]] },
      { at: 940,  units: [['tank', 0], ['walker', 130]] }     // เวฟสุดท้ายก่อนบอส (ต้องมาก่อน 1000 m เพราะหลังจากนั้นกล้องถูกล็อก)
    ]
  },
  {
    id: 3, title: 'STORM RIDGE', name: 'MISSION 03  STORM RIDGE',
    lengthM: 1300, unlockAt: 2, bonusExp: 200, bonusGold: 400,
    boss: { at: 1100, name: 'GIANT HOPPER', kind: 'hopper' },
    waves: [
      { at: 80,   units: [['walker', 0], ['drone', 100, 170]] },
      { at: 200,  units: [['chopper', 0], ['walker', 90]] },
      { at: 330,  units: [['walker', 0], ['sniper', 0]] },
      { at: 460,  units: [['tank', 0], ['chopper', 120]] },
      { at: 600,  units: [['drone', 0, 160], ['drone', 120, 130], ['sniper', 0]] },
      { at: 740,  units: [['chopper', 0], ['walker', 100], ['walker', 200]] },
      { at: 880,  units: [['tank', 0], ['sniper', 0], ['drone', 100, 150]] },
      { at: 1020, units: [['chopper', 0], ['chopper', 170], ['walker', 90]] }
    ]
  },
  {
    id: 4, title: 'LONG SHOT', name: 'MISSION 04  LONG SHOT',
    lengthM: 1500, unlockAt: 3, bonusExp: 300, bonusGold: 600,
    boss: { at: 1300, name: 'BOSS SNIPER', kind: 'sniper' },
    waves: [
      { at: 80,   units: [['walker', 0], ['sniper', 0]] },
      { at: 200,  units: [['chopper', 0], ['drone', 100, 150]] },
      { at: 320,  units: [['sniper', 0], ['sniper', 70]] },
      { at: 450,  units: [['tank', 0], ['chopper', 100], ['walker', 120]] },
      { at: 580,  units: [['chopper', 0], ['chopper', 140], ['sniper', 0]] },
      { at: 710,  units: [['walker', 0], ['walker', 100], ['sniper', 0], ['drone', 60, 150]] },
      { at: 850,  units: [['tank', 0], ['sniper', 0], ['sniper', 80]] },
      { at: 990,  units: [['chopper', 0], ['sniper', 0], ['tank', 140]] },
      { at: 1130, units: [['chopper', 0], ['chopper', 150], ['sniper', 0], ['sniper', 70]] },
      { at: 1230, units: [['tank', 0], ['walker', 100], ['sniper', 0]] }     // เวฟสุดท้ายก่อนบอส (ก่อน 1300 m)
    ]
  },
  {
    id: 5, title: 'AIR RAID', name: 'MISSION 05  AIR RAID',
    lengthM: 1500, unlockAt: 4, bonusExp: 400, bonusGold: 800,
    boss: { at: 1300, name: 'GIANT BOMBER', kind: 'bomber' },
    waves: [
      { at: 80,   units: [['launcher', 0], ['walker', 100]] },
      { at: 200,  units: [['bomber', 0, 80]] },
      { at: 320,  units: [['swarmer', 0], ['walker', 90], ['drone', 100, 150]] },
      { at: 450,  units: [['launcher', 0], ['launcher', 150], ['walker', 70]] },
      { at: 580,  units: [['bomber', 0, 80], ['swarmer', 120]] },
      { at: 710,  units: [['tank', 0], ['launcher', 130], ['bomber', 60, 105]] },
      { at: 850,  units: [['swarmer', 0], ['swarmer', 160], ['sniper', 0]] },
      { at: 990,  units: [['bomber', 0, 80], ['bomber', 220, 105], ['launcher', 100]] },
      { at: 1130, units: [['bomber', 0, 90], ['swarmer', 100], ['launcher', 200], ['chopper', 60]] },
      { at: 1230, units: [['bomber', 0, 80], ['bomber', 160, 105], ['swarmer', 60]] }     // เวฟสุดท้ายก่อนบอส (ก่อน 1300 m)
    ]
  }
];

const ENEMY_LABEL = { walker: 'หุ่นเดินดิน', drone: 'โดรน', tank: 'Heavy Tank', chopper: 'เฮลิคอปเตอร์', sniper: 'สไนเปอร์', bomber: 'เครื่องบินทิ้งระเบิด', launcher: 'รถยิงมิสไซล์', swarmer: 'รถมิสไซล์ฝูง', boss: 'BOSS' };

// ---------- การเลือกด่าน (ค่าอยู่ในหน่วยความจำ ไม่ได้เซฟ) ----------
let selectedMission = -1;            // -1 = ยังไม่ได้เลือก -> Hangar จะเลือกด่านล่าสุดที่ปลดล็อกให้

function missionUnlocked(i) { return profile.missions >= MISSIONS[i].unlockAt; }

function highestUnlocked() {
  let h = 0;
  for (let i = 0; i < MISSIONS.length; i++) if (missionUnlocked(i)) h = i;
  return h;
}

function selectMission(i) { selectedMission = clamp(i, 0, MISSIONS.length - 1); }

// ถ้าเซฟถูกล้าง (NEW GAME) แล้วด่านที่เลือกไว้ล็อกอยู่ ให้ถอยกลับมาด่านที่เล่นได้
function ensureValidSelection() {
  if (selectedMission < 0 || !missionUnlocked(selectedMission)) selectedMission = highestUnlocked();
}

function currentMission() { ensureValidSelection(); return MISSIONS[selectedMission]; }

// นับศัตรูทั้งหมดของด่าน แยกตามชนิด เช่น { walker: 2, drone: 2, tank: 0, boss: 0, total: 4 } (บอสนับเป็น 1 ตัว)
function missionTotals(m) {
  const t = { walker: 0, drone: 0, tank: 0, chopper: 0, sniper: 0, bomber: 0, launcher: 0, swarmer: 0, boss: 0, total: 0 };
  for (const w of m.waves) for (const u of w.units) { t[u[0]]++; t.total++; }
  if (m.boss) { t.boss = 1; t.total++; }
  return t;
}

// ข้อความสรุปองค์ประกอบศัตรู ใช้แสดงในเมนู/Hangar
function missionSummaryText(m) {
  const t = missionTotals(m);
  const parts = [];
  for (const k of ['walker', 'drone', 'tank', 'chopper', 'sniper', 'bomber', 'launcher', 'swarmer']) if (t[k] > 0) parts.push(ENEMY_LABEL[k] + ' ' + t[k]);
  if (m.boss) parts.push(/^BOSS/.test(m.boss.name) ? m.boss.name : 'BOSS ' + m.boss.name);
  return parts.join(' / ');
}
