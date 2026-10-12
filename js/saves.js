'use strict';
/* ==========================================================================
   saves.js : หน้าเลือกเซฟ (SAVE SLOTS) — ฉาก 'saves' เปิดจากเมนูหลัก
   3 ช่อง: LOAD / NEW GAME (ช่องว่าง) / EXPORT (ดาวน์โหลดไฟล์เซฟ) / IMPORT (โหลดไฟล์เซฟเข้าช่อง) / DELETE
   ปุ่มที่เสี่ยงทับหรือลบข้อมูล (IMPORT ลงช่องที่มีเซฟ, DELETE) ต้องกดซ้ำอีกครั้งภายใน 3 วินาที
   ตรรกะเซฟจริงอยู่ใน save.js
   ========================================================================== */

const SaveScene = {
  buttons: [],
  hover: -1,
  infos: [],
  msg: '', msgOk: true, msgT: 0,
  confirm: null,       // { id: 'del1' | 'imp2' ..., t: วินาทีที่เหลือ }
  t: 0,

  enter: function () {
    this.confirm = null; this.msg = ''; this.msgT = 0; this.t = 0;
    this.rebuild();
  },

  say: function (res) { this.msg = res.msg; this.msgOk = res.ok; this.msgT = 3.5; },

  needConfirm: function (id) {                       // true = ยังไม่ยืนยัน (เพิ่งตั้งให้รอกดซ้ำ)
    if (this.confirm && this.confirm.id === id) { this.confirm = null; return false; }
    this.confirm = { id: id, t: 3 };
    return true;
  },

  rebuild: function () {
    this.infos = [];
    for (let n = 1; n <= Save.SLOTS; n++) this.infos.push(Save.info(n));
    const items = [];
    for (let i = 0; i < Save.SLOTS; i++) {
      const n = i + 1, y = 62 + i * 100 + 52;
      const x0 = 330;
      items.push({
        x: x0, y: y, w: 84, h: 28, small: true,
        label: function () { return SaveScene.infos[i] ? (Save.slot === n ? 'PLAYING' : 'LOAD') : 'NEW GAME'; },
        action: function () { SaveScene.load(n); }
      });
      items.push({
        x: x0 + 90, y: y, w: 84, h: 28, small: true, label: 'EXPORT',
        disabled: function () { return !SaveScene.infos[i]; },
        action: function () { SaveScene.say(Save.exportSlot(n, profile)); }
      });
      items.push({
        x: x0 + 180, y: y, w: 84, h: 28, small: true,
        label: function () { return SaveScene.confirm && SaveScene.confirm.id === 'imp' + n ? 'ทับเซฟ?' : 'IMPORT'; },
        action: function () { SaveScene.importTo(n); }
      });
      items.push({
        x: x0 + 270, y: y, w: 84, h: 28, small: true,
        label: function () { return SaveScene.confirm && SaveScene.confirm.id === 'del' + n ? 'ยืนยันลบ' : 'DELETE'; },
        disabled: function () { return !SaveScene.infos[i]; },
        action: function () { SaveScene.del(n); }
      });
    }
    items.push({ x: 300, y: 372, w: 200, h: 36, label: 'BACK', hint: 'Esc', action: function () { Scenes.go('menu'); } });
    this.buttons = items;
  },

  // เลือกช่องเล่น (ช่องว่างจะเริ่มเกมใหม่) แล้วกลับเมนู
  load: function (n) {
    if (Save.slot !== n || !this.infos[n - 1]) {
      const had = Save.select(n, profile);
      selectedMission = -1;                          // เลือกด่านล่าสุดที่เปิดแล้วของเซฟนี้ใหม่
    }
    Scenes.go('menu');
  },

  del: function (n) {
    if (this.needConfirm('del' + n)) return;
    this.say(Save.remove(n, profile) ? { ok: true, msg: 'ลบ SLOT ' + n + ' แล้ว' } : { ok: false, msg: 'ลบไม่ได้' });
    if (n === Save.slot) selectedMission = -1;
    this.rebuild();
  },

  importTo: function (n) {
    if (this.infos[n - 1] && this.needConfirm('imp' + n)) return;   // ช่องที่มีเซฟอยู่: กดซ้ำเพื่อยืนยันก่อนเปิดตัวเลือกไฟล์
    this.confirm = null;
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = function () {
      const f = inp.files && inp.files[0];
      if (!f) return;
      if (f.size > 1000000) { SaveScene.say({ ok: false, msg: 'ไฟล์ใหญ่เกินไป ไม่ใช่ไฟล์เซฟของ Wanzer' }); return; }
      const rd = new FileReader();
      rd.onload = function () {
        const res = Save.importInto(n, String(rd.result), profile);
        if (res.ok && n === Save.slot) selectedMission = -1;
        SaveScene.say(res);
        SaveScene.rebuild();
      };
      rd.onerror = function () { SaveScene.say({ ok: false, msg: 'อ่านไฟล์ไม่ได้' }); };
      rd.readAsText(f);
    };
    inp.click();
  },

  update: function (dt) {
    this.t += dt;
    this.msgT = Math.max(0, this.msgT - dt);
    if (this.confirm) { this.confirm.t -= dt; if (this.confirm.t <= 0) this.confirm = null; }
    this.hover = hoverIndex(this.buttons);
  },

  render: function () {
    drawBackground();
    drawGround();
    ctx.fillStyle = 'rgba(15,19,22,0.78)';
    ctx.fillRect(0, 0, W, H);
    drawText('SAVE SLOTS', W / 2, 44, fnt(700, 28), '#e0a526', 'center');

    for (let i = 0; i < Save.SLOTS; i++) {
      const n = i + 1, y = 62 + i * 100, info = this.infos[i], on = Save.slot === n;
      ctx.fillStyle = 'rgba(22,26,30,0.95)';
      ctx.fillRect(100, y, 600, 90);
      ctx.strokeStyle = on ? '#e0a526' : '#333c45';
      ctx.lineWidth = on ? 2 : 1;
      ctx.strokeRect(100.5, y + 0.5, 599, 89);
      drawText('SLOT ' + n, 118, y + 26, fnt(700, 18), on ? '#e0a526' : '#d9dfd2');
      if (on) drawText('ACTIVE', 200, y + 25, fnt(700, 10), '#5fd36f');
      if (info) {
        drawText('LV ' + info.level, 118, y + 52, fnt(700, 20), '#e0a526');
        drawText('CREDITS ' + info.gold, 190, y + 51, fnt(600, 12), '#ffd23f');
        drawText('ภารกิจผ่าน ' + info.missions + '   ' + this.timeText(info.savedAt), 118, y + 76, fnt(400, 11), '#8d978c');
      } else {
        drawText('ว่าง — กด NEW GAME เพื่อเริ่มเกมใหม่', 118, y + 56, fnt(400, 13), '#6f7a70');
      }
    }
    for (let i = 0; i < this.buttons.length; i++) drawButton(this.buttons[i], i === this.hover);

    if (this.msgT > 0) drawText(this.msg, W / 2, 428, fnt(600, 13), this.msgOk ? '#5fd36f' : '#e0583a', 'center');
    else if (!Save.usable) drawText('เบราว์เซอร์นี้เก็บเซฟไม่ได้ ใช้ EXPORT เพื่อสำรองเป็นไฟล์', W / 2, 428, fnt(400, 12), '#e0583a', 'center');
    else drawText('เกมเซฟอัตโนมัติลงช่อง ACTIVE   ใช้ EXPORT / IMPORT ย้ายเซฟระหว่างเครื่อง', W / 2, 428, fnt(400, 12), '#8d978c', 'center');
  },

  timeText: function (ms) {
    if (!ms) return '';
    const d = new Date(ms), p = function (v) { return (v < 10 ? '0' : '') + v; };
    return 'เซฟล่าสุด ' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  },

  keydown: function (e) {
    if (e.code === 'Escape') Scenes.go('menu');
    else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') this.load(+e.code.slice(5));
  },

  mousedown: function () {
    const it = this.buttons[hoverIndex(this.buttons)];
    if (!it) return;
    const off = typeof it.disabled === 'function' ? it.disabled() : it.disabled;
    if (!off) it.action();
  }
};
