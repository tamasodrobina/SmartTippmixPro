import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// 1. TELJES SPORTÁG KATALÓGUS (MIND A 34+ SPORTÁG: FOCI, TENISZ, KOSÁR, ESPORT, EGYÉB)
// ============================================================================

const ALL_SPORTS_MASTER = [
  { key: '1', tippmixId: 1, name: 'Labdarúgás (Foci)', shortName: 'Foci', icon: '⚽', searchTerms: ['football', 'soccer', 'labdarúgás'], featured: true },
  { key: '5', tippmixId: 5, name: 'Tenisz', shortName: 'Tenisz', icon: '🎾', searchTerms: ['tennis', 'ATP', 'WTA', 'ITF', 'tenisz'], featured: true },
  { key: '2', tippmixId: 2, name: 'Kosárlabda', shortName: 'Kosárlabda', icon: '🏀', searchTerms: ['basketball', 'NBA', 'Euroleague', 'kosárlabda'], featured: true },
  { key: '4', tippmixId: 4, name: 'Jégkorong', shortName: 'Jégkorong', icon: '🏒', searchTerms: ['ice hockey', 'NHL', 'KHL', 'jégkorong'], featured: true },
  { key: '999', tippmixId: 999, name: 'E-Sport (CS2, LoL, Dota, E-Foci, E-Kosár)', shortName: 'E-Sport', icon: '🎮', searchTerms: ['esports', 'CS2', 'League of Legends', 'Dota 2', 'Valorant', 'eBasketball', 'eSoccer'], featured: true },
  { key: '6', tippmixId: 6, name: 'Kézilabda', shortName: 'Kézilabda', icon: '🤾', searchTerms: ['handball', 'kézilabda'], featured: true },
  { key: '22', tippmixId: 22, name: 'Darts', shortName: 'Darts', icon: '🎯', searchTerms: ['darts', 'PDC'], featured: true },
  { key: '19', tippmixId: 19, name: 'Snooker', shortName: 'Snooker', icon: '🎱', searchTerms: ['snooker', 'WST'], featured: true },
  { key: '16', tippmixId: 16, name: 'Amerikai futball', shortName: 'Am. futball', icon: '🏈', searchTerms: ['american football', 'NFL', 'NCAA'], featured: true },

  // Egyéb sportágak (A-tól Z-ig)
  { key: '20', tippmixId: 20, name: 'Asztalitenisz', shortName: 'Asztalitenisz', icon: '🏓', searchTerms: ['table tennis', 'Liga Pro', 'TT Cup', 'asztalitenisz'], featured: false },
  { key: 'aus_futball', tippmixId: 18, name: 'Ausztrál futball', shortName: 'Aus. futball', icon: '🏉', searchTerms: ['australian rules football', 'AFL'], featured: false },
  { key: 'bandy', tippmixId: 28, name: 'Bandy', shortName: 'Bandy', icon: '🏑', searchTerms: ['bandy'], featured: false },
  { key: '3', tippmixId: 3, name: 'Baseball', shortName: 'Baseball', icon: '⚾', searchTerms: ['baseball', 'MLB', 'NPB', 'KBO'], featured: false },
  { key: 'box', tippmixId: 10, name: 'Box (Ökölvívás)', shortName: 'Box', icon: '🥊', searchTerms: ['boxing', 'fight', 'ökölvívás'], featured: false },
  { key: '7', tippmixId: 7, name: 'Floorball', shortName: 'Floorball', icon: '🏑', searchTerms: ['floorball'], featured: false },
  { key: '29', tippmixId: 29, name: 'Futsal', shortName: 'Futsal', icon: '⚽', searchTerms: ['futsal'], featured: false },
  { key: 'golf', tippmixId: 9, name: 'Golf', shortName: 'Golf', icon: '⛳', searchTerms: ['golf', 'PGA', 'DP World Tour'], featured: false },
  { key: 'gyephoki', tippmixId: 24, name: 'Gyephoki', shortName: 'Gyephoki', icon: '🏑', searchTerms: ['field hockey', 'gyephoki'], featured: false },
  { key: 'kabaddi', tippmixId: 42, name: 'Kabaddi', shortName: 'Kabaddi', icon: '🤼', searchTerms: ['kabaddi', 'Pro Kabaddi'], featured: false },
  { key: 'kerekpar', tippmixId: 17, name: 'Kerékpár', shortName: 'Kerékpár', icon: '🚴', searchTerms: ['cycling', 'UCI'], featured: false },
  { key: 'krikett', tippmixId: 21, name: 'Krikett', shortName: 'Krikett', icon: '🏏', searchTerms: ['cricket', 'T20', 'ODI', 'Test cricket'], featured: false },
  { key: 'ligarogbi', tippmixId: 13, name: 'Ligarögbi', shortName: 'Ligarögbi', icon: '🏉', searchTerms: ['rugby league', 'NRL', 'Super League'], featured: false },
  { key: 'loverseny', tippmixId: 35, name: 'Lóverseny', shortName: 'Lóverseny', icon: '🏇', searchTerms: ['horse racing', 'lóverseny'], featured: false },
  { key: 'mma', tippmixId: 31, name: 'MMA (UFC / Ketrecharc)', shortName: 'MMA', icon: '🥋', searchTerms: ['MMA', 'UFC', 'PFL', 'Bellator', 'KSW'], featured: false },
  { key: '11', tippmixId: 11, name: 'Motorsport (F1, MotoGP, Rally)', shortName: 'Motorsport', icon: '🏎️', searchTerms: ['motorsport', 'Formula 1', 'MotoGP', 'NASCAR', 'Rally'], featured: false },
  { key: 'netball', tippmixId: 40, name: 'Netball', shortName: 'Netball', icon: '🏐', searchTerms: ['netball'], featured: false },
  { key: 'pesapallo', tippmixId: 41, name: 'Pesäpallo', shortName: 'Pesäpallo', icon: '⚾', searchTerms: ['pesapallo', 'Superpesis'], featured: false },
  { key: '12', tippmixId: 12, name: 'Rögbi', shortName: 'Rögbi', icon: '🏉', searchTerms: ['rugby union', 'rögbi'], featured: false },
  { key: '23', tippmixId: 23, name: 'Röplabda', shortName: 'Röplabda', icon: '🏐', searchTerms: ['volleyball', 'röplabda'], featured: false },
  { key: 'strandfoci', tippmixId: 32, name: 'Strandfoci', shortName: 'Strandfoci', icon: '🏖️', searchTerms: ['beach soccer', 'strandfoci'], featured: false },
  { key: 'strandroplabda', tippmixId: 33, name: 'Strandröplabda', shortName: 'Strandröplabda', icon: '🏖️', searchTerms: ['beach volleyball', 'strandröplabda'], featured: false },
  { key: 'teli_sportok', tippmixId: 14, name: 'Téli sportok (Sí, Biatlon)', shortName: 'Téli sportok', icon: '❄️', searchTerms: ['winter sports', 'biathlon', 'alpine skiing', 'ski jumping'], featured: false },
  { key: 'tollaslabda', tippmixId: 30, name: 'Tollaslabda', shortName: 'Tollaslabda', icon: '🏸', searchTerms: ['badminton', 'BWF', 'tollaslabda'], featured: false },
  { key: '26', tippmixId: 26, name: 'Vízilabda', shortName: 'Vízilabda', icon: '🤽', searchTerms: ['water polo', 'vízilabda'], featured: false },
  { key: '998', tippmixId: 998, name: 'Speciális fogadások', shortName: 'Speciális', icon: '⭐', searchTerms: ['special bets'], featured: false }
];

// ============================================================================
// 2. TÖBBSZINTŰ INTELLIGENS GYORSÍTÓTÁR (CACHE & RATE-LIMIT VÉDELEM)
// ============================================================================
// Megakadályozza, hogy a Google Gemini, a DuckDuckGo vagy a Tippmix API-t
// feleslegesen pörgesse a szerver, ha nem változott a kínálat!

const CATALOG_CACHE_TTL_MS = 3 * 60 * 1000;        // 3 perc: teljes Tippmix meccslista
const EVENT_MARKET_CACHE_TTL_MS = 15 * 60 * 1000;  // 15 perc: egy-egy mérkőzés 75+ részletes piaca
const WEB_RESEARCH_CACHE_TTL_MS = 60 * 60 * 1000;  // 60 perc: egy mérkőzésre lekapart netes cikkek/statok
const AI_ANALYSIS_CACHE_TTL_MS = 20 * 60 * 1000;   // 20 perc: teljes AI elemzés (ha a meccs-ujjlenyomat nem változott!)

let catalogCache = {
  timestamp: 0,
  events: [],
  sports: []
};

const eventMarketCache = new Map();     // key: eventId -> { timestamp, data }
const webResearchCache = new Map();     // key: query   -> { timestamp, results }
const aiAnalysisCache = new Map();      // key: fingerprint -> { timestamp, payload }

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

// Ujjlenyomat (fingerprint) generálása a jelölt mérkőzések és a beállítások alapján:
// Ha ugyanazok a meccsek vannak az adott időablakban és nem változtak a paraméterek,
// NEM hívjuk meg újra a Gemini API-t, hanem 0 ms alatt visszaadjuk az eredményt!
function createAnalysisFingerprint({ mode, sportId, minOdds, maxOdds, tipsCount, eventIds = [], customQuery = '' }) {
  const raw = JSON.stringify({
    mode,
    sportId,
    minOdds: Number(minOdds).toFixed(2),
    maxOdds: Number(maxOdds).toFixed(2),
    tipsCount: Number(tipsCount),
    eventIds: [...eventIds].sort(),
    customQuery: customQuery.toLowerCase().trim()
  });
  return crypto.createHash('sha1').update(raw).digest('hex');
}

// ============================================================================
// 3. TIPPMIX / TIPPMIXPRO ADATLEKÉRŐ
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
  const events = json?.data?.events || [];

  const countsById = new Map();
  const dynamicSports = new Map();

  for (const ev of events) {
    if (!ev.sportId) continue;
    countsById.set(ev.sportId, (countsById.get(ev.sportId) || 0) + 1);
    if (!ALL_SPORTS_MASTER.some(s => s.tippmixId === ev.sportId)) {
      dynamicSports.set(ev.sportId, {
        key: String(ev.sportId),
        tippmixId: ev.sportId,
        name: ev.sportName || `Sport #${ev.sportId}`,
        shortName: ev.sportName || `Sport #${ev.sportId}`,
        icon: '🏅',
        searchTerms: [ev.sportName || 'sport'],
        featured: false
      });
    }
  }

  const combinedMaster = [...ALL_SPORTS_MASTER, ...Array.from(dynamicSports.values())];
  const sports = combinedMaster.map(s => ({
    ...s,
    sportId: s.key,
    sportName: s.name,
    count: countsById.get(s.tippmixId) || 0
  }));

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

function getMarketPriority(marketName = '') {
  const name = marketName.toLowerCase();
  if (name === '1x2' || name.includes('mérkőzés győztese') || name.includes('ki nyeri')) return 1;
  if (name === 'kétesély' || name.includes('döntetlennél a tét visszajár')) return 2;
  if (name.includes('mindkét csapat szerez gólt')) return 3;
  if (/^gólszám [1234],5$/.test(name) || /^pontszám/.test(name) || /^játékszám/.test(name) || /^szettszám/.test(name) || /^frame/.test(name)) return 4;
  if (name.includes('gólszám') || name.includes('pontszám') || name.includes('hendikep') || name.includes('játszma') || name.includes('map')) return 5;
  if (name.includes('1. félidő') || name.includes('1. játszma') || name.includes('csapat gólszám')) return 6;
  return 10;
}

function extractTargetOddsMarkets(markets = [], minOdds = 1.30, maxOdds = 2.00, maxOptionsPerEvent = 16) {
  const validOptions = [];
  const midPoint = (minOdds + maxOdds) / 2;

  for (const m of markets) {
    if (!m.outcomes || !Array.isArray(m.outcomes)) continue;
    const priority = getMarketPriority(m.marketName);

    for (const o of m.outcomes) {
      const odds = Number(o.fixedOdds);
      if (odds >= minOdds && odds <= maxOdds) {
        validOptions.push({
          marketId: m.marketId,
          marketName: m.marketName + (m.specialOddsValue ? ` (${m.specialOddsValue})` : ''),
          outcomeName: o.outcomeName,
          odds: Number(odds.toFixed(2)),
          priority
        });
      }
    }
  }

  validOptions.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const distA = Math.abs(a.odds - midPoint);
    const distB = Math.abs(b.odds - midPoint);
    return distA - distB;
  });

  return validOptions.slice(0, maxOptionsPerEvent);
}

async function enrichCandidateEvents(candidateEvents, minOdds = 1.30, maxOdds = 2.00, forceRefresh = false) {
  const detailedResults = await Promise.all(
    candidateEvents.map(async (ev) => {
      const detailed = await fetchEventDetails(ev.eventId, forceRefresh);
      const allMarkets = detailed?.markets?.length ? detailed.markets : (ev.markets || []);
      const filteredOptions = extractTargetOddsMarkets(allMarkets, minOdds, maxOdds, 16);

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
        availableTargetMarkets: filteredOptions
      };
    })
  );

  return detailedResults.filter(e => e.availableTargetMarkets.length > 0);
}

function selectBalancedMultiSportCandidates(events, maxTotal = 18) {
  const bySport = new Map();

  for (const ev of events) {
    const sId = ev.sportId || 'other';
    if (!bySport.has(sId)) {
      bySport.set(sId, []);
    }
    bySport.get(sId).push(ev);
  }

  for (const [, list] of bySport.entries()) {
    list.sort((a, b) => (b.totalMarketCount || 1) - (a.totalMarketCount || 1));
  }

  const selected = [];
  const sportLists = Array.from(bySport.values());
  let round = 0;

  while (selected.length < maxTotal) {
    let addedInRound = false;
    for (const list of sportLists) {
      if (round < list.length && selected.length < maxTotal) {
        selected.push(list[round]);
        addedInRound = true;
      }
    }
    if (!addedInRound) break;
    round++;
  }

  return selected;
}

// ============================================================================
// 4. RATE-LIMIT VÉDETT, CACHE-ELT WEB KERESŐ MOTOR
// ============================================================================

function decodeHtmlEntities(str = '') {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .trim();
}

async function searchDuckDuckGoCached(query, maxResults = 4) {
  const cacheKey = query.toLowerCase().trim();
  const now = Date.now();
  const cached = webResearchCache.get(cacheKey);
  if (cached && now - cached.timestamp < WEB_RESEARCH_CACHE_TTL_MS) {
    return cached.results;
  }

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,hu;q=0.8'
      }
    });
    if (!response.ok) return [];
    const html = await response.text();

    const results = [];
    const blockRegex = /<div class="links_main[\s\S]*?<\/div>\s*<\/div>/g;
    const blocks = html.match(blockRegex) || [];

    for (const block of blocks.slice(0, maxResults)) {
      const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const urlMatch = block.match(/uddg=([^&"]+)/);

      const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : '';
      const snippet = snippetMatch ? decodeHtmlEntities(snippetMatch[1]) : '';
      let targetUrl = '';
      if (urlMatch && urlMatch[1]) {
        try {
          targetUrl = decodeURIComponent(urlMatch[1]);
        } catch (_) {
          targetUrl = '';
        }
      }

      if (title && snippet) {
        results.push({ title, snippet, url: targetUrl });
      }
    }

    webResearchCache.set(cacheKey, { timestamp: now, results });
    return results;
  } catch (_) {
    return [];
  }
}

// Kíméletes (kötegelt) keresés, hogy soha ne tiltson ki a keresőmotor
async function gatherWebResearchForMatches(eventsList, customQuery = '') {
  const allWebSources = [];
  const researchSections = [];

  if (eventsList && eventsList.length > 0) {
    // Maximum 6 kiemelt mérkőzésre indítunk keresést, 3-as csoportokban (rate-limit védelem),
    // és ha már cache-ben van a meccs, 0 hálózati kéréssel jön vissza!
    const topToSearch = eventsList.slice(0, 6);
    for (let i = 0; i < topToSearch.length; i += 3) {
      const batch = topToSearch.slice(i, i + 3);
      const settled = await Promise.all(
        batch.map(async (ev) => {
          const q = `${ev.eventName} ${ev.sportName || ''} prediction stats H2H tips`;
          const results = await searchDuckDuckGoCached(q, 3);
          for (const r of results) {
            if (r.url) allWebSources.push({ title: r.title, url: r.url });
          }
          if (results.length === 0) return null;
          const lines = results.map(r => `   • [${r.title}]: ${r.snippet}`).join('\n');
          return `Mérkőzés internetes találatok (${ev.sportName} - ${ev.eventName}):\n${lines}`;
        })
      );
      for (const item of settled) {
        if (item) researchSections.push(item);
      }
    }
  } else if (customQuery) {
    const q1 = `${customQuery} prediction stats H2H betting tips odds`;
    const q2 = `${customQuery} upcoming matches predictions tips today`;
    const [res1, res2] = await Promise.all([
      searchDuckDuckGoCached(q1, 5),
      searchDuckDuckGoCached(q2, 4)
    ]);
    const combined = [...res1, ...res2];
    for (const r of combined) {
      if (r.url) allWebSources.push({ title: r.title, url: r.url });
    }
    if (combined.length > 0) {
      researchSections.push(
        `Internetes találatok ("${customQuery}"):\n` +
        combined.map(r => `   • [${r.title}]: ${r.snippet}`).join('\n')
      );
    }
  }

  return {
    researchText: researchSections.length > 0
      ? researchSections.join('\n\n')
      : 'Használd a nemzetközi sportstatisztikai és fogadási tudásbázisodat.',
    webSources: allWebSources
  };
}

// ============================================================================
// 5. GEMINI AI ELEMZŐ MOTOR (MODELL-LISTA CACHE + AUTOMATIKUS FALLBACK)
// ============================================================================

let cachedModelsForKey = { keyHash: '', timestamp: 0, models: [] };

async function discoverActiveGeminiModels(apiKey) {
  const defaultModels = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest'
  ];

  const keyHash = crypto.createHash('md5').update(apiKey).digest('hex');
  const now = Date.now();
  // A modell-listát is cache-eljük 30 percig, hogy ne csináljon minden elemzésnél plusz API hívást!
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
        if (name.includes('tts') || name.includes('image') || name.includes('embedding') || name.includes('vision') || name.includes('aqa') || name.includes('transcribe') || name.includes('robotics') || name.includes('banana')) return false;
        return name.startsWith('gemini-');
      });

    if (available.length === 0) return defaultModels;

    available.sort((a, b) => {
      const score = (n) => {
        if (n === 'gemini-3.8-flash') return 100;
        if (n === 'gemini-3.7-flash') return 98;
        if (n === 'gemini-3.6-flash') return 96;
        if (n === 'gemini-3.5-flash') return 94;
        if (n === 'gemini-flash-latest') return 92;
        if (n === 'gemini-3.5-flash-lite') return 90;
        if (n === 'gemini-flash-lite-latest') return 88;
        if (n.includes('flash')) return 80;
        return 60;
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
    throw new Error('Hiányzik a Gemini API kulcs! Kérlek add meg a jobb felső sarokban található "API Kulcs" gombbal, vagy a .env fájlban (GEMINI_API_KEY).');
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
// 6. REST API VÉGPONTOK
// ============================================================================

app.get('/api/status', async (req, res) => {
  try {
    const catalog = await fetchTippmixCatalog();
    const now = new Date();
    const upcomingCount = catalog.events.filter(e => new Date(e.eventDate) > now).length;

    res.json({
      ok: true,
      hasServerApiKey: Boolean(process.env.GEMINI_API_KEY),
      totalEvents: catalog.events.length,
      upcomingEvents: upcomingCount,
      sports: catalog.sports,
      cacheStats: {
        cachedAnalyses: aiAnalysisCache.size,
        cachedMatches: eventMarketCache.size,
        cachedWebSearches: webResearchCache.size
      },
      serverTime: now.toISOString()
    });
  } catch (err) {
    res.json({
      ok: false,
      hasServerApiKey: Boolean(process.env.GEMINI_API_KEY),
      sports: ALL_SPORTS_MASTER.map(s => ({ ...s, sportId: s.key, sportName: s.name, count: 0 })),
      error: err.message
    });
  }
});

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

// IDŐINTERVALLUM ALAPJÁN TÖRTÉNŐ ELEMZÉS (1-24 óra, egyedi odds sáv, 1-10 tipp, intelligens cache!)
app.post('/api/analyze/interval', async (req, res) => {
  try {
    const hours = Math.min(24, Math.max(1, Number(req.body.hours) || 6));
    const sportId = req.body.sportId ? String(req.body.sportId) : 'all';
    const rawMinOdds = Math.max(1.01, Math.min(20.0, Number(req.body.minOdds) || 1.30));
    const rawMaxOdds = Math.max(1.05, Math.min(50.0, Number(req.body.maxOdds) || 2.00));
    const minOdds = Math.min(rawMinOdds, rawMaxOdds);
    const maxOdds = Math.max(rawMinOdds, rawMaxOdds);
    const tipsCount = Math.min(10, Math.max(1, Number(req.body.tipsCount) || 3));
    const forceRefresh = Boolean(req.body.forceRefresh);
    const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
    const clientEvents = Array.isArray(req.body.clientEvents) ? req.body.clientEvents : null;

    let allEvents = [];
    if (clientEvents && clientEvents.length > 0) {
      allEvents = clientEvents;
    } else {
      const catalog = await fetchTippmixCatalog(forceRefresh);
      allEvents = catalog.events;
    }

    const selectedSportMeta = ALL_SPORTS_MASTER.find(s => s.key === sportId || String(s.tippmixId) === sportId);
    const now = new Date();
    const endWindow = new Date(now.getTime() + hours * 3600 * 1000);

    let windowEvents = allEvents.filter(ev => {
      const evDate = new Date(ev.eventDate);
      const inTime = evDate >= now && evDate <= endWindow;
      if (!inTime) return false;
      if (sportId === 'all') return true;
      if (String(ev.sportId) === sportId) return true;
      if (selectedSportMeta && Number(ev.sportId) === Number(selectedSportMeta.tippmixId)) return true;
      if (selectedSportMeta && ev.sportName?.toLowerCase().includes(selectedSportMeta.shortName.toLowerCase())) return true;
      return false;
    });

    // Ha több tippet (pl. 8-10-et) kér a felhasználó, kicsit több jelölt mérkőzést (max 20) veszünk be
    const candidateLimit = Math.max(16, tipsCount * 2 + 4);
    let topCandidates = [];
    if (sportId === 'all') {
      topCandidates = selectBalancedMultiSportCandidates(windowEvents, candidateLimit);
    } else {
      windowEvents.sort((a, b) => (b.totalMarketCount || 1) - (a.totalMarketCount || 1));
      topCandidates = windowEvents.slice(0, candidateLimit);
    }

    // 1. ELLENŐRIZZÜK AZ UJJLENYOMATOT (FINGERPRINT CACHE):
    // Ha pontosan ugyanezek a mérkőzések vannak az időablakban, és nem kért kényszerített frissítést,
    // akkor 0 API hívással, azonnal visszaadjuk a gyorsítótárazott elemzést!
    const fingerprint = createAnalysisFingerprint({
      mode: 'interval',
      sportId,
      minOdds,
      maxOdds,
      tipsCount,
      eventIds: topCandidates.map(e => e.eventId)
    });

    const cachedAnalysis = aiAnalysisCache.get(fingerprint);
    if (!forceRefresh && cachedAnalysis && Date.now() - cachedAnalysis.timestamp < AI_ANALYSIS_CACHE_TTL_MS) {
      const ageMinutes = Math.max(1, Math.round((Date.now() - cachedAnalysis.timestamp) / 60000));
      return res.json({
        ...cachedAnalysis.payload,
        fromCache: true,
        cacheAgeMinutes: ageMinutes
      });
    }

    const enrichedEvents = topCandidates.length > 0
      ? await enrichCandidateEvents(topCandidates, minOdds, maxOdds, forceRefresh)
      : [];

    const sportSearchLabel = selectedSportMeta
      ? `${selectedSportMeta.name} (${selectedSportMeta.searchTerms.join(' ')})`
      : 'football tennis basketball esports ice hockey handball darts snooker table tennis volleyball';

    const webResearch = await gatherWebResearchForMatches(
      enrichedEvents,
      enrichedEvents.length === 0 ? `${sportSearchLabel} upcoming matches next ${hours} hours predictions betting tips odds` : ''
    );

    let matchesContextBlock = '';
    if (enrichedEvents.length > 0) {
      const presentSports = [...new Set(enrichedEvents.map(e => e.sportName))].join(', ');
      matchesContextBlock = `A KÖVETKEZŐ ${hours} ÓRÁBAN ELÉRHETŐ TIPPMIXPRO MÉRKŐZÉSEK ÉS ${minOdds.toFixed(2)}-${maxOdds.toFixed(2)} KÖZÖTTI PIACOK (Érintett sportágak: ${presentSports}):\n` +
        enrichedEvents.map((ev, idx) => {
          const marketsStr = ev.availableTargetMarkets
            .map(m => `   - Piac: "${m.marketName}" | Tipp: "${m.outcomeName}" | TippmixPro Odds: ${m.odds.toFixed(2)}`)
            .join('\n');
          return `[${idx + 1}] Sportág: ${ev.sportName} | Sorozat: ${ev.competitionGroupName} - ${ev.competitionName}\n    Mérkőzés: ${ev.eventName} (Kezdés: ${ev.eventDate})\n    Elérhető ${minOdds.toFixed(2)} - ${maxOdds.toFixed(2)} közötti TippmixPro opciók:\n${marketsStr}`;
        }).join('\n\n');
    } else {
      matchesContextBlock = `Kiválasztott sportág: ${selectedSportMeta ? selectedSportMeta.name : 'Összes sportág'}. Időablak: következő ${hours} óra.
Használd a lenti valós idejű internetes keresési találatokat és a nemzetközi sportnaptárt az adott sportágban a következő ${hours} órában / ma sorra kerülő mérkőzésekhez és azok ${minOdds.toFixed(2)} - ${maxOdds.toFixed(2)} közötti fogadási lehetőségeihez!`;
    }

    const prompt = `Te egy profi, minden sportágat (Labdarúgás, Tenisz, Kosárlabda, Jégkorong, Kézilabda, E-Sport, Darts, Snooker, Asztalitenisz, Röplabda, Vízilabda, Amerikai futball, MMA, Box, Motorsport, Baseball, Krikett, stb.) átfogó sportfogadási elemző és statisztikai kutató vagy.
A felhasználó a következő ${hours} órában (${now.toISOString()} és ${endWindow.toISOString()} között) keresi a **${tipsCount} LEGVALÓSZÍNŰBB, szakmailag legjobban alátámasztott fogadási tippet**, amelyek szorzója **SZIGORÚAN ${minOdds.toFixed(2)} és ${maxOdds.toFixed(2)} közé esik**.
Kiválasztott sportág szűrő: ${selectedSportMeta ? selectedSportMeta.name : 'ÖSSZES SPORTÁG (Foci, Tenisz, Kosárlabda, E-Sport, Jégkorong, Kézilabda, Darts, Snooker, Egyéb - minden lehetőség!)'}.

FELADATOD:
1. Vizsgáld át a lenti mérkőzéseket és a valós idejű internetes elemző/statisztikai találatokat (forma, H2H, gól/pont/szett/map mutatók, hazai/vendég statisztikák, nemzetközi tippoldalak előrejelzései).
2. Válaszd ki pontosan a **${tipsCount} LEGVALÓSZÍNŰBB fogadási tippet** a **${minOdds.toFixed(2)} és ${maxOdds.toFixed(2)} közötti odds** tartományból (ha kevesebb mint ${tipsCount} mérkőzés van, adhatsz több különböző piaci tippet is a mérkőzésekre, hogy meglegyen a kért ${tipsCount} darab tipp)!
   - Ha "ÖSSZES SPORTÁG" van kiválasztva, törekedj arra, hogy a teljes kínálatból (vegyesen Foci, Tenisz, Kosárlabda, E-Sport, Jégkorong, Snooker, Kézilabda stb. mérkőzésekből) a legmagasabb találati valószínűségű tippeket válaszd ki!
   - Ha a lenti TippmixPro listában szerepelnek mérkőzések, KÖTELEZŐEN az ott szereplő valós piacokból és ${minOdds.toFixed(2)}–${maxOdds.toFixed(2)} közötti szorzókból válassz!
3. Minden tipphez adj részletes magyar nyelvű szakmai indoklást, és a végén részletes kockázati elemzést!

${matchesContextBlock}

VALÓS IDEJŰ INTERNETES ELEMZŐ ÉS STATISZTIKAI TALÁLATOK:
${webResearch.researchText}

VÁLASZ FORMÁTUMA:
Kizárólag egy érvényes JSON objektummal válaszolj (minden szöveg magyar nyelven legyen!), az alábbi sémában (a \`tips\` tömbben ${tipsCount} elem legyen, \`rank\`: 1..${tipsCount}):
{
  "analysisOverview": "Rövid, 2-3 mondatos összefoglaló arról, milyen sportágakat, mérkőzéseket és elemző forrásokat vizsgáltál át a következő ${hours} órás időablakban (${minOdds.toFixed(2)} - ${maxOdds.toFixed(2)} odds sávban).",
  "tips": [
    {
      "rank": 1,
      "sportName": "Sportág pontos neve (pl. Labdarúgás, Tenisz, Kosárlabda, E-Sport, Jégkorong, Snooker)",
      "competitionName": "Bajnokság / Torna pontos neve",
      "eventName": "Mérkőzés pontos neve",
      "eventDate": "Kezdési időpont ISO formátumban",
      "marketName": "A kiválasztott Tippmix piac pontos neve (pl. Gólszám 2,5 / A mérkőzés győztese / 1X2 / Hendikep)",
      "outcomeName": "A kiválasztott kimenetel pontos neve",
      "odds": 1.65,
      "estimatedProbability": 74,
      "shortSummary": "1-2 mondatos lényegretörő összegzés a kártya előnézetéhez.",
      "detailedReasoning": {
        "mainThesis": "Részletes, 4-6 mondatos fő indoklás: miért ez a legvalószínűbb gondolat a mérkőzésre.",
        "formAndStats": "Konkrét statisztikák, aktuális forma, utolsó mérkőzések eredményei, gól/pont/szett/map átlagok és egymás elleni (H2H) mérleg.",
        "expertConsensus": "Mit mutatnak a nemzetközi elemző- és tippoldalak, milyen trendeket és esélyeket jeleznek a statisztikai modellek.",
        "keyFactors": [
          "1. kulcsérv",
          "2. kulcsérv",
          "3. kulcsérv"
        ]
      },
      "riskAssessment": {
        "level": "Alacsony | Alacsony-Közepes | Közepes | Magas",
        "score": 3,
        "explanation": "Részletes kockázati elemzés a végére: mennyire kockázatos a tipp (1-10 skálán, ahol 1 a legbiztonságosabb és 10 a legkockázatosabb), és pontosan milyen forgatókönyv boríthatja a papírformát."
      },
      "consultedSources": [
        "TippmixPro Hivatalos Szorzók",
        "Nemzetközi statisztikai és H2H adatbázis"
      ]
    }
  ]
}`;

    const aiResult = await callGeminiWithSearch({
      apiKey,
      prompt,
      precollectedSources: webResearch.webSources
    });

    const responsePayload = {
      ok: true,
      mode: 'interval',
      hours,
      sportId,
      minOdds,
      maxOdds,
      tipsCount,
      sportName: selectedSportMeta ? selectedSportMeta.name : 'Összes sportág (Minden lehetőség)',
      totalMatchesInWindow: windowEvents.length,
      analyzedMatchesCount: enrichedEvents.length,
      modelUsed: aiResult.modelUsed,
      searchQueries: aiResult.searchQueries,
      webSources: aiResult.webSources,
      result: aiResult.data,
      fromCache: false
    };

    // Elmentjük a memóriába az ujjlenyomat alapján
    aiAnalysisCache.set(fingerprint, {
      timestamp: Date.now(),
      payload: responsePayload
    });

    res.json(responsePayload);
  } catch (err) {
    console.error('Interval elemzési hiba:', err);
    res.status(500).json({
      ok: false,
      error: err.message || 'Váratlan hiba történt az elemzés során.'
    });
  }
});

// EGYEDI MÉRKŐZÉS VAGY SZABAD SZÖVEGES KERESÉS ELEMZÉSE
app.post('/api/analyze/custom', async (req, res) => {
  try {
    const query = (req.body.query || '').toString().trim();
    const eventId = req.body.eventId ? Number(req.body.eventId) : null;
    const rawMinOdds = Math.max(1.01, Math.min(20.0, Number(req.body.minOdds) || 1.30));
    const rawMaxOdds = Math.max(1.05, Math.min(50.0, Number(req.body.maxOdds) || 2.00));
    const minOdds = Math.min(rawMinOdds, rawMaxOdds);
    const maxOdds = Math.max(rawMinOdds, rawMaxOdds);
    const tipsCount = Math.min(10, Math.max(1, Number(req.body.tipsCount) || 3));
    const forceRefresh = Boolean(req.body.forceRefresh);
    const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;

    if (!query && !eventId) {
      return res.status(400).json({
        ok: false,
        error: 'Kérlek írj be egy mérkőzést, csapatot, játékost vagy bajnokságot a szövegmezőbe!'
      });
    }

    const catalog = await fetchTippmixCatalog(forceRefresh);
    let matchedEvents = [];

    if (eventId) {
      const found = catalog.events.find(e => Number(e.eventId) === eventId);
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
        .sort((a, b) => b.score - a.score || (b.ev.totalMarketCount || 0) - (a.ev.totalMarketCount || 0));

      matchedEvents = scored.slice(0, 6).map(s => s.ev);
    }

    // Ujjlenyomat ellenőrzése egyedi keresésre is
    const fingerprint = createAnalysisFingerprint({
      mode: 'custom',
      sportId: 'custom',
      minOdds,
      maxOdds,
      tipsCount,
      eventIds: matchedEvents.map(e => e.eventId),
      customQuery: query
    });

    const cachedAnalysis = aiAnalysisCache.get(fingerprint);
    if (!forceRefresh && cachedAnalysis && Date.now() - cachedAnalysis.timestamp < AI_ANALYSIS_CACHE_TTL_MS) {
      const ageMinutes = Math.max(1, Math.round((Date.now() - cachedAnalysis.timestamp) / 60000));
      return res.json({
        ...cachedAnalysis.payload,
        fromCache: true,
        cacheAgeMinutes: ageMinutes
      });
    }

    const enrichedEvents = matchedEvents.length > 0
      ? await enrichCandidateEvents(matchedEvents, minOdds, maxOdds, forceRefresh)
      : [];

    const webResearch = await gatherWebResearchForMatches(enrichedEvents, query);

    let tippmixContextText = '';
    if (enrichedEvents.length > 0) {
      tippmixContextText = `A keresett kifejezéshez ("${query}") megtaláltuk az alábbi HIVATALOS TIPPMIX / TIPPMIXPRO mérkőzéseket és a valós ${minOdds.toFixed(2)} - ${maxOdds.toFixed(2)} közötti szorzókat:\n\n` +
        enrichedEvents.map((ev, idx) => {
          const marketsStr = ev.availableTargetMarkets
            .map(m => `   - Piac: "${m.marketName}" | Tipp: "${m.outcomeName}" | TippmixPro Odds: ${m.odds.toFixed(2)}`)
            .join('\n');
          return `[${idx + 1}] Sportág: ${ev.sportName} | Sorozat: ${ev.competitionGroupName} - ${ev.competitionName}\n    Mérkőzés: ${ev.eventName} (Kezdés: ${ev.eventDate})\n    Elérhető ${minOdds.toFixed(2)} - ${maxOdds.toFixed(2)} közötti TippmixPro opciók:\n${marketsStr}`;
        }).join('\n\n');
    } else {
      tippmixContextText = `A felhasználó által beírt keresés: "${query}".
(Válassz a mérkőzéshez ${tipsCount} darab reális, ${minOdds.toFixed(2)} és ${maxOdds.toFixed(2)} közötti TippmixPro piaci opciót és szorzót a nemzetközi fogadóirodai kínálat alapján!)`;
    }

    const prompt = `Te egy profi sportfogadási elemző és statisztikai kutató vagy (minden sportágban: Foci, Tenisz, Kosárlabda, E-Sport, Jégkorong, Kézilabda, Darts, Snooker, MMA, Box, Motorsport, stb.).
A felhasználó egy konkrét mérkőzésre, csapatra, játékosra vagy fogadási lehetőségre keresett rá: "${query}".

FELADATOD:
1. Elemezd a lenti TippmixPro adatokat és a valós idejű internetes keresési találatokat (nemzetközi elemző oldalak, tipp oldalak, H2H statisztikák, forma, hazai/vendég mutatók, várható kezdők/hiányzók, motiváció).
2. Add vissza a **${tipsCount} LEGVALÓSZÍNŰBB fogadási tippet** a mérkőzésre (vagy a keresett csapat/játékos/bajnokság mérkőzéseire), amelyek szorzója **SZIGORÚAN ${minOdds.toFixed(2)} és ${maxOdds.toFixed(2)} közé esik**!
   - Ha egyetlen konkrét mérkőzésről van szó, akkor adj ${tipsCount} különböző piaci tippet ugyanarra a mérkőzésre a ${minOdds.toFixed(2)}–${maxOdds.toFixed(2)} sávból (pl. Győztes / Kétesély / DNB, Gólszám / Pontszám / Szettszám / Map Over-Under, Mindkét csapat szerez gólt, Hendikep, Félidő/Játszma piacok).
   - Ha a lenti TippmixPro listában szerepelnek a pontos ${minOdds.toFixed(2)}–${maxOdds.toFixed(2)} közötti piacok és oddsok, KÖTELEZŐEN azokat a valós TippmixPro piacneveket és szorzókat használd!
3. Minden tipphez adj részletes szöveges indoklást és a végén alapos kockázati értékelést!

TIPPMIXPRO ADATOK A KERESÉSHEZ:
${tippmixContextText}

VALÓS IDEJŰ INTERNETES ELEMZŐ ÉS STATISZTIKAI TALÁLATOK:
${webResearch.researchText}

VÁLASZ FORMÁTUMA:
Kizárólag egy érvényes JSON objektummal válaszolj (minden szöveg magyar nyelven legyen!), az alábbi sémában (a \`tips\` tömbben ${tipsCount} elem legyen, \`rank\`: 1..${tipsCount}):
{
  "analysisOverview": "Rövid, 2-3 mondatos összefoglaló a keresett mérkőzésről/csapatról, az átvizsgált elemző oldalakról és a mérkőzés fő képéről (${minOdds.toFixed(2)} - ${maxOdds.toFixed(2)} odds sávban).",
  "tips": [
    {
      "rank": 1,
      "sportName": "Sportág neve",
      "competitionName": "Bajnokság / Torna neve",
      "eventName": "Mérkőzés pontos neve",
      "eventDate": "Kezdési időpont (ISO vagy olvasható dátum)",
      "marketName": "A kiválasztott piac pontos neve (pl. Gólszám 2,5 / 1X2 / Mindkét csapat szerez gólt)",
      "outcomeName": "A kiválasztott kimenetel pontos neve",
      "odds": 1.55,
      "estimatedProbability": 74,
      "shortSummary": "1-2 mondatos lényegretörő összegzés a kártya előnézetéhez.",
      "detailedReasoning": {
        "mainThesis": "Részletes, 4-6 mondatos fő indoklás: miért ez a legvalószínűbb gondolat.",
        "formAndStats": "Konkrét statisztikák, aktuális forma, gól/pont/szett/map átlagok és egymás elleni (H2H) eredmények.",
        "expertConsensus": "Mit mondanak az elemző- és tippoldalak, milyen előrejelzések olvashatók a szakportálokon.",
        "keyFactors": [
          "1. kulcsérv",
          "2. kulcsérv",
          "3. kulcsérv"
        ]
      },
      "riskAssessment": {
        "level": "Alacsony | Alacsony-Közepes | Közepes | Magas",
        "score": 3,
        "explanation": "Részletes kockázati elemzés a végén: mennyire kockázatos ez a tipp (1-10 skálán) és milyen tényezők veszélyeztethetik."
      },
      "consultedSources": [
        "TippmixPro Hivatalos Szorzók",
        "Nemzetközi statisztikai és elemző portálok"
      ]
    }
  ]
}`;

    const aiResult = await callGeminiWithSearch({
      apiKey,
      prompt,
      precollectedSources: webResearch.webSources
    });

    const responsePayload = {
      ok: true,
      mode: 'custom',
      query,
      minOdds,
      maxOdds,
      tipsCount,
      matchedTippmixEventsCount: enrichedEvents.length,
      modelUsed: aiResult.modelUsed,
      searchQueries: aiResult.searchQueries,
      webSources: aiResult.webSources,
      result: aiResult.data,
      fromCache: false
    };

    aiAnalysisCache.set(fingerprint, {
      timestamp: Date.now(),
      payload: responsePayload
    });

    res.json(responsePayload);
  } catch (err) {
    console.error('Custom elemzési hiba:', err);
    res.status(500).json({
      ok: false,
      error: err.message || 'Váratlan hiba történt a mérkőzés elemzése során.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ TippmixPro AI Elemző szerver fut: http://localhost:${PORT}`);
});
