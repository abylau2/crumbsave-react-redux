import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBags } from '../features/bags/bagsThunks.js';
import { selectAllBags, selectBagsRequest, selectBagsStatus } from '../features/bags/bagsSelectors.js';

// Loads the catalog once and keeps it in the Redux store. Every page that calls
// useBags() reads the same data; the thunk's `condition` makes sure that mounting
// several of them (or coming back within a minute) does not send extra requests.
export function useBags() {
  const dispatch = useDispatch();
  const bags = useSelector(selectAllBags);
  const status = useSelector(selectBagsStatus);
  const request = useSelector(selectBagsRequest);

  useEffect(() => {
    dispatch(fetchBags());
  }, [dispatch, request.stale]);

  const retry = useCallback(() => dispatch(fetchBags({ force: true })), [dispatch]);
  return { bags, status, error: request.error?.message ?? '', isFetching: request.status === 'loading', retry };
}
