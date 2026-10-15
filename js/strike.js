'use strict';
/* ==========================================================================
   strike.js : อาวุธโจมตีเป็นจุดจากฟ้า (ช่องมิซไซล์)  เป้า = ตำแหน่งเมาส์บนพื้นตอนกดยิง  มีเวลาหน่วงเตือนก่อนตก
     ORBITAL  X-Breaker      ดาวเทียมยิงเสาแสงลงมา โดนทุกตัวในแนวเสา (บนพื้นและบนอากาศ) 3 ติ๊ก
     NAPALM   Burning Rave   ทิ้งระเบิด 3 ลูกเรียงกัน ระเบิดแล้วเกิดไฟค้างบนพื้นหลายวินาที (ดาเมจต่อเนื่อง เฉพาะศัตรูที่ยืนบนพื้น)
   กติการ่วม: ดาเมจใส่บอสคูณ STRIKE_BOSS_MULT / ทำร้ายผู้เล่นได้ถ้ายืนในจุดตก (กางโล่ลดดาเมจ, กระโดดข้ามไฟนาปาล์มได้) / คูลดาวน์ยาวตาม cd ของอาวุธ
   ค่าตัวเลขอยู่ใน weapondb.js (ข้อมูลอาวุธ + ค่าคงที่ด้านบนของไฟล์นั้น)
   ========================================================================== */

let strikes = [];          // การโจมตีที่ยังไม่จบ
let firePatches = [];      // ไฟนาปาล์มค้างบนพื้น { x, hw, t, life, burn }
let fireTick = 0;

function resetStrikes() { strikes = []; firePatches = []; fireTick = 0; }

// กดยิง: ล็อกจุดเป้า (x ของเมาส์ในโลก) แล้วเริ่มนับเวลาหน่วง  คืนคูลดาวน์ (วินาที)
function startStrike(p, w) {
  const tx = clamp(mouse.x + cam, Math.max(0, cam + 24), Math.min(WORLD_W, cam + W - 24));
  const s = { kind: w.type, w: w, x: tx, t: 0, delay: w.delay || 1.3, ticks: 0, dmg: Math.max(1, Math.round(w.damage * atkMult())) };
  if (w.type === 'NAPALM') {
    s.burn = Math.max(1, Math.round((w.burn || 12) * atkMult()));
    s.bombs = [-1, 0, 1].map(function (k, i) { return { x: tx + k * NAPALM_SPREAD, land: s.delay + i * NAPALM_BOMB_GAP, hit: false }; });
  }
  strikes.push(s);
  addShake(2);
  return w.cd || 25;
}

function strikeDmgFor(e, d) { return e.type === 'boss' ? Math.max(1, Math.round(d * STRIKE_BOSS_MULT)) : d; }
function overlapX(e, x0, x1) { return e.x + e.w > x0 && e.x < x1; }
function strikeSfx(name) { try { Sfx.play(name); } catch (e) {} }

function orbitalHit(s) {
  const r = s.w.radius || 38, x0 = s.x - r, x1 = s.x + r;
  for (const e of enemies.slice()) {
    if (untargetable(e) || !overlapX(e, x0, x1)) continue;
    spawnSparks(e.x + e.w / 2, e.y + e.h / 2, 6, '#d9c2ff');
    damageEnemy(e, strikeDmgFor(e, s.dmg), true, true);
  }
  if (!player.dead && overlapX(player, x0, x1)) damagePlayer(STRIKE_SELF_DMG, STRIKE_SELF_SHIELD);
  spawnSparks(s.x, GROUND_Y - 4, 10, '#e8dcff');
  addShake(6);
}

function napalmLand(s, b) {
  b.hit = true;
  const hy = GROUND_Y - 120;
  for (const e of enemies.slice()) {
    if (untargetable(e) || e.y + e.h < hy) continue;                     // ระเบิดโดนเฉพาะตัวที่อยู่ต่ำใกล้พื้น
    if (Math.abs(e.x + e.w / 2 - b.x) > NAPALM_BLAST_R + e.w / 2) continue;
    damageEnemy(e, strikeDmgFor(e, s.dmg), true, true);
  }
  if (!player.dead && player.y + player.h > hy && Math.abs(player.x + player.w / 2 - b.x) < NAPALM_BLAST_R + player.w / 2) damagePlayer(STRIKE_SELF_DMG * 0.6, STRIKE_SELF_SHIELD * 0.6);
  firePatches.push({ x: b.x, hw: NAPALM_PATCH_HW, t: 0, life: s.w.fireLife || 6, burn: s.burn });
  smallBoom(b.x, GROUND_Y - 14, 46);
  spawnSparks(b.x, GROUND_Y - 10, 14, '#ffb13b');
  addShake(5);
  strikeSfx('napalm_boom');
}

function updateStrikes(dt) {
  for (let i = strikes.length - 1; i >= 0; i--) {
    const s = strikes[i];
    s.t += dt;
    if (s.kind === 'ORBITAL') {
      while (s.ticks < ORBITAL_TICKS && s.t >= s.delay + s.ticks * ORBITAL_TICK_GAP) {
        if (s.ticks === 0) strikeSfx('orbital_fire');
        orbitalHit(s); s.ticks++;
      }
      if (s.t >= s.delay + ORBITAL_TICK_GAP * (ORBITAL_TICKS - 1) + 0.35) strikes.splice(i, 1);
    } else {
      let all = true;
      for (const b of s.bombs) { if (!b.hit && s.t >= b.land) napalmLand(s, b); if (!b.hit) all = false; }
      if (all) strikes.splice(i, 1);
    }
  }
  for (let i = firePatches.length - 1; i >= 0; i--) { firePatches[i].t += dt; if (firePatches[i].t >= firePatches[i].life) firePatches.splice(i, 1); }
  if (!firePatches.length) { fireTick = 0; return; }
  fireTick -= dt;
  if (fireTick > 0) return;
  fireTick += NAPALM_TICK;
  const burnAt = function (e) {                                          // ดาเมจไฟสูงสุดของกองไฟที่ทับตัวนี้ (ไม่ซ้อนกันหลายกอง)
    let m = 0;
    for (const f of firePatches) if (overlapX(e, f.x - f.hw, f.x + f.hw)) m = Math.max(m, f.burn);
    return m;
  };
  for (const e of enemies.slice()) {
    if (untargetable(e) || e.y + e.h < GROUND_Y - 8) continue;           // ไฟเผาเฉพาะศัตรูที่ยืนบนพื้น (บินอยู่ไม่โดน)
    const b = burnAt(e);
    if (b) { spawnSparks(e.x + e.w / 2, e.y + e.h - 6, 3, '#ff9b3b'); damageEnemy(e, strikeDmgFor(e, b), true, true); }
  }
  if (!player.dead && player.onGround && burnAt(player)) damagePlayer(NAPALM_SELF_DMG, NAPALM_SELF_SHIELD);
}

// ---------- วาด ----------
function drawStrikes() {
  const t = performance.now() / 1000;
  for (const s of strikes) {
    const sx = s.x - cam;
    if (s.kind === 'ORBITAL') {
      const r = s.w.radius || 38;
      if (s.t < s.delay) {                                               // ช่วงเตือน: วงเล็งบนพื้นหดเข้า + เสาไกด์บาง + ดาวเทียมกะพริบข้างบน
        const k = s.t / s.delay, blink = Math.floor(s.t * (8 + 12 * k)) % 2 ? 1 : 0.55;
        ctx.save();
        ctx.strokeStyle = 'rgba(200,170,255,' + (0.25 + 0.5 * k) * blink + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(sx, GROUND_Y, r, 9, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(sx, GROUND_Y, r + 40 * (1 - k), 9 + 6 * (1 - k), 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(220,200,255,' + (0.1 + 0.25 * k) + ')';
        ctx.setLineDash([5, 7]);
        ctx.beginPath(); ctx.moveTo(sx - r, 30); ctx.lineTo(sx - r, GROUND_Y); ctx.moveTo(sx + r, 30); ctx.lineTo(sx + r, GROUND_Y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(230,220,255,' + 0.5 * blink + ')';          // ดาวเทียมจิ๋ว
        ctx.fillRect(sx - 4, 18, 8, 8); ctx.fillRect(sx - 16, 20, 9, 4); ctx.fillRect(sx + 7, 20, 9, 4);
        ctx.restore();
      } else {                                                            // ช่วงยิง: เสาแสงลงมาจากฟ้า จางตามเวลา
        const k = 1 - clamp((s.t - s.delay) / (ORBITAL_TICK_GAP * (ORBITAL_TICKS - 1) + 0.35), 0, 1);
        const w = r * (0.5 + 0.9 * k) * (1 + Math.sin(t * 60) * 0.04);
        ctx.save();
        ctx.fillStyle = 'rgba(160,110,255,' + 0.28 * k + ')';
        ctx.fillRect(sx - w * 1.5, 0, w * 3, GROUND_Y);
        ctx.fillStyle = 'rgba(205,175,255,' + 0.55 * k + ')';
        ctx.fillRect(sx - w, 0, w * 2, GROUND_Y);
        ctx.fillStyle = 'rgba(255,255,255,' + 0.95 * k + ')';
        ctx.fillRect(sx - w * 0.35, 0, w * 0.7, GROUND_Y);
        const g = ctx.createRadialGradient(sx, GROUND_Y, 0, sx, GROUND_Y, r * 2);
        g.addColorStop(0, 'rgba(255,255,255,' + 0.8 * k + ')'); g.addColorStop(1, 'rgba(160,110,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx, GROUND_Y, r * 2, 22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    } else {
      const span = NAPALM_SPREAD + NAPALM_PATCH_HW;                       // ช่วงเตือน: แถบเป้าสีส้มบนพื้น + ลูกระเบิดตกลงมา
      if (s.t < s.delay) {
        const k = s.t / s.delay, blink = Math.floor(s.t * (6 + 12 * k)) % 2 ? 1 : 0.55;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,150,60,' + (0.3 + 0.5 * k) * blink + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(sx, GROUND_Y, span, 10, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,120,40,' + 0.08 * (0.5 + k) + ')';
        ctx.fill();
        ctx.restore();
      }
      for (const b of s.bombs) {
        if (b.hit || s.t < 0.25) continue;
        const q = clamp((s.t - 0.25) / (b.land - 0.25), 0, 1), y = -30 + (GROUND_Y + 30) * q * q, bx = b.x - cam;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,170,70,0.5)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(bx, y - 34 * q); ctx.lineTo(bx, y - 6); ctx.stroke();
        ctx.fillStyle = '#2a2d31'; ctx.beginPath(); ctx.ellipse(bx, y, 5, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e05a2a'; ctx.fillRect(bx - 5, y - 2, 10, 3);
        ctx.restore();
      }
    }
  }
  for (const f of firePatches) {                                          // ไฟค้างบนพื้น
    const k = f.t / f.life, fade = Math.min(1, f.t / 0.3) * (k > 0.8 ? (1 - k) / 0.2 : 1);
    const x0 = f.x - f.hw - cam;
    ctx.save();
    const g = ctx.createLinearGradient(0, GROUND_Y - 30, 0, GROUND_Y + 4);
    g.addColorStop(0, 'rgba(255,120,30,0)'); g.addColorStop(1, 'rgba(255,150,40,' + 0.35 * fade + ')');
    ctx.fillStyle = g; ctx.fillRect(x0, GROUND_Y - 30, f.hw * 2, 34);
    const n = Math.floor(f.hw / 3);
    for (let i = 0; i < n; i++) {
      const fx = x0 + (i + 0.5) * (f.hw * 2 / n);
      const flick = 0.55 + 0.45 * Math.sin(t * 9 + i * 1.7 + f.x * 0.013), h = (12 + 20 * flick) * fade * (1 - 0.35 * Math.abs(i - n / 2) / (n / 2));
      ctx.fillStyle = 'rgba(255,90,20,' + 0.85 * fade + ')';
      ctx.beginPath(); ctx.moveTo(fx - 5, GROUND_Y); ctx.quadraticCurveTo(fx - 3, GROUND_Y - h * 0.6, fx + Math.sin(t * 7 + i) * 2, GROUND_Y - h); ctx.quadraticCurveTo(fx + 3, GROUND_Y - h * 0.6, fx + 5, GROUND_Y); ctx.fill();
      ctx.fillStyle = 'rgba(255,215,90,' + 0.9 * fade + ')';
      ctx.beginPath(); ctx.moveTo(fx - 2.5, GROUND_Y); ctx.quadraticCurveTo(fx - 1.5, GROUND_Y - h * 0.4, fx, GROUND_Y - h * 0.62); ctx.quadraticCurveTo(fx + 1.5, GROUND_Y - h * 0.4, fx + 2.5, GROUND_Y); ctx.fill();
    }
    ctx.restore();
  }
}
