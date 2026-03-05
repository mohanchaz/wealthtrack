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
  });

  // ── Set active sidebar item ───────────────────────────────────
  function setActiveSidebarItem(el) {
    document.querySelectorAll('.sidebar-item, .sidebar-sub-item, .sidebar-nested-item, .sidebar-nested-header').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    // If a nested item is active, also highlight the parent header
    if (el.classList.contains('sidebar-nested-item')) {
      zerodhaHeader?.classList.add('active');
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
      // Ensure Zerodha group stays open when a child is selected
      zerodhaGroup?.classList.add('open');
      zerodhaChevron?.classList.add('open');
      navigateTo('page-assets', item.dataset.assetFilter);
    });
  });

});