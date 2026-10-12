'use strict';
/* ==========================================================================
   scenes.js : ระบบเปลี่ยนฉาก (State Management)
   ทุกฉากมีหน้าตาเหมือนกัน: { enter(data), update(dt), render(), keydown(e), mousedown() }
   Scenes.go('ชื่อฉาก', ข้อมูลส่งต่อ) จะเปลี่ยนฉากและเรียก enter() ของฉากใหม่

   ฉากทั้งหมด:  menu (เมนูหลัก) -> hangar (อู่ซ่อม/ร้านค้า) -> play (เล่นเกม) -> complete (สรุปผล) -> hangar / menu
   ========================================================================== */

const Scenes = {
  current: null,
  registry: {},

  go: function (name, data) {
    this.current = this.registry[name];
    mouse.down = false; mouse.rightDown = false;   // กันกดเมาส์ค้างข้ามฉากแล้วยิงทันที
    this.current.enter(data);
  },
  update: function (dt) { this.current.update(dt); },
  render: function () { this.current.render(); drawCrosshair(); },
  keydown: function (e) { if (this.current.keydown) this.current.keydown(e); },
  mousedown: function () { if (this.current.mousedown) this.current.mousedown(); }
};

// ฟังก์ชันช่วย: หาปุ่มที่เมาส์ชี้อยู่ (-1 = ไม่มี)
function hoverIndex(buttons) {
  for (let i = 0; i < buttons.length; i++) if (pointInRect(mouse.x, mouse.y, buttons[i])) return i;
  return -1;
}

// ---------------------------------------------------------------- เมนูหลัก
const MenuScene = {
  buttons: [],
  hover: -1,
  confirmReset: 0,     // > 0 = กำลังรอให้กดยืนยันล้างเซฟ (นับถอยหลังเป็นวินาที)
  scroll: 0,

  enter: function () {
    this.confirmReset = 0;
    this.scroll = 0;
    this.buttons = [
      { x: 250, y: 308, w: 300, h: 36, label: 'START MISSION', hint: 'Enter', action: function () { Scenes.go('hangar'); } },
      { x: 250, y: 349, w: 300, h: 36, label: 'SAVE SLOTS', hint: 'S', action: function () { Scenes.go('saves'); } },
      {
        x: 250, y: 390, w: 300, h: 36, hint: 'N',
        label: function () { return MenuScene.confirmReset > 0 ? 'กดอีกครั้งเพื่อล้างเซฟ' : 'NEW GAME  (ล้าง SLOT ' + Save.slot + ')'; },
        action: function () { MenuScene.askReset(); }
      }
    ];
  },
  askReset: function () {
    if (this.confirmReset > 0) { Save.reset(profile); selectedMission = -1; this.confirmReset = 0; }
    else this.confirmReset = 3;
  },
  update: function (dt) {
    this.scroll += 30 * dt;
    cam = this.scroll % (WORLD_W - W);                // ฉากหลังเลื่อนช้าๆ เป็นบรรยากาศ
    if (this.confirmReset > 0) this.confirmReset = Math.max(0, this.confirmReset - dt);
    this.hover = hoverIndex(this.buttons);
  },
  render: function () {
    drawBackground();
    drawGround();
    drawMenuScreen(this.buttons, this.hover);
  },
  keydown: function (e) {
    if (e.code === 'Enter' || e.code === 'Space') Scenes.go('hangar');
    else if (e.code === 'KeyS') Scenes.go('saves');
    else if (e.code === 'KeyN') this.askReset();
  },
  mousedown: function () {
    const i = hoverIndex(this.buttons);
    if (i >= 0) this.buttons[i].action();
  }
};

// ---------------------------------------------------------------- เล่นเกม
const PlayScene = {
  enter: function () { resetMission(); },
  update: function (dt) { updateGame(dt); },
  render: function () {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 2 * shake, (Math.random() - 0.5) * 2 * shake);
    drawBackground();
    drawGround();
    drawItems();
    drawEnemies();
    drawBossWreck();
    drawAfterimages();
    drawBullets();
    drawMissiles();
    drawEnemyShots();
    drawBeam();
    drawSlashes();
    if (!player.dead) drawPlayer();
    drawShield();
    drawEffects();
    drawSparks();
    drawDmgNums();
    ctx.restore();

    ctx.save();
    ctx.translate(0, 48);
    drawHUD();
    drawBooster();
    drawObjective();
    ctx.restore();
    drawTopBar();
    drawBossHud();
    if (player.dead) drawDeadOverlay();
  },
  keydown: function (e) {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') player.dashBuffer = 0.15;   // Shift = Dash (ต้องกดทิศ A/D ค้างด้วย)
    else if (e.code === 'KeyR' && player.dead) resetMission();
    else if (e.code === 'Escape') Scenes.go('menu');
  }
};

// ---------------------------------------------------------------- สรุปผลภารกิจ
const CompleteScene = {
  summary: null,
  t: 0,
  buttons: [],
  hover: -1,

  enter: function (data) {
    this.summary = data;
    this.t = 0;
    this.buttons = [
      { x: 170, y: 392, w: 220, h: 40, label: 'TO HANGAR', hint: 'Enter', action: function () { Scenes.go('hangar'); } },
      { x: 410, y: 392, w: 220, h: 40, label: 'MAIN MENU', hint: 'Esc', action: function () { Scenes.go('menu'); } }
    ];
  },
  update: function (dt) {
    this.t += dt;
    this.hover = hoverIndex(this.buttons);
  },
  render: function () {
    drawBackground();
    drawGround();
    drawCompleteScreen(this.summary, this.t, this.buttons, this.hover);
  },
  keydown: function (e) {
    if (this.t < 0.8) return;                        // กันเผลอกดข้ามระหว่างตัวเลขกำลังขึ้น
    if (e.code === 'Enter' || e.code === 'Space') Scenes.go('hangar');
    else if (e.code === 'Escape') Scenes.go('menu');
  },
  mousedown: function () {
    if (this.t < 0.8) return;
    const i = hoverIndex(this.buttons);
    if (i >= 0) this.buttons[i].action();
  }
};

Scenes.registry = { menu: MenuScene, hangar: HangarScene, play: PlayScene, complete: CompleteScene, saves: SaveScene };
