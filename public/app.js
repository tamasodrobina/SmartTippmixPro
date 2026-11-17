// ============================================================================
// SmartTippmixPro - Frontend Fő Belépési Pont (Moduláris Felépítés)
// ============================================================================
// Modulok:
//  - ./js/state.js        -> Központi állapot (State) és DOM hivatkozások
//  - ./js/utils.js        -> Segédfüggvények, dátumformázás, localStorage mentés
//  - ./js/filters.js      -> Globális szűrőpult (Odds, Tippszám, Kockázati Szint, Diagnosztika)
//  - ./js/homeAnalysis.js -> Főoldali Időintervallum & Egyedi Meccskereső elemzés
//  - ./js/leagueView.js   -> Sportág nézet (Bajnokságok, Aznapi meccsek, Részletes Modal)
//  - ./js/statsPanel.js   -> Találati Arány kártyák, 3-szintű Akkordion & Extra Statok (ROI)
//  - ./js/historyModal.js -> Felugró Tippnapló & Előzmények ablak
// ============================================================================

import { dom } from './js/state.js';
import { initHomeControls, registerFilterCallbacks } from './js/filters.js';
import { initHomeAnalysisControls, runIntervalAnalysis, runCustomAnalysis } from './js/homeAnalysis.js';
import { initLeagueAndModalControls, switchNav, loadLeagueMatches, openDetailedModal } from './js/leagueView.js';
import { initStatsAccordions, loadBettingStats } from './js/statsPanel.js';
import { initTipHistoryModal } from './js/historyModal.js';

async function init() {
  // Összekötjük a szűrő gyorsjavító gombokat az elemző és bajnokság-töltő függvényekkel
  registerFilterCallbacks({
    onLeagueMatchesReload: () => loadLeagueMatches(false),
    onRunInterval: (forceRefresh) => runIntervalAnalysis(forceRefresh),
    onRunCustom: (forceRefresh) => runCustomAnalysis(forceRefresh),
    onRunModal: (eventId, eventName, matchObj, forceRefresh) => openDetailedModal(eventId, eventName, matchObj, forceRefresh)
  });

  initHomeControls();
  initHomeAnalysisControls();
  initLeagueAndModalControls();
  initStatsAccordions();
  initTipHistoryModal();
  loadBettingStats();

  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.sports) {
      data.sports.forEach(s => {
        const badgeEl = s.tippmixId === 1 ? dom.sportCount1 : (s.tippmixId === 5 ? dom.sportCount5 : (s.tippmixId === 16 ? dom.sportCount16 : null));
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
      dom.catalogStatusText.innerHTML = `
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
