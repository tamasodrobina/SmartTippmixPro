import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATS_FILE = path.join(__dirname, 'data', 'betting_stats.json');
const GITHUB_REPO = process.env.GITHUB_REPO || 'tamasodrobina/SmartTippmixPro';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;

let isEvaluating = false;
let gitSyncTimeout = null;

function createSportStats() {
  return {
    totalChecked: 0,
    won: 0,
    lost: 0,
    winRate: 0,
    byRisk: {
      low: { totalChecked: 0, won: 0, lost: 0, winRate: 0 },
      medium: { totalChecked: 0, won: 0, lost: 0, winRate: 0 },
      high: { totalChecked: 0, won: 0, lost: 0, winRate: 0 }
    }
  };
}

// Kezdő állapot (Foci, Tenisz, NFL)
let state = {
  updatedAt: new Date().toISOString(),
  resetAt: null,
  stats: {
    football: createSportStats(),
    tennis: createSportStats(),
    nfl: createSportStats()
  },
  pendingTips: [],
  history: [],
  seenTipIds: []
};

// 1. Állapot betöltése
export async function initTracker() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const raw = fs.readFileSync(STATS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      state = {
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        resetAt: parsed.resetAt || null,
        stats: {
          football: mergeSportStats(parsed.stats?.football),
          tennis: mergeSportStats(parsed.stats?.tennis),
          nfl: mergeSportStats(parsed.stats?.nfl)
        },
        pendingTips: Array.isArray(parsed.pendingTips) ? parsed.pendingTips : [],
        history: Array.isArray(parsed.history) ? parsed.history : [],
        seenTipIds: Array.isArray(parsed.seenTipIds) ? parsed.seenTipIds : []
      };
      console.log(`📊 Tracker betöltve: Foci ${state.stats.football.winRate}%, Tenisz ${state.stats.tennis.winRate}%, NFL ${state.stats.nfl.winRate}%, Függőben: ${state.pendingTips.length}, Előzmények: ${state.history.length}`);
    }
  } catch (err) {
    console.warn('⚠️ Hiba a helyi statisztika betöltésekor:', err.message);
  }

  // Mindig megpróbáljuk betölteni GitHubról (akár van token, akár nincs)
  await pullFromGitHub();
}

function mergeSportStats(existing) {
  const base = createSportStats();
  if (!existing) return base;
  return {
    totalChecked: existing.totalChecked || 0,
    won: existing.won || 0,
    lost: existing.lost || 0,
    winRate: existing.winRate || 0,
    byRisk: {
      low: { ...(base.byRisk.low), ...(existing.byRisk?.low || {}) },
      medium: { ...(base.byRisk.medium), ...(existing.byRisk?.medium || {}) },
      high: { ...(base.byRisk.high), ...(existing.byRisk?.high || {}) }
    }
  };
}

// 2. Mentés helyi fájlba & szinkronizáció GitHubra
export function saveState() {
  try {
    state.updatedAt = new Date().toISOString();
    const dataDir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(STATS_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Hiba a statisztika mentésekor:', err.message);
  }

  if (GITHUB_TOKEN) {
    if (gitSyncTimeout) clearTimeout(gitSyncTimeout);
    gitSyncTimeout = setTimeout(() => {
      pushToGitHub().catch(e => console.warn('⚠️ GitHub sync sikertelen:', e.message));
    }, 5000);
  }
}

// 3. Egyedi azonosító a duplikációk 100%-os kiszűrésére
export function generateTipId(sportId, eventName, eventDate, marketName, outcomeName) {
  const norm = str => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const dateKey = String(eventDate || '').slice(0, 10);
  return `${sportId}_${norm(eventName)}_${dateKey}_${norm(marketName)}_${norm(outcomeName)}`;
}

// Megállapítja a sportág azonosítót (1 = Foci, 5 = Tenisz, 16 = NFL)
export function normalizeSportId(sportInput) {
  if (!sportInput) return null;
  const s = String(sportInput).toLowerCase();
  if (s === '1' || s.includes('foci') || s.includes('labdarúg') || s.includes('football') || s.includes('soccer')) return 1;
  if (s === '5' || s.includes('tenisz') || s.includes('tennis') || s.includes('atp') || s.includes('wta') || s.includes('challenger')) return 5;
  if (s === '16' || s.includes('nfl') || s.includes('amerikai futball') || s.includes('amerikai foci')) return 16;
  return null;
}

// Megállapítja a kockázati kategóriát: low (1-3), medium (4-6), high (7-10)
export function determineRiskCategory(tip) {
  const risk = tip.riskAssessment || {};

  // 1. Ha van numerikus pontszám (Gemini AI elemzés: 1-10)
  const score = Number(risk.score || tip.riskScore || 0);
  if (score > 0) {
    if (score <= 3) return { category: 'low', label: 'Alacsony', score };
    if (score <= 6) return { category: 'medium', label: 'Közepes', score };
    return { category: 'high', label: 'Magas', score };
  }

  // 2. Ha szöveges szint van megadva
  const level = String(risk.level || tip.riskLevel || '').toLowerCase();
  if (level.includes('alacsony') && !level.includes('közepes')) {
    return { category: 'low', label: 'Alacsony', score: 2 };
  }
  if (level.includes('magas')) {
    return { category: 'high', label: 'Magas', score: 8 };
  }
  if (level.includes('közepes')) {
    return { category: 'medium', label: 'Közepes', score: 5 };
  }

  // 3. Fallback: odds alapján (pl. ligatáblázat automatikus Top 2 tippjeinél)
  const odds = Number(tip.odds) || 1.6;
  if (odds <= 1.45) return { category: 'low', label: 'Alacsony', score: 2 };
  if (odds <= 1.75) return { category: 'medium', label: 'Közepes', score: 4 };
  return { category: 'high', label: 'Magas', score: 7 };
}

// 4. Új tipp felvétele a várólistába (duplikáció szűréssel)
export function recordTip(tip, source = 'manual') {
  if (!tip) return false;

  const sportId = normalizeSportId(tip.sportId || tip.sportName);
  if (!sportId) return false; // Kizárólag Foci (1), Tenisz (5), NFL (16) kerül tárolásra!

  const eventName = tip.eventName || tip.matchName || '';
  const eventDate = tip.eventDate || '';
  const marketName = tip.marketName || tip.market || '';
  const outcomeName = tip.outcomeName || tip.outcome || '';
  const odds = Number(tip.odds) || 0;

  if (!eventName || !marketName || !outcomeName) return false;

  const tipId = generateTipId(sportId, eventName, eventDate, marketName, outcomeName);

  // DUPLIKÁCIÓ SZŰRÉS: Ha már szerepel a várólistában vagy korábban már ellenőriztük, ignoráljuk!
  if (state.seenTipIds.includes(tipId)) return false;
  if (state.pendingTips.some(t => t.id === tipId)) return false;

  state.seenTipIds.push(tipId);
  if (state.seenTipIds.length > 3000) {
    state.seenTipIds = state.seenTipIds.slice(-3000);
  }

  const riskInfo = determineRiskCategory(tip);

  let sportDisplayName = 'Labdarúgás (Foci)';
  if (sportId === 5) sportDisplayName = 'Tenisz';
  if (sportId === 16) sportDisplayName = 'Amerikai futball (NFL)';

  state.pendingTips.push({
    id: tipId,
    sportId,
    sportName: sportDisplayName,
    eventId: tip.eventId || null,
    eventName,
    competitionName: tip.competitionName || '',
    eventDate,
    marketName,
    outcomeName,
    odds,
    riskCategory: riskInfo.category, // 'low' | 'medium' | 'high'
    riskScore: riskInfo.score,
    riskLevel: riskInfo.label,
    source,
    addedAt: new Date().toISOString(),
    status: 'pending'
  });

  saveState();
  return true;
}

// Kötegelt tipp felvétel
export function recordTipsBatch(tipsList = [], source = 'batch') {
  if (!Array.isArray(tipsList) || tipsList.length === 0) return 0;
  let addedCount = 0;
  for (const tip of tipsList) {
    if (recordTip(tip, source)) {
      addedCount++;
    }
  }
  return addedCount;
}

// 5. Statisztika lekérdezése
export function getStats() {
  const pendingBySport = {
    football: state.pendingTips.filter(t => t.sportId === 1).length,
    tennis: state.pendingTips.filter(t => t.sportId === 5).length,
    nfl: state.pendingTips.filter(t => t.sportId === 16).length
  };

  // Dinamikusan hozzárendeljük az egyes sportágakhoz a függőben lévő tippjeik számát
  const statsWithPending = {
    football: {
      ...state.stats.football,
      pendingCount: pendingBySport.football
    },
    tennis: {
      ...state.stats.tennis,
      pendingCount: pendingBySport.tennis
    },
    nfl: {
      ...state.stats.nfl,
      pendingCount: pendingBySport.nfl
    }
  };

  return {
    ok: true,
    updatedAt: state.updatedAt,
    resetAt: state.resetAt || null,
    stats: statsWithPending,
    pendingCount: state.pendingTips.length,
    pendingBySport,
    pendingTipsSummary: state.pendingTips.slice(0, 100).map(t => ({
      id: t.id,
      sportId: t.sportId,
      sportName: t.sportName,
      eventName: t.eventName,
      eventDate: t.eventDate,
      competitionName: t.competitionName || '',
      marketName: t.marketName,
      outcomeName: t.outcomeName,
      odds: t.odds,
      riskLevel: t.riskLevel,
      riskCategory: t.riskCategory,
      riskScore: t.riskScore,
      source: t.source,
      status: 'pending'
    })),
    historyCount: (state.history || []).length,
    history: (state.history || []).slice(0, 200)
  };
}

// Lekérdezi az előzményeket (szűrhető: sportId, riskCategory, status)
export function getHistory(filters = {}) {
  let list = Array.isArray(state.history) ? [...state.history] : [];
  if (filters.sportId && filters.sportId !== 'all') {
    const sId = Number(filters.sportId);
    list = list.filter(t => {
      const tipSportId = Number(t.sportId || (t.sportName?.includes('Tenisz') ? 5 : (t.sportName?.includes('futball') || t.sportName?.includes('NFL') ? 16 : 1)));
      return tipSportId === sId;
    });
  }
  if (filters.riskCategory && filters.riskCategory !== 'all') {
    list = list.filter(t => t.riskCategory === filters.riskCategory);
  }
  if (filters.status && filters.status !== 'all') {
    list = list.filter(t => t.status === filters.status);
  }
  return list;
}

// Manuális vagy kliens oldali kiértékelt tipp rögzítése
export function recordEvaluatedTip(item) {
  if (!item || !item.eventName || !item.marketName || !item.outcomeName) return null;
  const sportId = normalizeSportId(item.sportId || item.sportName) || 1;
  const tipId = item.id || generateTipId(sportId, item.eventName, item.eventDate, item.marketName, item.outcomeName);
  const riskInfo = determineRiskCategory(item);

  if (!Array.isArray(state.history)) state.history = [];
  const existingIndex = state.history.findIndex(h => h.id === tipId);

  const historyItem = {
    id: tipId,
    sportId,
    sportName: item.sportName || (sportId === 5 ? 'Tenisz' : (sportId === 16 ? 'Amerikai futball (NFL)' : 'Labdarúgás (Foci)')),
    eventName: item.eventName,
    eventDate: item.eventDate || new Date().toISOString(),
    competitionName: item.competitionName || '',
    marketName: item.marketName,
    outcomeName: item.outcomeName,
    odds: Number(item.odds) || 1.5,
    riskCategory: riskInfo.category,
    riskScore: riskInfo.score,
    riskLevel: riskInfo.level,
    won: Boolean(item.won),
    finalScore: item.finalScore || null,
    verificationMethod: item.verificationMethod || 'manual_sync',
    evaluatedAt: item.evaluatedAt || new Date().toISOString(),
    status: item.won ? 'won' : 'lost'
  };

  if (existingIndex >= 0) {
    state.history[existingIndex] = historyItem;
  } else {
    state.history.unshift(historyItem);
  }

  // Eltávolítjuk a függők közül
  state.pendingTips = state.pendingTips.filter(t => t.id !== tipId);
  if (!state.seenTipIds.includes(tipId)) state.seenTipIds.push(tipId);

  saveState();
  return historyItem;
}

// Teljes nullázás (Reset)
export function resetTracker() {
  const nowIso = new Date().toISOString();
  state = {
    updatedAt: nowIso,
    resetAt: nowIso,
    stats: {
      football: createSportStats(),
      tennis: createSportStats(),
      nfl: createSportStats()
    },
    pendingTips: [],
    history: [],
    seenTipIds: []
  };
  saveState();
  console.log('🔄 [TRACKER RESET] Minden statisztika, függő tipp és előzmény sikeresen nullázva!');
  return state;
}

// 6. Eredmény-ellenőrző háttérmotor (Hivatalos Tippmix API + Kötegelt Gemini Fallback)
const TIPPMIX_RESULTS_URL = 'https://api.tippmix.hu/v2/tippmix/results';
const resultsCache = new Map(); // key: `${sportId}_${date}`, val: { data, ts }

export async function fetchTippmixOfficialResults(sportId = 1, dateStr) {
  const dateKey = String(dateStr || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const cacheKey = `${sportId}_${dateKey}`;
  const now = Date.now();

  if (resultsCache.has(cacheKey)) {
    const cached = resultsCache.get(cacheKey);
    if (now - cached.ts < 5 * 60 * 1000) {
      return cached.data;
    }
  }

  try {
    const res = await fetch(TIPPMIX_RESULTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://www.tippmix.hu',
        'Referer': 'https://www.tippmix.hu/eredmenyek',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        sportId: Number(sportId) || 1,
        pageSize: 100,
        page: 1,
        date: dateKey
      })
    });

    if (!res.ok) {
      return [];
    }

    const json = await res.json();
    const events = Array.isArray(json?.events) ? json.events : [];
    resultsCache.set(cacheKey, { data: events, ts: now });
    return events;
  } catch (err) {
    console.warn(`⚠️ Tippmix results lekérési hiba (${sportId}, ${dateKey}):`, err.message);
    return [];
  }
}

function applyEvaluationResult(tip, verificationResult) {
  let targetStats = state.stats.football;
  if (tip.sportId === 5) targetStats = state.stats.tennis;
  if (tip.sportId === 16) targetStats = state.stats.nfl;

  const isVoid = Boolean(verificationResult.isVoid);
  const isWon = Boolean(verificationResult.won);

  if (isVoid) {
    console.log(`🔄 TIPP TÉT VISSZAJÁR: [${tip.sportName}] ${tip.eventName} -> ${tip.marketName}: ${tip.outcomeName} (${verificationResult.method || 'tippmix_official'})`);
  } else {
    targetStats.totalChecked++;
    if (isWon) {
      targetStats.won++;
    } else {
      targetStats.lost++;
    }
    targetStats.winRate = Math.round((targetStats.won / targetStats.totalChecked) * 100);

    // Kockázati kategória (low, medium, high) frissítése
    const riskCat = tip.riskCategory || 'medium';
    if (!targetStats.byRisk) {
      targetStats.byRisk = createSportStats().byRisk;
    }
    const subStats = targetStats.byRisk[riskCat] || targetStats.byRisk.medium;
    subStats.totalChecked++;
    if (isWon) {
      subStats.won++;
    } else {
      subStats.lost++;
    }
    subStats.winRate = Math.round((subStats.won / subStats.totalChecked) * 100);

    console.log(`✅ TIPP KIÉRTÉKELVE: [${tip.sportName} - ${tip.riskLevel || riskCat}] ${tip.eventName} -> ${tip.marketName}: ${tip.outcomeName} | Eredmény: ${isWon ? 'NYERT 🟢' : 'VESZTETT 🔴'} (${verificationResult.method || 'tippmix_official'})`);
  }

  const historyItem = {
    id: tip.id,
    sportId: tip.sportId,
    sportName: tip.sportName,
    eventName: tip.eventName,
    eventDate: tip.eventDate,
    competitionName: tip.competitionName || '',
    marketName: tip.marketName,
    outcomeName: tip.outcomeName,
    odds: tip.odds,
    riskCategory: tip.riskCategory || 'medium',
    riskScore: tip.riskScore || (tip.riskCategory === 'low' ? 3 : (tip.riskCategory === 'high' ? 8 : 5)),
    riskLevel: tip.riskLevel || (tip.riskCategory === 'low' ? 'Alacsony' : (tip.riskCategory === 'high' ? 'Magas' : 'Közepes')),
    won: isWon,
    finalScore: verificationResult.score || null,
    verificationMethod: verificationResult.method || 'tippmix_official',
    evaluatedAt: new Date().toISOString(),
    status: isVoid ? 'void' : (isWon ? 'won' : 'lost')
  };

  if (!Array.isArray(state.history)) state.history = [];
  const existingHistIdx = state.history.findIndex(h => h.id === historyItem.id);
  if (existingHistIdx >= 0) {
    state.history[existingHistIdx] = historyItem;
  } else {
    state.history.unshift(historyItem);
    if (state.history.length > 500) {
      state.history = state.history.slice(0, 500);
    }
  }
}

export async function evaluatePendingTips(fetchEventDetailsFn, callGeminiFn) {
  if (isEvaluating) return;
  if (!Array.isArray(state.pendingTips) || state.pendingTips.length === 0) return;

  isEvaluating = true;
  const now = Date.now();
  let statsChanged = false;

  try {
    // 1. Megkeressük azokat a tippeket, amelyek mérkőzése már biztosan befejeződött
    const readyTips = [];
    const futureTips = [];

    for (const tip of state.pendingTips) {
      const eventTime = new Date(tip.eventDate).getTime();
      if (isNaN(eventTime)) {
        continue;
      }

      // Becsült meccs-időtartam: Foci: 115 perc, Tenisz: 120 perc, NFL: 210 perc
      let durationMs = 115 * 60 * 1000;
      if (tip.sportId === 5) durationMs = 120 * 60 * 1000;
      if (tip.sportId === 16) durationMs = 210 * 60 * 1000;

      // 72 óránál régebbi, beragadt meccsek kiszűrése (hogy ne terhelje a rendszert)
      const ageHours = (now - eventTime) / (1000 * 60 * 60);
      if (ageHours > 72) {
        console.warn(`🧹 Beragadt régi tipp eltávolítva (>72h): ${tip.eventName} - ${tip.marketName}`);
        continue;
      }

      if (now >= eventTime + durationMs) {
        readyTips.push(tip);
      } else {
        futureTips.push(tip);
      }
    }

    if (readyTips.length === 0) {
      state.pendingTips = futureTips;
      return;
    }

    const unverifiedTips = [];

    // 2. LÉPÉS: HIVATALOS TIPPMIX EREDMÉNYEK (0 AI token, automatikus winner/loser/void)
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanMarket = m => String(m || '').split('(')[0].trim().toLowerCase();

    for (const tip of readyTips) {
      let verified = false;
      const dateKey = String(tip.eventDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
      
      const datesToTry = [dateKey];
      try {
        const dObj = new Date(dateKey);
        const prev = new Date(dObj.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const next = new Date(dObj.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        datesToTry.push(prev, next);
      } catch (_) {}

      for (const d of datesToTry) {
        if (verified) break;
        const events = await fetchTippmixOfficialResults(tip.sportId, d);
        if (!Array.isArray(events) || events.length === 0) continue;

        const matchedEv = events.find(e => 
          (tip.eventId && Number(e.id) === Number(tip.eventId)) ||
          norm(e.name) === norm(tip.eventName)
        );

        if (matchedEv && Array.isArray(matchedEv.markets)) {
          const market = matchedEv.markets.find(m => 
            cleanMarket(m.name) === cleanMarket(tip.marketName) ||
            norm(m.name) === norm(tip.marketName)
          );

          if (market && Array.isArray(market.outcomes)) {
            const outcome = market.outcomes.find(o => 
              norm(o.name) === norm(tip.outcomeName)
            );

            if (outcome && (outcome.result === 'winner' || outcome.result === 'loser' || outcome.result === 'void')) {
              let score = null;
              if (matchedEv.fulltimeScore && typeof matchedEv.fulltimeScore.participant1Score !== 'undefined') {
                score = `${matchedEv.fulltimeScore.participant1Score}-${matchedEv.fulltimeScore.participant2Score}`;
              }
              applyEvaluationResult(tip, {
                won: outcome.result === 'winner',
                isVoid: outcome.result === 'void',
                score,
                method: 'tippmix_official'
              });
              statsChanged = true;
              verified = true;
            }
          }
        }
      }

      if (!verified) {
        unverifiedTips.push(tip);
      }
    }

    // 3. Ha maradt ellenőrizendő tipp, és elérhető a Gemini AI:
    // KÖTEGELT KÉRÉS (Egyszerre több meccs 1 promptban, napi kvóta 500 kérés védelmére)
    if (unverifiedTips.length > 0 && callGeminiFn && process.env.GEMINI_API_KEY) {
      // Csoportosítás mérkőzés szerint
      const matchMap = new Map();
      for (const tip of unverifiedTips) {
        const key = tip.eventName;
        if (!matchMap.has(key)) matchMap.set(key, []);
        matchMap.get(key).push(tip);
      }

      // Ciklusonként legfeljebb 3-5 mérkőzést ellenőrzünk 1 promptban
      const matchesToProcess = Array.from(matchMap.entries()).slice(0, 3);
      const evaluatedTipIds = new Set();

      const batchItems = matchesToProcess.map(([eventName, tips]) => ({
        match: eventName,
        sport: tips[0].sportName,
        date: tips[0].eventDate,
        tips: tips.map(t => ({
          id: t.id,
          market: t.marketName,
          selection: t.outcomeName,
          odds: t.odds
        }))
      }));

      const queryPrompt = `Feladat: Határozd meg az alábbi lezárult sportesemények hivatalos végeredményét és értékeld ki a hozzájuk tartozó fogadási tippeket!
Mérkőzések és vizsgálandó tippek:
${JSON.stringify(batchItems, null, 2)}

Keresd meg az interneten a hivatalos végeredményt!
KIZÁRÓLAG egy érvényes JSON formátumban válaszolj az alábbi struktúrában:
{
  "results": [
    {
      "id": "tipp_azonosito",
      "finished": true,
      "finalScore": "pl. 2-1",
      "won": true,
      "explanation": "Rövid indoklás miért nyert vagy vesztett a tipp"
    }
  ]
}
(Ha egy meccs elmaradt vagy nem fejeződött be, a "finished" értéke legyen false).`;

      try {
        const aiCheck = await callGeminiFn({
          apiKey: process.env.GEMINI_API_KEY,
          prompt: queryPrompt
        });

        const resultsList = Array.isArray(aiCheck?.data?.results)
          ? aiCheck.data.results
          : (Array.isArray(aiCheck?.data) ? aiCheck.data : []);

        for (const resItem of resultsList) {
          if (resItem && resItem.finished && typeof resItem.won === 'boolean' && resItem.id) {
            const matchedTip = unverifiedTips.find(t => t.id === resItem.id);
            if (matchedTip) {
              applyEvaluationResult(matchedTip, {
                won: resItem.won,
                score: resItem.finalScore || null,
                method: 'gemini_search'
              });
              evaluatedTipIds.add(matchedTip.id);
              statsChanged = true;
            }
          }
        }
      } catch (err) {
        const msg = String(err.message || '');
        if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('limit')) {
          console.warn('⏳ [TRACKER] Gemini API napi vagy perces kvótakorlát elérve. A háttérellenőrzés a következő ciklusban folytatódik.');
        } else {
          console.warn('⚠️ [TRACKER] Eredményellenőrzési hiba:', msg);
        }
      }

      // Azok a tippek maradnak függőben, amiket most még nem tudtunk kiértékelni
      const remainingUnverified = unverifiedTips.filter(t => !evaluatedTipIds.has(t.id));
      state.pendingTips = [...futureTips, ...remainingUnverified];
    } else {
      state.pendingTips = [...futureTips, ...unverifiedTips];
    }
  } catch (err) {
    console.error('❌ [TRACKER] Váratlan hiba az evaluatePendingTips futásakor:', err.message);
  } finally {
    if (statsChanged) {
      saveState();
    }
    isEvaluating = false;
  }
}

// 7. GITHUB SZINKRONIZÁCIÓ
async function pullFromGitHub() {
  try {
    let remoteState = null;

    if (GITHUB_TOKEN) {
      const authHeader = GITHUB_TOKEN.startsWith('Bearer ') || GITHUB_TOKEN.startsWith('token ') 
        ? GITHUB_TOKEN 
        : `token ${GITHUB_TOKEN}`;
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/data/betting_stats.json`;
      const res = await fetch(url, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'SmartTippmixPro-Tracker'
        }
      });

      if (res.status === 200) {
        const data = await res.json();
        const content = Buffer.from(data.content, 'base64').toString('utf8');
        remoteState = JSON.parse(content);
      }
    }

    // Ha nincs token vagy az API nem válaszolt, töltsük le közvetlenül a publikus tárolóból
    if (!remoteState) {
      const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/data/betting_stats.json?t=${Date.now()}`;
      const rawRes = await fetch(rawUrl, {
        headers: { 'User-Agent': 'SmartTippmixPro-Tracker' }
      });
      if (rawRes.ok) {
        remoteState = await rawRes.json();
      }
    }

    if (remoteState && remoteState.stats) {
      // Ha a távoli állapot egy frissebb resetet tartalmaz, tisztán érvényesítjük a resetet!
      if (remoteState.resetAt && (!state.resetAt || new Date(remoteState.resetAt) > new Date(state.resetAt))) {
        state = {
          updatedAt: remoteState.updatedAt || new Date().toISOString(),
          resetAt: remoteState.resetAt,
          stats: {
            football: mergeSportStats(remoteState.stats?.football),
            tennis: mergeSportStats(remoteState.stats?.tennis),
            nfl: mergeSportStats(remoteState.stats?.nfl)
          },
          pendingTips: Array.isArray(remoteState.pendingTips) ? remoteState.pendingTips : [],
          seenTipIds: Array.isArray(remoteState.seenTipIds) ? remoteState.seenTipIds : []
        };
        saveState();
        console.log('🔄 [TRACKER SYNC] Friss nullázás (reset) sikeresen érvényesítve GitHubról!');
        return;
      }

      function combineSportStats(local, remote) {
        const l = local || createSportStats();
        const r = remote || createSportStats();
        if ((r.totalChecked || 0) >= (l.totalChecked || 0)) {
          return mergeSportStats(r);
        }
        return mergeSportStats(l);
      }

      state.stats = {
        football: combineSportStats(state.stats?.football, remoteState.stats?.football),
        tennis: combineSportStats(state.stats?.tennis, remoteState.stats?.tennis),
        nfl: combineSportStats(state.stats?.nfl, remoteState.stats?.nfl)
      };

      // FÜGGŐ TIPPEK UNIÓJA: Soha semmit nem írunk felül üressel!
      const existingIds = new Set(state.pendingTips.map(t => t.id));
      if (Array.isArray(remoteState.pendingTips)) {
        for (const rt of remoteState.pendingTips) {
          if (rt && rt.id && !existingIds.has(rt.id)) {
            state.pendingTips.push(rt);
            existingIds.add(rt.id);
          }
        }
      }

      if (Array.isArray(remoteState.seenTipIds)) {
        const seenSet = new Set(state.seenTipIds);
        for (const sid of remoteState.seenTipIds) {
          seenSet.add(sid);
        }
        state.seenTipIds = Array.from(seenSet).slice(-3000);
      }

      // ELŐZMÉNYEK UNIÓJA
      if (Array.isArray(remoteState.history)) {
        const histMap = new Map();
        for (const h of state.history || []) {
          if (h && h.id) histMap.set(h.id, h);
        }
        for (const h of remoteState.history) {
          if (h && h.id && !histMap.has(h.id)) {
            histMap.set(h.id, h);
          }
        }
        state.history = Array.from(histMap.values())
          .sort((a, b) => new Date(b.evaluatedAt || 0) - new Date(a.evaluatedAt || 0))
          .slice(0, 300);
      }

      console.log(`☁️ Statisztikák, függő tippek és előzmények sikeresen beolvasva GitHubról: Foci ${state.stats.football.winRate}%, Tenisz ${state.stats.tennis.winRate}%, NFL ${state.stats.nfl.winRate}%, Függőben: ${state.pendingTips.length}, Előzmények: ${state.history.length}`);
    }
  } catch (err) {
    console.warn('⚠️ GitHub pull nem sikerült:', err.message);
  }
}

async function pushToGitHub() {
  if (!GITHUB_TOKEN) {
    console.log('ℹ️ [GITHUB SYNC] GITHUB_TOKEN nincs beállítva a környezetben, push kihagyva.');
    return;
  }
  try {
    const authHeader = GITHUB_TOKEN.startsWith('Bearer ') || GITHUB_TOKEN.startsWith('token ') 
      ? GITHUB_TOKEN 
      : `token ${GITHUB_TOKEN}`;

    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/data/betting_stats.json`;
    let sha = null;

    const checkRes = await fetch(url, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SmartTippmixPro-Tracker'
      }
    });
    if (checkRes.status === 200) {
      const checkData = await checkRes.json();
      sha = checkData.sha;
    } else {
      const checkErr = await checkRes.text();
      console.warn(`⚠️ [GITHUB SYNC] Fájl-ellenőrzés sikertelen (HTTP ${checkRes.status}):`, checkErr);
    }

    const contentBase64 = Buffer.from(JSON.stringify(state, null, 2), 'utf8').toString('base64');
    const updateRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'SmartTippmixPro-Tracker'
      },
      body: JSON.stringify({
        message: `chore: update betting win rate stats [Foci: ${state.stats.football.winRate}% | Tenisz: ${state.stats.tennis.winRate}% | NFL: ${state.stats.nfl.winRate}%] [skip render] [skip ci]`,
        content: contentBase64,
        sha: sha || undefined
      })
    });

    if (updateRes.ok) {
      console.log('☁️ [GITHUB SYNC] Statisztika és előzmények sikeresen szinkronizálva a GitHub tárolóba!');
    } else {
      const updateErr = await updateRes.text();
      console.warn(`⚠️ [GITHUB SYNC] Mentés sikertelen a GitHubra (HTTP ${updateRes.status}):`, updateErr);
    }
  } catch (err) {
    console.warn('⚠️ Hiba a GitHub szinkronizálás során:', err.message);
  }
}
