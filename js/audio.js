'use strict';
/* ==========================================================================
   audio.js : ระบบเสียง — เสียงเอฟเฟกต์ชั่วคราวสังเคราะห์ด้วยโค้ด (WebAudio) ไม่ต้องมีไฟล์เสียง
   - วางไฟล์จริงทับได้ทีหลัง: assets/audio/<ชื่อเสียง>.ogg (หรือ .mp3 / .wav) ชื่อเสียงดูในตาราง SYNTH ด้านล่าง
       มีไฟล์ชื่อตรง = ใช้ไฟล์แทนเสียงสังเคราะห์ทันที (ฝังตอน build เหมือนภาพ) เสียงที่ไม่มีไฟล์ยังใช้เสียงสังเคราะห์
       เสียงเพลงวนลูป (ไม่มีเสียงสังเคราะห์ ต้องมีไฟล์ถึงจะดัง): bgm_menu  bgm_hangar  bgm_play  bgm_boss
   - ปุ่ม: M = ปิด/เปิดเสียง   - / =  = ลด/เพิ่มระดับเสียงรวม (จำค่าไว้ในเครื่อง)
   - ตัวเสียงผูกกับเกมโดยครอบฟังก์ชันเดิม (fireWeapon, explode, damageEnemy ...) และเฝ้าดูสถานะทุกเฟรม จึงไม่ต้องแก้โค้ดเกมส่วนอื่น
   ========================================================================== */

// ใช้เมื่อเปิดเกมแบบแยกไฟล์ (index.html + โฟลเดอร์ assets บนเว็บ/GitHub ไม่ผ่าน build.py): ใส่ชื่อไฟล์เสียงที่วางไว้ใน assets/audio/ ลงลิสต์นี้
// เช่น ['gun_mg.ogg', 'explosion_big.ogg', 'bgm_menu.ogg']  (ตอนรัน build.py ไม่ต้องใส่ ระบบฝังและหาไฟล์เองให้)
const AUDIO_FILES = [];

const AUDIO = { master: 0.7, sfx: 1.0, music: 0.6, muted: false };

const Sfx = (function () {
  let ac = null, out = null, sfxBus = null, musicBus = null, noiseBuf = null, voices = 0;
  const files = {}, loading = {}, last = {}, loops = {};
  let music = null;                                    // { name, src, gain }

  try {                                                // จำระดับเสียงที่ผู้เล่นตั้งไว้
    const v = JSON.parse(localStorage.getItem('wanzer.audio') || 'null');
    if (v) { if (typeof v.master === 'number') AUDIO.master = v.master; AUDIO.muted = !!v.muted; }
  } catch (e) { }
  function persist() { try { localStorage.setItem('wanzer.audio', JSON.stringify({ master: AUDIO.master, muted: AUDIO.muted })); } catch (e) { } }

  function applyVolume() { if (out) out.gain.value = AUDIO.muted ? 0 : AUDIO.master; }

  // ---- เริ่มระบบเสียง (เบราว์เซอร์อนุญาตหลังผู้ใช้กดปุ่ม/คลิกครั้งแรกเท่านั้น) ----
  function unlock() {
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        out = ac.createGain(); out.connect(ac.destination);
        sfxBus = ac.createGain(); sfxBus.gain.value = AUDIO.sfx; sfxBus.connect(out);
        musicBus = ac.createGain(); musicBus.gain.value = AUDIO.music; musicBus.connect(out);
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        applyVolume();
        preloadFiles();
      }
      if (ac.state === 'suspended') ac.resume();
    } catch (e) { ac = null; }
  }
  ['keydown', 'mousedown', 'pointerdown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, unlock, { passive: true }); });

  // ---- ไฟล์เสียงที่ฝังไว้ (assets/audio/*) ----
  function embeddedUrl(name) {
    if (typeof EMBEDDED_ASSETS !== 'undefined') {
      for (const ext of ['ogg', 'mp3', 'wav']) { const u = 'assets/audio/' + name + '.' + ext; if (EMBEDDED_ASSETS[u]) return EMBEDDED_ASSETS[u]; }
    }
    for (const f of AUDIO_FILES) if (f.replace(/\.(ogg|mp3|wav)$/, '') === name) return 'assets/audio/' + f;   // แยกไฟล์: โหลดตรงจากโฟลเดอร์
    return null;
  }
  function loadFile(name) {
    if (files[name] !== undefined || loading[name]) return;
    const url = embeddedUrl(name);
    if (!url) { files[name] = null; return; }
    loading[name] = true;
    fetch(url).then(function (r) { return r.arrayBuffer(); })
      .then(function (b) { return new Promise(function (ok, no) { ac.decodeAudioData(b, ok, no); }); })
      .then(function (buf) { files[name] = buf; delete loading[name]; if (music && music.want === name) setMusic(name, true); })
      .catch(function () { files[name] = null; delete loading[name]; });
  }
  function preloadFiles() {
    if (typeof EMBEDDED_ASSETS !== 'undefined') for (const k in EMBEDDED_ASSETS) { const m = /^assets\/audio\/(.+)\.(ogg|mp3|wav)$/.exec(k); if (m) loadFile(m[1]); }
    for (const f of AUDIO_FILES) loadFile(f.replace(/\.(ogg|mp3|wav)$/, ''));
  }

  // ---- ชิ้นส่วนสร้างเสียงสังเคราะห์ ----
  function env(g, t, dur, peak, atk) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + (atk || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function osc(type, f0, f1, t, dur, gain, dest) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, dur, gain); o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05); track(o);
  }
  function nz(ftype, f0, f1, t, dur, gain, dest, q) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = ftype; f.Q.value = q || 0.8;
    f.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, dur, gain); s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random()); s.stop(t + dur + 0.05); track(s);
  }
  function track(node) { voices++; node.onended = function () { voices--; }; }

  // ตารางเสียงสังเคราะห์: ชื่อ -> function(t, d, r)  t = เวลาเริ่ม d = ปลายทาง r = ตัวคูณระดับเสียงสูงต่ำ
  const SYNTH = {
    gun_mg:       function (t, d, r) { nz('bandpass', 1900 * r, 900 * r, t, 0.06, 0.5, d, 1.2); osc('square', 190 * r, 80 * r, t, 0.05, 0.22, d); },
    gun_shotgun:  function (t, d, r) { nz('lowpass', 2600, 280, t, 0.3, 0.95, d); osc('sawtooth', 130 * r, 40, t, 0.22, 0.5, d); },
    gun_rifle:    function (t, d, r) { nz('bandpass', 3200, 380, t, 0.38, 0.85, d, 0.9); osc('sawtooth', 320, 55, t, 0.2, 0.5, d); nz('highpass', 3000, 3000, t, 0.05, 0.4, d); },
    melee_swing:  function (t, d, r) { nz('bandpass', 450 * r, 2200 * r, t, 0.2, 0.55, d, 1.4); },
    punch:        function (t, d, r) { osc('sine', 150, 50, t, 0.13, 0.7, d); nz('lowpass', 900, 200, t, 0.09, 0.5, d); },
    missile:      function (t, d, r) { nz('bandpass', 600, 2600, t, 0.55, 0.5, d, 1); osc('sawtooth', 90, 220, t, 0.45, 0.22, d); },
    missile_swarm: function (t, d, r) { for (let i = 0; i < 5; i++) { nz('bandpass', 700, 2800, t + i * 0.055, 0.3, 0.3, d, 1); osc('sawtooth', 100, 240, t + i * 0.055, 0.25, 0.12, d); } },
    explosion_small: function (t, d, r) { nz('lowpass', 1900, 220, t, 0.38, 0.85, d); osc('sine', 95 * r, 30, t, 0.3, 0.6, d); },
    explosion_big: function (t, d, r) { nz('lowpass', 1300, 70, t, 1.0, 1.0, d); osc('sine', 70, 22, t, 0.85, 0.95, d); nz('highpass', 2500, 2500, t, 0.06, 0.45, d); },
    hit:          function (t, d, r) { osc('square', 520, 200, t, 0.05, 0.13, d); nz('bandpass', 2400, 1200, t, 0.04, 0.2, d); },
    crit:         function (t, d, r) { osc('square', 520, 200, t, 0.05, 0.13, d); osc('triangle', 1200, 1900, t, 0.12, 0.2, d); nz('highpass', 3500, 3500, t, 0.06, 0.25, d); },
    hurt:         function (t, d, r) { osc('sawtooth', 210, 60, t, 0.22, 0.45, d); nz('lowpass', 1500, 300, t, 0.16, 0.5, d); },
    shield_on:    function (t, d, r) { osc('sine', 300, 760, t, 0.2, 0.22, d); osc('triangle', 600, 1250, t, 0.2, 0.12, d); },
    shield_hit:   function (t, d, r) { osc('square', 950, 500, t, 0.09, 0.2, d); nz('bandpass', 4200, 4200, t, 0.1, 0.25, d, 8); },
    shield_break: function (t, d, r) { nz('lowpass', 2500, 200, t, 0.45, 0.6, d); osc('sawtooth', 650, 80, t, 0.4, 0.4, d); },
    dash:         function (t, d, r) { nz('bandpass', 500, 3200, t, 0.26, 0.6, d, 1); osc('sine', 200, 720, t, 0.2, 0.2, d); },
    jump:         function (t, d, r) { osc('triangle', 220, 460, t, 0.13, 0.2, d); },
    land:         function (t, d, r) { osc('sine', 115, 50, t, 0.13, 0.5, d); nz('lowpass', 700, 200, t, 0.07, 0.3, d); },
    step:         function (t, d, r) { nz('lowpass', 1100 * r, 300, t, 0.06, 0.45, d); osc('sine', 100 * r, 60, t, 0.06, 0.3, d); },
    pickup_hp:    function (t, d, r) { osc('sine', 660, 990, t, 0.12, 0.25, d); osc('sine', 990, 1320, t + 0.09, 0.14, 0.25, d); },
    pickup_refill: function (t, d, r) { osc('triangle', 400, 1700, t, 0.3, 0.28, d); },
    coin:         function (t, d, r) { osc('square', 1318, 1318, t, 0.06, 0.12, d); osc('square', 1760, 1760, t + 0.05, 0.1, 0.12, d); },
    levelup:      function (t, d, r) { [523, 659, 784, 1047].forEach(function (f, i) { osc('triangle', f, f, t + i * 0.09, 0.22, 0.28, d); }); },
    enemy_shot:   function (t, d, r) { osc('square', 420 * r, 200, t, 0.07, 0.12, d); nz('bandpass', 2200, 1000, t, 0.05, 0.12, d); },
    tank_shell:   function (t, d, r) { osc('sawtooth', 100, 38, t, 0.38, 0.6, d); nz('lowpass', 900, 150, t, 0.32, 0.7, d); },
    snipe_shot:   function (t, d, r) { nz('bandpass', 3800, 300, t, 0.3, 0.9, d, 0.8); osc('sawtooth', 520, 45, t, 0.25, 0.6, d); },
    bomb_drop:    function (t, d, r) { osc('sine', 950, 280, t, 0.55, 0.14, d); },
    bomber_pass:  function (t, d, r) { nz('bandpass', 180, 620, t, 1.1, 0.28, d, 1.2); osc('sawtooth', 70, 95, t, 1.0, 0.1, d); },
    warning:      function (t, d, r) { for (let i = 0; i < 4; i++) { osc('sawtooth', 560, 820, t + i * 0.75, 0.7, 0.2, d); } },
    wave_alert:   function (t, d, r) { osc('square', 880, 880, t, 0.1, 0.14, d); osc('square', 880, 880, t + 0.16, 0.1, 0.14, d); },
    boss_phase2:  function (t, d, r) { osc('sawtooth', 130, 55, t, 0.9, 0.5, d); nz('lowpass', 1200, 100, t, 0.9, 0.5, d); },
    ui_hover:     function (t, d, r) { osc('sine', 820, 820, t, 0.035, 0.07, d); },
    ui_click:     function (t, d, r) { osc('square', 600, 950, t, 0.06, 0.13, d); },
    error:        function (t, d, r) { osc('square', 160, 150, t, 0.11, 0.2, d); osc('square', 160, 150, t + 0.15, 0.11, 0.2, d); },
    launch:       function (t, d, r) { osc('sawtooth', 100, 520, t, 0.6, 0.3, d); nz('bandpass', 400, 2600, t, 0.6, 0.45, d, 1); },
    mission_clear: function (t, d, r) { [523, 659, 784, 1047, 1319].forEach(function (f, i) { osc('sawtooth', f, f, t + i * 0.13, 0.4, 0.14, d); osc('triangle', f / 2, f / 2, t + i * 0.13, 0.4, 0.14, d); }); },
    player_dead:  function (t, d, r) { osc('sawtooth', 320, 45, t, 1.0, 0.4, d); nz('lowpass', 1400, 80, t, 1.1, 0.7, d); }
  };
  const MIN_GAP = { gun_mg: 0.02, hit: 0.05, crit: 0.08, step: 0.12, explosion_small: 0.05, explosion_big: 0.1, enemy_shot: 0.04, ui_hover: 0.05, coin: 0.05, melee_swing: 0.05, punch: 0.05, shield_hit: 0.08, hurt: 0.08 };

  // ---- เล่นเสียง: Sfx.play('ชื่อ', { vol: 0..1, rate: ตัวคูณความสูงต่ำ }) ----
  function play(name, o) {
    if (!ac || AUDIO.muted || ac.state !== 'running') return;
    try {
      o = o || {};
      const now = ac.currentTime;
      if (now - (last[name] || -1) < (MIN_GAP[name] || 0.03)) return;
      if (voices > 48) return;                                  // กันเสียงซ้อนจนเครื่องอืด
      last[name] = now;
      const vol = (o.vol === undefined ? 1 : o.vol) * 0.8, rate = o.rate || 1;
      const buf = files[name];
      if (buf) {                                                // มีไฟล์จริง: ใช้ไฟล์
        const s = ac.createBufferSource(), g = ac.createGain();
        s.buffer = buf; s.playbackRate.value = rate; g.gain.value = vol;
        s.connect(g); g.connect(sfxBus); s.start(); track(s);
        return;
      }
      loadFile(name);
      const fn = SYNTH[name];
      if (!fn) return;
      const g = ac.createGain(); g.gain.value = vol; g.connect(sfxBus);
      fn(now + 0.005, g, rate);
      setTimeout(function () { try { g.disconnect(); } catch (e) { } }, 2500);
    } catch (e) { }
  }

  // ---- เสียงวนลูปขณะกดค้าง (เลเซอร์, ไอพ่น): Sfx.loop('laser', true/false) ----
  function loop(name, on) {
    if (!ac) return;
    const cur = loops[name];
    if (on && !cur && !AUDIO.muted && ac.state === 'running') {
      const g = ac.createGain(); g.gain.value = 0; g.connect(sfxBus);
      const nodes = [];
      if (name === 'laser') {
        const a = ac.createOscillator(), b = ac.createOscillator(), f = ac.createBiquadFilter();
        a.type = 'sawtooth'; b.type = 'sawtooth'; a.frequency.value = 170; b.frequency.value = 174; f.type = 'lowpass'; f.frequency.value = 1400;
        a.connect(f); b.connect(f); f.connect(g); nodes.push(a, b);
        const n = ac.createBufferSource(), nf = ac.createBiquadFilter(); n.buffer = noiseBuf; n.loop = true; nf.type = 'highpass'; nf.frequency.value = 5000;
        const ng = ac.createGain(); ng.gain.value = 0.25; n.connect(nf); nf.connect(ng); ng.connect(g); nodes.push(n);
        g.gain.linearRampToValueAtTime(0.16, ac.currentTime + 0.05);
      } else {
        const n = ac.createBufferSource(), nf = ac.createBiquadFilter(); n.buffer = noiseBuf; n.loop = true; nf.type = 'lowpass'; nf.frequency.value = 800;
        n.connect(nf); nf.connect(g); nodes.push(n);
        g.gain.linearRampToValueAtTime(0.13, ac.currentTime + 0.1);
      }
      nodes.forEach(function (x) { x.start(); });
      loops[name] = { g: g, nodes: nodes };
    } else if ((!on || AUDIO.muted) && cur) {
      const t = ac.currentTime;
      cur.g.gain.cancelScheduledValues(t); cur.g.gain.setValueAtTime(cur.g.gain.value, t); cur.g.gain.linearRampToValueAtTime(0, t + 0.08);
      cur.nodes.forEach(function (x) { try { x.stop(t + 0.1); } catch (e) { } });
      delete loops[name];
    }
  }

  // ---- เพลงพื้นหลัง (ต้องมีไฟล์ bgm_*.ogg) ----
  function setMusic(name, force) {
    if (!ac) return;
    if (!force && music && music.want === name) return;
    const buf = name ? files[name] : null;
    if (name) loadFile(name);
    if (music && music.src && (force || music.name !== name)) {
      const m = music, t = ac.currentTime;
      m.gain.gain.cancelScheduledValues(t); m.gain.gain.setValueAtTime(m.gain.gain.value, t); m.gain.gain.linearRampToValueAtTime(0, t + 0.8);
      try { m.src.stop(t + 0.9); } catch (e) { }
      music = { name: null, want: name, src: null, gain: null };
    }
    if (!music) music = { name: null, want: name, src: null, gain: null };
    music.want = name;
    if (buf && music.name !== name) {
      const s = ac.createBufferSource(), g = ac.createGain();
      s.buffer = buf; s.loop = true; g.gain.value = 0; s.connect(g); g.connect(musicBus);
      s.start(); g.gain.linearRampToValueAtTime(1, ac.currentTime + 1.0);
      music = { name: name, want: name, src: s, gain: g };
    }
  }

  function setMaster(v) { AUDIO.master = Math.max(0, Math.min(1, v)); AUDIO.muted = false; applyVolume(); persist(); toast('VOLUME ' + Math.round(AUDIO.master * 100) + '%'); }
  function toggleMute() { AUDIO.muted = !AUDIO.muted; applyVolume(); persist(); if (AUDIO.muted) { loop('laser', false); loop('jet', false); } toast(AUDIO.muted ? 'SOUND OFF  (M)' : 'SOUND ON'); }
  let toastText = '', toastT = 0;
  function toast(s) { toastText = s; toastT = 1.4; }
  function tickToast(dt) { if (toastT > 0) toastT -= dt; }
  function drawToast() {
    if (toastT <= 0) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, toastT * 2);
    ctx.fillStyle = 'rgba(15,19,22,0.9)'; ctx.fillRect(W / 2 - 80, 8, 160, 24);
    ctx.strokeStyle = '#e0a526'; ctx.lineWidth = 1; ctx.strokeRect(W / 2 - 79.5, 8.5, 159, 23);
    drawText(toastText, W / 2, 24, fnt(600, 11), '#e0a526', 'center');
    ctx.restore();
  }

  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyM' && !e.repeat) toggleMute();
    else if (e.code === 'Minus') setMaster(AUDIO.master - 0.1);
    else if (e.code === 'Equal') setMaster(AUDIO.master + 0.1);
  });

  return { names: Object.keys(SYNTH), unlock: unlock, play: play, loop: loop, setMusic: setMusic, tickToast: tickToast, drawToast: drawToast, ready: function () { return !!ac && ac.state === 'running'; }, toast: toast };
})();

// ==========================================================================
// ผูกเสียงกับเกม: ครอบฟังก์ชันเดิม (ฟังก์ชันประกาศแบบ function จึงแทนที่ได้ ไม่ต้องแก้ไฟล์เดิม)
// ==========================================================================
(function () {
  function screenVol(x) { const sx = x - cam; return sx < -40 || sx > W + 40 ? 0.35 : 1; }   // เสียงนอกจอเบากว่า

  const _fire = fireWeapon;
  fireWeapon = function (p, slot) {
    const r = _fire(p, slot);
    try {
      if (slot === 1) { const m = equippedMissile(); Sfx.play(m.type === 'SWARM' ? 'missile_swarm' : 'missile', { vol: m.type === 'SWARM' ? 0.9 : 1, rate: m.type === 'DUAL' ? 1.08 : 1 }); }
      else {
        const g = equippedGun(), id = g.id;
        if (g.type === 'MELEE') Sfx.play(g.thrust ? 'punch' : 'melee_swing', { rate: g.thrust ? 1 : 0.9 });
        else if (g.type === 'SHOTGUN') Sfx.play('gun_shotgun', { rate: id.indexOf('winchester') === 0 ? 0.8 : id.indexOf('benelli') === 0 ? 1.15 : 1 });
        else if (g.type === 'RIFLE') Sfx.play('gun_rifle');
        else if (g.type === 'MACHINE_GUN') Sfx.play('gun_mg', { rate: id.indexOf('ares') === 0 ? 1.3 : id.indexOf('borz') === 0 ? 0.75 : 1, vol: 0.8 });
      }
    } catch (e) { }
    return r;
  };

  const _explode = explode;
  explode = function (e) {
    _explode(e);
    try {
      const big = e.type === 'tank' || e.type === 'bomber' || e.type === 'launcher' || e.type === 'swarmer' || e.type === 'boss';
      Sfx.play(big ? 'explosion_big' : 'explosion_small', { vol: screenVol(e.x + e.w / 2) * (big ? 0.9 : 0.8), rate: 0.9 + Math.random() * 0.2 });
    } catch (er) { }
  };

  const _dmgEnemy = damageEnemy;
  damageEnemy = function (e, dmg, heavy, ignoreArmor) {
    const n = dmgNums.length, killed = _dmgEnemy(e, dmg, heavy, ignoreArmor);
    try {
      if (!killed) {
        const crit = dmgNums.length > n && /!$/.test(dmgNums[dmgNums.length - 1].text || '');
        Sfx.play(crit ? 'crit' : 'hit', { rate: 0.9 + Math.random() * 0.25, vol: screenVol(e.x) * 0.9 });
      }
    } catch (er) { }
    return killed;
  };

  const _dmgPlayer = damagePlayer;
  damagePlayer = function (dmg, shieldCost) {
    const was = player.dead, up = player.shieldUp;
    _dmgPlayer(dmg, shieldCost);
    try { if (!was) Sfx.play(up ? 'shield_hit' : 'hurt'); } catch (e) { }
  };

  const _collect = collectItem;
  collectItem = function (it) {
    _collect(it);
    try { Sfx.play(it.type === 'hp' ? 'pickup_hp' : it.type === 'refill' ? 'pickup_refill' : 'coin'); } catch (e) { }
  };

  const _lvl = levelUpFx;
  levelUpFx = function () { _lvl(); try { Sfx.play('levelup'); } catch (e) { } };

  const _bossDown = bossDefeated;
  bossDefeated = function (e) {
    _bossDown(e);
    try { Sfx.play('explosion_big', { vol: 1 }); setTimeout(function () { Sfx.play('explosion_big', { vol: 1, rate: 0.8 }); }, 350); } catch (er) { }
  };

  // ----- เมนู: คลิก / ซื้อ / เปลี่ยนฉาก -----
  const _go = Scenes.go;
  Scenes.go = function (name, data) {
    _go.call(Scenes, name, data);
    try {
      if (name === 'play') Sfx.play('launch');
      else if (name === 'complete') Sfx.play('mission_clear');
      else Sfx.play('ui_click', { vol: 0.7 });
    } catch (e) { }
  };
  const _md = Scenes.mousedown;
  Scenes.mousedown = function () { if (Scenes.current !== PlayScene) Sfx.play('ui_click'); _md.call(Scenes); };
  for (const fn of ['pickPart', 'pickWeapon']) {
    const orig = HangarScene[fn];
    HangarScene[fn] = function () {
      orig.apply(HangarScene, arguments);
      try { Sfx.play(HangarScene.msgOk ? 'coin' : 'error'); } catch (e) { }
    };
  }
  const _launch = HangarScene.launch;
  HangarScene.launch = function () { const before = Scenes.current; _launch.call(HangarScene); if (Scenes.current === before) Sfx.play('error'); };

  // ----- เฝ้าดูสถานะทุกเฟรม (เดิน กระโดด ลงพื้น แดช โล่ ไอพ่น เลเซอร์ ศัตรูยิง ฯลฯ) -----
  const st = { onGround: true, dashT: 0, shieldUp: false, broken: false, dead: false, stepIdx: 0, bossWarn: 0, banner: 0, hover: -1, scene: null, land: 0 };
  const seenShots = new Map(), seenMissiles = new Map(), seenEnemies = new WeakSet(), p2 = new WeakSet();
  const SHOT_SOUND = { bmissile: 'missile', hmg: 'enemy_shot', snipe: 'snipe_shot', bomb: 'bomb_drop' };

  window.sfxUpdate = function (dt) {
    Sfx.tickToast(dt);
    if (!Sfx.ready()) return;
    const sc = Scenes.current, p = player;
    if (sc !== st.scene) { st.scene = sc; seenShots.clear(); seenMissiles.clear(); st.hover = -1; st.bossWarn = 0; }

    // เพลงตามฉาก (ต้องมีไฟล์ bgm_*)
    const boss = sc === PlayScene && mission.bossState !== 'none' && mission.bossState !== 'dying';
    Sfx.setMusic(sc === PlayScene ? (boss ? 'bgm_boss' : 'bgm_play') : sc === HangarScene ? 'bgm_hangar' : sc === CompleteScene ? null : 'bgm_menu');

    if (sc !== PlayScene) {
      Sfx.loop('laser', false); Sfx.loop('jet', false);
      const h = sc.hover === undefined ? -1 : sc.hover;                 // เมาส์/เคอร์เซอร์ชี้ปุ่มใหม่
      if (h !== st.hover) { if (h >= 0) Sfx.play('ui_hover'); st.hover = h; }
      return;
    }

    // ตัวผู้เล่น
    if (st.onGround && !p.onGround && p.vy < -200) Sfx.play('jump');
    if (!st.onGround && p.onGround && p.land > 1.2) Sfx.play('land', { vol: Math.min(1, 0.4 + p.land / 4) });
    st.onGround = p.onGround;
    if (p.dashT > 0 && st.dashT <= 0) Sfx.play('dash');
    st.dashT = p.dashT;
    if (p.shieldUp && !st.shieldUp) Sfx.play('shield_on');
    st.shieldUp = p.shieldUp;
    if (p.shieldBroken && !st.broken && p.shield <= 0) Sfx.play('shield_break');
    st.broken = p.shieldBroken;
    if (p.dead && !st.dead) Sfx.play('player_dead');
    st.dead = p.dead;
    const idx = Math.floor(p.walkPhase / Math.PI);
    if (idx !== st.stepIdx) { if (p.walkAmt > 0.4 && p.onGround && !p.dead) Sfx.play('step', { vol: 0.7 + 0.3 * (1 - p.crouch), rate: 1 - 0.2 * p.crouch + Math.random() * 0.15 }); st.stepIdx = idx; }
    Sfx.loop('jet', !!p.thrusting && !p.dead);
    Sfx.loop('laser', !!p.beamOn);

    // ป้ายเตือน
    if (mission.bossWarn > 0 && st.bossWarn <= 0) Sfx.play('warning');
    st.bossWarn = mission.bossWarn;
    if (mission.banner > 0 && st.banner <= 0 && mission.bossState === 'none') Sfx.play('wave_alert');
    st.banner = mission.banner;

    // ศัตรู: โผล่ใหม่ / บอสเข้าเฟส 2
    for (const e of enemies) {
      if (!seenEnemies.has(e)) { seenEnemies.add(e); if (e.type === 'bomber') Sfx.play('bomber_pass', { vol: 0.8 }); }
      if (e.type === 'boss' && e.phase2Hp && e.hp <= e.phase2Hp && !p2.has(e) && e.mode !== 'intro') { p2.add(e); Sfx.play('boss_phase2'); }
    }

    // กระสุน/ระเบิดศัตรู: เกิดใหม่ = เสียงยิง  หายไปทั้งที่ยังมีอายุ (ระเบิดตกพื้น) = เสียงระเบิด
    const cur = new Set(enemyShots);
    for (const s of enemyShots) {
      if (seenShots.has(s)) continue;
      seenShots.set(s, s.kind || 'plain');
      const k = s.kind, nm = k && SHOT_SOUND[k];
      if (k === 'bmissile' && s.big === false) { /* ฝูงเล็ก ไม่ซ้ำเสียงทุกลูก */ }
      Sfx.play(nm || (s.big ? 'tank_shell' : 'enemy_shot'), { vol: screenVol(s.x) * 0.8, rate: 0.9 + Math.random() * 0.2 });
    }
    seenShots.forEach(function (kind, s) {
      if (cur.has(s)) return;
      seenShots.delete(s);
      if (kind === 'bomb' && s.life > 0) Sfx.play('explosion_small', { vol: screenVol(s.x), rate: 0.75 });
    });

    // มิสไซล์ผู้เล่นที่ระเบิดกลางทาง
    const curM = new Set(missiles);
    for (const m of missiles) if (!seenMissiles.has(m)) seenMissiles.set(m, 1);
    seenMissiles.forEach(function (v, m) {
      if (curM.has(m)) return;
      seenMissiles.delete(m);
      if (m.life > 0 && m.x > -50 && m.y > -400) Sfx.play('explosion_small', { vol: screenVol(m.x) * 0.7, rate: m.small ? 1.3 : 1 });
    });
  };
})();
