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
  seenTipIds: [],
  replacedTipIds: []
};

function normalizeMatchKey(name = '') {
  return String(name || '').toLowerCase().replace(/[^a-z0-9\u00C0-\u017F]/g, '');
}

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
        seenTipIds: Array.isArray(parsed.seenTipIds) ? parsed.seenTipIds : [],
        replacedTipIds: Array.isArray(parsed.replacedTipIds) ? parsed.replacedTipIds : []
      };
      console.log(`📊 Tracker betöltve: Foci ${state.stats.football.winRate}%, Tenisz ${state.stats.tennis.winRate}%, NFL ${state.stats.nfl.winRate}%, Függőben: ${state.pendingTips.length}, Előzmények: ${state.history.length}`);
    }
  } catch (err) {
    console.warn('⚠️ Hiba a helyi statisztika betöltésekor:', err.message);
  }

  // Mindig megpróbáljuk betölteni GitHubról (akár van token, akár nincs)
  await pullFromGitHub();

  // Visszamenőlegesen is besoroljuk az összes már kiértékelt és függő tippet a liga/torna kategóriákba
  if (enrichAllStateTips()) {
    saveState();
  }
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
// FONTOS: Az NFL / Amerikai foci ellenőrzése megelőzi a sima "foci"/"football" keresést!
export function normalizeSportId(sportInput, competitionInput = '') {
  const s = String(sportInput || '').toLowerCase().trim();
  const c = String(competitionInput || '').toLowerCase().trim();

  if (
    s === '16' ||
    s.includes('nfl') ||
    s.includes('amerikai') ||
    s.includes('american') ||
    c.includes('nfl') ||
    c.includes('amerikai futball') ||
    c.includes('super bowl')
  ) {
    return 16;
  }

  if (
    s === '5' ||
    s.includes('tenisz') ||
    s.includes('tennis') ||
    s.includes('atp') ||
    s.includes('wta') ||
    s.includes('challenger') ||
    s.includes('itf') ||
    c.includes('atp') ||
    c.includes('wta') ||
    c.includes('challenger') ||
    c.includes('grand slam')
  ) {
    return 5;
  }

  if (s === '1' || s.includes('foci') || s.includes('labdarúg') || s.includes('football') || s.includes('soccer')) {
    return 1;
  }
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

// ============================================================================
// HIERARCHIKUS LIGA- ÉS TORNA-KATEGORIZÁLÓ RENDSZER (FIX ERŐSSÉGI SORRENDBEN)
// ============================================================================

export const FOOTBALL_CATEGORY_SCHEMA = [
  {
    key: 'top5_1',
    name: 'Top 5 Bajnokság (1. osztály)',
    icon: '👑',
    order: 1,
    expandable: true,
    fixedSubs: [
      { key: 'eng_1', name: '🇬🇧 Premier League (Angol 1.)', order: 1 },
      { key: 'esp_1', name: '🇪🇸 La Liga (Spanyol 1.)', order: 2 },
      { key: 'ita_1', name: '🇮🇹 Serie A (Olasz 1.)', order: 3 },
      { key: 'ger_1', name: '🇩🇪 Bundesliga (Német 1.)', order: 4 },
      { key: 'fra_1', name: '🇫🇷 Ligue 1 (Francia 1.)', order: 5 }
    ]
  },
  {
    key: 'ucl',
    name: 'Bajnokok Ligája (BL)',
    icon: '🌟',
    order: 2,
    expandable: false,
    fixedSubs: []
  },
  {
    key: 'uel_uecl',
    name: 'Európa Liga & Konferencia Liga',
    icon: '🏆',
    order: 3,
    expandable: true,
    fixedSubs: [
      { key: 'uel', name: '🏆 Európa Liga (EL)', order: 1 },
      { key: 'uecl', name: '🏆 Konferencia Liga (KL)', order: 2 }
    ]
  },
  {
    key: 'top5_2',
    name: 'Top 5 Bajnokság (2. osztály)',
    icon: '🥈',
    order: 4,
    expandable: true,
    fixedSubs: [
      { key: 'eng_2', name: '🇬🇧 Championship (Angol 2.)', order: 1 },
      { key: 'esp_2', name: '🇪🇸 La Liga 2 (Spanyol 2.)', order: 2 },
      { key: 'ita_2', name: '🇮🇹 Serie B (Olasz 2.)', order: 3 },
      { key: 'ger_2', name: '🇩🇪 Bundesliga 2 (Német 2.)', order: 4 },
      { key: 'fra_2', name: '🇫🇷 Ligue 2 (Francia 2.)', order: 5 }
    ]
  },
  {
    key: 'national',
    name: 'Válogatott mérkőzések (Férfi)',
    icon: '🌍',
    order: 5,
    expandable: true,
    fixedSubs: []
  },
  {
    key: 'hun_1',
    name: 'Magyar NB I & Magyar Kupa',
    icon: '🇭🇺',
    order: 6,
    expandable: false,
    fixedSubs: []
  },
  {
    key: 'hun_2',
    name: 'Magyar NB II (2. osztály)',
    icon: '🇭🇺',
    order: 7,
    expandable: false,
    fixedSubs: []
  },
  {
    key: 'women',
    name: 'Női Labdarúgás (Klub & Válogatott)',
    icon: '👩',
    order: 8,
    expandable: true,
    fixedSubs: []
  },
  {
    key: 'other',
    name: 'Egyéb bajnokságok és kupák',
    icon: '🌐',
    order: 9,
    expandable: true,
    fixedSubs: []
  }
];

export const TENNIS_CATEGORY_SCHEMA = [
  {
    key: 'tennis_top',
    name: 'Top Tornák (Grand Slam / ATP / WTA)',
    icon: '👑',
    order: 1,
    expandable: true,
    fixedSubs: []
  },
  {
    key: 'tennis_challenger',
    name: 'Kisebb Tornák (Challenger / ITF)',
    icon: '🎾',
    order: 2,
    expandable: true,
    fixedSubs: []
  }
];

export function cleanSubLeagueName(rawComp, sportId = 1) {
  let s = String(rawComp || '').trim();
  if (!s) return sportId === 5 ? 'Tenisz torna' : 'Egyéb mérkőzés';

  if (Number(sportId) === 5) {
    s = s.replace(/,\s*(férfi|női|vegyes)\s*(egyes|páros).*$/i, '').trim();
    s = s.replace(/,\s*\d+\.\s*csop.*$/i, '').trim();
    return s || 'Tenisz torna';
  }

  if (s.includes(' - ')) {
    const parts = s.split(' - ').map(p => p.trim());
    s = parts.slice(1).join(' - ');
  }

  const hasNoi = /női|\bnoi\b|women|femenin|frauen|femminil/i.test(s);
  s = s.replace(/,\s*([a-d]\s*div.*|[a-d]\s*liga.*|alsóház|felsőház|rájátszás|alapszakasz|bajnoki ág|kiesési ág|észak|dél|kelet|nyugat|[a-z0-9]\s*csoport|[a-z0-9]\.\s*csop.*|[a-z0-9]\.\s*cs\.|[a-l])$/i, '').trim();
  s = s.replace(/\s+[a-d]\s*div\.[a-z0-9]+$/i, '').trim();
  s = s.replace(/\bDél-koreai b\./i, 'Dél-koreai bajnokság');
  if (hasNoi && !/női/i.test(s)) {
    s += ', női';
  }
  return s || 'Egyéb bajnokság';
}

export function classifyTipCategory(tip) {
  const detectedSport = normalizeSportId(tip?.sportName || tip?.sportId, tip?.competitionName);
  const sportId = Number(detectedSport || tip?.sportId || 1);
  const rawComp = String(tip?.competitionName || '').trim();
  const comp = rawComp.toLowerCase();
  const ev = String(tip?.eventName || '').toLowerCase();

  if (sportId === 16 || /\bnfl\b/i.test(rawComp)) {
    return {
      groupKey: 'nfl_main',
      groupName: 'NFL',
      subKey: 'nfl_main',
      subName: 'USA - NFL'
    };
  }

  if (sportId === 5) {
    const isChallenger = comp.includes('challenger') || comp.includes('itf') || comp.includes('wta 125') || comp.includes('futures');
    const subName = cleanSubLeagueName(rawComp, 5);
    const subKey = 'ten_' + subName.toLowerCase().replace(/[^a-z0-9áéíóöőúüű]/g, '_').replace(/_+/g, '_');
    if (isChallenger) {
      return {
        groupKey: 'tennis_challenger',
        groupName: 'Kisebb Tornák (Challenger / ITF)',
        subKey,
        subName
      };
    }
    return {
      groupKey: 'tennis_top',
      groupName: 'Top Tornák (Grand Slam / ATP / WTA)',
      subKey,
      subName
    };
  }

  // LABDARÚGÁS (sportId === 1)
  // 1. Női foci (MINDEN női klub- ÉS női válogatott mérkőzés ide kerül, elsőként szűrve!)
  const isWomenMatch =
    comp.includes('női') ||
    /\bnoi\b/.test(comp) ||
    comp.includes('women') ||
    comp.includes('woman') ||
    comp.includes('ladies') ||
    comp.includes('femenin') ||
    comp.includes('féminin') ||
    comp.includes('frauen') ||
    comp.includes('femminil') ||
    comp.includes('damer') ||
    comp.includes('damallsvenskan') ||
    comp.includes('nwsl') ||
    comp.includes('algarve') ||
    comp.includes('shebelieves') ||
    comp.includes('arnold clark') ||
    comp.includes('pinatar') ||
    ev.includes('női') ||
    /\bnoi\b/.test(ev) ||
    /\((n|w|női|women)\)/i.test(ev) ||
    /\((n|w|női|women)\)/i.test(comp);

  if (isWomenMatch) {
    let subName = cleanSubLeagueName(rawComp || 'Női mérkőzés', 1);
    if (!/női/i.test(subName)) {
      subName += ', női';
    }
    const subKey = 'w_' + subName.toLowerCase().replace(/[^a-z0-9áéíóöőúüű]/g, '_').replace(/_+/g, '_');
    return {
      groupKey: 'women',
      groupName: 'Női Labdarúgás (Klub & Válogatott)',
      subKey,
      subName
    };
  }

  // 2. Férfi Válogatott mérkőzések (kizárólag férfi válogatottak, mivel a nőit fentebb már kiszűrtük!)
  if (
    comp.includes('válogatott') ||
    comp.includes('nemzetek ligája') ||
    comp.includes('nemz.ligája') ||
    comp.includes('nemzetek kupája') ||
    comp.includes('vb-selejtező') ||
    comp.includes('eb-selejtező') ||
    comp.includes('világbajnokság') ||
    comp.includes('európa-bajnokság') ||
    comp.includes('copa america') ||
    comp.includes('afrika kupa') ||
    comp.includes('afrika-kupa') ||
    comp.includes('ázsia kupa') ||
    comp.includes('gold cup') ||
    comp.includes('nl (speciális)') ||
    /\bu(1[5-9]|2[0-3])\b/i.test(comp) ||
    /\bu(1[5-9]|2[0-3])[a-záéíóöőúüű]/i.test(ev)
  ) {
    const subName = cleanSubLeagueName(rawComp || 'Válogatott mérkőzés', 1);
    const subKey = 'nat_' + subName.toLowerCase().replace(/[^a-z0-9áéíóöőúüű]/g, '_').replace(/_+/g, '_');
    return {
      groupKey: 'national',
      groupName: 'Válogatott mérkőzések (Férfi)',
      subKey,
      subName
    };
  }

  // 3. Bajnokok Ligája (Európai BL)
  if (
    (comp.includes('bajnokok ligája') || comp.includes('champions league') || /\bbl\b/.test(comp)) &&
    !comp.includes('ázsia') &&
    !comp.includes('afc') &&
    !comp.includes('afrika') &&
    !comp.includes('caf') &&
    !comp.includes('concacaf') &&
    !comp.includes('ifjúsági')
  ) {
    return {
      groupKey: 'ucl',
      groupName: 'Bajnokok Ligája (BL)',
      subKey: 'ucl',
      subName: '🌟 Bajnokok Ligája (BL)'
    };
  }

  // 4. Európa Liga & Konferencia Liga
  if (
    comp.includes('európa liga') ||
    comp.includes('európa-liga') ||
    comp.includes('europa league') ||
    comp.includes('konferencia liga') ||
    comp.includes('konferencia-liga') ||
    comp.includes('conference league') ||
    /\b(el|kl)\b/.test(comp)
  ) {
    const isUecl = comp.includes('konferencia') || comp.includes('conference') || /\bkl\b/.test(comp);
    return {
      groupKey: 'uel_uecl',
      groupName: 'Európa Liga & Konferencia Liga',
      subKey: isUecl ? 'uecl' : 'uel',
      subName: isUecl ? '🏆 Konferencia Liga (KL)' : '🏆 Európa Liga (EL)'
    };
  }

  // 5. Magyar NB I és NB II
  if (comp.includes('magyar 2') || comp.includes('nb ii') || comp.includes('nb 2') || comp.includes('merkantil')) {
    return {
      groupKey: 'hun_2',
      groupName: 'Magyar NB II (2. osztály)',
      subKey: 'hun_2',
      subName: '🇭🇺 Magyar NB II'
    };
  }
  if (
    comp.includes('magyar bajnokság') ||
    comp.includes('nb i') ||
    comp.includes('nb 1') ||
    comp.includes('otp bank') ||
    comp.includes('fizz liga') ||
    comp.includes('magyar kupa')
  ) {
    return {
      groupKey: 'hun_1',
      groupName: 'Magyar NB I & Magyar Kupa',
      subKey: 'hun_1',
      subName: cleanSubLeagueName(rawComp || 'Magyar NB I', 1)
    };
  }

  // 6. Top 5 Bajnokság – 2. osztály
  if ((comp.includes('angol 2') || comp.includes('championship')) && !comp.includes('skót')) {
    return {
      groupKey: 'top5_2',
      groupName: 'Top 5 Bajnokság (2. osztály)',
      subKey: 'eng_2',
      subName: '🇬🇧 Championship (Angol 2.)'
    };
  }
  if (comp.includes('spanyol 2') || comp.includes('laliga 2') || comp.includes('la liga 2') || comp.includes('segunda division') || comp.includes('hypermotion')) {
    return {
      groupKey: 'top5_2',
      groupName: 'Top 5 Bajnokság (2. osztály)',
      subKey: 'esp_2',
      subName: '🇪🇸 La Liga 2 (Spanyol 2.)'
    };
  }
  if ((comp.includes('olasz 2') || comp.includes('olasz b') || comp.includes('serie b')) && !comp.includes('brazil') && !comp.includes('ecuador') && !comp.includes('kolumbia')) {
    return {
      groupKey: 'top5_2',
      groupName: 'Top 5 Bajnokság (2. osztály)',
      subKey: 'ita_2',
      subName: '🇮🇹 Serie B (Olasz 2.)'
    };
  }
  if (comp.includes('német 2') || comp.includes('2. bundesliga') || comp.includes('bundesliga 2')) {
    return {
      groupKey: 'top5_2',
      groupName: 'Top 5 Bajnokság (2. osztály)',
      subKey: 'ger_2',
      subName: '🇩🇪 Bundesliga 2 (Német 2.)'
    };
  }
  if (comp.includes('francia 2') || comp.includes('ligue 2')) {
    return {
      groupKey: 'top5_2',
      groupName: 'Top 5 Bajnokság (2. osztály)',
      subKey: 'fra_2',
      subName: '🇫🇷 Ligue 2 (Francia 2.)'
    };
  }

  // 7. Top 5 Bajnokság – 1. osztály
  const isLowerOrCup = /(\b[2345]\.|alacsony|amatőr|tartalék|ifjúsági|olasz c|liga 3|national|kupa|cup|pokal|coppa|coupe|copa|supercup|szuperkupa)/i.test(comp);
  if (!isLowerOrCup) {
    if (
      (comp.includes('angol bajnokság') || comp.includes('premier league') || comp.includes('anglia - premier liga') || comp.includes('premier liga')) &&
      !comp.includes('skót') && !comp.includes('orosz') && !comp.includes('ukrán') && !comp.includes('kazah') && !comp.includes('izrael') && !comp.includes('egyiptom') && !comp.includes('kanada') && !comp.includes('bosnyák') && !comp.includes('feröer') && !comp.includes('azeri') && !comp.includes('örmény')
    ) {
      return {
        groupKey: 'top5_1',
        groupName: 'Top 5 Bajnokság (1. osztály)',
        subKey: 'eng_1',
        subName: '🇬🇧 Premier League (Angol 1.)'
      };
    }
    if (comp.includes('spanyol bajnokság') || comp.includes('laliga') || comp.includes('la liga')) {
      return {
        groupKey: 'top5_1',
        groupName: 'Top 5 Bajnokság (1. osztály)',
        subKey: 'esp_1',
        subName: '🇪🇸 La Liga (Spanyol 1.)'
      };
    }
    if ((comp.includes('olasz bajnokság') || comp.includes('serie a')) && !comp.includes('brazil') && !comp.includes('ecuador')) {
      return {
        groupKey: 'top5_1',
        groupName: 'Top 5 Bajnokság (1. osztály)',
        subKey: 'ita_1',
        subName: '🇮🇹 Serie A (Olasz 1.)'
      };
    }
    if ((comp.includes('német bajnokság') || comp.includes('bundesliga')) && !comp.includes('osztrák')) {
      return {
        groupKey: 'top5_1',
        groupName: 'Top 5 Bajnokság (1. osztály)',
        subKey: 'ger_1',
        subName: '🇩🇪 Bundesliga (Német 1.)'
      };
    }
    if (comp.includes('francia bajnokság') || comp.includes('ligue 1')) {
      return {
        groupKey: 'top5_1',
        groupName: 'Top 5 Bajnokság (1. osztály)',
        subKey: 'fra_1',
        subName: '🇫🇷 Ligue 1 (Francia 1.)'
      };
    }
  }

  // 8. Egyéb bajnokságok és kupák
  const subName = cleanSubLeagueName(rawComp || 'Egyéb bajnokság', 1);
  const subKey = 'oth_' + subName.toLowerCase().replace(/[^a-z0-9áéíóöőúüű]/g, '_').replace(/_+/g, '_');
  return {
    groupKey: 'other',
    groupName: 'Egyéb bajnokságok és kupák',
    subKey,
    subName
  };
}

export function enrichTipWithCategory(tip) {
  if (!tip) return tip;
  // Auto-javítás, ha egy NFL vagy Tenisz tipp korábban hibásan Foci (sportId: 1) címkét kapott (pl. "Amerikai foci" vagy "USA - NFL" miatt)
  const trueSportId = normalizeSportId(tip.sportName || tip.sportId, tip.competitionName);
  if (trueSportId && Number(tip.sportId) !== trueSportId) {
    const oldId = tip.id;
    tip.sportId = trueSportId;
    if (trueSportId === 16) tip.sportName = 'Amerikai futball (NFL)';
    else if (trueSportId === 5) tip.sportName = 'Tenisz';
    else if (trueSportId === 1) tip.sportName = 'Labdarúgás (Foci)';
    if (tip.eventName && tip.marketName && tip.outcomeName) {
      const newId = generateTipId(trueSportId, tip.eventName, tip.eventDate, tip.marketName, tip.outcomeName);
      tip.id = newId;
      if (oldId && oldId !== newId) {
        if (!Array.isArray(state.replacedTipIds)) state.replacedTipIds = [];
        if (!state.replacedTipIds.includes(oldId)) state.replacedTipIds.push(oldId);
        if (Array.isArray(state.seenTipIds) && !state.seenTipIds.includes(newId)) state.seenTipIds.push(newId);
      }
    }
  }
  const cat = classifyTipCategory(tip);
  tip.categoryGroupKey = cat.groupKey;
  tip.categoryGroupName = cat.groupName;
  tip.categorySubKey = cat.subKey;
  tip.categorySubName = cat.subName;
  return tip;
}

function enrichAllStateTips() {
  let changed = false;
  if (Array.isArray(state.pendingTips)) {
    for (const t of state.pendingTips) {
      const prevGroup = t.categoryGroupKey;
      const prevGroupName = t.categoryGroupName;
      const prevSub = t.categorySubKey;
      const prevSubName = t.categorySubName;
      enrichTipWithCategory(t);
      if (
        t.categoryGroupKey !== prevGroup ||
        t.categoryGroupName !== prevGroupName ||
        t.categorySubKey !== prevSub ||
        t.categorySubName !== prevSubName
      ) {
        changed = true;
      }
    }
  }
  if (Array.isArray(state.history)) {
    if (!Array.isArray(state.replacedTipIds)) state.replacedTipIds = [];
    const replacedSet = new Set(state.replacedTipIds);
    const seen = Array.isArray(state.seenTipIds) ? state.seenTipIds : [];

    // 1. Kiszűrjük a már lecserélt tippeket és mérkőzésenként csak a legfrissebb elemzést (max 3 nem-ellentmondó tippet) tartjuk meg
    const byMatch = new Map();
    for (const h of state.history) {
      if (!h || !h.id) continue;
      if (replacedSet.has(h.id)) {
        changed = true;
        continue;
      }
      const k = `${h.sportId || 1}|${normalizeMatchKey(h.eventName)}|${String(h.eventDate || '').slice(0, 10)}`;
      if (!byMatch.has(k)) byMatch.set(k, []);
      byMatch.get(k).push(h);
    }

    const dedupedHistory = [];
    for (const [, list] of byMatch.entries()) {
      if (list.length === 1) {
        dedupedHistory.push(list[0]);
        continue;
      }
      const sorted = [...list].sort((a, b) => seen.indexOf(b.id) - seen.indexOf(a.id));
      const matchKept = [];
      const seenMarketTypes = new Set();

      for (const item of sorted) {
        const m = String(item.marketName || '').toLowerCase();
        const o = String(item.outcomeName || '').toLowerCase();
        let mGroup = m.replace(/\([^)]*\)/g, '').replace(/[0-9,.]+/g, '').trim();
        if (
          m === '1x2' ||
          m === 'a mérkőzés győztese' ||
          (m === 'kétesély' && list.some(x => x.marketName === '1X2' && !o.includes(String(x.outcomeName || '').toLowerCase())))
        ) {
          mGroup = 'main_winner_contradiction';
        }

        if (seenMarketTypes.has(mGroup) || matchKept.length >= 3) {
          changed = true;
          if (!replacedSet.has(item.id)) {
            replacedSet.add(item.id);
            state.replacedTipIds.push(item.id);
          }
          continue;
        }
        seenMarketTypes.add(mGroup);
        matchKept.push(item);
      }
      dedupedHistory.push(...matchKept);
    }

    dedupedHistory.sort((a, b) => new Date(b.evaluatedAt || 0) - new Date(a.evaluatedAt || 0));
    if (dedupedHistory.length !== state.history.length) {
      state.history = dedupedHistory;
      changed = true;
    }

    for (const h of state.history) {
      const prevGroup = h.categoryGroupKey;
      const prevGroupName = h.categoryGroupName;
      const prevSub = h.categorySubKey;
      const prevSubName = h.categorySubName;
      enrichTipWithCategory(h);
      if (
        h.categoryGroupKey !== prevGroup ||
        h.categoryGroupName !== prevGroupName ||
        h.categorySubKey !== prevSub ||
        h.categorySubName !== prevSubName
      ) {
        changed = true;
      }
    }

    // 2. Újraszámoljuk a fő sportág statisztikákat közvetlenül a megtisztított history-ból, hogy 100%-ig egyezzenek!
    const freshStats = {
      football: createSportStats(),
      tennis: createSportStats(),
      nfl: createSportStats()
    };

    for (const h of state.history) {
      if (h.status === 'void') continue;
      const sId = Number(h.sportId || 1);
      const sKey = sId === 5 ? 'tennis' : (sId === 16 ? 'nfl' : 'football');
      const target = freshStats[sKey];
      const isWon = h.status === 'won' || Boolean(h.won);

      target.totalChecked++;
      if (isWon) target.won++;
      else target.lost++;
      target.winRate = Math.round((target.won / target.totalChecked) * 100);

      const rCat = h.riskCategory || 'medium';
      const rObj = target.byRisk[rCat] || target.byRisk.medium;
      rObj.totalChecked++;
      if (isWon) rObj.won++;
      else rObj.lost++;
      rObj.winRate = Math.round((rObj.won / rObj.totalChecked) * 100);
    }

    if (JSON.stringify(state.stats) !== JSON.stringify(freshStats)) {
      state.stats = freshStats;
      changed = true;
    }
  }
  return changed;
}

export const ELITE_FOOTBALL_GROUP_KEYS = new Set(['top5_1', 'ucl', 'uel_uecl']);

export function classifyMarketBucket(marketName, sportId) {
  const m = String(marketName || '').toLowerCase();
  const sId = Number(sportId) || 1;
  if (sId === 5 && (m.includes('játszma') || m.includes('játékszám') || m.includes('szett'))) {
    return { key: 'tennis_sets_games', name: 'Tenisz Játszma / Játékszám', shortName: 'játszma / játékszám', icon: '🎾' };
  }
  if (m.includes('büntetőlap') || m.includes('sárga lap') || m.includes('kiállítás')) {
    return { key: 'cards', name: 'Büntetőlapok / Sárga lapok', shortName: 'büntetőlapok', icon: '🟨' };
  }
  if (m.includes('szöglet')) {
    return { key: 'corners', name: 'Szögletszám / Szögletek', shortName: 'szögletszám', icon: '🚩' };
  }
  if (m.includes('mindkét csapat')) {
    return { key: 'btts', name: 'Mindkét csapat szerez gólt (BTTS)', shortName: 'mindkét csapat gól', icon: '⚽' };
  }
  if (
    m.includes('touchdown') ||
    m.includes('mezőnygól') ||
    m.includes('yard') ||
    m.includes('elkapás') ||
    m.includes('reception') ||
    m.includes('passzolt') ||
    m.includes('sikeres passzok') ||
    m.includes('interception') ||
    m.includes('gólszerző') ||
    m.includes('góllövő') ||
    m.includes('szerez gólt') ||
    m.includes('szabálytalanság') ||
    m.includes('lesszám') ||
    m.includes('11-es')
  ) {
    return { key: 'player_special', name: 'Játékos & Speciális (TD / Yard / Góllövő / 11-es)', shortName: 'játékos / speciális', icon: '🎯' };
  }
  if (m.includes('hendikep')) {
    return { key: 'handicap', name: 'Hendikep / Ázsiai hendikep', shortName: 'hendikep', icon: '⚖️' };
  }
  if (m.includes('gólszám') || m.includes('pontszám')) {
    return { key: 'over_under', name: 'Gólszám / Pontszám (Alatt/Felett)', shortName: sId === 16 ? 'pontszám' : 'gólszám', icon: '📊' };
  }
  if (m.includes('kétesély')) {
    return { key: 'double_chance', name: 'Kétesély (1X / X2 / 12)', shortName: 'kétesély', icon: '🛡️' };
  }
  if (m.includes('tét visszajár')) {
    return { key: 'dnb', name: 'Döntetlennél a tét visszajár (DNB)', shortName: 'tét visszajár (DNB)', icon: '🔄' };
  }
  if (
    m === '1x2' ||
    m.startsWith('1x2') ||
    m.includes('1. félidő - 1x2') ||
    m.includes('mérkőzés győztese') ||
    m.startsWith('ki nyeri')
  ) {
    return { key: '1x2', name: '1X2 / Mérkőzés győztese', shortName: sId === 1 ? '1X2' : 'mérkőzés győztese', icon: '🏆' };
  }
  if (sId === 5) {
    return { key: 'tennis_sets_games', name: 'Tenisz Játszma / Játékszám', shortName: 'játszma / játékszám', icon: '🎾' };
  }
  return { key: 'other_market', name: 'Egyéb speciális piacok', shortName: 'speciális', icon: '✨' };
}

export function getInsightSectionMeta(tipOrItem = {}, fallbackContext = {}) {
  const rawSport = tipOrItem.sportId || tipOrItem.sportName || fallbackContext.sportId || fallbackContext.sportName || 1;
  const sportId = normalizeSportId(rawSport) || 1;

  if (sportId === 16) {
    return {
      sectionKey: 'nfl',
      sportId: 16,
      shortGroupLabel: 'NFL',
      groupFullLabel: '🏈 Amerikai futball (NFL)'
    };
  }
  if (sportId === 5) {
    return {
      sectionKey: 'tennis',
      sportId: 5,
      shortGroupLabel: 'Tenisz',
      groupFullLabel: '🎾 Tenisz'
    };
  }

  // Foci: 2 fő csoportra bontva -> 1) Top 5 Liga / BL / EL / KL  vs.  2) Többi bajnokság
  const compName = tipOrItem.competitionName || fallbackContext.competitionName || '';
  const evName = tipOrItem.eventName || fallbackContext.eventName || '';
  const gKey = tipOrItem.categoryGroupKey || classifyTipCategory({
    sportId: 1,
    competitionName: compName,
    eventName: evName
  }).groupKey;

  if (ELITE_FOOTBALL_GROUP_KEYS.has(gKey)) {
    return {
      sectionKey: 'football_elite',
      sportId: 1,
      shortGroupLabel: 'Top liga',
      groupFullLabel: '⚽ Foci – Top 5 Liga / BL / EL / KL'
    };
  }
  return {
    sectionKey: 'football_other',
    sportId: 1,
    shortGroupLabel: 'Többi foci liga',
    groupFullLabel: '⚽ Foci – Többi bajnokság & kupa'
  };
}

function createEmptyNodeStats(meta = {}) {
  return {
    ...meta,
    totalChecked: 0,
    won: 0,
    lost: 0,
    voidCount: 0,
    winRate: 0,
    pendingCount: 0,
    netUnits: 0,
    profitUnits: 0,
    roi: 0,
    roiPercent: 0,
    byRisk: {
      low: { totalChecked: 0, won: 0, lost: 0, winRate: 0, pendingCount: 0, netUnits: 0, profitUnits: 0 },
      medium: { totalChecked: 0, won: 0, lost: 0, winRate: 0, pendingCount: 0, netUnits: 0, profitUnits: 0 },
      high: { totalChecked: 0, won: 0, lost: 0, winRate: 0, pendingCount: 0, netUnits: 0, profitUnits: 0 }
    }
  };
}

function addHistoryItemToNode(node, item) {
  const riskCat = item.riskCategory || 'medium';
  const rNode = node.byRisk[riskCat] || node.byRisk.medium;
  const odds = Number(item.odds) || 1.5;

  if (item.status === 'void') {
    node.voidCount = (node.voidCount || 0) + 1;
    return;
  }

  node.totalChecked++;
  rNode.totalChecked++;

  if (item.won) {
    node.won++;
    rNode.won++;
    const profit = odds - 1;
    node.netUnits = Number((node.netUnits + profit).toFixed(2));
    rNode.netUnits = Number((rNode.netUnits + profit).toFixed(2));
  } else {
    node.lost++;
    rNode.lost++;
    node.netUnits = Number((node.netUnits - 1).toFixed(2));
    rNode.netUnits = Number((rNode.netUnits - 1).toFixed(2));
  }

  node.profitUnits = node.netUnits;
  rNode.profitUnits = rNode.netUnits;
  node.winRate = Math.round((node.won / node.totalChecked) * 100);
  rNode.winRate = Math.round((rNode.won / rNode.totalChecked) * 100);
  node.roi = Number(((node.netUnits / node.totalChecked) * 100).toFixed(1));
  node.roiPercent = node.roi;
}

function addPendingItemToNode(node, item) {
  const riskCat = item.riskCategory || 'medium';
  const rNode = node.byRisk[riskCat] || node.byRisk.medium;
  node.pendingCount++;
  rNode.pendingCount++;
}

export function buildCategoriesAndInsights() {
  enrichAllStateTips();

  const buildSportHierarchy = (sportId, schema) => {
    const groupMap = new Map();
    for (const g of schema) {
      const groupNode = createEmptyNodeStats({
        key: g.key,
        name: g.name,
        icon: g.icon,
        order: g.order,
        expandable: g.expandable
      });
      groupNode.subMap = new Map();
      if (Array.isArray(g.fixedSubs)) {
        for (const fsSub of g.fixedSubs) {
          groupNode.subMap.set(
            fsSub.key,
            createEmptyNodeStats({
              key: fsSub.key,
              name: fsSub.name,
              order: fsSub.order,
              isFixed: true
            })
          );
        }
      }
      groupMap.set(g.key, groupNode);
    }

    const histItems = (state.history || []).filter(h => Number(h.sportId) === sportId);
    for (const h of histItems) {
      const gKey = h.categoryGroupKey || classifyTipCategory(h).groupKey;
      const sKey = h.categorySubKey || classifyTipCategory(h).subKey;
      const sName = h.categorySubName || classifyTipCategory(h).subName;

      const gNode = groupMap.get(gKey) || groupMap.get(sportId === 5 ? 'tennis_top' : 'other');
      if (!gNode) continue;

      addHistoryItemToNode(gNode, h);

      if (!gNode.subMap.has(sKey)) {
        gNode.subMap.set(
          sKey,
          createEmptyNodeStats({
            key: sKey,
            name: sName,
            order: 100 + gNode.subMap.size,
            isFixed: false
          })
        );
      }
      addHistoryItemToNode(gNode.subMap.get(sKey), h);
    }

    const pendItems = (state.pendingTips || []).filter(p => Number(p.sportId) === sportId);
    for (const p of pendItems) {
      const gKey = p.categoryGroupKey || classifyTipCategory(p).groupKey;
      const sKey = p.categorySubKey || classifyTipCategory(p).subKey;
      const sName = p.categorySubName || classifyTipCategory(p).subName;

      const gNode = groupMap.get(gKey) || groupMap.get(sportId === 5 ? 'tennis_top' : 'other');
      if (!gNode) continue;

      addPendingItemToNode(gNode, p);

      if (!gNode.subMap.has(sKey)) {
        gNode.subMap.set(
          sKey,
          createEmptyNodeStats({
            key: sKey,
            name: sName,
            order: 100 + gNode.subMap.size,
            isFixed: false
          })
        );
      }
      addPendingItemToNode(gNode.subMap.get(sKey), p);
    }

    return Array.from(groupMap.values())
      .sort((a, b) => a.order - b.order)
      .map(gNode => {
        const subCategories = Array.from(gNode.subMap.values()).sort((a, b) => {
          if (a.isFixed && b.isFixed) return a.order - b.order;
          if (a.isFixed) return -1;
          if (b.isFixed) return 1;
          const countDiff = (b.totalChecked + b.pendingCount) - (a.totalChecked + a.pendingCount);
          if (countDiff !== 0) return countDiff;
          return a.name.localeCompare(b.name, 'hu');
        });
        const { subMap, ...rest } = gNode;
        return {
          ...rest,
          subCategories
        };
      });
  };

  const footballCategories = buildSportHierarchy(1, FOOTBALL_CATEGORY_SCHEMA);
  const tennisCategories = buildSportHierarchy(5, TENNIS_CATEGORY_SCHEMA);

  // Extra Insights (Külön szeparálva: 1. Foci Top5/BL/EL/KL, 2. Foci Többi, 3. NFL, 4. Tenisz)
  const overallNode = createEmptyNodeStats({ key: 'overall', name: 'Összesített' });
  const sportNodes = {
    football: createEmptyNodeStats({ key: 'football', name: 'Labdarúgás (Foci)' }),
    tennis: createEmptyNodeStats({ key: 'tennis', name: 'Tenisz' }),
    nfl: createEmptyNodeStats({ key: 'nfl', name: 'Amerikai futball (NFL)' })
  };

  const sectionDefs = [
    {
      key: 'football_elite',
      icon: '👑',
      title: '⚽ Labdarúgás – Top 5 Liga / BL / EL / KL',
      shortTitle: 'Top5 / BL / EL / KL',
      subtitle: 'Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Bajnokok Ligája, Európa Liga, Konferencia Liga',
      accent: 'emerald'
    },
    {
      key: 'football_other',
      icon: '⚽',
      title: '⚽ Labdarúgás – Többi bajnokság & kupa',
      shortTitle: 'Többi Foci liga',
      subtitle: 'Magyar NB I & NB II, Top 5 másodosztály, Válogatott mérkőzések, Női foci és egyéb nemzetközi ligák',
      accent: 'teal'
    },
    {
      key: 'nfl',
      icon: '🏈',
      title: '🏈 Amerikai futball (NFL)',
      shortTitle: 'NFL',
      subtitle: 'NFL mérkőzések, csapat- és játékos-speciális piacok',
      accent: 'amber'
    },
    {
      key: 'tennis',
      icon: '🎾',
      title: '🎾 Tenisz (ATP / WTA / Challenger / ITF)',
      shortTitle: 'Tenisz',
      subtitle: 'Grand Slam, ATP, WTA, Challenger és ITF tornák',
      accent: 'sky'
    }
  ];

  const sections = {};
  const sectionMarketMaps = {};
  const sectionWinOddsTracker = {};

  for (const def of sectionDefs) {
    sections[def.key] = {
      ...def,
      summary: createEmptyNodeStats({ key: def.key, name: def.title }),
      byMarketType: []
    };
    sectionMarketMaps[def.key] = new Map();
    sectionWinOddsTracker[def.key] = { sum: 0, count: 0 };
  }

  const marketMap = new Map();
  let wonOddsSum = 0;
  let wonOddsCount = 0;

  for (const h of state.history || []) {
    addHistoryItemToNode(overallNode, h);
    const hOdds = Number(h.odds) || 0;
    const isWonValid = Boolean(h.won && h.status !== 'void' && hOdds > 1);
    if (isWonValid) {
      wonOddsSum += hOdds;
      wonOddsCount++;
    }

    const sId = Number(h.sportId || 1);
    if (sId === 1) addHistoryItemToNode(sportNodes.football, h);
    else if (sId === 5) addHistoryItemToNode(sportNodes.tennis, h);
    else if (sId === 16) addHistoryItemToNode(sportNodes.nfl, h);

    const mBucket = classifyMarketBucket(h.marketName, sId);
    if (!marketMap.has(mBucket.key)) {
      marketMap.set(mBucket.key, createEmptyNodeStats(mBucket));
    }
    addHistoryItemToNode(marketMap.get(mBucket.key), h);

    // Külön szeparált szekció (football_elite, football_other, nfl, tennis) frissítése
    const secMeta = getInsightSectionMeta(h);
    const secKey = secMeta.sectionKey;
    if (sections[secKey]) {
      addHistoryItemToNode(sections[secKey].summary, h);
      if (isWonValid) {
        sectionWinOddsTracker[secKey].sum += hOdds;
        sectionWinOddsTracker[secKey].count++;
      }
      const sMktMap = sectionMarketMaps[secKey];
      if (!sMktMap.has(mBucket.key)) {
        sMktMap.set(mBucket.key, createEmptyNodeStats(mBucket));
      }
      addHistoryItemToNode(sMktMap.get(mBucket.key), h);
    }
  }

  for (const p of state.pendingTips || []) {
    addPendingItemToNode(overallNode, p);
    const sId = Number(p.sportId || 1);
    if (sId === 1) addPendingItemToNode(sportNodes.football, p);
    else if (sId === 5) addPendingItemToNode(sportNodes.tennis, p);
    else if (sId === 16) addPendingItemToNode(sportNodes.nfl, p);

    const secMeta = getInsightSectionMeta(p);
    const secKey = secMeta.sectionKey;
    if (sections[secKey]) {
      addPendingItemToNode(sections[secKey].summary, p);
      const mBucket = classifyMarketBucket(p.marketName, sId);
      const sMktMap = sectionMarketMaps[secKey];
      if (!sMktMap.has(mBucket.key)) {
        sMktMap.set(mBucket.key, createEmptyNodeStats(mBucket));
      }
      addPendingItemToNode(sMktMap.get(mBucket.key), p);
    }
  }

  overallNode.avgWinOdds = wonOddsCount > 0 ? Number((wonOddsSum / wonOddsCount).toFixed(2)) : 0;

  for (const def of sectionDefs) {
    const sec = sections[def.key];
    const tr = sectionWinOddsTracker[def.key];
    sec.summary.avgWinOdds = tr.count > 0 ? Number((tr.sum / tr.count).toFixed(2)) : 0;
    sec.byMarketType = Array.from(sectionMarketMaps[def.key].values())
      .filter(m => m.totalChecked > 0 || m.pendingCount > 0)
      .sort((a, b) => b.totalChecked - a.totalChecked);
  }

  const byMarketType = Array.from(marketMap.values()).sort((a, b) => b.totalChecked - a.totalChecked);

  return {
    categories: {
      football: footballCategories,
      tennis: tennisCategories
    },
    extraInsights: {
      overall: overallNode,
      bySport: sportNodes,
      byMarketType,
      sectionOrder: sectionDefs.map(d => d.key),
      sections
    }
  };
}

// Kiszámolja egy adott tipphez (sportág + Foci Top5/BL/EL/KL vs. Többi csoport + piactípus + kockázati szint alapján),
// hogy eddig hány %-os találati aránnyal jött be!
export function getTipHistoricalHitRate(tip = {}, fallbackContext = {}, prebuiltInsights = null) {
  const insights = prebuiltInsights || buildCategoriesAndInsights().extraInsights;
  const secMeta = getInsightSectionMeta(tip, fallbackContext);
  const mBucket = classifyMarketBucket(tip.marketName || tip.market || '', secMeta.sportId);
  const riskInfo = determineRiskCategory(tip);
  const riskCat = riskInfo.category || 'medium'; // 'low' | 'medium' | 'high'
  const riskLabel = riskInfo.label || (riskCat === 'low' ? 'Alacsony' : riskCat === 'high' ? 'Magas' : 'Közepes');

  const sec = insights?.sections?.[secMeta.sectionKey];
  const secSummary = sec?.summary || { totalChecked: 0, won: 0, winRate: 0, byRisk: {} };
  const marketInSec = (sec?.byMarketType || []).find(m => m.key === mBucket.key);

  const rMkt = marketInSec?.byRisk?.[riskCat] || { totalChecked: 0, won: 0, winRate: 0, pendingCount: 0 };
  const rSec = secSummary?.byRisk?.[riskCat] || { totalChecked: 0, won: 0, winRate: 0, pendingCount: 0 };

  // 1. Ha ebben a csoportban az adott piactípuson ÉS az adott kockázati szinten már van kiértékelt tipp:
  if (rMkt.totalChecked > 0) {
    const otherRisksNote = marketInSec && marketInSec.totalChecked > rMkt.totalChecked
      ? ` (Összes kockázati szinten ezen a piacon: ${marketInSec.winRate}% • ${marketInSec.won}/${marketInSec.totalChecked})`
      : '';
    return {
      sectionKey: secMeta.sectionKey,
      groupShortLabel: secMeta.shortGroupLabel,
      groupFullLabel: secMeta.groupFullLabel,
      marketKey: mBucket.key,
      marketName: mBucket.name,
      marketShortName: mBucket.shortName,
      riskCategory: riskCat,
      riskLabel,
      winRate: rMkt.winRate,
      won: rMkt.won,
      totalChecked: rMkt.totalChecked,
      scope: 'market_and_risk_in_group',
      shortText: `${secMeta.shortGroupLabel}: ${mBucket.shortName} (${riskLabel}) • ${rMkt.winRate}% (${rMkt.won}/${rMkt.totalChecked})`,
      tooltip: `${secMeta.groupFullLabel} • ${mBucket.name} piacon ${riskLabel} kockázati szinten eddigi találati arány: ${rMkt.winRate}% (${rMkt.won}/${rMkt.totalChecked} nyert)${otherRisksNote}`
    };
  }

  // 2. Ha ezen a piacon ezen a kockázati szinten még nincs lezárt tipp (0/0), de a kategóriában (pl. Többi foci liga) ezen a kockázati szinten már van:
  if (rSec.totalChecked > 0) {
    const otherRisksNote = marketInSec && marketInSec.totalChecked > 0
      ? ` Más kockázati szinteken a(z) ${mBucket.name} piacon: ${marketInSec.winRate}% (${marketInSec.won}/${marketInSec.totalChecked}).`
      : '';
    return {
      sectionKey: secMeta.sectionKey,
      groupShortLabel: secMeta.shortGroupLabel,
      groupFullLabel: secMeta.groupFullLabel,
      marketKey: mBucket.key,
      marketName: mBucket.name,
      marketShortName: mBucket.shortName,
      riskCategory: riskCat,
      riskLabel,
      winRate: null,
      won: 0,
      totalChecked: 0,
      groupRiskWinRate: rSec.winRate,
      groupRiskWon: rSec.won,
      groupRiskTotal: rSec.totalChecked,
      scope: 'risk_in_group',
      shortText: `${secMeta.shortGroupLabel}: ${mBucket.shortName} (${riskLabel}) • 0/0 (${riskLabel} össz: ${rSec.winRate}%)`,
      tooltip: `${secMeta.groupFullLabel} • ${mBucket.name} piacon ${riskLabel} kockázati szinten még nincs lezárt tipp (0/0). A kategóriában az összes ${riskLabel} kockázatú tipp találati aránya: ${rSec.winRate}% (${rSec.won}/${rSec.totalChecked} nyert).${otherRisksNote}`
    };
  }

  // 3. Ha ebben a kategóriában ezen a kockázati szinten még egyetlen lezárt tipp sincs (0/0):
  const otherRisksNote = marketInSec && marketInSec.totalChecked > 0
    ? ` Más kockázati szinteken ezen a piacon eddig: ${marketInSec.winRate}% (${marketInSec.won}/${marketInSec.totalChecked} nyert).`
    : '';
  return {
    sectionKey: secMeta.sectionKey,
    groupShortLabel: secMeta.shortGroupLabel,
    groupFullLabel: secMeta.groupFullLabel,
    marketKey: mBucket.key,
    marketName: mBucket.name,
    marketShortName: mBucket.shortName,
    riskCategory: riskCat,
    riskLabel,
    winRate: null,
    won: 0,
    totalChecked: 0,
    scope: 'none',
    shortText: `${secMeta.shortGroupLabel}: ${mBucket.shortName} (${riskLabel}) • 0/0 (új)`,
    tooltip: `${secMeta.groupFullLabel} • ${mBucket.name} piacon ${riskLabel} kockázati szinten még nincs lezárt múltbeli minta (0/0).${otherRisksNote}`
  };
}

export function attachHistoricalAccuracyToTips(tips = [], fallbackContext = {}) {
  if (!Array.isArray(tips) || tips.length === 0) return tips;
  const insights = buildCategoriesAndInsights().extraInsights;
  for (const t of tips) {
    if (!t) continue;
    t.historicalAccuracy = getTipHistoricalHitRate(t, fallbackContext, insights);
  }
  return tips;
}

// 4. Új tipp felvétele a várólistába (duplikáció szűréssel)
export function recordTip(tip, source = 'manual', skipSave = false) {
  if (!tip) return false;

  const sportId = normalizeSportId(tip.sportId || tip.sportName, tip.competitionName);
  if (!sportId) return false; // Kizárólag Foci (1), Tenisz (5), NFL (16) kerül tárolásra!

  const eventName = tip.eventName || tip.matchName || '';
  const eventDate = tip.eventDate || '';
  const marketName = tip.marketName || tip.market || '';
  const outcomeName = tip.outcomeName || tip.outcome || '';
  const odds = Number(tip.odds) || 0;

  if (!eventName || !marketName || !outcomeName) return false;

  const tipId = generateTipId(sportId, eventName, eventDate, marketName, outcomeName);

  // Ha kliens-szinkronból jön egy már felülírt/lecserélt régi tipp, vagy olyan meccsre, amely már ki van értékelve a history-ban / van frissebb elemzése, ignoráljuk!
  if (source === 'client_sync') {
    if (Array.isArray(state.replacedTipIds) && state.replacedTipIds.includes(tipId)) return false;
    if (tip.id && Array.isArray(state.replacedTipIds) && state.replacedTipIds.includes(tip.id)) return false;
    const mKey = normalizeMatchKey(eventName);
    const datePrefix = String(eventDate || '').slice(0, 10);
    if (mKey && state.pendingTips.some(t => normalizeMatchKey(t.eventName) === mKey)) return false;
    if (mKey && Array.isArray(state.history) && state.history.some(h => normalizeMatchKey(h.eventName) === mKey && (!datePrefix || String(h.eventDate || '').slice(0, 10) === datePrefix))) {
      return false;
    }
  }

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

  const newPendingItem = enrichTipWithCategory({
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

  state.pendingTips.push(newPendingItem);

  if (!skipSave) {
    saveState();
  }
  return true;
}

// Kötegelt tipp felvétel (újraelemzéskor a korábbi függő tippek lecserélésével!)
export function recordTipsBatch(tipsList = [], source = 'batch', options = {}) {
  if (!Array.isArray(tipsList) || tipsList.length === 0) return 0;

  if (!Array.isArray(state.replacedTipIds)) state.replacedTipIds = [];
  let stateModified = false;

  // Ha nem pusztán kliens-szinkronról van szó, akkor az adott mérkőzések korábbi függő (pending) tippjeit lecseréljük az új elemzésre!
  if (source !== 'client_sync') {
    const incomingMatchKeys = new Set(
      [
        ...tipsList.map(t => normalizeMatchKey(t?.eventName || t?.matchName || '')),
        ...(Array.isArray(options.targetEventNames) ? options.targetEventNames.map(n => normalizeMatchKey(n)) : [])
      ].filter(Boolean)
    );

    const replaceInterval = Boolean(options.replaceInterval && source === 'homepage_interval');
    const targetSportId = options.sportId && options.sportId !== 'all' ? Number(options.sportId) : null;

    // Kiszámoljuk az új elemzésben érkező tipId-kat
    const incomingTipIds = new Set();
    for (const tip of tipsList) {
      const sId = normalizeSportId(tip?.sportId || tip?.sportName);
      const evName = tip?.eventName || tip?.matchName || '';
      const evDate = tip?.eventDate || '';
      const mName = tip?.marketName || tip?.market || '';
      const oName = tip?.outcomeName || tip?.outcome || '';
      if (sId && evName && mName && oName) {
        incomingTipIds.add(generateTipId(sId, evName, evDate, mName, oName));
      }
    }

    // Megkeressük a lecserélendő régi függő tippeket
    const remainingPending = [];
    for (const pt of state.pendingTips) {
      const ptMatchKey = normalizeMatchKey(pt.eventName);
      const sameMatch = ptMatchKey && incomingMatchKeys.has(ptMatchKey);
      const sameIntervalBatch = replaceInterval && pt.source === 'homepage_interval' && (!targetSportId || Number(pt.sportId) === targetSportId);

      if (sameMatch || sameIntervalBatch) {
        stateModified = true;
        if (pt.id && !incomingTipIds.has(pt.id)) {
          if (!state.replacedTipIds.includes(pt.id)) {
            state.replacedTipIds.push(pt.id);
          }
        }
        state.seenTipIds = state.seenTipIds.filter(id => id !== pt.id);
      } else {
        remainingPending.push(pt);
      }
    }
    state.pendingTips = remainingPending;

    // Biztosítjuk, hogy az új elemzés tippjei (még ha valamelyik szerepelt is korábban) bekerüljenek!
    for (const newId of incomingTipIds) {
      state.seenTipIds = state.seenTipIds.filter(id => id !== newId);
      state.replacedTipIds = state.replacedTipIds.filter(id => id !== newId);
    }

    if (state.replacedTipIds.length > 2000) {
      state.replacedTipIds = state.replacedTipIds.slice(-2000);
    }
  }

  let addedCount = 0;
  for (const tip of tipsList) {
    if (recordTip(tip, source, true)) {
      addedCount++;
      stateModified = true;
    }
  }

  if (stateModified) {
    saveState();
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

  const { categories, extraInsights } = buildCategoriesAndInsights();

  return {
    ok: true,
    updatedAt: state.updatedAt,
    resetAt: state.resetAt || null,
    stats: statsWithPending,
    categories,
    extraInsights,
    pendingCount: state.pendingTips.length,
    pendingBySport,
    pendingTipsSummary: state.pendingTips.slice(0, 150).map(t => {
      enrichTipWithCategory(t);
      return {
        id: t.id,
        sportId: t.sportId,
        sportName: t.sportName,
        eventName: t.eventName,
        eventDate: t.eventDate,
        competitionName: t.competitionName || '',
        categoryGroupKey: t.categoryGroupKey || '',
        categoryGroupName: t.categoryGroupName || '',
        categorySubKey: t.categorySubKey || '',
        categorySubName: t.categorySubName || '',
        marketName: t.marketName,
        outcomeName: t.outcomeName,
        odds: t.odds,
        riskLevel: t.riskLevel,
        riskCategory: t.riskCategory,
        riskScore: t.riskScore,
        source: t.source,
        status: 'pending'
      };
    }),
    historyCount: (state.history || []).length,
    history: (state.history || []).slice(0, 300)
  };
}

// Lekérdezi az előzményeket (szűrhető: sportId, riskCategory, status, categoryGroup, categorySub)
export function getHistory(filters = {}) {
  let list = Array.isArray(state.history) ? [...state.history] : [];
  for (const t of list) {
    enrichTipWithCategory(t);
  }
  if (filters.sportId && filters.sportId !== 'all') {
    const sId = Number(filters.sportId);
    list = list.filter(t => {
      const tipSportId = Number(t.sportId || (t.sportName?.includes('Tenisz') ? 5 : (t.sportName?.includes('futball') || t.sportName?.includes('NFL') ? 16 : 1)));
      return tipSportId === sId;
    });
  }
  if (filters.categoryGroup && filters.categoryGroup !== 'all') {
    list = list.filter(t => t.categoryGroupKey === filters.categoryGroup);
  }
  if (filters.categorySub && filters.categorySub !== 'all') {
    list = list.filter(t => t.categorySubKey === filters.categorySub);
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

  const historyItem = enrichTipWithCategory({
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
    riskLevel: riskInfo.level || riskInfo.label,
    won: Boolean(item.won),
    finalScore: item.finalScore || null,
    verificationMethod: item.verificationMethod || 'manual_sync',
    evaluatedAt: item.evaluatedAt || new Date().toISOString(),
    status: item.won ? 'won' : 'lost'
  });

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

// 6. Eredmény-ellenőrző háttérmotor (Hivatalos TippmixPro API + Hivatalos Tippmix API + Kötegelt Gemini Fallback)
const TIPPMIXPRO_RESULTS_BASE = 'https://sports-api.glastcoper.com/historical-results/api/v1/results-page';
const TIPPMIXPRO_OPERATOR_ID = '2901';
const TIPPMIX_RESULTS_URL = 'https://api.tippmix.hu/v2/tippmix/results';

const resultsCache = new Map(); // key: `${sportId}_${date}`, val: { data, ts }
const proResultsCache = new Map(); // key: `pro_${proSportId}_${date}`, val: { data, ts }
const proMatchDetailsCache = new Map(); // key: `pro_detail_${matchId}`, val: { data, ts }

function mapInternalSportToProSportId(sportId = 1) {
  const s = Number(sportId);
  if (s === 5) return '3';  // Tenisz
  if (s === 16) return '5'; // Amerikai futball (NFL)
  return '1';               // Labdarúgás (Foci)
}

export async function fetchTippmixProOfficialResults(sportId = 1, dateStr) {
  const proSportId = mapInternalSportToProSportId(sportId);
  const dateKey = String(dateStr || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const cacheKey = `pro_${proSportId}_${dateKey}`;
  const now = Date.now();

  if (proResultsCache.has(cacheKey)) {
    const cached = proResultsCache.get(cacheKey);
    if (now - cached.ts < 5 * 60 * 1000) {
      return cached.data;
    }
  }

  try {
    const res = await fetch(`${TIPPMIXPRO_RESULTS_BASE}/matches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OperatorId': TIPPMIXPRO_OPERATOR_ID,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        sportId: proSportId,
        lang: 'hu',
        startDate: dateKey,
        endDate: dateKey,
        eventsLimit: 200,
        offset: 0,
        deviceName: 'small'
      })
    });

    if (!res.ok) return [];
    const json = await res.json();
    const list = Array.isArray(json?.response) ? json.response : [];
    proResultsCache.set(cacheKey, { data: list, ts: now });
    return list;
  } catch (err) {
    console.warn(`⚠️ TippmixPro results lekérési hiba (${sportId}, ${dateKey}):`, err.message);
    return [];
  }
}

export async function fetchTippmixProMatchDetails(matchId) {
  const mId = String(matchId || '').trim();
  if (!mId) return null;
  const now = Date.now();

  if (proMatchDetailsCache.has(mId)) {
    const cached = proMatchDetailsCache.get(mId);
    if (now - cached.ts < 15 * 60 * 1000) {
      return cached.data;
    }
  }

  try {
    const res = await fetch(`${TIPPMIXPRO_RESULTS_BASE}/match-details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OperatorId': TIPPMIXPRO_OPERATOR_ID,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        matchId: mId,
        lang: 'hu',
        deviceName: 'extended'
      })
    });

    if (!res.ok) return null;
    const json = await res.json();
    const resp = json?.response;
    if (!resp || !Array.isArray(resp.outcomeEntities)) return null;

    // Összeépítjük a lezárt piacokat és kimeneteleket (statusId: 2 = Nyertes, 3 = Vesztes, 8 = Törölve/Void)
    const outcomesById = new Map();
    for (const o of resp.outcomeEntities) {
      if (!o || !o.id) continue;
      let result = null;
      const stName = String(o.statusName || '').toLowerCase();
      if (o.statusId === 2 || stName === 'nyertes' || stName === 'winner') result = 'winner';
      else if (o.statusId === 3 || stName === 'vesztes' || stName === 'loser') result = 'loser';
      else if (o.statusId === 8 || stName === 'törölve' || stName === 'void') result = 'void';

      outcomesById.set(String(o.id), {
        id: String(o.id),
        name: String(o.translatedName || o.shortTranslatedName || o.typeName || '').trim(),
        paramFloat1: o.paramFloat1,
        result
      });
    }

    const outIdsByMarket = new Map();
    for (const rel of (resp.marketOutcomeRelationEntities || [])) {
      if (!rel || !rel.marketId || !rel.outcomeId) continue;
      const mKey = String(rel.marketId);
      if (!outIdsByMarket.has(mKey)) outIdsByMarket.set(mKey, []);
      outIdsByMarket.get(mKey).push(String(rel.outcomeId));
    }

    const markets = [];
    const seenMarkets = new Set();
    for (const grp of (resp.marketGroupsWithMarkets || [])) {
      for (const m of (grp?.marketEntities || [])) {
        if (!m || !m.id || seenMarkets.has(String(m.id))) continue;
        seenMarkets.add(String(m.id));
        const oIds = outIdsByMarket.get(String(m.id)) || [];
        const mOutcomes = oIds.map(id => outcomesById.get(id)).filter(Boolean);
        if (mOutcomes.length > 0) {
          markets.push({
            id: String(m.id),
            name: String(m.displayName || m.name || m.bettingTypeName || '').trim(),
            rawName: String(m.name || '').trim(),
            outcomes: mOutcomes
          });
        }
      }
    }

    let fulltimeScore = null;
    const scores = Array.isArray(resp.eventPartScoreEntities) ? resp.eventPartScoreEntities : [];
    const mainScore = scores.find(s =>
      s.eventInfoTypeName === 'Score' &&
      (s.eventPartId === 3 || s.eventPartId === 30 || /rendes|hosszabbítással|ordinary/i.test(s.eventPartName || ''))
    ) || scores.find(s => s.eventInfoTypeName === 'Score');

    if (mainScore && typeof mainScore.homeScore !== 'undefined') {
      fulltimeScore = {
        participant1Score: mainScore.homeScore,
        participant2Score: mainScore.awayScore
      };
    }

    const formatted = {
      id: mId,
      name: resp.match?.name || '',
      fulltimeScore,
      markets
    };

    proMatchDetailsCache.set(mId, { data: formatted, ts: now });
    return formatted;
  } catch (err) {
    console.warn(`⚠️ TippmixPro match-details hiba (${mId}):`, err.message);
    return null;
  }
}

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

  const historyItem = enrichTipWithCategory({
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
  });

  if (!Array.isArray(state.history)) state.history = [];
  const existingHistIdx = state.history.findIndex(h => h.id === historyItem.id);
  if (existingHistIdx >= 0) {
    state.history[existingHistIdx] = historyItem;
  } else {
    state.history.unshift(historyItem);
    if (state.history.length > 2500) {
      state.history = state.history.slice(0, 2500);
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

    // 2. LÉPÉS: HIVATALOS TIPPMIXPRO & TIPPMIX EREDMÉNYEK (0 AI token, automatikus winner/loser/void, beleértve a Játékos-piacokat is!)
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9\u00C0-\u017F]/g, '');
    const stripPeriod = s => String(s || '').replace(/\s*-\s*(rendes játékidő|hosszabbítással)$/i, '').trim();
    const cleanMarket = m => stripPeriod(String(m || '').split('(')[0]).trim().toLowerCase();
    const baseMarketType = m => cleanMarket(m).replace(/[0-9,.\-+]+/g, '').replace(/\s+/g, ' ').trim();

    const tryMatchMarketAndOutcome = (matchedEv, tip) => {
      if (!matchedEv || !Array.isArray(matchedEv.markets)) return null;

      let market = matchedEv.markets.find(m =>
        cleanMarket(m.name) === cleanMarket(tip.marketName) ||
        norm(m.name) === norm(tip.marketName) ||
        (m.rawName && (cleanMarket(m.rawName) === cleanMarket(tip.marketName) || norm(m.rawName) === norm(tip.marketName)))
      );

      let outcome = null;
      if (market && Array.isArray(market.outcomes)) {
        outcome = market.outcomes.find(o => norm(o.name) === norm(tip.outcomeName));
      }

      // Fallback A: Ha a piactípus egyezik (pl. TippmixPro-n a lezárt piac neve "Gólszám - Rendes játékidő" vagy "Büntetőlap-szám",
      // a tippben pedig "Gólszám 2.5 - Rendes játékidő" vagy "Alvin Kamara elkapott yard-jainak száma 13.5"),
      // megkeressük ugyanazon alaptípusú piacon a pontos kimenetelt (pl. "Több, mint 2.5" vagy "Alvin Kamara: Több, mint 13.5")!
      if (!outcome) {
        const targetBase = baseMarketType(tip.marketName);
        const sameTypeMarketWithOutcome = matchedEv.markets.find(m =>
          (baseMarketType(m.name) === targetBase || (m.rawName && baseMarketType(m.rawName) === targetBase)) &&
          Array.isArray(m.outcomes) &&
          m.outcomes.some(o => norm(o.name) === norm(tip.outcomeName))
        );
        if (sameTypeMarketWithOutcome) {
          market = sameTypeMarketWithOutcome;
          outcome = sameTypeMarketWithOutcome.outcomes.find(o => norm(o.name) === norm(tip.outcomeName));
        }
      }

      // Fallback B: Ha a kimenetel egyedi játékos-kimenetel (pl. "Alvin Kamara: Több, mint 13.5" vagy "Odunze Rome: Több, mint 3.5"),
      // és pontosan egyezik egy lezárt kimenetellel ugyanabban a periódusban
      if (!outcome && String(tip.outcomeName || '').includes(':')) {
        for (const m of matchedEv.markets) {
          if (!Array.isArray(m.outcomes)) continue;
          const foundOut = m.outcomes.find(o => norm(o.name) === norm(tip.outcomeName));
          if (foundOut) {
            market = m;
            outcome = foundOut;
            break;
          }
        }
      }

      // Fallback C: Ha a piac pontosan megvan (határértékkel együtt), és a kimenetel "Több, mint..." vagy "Kevesebb, mint..."
      if (!outcome && market && Array.isArray(market.outcomes) && market.outcomes.length === 2) {
        const outLower = String(tip.outcomeName || '').toLowerCase();
        if (outLower.startsWith('több, mint') || outLower.startsWith('kevesebb, mint')) {
          const dirPrefix = outLower.startsWith('több, mint') ? 'több, mint' : 'kevesebb, mint';
          outcome = market.outcomes.find(o => String(o.name || '').toLowerCase().startsWith(dirPrefix));
        }
      }

      if (outcome && (outcome.result === 'winner' || outcome.result === 'loser' || outcome.result === 'void')) {
        let score = null;
        if (matchedEv.fulltimeScore && typeof matchedEv.fulltimeScore.participant1Score !== 'undefined') {
          score = `${matchedEv.fulltimeScore.participant1Score}-${matchedEv.fulltimeScore.participant2Score}`;
        }
        return {
          won: outcome.result === 'winner',
          isVoid: outcome.result === 'void',
          score
        };
      }
      return null;
    };

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

      // 2A. Elsődleges: Hivatalos TippmixPro Historical Results API (5000+ kiértékelt kimenetel/meccs, játékos-piacokkal!)
      if (tip.eventId && String(tip.eventId).length >= 15) {
        const proDetails = await fetchTippmixProMatchDetails(String(tip.eventId));
        const evalRes = tryMatchMarketAndOutcome(proDetails, tip);
        if (evalRes) {
          applyEvaluationResult(tip, { ...evalRes, method: 'tippmixpro_official' });
          statsChanged = true;
          verified = true;
        }
      }

      for (const d of datesToTry) {
        if (verified) break;
        const proList = await fetchTippmixProOfficialResults(tip.sportId, d);
        if (Array.isArray(proList) && proList.length > 0) {
          const matchedProSummary = proList.find(item => {
            const me = item?.matchEntity;
            if (!me) return false;
            if (tip.eventId && String(me.id) === String(tip.eventId)) return true;
            return norm(me.name) === norm(tip.eventName);
          });
          if (matchedProSummary?.matchEntity?.id) {
            const proDetails = await fetchTippmixProMatchDetails(matchedProSummary.matchEntity.id);
            const evalRes = tryMatchMarketAndOutcome(proDetails, tip);
            if (evalRes) {
              applyEvaluationResult(tip, { ...evalRes, method: 'tippmixpro_official' });
              statsChanged = true;
              verified = true;
              break;
            }
          }
        }
      }

      // 2B. Másodlagos (Fallback): Hivatalos api.tippmix.hu/v2/tippmix/results
      for (const d of datesToTry) {
        if (verified) break;
        const events = await fetchTippmixOfficialResults(tip.sportId, d);
        if (!Array.isArray(events) || events.length === 0) continue;

        const matchedEv = events.find(e =>
          (tip.eventId && String(e.id) === String(tip.eventId)) ||
          norm(e.name) === norm(tip.eventName)
        );

        const evalRes = tryMatchMarketAndOutcome(matchedEv, tip);
        if (evalRes) {
          applyEvaluationResult(tip, { ...evalRes, method: 'tippmix_official' });
          statsChanged = true;
          verified = true;
        }
      }

      if (!verified) {
        unverifiedTips.push(tip);
      }
    }

    // 3. Ha maradt ellenőrizendő tipp, és már legalább 12 óra eltelt a kezdés óta (hogy a hivatalos TippmixPro / Tippmix lezárást megvárjuk, és az AI soha ne tippeljen be félkész/friss meccset):
    const geminiEligibleTips = unverifiedTips.filter(t => {
      const evTime = new Date(t.eventDate).getTime();
      return !isNaN(evTime) && (now - evTime) >= 12 * 3600 * 1000;
    });

    if (geminiEligibleTips.length > 0 && callGeminiFn && process.env.GEMINI_API_KEY) {
      // Csoportosítás mérkőzés szerint
      const matchMap = new Map();
      for (const tip of geminiEligibleTips) {
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

      if (Array.isArray(remoteState.replacedTipIds)) {
        const repSet = new Set(state.replacedTipIds || []);
        for (const rid of remoteState.replacedTipIds) {
          repSet.add(rid);
        }
        state.replacedTipIds = Array.from(repSet).slice(-2000);
      }

      // FÜGGŐ TIPPEK UNIÓJA (a már lecserélt/felülírt régi tippek kihagyásával):
      const replacedSet = new Set(state.replacedTipIds || []);
      state.pendingTips = (state.pendingTips || []).filter(t => t && !replacedSet.has(t.id));
      const existingIds = new Set(state.pendingTips.map(t => t.id));
      const existingMatchKeys = new Set(state.pendingTips.map(t => normalizeMatchKey(t.eventName)).filter(Boolean));
      if (Array.isArray(remoteState.pendingTips)) {
        for (const rt of remoteState.pendingTips) {
          if (rt && rt.id && !existingIds.has(rt.id) && !replacedSet.has(rt.id)) {
            const rtMatchKey = normalizeMatchKey(rt.eventName);
            // Ha helyben már van frissebb elemzés ugyanarra a meccsre, ne tegyük vissza a régit
            if (rtMatchKey && existingMatchKeys.has(rtMatchKey)) continue;
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

      // ELŐZMÉNYEK UNIÓJA (a lecserélt/törölt duplikátumok kihagyásával)
      if (Array.isArray(remoteState.history)) {
        const histMap = new Map();
        for (const h of state.history || []) {
          if (h && h.id && !replacedSet.has(h.id)) histMap.set(h.id, h);
        }
        for (const h of remoteState.history) {
          if (h && h.id && !histMap.has(h.id) && !replacedSet.has(h.id)) {
            histMap.set(h.id, h);
          }
        }
        state.history = Array.from(histMap.values())
          .sort((a, b) => new Date(b.evaluatedAt || 0) - new Date(a.evaluatedAt || 0))
          .slice(0, 2500);
      }

      // Biztosítjuk, hogy ami már bekerült a kiértékelt history-ba, az soha ne maradjon bent a pendingTips-ben!
      const evaluatedIds = new Set((state.history || []).map(h => h?.id).filter(Boolean));
      state.pendingTips = (state.pendingTips || []).filter(p => p && !evaluatedIds.has(p.id));

      enrichAllStateTips();

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
