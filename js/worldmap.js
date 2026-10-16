'use strict';
/* ==========================================================================
   worldmap.js : แผนที่โลก (WORLD MAP) — เลือกด่านจากแผนที่ แทนการเลื่อน < > ใน Hangar (ปุ่ม < > ยังใช้ได้เหมือนเดิม)
   เปิดจาก Hangar: ปุ่ม MAP หรือกด N (M ใช้เปิด/ปิดเสียง)     กดโหนดด่านที่เล่นได้ = เลือกด่านนั้นแล้วกลับเข้า Hangar (ยังไม่เริ่มเล่น)
   2 ระดับ:  1) โลก = ภูมิภาคเรียงตามเส้นทาง (MAP_REGIONS)   2) ภูมิภาค = โหนดด่านของภูมิภาคนั้น
   ปุ่ม:  เมาส์คลิก / A D หรือ ลูกศร = เลือก   Enter / Space = เข้า   Esc = ย้อนกลับ   จอยเกมแพด: D-pad + A / B (ระบบเมนูปกติ)

   เพิ่มภูมิภาค / ย้ายด่านเข้าภูมิภาค: แก้ตาราง MAP_REGIONS ด้านล่างที่เดียว
     first / last = เลขด่าน (id ใน missions.js) ของภูมิภาคนี้ (ต่อเนื่องตามลำดับด่าน)  ช่วงที่ยังไม่มีด่านจริง = โหนด "COMING SOON"
     x, y = ตำแหน่งบนแผนที่โลก (800 x 450)   color = สีประจำภูมิภาค
     ภูมิภาคที่ไม่มีด่านจริงเลย = เป็นวงประเทียบ "COMING SOON" กดเข้าไม่ได้
   ภาพวาดเอง (ไม่บังคับ):  assets/map/world.png  (พื้นหลังแผนที่โลก 800 x 450)   assets/map/<id ภูมิภาค>.png  (พื้นหลังของภูมิภาคนั้น เช่น assets/map/desert.png)
     ไม่มีไฟล์ = วาดฉากพื้นฐานด้วยโค้ด  ตำแหน่งโหนดยังอยู่ตามตารางนี้ (ปรับให้ตรงภาพได้)
   ========================================================================== */

const MAP_REGIONS = [
  { id: 'city1',      name: 'เมืองแรก',      en: 'CITY I',        first: 1,  last: 5,  x: 90,  y: 325, color: '#5aa9ff' },
  { id: 'desert',     name: 'ทะเลทราย',      en: 'DESERT',        first: 6,  last: 9,  x: 215, y: 272, color: '#e0a526' },
  { id: 'factory',    name: 'โรงงาน',        en: 'FACTORY',       first: 10, last: 14, x: 340, y: 325, color: '#e07a2a' },
  { id: 'jungle',     name: 'ป่าดิบ',        en: 'JUNGLE',        first: 15, last: 19, x: 465, y: 272, color: '#43b25f' },
  { id: 'city2',      name: 'เมืองสอง',      en: 'CITY II',       first: 20, last: 24, x: 590, y: 325, color: '#9a86e0' },
  { id: 'seaside',    name: 'ริมทะเล',       en: 'SEASIDE',       first: 25, last: 28, x: 705, y: 265, color: '#3fc2c9' },
  { id: 'undersea',   name: 'ใต้ทะเล',       en: 'UNDERSEA',      first: 29, last: 33, x: 685, y: 185, color: '#2f78d8' },
  { id: 'wasteland',  name: 'แดนร้าง',       en: 'WASTELAND',     first: 34, last: 37, x: 560, y: 140, color: '#b0623e' },
  { id: 'city3',      name: 'เมืองสาม',      en: 'CITY III',      first: 38, last: 42, x: 435, y: 192, color: '#d070d8' },
  { id: 'sky',        name: 'ปราการลอยฟ้า',  en: 'SKY FORTRESS',  first: 43, last: 47, x: 310, y: 130, color: '#9fd8ff' },
  { id: 'space',      name: 'สถานีอวกาศ',    en: 'SPACE STATION', first: 48, last: 50, x: 185, y: 85, color: '#e8e8ff' }
];

const MAP_NODE_R = 21;

function mapMissionById(id) {
  for (let i = 0; i < MISSIONS.length; i++) if (MISSIONS[i].id === id) return i;
  return -1;
}
function mapRegionOf(missionId) {
  for (let i = 0; i < MAP_REGIONS.length; i++) if (missionId >= MAP_REGIONS[i].first && missionId <= MAP_REGIONS[i].last) return i;
  return -1;
}
function mapPlanned(r) { return r.last - r.first + 1; }
function mapRegionInfo(r) {                        // สรุปสถานะภูมิภาค
  let exist = 0, cleared = 0, firstIdx = -1;
  for (let id = r.first; id <= r.last; id++) {
    const i = mapMissionById(id);
    if (i < 0) continue;
    exist++; if (firstIdx < 0) firstIdx = i;
    if (clearsOf(id) > 0) cleared++;
  }
  let state = 'open';
  if (!exist) state = 'soon';
  else if (!missionUnlocked(firstIdx)) state = 'locked';
  else if (cleared === mapPlanned(r)) state = 'done';
  return { exist: exist, cleared: cleared, state: state, planned: mapPlanned(r) };
}

// สิ่งที่ปลดล็อกจากการเคลียร์ด่านนี้ซ้ำ (จากอาวุธ/พาร์ทที่มีฟิลด์ unlock): { id ด่าน: [{ name, need }] }
function mapUnlocksOf(missionId) {
  const out = [];
  for (const w of WEAPON_FLAT) if (w.unlock && w.unlock.mission === missionId) out.push({ name: w.name, need: w.unlock.clears || 1 });
  for (const c of PART_CATEGORIES) for (const p of WANZER_PARTS[c]) if (p.unlock && p.unlock.mission === missionId) out.push({ name: p.name + ' (' + PART_CAT_LABEL[c] + ')', need: p.unlock.clears || 1 });
  return out;
}

// รายการศัตรูของด่านสำหรับแสดงผล: [{ label, n }] เรียงตามลำดับใน ENEMY_LABEL (ไม่รวมบอส)
function missionEnemyList(m) {
  const t = missionTotals(m), out = [];
  for (const k in ENEMY_LABEL) if (k !== 'boss' && t[k] > 0) out.push({ label: ENEMY_LABEL[k], n: t[k] });
  return out;
}
// ข้อความสั้นๆ ของด่าน ใช้ใน Hangar / เมนู (รายการศัตรูเต็มอยู่ในป๊อบอัพบนแผนที่): บอส + รางวัล
function missionBriefText(m, withLength) {
  const parts = [];
  if (withLength) parts.push('ความยาว ' + m.lengthM + ' m');
  if (m.boss) parts.push('BOSS: ' + m.boss.name.replace(/^BOSS\s+/, ''));
  parts.push('+' + m.bonusExp + ' EXP  +' + m.bonusGold + ' CR');
  return parts.join('   |   ');
}

function mapFitLeft(s, x, y, weight, size, color, maxW) {   // ย่อฟอนต์ไม่เกิน 9px แล้วตัดท้ายด้วย ... ถ้ายังยาวเกิน
  ctx.font = fnt(weight, size);
  while (size > 9 && ctx.measureText(s).width > maxW) { size--; ctx.font = fnt(weight, size); }
  if (ctx.measureText(s).width > maxW) {
    while (s.length > 4 && ctx.measureText(s + '...').width > maxW) s = s.slice(0, -1);
    s += '...';
  }
  drawText(s, x, y, fnt(weight, size), color, 'left');
}

const MapScene = {
  level: 'world',        // 'world' | 'region'
  reg: 0,                // ภูมิภาคที่เปิดอยู่ (ระดับ region)
  cur: 0,                // ตัวที่เลือกอยู่: ระดับ world = ภูมิภาค / ระดับ region = ช่องด่านในภูมิภาค
  items: [],
  hover: -1,
  t: 0,
  msg: '', msgT: 0,

  enter: function (data) {
    ensureValidSelection();
    this.t = 0; this.msg = ''; this.msgT = 0;
    const cur = MISSIONS[selectedMission];
    const ri = cur ? mapRegionOf(cur.id) : 0;
    this.reg = Math.max(0, ri);
    this.level = data && data.level ? data.level : 'world';
    this.cur = this.level === 'world' ? this.reg : Math.max(0, cur.id - MAP_REGIONS[this.reg].first);
    this.rebuild();
  },

  say: function (s) { this.msg = s; this.msgT = 2.5; },

  slotPos: function (k, n) {
    if (n <= 1) return { x: 400, y: 200 };
    return { x: 110 + k * (580 / (n - 1)), y: 118 + (k % 2 ? -26 : 26) };   // โหนดอยู่ครึ่งบน เว้นครึ่งล่างให้ป๊อบอัพข้อมูลศัตรู
  },

  rebuild: function () {
    const items = [], self = this;
    if (this.level === 'world') {
      for (let i = 0; i < MAP_REGIONS.length; i++) {
        const r = MAP_REGIONS[i];
        items.push({ region: i, x: r.x - 30, y: r.y - 30, w: 60, h: 60, action: (function (k) { return function () { self.cur = k; self.activate(); }; })(i) });
      }
      items.push({ x: W - 134, y: 10, w: 110, h: 26, small: true, label: '< HANGAR', action: function () { Scenes.go('hangar'); } });
    } else {
      const r = MAP_REGIONS[this.reg], n = mapPlanned(r);
      for (let k = 0; k < n; k++) {
        const p = this.slotPos(k, n);
        items.push({ slot: k, x: p.x - 28, y: p.y - 28, w: 56, h: 56, action: (function (j) { return function () { self.cur = j; self.activate(); }; })(k) });
      }
      items.push({ x: W - 134, y: 10, w: 110, h: 26, small: true, label: '< BACK', action: function () { self.back(); } });
      items.push({
        x: 622, y: 366, w: 140, h: 44, primary: true, hint: 'Enter', label: 'HANGAR',
        disabled: function () { return !self.slotGo(self.cur); },
        action: function () { self.activate(); }
      });
    }
    this.items = items;
  },

  // ช่องด่านนี้เข้า Hangar ได้ไหม: คืน index ใน MISSIONS ถ้าเล่นได้ ไม่งั้น -1
  slotGo: function (k) {
    const r = MAP_REGIONS[this.reg], i = mapMissionById(r.first + k);
    return i >= 0 && missionUnlocked(i) ? i : -1;
  },

  back: function () {
    if (this.level === 'region') { this.level = 'world'; this.cur = this.reg; this.rebuild(); }
    else Scenes.go('hangar');
  },

  activate: function () {
    if (this.level === 'world') {
      const r = MAP_REGIONS[this.cur], info = mapRegionInfo(r);
      if (info.state === 'soon') { this.say('ภูมิภาคนี้ยังไม่เปิด (COMING SOON)'); return; }
      this.reg = this.cur; this.level = 'region';
      const cm = MISSIONS[selectedMission], inReg = cm && cm.id >= r.first && cm.id <= r.last;
      let k = inReg ? cm.id - r.first : 0;
      if (!inReg) for (let j = 0; j < mapPlanned(r); j++) { const i = mapMissionById(r.first + j); if (i >= 0 && missionUnlocked(i) && clearsOf(r.first + j) === 0) { k = j; break; } }   // ด่านแรกที่ยังไม่เคยผ่าน
      this.cur = k; this.rebuild();
      return;
    }
    const r = MAP_REGIONS[this.reg], i = mapMissionById(r.first + this.cur);
    if (i < 0) { this.say('ด่านนี้ยังไม่เปิด (COMING SOON)'); return; }
    if (!missionUnlocked(i)) { this.say('ด่านนี้ยังล็อก: เคลียร์ภารกิจครบ ' + MISSIONS[i].unlockAt + ' ครั้งก่อน (ตอนนี้ ' + profile.missions + ')'); return; }
    selectMission(i);
    Scenes.go('hangar');
  },

  move: function (d) {
    const n = this.level === 'world' ? MAP_REGIONS.length : mapPlanned(MAP_REGIONS[this.reg]);
    this.cur = clamp(this.cur + d, 0, n - 1);
  },

  update: function (dt) {
    this.t += dt;
    this.msgT = Math.max(0, this.msgT - dt);
    this.hover = hoverIndex(this.items);
    const it = this.hover >= 0 ? this.items[this.hover] : null;
    if (it && it.region !== undefined) this.cur = it.region;
    else if (it && it.slot !== undefined) this.cur = it.slot;
  },

  keydown: function (e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowUp' || e.code === 'KeyW') this.move(-1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'ArrowDown' || e.code === 'KeyS') this.move(1);
    else if (e.code === 'Enter' || e.code === 'Space') this.activate();
    else if (e.code === 'Escape') this.back();
  },

  mousedown: function () {
    const i = hoverIndex(this.items);
    if (i >= 0 && this.items[i].action) this.items[i].action();
  },

  render: function () { drawMapScreen(this); }
};

// ---------------------------------------------------------------- วาด
function mapBackground(h) {
  const reg = MAP_REGIONS[h.reg];
  const img = partImage(h.level === 'world' ? 'assets/map/world.png' : 'assets/map/' + reg.id + '.png');
  if (img) { ctx.drawImage(img, 0, 0, W, H); return; }
  ctx.fillStyle = '#0e1317'; ctx.fillRect(0, 0, W, H);
  const col = h.level === 'world' ? '#59636d' : reg.color;
  const g = ctx.createRadialGradient(W / 2, H * 0.55, 40, W / 2, H * 0.55, 460);
  g.addColorStop(0, h.level === 'world' ? 'rgba(90,110,130,0.18)' : col + '33');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(120,140,155,0.07)'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
}

function mapHeader(title, sub) {
  ctx.fillStyle = 'rgba(15,19,22,0.92)'; ctx.fillRect(0, 0, W, 46);
  ctx.fillStyle = '#333c45'; ctx.fillRect(0, 46, W, 1);
  drawText(title, 24, 33, fnt(700, 22), '#e0a526');
  if (sub) drawText(sub, W - 146, 31, fnt(400, 12), '#8d978c', 'right');   // ชิดขวา เว้นช่องกลางไว้ให้ปุ่ม SOUND (M) ของหน้าเว็บ
}

function mapLock(x, y, col) {                       // รูปกุญแจเล็ก
  ctx.fillStyle = col; ctx.fillRect(x - 5, y - 1, 10, 8);
  ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y - 1, 4, Math.PI, 0); ctx.stroke();
}

function drawMapScreen(h) {
  mapBackground(h);
  if (h.level === 'world') drawMapWorld(h); else drawMapRegion(h);
  for (let i = 0; i < h.items.length; i++) if (h.items[i].label) drawButton(h.items[i], i === h.hover);
  if (h.msgT > 0) {
    ctx.globalAlpha = clamp(h.msgT / 0.5, 0, 1);
    drawText(h.msg, W / 2, 428, fnt(700, 13), '#e0583a', 'center');
    ctx.globalAlpha = 1;
  }
}

function drawMapWorld(h) {
  let done = 0, total = 0;
  for (const r of MAP_REGIONS) { const inf = mapRegionInfo(r); done += inf.cleared; total += inf.exist; }
  mapHeader('WORLD MAP', 'เคลียร์แล้ว ' + done + ' / ' + total + ' ด่าน');
  const t = h.t, infos = MAP_REGIONS.map(mapRegionInfo);
  const curMission = MISSIONS[selectedMission], curReg = curMission ? mapRegionOf(curMission.id) : -1;

  // เส้นทางระหว่างภูมิภาค
  ctx.lineCap = 'round';
  for (let i = 0; i < MAP_REGIONS.length - 1; i++) {
    const a = MAP_REGIONS[i], b = MAP_REGIONS[i + 1], live = infos[i + 1].state !== 'soon' && infos[i + 1].state !== 'locked';
    ctx.strokeStyle = live ? 'rgba(224,165,38,0.18)' : 'rgba(120,135,150,0.10)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = live ? 'rgba(224,165,38,0.85)' : 'rgba(120,135,150,0.4)'; ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]); ctx.lineDashOffset = live ? -t * 16 : 0;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);
  }

  // ภูมิภาค
  for (let i = 0; i < MAP_REGIONS.length; i++) {
    const r = MAP_REGIONS[i], inf = infos[i], sel = i === h.cur, off = inf.state === 'soon' || inf.state === 'locked';
    const col = off ? '#46515b' : r.color, rr = sel ? 25 : 22;
    ctx.save();
    if (i === curReg) {                                  // ภูมิภาคที่ด่านปัจจุบันอยู่
      ctx.strokeStyle = 'rgba(224,165,38,' + (0.35 + 0.35 * Math.sin(t * 4)) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, 34 + Math.sin(t * 4) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = '#161c21'; ctx.beginPath(); ctx.arc(r.x, r.y, rr, 0, Math.PI * 2); ctx.fill();
    if (inf.state === 'soon') ctx.setLineDash([4, 4]);
    ctx.strokeStyle = sel ? '#e0a526' : col; ctx.lineWidth = sel ? 3 : 2;
    ctx.beginPath(); ctx.arc(r.x, r.y, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    if (inf.exist) {                                     // วงความคืบหน้า
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, rr + 5, 0, Math.PI * 2); ctx.stroke();
      if (inf.cleared) {
        ctx.strokeStyle = inf.state === 'done' ? '#5fd36f' : col; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(r.x, r.y, rr + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * inf.cleared / inf.planned); ctx.stroke();
      }
    }
    if (inf.state === 'locked') mapLock(r.x, r.y + 2, '#6f7a82');
    else drawText(String(i + 1), r.x, r.y + 6, fnt(700, 17), inf.state === 'soon' ? '#56606a' : (sel ? '#e0a526' : '#d9dfd2'), 'center');
    ctx.restore();
    drawText(r.name, r.x, r.y + 44, fnt(700, 12), off ? '#6f7a82' : '#d9dfd2', 'center');
    drawText(inf.state === 'soon' ? 'COMING SOON' : r.en, r.x, r.y + 57, fnt(600, 9), off ? '#56606a' : r.color, 'center');
  }

  // แผงข้อมูลภูมิภาคที่เลือก
  const r = MAP_REGIONS[h.cur], inf = infos[h.cur];
  ctx.fillStyle = 'rgba(15,19,22,0.88)'; ctx.fillRect(24, 394, 752, 38);
  ctx.strokeStyle = '#333c45'; ctx.lineWidth = 1; ctx.strokeRect(24.5, 394.5, 751, 37);
  drawText((h.cur + 1) + '  ' + r.name + '  ' + r.en, 38, 418, fnt(700, 14), inf.state === 'soon' ? '#6f7a82' : r.color);
  const txt = inf.state === 'soon' ? 'COMING SOON  (ด่าน ' + r.first + '-' + r.last + ' ยังไม่เปิด)'
    : (inf.state === 'locked' ? 'LOCKED  เคลียร์ภูมิภาคก่อนหน้าให้ครบก่อน'
    : 'ด่าน ' + r.first + '-' + r.last + '   เคลียร์แล้ว ' + inf.cleared + ' / ' + inf.planned + (inf.exist < inf.planned ? '   (เปิดให้เล่นแล้ว ' + inf.exist + ')' : ''));
  drawText(txt, W - 38, 418, fnt(600, 12), inf.state === 'soon' || inf.state === 'locked' ? '#8d978c' : '#d9dfd2', 'right');
}

function drawMapRegion(h) {
  const r = MAP_REGIONS[h.reg], n = mapPlanned(r), inf = mapRegionInfo(r), t = h.t;
  mapHeader(r.name, r.en + '  |  ด่าน ' + r.first + '-' + r.last + '  |  เคลียร์แล้ว ' + inf.cleared + ' / ' + n);
  ctx.fillStyle = r.color; ctx.fillRect(0, 46, W, 2);
  const pos = []; for (let k = 0; k < n; k++) pos.push(h.slotPos(k, n));

  ctx.lineCap = 'round';
  for (let k = 0; k < n - 1; k++) {                                // เส้นทางระหว่างด่าน
    const mi = mapMissionById(r.first + k + 1), live = mi >= 0 && missionUnlocked(mi);
    ctx.strokeStyle = live ? r.color + '33' : 'rgba(120,135,150,0.10)'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(pos[k].x, pos[k].y); ctx.lineTo(pos[k + 1].x, pos[k + 1].y); ctx.stroke();
    ctx.strokeStyle = live ? r.color : 'rgba(120,135,150,0.4)'; ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]); ctx.lineDashOffset = live ? -t * 16 : 0;
    ctx.beginPath(); ctx.moveTo(pos[k].x, pos[k].y); ctx.lineTo(pos[k + 1].x, pos[k + 1].y); ctx.stroke();
    ctx.setLineDash([]);
  }

  for (let k = 0; k < n; k++) {                                    // โหนดด่าน
    const id = r.first + k, mi = mapMissionById(id), m = mi >= 0 ? MISSIONS[mi] : null, p = pos[k], sel = k === h.cur;
    const unlocked = m && missionUnlocked(mi), clears = m ? clearsOf(id) : 0;
    const col = !m ? '#3a444d' : (!unlocked ? '#46515b' : (clears ? '#5fd36f' : r.color));
    const rr = MAP_NODE_R + (sel ? 4 : 0) + (m && unlocked && !clears ? Math.sin(t * 5) * 1.5 : 0);
    ctx.save();
    ctx.fillStyle = clears ? '#1d3a24' : '#161c21'; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.fill();
    if (!m) ctx.setLineDash([4, 4]);
    ctx.strokeStyle = sel ? '#e0a526' : col; ctx.lineWidth = sel ? 3 : 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    if (!m) drawText('?', p.x, p.y + 6, fnt(700, 17), '#4a545d', 'center');
    else if (!unlocked) mapLock(p.x, p.y + 2, '#6f7a82');
    else drawText(String(id), p.x, p.y + 6, fnt(700, 16), sel ? '#e0a526' : '#d9dfd2', 'center');
    if (m && m.boss) {                                             // ป้ายบอสท้ายด่าน
      ctx.fillStyle = unlocked ? '#e0583a' : '#5a3a36';
      ctx.beginPath(); ctx.moveTo(p.x - rr + 3, p.y - rr + 2); ctx.lineTo(p.x - rr + 11, p.y - rr + 10); ctx.lineTo(p.x - rr + 3, p.y - rr + 18); ctx.lineTo(p.x - rr - 5, p.y - rr + 10); ctx.closePath(); ctx.fill();
    }
    if (clears) {                                                  // จำนวนครั้งที่เคลียร์ (x/ต้องการ ถ้ามีของปลดล็อก)
      const need = mapUnlocksOf(id).reduce(function (a, u) { return Math.max(a, u.need); }, 0);
      const s = need ? Math.min(clears, need) + '/' + need : 'x' + clears;
      ctx.font = fnt(700, 10);
      const w = ctx.measureText(s).width + 10;
      ctx.fillStyle = need && clears >= need ? '#2f7d3a' : '#0f1316'; ctx.fillRect(p.x + rr - 10, p.y - rr - 2, w, 14);
      ctx.strokeStyle = '#5fd36f'; ctx.lineWidth = 1; ctx.strokeRect(p.x + rr - 9.5, p.y - rr - 1.5, w - 1, 13);
      drawText(s, p.x + rr - 5, p.y - rr + 9, fnt(700, 10), '#d9ffe0', 'left');
    }
    ctx.restore();
    drawText(m ? m.title : 'COMING SOON', p.x, p.y + rr + 16, fnt(600, 10), m ? (unlocked ? '#d9dfd2' : '#6f7a82') : '#4a545d', 'center');
  }

  // ป๊อบอัพรายการศัตรูของด่านที่เลือก (ใต้แถวโหนด ชี้ขึ้นหาโหนด)
  {
    const pm = mapMissionById(r.first + h.cur);
    if (pm >= 0 && missionUnlocked(pm)) drawMapPopup(MISSIONS[pm], pos[h.cur], r.color);
  }

  // แผงข้อมูลด่านที่เลือก
  const id = r.first + h.cur, mi = mapMissionById(id), m = mi >= 0 ? MISSIONS[mi] : null;
  ctx.fillStyle = 'rgba(15,19,22,0.9)'; ctx.fillRect(24, 330, 752, 96);
  ctx.strokeStyle = '#333c45'; ctx.lineWidth = 1; ctx.strokeRect(24.5, 330.5, 751, 95);
  if (!m) {
    drawText('MISSION ' + ('0' + id).slice(-2), 40, 354, fnt(700, 14), '#6f7a82');
    drawText('COMING SOON  ด่านนี้ยังไม่เปิดให้เล่น', 40, 376, fnt(600, 13), '#8d978c');
  } else {
    const unlocked = missionUnlocked(mi), clears = clearsOf(id), ul = mapUnlocksOf(id);
    drawText('MISSION ' + ('0' + id).slice(-2), 40, 354, fnt(700, 14), unlocked ? '#e0a526' : '#8a6a5f');
    drawText(m.title, 138, 354, fnt(700, 14), unlocked ? '#d9dfd2' : '#8a6a5f');
    drawText(m.lengthM + ' m' + (m.boss ? '    BOSS: ' + m.boss.name : ''), 40, 374, fnt(600, 11), m.boss ? '#e08a7a' : '#8d978c');
    drawText('+' + m.bonusExp + ' EXP  +' + m.bonusGold + ' CR', W - 40, 354, fnt(600, 11), '#ffd23f', 'right');
    if (!unlocked) drawText('LOCKED: เคลียร์ภารกิจครบ ' + m.unlockAt + ' ครั้ง (ตอนนี้ ' + profile.missions + ')', 330, 354, fnt(600, 11), '#e0583a');
    else drawText(clears ? 'เคลียร์แล้ว ' + clears + ' ครั้ง' : 'ยังไม่เคยผ่าน', 330, 354, fnt(600, 11), clears ? '#5fd36f' : '#8d978c');
    if (ul.length) {                                               // ของที่ปลดล็อกด้วยการเคลียร์ด่านนี้ซ้ำ
      const need = ul.reduce(function (a, u) { return Math.max(a, u.need); }, 0);
      mapFitLeft('ปลดล็อก (เคลียร์ ' + need + ' ครั้ง): ' + ul.map(function (u) { return u.name; }).join(', '), 40, 410, 600, 10, clears >= need ? '#5fd36f' : '#c9a24a', 560);
    }
  }
}

function drawMapPopup(m, np, color) {
  const list = missionEnemyList(m), total = missionTotals(m).total;
  const cols = clamp(Math.ceil(list.length / 4), 1, 5), rows = Math.max(1, Math.ceil(list.length / cols));   // สูงไม่เกิน 4 แถว ให้พ้นแผงข้อมูลด้านล่าง
  const colW = 138, w = 24 + cols * colW, rowH = 15;
  const h = 34 + rows * rowH + (m.boss ? 22 : 0) + 6;
  const x = clamp(np.x - w / 2, 16, W - 16 - w), y = 194;
  const ax = clamp(np.x, x + 14, x + w - 14);
  ctx.fillStyle = 'rgba(15,19,22,0.95)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
  ctx.fillStyle = color;                                           // ลูกศรชี้ขึ้นหาโหนด
  ctx.beginPath(); ctx.moveTo(ax - 7, y); ctx.lineTo(ax, y - 7); ctx.lineTo(ax + 7, y); ctx.closePath(); ctx.fill();
  drawText('ศัตรูในด่าน', x + 12, y + 20, fnt(700, 12), '#d9dfd2');
  drawText('รวม ' + total, x + w - 12, y + 20, fnt(600, 11), '#8d978c', 'right');
  for (let i = 0; i < list.length; i++) {
    const c = Math.floor(i / rows), r = i % rows, cx = x + 12 + c * colW, cy = y + 40 + r * rowH;
    mapFitLeft(list[i].label, cx, cy, 400, 11, '#c4cbbf', colW - 38);
    drawText('x' + list[i].n, cx + colW - 18, cy, fnt(700, 11), '#e0a526', 'right');
  }
  if (m.boss) {
    const by = y + 34 + rows * rowH + 14;
    ctx.fillStyle = 'rgba(224,88,58,0.18)'; ctx.fillRect(x + 8, by - 13, w - 16, 18);
    drawText('BOSS', x + 14, by, fnt(700, 11), '#e0583a');
    mapFitLeft(m.boss.name.replace(/^BOSS\s+/, ''), x + 56, by, 700, 11, '#ffb3a0', w - 70);
  }
}
