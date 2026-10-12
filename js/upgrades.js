'use strict';
/* ==========================================================================
   upgrades.js : ข้อมูลและกฎของการอัปเกรด/ซื้ออาวุธ (ไม่มีโค้ดวาด)
   - สเตตัสรวม maxHp(), maxFuel(), fuelRechargeRate() คำนวณจากชิ้นส่วนหุ่นใน parts.js
   ========================================================================== */

// สเตตัสรวมจากชิ้นส่วนที่สวมอยู่ (ดู parts.js)
function maxHp() { return PLAYER_HP + partsHpBonus(); }
function maxFuel() { return partsBoostSeconds() * FUEL_DRAIN * partsFuelWeightMult(); }                 // เกจ Booster = เวลาบินของแพ็กหลัง x อัตราสิ้นเปลือง
function fuelRechargeRate() { return FUEL_RECHARGE * partsEnergyMult(); }      // พลังงานลำตัวกำหนดความเร็วชาร์จ
function flightSeconds(fuel) { return (fuel === undefined ? maxFuel() : fuel) / FUEL_DRAIN; }

// อาวุธ (ปืน/มิสไซล์ 2 ช่อง) ซื้อและสวมผ่าน buyOrEquipWeapon ใน weapondb.js · ชิ้นส่วนหุ่นผ่าน buyOrEquipPart ใน parts.js
