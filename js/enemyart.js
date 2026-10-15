'use strict';
/* ==========================================================================
   enemyart.js : ตัวโหลดภาพวาดของศัตรู/บอส  (วางไฟล์แล้วใช้แทนภาพโค้ดเดิมทันที ไม่มีไฟล์ = ใช้ภาพโค้ดเดิม ทีละตัวได้)
   ไฟล์: assets/enemies/<ชื่อ>.png   (PNG โปร่งใส วาดให้หัน "ซ้าย" โค้ดพลิกให้เองตามทิศที่ศัตรูหัน)
     ศัตรูทั่วไป: walker drone tank chopper sniper bomber monolet tplane swanzer mwanzer launcher swarmer fighter
     บอส:         boss_fortress boss_hopper boss_sniper boss_bomber boss_mimic boss_carrier boss_megabolt
       (Fortress/Bomber ที่แยกออกจาก Giant Carrier ในด่าน 7 ใช้ภาพ boss_fortress / boss_bomber ชุดเดียวกัน)
   เฟรมแอนิเมชัน (ไม่บังคับ): <ชื่อ>_2.png, <ชื่อ>_3.png ... (สูงสุด 6 เฟรม) สลับวนตามเวลา  ความเร็ว = fps ใน ENEMY_ART
   ขนาดที่วางในเกม: สูง = ความสูงกรอบโดนยิงของศัตรู x scale  กว้างตามสัดส่วนภาพ  ชิดล่างของกรอบ กึ่งกลางกรอบ
     ภาพจะใหญ่กว่ากรอบโดนได้ (เช่นปืนยื่นออกนอกกรอบ) ปรับด้วย scale / ox (ขยับไปทางหน้า) / oy (ขยับลง) ได้ที่ ENEMY_ART ด้านล่าง
     ขนาดวาดที่แนะนำ = 3-4 เท่าของกรอบโดน (ดูตาราง ENEMY_BOX) ภาพจะย่อลงตอนวาดจึงคมกว่า
   สิ่งที่ยังเป็นโค้ดวาดทับ: หลอด HP, เลเซอร์ไซต์ของสไนเปอร์, ลำแสงเลเซอร์ของ Giant Carrier, กระสุน/ระเบิด/เอฟเฟกต์ทั้งหมด
     แต่ส่วนที่ติดกับตัว (แขนปืนหมุนได้ของ Fortress, แสงชาร์จที่ปากปืน, ใบพัด) จะไม่แสดงเมื่อใช้ภาพ (ภาพเดียวทั้งตัว)
   ตรวจชื่อไฟล์ผิด: เปิด Console (F12) พิมพ์ missingAssets()
   ========================================================================== */

// ปรับต่อชนิด: scale (1 = สูงเท่ากรอบโดน)  ox (px ไปทางหน้า)  oy (px ลงล่าง)  fps (ความเร็วสลับเฟรม)  bar (ระยะหลอด HP เหนือกรอบ)
// ใส่เฉพาะตัวที่ต้องปรับ  ตัวอย่าง:  tank: { scale: 1.3, oy: 4 }
const ENEMY_ART = {
  // walker: { scale: 1, ox: 0, oy: 0, fps: 6 },
};
const ENEMY_ART_FPS = 6;
const ENEMY_BAR = { walker: 12, drone: 18, tank: 22, chopper: 24, sniper: 14, bomber: 18, monolet: 12, tplane: 18, swanzer: 16, mwanzer: 16, launcher: 24, swarmer: 24, fighter: 12 };
// กรอบโดนของแต่ละตัว (กว้าง x สูง พิกเซลเกม) ไว้อ้างอิงขนาดภาพ — ไม่ได้ใช้ในโค้ด
const ENEMY_BOX = {
  walker: [38, 46], drone: [34, 22], tank: [64, 36], chopper: [60, 26], sniper: [30, 50], bomber: [80, 24], monolet: [42, 72], tplane: [92, 22],
  swanzer: [40, 70], mwanzer: [40, 70], launcher: [76, 40], swarmer: [76, 40], fighter: [36, 14],
  boss_fortress: [120, 120], boss_hopper: [150, 64], boss_sniper: [84, 130], boss_bomber: [190, 50], boss_mimic: [54, 96], boss_carrier: [230, 134], boss_megabolt: [250, 150]
};

const ART_WHITE = new Map();        // ภาพ -> เงาขาว (ตอนโดนยิงกะพริบ)
function artWhite(img) {
  let c = ART_WHITE.get(img);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    ART_WHITE.set(img, c);
  }
  return c;
}

function enemyArtKey(e) { return e.type === 'boss' ? 'boss_' + e.kind : e.type === 'swarmer' ? 'swarmer' : e.type; }

// ทิศที่ศัตรูหัน: +1 ขวา / -1 ซ้าย
function enemyArtFacing(e) {
  if ((e.type === 'swanzer' || e.type === 'mwanzer') && typeof wzFacing === 'function') return wzFacing(e);
  if (e.kind === 'mimic' && typeof mimicFacing === 'function') return mimicFacing(e);
  return e.dir > 0 ? 1 : -1;
}

// เฟรมที่ต้องวาดตอนนี้ ไม่มีไฟล์ = null
function enemyArtImage(key, e) {
  const base = partImage('assets/enemies/' + key + '.png');
  if (!base) return null;
  const imgs = [base];
  for (let i = 2; i <= 6; i++) {
    const f = partImage('assets/enemies/' + key + '_' + i + '.png');
    if (!f) break;
    imgs.push(f);
  }
  if (imgs.length === 1) return base;
  const cfg = ENEMY_ART[key] || {};
  const fps = cfg.fps || ENEMY_ART_FPS;
  return imgs[Math.floor((performance.now() / 1000 + (e.phase || 0)) * fps) % imgs.length];
}

// วาดภาพแทนตัวโค้ด คืน true ถ้าวาดแล้ว (ไม่มีไฟล์ = false ให้โค้ดเดิมวาดต่อ)
function drawEnemyArt(e, sx, sy, flash) {
  const key = enemyArtKey(e);
  const img = enemyArtImage(key, e);
  if (!img) return false;
  const cfg = ENEMY_ART[key] || {};
  const face = enemyArtFacing(e);
  const flip = (face > 0) === (typeof ART_FACES_LEFT === 'undefined' ? true : ART_FACES_LEFT);
  const dh = e.h * (cfg.scale || 1);
  const dw = img.naturalWidth * dh / img.naturalHeight;
  const cx = sx + e.w / 2 + (cfg.ox || 0) * face;
  const y = sy + e.h - dh + (cfg.oy || 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.translate(cx, 0);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -dw / 2, y, dw, dh);
  if (flash) ctx.drawImage(artWhite(img), -dw / 2, y, dw, dh);
  ctx.restore();
  return true;
}
