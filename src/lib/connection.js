// Network status helpers. The state itself lives in Redux (features/network/networkSlice.js);
// this module lets non-React code (the API service, window events) update it.
import { useSelector } from 'react-redux';
import { dataReported, onlineChanged, selectNetwork } from '../features/network/networkSlice.js';

let store = null;

// Called once from app/store.js. Before that (for example in Node tests) the
// helpers below simply do nothing.
export function bindConnectionStore(nextStore) {
  store = nextStore;
}

export function useConnection() {
  return useSelector(selectNetwork);
}

export const setOnline = (online) => store?.dispatch(onlineChanged(online));
// Called after every catalog request. `fromSaved` is true when the data came from the
// service worker cache (or from this browser) because the network request failed.
export const reportData = ({ fromSaved, savedAt = null }) => store?.dispatch(dataReported({ fromSaved, savedAt }));

// A real reachability check. navigator.onLine only says "some network adapter exists".
export async function checkConnection(base = '/') {
  try {
    const response = await fetch(`${base}manifest.webmanifest?__ping=${Date.now()}`, { cache: 'no-store' });
    setOnline(response.ok);
    return response.ok;
  } catch {
    setOnline(false);
    return false;
  }
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('offline', () => setOnline(false));
  window.addEventListener('online', () => checkConnection(import.meta.env?.BASE_URL ?? '/'));
}
