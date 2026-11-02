# SmartTippmixPro 🎯

AI-alapú intelligens sportfogadási elemző és odds radar alkalmazás, amely a hivatalos Szerencsejáték Zrt. (Tippmix / TippmixPro) élő kínálatára, valós oddsaira és nemzetközi statisztikai adatbázisokra épül.

![SmartTippmixPro](https://img.shields.io/badge/Platform-TippmixPro-emerald?style=for-the-badge)
![AI-Powered](https://img.shields.io/badge/AI-Google%20Gemini-blue?style=for-the-badge)
![Sportágak](https://img.shields.io/badge/Sportágak-34%2B%20%26%20E--Sport-purple?style=for-the-badge)

---

## 🚀 Fő funkciók

* ⏱️ **Időintervallum elemzés (1 – 24 óra):** Megkeresi a kiválasztott órán belül induló mérkőzéseket.
* 🏆 **34+ Sportág & E-Sport:** Foci, Tenisz, Kosárlabda, Jégkorong, E-Sport (CS2, LoL, Dota, E-Kosár, E-Foci), Kézilabda, Darts, Snooker, MMA, Asztalitenisz, Röplabda, Vízilabda, Amerikai futball és még 20+ kategória.
* 🎯 **Egyedileg állítható Odds tartomány:** Szabadon beállítható min/max odds (alapértelmezett: 1.30 – 2.00, gyors profilok: 1.20–1.55, 1.30–2.00, 1.70–3.00).
* 📋 **Állítható Tippszám (1 – 10 db):** Te döntöd el, hány legvalószínűbb tippet szeretnél látni (Top 1-től Top 10-ig).
* ⚡ **Intelligens Gyorsítótár (Smart Cache):** Ha nem változtak a mérkőzések az adott időablakban, a backend **0 külső API hívással**, azonnal memóriából adja vissza az eredményt.
* 🔍 **Konkrét Mérkőzés / Csapat Kereső:** Írj be bármilyen meccset vagy csapatot; az élő Tippmix listából automatikus kiegészítéssel vagy szabad internetes kereséssel elemzi az eseményt.
* 📖 **Kattintható Részletes Indoklás & Kockázatelemzés:**
  * Szakmai indoklás (Miért ez a gondolat?)
  * Forma, aktuális statisztikák és H2H mérleg
  * Elemző- és tippoldalak nemzetközi konszenzusa
  * 3 kulcsérv a tipp mellett
  * Kockázatelemzés (1–10 skála + szöveges értékelés arról, mi boríthatja a papírformát)
  * Felhasznált forráslinkek

---

## 🔒 Biztonság & API Kulcs

A Gemini API kulcs **teljesen el van rejtve** a felhasználók és a frontend elől:
* A kulcsot kizárólag a szerver oldali környezeti változó (`GEMINI_API_KEY`) kezeli (`.env` fájlban vagy Render / VPS környezetben).
* A `.gitignore` meggátolja a `.env` feltöltését, így a kulcs soha nem kerül publikus GitHub repóba.

---

## 🛠️ Telepítés és Futtatás Helyben

```bash
# 1. Függőségek telepítése
npm install

# 2. Hozz létre egy .env fájlt a gyökérkönyvtárban:
GEMINI_API_KEY=a_te_gemini_api_kulcsod
PORT=3000

# 3. Indítás
npm start
```

Nyisd meg a böngésződben: **`http://localhost:3000`**

---

## ☁️ Üzembe helyezés (Render.com / Cloud)

A repó tartalmaz egy kész `render.yaml` konfigurációt:
1. Hozz létre egy új Web Service-t a [Render.com](https://render.com)-on a GitHub repóból.
2. Add meg az `Environment Variables` fülön a `GEMINI_API_KEY` értékét.
3. A build és indítás automatikus (`npm install` -> `npm start`).
