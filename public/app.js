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

// Bajnokság & Meccs táblázat elemek (Sportág nézet)
const leagueSectionHeading = document.getElementById('leagueSectionHeading');
const selectAllLeaguesBtn = document.getElementById('selectAllLeaguesBtn');
const selectTopLeaguesBtn = document.getElementById('selectTopLeaguesBtn');
const prestigiousBadgesContainer = document.getElementById('prestigiousBadgesContainer');
const toggleMoreLeaguesBtn = document.getElementById('toggleMoreLeaguesBtn');
const moreLeaguesBtnText = document.getElementById('moreLeaguesBtnText');
const moreLeaguesChevron = document.getElementById('moreLeaguesChevron');
const moreLeaguesContainer = document.getElementById('moreLeaguesContainer');

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
const modalRefereeName = document.getElementById('modalRefereeName');
const modalRefereeCards = document.getElementById('modalRefereeCards');
const modalRefereePenalties = document.getElementById('modalRefereePenalties');
const modalRefereeSummary = document.getElementById('modalRefereeSummary');
const modalCornerText = document.getElementById('modalCornerText');
const modalCardText = document.getElementById('modalCardText');
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

// Eredmények kirajzolása a főoldalon
function renderAnalysisResults(payload, metaLabel) {
  const result = payload.result || {};
  const tips = Array.isArray(result.tips) ? result.tips : [];

  resultsMetaBadge.textContent = metaLabel;
  analysisOverviewText.textContent = result.analysisOverview || 'Az elemzés elkészült a kiválasztott feltételek alapján.';

  if (payload.fromCache) {
    cacheStatusBadge.textContent = `⚡ Okos Gyorsítótárból (0 API hívás)`;
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

      const card = document.createElement('article');
      card.className = 'tip-card glass-card rounded-2xl overflow-hidden shadow-xl border border-slate-800 p-4 sm:p-5 space-y-3';
      card.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-1 rounded-lg text-xs font-black uppercase ${rank === 1 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-emerald-400 border border-emerald-500/30'}">
              #${rank}. Tipp
            </span>
            <span class="text-xs font-semibold text-slate-300">${sportIcon} ${escapeHtml(tip.competitionName || '')}</span>
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
            <div class="min-w-0">
              <span class="text-[10px] uppercase font-bold text-slate-400 block truncate">${escapeHtml(tip.marketName)}</span>
              <span class="text-sm font-black text-emerald-400 block truncate mt-0.5">${escapeHtml(tip.outcomeName)}</span>
              <span class="text-[11px] text-slate-400 mt-0.5 block">Esély: <strong class="text-white">${prob}%</strong></span>
            </div>
            <div class="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-lg">
              ${Number(tip.odds).toFixed(2)}
            </div>
          </div>
        </div>

        <!-- Részletes kifejtés & kockázat -->
        <div class="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div class="text-slate-400">
            Kockázati szint: <strong class="text-amber-400">${escapeHtml(risk.level || 'Közepes')} (${risk.score || 4}/10)</strong>
          </div>
          <span class="text-slate-500 italic text-[11px]">${escapeHtml(risk.explanation || '')}</span>
        </div>
      `;
      tipsContainer.appendChild(card);
    });
  }

  resultsSection.classList.remove('hidden');
}

// ============================================================================
// 4. SPORTÁG NÉZET: BAJNOKSÁGOK ÉS AZNAPI MECCSEK TOP 2 TIPPPEL
// ============================================================================

async function loadSportCompetitions(sportId, resetSelection = false) {
  prestigiousBadgesContainer.innerHTML = `<div class="text-xs text-slate-500 animate-pulse">Rangos bajnokságok betöltése...</div>`;
  moreLeaguesContainer.innerHTML = '';

  try {
    const res = await fetch(`/api/competitions?sports=${sportId}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    allCompetitions = data.competitions || [];

    // Kiemelt elitsorozatok (BL, EL, Premier League, La Liga, NB I, NFL, stb.)
    const prestigious = allCompetitions.filter(c => c.prestigeScore >= 750 || c.displayName.toLowerCase().includes('bl') || c.displayName.toLowerCase().includes('el'));
    const others = allCompetitions.filter(c => !prestigious.includes(c));

    if (resetSelection || selectedCompetitionKeys.size === 0) {
      selectedCompetitionKeys.clear();
      const topToday = prestigious.filter(c => c.todayMatches > 0);
      if (topToday.length > 0) {
        selectedCompetitionKeys.add(topToday[0].key);
      } else if (prestigious.length > 0) {
        selectedCompetitionKeys.add(prestigious[0].key);
      } else if (allCompetitions.length > 0) {
        selectedCompetitionKeys.add(allCompetitions[0].key);
      }
    }

    renderCompetitionBadges(prestigious, others);
    loadLeagueMatches();
  } catch (err) {
    console.error('Hiba a bajnokságok betöltésekor:', err);
    prestigiousBadgesContainer.innerHTML = `<div class="text-xs text-rose-400">Nem sikerült betölteni a bajnokságokat.</div>`;
  }
}

function renderCompetitionBadges(prestigious, others) {
  prestigiousBadgesContainer.innerHTML = prestigious.map(c => {
    const active = selectedCompetitionKeys.has(c.key);
    const icon = getSportIcon(c.sportId);
    const matchCountStr = c.todayMatches > 0 ? `${c.todayMatches} mai` : `${c.totalMatches}`;
    return `
      <button type="button" data-comp-key="${escapeHtml(c.key)}"
        class="comp-badge-btn px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
          active
            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
        }">
        <span>${icon}</span>
        <span>${escapeHtml(c.displayName)}</span>
        <span class="px-1.5 py-0.2 rounded text-[10px] font-black ${active ? 'bg-slate-950/20 text-white' : 'bg-slate-800 text-emerald-400'}">
          ${matchCountStr}
        </span>
      </button>
    `;
  }).join('');

  moreLeaguesContainer.innerHTML = others.map(c => {
    const active = selectedCompetitionKeys.has(c.key);
    const icon = getSportIcon(c.sportId);
    const matchCountStr = c.todayMatches > 0 ? `${c.todayMatches} mai` : `${c.totalMatches}`;
    return `
      <button type="button" data-comp-key="${escapeHtml(c.key)}"
        class="comp-badge-btn p-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-between gap-1 border truncate ${
          active
            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
        }">
        <span class="truncate flex items-center gap-1">
          <span>${icon}</span>
          <span class="truncate">${escapeHtml(c.displayName)}</span>
        </span>
        <span class="px-1.5 py-0.2 rounded text-[10px] shrink-0 ${active ? 'bg-slate-950/20 text-white' : 'bg-slate-800 text-slate-400'}">
          ${matchCountStr}
        </span>
      </button>
    `;
  }).join('');

  document.querySelectorAll('.comp-badge-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.compKey;
      if (selectedCompetitionKeys.has(key)) {
        if (selectedCompetitionKeys.size > 1) {
          selectedCompetitionKeys.delete(key);
        }
      } else {
        selectedCompetitionKeys.add(key);
      }
      renderCompetitionBadges(
        allCompetitions.filter(c => c.prestigeScore >= 750 || c.displayName.toLowerCase().includes('bl') || c.displayName.toLowerCase().includes('el')),
        allCompetitions.filter(c => !(c.prestigeScore >= 750 || c.displayName.toLowerCase().includes('bl') || c.displayName.toLowerCase().includes('el')))
      );
      loadLeagueMatches();
    });
  });
}

selectAllLeaguesBtn.addEventListener('click', () => {
  selectedCompetitionKeys.clear();
  allCompetitions.forEach(c => {
    if (c.todayMatches > 0) selectedCompetitionKeys.add(c.key);
  });
  if (selectedCompetitionKeys.size === 0) {
    allCompetitions.forEach(c => selectedCompetitionKeys.add(c.key));
  }
  loadSportCompetitions(activeNav);
});

selectTopLeaguesBtn.addEventListener('click', () => {
  selectedCompetitionKeys.clear();
  allCompetitions.filter(c => c.prestigeScore >= 800 || c.displayName.toLowerCase().includes('bl') || c.displayName.toLowerCase().includes('el')).forEach(c => {
    selectedCompetitionKeys.add(c.key);
  });
  loadSportCompetitions(activeNav);
});

toggleMoreLeaguesBtn.addEventListener('click', () => {
  const isHidden = moreLeaguesContainer.classList.contains('hidden');
  moreLeaguesContainer.classList.toggle('hidden', !isHidden);
  moreLeaguesChevron.classList.toggle('rotate-180', isHidden);
  moreLeaguesBtnText.textContent = isHidden ? 'Kevesebb megjelenítése' : 'Továbbiak megjelenítése';
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
    const res = await fetch('/api/matches/by-competitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        competitionKeys: Array.from(selectedCompetitionKeys),
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

    if (currentLeagueMatches.length === 0) {
      leagueMatchesList.innerHTML = `
        <div class="glass-card rounded-2xl p-8 text-center space-y-2 text-slate-400">
          <p class="text-sm font-semibold">Nincs aznapi mérkőzés a kiválasztott bajnokságban ebben az odds sávban.</p>
          <p class="text-xs text-slate-500">Próbálj más bajnokságot választani vagy kattints az "Összes mai meccs" gombra!</p>
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

  // 1. Játékvezetői vizsgálat
  const ref = result.refereeAnalysis || {};
  modalRefereeName.textContent = ref.refereeName || 'Nem ismert / Információ alatt';
  modalRefereeCards.textContent = ref.cardAverage || 'Átlagos lapmutató';
  modalRefereePenalties.textContent = ref.penaltyTendency || 'Közepes tendencia';
  modalRefereeSummary.textContent = ref.summary || 'A játékvezetői stílus nem befolyásolja drasztikusan a mérkőzés ritmusát.';

  // 2. Szögletek & Sárga lapok
  const cc = result.cornersAndCards || {};
  modalCornerText.textContent = cc.cornerAnalysis || 'Kiegyensúlyozott szélsőjáték és mezőnyharc várható.';
  modalCardText.textContent = cc.cardAnalysis || 'Fegyelmezett játék várható, közepes lapos határokkal.';

  // 3. Top 3 Tippek
  const tips = result.tips || [];
  modalTipsList.innerHTML = tips.map((t, idx) => {
    const rank = t.rank || idx + 1;
    const reasoning = t.detailedReasoning || {};
    const risk = t.riskAssessment || {};
    const prob = t.estimatedProbability || 75;

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
