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
// 1. KIZÁRÓLAGOS SPORTÁGAK: NFL, FOCI (LABDARÚGÁS), TENISZ
// ============================================================================

const ALL_SPORTS_MASTER = [
  { key: '1', tippmixId: 1, name: 'Labdarúgás (Foci)', shortName: 'Foci', icon: '⚽', searchTerms: ['football', 'soccer', 'labdarúgás'], featured: true },
  { key: '5', tippmixId: 5, name: 'Tenisz', shortName: 'Tenisz', icon: '🎾', searchTerms: ['tennis', 'ATP', 'WTA', 'ITF', 'tenisz'], featured: true },
  { key: '16', tippmixId: 16, name: 'Amerikai futball (NFL)', shortName: 'NFL', icon: '🏈', searchTerms: ['american football', 'NFL', 'NCAA'], featured: true }
];

const ALLOWED_SPORT_IDS = new Set([1, 5, 16]);

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

const CATALOG_CACHE_TTL_MS = 3 * 60 * 1000;        // 3 perc: Tippmix meccslista
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

  const countsById = new Map();
  for (const ev of events) {
    countsById.set(ev.sportId, (countsById.get(ev.sportId) || 0) + 1);
  }

  const sports = ALL_SPORTS_MASTER.map(s => ({
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

// Piaci prioritások: kiemelten kezeljük a sárga lapokat, szögleteket és a fő piacokat!
function getMarketPriority(marketName = '') {
  const name = marketName.toLowerCase();
  // 1. Fő piacok (1X2, Győztes)
  if (name === '1x2' || name.includes('mérkőzés győztese') || name.includes('ki nyeri') || name === 'győztes') return 1;
  // 2. Kétesély, DNB
  if (name === 'kétesély' || name.includes('döntetlennél a tét visszajár')) return 2;
  // 3. Mindkét csapat szerez gólt
  if (name.includes('mindkét csapat szerez gólt')) return 3;
  // 4. Gólszámok (1.5, 2.5, 3.5)
  if (/^gólszám [1234],5$/.test(name) || /^pontszám/.test(name) || /^játékszám/.test(name) || /^szettszám/.test(name)) return 4;
  // 5. Szögletszám és Büntetőlapok (Sárga lapok)
  if (name.includes('szögletszám') || name.includes('büntetőlap') || name.includes('sárga lap')) return 4.5;
  // 6. Hendikep és egyéb
  if (name.includes('hendikep') || name.includes('játszma') || name.includes('gólszám')) return 5;
  if (name.includes('1. félidő') || name.includes('csapat szöglet') || name.includes('csapat gólszám')) return 6;
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
        availableTargetMarkets: filteredOptions,
        allMarketsList: allMarkets
      };
    })
  );

  return detailedResults;
}

// ============================================================================
// 5. VALÓS IDEJŰ INTERNETES KUTATÓ (JÁTÉKVEZETŐ, LAPOK, SZÖGLETEK)
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

async function gatherWebResearchForMatches(eventsList, customQuery = '') {
  const allWebSources = [];
  const researchSections = [];

  if (eventsList && eventsList.length > 0) {
    const topToSearch = eventsList.slice(0, 4);
    for (const ev of topToSearch) {
      // 1. Általános forma és előrejelzés keresés
      const qMain = `${ev.eventName} prediction stats H2H betting tips`;
      // 2. Célzott játékvezető, sárga lapok és szögletek keresés (focinál és NFL-nél!)
      let qSpecial = '';
      if (Number(ev.sportId) === 1 || ev.sportName?.toLowerCase().includes('foci')) {
        qSpecial = `${ev.eventName} referee cards corners stats`;
      } else if (Number(ev.sportId) === 16 || ev.sportName?.toLowerCase().includes('nfl')) {
        qSpecial = `${ev.eventName} referee penalties betting stats`;
      }

      const searches = [searchDuckDuckGoCached(qMain, 3)];
      if (qSpecial) searches.push(searchDuckDuckGoCached(qSpecial, 3));

      const settled = await Promise.all(searches);
      const combined = settled.flat();

      for (const r of combined) {
        if (r.url) allWebSources.push({ title: r.title, url: r.url });
      }

      if (combined.length > 0) {
        const lines = combined.map(r => `   • [${r.title}]: ${r.snippet}`).join('\n');
        researchSections.push(`Mérkőzés internetes és bírói/lap/szöglet találatok (${ev.sportName} - ${ev.eventName}):\n${lines}`);
      }
    }
  } else if (customQuery) {
    const q1 = `${customQuery} prediction stats H2H betting tips odds`;
    const q2 = `${customQuery} referee cards corners stats penalties`;
    const [res1, res2] = await Promise.all([
      searchDuckDuckGoCached(q1, 4),
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
      : 'Használd a nemzetközi sportstatisztikai, játékvezetői és fogadási tudásbázisodat.',
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

// 7.1 STÁTUSZ & SPORTÁGAK
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

// 7.2 BAJNOKSÁGOK LISTÁJA PRIORITÁS SZERINT (BL, EL, TOP LIGÁK, NB I ELŐRE!)
app.get('/api/competitions', async (req, res) => {
  try {
    const catalog = await fetchTippmixCatalog();
    const rawSports = (req.query.sports || '1,5,16').toString().split(',').map(s => Number(s.trim())).filter(Boolean);
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
          todayMatches: 0
        });
      }

      const item = compMap.get(compKey);
      item.totalMatches++;

      if (isTodayInHungary(ev.eventDate)) {
        item.todayMatches++;
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

// 7.3 AZNAPI MÉRKŐZÉSEK ÉS TOP 2 TIPP ADOTT BAJNOKSÁG(OK)HOZ (SZIGORÚAN CSAK MAI MECCSEK!)
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

      // SZIGORÚAN CSAK A MAI NAPON (Europe/Budapest) JÁTSZOTT MECCSEK!
      if (onlyToday) {
        if (!isTodayInHungary(ev.eventDate)) {
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

    windowEvents.sort((a, b) => (b.totalMarketCount || 1) - (a.totalMarketCount || 1));
    const topCandidates = windowEvents.slice(0, Math.max(12, tipsCount * 2 + 2));

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
      return res.json({
        ...cachedAnalysis.payload,
        fromCache: true
      });
    }

    const enrichedEvents = topCandidates.length > 0
      ? await enrichCandidateEvents(topCandidates, minOdds, maxOdds, forceRefresh)
      : [];

    const webResearch = await gatherWebResearchForMatches(
      enrichedEvents,
      enrichedEvents.length === 0 ? `${selectedSportMeta ? selectedSportMeta.name : 'football tennis NFL'} upcoming matches next ${hours} hours predictions betting tips odds` : ''
    );

    let matchesContextBlock = '';
    if (enrichedEvents.length > 0) {
      matchesContextBlock = `A KÖVETKEZŐ ${hours} ÓRÁBAN ELÉRHETŐ TIPPMIXPRO MÉRKŐZÉSEK ÉS ${minOdds.toFixed(2)}-${maxOdds.toFixed(2)} KÖZÖTTI PIACOK:\n` +
        enrichedEvents.map((ev, idx) => {
          const marketsStr = ev.availableTargetMarkets
            .map(m => `   - Piac: "${m.marketName}" | Tipp: "${m.outcomeName}" | Odds: ${m.odds.toFixed(2)}`)
            .join('\n');
          return `[${idx + 1}] Sportág: ${ev.sportName} | Sorozat: ${ev.competitionGroupName} - ${ev.competitionName}\n    Mérkőzés: ${ev.eventName} (Kezdés: ${ev.eventDate})\n    Elérhető ${minOdds.toFixed(2)} - ${maxOdds.toFixed(2)} közötti opciók:\n${marketsStr}`;
        }).join('\n\n');
    }

    const prompt = `Te egy profi sportfogadási és statisztikai elemző vagy (kiemelt szakterületeid: Labdarúgás, Tenisz, Amerikai futball / NFL).
A felhasználó a következő ${hours} órában keresi a **${tipsCount} LEGVALÓSZÍNŰBB fogadási tippet**, amelyek szorzója **SZIGORÚAN ${minOdds.toFixed(2)} és ${maxOdds.toFixed(2)} közé esik**.
Kiválasztott sportág: ${selectedSportMeta ? selectedSportMeta.name : 'Foci, Tenisz vagy NFL'}.

KÜLÖNLEGES SZAKMAI KÖVETELMÉNYEK:
1. JÁTÉKVEZETŐI ELEMZÉS: Focinál és NFL-nél vedd figyelembe a játékvezető (referee) lapátlagát, büntetőit és stílusát!
2. SAROKRÚGÁSOK ÉS SÁRGA LAPOK: Focinál alaposan elemezd a szögleteket (corners) és sárga lapokat (cards) is, ha azok a legvalószínűbb opciók között szerepelnek!
3. Pontosan ${tipsCount} tippet adj vissza, szakmai indoklással és kockázati besorolással!

${matchesContextBlock}

VALÓS IDEJŰ INTERNETES ELEMZŐ ÉS STATISZTIKAI TALÁLATOK:
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
        "mainThesis": "Részletes, 4-6 mondatos fő szakmai indoklás.",
        "formAndStats": "Statisztikák, H2H mérleg, forma.",
        "refereeAndDiscipline": "Játékvezetői és fegyelmi (sárga lap, szöglet, büntető) észrevételek.",
        "keyFactors": ["1. érv", "2. érv", "3. érv"]
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

    const responsePayload = {
      ok: true,
      mode: 'interval',
      hours,
      sportId,
      minOdds,
      maxOdds,
      tipsCount,
      sportName: selectedSportMeta ? selectedSportMeta.name : 'NFL, Foci, Tenisz',
      result: aiResult.data,
      fromCache: false
    };

    aiAnalysisCache.set(fingerprint, {
      timestamp: Date.now(),
      payload: responsePayload
    });

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
        .sort((a, b) => b.score - a.score);

      matchedEvents = scored.slice(0, 4).map(s => s.ev);
    }

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
      return res.json({
        ...cachedAnalysis.payload,
        fromCache: true
      });
    }

    const enrichedEvents = matchedEvents.length > 0
      ? await enrichCandidateEvents(matchedEvents, minOdds, maxOdds, forceRefresh)
      : [];

    console.log(`🌐 [RÉSZLETES ELEMZÉS] Internetes kutatás indítása: "${query}" (Bíró, lapok, szögletek, forma)...`);
    const webResearch = await gatherWebResearchForMatches(enrichedEvents, query);

    let tippmixContextText = '';
    if (enrichedEvents.length > 0) {
      tippmixContextText = `A kiválasztott mérkőzéshez ("${query}") a TippmixPro valós ${minOdds.toFixed(2)} - ${maxOdds.toFixed(2)} közötti piacai és szorzói:\n\n` +
        enrichedEvents.map((ev, idx) => {
          const marketsStr = ev.availableTargetMarkets
            .map(m => `   - Piac: "${m.marketName}" | Tipp: "${m.outcomeName}" | Odds: ${m.odds.toFixed(2)}`)
            .join('\n');
          return `[${idx + 1}] Sportág: ${ev.sportName} | Bajnokság: ${ev.competitionGroupName} - ${ev.competitionName}\n    Mérkőzés: ${ev.eventName} (Kezdés: ${ev.eventDate})\n    Elérhető ${minOdds.toFixed(2)} - ${maxOdds.toFixed(2)} közötti opciók:\n${marketsStr}`;
        }).join('\n\n');
    }

    const prompt = `Te egy kiemelkedő felkészültségű sportfogadási szakértő és statisztikai elemző vagy (Labdarúgás, Tenisz, Amerikai futball / NFL).
A felhasználó az alábbi konkrét mérkőzés mélyreható szakmai elemzését kéri: "${query}".

KÖTELEZŐ ELEMZÉSI SZEMPONTOK (SZAKMAI MÉLYSÉG):
1. **JÁTÉKVEZETŐ / BÍRÓ (REFEREE) VIZSGÁLAT**:
   - Labdarúgásnál: Keresd meg a kijelölt játékvezetőt! Milyen a lapátlaga (sárga lap / mérkőzés, piros lap)? Gyakran fúj-e tizenegyest? Engedi a folyamatos játékot vagy sokat aprítja a mezőnyt?
   - NFL-nél: Ki a vezetőbíró (lead referee)? Hány büntetőt (penalties per game) és büntetőyardot dobnak átlagosan, melyik csapat stílusának kedvez?
2. **SZÖGLETEK ÉS SÁRGA LAPOK (CORNERS & CARDS)**:
   - Labdarúgásnál elemezd a várható szögletszámot (csapatok szélsőjátéka, lövések száma, blokkolt beadások) és a lapos határokat (derbi hangulat, tét, feszültség)!
3. **TOP 3 LEGVALÓSZÍNŰBB TIPP**:
   - Válassz ki pontosan **3 darab különböző piaci tippet** a mérkőzésre, amelyek szorzója **SZIGORÚAN ${minOdds.toFixed(2)} és ${maxOdds.toFixed(2)} közé esik**!
   - Ha a fenti TippmixPro adatokban szerepelnek opciók, KÖTELEZŐEN az ott lévő valós piacneveket és oddsokat válaszd ki!
4. **KOCKÁZATI ÉRTÉKELÉS (1-10)**:
   - Részletesen indokold meg a kockázat mértékét és a váratlan forgatókönyveket!

TIPPMIXPRO ADATOK:
${tippmixContextText}

INTERNETES ELEMZŐ, BÍRÓI ÉS STATISZTIKAI TALÁLATOK:
${webResearch.researchText}

VÁLASZ FORMÁTUMA (Kizárólag érvényes JSON, magyarul):
{
  "analysisOverview": "2-3 mondatos professzionális összegzés a mérkőzésről.",
  "refereeAnalysis": {
    "refereeName": "A játékvezető neve (pl. Anthony Taylor / Nem ismert)",
    "cardAverage": "pl. 4.1 sárga lap / meccs, 0.15 piros lap",
    "penaltyTendency": "pl. Átlagosnál gyakoribb büntetők",
    "summary": "3-4 mondat a bírói stílusról, a lapok várhatóságáról és a játék ritmusára gyakorolt hatásáról."
  },
  "cornersAndCards": {
    "cornerAnalysis": "Részletes elemzés a szögletekről: melyik csapat dominálhat a széleken, várható sarokrúgások száma és határok.",
    "cardAnalysis": "Részletes elemzés a sárga lapokról: feszültség, tét, játékosok habitusa, büntetőlap-szám előrejelzés."
  },
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
        "mainThesis": "Részletes fő indoklás: miért ez a legvalószínűbb tipp a mérkőzésre.",
        "formAndStats": "Konkrét statisztikák, gól/pont átlagok, H2H forma.",
        "refereeAndDisciplineInsight": "Hogyan támasztja alá ezt a bírói és a fegyelmi (lap/szöglet) kép.",
        "keyFactors": ["1. kulcsérv", "2. kulcsérv", "3. kulcsérv"]
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

    const responsePayload = {
      ok: true,
      mode: 'custom',
      query,
      minOdds,
      maxOdds,
      tipsCount,
      matchedTippmixEventsCount: enrichedEvents.length,
      modelUsed: aiResult.modelUsed,
      result: aiResult.data,
      fromCache: false
    };

    aiAnalysisCache.set(fingerprint, {
      timestamp: Date.now(),
      payload: responsePayload
    });

    res.json(responsePayload);
  } catch (err) {
    console.error('Részletes meccs elemzési hiba:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ SmartTippmixPro AI Szerver fut: http://localhost:${PORT}`);
  console.log(`⚽ Fókusz sportágak: Labdarúgás, Tenisz, NFL`);
});
