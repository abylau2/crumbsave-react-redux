import { configureStore } from '@reduxjs/toolkit';
import bagsReducer from '../features/bags/bagsSlice.js';
import reservationsReducer from '../features/reservations/reservationsSlice.js';
import networkReducer from '../features/network/networkSlice.js';
import { fetchBags } from '../features/bags/bagsThunks.js';
import { fetchReservations } from '../features/reservations/reservationsThunks.js';
import { bindConnectionStore } from '../lib/connection.js';

// One function builds the store, so tests can create a fresh one each time.
export function makeStore(preloadedState) {
  return configureStore({
    reducer: {
      bags: bagsReducer,
      reservations: reservationsReducer,
      network: networkReducer
    },
    preloadedState
  });
}

export const store = makeStore();
bindConnectionStore(store);

// Like TanStack Query's refetchOnWindowFocus / refetchOnReconnect from Homework 6:
// when the tab becomes visible again or the network returns, data that was already
// loaded is refreshed. The thunks' `condition` skips anything that is still fresh.
function refreshLoadedData() {
  const state = store.getState();
  if (state.bags.list.fetchedAt) store.dispatch(fetchBags());
  if (state.reservations.list.fetchedAt) store.dispatch(fetchReservations());
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('focus', refreshLoadedData);
  window.addEventListener('online', refreshLoadedData);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshLoadedData();
  });
}
