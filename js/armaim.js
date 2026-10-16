'use strict';
/* ==========================================================================
   armaim.js : ภาพแขนท่าเล็ง/ถือปืน (arms_<ไอดีพาร์ท>_aims.png)
   - ภาพแขนปกติ (assets/parts/arms_<ไอดี>.png) วาดห้อยลงและหมุนรอบไหล่ตามมุมเล็ง ส่วนภาพ "_aims" คือแขนท่าถือปืนที่วาดไว้แล้ว (เช่นแขนงอ)
     ถ้าพาร์ทแขนที่สวมอยู่มีไฟล์ _aims ตอนถืออาวุธจะใช้ภาพนี้แทน ไม่มีไฟล์ = ใช้ภาพแขนปกติเหมือนเดิม (ถอดอาวุธใน Hangar ใช้ภาพปกติเสมอ)
   - วาดท่านี้ "หันซ้าย เล็งตรงไปทางซ้ายแนวนอน" (เหมือนภาพอาวุธ) โค้ดหมุน/พลิกตามเมาส์ให้เอง
   - สเกลเดียวกับภาพแขนปกติของพาร์ทนั้น (ย่อ/ขยายพิกเซลต่อพิกเซลเท่ากัน) ปรับเพิ่มได้ด้วย aimRig.scale
   - จุดอ้างอิงเป็นสัดส่วน 0..1 บนภาพ _aims:  a = ข้อต่อไหล่ (จุดหมุน)   hand = ตำแหน่งมือที่จับอาวุธ (ปืนวางตรงนี้ กระสุนออกจากจุดนี้ + ความยาวปืน)
     ตั้งค่าตั้งต้นของทุกพาร์ทที่ ARM_AIM_RIG  ถ้าพาร์ทไหนไม่เหมือน ใส่ aimRig: { a: [x, y], hand: [x, y], scale: 1 } ในข้อมูลพาร์ทแขนชิ้นนั้น (js/parts.js)
   - เปิด ARM_AIM_DEBUG = true จะเห็นจุดแดง = ไหล่ จุดฟ้า = มือ บนแขน ไว้ตั้งค่าให้ตรงภาพ
   ไฟล์นี้ต้องโหลดหลัง parts.js (ใช้ฟังก์ชัน partImage / partSpriteUrl)
   ========================================================================== */

const ARM_AIM_RIG = { a: [0.8, 0.25], hand: [0.1, 0.75], scale: 1 };   // ค่าตั้งต้น (ภาพวาดหันซ้าย): ไหล่อยู่ทางขวาของภาพ มืออยู่ทางซ้าย
const ARM_AIM_DEBUG = false;

// ข้อมูลภาพแขนท่าเล็งของพาร์ทแขนที่สวมอยู่ (null = ไม่มีไฟล์ ใช้แขนปกติ)
function armAimInfo() {
  const id = profile.equippedParts.ARMS;
  const img = partImage(partSpriteUrl('ARMS', id, '_aims'));
  if (!img) return null;
  const base = equippedPartImage('ARMS'), part = findPart('ARMS', id);
  const rig = Object.assign({}, ARM_AIM_RIG, part && part.aimRig);
  return { img: img, a: rig.a, hand: rig.hand, sc: (base ? SPRITE_H.ARMS / base.height : 1) * (rig.scale || 1) };
}

// ตำแหน่งมือหลังหมุนแขนท่าเล็งไปตามมุม ang รอบไหล่ (px,py)  k = สเกล  ex = แขนยืดตอนชก
function armAimHandAt(ai, px, py, ang, k, ex) {
  let vx = (ai.hand[0] - ai.a[0]) * ai.img.width * ai.sc * k * (1 + (ex || 0)), vy = (ai.hand[1] - ai.a[1]) * ai.img.height * ai.sc * k;
  if (ART_FACES_LEFT) vx = -vx;
  if (Math.cos(ang) < 0) vy = -vy;
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: px + vx * c - vy * s, y: py + vx * s + vy * c };
}

function drawAimArm(ai, ax, ay, ang, k, ex) {
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(ang);
  if (Math.cos(ang) < 0) ctx.scale(1, -1);               // เล็งไปซ้ายพลิกแนวตั้งไม่ให้กลับหัว (เหมือนภาพอาวุธ)
  if (ART_FACES_LEFT) ctx.scale(-1, 1);
  ctx.scale(ai.sc * k * (1 + (ex || 0)), ai.sc * k);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ai.img, -ai.a[0] * ai.img.width, -ai.a[1] * ai.img.height);
  ctx.restore();
  if (ARM_AIM_DEBUG) {
    const h = armAimHandAt(ai, ax, ay, ang, k, ex);
    ctx.fillStyle = '#ff3b3b'; ctx.fillRect(ax - 2, ay - 2, 4, 4);
    ctx.fillStyle = '#3bb8ff'; ctx.fillRect(h.x - 2, h.y - 2, 4, 4);
  }
}
