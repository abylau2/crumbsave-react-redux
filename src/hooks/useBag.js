import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBagById } from '../features/bags/bagsThunks.js';
import { selectBagById, selectBagDetailRequest } from '../features/bags/bagsSelectors.js';

// One bag. If the catalog list already brought this bag, it is shown immediately
// (same entity in the store) and no extra request is made while it is fresh.
export function useBag(id) {
  const dispatch = useDispatch();
  const bag = useSelector((state) => selectBagById(state, id)) ?? null;
  const detail = useSelector((state) => selectBagDetailRequest(state, id));

  useEffect(() => {
    dispatch(fetchBagById({ id }));
  }, [dispatch, id]);

  const status = bag || detail?.notFound ? 'success' : detail?.status === 'failed' ? 'error' : 'loading';
  const retry = useCallback(() => dispatch(fetchBagById({ id, force: true })), [dispatch, id]);
  return { bag, status, error: detail?.error?.message ?? '', retry };
}
