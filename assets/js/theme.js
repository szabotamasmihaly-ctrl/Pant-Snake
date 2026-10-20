// Light or dark: follows the system until the visitor picks one with the sun/moon button, then remembers it.
// Loaded in <head> before the styles paint, so the page never flashes the wrong colours.
(function () {
  var KEY = 'ps-theme', root = document.documentElement, mq = matchMedia('(prefers-color-scheme: light)');
  function stored() { try { var s = localStorage.getItem(KEY); return s === 'light' || s === 'day' ? 'light' : s === 'dark' || s === 'night' ? 'dark' : null; } catch (e) { return null; } }   // the deck says day/night
  function label(b, t) { var next = t === 'light' ? 'dark' : 'light'; b.setAttribute('aria-label', 'Switch to ' + next + ' mode'); b.title = 'Switch to ' + next + ' mode'; }
  function apply() {
    var t = stored() || (mq.matches ? 'light' : 'dark');
    if (root.dataset.theme !== t) { root.dataset.theme = t; dispatchEvent(new CustomEvent('themechange', { detail: t })); }
    var bs = document.querySelectorAll('.themebtn'); for (var i = 0; i < bs.length; i++) label(bs[i], t);
  }
  apply();
  if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply);
  addEventListener('storage', function (e) { if (e.key === KEY) apply(); });
  window.psTheme = { get: function () { return root.dataset.theme; }, set: function (t) { try { localStorage.setItem(KEY, t); } catch (e) {} apply(); } };
  var ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">'
    + '<g class="sun"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g>'
    + '<path class="moon" d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z"/></svg>';
  function addButton() {
    var slot = document.querySelector('[data-theme-slot]'); if (!slot || slot.querySelector('.themebtn')) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'themebtn'; b.innerHTML = ICON;
    b.onclick = function () { window.psTheme.set(root.dataset.theme === 'light' ? 'dark' : 'light'); };
    slot.appendChild(b); label(b, root.dataset.theme);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButton); else addButton();
})();
