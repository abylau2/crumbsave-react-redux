import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchReservations } from '../features/reservations/reservationsThunks.js';
import { selectAllReservations, selectReservationsRequest, selectReservationsStatus } from '../features/reservations/reservationsSelectors.js';

export function useReservations() {
  const dispatch = useDispatch();
  const items = useSelector(selectAllReservations);
  const status = useSelector(selectReservationsStatus);
  const request = useSelector(selectReservationsRequest);

  useEffect(() => {
    dispatch(fetchReservations());
  }, [dispatch, request.stale]);

  const retry = useCallback(() => dispatch(fetchReservations({ force: true })), [dispatch]);
  return { items, status, error: request.error?.message ?? '', retry };
}
