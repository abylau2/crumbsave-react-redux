import { createSelector } from '@reduxjs/toolkit';
import { reservationsAdapter } from './reservationsSlice.js';

export const { selectAll: selectAllReservations } = reservationsAdapter.getSelectors((state) => state.reservations);

export const selectReservationsRequest = (state) => state.reservations.list;
export const selectIsReserving = (state, bagId) => state.reservations.reserving[bagId] === 'pending';

export function selectReservationsStatus(state) {
  const request = selectReservationsRequest(state);
  if (request.fetchedAt === 0) return request.status === 'failed' ? 'error' : 'loading';
  return 'success';
}

// Memoized: a Set of reserved bag ids, rebuilt only when reservations change.
export const selectReservedBagIds = createSelector(
  [selectAllReservations],
  (reservations) => new Set(reservations.map((reservation) => reservation.bagId))
);

export const selectIsBagReserved = (state, bagId) => selectReservedBagIds(state).has(bagId);
