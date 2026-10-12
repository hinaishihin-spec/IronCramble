'use strict';
/* ==========================================================================
   config.js : ค่าคงที่ของเกมทั้งหมด + canvas + ฟังก์ชันช่วยเล็กๆ
   อยากปรับสมดุลเกม (ความเร็ว ดาเมจ คูลดาวน์) ให้แก้ที่ไฟล์นี้ที่เดียว
   ========================================================================== */

const W = 800, H = 450;
let WORLD_W = 6000;            // ความยาวฉากของด่านปัจจุบัน (พิกเซล, 10px = 1m) ถูกตั้งใหม่ทุกครั้งที่เริ่มด่าน (ดู missions.js)
const GROUND_Y = 380;          // ระดับพื้น
const GRAVITY = 2200;          // px/s^2
const MOVE_SPEED = 260;        // px/s
const JUMP_SPEED = 780;        // px/s
const BULLET_SPEED = 950;      // px/s
const BULLET_LIFE = 1.3;       // วินาที
const GUN_LEN = 30;
const PLAYER_BOX = { w: 36, h: 64 };   // กรอบชนของหุ่น (พิกเซลเกม) ภาพหุ่นผืนผ้าใบ 128x160 พิกเซลภาพ = 64x80 พิกเซลเกม เท้าชิดขอบล่าง กึ่งกลางตรงกับกรอบชน

// Dash / Boost
const DASH_SPEED = 820;
const DASH_TIME = 0.2;
const DASH_COOLDOWN = 0.6;
// Jetpack
const FUEL_MAX = 100;
const FUEL_DRAIN = 34;         // ต่อวินาทีขณะบิน (ประมาณ 3 วินาที)
const FUEL_RECHARGE = 55;      // ต่อวินาทีเมื่ออยู่บนพื้น
const JET_ENGAGE_VY = 200;
const JET_RISE_VY = 140;

// Combat
const PLAYER_HP = 100;
const MG_DELAY = 0.07;         // Machine Gun: ยิงเร็ว
const MG_DMG = 5;              // ดาเมจต่ำ
const MISSILE_DELAY = 0.9;     // Homing Missile: ยิงช้า
const MISSILE_DMG = 30;
const MISSILE_SPEED = 380;
const MISSILE_TURN = 4.5;      // rad/s อัตราเลี้ยวเข้าหาเป้า
const MISSILE_LIFE = 3;
const KNOCKBACK = 300;         // px/s แรงผลักศัตรูเมื่อโดนมิสไซล์
const SHIELD_MAX = 100;
const SHIELD_DRAIN = 20;
const SHIELD_REGEN = 18;
const SHIELD_HIT_COST = 4;
const SHIELD_UNLOCK = 25;
const SHIELD_REDUCE = 0.8;     // ลดดาเมจ 80%
const SHIELD_SLOW = 0.45;

// Damage roll (สูตรดาเมจตอนกระสุนชนศัตรู ใช้กับอาวุธทุกชนิด)
const DMG_VARIANCE = 0.15;         // สุ่มดาเมจพื้นฐาน +/- 15% (10 -> 8..12)
const CRIT_CHANCE = 0.10;          // โอกาสคริติคอล 10%
const CRIT_MULT = 2;               // คริติคอล = ดาเมจ x2 และทะลวงเกราะ (ไม่โดนลดจาก armor)

// Progression
const ITEM_SIZE = 14;
const DROP_CHANCE = 0.75;
const LEVEL_ATK_BONUS = 1.1;   // พลังโจมตี x1.1 ต่อเลเวล

// Hangar / Upgrades (ราคา = BASE + STEP * เลเวลปัจจุบัน)
const ARMOR_MAX_LV = 5;
const ARMOR_BASE_COST = 100;       // เลเวล 0 -> 1 ราคา 100, ต่อไป 150, 200, ...
const ARMOR_COST_STEP = 50;
const ARMOR_HP_PER_LV = 20;        // Max HP +20 ต่อเลเวล
const VERNIER_MAX_LV = 5;
const VERNIER_BASE_COST = 100;
const VERNIER_COST_STEP = 50;
const VERNIER_FUEL_PER_LV = 15;    // เกจ Booster ใหญ่ขึ้น (บินนานขึ้น)
const VERNIER_RECHARGE_PER_LV = 0.15;   // รีชาร์จเร็วขึ้น +15% ต่อเลเวล
const LASER_COST = 500;

// Weapon 4: Laser Beam (ซื้อในอู่) — ยิงต่อเนื่อง ดาเมจสูง ทะลุศัตรู แต่มีเกจความร้อน
const LASER_DPS = 120;
const LASER_TICK = 0.1;            // วินาทีต่อการทำดาเมจ 1 ครั้ง
const LASER_LEN = 560;
const HEAT_MAX = 100;
const LASER_HEAT_RATE = 38;        // ความร้อนที่เพิ่มต่อวินาทีขณะยิง (ยิงต่อเนื่องได้ ~2.6 วินาที)
const LASER_COOL_RATE = 30;        // ลดลงต่อวินาทีขณะไม่ยิง
const LASER_UNLOCK_HEAT = 35;      // ติด OVERHEAT แล้วต้องเย็นลงถึงค่านี้ก่อนยิงใหม่

// Enemy: Heavy Tank (ปรากฏในด่าน 02) — อึด ช้า ยิงกระสุนปืนใหญ่ดาเมจสูง
const TANK_HP = 180;
const TANK_ARMOR = 0.35;           // ลดดาเมจจากการโจมตีเบา (ปืนกล/เลเซอร์) 35% มิสไซล์ไม่โดนลด
const TANK_SPEED = 26;             // px/s (หุ่นเดินดิน 55)
const TANK_STOP_DIST = 380;        // หยุดเดินเมื่อห่างผู้เล่นเท่านี้ แล้วยืนยิง
const TANK_SHELL_DMG = 32;
const TANK_SHELL_SPEED = 280;
const TANK_WINDUP = 0.7;           // วินาทีที่ปากกระบอกเรืองแสงเตือนก่อนยิง (หลบทัน)
const TANK_FIRE_CD = 3.6;          // คูลดาวน์ระหว่างนัด
const TANK_SHIELD_COST = 18;       // กระสุนปืนใหญ่กินเกจโล่มากกว่ากระสุนปกติ (4)

// อาวุธใหม่ 3 ชิ้น (ซื้อในอู่)  ปุ่มในด่าน: 4 Dual MG, 5 Dual Missile, 6 Shotgun, 7 Laser
const DUAL_MG_COST = 600;
const DUAL_MG_OFFSET = 10;            // px เยื้องซ้าย/ขวาจากปากกระบอก (ตั้งฉากกับทิศยิง)
const DUAL_MG_BULLET_MULT = 1;        // ดาเมจต่อนัด (2 นัด = x2 รวมแล้ว) ถ้าตั้ง 2 จะรวมเป็น x4
const DUAL_MISSILE_COST = 800;
const DUAL_MISSILE_ANGLE = 0.25;      // เรเดียน (~14°) มุมเฉียงออกก่อนเลี้ยวล็อกเป้า
const DUAL_MISSILE_DELAY = 1.1;
const SHOTGUN_COST = 500;
const SHOTGUN_STEP = 5 * Math.PI / 180;   // 5° ต่อช่อง (นัดนอกสุด ±10°)
const SHOTGUN_SPEED = 850;
const SHOTGUN_LIFE = 0.3;             // ปืนกลปกติ BULLET_LIFE = 1.3 (ลูกซองระยะสั้นกว่ามาก)
const SHOTGUN_DMG_MULT = 2;           // ดาเมจต่อเม็ด x ดาเมจปืนกลปกติ
const SHOTGUN_DELAY = 0.75;
const SHOTGUN_KNOCKBACK = 1.0;        // แรงผลักต่อเม็ดลูกซองทุกรุ่น (x KNOCKBACK)
const WINCHESTER_KB_MULT = 1.5;       // ซีรีส์ Winchester: แรงผลักศัตรูถอยหลังเพิ่มอีก 1.5 เท่า

// Boss: Mobile Fortress (ท้ายด่าน 02) — ตัวใหญ่ 120x120 HP 500 สองเฟส
const BOSS_W = 120, BOSS_H = 120;
const BOSS_HP = 500;
const BOSS_PHASE2_HP = 250;        // HP ต่ำกว่านี้ = เฟส 2 (เรืองแสงแดง ยิงมิสไซล์กระจาย)
const BOSS_ARMOR = 0.25;           // ลดดาเมจปืนกล/เลเซอร์ 25% (มิสไซล์เจาะเต็มแรง)
const BOSS_EXP = 200;
const BOSS_REWARD_GOLD = 150;      // Credits ที่ได้ทันทีเมื่อบอสระเบิด
const BOSS_WARN_TIME = 3.2;        // วินาทีที่ป้าย WARNING ค้าง (บอสค่อยเลื่อนเข้าจอระหว่างนี้)
const BOSS_MG_DMG = 4;             // ปืนกลหนัก: ดาเมจต่อนัด
const BOSS_MG_RATE = 0.2;          // วินาทีต่อนัดขณะยิงรัว
const BOSS_MG_SPEED = 380;
const BOSS_DRONE_CAP = 4;          // โดรนลูกน้องที่มีชีวิตพร้อมกันได้สูงสุด
const BOSS_MISSILE_DMG = 12;
const BOSS_MISSILE_SPEED = 250;
const BOSS_MISSILE_SPREAD = 0.3;   // มุมกระจาย (เรเดียน) ระหว่างมิสไซล์แต่ละลูก
const BOSS_MISSILE_SHIELD_COST = 10;
const BOSS_DEATH_TIME = 2.2;       // วินาทีที่บอสระเบิดต่อเนื่องก่อนระเบิดใหญ่
const BOSS_END_DELAY = 1.8;        // วินาทีหลังระเบิดใหญ่ก่อนไปหน้าสรุปผล

// Enemy: Attack Chopper (ด่าน 03+) — บินสูงตามแกน X ของผู้เล่นช้าๆ ยิงมิสไซล์เฉียงลงทุก 3 วินาที
const CHOPPER_W = 60, CHOPPER_H = 26;
const CHOPPER_HP = 70;
const CHOPPER_Y = 84;              // ความสูงที่บินลอย (px จากขอบบนจอ)
const CHOPPER_SPEED = 55;          // px/s ตามผู้เล่นช้าๆ (ตอนบินเข้าจอจะเร็วกว่านี้)
const CHOPPER_ENTER_SPEED = 150;
const CHOPPER_FIRE_CD = 3.0;       // ยิงทุก 3 วินาที
const CHOPPER_WINDUP = 0.5;        // แท่นยิงเรืองแสงเตือนก่อนยิง
const CHOPPER_MISSILE_DMG = 10;
const CHOPPER_MISSILE_SPEED = 230;
const CHOPPER_MISSILE_SHIELD_COST = 10;

// Enemy: Sniper (ด่าน 03+) — เกราะบาง HP ต่ำมาก ยืนนิ่งชิดขอบจอขวา ยิงไกล 2 เท่าของหุ่นเดินดิน (460 -> 920)
const SNIPER_W = 30, SNIPER_H = 50;
const SNIPER_HP = 24;
const SNIPER_RANGE = 920;
const SNIPER_EDGE = 14;            // ระยะห่างจากขอบจอขวา
const SNIPER_SIGHT_TIME = 1.5;     // เลเซอร์ไซต์สีแดงค้าง 1.5 วินาทีก่อนยิง
const SNIPER_LOCK_AT = 1.1;        // วินาทีที่ 1.1 เลเซอร์ "ล็อกเส้น" หยุดตามผู้เล่น (หลบได้ใน 0.4 วินาทีสุดท้าย)
const SNIPER_TURN = 3.0;           // rad/s ความเร็วหมุนปากกระบอกตามผู้เล่น
const SNIPER_BULLET_SPEED = 1500;  // กระสุนเร็วมาก หลบไม่ทันถ้ายังอยู่บนเส้นเลเซอร์
const SNIPER_DMG = 30;
const SNIPER_SHIELD_COST = 22;
const SNIPER_FIRE_CD = 3.0;

// Boss: Giant Hopper (ท้ายด่าน 03) — เฮลิคอปเตอร์โจมตียักษ์ บินบนจอ ตามแกน X ช้าๆ ยิงมิสไซล์ฝูงเฉียงลงทุก 3 วินาที
const HOPPER_W = 150, HOPPER_H = 64;
const HOPPER_HP = 600;
const HOPPER_PHASE2_HP = 300;
const HOPPER_ARMOR = 0.2;
const HOPPER_EXP = 300;
const HOPPER_REWARD_GOLD = 250;
const HOPPER_Y = 92;
const HOPPER_SPEED = 45, HOPPER_SPEED2 = 75;
const HOPPER_FIRE_CD = 3.0;
const HOPPER_WINDUP = 0.7;
const HOPPER_SWARM = 5, HOPPER_SWARM2 = 8;      // จำนวนมิสไซล์ต่อฝูง (เฟส 1 / เฟส 2)
const HOPPER_MISSILE_DMG = 9;
const HOPPER_MISSILE_SPEED = 240;
const HOPPER_MISSILE_SHIELD_COST = 9;

// Boss: Boss Sniper (ท้ายด่าน 04) — หุ่นสไนเปอร์ยักษ์ ยืนนิ่งขอบจอขวา เลเซอร์ไซต์ 1.5 วินาที แล้วยิงกระสุนเร็ว
const BSNIPER_W = 84, BSNIPER_H = 130;
const BSNIPER_HP = 520;
const BSNIPER_PHASE2_HP = 260;
const BSNIPER_ARMOR = 0.25;
const BSNIPER_EXP = 400;
const BSNIPER_REWARD_GOLD = 350;
const BSNIPER_DMG = 28;
const BSNIPER_REST = 1.4, BSNIPER_REST2 = 0.8;  // พักระหว่างนัด (เฟส 1 / เฟส 2)
const BSNIPER_OFFSET2 = 0.22;                    // เฟส 2: เส้นเลเซอร์เส้นที่ 2 เบี่ยงจากเส้นแรก (เรเดียน)

// Mission (ข้อมูลของแต่ละด่านอยู่ใน missions.js)
const CLEAR_DELAY = 1.8;       // วินาทีที่โชว์ AREA CLEAR ก่อนไปหน้าสรุปผล
const WAVE_BANNER_TIME = 1.8;  // วินาทีที่ป้าย WAVE INCOMING ค้างบนจอ

// Save
const SAVE_KEY = 'wanzer.save.v1';   // เปลี่ยนเลขเวอร์ชันเมื่อโครงสร้างเซฟเปลี่ยน

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
function hpColor(r) { return r > 0.5 ? '#5fd36f' : (r > 0.25 ? '#e0a526' : '#d9462f'); }
function fnt(weight, size) { return weight + ' ' + size + "px 'Chakra Petch', 'Noto Sans Thai', sans-serif"; }
function expToNext(lv) { return 60 + 40 * (lv - 1); }

// ศัตรูด่าน 05 (enemy3.js): เครื่องบินทิ้งระเบิด + รถยิงมิสไซล์ (ลูกเดียว / ฝูง)
const BOMBER_W = 80, BOMBER_H = 24;
const BOMBER_HP = 110;
const BOMBER_Y = 78;               // ความสูงบิน (px จากขอบบนจอ) แต่ละตัวเยื้องกันได้ตามค่าในเวฟ
const BOMBER_SPEED = 230;          // px/s ความเร็วบินตรง
const BOMBER_ACCEL = 300;          // px/s^2 ตอนกลับลำ (ค่าน้อย = วงเลี้ยวกว้าง)
const BOMBER_OVERSHOOT = 430;      // บินเลยตัวผู้เล่นไปไกลเท่านี้แล้วกลับลำ
const BOMBER_BOMB_CD = 0.3;        // ระยะห่างระหว่างลูกระเบิดที่หย่อน (วินาที)
const BOMBER_BOMB_WINDOW = 130;    // หย่อนเมื่อจุดตกที่คำนวณไว้ห่างจากผู้เล่นไม่เกินเท่านี้ (px)
const BOMB_GRAVITY = 620;
const BOMB_DMG = 16;
const BOMB_SPLASH = 38;            // รัศมีระเบิดตอนตกพื้น (px ซ้าย-ขวาของตัวผู้เล่น)
const BOMB_SHIELD_COST = 14;

const LAUNCHER_W = 76, LAUNCHER_H = 40;
const LAUNCHER_HP = 150;
const LAUNCHER_ARMOR = 0.25;
const LAUNCHER_SPEED = 28;
const LAUNCHER_STOP_DIST = 430;
const LAUNCHER_FIRE_CD = 3.6;
const LAUNCHER_WINDUP = 0.9;
const LAUNCHER_MISSILE_DMG = 24;
const LAUNCHER_MISSILE_SPEED = 250;
const LAUNCHER_MISSILE_SHIELD_COST = 16;

const SWARMER_HP = 120;
const SWARMER_ARMOR = 0.15;
const SWARMER_STOP_DIST = 520;
const SWARMER_FIRE_CD = 5.2;
const SWARMER_WINDUP = 1.0;
const SWARMER_COUNT = 7;           // มิสไซล์ต่อฝูง
const SWARMER_GAP = 0.16;          // ห่างกันลูกละกี่วินาที
const SWARMER_MISSILE_DMG = 8;
const SWARMER_MISSILE_SPEED = 225;
const SWARMER_MISSILE_SHIELD_COST = 6;
