'use strict';
/* ==========================================================================
   hangar.js : ฉาก Hangar (อู่ซ่อม / ร้านค้า / เลือกด่าน)
   อยู่ระหว่างเมนู/หน้าสรุปผล กับหน้าเล่นเกม:  menu -> hangar -> play -> complete -> hangar
   กฎการซื้ออยู่ใน upgrades.js  ข้อมูลด่านอยู่ใน missions.js  หน้าตาอยู่ใน ui.js (drawHangarScreen)
   ========================================================================== */

const HANGAR_TABS = PART_CATEGORIES.concat(['GUN', 'MISSILE']);
const ROW_KEYS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
const GUN_TYPES = ['MACHINE_GUN', 'SHOTGUN', 'RIFLE', 'LASER', 'MELEE'];      // แท็บปืนแบ่งตามประเภท (ปืนมีหลายรุ่น แถวเดียวไม่พอ)
const SUB_KEYS = ['Z', 'X', 'C', 'V', 'B'];
const ROW_CODES = ROW_KEYS.map(function (k) { return 'Key' + k; });

const HangarScene = {
  items: [],       // การ์ดอัปเกรด (มี kind) + ปุ่ม (มี action) รวมเป็นลิสต์เดียว ใช้หาตัวที่เมาส์ชี้
  hover: -1,
  t: 0,
  msg: '', msgOk: true, msgT: 0,
  flash: 0,
  sub: 'MACHINE_GUN',  // ประเภทปืนที่เปิดอยู่ในแท็บปืน
  hideWeapons: false,  // ดูตัวอย่างหุ่นแบบถอดอาวุธทั้งหมด (เฉพาะภาพพรีวิว ไม่ถอดอาวุธจริง)
  tab: 'HEAD',         // แท็บที่เปิดอยู่: HEAD | BODY | ARMS | LEGS | BACKPACK | GUN | MISSILE

  enter: function () {
    this.hideWeapons = false;
    this.t = 0; this.msg = ''; this.msgT = 0; this.flash = 0;
    ensureValidSelection();                           // เข้าอู่ครั้งแรก = เลือกด่านล่าสุดที่เล่นได้ให้อัตโนมัติ
    this.rebuild();
  },

  // สร้างรายการที่คลิกได้ใหม่ตามแท็บ: แท็บ 7 อัน (5 หมวดพาร์ท + ปืน + มิสไซล์) + การ์ดพาร์ท/แถวอาวุธ + ปุ่มด้านล่าง
  rebuild: function () {
    const tabs = HANGAR_TABS;
    const items = [];
    for (let i = 0; i < tabs.length; i++) items.push({ tab: tabs[i], key: String(i + 1), x: 356 + i * 55, y: 54, w: 52, h: 28 });
    if (this.tab === 'GUN') {
      for (let i = 0; i < GUN_TYPES.length; i++) items.push({ sub: GUN_TYPES[i], key: SUB_KEYS[i], x: 356 + i * 84, y: 88, w: 80, h: 20 });
      const list = weaponList('gun').filter(function (w) { return w.type === HangarScene.sub; });
      const pitch = Math.min(24, Math.floor(216 / list.length));      // แถวเยอะ (ลูกซอง 12) บีบให้พอดีกับพื้นที่
      for (let i = 0; i < list.length; i++) items.push({ wp: list[i], key: ROW_KEYS[i], x: 356, y: 114 + i * pitch, w: 420, h: pitch - 2 });
    } else if (this.tab === 'MISSILE') {
      const list = weaponList('missile');
      for (let i = 0; i < list.length; i++) items.push({ wp: list[i], key: ROW_KEYS[i], x: 356, y: 90 + i * 24, w: 420, h: 22 });
    } else {
      const list = partList(this.tab);
      for (let i = 0; i < list.length; i++) items.push({ part: list[i], cat: this.tab, key: ROW_KEYS[i], x: 356, y: 90 + i * 48, w: 420, h: 44 });
    }
    this.items = items.concat([
      {
        x: 500, y: 346, w: 276, h: 50, hint: 'Enter', primary: true,
        label: function () { return isOverweight() ? 'OVERWEIGHT' : (missionUnlocked(selectedMission) ? 'LAUNCH' : 'LOCKED'); },
        disabled: function () { return isOverweight() || !missionUnlocked(selectedMission); },
        action: function () { HangarScene.launch(); }
      },
      { x: 214, y: 346, w: 34, h: 50, label: '<', hint: 'A', disabled: function () { return selectedMission <= 0; }, action: function () { HangarScene.pickMission(-1); } },
      { x: 456, y: 346, w: 34, h: 50, label: '>', hint: 'D', disabled: function () { return selectedMission >= MISSIONS.length - 1; }, action: function () { HangarScene.pickMission(1); } },
      { x: 38, y: 92, w: 92, h: 24, small: true, label: function () { return HangarScene.hideWeapons ? 'ใส่อาวุธ' : 'ถอดอาวุธ'; }, action: function () { HangarScene.hideWeapons = !HangarScene.hideWeapons; } },
      { x: 24, y: 352, w: 180, h: 38, label: 'MAIN MENU', hint: 'Esc', action: function () { Scenes.go('menu'); } }
    ]);
  },

  setTab: function (t) {
    if (t === this.tab) return;
    this.tab = t;
    if (t === 'GUN') this.sub = equippedGun().type;   // เปิดแท็บปืนที่ประเภทของปืนที่สวมอยู่
    this.rebuild();
  },

  // กดการ์ดพาร์ท: ซื้อ (ถ้ายังไม่มี) แล้วสวมใส่ / สลับมาสวมถ้ามีอยู่แล้ว
  pickPart: function (cat, id) {
    const res = buyOrEquipPart(cat, id);
    this.msg = res.msg;
    this.msgOk = res.ok;
    this.msgT = 2.5;
    if (res.ok) this.flash = 0.5;
  },

  // กดแถวอาวุธ: ซื้อ (ถ้ายังไม่มี) แล้วสวมเข้าช่องของอาวุธนั้น (ช่องละ 1 กระบอก)
  pickWeapon: function (id) {
    const res = buyOrEquipWeapon(id);
    this.msg = res.msg + (res.ok && isOverweight() ? '  ⚠ OVERWEIGHT' : '');
    this.msgOk = res.ok;
    this.msgT = 2.5;
    if (res.ok) this.flash = 0.5;
  },

  // เปลี่ยนด่านที่เลือก (เลือกดูด่านที่ยังล็อกได้ แต่ LAUNCH จะกดไม่ได้)
  pickMission: function (d) {
    selectMission(selectedMission + d);
  },

  launch: function () {
    if (isOverweight()) {                              // น้ำหนักรวมเกิน maxLoad รวม (ลำตัว+ขา+แพ็กหลัง): ออกรบไม่ได้
      this.msg = 'OVERWEIGHT  น้ำหนัก ' + calculateTotalWeight() + ' เกิน ' + partsMaxLoad() + ' เปลี่ยนลำตัว/ขา/แพ็กหลังหรือถอดพาร์ทหนักก่อน';
      this.msgOk = false;
      this.msgT = 3;
      return;
    }
    if (!missionUnlocked(selectedMission)) {
      const m = MISSIONS[selectedMission];
      this.msg = 'ด่านนี้ยังล็อก (' + m.title + ') เล่นภารกิจก่อนหน้าให้จบก่อน';
      this.msgOk = false;
      this.msgT = 2.5;
      return;
    }
    Scenes.go('play');
  },

  update: function (dt) {
    this.t += dt;
    this.msgT = Math.max(0, this.msgT - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.hover = hoverIndex(this.items);
  },

  render: function () { drawHangarScreen(this); },

  keydown: function (e) {
    const dm = /^(?:Digit|Numpad)([1-8])$/.exec(e.code);
    const rm = ROW_CODES.indexOf(e.code);
    const sm = this.tab === 'GUN' ? SUB_KEYS.indexOf(e.code.slice(3)) : -1;
    if (dm) this.setTab(HANGAR_TABS[+dm[1] - 1]);                  // 1-8 = เปลี่ยนแท็บ
    else if (sm >= 0 && e.code.indexOf('Key') === 0) { this.sub = GUN_TYPES[sm]; this.rebuild(); }   // Z X C V B = ประเภทปืน/อาวุธประชิด
    else if (rm >= 0) {                                            // Q W E R T Y U I O P = แถวที่ 1-10 ของแท็บนี้
      const it = this.items.filter(function (x) { return x.part || x.wp; })[rm];
      if (it && it.wp) this.pickWeapon(it.wp.id);
      else if (it) this.pickPart(it.cat, it.part.id);
    }
    else if (e.code === 'KeyH') this.hideWeapons = !this.hideWeapons;           // H = ถอด/ใส่อาวุธ (พรีวิวหุ่นเปล่า)
    else if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.pickMission(-1);
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') this.pickMission(1);
    else if (e.code === 'Enter' || e.code === 'Space') this.launch();
    else if (e.code === 'Escape') Scenes.go('menu');
  },

  mousedown: function () {
    const it = this.items[hoverIndex(this.items)];
    if (!it) return;
    if (it.tab) { this.setTab(it.tab); return; }
    if (it.part) { this.pickPart(it.cat, it.part.id); return; }
    if (it.sub) { this.sub = it.sub; this.rebuild(); return; }
    if (it.wp) { this.pickWeapon(it.wp.id); return; }
    if (it.primary) { this.launch(); return; }        // ปุ่ม LAUNCH: ถ้าด่านล็อก launch() จะแสดงข้อความบอกสาเหตุ
    const off = typeof it.disabled === 'function' ? it.disabled() : it.disabled;
    if (off) return;                                  // ลูกศรที่สุดขอบรายการ กดไม่ได้
    it.action();
  }
};
