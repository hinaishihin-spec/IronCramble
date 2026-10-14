'use strict';
/* ==========================================================================
   scenery.js : ภาพฉากหลายชั้นต่อด่าน (ฟ้า / ไกล / กลาง / พื้น) — วาดฉากด้วยภาพแทนโค้ดได้ทีละชั้น
   ไฟล์ภาพ (PNG โปร่งใสได้): assets/bg/<ชุด>_<ชั้น>.png   ชั้น = sky | far | mid | ground
     ชุด  = m<เลขด่าน> เช่น m1_far.png, m6_mid.png   หรือตั้งชื่อชุดเองที่ด่านใน missions.js:  scene: 'city'  -> city_far.png
            ด่านไหนไม่มีไฟล์ของตัวเอง จะใช้ชุด default (default_far.png ...) ทุกด่านใช้ร่วมกันได้   ไม่มีทั้งสองอย่าง = ฉากโค้ดเดิมของชั้นนั้น
     เมนู/Hangar/หน้าสรุปผล ใช้ชุด default
   ขนาด: ชั้น sky / far / mid ย่อให้สูงเท่าพื้นที่เหนือพื้น (GROUND_Y = 380 พิกเซลเกม) ความกว้างตามสัดส่วนภาพ ภาพซ้ายขวาต่อกันได้ = วนซ้ำเนียน
         แนะนำวาด 2 เท่า: สูง 760 กว้าง 3200 (sky กว้าง 1600 ก็พอ)   ชั้น ground ย่อให้สูงเท่าพื้น (70) แนะนำ 512 x 140 เลื่อนตามโลกจริง
   ความเร็วเลื่อน SCENE_FACTOR (เทียบกล้อง: 0 = นิ่ง, 1 = เลื่อนเท่าโลก) ปรับได้ด้านล่าง
   ไฟล์ในโฟลเดอร์ assets/ ถูกฝังตอน build (python3 build.py) เหมือนภาพพาร์ท
   ========================================================================== */

const SCENE_FACTOR = { sky: 0.02, far: 0.15, mid: 0.45, ground: 1.0 };
// ขนาดภาพของแต่ละชั้นเทียบค่าตั้งต้น (1 = สูงเต็มพื้นที่เหนือพื้น / เต็มความสูงพื้น) ย่อ < 1 ได้ถ้าภาพวาดออกมาใหญ่เกินไป
// far / mid ย่อแล้วล่างภาพยังชิดเส้นพื้น  เช่น mid: 0.7 = ตึกเตี้ยลง 30% (ความกว้างย่อตาม ตึกจึงเล็กลงทั้งภาพ)
const SCENE_SCALE = { sky: 1, far: 1, mid: 0.5, ground: 1 };

// ภาพของชั้นนี้ในด่านปัจจุบัน (ชุดของด่าน > default) ไม่มี = null
function sceneImage(layer) {
  const keys = [];
  if (typeof Scenes !== 'undefined' && Scenes.current === PlayScene && mission.def) keys.push(mission.def.scene || ('m' + mission.def.id));
  keys.push('default');
  for (const k of keys) {
    const img = partImage('assets/bg/' + k + '_' + layer + '.png');
    if (img) return img;
  }
  return null;
}

// วาดชั้นภาพวนซ้ำแนวนอน เลื่อนตามกล้อง x SCENE_FACTOR  ชั้น ground วางต่อจากเส้นพื้น ชั้นอื่นล่างภาพชิดเส้นพื้น (sky เริ่มที่ขอบบนจอ)
function drawSceneLayer(img, layer) {
  const ground = layer === 'ground';
  const base = ground ? H - GROUND_Y : GROUND_Y;
  const h = base * (SCENE_SCALE[layer] || 1);
  const y = ground ? GROUND_Y : (layer === 'sky' ? 0 : GROUND_Y - h);
  const w = img.width * h / img.height;
  const off = ((cam * SCENE_FACTOR[layer]) % w + w) % w;
  ctx.imageSmoothingEnabled = true;
  for (let x = -Math.round(off); x < W + 40; x += Math.round(w)) ctx.drawImage(img, x, y, Math.round(w) + 1, h);   // +1 กันรอยต่อบางๆ
}
