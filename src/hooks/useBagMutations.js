import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createBag } from '../features/bags/bagsThunks.js';
import { reserveBag } from '../features/reservations/reservationsThunks.js';
import { selectCreateBagRequest } from '../features/bags/bagsSelectors.js';
import { selectIsBagReserved, selectIsReserving } from '../features/reservations/reservationsSelectors.js';

// `unwrap()` turns the thunk result into a normal promise: it resolves with the
// payload or throws the { message, code } error, so pages can use try/catch.
export function useCreateBag() {
  const dispatch = useDispatch();
  const request = useSelector(selectCreateBagRequest);
  const create = useCallback((values) => dispatch(createBag(values)).unwrap(), [dispatch]);
  return { create, isPending: request.status === 'loading' };
}

export function useReserveBag(bagId) {
  const dispatch = useDispatch();
  const isPending = useSelector((state) => selectIsReserving(state, bagId));
  const isReserved = useSelector((state) => selectIsBagReserved(state, bagId));
  const reserve = useCallback(() => dispatch(reserveBag(bagId)).unwrap(), [dispatch, bagId]);
  return { reserve, isPending, isReserved };
}
