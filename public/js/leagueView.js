// ============================================================================
// SmartTippmixPro - Sportág Nézet (Bajnokságok, Meccssorok) & Részletes Modal
// ============================================================================

import { state, dom } from './state.js';
import { escapeHtml, formatHungarianDate, getSportIcon, parseJsonResponse, saveQueriedTipsLocally } from './utils.js';
import { getFilterSettings, buildEmptyStateDiagnosticHtml, bindQuickFixButtons } from './filters.js';
import { loadBettingStats } from './statsPanel.js';

export function switchNav(navKey) {
  state.activeNav = navKey;

  const tabs = [
    { key: 'all', btn: dom.navBtnAll },
    { key: '1', btn: dom.navBtn1 },
    { key: '5', btn: dom.navBtn5 },
    { key: '16', btn: dom.navBtn16 }
  ];

  tabs.forEach(({ key, btn }) => {
    if (key === state.activeNav) {
      if (key === 'all') {
        btn.className = 'nav-tab-btn shrink-0 h-8 sm:h-8.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer bg-rose-600 text-white shadow-sm';
      } else {
        btn.className = 'nav-tab-btn shrink-0 h-8 sm:h-8.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20';
      }
    } else {
      btn.className = 'nav-tab-btn shrink-0 h-8 sm:h-8.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer text-slate-300 hover:text-white hover:bg-slate-800';
    }
  });

  if (state.activeNav === 'all') {
    dom.mainHomeView.classList.remove('hidden');
    dom.sportLeagueView.classList.add('hidden');
  } else {
    dom.mainHomeView.classList.add('hidden');
    dom.sportLeagueView.classList.remove('hidden');

    let sportName = 'Labdarúgás (Foci)';
    if (state.activeNav === '5') sportName = 'Tenisz (ATP / WTA)';
    if (state.activeNav === '16') sportName = 'Amerikai futball (NFL)';

    dom.leagueSectionHeading.textContent = `${sportName} – Bajnokság & Sorozat (Rangsorolt Prioritás)`;
    loadSportCompetitions(state.activeNav, true);
  }
}

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
  if (Number(sportId) === 1) {
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
  if (Number(sportId) === 5) {
    if (g.includes('grand slam')) return 1000;
    if (g.includes('atp')) return 900;
    if (g.includes('wta')) return 850;
    if (g.includes('challenger')) return 700;
    return 400;
  }
  if (Number(sportId) === 16) {
    if (g.includes('usa')) return 1000;
    if (g.includes('ncaa')) return 700;
    return 400;
  }
  return 100;
}

export async function loadSportCompetitions(sportId, resetSelection = false) {
  dom.countryGroupSelect.innerHTML = `<option value="">Betöltés...</option>`;
  dom.competitionSubSelect.innerHTML = `<option value="">Betöltés...</option>`;

  try {
    const res = await fetch(`/api/competitions?sports=${sportId}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    state.allCompetitions = data.competitions || [];

    const countryGroupsMap = new Map();
    for (const c of state.allCompetitions) {
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

    dom.countryGroupSelect.innerHTML = '';

    const totalTodayAll = countryGroups.reduce((acc, g) => acc + g.todayMatches, 0);
    const optAll = document.createElement('option');
    optAll.value = 'ALL';
    optAll.textContent = `🌐 Összes ország / liga (${totalTodayAll} meccs a következő 24 órában)`;
    dom.countryGroupSelect.appendChild(optAll);

    countryGroups.forEach(cg => {
      const opt = document.createElement('option');
      opt.value = cg.groupName;
      const flag = getCountryFlag(cg.groupName);
      const matchBadge = cg.todayMatches > 0 ? `(${cg.todayMatches} meccs / 24h)` : `(0 meccs)`;
      opt.textContent = `${flag} ${cg.groupName} ${matchBadge}`;
      dom.countryGroupSelect.appendChild(opt);
    });

    if (resetSelection) {
      const defaultGroup = countryGroups.find(g => g.todayMatches > 0) || countryGroups[0];
      if (defaultGroup) {
        dom.countryGroupSelect.value = defaultGroup.groupName;
      }
    }

    updateCompetitionSubDropdown();
  } catch (err) {
    console.error('Hiba a bajnokságok betöltésekor:', err);
    dom.countryGroupSelect.innerHTML = `<option value="">Hiba a betöltéskor</option>`;
  }
}

export function updateCompetitionSubDropdown() {
  const selectedGroup = dom.countryGroupSelect.value;
  dom.competitionSubSelect.innerHTML = '';

  let availableComps = [];
  if (!selectedGroup || selectedGroup === 'ALL') {
    availableComps = state.allCompetitions;
  } else {
    availableComps = state.allCompetitions.filter(c => (c.competitionGroupName || 'Egyéb') === selectedGroup);
  }

  availableComps.sort((a, b) => {
    const hasTodayA = a.todayMatches > 0 ? 1 : 0;
    const hasTodayB = b.todayMatches > 0 ? 1 : 0;
    if (hasTodayB !== hasTodayA) return hasTodayB - hasTodayA;
    if (b.prestigeScore !== a.prestigeScore) return b.prestigeScore - a.prestigeScore;
    if (b.todayMatches !== a.todayMatches) return b.todayMatches - a.todayMatches;
    return b.totalMatches - a.totalMatches;
  });

  const totalTodaySub = availableComps.reduce((acc, c) => acc + c.todayMatches, 0);
  dom.countryTodayMatchesBadge.textContent = `${totalTodaySub} mérkőzés a következő 24 órában`;

  const optAllSub = document.createElement('option');
  optAllSub.value = 'ALL';
  optAllSub.textContent = `⭐ Összes osztály ebből (${totalTodaySub} meccs / 24h)`;
  dom.competitionSubSelect.appendChild(optAllSub);

  availableComps.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.key;
    const star = c.todayMatches > 0 ? '⚽ ' : '';
    const matchCountStr = c.todayMatches > 0 ? `(${c.todayMatches} meccs / 24h)` : `(0 meccs)`;
    opt.textContent = `${star}${c.competitionName} ${matchCountStr}`;
    dom.competitionSubSelect.appendChild(opt);
  });

  const topMatchComp = availableComps.find(c => c.todayMatches > 0 && (c.prestigeScore >= 900 || c.competitionName.includes('BL')));
  if (topMatchComp) {
    dom.competitionSubSelect.value = topMatchComp.key;
  } else if (availableComps.length > 0 && availableComps[0].todayMatches > 0) {
    dom.competitionSubSelect.value = availableComps[0].key;
  }

  loadLeagueMatches();
}

export async function loadLeagueMatches(forceRefresh = false) {
  dom.leagueMatchesList.innerHTML = `
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
    const selectedGroup = dom.countryGroupSelect.value;
    const selectedCompKey = dom.competitionSubSelect.value;

    let compKeysToSend = [];
    if (selectedCompKey && selectedCompKey !== 'ALL') {
      compKeysToSend = [selectedCompKey];
    } else if (selectedGroup && selectedGroup !== 'ALL') {
      const compsInGroup = state.allCompetitions.filter(c => (c.competitionGroupName || 'Egyéb') === selectedGroup);
      compKeysToSend = compsInGroup.map(c => c.key);
    }

    const res = await fetch('/api/matches/by-competitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        competitionKeys: compKeysToSend,
        competitionGroupName: (selectedGroup && selectedGroup !== 'ALL') ? selectedGroup : null,
        sportIds: [Number(state.activeNav)],
        onlyToday: true,
        minOdds,
        maxOdds,
        forceRefresh: Boolean(forceRefresh)
      })
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    state.currentLeagueMatches = data.matches || [];
    dom.matchesCountBadge.textContent = `${state.currentLeagueMatches.length} meccs`;

    const groupText = (selectedGroup && selectedGroup !== 'ALL') ? selectedGroup : 'Összes ország';
    const compText = (selectedCompKey && selectedCompKey !== 'ALL')
      ? (dom.competitionSubSelect.options[dom.competitionSubSelect.selectedIndex]?.textContent.replace(/^⭐\s*/, '').split('(')[0].trim() || '')
      : 'Összes osztály';
    dom.matchesSectionTitle.textContent = `${groupText} • ${compText} (Következő 24 óra)`;

    if (state.currentLeagueMatches.length === 0) {
      const isNfl = Number(state.activeNav) === 16;
      dom.leagueMatchesList.innerHTML = `
        <div class="glass-card rounded-2xl p-8 text-center space-y-2 text-slate-400">
          <p class="text-sm font-semibold">${isNfl ? 'A következő 24 órában nincs NFL mérkőzés (a forduló meccsei a hétvégén esedékesek).' : 'Nincs mérkőzés a következő 24 órában a kiválasztott osztályban/bajnokságban ebben az odds sávban.'}</p>
          <p class="text-xs text-slate-500">${isNfl ? 'Nézd meg a Főoldali keresőt vagy válassz Foci / Tenisz mérkőzéseket!' : 'Válassz másik bajnokságot vagy az "Összes osztály ebből" lehetőséget!'}</p>
        </div>
      `;
      return;
    }

    renderLeagueMatchRows(state.currentLeagueMatches);
    loadBettingStats();
  } catch (err) {
    console.error('Hiba a meccsek betöltésekor:', err);
    dom.leagueMatchesList.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center text-rose-400 text-sm">Hiba a mérkőzések betöltésekor.</div>`;
  }
}

export function renderLeagueMatchRows(matches) {
  dom.leagueMatchesList.innerHTML = matches.map(m => {
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

        <div class="lg:w-6/12 flex flex-col sm:flex-row items-stretch gap-2 min-w-0">
          ${tipsHtml}
        </div>

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
      const eventId = String(btn.dataset.eventId || '');
      const eventName = btn.dataset.eventName;
      const matchObj = state.currentLeagueMatches.find(m => String(m.eventId) === eventId);
      openDetailedModal(eventId, eventName, matchObj);
    });
  });
}

export async function openDetailedModal(eventId, eventName, matchObj, forceRefresh = false) {
  state.currentModalEventId = eventId;
  state.currentModalEventName = eventName;
  state.currentModalMatchObj = matchObj;

  dom.modalMatchTitle.textContent = eventName;
  dom.modalSportBadge.textContent = matchObj ? `${getSportIcon(matchObj.sportId)} ${matchObj.sportName || 'Sport'}` : 'Mérkőzés';
  dom.modalCompetitionBadge.textContent = matchObj ? (matchObj.competitionName || '') : '';
  dom.modalTimeBadge.textContent = matchObj ? formatHungarianDate(matchObj.eventDate) : 'Ma';

  if (dom.modalCacheBadge) dom.modalCacheBadge.classList.add('hidden');
  dom.modalLoading.classList.remove('hidden');
  dom.modalContent.classList.add('hidden');
  dom.detailedModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  dom.modalLoading.innerHTML = `
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
    const { minOdds, maxOdds, riskFilter } = getFilterSettings(true);
    const res = await fetch('/api/analyze/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        query: eventName,
        minOdds,
        maxOdds,
        tipsCount: 3,
        riskFilter,
        forceRefresh: Boolean(forceRefresh)
      })
    });

    const data = await parseJsonResponse(res);

    if (dom.modalCacheBadge) {
      if (data.fromCache) {
        dom.modalCacheBadge.classList.remove('hidden');
      } else {
        dom.modalCacheBadge.classList.add('hidden');
      }
    }

    if (Array.isArray(data.result?.tips) && data.result.tips.length > 0) {
      saveQueriedTipsLocally(data.result.tips, [eventName]);
      setTimeout(loadBettingStats, 600);
    }

    renderModalContent(data.result, data);
  } catch (err) {
    console.error('Hiba a részletes elemzés lekérésekor:', err);
    dom.modalLoading.innerHTML = `
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
        openDetailedModal(state.currentModalEventId, state.currentModalEventName, state.currentModalMatchObj, true);
      });
    }
  }
}

export function renderModalContent(result = {}, fullPayload = {}) {
  dom.modalLoading.classList.add('hidden');
  dom.modalContent.classList.remove('hidden');

  const tips = result.tips || [];

  if (tips.length === 0 || fullPayload.noMatches) {
    dom.modalTipsList.innerHTML = buildEmptyStateDiagnosticHtml(fullPayload, true);
    bindQuickFixButtons(dom.modalTipsList, true);
    return;
  }

  const fewerBannerHtml = fullPayload.fewerTipsReason
    ? `<div class="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-xs text-indigo-200 flex items-center gap-2 mb-2"><span>ℹ️</span><span>${escapeHtml(fullPayload.fewerTipsReason)}</span></div>`
    : '';

  dom.modalTipsList.innerHTML = fewerBannerHtml + tips.map((t, idx) => {
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

        ${(reasoning.injuriesAndLineup && !/^(nincs|nincsenek)\b/i.test(String(reasoning.injuriesAndLineup).trim())) ? `
          <div class="space-y-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
              <span>🏥</span>
              <span>Sérültek, hiányzók &amp; kulcsjátékosok hatása:</span>
            </span>
            <p class="text-xs text-amber-200/90 leading-relaxed bg-amber-950/25 p-2.5 rounded-lg border border-amber-500/30 break-words">
              ${escapeHtml(reasoning.injuriesAndLineup)}
            </p>
          </div>
        ` : ''}

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

export function initLeagueAndModalControls() {
  dom.navBtnAll.addEventListener('click', () => switchNav('all'));
  dom.navBtn1.addEventListener('click', () => switchNav('1'));
  dom.navBtn5.addEventListener('click', () => switchNav('5'));
  dom.navBtn16.addEventListener('click', () => switchNav('16'));

  dom.countryGroupSelect.addEventListener('change', () => {
    updateCompetitionSubDropdown();
  });

  dom.competitionSubSelect.addEventListener('change', () => {
    loadLeagueMatches();
  });

  if (dom.modalRefreshBtn) {
    dom.modalRefreshBtn.addEventListener('click', () => {
      if (state.currentModalEventId || state.currentModalEventName) {
        openDetailedModal(state.currentModalEventId, state.currentModalEventName, state.currentModalMatchObj, true);
      }
    });
  }

  if (dom.refreshLeagueMatchesBtn) {
    dom.refreshLeagueMatchesBtn.addEventListener('click', () => {
      loadLeagueMatches(true);
    });
  }

  dom.closeModalBtn.addEventListener('click', () => {
    dom.detailedModal.classList.add('hidden');
    document.body.style.overflow = '';
  });

  dom.detailedModal.addEventListener('click', (e) => {
    if (e.target === dom.detailedModal) {
      dom.detailedModal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  });
}
