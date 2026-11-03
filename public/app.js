// ============================================================================
// SmartTippmixPro - Frontend Alkalmazás (NFL, Foci, Tenisz)
// ============================================================================

// Állapot (State)
let selectedSportIds = new Set([1]); // Alapértelmezett: Foci (1), de tenisz (5) és NFL (16) is hozzáadható
let selectedCompetitionKeys = new Set();
let allCompetitions = [];
let currentMatches = [];
let activeDetailedEvent = null;

// DOM elemek
const sportBtn1 = document.getElementById('sportBtn1');
const sportBtn5 = document.getElementById('sportBtn5');
const sportBtn16 = document.getElementById('sportBtn16');
const sportCount1 = document.getElementById('sportCount1');
const sportCount5 = document.getElementById('sportCount5');
const sportCount16 = document.getElementById('sportCount16');

const catalogStatusText = document.getElementById('catalogStatusText');
const minOddsInput = document.getElementById('minOddsInput');
const maxOddsInput = document.getElementById('maxOddsInput');
const oddsFilterBadge = document.getElementById('oddsFilterBadge');
const oddsPresetBtns = document.querySelectorAll('.odds-preset-btn');

const customSearchInput = document.getElementById('customSearchInput');
const customSearchSubmitBtn = document.getElementById('customSearchSubmitBtn');
const searchDropdown = document.getElementById('searchDropdown');

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
// 1. SEGÉDFÜGGVÉNYEK
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
  return {
    minOdds: Math.min(rawMin, rawMax),
    maxOdds: Math.max(rawMin, rawMax)
  };
}

// ============================================================================
// 2. SPORTÁG MULTI-SELECT KEZELÉS
// ============================================================================

function updateSportButtonStyles() {
  const btns = [
    { id: 1, btn: sportBtn1 },
    { id: 5, btn: sportBtn5 },
    { id: 16, btn: sportBtn16 }
  ];

  btns.forEach(({ id, btn }) => {
    const active = selectedSportIds.has(id);
    if (active) {
      btn.className = 'sport-multi-btn h-9 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 border border-emerald-400';
    } else {
      btn.className = 'sport-multi-btn h-9 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700';
    }
  });
}

function toggleSport(sportId) {
  const id = Number(sportId);
  if (selectedSportIds.has(id)) {
    // Ne engedjük, hogy 0 sportág legyen kiválasztva
    if (selectedSportIds.size > 1) {
      selectedSportIds.delete(id);
    }
  } else {
    selectedSportIds.add(id);
  }
  updateSportButtonStyles();
  loadCompetitions(true);
}

sportBtn1.addEventListener('click', () => toggleSport(1));
sportBtn5.addEventListener('click', () => toggleSport(5));
sportBtn16.addEventListener('click', () => toggleSport(16));

// ============================================================================
// 3. BAJNOKSÁGOK ÉS RANGSOROK BETÖLTÉSE (PRESTIGE SCORING)
// ============================================================================

async function loadCompetitions(resetSelection = false) {
  prestigiousBadgesContainer.innerHTML = `<div class="text-xs text-slate-500 animate-pulse">Rangos bajnokságok betöltése...</div>`;
  moreLeaguesContainer.innerHTML = '';

  try {
    const sportsParam = Array.from(selectedSportIds).join(',');
    const res = await fetch(`/api/competitions?sports=${sportsParam}`);
    const data = await res.json();

    if (!data.ok) throw new Error(data.error);

    allCompetitions = data.competitions || [];

    // Kiemelt elitsorozatok (BL, EL, Premier League, La Liga, NB I, NFL, stb.)
    const prestigious = allCompetitions.filter(c => c.prestigeScore >= 750 || c.displayName.toLowerCase().includes('bl') || c.displayName.toLowerCase().includes('el'));
    const others = allCompetitions.filter(c => !prestigious.includes(c));

    // Ha most váltottunk sportágat, alapból jelöljük ki az első kiemelt bajnokságot (pl. BL) vagy az összes kiemeltet!
    if (resetSelection || selectedCompetitionKeys.size === 0) {
      selectedCompetitionKeys.clear();
      // Kiemelt bajnokságok közül azok, amiknek ma van mérkőzése
      const topToday = prestigious.filter(c => c.todayMatches > 0);
      if (topToday.length > 0) {
        // Alapból a legrangosabb sorozatot (pl. BL) jelöljük ki, hogy azonnal látható legyen a meccslista!
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

  // Kattintás eseménykezelők a bajnokság gombokra (Multi-select)
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

// Gyors Bajnokság gombok
selectAllLeaguesBtn.addEventListener('click', () => {
  selectedCompetitionKeys.clear();
  allCompetitions.forEach(c => {
    if (c.todayMatches > 0) selectedCompetitionKeys.add(c.key);
  });
  if (selectedCompetitionKeys.size === 0) {
    allCompetitions.forEach(c => selectedCompetitionKeys.add(c.key));
  }
  loadCompetitions();
});

selectTopLeaguesBtn.addEventListener('click', () => {
  selectedCompetitionKeys.clear();
  allCompetitions.filter(c => c.prestigeScore >= 800 || c.displayName.toLowerCase().includes('bl') || c.displayName.toLowerCase().includes('el')).forEach(c => {
    selectedCompetitionKeys.add(c.key);
  });
  loadCompetitions();
});

toggleMoreLeaguesBtn.addEventListener('click', () => {
  const isHidden = moreLeaguesContainer.classList.contains('hidden');
  moreLeaguesContainer.classList.toggle('hidden', !isHidden);
  moreLeaguesChevron.classList.toggle('rotate-180', isHidden);
  moreLeaguesBtnText.textContent = isHidden ? 'Kevesebb megjelenítése' : 'Továbbiak megjelenítése';
});

// ============================================================================
// 4. AZNAPI MÉRKŐZÉSEK ÉS TOP 2 TIPP LEKÉRÉSE & MEGJELENÍTÉSE
// ============================================================================

async function loadLeagueMatches() {
  leagueMatchesList.innerHTML = `
    <div class="glass-card rounded-2xl p-8 text-center space-y-3">
      <div class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 animate-spin">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      </div>
      <p class="text-xs sm:text-sm text-slate-300 font-medium">Aznapi mérkőzések és Top 2 piacok betöltése a Tippmixről...</p>
    </div>
  `;

  try {
    const { minOdds, maxOdds } = getFilterSettings();
    const res = await fetch('/api/matches/by-competitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        competitionKeys: Array.from(selectedCompetitionKeys),
        sportIds: Array.from(selectedSportIds),
        onlyToday: true,
        minOdds,
        maxOdds
      })
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    currentMatches = data.matches || [];
    matchesCountBadge.textContent = `${currentMatches.length} meccs`;

    if (currentMatches.length === 0) {
      leagueMatchesList.innerHTML = `
        <div class="glass-card rounded-2xl p-8 text-center space-y-2 text-slate-400">
          <p class="text-sm font-semibold">Nincs aznapi mérkőzés a kiválasztott bajnokságban a megadott odds határok között.</p>
          <p class="text-xs text-slate-500">Próbálj más bajnokságot kijelölni vagy kattints a fenti "Összes mai meccs" gombra!</p>
        </div>
      `;
      return;
    }

    renderMatchRows(currentMatches);
  } catch (err) {
    console.error('Hiba a meccsek betöltésekor:', err);
    leagueMatchesList.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center text-rose-400 text-sm">Hiba a mérkőzések betöltésekor.</div>`;
  }
}

// EGY SORBAN: Időpont + Csapatok + TOP 2 TIPP + "RÉSZLETESEN" GOMB
function renderMatchRows(matches) {
  leagueMatchesList.innerHTML = matches.map((m, idx) => {
    const timeFormatted = formatHungarianDate(m.eventDate);
    const sportIcon = getSportIcon(m.sportId);
    const tips = m.top2Tips || [];

    // Top 2 tipp kirajzolása egy sorba
    let tipsHtml = '';
    if (tips.length > 0) {
      tipsHtml = tips.map((t, tIdx) => `
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
      tipsHtml = `<div class="text-xs text-slate-500 italic py-1">Nincs elérhető piac az adott odds sávban.</div>`;
    }

    return `
      <div class="match-row glass-card rounded-2xl p-3.5 sm:p-4 border border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
        
        <!-- BAL OSZLOP: IDŐPONT, CSAPATOK ÉS BAJNOKSÁG -->
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

        <!-- KÖZÉPSŐ OSZLOP: VELE EGY SORBA A TOP 2 TIPP -->
        <div class="lg:w-6/12 flex flex-col sm:flex-row items-stretch gap-2 min-w-0">
          ${tipsHtml}
        </div>

        <!-- JOBB OSZLOP: A SOR VÉGÉN A "RÉSZLETESEN" GOMB -->
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

  // Részletesen gombok eseménykezelője
  document.querySelectorAll('.open-detailed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const eventId = Number(btn.dataset.eventId);
      const eventName = btn.dataset.eventName;
      const matchObj = currentMatches.find(m => m.eventId === eventId);
      openDetailedModal(eventId, eventName, matchObj);
    });
  });
}

// ============================================================================
// 5. RÉSZLETES ELEMZÉS MODAL (TOP 3 TIPP + JÁTÉKVEZETŐ + SÁRGA LAPOK & SZÖGLETEK)
// ============================================================================

async function openDetailedModal(eventId, eventName, matchObj) {
  activeDetailedEvent = { eventId, eventName };

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

  // 1. Játékvezetői adatok
  const ref = result.refereeAnalysis || {};
  modalRefereeName.textContent = ref.refereeName || 'Nem ismert / Információ alatt';
  modalRefereeCards.textContent = ref.cardAverage || 'Átlagos lapmutató';
  modalRefereePenalties.textContent = ref.penaltyTendency || 'Közepes tendencia';
  modalRefereeSummary.textContent = ref.summary || 'A játékvezetői stílus nem befolyásolja drasztikusan a papírformát.';

  // 2. Szögletek & Sárga lapok
  const cc = result.cornersAndCards || {};
  modalCornerText.textContent = cc.cornerAnalysis || 'A szögletmutatók kiegyensúlyozott mezőnyjátékot jeleznek előre.';
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

        <!-- Kockázati értékelés -->
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
// 6. KERESŐ & ODDS SÁV KEZELŐK
// ============================================================================

let searchTimeout = null;
customSearchInput.addEventListener('input', () => {
  const val = customSearchInput.value.trim();
  clearTimeout(searchTimeout);
  if (val.length < 2) {
    searchDropdown.classList.add('hidden');
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`/api/matches/search?q=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (!data.ok || !data.matches || data.matches.length === 0) {
        searchDropdown.classList.add('hidden');
        return;
      }

      searchDropdown.innerHTML = data.matches.map(m => `
        <button type="button" data-event-id="${m.eventId}" data-event-name="${escapeHtml(m.eventName)}"
          class="search-result-item w-full text-left px-3 py-2 hover:bg-slate-800 transition flex items-center justify-between text-xs">
          <span class="text-white font-semibold truncate">${getSportIcon(m.sportId)} ${escapeHtml(m.eventName)}</span>
          <span class="text-emerald-400 shrink-0 font-medium">${formatHungarianDate(m.eventDate)}</span>
        </button>
      `).join('');

      searchDropdown.classList.remove('hidden');

      document.querySelectorAll('.search-result-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const eventId = Number(btn.dataset.eventId);
          const eventName = btn.dataset.eventName;
          customSearchInput.value = eventName;
          searchDropdown.classList.add('hidden');
          openDetailedModal(eventId, eventName, { eventId, eventName });
        });
      });
    } catch (_) {
      searchDropdown.classList.add('hidden');
    }
  }, 250);
});

customSearchSubmitBtn.addEventListener('click', () => {
  const q = customSearchInput.value.trim();
  if (!q) return;
  searchDropdown.classList.add('hidden');
  openDetailedModal(null, q, { eventName: q });
});

customSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    customSearchSubmitBtn.click();
  }
});

// Odds sáv szinkronizáció
function syncOdds() {
  const { minOdds, maxOdds } = getFilterSettings();
  oddsFilterBadge.textContent = `Odds: ${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)}`;
  loadLeagueMatches();
}

minOddsInput.addEventListener('change', syncOdds);
maxOddsInput.addEventListener('change', syncOdds);

oddsPresetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    minOddsInput.value = btn.dataset.min;
    maxOddsInput.value = btn.dataset.max;
    oddsPresetBtns.forEach(b => {
      b.className = (b === btn)
        ? 'odds-preset-btn rounded-lg text-xs font-black bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 transition'
        : 'odds-preset-btn rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition';
    });
    syncOdds();
  });
});

// ============================================================================
// 7. INICIALIZÁLÁS
// ============================================================================

async function init() {
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
        <span><strong class="text-white">${data.totalEvents} mérkőzés</strong> elérhető (NFL, Foci, Tenisz)</span>
      `;
    }
  } catch (err) {
    console.warn('Státusz hiba:', err);
  }

  updateSportButtonStyles();
  loadCompetitions(true);
}

init();
