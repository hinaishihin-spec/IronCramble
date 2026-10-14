'use strict';
/* ==========================================================================
   world.js : กล้อง (Camera Scrolling) + ฉากหลัง + พื้น
   ========================================================================== */

let cam = 0;   // ตำแหน่งซ้ายสุดของกล้องในโลกเกม

function resetCamera() { cam = 0; }

// กล้องตามตัวหุ่น โดยให้หุ่นอยู่ค่อนไปทางซ้ายเพื่อเห็นด้านขวา (ทิศที่เดินหน้า)
function updateCamera(dt) {
  const cx = player.x + player.w / 2;
  const target = mission.lockX >= 0 ? mission.lockX : clamp(cx - W * 0.4, 0, WORLD_W - W);   // บอส: กล้องหยุดที่ lockX
  cam += (target - cam) * Math.min(1, dt * 8);
}

// ฉากหลายชั้น: แต่ละชั้นใช้ภาพวาดถ้ามีไฟล์ (ดู scenery.js) ไม่มีก็วาดแบบโค้ดเดิมเฉพาะชั้นนั้น
function drawBackground() {
  const sky = sceneImage('sky'), far = sceneImage('far'), mid = sceneImage('mid');

  if (sky) {
    ctx.fillStyle = '#1b2733';
    ctx.fillRect(-20, -20, W + 40, H + 40);
    drawSceneLayer(sky, 'sky');
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, '#1b2733');
    g.addColorStop(1, '#4a4a42');
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, W + 40, H + 40);   // เผื่อขอบไว้ตอนจอสั่น
  }

  if (far) drawSceneLayer(far, 'far');
  else {                                      // far ridge line (parallax 0.15)
    ctx.fillStyle = '#26303a';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    const farOff = cam * SCENE_FACTOR.far;
    for (let x = 0; x <= W + 40; x += 40) {
      const wx = Math.floor((x + farOff) / 40);
      ctx.lineTo(x, GROUND_Y - 90 - hash(wx) * 90);
    }
    ctx.lineTo(W + 40, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }

  if (mid) drawSceneLayer(mid, 'mid');
  else {                                      // mid ruined buildings (parallax 0.45)
    const midOff = cam * SCENE_FACTOR.mid;
    const cell = 130;
    const first = Math.floor(midOff / cell);
    ctx.fillStyle = '#323b40';
    for (let i = first; i < first + Math.ceil(W / cell) + 2; i++) {
      const bw = 60 + hash(i + 3) * 50;
      const bh = 50 + hash(i + 9) * 120;
      const bx = i * cell - midOff;
      ctx.fillRect(bx, GROUND_Y - bh, bw, bh);
      ctx.fillStyle = '#3b464b';
      ctx.fillRect(bx + 8, GROUND_Y - bh + 10, 8, 8);
      ctx.fillRect(bx + 26, GROUND_Y - bh + 10, 8, 8);
      ctx.fillStyle = '#323b40';
    }
  }
}

function drawGround() {
  const gimg = sceneImage('ground');
  if (gimg) {
    ctx.fillStyle = '#2b2d27';
    ctx.fillRect(-20, GROUND_Y, W + 40, H - GROUND_Y + 20);
    drawSceneLayer(gimg, 'ground');
  } else {
    ctx.fillStyle = '#2b2d27';
    ctx.fillRect(-20, GROUND_Y, W + 40, H - GROUND_Y + 20);
    ctx.fillStyle = '#5b5f4f';
    ctx.fillRect(-20, GROUND_Y, W + 40, 3);
  }

  // distance markers (10px = 1m)  มีภาพพื้นแล้วจะเหลือแค่ตัวเลขจางๆ ไม่วาดขีดทับภาพ
  ctx.font = "600 11px 'Chakra Petch', monospace";
  ctx.textAlign = 'center';
  const start = Math.floor(cam / 100) * 100;
  for (let wx = start; wx <= cam + W + 100; wx += 100) {
    const sx = wx - cam;
    const major = wx % 500 === 0;
    if (!gimg) {
      ctx.fillStyle = major ? '#8c9078' : '#4a4d41';
      ctx.fillRect(sx - 1, GROUND_Y + 3, 2, major ? 14 : 7);
    }
    if (major) {
      ctx.fillStyle = gimg ? 'rgba(255,255,255,0.45)' : '#8c9078';
      ctx.fillText((wx / 10) + ' m', sx, GROUND_Y + 32);
    }
  }
  ctx.textAlign = 'left';
}
