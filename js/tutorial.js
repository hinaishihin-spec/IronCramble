'use strict';
/* ==========================================================================
   tutorial.js : หน้าต่างวิธีเล่น (TUTORIAL) — กด T เปิด/ปิด ได้ทุกฉาก (เล่นในด่านอยู่ เกมจะหยุดชั่วคราวขณะอ่าน)
   ปิดด้วย T / Esc / คลิก X / คลิกนอกหน้าต่าง   สลับแท็บ: ← → หรือ 1-5 หรือคลิกแท็บ   เลื่อนอ่าน: ↑ ↓ / ล้อเมาส์ (ถ้าเนื้อหายาว)
   เปิดเองหนึ่งครั้งตอนเข้าเกมครั้งแรก (จำใน localStorage)

   เพิ่ม/แก้คำอธิบาย: แก้ตาราง TUTORIAL_TABS ด้านล่างที่เดียว   rows: { keys: ['A','D'], text: '...' }   keys ว่างได้ (= บรรทัดหมายเหตุ)
   ไม่แตะฉากอื่น: ครอบ Scenes.update / render / keydown / mousedown ไว้ เมื่อเปิดอยู่จะรับปุ่ม/เมาส์แทนฉากเดิม
   ========================================================================== */

const TUTORIAL_SEEN_KEY = 'wanzer_tutorial_seen';

const TUTORIAL_TABS = [
  {
    title: 'ในด่าน',
    rows: [
      { keys: ['A', 'D'], text: 'เดินซ้าย / ขวา' },
      { keys: ['W', 'Space'], text: 'กระโดด · กดค้างกลางอากาศเพื่อบิน (บูสต์มีเวลาจำกัด ชาร์จคืนเมื่อลงพื้น)' },
      { keys: ['S', '↓'], text: 'กดค้างเพื่อนั่ง/ย่อตัว เดินช้าลง กระสุนสูงลอยข้ามหัว' },
      { keys: ['Shift'], text: '+ A / D พุ่งตัว (Dash) หลบกระสุนได้' },
      { keys: ['Q'], text: 'กดค้างเพื่อกางโล่ ลดดาเมจ 80% แต่เดินช้าลงและยิงไม่ได้' },
      { keys: ['เมาส์'], text: 'เล็ง 360 องศา · คลิกซ้าย = ปืนมือขวา · คลิกขวา = ปืนมือซ้าย (ถ้าใส่ไว้) ไม่ได้ใส่อาวุธมือซ้าย คลิกขวา = ยิงมิสไซล์เหมือนเดิม' },
      { keys: ['F'], text: 'ยิงมิสไซล์ (ใส่อาวุธมือซ้ายแล้ว มิสไซล์ใช้ปุ่มนี้อย่างเดียว)' },
      { keys: [], text: 'ถือสองมือ: ปืนทั้งสองมือดาเมจลดลง 20% (ค่า x0.8) แต่ยิงพร้อมกันได้ ฟัน/ชกด้วยอาวุธประชิดคนละมือได้' },
      { keys: ['R'], text: 'ลองภารกิจใหม่เมื่อหุ่นพัง' },
      { keys: ['Esc'], text: 'กลับเมนูหลัก' },
      { keys: [], text: 'ทำลายศัตรูทั้งหมดและเดินไปจนสุดด่าน บอสท้ายด่านจะโผล่เมื่อไปถึงจุดบอส เก็บไอเท็มที่ศัตรูทิ้งไว้เพื่อฟื้นพลัง' }
    ]
  },
  {
    title: 'Hangar',
    rows: [
      { keys: ['1', '-', '9'], text: 'เปลี่ยนหมวด: หัว / ลำตัว / แขน / ขา / แพ็กหลัง / ไหล่ / ปืน / มิสไซล์ / โดรน' },
      { keys: ['Q', '-', 'P'], text: 'ซื้อและสวมรายการที่ 1–10 ของหมวดนั้น (หรือคลิกเมาส์ที่การ์ด)' },
      { keys: ['Z', 'X', 'C', 'V', 'B'], text: 'สลับกลุ่มซีรีส์ของพาร์ท / ประเภทปืน / ประเภทโดรน (ตามที่แท็บนั้นมี)' },
      { keys: ['G'], text: 'ในแท็บปืน: สลับแก้ไขอาวุธมือขวา / มือซ้าย (หรือปุ่ม แก้ไข: มือ…) · กดอาวุธที่ถืออยู่มือซ้ายอีกครั้ง = ถอดออก' },
      { keys: ['K'], text: 'แผงชิปทักษะ (ปุ่ม ชิป): ติดตั้งได้ 1 ชิ้น ไม่มีน้ำหนัก · แถวละหนึ่งชนิด กดปุ่ม I / II / III เพื่อซื้อและสวมระดับนั้น (กดซ้ำ = ถอด) · ชิปปลดล็อกจากการชนะบอสด่านตามที่ระบุ' },
      { keys: [], text: 'ชิปสุ่มเกิด (ฟ้า): ยิงทะลุเกราะ / ยิงคู่ / ตีคู่ / ต่อยคู่ / มิสไซล์คู่ / ปืน+มิสไซล์ไหล่ ตอนโจมตีมีโอกาส 10 / 15 / 20% (มีช่วงพัก) · ชิปเพิ่มค่า (เหลือง): ปืนแรง ทุบแรง HP ลดดาเมจ Boost' },
      { keys: ['G'], text: 'ในแท็บมิสไซล์: สลับแก้ไขพอดไหล่ขวา / ไหล่ซ้าย · ใส่สองไหล่แล้วปุ่มมิสไซล์เดิมยิงสลับสองพอดเอง (ไหล่ซ้ายใช้ได้เฉพาะ Single / Dual / Swarm และต้องเป็นคนละชิ้นกับไหล่ขวา)' },
      { keys: [], text: 'อาวุธบางชิ้นถือได้เฉพาะมือขวาหรือมือซ้าย (ขึ้นป้ายสีแดงที่แถว) เลเซอร์ถือได้เฉพาะมือขวา · อาวุธชิ้นเดียวถือสองมือไม่ได้ ต้องใช้คนละชิ้น' },
      { keys: ['H'], text: 'ถอด/ใส่อาวุธ เพื่อดูพรีวิวหุ่นเปล่า (หรือปุ่ม ถอดอาวุธ ในจอ)' },
      { keys: ['A', 'D'], text: 'เลือกด่าน (หรือปุ่ม < >) · Enter = LAUNCH เริ่มภารกิจ' },
      { keys: ['N'], text: 'เปิดแผนที่โลกเพื่อเลือกด่าน (หรือปุ่ม MAP)' },
      { keys: ['Esc'], text: 'กลับเมนูหลัก' },
      { keys: [], text: 'น้ำหนักรวมของพาร์ท+อาวุธห้ามเกินที่ลำตัว/ขารับได้ ไม่งั้นปุ่มขึ้น OVERWEIGHT และออกเล่นไม่ได้' },
      { keys: [], text: 'พาร์ทซีรีส์พิเศษ (MegaZ / PrirateK / SpaceR / MagiL / BeastE) ราคาเท่ากัน แต่ละชุดเสริมต่างกัน: โบนัสดาเมจเฉพาะประเภทอาวุธ (ปืนลูกซอง / ไรเฟิล / มิสไซล์ / ประชิด) และลดดาเมจที่ได้รับ (รวมกันไม่เกิน 20%)' },
      { keys: [], text: 'บางอาวุธ/พาร์ทล็อกอยู่ ต้องเคลียร์ด่านที่กำหนดซ้ำครบกี่ครั้งก่อนจึงซื้อได้ (ดูที่การ์ดและบนแผนที่)' }
    ]
  },
  {
    title: 'แผนที่ / ภารกิจ',
    rows: [
      { keys: ['N'], text: 'ใน Hangar: เปิดแผนที่โลก (11 ภูมิภาค เรียงตามเส้นทาง)' },
      { keys: ['←', '→'], text: 'เลือกภูมิภาค / เลือกด่าน (หรือ A D) · เมาส์ชี้แล้วคลิกได้เลย' },
      { keys: ['Enter'], text: 'ระดับโลก = เข้าภูมิภาค · ระดับภูมิภาค = เลือกด่านนั้นแล้วกลับ Hangar (ยังไม่เริ่มเล่น)' },
      { keys: ['Esc'], text: 'ย้อนกลับ (ภูมิภาค → โลก → Hangar)' },
      { keys: [], text: 'วงสีเขียวรอบภูมิภาคคือจำนวนด่านที่เคลียร์แล้ว · ป้ายแดงที่โหนดคือด่านที่มีบอส · ตัวเลขมุมโหนดคือจำนวนครั้งที่เคลียร์ (หรือ x/ต้องการ ถ้ามีของปลดล็อก)' },
      { keys: [], text: 'ป๊อบอัพใต้โหนดแสดงรายการศัตรูทั้งหมดของด่านที่เลือก (พร้อมจำนวนและบอส) ดูก่อนกดเข้า Hangar ได้' },
      { keys: [], text: 'ด่านล็อกอยู่จนกว่าจะเคลียร์ภารกิจครบตามที่กำหนด · ด่านที่ยังไม่เปิดให้เล่นจะขึ้น COMING SOON' },
      { keys: [], text: 'จบด่านได้ EXP และเครดิต (CR) ตามที่แสดงในแผงข้อมูลด่าน เล่นซ้ำเพื่อฟาร์มได้' }
    ]
  },
  {
    title: 'จอยเกมแพด',
    rows: [
      { keys: ['🎮 ในด่าน'], text: 'สติ๊กซ้าย เดิน · สติ๊กขวา เล็ง (มีตัวช่วยดูดเข้าเป้าเบา ๆ เฉพาะจอย) · A กระโดด/บิน · สติ๊กลง ย่อตัว · B หรือ RB พุ่ง (ดันสติ๊กซ้ายด้วย) · LB โล่ · RT ปืนมือขวา · LT ปืนมือซ้าย (ไม่ได้ใส่ = มิสไซล์) · X มิสไซล์ · Back = เมนู' },
      { keys: ['🎮 เมนู'], text: 'สติ๊กซ้าย/D-pad ขยับเคอร์เซอร์ · A คลิก · B ย้อนกลับ · Start ยืนยัน/LAUNCH · LB/RB เปลี่ยนหมวด · LT/RT เลือกด่าน · Y ถอดอาวุธพรีวิว · กดสติ๊กขวา (R3) สลับมือที่แก้ไขในแท็บปืน' },
      { keys: [], text: 'ต่อจอยแล้วต้องกดปุ่มบนจอยหนึ่งครั้งให้เบราว์เซอร์เห็นจอย · ถ้าเปิดเกมใน iframe/หน้าเว็บฝัง จอยอาจถูกบล็อก ให้เปิดไฟล์ html ของคุณเองในแท็บเต็ม' },
      { keys: ['🎮 Tutorial'], text: 'เปิดหน้าต่างนี้: ในด่านกด Start (เกมหยุดชั่วคราว) · ในเมนู/Hangar/แผนที่กด L3 (กดสติ๊กซ้าย) · ขณะเปิด: LB/RB สลับหัวข้อ · D-pad ขึ้นลง เลื่อนอ่าน · B / Back / Start ปิด' }
    ]
  },
  {
    title: 'ระบบ',
    rows: [
      { keys: ['T'], text: 'เปิด/ปิดหน้าต่างวิธีเล่นนี้ (ในด่านเกมหยุดชั่วคราวขณะเปิด) · จอยเกมแพด: Start ในด่าน / L3 ในเมนู' },
      { keys: ['M'], text: 'ปิด/เปิดเสียง' },
      { keys: ['-', '='], text: 'ลด / เพิ่มระดับเสียง' },
      { keys: ['Esc'], text: 'ย้อนกลับ / กลับเมนูหลัก' },
      { keys: [], text: 'เกมเซฟอัตโนมัติลง SLOT ที่เลือกไว้ เปลี่ยนช่องหรือสำรองไฟล์ได้ที่ SAVE SLOTS ในเมนูหลัก' },
      { keys: [], text: 'NEW GAME ในเมนูหลัก (กด N) จะล้างเซฟของ SLOT ปัจจุบัน ต้องกดยืนยันซ้ำอีกครั้ง' }
    ]
  }
];

const Tutorial = {
  open: false,
  tab: 0,
  scroll: 0,
  maxScroll: 0,
  closeBtn: { x: 722, y: 40, w: 26, h: 26 },
  panel: { x: 40, y: 30, w: 720, h: 390 },
  tabRects: [],

  toggle: function () { if (this.open) this.close(); else this.show(); },
  show: function () { this.open = true; this.scroll = 0; this.layoutTabs(); },
  close: function () {
    this.open = false;
    try { localStorage.setItem(TUTORIAL_SEEN_KEY, '1'); } catch (e) { }
  },
  setTab: function (i) {
    this.tab = ((i % TUTORIAL_TABS.length) + TUTORIAL_TABS.length) % TUTORIAL_TABS.length;
    this.scroll = 0;
  },

  layoutTabs: function () {
    const n = TUTORIAL_TABS.length, x0 = this.panel.x + 20, w = (this.panel.w - 40 - 40) / n;   // เว้นขวา 40 ให้ปุ่ม X
    this.tabRects = [];
    for (let i = 0; i < n; i++) this.tabRects.push({ x: x0 + i * w, y: this.panel.y + 48, w: w - 4, h: 28 });
  },

  // ตัดบรรทัดตามความกว้าง (ภาษาไทยไม่มีช่องว่าง จึงตัดทีละตัวอักษร ถอยไปที่ช่องว่างถ้ามี)
  wrap: function (s, maxW) {
    const out = []; let line = '';
    for (let i = 0; i < s.length; i++) {
      const t = line + s[i];
      if (ctx.measureText(t).width > maxW && line) {
        const sp = line.lastIndexOf(' ');
        if (sp > line.length * 0.5 && s[i] !== ' ') { out.push(line.slice(0, sp)); line = line.slice(sp + 1) + s[i]; }
        else { out.push(line); line = s[i] === ' ' ? '' : s[i]; }
      } else line = t;
    }
    if (line) out.push(line);
    return out;
  },

  drawKey: function (label, x, y) {                    // ปุ่มคีย์บอร์ดขนาดเล็ก คืนตำแหน่ง x ถัดไป
    ctx.font = fnt(600, 11);
    const w = Math.max(20, ctx.measureText(label).width + 14);
    ctx.fillStyle = '#20262c'; ctx.fillRect(x, y, w, 20);
    ctx.fillStyle = '#4a545d'; ctx.fillRect(x, y + 19, w, 2);
    ctx.strokeStyle = '#333c45'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 19);
    drawText(label, x + w / 2, y + 14, fnt(600, 11), '#d9dfd2', 'center');
    return x + w + 4;
  },

  // ---- ครอบระบบฉาก
  hook: function () {
    const self = this;
    const baseUpdate = Scenes.update, baseRender = Scenes.render, baseKey = Scenes.keydown, baseMouse = Scenes.mousedown;
    Scenes.update = function (dt) { if (self.open) return; baseUpdate.call(Scenes, dt); };
    Scenes.render = function () {
      baseRender.call(Scenes);
      if (self.open) { self.draw(); drawCrosshair(); }
      else if (Scenes.current !== PlayScene) drawText('T = วิธีเล่น', W - 10, H - 8, fnt(600, 10), '#6f7a70', 'right');
    };
    Scenes.keydown = function (e) {
      const tg = e && e.target && e.target.tagName;
      if (tg === 'INPUT' || tg === 'TEXTAREA') return baseKey.call(Scenes, e);          // กำลังพิมพ์ข้อความ (เช่นชื่อเซฟ) ไม่แย่ง T
      if (e.code === 'KeyT') { self.toggle(); return; }
      if (!self.open) return baseKey.call(Scenes, e);
      if (e.code === 'Escape') self.close();
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') self.setTab(self.tab - 1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') self.setTab(self.tab + 1);
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') self.scroll = Math.min(self.maxScroll, self.scroll + 40);
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') self.scroll = Math.max(0, self.scroll - 40);
      else { const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code); if (m && +m[1] <= TUTORIAL_TABS.length) self.setTab(+m[1] - 1); }
    };
    Scenes.mousedown = function () {
      if (!self.open) return baseMouse.call(Scenes);
      if (pointInRect(mouse.x, mouse.y, self.closeBtn) || !pointInRect(mouse.x, mouse.y, self.panel)) { self.close(); return; }
      for (let i = 0; i < self.tabRects.length; i++) if (pointInRect(mouse.x, mouse.y, self.tabRects[i])) { self.setTab(i); return; }
    };
    canvas.addEventListener('wheel', function (e) {
      if (!self.open) return;
      e.preventDefault();
      self.scroll = clamp(self.scroll + (e.deltaY > 0 ? 40 : -40), 0, self.maxScroll);
    }, { passive: false });
    this.layoutTabs();
    let seen = false;
    try { seen = !!localStorage.getItem(TUTORIAL_SEEN_KEY); } catch (e) { seen = true; }   // เข้าถึง storage ไม่ได้ = ไม่เด้งเอง
    if (!seen) this.show();
  },

  draw: function () {
    const p = this.panel, tab = TUTORIAL_TABS[this.tab];
    ctx.fillStyle = 'rgba(8,10,12,0.78)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#161a1e'; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#e0a526'; ctx.lineWidth = 2; ctx.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
    drawText('TUTORIAL', p.x + 20, p.y + 34, fnt(700, 20), '#e0a526');
    drawText('วิธีเล่น', p.x + 124, p.y + 33, fnt(400, 12), '#8d978c');

    const cb = this.closeBtn, hotX = pointInRect(mouse.x, mouse.y, cb);
    ctx.fillStyle = hotX ? '#e0a526' : '#20262c'; ctx.fillRect(cb.x, cb.y, cb.w, cb.h);
    ctx.strokeStyle = '#333c45'; ctx.lineWidth = 1; ctx.strokeRect(cb.x + 0.5, cb.y + 0.5, cb.w - 1, cb.h - 1);
    drawText('X', cb.x + cb.w / 2, cb.y + 18, fnt(700, 13), hotX ? '#161a1e' : '#d9dfd2', 'center');

    for (let i = 0; i < this.tabRects.length; i++) {
      const r = this.tabRects[i], on = i === this.tab, hot = pointInRect(mouse.x, mouse.y, r);
      ctx.fillStyle = on ? '#e0a526' : (hot ? '#2c343b' : '#20262c'); ctx.fillRect(r.x, r.y, r.w, r.h);
      drawText((i + 1) + ' ' + TUTORIAL_TABS[i].title, r.x + r.w / 2, r.y + 19, fnt(700, 12), on ? '#161a1e' : '#d9dfd2', 'center');
    }

    // เนื้อหา (ตัดขอบด้วย clip เพื่อเลื่อนอ่านได้)
    const cx = p.x + 20, cy = p.y + 88, cw = p.w - 40, ch = p.h - 88 - 34;
    ctx.save();
    ctx.beginPath(); ctx.rect(p.x + 4, cy, p.w - 8, ch); ctx.clip();
    let y = cy - this.scroll + 4;
    const textX = cx + 190, textW = cw - 190 - 6;
    for (const row of tab.rows) {
      ctx.font = fnt(400, 12);
      const hasKeys = row.keys && row.keys.length;
      const lines = this.wrap(row.text, hasKeys ? textW : cw - 6);
      const h = Math.max(hasKeys ? 26 : 0, lines.length * 17 + 8);
      if (hasKeys) {
        let kx = cx;
        for (const k of row.keys) {
          if (k === '-') { drawText('–', kx + 2, y + 15, fnt(600, 12), '#8d978c', 'left'); kx += 14; }
          else kx = this.drawKey(k, kx, y + 1);
        }
      }
      const tx = hasKeys ? textX : cx;
      for (let i = 0; i < lines.length; i++) drawText(lines[i], tx, y + 15 + i * 17, fnt(400, 12), hasKeys ? '#c4cbbf' : '#e0a526', 'left');
      y += h;
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(cx, y - 2, cw - 6, 1);
    }
    ctx.restore();
    this.maxScroll = Math.max(0, Math.ceil(y + this.scroll - cy - ch + 4));
    if (this.scroll > this.maxScroll) this.scroll = this.maxScroll;
    if (this.maxScroll > 0) {
      if (this.scroll < this.maxScroll) drawText('▼ เลื่อนลง (↓ / ล้อเมาส์)', p.x + p.w - 20, cy + ch - 4, fnt(600, 10), '#e0a526', 'right');
      if (this.scroll > 0) drawText('▲', p.x + p.w - 20, cy + 12, fnt(600, 10), '#e0a526', 'right');
    }
    ctx.fillStyle = '#333c45'; ctx.fillRect(p.x, p.y + p.h - 30, p.w, 1);
    drawText('← → / 1-5 สลับหัวข้อ    T หรือ Esc ปิด', p.x + p.w / 2, p.y + p.h - 11, fnt(600, 11), '#6f7a70', 'center');
  }
};

Tutorial.hook();
