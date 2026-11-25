import { createSelector } from '@reduxjs/toolkit';
import { bagsAdapter } from './bagsAdapter.js';
import { filterAndSortBags, paginate } from '../../utils/catalog.js';
import { defaultFilters } from '../../utils/catalogParams.js';
import { dashboardStats, filterDashboard } from '../../utils/dashboard.js';

// ---------------------------------------------------------------- basic selectors
// The adapter gives memoized selectAll / selectById for the normalized bags.
export const {
  selectAll: selectAllBags,
  selectById: selectBagById,
  selectTotal: selectBagCount
} = bagsAdapter.getSelectors((state) => state.bags);

export const selectBagsRequest = (state) => state.bags.list;
export const selectBagDetailRequest = (state, id) => state.bags.details[id];
export const selectCreateBagRequest = (state) => state.bags.create;

// What a page needs to decide between skeleton, error and content.
// Data that was loaded once stays on screen while it refreshes or if a refresh fails.
export function selectBagsStatus(state) {
  const request = selectBagsRequest(state);
  if (request.fetchedAt === 0) {
    if (request.status === 'failed') return 'error';
    return 'loading';
  }
  return 'success';
}

// ---------------------------------------------------------------- memoized selectors
// createSelector re-runs the function only when its inputs change. With the same
// bags and the same filters object it returns the very same array, so React
// components do not re-render and the (expensive) sort is not repeated.

export const selectFilteredBags = createSelector(
  [selectAllBags, (state, filters) => filters],
  (bags, filters) => filterAndSortBags(bags, filters)
);

export const selectCatalogPage = createSelector(
  [selectFilteredBags, (state, filters) => filters.page],
  (results, page) => ({ ...paginate(results, page), total: results.length })
);

export const selectFeaturedBags = createSelector(
  [selectAllBags],
  (bags) => filterAndSortBags(bags, defaultFilters).slice(0, 6)
);

export const selectDashboardOptions = createSelector(
  [selectAllBags],
  (bags) => ({
    categories: [...new Set(bags.map((bag) => bag.category))].sort(),
    districts: [...new Set(bags.map((bag) => bag.district))].sort()
  })
);

export const selectDashboard = createSelector(
  [selectAllBags, (state, category) => category, (state, category, district) => district],
  (bags, category, district) => {
    const filtered = filterDashboard(bags, category, district);
    return { filtered, stats: dashboardStats(filtered) };
  }
);
