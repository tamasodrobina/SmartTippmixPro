// ============================================================================
// SmartTippmixPro - Tippnapló & Előzmények Modal (History Modal)
// ============================================================================

import { state, dom, LS_HISTORY_KEY } from './state.js';
import { escapeHtml, formatHungarianDate, getSportIcon, getRiskVisuals, parseJsonResponse } from './utils.js';

let onStatsReloadCallback = null;

export function registerHistoryStatsCallback(cb) {
  onStatsReloadCallback = cb;
}

export function updateStatusTabsUI() {
  dom.historyStatusTabs.forEach(tab => {
    const f = tab.getAttribute('data-status-filter');
    if (f === state.currentHistoryFilter.status) {
      tab.className = 'history-status-tab px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-bold transition bg-emerald-500 text-slate-950 shadow-sm cursor-pointer text-center truncate';
    } else {
      tab.className = 'history-status-tab px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-semibold transition text-slate-300 hover:bg-slate-800 cursor-pointer text-center truncate';
    }
  });
}

export function updateHistoryModalTitle() {
  let sportName = 'Összes sportág';
  if (state.currentHistoryFilter.sportId === '1') sportName = '⚽ Labdarúgás';
  if (state.currentHistoryFilter.sportId === '5') sportName = '🎾 Tenisz';
  if (state.currentHistoryFilter.sportId === '16') sportName = '🏈 NFL';

  let riskName = 'Minden kockázat';
  if (state.currentHistoryFilter.riskCategory === 'low') riskName = '🟢 Alacsony kockázat';
  if (state.currentHistoryFilter.riskCategory === 'medium') riskName = '🟡 Közepes kockázat';
  if (state.currentHistoryFilter.riskCategory === 'high') riskName = '🔴 Magas kockázat';

  if (state.currentHistoryFilter.categoryLabel) {
    dom.historyModalTitle.textContent = `${sportName} › ${state.currentHistoryFilter.categoryLabel} – ${riskName}`;
    if (dom.historyActiveCategoryPill && dom.historyActiveCategoryLabel) {
      dom.historyActiveCategoryLabel.textContent = state.currentHistoryFilter.categoryLabel;
      dom.historyActiveCategoryPill.classList.remove('hidden');
      dom.historyActiveCategoryPill.classList.add('inline-flex');
    }
  } else {
    dom.historyModalTitle.textContent = `${sportName} – ${riskName}`;
    if (dom.historyActiveCategoryPill) {
      dom.historyActiveCategoryPill.classList.add('hidden');
      dom.historyActiveCategoryPill.classList.remove('inline-flex');
    }
  }
  dom.historyModalSubtitle.textContent = `A kiválasztott szűrésnek megfelelő lezárt és folyamatban lévő tippek`;
}

export function openTipHistoryModal(sportId = 'all', riskCategory = 'all', status = 'all', categoryGroup = 'all', categorySub = 'all', categoryLabel = '') {
  state.currentHistoryFilter.sportId = sportId;
  state.currentHistoryFilter.riskCategory = riskCategory;
  state.currentHistoryFilter.status = status;
  state.currentHistoryFilter.categoryGroup = categoryGroup || 'all';
  state.currentHistoryFilter.categorySub = categorySub || 'all';
  state.currentHistoryFilter.categoryLabel = categoryLabel || '';

  if (dom.historySportSelect) dom.historySportSelect.value = sportId;
  if (dom.historyRiskSelect) dom.historyRiskSelect.value = riskCategory;
  updateStatusTabsUI();
  updateHistoryModalTitle();

  dom.tipHistoryModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  fetchAndRenderHistory();
}

export function closeTipHistoryModal() {
  dom.tipHistoryModal.classList.add('hidden');
  document.body.style.overflow = '';
}

export async function fetchAndRenderHistory() {
  dom.historyModalBody.innerHTML = `
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
      sportId: state.currentHistoryFilter.sportId,
      riskCategory: state.currentHistoryFilter.riskCategory,
      status: state.currentHistoryFilter.status,
      categoryGroup: state.currentHistoryFilter.categoryGroup || 'all',
      categorySub: state.currentHistoryFilter.categorySub || 'all'
    });

    const res = await fetch(`/api/tips/history?${params.toString()}`);
    const data = await parseJsonResponse(res);

    const historyItems = Array.isArray(data.history) ? [...data.history] : [];
    const pendingItems = Array.isArray(data.pending) ? [...data.pending] : [];

    // Kliensoldali előzmény-mentés
    try {
      const rawStored = localStorage.getItem(LS_HISTORY_KEY);
      const storedList = rawStored ? JSON.parse(rawStored) : [];
      if (historyItems.length > 0 && state.currentHistoryFilter.categoryGroup === 'all' && state.currentHistoryFilter.categorySub === 'all') {
        const hMap = new Map();
        storedList.forEach(item => { if (item && item.id) hMap.set(item.id, item); });
        historyItems.forEach(item => { if (item && item.id) hMap.set(item.id, item); });
        localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(Array.from(hMap.values()).slice(0, 400)));
      }
    } catch (_) {}

    const filterByAllCriteria = (list) => list.filter(item => {
      if (state.currentHistoryFilter.sportId !== 'all') {
        const expectedSportId = Number(state.currentHistoryFilter.sportId);
        const itemSportId = Number(item.sportId || (item.sportName?.includes('Tenisz') ? 5 : (item.sportName?.includes('futball') || item.sportName?.includes('NFL') ? 16 : 1)));
        if (itemSportId !== expectedSportId) return false;
      }
      if (state.currentHistoryFilter.categoryGroup && state.currentHistoryFilter.categoryGroup !== 'all') {
        if (item.categoryGroupKey !== state.currentHistoryFilter.categoryGroup) return false;
      }
      if (state.currentHistoryFilter.categorySub && state.currentHistoryFilter.categorySub !== 'all') {
        if (item.categorySubKey !== state.currentHistoryFilter.categorySub) return false;
      }
      if (state.currentHistoryFilter.riskCategory !== 'all') {
        if (item.riskCategory !== state.currentHistoryFilter.riskCategory) return false;
      }
      return true;
    });

    const filteredHistory = filterByAllCriteria(historyItems);
    const filteredPending = filterByAllCriteria(pendingItems);

    let displayList = [];
    if (state.currentHistoryFilter.status === 'pending') {
      displayList = filteredPending.map(p => ({ ...p, status: 'pending' }));
    } else if (state.currentHistoryFilter.status === 'won') {
      displayList = filteredHistory.filter(h => h.won);
    } else if (state.currentHistoryFilter.status === 'lost') {
      displayList = filteredHistory.filter(h => !h.won);
    } else {
      displayList = [
        ...filteredPending.map(p => ({ ...p, status: 'pending' })),
        ...filteredHistory
      ];
    }

    const wonCount = filteredHistory.filter(h => h.won).length;
    const lostCount = filteredHistory.filter(h => !h.won).length;
    const pendingCount = filteredPending.length;
    const totalCount = wonCount + lostCount + pendingCount;

    if (dom.histCountAll) dom.histCountAll.textContent = totalCount;
    if (dom.histCountWon) dom.histCountWon.textContent = wonCount;
    if (dom.histCountLost) dom.histCountLost.textContent = lostCount;
    if (dom.histCountPending) dom.histCountPending.textContent = pendingCount;

    dom.historyModalSummaryText.textContent = `Találatok: ${displayList.length} db tipp (${wonCount} nyert, ${lostCount} vesztett, ${pendingCount} vár)`;

    if (displayList.length === 0) {
      dom.historyModalBody.innerHTML = `
        <div class="glass-card rounded-2xl p-8 text-center text-slate-400 space-y-2 border border-slate-800 my-4">
          <span class="text-3xl block mb-2">📋</span>
          <h4 class="text-sm font-bold text-white">Még nem található tipp ebben a szűrésben</h4>
          <p class="text-xs text-slate-500 max-w-md mx-auto">
            Amint az AI által elemzett tippek mérkőzései befejeződnek ebben a bajnokságban és kockázati szinten, a rendszer automatikusan kiértékeli őket és ide rögzíti a végeredményt.
          </p>
        </div>
      `;
      return;
    }

    dom.historyModalBody.innerHTML = '';
    displayList.forEach(item => {
      const isPending = item.status === 'pending';
      const isWon = item.won === true;

      let statusBadgeHtml = '';
      let cardBorderClass = 'border-slate-800';

      if (isPending) {
        statusBadgeHtml = `<span class="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">⏳ ELLENŐRZÉSRE VÁR</span>`;
        cardBorderClass = 'border-amber-900/30';
      } else if (item.status === 'void') {
        statusBadgeHtml = `<span class="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-sky-500/20 border border-sky-500/40 text-sky-300">🔄 TÉT VISSZAJÁR</span>`;
        cardBorderClass = 'border-sky-900/40';
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
      const catBadgeHtml = item.categoryGroupName
        ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-emerald-300 font-semibold">${escapeHtml(item.categorySubName || item.categoryGroupName)}</span>`
        : '';

      const card = document.createElement('div');
      card.className = `p-3.5 sm:p-4 rounded-2xl bg-slate-950/70 border ${cardBorderClass} space-y-2.5 transition hover:bg-slate-950/90`;
      card.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0 flex-wrap">
            <span class="text-sm">${sportIcon}</span>
            <span class="text-xs font-semibold text-slate-300 truncate">${escapeHtml(item.competitionName || item.sportName || '')}</span>
            ${catBadgeHtml}
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
            <span class="text-slate-500 text-[10px]">${item.verificationMethod === 'tippmix_official' || item.verificationMethod === 'tippmix_api' ? 'Tippmix Hivatalos' : 'Webes ellenőrzés'}</span>
          </div>
        ` : (isPending ? `
          <div class="text-[10px] text-amber-300/80 bg-amber-950/20 px-2.5 py-1 rounded-lg border border-amber-900/30 flex items-center gap-1.5">
            <span>ℹ️</span>
            <span>A mérkőzés lejárta után a rendszer automatikusan ellenőrzi az eredményt.</span>
          </div>
        ` : '')}
      `;

      dom.historyModalBody.appendChild(card);
    });
  } catch (err) {
    dom.historyModalBody.innerHTML = `
      <div class="glass-card rounded-2xl p-6 text-center text-rose-400 text-xs space-y-2 border border-rose-900/40">
        <p>Hiba történt az előzmények lekérése közben: ${escapeHtml(err.message)}</p>
        <button type="button" onclick="fetchAndRenderHistory()" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold">Újrapróbálkozás</button>
      </div>
    `;
  }
}

window.fetchAndRenderHistory = fetchAndRenderHistory;

export function initTipHistoryModal() {
  document.querySelectorAll('[data-history-trigger]').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const sport = trigger.getAttribute('data-sport') || 'all';
      const risk = trigger.getAttribute('data-risk') || 'all';
      const status = trigger.getAttribute('data-status') || 'all';
      openTipHistoryModal(sport, risk, status, 'all', 'all', '');
    });
  });

  if (dom.clearHistoryCategoryBtn) {
    dom.clearHistoryCategoryBtn.addEventListener('click', () => {
      state.currentHistoryFilter.categoryGroup = 'all';
      state.currentHistoryFilter.categorySub = 'all';
      state.currentHistoryFilter.categoryLabel = '';
      updateHistoryModalTitle();
      fetchAndRenderHistory();
    });
  }

  if (dom.closeHistoryModalBtn) {
    dom.closeHistoryModalBtn.addEventListener('click', closeTipHistoryModal);
  }

  if (dom.tipHistoryModal) {
    dom.tipHistoryModal.addEventListener('click', (e) => {
      if (e.target === dom.tipHistoryModal) closeTipHistoryModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.tipHistoryModal && !dom.tipHistoryModal.classList.contains('hidden')) {
      closeTipHistoryModal();
    }
  });

  if (dom.historySportSelect) {
    dom.historySportSelect.addEventListener('change', () => {
      state.currentHistoryFilter.sportId = dom.historySportSelect.value;
      state.currentHistoryFilter.categoryGroup = 'all';
      state.currentHistoryFilter.categorySub = 'all';
      state.currentHistoryFilter.categoryLabel = '';
      updateHistoryModalTitle();
      fetchAndRenderHistory();
    });
  }

  if (dom.historyRiskSelect) {
    dom.historyRiskSelect.addEventListener('change', () => {
      state.currentHistoryFilter.riskCategory = dom.historyRiskSelect.value;
      updateHistoryModalTitle();
      fetchAndRenderHistory();
    });
  }

  if (dom.historyStatusTabs) {
    dom.historyStatusTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const filter = tab.getAttribute('data-status-filter') || 'all';
        state.currentHistoryFilter.status = filter;
        updateStatusTabsUI();
        fetchAndRenderHistory();
      });
    });
  }

  if (dom.historyModalRefreshBtn) {
    dom.historyModalRefreshBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/stats/evaluate', { method: 'POST' });
      } catch (_) {}
      fetchAndRenderHistory();
      if (onStatsReloadCallback) onStatsReloadCallback();
    });
  }
}
