// Bootstrap — replaced with the real flow in Task 4. For now it just proves the
// content script runs on the menu page.
(() => {
  if (!document.querySelector('form[name="frm"]')) return;
  console.log('[taste+] content script active on school_menu.asp');
  document.documentElement.dataset.tastePlus = 'active';
})();
