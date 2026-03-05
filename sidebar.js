// ══════════════════════════════════════════════════════════════
//  SIDEBAR NAVIGATION
// ══════════════════════════════════════════════════════════════

document.addEventListener('fragments-loaded', () => {

  // ── Assets sub-group always open (static) ───────────────────
  const assetsSubGroup = document.getElementById('assets-sub-group');
  if (assetsSubGroup) assetsSubGroup.classList.add('open');

  // ── Zerodha nested group — open by default ───────────────────
  const zerodhaGroup   = document.getElementById('zerodha-nav-group');
  const zerodhaChevron = document.getElementById('zerodha-nav-chevron');
  const zerodhaHeader  = document.getElementById('zerodha-nav-header');
  if (zerodhaGroup)   zerodhaGroup.classList.add('open');
  if (zerodhaChevron) zerodhaChevron.classList.add('open');

  zerodhaHeader?.addEventListener('click', () => {
    zerodhaGroup?.classList.toggle('open');
    zerodhaChevron?.classList.toggle('open');
    // Navigate to Zerodha group overview
    setActiveSidebarItem(zerodhaHeader);
    navigateTo('page-assets', 'Zerodha');
  });

  // ── Aionion nested group — open by default ────────────────────
  const aionionGroup   = document.getElementById('aionion-nav-group');
  const aionionChevron = document.getElementById('aionion-nav-chevron');
  const aionionHeader  = document.getElementById('aionion-nav-header');
  if (aionionGroup)   aionionGroup.classList.add('open');
  if (aionionChevron) aionionChevron.classList.add('open');

  aionionHeader?.addEventListener('click', () => {
    aionionGroup?.classList.toggle('open');
    aionionChevron?.classList.toggle('open');
    // Navigate to Aionion group overview
    setActiveSidebarItem(aionionHeader);
    navigateTo('page-assets', 'Aionion');
  });

  // ── Set active sidebar item ───────────────────────────────────
  function setActiveSidebarItem(el) {
    document.querySelectorAll('.sidebar-item, .sidebar-sub-item, .sidebar-nested-item, .sidebar-nested-header').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    // If a nested item is active, also highlight the parent header
    if (el.classList.contains('sidebar-nested-item')) {
      const filter = el.dataset.assetFilter || '';
      if (['Zerodha Stocks', 'Mutual Funds', 'Gold'].includes(filter)) {
        zerodhaHeader?.classList.add('active');
      } else if (['Aionion Stocks', 'Aionion Gold'].includes(filter)) {
        aionionHeader?.classList.add('active');
      }
    }
  }

  // ── Main sidebar items ────────────────────────────────────────
  document.querySelectorAll('.sidebar-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page   = item.dataset.page;
      const pageId = `page-${page}`;
      setActiveSidebarItem(item);
      if (allPages.includes(pageId)) {
        navigateTo(pageId, null);
      } else {
        allPages.forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
      }
    });
  });

  // ── Sub-items (Cash, Bank FD, Aionion) ───────────────────────
  document.querySelectorAll('.sidebar-sub-item[data-asset-filter]').forEach(sub => {
    sub.addEventListener('click', e => {
      e.stopPropagation();
      setActiveSidebarItem(sub);
      navigateTo('page-assets', sub.dataset.assetFilter);
    });
  });

  // ── Nested items (Zerodha: Stocks, Mutual Funds, Gold) ───────
  document.querySelectorAll('.sidebar-nested-item[data-asset-filter]').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      setActiveSidebarItem(item);
      const filter = item.dataset.assetFilter || '';
      // Keep the correct group open
      if (['Zerodha Stocks', 'Mutual Funds', 'Gold'].includes(filter)) {
        zerodhaGroup?.classList.add('open');
        zerodhaChevron?.classList.add('open');
      } else if (['Aionion Stocks', 'Aionion Gold'].includes(filter)) {
        aionionGroup?.classList.add('open');
        aionionChevron?.classList.add('open');
      }
      navigateTo('page-assets', filter);
    });
  });

});