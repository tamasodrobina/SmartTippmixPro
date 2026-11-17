// ============================================================================
// SmartTippmixPro - Globális Szűrők, Kockázat/Odds Diagnosztika és Gyorsjavítók
// ============================================================================

import { state, dom } from './state.js';
import { escapeHtml, getRiskFilterShortLabel } from './utils.js';

let rerunCallbacks = {
  onLeagueMatchesReload: null,
  onRunInterval: null,
  onRunCustom: null,
  onRunModal: null
};

export function registerFilterCallbacks(callbacks = {}) {
  rerunCallbacks = { ...rerunCallbacks, ...callbacks };
}

export function evaluateClientRiskOddsState(minOdds, maxOdds, riskFilter) {
  let suggestedRiskForOdds = { key: 'medium', label: '🟡 Közepes kockázat (4–6)' };
  if (maxOdds <= 1.60 || (minOdds + maxOdds) / 2 <= 1.48) {
    suggestedRiskForOdds = { key: 'low', label: '🟢 Alacsony kockázat (1–3)' };
  } else if (minOdds >= 1.80 || (minOdds + maxOdds) / 2 >= 1.95) {
    suggestedRiskForOdds = { key: 'high', label: '🔴 Magas kockázat (7–10)' };
  }

  let suggestedOddsForRisk = { min: 1.30, max: 2.00, label: '1.30 – 2.00' };
  let currentRiskLabel = '🎯 Minden szint';
  if (riskFilter === 'low') {
    suggestedOddsForRisk = { min: 1.20, max: 1.60, label: '1.20 – 1.60' };
    currentRiskLabel = '🟢 Alacsony kockázat (1–3)';
  } else if (riskFilter === 'medium') {
    suggestedOddsForRisk = { min: 1.45, max: 2.10, label: '1.45 – 2.10' };
    currentRiskLabel = '🟡 Közepes kockázat (4–6)';
  } else if (riskFilter === 'high') {
    suggestedOddsForRisk = { min: 1.80, max: 3.20, label: '1.80 – 3.20' };
    currentRiskLabel = '🔴 Magas kockázat (7–10)';
  }

  let hasConflict = false;
  let conflictMessage = '';

  if (riskFilter === 'high' && maxOdds < 1.60) {
    hasConflict = true;
    conflictMessage = `A kiválasztott 🔴 Magas kockázathoz (7–10) a beállított ${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)} szorzósáv túl alacsony (ebben a sávban csak biztonsági/közepes tippek vannak).`;
  } else if (riskFilter === 'low' && minOdds > 1.90) {
    hasConflict = true;
    conflictMessage = `A kiválasztott 🟢 Alacsony kockázathoz (1–3) a beállított ${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)} szorzósáv túl magas (ezek a szorzók már Közepes/Magas kockázatúak).`;
  } else if (riskFilter === 'medium' && maxOdds < 1.35) {
    hasConflict = true;
    conflictMessage = `A kiválasztott 🟡 Közepes kockázathoz (4–6) a beállított ${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)} szorzósáv túl alacsony (ez az 🟢 Alacsony kockázat sávja).`;
  } else if (riskFilter === 'medium' && minOdds > 2.45) {
    hasConflict = true;
    conflictMessage = `A kiválasztott 🟡 Közepes kockázathoz (4–6) a beállított ${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)} szorzósáv túl magas (ez a 🔴 Magas kockázat sávja).`;
  }

  return {
    hasConflict,
    conflictMessage,
    isTooNarrow: (maxOdds - minOdds) < 0.10,
    currentRiskKey: riskFilter,
    currentRiskLabel,
    currentOddsLabel: `${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)}`,
    suggestedRiskForOdds,
    suggestedOddsForRisk
  };
}

export function getFilterSettings(autoSwapInputs = false) {
  const rawMin = Number(dom.minOddsInput.value) || 1.30;
  const rawMax = Number(dom.maxOddsInput.value) || 2.00;
  const swapped = rawMin > rawMax;
  const minOdds = Math.min(rawMin, rawMax);
  const maxOdds = Math.max(rawMin, rawMax);
  if (autoSwapInputs && swapped) {
    dom.minOddsInput.value = minOdds.toFixed(2);
    dom.maxOddsInput.value = maxOdds.toFixed(2);
  }
  const tipsCount = Math.min(10, Math.max(1, Number(dom.tipsCountSelect.value) || 3));
  return {
    minOdds,
    maxOdds,
    swapped,
    tipsCount,
    riskFilter: state.selectedRiskFilter || 'all'
  };
}

export function updateRiskFilterBtnsUI() {
  dom.riskFilterBtns.forEach(btn => {
    const rf = btn.getAttribute('data-risk-filter') || 'all';
    const isSelected = rf === state.selectedRiskFilter;
    if (rf === 'low') {
      btn.className = isSelected
        ? 'risk-filter-btn h-9 px-2.5 rounded-lg text-xs font-black bg-emerald-500/25 text-emerald-200 border border-emerald-400/70 shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer truncate'
        : 'risk-filter-btn h-9 px-2.5 rounded-lg text-xs font-semibold text-emerald-300/90 hover:text-emerald-200 hover:bg-emerald-950/50 border border-transparent transition flex items-center justify-center gap-1.5 cursor-pointer truncate';
    } else if (rf === 'medium') {
      btn.className = isSelected
        ? 'risk-filter-btn h-9 px-2.5 rounded-lg text-xs font-black bg-amber-500/25 text-amber-200 border border-amber-400/70 shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer truncate'
        : 'risk-filter-btn h-9 px-2.5 rounded-lg text-xs font-semibold text-amber-300/90 hover:text-amber-200 hover:bg-amber-950/50 border border-transparent transition flex items-center justify-center gap-1.5 cursor-pointer truncate';
    } else if (rf === 'high') {
      btn.className = isSelected
        ? 'risk-filter-btn h-9 px-2.5 rounded-lg text-xs font-black bg-rose-500/25 text-rose-200 border border-rose-400/70 shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer truncate'
        : 'risk-filter-btn h-9 px-2.5 rounded-lg text-xs font-semibold text-rose-300/90 hover:text-rose-200 hover:bg-rose-950/50 border border-transparent transition flex items-center justify-center gap-1.5 cursor-pointer truncate';
    } else {
      btn.className = isSelected
        ? 'risk-filter-btn h-9 px-2.5 rounded-lg text-xs font-black bg-slate-700/80 text-white border border-slate-500/60 shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer truncate'
        : 'risk-filter-btn h-9 px-2.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 border border-transparent transition flex items-center justify-center gap-1.5 cursor-pointer truncate';
    }
  });
}

export function renderLiveFilterConflictBar() {
  if (!dom.filterConflictWarningBar) return;
  const rawMin = Number(dom.minOddsInput.value) || 1.30;
  const rawMax = Number(dom.maxOddsInput.value) || 2.00;
  const isSwapped = rawMin > rawMax;
  const { minOdds, maxOdds, riskFilter } = getFilterSettings(false);
  const check = evaluateClientRiskOddsState(minOdds, maxOdds, riskFilter);

  if (!check.hasConflict && !check.isTooNarrow && !isSwapped) {
    dom.filterConflictWarningBar.classList.add('hidden');
    dom.filterConflictWarningBar.innerHTML = '';
    return;
  }

  dom.filterConflictWarningBar.classList.remove('hidden');

  if (check.hasConflict) {
    dom.filterConflictWarningBar.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div class="space-y-0.5">
          <div class="font-bold text-amber-300 flex items-center gap-1.5">
            <span>⚠️</span>
            <span>Ellentmondó Odds (${check.currentOddsLabel}) és Kockázati Szint (${check.currentRiskLabel}) beállítás!</span>
          </div>
          <p class="text-[11px] text-amber-100/90">${escapeHtml(check.conflictMessage)}</p>
        </div>
        <div class="flex flex-wrap items-center gap-1.5 shrink-0">
          <button type="button" data-quick-fix-risk="${check.suggestedRiskForOdds.key}"
            class="px-2.5 py-1.5 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/60 text-emerald-200 font-bold text-[11px] transition cursor-pointer">
            Marad ${check.currentOddsLabel} → ${check.suggestedRiskForOdds.label}
          </button>
          <button type="button" data-quick-fix-odds-min="${check.suggestedOddsForRisk.min}" data-quick-fix-odds-max="${check.suggestedOddsForRisk.max}"
            class="px-2.5 py-1.5 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/60 text-amber-100 font-bold text-[11px] transition cursor-pointer">
            Marad ${check.currentRiskLabel} → Odds: ${check.suggestedOddsForRisk.label}
          </button>
        </div>
      </div>
    `;
  } else if (isSwapped) {
    dom.filterConflictWarningBar.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <span>🔄 A <strong>Min. Odds (${rawMin.toFixed(2)})</strong> nagyobb, mint a <strong>Max. Odds (${rawMax.toFixed(2)})</strong> — kereséskor automatikusan <strong>${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)}</strong> sorrendben használjuk.</span>
        <button type="button" data-quick-fix-odds-min="${minOdds}" data-quick-fix-odds-max="${maxOdds}"
          class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] shrink-0 cursor-pointer">
          Sorrend cseréje most
        </button>
      </div>
    `;
  } else if (check.isTooNarrow) {
    dom.filterConflictWarningBar.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <span>⚠️ A megadott szorzósáv (<strong>${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)}</strong>) nagyon szűk (kevesebb mint 0.10 eltérés), így kevés vagy 0 találat várható.</span>
        <button type="button" data-quick-fix-odds-min="${Math.max(1.10, Number((minOdds - 0.15).toFixed(2)))}" data-quick-fix-odds-max="${Number((maxOdds + 0.25).toFixed(2))}"
          class="px-2.5 py-1 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/60 text-emerald-200 font-bold text-[11px] shrink-0 cursor-pointer">
          Sáv tágítása (${Math.max(1.10, Number((minOdds - 0.15).toFixed(2))).toFixed(2)}–${Number((maxOdds + 0.25).toFixed(2)).toFixed(2)})
        </button>
      </div>
    `;
  }

  bindQuickFixButtons(dom.filterConflictWarningBar, false);
}

export function syncLabels() {
  const { minOdds, maxOdds, tipsCount, riskFilter } = getFilterSettings(false);
  const riskSuffix = getRiskFilterShortLabel(riskFilter);
  dom.headerOddsBadge.textContent = `${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)} Odds • Top ${tipsCount}${riskSuffix ? ` • ${riskSuffix}` : ''}`;
  dom.analyzeIntervalBtnLabel.textContent = `Időintervallum Elemzése (Top ${tipsCount} • ${minOdds.toFixed(2)}–${maxOdds.toFixed(2)}${riskSuffix ? ` • ${riskSuffix}` : ''})`;
  dom.analyzeCustomBtnLabel.textContent = `Mérkőzés Elemzése (Top ${tipsCount} Tipp${riskSuffix ? ` • ${riskSuffix}` : ''})`;
  renderLiveFilterConflictBar();
}

export function applyQuickFilterState({ newRisk, newMinOdds, newMaxOdds }) {
  if (newRisk) {
    state.selectedRiskFilter = newRisk;
    updateRiskFilterBtnsUI();
  }
  if (typeof newMinOdds === 'number' && typeof newMaxOdds === 'number') {
    dom.minOddsInput.value = Number(newMinOdds).toFixed(2);
    dom.maxOddsInput.value = Number(newMaxOdds).toFixed(2);
    dom.oddsPresetBtns.forEach(b => {
      const matchPreset = Number(b.dataset.min) === Number(newMinOdds) && Number(b.dataset.max) === Number(newMaxOdds);
      b.className = matchPreset
        ? 'odds-preset-btn rounded-lg text-xs font-black bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 transition truncate px-1'
        : 'odds-preset-btn rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition truncate px-1';
    });
  }
  syncLabels();
}

window.applyQuickFilterState = applyQuickFilterState;

export function buildEmptyStateDiagnosticHtml(payload = {}, isModal = false) {
  const { minOdds, maxOdds, riskFilter } = getFilterSettings(false);
  const rc = payload.riskOddsConflict || evaluateClientRiskOddsState(minOdds, maxOdds, riskFilter);
  const diag = payload.diagnostics || null;
  const reasonCode = payload.reasonCode || '';
  const emptyMsg = payload.noMatchesMessage || 'Nem található fogadási opció a megadott feltételekkel.';

  // 1. ESET: Kockázati szint és Odds-sáv ellentmondás
  if (reasonCode === 'risk_odds_conflict' || (rc && rc.hasConflict)) {
    return `
      <div class="glass-card rounded-2xl p-5 sm:p-6 text-left text-slate-200 space-y-4 border border-amber-500/40 bg-amber-950/15">
        <div class="flex items-start gap-3">
          <span class="text-2xl sm:text-3xl shrink-0">⚠️</span>
          <div class="space-y-1">
            <h4 class="text-sm sm:text-base font-black text-amber-300">
              Nincs találat a beállított Odds (${escapeHtml(rc.currentOddsLabel)}) és Kockázati Szint (${escapeHtml(rc.currentRiskLabel)}) kombinációjával
            </h4>
            <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
              ${escapeHtml(rc.conflictMessage || emptyMsg)}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
          <!-- 1. JAVASLAT: Ha maradnál ezeknél az oddsoknál, milyen kockázat illik rá? -->
          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 space-y-2 flex flex-col justify-between">
            <div class="space-y-1">
              <span class="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">1. Javaslat — Ha maradnál az ${escapeHtml(rc.currentOddsLabel)} szorzóknál:</span>
              <p class="text-xs text-slate-300">
                Ehhez a szorzótartományhoz a <strong>${escapeHtml(rc.suggestedRiskForOdds.label)}</strong> (vagy a <strong>🎯 Minden szint</strong>) illik:
              </p>
            </div>
            <div class="flex flex-wrap gap-1.5 pt-1">
              <button type="button" data-quick-fix-risk="${escapeHtml(rc.suggestedRiskForOdds.key)}" data-rerun="true"
                class="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-sm active:scale-95">
                ${escapeHtml(rc.suggestedRiskForOdds.label)} választása &amp; Keresés
              </button>
              <button type="button" data-quick-fix-risk="all" data-rerun="true"
                class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition cursor-pointer active:scale-95">
                🎯 Minden szint &amp; Keresés
              </button>
            </div>
          </div>

          <!-- 2. JAVASLAT: Ha maradnál a kiválasztott kockázati szintnél, milyen odds illik hozzá? -->
          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-2 flex flex-col justify-between">
            <div class="space-y-1">
              <span class="text-[10px] font-black uppercase tracking-wider text-amber-400 block">2. Javaslat — Ha maradnál a ${escapeHtml(rc.currentRiskLabel)} szintnél:</span>
              <p class="text-xs text-slate-300">
                Ehhez a kockázati szinthez a(z) <strong>${escapeHtml(rc.suggestedOddsForRisk.label)}</strong> közötti szorzósáv javasolt:
              </p>
            </div>
            <div class="pt-1">
              <button type="button" data-quick-fix-odds-min="${rc.suggestedOddsForRisk.min}" data-quick-fix-odds-max="${rc.suggestedOddsForRisk.max}" data-rerun="true"
                class="w-full sm:w-auto px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-sm active:scale-95">
                📈 Odds igazítása (${escapeHtml(rc.suggestedOddsForRisk.label)}) &amp; Keresés
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 2. ESET: Már elkezdődött a meccs vagy lezárultak a piacok
  if (reasonCode === 'match_started') {
    return `
      <div class="glass-card rounded-2xl p-6 text-center text-slate-300 space-y-3 border border-slate-800">
        <span class="text-3xl block">⏱️</span>
        <h4 class="text-sm sm:text-base font-bold text-white">A mérkőzés már elkezdődött vagy a piacai lezárultak</h4>
        <p class="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">${escapeHtml(emptyMsg)}</p>
      </div>
    `;
  }

  // 3. ESET: Nincs piac a beállított odds-sávban (vagy túl szűk az odds-sáv)
  if (diag && (reasonCode === 'no_markets_in_odds_range' || reasonCode === 'odds_too_narrow')) {
    const sugMin = diag.suggestedOddsRange?.min || 1.25;
    const sugMax = diag.suggestedOddsRange?.max || 2.20;
    return `
      <div class="glass-card rounded-2xl p-5 sm:p-6 text-center text-slate-200 space-y-3.5 border border-slate-800">
        <span class="text-3xl block">🎯</span>
        <h4 class="text-sm sm:text-base font-bold text-white">
          ${reasonCode === 'odds_too_narrow' ? 'Túl szűk a beállított szorzósáv' : 'Nincs fogadási opció a beállított szorzósávban'}
        </h4>
        <p class="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
          ${escapeHtml(diag.detailMsg || emptyMsg)}
        </p>
        <div class="pt-1 flex flex-wrap items-center justify-center gap-2">
          <button type="button" data-quick-fix-odds-min="${sugMin}" data-quick-fix-odds-max="${sugMax}" data-rerun="true"
            class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-md active:scale-95">
            📈 Szorzósáv tágítása (${sugMin.toFixed(2)} – ${sugMax.toFixed(2)}) &amp; Újraelemzés
          </button>
        </div>
      </div>
    `;
  }

  // 4. Általános üres állapot
  return `
    <div class="glass-card rounded-2xl p-6 sm:p-8 text-center text-slate-300 space-y-3 border border-slate-800">
      <span class="text-3xl sm:text-4xl block mb-1">🗓️</span>
      <h4 class="text-sm sm:text-base font-bold text-white">Nincs találat a megadott feltételekkel</h4>
      <p class="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">${escapeHtml(emptyMsg)}</p>
    </div>
  `;
}

export function bindQuickFixButtons(containerEl, isModalContext = false) {
  if (!containerEl) return;

  const triggerRerun = () => {
    if (isModalContext && (state.currentModalEventId || state.currentModalEventName) && rerunCallbacks.onRunModal) {
      rerunCallbacks.onRunModal(state.currentModalEventId, state.currentModalEventName, state.currentModalMatchObj, true);
    } else if (state.lastExecutedMode === 'custom' && rerunCallbacks.onRunCustom) {
      rerunCallbacks.onRunCustom(true);
    } else if (rerunCallbacks.onRunInterval) {
      rerunCallbacks.onRunInterval(true);
    }
  };

  containerEl.querySelectorAll('[data-quick-fix-risk]').forEach(btn => {
    btn.addEventListener('click', () => {
      const newRisk = btn.getAttribute('data-quick-fix-risk') || 'all';
      const shouldRerun = btn.getAttribute('data-rerun') === 'true';
      applyQuickFilterState({ newRisk });
      if (shouldRerun) triggerRerun();
    });
  });

  containerEl.querySelectorAll('[data-quick-fix-odds-min]').forEach(btn => {
    btn.addEventListener('click', () => {
      const newMin = Number(btn.getAttribute('data-quick-fix-odds-min')) || 1.30;
      const newMax = Number(btn.getAttribute('data-quick-fix-odds-max')) || 2.00;
      const shouldRerun = btn.getAttribute('data-rerun') === 'true';
      applyQuickFilterState({ newMinOdds: newMin, newMaxOdds: newMax });
      if (shouldRerun) triggerRerun();
    });
  });
}

export function initHomeControls() {
  dom.hoursSelect.innerHTML = '';
  for (let h = 1; h <= 24; h++) {
    const opt = document.createElement('option');
    opt.value = String(h);
    opt.textContent = `Következő ${h} órában (${h} óra)`;
    if (h === 6) opt.selected = true;
    dom.hoursSelect.appendChild(opt);
  }

  dom.tipsCountSelect.innerHTML = '';
  for (let c = 1; c <= 10; c++) {
    const opt = document.createElement('option');
    opt.value = String(c);
    opt.textContent = `Top ${c} legvalószínűbb tipp (${c} db)`;
    if (c === 3) opt.selected = true;
    dom.tipsCountSelect.appendChild(opt);
  }

  dom.riskFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedRiskFilter = btn.getAttribute('data-risk-filter') || 'all';
      updateRiskFilterBtnsUI();
      syncLabels();
    });
  });

  dom.tipsCountSelect.addEventListener('change', syncLabels);
  dom.minOddsInput.addEventListener('input', syncLabels);
  dom.maxOddsInput.addEventListener('input', syncLabels);

  dom.oddsPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.minOddsInput.value = btn.dataset.min;
      dom.maxOddsInput.value = btn.dataset.max;
      dom.oddsPresetBtns.forEach(b => {
        b.className = (b === btn)
          ? 'odds-preset-btn rounded-lg text-xs font-black bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 transition truncate px-1'
          : 'odds-preset-btn rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition truncate px-1';
      });
      syncLabels();
      if (state.activeNav !== 'all' && rerunCallbacks.onLeagueMatchesReload) {
        rerunCallbacks.onLeagueMatchesReload();
      }
    });
  });

  dom.quickHourBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.hoursSelect.value = btn.dataset.quickHours;
      dom.quickHourBtns.forEach(b => {
        b.className = (b === btn)
          ? 'quick-hour-btn h-8 sm:h-7 px-2 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 transition text-center'
          : 'quick-hour-btn h-8 sm:h-7 px-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition text-center';
      });
    });
  });

  syncLabels();
}
