// ============================================================================
// SmartTippmixPro - Központi Állapot (State) és DOM Hivatkozások
// ============================================================================

export const LS_PENDING_KEY = 'smart_tippmix_saved_tips';
export const LS_HISTORY_KEY = 'smart_tippmix_saved_history';

export const state = {
  activeNav: 'all', // 'all' (főoldal) | '1' (foci) | '5' (tenisz) | '16' (nfl)
  selectedRiskFilter: 'all', // 'all' | 'low' | 'medium' | 'high'
  selectedCompetitionKeys: new Set(),
  allCompetitions: [],
  currentLeagueMatches: [],
  loadingTimer: null,
  lastExecutedMode: 'interval',
  selectedAutocompleteEventId: null,

  // Részletes meccs-elemző modal állapota
  currentModalEventId: null,
  currentModalEventName: '',
  currentModalMatchObj: null,

  // Nyitott 2. szintű (Foci / Tenisz) és 3. szintű (Al-bajnokságok) panelek állapota
  openSportAccordions: {
    football: false,
    tennis: false,
    extra: false
  },
  expandedSubCategoryGroups: new Set(),
  latestCategoriesData: { football: [], tennis: [] },
  latestExtraInsightsData: null,

  // Tippnapló & Előzmények modal szűrő állapota
  currentHistoryFilter: {
    sportId: 'all',
    riskCategory: 'all',
    status: 'all',
    categoryGroup: 'all',
    categorySub: 'all',
    categoryLabel: ''
  }
};

export const dom = {
  // Navigációs elemek
  navBtnAll: document.getElementById('navBtnAll'),
  navBtn1: document.getElementById('navBtn1'),
  navBtn5: document.getElementById('navBtn5'),
  navBtn16: document.getElementById('navBtn16'),
  sportCount1: document.getElementById('sportCount1'),
  sportCount5: document.getElementById('sportCount5'),
  sportCount16: document.getElementById('sportCount16'),

  // Találati arány (Win Rate) sáv elemek (Foci, Tenisz, NFL)
  footballWinRate: document.getElementById('footballWinRate'),
  footballWinCount: document.getElementById('footballWinCount'),
  footballRiskLow: document.getElementById('footballRiskLow'),
  footballRiskMed: document.getElementById('footballRiskMed'),
  footballRiskHigh: document.getElementById('footballRiskHigh'),
  footballPendingBadge: document.getElementById('footballPendingBadge'),

  tennisWinRate: document.getElementById('tennisWinRate'),
  tennisWinCount: document.getElementById('tennisWinCount'),
  tennisRiskLow: document.getElementById('tennisRiskLow'),
  tennisRiskMed: document.getElementById('tennisRiskMed'),
  tennisRiskHigh: document.getElementById('tennisRiskHigh'),
  tennisPendingBadge: document.getElementById('tennisPendingBadge'),

  nflWinRate: document.getElementById('nflWinRate'),
  nflWinCount: document.getElementById('nflWinCount'),
  nflRiskLow: document.getElementById('nflRiskLow'),
  nflRiskMed: document.getElementById('nflRiskMed'),
  nflRiskHigh: document.getElementById('nflRiskHigh'),
  nflPendingBadge: document.getElementById('nflPendingBadge'),

  pendingTipsBadge: document.getElementById('pendingTipsBadge'),

  // Nézet szekciók
  mainHomeView: document.getElementById('mainHomeView'),
  sportLeagueView: document.getElementById('sportLeagueView'),

  // Globális szűrők
  headerOddsBadge: document.getElementById('headerOddsBadge'),
  minOddsInput: document.getElementById('minOddsInput'),
  maxOddsInput: document.getElementById('maxOddsInput'),
  tipsCountSelect: document.getElementById('tipsCountSelect'),
  oddsPresetBtns: document.querySelectorAll('.odds-preset-btn'),
  riskFilterBtns: document.querySelectorAll('.risk-filter-btn'),
  filterConflictWarningBar: document.getElementById('filterConflictWarningBar'),
  catalogStatusText: document.getElementById('catalogStatusText'),

  // Főoldal elemek (Intervallum + Egyedi meccskereső)
  hoursSelect: document.getElementById('hoursSelect'),
  homeSportSelect: document.getElementById('homeSportSelect'),
  analyzeIntervalBtn: document.getElementById('analyzeIntervalBtn'),
  analyzeIntervalBtnLabel: document.getElementById('analyzeIntervalBtnLabel'),
  quickHourBtns: document.querySelectorAll('.quick-hour-btn'),

  customMatchInput: document.getElementById('customMatchInput'),
  clearCustomInputBtn: document.getElementById('clearCustomInputBtn'),
  autocompleteDropdown: document.getElementById('autocompleteDropdown'),
  analyzeCustomBtn: document.getElementById('analyzeCustomBtn'),
  analyzeCustomBtnLabel: document.getElementById('analyzeCustomBtnLabel'),

  loadingSection: document.getElementById('loadingSection'),
  loadingTitle: document.getElementById('loadingTitle'),
  loadingStepText: document.getElementById('loadingStepText'),
  loadingProgressBar: document.getElementById('loadingProgressBar'),

  errorSection: document.getElementById('errorSection'),
  errorMessageText: document.getElementById('errorMessageText'),

  resultsSection: document.getElementById('resultsSection'),
  resultsMetaBadge: document.getElementById('resultsMetaBadge'),
  cacheStatusBadge: document.getElementById('cacheStatusBadge'),
  forceRefreshBtn: document.getElementById('forceRefreshBtn'),
  analysisOverviewText: document.getElementById('analysisOverviewText'),
  tipsContainer: document.getElementById('tipsContainer'),

  // Bajnokság & Meccs táblázat elemek (Sportág nézet - Kétlépcsős Dropdown)
  leagueSectionHeading: document.getElementById('leagueSectionHeading'),
  countryGroupSelect: document.getElementById('countryGroupSelect'),
  competitionSubSelect: document.getElementById('competitionSubSelect'),
  countryTodayMatchesBadge: document.getElementById('countryTodayMatchesBadge'),
  compTodayMatchesBadge: document.getElementById('compTodayMatchesBadge'),

  matchesSectionTitle: document.getElementById('matchesSectionTitle'),
  matchesCountBadge: document.getElementById('matchesCountBadge'),
  leagueMatchesList: document.getElementById('leagueMatchesList'),
  refreshLeagueMatchesBtn: document.getElementById('refreshLeagueMatchesBtn'),

  // Részletes meccs-elemző modal elemek
  detailedModal: document.getElementById('detailedModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  modalRefreshBtn: document.getElementById('modalRefreshBtn'),
  modalCacheBadge: document.getElementById('modalCacheBadge'),
  modalSportBadge: document.getElementById('modalSportBadge'),
  modalCompetitionBadge: document.getElementById('modalCompetitionBadge'),
  modalTimeBadge: document.getElementById('modalTimeBadge'),
  modalMatchTitle: document.getElementById('modalMatchTitle'),
  modalLoading: document.getElementById('modalLoading'),
  modalContent: document.getElementById('modalContent'),
  modalTipsList: document.getElementById('modalTipsList'),

  // Statisztikák & Akkordion panelek
  footballCategoriesPanel: document.getElementById('footballCategoriesPanel'),
  tennisCategoriesPanel: document.getElementById('tennisCategoriesPanel'),
  extraInsightsPanel: document.getElementById('extraInsightsPanel'),
  toggleExtraInsightsBtn: document.getElementById('toggleExtraInsightsBtn'),
  extraInsightsChevron: document.getElementById('extraInsightsChevron'),
  footballStatCard: document.getElementById('footballStatCard'),
  tennisStatCard: document.getElementById('tennisStatCard'),
  footballAccordionChevron: document.getElementById('footballAccordionChevron'),
  tennisAccordionChevron: document.getElementById('tennisAccordionChevron'),

  // Tippnapló & Előzmények modal elemek
  tipHistoryModal: document.getElementById('tipHistoryModal'),
  closeHistoryModalBtn: document.getElementById('closeHistoryModalBtn'),
  historyModalTitle: document.getElementById('historyModalTitle'),
  historyModalSubtitle: document.getElementById('historyModalSubtitle'),
  historySportSelect: document.getElementById('historySportSelect'),
  historyRiskSelect: document.getElementById('historyRiskSelect'),
  historyActiveCategoryPill: document.getElementById('historyActiveCategoryPill'),
  historyActiveCategoryLabel: document.getElementById('historyActiveCategoryLabel'),
  clearHistoryCategoryBtn: document.getElementById('clearHistoryCategoryBtn'),
  historyModalBody: document.getElementById('historyModalBody'),
  historyModalSummaryText: document.getElementById('historyModalSummaryText'),
  historyModalRefreshBtn: document.getElementById('historyModalRefreshBtn'),
  histCountAll: document.getElementById('histCountAll'),
  histCountWon: document.getElementById('histCountWon'),
  histCountLost: document.getElementById('histCountLost'),
  histCountPending: document.getElementById('histCountPending'),
  historyStatusTabs: document.querySelectorAll('.history-status-tab')
};
