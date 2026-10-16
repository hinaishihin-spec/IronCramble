'use strict';
/* ==========================================================================
   aimassist.js : Aim assist สำหรับจอยเกมแพด (สติ๊กขวาเล็ง)  เมาส์ไม่ได้รับผลใด ๆ
   - ตอนสติ๊กขวาชี้ไปใกล้ศัตรู ทิศเล็งจะถูก "ดูดเข้าหาเป้าเบา ๆ" (ไม่ล็อกเต็มตัว ยังเล็ง 360 องศาเองได้)
   - เป้าที่ช่วย: ศัตรูบนจอในระยะ AIM_ASSIST_RANGE ที่ทิศอยู่ในกรวย AIM_ASSIST_CONE (ศัตรูตัวใหญ่/ใกล้ = กรวยกว้างขึ้น)
     ติดเป้าเดิมไว้จนสติ๊กเบนออกไปไกลกว่ากรวย x AIM_ASSIST_STICKY  เป้าเปลี่ยนแบบนุ่ม ๆ ไม่กระชาก
   - ปิดทั้งระบบ: AIM_ASSIST_ON = false   ปรับแรงดูด: AIM_ASSIST_PULL (0 = ไม่ดูด, 1 = ดูดตรงเป้าเลย)
   ใช้จาก gamepad.js (padAimAssist)  ไฟล์นี้ต้องโหลดก่อน gamepad.js
   ========================================================================== */

const AIM_ASSIST_ON = true;
const AIM_ASSIST_RANGE = 460;      // ระยะไกลสุดที่ช่วยเล็ง (พิกเซล จากหัวไหล่)
const AIM_ASSIST_CONE = 0.20;      // ครึ่งมุมกรวยพื้นฐาน (เรเดียน ~11.5 องศา) บวกมุมขนาดตัวศัตรูตามระยะ
const AIM_ASSIST_PULL = 0.65;      // สัดส่วนของมุมที่คลาดจากเป้าซึ่งถูกดึงเข้า (0-1)
const AIM_ASSIST_STICKY = 1.5;     // ติดเป้าเดิมจนกว่ามุมคลาดเกินกรวย x ค่านี้
const AIM_ASSIST_SMOOTH = 14;      // ความนุ่มของการดึง (ยิ่งมากยิ่งไวตาม)

const AIMASSIST = { target: null, corr: 0 };

function aimAssistAngDiff(a, b) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }

// ap = หัวไหล่ (โลก)  ax, ay = ทิศเล็งจากสติ๊ก (เวกเตอร์หน่วย)  คืนทิศเล็งใหม่ { x, y } (หน่วยเช่นกัน)  active=false = ไม่ช่วย (ล้างเป้า)
function padAimAssist(ap, ax, ay, dt, active) {
  const ang = Math.atan2(ay, ax);
  let want = 0, tgt = null;
  if (AIM_ASSIST_ON && active) {
    let best = Infinity;
    for (const e of enemies) {
      if (untargetable(e)) continue;
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2, sx = cx - cam;
      if (sx < -20 || sx > W + 20) continue;                     // นอกจอ ไม่ช่วย
      const d = Math.hypot(cx - ap.x, cy - ap.y);
      if (d > AIM_ASSIST_RANGE || d < 1) continue;
      const diff = aimAssistAngDiff(ang, Math.atan2(cy - ap.y, cx - ap.x));
      const tol = AIM_ASSIST_CONE + Math.atan2(Math.max(e.w, e.h) / 2, d);
      const lim = e === AIMASSIST.target ? tol * AIM_ASSIST_STICKY : tol;
      const score = Math.abs(diff) / lim;
      if (score <= 1 && score < best) { best = score; tgt = e; want = diff * AIM_ASSIST_PULL; }
    }
  }
  AIMASSIST.target = tgt;
  AIMASSIST.corr += (want - AIMASSIST.corr) * Math.min(1, dt * AIM_ASSIST_SMOOTH);
  if (!tgt && Math.abs(AIMASSIST.corr) < 0.002) AIMASSIST.corr = 0;
  const a2 = ang + AIMASSIST.corr;
  return { x: Math.cos(a2), y: Math.sin(a2) };
}
