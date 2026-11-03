# SmartTippmixPro 🎯

AI-alapú intelligens sportfogadási elemző és odds radar alkalmazás, amely a hivatalos Szerencsejáték Zrt. (Tippmix / TippmixPro) élő kínálatára, valós oddsaira, játékvezetői statisztikáira és nemzetközi elemző adatbázisokra épül.

![SmartTippmixPro](https://img.shields.io/badge/Platform-TippmixPro-emerald?style=for-the-badge)
![AI-Powered](https://img.shields.io/badge/AI-Google%20Gemini-blue?style=for-the-badge)
![Fókusz](https://img.shields.io/badge/Sportágak-NFL%20•%20Foci%20•%20Tenisz-purple?style=for-the-badge)

---

## 🚀 Fő funkciók

* 🏈 **Fókuszált Sportágak (Multi-select):**
  * ⚽ **Labdarúgás (Foci):** BL, EL, Konferencia Liga, Premier League, La Liga, Serie A, Bundesliga, Ligue 1, OTP Bank Liga (NB I) és egyéb rangos ligák.
  * 🎾 **Tenisz:** Grand Slam tornák, ATP Masters, ATP 500/250, WTA, Challenger sorozatok.
  * 🏈 **Amerikai futball (NFL):** NFL alapszakasz, rájátszás és NCAA.
  * Egyszerre tetszőleges kombinációban bejelölhetők.

* 🏆 **Prioritásos Bajnokság-választó (Prestige Scoring):**
  * Ha a focit választod ki, a legrangosabb sorozatok kerülnek előre: **BL (Bajnokok Ligája)**, **EL (Európa Liga)**, **Top 5 európai bajnokság**, **NB I**.
  * Gyorsgombok a kiemelt elitsorozatokra és kibontható választó a további ligákhoz.

* 📅 **Aznapi Mérkőzések & Top 2 Tipp egy sorban:**
  * Az adott bajnokság aznapi összes mérkőzése átlátható listában jelenik meg.
  * Vele egy sorban megjelenik a mérkőzés **Top 2 legvalószínűbb tippje** (a kiválasztott odds sávból, pl. 1.30–2.00).

* 🔍 **"Részletesen" Gomb & Mélyelemzés (Top 3 Tipp):**
  * Minden meccssor végén egy kattintással megnyitható a teljes AI mélyelemzés.
  * 👨‍⚖️ **Játékvezetői (Bíró) vizsgálat:** Focinál és NFL-nél utánanéz a kijelölt bírónak, meccsenkénti lapátlagának (sárga/piros lap), tizenegyes- és szabálytalansági tendenciáinak.
  * 🚩 **Szögletek & Büntetőlapok:** Alapos elemzés a sarokrúgások és sárga lapok várható alakulásáról.
  * ⭐ **Top 3 legvalószínűbb tipp** részletes indoklással, becsült valószínűséggel és kockázati besorolással (1–10).

* 🎯 **Egyedileg állítható Odds tartomány:**
  * Szabadon beállítható min/max odds (alapértelmezett: 1.30 – 2.00, gyors profilok: 1.20–1.55, 1.30–2.00, 1.70–3.00).

* ⚡ **Intelligens Gyorsítótár (Smart Cache):**
  * Ha nem változtak a mérkőzések vagy az elemzési paraméterek, a backend **0 külső API hívással**, azonnal memóriából adja vissza az eredményt.

---

## 🔒 Biztonság & API Kulcs

A Gemini API kulcs **teljesen el van rejtve** a felhasználók és a frontend elől:
* A kulcsot kizárólag a szerver oldali környezeti változó (`GEMINI_API_KEY`) kezeli (`.env` fájlban vagy Render / VPS környezetben).
* A `.gitignore` védi a `.env` fájlt, így a kulcs soha nem kerül publikus GitHub repóba.

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
