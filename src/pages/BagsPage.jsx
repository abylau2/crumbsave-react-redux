import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useSearchParams } from 'react-router-dom';
import { BagCard } from '../components/BagCard.jsx';
import { CatalogControls } from '../components/CatalogControls.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/States.jsx';
import { useBags } from '../hooks/useBags.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { selectCatalogPage } from '../features/bags/bagsSelectors.js';
import { defaultFilters, parseCatalogParams, catalogParams } from '../utils/catalogParams.js';

export default function BagsPage() {
  const { status, error, retry } = useBags();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  // The URL is the single source of truth for filters, sorting and the page number.
  const filters = useMemo(() => parseCatalogParams(params), [params]);
  // Memoized selector: same bags + same filters object -> same result, no re-sorting.
  const pageData = useSelector((state) => selectCatalogPage(state, filters));

  // The search box is temporary UI state: it updates on every key press, and the
  // URL follows 300 ms after the user stops typing (debounce).
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchDraft, 300);
  const written = useRef(filters.search);
  useEffect(() => {
    if (debouncedSearch === filters.search) return;
    written.current = debouncedSearch;
    setParams(catalogParams({ ...filters, search: debouncedSearch, page: 1 }, params), { replace: true });
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps
  // The URL changed from outside (Clear filters, Back button, a link): show it in the box.
  useEffect(() => {
    if (filters.search !== written.current) {
      written.current = filters.search;
      setSearchDraft(filters.search);
    }
  }, [filters.search]);

  useEffect(() => {
    if (status !== 'success') return;
    const normalized = catalogParams({ ...filters, page: pageData.currentPage }, params);
    if (normalized.toString() !== params.toString()) setParams(normalized, { replace: true });
  }, [status, filters, pageData.currentPage, params, setParams]);

  function change(field, value) {
    if (field === 'search') { setSearchDraft(value); return; }
    setParams(catalogParams({ ...filters, [field]: value, page: 1 }, params));
  }
  function clear() { setParams(catalogParams(defaultFilters, params)); }
  const context = { catalog: `/bags${location.search}`, fromApp: true };
  return <section className="catalog-section container" id="catalog" aria-labelledby="catalog-title">
    <div className="section-header"><div><p className="eyebrow">THE DAILY FIND</p><h1 id="catalog-title">Explore what's on the menu.</h1><p>Good food from local spots, collected in one place.</p></div></div>
    {status === 'loading' && <LoadingSkeleton />}
    {status === 'error' && <ErrorState message={error} onRetry={retry} />}
    {status === 'success' && <>
      <CatalogControls filters={{ ...filters, search: searchDraft }} onChange={change} onClear={clear} resultCount={pageData.total} />
      {!pageData.total ? <EmptyState onClear={clear} /> : <><div className="bag-grid">{pageData.items.map((bag, index) => <BagCard key={bag.id} bag={bag} priority={index < 3} navigationState={context} />)}</div><Pagination page={pageData.currentPage} pageCount={pageData.pageCount} onPage={(page) => setParams(catalogParams({ ...filters, page }, params))} /></>}
    </>}
  </section>;
}
