'use strict';
/* ==========================================================================
   effects.js : เอฟเฟกต์ภาพทั้งหมด (ประกายไฟ ระเบิด ตัวเลขลอย จอสั่น เงา Dash)
   ========================================================================== */

let sparks = [];
let effects = [];       // วงกลมระเบิด / วงแหวน
let dmgNums = [];       // ข้อความลอยขึ้นแล้วจาง (ดาเมจ, EXP, LEVEL UP)
let afterimages = [];   // ภาพเงาตอน Dash
let shake = 0;          // ความแรงจอสั่น (พิกเซล)

function resetEffects() { sparks = []; effects = []; dmgNums = []; afterimages = []; shake = 0; }
function addShake(n) { shake = Math.max(shake, n); }

function spawnSparks(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * (0.15 + Math.random() * 0.7);
    const s = 80 + Math.random() * 200;
    sparks.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25 + Math.random() * 0.2, color: color });
  }
}

// ประกายไฟสีส้มกระเด็นไปทาง (nx, ny) เมื่อกระสุนกระทบ
function impact(x, y, nx, ny) {
  const base = Math.atan2(ny, nx);
  const colors = ['#ff8a2a', '#ff6a1a', '#ffb13b'];
  for (let i = 0; i < 9; i++) {
    const a = base + (Math.random() - 0.5) * 1.6;
    const s = 140 + Math.random() * 220;
    sparks.push({
      x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.15 + Math.random() * 0.2,
      color: colors[(Math.random() * colors.length) | 0]
    });
  }
}

function smallBoom(x, y, r) {
  effects.push({ x: x, y: y, maxR: r, delay: 0, dur: 0.3, t: 0 });
  effects.push({ x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, maxR: r * 0.7, delay: 0.05, dur: 0.3, t: 0 });
}

// ระเบิดวงกลมซ้อนกัน ใช้ทั้งกับศัตรูและผู้เล่น (ต้องมี x, y, w, h, type)
function explode(e) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  const size = e.type === 'walker' ? 1 : (e.type === 'tank' ? 1.6 : (e.type === 'chopper' ? 1.2 : (e.type === 'bomber' ? 1.4 : (e.type === 'launcher' || e.type === 'swarmer' ? 1.5 : 0.75))));
  for (let k = 0; k < 4; k++) {
    effects.push({
      x: cx + (Math.random() - 0.5) * e.w * 0.8,
      y: cy + (Math.random() - 0.5) * e.h * 0.8,
      maxR: (14 + Math.random() * 16) * size,
      delay: k * 0.07, dur: 0.4, t: 0
    });
  }
  spawnSparks(cx, cy, 16, '#ffb13b');
}

function addDmgNum(e, dmg, heavy, crit) {
  dmgNums.push({
    x: e.x + e.w / 2 + (Math.random() - 0.5) * 14, y: e.y - 22,
    vy: crit ? -130 : -110, life: crit ? 1.1 : 0.85, max: crit ? 1.1 : 0.85, text: '-' + dmg + (crit ? '!' : ''), heavy: heavy,
    color: crit ? '#ffd23f' : undefined, size: crit ? 26 : undefined      // คริติคอล: สีเหลืองทอง ตัวใหญ่
  });
}

function popText(x, y, text, color, size) {
  dmgNums.push({ x: x, y: y, vy: -70, life: 1.1, max: 1.1, text: text, heavy: false, color: color, size: size });
}

function updateEffects(dt) {
  shake *= Math.pow(0.004, dt);
  if (shake < 0.15) shake = 0;

  for (let i = dmgNums.length - 1; i >= 0; i--) {
    const d = dmgNums[i];
    d.y += d.vy * dt;
    d.vy *= Math.pow(0.05, dt);
    d.life -= dt;
    if (d.life <= 0) dmgNums.splice(i, 1);
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].t += dt;
    if (effects[i].t >= effects[i].delay + effects[i].dur) effects.splice(i, 1);
  }
  for (let i = afterimages.length - 1; i >= 0; i--) {
    afterimages[i].life -= dt;
    if (afterimages[i].life <= 0) afterimages.splice(i, 1);
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.vy += 900 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    if (s.life <= 0) sparks.splice(i, 1);
  }
}

function drawSparks() {
  for (const s of sparks) {
    ctx.globalAlpha = clamp(s.life / 0.3, 0, 1);
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x - cam - 1.5, s.y - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;
}

function drawEffects() {
  for (const f of effects) {
    const lt = f.t - f.delay;
    if (lt < 0) continue;
    const p = lt / f.dur;
    const r = f.maxR * (1 - (1 - p) * (1 - p));
    ctx.globalAlpha = 1 - p;
    if (f.ring) {
      ctx.strokeStyle = f.ring;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(f.x - cam, f.y, r, 0, Math.PI * 2); ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#ff9f2e';
    ctx.beginPath(); ctx.arc(f.x - cam, f.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff2c4';
    ctx.beginPath(); ctx.arc(f.x - cam, f.y, r * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawDmgNums() {
  ctx.textAlign = 'center';
  for (const d of dmgNums) {
    const a = clamp(d.life / d.max * 1.6, 0, 1);
    ctx.font = "700 " + (d.size || (d.heavy ? 20 : 14)) + "px 'Chakra Petch', monospace";
    ctx.globalAlpha = a;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(d.text, d.x - cam, d.y);
    ctx.fillStyle = d.color || (d.heavy ? '#ff5a3c' : '#ffffff');
    ctx.fillText(d.text, d.x - cam, d.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function drawAfterimages() {
  for (const a of afterimages) {
    ctx.globalAlpha = (a.life / 0.22) * 0.4;
    ctx.fillStyle = '#8fe3b0';
    ctx.fillRect(a.x - cam, a.y, player.w, player.h);
  }
  ctx.globalAlpha = 1;
}
