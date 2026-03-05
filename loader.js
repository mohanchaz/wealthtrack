// ── HTML Fragment Loader ──────────────────────────────────────
// Fetches all page/modal HTML fragments and injects them into
// the DOM before the rest of the app scripts run.

(async function () {
  async function loadHTML(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return res.text();
  }

  async function inject(containerId, html) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = html;
  }

  async function append(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    while (temp.firstChild) document.body.appendChild(temp.firstChild);
  }

  try {
    // Load all fragments in parallel
    const [
      loginHtml,
      dashShellHtml,
      dashPageHtml,
      allocPageHtml,
      assetsPageHtml,
      modalZerodhaImport,
      modalZerodhaInvested,
      modalFdInvested,
      modalAlloc,
      modalZerodhaEdit,
      modalAddAsset,
      modalAionionInvested,
      modalAionionEdit,
      modalAionionGoldEdit,
      modalAionionGoldInvested,
      modalMfImport,
      modalMfInvested,
      modalMfEdit,
      modalGoldImport,
      modalGoldInvested,
      modalGoldEdit,
    ] = await Promise.all([
      loadHTML('pages/login.html'),
      loadHTML('pages/dashboard-shell.html'),
      loadHTML('pages/dashboard.html'),
      loadHTML('pages/allocation.html'),
      loadHTML('pages/assets.html'),
      loadHTML('modals/zerodha-import.html'),
      loadHTML('modals/zerodha-invested.html'),
      loadHTML('modals/fd-invested.html'),
      loadHTML('modals/alloc-modal.html'),
      loadHTML('modals/zerodha-edit.html'),
      loadHTML('modals/add-asset.html'),
      loadHTML('modals/aionion-invested.html'),
      loadHTML('modals/aionion-edit.html'),
      loadHTML('modals/aionion-gold-edit.html'),
      loadHTML('modals/aionion-gold-invested.html'),
      loadHTML('modals/mf-import.html'),
      loadHTML('modals/mf-invested.html'),
      loadHTML('modals/mf-edit.html'),
      loadHTML('modals/gold-import.html'),
      loadHTML('modals/gold-invested.html'),
      loadHTML('modals/gold-edit.html'),
      loadHTML('modals/bonds-edit.html'),
    ]);

    // 1. Inject login / auth view
    await inject('auth-view', loginHtml);

    // 2. Build dashboard shell then inject the three pages into <main>
    const dashTemp = document.createElement('div');
    dashTemp.innerHTML = dashShellHtml;
    const dashView = dashTemp.querySelector('#dashboard-view');

    const main = dashView.querySelector('main');
    if (main) {
      main.innerHTML =
        dashPageHtml +
        '\n' + allocPageHtml +
        '\n' + assetsPageHtml;
    }

    // Append full dashboard-view to body
    document.getElementById('dashboard-view').outerHTML; // placeholder exists in index.html
    document.getElementById('dashboard-view').replaceWith(dashView);

    // 3. Append all modals to body
    await append(modalZerodhaImport);
    await append(modalZerodhaInvested);
    await append(modalFdInvested);
    await append(modalAlloc);
    await append(modalZerodhaEdit);
    await append(modalAddAsset);
    await append(modalAionionInvested);
    await append(modalAionionEdit);
    await append(modalAionionGoldEdit);
    await append(modalAionionGoldInvested);
    await append(modalMfImport);
    await append(modalMfInvested);
    await append(modalMfEdit);
    await append(modalGoldImport);
    await append(modalGoldInvested);
    await append(modalGoldEdit);

    // 4. Signal that HTML is ready — app scripts may now safely query the DOM
    document.dispatchEvent(new Event('fragments-loaded'));

  } catch (err) {
    console.error('Fragment loader error:', err);
    document.body.innerHTML = `
      <div style="padding:40px;font-family:sans-serif;color:#c00">
        <h2>Failed to load app</h2>
        <pre>${err.message}</pre>
        <p>Make sure all files in <code>pages/</code> and <code>modals/</code> are deployed.</p>
      </div>`;
  }
})();