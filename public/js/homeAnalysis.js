// ============================================================================
// SmartTippmixPro - Főoldali Elemző (Időintervallum, Egyedi Kereső, Tippkártyák)
// ============================================================================

import { state, dom } from './state.js';
import { escapeHtml, formatHungarianDate, getSportIcon, getRiskFilterShortLabel, getRiskVisuals, parseJsonResponse, saveQueriedTipsLocally } from './utils.js';
import { getFilterSettings, buildEmptyStateDiagnosticHtml, bindQuickFixButtons } from './filters.js';
import { loadBettingStats } from './statsPanel.js';

export function startLoadingAnimation(mode, subtitle) {
  const { minOdds, maxOdds, tipsCount } = getFilterSettings();
  dom.errorSection.classList.add('hidden');
  dom.resultsSection.classList.add('hidden');
  dom.loadingSection.classList.remove('hidden');
  dom.loadingTitle.textContent = subtitle;
  dom.loadingProgressBar.style.width = '20%';

  const steps = [
    { pct: '30%', text: `1/4: Mérkőzések és ${minOdds.toFixed(2)}–${maxOdds.toFixed(2)} szorzók szűrése...` },
    { pct: '55%', text: '2/4: Internetes források és bírói adatok átvizsgálása...' },
    { pct: '80%', text: '3/4: Forma, szögletek és sárga lapok összevetése...' },
    { pct: '92%', text: `4/4: Top ${tipsCount} tipp összeállítása és kockázatelemzés...` }
  ];

  let idx = 0;
  dom.loadingStepText.textContent = steps[0].text;

  clearInterval(state.loadingTimer);
  state.loadingTimer = setInterval(() => {
    idx = Math.min(steps.length - 1, idx + 1);
    dom.loadingStepText.textContent = steps[idx].text;
    dom.loadingProgressBar.style.width = steps[idx].pct;
  }, 3500);
}

export function stopLoadingAnimation() {
  clearInterval(state.loadingTimer);
  dom.loadingSection.classList.add('hidden');
}

export function showError(msg) {
  stopLoadingAnimation();
  dom.errorMessageText.textContent = msg;
  dom.errorSection.classList.remove('hidden');
}

export async function runIntervalAnalysis(forceRefresh = false) {
  state.lastExecutedMode = 'interval';
  const hours = Number(dom.hoursSelect.value) || 6;
  const sportId = dom.homeSportSelect.value || 'all';
  const { minOdds, maxOdds, tipsCount, riskFilter } = getFilterSettings(true);
  const riskLabel = getRiskFilterShortLabel(riskFilter);
  const sportLabel = dom.homeSportSelect.options[dom.homeSportSelect.selectedIndex]?.textContent || 'Összes sportág';

  startLoadingAnimation('interval', `Következő ${hours} óra elemzése (${sportLabel}${riskLabel ? ` • ${riskLabel}` : ''})...`);
  dom.analyzeIntervalBtn.disabled = true;
  dom.analyzeCustomBtn.disabled = true;

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
        riskFilter,
        forceRefresh: Boolean(forceRefresh)
      })
    });

    const data = await parseJsonResponse(res);

    stopLoadingAnimation();
    renderAnalysisResults(
      data,
      `Következő ${hours} óra • ${minOdds.toFixed(2)}–${maxOdds.toFixed(2)} odds • Top ${tipsCount} tipp${riskLabel ? ` • ${riskLabel}` : ''}`
    );
  } catch (err) {
    showError(err.message);
  } finally {
    dom.analyzeIntervalBtn.disabled = false;
    dom.analyzeCustomBtn.disabled = false;
  }
}

export async function runCustomAnalysis(forceRefresh = false) {
  const query = dom.customMatchInput.value.trim();
  if (!query) {
    showError('Kérlek írj be egy mérkőzést, csapatot vagy játékost a keresőmezőbe!');
    dom.customMatchInput.focus();
    return;
  }

  state.lastExecutedMode = 'custom';
  const { minOdds, maxOdds, tipsCount, riskFilter } = getFilterSettings(true);
  const riskLabel = getRiskFilterShortLabel(riskFilter);

  startLoadingAnimation('custom', `"${query}" részletes elemzése${riskLabel ? ` (${riskLabel})` : ''}...`);
  dom.analyzeIntervalBtn.disabled = true;
  dom.analyzeCustomBtn.disabled = true;

  try {
    const res = await fetch('/api/analyze/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        eventId: state.selectedAutocompleteEventId,
        minOdds,
        maxOdds,
        tipsCount,
        riskFilter,
        forceRefresh: Boolean(forceRefresh)
      })
    });

    const data = await parseJsonResponse(res);

    stopLoadingAnimation();
    renderAnalysisResults(
      data,
      `Keresés: "${query}" • ${minOdds.toFixed(2)}–${maxOdds.toFixed(2)} odds • Top ${tipsCount} tipp${riskLabel ? ` • ${riskLabel}` : ''}`
    );
  } catch (err) {
    showError(err.message);
  } finally {
    dom.analyzeIntervalBtn.disabled = false;
    dom.analyzeCustomBtn.disabled = false;
  }
}

export function renderAnalysisResults(payload, metaLabel) {
  const result = payload.result || {};
  const tips = Array.isArray(result.tips) ? result.tips : [];

  if (tips.length > 0) {
    saveQueriedTipsLocally(tips);
    setTimeout(loadBettingStats, 800);
  }

  dom.resultsMetaBadge.textContent = metaLabel;
  dom.analysisOverviewText.textContent = result.analysisOverview || (payload.noMatches ? payload.noMatchesMessage : 'Az elemzés elkészült a kiválasztott feltételek alapján.');

  if (payload.fromCache) {
    dom.cacheStatusBadge.textContent = '⚡ Okos Gyorsítótárból (0 API hívás)';
    dom.cacheStatusBadge.classList.remove('hidden');
    dom.forceRefreshBtn.classList.remove('hidden');
  } else {
    dom.cacheStatusBadge.classList.add('hidden');
    dom.forceRefreshBtn.classList.remove('hidden');
  }

  dom.tipsContainer.innerHTML = '';
  if (payload.noMatches || tips.length === 0) {
    dom.tipsContainer.innerHTML = buildEmptyStateDiagnosticHtml(payload, false);
    bindQuickFixButtons(dom.tipsContainer, false);
    dom.resultsSection.classList.remove('hidden');
    return;
  }

  if (payload.fewerTipsReason) {
    const infoBanner = document.createElement('div');
    infoBanner.className = 'p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-xs text-indigo-200 flex items-center gap-2';
    infoBanner.innerHTML = `<span>ℹ️</span><span>${escapeHtml(payload.fewerTipsReason)}</span>`;
    dom.tipsContainer.appendChild(infoBanner);
  }

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

      <div class="tip-details-panel hidden border-t border-slate-800 bg-slate-950/90 p-4 sm:p-5 space-y-4">
        <div class="space-y-1.5">
          <h4 class="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <span>💡</span>
            <span>Miért ez a gondolat? (Szakmai indoklás)</span>
          </h4>
          <p class="text-xs sm:text-sm text-slate-200 leading-relaxed bg-slate-900 p-3 sm:p-4 rounded-xl border border-slate-800 break-words">
            ${escapeHtml(reasoning.mainThesis || tip.shortSummary || 'Nincs külön indoklás rögzítve.')}
          </p>
        </div>

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

        ${(reasoning.injuriesAndLineup && !/^(nincs|nincsenek)\b/i.test(String(reasoning.injuriesAndLineup).trim())) ? `
          <div class="space-y-1.5">
            <h5 class="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <span>🏥</span>
              <span>Sérültek, hiányzók &amp; kulcsjátékosok hatása</span>
            </h5>
            <p class="text-xs sm:text-sm text-amber-200/90 leading-relaxed bg-amber-950/25 p-3 rounded-xl border border-amber-500/30 break-words">
              ${escapeHtml(reasoning.injuriesAndLineup)}
            </p>
          </div>
        ` : ''}

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

    dom.tipsContainer.appendChild(card);
  });

  dom.resultsSection.classList.remove('hidden');
  dom.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  loadBettingStats();
}

export function initHomeAnalysisControls() {
  dom.analyzeIntervalBtn.addEventListener('click', () => runIntervalAnalysis(false));
  dom.analyzeCustomBtn.addEventListener('click', () => runCustomAnalysis(false));
  dom.forceRefreshBtn.addEventListener('click', () => {
    if (state.lastExecutedMode === 'custom') runCustomAnalysis(true);
    else runIntervalAnalysis(true);
  });

  let searchDebounce = null;
  dom.customMatchInput.addEventListener('input', () => {
    state.selectedAutocompleteEventId = null;
    const val = dom.customMatchInput.value.trim();
    dom.clearCustomInputBtn.classList.toggle('hidden', val.length === 0);

    clearTimeout(searchDebounce);
    if (val.length < 2) {
      dom.autocompleteDropdown.classList.add('hidden');
      return;
    }

    searchDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/matches/search?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        if (!data.ok || !data.matches || data.matches.length === 0) {
          dom.autocompleteDropdown.classList.add('hidden');
          return;
        }

        dom.autocompleteDropdown.innerHTML = data.matches.map(m => `
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

        dom.autocompleteDropdown.classList.remove('hidden');

        dom.autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(btn => {
          btn.addEventListener('click', () => {
            dom.customMatchInput.value = btn.dataset.eventName;
            state.selectedAutocompleteEventId = String(btn.dataset.eventId || '');
            dom.clearCustomInputBtn.classList.remove('hidden');
            dom.autocompleteDropdown.classList.add('hidden');
          });
        });
      } catch (_) {
        dom.autocompleteDropdown.classList.add('hidden');
      }
    }, 200);
  });

  dom.clearCustomInputBtn.addEventListener('click', () => {
    dom.customMatchInput.value = '';
    state.selectedAutocompleteEventId = null;
    dom.clearCustomInputBtn.classList.add('hidden');
    dom.autocompleteDropdown.classList.add('hidden');
    dom.customMatchInput.focus();
  });

  document.addEventListener('click', (e) => {
    if (!dom.customMatchInput.contains(e.target) && !dom.autocompleteDropdown.contains(e.target)) {
      dom.autocompleteDropdown.classList.add('hidden');
    }
  });

  dom.customMatchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      dom.autocompleteDropdown.classList.add('hidden');
      runCustomAnalysis(false);
    }
  });
}
