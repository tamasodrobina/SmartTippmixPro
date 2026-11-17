// ============================================================================
// SmartTippmixPro - Segédfüggvények, Formázók és Helyi Mentés (Utils)
// ============================================================================

import { LS_PENDING_KEY } from './state.js';

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
