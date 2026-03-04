// ══════════════════════════════════════════════════════════════
//  SIDEBAR NAVIGATION
// ══════════════════════════════════════════════════════════════

document.addEventListener('fragments-loaded', () => {

  // ── Assets sub-group always open (static) ───────────────────
  const assetsSubGroup = document.getElementById('assets-sub-group');
  if (assetsSubGroup) assetsSubGroup.classList.add('open');

  // ── Set active sidebar item / sub-item ───────────────────────
  function setActiveSidebarItem(el) {
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.sidebar-sub-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
  }

  // ── Main sidebar items ────────────────────────────────────────
  document.querySelectorAll('.sidebar-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      const pageId = `page-${page}`;
      setActiveSidebarItem(item);
      if (allPages.includes(pageId)) {
        navigateTo(pageId, null);
      } else {
        allPages.forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
      }
    });
  });

  // ── Sub-items (Cash, Bank FD, Zerodha Stocks) ────────────────
  document.querySelectorAll('.sidebar-sub-item[data-asset-filter]').forEach(sub => {
    sub.addEventListener('click', e => {
      e.stopPropagation();
      setActiveSidebarItem(sub);
      navigateTo('page-assets', sub.dataset.assetFilter);
    });
  });

});
