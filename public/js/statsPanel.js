// ============================================================================
// SmartTippmixPro - Találati Arány Kártyák, 3-Szintű Akkordion & Extra Statok
// ============================================================================

import { state, dom, LS_PENDING_KEY } from './state.js';
import { escapeHtml } from './utils.js';
import { openTipHistoryModal, registerHistoryStatsCallback } from './historyModal.js';

export function initStatsAccordions() {
  registerHistoryStatsCallback(loadBettingStats);

  // 1. szint: FOCI és TENISZ kártya fejlécére kattintva lenyílik / bezárul a kategória-bontás
  document.querySelectorAll('[data-sport-accordion]').forEach(headerEl => {
    headerEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-history-trigger]')) return;
      const sportKey = headerEl.getAttribute('data-sport-accordion');
      toggleSportAccordion(sportKey);
    });
  });

  // Külön menüpont: Érdekességek & Extra Statok
  if (dom.toggleExtraInsightsBtn) {
    dom.toggleExtraInsightsBtn.addEventListener('click', () => {
      state.openSportAccordions.extra = !state.openSportAccordions.extra;
      if (dom.extraInsightsPanel) {
        dom.extraInsightsPanel.classList.toggle('hidden', !state.openSportAccordions.extra);
      }
      if (dom.extraInsightsChevron) {
        dom.extraInsightsChevron.style.transform = state.openSportAccordions.extra ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    });
  }
}

export function toggleSportAccordion(sportKey) {
  if (sportKey === 'football') {
    state.openSportAccordions.football = !state.openSportAccordions.football;
    if (dom.footballCategoriesPanel) {
      dom.footballCategoriesPanel.classList.toggle('hidden', !state.openSportAccordions.football);
    }
    if (dom.footballAccordionChevron) {
      dom.footballAccordionChevron.style.transform = state.openSportAccordions.football ? 'rotate(180deg)' : 'rotate(0deg)';
    }
    if (dom.footballStatCard) {
      dom.footballStatCard.classList.toggle('border-emerald-500/60', state.openSportAccordions.football);
      dom.footballStatCard.classList.toggle('ring-1', state.openSportAccordions.football);
      dom.footballStatCard.classList.toggle('ring-emerald-500/30', state.openSportAccordions.football);
    }
  } else if (sportKey === 'tennis') {
    state.openSportAccordions.tennis = !state.openSportAccordions.tennis;
    if (dom.tennisCategoriesPanel) {
      dom.tennisCategoriesPanel.classList.toggle('hidden', !state.openSportAccordions.tennis);
    }
    if (dom.tennisAccordionChevron) {
      dom.tennisAccordionChevron.style.transform = state.openSportAccordions.tennis ? 'rotate(180deg)' : 'rotate(0deg)';
    }
    if (dom.tennisStatCard) {
      dom.tennisStatCard.classList.toggle('border-emerald-500/60', state.openSportAccordions.tennis);
      dom.tennisStatCard.classList.toggle('ring-1', state.openSportAccordions.tennis);
      dom.tennisStatCard.classList.toggle('ring-emerald-500/30', state.openSportAccordions.tennis);
    }
  }
}

function renderCategoryIconBox(catKey, fallbackIcon) {
  if (catKey === 'hun_1' || catKey === 'hun_2') {
    return `
      <div class="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/90 flex flex-col items-center justify-center overflow-hidden shrink-0 shadow-sm" title="Magyarország">
        <div class="w-5 h-3.5 rounded-[2px] overflow-hidden flex flex-col border border-white/15">
          <span class="flex-1 bg-rose-600 block"></span>
          <span class="flex-1 bg-white block"></span>
          <span class="flex-1 bg-emerald-600 block"></span>
        </div>
      </div>
    `;
  }
  return `
    <div class="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/90 flex items-center justify-center text-sm sm:text-base shrink-0 shadow-sm">
      ${fallbackIcon || '🏆'}
    </div>
  `;
}

function formatSubLeagueVisuals(subKey, rawName) {
  const cleanText = String(rawName || '')
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '')
    .replace(/^[🏆🎾🌟👑🥈🌍👩🌐]\s*/u, '')
    .trim();

  const badgeMap = {
    eng_1: { code: 'ENG', cls: 'bg-blue-950/80 border-blue-500/40 text-blue-300' },
    eng_2: { code: 'ENG', cls: 'bg-blue-950/80 border-blue-500/40 text-blue-300' },
    esp_1: { code: 'ESP', cls: 'bg-amber-950/80 border-amber-500/40 text-amber-300' },
    esp_2: { code: 'ESP', cls: 'bg-amber-950/80 border-amber-500/40 text-amber-300' },
    ita_1: { code: 'ITA', cls: 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300' },
    ita_2: { code: 'ITA', cls: 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300' },
    ger_1: { code: 'GER', cls: 'bg-rose-950/80 border-rose-500/40 text-rose-300' },
    ger_2: { code: 'GER', cls: 'bg-rose-950/80 border-rose-500/40 text-rose-300' },
    fra_1: { code: 'FRA', cls: 'bg-indigo-950/80 border-indigo-500/40 text-indigo-300' },
    fra_2: { code: 'FRA', cls: 'bg-indigo-950/80 border-indigo-500/40 text-indigo-300' },
    uel:   { code: 'EL',  cls: 'bg-amber-950/80 border-amber-500/40 text-amber-300' },
    uecl:  { code: 'KL',  cls: 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300' }
  };

  const b = badgeMap[subKey];
  const badgeHtml = b
    ? `<span class="w-8 h-6 rounded-md border ${b.cls} text-[10px] font-black flex items-center justify-center shrink-0 tracking-tighter">${b.code}</span>`
    : `<span class="w-8 h-6 rounded-md bg-slate-950 border border-slate-700/80 text-emerald-400 text-[10px] font-black flex items-center justify-center shrink-0">↳</span>`;

  return { cleanText, badgeHtml };
}

function renderOverallStatsClusterHtml(won, totalChecked, winRate, pendingCount) {
  const hasChecked = Number(totalChecked || 0) > 0;
  const pCount = Number(pendingCount || 0);

  const pendingBadgeHtml = pCount > 0
    ? `<span class="w-[52px] text-center py-0.5 rounded-md bg-amber-950/60 border border-amber-500/50 text-amber-300 text-[10px] font-bold shrink-0">${pCount} vár</span>`
    : `<span class="w-[52px] text-center py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-semibold shrink-0">0 vár</span>`;

  const rateText = hasChecked ? `${winRate}%` : `--%`;
  const countText = `(${won || 0}/${totalChecked || 0} nyert)`;

  return `
    <div class="flex items-center justify-end gap-2 shrink-0">
      ${pendingBadgeHtml}
      <div class="w-[82px] text-right shrink-0">
        <span class="text-sm font-black text-emerald-400 block leading-tight">${rateText}</span>
        <span class="text-[10px] text-slate-400 block leading-tight mt-0.5 whitespace-nowrap">${countText}</span>
      </div>
    </div>
  `;
}

function renderRiskButtonsHtml(sportId, byRisk, groupKey, subKey, labelBreadCrumb) {
  const low = byRisk?.low || { totalChecked: 0, won: 0, winRate: 0 };
  const med = byRisk?.medium || { totalChecked: 0, won: 0, winRate: 0 };
  const high = byRisk?.high || { totalChecked: 0, won: 0, winRate: 0 };

  const lowText = low.totalChecked > 0 ? `${low.winRate}% (${low.won}/${low.totalChecked})` : `--% (0/0)`;
  const medText = med.totalChecked > 0 ? `${med.winRate}% (${med.won}/${med.totalChecked})` : `--% (0/0)`;
  const highText = high.totalChecked > 0 ? `${high.winRate}% (${high.won}/${high.totalChecked})` : `--% (0/0)`;

  const gAttr = escapeHtml(groupKey || 'all');
  const sAttr = escapeHtml(subKey || 'all');
  const lAttr = escapeHtml(labelBreadCrumb || '');

  return `
    <div class="w-full lg:w-[324px] grid grid-cols-3 gap-1.5 shrink-0">
      <button type="button"
        data-cat-history-btn
        data-sport="${sportId}"
        data-risk="low"
        data-group="${gAttr}"
        data-sub="${sAttr}"
        data-label="${lAttr}"
        class="h-11 flex flex-col items-center justify-center px-1 rounded-lg bg-emerald-950/35 hover:bg-emerald-900/60 border border-emerald-800/50 hover:border-emerald-400/70 transition cursor-pointer active:scale-95 text-center group"
        title="${lAttr} – Csak az Alacsony kockázatú tippek megnyitása">
        <span class="text-emerald-400 text-[10px] font-bold uppercase tracking-tight leading-tight group-hover:text-emerald-300">Alacsony</span>
        <span class="text-white font-extrabold text-[11px] leading-tight mt-0.5 whitespace-nowrap">${lowText}</span>
      </button>
      <button type="button"
        data-cat-history-btn
        data-sport="${sportId}"
        data-risk="medium"
        data-group="${gAttr}"
        data-sub="${sAttr}"
        data-label="${lAttr}"
        class="h-11 flex flex-col items-center justify-center px-1 rounded-lg bg-amber-950/35 hover:bg-amber-900/60 border border-amber-800/50 hover:border-amber-400/70 transition cursor-pointer active:scale-95 text-center group"
        title="${lAttr} – Csak a Közepes kockázatú tippek megnyitása">
        <span class="text-amber-400 text-[10px] font-bold uppercase tracking-tight leading-tight group-hover:text-amber-300">Közepes</span>
        <span class="text-white font-extrabold text-[11px] leading-tight mt-0.5 whitespace-nowrap">${medText}</span>
      </button>
      <button type="button"
        data-cat-history-btn
        data-sport="${sportId}"
        data-risk="high"
        data-group="${gAttr}"
        data-sub="${sAttr}"
        data-label="${lAttr}"
        class="h-11 flex flex-col items-center justify-center px-1 rounded-lg bg-rose-950/35 hover:bg-rose-900/60 border border-rose-800/50 hover:border-rose-400/70 transition cursor-pointer active:scale-95 text-center group"
        title="${lAttr} – Csak a Magas kockázatú tippek megnyitása">
        <span class="text-rose-400 text-[10px] font-bold uppercase tracking-tight leading-tight group-hover:text-rose-300">Magas</span>
        <span class="text-white font-extrabold text-[11px] leading-tight mt-0.5 whitespace-nowrap">${highText}</span>
      </button>
    </div>
  `;
}

export function renderSportCategoriesAccordion(sportId, sportKey, categoriesList, containerEl) {
  if (!containerEl) return;
  if (!Array.isArray(categoriesList) || categoriesList.length === 0) {
    containerEl.innerHTML = `<div class="text-xs text-slate-400 p-3">Nem található kategória bontás.</div>`;
    return;
  }

  const sportTitle = sportId === 1
    ? '⚽ Labdarúgás – Bajnokságok és Sorozatok Szerinti Bontás (Liga-erősség sorrendben)'
    : '🎾 Tenisz – Tornák Szerinti Bontás (Grand Slam / ATP / WTA vs. Challenger / ITF)';

  const rowsHtml = categoriesList.map(cat => {
    const groupId = `${sportKey}_${cat.key}`;
    const isExpanded = state.expandedSubCategoryGroups.has(groupId);
    const subs = Array.isArray(cat.subCategories) ? cat.subCategories : [];
    const canExpand = Boolean(cat.expandable && subs.length > 0);
    const groupBreadcrumb = cat.name;

    let subRowsHtml = '';
    if (canExpand) {
      const subItemsHtml = subs.map(sub => {
        const { cleanText, badgeHtml } = formatSubLeagueVisuals(sub.key, sub.name);
        const subBreadcrumb = `${groupBreadcrumb} › ${cleanText}`;

        return `
          <div class="rounded-xl bg-slate-900/95 border border-slate-800/90 hover:border-slate-700 p-2.5 sm:px-3 transition flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 lg:gap-3">
            <div class="flex items-center justify-between gap-2 min-w-0 flex-1 cursor-pointer group"
              data-cat-history-btn
              data-sport="${sportId}"
              data-risk="all"
              data-group="${escapeHtml(cat.key)}"
              data-sub="${escapeHtml(sub.key)}"
              data-label="${escapeHtml(subBreadcrumb)}"
              title="Kattints a(z) ${escapeHtml(cleanText)} összes tippjének megnyitásához!">
              <div class="flex items-center gap-2.5 min-w-0">
                ${badgeHtml}
                <span class="text-xs sm:text-[13px] font-bold text-slate-200 group-hover:text-emerald-300 transition truncate">${escapeHtml(cleanText)}</span>
              </div>
              ${renderOverallStatsClusterHtml(sub.won, sub.totalChecked, sub.winRate, sub.pendingCount)}
            </div>

            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              ${renderRiskButtonsHtml(sportId, sub.byRisk, cat.key, sub.key, subBreadcrumb)}
              <button type="button"
                data-cat-history-btn
                data-sport="${sportId}"
                data-risk="all"
                data-group="${escapeHtml(cat.key)}"
                data-sub="${escapeHtml(sub.key)}"
                data-label="${escapeHtml(subBreadcrumb)}"
                class="h-9 lg:h-11 w-full sm:w-[96px] rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1 shrink-0 transition cursor-pointer active:scale-95"
                title="A(z) ${escapeHtml(cleanText)} összes tippjének megnyitása">
                <span>📋</span>
                <span>Tippek</span>
              </button>
            </div>
          </div>
        `;
      }).join('');

      subRowsHtml = `
        <div id="subPanel_${escapeHtml(groupId)}" class="${isExpanded ? '' : 'hidden'} pt-2 mt-2 border-t border-slate-800/80 space-y-2 pl-0 sm:pl-3 sm:border-l-2 sm:border-l-emerald-500/40">
          ${subItemsHtml}
        </div>
      `;
    }

    const rightActionButtonHtml = canExpand
      ? `
        <button type="button"
          data-sub-accordion-btn="${escapeHtml(groupId)}"
          class="h-9 lg:h-11 w-full sm:w-[96px] rounded-lg bg-slate-900 hover:bg-slate-800 border border-emerald-500/35 hover:border-emerald-400 text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1.5 shrink-0 transition cursor-pointer active:scale-95"
          title="Al-bajnokságok / egyedi ligák lenyitása (${subs.length} db)">
          <span>${subs.length} liga</span>
          <span data-sub-chevron="${escapeHtml(groupId)}" class="text-[10px] transition-transform duration-200" style="transform: ${isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}">▼</span>
        </button>
      `
      : `
        <button type="button"
          data-cat-history-btn
          data-sport="${sportId}"
          data-risk="all"
          data-group="${escapeHtml(cat.key)}"
          data-sub="all"
          data-label="${escapeHtml(groupBreadcrumb)}"
          class="h-9 lg:h-11 w-full sm:w-[96px] rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1 shrink-0 transition cursor-pointer active:scale-95"
          title="A(z) ${escapeHtml(cat.name)} összes tippjének megnyitása">
          <span>📋</span>
          <span>Tippek</span>
        </button>
      `;

    return `
      <div class="rounded-xl bg-slate-950/90 border border-slate-800/90 hover:border-slate-700/90 p-2.5 sm:p-3 transition">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 lg:gap-3">
          <div class="flex items-center justify-between gap-2 min-w-0 flex-1 cursor-pointer group"
            data-cat-history-btn
            data-sport="${sportId}"
            data-risk="all"
            data-group="${escapeHtml(cat.key)}"
            data-sub="all"
            data-label="${escapeHtml(groupBreadcrumb)}"
            title="Kattints a(z) ${escapeHtml(cat.name)} kategória összes tippjének megtekintéséhez!">
            <div class="flex items-center gap-2.5 min-w-0">
              ${renderCategoryIconBox(cat.key, cat.icon)}
              <span class="text-xs sm:text-[13px] font-extrabold text-white group-hover:text-emerald-300 transition truncate">${escapeHtml(cat.name)}</span>
            </div>
            ${renderOverallStatsClusterHtml(cat.won, cat.totalChecked, cat.winRate, cat.pendingCount)}
          </div>

          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            ${renderRiskButtonsHtml(sportId, cat.byRisk, cat.key, 'all', groupBreadcrumb)}
            ${rightActionButtonHtml}
          </div>
        </div>
        ${subRowsHtml}
      </div>
    `;
  }).join('');

  containerEl.innerHTML = `
    <div class="flex items-center justify-between gap-2 px-1 pb-1">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xs sm:text-sm font-black text-emerald-400 truncate">${sportTitle}</span>
      </div>
      <button type="button" data-close-sport-panel="${sportKey}"
        class="shrink-0 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-800 cursor-pointer transition">
        ✕ Bezárás
      </button>
    </div>
    <div class="space-y-2">
      ${rowsHtml}
    </div>
  `;

  containerEl.querySelectorAll('[data-cat-history-btn]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sId = btn.getAttribute('data-sport') || 'all';
      const risk = btn.getAttribute('data-risk') || 'all';
      const group = btn.getAttribute('data-group') || 'all';
      const sub = btn.getAttribute('data-sub') || 'all';
      const label = btn.getAttribute('data-label') || '';
      openTipHistoryModal(sId, risk, 'all', group, sub, label);
    });
  });

  containerEl.querySelectorAll('[data-sub-accordion-btn]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const gId = btn.getAttribute('data-sub-accordion-btn');
      const subPanel = document.getElementById(`subPanel_${gId}`);
      const chevron = containerEl.querySelector(`[data-sub-chevron="${gId}"]`);
      if (!subPanel) return;

      const willOpen = subPanel.classList.contains('hidden');
      subPanel.classList.toggle('hidden', !willOpen);
      if (willOpen) {
        state.expandedSubCategoryGroups.add(gId);
      } else {
        state.expandedSubCategoryGroups.delete(gId);
      }
      if (chevron) {
        chevron.style.transform = willOpen ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    });
  });

  const closeBtn = containerEl.querySelector(`[data-close-sport-panel="${sportKey}"]`);
  if (closeBtn) {
    closeBtn.addEventListener('click', () => toggleSportAccordion(sportKey));
  }
}

export function renderExtraInsightsPanel(extraInsights) {
  if (!dom.extraInsightsPanel || !extraInsights) return;
  const ov = extraInsights.overall || { totalChecked: 0, won: 0, lost: 0, winRate: 0, profitUnits: 0, netUnits: 0, roiPercent: 0, roi: 0, avgWinOdds: 0 };
  const markets = Array.isArray(extraInsights.byMarketType) ? extraInsights.byMarketType : [];

  const ovProfit = Number(ov.profitUnits ?? ov.netUnits ?? 0);
  const ovRoi = Number(ov.roiPercent ?? ov.roi ?? 0);

  const profitSign = ovProfit > 0 ? '+' : '';
  const profitColor = ovProfit >= 0 ? 'text-emerald-400' : 'text-rose-400';
  const roiSign = ovRoi > 0 ? '+' : '';
  const roiColor = ovRoi >= 0 ? 'text-emerald-400' : 'text-rose-400';

  const marketCardsHtml = markets.map(m => {
    const mProfit = Number(m.profitUnits ?? m.netUnits ?? 0);
    const mRoi = Number(m.roiPercent ?? m.roi ?? 0);
    const pSign = mProfit > 0 ? '+' : '';
    const pColor = mProfit >= 0 ? 'text-emerald-400' : 'text-rose-400';
    const rSign = mRoi > 0 ? '+' : '';
    const rColor = mRoi >= 0 ? 'text-emerald-400' : 'text-rose-400';
    return `
      <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800/90 flex items-center justify-between gap-2.5">
        <div class="min-w-0">
          <div class="text-xs font-bold text-white truncate">${m.icon || '📊'} ${escapeHtml(m.name)}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">
            Találat: <strong class="text-slate-200">${m.won}/${m.totalChecked}</strong> &bull; Egyenleg: <strong class="${pColor}">${pSign}${mProfit.toFixed(2)} egység</strong>
          </div>
        </div>
        <div class="text-right shrink-0">
          <span class="text-sm font-black text-emerald-400 block leading-tight">${m.winRate}%</span>
          <span class="block text-[10px] ${rColor} font-bold leading-tight mt-0.5" title="Tőkearányos megtérülés (haszonkulcs) az adott piacon">Haszon: ${rSign}${mRoi.toFixed(1)}%</span>
        </div>
      </div>
    `;
  }).join('');

  dom.extraInsightsPanel.innerHTML = `
    <div class="flex items-center justify-between gap-2 px-1">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xs sm:text-sm font-black text-indigo-300 truncate">📊 Érdekességek &amp; Extra Statisztikák (1 egység / tipp alapon)</span>
      </div>
      <button type="button" id="closeExtraInsightsBtn"
        class="shrink-0 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-800 cursor-pointer transition">
        ✕ Bezárás
      </button>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
      <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
        <span class="text-[10px] text-slate-400 uppercase font-bold block truncate">Összes Kiértékelt Tipp</span>
        <span class="text-base sm:text-lg font-black text-white mt-0.5 block">${ov.winRate}% <span class="text-xs font-semibold text-slate-400">(${ov.won}/${ov.totalChecked})</span></span>
      </div>
      <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800" title="Ha minden tippre 1 egységet (pl. 1000 Ft-ot) tettél volna fel, ennyi egység tiszta nyereségnél/veszteségnél járnál">
        <span class="text-[10px] text-slate-400 uppercase font-bold block truncate">Tiszta Profit (1 egység/tipp)</span>
        <span class="text-base sm:text-lg font-black ${profitColor} mt-0.5 block">${profitSign}${ovProfit.toFixed(2)} egység</span>
      </div>
      <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800" title="ROI (Return on Investment): A befektetett tétekhez képest hány százalék tiszta hasznot termeltek a tippek a szorzók alapján">
        <span class="text-[10px] text-slate-400 uppercase font-bold block truncate">Megtérülés / Haszon (ROI)</span>
        <span class="text-base sm:text-lg font-black ${roiColor} mt-0.5 block">${roiSign}${ovRoi.toFixed(1)}%</span>
      </div>
      <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
        <span class="text-[10px] text-slate-400 uppercase font-bold block truncate">Átlagos Nyertes Odds</span>
        <span class="text-base sm:text-lg font-black text-amber-300 mt-0.5 block">${Number(ov.avgWinOdds || 0).toFixed(2)}x</span>
      </div>
    </div>

    <div class="space-y-1.5">
      <h4 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">Fogadási Piacok Szerinti Teljesítmény (Melyik piacon a legpontosabb és legnyereségesebb az AI?)</h4>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        ${marketCardsHtml || '<div class="text-xs text-slate-400 p-2">Még nincs elég kiértékelt piaci adat.</div>'}
      </div>
    </div>
  `;

  const closeExtraBtn = document.getElementById('closeExtraInsightsBtn');
  if (closeExtraBtn) {
    closeExtraBtn.addEventListener('click', () => {
      state.openSportAccordions.extra = false;
      dom.extraInsightsPanel.classList.add('hidden');
      if (dom.extraInsightsChevron) dom.extraInsightsChevron.style.transform = 'rotate(0deg)';
    });
  }
}

export async function loadBettingStats() {
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
          pendingEl.className = 'inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-500/50 text-amber-300 font-bold';
        } else {
          pendingEl.className = 'inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400 font-semibold';
        }
      }

      const byRisk = s.byRisk || {};
      const low = byRisk.low || {};
      const med = byRisk.medium || {};
      const high = byRisk.high || {};

      if (lowEl) lowEl.textContent = low.totalChecked > 0 ? `${low.winRate}% (${low.won}/${low.totalChecked})` : `--% (0/0)`;
      if (medEl) medEl.textContent = med.totalChecked > 0 ? `${med.winRate}% (${med.won}/${med.totalChecked})` : `--% (0/0)`;
      if (highEl) highEl.textContent = high.totalChecked > 0 ? `${high.winRate}% (${high.won}/${high.totalChecked})` : `--% (0/0)`;
    }

    renderSportStats(data.stats.football, dom.footballWinRate, dom.footballWinCount, dom.footballRiskLow, dom.footballRiskMed, dom.footballRiskHigh, dom.footballPendingBadge);
    renderSportStats(data.stats.tennis, dom.tennisWinRate, dom.tennisWinCount, dom.tennisRiskLow, dom.tennisRiskMed, dom.tennisRiskHigh, dom.tennisPendingBadge);
    renderSportStats(data.stats.nfl, dom.nflWinRate, dom.nflWinCount, dom.nflRiskLow, dom.nflRiskMed, dom.nflRiskHigh, dom.nflPendingBadge);

    if (dom.pendingTipsBadge) {
      const pCount = Number(data.pendingCount || 0);
      dom.pendingTipsBadge.textContent = `${pCount} ellenőrzésre vár`;
    }

    if (data.categories) {
      state.latestCategoriesData = data.categories;
      renderSportCategoriesAccordion(1, 'football', data.categories.football || [], dom.footballCategoriesPanel);
      renderSportCategoriesAccordion(5, 'tennis', data.categories.tennis || [], dom.tennisCategoriesPanel);
    }

    if (data.extraInsights) {
      state.latestExtraInsightsData = data.extraInsights;
      renderExtraInsightsPanel(data.extraInsights);
    }

    // Automatikus kliens-oldali helyreállítás
    const rawLocal = localStorage.getItem(LS_PENDING_KEY);
    if (rawLocal) {
      try {
        const localTips = JSON.parse(rawLocal);
        const now = Date.now();

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
                loadBettingStats();
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
