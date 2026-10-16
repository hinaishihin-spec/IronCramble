ใส่ไฟล์ภาพที่วาดไว้ที่นี่ (ตามชื่อไฟล์ในคู่มือ wanzer-sprite-guide)
assets/parts/ = ลำตัว หัว แขน ขา แพ็กหลัง
assets/weapons/ = gun_*.png, missile_*.png
assets/ = ภาพไหล่ (shoulder_*.png)

--- แขนท่าถือปืน (arms_<ไอดีพาร์ท>_aims.png) ---
ใส่ที่ assets/parts/ เช่น arms_basic_aims.png คู่กับ arms_basic.png  มีไฟล์ _aims = ตอนถืออาวุธใช้ภาพนี้ (ถอดอาวุธใน Hangar ยังใช้ภาพปกติ)
วาดหันซ้าย เล็งตรงไปทางซ้ายแนวนอน (เหมือนภาพอาวุธ) สเกลเดียวกับภาพแขนปกติ  จุดไหล่/มือตั้งที่ ARM_AIM_RIG ใน js/armaim.js (หรือ aimRig ในข้อมูลพาร์ทแขนชิ้นนั้น)
เปิด ARM_AIM_DEBUG = true ใน js/armaim.js เพื่อดูจุดแดง (ไหล่) / จุดฟ้า (มือ) ตอนตั้งค่า
