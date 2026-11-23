// ============================================================================
// SmartTippmixPro - Segédfüggvények, Formázók és Helyi Mentés (Utils)
// ============================================================================

import { state, LS_PENDING_KEY } from './state.js';

function classifyClientMarketBucket(marketName = '', sportId = 1) {
  const m = String(marketName || '').toLowerCase();
  const sId = Number(sportId) || 1;
  if (sId === 5 && (m.includes('játszma') || m.includes('játékszám') || m.includes('szett'))) {
    return { key: 'tennis_sets_games', shortName: 'játszma / játékszám' };
  }
  if (m.includes('büntetőlap') || m.includes('sárga lap') || m.includes('kiállítás')) {
    return { key: 'cards', shortName: 'büntetőlapok' };
  }
  if (m.includes('szöglet')) {
    return { key: 'corners', shortName: 'szögletszám' };
  }
  if (m.includes('mindkét csapat')) {
    return { key: 'btts', shortName: 'mindkét csapat gól' };
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
    return { key: 'player_special', shortName: 'játékos / speciális' };
  }
  if (m.includes('hendikep')) {
    return { key: 'handicap', shortName: 'hendikep' };
  }
  if (m.includes('gólszám') || m.includes('pontszám')) {
    return { key: 'over_under', shortName: sId === 16 ? 'pontszám' : 'gólszám' };
  }
  if (m.includes('kétesély')) {
    return { key: 'double_chance', shortName: 'kétesély' };
  }
  if (m.includes('tét visszajár')) {
    return { key: 'dnb', shortName: 'tét visszajár (DNB)' };
  }
  if (m === '1x2' || m.startsWith('1x2') || m.includes('1. félidő - 1x2') || m.includes('mérkőzés győztese') || m.startsWith('ki nyeri')) {
    return { key: '1x2', shortName: sId === 1 ? '1X2' : 'mérkőzés győztese' };
  }
  if (sId === 5) {
    return { key: 'tennis_sets_games', shortName: 'játszma / játékszám' };
  }
  return { key: 'other_market', shortName: 'speciális' };
}

function detectClientSectionMeta(tip = {}, fallbackContext = {}) {
  const sRaw = String(tip.sportId || tip.sportName || fallbackContext.sportId || fallbackContext.sportName || '1').toLowerCase();
  if (sRaw === '16' || sRaw.includes('nfl') || sRaw.includes('amerikai')) {
    return { sectionKey: 'nfl', sportId: 16, shortGroupLabel: 'NFL', groupFullLabel: '🏈 Amerikai futball (NFL)' };
  }
  if (sRaw === '5' || sRaw.includes('tenisz') || sRaw.includes('tennis')) {
    return { sectionKey: 'tennis', sportId: 5, shortGroupLabel: 'Tenisz', groupFullLabel: '🎾 Tenisz' };
  }

  const comp = String(tip.competitionName || fallbackContext.competitionName || '').toLowerCase();
  const isWomen = /női|\bnoi\b|women|femenin|frauen|femminil/i.test(comp);
  const isLowerOrCup = /(\b[2345]\.|championship|serie b|la liga 2|laliga 2|bundesliga 2|2\. bundesliga|ligue 2|kupa|cup|pokal|coppa|coupe|copa|supercup|szuperkupa)/i.test(comp);
  const isUefaClub =
    ((comp.includes('bajnokok ligája') || comp.includes('champions league') || /\bbl\b/.test(comp)) && !comp.includes('ázsia') && !comp.includes('afrika')) ||
    comp.includes('európa liga') || comp.includes('európa-liga') || comp.includes('europa league') ||
    comp.includes('konferencia liga') || comp.includes('konferencia-liga') || comp.includes('conference league') ||
    /\b(el|kl)\b/.test(comp);
  const isTop5 = !isLowerOrCup && !isWomen && (
    ((comp.includes('angol bajnokság') || comp.includes('premier league')) && !comp.includes('skót')) ||
    comp.includes('spanyol bajnokság') || comp.includes('laliga') || comp.includes('la liga') ||
    ((comp.includes('olasz bajnokság') || comp.includes('serie a')) && !comp.includes('brazil')) ||
    ((comp.includes('német bajnokság') || comp.includes('bundesliga')) && !comp.includes('osztrák')) ||
    comp.includes('francia bajnokság') || comp.includes('ligue 1')
  );

  if (!isWomen && (isUefaClub || isTop5)) {
    return { sectionKey: 'football_elite', sportId: 1, shortGroupLabel: 'Top liga', groupFullLabel: '⚽ Foci – Top 5 Liga / BL / EL / KL' };
  }
  return { sectionKey: 'football_other', sportId: 1, shortGroupLabel: 'Többi foci liga', groupFullLabel: '⚽ Foci – Többi bajnokság & kupa' };
}

export function getTipHistoricalAccuracyInfo(tip = {}, fallbackContext = {}) {
  const secMeta = detectClientSectionMeta(tip, fallbackContext);
  const mBucket = classifyClientMarketBucket(tip.marketName || tip.market || '', secMeta.sportId);

  if (tip?.historicalAccuracy && tip.historicalAccuracy.winRate !== undefined && tip.historicalAccuracy.winRate !== null) {
    const ha = tip.historicalAccuracy;
    const grp = ha.groupShortLabel === 'Top5/BL/EL/KL' ? 'Top liga'
      : ha.groupShortLabel === 'Többi Foci liga' ? 'Többi foci liga'
      : (ha.groupShortLabel || secMeta.shortGroupLabel);
    const mShort = ha.marketShortName || mBucket.shortName;
    return {
      ...ha,
      shortText: `${grp}: ${mShort} • ${ha.winRate}% (${ha.won}/${ha.totalChecked})`
    };
  }

  const sections = state.latestExtraInsightsData?.sections;
  const sec = sections?.[secMeta.sectionKey];
  if (sec) {
    const mNode = (sec.byMarketType || []).find(m => m.key === mBucket.key);
    if (mNode && mNode.totalChecked > 0) {
      return {
        sectionKey: secMeta.sectionKey,
        groupShortLabel: secMeta.shortGroupLabel,
        marketShortName: mBucket.shortName,
        winRate: mNode.winRate,
        won: mNode.won,
        totalChecked: mNode.totalChecked,
        shortText: `${secMeta.shortGroupLabel}: ${mBucket.shortName} • ${mNode.winRate}% (${mNode.won}/${mNode.totalChecked})`,
        tooltip: `${secMeta.groupFullLabel} • ${mNode.name} piacon eddigi találati arány: ${mNode.winRate}% (${mNode.won}/${mNode.totalChecked} nyert)`
      };
    }
    if (sec.summary && sec.summary.totalChecked > 0) {
      return {
        sectionKey: secMeta.sectionKey,
        groupShortLabel: secMeta.shortGroupLabel,
        marketShortName: mBucket.shortName,
        winRate: sec.summary.winRate,
        won: sec.summary.won,
        totalChecked: sec.summary.totalChecked,
        shortText: `${secMeta.shortGroupLabel}: ${mBucket.shortName} • ${sec.summary.winRate}% (${sec.summary.won}/${sec.summary.totalChecked})`,
        tooltip: `${secMeta.groupFullLabel} kategóriában eddigi összesített találati arány: ${sec.summary.winRate}% (${sec.summary.won}/${sec.summary.totalChecked} nyert)`
      };
    }
  }
  return null;
}

export function renderTipHistoricalBadgeHtml(tip = {}, fallbackContext = {}, isCompact = false) {
  const info = getTipHistoricalAccuracyInfo(tip, fallbackContext);
  if (!info || !info.shortText) return '';

  const isElite = info.sectionKey === 'football_elite';
  const colorCls = isElite
    ? 'bg-emerald-950/85 border-emerald-400/45 text-emerald-200'
    : 'bg-indigo-950/85 border-indigo-400/45 text-indigo-200';
  const sizeCls = isCompact
    ? 'px-1.5 py-0.5 text-[9px]'
    : 'px-2 py-0.5 text-[10px]';

  return `
    <span class="inline-flex items-center gap-1 rounded-md border ${colorCls} ${sizeCls} font-extrabold leading-tight whitespace-nowrap shadow-sm"
      title="${escapeHtml(info.tooltip || info.shortText)}">
      <span>🎯</span>
      <span>${escapeHtml(info.shortText)}</span>
    </span>
  `;
}

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatHungarianDate(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const timeStr = d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Ma ${timeStr}`;
    if (isTomorrow) return `Holnap ${timeStr}`;
    return `${d.getMonth() + 1}.${d.getDate()} ${timeStr}`;
  } catch (_) {
    return isoStr;
  }
}

export function getSportIcon(sportId) {
  const id = Number(sportId);
  if (id === 1) return '⚽';
  if (id === 5) return '🎾';
  if (id === 16) return '🏈';
  return '🏅';
}

export function getRiskFilterShortLabel(rf) {
  if (rf === 'low') return '🟢 Alacsony kockázat';
  if (rf === 'medium') return '🟡 Közepes kockázat';
  if (rf === 'high') return '🔴 Magas kockázat';
  return '';
}

export function getRiskVisuals(level = '', score = 4) {
  const norm = (level || '').toLowerCase();
  const numScore = Math.min(10, Math.max(1, Number(score) || 4));

  if (norm.includes('alacsony') && !norm.includes('közepes') && numScore <= 3) {
    return {
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      barClass: 'bg-emerald-500',
      boxClass: 'bg-emerald-950/40 border-emerald-500/30',
      textClass: 'text-emerald-300',
      label: level || 'Alacsony kockázat',
      score: numScore
    };
  }
  if (norm.includes('magas') || numScore >= 7) {
    return {
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      barClass: 'bg-rose-500',
      boxClass: 'bg-rose-950/40 border-rose-500/30',
      textClass: 'text-rose-300',
      label: level || 'Magasabb kockázat',
      score: numScore
    };
  }
  return {
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    barClass: 'bg-amber-400',
    boxClass: 'bg-amber-950/35 border-amber-500/30',
    textClass: 'text-amber-300',
    label: level || 'Közepes kockázat',
    score: numScore
  };
}

export async function parseJsonResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (res.status === 502 || res.status === 503) {
      throw new Error('A szerver jelenleg épp frissül a felhőben (Render deploy). Kérlek várj kb. 20 másodpercet és próbáld újra!');
    }
    if (res.status === 504) {
      throw new Error('Időtúllépés történt az elemzés során. Kérlek próbáld újra!');
    }
    throw new Error(`A szerver átmenetileg nem válaszol (HTTP ${res.status}). Kérlek próbáld újra!`);
  }
  const data = await res.json();
  if (!res.ok || (data && data.ok === false)) {
    throw new Error(data?.error || `Hiba történt az elemzés közben (HTTP ${res.status})`);
  }
  return data;
}

export function normClientMatchKey(name = '') {
  return String(name || '').toLowerCase().replace(/[^a-z0-9\u00C0-\u017F]/g, '');
}

export function saveQueriedTipsLocally(tips = [], extraMatchNames = []) {
  if (!Array.isArray(tips) || tips.length === 0) return;
  try {
    const raw = localStorage.getItem(LS_PENDING_KEY);
    const existing = raw ? JSON.parse(raw) : [];

    // Újraelemzéskor az adott mérkőzés(ek) korábbi tippjeit töröljük a helyi tárolóból, hogy kizárólag az új elemzés maradjon meg
    const incomingMatchKeys = new Set(
      [
        ...tips.map(t => normClientMatchKey(t?.eventName)),
        ...extraMatchNames.map(n => normClientMatchKey(n))
      ].filter(Boolean)
    );

    const map = new Map();
    for (const t of existing) {
      if (t && (t.id || (t.eventName && t.outcomeName))) {
        const mKey = normClientMatchKey(t.eventName);
        if (mKey && incomingMatchKeys.has(mKey)) continue;
        const key = t.id || `${t.eventName}-${t.marketName}-${t.outcomeName}`;
        map.set(key, t);
      }
    }
    for (const t of tips) {
      if (t && (t.eventName && t.outcomeName)) {
        const key = t.id || `${t.eventName}-${t.marketName}-${t.outcomeName}`;
        map.set(key, { ...t, savedAt: Date.now() });
      }
    }
    const combined = Array.from(map.values()).slice(-200);
    localStorage.setItem(LS_PENDING_KEY, JSON.stringify(combined));
  } catch (e) {
    console.warn('LocalStorage mentési hiba:', e);
  }
}
