import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { initTracker, recordTip, recordTipsBatch, evaluatePendingTips, getStats, resetTracker, getHistory, recordEvaluatedTip } from './tracker.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// 1. KIZÁRÓLAGOS SPORTÁGAK: NFL, FOCI (LABDARÚGÁS), TENISZ
// ============================================================================

const ALL_SPORTS_MASTER = [
  { key: '1', tippmixId: 1, name: 'Labdarúgás (Foci)', shortName: 'Foci', icon: '⚽', searchTerms: ['football', 'soccer', 'labdarúgás'], featured: true },
  { key: '5', tippmixId: 5, name: 'Tenisz', shortName: 'Tenisz', icon: '🎾', searchTerms: ['tennis', 'ATP', 'WTA', 'ITF', 'tenisz'], featured: true },
  { key: '16', tippmixId: 16, name: 'Amerikai futball (NFL)', shortName: 'NFL', icon: '🏈', searchTerms: ['american football', 'NFL', 'NCAA'], featured: true }
];

const ALLOWED_SPORT_IDS = new Set([1, 5, 16]);

// Segédfüggvény: a következő 24 órában (gördülő 24h) kezdődik-e a mérkőzés
function isWithinNext24Hours(dateInput) {
  if (!dateInput) return false;
  try {
    const t = new Date(dateInput).getTime();
    if (isNaN(t)) return false;
    const now = Date.now();
    const max = now + 24 * 60 * 60 * 1000;
    return t >= now && t <= max;
  } catch (_) {
    return false;
  }
}

// Segédfüggvény: pontosan ma játszódik-e a mérkőzés a magyar időzóna szerint (Europe/Budapest)
function isTodayInHungary(dateInput) {
  if (!dateInput) return false;
  try {
    const d = new Date(dateInput);
    const now = new Date();
    const dStr = d.toLocaleDateString('hu-HU', { timeZone: 'Europe/Budapest' });
    const nowStr = now.toLocaleDateString('hu-HU', { timeZone: 'Europe/Budapest' });
    return dStr === nowStr;
  } catch (_) {
    return false;
  }
}

// ============================================================================
// 2. BAJNOKSÁG RANGSOROLÓ (PRESTIGE SCORING)
// ============================================================================

function getCompetitionPrestigeScore(sportId, groupName = '', compName = '') {
  const full = `${groupName} ${compName}`.toLowerCase();
  const cName = compName.toLowerCase().trim();
  const gName = groupName.toLowerCase().trim();

  if (Number(sportId) === 1) { // Labdarúgás
    // Tier 1: Nemzetközi elitsorozatok
    if (cName === 'bl' || full.includes('bajnokok ligája') || full.includes('champions league')) return 1000;
    if (cName === 'el' || full.includes('európa-liga') || full.includes('európa liga') || full.includes('europa league')) return 960;
    if (cName === 'kl' || full.includes('konferencia liga') || full.includes('conference league')) return 920;
    if (full.includes('világbajnokság') || full.includes('world cup') || full.includes('nemzetek ligája') || full.includes('európa-bajnokság')) return 910;

    // Tier 2: Top 5 európai liga + NB I
    if (full.includes('premier league') || (gName.includes('anglia') && cName.includes('premier'))) return 880;
    if (full.includes('la liga') || full.includes('primera divisi') || (gName.includes('spanyol') && cName.includes('la liga'))) return 870;
    if (full.includes('serie a') || (gName.includes('olasz') && cName.includes('serie a'))) return 860;
    if (full.includes('bundesliga') || (gName.includes('német') && cName.includes('bundesliga'))) return 850;
    if (full.includes('ligue 1') || (gName.includes('francia') && cName.includes('ligue 1'))) return 840;
    if (full.includes('nb i') || full.includes('otp bank') || (gName.includes('magyar') && cName.includes('nb i'))) return 830;

    // Tier 3: Top kupák és rangos másodosztályok
    if (full.includes('fa-kupa') || full.includes('fa cup') || full.includes('efl cup') || full.includes('copa del rey') || full.includes('coppa italia') || full.includes('dfb-pokal')) return 780;
    if (full.includes('championship') || (gName.includes('anglia') && cName.includes('championship'))) return 750;
    if (full.includes('eredivisie') || full.includes('liga portugal') || full.includes('süper lig')) return 730;
    if (full.includes('magyar kupa') || full.includes('nb ii')) return 700;

    // Tier 4: További európai első osztályok & Dél-Amerika
    if (full.includes('copa libertadores') || full.includes('copa sudamericana')) return 680;
    if (['belga', 'skót', 'osztrák', 'svájci', 'görög', 'lengyel', 'dán', 'svéd', 'norvég', 'cseh', 'horvát'].some(w => full.includes(w))) return 600;

    return 300;
  }

  if (Number(sportId) === 5) { // Tenisz
    if (['wimbledon', 'us open', 'roland garros', 'australian open'].some(w => full.includes(w))) return 1000;
    if (full.includes('atp finals') || full.includes('wta finals') || full.includes('atp masters') || full.includes('1000')) return 950;
    if (full.includes('atp') && !full.includes('challenger')) return 900;
    if (full.includes('wta') && !full.includes('challenger')) return 850;
    if (full.includes('davis') || full.includes('billie jean')) return 800;
    if (full.includes('challenger')) return 600;
    return 300;
  }

  if (Number(sportId) === 16) { // NFL
    if (cName === 'nfl' || full.includes('nfl')) return 1000;
    if (full.includes('ncaa') || full.includes('egyetemi')) return 750;
    return 400;
  }

  return 100;
}

// ============================================================================
// 3. GYORSÍTÓTÁR (CACHE & RATE-LIMIT VÉDELEM)
// ============================================================================

const CATALOG_CACHE_TTL_MS = 60 * 60 * 1000;        // 60 perc: óránkénti intelligens katalógus frissítés
const EVENT_MARKET_CACHE_TTL_MS = 15 * 60 * 1000;  // 15 perc: mérkőzés piacai
const WEB_RESEARCH_CACHE_TTL_MS = 60 * 60 * 1000;  // 60 perc: internetes statisztikák
const AI_ANALYSIS_CACHE_TTL_MS = 20 * 60 * 1000;   // 20 perc: AI elemzés

let catalogCache = {
  timestamp: 0,
  events: [],
  sports: []
};

const eventMarketCache = new Map();
const webResearchCache = new Map();
const aiAnalysisCache = new Map();

function cleanExpiredCaches() {
  const now = Date.now();
  for (const [k, v] of eventMarketCache.entries()) {
    if (now - v.timestamp > EVENT_MARKET_CACHE_TTL_MS) eventMarketCache.delete(k);
  }
  for (const [k, v] of webResearchCache.entries()) {
    if (now - v.timestamp > WEB_RESEARCH_CACHE_TTL_MS) webResearchCache.delete(k);
  }
  for (const [k, v] of aiAnalysisCache.entries()) {
    if (now - v.timestamp > AI_ANALYSIS_CACHE_TTL_MS) aiAnalysisCache.delete(k);
  }
}

setInterval(cleanExpiredCaches, 5 * 60 * 1000).unref();

function createAnalysisFingerprint({ mode, sportId, minOdds, maxOdds, tipsCount, riskFilter = 'all', eventIds = [], customQuery = '' }) {
  const raw = JSON.stringify({
    v: 'v3_risk',
    mode,
    sportId,
    minOdds: Number(minOdds).toFixed(2),
    maxOdds: Number(maxOdds).toFixed(2),
    tipsCount: Number(tipsCount),
    riskFilter: String(riskFilter || 'all'),
    eventIds: [...eventIds].sort(),
    customQuery: customQuery.toLowerCase().trim()
  });
  return crypto.createHash('sha1').update(raw).digest('hex');
}

function getRiskFilterPromptBlock(riskFilter = 'all', minOdds = 1.3, maxOdds = 2.0) {
  if (riskFilter === 'low') {
    return `
KÖTELEZŐ KOCKÁZATI SZINT SZŰRÉS — KIZÁRÓLAG ALACSONY KOCKÁZATÚ (1–3 / 10) TIPPEK:
- A felhasználó kifejezetten **ALACSONY KOCKÁZATÚ (1–3/10)** tippeket kér a megadott **${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)}** odds-sávon belül!
- **NE SKATULYÁZD BE A PIACOKAT!** Bármilyen piactípus (pl. Mindkét csapat szerez gólt / BTTS, Gólszám 2,5 felett/alatt, 1X2, Kétesély, DNB, Csapat gólszám, Szögletszám, Büntetőlapok, Hendikep stb.) lehet Alacsony kockázatú, amennyiben az adott mérkőzésen a két csapat formája, statisztikája, egymás elleni eredményei (H2H) és a hiányzók/kezdők alapján az a kimenetel kiemelkedően magas valószínűséggel (erős statisztikai megalapozottsággal, minimális bizonytalansággal) várható!
- Minden visszaadott tippnél a "riskAssessment.level" értéke KÖTELEZŐEN "Alacsony", a "riskAssessment.score" értéke pedig szigorúan 1, 2 vagy 3 legyen!`;
  }
  if (riskFilter === 'medium') {
    return `
KÖTELEZŐ KOCKÁZATI SZINT SZŰRÉS — KIZÁRÓLAG KÖZEPES KOCKÁZATÚ (4–6 / 10) TIPPEK:
- A felhasználó kifejezetten **KÖZEPES KOCKÁZATÚ (4–6/10)** tippeket kér a megadott **${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)}** odds-sávon belül!
- **NE SKATULYÁZD BE A PIACOKAT!** Bármilyen elérhető piactípusból (1X2, Mindkét csapat szerez gólt, Gólszám/Pontszám, Kétesély, DNB, Szögletek, Lapok, Hendikep, Játékos piacok stb.) szabadon választhatsz, ahol a statisztikák, a forma és a keretek alapján a tipp jó értéket képvisel, de mérsékelt (4–6/10-es) kockázati faktorral bír!
- Minden visszaadott tippnél a "riskAssessment.level" értéke KÖTELEZŐEN "Közepes", a "riskAssessment.score" értéke pedig szigorúan 4, 5 vagy 6 legyen!`;
  }
  if (riskFilter === 'high') {
    return `
KÖTELEZŐ KOCKÁZATI SZŰRÉS — KIZÁRÓLAG MAGAS KOCKÁZATÚ (7–10 / 10) TIPPEK:
- A felhasználó kifejezetten **MAGAS KOCKÁZATÚ (7–10/10)** tippeket kér a megadott **${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)}** odds-sávon belül!
- **NE SKATULYÁZD BE A PIACOKAT!** Bármilyen piactípusból (1X2, Mindkét csapat szerez gólt, Gólszám/Pontszám, Hendikep, Kombinált piacok, Félidő, Gólszerző/Touchdown, Szöglet, Lapok stb.) választhatsz olyan kimenetelt, amely a statisztikák alapján reális értéket hordoz, de a mérkőzés képe vagy a szorzó alapján magasabb (7–10/10-es) kockázati szintű!
- Minden visszaadott tippnél a "riskAssessment.level" értéke KÖTELEZŐEN "Magas", a "riskAssessment.score" értéke pedig szigorúan 7, 8, 9 vagy 10 legyen!`;
  }
  return '';
}

function enforceTipRiskFilter(tips = [], riskFilter = 'all') {
  if (!Array.isArray(tips) || riskFilter === 'all') return;
  for (const t of tips) {
    if (!t) continue;
    if (!t.riskAssessment) t.riskAssessment = {};
    const rawScore = Number(t.riskAssessment.score) || 4;
    if (riskFilter === 'low') {
      t.riskAssessment.level = 'Alacsony';
      t.riskAssessment.score = Math.min(3, Math.max(1, rawScore <= 3 ? rawScore : 2));
    } else if (riskFilter === 'medium') {
      t.riskAssessment.level = 'Közepes';
      t.riskAssessment.score = Math.min(6, Math.max(4, (rawScore >= 4 && rawScore <= 6) ? rawScore : 5));
    } else if (riskFilter === 'high') {
      t.riskAssessment.level = 'Magas';
      t.riskAssessment.score = Math.min(10, Math.max(7, rawScore >= 7 ? rawScore : 7));
    }
  }
}

// Kockázati szint és Odds-sáv összeférhetőség vizsgálata + javaslatok generálása
function evaluateRiskAndOddsConflict(riskFilter = 'all', minOdds = 1.30, maxOdds = 2.00) {
  // 1. Melyik kockázati szint illik legjobban a jelenlegi minOdds–maxOdds sávhoz?
  let suggestedRiskForOdds = { key: 'medium', label: '🟡 Közepes kockázat (4–6)' };
  if (maxOdds <= 1.60 || (minOdds + maxOdds) / 2 <= 1.48) {
    suggestedRiskForOdds = { key: 'low', label: '🟢 Alacsony kockázat (1–3)' };
  } else if (minOdds >= 1.80 || (minOdds + maxOdds) / 2 >= 1.95) {
    suggestedRiskForOdds = { key: 'high', label: '🔴 Magas kockázat (7–10)' };
  }

  // 2. Milyen odds-sáv illik a kiválasztott kockázati szinthez?
  let suggestedOddsForRisk = { min: 1.30, max: 2.00, label: '1.30 – 2.00' };
  let currentRiskLabel = '🎯 Minden szint';
  if (riskFilter === 'low') {
    suggestedOddsForRisk = { min: 1.20, max: 1.60, label: '1.20 – 1.60' };
    currentRiskLabel = '🟢 Alacsony kockázat (1–3)';
  } else if (riskFilter === 'medium') {
    suggestedOddsForRisk = { min: 1.45, max: 2.10, label: '1.45 – 2.10' };
    currentRiskLabel = '🟡 Közepes kockázat (4–6)';
  } else if (riskFilter === 'high') {
    suggestedOddsForRisk = { min: 1.80, max: 3.20, label: '1.80 – 3.20' };
    currentRiskLabel = '🔴 Magas kockázat (7–10)';
  }

  if (riskFilter === 'all') {
    return { hasConflict: false, suggestedRiskForOdds, suggestedOddsForRisk, currentRiskLabel };
  }

  let hasConflict = false;
  let conflictMessage = '';

  if (riskFilter === 'high' && maxOdds < 1.60) {
    hasConflict = true;
    conflictMessage = `Nincs találat a beállított ${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)} szorzósáv és a 🔴 Magas kockázat (7–10) kombinációjával, mert ${maxOdds.toFixed(2)} alatti szorzóknál nagy valószínűségű (Alacsony vagy Közepes kockázatú) kimenetelek szerepelnek.`;
  } else if (riskFilter === 'low' && minOdds > 1.90) {
    hasConflict = true;
    conflictMessage = `Nincs találat a beállított ${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)} szorzósáv és a 🟢 Alacsony kockázat (1–3) kombinációjával, mert ${minOdds.toFixed(2)} feletti szorzóknál a matematikai találati esély már a Közepes vagy Magas kockázati sávba esik.`;
  } else if (riskFilter === 'medium' && maxOdds < 1.35) {
    hasConflict = true;
    conflictMessage = `Nincs találat a beállított ${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)} szorzósáv és a 🟡 Közepes kockázat (4–6) kombinációjával, mert ez az alacsony szorzósáv a 🟢 Alacsony kockázatú biztonsági tippeknek felel meg.`;
  } else if (riskFilter === 'medium' && minOdds > 2.45) {
    hasConflict = true;
    conflictMessage = `Nincs találat a beállított ${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)} szorzósáv és a 🟡 Közepes kockázat (4–6) kombinációjával, mert ${minOdds.toFixed(2)} feletti szorzóknál a tippek már a 🔴 Magas kockázati kategóriába tartoznak.`;
  }

  return {
    hasConflict,
    conflictMessage,
    currentRiskKey: riskFilter,
    currentRiskLabel,
    currentOddsLabel: `${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)}`,
    suggestedRiskForOdds,
    suggestedOddsForRisk
  };
}

// Diagnosztika generálása, ha 0 piac esik a beállított minOdds–maxOdds sávba
function buildNoMarketsDiagnostics(enrichedEvents = [], minOdds = 1.30, maxOdds = 2.00, riskFilter = 'all') {
  const allOdds = [];
  for (const ev of enrichedEvents) {
    for (const m of (ev.allMarketsList || [])) {
      const o = Number(m.odds);
      if (o > 1.0) allOdds.push(o);
    }
  }
  allOdds.sort((a, b) => a - b);

  const totalAllMarkets = allOdds.length;
  const isTooNarrow = (maxOdds - minOdds) < 0.10;
  const minAvail = totalAllMarkets > 0 ? allOdds[0] : null;
  const maxAvail = totalAllMarkets > 0 ? allOdds[allOdds.length - 1] : null;

  let nearestLower = null;
  let nearestHigher = null;
  for (const o of allOdds) {
    if (o < minOdds) nearestLower = o;
    if (o > maxOdds && nearestHigher === null) nearestHigher = o;
  }

  const riskConflict = evaluateRiskAndOddsConflict(riskFilter, minOdds, maxOdds);

  let suggestedMin = 1.25;
  let suggestedMax = 2.20;
  if (nearestLower !== null && nearestHigher !== null) {
    suggestedMin = Math.max(1.05, Number((nearestLower - 0.05).toFixed(2)));
    suggestedMax = Number((nearestHigher + 0.15).toFixed(2));
  } else if (nearestLower !== null) {
    suggestedMin = Math.max(1.05, Number(( Math.min(nearestLower, minAvail || nearestLower) ).toFixed(2)));
    suggestedMax = Number((nearestLower + 0.30).toFixed(2));
  } else if (nearestHigher !== null) {
    suggestedMin = Math.max(1.05, Number((nearestHigher - 0.10).toFixed(2)));
    suggestedMax = Number((nearestHigher + 0.50).toFixed(2));
  }

  let detailMsg = '';
  if (isTooNarrow) {
    detailMsg = `A beállított szorzósáv (${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)}) túl szűk (kevesebb mint 0.10 különbség), ezért egyetlen fogadási opció sem esett bele.`;
  } else if (totalAllMarkets > 0) {
    const nearParts = [];
    if (nearestLower !== null) nearParts.push(`${nearestLower.toFixed(2)} (alatta)`);
    if (nearestHigher !== null) nearParts.push(`${nearestHigher.toFixed(2)} (felette)`);
    detailMsg = `Összesen ${totalAllMarkets} fogadási opció érhető el a TippmixPro-n, de egyik sem esik a beállított ${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)} szorzósávba.${nearParts.length > 0 ? ` A legközelebbi elérhető szorzók: ${nearParts.join(' és ')}.` : ''}`;
  } else {
    detailMsg = `A mérkőzéshez jelenleg nem található nyitott mérkőzés előtti fogadási piac a TippmixPro kínálatában.`;
  }

  return {
    totalAllMarkets,
    isTooNarrow,
    minAvail,
    maxAvail,
    nearestLower,
    nearestHigher,
    detailMsg,
    suggestedOddsRange: { min: suggestedMin, max: suggestedMax },
    riskConflict
  };
}

// ============================================================================
// 4. TIPPMIX / TIPPMIXPRO ADATLEKÉRŐ
// ============================================================================

const TIPPMIX_SEARCH_URL = 'https://api.tippmix.hu/tippmix/search';
const TIPPMIX_EVENT_URL = 'https://api.tippmix.hu/tippmix/event';

const TIPPMIX_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Origin': 'https://www.tippmix.hu',
  'Referer': 'https://www.tippmix.hu/'
};

async function fetchTippmixCatalog(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && catalogCache.events.length > 0 && now - catalogCache.timestamp < CATALOG_CACHE_TTL_MS) {
    return catalogCache;
  }

  const response = await fetch(TIPPMIX_SEARCH_URL, {
    method: 'POST',
    headers: TIPPMIX_HEADERS,
    body: JSON.stringify({ hitsPerPage: 1500, page: 1 })
  });

  if (!response.ok) {
    throw new Error(`Tippmix API hiba: HTTP ${response.status}`);
  }

  const json = await response.json();
  const rawEvents = json?.data?.events || [];

  // SZIGORÚ SZŰRÉS: Kizárólag Foci (1), Tenisz (5), NFL (16)
  const events = rawEvents.filter(ev => ev && ALLOWED_SPORT_IDS.has(Number(ev.sportId)));

  const nowMs = now;
  const max24hMs = nowMs + 24 * 60 * 60 * 1000;
  const totalCountsById = new Map();
  const next24hCountsById = new Map();

  for (const ev of events) {
    const spId = Number(ev.sportId);
    totalCountsById.set(spId, (totalCountsById.get(spId) || 0) + 1);

    const t = new Date(ev.eventDate).getTime();
    if (t >= nowMs && t <= max24hMs) {
      next24hCountsById.set(spId, (next24hCountsById.get(spId) || 0) + 1);
    }
  }

  const sports = ALL_SPORTS_MASTER.map(s => {
    const count24h = next24hCountsById.get(s.tippmixId) || 0;
    const totalCount = totalCountsById.get(s.tippmixId) || 0;
    return {
      ...s,
      sportId: s.key,
      sportName: s.name,
      count: count24h, // Elsődleges számláló: Következő 24 óra mérkőzései!
      next24hCount: count24h,
      todayUpcomingCount: count24h,
      todayCount: count24h,
      totalCount
    };
  });

  catalogCache = {
    timestamp: now,
    events,
    sports
  };

  return catalogCache;
}

async function fetchEventDetails(eventId, forceRefresh = false) {
  const key = Number(eventId);
  const now = Date.now();
  const cached = eventMarketCache.get(key);
  if (!forceRefresh && cached && now - cached.timestamp < EVENT_MARKET_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const response = await fetch(TIPPMIX_EVENT_URL, {
      method: 'POST',
      headers: TIPPMIX_HEADERS,
      body: JSON.stringify({ eventId: key })
    });
    if (!response.ok) return null;
    const json = await response.json();
    const eventObj = Array.isArray(json?.data) ? json.data[0] : json?.data;
    if (eventObj) {
      eventMarketCache.set(key, { timestamp: now, data: eventObj });
    }
    return eventObj || null;
  } catch (_) {
    return null;
  }
}

// ============================================================================
// PIACI KATEGÓRIÁK, PRIORITÁSOK ÉS TELJES KÍNÁLAT KEZELÉSE
// ============================================================================

// Piac kategória felismerése minden lehetséges fogadási típushoz
function getMarketCategory(marketName = '') {
  const name = marketName.toLowerCase();

  // 1. Góllövő / Gólszerző / Játékos statisztikák / Touchdown
  if (
    name.includes('gólszerző') ||
    name.includes('góllövő') ||
    name.includes('szerez gólt') ||
    name.includes('szerez legalább') ||
    name.includes('játékos') ||
    name.includes('touchdown') ||
    name.includes('passzolt') ||
    name.includes('yard') ||
    name.includes('első gól') ||
    name.includes('ki szerzi') ||
    name.includes('melyik játékos')
  ) {
    return 'SCORER_PLAYER';
  }

  // 2. Kiállítás / Piros lap
  if (
    name.includes('kiállítás') ||
    name.includes('piros lap') ||
    name.includes('kiállít') ||
    name.includes('lesz kiállítás') ||
    name.includes('kiállítás a mérkőzésen')
  ) {
    return 'RED_CARD';
  }

  // 3. 11-es / Büntető
  if (
    name.includes('11-es') ||
    name.includes('tizenegyes') ||
    name.includes('büntető') ||
    name.includes('lesz 11') ||
    name.includes('lesz büntető') ||
    name.includes('büntetőrúgás') ||
    name.includes('büntető a mérkőzésen')
  ) {
    return 'PENALTY';
  }

  // 4. Szögletszám és szögletek
  if (name.includes('szöglet') || name.includes('szögletszám') || name.includes('szögletek')) {
    return 'CORNERS';
  }

  // 5. Lapok és sárga lapok / büntetőlapok
  if (
    name.includes('büntetőlap') ||
    name.includes('sárga lap') ||
    name.includes('lapok száma') ||
    name.includes('lapok') ||
    name.includes('lap ')
  ) {
    return 'CARDS';
  }

  // 6. Fő piacok (1X2, Győztes)
  if (
    name === '1x2' ||
    name.includes('mérkőzés győztese') ||
    name.includes('ki nyeri') ||
    name === 'győztes'
  ) {
    return 'MAIN_1X2';
  }

  // 7. Kétesély, DNB
  if (name === 'kétesély' || name.includes('döntetlennél a tét visszajár')) {
    return 'MAIN_CHANCE';
  }

  // 8. Mindkét csapat szerez gólt
  if (name.includes('mindkét csapat szerez gólt') || name.includes('btts')) {
    return 'BTTS';
  }

  // 9. Gólszámok, Pontszámok, Szettszámok, Játékszámok
  if (
    name.includes('gólszám') ||
    name.includes('pontszám') ||
    name.includes('szettszám') ||
    name.includes('játékszám') ||
    name.includes('mezőnygól') ||
    name.includes('gólok száma')
  ) {
    return 'TOTALS';
  }

  // 10. Hendikep és Ázsiai piacok
  if (name.includes('hendikep') || name.includes('ázsiai')) {
    return 'HANDICAP';
  }

  // 11. Félidők, Harmadok, Negyedek, Játszmák
  if (
    name.includes('1. félidő') ||
    name.includes('2. félidő') ||
    name.includes('félidő') ||
    name.includes('játszma') ||
    name.includes('harmad') ||
    name.includes('negyed')
  ) {
    return 'PERIODS';
  }

  // 12. Különleges csapatspecifikus és mérkőzés piacok
  if (
    name.includes('kapott gól nélkül') ||
    name.includes('tisztán tartott') ||
    name.includes('nyer legalább egy') ||
    name.includes('különbség') ||
    name.includes('első 10 perc') ||
    name.includes('tie-break') ||
    name.includes('pontos eredmény') ||
    name.includes('pontos végeredmény')
  ) {
    return 'SPECIAL';
  }

  return 'OTHER';
}

function getCategoryBasePriority(category) {
  switch (category) {
    case 'MAIN_1X2': return 1.0;
    case 'MAIN_CHANCE': return 1.5;
    case 'BTTS': return 2.0;
    case 'TOTALS': return 2.5;
    case 'SCORER_PLAYER': return 2.8; // Gólszerző / Góllövő / Touchdown kiemelten kezelve!
    case 'RED_CARD': return 3.0;      // Kiállítás / Piros lap kiemelten!
    case 'PENALTY': return 3.2;       // 11-es / Büntető kiemelten!
    case 'CORNERS': return 3.5;       // Szögletek
    case 'CARDS': return 3.7;         // Sárga lapok / Büntetőlapok
    case 'SPECIAL': return 4.0;       // Kapott gól nélkül, tie-break, stb.
    case 'HANDICAP': return 4.5;      // Hendikepek
    case 'PERIODS': return 5.0;       // Félidők
    default: return 6.0;
  }
}

// Piaci prioritások meghatározása
function getMarketPriority(marketName = '') {
  const cat = getMarketCategory(marketName);
  return getCategoryBasePriority(cat);
}

// Odds tartományba eső piacok kinyerése és sokszínűségi optimalizálása
function extractTargetOddsMarkets(markets = [], minOdds = 1.30, maxOdds = 2.00, maxOptionsPerEvent = 25) {
  const validOptions = [];
  const midPoint = (minOdds + maxOdds) / 2;

  for (const m of markets) {
    if (!m.outcomes || !Array.isArray(m.outcomes)) continue;
    const cat = getMarketCategory(m.marketName);
    const priority = getMarketPriority(m.marketName);

    for (const o of m.outcomes) {
      const odds = Number(o.fixedOdds);
      if (odds >= minOdds && odds <= maxOdds) {
        validOptions.push({
          marketId: m.marketId,
          marketName: m.marketName + (m.specialOddsValue ? ` (${m.specialOddsValue})` : ''),
          outcomeName: o.outcomeName,
          odds: Number(odds.toFixed(2)),
          category: cat,
          priority
        });
      }
    }
  }

  // Ha nagy opciószámot kérünk (pl. egyedi meccselemzésnél maxOptionsPerEvent >= 50),
  // akkor visszaadjuk a TELJES valós kínálatot prioritás és odds szerint rendezve
  if (maxOptionsPerEvent >= 50) {
    validOptions.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const distA = Math.abs(a.odds - midPoint);
      const distB = Math.abs(b.odds - midPoint);
      return distA - distB;
    });
    return validOptions.slice(0, maxOptionsPerEvent);
  }

  // Korlátozottabb kvótánál (pl. intervallum keresésnél több mérkőzéshez):
  // Gondoskodunk róla, hogy minden elérhető kategória (Gólszerző, Kiállítás, 11-es, Szöglet, Lapok, Gólszám stb.)
  // képviselve legyen, és ne csak 1X2 vagy sima gólszám töltse ki a helyeket.
  const categoryBuckets = new Map();
  for (const opt of validOptions) {
    if (!categoryBuckets.has(opt.category)) {
      categoryBuckets.set(opt.category, []);
    }
    categoryBuckets.get(opt.category).push(opt);
  }

  for (const bucket of categoryBuckets.values()) {
    bucket.sort((a, b) => {
      const distA = Math.abs(a.odds - midPoint);
      const distB = Math.abs(b.odds - midPoint);
      return distA - distB;
    });
  }

  const selected = [];
  const marketCounts = new Map();

  const sortedCategories = Array.from(categoryBuckets.keys()).sort((catA, catB) => {
    return getCategoryBasePriority(catA) - getCategoryBasePriority(catB);
  });

  let added = true;
  while (selected.length < maxOptionsPerEvent && added) {
    added = false;
    for (const cat of sortedCategories) {
      if (selected.length >= maxOptionsPerEvent) break;
      const bucket = categoryBuckets.get(cat);
      while (bucket.length > 0) {
        const candidate = bucket.shift();
        const baseName = candidate.marketName.split('(')[0].trim().toLowerCase();
        const count = marketCounts.get(baseName) || 0;
        // Maximum 2 kimenetel ugyanabból a konkrét piacnévből a változatosság biztosítására
        if (count < 2) {
          marketCounts.set(baseName, count + 1);
          selected.push(candidate);
          added = true;
          break;
        }
      }
    }
  }

  if (selected.length < maxOptionsPerEvent) {
    const remaining = validOptions.filter(o => !selected.includes(o));
    remaining.sort((a, b) => a.priority - b.priority);
    for (const r of remaining) {
      if (selected.length >= maxOptionsPerEvent) break;
      selected.push(r);
    }
  }

  return selected;
}

async function enrichCandidateEvents(candidateEvents, minOdds = 1.30, maxOdds = 2.00, forceRefresh = false, maxOptionsPerEvent = 25) {
  const detailedResults = await Promise.all(
    candidateEvents.map(async (ev) => {
      const detailed = await fetchEventDetails(ev.eventId, forceRefresh);
      const allMarkets = detailed?.markets?.length ? detailed.markets : (ev.markets || []);
      let filteredOptions = extractTargetOddsMarkets(allMarkets, minOdds, maxOdds, maxOptionsPerEvent);
      // Ha nincs egyetlen piac sem a szűk sávban, enyhe fallback sávval kinyerjük, hogy ne vesszen el a meccs
      if (filteredOptions.length === 0) {
        filteredOptions = extractTargetOddsMarkets(allMarkets, Math.max(1.10, minOdds - 0.20), Math.min(3.50, maxOdds + 0.40), maxOptionsPerEvent);
      }

      return {
        eventId: ev.eventId,
        betradarId: ev.betradarId,
        sportId: ev.sportId,
        sportName: ev.sportName,
        competitionGroupName: ev.competitionGroupName,
        competitionName: ev.competitionName,
        eventName: ev.eventName,
        eventDate: ev.eventDate,
        isLive: ev.isLive,
        totalMarketCount: ev.totalMarketCount || allMarkets.length,
        availableTargetMarkets: filteredOptions,
        allMarketsList: allMarkets
      };
    })
  );

  return detailedResults;
}

// ============================================================================
// ============================================================================
// 5. VALÓS IDEJŰ INTERNETES KUTATÓ & HIVATALOS ESPN SÉRÜLT/FORMA ADATBÁZIS
// ============================================================================

function decodeHtmlEntities(str = '') {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const HU_TO_EN_TEAMS = {
  'magyarország': 'Hungary',
  'németország': 'Germany',
  'hollandia': 'Netherlands',
  'spanyolország': 'Spain',
  'olaszország': 'Italy',
  'franciaország': 'France',
  'anglia': 'England',
  'portugália': 'Portugal',
  'horvátország': 'Croatia',
  'szerbia': 'Serbia',
  'görögország': 'Greece',
  'skócia': 'Scotland',
  'svájc': 'Switzerland',
  'lengyelország': 'Poland',
  'dánia': 'Denmark',
  'svédország': 'Sweden',
  'norvégia': 'Norway',
  'ausztria': 'Austria',
  'szlovénia': 'Slovenia',
  'szlovákia': 'Slovakia',
  'csehország': 'Czech Republic',
  'románia': 'Romania',
  'törökország': 'Turkey',
  'belgium': 'Belgium',
  'wales': 'Wales',
  'írország': 'Republic of Ireland',
  'észak-írország': 'Northern Ireland',
  'izland': 'Iceland',
  'finnország': 'Finland',
  'ukrajna': 'Ukraine',
  'grúzia': 'Georgia',
  'albánia': 'Albania',
  'észak-macedónia': 'North Macedonia',
  'bosznia-hercegovina': 'Bosnia and Herzegovina',
  'montenegró': 'Montenegro',
  'koszovó': 'Kosovo',
  'bulgária': 'Bulgaria',
  'észtország': 'Estonia',
  'lettország': 'Latvia',
  'litvánia': 'Lithuania',
  'fehéroroszország': 'Belarus',
  'moldova': 'Moldova',
  'feröer-szigetek': 'Faroe Islands',
  'ciprus': 'Cyprus',
  'málta': 'Malta',
  'gibraltár': 'Gibraltar',
  'luxemburg': 'Luxembourg',
  'liechtenstein': 'Liechtenstein',
  'andorra': 'Andorra',
  'san marino': 'San Marino',
  'kazahsztán': 'Kazakhstan',
  'azerbajdzsán': 'Azerbaijan',
  'örményország': 'Armenia',
  'izrael': 'Israel',
  'brazília': 'Brazil',
  'argentína': 'Argentina',
  'kolumbia': 'Colombia',
  'mexikó': 'Mexico',
  'kanada': 'Canada',
  'japán': 'Japan',
  'dél-korea': 'South Korea',
  'ausztrália': 'Australia',
  'marokkó': 'Morocco',
  'egyiptom': 'Egypt',
  'szenegál': 'Senegal',
  'nigéria': 'Nigeria',
  'kamerun': 'Cameroon',
  'ghána': 'Ghana',
  'elefántcsontpart': 'Ivory Coast',
  'algéria': 'Algeria',
  'tunézia': 'Tunisia'
};

const NFL_TEAM_MAP = {
  'baltimore': 'Baltimore Ravens',
  'la chargers': 'Los Angeles Chargers',
  'los angeles chargers': 'Los Angeles Chargers',
  'la rams': 'Los Angeles Rams',
  'los angeles rams': 'Los Angeles Rams',
  'kansas city': 'Kansas City Chiefs',
  'buffalo': 'Buffalo Bills',
  'detroit': 'Detroit Lions',
  'san francisco': 'San Francisco 49ers',
  'philadelphia': 'Philadelphia Eagles',
  'dallas': 'Dallas Cowboys',
  'green bay': 'Green Bay Packers',
  'minnesota': 'Minnesota Vikings',
  'chicago': 'Chicago Bears',
  'pittsburgh': 'Pittsburgh Steelers',
  'cincinnati': 'Cincinnati Bengals',
  'cleveland': 'Cleveland Browns',
  'houston': 'Houston Texans',
  'indianapolis': 'Indianapolis Colts',
  'jacksonville': 'Jacksonville Jaguars',
  'tennessee': 'Tennessee Titans',
  'miami': 'Miami Dolphins',
  'new england': 'New England Patriots',
  'ny jets': 'New York Jets',
  'new york jets': 'New York Jets',
  'ny giants': 'New York Giants',
  'new york giants': 'New York Giants',
  'washington': 'Washington Commanders',
  'atlanta': 'Atlanta Falcons',
  'new orleans': 'New Orleans Saints',
  'tampa bay': 'Tampa Bay Buccaneers',
  'carolina': 'Carolina Panthers',
  'seattle': 'Seattle Seahawks',
  'arizona': 'Arizona Cardinals',
  'denver': 'Denver Broncos',
  'las vegas': 'Las Vegas Raiders'
};

function translateTeamNameToEnglish(rawTeam = '', isNfl = false) {
  let clean = rawTeam.trim();
  const lower = clean.toLowerCase();

  if (isNfl) {
    for (const [key, full] of Object.entries(NFL_TEAM_MAP)) {
      if (lower === key || lower.includes(key) || full.toLowerCase().includes(lower)) {
        return full;
      }
    }
  }

  const u21Suffix = /\bu21\b/i.test(clean) ? ' U21' : (/\bu19\b/i.test(clean) ? ' U19' : '');
  const baseLower = lower.replace(/\bu21\b|\bu19\b|\(női\)|\bnői\b/gi, '').trim();

  if (HU_TO_EN_TEAMS[baseLower]) {
    return `${HU_TO_EN_TEAMS[baseLower]}${u21Suffix}`;
  }
  for (const [hu, en] of Object.entries(HU_TO_EN_TEAMS)) {
    if (baseLower.includes(hu)) {
      return `${en}${u21Suffix}`;
    }
  }
  return clean;
}

function parseMatchTeams(eventName = '', isNfl = false) {
  const parts = eventName.split(/\s+[-–vs.]+\s+/i).map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const homeHu = parts[0];
    const awayHu = parts[1];
    const homeEn = translateTeamNameToEnglish(homeHu, isNfl);
    const awayEn = translateTeamNameToEnglish(awayHu, isNfl);
    return {
      homeHu,
      awayHu,
      homeEn,
      awayEn,
      englishMatchup: `${homeEn} vs ${awayEn}`
    };
  }
  const singleEn = translateTeamNameToEnglish(eventName, isNfl);
  return { homeHu: eventName, awayHu: '', homeEn: singleEn, awayEn: '', englishMatchup: singleEn };
}

let espnCache = {
  nflInjuries: { timestamp: 0, data: null },
  nflScoreboard: { timestamp: 0, data: null },
  soccerScoreboard: { timestamp: 0, data: null },
  summaries: new Map()
};

async function fetchJsonWithTimeout(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchEspnMatchIntelligence(ev, parsedTeams, isFootball, isNfl) {
  const now = Date.now();
  const lines = [];
  const sources = [];

  try {
    if (isNfl) {
      if (!espnCache.nflInjuries.data || now - espnCache.nflInjuries.timestamp > 20 * 60 * 1000) {
        const injData = await fetchJsonWithTimeout('https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries');
        if (injData) espnCache.nflInjuries = { timestamp: now, data: injData };
      }
      if (!espnCache.nflScoreboard.data || now - espnCache.nflScoreboard.timestamp > 15 * 60 * 1000) {
        const sbData = await fetchJsonWithTimeout('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
        if (sbData) espnCache.nflScoreboard = { timestamp: now, data: sbData };
      }

      const targetTeams = [parsedTeams.homeEn, parsedTeams.awayEn].filter(Boolean);
      const allTeamInjuries = espnCache.nflInjuries.data?.injuries || [];

      for (const tName of targetTeams) {
        const tLower = tName.toLowerCase();
        const foundTeam = allTeamInjuries.find(ti => {
          const dn = (ti.displayName || '').toLowerCase();
          return dn === tLower || dn.includes(tLower) || tLower.includes(dn);
        });

        if (foundTeam && Array.isArray(foundTeam.injuries)) {
          // Fontos sérültek: Injured Reserve, Out, Doubtful, Questionable + kulcsposztok (QB, RB, WR, TE, CB, S, LB, DE, OT)
          const relevantInjuries = foundTeam.injuries.filter(inj => {
            const st = (inj.status || '').toLowerCase();
            const pos = (inj.athlete?.position?.abbreviation || '').toUpperCase();
            if (st.includes('injured reserve') || st === 'out' || st === 'doubtful' || st === 'questionable') return true;
            if ((pos === 'QB' || pos === 'RB' || pos === 'WR' || pos === 'PK') && (inj.shortComment || inj.longComment)) return true;
            return false;
          });

          if (relevantInjuries.length > 0) {
            lines.push(`   🏥 [HIVATALOS ESPN NFL SÉRÜLTJELENTÉS – ${foundTeam.displayName}]:`);
            for (const inj of relevantInjuries.slice(0, 12)) {
              const player = inj.athlete?.displayName || 'Ismeretlen';
              const pos = inj.athlete?.position?.abbreviation || '?';
              const status = inj.status || 'Unknown';
              const comment = (inj.shortComment || inj.longComment || '').replace(/\s+/g, ' ').trim();
              lines.push(`      - ${player} (${pos}) — Státusz: ${status.toUpperCase()}${comment ? ` | Megjegyzés: ${comment.slice(0, 220)}` : ''}`);
            }
            sources.push({ title: `ESPN Official NFL Injury Report – ${foundTeam.displayName}`, url: 'https://www.espn.com/nfl/injuries' });
          }
        }
      }

      const sbEvents = espnCache.nflScoreboard.data?.events || [];
      const matchedSb = sbEvents.find(e => {
        const en = (e.name || '').toLowerCase();
        return targetTeams.some(t => en.includes(t.toLowerCase().split(' ').pop()));
      });

      if (matchedSb) {
        const comp = matchedSb.competitions?.[0];
        if (comp?.competitors) {
          lines.push(`   🏈 [ESPN NFL CSAPAT STATISZTIKÁK ÉS VEZÉRJÁTÉKOSOK – ${matchedSb.name}]:`);
          for (const c of comp.competitors) {
            const tName = c.team?.displayName || '';
            const rec = c.records?.[0]?.summary || '';
            const leaders = (c.leaders || [])
              .map(l => `${l.displayName}: ${l.leaders?.[0]?.athlete?.displayName || ''} (${l.leaders?.[0]?.displayValue || ''})`)
              .join('; ');
            lines.push(`      - ${tName} (Mérleg: ${rec}) | Aktuális statisztikai vezetők: ${leaders}`);
          }
        }
      }
    } else if (isFootball) {
      if (!espnCache.soccerScoreboard.data || now - espnCache.soccerScoreboard.timestamp > 15 * 60 * 1000) {
        const sbData = await fetchJsonWithTimeout('https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard');
        if (sbData) espnCache.soccerScoreboard = { timestamp: now, data: sbData };
      }

      const sbEvents = espnCache.soccerScoreboard.data?.events || [];
      const homeKey = parsedTeams.homeEn.toLowerCase();
      const awayKey = parsedTeams.awayEn.toLowerCase();

      const matchedSb = sbEvents.find(e => {
        const en = (e.name || '').toLowerCase();
        return (homeKey && en.includes(homeKey)) || (awayKey && en.includes(awayKey));
      });

      if (matchedSb && matchedSb.id) {
        let summaryData = espnCache.summaries.get(matchedSb.id);
        if (!summaryData || now - summaryData.timestamp > 20 * 60 * 1000) {
          const fetched = await fetchJsonWithTimeout(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${matchedSb.id}`);
          if (fetched) {
            summaryData = { timestamp: now, data: fetched };
            espnCache.summaries.set(matchedSb.id, summaryData);
          }
        }

        const sum = summaryData?.data;
        if (sum) {
          if (Array.isArray(sum.leaders) && sum.leaders.length > 0) {
            lines.push(`   ⚽ [ESPN HIVATALOS CSAPAT KULCSJÁTÉKOSOK & GÓLSZERZŐK – ${matchedSb.name}]:`);
            for (const tl of sum.leaders) {
              const tName = tl.team?.displayName || '';
              const lStr = (tl.leaders || [])
                .map(x => `${x.displayName}: ${x.leaders?.[0]?.athlete?.displayName || ''} (${x.leaders?.[0]?.displayValue || ''})`)
                .filter(Boolean)
                .join(' | ');
              if (lStr) lines.push(`      - ${tName}: ${lStr}`);
            }
          }
          if (Array.isArray(sum.lastFiveGames) && sum.lastFiveGames.length > 0) {
            lines.push(`   📈 [UTOLSÓ 5 MÉRKŐZÉS FORMA – ${matchedSb.name}]:`);
            for (const g of sum.lastFiveGames) {
              const tName = g.team?.displayName || '';
              const evStr = (g.events || [])
                .slice(0, 5)
                .map(e => `${e.gameResult || ''} vs ${e.opponent?.displayName || ''} (${e.score || ''})`)
                .join(', ');
              if (evStr) lines.push(`      - ${tName}: ${evStr}`);
            }
          }
          sources.push({ title: `ESPN Match Center – ${matchedSb.name}`, url: `https://www.espn.com/soccer/match/_/gameId/${matchedSb.id}` });
        }
      }
    }
  } catch (_) {
    // ignore ESPN fallback errors
  }

  // TippmixPro aktív játékos-piacok kivonatolása (kik azok a játékosok, akikre a TippmixPro ma ténylegesen kínál oddsot)
  if (Array.isArray(ev.allMarketsList) && ev.allMarketsList.length > 0) {
    const playerMarkets = ev.allMarketsList.filter(m => {
      const mn = (m.marketName || '').toLowerCase();
      return mn.includes('gólszerző') || mn.includes('touchdown') || mn.includes('passzolt yard') || mn.includes('futott yard') || mn.includes('elkapott yard');
    });
    if (playerMarkets.length > 0) {
      const samplePlayers = [...new Set(playerMarkets.slice(0, 14).map(m => `${m.outcomeName} (${m.marketName}: ${m.odds})`))];
      if (samplePlayers.length > 0) {
        lines.push(`   🎯 [TIPPMIXPRO AKTÍV JÁTÉKOS PIACOK A MAI MECCSRE (Kik szerepelnek a mai keretben)]: ${samplePlayers.join(', ')}`);
      }
    }
  }

  return { lines, sources };
}

async function searchLiveNewsRssCached(query, maxResults = 5, recentDays = 10) {
  const cacheKey = `rss_${query.toLowerCase().trim()}_${recentDays}`;
  const now = Date.now();
  const cached = webResearchCache.get(cacheKey);
  if (cached && now - cached.timestamp < WEB_RESEARCH_CACHE_TTL_MS) {
    return cached.results;
  }

  const results = [];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  };

  try {
    const bingUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`;
    const googleUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query + (recentDays ? ` when:${recentDays}d` : ''))}&hl=en-US&gl=US&ceid=US:en`;

    const [bingRes, googleRes] = await Promise.allSettled([
      fetch(bingUrl, { headers }),
      fetch(googleUrl, { headers })
    ]);

    if (bingRes.status === 'fulfilled' && bingRes.value.ok) {
      const xml = await bingRes.value.text();
      const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      for (const m of itemMatches.slice(0, maxResults)) {
        const block = m[1];
        const title = decodeHtmlEntities((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
        const desc = decodeHtmlEntities((block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '');
        const link = decodeHtmlEntities((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '');
        const pubDate = decodeHtmlEntities((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '');
        if (title && (desc || pubDate)) {
          results.push({
            title,
            snippet: `${desc || title}${pubDate ? ` (${pubDate.slice(0, 16)})` : ''}`,
            url: link
          });
        }
      }
    }

    if (googleRes.status === 'fulfilled' && googleRes.value.ok) {
      const xml = await googleRes.value.text();
      const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      for (const m of itemMatches.slice(0, maxResults)) {
        const block = m[1];
        const title = decodeHtmlEntities((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
        const desc = decodeHtmlEntities((block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '');
        const link = decodeHtmlEntities((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '');
        const pubDate = decodeHtmlEntities((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '');
        if (title) {
          results.push({
            title,
            snippet: `${desc && desc !== title ? desc : title}${pubDate ? ` (${pubDate.slice(0, 16)})` : ''}`,
            url: link
          });
        }
      }
    }

    const deduped = [];
    const seen = new Set();
    for (const r of results) {
      const k = r.title.toLowerCase().slice(0, 55);
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(r);
      if (deduped.length >= maxResults) break;
    }

    webResearchCache.set(cacheKey, { timestamp: now, results: deduped });
    return deduped;
  } catch (_) {
    return [];
  }
}

async function gatherWebResearchForMatches(eventsList, customQuery = '') {
  const allWebSources = [];
  const seenUrls = new Set();
  const researchSections = [];

  const dedupeAndCollect = (resultsArray) => {
    const unique = [];
    for (const r of resultsArray) {
      if (!r || !r.title || !r.snippet) continue;
      const key = r.title.toLowerCase().slice(0, 55);
      if (seenUrls.has(key)) continue;
      seenUrls.add(key);
      unique.push(r);
      if (r.url) allWebSources.push({ title: r.title, url: r.url });
    }
    return unique;
  };

  if (eventsList && eventsList.length > 0) {
    const isSingleDeepMatch = eventsList.length === 1;
    const topToSearch = eventsList.slice(0, 5);

    for (const ev of topToSearch) {
      const sportIdNum = Number(ev.sportId);
      const isFootball = sportIdNum === 1 || ev.sportName?.toLowerCase().includes('foci') || ev.sportName?.toLowerCase().includes('labdarúgás');
      const isNfl = sportIdNum === 16 || ev.sportName?.toLowerCase().includes('nfl') || ev.sportName?.toLowerCase().includes('amerikai');

      const parsedTeams = parseMatchTeams(ev.eventName, isNfl);
      const enMatch = parsedTeams.englishMatchup;

      // 1. Általános előrejelzés, forma és fogadási tippek (angolra fordított csapatnevekkel!)
      const qMain = `${enMatch} preview prediction betting tips stats`;

      // 2. Célzott SÉRÜLTEK, ELTILTOTTAK, HIÁNYZÓK és VÁRHATÓ KEZDŐCSAPATOK
      let qInjuries = '';
      if (isFootball) {
        qInjuries = `${enMatch} team news injuries suspensions predicted lineup`;
      } else if (isNfl) {
        qInjuries = `${enMatch} injury report out questionable quarterback starters`;
      } else {
        qInjuries = `${enMatch} tennis preview injury form head to head`;
      }

      // 3. Csapatonkénti célzott sérült és kulcsjátékos keresés
      let qTeamSpecific = '';
      if (isNfl && parsedTeams.homeEn && parsedTeams.awayEn) {
        qTeamSpecific = `${parsedTeams.homeEn} ${parsedTeams.awayEn} quarterback injury report lineup`;
      } else if (isFootball && parsedTeams.homeEn && parsedTeams.awayEn) {
        qTeamSpecific = `${parsedTeams.homeEn} vs ${parsedTeams.awayEn} starting XI lineup key players`;
      } else {
        qTeamSpecific = `${enMatch} key players stats`;
      }

      const searches = [
        fetchEspnMatchIntelligence(ev, parsedTeams, isFootball, isNfl),
        searchLiveNewsRssCached(qMain, 6, 10),
        searchLiveNewsRssCached(qInjuries, 6, 10),
        searchLiveNewsRssCached(qTeamSpecific, 5, 14)
      ];

      if (isSingleDeepMatch && isFootball) {
        searches.push(
          searchLiveNewsRssCached(`${enMatch} SportsMole WhoScored lineup injuries prediction`, 4, 10)
        );
      }

      const [espnIntel, ...rssResults] = await Promise.all(searches);
      const combined = dedupeAndCollect(rssResults.flat());

      if (espnIntel?.sources?.length > 0) {
        allWebSources.push(...espnIntel.sources);
      }

      const sectionLines = [];
      if (espnIntel?.lines?.length > 0) {
        sectionLines.push(...espnIntel.lines);
      }
      if (combined.length > 0) {
        sectionLines.push(`   📰 [FRISS NEMZETKÖZI SZAKCIKKEK ÉS SÉRÜLÉSI HÍREK (${combined.length} cikk az elmúlt napokból – ${enMatch})]:`);
        for (const r of combined) {
          sectionLines.push(`      • [${r.title}]: ${r.snippet}`);
        }
      }

      if (sectionLines.length > 0) {
        researchSections.push(
          `Mérkőzés valós idejű kutatása [${ev.sportName} - ${ev.eventName} (${enMatch})]:\n${sectionLines.join('\n')}`
        );
      }
    }
  } else if (customQuery) {
    const parsedTeams = parseMatchTeams(customQuery, true);
    const enMatch = parsedTeams.englishMatchup;
    const [espnNfl, r1, r2, r3] = await Promise.all([
      fetchEspnMatchIntelligence({ eventName: customQuery }, parsedTeams, false, true),
      searchLiveNewsRssCached(`${enMatch} preview prediction betting tips`, 6, 10),
      searchLiveNewsRssCached(`${enMatch} injury report team news predicted lineup`, 6, 10),
      searchLiveNewsRssCached(`${enMatch} key players quarterback striker stats`, 5, 14)
    ]);
    const combined = dedupeAndCollect([r1, r2, r3].flat());
    const sectionLines = [];
    if (espnNfl?.lines?.length > 0) sectionLines.push(...espnNfl.lines);
    if (combined.length > 0) {
      sectionLines.push(...combined.map(r => `   • [${r.title}]: ${r.snippet}`));
    }
    if (sectionLines.length > 0) {
      researchSections.push(
        `Internetes és ESPN kutatási találatok ("${customQuery}" / "${enMatch}"):\n${sectionLines.join('\n')}`
      );
    }
  }

  return {
    researchText: researchSections.length > 0
      ? researchSections.join('\n\n')
      : 'Nem érkezett friss külső sérültjelentés ehhez a mérkőzéshez.',
    webSources: allWebSources
  };
}

// ============================================================================
// 6. GEMINI AI ELEMZŐ MOTOR
// ============================================================================

let cachedModelsForKey = { keyHash: '', timestamp: 0, models: [] };

async function discoverActiveGeminiModels(apiKey) {
  const defaultModels = [
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3.5-flash'
  ];

  const keyHash = crypto.createHash('md5').update(apiKey).digest('hex');
  const now = Date.now();
  if (cachedModelsForKey.keyHash === keyHash && now - cachedModelsForKey.timestamp < 30 * 60 * 1000 && cachedModelsForKey.models.length > 0) {
    return cachedModelsForKey.models;
  }

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    if (!r.ok) return defaultModels;
    const d = await r.json();

    const available = (d.models || [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name.replace(/^models\//, ''))
      .filter(name => {
        if (name.includes('1.5') || name.includes('2.0') || name.includes('2.5')) return false;
        if (name.includes('tts') || name.includes('image') || name.includes('embedding') || name.includes('vision') || name.includes('aqa') || name.includes('transcribe') || name.includes('robotics')) return false;
        return name.startsWith('gemini-');
      });

    if (available.length === 0) return defaultModels;

    available.sort((a, b) => {
      const score = (n) => {
        if (n === 'gemini-flash-lite-latest') return 100;
        if (n === 'gemini-3.1-flash-lite') return 98;
        if (n === 'gemini-3.5-flash-lite') return 96;
        if (n === 'gemini-flash-latest') return 92;
        if (n === 'gemini-3.5-flash') return 88;
        if (n.includes('flash') && n.includes('lite')) return 80;
        if (n.includes('flash')) return 70;
        return 50;
      };
      return score(b) - score(a);
    });

    const finalModels = [...new Set([...available, ...defaultModels])];
    cachedModelsForKey = { keyHash, timestamp: now, models: finalModels };
    return finalModels;
  } catch (_) {
    return defaultModels;
  }
}

async function callGeminiWithSearch({ apiKey, prompt, precollectedSources = [] }) {
  const cleanKey = (apiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!cleanKey) {
    throw new Error('Hiányzik a Gemini API kulcs! Kérlek add meg a .env fájlban (GEMINI_API_KEY).');
  }

  const modelsToTry = await discoverActiveGeminiModels(cleanKey);
  const errorsPerModel = [];

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const body = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.25,
          responseMimeType: 'application/json'
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data?.error?.message || `HTTP ${response.status}`;
        throw new Error(errMsg);
      }

      const candidate = data?.candidates?.[0];
      const textParts = candidate?.content?.parts?.map(p => p.text || '').join('\n') || '';

      const parsedJson = parseJsonFromAiResponse(textParts);
      return {
        modelUsed: model,
        data: parsedJson,
        webSources: precollectedSources,
        searchQueries: []
      };
    } catch (err) {
      console.warn(`Modell (${model}) hiba, váltás a következőre:`, err.message);
      errorsPerModel.push(`${model}: ${err.message}`);
    }
  }

  throw new Error(errorsPerModel[0] || 'Nem sikerült választ kapni a Gemini API-tól.');
}

function parseJsonFromAiResponse(text) {
  if (!text) throw new Error('Üres válasz érkezett az AI modelltől.');

  try {
    return JSON.parse(text.trim());
  } catch (_) {}

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) {}
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    return JSON.parse(candidate);
  }

  throw new Error('Az AI válasza nem tartalmazott érvényes JSON struktúrát.');
}

// ============================================================================
// 7. REST API VÉGPONTOK
// ============================================================================

// Health check végpont (UptimeRobot / Render pinghez: /api/health és /health is él)
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ ok: true, status: 'alive', time: new Date().toISOString() });
});

// 7.0 STATISZTIKA & TALÁLATI ARÁNY (FOCI, TENISZ, NFL)
app.get('/api/stats', (req, res) => {
  try {
    res.json(getStats());
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Manuális vagy kliens oldali ellenőrzés indítása
app.post('/api/stats/evaluate', (req, res) => {
  try {
    evaluatePendingTips(fetchEventDetails, callGeminiWithSearch).catch(err => {
      console.warn('⚠️ evaluatePendingTips hiba:', err.message);
    });
    res.json({ ok: true, message: 'Kiértékelés elindítva a háttérben.' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// KLIENS OLDALI TIPPEK SZINKRONIZÁLÁSA / HELYREÁLLÍTÁSA (Deploy utáni adatmentés)
app.post('/api/tips/sync', (req, res) => {
  try {
    const incomingTips = Array.isArray(req.body.tips) ? req.body.tips : [];
    if (incomingTips.length === 0) {
      return res.json({ ok: true, addedCount: 0 });
    }
    const addedCount = recordTipsBatch(incomingTips, 'client_sync');
    res.json({ ok: true, addedCount, totalPending: getStats().pendingCount });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// TIPP ELŐZMÉNYEK ÉS FÜGGŐ TIPPEK LEKÉRDEZÉSE (Szűrés: sportId, riskCategory, status, categoryGroup, categorySub)
app.get('/api/tips/history', (req, res) => {
  try {
    const { sportId, riskCategory, status, categoryGroup, categorySub } = req.query;
    const historyList = getHistory({ sportId, riskCategory, status, categoryGroup, categorySub });
    const fullStats = getStats();

    // Függő tippek szűrése az ablakhoz
    let pendingList = fullStats.pendingTipsSummary || [];
    if (sportId && sportId !== 'all') {
      const sId = Number(sportId);
      pendingList = pendingList.filter(t => {
        const tipSportId = Number(t.sportId || (t.sportName?.includes('Tenisz') ? 5 : (t.sportName?.includes('futball') || t.sportName?.includes('NFL') ? 16 : 1)));
        return tipSportId === sId;
      });
    }
    if (categoryGroup && categoryGroup !== 'all') {
      pendingList = pendingList.filter(t => t.categoryGroupKey === categoryGroup);
    }
    if (categorySub && categorySub !== 'all') {
      pendingList = pendingList.filter(t => t.categorySubKey === categorySub);
    }
    if (riskCategory && riskCategory !== 'all') {
      pendingList = pendingList.filter(t => t.riskCategory === riskCategory);
    }

    res.json({
      ok: true,
      history: historyList,
      pending: pendingList,
      stats: fullStats.stats,
      categories: fullStats.categories,
      extraInsights: fullStats.extraInsights,
      counts: {
        totalHistory: historyList.length,
        totalPending: pendingList.length
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// KIÉRTÉKELT TIPP RÖGZÍTÉSE / IMPORTÁLÁSA (pl. már lezárult élő tipp beemelése)
app.post('/api/tips/history/record', (req, res) => {
  try {
    const item = req.body;
    if (!item) {
      return res.status(400).json({ ok: false, error: 'Hiányzó tipp adat.' });
    }
    const recorded = recordEvaluatedTip(item);
    if (!recorded) {
      return res.status(400).json({ ok: false, error: 'Érvénytelen tipp formátum.' });
    }
    res.json({ ok: true, item: recorded, stats: getStats() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// STATISZTIKÁK ÉS FÜGGŐ TIPPEK TELJES NULLÁZÁSA (RESET)
app.post('/api/stats/reset', (req, res) => {
  try {
    const cleanState = resetTracker();
    res.json({ ok: true, message: 'Minden statisztika és függő tipp sikeresen nullázva!', state: cleanState });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 7.1 STÁTUSZ & SPORTÁGAK (GÖRDÜLŐ 24 ÓRÁS SZÁMÍTÁS)
app.get('/api/status', async (req, res) => {
  try {
    const catalog = await fetchTippmixCatalog();
    const now = Date.now();
    const max24h = now + 24 * 60 * 60 * 1000;

    const upcomingCount = catalog.events.filter(e => new Date(e.eventDate).getTime() > now).length;
    const rolling24hCount = catalog.events.filter(e => {
      const t = new Date(e.eventDate).getTime();
      return t >= now && t <= max24h;
    }).length;

    res.json({
      ok: true,
      hasServerApiKey: Boolean(process.env.GEMINI_API_KEY),
      totalEvents: catalog.events.length,
      upcomingEvents: upcomingCount,
      todayEvents: rolling24hCount,
      rolling24hEvents: rolling24hCount,
      sports: catalog.sports,
      cacheStats: {
        cachedAnalyses: aiAnalysisCache.size,
        cachedMatches: eventMarketCache.size,
        cachedWebSearches: webResearchCache.size
      },
      serverTime: new Date(now).toISOString()
    });
  } catch (err) {
    res.json({
      ok: false,
      hasServerApiKey: Boolean(process.env.GEMINI_API_KEY),
      sports: ALL_SPORTS_MASTER.map(s => ({ ...s, sportId: s.key, sportName: s.name, count: 0, todayCount: 0, totalCount: 0 })),
      error: err.message
    });
  }
});

// 7.2 BAJNOKSÁGOK LISTÁJA PRIORITÁS SZERINT (BL, EL, TOP LIGÁK, NB I ELŐRE!)
app.get('/api/competitions', async (req, res) => {
  try {
    const catalog = await fetchTippmixCatalog();
    const rawParam = req.query.sportId || req.query.sports || '1,5,16';
    const rawSports = rawParam.toString().split(',').map(s => Number(s.trim())).filter(Boolean);
    const filterSports = rawSports.length > 0 ? rawSports : [1, 5, 16];

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const compMap = new Map();

    for (const ev of catalog.events) {
      if (!filterSports.includes(Number(ev.sportId))) continue;

      const groupName = ev.competitionGroupName || '';
      const compName = ev.competitionName || '';
      const compKey = `${ev.sportId}:${groupName} - ${compName}`;

      if (!compMap.has(compKey)) {
        const prestige = getCompetitionPrestigeScore(ev.sportId, groupName, compName);
        compMap.set(compKey, {
          key: compKey,
          sportId: ev.sportId,
          sportName: ev.sportName,
          competitionGroupName: groupName,
          competitionName: compName,
          displayName: groupName ? `${groupName} - ${compName}` : compName,
          prestigeScore: prestige,
          totalMatches: 0,
          todayMatches: 0,
          next24hMatches: 0
        });
      }

      const item = compMap.get(compKey);
      item.totalMatches++;

      if (isWithinNext24Hours(ev.eventDate)) {
        item.todayMatches++;
        item.next24hMatches = (item.next24hMatches || 0) + 1;
      }
    }

    const competitions = Array.from(compMap.values());
    competitions.sort((a, b) => {
      if (b.prestigeScore !== a.prestigeScore) return b.prestigeScore - a.prestigeScore;
      if (b.todayMatches !== a.todayMatches) return b.todayMatches - a.todayMatches;
      return b.totalMatches - a.totalMatches;
    });

    res.json({
      ok: true,
      competitions
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 7.3 KÖVETKEZŐ 24 ÓRA MÉRKŐZÉSEI ÉS TOP 2 TIPP ADOTT BAJNOKSÁG(OK)HOZ (GÖRDÜLŐ 24H)
app.post('/api/matches/by-competitions', async (req, res) => {
  try {
    const catalog = await fetchTippmixCatalog();
    const competitionKeys = Array.isArray(req.body.competitionKeys) ? req.body.competitionKeys.filter(k => k && k !== 'ALL') : [];
    const competitionGroupName = req.body.competitionGroupName ? String(req.body.competitionGroupName).trim() : null;
    const sportIds = Array.isArray(req.body.sportIds) ? req.body.sportIds.map(Number) : [1];
    const onlyToday = req.body.onlyToday !== false;
    const rawMinOdds = Math.max(1.01, Math.min(20.0, Number(req.body.minOdds) || 1.30));
    const rawMaxOdds = Math.max(1.05, Math.min(50.0, Number(req.body.maxOdds) || 2.00));
    const minOdds = Math.min(rawMinOdds, rawMaxOdds);
    const maxOdds = Math.max(rawMinOdds, rawMaxOdds);

    // Kiszűrjük a mérkőzéseket a kiválasztott bajnokság(ok) alapján
    let matchedEvents = catalog.events.filter(ev => {
      if (!sportIds.includes(Number(ev.sportId))) return false;

      const groupName = ev.competitionGroupName || '';
      const compName = ev.competitionName || '';
      const compKey = `${ev.sportId}:${groupName} - ${compName}`;

      if (competitionGroupName && competitionGroupName !== 'ALL' && groupName !== competitionGroupName) {
        return false;
      }

      if (competitionKeys.length > 0 && !competitionKeys.includes(compKey) && !competitionKeys.includes(compName)) {
        return false;
      }

      // GÖRDÜLŐ 24 ÓRÁS SZŰRÉS: a mostantól számított következő 24 óra meccsei!
      if (onlyToday) {
        if (!isWithinNext24Hours(ev.eventDate)) {
          return false;
        }
      }

      return true;
    });

    // Időrendi sorrend
    matchedEvents.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));

    // Limitáljuk a túlterhelés elkerülésére (pl. max 30 mérkőzés)
    const targetEvents = matchedEvents.slice(0, 30);

    // Minden mérkőzéshez lekérjük a részletes piacokat és kiszámítjuk a TOP 2 TIPPEKET
    const enrichedMatches = await Promise.all(
      targetEvents.map(async (ev) => {
        const detailed = await fetchEventDetails(ev.eventId);
        const allMarkets = detailed?.markets?.length ? detailed.markets : (ev.markets || []);

        // 1. Megpróbáljuk kinyerni a felhasználó odds sávjából a piacokat
        let targetMarkets = extractTargetOddsMarkets(allMarkets, minOdds, maxOdds, 10);

        // Ha kevesebb mint 2 opció lenne az exact sávban, kicsit tágítunk, hogy mindig legyen Top 2 tipp
        if (targetMarkets.length < 2) {
          const fallbackMarkets = extractTargetOddsMarkets(allMarkets, Math.max(1.10, minOdds - 0.20), Math.min(3.50, maxOdds + 0.50), 10);
          for (const fm of fallbackMarkets) {
            if (!targetMarkets.some(tm => tm.marketId === fm.marketId && tm.outcomeName === fm.outcomeName)) {
              targetMarkets.push(fm);
              if (targetMarkets.length >= 2) break;
            }
          }
        }

        // Kiválasztjuk a TOP 2 tippet (különböző piacokból preferálva)
        const top2 = [];
        const usedMarketNames = new Set();

        for (const tm of targetMarkets) {
          const baseMarketName = tm.marketName.split('(')[0].trim().toLowerCase();
          if (!usedMarketNames.has(baseMarketName)) {
            top2.push(tm);
            usedMarketNames.add(baseMarketName);
          }
          if (top2.length >= 2) break;
        }

        // Ha még mindig nincs 2 tipp, engedjük ugyanazt a piacot más kimenetellel
        if (top2.length < 2 && targetMarkets.length > top2.length) {
          for (const tm of targetMarkets) {
            if (!top2.includes(tm)) {
              top2.push(tm);
              if (top2.length >= 2) break;
            }
          }
        }

        return {
          eventId: ev.eventId,
          sportId: ev.sportId,
          sportName: ev.sportName,
          competitionGroupName: ev.competitionGroupName,
          competitionName: ev.competitionName,
          eventName: ev.eventName,
          eventDate: ev.eventDate,
          totalMarketCount: ev.totalMarketCount || allMarkets.length,
          top2Tips: top2.map(t => ({
            marketName: t.marketName,
            outcomeName: t.outcomeName,
            odds: t.odds
          }))
        };
      })
    );

    res.json({
      ok: true,
      totalCount: matchedEvents.length,
      matches: enrichedMatches
    });
  } catch (err) {
    console.error('Bajnokság meccsek hiba:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 7.4 GYORS KERESŐ AUTOCOMPLETE
app.get('/api/matches/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim().toLowerCase();
    const catalog = await fetchTippmixCatalog();
    const now = new Date();

    let matches = catalog.events.filter(ev => {
      const evDate = new Date(ev.eventDate);
      if (evDate < new Date(now.getTime() - 2 * 3600 * 1000)) return false;
      if (!q) return true;
      return (
        ev.eventName?.toLowerCase().includes(q) ||
        ev.competitionName?.toLowerCase().includes(q) ||
        ev.competitionGroupName?.toLowerCase().includes(q) ||
        ev.sportName?.toLowerCase().includes(q)
      );
    });

    matches.sort((a, b) => (b.totalMarketCount || 0) - (a.totalMarketCount || 0));

    res.json({
      ok: true,
      matches: matches.slice(0, 18).map(ev => ({
        eventId: ev.eventId,
        sportId: ev.sportId,
        sportName: ev.sportName,
        competitionGroupName: ev.competitionGroupName,
        competitionName: ev.competitionName,
        eventName: ev.eventName,
        eventDate: ev.eventDate,
        totalMarketCount: ev.totalMarketCount
      }))
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 7.5 IDŐINTERVALLUM ALAPJÁN TÖRTÉNŐ ELEMZÉS
app.post('/api/analyze/interval', async (req, res) => {
  try {
    const hours = Math.min(24, Math.max(1, Number(req.body.hours) || 6));
    const sportId = req.body.sportId ? String(req.body.sportId) : 'all';
    const rawMinOdds = Math.max(1.01, Math.min(20.0, Number(req.body.minOdds) || 1.30));
    const rawMaxOdds = Math.max(1.05, Math.min(50.0, Number(req.body.maxOdds) || 2.00));
    const minOdds = Math.min(rawMinOdds, rawMaxOdds);
    const maxOdds = Math.max(rawMinOdds, rawMaxOdds);
    const tipsCount = Math.min(10, Math.max(1, Number(req.body.tipsCount) || 3));
    const riskFilter = ['low', 'medium', 'high'].includes(req.body.riskFilter) ? req.body.riskFilter : 'all';
    const forceRefresh = Boolean(req.body.forceRefresh);
    const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;

    const catalog = await fetchTippmixCatalog(forceRefresh);
    const selectedSportMeta = ALL_SPORTS_MASTER.find(s => s.key === sportId || String(s.tippmixId) === sportId);
    const now = new Date();
    const endWindow = new Date(now.getTime() + hours * 3600 * 1000);

    let windowEvents = catalog.events.filter(ev => {
      const evDate = new Date(ev.eventDate);
      const inTime = evDate >= now && evDate <= endWindow;
      if (!inTime) return false;
      if (sportId === 'all') return true;
      if (String(ev.sportId) === sportId) return true;
      return false;
    });

    // Ha EGYÁLTALÁN NINCS mérkőzés a megadott intervallumban az adott sportágból
    if (windowEvents.length === 0) {
      const sportLabel = selectedSportMeta ? selectedSportMeta.name : (sportId === 'all' ? 'Összes sportág' : 'a kiválasztott sportág');
      return res.json({
        ok: true,
        mode: 'interval',
        noMatches: true,
        hours,
        sportId,
        minOdds,
        maxOdds,
        tipsCount,
        sportName: selectedSportMeta ? selectedSportMeta.name : 'NFL, Foci, Tenisz',
        noMatchesMessage: `A(z) ${sportLabel} kínálatában a következő ${hours} órában nem található kezdődő mérkőzés a TippmixPro felületén. Kérlek válassz tágabb időintervallumot (pl. 12 vagy 24 óra), vagy válaszd az "Összes sportág" lehetőséget!`,
        result: {
          analysisOverview: `A(z) ${sportLabel} kínálatában a következő ${hours} órában nincs kezdődő mérkőzés a TippmixPro-n.`,
          tips: []
        },
        fromCache: false
      });
    }

    windowEvents.sort((a, b) => (b.totalMarketCount || 1) - (a.totalMarketCount || 1));
    const topCandidates = windowEvents.slice(0, Math.max(12, tipsCount * 2 + 2));

    const fingerprint = createAnalysisFingerprint({
      mode: 'interval',
      sportId,
      minOdds,
      maxOdds,
      tipsCount,
      riskFilter,
      eventIds: topCandidates.map(e => e.eventId)
    });

    const cachedAnalysis = aiAnalysisCache.get(fingerprint);
    if (!forceRefresh && cachedAnalysis && Date.now() - cachedAnalysis.timestamp < AI_ANALYSIS_CACHE_TTL_MS) {
      const cachedTips = cachedAnalysis.payload?.result?.tips;
      if (Array.isArray(cachedTips) && cachedTips.length > 0) {
        return res.json({
          ...cachedAnalysis.payload,
          fromCache: true
        });
      }
    }

    const enrichedEvents = topCandidates.length > 0
      ? await enrichCandidateEvents(topCandidates, minOdds, maxOdds, forceRefresh, 25)
      : [];

    const riskConflictCheck = evaluateRiskAndOddsConflict(riskFilter, minOdds, maxOdds);
    if (riskConflictCheck.hasConflict) {
      return res.json({
        ok: true,
        mode: 'interval',
        noMatches: true,
        reasonCode: 'risk_odds_conflict',
        hours,
        sportId,
        minOdds,
        maxOdds,
        tipsCount,
        riskFilter,
        riskOddsConflict: riskConflictCheck,
        noMatchesMessage: riskConflictCheck.conflictMessage,
        result: {
          analysisOverview: riskConflictCheck.conflictMessage,
          tips: []
        },
        fromCache: false
      });
    }

    const totalAvailableMarkets = enrichedEvents.reduce((acc, ev) => acc + (ev.availableTargetMarkets?.length || 0), 0);
    if (totalAvailableMarkets === 0) {
      const diag = buildNoMarketsDiagnostics(enrichedEvents, minOdds, maxOdds, riskFilter);
      return res.json({
        ok: true,
        mode: 'interval',
        noMatches: true,
        reasonCode: diag.isTooNarrow ? 'odds_too_narrow' : 'no_markets_in_odds_range',
        hours,
        sportId,
        minOdds,
        maxOdds,
        tipsCount,
        riskFilter,
        diagnostics: diag,
        riskOddsConflict: diag.riskConflict,
        sportName: selectedSportMeta ? selectedSportMeta.name : 'NFL, Foci, Tenisz',
        noMatchesMessage: `A következő ${hours} órában van ${windowEvents.length} mérkőzés, de: ${diag.detailMsg}`,
        result: {
          analysisOverview: diag.detailMsg,
          tips: []
        },
        fromCache: false
      });
    }

    const webResearch = await gatherWebResearchForMatches(
      enrichedEvents,
      enrichedEvents.length === 0 ? `${selectedSportMeta ? selectedSportMeta.name : 'football tennis NFL'} upcoming matches next ${hours} hours predictions betting tips odds` : ''
    );

    let matchesContextBlock = '';
    if (enrichedEvents.length > 0) {
      matchesContextBlock = `A KÖVETKEZŐ ${hours} ÓRÁBAN ELÉRHETŐ TIPPMIXPRO MÉRKŐZÉSEK ÉS SOKSZÍNŰ ${minOdds.toFixed(2)}-${maxOdds.toFixed(2)} KÖZÖTTI PIACOK (1X2, GÓLSZÁM, MINDKÉT CSAPAT GÓL, GÓLLÖVŐ, KIÁLLÍTÁS, 11-ES, SZÖGLETEK, LAPOK, FÉLIDŐK, HENDIKEPEK):\n` +
        enrichedEvents.map((ev, idx) => {
          const marketsStr = ev.availableTargetMarkets
            .map(m => `   - Piac: "${m.marketName}" | Tipp: "${m.outcomeName}" | Odds: ${m.odds.toFixed(2)}`)
            .join('\n');
          return `[${idx + 1}] Sportág: ${ev.sportName} | Sorozat: ${ev.competitionGroupName} - ${ev.competitionName}\n    Mérkőzés: ${ev.eventName} (Kezdés: ${ev.eventDate})\n    Elérhető ${minOdds.toFixed(2)} - ${maxOdds.toFixed(2)} közötti opciók (${ev.availableTargetMarkets.length} db):\n${marketsStr}`;
        }).join('\n\n');
    }

    const riskFilterInstruction = getRiskFilterPromptBlock(riskFilter, minOdds, maxOdds);

    const prompt = `Te egy profi sportfogadási és statisztikai elemző vagy (kiemelt szakterületeid: Labdarúgás, Tenisz, Amerikai futball / NFL).
A felhasználó a következő ${hours} órában keresi a **legfeljebb ${tipsCount} LEGVALÓSZÍNŰBB fogadási tippet**, amelyek szorzója **SZIGORÚAN ${minOdds.toFixed(2)} és ${maxOdds.toFixed(2)} közé esik**.
Kiválasztott sportág: ${selectedSportMeta ? selectedSportMeta.name : 'Foci, Tenisz vagy NFL'}.
${riskFilterInstruction}

KÜLÖNLEGES SZAKMAI KÖVETELMÉNYEK:
1. **SZIGORÚAN VALÓDI MÉRKŐZÉSEK ÉS PIACOK**:
   - KIZÁRÓLAG a fenti "KÖVETKEZŐ ${hours} ÓRÁBAN ELÉRHETŐ TIPPMIXPRO MÉRKŐZÉSEK" listában szereplő mérkőzésekből és opciókból választhatsz tippet! Szigorúan tilos kitalálni bármilyen más meccset vagy oddsot!
2. **KEVÉS MÉRKŐZÉS VAGY KEVÉS OPCIÓ KEZELÉSE**:
   - Ha a következő ${hours} órában kevés mérkőzés érhető el (pl. csak 1-2 meccs), akkor a megadott valós mérkőzések KÜLÖNBÖZŐ PIACAI közül válassz (pl. 1X2 kimenetel, gólszám, lapok, szöglet, büntető, gólszerző, hendikep).
   - Amennyiben nincs elegendő kimagasló fogadási érték a kínálatban, adj vissza KEVESEBB (akár csak 1 vagy 2) prémium tippet a kért ${tipsCount} helyett, de SOHA NE találj ki fantom mérkőzést!
3. **PIACI SOKSZÍNŰSÉG**: A kínálatban mindenféle piac elérhető (1X2, Gólszám/Pontszám, Mindkét csapat szerez gólt, Gólszerző/Touchdown, Kiállítás, 11-es/Büntető, Szögletek, Lapok, Hendikep, Félidők). A fenti valós listában szereplő opciókból válogass!
4. **SÉRÜLTEK, ELTILTOTTAK ÉS KULCSJÁTÉKOSOK POSZT SZERINTI SÚLYOZÁSA (KIEMELTEN FONTOS!)**:
   - Minden mérkőzésnél vizsgáld meg a lenti **HIVATALOS ESPN SÉRÜLTJELENTÉS**, a **TIPPMIXPRO AKTÍV JÁTÉKOS PIACOK** és a **FRISS NEMZETKÖZI SZAKCIKKEK** alapján a **biztosan hiányzó (Injured Reserve / Out / eltiltott) vagy kérdéses (Questionable) kulcsjátékosokat**:
   - **Gólerős támadó / Házi gólkirály / Kezdő QB / Irányító hiánya:** Ha egy csapat kezdő irányítója (QB, pl. Injured Reserve státuszban), legtöbb gólt szerző csatára vagy legmagasabb osztályzatú támadója nem lép pályára, SZIGORÚAN TILOS rá játékos-tippet adni, és csökkentsd a csapat pont-/gólvárakozását (kerüld a csapat merész Over vagy sima győzelem tippjét, helyette előnyben részesítendő a Kétesély, DNB, Under, a csereirányító/futójáték sajátosságai vagy az ellenfél hendikepje).
   - **Magas átlagosztályzatú vezérvédő vagy 1. számú kapus hiánya:** Ha a védelem legstabilabb belső védője/safety-je vagy a kezdőkapus hiányzik, jelentősen nő a kapott gól/pont esélye — ilyenkor felértékelődik a **Mindkét csapat szerez gólt (BTTS - Igen)**, a **Gólszám 2,5 felett**, vagy az ellenfél gólszerzési piaca!
   - **SZIGORÚ HALLUCINÁCIÓ-TILALOM A SÉRÜLTEKNÉL:** SOHA ne írj általános töltelékszöveget (pl. TILOS olyat írni, hogy "Nincsenek váratlan kulcs-sérülések" vagy "a megszokott kezdőcsapat lép pályára")! A "detailedReasoning.injuriesAndLineup" mezőben KIZÁRÓLAG konkrét, névvel és poszttal megnevezett sérült/hiányzó játékosokat (pl. "Lamar Jackson (QB - Injured Reserve), Jaylinn Hawkins (S - Out)...") és azok hatását írd le! Ha nincs konkrétan ismert sérült kulcsjátékos a megadott adatokban, a "detailedReasoning.injuriesAndLineup" mező KÖTELEZŐEN üres string "" legyen!
5. **RELEVANCIA-SZABÁLY**: Nem kell feleslegesen kiemelni a bírót, a lapokat vagy a szögleteket, KIVÉVE, HA AZ VALÓBAN RELEVÁNS a választott tipp szempontjából (pl. bíró szigora lapos/11-es/kiállítás tippnél, szögletstatisztika sarokrúgás tippnél)! Csak releváns tényezőket említs!
6. Legfeljebb ${tipsCount} prémium tippet adj vissza a fentiek szerint, szakmai indoklással és kockázati besorolással!

${matchesContextBlock}

VALÓS IDEJŰ INTERNETES ELEMZŐ ÉS STATISZTIKAI TALÁLATOK (FORMA, SÉRÜLTEK, KEZDŐK, KULCSJÁTÉKOSOK):
${webResearch.researchText}

VÁLASZ FORMÁTUMA:
Kizárólag egy érvényes JSON objektummal válaszolj az alábbi formában:
{
  "analysisOverview": "Rövid összefoglaló a mérkőzésekről (${minOdds.toFixed(2)} - ${maxOdds.toFixed(2)} odds sávban).",
  "tips": [
    {
      "rank": 1,
      "sportName": "Labdarúgás | Tenisz | Amerikai futball",
      "competitionName": "Bajnokság pontos neve",
      "eventName": "Mérkőzés pontos neve",
      "eventDate": "Kezdési időpont ISO formátumban",
      "marketName": "Piac pontos neve (pl. Gólszám 2,5 / 1X2 / Szögletszám / Büntetőlapok)",
      "outcomeName": "Kimenetel neve",
      "odds": 1.65,
      "estimatedProbability": 75,
      "shortSummary": "1-2 mondatos lényegretörő összegzés.",
      "detailedReasoning": {
        "mainThesis": "Részletes, lényegretörő szakmai indoklás a tipp valószínűsége mellett. Csak a tipp szempontjából releváns tényezőket fejtsd ki!",
        "injuriesAndLineup": "Ha van fontos sérült/eltiltott kulcsjátékos (pl. házi gólkirály vagy magas osztályzatú vezérvédő/kapus) és annak hatása a tippre, írd le itt; ha nincs releváns hiányzó, legyen üres string \"\".",
        "keyFactors": ["1. releváns érv", "2. releváns érv", "3. releváns érv"]
      },
      "riskAssessment": {
        "level": "Alacsony | Alacsony-Közepes | Közepes | Magas",
        "score": 3,
        "explanation": "Részletes kockázati elemzés (1-10 skálán)."
      }
    }
  ]
}`;

    const aiResult = await callGeminiWithSearch({
      apiKey,
      prompt,
      precollectedSources: webResearch.webSources
    });

    if (Array.isArray(aiResult.data?.tips)) {
      enforceTipRiskFilter(aiResult.data.tips, riskFilter);
    }

    const returnedTips = Array.isArray(aiResult.data?.tips) ? aiResult.data.tips : [];
    let fewerTipsReason = null;
    if (returnedTips.length > 0 && returnedTips.length < tipsCount) {
      fewerTipsReason = `A kért ${tipsCount} tipp helyett ${returnedTips.length} tipp jelenik meg, mert a megadott feltételeknek (Következő ${hours} óra • ${minOdds.toFixed(2)}–${maxOdds.toFixed(2)} odds${riskFilter !== 'all' ? ` • ${riskConflictCheck.currentRiskLabel}` : ''} • ${windowEvents.length} elérhető mérkőzés) összesen ez a(z) ${returnedTips.length} opció felelt meg.`;
    }

    const responsePayload = {
      ok: true,
      mode: 'interval',
      hours,
      sportId,
      minOdds,
      maxOdds,
      tipsCount,
      riskFilter,
      fewerTipsReason,
      riskOddsConflict: returnedTips.length === 0 && riskFilter !== 'all' ? {
        ...riskConflictCheck,
        hasConflict: true,
        conflictMessage: `A megadott ${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)} szorzósávban és a kiválasztott ${riskConflictCheck.currentRiskLabel} szűrővel jelenleg nem található megfelelő tipp a következő ${hours} órában.`
      } : null,
      sportName: selectedSportMeta ? selectedSportMeta.name : 'NFL, Foci, Tenisz',
      result: aiResult.data,
      fromCache: false
    };

    // Automatikus tipp-mentés (újraelemzéskor lecseréli a korábbi függő tippeket az új elemzésre)
    if (Array.isArray(aiResult.data?.tips)) {
      recordTipsBatch(aiResult.data.tips, 'homepage_interval', {
        replaceInterval: Boolean(forceRefresh),
        sportId
      });
    }

    if (Array.isArray(aiResult.data?.tips) && aiResult.data.tips.length > 0) {
      aiAnalysisCache.set(fingerprint, {
        timestamp: Date.now(),
        payload: responsePayload
      });
    }

    res.json(responsePayload);
  } catch (err) {
    console.error('Interval elemzési hiba:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 7.6 RÉSZLETES MÉRKŐZÉS ELEMZÉS (TOP 3 TIPP + JÁTÉKVEZETŐ + SÁRGA LAPOK & SZÖGLETEK)
app.post('/api/analyze/custom', async (req, res) => {
  try {
    const query = (req.body.query || '').toString().trim();
    const eventId = req.body.eventId ? Number(req.body.eventId) : null;
    const rawMinOdds = Math.max(1.01, Math.min(20.0, Number(req.body.minOdds) || 1.30));
    const rawMaxOdds = Math.max(1.05, Math.min(50.0, Number(req.body.maxOdds) || 2.00));
    const minOdds = Math.min(rawMinOdds, rawMaxOdds);
    const maxOdds = Math.max(rawMinOdds, rawMaxOdds);
    const tipsCount = Math.min(10, Math.max(1, Number(req.body.tipsCount) || 3));
    const riskFilter = ['low', 'medium', 'high'].includes(req.body.riskFilter) ? req.body.riskFilter : 'all';
    const forceRefresh = Boolean(req.body.forceRefresh);
    const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;

    if (!query && !eventId) {
      return res.status(400).json({
        ok: false,
        error: 'Kérlek válassz ki vagy írj be egy mérkőzést!'
      });
    }

    const catalog = await fetchTippmixCatalog(forceRefresh);
    let matchedEvents = [];

    if (eventId) {
      let found = catalog.events.find(e => Number(e.eventId) === eventId);
      if (!found) {
        const detailed = await fetchEventDetails(eventId, forceRefresh);
        if (detailed) found = detailed;
      }
      if (found) matchedEvents = [found];
    }

    if (matchedEvents.length === 0 && query) {
      const qLower = query.toLowerCase();
      const terms = qLower.split(/[\s,-]+/).filter(t => t.length >= 2);

      const scored = catalog.events
        .map(ev => {
          const haystack = `${ev.eventName} ${ev.competitionName} ${ev.competitionGroupName} ${ev.sportName}`.toLowerCase();
          let score = 0;
          if (haystack.includes(qLower)) score += 100;
          for (const term of terms) {
            if (haystack.includes(term)) score += 25;
          }
          return { ev, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);

      matchedEvents = scored.slice(0, 4).map(s => s.ev);
    }

    if (matchedEvents.length === 0) {
      return res.json({
        ok: true,
        mode: 'custom',
        noMatches: true,
        minOdds,
        maxOdds,
        tipsCount,
        noMatchesMessage: `A megadott keresési kifejezésre ("${query}") jelenleg nem található kezdődő mérkőzés a TippmixPro kínálatában. Kérlek ellenőrizd a csapat nevét, vagy válassz a kereső ajánlataiból!`,
        result: {
          analysisOverview: `Nem található aktív TippmixPro mérkőzés erre a keresésre: "${query}".`,
          tips: []
        },
        fromCache: false
      });
    }

    const fingerprint = createAnalysisFingerprint({
      mode: 'custom',
      sportId: 'custom',
      minOdds,
      maxOdds,
      tipsCount,
      riskFilter,
      eventIds: matchedEvents.map(e => e.eventId),
      customQuery: query
    });

    const cachedAnalysis = aiAnalysisCache.get(fingerprint);
    if (!forceRefresh && cachedAnalysis && Date.now() - cachedAnalysis.timestamp < AI_ANALYSIS_CACHE_TTL_MS) {
      const cachedTips = cachedAnalysis.payload?.result?.tips;
      if (Array.isArray(cachedTips) && cachedTips.length > 0) {
        return res.json({
          ...cachedAnalysis.payload,
          fromCache: true
        });
      }
    }

    const enrichedEvents = matchedEvents.length > 0
      ? await enrichCandidateEvents(matchedEvents, minOdds, maxOdds, forceRefresh, 80)
      : [];

    // 1. Ellenőrzés: Már elkezdődött a mérkőzés vagy lezárultak a piacai?
    const nowMs = Date.now();
    const allStarted = matchedEvents.every(ev => ev.eventDate && new Date(ev.eventDate).getTime() <= nowMs - 2 * 60 * 1000);
    const totalAllMarkets = enrichedEvents.reduce((acc, ev) => acc + (ev.allMarketsList?.length || 0), 0);

    if (allStarted || totalAllMarkets === 0) {
      const mName = matchedEvents[0]?.eventName || query;
      const startedMsg = allStarted
        ? `⏱️ A kiválasztott mérkőzés ("${mName}") már elkezdődött (vagy véget ért), ezért a mérkőzés előtti fogadási piacok lezárultak a TippmixPro-n.`
        : `⏱️ A kiválasztott mérkőzéshez ("${mName}") jelenleg nem érhető el nyitott mérkőzés előtti fogadási piac a TippmixPro kínálatában.`;
      return res.json({
        ok: true,
        mode: 'custom',
        noMatches: true,
        reasonCode: 'match_started',
        query,
        minOdds,
        maxOdds,
        tipsCount,
        riskFilter,
        noMatchesMessage: startedMsg,
        result: {
          analysisOverview: startedMsg,
          tips: []
        },
        fromCache: false
      });
    }

    // 2. Ellenőrzés: Kockázati szint és Odds-sáv ellentmondás
    const riskConflictCheck = evaluateRiskAndOddsConflict(riskFilter, minOdds, maxOdds);
    if (riskConflictCheck.hasConflict) {
      return res.json({
        ok: true,
        mode: 'custom',
        noMatches: true,
        reasonCode: 'risk_odds_conflict',
        query,
        minOdds,
        maxOdds,
        tipsCount,
        riskFilter,
        riskOddsConflict: riskConflictCheck,
        noMatchesMessage: riskConflictCheck.conflictMessage,
        result: {
          analysisOverview: riskConflictCheck.conflictMessage,
          tips: []
        },
        fromCache: false
      });
    }

    // 3. Ellenőrzés: Van-e egyáltalán piac a beállított minOdds–maxOdds sávban ezen a meccsen?
    const totalAvailableTargetMarkets = enrichedEvents.reduce((acc, ev) => acc + (ev.availableTargetMarkets?.length || 0), 0);
    if (totalAvailableTargetMarkets === 0) {
      const diag = buildNoMarketsDiagnostics(enrichedEvents, minOdds, maxOdds, riskFilter);
      return res.json({
        ok: true,
        mode: 'custom',
        noMatches: true,
        reasonCode: diag.isTooNarrow ? 'odds_too_narrow' : 'no_markets_in_odds_range',
        query,
        minOdds,
        maxOdds,
        tipsCount,
        riskFilter,
        diagnostics: diag,
        riskOddsConflict: diag.riskConflict,
        noMatchesMessage: diag.detailMsg,
        result: {
          analysisOverview: diag.detailMsg,
          tips: []
        },
        fromCache: false
      });
    }

    console.log(`🌐 [RÉSZLETES ELEMZÉS] Internetes kutatás indítása: "${query}" (Bíró, lapok, 11-es, szögletek, gólszerzők, forma)...`);
    const webResearch = await gatherWebResearchForMatches(enrichedEvents, query);

    let tippmixContextText = '';
    if (enrichedEvents.length > 0) {
      tippmixContextText = `A kiválasztott mérkőzéshez ("${query}") a TippmixPro valós ${minOdds.toFixed(2)} - ${maxOdds.toFixed(2)} közötti teljes piaci kínálata és szorzói:\n\n` +
        enrichedEvents.map((ev, idx) => {
          const marketsStr = ev.availableTargetMarkets
            .map(m => `   - Piac: "${m.marketName}" | Tipp: "${m.outcomeName}" | Odds: ${m.odds.toFixed(2)}`)
            .join('\n');
          return `[${idx + 1}] Sportág: ${ev.sportName} | Bajnokság: ${ev.competitionGroupName} - ${ev.competitionName}\n    Mérkőzés: ${ev.eventName} (Kezdés: ${ev.eventDate})\n    Elérhető ${minOdds.toFixed(2)} - ${maxOdds.toFixed(2)} közötti opciók (${ev.availableTargetMarkets.length} db):\n${marketsStr}`;
        }).join('\n\n');
    }

    const riskFilterInstruction = getRiskFilterPromptBlock(riskFilter, minOdds, maxOdds);

    const prompt = `Te egy kiemelkedő felkészültségű sportfogadási szakértő és statisztikai elemző vagy (Labdarúgás, Tenisz, Amerikai futball / NFL).
A felhasználó az alábbi konkrét mérkőzés mélyreható szakmai elemzését kéri: "${query}".
${riskFilterInstruction}

KÖTELEZŐ ELEMZÉSI SZEMPONTOK (SZAKMAI MÉLYSÉG ÉS PIACI SOKSZÍNŰSÉG):
1. **MINDEN ELÉRHETŐ FOGADÁSI PIAC ÉS LEHETŐSÉG ÁTTEKINTÉSE**:
   - A mérkőzéshez lent megadott TippmixPro kínálat a teljes odds-sávot tartalmazza: 1X2, Kétesély, Gólszám/Pontszám, Mindkét csapat gólt szerez, Góllövő / Gólszerző / Touchdown, Kiállítás / Piros lap, 11-es / Büntető, Szögletek, Lapok, Félidők, Hendikepek stb.!
   - Bátran és nyitottan válassz speciális piacokat is (pl. gólszerző, lapok, szöglet, 11-es/büntető, kiállítás, félidő), amennyiben a statisztikák, a forma vagy a bírói adatok alapján az képviseli a legnagyobb valószínűséget és értéket!
2. **SÉRÜLTEK, ELTILTOTTAK ÉS KULCSJÁTÉKOSOK POSZT SZERINTI SÚLYOZÁSA (KIEMELTEN FONTOS!)**:
   - Vizsgáld meg a lenti **HIVATALOS ESPN SÉRÜLTJELENTÉS**, a **TIPPMIXPRO AKTÍV JÁTÉKOS PIACOK** és a **FRISS NEMZETKÖZI SZAKCIKKEK** alapján a **biztosan hiányzó (Injured Reserve / Out / eltiltott) vagy kérdéses (Questionable) kulcsjátékosokat** és várható kezdőcsapatokat:
   - **Gólerős támadó / Házi gólkirály / Kezdő QB / Irányító hiánya:** Ha egy csapat kezdő irányítója (QB, pl. Injured Reserve státuszban), legtöbb gólt szerző csatára vagy legmagasabb osztályzatú támadója nem lép pályára, SZIGORÚAN TILOS rá játékos-tippet adni, és csökkentsd a csapat pont-/gólvárakozását (kerüld a csapat merész Over vagy sima győzelem tippjét, helyette előnyben részesítendő a Kétesély, DNB, Under, a csereirányító/futójáték sajátosságai vagy az ellenfél hendikepje).
   - **Magas átlagosztályzatú vezérvédő vagy 1. számú kapus hiánya:** Ha a védelem legstabilabb belső védője/safety-je vagy a kezdőkapus hiányzik, jelentősen nő a kapott gól/pont esélye — ilyenkor felértékelődik a **Mindkét csapat szerez gólt (BTTS - Igen)**, a **Gólszám 2,5 felett**, vagy az ellenfél gólszerzési piaca!
   - **SZIGORÚ HALLUCINÁCIÓ-TILALOM A SÉRÜLTEKNÉL:** SOHA ne írj általános töltelékszöveget (pl. TILOS olyat írni, hogy "Nincsenek váratlan kulcs-sérülések" vagy "a megszokott kezdőcsapat lép pályára")! A "detailedReasoning.injuriesAndLineup" mezőben KIZÁRÓLAG konkrét, névvel és poszttal megnevezett sérült/hiányzó játékosokat (pl. "Lamar Jackson (QB - Injured Reserve), Jaylinn Hawkins (S - Out)...") és azok hatását írd le! Ha nincs konkrétan ismert sérült kulcsjátékos a megadott adatokban, a "detailedReasoning.injuriesAndLineup" mező KÖTELEZŐEN üres string "" legyen!
3. **RELEVANCIA-SZABÁLY**:
   - Nem kell külön kiemelni a játékvezetőt, sem a szögleteket vagy lapokat, KIVÉVE, HA AZ VALÓBAN RELEVÁNS a választott tipp szempontjából (pl. ha lap/szöglet/11-es/kiállítás piacon van a tipp, vagy a bíró személye közvetlenül befolyásolja az adott piacot)!
   - Minden információt CSAK AKKOR adj a részletes leírásba, ha azok közvetlenül relevánsak a tippek szempontjából.
4. **TOP 3 LEGVALÓSZÍNŰBB TIPP (KÜLÖNBÖZŐ PIACI TÍPUSOKBÓL)**:
   - Válassz ki pontosan **3 darab különböző piacú és jellegű tippet** a mérkőzésre, amelyek szorzója **SZIGORÚAN ${minOdds.toFixed(2)} és ${maxOdds.toFixed(2)} közé esik**!
   - Ha a fenti TippmixPro adatokban szerepelnek opciók, KÖTELEZŐEN az ott lévő valós piacneveket és oddsokat válaszd ki!
5. **KOCKÁZATI ÉRTÉKELÉS (1-10)**:
   - Részletesen indokold meg a kockázat mértékét és a váratlan forgatókönyveket (beleértve a kulcshiányzók hatását is)!

TIPPMIXPRO ADATOK:
${tippmixContextText}

INTERNETES ELEMZŐ ÉS STATISZTIKAI TALÁLATOK (15–18 SZAKOLDAL – FORMA, SÉRÜLTEK, KEZDŐK, KULCSJÁTÉKOSOK):
${webResearch.researchText}

VÁLASZ FORMÁTUMA (Kizárólag érvényes JSON, magyarul):
{
  "analysisOverview": "2-3 mondatos professzionális összegzés a mérkőzésről.",
  "tips": [
    {
      "rank": 1,
      "sportName": "Labdarúgás | Tenisz | Amerikai futball",
      "competitionName": "Bajnokság pontos neve",
      "eventName": "Mérkőzés pontos neve",
      "eventDate": "Kezdési időpont",
      "marketName": "A kiválasztott piac pontos neve",
      "outcomeName": "A kiválasztott kimenetel pontos neve",
      "odds": 1.62,
      "estimatedProbability": 76,
      "shortSummary": "1-2 mondatos összegzés a kártyához.",
      "detailedReasoning": {
        "mainThesis": "Részletes fő indoklás: miért ez a legvalószínűbb tipp a mérkőzésre (kizárólag a tipp szempontjából releváns tényezőkkel!).",
        "injuriesAndLineup": "Ha van fontos sérült/eltiltott kulcsjátékos (pl. házi gólkirály vagy magas osztályzatú vezérvédő/kapus) és annak hatása a tippre, írd le itt; ha nincs releváns hiányzó, legyen üres string \"\".",
        "keyFactors": ["1. releváns kulcsérv", "2. releváns kulcsérv", "3. releváns kulcsérv"]
      },
      "riskAssessment": {
        "level": "Alacsony | Alacsony-Közepes | Közepes | Magas",
        "score": 3,
        "explanation": "Kockázati elemzés (1-10 skálán) és mi boríthatja a papírformát."
      }
    }
  ]
}`;

    const aiResult = await callGeminiWithSearch({
      apiKey,
      prompt,
      precollectedSources: webResearch.webSources
    });

    if (Array.isArray(aiResult.data?.tips)) {
      enforceTipRiskFilter(aiResult.data.tips, riskFilter);
    }

    const returnedTips = Array.isArray(aiResult.data?.tips) ? aiResult.data.tips : [];
    let fewerTipsReason = null;
    if (returnedTips.length > 0 && returnedTips.length < tipsCount) {
      fewerTipsReason = `A kért ${tipsCount} tipp helyett ${returnedTips.length} tipp jelenik meg, mert ezen a mérkőzésen a beállított feltételeknek (${minOdds.toFixed(2)}–${maxOdds.toFixed(2)} odds${riskFilter !== 'all' ? ` • ${riskConflictCheck.currentRiskLabel}` : ''} • ${totalAvailableTargetMarkets} elérhető piaci opció) csak ez a(z) ${returnedTips.length} különböző kimenetel felelt meg.`;
    }

    const responsePayload = {
      ok: true,
      mode: 'custom',
      query,
      minOdds,
      maxOdds,
      tipsCount,
      riskFilter,
      fewerTipsReason,
      riskOddsConflict: returnedTips.length === 0 && riskFilter !== 'all' ? {
        ...riskConflictCheck,
        hasConflict: true,
        conflictMessage: `Ezen a mérkőzésen a beállított ${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)} szorzósávban és a kiválasztott ${riskConflictCheck.currentRiskLabel} szűrővel nem található megfelelő tipp.`
      } : null,
      matchedTippmixEventsCount: enrichedEvents.length,
      modelUsed: aiResult.modelUsed,
      result: aiResult.data,
      fromCache: false
    };

    // Automatikus tipp-mentés (egyedi meccs újraelemzésekor lecseréli a meccs korábbi függő tippjeit kizárólag az új elemzésre)
    if (Array.isArray(aiResult.data?.tips)) {
      if (matchedEvents.length === 1 && matchedEvents[0]?.eventName) {
        const officialEvent = matchedEvents[0];
        for (const t of aiResult.data.tips) {
          if (t) {
            t.eventName = officialEvent.eventName;
            if (!t.eventDate && officialEvent.eventDate) t.eventDate = officialEvent.eventDate;
            if (!t.eventId && officialEvent.eventId) t.eventId = officialEvent.eventId;
          }
        }
      }
      recordTipsBatch(aiResult.data.tips, 'homepage_custom', {
        targetEventNames: [query, ...matchedEvents.map(e => e.eventName)].filter(Boolean)
      });
    }

    if (Array.isArray(aiResult.data?.tips) && aiResult.data.tips.length > 0) {
      aiAnalysisCache.set(fingerprint, {
        timestamp: Date.now(),
        payload: responsePayload
      });
    }

    res.json(responsePayload);
  } catch (err) {
    console.error('Részletes meccs elemzési hiba:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SmartTippmixPro AI Szerver fut: http://0.0.0.0:${PORT}`);
  console.log(`⚽ Fókusz sportágak: Labdarúgás, Tenisz, NFL`);

  // Tracker inicializálás és háttérellenőrzés indítása
  initTracker().catch(err => console.warn('⚠️ initTracker hiba:', err.message));
  setInterval(() => {
    evaluatePendingTips(fetchEventDetails, callGeminiWithSearch).catch(() => {});
  }, 10 * 60 * 1000);

  // Óránkénti intelligens katalógus frissítés (hogy a gördülő 24 órás ablak mindig friss legyen)
  setInterval(() => {
    fetchTippmixCatalog(true).catch(err => console.warn('⚠️ Óránkénti katalógus frissítési hiba:', err.message));
  }, 60 * 60 * 1000);
});
