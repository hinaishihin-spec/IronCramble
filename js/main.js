'use strict';
/* ==========================================================================
   main.js : จุดเริ่มต้นของเกม — เปิดฉากแรก และวนลูปเกม (game loop)
   ไฟล์นี้ต้องถูกโหลดเป็นไฟล์สุดท้ายใน index.html
   ========================================================================== */

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);   // จำกัด dt กันเกมกระโดดเมื่อแท็บถูกพักไว้
  lastTime = now;
  tickFps(dt);
  pollGamepad(dt);                                      // จอยเกมแพด: เขียนสถานะลง keys/mouse ก่อนอัปเดตฉาก
  Scenes.update(dt);
  Scenes.render();
  requestAnimationFrame(frame);
}

Scenes.go('menu');
requestAnimationFrame(frame);
