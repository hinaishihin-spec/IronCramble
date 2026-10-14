'use strict';
/* ==========================================================================
   mission.js : ตัวควบคุมการเล่น 1 ด่าน — เริ่มด่าน, ปล่อยเวฟศัตรูตามระยะทาง,
                อัปเดตทั้งโลกเกม, เช็กเงื่อนไขจบด่าน, สรุปผล
   ข้อมูลของแต่ละด่าน (ความยาว เวฟ รางวัล) อยู่ใน missions.js
   ========================================================================== */

// สถิติของภารกิจรอบนี้ (ใช้แสดงบนหน้าสรุปผล) — รีเซ็ตทุกครั้งที่เริ่มด่าน
const run = { kills: 0, total: 0, time: 0, shots: 0, exp: 0, gold: 0, levelStart: 1 };

// สถานะของด่านที่กำลังเล่น  def = ข้อมูลด่านที่เริ่มเล่น (จำไว้ แม้ผู้เล่นจะไปเปลี่ยนด่านที่เลือกทีหลัง)
const mission = {
  def: null, nextWave: 0, cleared: false, clearTimer: CLEAR_DELAY, banner: 0, bannerText: '',
  // บอส (ดู boss.js)
  bossState: 'none', lockX: -1, bossWarn: 0, boss: null, bossGold: 0,
  deathT: 0, deathBoomT: 0, finalBlown: false, endT: 0, whiteFlash: 0
};

function resetRun() {
  run.kills = 0; run.total = 0; run.time = 0; run.shots = 0; run.exp = 0; run.gold = 0;
  run.levelStart = profile.level;
}

function resetMission() {
  const def = currentMission();
  mission.def = def;
  WORLD_W = def.lengthM * 10;                       // ความยาวฉากเปลี่ยนตามด่าน
  resetPlayer();
  resetCamera();
  resetEffects();
  resetItems();
  resetWeapons();
  resetEnemies();                                   // เริ่มด่านโดยยังไม่มีศัตรูเลย รอเวฟแรกตามระยะทาง
  resetRun();
  run.total = missionTotals(def).total;
  mission.nextWave = 0;
  mission.cleared = false;
  mission.clearTimer = CLEAR_DELAY;
  mission.banner = 0;
  mission.bossState = 'none';                       // ยังไม่ถึงระยะบอส กล้องไม่ล็อก
  mission.lockX = -1;
  mission.bossWarn = 0;
  mission.boss = null;
  mission.bossGold = 0;
  mission.finalBlown = false;
  mission.whiteFlash = 0;
}

// ---------- เวฟศัตรู (Distance Trigger) ----------
// ศัตรูของเวฟจะถูกสร้างตอนนี้เท่านั้น โดยโผล่ที่ขอบจอด้านขวา แล้วเดิน/บินเข้ามาหาผู้เล่น
function spawnWave(wave) {
  const baseX = cam + W + 40;
  for (const u of wave.units) {
    const kind = u[0], off = u[1] || 0, y = u[2];
    let e;
    if (kind === 'walker') e = makeWalker(baseX + off);
    else if (kind === 'drone') e = makeDrone(baseX + off, y || 150);
    else if (kind === 'chopper') e = makeChopper(baseX + off);
    else if (kind === 'bomber') e = makeBomber(baseX + off, y || BOMBER_Y);          // ตัวเลขที่ 3 = ความสูงบิน
    else if (kind === 'monolet') e = makeMonolet(baseX + off);
    else if (kind === 'swanzer') e = makeShotWanzer(baseX + off);
    else if (kind === 'mwanzer') e = makeMissileWanzer(baseX + off);
    else if (kind === 'tplane') e = makeTPlane(baseX + off, y || TPLANE_Y);          // ตัวเลขที่ 3 = ความสูงบิน
    else if (kind === 'launcher') e = makeLauncher(baseX + off, false);
    else if (kind === 'swarmer') e = makeLauncher(baseX + off, true);
    else if (kind === 'sniper') { e = makeSniper(baseX); e.slot = off; }   // off = เยื้องเข้าซ้ายจากขอบจอขวา
    else e = makeTank(baseX + off);
    e.x = clamp(e.x, 0, WORLD_W - e.w - 10);
    e.homeX = e.x;
    e.hunt = true;                                  // เวฟที่เพิ่งโผล่จะมุ่งเข้าหาผู้เล่นทันที (ไม่เดินวนอยู่กับที่)
    scaleEnemyHp(e, ENEMY_HP_MULT);
    enemies.push(e);
  }
}

function updateWaves() {
  const waves = mission.def.waves;
  const distM = player.x / 10;
  // while: ถ้าผู้เล่น Dash ข้ามหลายจุดในเฟรมเดียว เวฟที่ถึงเกณฑ์จะออกมาครบ ไม่ตกหล่น
  while (mission.nextWave < waves.length && distM >= waves[mission.nextWave].at) {
    spawnWave(waves[mission.nextWave]);
    mission.nextWave++;
    mission.banner = WAVE_BANNER_TIME;
    mission.bannerText = 'WARNING  WAVE ' + mission.nextWave + ' / ' + waves.length + '  INCOMING';
    addShake(2);
  }
}

// ระยะ (เมตร) ของเวฟถัดไป  คืนค่า -1 ถ้าออกครบทุกเวฟแล้ว (ใช้แสดงบน HUD)
function nextWaveDistance() {
  const waves = mission.def.waves;
  return mission.nextWave < waves.length ? waves[mission.nextWave].at : -1;
}

// ---------- บอสท้ายด่าน ----------
// เดินถึงระยะบอส: ล็อกกล้อง + ป้าย WARNING + บอสเลื่อนเข้าจากขอบจอขวา
function updateBossTrigger() {
  const b = mission.def.boss;
  if (!b || mission.bossState !== 'none' || player.dead) return;
  if (player.x / 10 < b.at) return;
  mission.bossState = 'intro';
  mission.lockX = clamp(player.x + player.w / 2 - W * 0.4, 0, WORLD_W - W);   // จุดที่กล้องหยุดอยู่ตลอดการต่อสู้
  mission.bossWarn = BOSS_WARN_TIME;
  enemies.push(scaleEnemyHp(makeBossFor(b, mission.lockX), BOSS_HP_MULT));          // ชนิดบอสตาม boss.kind ของด่าน (boss2.js)
  addShake(6);
}

// อัปเดตทุกอย่างในหน้าเล่นเกม 1 เฟรม
function updateGame(dt) {
  updatePlayer(dt);
  if (mission.lockX >= 0) player.x = clamp(player.x, mission.lockX, mission.lockX + W - player.w);   // Camera Lock: ห้ามถอยหลัง/เดินเลยจอ
  if (!player.dead) { updateWaves(); updateBossTrigger(); }
  updateWeapons(dt);
  updateItems(dt);
  updateEnemies(dt);
  updateEffects(dt);
  updateCamera(dt);
  mission.banner = Math.max(0, mission.banner - dt);
  mission.bossWarn = Math.max(0, mission.bossWarn - dt);
  mission.whiteFlash = Math.max(0, mission.whiteFlash - dt * 1.1);
  if (mission.bossState === 'dying') updateBossDeath(dt);

  if (!player.dead) {
    const allSpawned = mission.nextWave >= mission.def.waves.length;
    if (mission.def.boss) {
      run.time += mission.bossState === 'dying' ? 0 : dt;     // ด่านที่มีบอสจบตอนบอสพัง (ดู updateBossDeath)
    } else if (allSpawned && enemies.length === 0) {
      mission.cleared = true;
      mission.clearTimer -= dt;                     // เคลียร์หมดแล้ว รอโชว์ AREA CLEAR สักครู่
      if (mission.clearTimer <= 0) completeMission();
    } else {
      run.time += dt;
    }
  }
}

function completeMission() {
  const def = mission.def;
  const unlockedBefore = highestUnlocked();

  // โบนัสจบภารกิจ (ไม่เล่นเอฟเฟกต์เลเวลอัปซ้ำบนหน้าสรุป)
  gainExp(def.bonusExp, true);
  profile.gold += def.bonusGold;
  run.gold += def.bonusGold;
  profile.missions++;
  profile.clears[def.id] = (profile.clears[def.id] || 0) + 1;      // นับจำนวนครั้งที่เคลียร์ด่านนี้ (ด่านมีบอส = ชนะบอสครั้งหนึ่ง) ใช้ปลดล็อกพาร์ท
  saveProfile();

  // ถ้าเคลียร์ครั้งนี้ปลดล็อกด่านใหม่ ให้เลือกด่านนั้นรอไว้ใน Hangar และแจ้งบนหน้าสรุปผล
  let unlockedName = null;
  if (highestUnlocked() > unlockedBefore) {
    selectMission(highestUnlocked());
    unlockedName = MISSIONS[highestUnlocked()].name;
  }

  Scenes.go('complete', {
    name: def.name,
    kills: run.kills, total: run.total, time: run.time, shots: run.shots,
    exp: run.exp, gold: run.gold,
    bonusExp: def.bonusExp, bonusGold: def.bonusGold, bossGold: mission.bossGold,
    bossName: def.boss ? def.boss.name : null,
    levelFrom: run.levelStart, levelTo: profile.level,
    unlockedName: unlockedName
  });
}
