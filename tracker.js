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

// Kezdő állapot
let state = {
  updatedAt: new Date().toISOString(),
  stats: {
    football: { totalChecked: 0, won: 0, lost: 0, winRate: 0 },
    nfl: { totalChecked: 0, won: 0, lost: 0, winRate: 0 }
  },
  pendingTips: [],
  seenTipIds: []
};

// 1. Állapot betöltése (helyi fájlból, majd ha van GitHub token, GitHubról szinkronizálva)
export async function initTracker() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const raw = fs.readFileSync(STATS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      state = {
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        stats: {
          football: { totalChecked: 0, won: 0, lost: 0, winRate: 0, ...(parsed.stats?.football || {}) },
          nfl: { totalChecked: 0, won: 0, lost: 0, winRate: 0, ...(parsed.stats?.nfl || {}) }
        },
        pendingTips: Array.isArray(parsed.pendingTips) ? parsed.pendingTips : [],
        seenTipIds: Array.isArray(parsed.seenTipIds) ? parsed.seenTipIds : []
      };
      console.log(`📊 Tracker betöltve helyi fájlból: Foci ${state.stats.football.winRate}% (${state.stats.football.won}/${state.stats.football.totalChecked}), NFL ${state.stats.nfl.winRate}% (${state.stats.nfl.won}/${state.stats.nfl.totalChecked}), Függőben: ${state.pendingTips.length}`);
    }
  } catch (err) {
    console.warn('⚠️ Hiba a helyi statisztika betöltésekor:', err.message);
  }

  // Ha van GitHub token, szinkronizálunk a távoli repóból is (újraindulás utáni állapotmentés Renderen)
  if (GITHUB_TOKEN) {
    await pullFromGitHub();
  }
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

  // Debounced mentés GitHubra
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

// Megállapítja a sportág azonosítót (1 = Foci, 16 = NFL)
export function normalizeSportId(sportInput) {
  if (!sportInput) return null;
  const s = String(sportInput).toLowerCase();
  if (s === '1' || s.includes('foci') || s.includes('labdarúg') || s.includes('football') || s.includes('soccer')) return 1;
  if (s === '16' || s.includes('nfl') || s.includes('amerikai futball') || s.includes('amerikai foci')) return 16;
  return null;
}

// 4. Új tipp felvétele a várólistába (duplikáció szűréssel)
export function recordTip(tip, source = 'manual') {
  if (!tip) return false;

  const sportId = normalizeSportId(tip.sportId || tip.sportName);
  if (!sportId) return false; // Csak Foci (1) és NFL (16) kerül tárolásra!

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
  if (state.seenTipIds.length > 2000) {
    state.seenTipIds = state.seenTipIds.slice(-2000);
  }

  state.pendingTips.push({
    id: tipId,
    sportId,
    sportName: sportId === 1 ? 'Labdarúgás (Foci)' : 'Amerikai futball (NFL)',
    eventId: tip.eventId || null,
    eventName,
    competitionName: tip.competitionName || '',
    eventDate,
    marketName,
    outcomeName,
    odds,
    source,
    addedAt: new Date().toISOString(),
    status: 'pending'
  });

  saveState();
  return true;
}

// Kötegelt tipp felvétel (pl. ligatáblázatból vagy Top 3 intervallumból)
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
  return {
    ok: true,
    updatedAt: state.updatedAt,
    stats: state.stats,
    pendingCount: state.pendingTips.length,
    pendingTipsSummary: state.pendingTips.slice(0, 10).map(t => ({
      sportName: t.sportName,
      eventName: t.eventName,
      eventDate: t.eventDate,
      marketName: t.marketName,
      outcomeName: t.outcomeName,
      odds: t.odds,
      source: t.source
    }))
  };
}

// 6. Eredmény-ellenőrző háttérmotor
// Leellenőrzi azokat a mérkőzéseket, amelyek már véget értek!
export async function evaluatePendingTips(fetchEventDetailsFn, callGeminiFn) {
  if (isEvaluating) return;
  if (state.pendingTips.length === 0) return;

  isEvaluating = true;
  const now = Date.now();
  const remainingPending = [];
  let statsChanged = false;

  for (const tip of state.pendingTips) {
    const eventTime = new Date(tip.eventDate).getTime();
    if (isNaN(eventTime)) {
      continue; // Érvénytelen dátum, kihagyjuk
    }

    // Becsült meccs-időtartam: Focinál 115 perc, NFL-nél 210 perc
    const durationMs = tip.sportId === 1 ? 115 * 60 * 1000 : 210 * 60 * 1000;
    const isFinishedTime = now >= eventTime + durationMs;

    if (!isFinishedTime) {
      // Még tart vagy még el sem kezdődött a meccs
      remainingPending.push(tip);
      continue;
    }

    // A mérkőzés időben már véget ért -> Kiértékelés!
    let verificationResult = null;

    // 1. Lépés: Próbálkozás a Tippmix API-ból
    if (tip.eventId && fetchEventDetailsFn) {
      try {
        const details = await fetchEventDetailsFn(tip.eventId);
        if (details && details.markets) {
          const m = details.markets.find(m => 
            m.marketName?.toLowerCase().trim() === tip.marketName?.toLowerCase().trim()
          );
          if (m && m.winnerOutcomeName) {
            const isWon = m.winnerOutcomeName.toLowerCase().trim() === tip.outcomeName.toLowerCase().trim();
            verificationResult = { won: isWon, method: 'tippmix_api' };
          }
        }
      } catch (_) {}
    }

    // 2. Lépés: Ha a Tippmix API-ból nem jött kiértékelés (mert pl. már kikerült az aktív feedből),
    // használjuk a Gemini AI-t Google Search-csel a végeredmény ellenőrzésére!
    if (!verificationResult && callGeminiFn && process.env.GEMINI_API_KEY) {
      try {
        const queryPrompt = `Feladat: Állapítsd meg pontosan egy korábbi sportesemény végeredményét és hogy a megadott fogadási tipp nyertes lett-e!
Sportág: ${tip.sportName}
Mérkőzés: "${tip.eventName}"
Időpont: ${tip.eventDate}
Fogadási Piac: "${tip.marketName}"
Kiválasztott Kimenetel (Tipp): "${tip.outcomeName}"

Keresd meg az interneten a hivatalos végeredményt!
KIZÁRÓLAG egy érvényes JSON formátumban válaszolj:
{
  "finished": true,
  "finalScore": "pl. 2-1",
  "won": true,
  "explanation": "Rövid indoklás miért nyert vagy vesztett a tipp"
}
(Ha a meccs mégsem fejeződött be vagy elmaradt, a "finished" legyen false).`;

        const aiCheck = await callGeminiFn({
          apiKey: process.env.GEMINI_API_KEY,
          prompt: queryPrompt
        });

        if (aiCheck?.data && aiCheck.data.finished && typeof aiCheck.data.won === 'boolean') {
          verificationResult = {
            won: aiCheck.data.won,
            method: 'gemini_search',
            score: aiCheck.data.finalScore
          };
        }
      } catch (err) {
        console.warn(`⚠️ Eredményellenőrzési hiba (${tip.eventName}):`, err.message);
      }
    }

    // Ha sikerült kiértékelni:
    if (verificationResult) {
      statsChanged = true;
      const targetStats = tip.sportId === 1 ? state.stats.football : state.stats.nfl;
      targetStats.totalChecked++;
      if (verificationResult.won) {
        targetStats.won++;
      } else {
        targetStats.lost++;
      }
      targetStats.winRate = Math.round((targetStats.won / targetStats.totalChecked) * 100);

      console.log(`✅ TIPP KIÉRTÉKELVE: [${tip.sportName}] ${tip.eventName} -> ${tip.marketName}: ${tip.outcomeName} | Eredmény: ${verificationResult.won ? 'NYERT 🟢' : 'VESZTETT 🔴'} (${verificationResult.method})`);
      // A meccs TÖRLŐDIK a függő listából ahogy a felhasználó kérte!
    } else {
      // Még nem sikerült leellenőrizni, marad a várólistában
      remainingPending.push(tip);
    }
  }

  state.pendingTips = remainingPending;
  if (statsChanged) {
    saveState();
  }
  isEvaluating = false;
}

// 7. GITHUB SZINKRONIZÁCIÓ (Render újraindulások elleni védelem)
async function pullFromGitHub() {
  if (!GITHUB_TOKEN) return;
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/data/betting_stats.json`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SmartTippmixPro-Tracker'
      }
    });

    if (res.status === 200) {
      const data = await res.json();
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      const remoteState = JSON.parse(content);
      if (remoteState && remoteState.stats) {
        // Ha a távoli több kiértékelt meccset tartalmaz, azt használjuk
        const remoteTotal = (remoteState.stats.football?.totalChecked || 0) + (remoteState.stats.nfl?.totalChecked || 0);
        const localTotal = (state.stats.football?.totalChecked || 0) + (state.stats.nfl?.totalChecked || 0);
        if (remoteTotal >= localTotal) {
          state = remoteState;
          console.log(`☁️ Legfrissebb statisztikák sikeresen betöltve GitHubról: Foci ${state.stats.football.winRate}%, NFL ${state.stats.nfl.winRate}%`);
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ GitHub pull nem sikerült:', err.message);
  }
}

async function pushToGitHub() {
  if (!GITHUB_TOKEN) return;
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/data/betting_stats.json`;
    let sha = null;

    // Meglévő fájl sha kinyerése
    const checkRes = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SmartTippmixPro-Tracker'
      }
    });
    if (checkRes.status === 200) {
      const checkData = await checkRes.json();
      sha = checkData.sha;
    }

    const contentBase64 = Buffer.from(JSON.stringify(state, null, 2), 'utf8').toString('base64');
    const updateRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'SmartTippmixPro-Tracker'
      },
      body: JSON.stringify({
        message: `chore: update betting win rate stats [${state.stats.football.winRate}% / ${state.stats.nfl.winRate}%]`,
        content: contentBase64,
        sha: sha || undefined
      })
    });

    if (updateRes.ok) {
      console.log('☁️ Statisztika sikeresen szinkronizálva a GitHub tárolóba!');
    } else {
      const errJson = await updateRes.json();
      console.warn('⚠️ GitHub mentési válasz:', errJson.message);
    }
  } catch (err) {
    console.warn('⚠️ Hiba a GitHub szinkronizálás során:', err.message);
  }
}
