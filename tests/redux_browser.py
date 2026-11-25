"""Homework 8 browser checks: debounce, no duplicate API requests, shared Redux data.
Run: npm run build && python3 tests/redux_browser.py"""
import os, re, subprocess, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
CHROME = os.environ.get('CHROME_PATH') or next((p for p in ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'] if Path(p).exists()), None)
PORT = 4198
BASE = f'http://127.0.0.1:{PORT}'
server = subprocess.Popen(['npx', 'vite', 'preview', '--host', '127.0.0.1', '--port', str(PORT), '--strictPort'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
passed = failed = 0
def check(name, ok, detail=''):
    global passed, failed
    if ok: passed += 1; print('PASS', name)
    else: failed += 1; print('FAIL', name, detail)

try:
    time.sleep(3)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        page = browser.new_page()
        errors, api = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: api.append(r.url) if '/api/bags' in r.url else None)
        page.goto(BASE + '/')
        expect(page.locator('.bag-card')).to_have_count(6)
        page.get_by_role('navigation', name='Primary navigation').get_by_role('link', name='Explore Bags', exact=True).click()
        expect(page.locator('.bag-card')).to_have_count(12)
        page.get_by_role('navigation', name='Footer navigation').get_by_role('link', name='Dashboard', exact=True).click()
        expect(page.get_by_text('Total listings')).to_be_visible()
        list_calls = [u for u in api if u.endswith('/api/bags.json')]
        check('Home -> Bags -> Dashboard share one catalog request (no duplicates)', len(list_calls) == 1, list_calls)

        page.get_by_role('navigation', name='Primary navigation').get_by_role('link', name='Explore Bags', exact=True).click()
        expect(page.locator('.bag-card')).to_have_count(12)
        first = page.locator('.bag-card a').first
        first.click()
        expect(page.get_by_role('heading', level=1)).to_be_visible()
        detail_calls = [u for u in api if re.search(r'/api/bags/[^/]+\.json$', u)]
        check('details page uses the bag already in the store (no extra request while fresh)', not detail_calls, detail_calls)

        page.goto(BASE + '/bags')
        search = page.get_by_role('searchbox')
        search.press_sequentially('Ramen', delay=40)
        check('URL does not change on every key press (debounce)', 'q=' not in page.url, page.url)
        expect(page).to_have_url(re.compile('q=Ramen'))
        check('URL updates after the user stops typing', 'q=Ramen' in page.url)
        check('search box keeps every typed character', search.input_value() == 'Ramen', search.input_value())
        check('no page errors', not errors, errors)
        browser.close()
finally:
    server.terminate()
print(f'\n{passed}/{passed + failed} checks passed')
raise SystemExit(1 if failed else 0)
