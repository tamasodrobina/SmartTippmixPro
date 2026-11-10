// ============================================================================
// SmartTippmixPro - Frontend Alkalmazás (Összes Főoldal + Sportág Nézet)
// ============================================================================

// Állapot (State)
let activeNav = 'all'; // 'all' (főoldal) | '1' (foci) | '5' (tenisz) | '16' (nfl)
let selectedCompetitionKeys = new Set();
let allCompetitions = [];
let currentLeagueMatches = [];
let loadingTimer = null;
let lastExecutedMode = 'interval';

// Navigációs elemek
const navBtnAll = document.getElementById('navBtnAll');
const navBtn1 = document.getElementById('navBtn1');
const navBtn5 = document.getElementById('navBtn5');
const navBtn16 = document.getElementById('navBtn16');
const sportCount1 = document.getElementById('sportCount1');
const sportCount5 = document.getElementById('sportCount5');
const sportCount16 = document.getElementById('sportCount16');

// Találati arány (Win Rate) sáv elemek (Foci, Tenisz, NFL)
const footballWinRate = document.getElementById('footballWinRate');
const footballWinCount = document.getElementById('footballWinCount');
const footballRiskLow = document.getElementById('footballRiskLow');
const footballRiskMed = document.getElementById('footballRiskMed');
const footballRiskHigh = document.getElementById('footballRiskHigh');
const footballPendingBadge = document.getElementById('footballPendingBadge');

const tennisWinRate = document.getElementById('tennisWinRate');
const tennisWinCount = document.getElementById('tennisWinCount');
const tennisRiskLow = document.getElementById('tennisRiskLow');
const tennisRiskMed = document.getElementById('tennisRiskMed');
const tennisRiskHigh = document.getElementById('tennisRiskHigh');
const tennisPendingBadge = document.getElementById('tennisPendingBadge');

const nflWinRate = document.getElementById('nflWinRate');
const nflWinCount = document.getElementById('nflWinCount');
const nflRiskLow = document.getElementById('nflRiskLow');
const nflRiskMed = document.getElementById('nflRiskMed');
const nflRiskHigh = document.getElementById('nflRiskHigh');
const nflPendingBadge = document.getElementById('nflPendingBadge');

const pendingTipsBadge = document.getElementById('pendingTipsBadge');

// Nézet szekciók
const mainHomeView = document.getElementById('mainHomeView');
const sportLeagueView = document.getElementById('sportLeagueView');

// Globális szűrők
const headerOddsBadge = document.getElementById('headerOddsBadge');
const minOddsInput = document.getElementById('minOddsInput');
const maxOddsInput = document.getElementById('maxOddsInput');
const tipsCountSelect = document.getElementById('tipsCountSelect');
const oddsPresetBtns = document.querySelectorAll('.odds-preset-btn');
const catalogStatusText = document.getElementById('catalogStatusText');

// Főoldal elemek (Intervallum + Egyedi meccskereső)
const hoursSelect = document.getElementById('hoursSelect');
const homeSportSelect = document.getElementById('homeSportSelect');
const analyzeIntervalBtn = document.getElementById('analyzeIntervalBtn');
const analyzeIntervalBtnLabel = document.getElementById('analyzeIntervalBtnLabel');
const quickHourBtns = document.querySelectorAll('.quick-hour-btn');

const customMatchInput = document.getElementById('customMatchInput');
const clearCustomInputBtn = document.getElementById('clearCustomInputBtn');
const autocompleteDropdown = document.getElementById('autocompleteDropdown');
const analyzeCustomBtn = document.getElementById('analyzeCustomBtn');
const analyzeCustomBtnLabel = document.getElementById('analyzeCustomBtnLabel');
let selectedAutocompleteEventId = null;

const loadingSection = document.getElementById('loadingSection');
const loadingTitle = document.getElementById('loadingTitle');
const loadingStepText = document.getElementById('loadingStepText');
const loadingProgressBar = document.getElementById('loadingProgressBar');

const errorSection = document.getElementById('errorSection');
const errorMessageText = document.getElementById('errorMessageText');

const resultsSection = document.getElementById('resultsSection');
const resultsMetaBadge = document.getElementById('resultsMetaBadge');
const cacheStatusBadge = document.getElementById('cacheStatusBadge');
const forceRefreshBtn = document.getElementById('forceRefreshBtn');
const analysisOverviewText = document.getElementById('analysisOverviewText');
const tipsContainer = document.getElementById('tipsContainer');

// Bajnokság & Meccs táblázat elemek (Sportág nézet - Kétlépcsős Dropdown)
const leagueSectionHeading = document.getElementById('leagueSectionHeading');
const countryGroupSelect = document.getElementById('countryGroupSelect');
const competitionSubSelect = document.getElementById('competitionSubSelect');
const countryTodayMatchesBadge = document.getElementById('countryTodayMatchesBadge');
const compTodayMatchesBadge = document.getElementById('compTodayMatchesBadge');

const matchesSectionTitle = document.getElementById('matchesSectionTitle');
const matchesCountBadge = document.getElementById('matchesCountBadge');
const leagueMatchesList = document.getElementById('leagueMatchesList');

// Modal elemek
const detailedModal = document.getElementById('detailedModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalRefreshBtn = document.getElementById('modalRefreshBtn');
const modalCacheBadge = document.getElementById('modalCacheBadge');
const modalSportBadge = document.getElementById('modalSportBadge');
const modalCompetitionBadge = document.getElementById('modalCompetitionBadge');
const modalTimeBadge = document.getElementById('modalTimeBadge');
const modalMatchTitle = document.getElementById('modalMatchTitle');
const modalLoading = document.getElementById('modalLoading');
const modalContent = document.getElementById('modalContent');
const modalTipsList = document.getElementById('modalTipsList');
const refreshLeagueMatchesBtn = document.getElementById('refreshLeagueMatchesBtn');

// ============================================================================
// 1. SEGÉDFÜGGVÉNYEK & FORMÁZÓK
// ============================================================================

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatHungarianDate(isoStr) {
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

function getSportIcon(sportId) {
  const id = Number(sportId);
  if (id === 1) return '⚽';
  if (id === 5) return '🎾';
  if (id === 16) return '🏈';
  return '🏅';
}

function getFilterSettings() {
  const rawMin = Number(minOddsInput.value) || 1.30;
  const rawMax = Number(maxOddsInput.value) || 2.00;
  const tipsCount = Math.min(10, Math.max(1, Number(tipsCountSelect.value) || 3));
  return {
    minOdds: Math.min(rawMin, rawMax),
    maxOdds: Math.max(rawMin, rawMax),
    tipsCount
  };
}

// ============================================================================
// 2. NÉZETVÁLTÁS: FŐOLDAL ("ÖSSZES") vs SPORTÁG TÁBLÁZAT NÉZET
// ============================================================================

function switchNav(navKey) {
  activeNav = navKey;

  const tabs = [
    { key: 'all', btn: navBtnAll },
    { key: '1', btn: navBtn1 },
    { key: '5', btn: navBtn5 },
    { key: '16', btn: navBtn16 }
  ];

  tabs.forEach(({ key, btn }) => {
    if (key === activeNav) {
      if (key === 'all') {
        btn.className = 'nav-tab-btn shrink-0 h-8 sm:h-8.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer bg-rose-600 text-white shadow-sm';
      } else {
        btn.className = 'nav-tab-btn shrink-0 h-8 sm:h-8.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20';
      }
    } else {
      btn.className = 'nav-tab-btn shrink-0 h-8 sm:h-8.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer text-slate-300 hover:text-white hover:bg-slate-800';
    }
  });

  if (activeNav === 'all') {
    // Főoldal: Intervallum és Egyedi Meccskereső megjelenítése, Bajnokság táblázat elrejtése
    mainHomeView.classList.remove('hidden');
    sportLeagueView.classList.add('hidden');
  } else {
    // Sportág nézet: Bajnokság választó és Aznapi Meccsek táblázat megjelenítése
    mainHomeView.classList.add('hidden');
    sportLeagueView.classList.remove('hidden');

    let sportName = 'Labdarúgás (Foci)';
    if (activeNav === '5') sportName = 'Tenisz (ATP / WTA)';
    if (activeNav === '16') sportName = 'Amerikai futball (NFL)';

    leagueSectionHeading.textContent = `${sportName} – Bajnokság & Sorozat (Rangsorolt Prioritás)`;
    loadSportCompetitions(activeNav, true);
  }
}

navBtnAll.addEventListener('click', () => switchNav('all'));
navBtn1.addEventListener('click', () => switchNav('1'));
navBtn5.addEventListener('click', () => switchNav('5'));
navBtn16.addEventListener('click', () => switchNav('16'));

// ============================================================================
// 3. FŐOLDAL VEZÉRLŐK: IDŐINTERVALLUM ÉS EGYEDI KERESŐ
// ============================================================================

function initHomeControls() {
  hoursSelect.innerHTML = '';
  for (let h = 1; h <= 24; h++) {
    const opt = document.createElement('option');
    opt.value = String(h);
    opt.textContent = `Következő ${h} órában (${h} óra)`;
    if (h === 6) opt.selected = true;
    hoursSelect.appendChild(opt);
  }

  tipsCountSelect.innerHTML = '';
  for (let c = 1; c <= 10; c++) {
    const opt = document.createElement('option');
    opt.value = String(c);
    opt.textContent = `Top ${c} legvalószínűbb tipp (${c} db)`;
    if (c === 3) opt.selected = true;
    tipsCountSelect.appendChild(opt);
  }

  function syncLabels() {
    const { minOdds, maxOdds, tipsCount } = getFilterSettings();
    headerOddsBadge.textContent = `${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)} Odds • Top ${tipsCount}`;
    analyzeIntervalBtnLabel.textContent = `Időintervallum Elemzése (Top ${tipsCount} • ${minOdds.toFixed(2)}–${maxOdds.toFixed(2)})`;
    analyzeCustomBtnLabel.textContent = `Mérkőzés Elemzése (Top ${tipsCount} Tipp)`;
  }

  tipsCountSelect.addEventListener('change', syncLabels);
  minOddsInput.addEventListener('input', syncLabels);
  maxOddsInput.addEventListener('input', syncLabels);

  oddsPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      minOddsInput.value = btn.dataset.min;
      maxOddsInput.value = btn.dataset.max;
      oddsPresetBtns.forEach(b => {
        b.className = (b === btn)
          ? 'odds-preset-btn rounded-lg text-xs font-black bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 transition truncate px-1'
          : 'odds-preset-btn rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition truncate px-1';
      });
      syncLabels();
      if (activeNav !== 'all') {
        loadLeagueMatches();
      }
    });
  });

  quickHourBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      hoursSelect.value = btn.dataset.quickHours;
      quickHourBtns.forEach(b => {
        b.className = (b === btn)
          ? 'quick-hour-btn h-8 sm:h-7 px-2 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 transition text-center'
          : 'quick-hour-btn h-8 sm:h-7 px-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition text-center';
      });
    });
  });

  syncLabels();
}

async function parseJsonResponse(res) {
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

// Intervallum elemzés indítása
async function runIntervalAnalysis(forceRefresh = false) {
  lastExecutedMode = 'interval';
  const hours = Number(hoursSelect.value) || 6;
  const sportId = homeSportSelect.value || 'all';
  const { minOdds, maxOdds, tipsCount } = getFilterSettings();
  const sportLabel = homeSportSelect.options[homeSportSelect.selectedIndex]?.textContent || 'Összes sportág';

  startLoadingAnimation('interval', `Következő ${hours} óra elemzése (${sportLabel})...`);
  analyzeIntervalBtn.disabled = true;
  analyzeCustomBtn.disabled = true;

  try {
    const res = await fetch('/api/analyze/interval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hours,
        sportId,
        minOdds,
        maxOdds,
        tipsCount,
        forceRefresh: Boolean(forceRefresh)
      })
    });

    const data = await parseJsonResponse(res);

    stopLoadingAnimation();
    renderAnalysisResults(
      data,
      `Következő ${hours} óra • ${minOdds.toFixed(2)}–${maxOdds.toFixed(2)} odds • Top ${tipsCount} tipp`
    );
  } catch (err) {
    showError(err.message);
  } finally {
    analyzeIntervalBtn.disabled = false;
    analyzeCustomBtn.disabled = false;
  }
}

// Egyedi meccskeresés indítása
async function runCustomAnalysis(forceRefresh = false) {
  const query = customMatchInput.value.trim();
  if (!query) {
    showError('Kérlek írj be egy mérkőzést, csapatot vagy játékost a keresőmezőbe!');
    customMatchInput.focus();
    return;
  }

  lastExecutedMode = 'custom';
  const { minOdds, maxOdds, tipsCount } = getFilterSettings();

  startLoadingAnimation('custom', `"${query}" részletes elemzése...`);
  analyzeIntervalBtn.disabled = true;
  analyzeCustomBtn.disabled = true;

  try {
    const res = await fetch('/api/analyze/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        eventId: selectedAutocompleteEventId,
        minOdds,
        maxOdds,
        tipsCount,
        forceRefresh: Boolean(forceRefresh)
      })
    });

    const data = await parseJsonResponse(res);

    stopLoadingAnimation();
    renderAnalysisResults(
      data,
      `Keresés: "${query}" • ${minOdds.toFixed(2)}–${maxOdds.toFixed(2)} odds • Top ${tipsCount} tipp`
    );
  } catch (err) {
    showError(err.message);
  } finally {
    analyzeIntervalBtn.disabled = false;
    analyzeCustomBtn.disabled = false;
  }
}

analyzeIntervalBtn.addEventListener('click', () => runIntervalAnalysis(false));
analyzeCustomBtn.addEventListener('click', () => runCustomAnalysis(false));
forceRefreshBtn.addEventListener('click', () => {
  if (lastExecutedMode === 'custom') runCustomAnalysis(true);
  else runIntervalAnalysis(true);
});

// Autocomplete a főoldali keresőhöz
let searchDebounce = null;
customMatchInput.addEventListener('input', () => {
  selectedAutocompleteEventId = null;
  const val = customMatchInput.value.trim();
  clearCustomInputBtn.classList.toggle('hidden', val.length === 0);

  clearTimeout(searchDebounce);
  if (val.length < 2) {
    autocompleteDropdown.classList.add('hidden');
    return;
  }

  searchDebounce = setTimeout(async () => {
    try {
      const res = await fetch(`/api/matches/search?q=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (!data.ok || !data.matches || data.matches.length === 0) {
        autocompleteDropdown.classList.add('hidden');
        return;
      }

      autocompleteDropdown.innerHTML = data.matches.map(m => `
        <button type="button" data-event-id="${m.eventId}" data-event-name="${escapeHtml(m.eventName)}"
          class="autocomplete-item w-full text-left px-3.5 py-2.5 hover:bg-slate-800 transition flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs sm:text-sm font-semibold text-white truncate">${getSportIcon(m.sportId)} ${escapeHtml(m.eventName)}</div>
            <div class="text-[11px] text-slate-400 truncate">${escapeHtml(m.competitionGroupName || '')} - ${escapeHtml(m.competitionName || '')}</div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-[11px] font-medium text-emerald-400">${formatHungarianDate(m.eventDate)}</div>
          </div>
        </button>
      `).join('');

      autocompleteDropdown.classList.remove('hidden');

      autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(btn => {
        btn.addEventListener('click', () => {
          customMatchInput.value = btn.dataset.eventName;
          selectedAutocompleteEventId = Number(btn.dataset.eventId);
          clearCustomInputBtn.classList.remove('hidden');
          autocompleteDropdown.classList.add('hidden');
        });
      });
    } catch (_) {
      autocompleteDropdown.classList.add('hidden');
    }
  }, 200);
});

clearCustomInputBtn.addEventListener('click', () => {
  customMatchInput.value = '';
  selectedAutocompleteEventId = null;
  clearCustomInputBtn.classList.add('hidden');
  autocompleteDropdown.classList.add('hidden');
  customMatchInput.focus();
});

document.addEventListener('click', (e) => {
  if (!customMatchInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
    autocompleteDropdown.classList.add('hidden');
  }
});

customMatchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    autocompleteDropdown.classList.add('hidden');
    runCustomAnalysis(false);
  }
});

// Töltés animáció
function startLoadingAnimation(mode, subtitle) {
  const { minOdds, maxOdds, tipsCount } = getFilterSettings();
  errorSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  loadingTitle.textContent = subtitle;
  loadingProgressBar.style.width = '20%';

  const steps = [
    { pct: '30%', text: `1/4: Mérkőzések és ${minOdds.toFixed(2)}–${maxOdds.toFixed(2)} szorzók szűrése...` },
    { pct: '55%', text: '2/4: Internetes források és bírói adatok átvizsgálása...' },
    { pct: '80%', text: '3/4: Forma, szögletek és sárga lapok összevetése...' },
    { pct: '92%', text: `4/4: Top ${tipsCount} tipp összeállítása és kockázatelemzés...` }
  ];

  let idx = 0;
  loadingStepText.textContent = steps[0].text;

  clearInterval(loadingTimer);
  loadingTimer = setInterval(() => {
    idx = Math.min(steps.length - 1, idx + 1);
    loadingStepText.textContent = steps[idx].text;
    loadingProgressBar.style.width = steps[idx].pct;
  }, 3500);
}

function stopLoadingAnimation() {
  clearInterval(loadingTimer);
  loadingSection.classList.add('hidden');
}

function showError(msg) {
  stopLoadingAnimation();
  errorMessageText.textContent = msg;
  errorSection.classList.remove('hidden');
}

function getRiskVisuals(level = '', score = 4) {
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

// Eredmények kirajzolása a főoldalon
const LS_PENDING_KEY = 'smart_tippmix_saved_tips';
const LS_HISTORY_KEY = 'smart_tippmix_saved_history';

function saveQueriedTipsLocally(tips = []) {
  if (!Array.isArray(tips) || tips.length === 0) return;
  try {
    const raw = localStorage.getItem(LS_PENDING_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const map = new Map();
    for (const t of existing) {
      if (t && (t.id || (t.eventName && t.outcomeName))) {
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

function renderAnalysisResults(payload, metaLabel) {
  const result = payload.result || {};
  const tips = Array.isArray(result.tips) ? result.tips : [];

  if (tips.length > 0) {
    saveQueriedTipsLocally(tips);
    setTimeout(loadBettingStats, 800);
  }

  resultsMetaBadge.textContent = metaLabel;
  analysisOverviewText.textContent = result.analysisOverview || (payload.noMatches ? payload.noMatchesMessage : 'Az elemzés elkészült a kiválasztott feltételek alapján.');

  if (payload.fromCache) {
    cacheStatusBadge.textContent = '⚡ Okos Gyorsítótárból (0 API hívás)';
    cacheStatusBadge.classList.remove('hidden');
    forceRefreshBtn.classList.remove('hidden');
  } else {
    cacheStatusBadge.classList.add('hidden');
    forceRefreshBtn.classList.remove('hidden');
  }

  tipsContainer.innerHTML = '';
  if (payload.noMatches || tips.length === 0) {
    const emptyMsg = payload.noMatchesMessage || 'Nem található fogadási opció a megadott feltételekkel. Próbálj tágabb időintervallumot vagy odds határokat választani!';
    tipsContainer.innerHTML = `
      <div class="glass-card rounded-2xl p-8 text-center text-slate-300 space-y-3 border border-slate-800">
        <span class="text-4xl block mb-2">🗓️</span>
        <h4 class="text-base font-bold text-white">Nincs kezdődő mérkőzés vagy elérhető piac a megadott feltételekkel</h4>
        <p class="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">${escapeHtml(emptyMsg)}</p>
      </div>
    `;
    return;
  } else {
    tips.forEach((tip, idx) => {
      const rank = tip.rank || idx + 1;
      const sportIcon = getSportIcon(tip.sportName?.includes('Tenisz') ? 5 : (tip.sportName?.includes('futball') || tip.sportName?.includes('NFL') ? 16 : 1));
      const timeFormatted = formatHungarianDate(tip.eventDate);
      const reasoning = tip.detailedReasoning || {};
      const risk = tip.riskAssessment || {};
      const prob = tip.estimatedProbability || 75;
      const keyFactors = Array.isArray(reasoning.keyFactors) ? reasoning.keyFactors : [];
      const riskInfo = getRiskVisuals(risk.level, risk.score);

      const card = document.createElement('article');
      card.className = 'tip-card glass-card rounded-2xl overflow-hidden shadow-xl border border-slate-800 transition-all';
      card.innerHTML = `
        <!-- KATTINTHATÓ FEJLÉC / FŐ KÁRTYA -->
        <div class="tip-card-trigger p-4 sm:p-5 cursor-pointer select-none space-y-3.5 transition hover:bg-slate-900/40">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-lg text-xs font-black uppercase ${rank === 1 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-emerald-400 border border-emerald-500/30'}">
                #${rank}. Tipp
              </span>
              <span class="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>${sportIcon}</span>
                <span>${escapeHtml(tip.competitionName || '')}</span>
              </span>
            </div>
            <span class="text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
              🕒 ${escapeHtml(timeFormatted)}
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div class="md:col-span-8 min-w-0">
              <h3 class="text-base sm:text-lg font-black text-white leading-snug break-words">
                ${escapeHtml(tip.eventName || 'Mérkőzés')}
              </h3>
              <p class="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                ${escapeHtml(tip.shortSummary || '')}
              </p>
            </div>

            <div class="md:col-span-4 rounded-xl bg-slate-900 border border-emerald-500/35 p-3 flex items-center justify-between gap-3">
              <div class="min-w-0 flex-1">
                <span class="text-[10px] uppercase font-bold text-slate-400 block truncate">${escapeHtml(tip.marketName)}</span>
                <span class="text-sm font-black text-emerald-400 block truncate mt-0.5">${escapeHtml(tip.outcomeName)}</span>
                <span class="text-[11px] text-slate-400 mt-0.5 block">Esély: <strong class="text-white">${prob}%</strong></span>
              </div>
              <div class="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-lg">
                ${Number(tip.odds).toFixed(2)}
              </div>
            </div>
          </div>

          <!-- Alsó sáv: Kockázati szint + Lenyitás gomb -->
          <div class="pt-2.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2">
              <span class="text-slate-400">Kockázati szint:</span>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold border ${riskInfo.badgeClass}">
                ${escapeHtml(riskInfo.label)} (${riskInfo.score}/10)
              </span>
            </div>

            <button type="button" class="toggle-details-btn inline-flex items-center gap-1.5 font-bold text-emerald-400 hover:text-emerald-300 transition cursor-pointer">
              <span class="toggle-btn-text">Kattints a részletes indoklásért</span>
              <svg class="toggle-chevron w-4 h-4 transition-transform duration-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        <!-- LENYÍLÓ RÉSZLETES INDOKLÁS PANEL -->
        <div class="tip-details-panel hidden border-t border-slate-800 bg-slate-950/90 p-4 sm:p-5 space-y-4">
          <!-- 1. Miért ez a gondolat? -->
          <div class="space-y-1.5">
            <h4 class="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span>💡</span>
              <span>Miért ez a gondolat? (Szakmai indoklás)</span>
            </h4>
            <p class="text-xs sm:text-sm text-slate-200 leading-relaxed bg-slate-900 p-3 sm:p-4 rounded-xl border border-slate-800 break-words">
              ${escapeHtml(reasoning.mainThesis || tip.shortSummary || 'Nincs külön indoklás rögzítve.')}
            </p>
          </div>

          <!-- 2. Forma és statisztikák (ha van) -->
          ${reasoning.formAndStats ? `
            <div class="space-y-1.5">
              <h5 class="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <span>📊</span>
                <span>Forma, statisztikák &amp; H2H</span>
              </h5>
              <p class="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-900 p-3 rounded-xl border border-slate-800 break-words">
                ${escapeHtml(reasoning.formAndStats)}
              </p>
            </div>
          ` : ''}

          <!-- 3. Kulcsérvek (ha van) -->
          ${keyFactors.length > 0 ? `
            <div class="space-y-1.5">
              <h5 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span>📌</span>
                <span>Releváns kulcsérvek a tipp mellett:</span>
              </h5>
              <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                ${keyFactors.map(f => `
                  <li class="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 flex items-start gap-2 min-w-0">
                    <span class="text-emerald-400 font-bold shrink-0">✔</span>
                    <span class="break-words">${escapeHtml(f)}</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          <!-- 4. Mennyire kockázatos? -->
          <div class="rounded-xl border p-3.5 sm:p-4 space-y-2 ${riskInfo.boxClass}">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h5 class="text-xs sm:text-sm font-extrabold uppercase tracking-wider ${riskInfo.textClass} flex items-center gap-2">
                <span>⚠️</span>
                <span>Mennyire kockázatos? — ${escapeHtml(riskInfo.label)} (${riskInfo.score}/10)</span>
              </h5>
              <div class="w-full sm:w-36 bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700 shrink-0">
                <div class="${riskInfo.barClass} h-full" style="width: ${riskInfo.score * 10}%"></div>
              </div>
            </div>
            <p class="text-xs sm:text-sm text-slate-200 leading-relaxed break-words">
              ${escapeHtml(risk.explanation || 'Átlagos kockázatú mérkőzés.')}
            </p>
          </div>
        </div>
      `;

      const trigger = card.querySelector('.tip-card-trigger');
      const detailsPanel = card.querySelector('.tip-details-panel');
      const chevron = card.querySelector('.toggle-chevron');
      const btnText = card.querySelector('.toggle-btn-text');

      trigger.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        const isHidden = detailsPanel.classList.contains('hidden');
        if (isHidden) {
          detailsPanel.classList.remove('hidden');
          chevron.classList.add('rotate-180');
          btnText.textContent = 'Részletes indoklás bezárása';
        } else {
          detailsPanel.classList.add('hidden');
          chevron.classList.remove('rotate-180');
          btnText.textContent = 'Kattints a részletes indoklásért';
        }
      });

      tipsContainer.appendChild(card);
    });
  }

  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  loadBettingStats();
}

// ============================================================================
// 4. SPORTÁG NÉZET: KÉT LÉPCSŐS DROPDOWN (ORSZÁG/LIGA -> OSZTÁLY/SOROZAT)
// ============================================================================

function getCountryFlag(groupName = '') {
  const g = groupName.toLowerCase().trim();
  if (g.includes('nemzetközi klub') || g.includes('bajnokok') || g.includes('európa-liga')) return '🏆';
  if (g.includes('nemzetközi') || g.includes('nemzetek')) return '🌍';
  if (g.includes('anglia')) return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (g.includes('spanyol')) return '🇪🇸';
  if (g.includes('olasz')) return '🇮🇹';
  if (g.includes('német')) return '🇩🇪';
  if (g.includes('magyar')) return '🇭🇺';
  if (g.includes('francia')) return '🇫🇷';
  if (g.includes('skót') || g.includes('skócia')) return '🏴󠁧󠁢󠁳󠁣󠁴󠁿';
  if (g.includes('lengyel')) return '🇵🇱';
  if (g.includes('holland')) return '🇳🇱';
  if (g.includes('portugál')) return '🇵🇹';
  if (g.includes('török')) return '🇹🇷';
  if (g.includes('cseh')) return '🇨🇿';
  if (g.includes('svéd')) return '🇸🇪';
  if (g.includes('dán')) return '🇩🇰';
  if (g.includes('belga')) return '🇧🇪';
  if (g.includes('osztrák') || g.includes('ausztria')) return '🇦🇹';
  if (g.includes('svájc')) return '🇨🇭';
  if (g.includes('görög')) return '🇬🇷';
  if (g.includes('norvég')) return '🇳🇴';
  if (g.includes('horvát')) return '🇭🇷';
  if (g.includes('szerb')) return '🇷🇸';
  if (g.includes('román')) return '🇷🇴';
  if (g.includes('usa') || g.includes('amerik')) return '🇺🇸';
  if (g.includes('atp')) return '🎾';
  if (g.includes('wta')) return '🎾';
  if (g.includes('challenger')) return '🎾';
  return '⚽';
}

function getGroupPrestigeScore(sportId, groupName = '') {
  const g = groupName.toLowerCase().trim();
  if (Number(sportId) === 1) { // Foci
    if (g.includes('nemzetközi klub')) return 1000;
    if (g.includes('nemzetközi')) return 950;
    if (g.includes('anglia')) return 920;
    if (g.includes('spanyol')) return 910;
    if (g.includes('olasz')) return 900;
    if (g.includes('német')) return 890;
    if (g.includes('magyar')) return 880;
    if (g.includes('francia')) return 870;
    if (g.includes('holland')) return 800;
    if (g.includes('portugál')) return 790;
    if (g.includes('török')) return 780;
    if (g.includes('skót') || g.includes('skócia')) return 770;
    if (g.includes('lengyel')) return 760;
    if (g.includes('belga')) return 750;
    return 300;
  }
  if (Number(sportId) === 5) { // Tenisz
    if (g.includes('grand slam')) return 1000;
    if (g.includes('atp')) return 900;
    if (g.includes('wta')) return 850;
    if (g.includes('challenger')) return 700;
    return 400;
  }
  if (Number(sportId) === 16) { // NFL
    if (g.includes('usa')) return 1000;
    if (g.includes('ncaa')) return 700;
    return 400;
  }
  return 100;
}

async function loadSportCompetitions(sportId, resetSelection = false) {
  countryGroupSelect.innerHTML = `<option value="">Betöltés...</option>`;
  competitionSubSelect.innerHTML = `<option value="">Betöltés...</option>`;

  try {
    const res = await fetch(`/api/competitions?sports=${sportId}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    allCompetitions = data.competitions || [];

    // Csoportosítás Országok / Ligacsoportok szerint
    const countryGroupsMap = new Map();
    for (const c of allCompetitions) {
      const g = c.competitionGroupName || 'Egyéb';
      if (!countryGroupsMap.has(g)) {
        countryGroupsMap.set(g, {
          groupName: g,
          prestige: getGroupPrestigeScore(sportId, g),
          todayMatches: 0,
          totalMatches: 0,
          competitions: []
        });
      }
      const grp = countryGroupsMap.get(g);
      grp.todayMatches += c.todayMatches;
      grp.totalMatches += c.totalMatches;
      grp.competitions.push(c);
    }

    const countryGroups = Array.from(countryGroupsMap.values());
    countryGroups.sort((a, b) => {
      if (b.prestige !== a.prestige) return b.prestige - a.prestige;
      if (b.todayMatches !== a.todayMatches) return b.todayMatches - a.todayMatches;
      return b.totalMatches - a.totalMatches;
    });

    // Feltöltjük az 1. Dropdown-t (Ország / Liga)
    countryGroupSelect.innerHTML = '';

    // "Összes ország" opció
    const totalTodayAll = countryGroups.reduce((acc, g) => acc + g.todayMatches, 0);
    const optAll = document.createElement('option');
    optAll.value = 'ALL';
    optAll.textContent = `🌐 Összes ország / liga (${totalTodayAll} meccs a következő 24 órában)`;
    countryGroupSelect.appendChild(optAll);

    countryGroups.forEach(cg => {
      const opt = document.createElement('option');
      opt.value = cg.groupName;
      const flag = getCountryFlag(cg.groupName);
      const matchBadge = cg.todayMatches > 0 ? `(${cg.todayMatches} meccs / 24h)` : `(0 meccs)`;
      opt.textContent = `${flag} ${cg.groupName} ${matchBadge}`;
      countryGroupSelect.appendChild(opt);
    });

    // Alapértelmezett kiválasztás: az első olyan rangos csoport, aminek a következő 24 órában van meccse (pl. Nemzetközi klubcsapatok - BL)
    if (resetSelection) {
      const defaultGroup = countryGroups.find(g => g.todayMatches > 0) || countryGroups[0];
      if (defaultGroup) {
        countryGroupSelect.value = defaultGroup.groupName;
      }
    }

    updateCompetitionSubDropdown();
  } catch (err) {
    console.error('Hiba a bajnokságok betöltésekor:', err);
    countryGroupSelect.innerHTML = `<option value="">Hiba a betöltéskor</option>`;
  }
}

// 2. Dropdown (Bajnokság / Osztály) frissítése az 1. Dropdown alapján
function updateCompetitionSubDropdown() {
  const selectedGroup = countryGroupSelect.value;
  competitionSubSelect.innerHTML = '';

  let availableComps = [];
  if (!selectedGroup || selectedGroup === 'ALL') {
    availableComps = allCompetitions;
  } else {
    availableComps = allCompetitions.filter(c => (c.competitionGroupName || 'Egyéb') === selectedGroup);
  }

  // Rendezés a csoporton belül: a következő 24 órában meccsekkel rendelkezők legelőre, majd presztízs szerint
  availableComps.sort((a, b) => {
    const hasTodayA = a.todayMatches > 0 ? 1 : 0;
    const hasTodayB = b.todayMatches > 0 ? 1 : 0;
    if (hasTodayB !== hasTodayA) return hasTodayB - hasTodayA;
    if (b.prestigeScore !== a.prestigeScore) return b.prestigeScore - a.prestigeScore;
    if (b.todayMatches !== a.todayMatches) return b.todayMatches - a.todayMatches;
    return b.totalMatches - a.totalMatches;
  });

  const totalTodaySub = availableComps.reduce((acc, c) => acc + c.todayMatches, 0);
  countryTodayMatchesBadge.textContent = `${totalTodaySub} mérkőzés a következő 24 órában`;

  // Első opció: "Összes osztály ebből az országból"
  const optAllSub = document.createElement('option');
  optAllSub.value = 'ALL';
  optAllSub.textContent = `⭐ Összes osztály ebből (${totalTodaySub} meccs / 24h)`;
  competitionSubSelect.appendChild(optAllSub);

  availableComps.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.key;
    const star = c.todayMatches > 0 ? '⚽ ' : '';
    const matchCountStr = c.todayMatches > 0 ? `(${c.todayMatches} meccs / 24h)` : `(0 meccs)`;
    opt.textContent = `${star}${c.competitionName} ${matchCountStr}`;
    competitionSubSelect.appendChild(opt);
  });

  // Alapból olyan bajnokságot jelölünk ki, aminek van MA mérkőzése!
  const topMatchComp = availableComps.find(c => c.todayMatches > 0 && (c.prestigeScore >= 900 || c.competitionName.includes('BL')));
  if (topMatchComp) {
    competitionSubSelect.value = topMatchComp.key;
  } else if (availableComps.length > 0 && availableComps[0].todayMatches > 0) {
    competitionSubSelect.value = availableComps[0].key;
  }

  loadLeagueMatches();
}

countryGroupSelect.addEventListener('change', () => {
  updateCompetitionSubDropdown();
});

competitionSubSelect.addEventListener('change', () => {
  loadLeagueMatches();
});

// Aznapi meccsek lekérése és Top 2 tipp kirajzolása
async function loadLeagueMatches(forceRefresh = false) {
  leagueMatchesList.innerHTML = `
    <div class="glass-card rounded-2xl p-8 text-center space-y-3">
      <div class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 animate-spin">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      </div>
      <p class="text-xs sm:text-sm text-slate-300 font-medium">Aznapi mérkőzések és Top 2 tippek betöltése...</p>
    </div>
  `;

  try {
    const { minOdds, maxOdds } = getFilterSettings();
    const selectedGroup = countryGroupSelect.value;
    const selectedCompKey = competitionSubSelect.value;

    let compKeysToSend = [];
    if (selectedCompKey && selectedCompKey !== 'ALL') {
      compKeysToSend = [selectedCompKey];
    } else if (selectedGroup && selectedGroup !== 'ALL') {
      const compsInGroup = allCompetitions.filter(c => (c.competitionGroupName || 'Egyéb') === selectedGroup);
      compKeysToSend = compsInGroup.map(c => c.key);
    }

    const res = await fetch('/api/matches/by-competitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        competitionKeys: compKeysToSend,
        competitionGroupName: (selectedGroup && selectedGroup !== 'ALL') ? selectedGroup : null,
        sportIds: [Number(activeNav)],
        onlyToday: true,
        minOdds,
        maxOdds,
        forceRefresh: Boolean(forceRefresh)
      })
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    currentLeagueMatches = data.matches || [];
    matchesCountBadge.textContent = `${currentLeagueMatches.length} meccs`;

    // Fejléc szövegének aktualizálása
    const groupText = (selectedGroup && selectedGroup !== 'ALL') ? selectedGroup : 'Összes ország';
    const compText = (selectedCompKey && selectedCompKey !== 'ALL')
      ? (competitionSubSelect.options[competitionSubSelect.selectedIndex]?.textContent.replace(/^⭐\s*/, '').split('(')[0].trim() || '')
      : 'Összes osztály';
    matchesSectionTitle.textContent = `${groupText} • ${compText} (Következő 24 óra)`;

    if (currentLeagueMatches.length === 0) {
      const isNfl = Number(activeNav) === 16;
      leagueMatchesList.innerHTML = `
        <div class="glass-card rounded-2xl p-8 text-center space-y-2 text-slate-400">
          <p class="text-sm font-semibold">${isNfl ? 'A következő 24 órában nincs NFL mérkőzés (a forduló meccsei a hétvégén esedékesek).' : 'Nincs mérkőzés a következő 24 órában a kiválasztott osztályban/bajnokságban ebben az odds sávban.'}</p>
          <p class="text-xs text-slate-500">${isNfl ? 'Nézd meg a Főoldali keresőt vagy válassz Foci / Tenisz mérkőzéseket!' : 'Válassz másik bajnokságot vagy az "Összes osztály ebből" lehetőséget!'}</p>
        </div>
      `;
      return;
    }

    renderLeagueMatchRows(currentLeagueMatches);
    loadBettingStats();
  } catch (err) {
    console.error('Hiba a meccsek betöltésekor:', err);
    leagueMatchesList.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center text-rose-400 text-sm">Hiba a mérkőzések betöltésekor.</div>`;
  }
}

function renderLeagueMatchRows(matches) {
  leagueMatchesList.innerHTML = matches.map(m => {
    const timeFormatted = formatHungarianDate(m.eventDate);
    const sportIcon = getSportIcon(m.sportId);
    const tips = m.top2Tips || [];

    let tipsHtml = '';
    if (tips.length > 0) {
      tipsHtml = tips.map(t => `
        <div class="flex-1 min-w-[140px] bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl p-2 sm:p-2.5 flex items-center justify-between gap-2 transition">
          <div class="min-w-0">
            <span class="block text-[10px] uppercase font-bold text-slate-400 truncate">${escapeHtml(t.marketName)}</span>
            <span class="block text-xs font-black text-emerald-400 truncate mt-0.5">${escapeHtml(t.outcomeName)}</span>
          </div>
          <div class="shrink-0">
            <span class="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs shadow-sm">
              ${Number(t.odds).toFixed(2)}
            </span>
          </div>
        </div>
      `).join('');
    } else {
      tipsHtml = `<div class="text-xs text-slate-500 italic py-1">Nincs elérhető piac a megadott odds sávban.</div>`;
    }

    return `
      <div class="match-row glass-card rounded-2xl p-3.5 sm:p-4 border border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
        
        <!-- BAL: IDŐ, CSAPATOK, LIGA -->
        <div class="lg:w-4/12 min-w-0 space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[11px] font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 shrink-0">
              🕒 ${escapeHtml(timeFormatted)}
            </span>
            <span class="text-[11px] text-emerald-400 font-semibold truncate">
              ${sportIcon} ${escapeHtml(m.competitionGroupName ? `${m.competitionGroupName} - ${m.competitionName}` : m.competitionName)}
            </span>
          </div>
          <h4 class="text-sm sm:text-base font-black text-white truncate leading-snug">
            ${escapeHtml(m.eventName)}
          </h4>
        </div>

        <!-- KÖZÉP: TOP 2 TIPP EGY SORBAN -->
        <div class="lg:w-6/12 flex flex-col sm:flex-row items-stretch gap-2 min-w-0">
          ${tipsHtml}
        </div>

        <!-- JOBB: "RÉSZLETESEN" GOMB -->
        <div class="lg:w-2/12 flex items-center justify-end shrink-0">
          <button type="button" data-event-id="${m.eventId}" data-event-name="${escapeHtml(m.eventName)}"
            class="open-detailed-btn w-full lg:w-auto h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition cursor-pointer active:scale-95">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Részletesen</span>
          </button>
        </div>

      </div>
    `;
  }).join('');

  document.querySelectorAll('.open-detailed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const eventId = Number(btn.dataset.eventId);
      const eventName = btn.dataset.eventName;
      const matchObj = currentLeagueMatches.find(m => m.eventId === eventId);
      openDetailedModal(eventId, eventName, matchObj);
    });
  });
}

// ============================================================================
// 5. RÉSZLETES ELEMZÉS MODAL (TOP 3 TIPP + JÁTÉKVEZETŐ + SÁRGA LAPOK & SZÖGLETEK)
// ============================================================================

let currentModalEventId = null;
let currentModalEventName = '';
let currentModalMatchObj = null;

async function openDetailedModal(eventId, eventName, matchObj, forceRefresh = false) {
  currentModalEventId = eventId;
  currentModalEventName = eventName;
  currentModalMatchObj = matchObj;

  modalMatchTitle.textContent = eventName;
  modalSportBadge.textContent = matchObj ? `${getSportIcon(matchObj.sportId)} ${matchObj.sportName || 'Sport'}` : 'Mérkőzés';
  modalCompetitionBadge.textContent = matchObj ? (matchObj.competitionName || '') : '';
  modalTimeBadge.textContent = matchObj ? formatHungarianDate(matchObj.eventDate) : 'Ma';

  if (modalCacheBadge) modalCacheBadge.classList.add('hidden');
  modalLoading.classList.remove('hidden');
  modalContent.classList.add('hidden');
  detailedModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Alapértelmezett loading tartalom visszaállítása
  modalLoading.innerHTML = `
    <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 animate-spin">
      <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
    </div>
    <h4 class="text-sm sm:text-base font-bold text-white">${forceRefresh ? 'Teljesen friss AI elemzés generálása...' : 'AI Elemzés folyamatban...'}</h4>
    <p class="text-xs text-emerald-400 max-w-md mx-auto">
      Releváns statisztikák, forma és Top 3 tipp összegyűjtése...
    </p>
  `;

  try {
    const { minOdds, maxOdds } = getFilterSettings();
    const res = await fetch('/api/analyze/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        query: eventName,
        minOdds,
        maxOdds,
        tipsCount: 3,
        forceRefresh: Boolean(forceRefresh)
      })
    });

    const data = await parseJsonResponse(res);

    if (modalCacheBadge) {
      if (data.fromCache) {
        modalCacheBadge.classList.remove('hidden');
      } else {
        modalCacheBadge.classList.add('hidden');
      }
    }

    renderModalContent(data.result);
  } catch (err) {
    console.error('Hiba a részletes elemzés lekérésekor:', err);
    modalLoading.innerHTML = `
      <div class="text-rose-400 p-4 space-y-3">
        <p class="font-bold text-base">Az elemzés nem sikerült.</p>
        <p class="text-xs text-rose-300">${escapeHtml(err.message)}</p>
        <button type="button" id="modalRetryBtn"
          class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer shadow-lg active:scale-95">
          🔄 Újrapróbálás (Cache nélkül)
        </button>
      </div>
    `;
    const retryBtn = document.getElementById('modalRetryBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        openDetailedModal(currentModalEventId, currentModalEventName, currentModalMatchObj, true);
      });
    }
  }
}

function renderModalContent(result = {}) {
  modalLoading.classList.add('hidden');
  modalContent.classList.remove('hidden');

  const tips = result.tips || [];

  if (tips.length === 0) {
    modalTipsList.innerHTML = `
      <div class="glass-card rounded-2xl p-6 text-center space-y-3 border border-slate-800">
        <div class="text-3xl">🔍</div>
        <h4 class="font-bold text-white text-sm sm:text-base">Nem található megfelelő tipp a beállított odds sávban</h4>
        <p class="text-xs text-slate-400 max-w-md mx-auto">
          A megadott odds határok között (${minOddsInput.value} – ${maxOddsInput.value}) nem volt elérhető kimenetel, vagy a modell válasza üres volt.
        </p>
        <button type="button" id="modalEmptyRefreshBtn"
          class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95">
          <span>🔄</span>
          <span>Friss AI Elemzés Kérése (Cache nélkül)</span>
        </button>
      </div>
    `;
    const btn = document.getElementById('modalEmptyRefreshBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        openDetailedModal(currentModalEventId, currentModalEventName, currentModalMatchObj, true);
      });
    }
    return;
  }

  // Top 3 Tippek - Csak a releváns információk megjelenítése
  modalTipsList.innerHTML = tips.map((t, idx) => {
    const rank = t.rank || idx + 1;
    const reasoning = t.detailedReasoning || {};
    const risk = t.riskAssessment || {};
    const prob = t.estimatedProbability || 75;
    const factors = Array.isArray(reasoning.keyFactors) ? reasoning.keyFactors : [];

    return `
      <div class="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase ${rank === 1 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-emerald-400 border border-emerald-500/30'}">
              #${rank}. Tipp
            </span>
            <span class="text-xs text-slate-300 font-semibold">${escapeHtml(t.marketName)}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400 font-medium">Esély: <strong class="text-white">${prob}%</strong></span>
            <span class="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-sm">
              ${Number(t.odds).toFixed(2)}
            </span>
          </div>
        </div>

        <div class="text-sm font-black text-emerald-400">
          ${escapeHtml(t.outcomeName)}
        </div>

        <p class="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
          ${escapeHtml(reasoning.mainThesis || t.shortSummary || '')}
        </p>

        ${factors.length > 0 ? `
          <div class="space-y-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Releváns kulcsérvek:</span>
            <ul class="text-xs text-slate-300 space-y-0.5 list-disc list-inside">
              ${factors.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>Kockázati szint: <strong class="text-amber-400">${escapeHtml(risk.level || 'Alacsony-Közepes')} (${risk.score || 3}/10)</strong></span>
          <span class="text-[11px] italic text-slate-500">${escapeHtml(risk.explanation || '')}</span>
        </div>
      </div>
    `;
  }).join('');
}

if (modalRefreshBtn) {
  modalRefreshBtn.addEventListener('click', () => {
    if (currentModalEventId || currentModalEventName) {
      openDetailedModal(currentModalEventId, currentModalEventName, currentModalMatchObj, true);
    }
  });
}

if (refreshLeagueMatchesBtn) {
  refreshLeagueMatchesBtn.addEventListener('click', () => {
    loadLeagueMatches(true);
  });
}

closeModalBtn.addEventListener('click', () => {
  detailedModal.classList.add('hidden');
  document.body.style.overflow = '';
});

detailedModal.addEventListener('click', (e) => {
  if (e.target === detailedModal) {
    detailedModal.classList.add('hidden');
    document.body.style.overflow = '';
  }
});

// ============================================================================
// 6. INICIALIZÁLÁS
// ============================================================================

// Találati arány & statisztika lekérése (Foci, Tenisz, NFL + Kockázati szintek)
async function loadBettingStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    if (!data.ok || !data.stats) return;

    function renderSportStats(sportData, rateEl, countEl, lowEl, medEl, highEl, pendingEl) {
      const s = sportData || {};
      if (rateEl && countEl) {
        if (s.totalChecked > 0) {
          rateEl.textContent = `${s.winRate}%`;
          countEl.textContent = `(${s.won}/${s.totalChecked} nyert)`;
        } else {
          rateEl.textContent = `--%`;
          countEl.textContent = `(0/0 nyert)`;
        }
      }

      if (pendingEl) {
        const pendingCount = Number(s.pendingCount || 0);
        pendingEl.textContent = `${pendingCount} vár`;
        if (pendingCount > 0) {
          pendingEl.className = 'text-[10px] px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-600/60 text-amber-300 font-bold';
        } else {
          pendingEl.className = 'text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/70 text-slate-400 font-medium';
        }
      }

      const byRisk = s.byRisk || {};
      const low = byRisk.low || {};
      const med = byRisk.medium || {};
      const high = byRisk.high || {};

      if (lowEl) lowEl.textContent = low.totalChecked > 0 ? `${low.winRate}%` : `--%`;
      if (medEl) medEl.textContent = med.totalChecked > 0 ? `${med.winRate}%` : `--%`;
      if (highEl) highEl.textContent = high.totalChecked > 0 ? `${high.winRate}%` : `--%`;
    }

    renderSportStats(data.stats.football, footballWinRate, footballWinCount, footballRiskLow, footballRiskMed, footballRiskHigh, footballPendingBadge);
    renderSportStats(data.stats.tennis, tennisWinRate, tennisWinCount, tennisRiskLow, tennisRiskMed, tennisRiskHigh, tennisPendingBadge);
    renderSportStats(data.stats.nfl, nflWinRate, nflWinCount, nflRiskLow, nflRiskMed, nflRiskHigh, nflPendingBadge);

    if (pendingTipsBadge) {
      const pCount = Number(data.pendingCount || 0);
      pendingTipsBadge.textContent = `${pCount} ellenőrzésre vár`;
    }

    // AUTOMATIKUS KLIENS-OLDALI HELYREÁLLÍTÁS (Render deploy és szerver restart ellen):
    // A böngésző biztonsági mentésként megőrzi az utóbbi 48 óra tippjeit, és deploy után visszaszinkronizálja!
    const rawLocal = localStorage.getItem(LS_PENDING_KEY);
    if (rawLocal) {
      try {
        const localTips = JSON.parse(rawLocal);
        const now = Date.now();

        // Kizárólag az elavult (48 óránál régebbi) tippeket szűrjük ki, a deploy NEM törli őket!
        const validTips = localTips.filter(t => {
          const tTime = t.savedAt || (t.eventDate ? new Date(t.eventDate).getTime() : now);
          return (now - tTime < 48 * 3600 * 1000);
        });

        if (validTips.length !== localTips.length) {
          localStorage.setItem(LS_PENDING_KEY, JSON.stringify(validTips));
        }

        if (validTips.length > 0 && Number(data.pendingCount || 0) < validTips.length) {
          fetch('/api/tips/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tips: validTips })
          })
            .then(r => r.json())
            .then(syncData => {
              if (syncData && syncData.addedCount > 0) {
                console.log(`🔄 [HELYREÁLLÍTÁS] ${syncData.addedCount} korábbi függő tipp visszaállítva a szerverre!`);
                // Újratöltjük a sávot
                fetch('/api/stats')
                  .then(r => r.json())
                  .then(updated => {
                    if (updated && updated.stats) {
                      renderSportStats(updated.stats.football, footballWinRate, footballWinCount, footballRiskLow, footballRiskMed, footballRiskHigh, footballPendingBadge);
                      renderSportStats(updated.stats.tennis, tennisWinRate, tennisWinCount, tennisRiskLow, tennisRiskMed, tennisRiskHigh, tennisPendingBadge);
                      renderSportStats(updated.stats.nfl, nflWinRate, nflWinCount, nflRiskLow, nflRiskMed, nflRiskHigh, nflPendingBadge);
                      if (pendingTipsBadge) {
                        pendingTipsBadge.textContent = `${updated.pendingCount || 0} ellenőrzésre vár`;
                      }
                    }
                  });
              }
            })
            .catch(() => {});
        }
      } catch (_) {}
    }
  } catch (err) {
    console.warn('Statisztika lekérési hiba:', err);
  }
}

// ============================================================================
// 7. TIPPNAPLÓ & ELŐZMÉNYEK MODAL (KOCKÁZATOK ÉS SPORTÁGAK SZERINT)
// ============================================================================

const tipHistoryModal = document.getElementById('tipHistoryModal');
const closeHistoryModalBtn = document.getElementById('closeHistoryModalBtn');
const historyModalTitle = document.getElementById('historyModalTitle');
const historyModalSubtitle = document.getElementById('historyModalSubtitle');
const historySportSelect = document.getElementById('historySportSelect');
const historyRiskSelect = document.getElementById('historyRiskSelect');
const historyModalBody = document.getElementById('historyModalBody');
const historyModalSummaryText = document.getElementById('historyModalSummaryText');
const historyModalRefreshBtn = document.getElementById('historyModalRefreshBtn');

const histCountAll = document.getElementById('histCountAll');
const histCountWon = document.getElementById('histCountWon');
const histCountLost = document.getElementById('histCountLost');
const histCountPending = document.getElementById('histCountPending');
const historyStatusTabs = document.querySelectorAll('.history-status-tab');

let currentHistoryFilter = {
  sportId: 'all',
  riskCategory: 'all',
  status: 'all'
};

function initTipHistoryModal() {
  // Minden kattintható statisztikai doboz és gomb eseménykezelése
  document.querySelectorAll('[data-history-trigger]').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const sport = trigger.getAttribute('data-sport') || 'all';
      const risk = trigger.getAttribute('data-risk') || 'all';
      const status = trigger.getAttribute('data-status') || 'all';
      openTipHistoryModal(sport, risk, status);
    });
  });

  if (closeHistoryModalBtn) {
    closeHistoryModalBtn.addEventListener('click', closeTipHistoryModal);
  }

  if (tipHistoryModal) {
    tipHistoryModal.addEventListener('click', (e) => {
      if (e.target === tipHistoryModal) closeTipHistoryModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tipHistoryModal && !tipHistoryModal.classList.contains('hidden')) {
      closeTipHistoryModal();
    }
  });

  if (historySportSelect) {
    historySportSelect.addEventListener('change', () => {
      currentHistoryFilter.sportId = historySportSelect.value;
      updateHistoryModalTitle();
      fetchAndRenderHistory();
    });
  }

  if (historyRiskSelect) {
    historyRiskSelect.addEventListener('change', () => {
      currentHistoryFilter.riskCategory = historyRiskSelect.value;
      updateHistoryModalTitle();
      fetchAndRenderHistory();
    });
  }

  if (historyStatusTabs) {
    historyStatusTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const filter = tab.getAttribute('data-status-filter') || 'all';
        currentHistoryFilter.status = filter;
        updateStatusTabsUI();
        fetchAndRenderHistory();
      });
    });
  }

  if (historyModalRefreshBtn) {
    historyModalRefreshBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/stats/evaluate', { method: 'POST' });
      } catch (_) {}
      fetchAndRenderHistory();
      if (typeof fetchStats === 'function') fetchStats();
    });
  }
}

function updateStatusTabsUI() {
  historyStatusTabs.forEach(tab => {
    const f = tab.getAttribute('data-status-filter');
    if (f === currentHistoryFilter.status) {
      tab.className = 'history-status-tab px-2.5 py-1 rounded-lg text-xs font-bold transition bg-emerald-500 text-slate-950 shadow-sm cursor-pointer';
    } else {
      tab.className = 'history-status-tab px-2.5 py-1 rounded-lg text-xs font-semibold transition text-slate-300 hover:bg-slate-800 cursor-pointer';
    }
  });
}

function updateHistoryModalTitle() {
  let sportName = 'Összes sportág';
  if (currentHistoryFilter.sportId === '1') sportName = '⚽ Labdarúgás (Foci)';
  if (currentHistoryFilter.sportId === '5') sportName = '🎾 Tenisz';
  if (currentHistoryFilter.sportId === '16') sportName = '🏈 Amerikai futball (NFL)';

  let riskName = 'Minden kockázati szint';
  if (currentHistoryFilter.riskCategory === 'low') riskName = '🟢 Alacsony kockázat (1-3)';
  if (currentHistoryFilter.riskCategory === 'medium') riskName = '🟡 Közepes kockázat (4-6)';
  if (currentHistoryFilter.riskCategory === 'high') riskName = '🔴 Magas kockázat (7-10)';

  historyModalTitle.textContent = `${sportName} – ${riskName}`;
  historyModalSubtitle.textContent = `A kiválasztott szűrésnek megfelelő lezárt és folyamatban lévő tippek`;
}

function openTipHistoryModal(sportId = 'all', riskCategory = 'all', status = 'all') {
  currentHistoryFilter.sportId = sportId;
  currentHistoryFilter.riskCategory = riskCategory;
  currentHistoryFilter.status = status;

  if (historySportSelect) historySportSelect.value = sportId;
  if (historyRiskSelect) historyRiskSelect.value = riskCategory;
  updateStatusTabsUI();
  updateHistoryModalTitle();

  tipHistoryModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  fetchAndRenderHistory();
}

function closeTipHistoryModal() {
  tipHistoryModal.classList.add('hidden');
  document.body.style.overflow = '';
}

async function fetchAndRenderHistory() {
  historyModalBody.innerHTML = `
    <div class="py-12 text-center space-y-3">
      <div class="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 animate-spin">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
      </div>
      <p class="text-xs text-slate-400">Tipp előzmények betöltése...</p>
    </div>
  `;

  try {
    const params = new URLSearchParams({
      sportId: currentHistoryFilter.sportId,
      riskCategory: currentHistoryFilter.riskCategory,
      status: currentHistoryFilter.status
    });

    const res = await fetch(`/api/tips/history?${params.toString()}`);
    const data = await parseJsonResponse(res);

    const historyItems = Array.isArray(data.history) ? [...data.history] : [];
    const pendingItems = Array.isArray(data.pending) ? [...data.pending] : [];

    // Kliensoldali előzmény-mentés és visszaállítás (Deploy elleni védelem)
    try {
      const rawStored = localStorage.getItem(LS_HISTORY_KEY);
      const storedList = rawStored ? JSON.parse(rawStored) : [];
      if (historyItems.length > 0) {
        const hMap = new Map();
        storedList.forEach(item => { if (item && item.id) hMap.set(item.id, item); });
        historyItems.forEach(item => { if (item && item.id) hMap.set(item.id, item); });
        localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(Array.from(hMap.values()).slice(0, 300)));
      } else if (storedList.length > 0) {
        // A szerver újraindult, de csak a kiválasztott szűrésnek megfelelő helyi elemeket töltjük be!
        const matchingLocal = storedList.filter(item => {
          if (currentHistoryFilter.sportId !== 'all') {
            const expSport = Number(currentHistoryFilter.sportId);
            const itemSport = Number(item.sportId || (item.sportName?.includes('Tenisz') ? 5 : (item.sportName?.includes('futball') || item.sportName?.includes('NFL') ? 16 : 1)));
            if (itemSport !== expSport) return false;
          }
          if (currentHistoryFilter.riskCategory !== 'all' && item.riskCategory !== currentHistoryFilter.riskCategory) {
            return false;
          }
          return true;
        });

        for (const ml of matchingLocal) {
          if (!historyItems.some(h => h.id === ml.id)) {
            historyItems.push(ml);
          }
        }
      }
    } catch (_) {}

    // Szigorú szűrőfüggvény a sportágra és a kockázatra
    const filterBySportAndRisk = (list) => list.filter(item => {
      if (currentHistoryFilter.sportId !== 'all') {
        const expectedSportId = Number(currentHistoryFilter.sportId);
        const itemSportId = Number(item.sportId || (item.sportName?.includes('Tenisz') ? 5 : (item.sportName?.includes('futball') || item.sportName?.includes('NFL') ? 16 : 1)));
        if (itemSportId !== expectedSportId) return false;
      }
      if (currentHistoryFilter.riskCategory !== 'all') {
        if (item.riskCategory !== currentHistoryFilter.riskCategory) return false;
      }
      return true;
    });

    const filteredHistory = filterBySportAndRisk(historyItems);
    const filteredPending = filterBySportAndRisk(pendingItems);

    // Összesített elemek a választott státusz alapján
    let displayList = [];
    if (currentHistoryFilter.status === 'pending') {
      displayList = filteredPending.map(p => ({ ...p, status: 'pending' }));
    } else if (currentHistoryFilter.status === 'won') {
      displayList = filteredHistory.filter(h => h.won);
    } else if (currentHistoryFilter.status === 'lost') {
      displayList = filteredHistory.filter(h => !h.won);
    } else {
      // 'all': először a függők, utána a lezártak időrendben
      displayList = [
        ...filteredPending.map(p => ({ ...p, status: 'pending' })),
        ...filteredHistory
      ];
    }

    // Számlálók pontos frissítése a szűrt adatok alapján
    const wonCount = filteredHistory.filter(h => h.won).length;
    const lostCount = filteredHistory.filter(h => !h.won).length;
    const pendingCount = filteredPending.length;
    const totalCount = wonCount + lostCount + pendingCount;

    if (histCountAll) histCountAll.textContent = totalCount;
    if (histCountWon) histCountWon.textContent = wonCount;
    if (histCountLost) histCountLost.textContent = lostCount;
    if (histCountPending) histCountPending.textContent = pendingCount;

    historyModalSummaryText.textContent = `Találatok: ${displayList.length} db tipp (${wonCount} nyert, ${lostCount} vesztett, ${pendingCount} vár)`;

    if (displayList.length === 0) {
      historyModalBody.innerHTML = `
        <div class="glass-card rounded-2xl p-8 text-center text-slate-400 space-y-2 border border-slate-800 my-4">
          <span class="text-3xl block mb-2">📋</span>
          <h4 class="text-sm font-bold text-white">Még nem található tipp ebben a kategóriában</h4>
          <p class="text-xs text-slate-500 max-w-md mx-auto">
            Amint az AI által elemzett tippek mérkőzései befejeződnek, a rendszer automatikusan kiértékeli őket és ide rögzíti a végeredményt.
          </p>
        </div>
      `;
      return;
    }

    historyModalBody.innerHTML = '';
    displayList.forEach(item => {
      const isPending = item.status === 'pending';
      const isWon = item.won === true;
      const isLost = !isPending && item.won === false;

      let statusBadgeHtml = '';
      let cardBorderClass = 'border-slate-800';

      if (isPending) {
        statusBadgeHtml = `<span class="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">⏳ ELLENŐRZÉSRE VÁR</span>`;
        cardBorderClass = 'border-amber-900/30';
      } else if (isWon) {
        statusBadgeHtml = `<span class="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">✅ NYERT</span>`;
        cardBorderClass = 'border-emerald-900/40';
      } else {
        statusBadgeHtml = `<span class="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-rose-500/20 border border-rose-500/40 text-rose-300">❌ VESZTETT</span>`;
        cardBorderClass = 'border-rose-900/40';
      }

      const sportIcon = getSportIcon(item.sportId);
      const timeFormatted = formatHungarianDate(item.eventDate);
      const riskInfo = getRiskVisuals(item.riskLevel || (item.riskCategory === 'low' ? 'Alacsony' : (item.riskCategory === 'high' ? 'Magas' : 'Közepes')), item.riskScore);

      const card = document.createElement('div');
      card.className = `p-3.5 sm:p-4 rounded-2xl bg-slate-950/70 border ${cardBorderClass} space-y-2.5 transition hover:bg-slate-950/90`;
      card.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-sm">${sportIcon}</span>
            <span class="text-xs font-semibold text-slate-300 truncate">${escapeHtml(item.competitionName || item.sportName || '')}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[11px] text-slate-400">🕒 ${escapeHtml(timeFormatted)}</span>
            ${statusBadgeHtml}
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 pt-2">
          <div class="min-w-0">
            <h4 class="text-sm sm:text-base font-bold text-white truncate">${escapeHtml(item.eventName || '')}</h4>
            <div class="flex flex-wrap items-center gap-1.5 mt-1 text-xs">
              <span class="text-slate-400 font-medium">Piac:</span>
              <span class="text-slate-200 font-semibold">${escapeHtml(item.marketName || '')}</span>
              <span class="text-slate-600">&bull;</span>
              <span class="text-slate-400 font-medium">Tipp:</span>
              <span class="text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/40">${escapeHtml(item.outcomeName || '')}</span>
            </div>
          </div>

          <div class="flex items-center gap-2 text-right">
            <div>
              <span class="text-base font-black text-white">${Number(item.odds || 0).toFixed(2)}</span>
              <span class="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Odds</span>
            </div>
            <div class="px-2 py-1 rounded-lg ${riskInfo.badgeClass} text-[10px] font-bold text-center">
              <span>${riskInfo.label}</span>
              <span class="block text-[9px] opacity-80">${item.riskScore || 5}/10</span>
            </div>
          </div>
        </div>

        ${item.finalScore ? `
          <div class="text-[11px] text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center justify-between">
            <span>⚽ <strong>Hivatalos végeredmény:</strong> ${escapeHtml(item.finalScore)}</span>
            <span class="text-slate-500 text-[10px]">${item.verificationMethod === 'tippmix_api' ? 'TippmixPro API' : 'Webes ellenőrzés'}</span>
          </div>
        ` : (isPending ? `
          <div class="text-[10px] text-amber-300/80 bg-amber-950/20 px-2.5 py-1 rounded-lg border border-amber-900/30 flex items-center gap-1.5">
            <span>ℹ️</span>
            <span>A mérkőzés lejárta után a rendszer automatikusan ellenőrzi az eredményt.</span>
          </div>
        ` : '')}
      `;

      historyModalBody.appendChild(card);
    });
  } catch (err) {
    historyModalBody.innerHTML = `
      <div class="glass-card rounded-2xl p-6 text-center text-rose-400 text-xs space-y-2 border border-rose-900/40">
        <p>Hiba történt az előzmények lekérése közben: ${escapeHtml(err.message)}</p>
        <button type="button" onclick="fetchAndRenderHistory()" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold">Újrapróbálkozás</button>
      </div>
    `;
  }
}

async function init() {
  initHomeControls();
  initTipHistoryModal();
  loadBettingStats();

  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.sports) {
      data.sports.forEach(s => {
        const badgeEl = s.tippmixId === 1 ? sportCount1 : (s.tippmixId === 5 ? sportCount5 : (s.tippmixId === 16 ? sportCount16 : null));
        if (badgeEl) {
          const todayCount = Number(s.todayUpcomingCount ?? s.count ?? 0);
          const totalCount = Number(s.totalCount ?? 0);

          if (todayCount > 0) {
            badgeEl.textContent = todayCount;
            badgeEl.className = 'px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-emerald-400 font-bold';
            badgeEl.title = `Mérkőzések a következő 24 órában: ${todayCount} (Heti teljes: ${totalCount})`;
          } else {
            badgeEl.textContent = totalCount > 0 ? `0 (${totalCount})` : '0';
            badgeEl.className = 'px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-bold';
            badgeEl.title = `A következő 24 órában nincs mérkőzés (Heti fordulóban: ${totalCount})`;
          }
        }
      });

      const rollingTotal = data.rolling24hEvents ?? data.todayEvents ?? data.totalEvents;
      catalogStatusText.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
        <span><strong class="text-white">${rollingTotal} mérkőzés</strong> a következő 24 órában (Foci, Tenisz, NFL) &bull; <span class="text-slate-400 text-[11px]">Heti teljes adatbázis: ${data.totalEvents}</span></span>
      `;
    }
  } catch (err) {
    console.warn('Státusz hiba:', err);
  }

  // Alapértelmezetten a Főoldal ("ÖSSZES") nézet jelenik meg
  switchNav('all');
}

init();
