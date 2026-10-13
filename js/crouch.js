'use strict';
/* ==========================================================================
   crouch.js : ท่านั่ง/ย่อตัว — กด S หรือ ลูกศรล่าง ค้างไว้ (บนพื้น)
   - ตัวหุ่นย่อลง CROUCH.drop พิกเซลเกม (ลำตัว หัว แขน พอด จุดยิงลดตาม) กรอบชนเตี้ยลงเท่ากัน กระสุนที่ยิงมาสูงจะลอยข้ามหัว
   - เดินช้าลงเหลือ CROUCH.speed เท่า  กระโดด/แดชแล้วลุกขึ้นเอง  ยิงปืน/มิสไซล์/โล่ระหว่างนั่งได้
   - ภาพขาท่านั่ง: วาง PNG ชื่อ  assets/parts/legs_<ไอดีขา>_crouch.png  (เช่น legs_basic_crouch.png)
       วาดหันซ้ายและจุดอ้างอิงเหมือนภาพขาปกติ (กึ่งกลางเท้าชิดขอบล่าง) ขนาดใหญ่เท่าไหร่ก็ได้ โค้ดย่อให้สูงตามด้านล่าง
       ขาที่ไม่มีภาพท่านั่งจะใช้ภาพท่านั่งของพาร์ทตั้งต้น ถ้าไม่มีเลยจะบีบภาพขายืนให้เตี้ยลงแทน
   - ขาพิเศษปรับท่านั่งของตัวเองได้ที่ rig ในข้อมูลขา:  rig: { crouch: { h: ความสูงภาพขาตอนนั่ง, hip: สูงจากพื้นถึงสะโพกตอนนั่ง, hipX: ... } }
   ========================================================================== */

const CROUCH = {
  drop: 13,        // ย่อลงกี่พิกเซลเกม (สะโพกเตี้ยลง และกรอบชนเตี้ยลงเท่ากัน)
  speed: 0.45,     // ความเร็วเดินตอนนั่ง (เท่าของปกติ)
  legScale: 1.25,   // ขยาย/ย่อภาพขาท่านั่ง (1.15 = ใหญ่ขึ้น 15%) กว้างและสูงขยายพร้อมกัน เท้ายังชิดพื้น
  ease: 16         // ความเร็วลงนั่ง/ลุก (ยิ่งมากยิ่งไว)
};

function crouchHeld() {
  return !!(keys.KeyS || keys.ArrowDown) && !(keys.KeyW || keys.Space || keys.ArrowUp);
}

// เรียกทุกเฟรมจาก updatePlayer: ปรับระดับการนั่ง (0..1) และความสูงกรอบชน โดยเท้าติดพื้นเท่าเดิม
function updateCrouch(p, dt, dashing) {
  const want = !p.dead && p.onGround && !dashing && crouchHeld();
  p.crouch += ((want ? 1 : 0) - p.crouch) * Math.min(1, dt * CROUCH.ease);
  if (p.crouch < 0.01) p.crouch = 0;
  const h = PLAYER_BOX.h - CROUCH.drop * p.crouch, feet = p.y + p.h;
  p.h = h; p.y = feet - h;
}
function crouchSpeedMult() { return 1 - (1 - CROUCH.speed) * player.crouch; }

// ภาพขาท่านั่ง (ใช้เมื่อนั่งเกินครึ่ง) ไม่มีภาพ = null
function crouchLegImage() {
  return player.crouch > 0.5 ? equippedPartImage('LEGS', '_crouch') : null;
}

// ครอบ legRig(): ระหว่างนั่งให้สะโพกเตี้ยลง ขาหดสั้นลง (ใช้เฉพาะตอนเล่นด่าน ไม่กระทบพรีวิวใน Hangar)
(function () {
  const baseRig = legRig;
  legRig = function () {
    const base = baseRig(), c = (typeof player !== 'undefined' && Scenes.current === PlayScene) ? player.crouch : 0;
    if (!c) return base;
    const part = findPart('LEGS', profile.equippedParts.LEGS), cr = (part && part.rig && part.rig.crouch) || {};
    const th = cr.h !== undefined ? cr.h : (base.h - CROUCH.drop) * CROUCH.legScale;
    const thip = cr.hip !== undefined ? cr.hip : base.hip - CROUCH.drop;
    const tx = cr.hipX !== undefined ? cr.hipX : base.hipX;
    return Object.assign({}, base, { h: base.h + (th - base.h) * c, hip: base.hip + (thip - base.hip) * c, hipX: base.hipX + (tx - base.hipX) * c });
  };
})();
