โฟลเดอร์ไฟล์เสียงจริง (วางไฟล์ .ogg / .mp3 / .wav ที่นี่ แล้วรัน python3 build.py)
ชื่อไฟล์ต้องตรงกับชื่อเสียงด้านล่าง เช่น assets/audio/gun_mg.ogg  มีไฟล์ = ใช้ไฟล์แทนเสียงสังเคราะห์ชั่วคราว

เสียงเอฟเฟกต์ที่เกมเรียกใช้:
  gun_mg
  gun_shotgun
  gun_rifle
  melee_swing
  punch
  missile
  missile_swarm
  explosion_small
  explosion_big
  hit
  crit
  hurt
  shield_on
  shield_hit
  shield_break
  dash
  jump
  land
  step
  pickup_hp
  pickup_refill
  coin
  levelup
  enemy_shot
  tank_shell
  snipe_shot
  bomb_drop
  bomber_pass
  warning
  wave_alert
  boss_phase2
  ui_hover
  ui_click
  error
  launch
  mission_clear
  player_dead

เสียงวนลูป (ยังไม่มีไฟล์ = ใช้เสียงสังเคราะห์): laser (เลเซอร์ขณะยิง) / jet (ไอพ่นขณะบิน) — ตอนนี้วนลูปด้วยโค้ดเท่านั้น
เพลงพื้นหลังวนลูป (ต้องมีไฟล์ถึงจะดัง): bgm_menu  bgm_hangar  bgm_play  bgm_boss
ปุ่ม: M ปิด/เปิดเสียง   - / =  ลด/เพิ่มระดับเสียง

เปิดเกมแบบแยกไฟล์ (ขึ้น GitHub โดยไม่ build): ใส่ชื่อไฟล์ลงลิสต์ AUDIO_FILES ต้นไฟล์ js/audio.js เช่น ['gun_mg.ogg','bgm_menu.ogg']
