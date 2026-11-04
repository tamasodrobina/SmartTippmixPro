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
const modalSportBadge = document.getElementById('modalSportBadge');
const modalCompetitionBadge = document.getElementById('modalCompetitionBadge');
const modalTimeBadge = document.getElementById('modalTimeBadge');
const modalMatchTitle = document.getElementById('modalMatchTitle');
const modalLoading = document.getElementById('modalLoading');
const modalContent = document.getElementById('modalContent');
const modalTipsList = document.getElementById('modalTipsList');

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

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Hiba az elemzés során.');

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

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Hiba a mérkőzés elemzése során.');

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
function renderAnalysisResults(payload, metaLabel) {
  const result = payload.result || {};
  const tips = Array.isArray(result.tips) ? result.tips : [];

  resultsMetaBadge.textContent = metaLabel;
  analysisOverviewText.textContent = result.analysisOverview || 'Az elemzés elkészült a kiválasztott feltételek alapján.';

  if (payload.fromCache) {
    cacheStatusBadge.textContent = '⚡ Okos Gyorsítótárból (0 API hívás)';
    cacheStatusBadge.classList.remove('hidden');
    forceRefreshBtn.classList.remove('hidden');
  } else {
    cacheStatusBadge.classList.add('hidden');
    forceRefreshBtn.classList.remove('hidden');
  }

  tipsContainer.innerHTML = '';
  if (tips.length === 0) {
    tipsContainer.innerHTML = `
      <div class="glass-card rounded-2xl p-6 text-center text-slate-400 text-sm">
        Nem található tipp a megadott odds sávban. Próbálj tágabb odds határokat beállítani!
      </div>
    `;
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
    optAll.textContent = `🌐 Összes ország / liga (${totalTodayAll} mai meccs)`;
    countryGroupSelect.appendChild(optAll);

    countryGroups.forEach(cg => {
      const opt = document.createElement('option');
      opt.value = cg.groupName;
      const flag = getCountryFlag(cg.groupName);
      const matchBadge = cg.todayMatches > 0 ? `(${cg.todayMatches} mai meccs)` : `(0 mai meccs)`;
      opt.textContent = `${flag} ${cg.groupName} ${matchBadge}`;
      countryGroupSelect.appendChild(opt);
    });

    // Alapértelmezett kiválasztás: az első olyan rangos csoport, aminek MA van meccse (pl. Nemzetközi klubcsapatok - BL)
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

  // Rendezés a csoporton belül: mai meccsekkel rendelkezők legelőre, majd presztízs szerint
  availableComps.sort((a, b) => {
    const hasTodayA = a.todayMatches > 0 ? 1 : 0;
    const hasTodayB = b.todayMatches > 0 ? 1 : 0;
    if (hasTodayB !== hasTodayA) return hasTodayB - hasTodayA;
    if (b.prestigeScore !== a.prestigeScore) return b.prestigeScore - a.prestigeScore;
    if (b.todayMatches !== a.todayMatches) return b.todayMatches - a.todayMatches;
    return b.totalMatches - a.totalMatches;
  });

  const totalTodaySub = availableComps.reduce((acc, c) => acc + c.todayMatches, 0);
  countryTodayMatchesBadge.textContent = `${totalTodaySub} mai mérkőzés elérhető`;

  // Első opció: "Összes osztály ebből az országból"
  const optAllSub = document.createElement('option');
  optAllSub.value = 'ALL';
  optAllSub.textContent = `⭐ Összes osztály ebből (${totalTodaySub} mai meccs)`;
  competitionSubSelect.appendChild(optAllSub);

  availableComps.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.key;
    const star = c.todayMatches > 0 ? '⚽ ' : '';
    const matchCountStr = c.todayMatches > 0 ? `(${c.todayMatches} mai meccs)` : `(0 mai meccs)`;
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
async function loadLeagueMatches() {
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
        maxOdds
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
    matchesSectionTitle.textContent = `${groupText} • ${compText} (Kizárólag mai mérkőzések)`;

    if (currentLeagueMatches.length === 0) {
      leagueMatchesList.innerHTML = `
        <div class="glass-card rounded-2xl p-8 text-center space-y-2 text-slate-400">
          <p class="text-sm font-semibold">Nincs aznapi mérkőzés a kiválasztott osztályban/bajnokságban ebben az odds sávban.</p>
          <p class="text-xs text-slate-500">Válassz másik bajnokságot vagy az "Összes osztály ebből" lehetőséget!</p>
        </div>
      `;
      return;
    }

    renderLeagueMatchRows(currentLeagueMatches);
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

async function openDetailedModal(eventId, eventName, matchObj) {
  modalMatchTitle.textContent = eventName;
  modalSportBadge.textContent = matchObj ? `${getSportIcon(matchObj.sportId)} ${matchObj.sportName || 'Sport'}` : 'Mérkőzés';
  modalCompetitionBadge.textContent = matchObj ? (matchObj.competitionName || '') : '';
  modalTimeBadge.textContent = matchObj ? formatHungarianDate(matchObj.eventDate) : 'Ma';

  modalLoading.classList.remove('hidden');
  modalContent.classList.add('hidden');
  detailedModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

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
        tipsCount: 3
      })
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    renderModalContent(data.result);
  } catch (err) {
    console.error('Hiba a részletes elemzés lekérésekor:', err);
    modalLoading.innerHTML = `
      <div class="text-rose-400 p-4">
        <p class="font-bold">Az elemzés nem sikerült.</p>
        <p class="text-xs text-rose-300 mt-1">${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

function renderModalContent(result = {}) {
  modalLoading.classList.add('hidden');
  modalContent.classList.remove('hidden');

  // Top 3 Tippek - Csak a releváns információk megjelenítése
  const tips = result.tips || [];
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

async function init() {
  initHomeControls();

  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.sports) {
      data.sports.forEach(s => {
        if (s.tippmixId === 1) sportCount1.textContent = s.count;
        if (s.tippmixId === 5) sportCount5.textContent = s.count;
        if (s.tippmixId === 16) sportCount16.textContent = s.count;
      });
      catalogStatusText.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
        <span><strong class="text-white">${data.totalEvents} mérkőzés</strong> elérhető (Foci, Tenisz, NFL)</span>
      `;
    }
  } catch (err) {
    console.warn('Státusz hiba:', err);
  }

  // Alapértelmezetten a Főoldal ("ÖSSZES") nézet jelenik meg
  switchNav('all');
}

init();
