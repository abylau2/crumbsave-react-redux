import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  #map = new Map();
  getItem(key) { return this.#map.has(key) ? this.#map.get(key) : null; }
  setItem(key, value) { this.#map.set(key, String(value)); }
  removeItem(key) { this.#map.delete(key); }
  clear() { this.#map.clear(); }
}
globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

const { makeStore } = await import('../src/app/store.js');
const { fetchBags, fetchBagById, createBag } = await import('../src/features/bags/bagsThunks.js');
const { fetchReservations, reserveBag } = await import('../src/features/reservations/reservationsThunks.js');
const bagsReducer = (await import('../src/features/bags/bagsSlice.js')).default;
const sel = await import('../src/features/bags/bagsSelectors.js');
const resSel = await import('../src/features/reservations/reservationsSelectors.js');
const { STALE_TIME } = await import('../src/features/cachePolicy.js');
const { seedBags } = await import('../src/data/seedBags.js');
const { defaultFilters } = await import('../src/utils/catalogParams.js');
const { demoStorageKey, demoFailNextKey } = await import('../src/services/service.js');

const validBag = {
  title: 'Redux Test Bag', businessName: 'Test Cafe', category: 'Bakery', district: 'Medeu',
  description: 'A bag created by the Redux test to prove that the catalog refreshes.',
  originalPrice: 4000, price: 1500, quantity: 3, pickupStart: '18:00', pickupEnd: '20:00'
};
const shrinkStorage = () => {
  const state = JSON.parse(localStorage.getItem(demoStorageKey));
  state.bags = state.bags.slice(0, 1);
  localStorage.setItem(demoStorageKey, JSON.stringify(state));
};

test('configureStore creates three feature slices', () => {
  const state = makeStore().getState();
  assert.deepEqual(Object.keys(state).sort(), ['bags', 'network', 'reservations']);
  assert.equal(state.bags.list.status, 'idle');
  assert.equal(sel.selectBagsStatus(state), 'loading');
});

test('fetchBags: pending -> fulfilled fills the normalized bag entities', async () => {
  const store = makeStore();
  const promise = store.dispatch(fetchBags());
  assert.equal(store.getState().bags.list.status, 'loading');
  await promise;
  const state = store.getState();
  assert.equal(state.bags.list.status, 'succeeded');
  assert.equal(sel.selectBagCount(state), seedBags.length);
  assert.equal(sel.selectBagsStatus(state), 'success');
  assert.ok(state.bags.entities[seedBags[0].id]);
});

test('fresh data is reused: a second fetch is skipped by `condition` (no API request)', async () => {
  const store = makeStore();
  await store.dispatch(fetchBags());
  const stamp = store.getState().bags.list.fetchedAt;
  shrinkStorage(); // change data behind the store
  const second = await store.dispatch(fetchBags());
  assert.equal(second.meta.condition, true);
  assert.equal(store.getState().bags.list.fetchedAt, stamp);
  assert.equal(sel.selectBagCount(store.getState()), seedBags.length);
  assert.ok(STALE_TIME.bags > 0 && STALE_TIME.reservations > 0);
});

test('a request already in flight is not duplicated', async () => {
  const store = makeStore();
  const first = store.dispatch(fetchBags());
  const second = await store.dispatch(fetchBags());
  assert.equal(second.meta.condition, true);
  await first;
});

test('force refetches even while data is fresh', async () => {
  const store = makeStore();
  await store.dispatch(fetchBags());
  shrinkStorage();
  await store.dispatch(fetchBags({ force: true }));
  assert.equal(sel.selectBagCount(store.getState()), 1);
});

test('stale requests: an older answer cannot overwrite a newer request', () => {
  let state = bagsReducer(undefined, fetchBags.pending('old-request', {}));
  state = bagsReducer(state, fetchBags.pending('new-request', { force: true }));
  state = bagsReducer(state, fetchBags.fulfilled([seedBags[0]], 'old-request', {}));
  assert.equal(state.ids.length, 0, 'old answer ignored');
  assert.equal(state.list.status, 'loading');
  state = bagsReducer(state, fetchBags.fulfilled(seedBags.slice(0, 2), 'new-request', { force: true }));
  assert.equal(state.ids.length, 2);
  assert.equal(state.list.status, 'succeeded');
});

test('rejected: the error is stored, the page shows the error state, and retry recovers', async () => {
  const store = makeStore();
  sessionStorage.setItem(demoFailNextKey, 'getBags');
  await store.dispatch(fetchBags());
  let state = store.getState();
  assert.equal(state.bags.list.status, 'failed');
  assert.match(state.bags.list.error.message, /try again/i);
  assert.equal(sel.selectBagsStatus(state), 'error');
  await store.dispatch(fetchBags({ force: true })); // the Retry button
  state = store.getState();
  assert.equal(sel.selectBagsStatus(state), 'success');
  assert.equal(state.bags.list.error, null);
});

test('a failed refresh keeps the data that is already on screen', async () => {
  const store = makeStore();
  await store.dispatch(fetchBags());
  sessionStorage.setItem(demoFailNextKey, 'getBags');
  await store.dispatch(fetchBags({ force: true }));
  assert.equal(sel.selectBagsStatus(store.getState()), 'success');
  assert.equal(sel.selectBagCount(store.getState()), seedBags.length);
});

test('details: no request when the fresh list already has the bag; otherwise fetched and stored once', async () => {
  const store = makeStore();
  const id = seedBags[3].id;
  const cold = await store.dispatch(fetchBagById({ id }));
  assert.equal(cold.meta.requestStatus, 'fulfilled');
  assert.equal(store.getState().bags.details[id].status, 'succeeded');
  assert.equal(sel.selectBagById(store.getState(), id).title, seedBags[3].title);
  await store.dispatch(fetchBags());
  const other = seedBags[4].id;
  const skipped = await store.dispatch(fetchBagById({ id: other }));
  assert.equal(skipped.meta.condition, true, 'list is fresh, detail request skipped');
  assert.equal(store.getState().bags.ids.filter((x) => x === id).length, 1, 'bag stored once');
});

test('details: unknown id is marked notFound', async () => {
  const store = makeStore();
  await store.dispatch(fetchBagById({ id: 'missing-bag' }));
  assert.equal(store.getState().bags.details['missing-bag'].notFound, true);
  assert.equal(sel.selectBagById(store.getState(), 'missing-bag'), undefined);
});

test('createBag mutation adds the bag and refreshes the list', async () => {
  const store = makeStore();
  await store.dispatch(fetchBags());
  const stamp = store.getState().bags.list.fetchedAt;
  const bag = await store.dispatch(createBag(validBag)).unwrap();
  assert.ok(sel.selectBagById(store.getState(), bag.id));
  assert.equal(store.getState().bags.create.status, 'succeeded');
  // wait for the background refresh started by the mutation
  while (store.getState().bags.list.status === 'loading') await new Promise((r) => setTimeout(r, 20));
  assert.ok(store.getState().bags.list.fetchedAt > stamp);
  assert.equal(store.getState().bags.list.stale, false);
  assert.equal(sel.selectBagCount(store.getState()), seedBags.length + 1);
});

test('createBag validation error is rejected with a plain error object', async () => {
  const store = makeStore();
  await assert.rejects(store.dispatch(createBag({ ...validBag, title: '' })).unwrap(), (error) => error.code === 'VALIDATION_ERROR');
  assert.equal(store.getState().bags.create.status, 'failed');
});

test('reserveBag updates the bag and the reservations, blocks double submits and duplicates', async () => {
  const store = makeStore();
  await store.dispatch(fetchBags());
  await store.dispatch(fetchReservations());
  const bag = seedBags.find((item) => item.quantity > 1);
  const first = store.dispatch(reserveBag(bag.id));
  assert.equal(resSel.selectIsReserving(store.getState(), bag.id), true);
  const double = await store.dispatch(reserveBag(bag.id));
  assert.equal(double.meta.condition, true, 'second click skipped');
  await first;
  const state = store.getState();
  assert.equal(sel.selectBagById(state, bag.id).quantity, bag.quantity - 1);
  assert.equal(resSel.selectIsBagReserved(state, bag.id), true);
  await assert.rejects(store.dispatch(reserveBag(bag.id)).unwrap(), (error) => error.code === 'DUPLICATE');
  assert.equal(store.getState().reservations.lastError.code, 'DUPLICATE');
});

test('memoized selectors return the same reference for the same input', async () => {
  const store = makeStore();
  await store.dispatch(fetchBags());
  const state = store.getState();
  const filters = { ...defaultFilters, category: 'Bakery' };
  const a = sel.selectFilteredBags(state, filters);
  assert.equal(sel.selectFilteredBags(state, filters), a);
  assert.ok(a.length && a.every((bag) => bag.category === 'Bakery'));
  assert.equal(sel.selectCatalogPage(state, filters), sel.selectCatalogPage(state, filters));
  assert.equal(sel.selectFeaturedBags(state), sel.selectFeaturedBags(state));
  assert.equal(sel.selectFeaturedBags(state).length, 6);
  assert.equal(sel.selectDashboard(state, 'All', 'All districts'), sel.selectDashboard(state, 'All', 'All districts'));
  assert.equal(resSel.selectReservedBagIds(state), resSel.selectReservedBagIds(state));
});
