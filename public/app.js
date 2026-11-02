// ============================================================================
// TippmixPro AI Elemző - Frontend Alkalmazás (Mobil + Asztali Optimalizált)
// ============================================================================

const STORAGE_KEY_API = 'tippmix_ai_gemini_key';

const SPORT_ICONS = {
  'Labdarúgás': '⚽',
  'Labdarúgás (Foci)': '⚽',
  'Foci': '⚽',
  'Tenisz': '🎾',
  'Kosárlabda': '🏀',
  'Jégkorong': '🏒',
  'Kézilabda': '🤾',
  'Darts': '🎯',
  'Snooker': '🎱',
  'Asztalitenisz': '🏓',
  'Röplabda': '🏐',
  'Vízilabda': '🤽',
  'Amerikai foci': '🏈',
  'Amerikai futball': '🏈',
  'Baseball': '⚾',
  'Futsal': '⚽',
  'Rögbi': '🏉',
  'Ligarögbi': '🏉',
  'Ausztrál futball': '🏉',
  'Floorball': '🏑',
  'Gyephoki': '🏑',
  'Bandy': '🏑',
  'E-Sport': '🎮',
  'E-Sport (CS2, LoL, Dota, E-Foci, E-Kosár)': '🎮',
  'Box': '🥊',
  'Box (Ökölvívás)': '🥊',
  'MMA': '🥋',
  'MMA (UFC / Ketrecharc)': '🥋',
  'Motorsport': '🏎️',
  'Motorsport (F1, MotoGP, Rally)': '🏎️',
  'Krikett': '🏏',
  'Lóverseny': '🏇',
  'Golf': '⛳',
  'Kerékpár': '🚴',
  'Tollaslabda': '🏸',
  'Téli sportok': '❄️',
  'Téli sportok (Sí, Biatlon)': '❄️',
  'Strandfoci': '🏖️',
  'Strandröplabda': '🏖️',
  'Kabaddi': '🤼',
  'Netball': '🏐',
  'Pesäpallo': '⚾',
  'Speciális': '⭐',
  'Speciális fogadások': '⭐'
};

let serverHasApiKey = false;
let selectedAutocompleteEventId = null;
let loadingTimer = null;
let allSportsList = [];
let lastExecutedMode = 'interval';

// DOM elemek
const headerOddsBadge = document.getElementById('headerOddsBadge');
const minOddsInput = document.getElementById('minOddsInput');
const maxOddsInput = document.getElementById('maxOddsInput');
const tipsCountSelect = document.getElementById('tipsCountSelect');

const hoursSelect = document.getElementById('hoursSelect');
const sportSelect = document.getElementById('sportSelect');
const analyzeIntervalBtn = document.getElementById('analyzeIntervalBtn');
const analyzeIntervalBtnLabel = document.getElementById('analyzeIntervalBtnLabel');

const featuredSportsBar = document.getElementById('featuredSportsBar');
const toggleMoreSportsBtn = document.getElementById('toggleMoreSportsBtn');
const moreSportsChevron = document.getElementById('moreSportsChevron');
const moreSportsPanel = document.getElementById('moreSportsPanel');
const moreSportsGrid = document.getElementById('moreSportsGrid');
const closeMoreSportsBtn = document.getElementById('closeMoreSportsBtn');

const customMatchInput = document.getElementById('customMatchInput');
const clearCustomInputBtn = document.getElementById('clearCustomInputBtn');
const autocompleteDropdown = document.getElementById('autocompleteDropdown');
const analyzeCustomBtn = document.getElementById('analyzeCustomBtn');
const analyzeCustomBtnLabel = document.getElementById('analyzeCustomBtnLabel');

const catalogStatusText = document.getElementById('catalogStatusText');
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
const groundingFooter = document.getElementById('groundingFooter');
const webSourcesList = document.getElementById('webSourcesList');

// ============================================================================
// 1. INICIALIZÁLÁS (ÓRA, TIPPSZÁM 1-10, ODDS TARTOMÁNY, SPORTÁG SÁV)
// ============================================================================

function initControls() {
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

  function syncDynamicLabels() {
    const count = Number(tipsCountSelect.value) || 3;
    const minO = Number(minOddsInput.value || 1.30).toFixed(2);
    const maxO = Number(maxOddsInput.value || 2.00).toFixed(2);
    headerOddsBadge.textContent = `${minO} – ${maxO} Odds • Top ${count}`;
    analyzeIntervalBtnLabel.textContent = `Időintervallum Elemzése (Top ${count} • ${minO}–${maxO})`;
    analyzeCustomBtnLabel.textContent = `Mérkőzés Elemzése (Top ${count} Tipp)`;
  }

  tipsCountSelect.addEventListener('change', syncDynamicLabels);
  minOddsInput.addEventListener('input', syncDynamicLabels);
  maxOddsInput.addEventListener('input', syncDynamicLabels);

  const presetBtns = document.querySelectorAll('.odds-preset-btn');
  function updateOddsPresetStyles() {
    const curMin = Number(minOddsInput.value).toFixed(2);
    const curMax = Number(maxOddsInput.value).toFixed(2);
    presetBtns.forEach(btn => {
      if (btn.dataset.min === curMin && btn.dataset.max === curMax) {
        btn.className = 'odds-preset-btn rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 transition truncate px-1';
      } else {
        btn.className = 'odds-preset-btn rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition truncate px-1';
      }
    });
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      minOddsInput.value = btn.dataset.min;
      maxOddsInput.value = btn.dataset.max;
      updateOddsPresetStyles();
      syncDynamicLabels();
    });
  });

  minOddsInput.addEventListener('change', updateOddsPresetStyles);
  maxOddsInput.addEventListener('change', updateOddsPresetStyles);

  const quickBtns = document.querySelectorAll('.quick-hour-btn');
  function updateQuickBtnStyles() {
    const currentVal = hoursSelect.value;
    quickBtns.forEach(btn => {
      if (btn.dataset.quickHours === currentVal) {
        btn.className = 'quick-hour-btn h-8 sm:h-7 px-2 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 transition text-center';
      } else {
        btn.className = 'quick-hour-btn h-8 sm:h-7 px-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition text-center';
      }
    });
  }

  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      hoursSelect.value = btn.dataset.quickHours;
      updateQuickBtnStyles();
    });
  });

  hoursSelect.addEventListener('change', updateQuickBtnStyles);
  syncDynamicLabels();
}

function renderSportsNavigation(sports) {
  allSportsList = sports || [];
  const currentSelected = sportSelect.value || 'all';

  sportSelect.innerHTML = `<option value="all">🌐 Összes sportág (Minden)</option>`;
  for (const s of allSportsList) {
    const icon = s.icon || SPORT_ICONS[s.sportName] || '🏅';
    const labelName = s.shortName || s.sportName;
    const countLabel = s.count > 0 ? ` (${s.count})` : '';
    const opt = document.createElement('option');
    opt.value = String(s.sportId);
    opt.textContent = `${icon} ${labelName}${countLabel}`;
    if (String(s.sportId) === currentSelected) opt.selected = true;
    sportSelect.appendChild(opt);
  }

  const featured = allSportsList.filter(s => s.featured);
  const others = allSportsList.filter(s => !s.featured);

  const allActive = currentSelected === 'all';
  let featuredHtml = `
    <button type="button" data-sport-key="all"
      class="sport-nav-btn shrink-0 h-8 px-2.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer ${
        allActive
          ? 'bg-rose-600 text-white shadow-sm'
          : 'text-slate-300 hover:text-white hover:bg-slate-800'
      }">
      <span>🌐</span>
      <span>ÖSSZES</span>
    </button>
  `;

  for (const s of featured) {
    const active = String(s.sportId) === currentSelected;
    const badge = s.count > 0
      ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold leading-none ${active ? 'bg-black/25 text-white' : 'bg-slate-800 text-emerald-400'}">${s.count}</span>`
      : '';
    featuredHtml += `
      <button type="button" data-sport-key="${escapeHtml(s.sportId)}"
        class="sport-nav-btn shrink-0 h-8 px-2.5 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 transition cursor-pointer ${
          active
            ? 'bg-emerald-500 text-slate-950 shadow-sm'
            : 'text-slate-300 hover:text-white hover:bg-slate-800'
        }">
        <span>${s.icon || '🏅'}</span>
        <span>${escapeHtml(s.shortName || s.sportName)}</span>
        ${badge}
      </button>
    `;
  }

  featuredSportsBar.innerHTML = featuredHtml;

  moreSportsGrid.innerHTML = others.map(s => {
    const active = String(s.sportId) === currentSelected;
    const badge = s.count > 0
      ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold leading-none bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">${s.count}</span>`
      : '';
    return `
      <button type="button" data-sport-key="${escapeHtml(s.sportId)}"
        class="sport-nav-btn h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wide flex items-center justify-between gap-1.5 transition cursor-pointer border min-w-0 ${
          active
            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
            : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
        }">
        <span class="flex items-center gap-1.5 min-w-0 truncate">
          <span class="text-sm shrink-0">${s.icon || '🏅'}</span>
          <span class="truncate">${escapeHtml(s.shortName || s.sportName)}</span>
        </span>
        ${badge}
      </button>
    `;
  }).join('');

  document.querySelectorAll('.sport-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sportKey;
      sportSelect.value = key;
      moreSportsPanel.classList.add('hidden');
      moreSportsChevron.classList.remove('rotate-180');
      renderSportsNavigation(allSportsList);
    });
  });
}

sportSelect.addEventListener('change', () => {
  renderSportsNavigation(allSportsList);
});

toggleMoreSportsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isHidden = moreSportsPanel.classList.contains('hidden');
  moreSportsPanel.classList.toggle('hidden', !isHidden);
  moreSportsChevron.classList.toggle('rotate-180', isHidden);
});

closeMoreSportsBtn.addEventListener('click', () => {
  moreSportsPanel.classList.add('hidden');
  moreSportsChevron.classList.remove('rotate-180');
});

document.addEventListener('click', (e) => {
  if (!moreSportsPanel.classList.contains('hidden')) {
    if (!moreSportsPanel.contains(e.target) && !toggleMoreSportsBtn.contains(e.target)) {
      moreSportsPanel.classList.add('hidden');
      moreSportsChevron.classList.remove('rotate-180');
    }
  }
});

function getStoredApiKey() {
  return '';
}

function updateApiKeyBadge() {
  // A szerver környezeti változóját használjuk
}

async function loadServerStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    serverHasApiKey = Boolean(data.hasServerApiKey);
    updateApiKeyBadge();

    if (data.sports) {
      renderSportsNavigation(data.sports);
    }

    if (data.ok) {
      catalogStatusText.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
        <span class="truncate"><strong class="text-slate-200">${data.totalEvents} meccs</strong> &bull; <strong class="text-emerald-400">${data.sports.length} sportág</strong></span>
      `;
    } else {
      catalogStatusText.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
        <span class="truncate">${data.sports?.length || 34} sportág elérhető</span>
      `;
    }
  } catch (err) {
    console.warn('Státusz lekérdezési hiba:', err);
  }
}

// ============================================================================
// 2. AUTOCOMPLETE KERESŐ A SZÖVEGMEZŐHÖZ
// ============================================================================

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

      autocompleteDropdown.innerHTML = data.matches.map(m => {
        const icon = SPORT_ICONS[m.sportName] || '🏅';
        const timeStr = formatHungarianDate(m.eventDate);
        return `
          <button type="button" data-event-id="${m.eventId}" data-event-name="${escapeHtml(m.eventName)}"
            class="autocomplete-item w-full text-left px-3.5 py-2.5 hover:bg-slate-800 transition flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="text-xs sm:text-sm font-semibold text-white truncate">${icon} ${escapeHtml(m.eventName)}</div>
              <div class="text-[11px] text-slate-400 truncate">${escapeHtml(m.sportName || '')} &bull; ${escapeHtml(m.competitionGroupName || '')} - ${escapeHtml(m.competitionName || '')}</div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-[11px] font-medium text-emerald-400">${timeStr}</div>
              <div class="text-[10px] text-slate-500">${m.totalMarketCount || 1} piac</div>
            </div>
          </button>
        `;
      }).join('');

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

// ============================================================================
// 3. ELEMZÉS INDÍTÁSA (IDŐINTERVALLUM ÉS EGYEDI MÉRKŐZÉS + SMART CACHE)
// ============================================================================

function getFilterSettings() {
  const rawMin = Number(minOddsInput.value) || 1.30;
  const rawMax = Number(maxOddsInput.value) || 2.00;
  const minOdds = Math.max(1.01, Math.min(rawMin, rawMax));
  const maxOdds = Math.max(1.05, Math.max(rawMin, rawMax));
  const tipsCount = Math.min(10, Math.max(1, Number(tipsCountSelect.value) || 3));
  return { minOdds, maxOdds, tipsCount };
}

function ensureApiKeyOrOpenModal() {
  return '';
}

function startLoadingAnimation(mode, subtitle) {
  const { minOdds, maxOdds, tipsCount } = getFilterSettings();
  errorSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  loadingTitle.textContent = subtitle;
  loadingProgressBar.style.width = '20%';

  const steps = mode === 'interval'
    ? [
        { pct: '25%', text: `1/4: Mérkőzések és ${minOdds.toFixed(2)}–${maxOdds.toFixed(2)} szorzók szűrése (ellenőrzés a gyorsítótárban)...` },
        { pct: '55%', text: '2/4: Barangolás az interneten: nemzetközi elemző- és statisztikai oldalak átvizsgálása...' },
        { pct: '80%', text: '3/4: Forma, H2H, gól/pont/szett/map átlagok összevetése...' },
        { pct: '92%', text: `4/4: A Top ${tipsCount} legvalószínűbb tipp kiválasztása és részletes kockázatértékelés...` }
      ]
    : [
        { pct: '30%', text: `1/3: Mérkőzés és ${minOdds.toFixed(2)}–${maxOdds.toFixed(2)} közötti piacok azonosítása...` },
        { pct: '65%', text: '2/3: Barangolás az interneten: statisztikák, hírek és tippoldalak elemzése...' },
        { pct: '90%', text: `3/3: A Top ${tipsCount} legvalószínűbb tipp összeállítása és kockázati besorolás...` }
      ];

  let idx = 0;
  loadingStepText.textContent = steps[0].text;

  clearInterval(loadingTimer);
  loadingTimer = setInterval(() => {
    idx = Math.min(steps.length - 1, idx + 1);
    loadingStepText.textContent = steps[idx].text;
    loadingProgressBar.style.width = steps[idx].pct;
  }, 4000);
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

async function runIntervalAnalysis(forceRefresh = false) {
  const apiKey = ensureApiKeyOrOpenModal();
  if (apiKey === null) return;

  lastExecutedMode = 'interval';
  const hours = Number(hoursSelect.value) || 6;
  const sportId = sportSelect.value || 'all';
  const { minOdds, maxOdds, tipsCount } = getFilterSettings();
  const sportLabel = sportSelect.options[sportSelect.selectedIndex]?.textContent || 'Összes sportág';

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
        forceRefresh: Boolean(forceRefresh),
        apiKey
      })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Hiba történt az elemzés során.');
    }

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

async function runCustomAnalysis(forceRefresh = false) {
  const query = customMatchInput.value.trim();
  if (!query) {
    showError('Kérlek írj be egy mérkőzést, csapatot, játékost vagy bajnokságot a keresőmezőbe!');
    customMatchInput.focus();
    return;
  }

  const apiKey = ensureApiKeyOrOpenModal();
  if (apiKey === null) return;

  lastExecutedMode = 'custom';
  const { minOdds, maxOdds, tipsCount } = getFilterSettings();

  startLoadingAnimation('custom', `"${query}" részletes internetes elemzése...`);
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
        forceRefresh: Boolean(forceRefresh),
        apiKey
      })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Hiba történt a mérkőzés elemzése során.');
    }

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
  if (lastExecutedMode === 'custom') {
    runCustomAnalysis(true);
  } else {
    runIntervalAnalysis(true);
  }
});

// ============================================================================
// 4. EREDMÉNYEK ÉS KATTINTHATÓ TIPP KÁRTYÁK MEGJELENÍTÉSE
// ============================================================================

function getRiskVisuals(level = '', score = 4) {
  const norm = level.toLowerCase();
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

function renderAnalysisResults(payload, metaLabel) {
  const result = payload.result || {};
  const tips = Array.isArray(result.tips) ? result.tips : [];

  resultsMetaBadge.textContent = metaLabel;
  analysisOverviewText.textContent = result.analysisOverview || 'Az elemzés elkészült a kiválasztott feltételek és az internetes források alapján.';

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
        Nem sikerült a megadott odds-tartományban tippet kinyerni. Próbálj szélesebb odds-tartományt vagy nagyobb időintervallumot!
      </div>
    `;
  } else {
    tips.forEach((tip, index) => {
      const rank = tip.rank || index + 1;
      const sportIcon = SPORT_ICONS[tip.sportName] || '🏅';
      const timeFormatted = formatHungarianDate(tip.eventDate);
      const oddsVal = Number(tip.odds || 1.5).toFixed(2);
      const prob = Math.min(95, Math.max(20, Number(tip.estimatedProbability) || Math.round((1 / Number(oddsVal)) * 94)));

      const riskInfo = getRiskVisuals(tip.riskAssessment?.level, tip.riskAssessment?.score);
      const reasoning = tip.detailedReasoning || {};
      const keyFactors = Array.isArray(reasoning.keyFactors) ? reasoning.keyFactors : [];
      const sources = Array.isArray(tip.consultedSources) ? tip.consultedSources : [];

      const card = document.createElement('article');
      card.className = 'tip-card glass-card rounded-2xl overflow-hidden shadow-xl border border-slate-800';

      card.innerHTML = `
        <!-- KATTINTHATÓ FEJLÉC / FŐ KÁRTYA -->
        <div class="tip-card-trigger p-4 sm:p-6 cursor-pointer select-none space-y-3.5 sm:space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
              <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wider shrink-0 ${rank === 1 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-emerald-400 border border-emerald-500/30'}">
                #${rank}. Tipp
              </span>
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 shrink-0">
                <span>${sportIcon}</span>
                <span>${escapeHtml(tip.sportName || 'Sport')}</span>
              </span>
              <span class="text-xs text-slate-400 font-medium break-words">
                ${escapeHtml(tip.competitionName || '')}
              </span>
            </div>

            <span class="text-xs font-medium text-slate-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 shrink-0">
              🕒 ${escapeHtml(timeFormatted)}
            </span>
          </div>

          <!-- Mérkőzés és Fő Tipp Box -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-4 items-center">
            <div class="md:col-span-7 min-w-0 space-y-1">
              <h3 class="text-base sm:text-lg font-extrabold text-white leading-snug break-words">
                ${escapeHtml(tip.eventName || 'Mérkőzés')}
              </h3>
              <p class="text-xs sm:text-sm text-slate-300 leading-relaxed break-words">
                ${escapeHtml(tip.shortSummary || '')}
              </p>
            </div>

            <!-- Kiemelt Piac + Odds + Esély -->
            <div class="md:col-span-5 min-w-0 rounded-xl bg-slate-900 border border-emerald-500/35 p-3 sm:p-3.5 flex items-center justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="text-[11px] uppercase tracking-wider font-semibold text-slate-400 break-words">
                  ${escapeHtml(tip.marketName || 'Tippmix Piac')}
                </div>
                <div class="text-sm sm:text-base font-extrabold text-emerald-400 break-words mt-0.5">
                  ${escapeHtml(tip.outcomeName || 'Tipp')}
                </div>
                <div class="text-[11px] text-slate-400 mt-1">
                  Becsült esély: <strong class="text-white">${prob}%</strong>
                </div>
              </div>

              <div class="shrink-0">
                <div class="inline-flex flex-col items-center justify-center px-3.5 py-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 shadow-md">
                  <span class="text-[10px] font-bold uppercase tracking-wider opacity-80">Odds</span>
                  <span class="text-lg sm:text-xl font-black leading-none mt-0.5">${oddsVal}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Alsó sáv: Kockázati jelző + Mobilon teljes szélességű lenyitás gomb -->
          <div class="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
            <div class="flex items-center justify-between sm:justify-start gap-2">
              <span class="text-xs text-slate-400">Kockázati szint:</span>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold border ${riskInfo.badgeClass}">
                ${escapeHtml(riskInfo.label)} (${riskInfo.score}/10)
              </span>
            </div>

            <button type="button" class="toggle-details-btn w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-400 hover:text-emerald-300 bg-slate-900 sm:bg-transparent py-2 sm:py-0 px-3 sm:px-0 rounded-xl border border-slate-800 sm:border-0 transition">
              <span class="toggle-btn-text">Kattints a részletes indoklásért</span>
              <svg class="toggle-chevron w-4 h-4 transition-transform duration-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        <!-- LENYÍLÓ RÉSZLETES SZÖVEGES INDOKLÁS ÉS KOCKÁZATELEMZÉS -->
        <div class="tip-details-panel hidden border-t border-slate-800 bg-slate-950/90 p-4 sm:p-6 space-y-4 sm:space-y-5">

          <!-- 1. Miért ez a gondolat? -->
          <div class="space-y-2">
            <h4 class="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>Miért ez a gondolat? (Szakmai indoklás)</span>
            </h4>
            <p class="text-xs sm:text-sm text-slate-200 leading-relaxed bg-slate-900 p-3.5 sm:p-4 rounded-xl border border-slate-800 break-words">
              ${escapeHtml(reasoning.mainThesis || tip.shortSummary || '')}
            </p>
          </div>

          <!-- 2. Statisztikák + Elemző oldalak véleménye -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            <div class="bg-slate-900 p-3.5 sm:p-4 rounded-xl border border-slate-800 space-y-1.5 min-w-0">
              <h5 class="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <span>📊</span>
                <span>Forma, Statisztikák és H2H</span>
              </h5>
              <p class="text-xs sm:text-sm text-slate-300 leading-relaxed break-words">
                ${escapeHtml(reasoning.formAndStats || '')}
              </p>
            </div>

            <div class="bg-slate-900 p-3.5 sm:p-4 rounded-xl border border-slate-800 space-y-1.5 min-w-0">
              <h5 class="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <span>🌐</span>
                <span>Elemző- és Tippoldalak Konszenzusa</span>
              </h5>
              <p class="text-xs sm:text-sm text-slate-300 leading-relaxed break-words">
                ${escapeHtml(reasoning.expertConsensus || '')}
              </p>
            </div>
          </div>

          <!-- 3. Kulcstényezők -->
          ${keyFactors.length > 0 ? `
            <div class="space-y-2">
              <h5 class="text-xs font-bold uppercase tracking-wider text-slate-400">
                Kulcsérvek a tipp mellett
              </h5>
              <ul class="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                ${keyFactors.map(f => `
                  <li class="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 flex items-start gap-2 min-w-0">
                    <span class="text-emerald-400 font-bold mt-0.5 shrink-0">✔</span>
                    <span class="break-words">${escapeHtml(f)}</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          <!-- 4. MENNYIRE KOCKÁZATOS? -->
          <div class="rounded-xl border p-3.5 sm:p-4 space-y-2.5 ${riskInfo.boxClass}">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h5 class="text-xs sm:text-sm font-extrabold uppercase tracking-wider ${riskInfo.textClass} flex items-center gap-2">
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Mennyire kockázatos? — ${escapeHtml(riskInfo.label)} (${riskInfo.score}/10)</span>
              </h5>
              <div class="w-full sm:w-36 bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700 shrink-0">
                <div class="${riskInfo.barClass} h-full" style="width: ${riskInfo.score * 10}%"></div>
              </div>
            </div>
            <p class="text-xs sm:text-sm text-slate-200 leading-relaxed break-words">
              ${escapeHtml(tip.riskAssessment?.explanation || '')}
            </p>
          </div>

          <!-- 5. Források -->
          ${sources.length > 0 ? `
            <div class="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-400">
              <span class="font-semibold text-slate-300">Átvizsgált elemző források:</span>
              ${sources.map(s => `<span class="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">${escapeHtml(s)}</span>`).join('')}
            </div>
          ` : ''}

        </div>
      `;

      const trigger = card.querySelector('.tip-card-trigger');
      const detailsPanel = card.querySelector('.tip-details-panel');
      const chevron = card.querySelector('.toggle-chevron');
      const btnText = card.querySelector('.toggle-btn-text');

      trigger.addEventListener('click', () => {
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

  const webSources = Array.isArray(payload.webSources) ? payload.webSources : [];
  if (webSources.length > 0) {
    groundingFooter.classList.remove('hidden');
    const uniqueSources = [];
    const seenUrls = new Set();
    for (const s of webSources) {
      if (!seenUrls.has(s.url)) {
        seenUrls.add(s.url);
        uniqueSources.push(s);
      }
    }
    webSourcesList.innerHTML = uniqueSources.slice(0, 12).map(s => `
      <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 transition truncate max-w-full sm:max-w-xs">
        <span>🔗</span>
        <span class="truncate">${escapeHtml(s.title)}</span>
      </a>
    `).join('');
  } else {
    groundingFooter.classList.add('hidden');
  }

  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================================
// 6. SEGÉDFÜGGVÉNYEK
// ============================================================================

function formatHungarianDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const timePart = d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Ma ${timePart}`;
  if (isTomorrow) return `Holnap ${timePart}`;

  const datePart = d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
  return `${datePart} ${timePart}`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Indítás
initControls();
updateApiKeyBadge();
loadServerStatus();
