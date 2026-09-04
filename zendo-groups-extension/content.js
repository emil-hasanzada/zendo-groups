/* Zendo Groups v0.2.1 — content script: ручная группировка задач в аккордеоны.
   React-safe: DOM-узлы карточек НЕ перемещаются (иначе dnd-kit падает с
   NotFoundError в insertBefore). Группировка только через CSS order + display. */
(function () {
  'use strict';
  const calcKey = () => 'zendoGroups:' + location.pathname;
  let storeKey = calcKey();
  let state = { groups: [] };          // {id,name,column,keys[],open}
  let selecting = false;
  let selColumn = null;
  let selected = new Set();
  let applying = false;
  let panel = null, fab = null;
  let lastStats = [];

  const log = (...a) => console.log('[ZG]', ...a);

  const uid = () => 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ---------- storage ----------
  function load(cb) {
    try {
      chrome.storage.local.get([storeKey], (r) => {
        if (chrome.runtime.lastError) log('load error:', chrome.runtime.lastError.message);
        if (r && r[storeKey]) state = r[storeKey];
        log('loaded', state.groups.length, 'group(s), key=' + storeKey);
        cb && cb();
      });
    } catch (e) { log('load exception', e); cb && cb(); }
  }
  function save() {
    try {
      chrome.storage.local.set({ [storeKey]: state }, () => {
        if (chrome.runtime.lastError) log('save error:', chrome.runtime.lastError.message);
        else log('saved', state.groups.length, 'group(s)');
      });
    } catch (e) { log('save exception', e); }
  }

  // ---------- board structure ----------
  function getColumns() {
    const cols = [];
    document.querySelectorAll('h3').forEach((h) => {
      const root = h.closest('div.glass-col') || h.closest('div[class*="rounded-xl"]');
      if (!root || cols.some((c) => c.root === root)) return;
      const list = root.querySelector('div.flex-1.flex.flex-col.gap-2');
      if (!list) return;
      cols.push({ name: h.textContent.trim(), root, list });
    });
    return cols;
  }
  const cardKey = (el) => {
    const p = el.querySelector('p');
    return p ? p.textContent.trim() : '';
  };
  function directCards(list) {
    return [...list.children].filter(
      (el) => el.nodeType === 1 && !el.classList.contains('wa-group') && el.querySelector && el.querySelector('p')
    );
  }
  function cardOf(target, list) {
    let el = target;
    while (el && el.parentElement !== list) el = el.parentElement;
    return el && el.parentElement === list ? el : null;
  }

  // ---------- grouping (React-safe: узлы НЕ двигаем, только CSS order/display) ----------
  function clearGroups() {
    document.querySelectorAll('.wa-group').forEach((g) => g.remove());
    getColumns().forEach((col) => {
      directCards(col.list).forEach((c) => {
        c.style.order = '';
        c.classList.remove('zg-member', 'zg-first', 'zg-last');
        c.style.removeProperty('--zg-c');
        if (c.dataset.zgHidden) { c.style.display = ''; delete c.dataset.zgHidden; }
      });
    });
  }
  function applyGroups(reason) {
    if (applying) return lastStats;
    applying = true;
    lastStats = [];
    try {
      clearGroups();
      const cols = getColumns();
      log('apply (' + (reason || '?') + '): columns=[' + cols.map((c) => c.name).join(', ') + ']');
      cols.forEach((col) => {
        const groups = state.groups.filter((g) => g.column === col.name);
        if (!groups.length) return;
        const byKey = {};
        directCards(col.list).forEach((c) => {
          const k = cardKey(c);
          if (k && !byKey[k]) byKey[k] = c;
        });
        // Группы кластеризуем вверху колонки через order; остальные карточки ниже в своём порядке
        const palette = ['#6366f1', '#059669', '#d97706', '#e11d48', '#0ea5e9', '#8b5cf6'];
        let ord = 0;
        groups.forEach((g, gi) => {
          const color = palette[gi % palette.length];
          let matched = 0;
          const members = [];
          g.keys.forEach((k) => {
            const c = byKey[k];
            if (!c) return;
            members.push(c);
            delete byKey[k];
            matched++;
          });
          lastStats.push({ name: g.name, want: g.keys.length, got: matched });
          if (!members.length) return;
          const collapsed = g.open === false;
          const box = document.createElement('div');
          box.className = 'wa-group' + (collapsed ? '' : ' open');
          box.dataset.gid = g.id;
          box.style.order = String(ord);
          box.style.setProperty('--zg-c', color);
          const head = document.createElement('button');
          head.className = 'wa-head'; head.type = 'button';
          head.innerHTML =
            '<span class="wa-chev">\u25BC</span><span class="wa-num">' + g.keys.length + '</span>' +
            '<span style="flex:1;min-width:0"><span style="display:block;font-size:12.5px;font-weight:700">' + esc(g.name) + '</span>' +
            '<span style="display:block;font-size:11px;opacity:.6">' + esc(col.name) + '</span></span>' +
            '<span class="wa-count">' + g.keys.length + '</span>';
          head.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const nowOpen = !box.classList.contains('open');
            box.classList.toggle('open', nowOpen);
            g.open = nowOpen;
            members.forEach((m) => {
              if (nowOpen) { m.style.display = ''; delete m.dataset.zgHidden; }
              else { m.style.display = 'none'; m.dataset.zgHidden = '1'; }
            });
            save();
          });
          box.appendChild(head);
          members.forEach((m, mi) => {
            m.style.order = String(ord);
            m.classList.add('zg-member');
            if (mi === 0) m.classList.add('zg-first');
            if (mi === members.length - 1) m.classList.add('zg-last');
            m.style.setProperty('--zg-c', color);
            const p = m.querySelector('p');
            if (p) {
              p.style.setProperty('max-height', 'none', 'important');
              p.style.setProperty('overflow', 'visible', 'important');
            }
            if (collapsed) { m.style.display = 'none'; m.dataset.zgHidden = '1'; }
          });
          col.list.insertBefore(box, members[0]);
          ord += 10;
        });
        // Несгруппированные — ниже групп, в исходном порядке
        directCards(col.list).forEach((c) => {
          if (c.style.order === '') c.style.order = String(ord);
        });
      });
      log('apply done:', JSON.stringify(lastStats));
    } finally {
      applying = false;
    }
    renderPanelGroups();
    return lastStats;
  }
  function fullyApplied() {
    return state.groups.length > 0 && lastStats.length === state.groups.length &&
      lastStats.every((s) => s.got > 0);
  }
  // Повторные попытки после загрузки: карточки приезжают с API позже скрипта
  function ensureApplied() {
    applyGroups('ensure');
    if (state.groups.length && !fullyApplied()) {
      [800, 2000, 4000, 8000].forEach((t) =>
        setTimeout(() => {
          if (!selecting && !fullyApplied()) applyGroups('retry+' + t);
        }, t)
      );
    }
  }

  // ---------- re-apply on React re-renders ----------
  let deb = null;
  new MutationObserver(() => {
    if (applying || selecting || dragActive) return;
    clearTimeout(deb);
    deb = setTimeout(() => { if (!selecting && !dragActive) applyGroups('mut'); }, 500);
  }).observe(document.documentElement, { childList: true, subtree: true });

  // ---------- drag & drop ----------
  // Трекинг перетаскивания: во время drag DOM не трогаем (иначе dnd-kit падает),
  // после drop карточка, брошенная рядом с задачами группы, вступает в неё.
  let dragActive = false, downInfo = null, colSnapshot = null;
  function snapshotKeys() {
    const m = {};
    getColumns().forEach((col) => {
      m[col.name] = new Set(directCards(col.list).map(cardKey).filter(Boolean));
    });
    return m;
  }
  document.addEventListener('pointerdown', (e) => {
    downInfo = {
      x: e.clientX, y: e.clientY,
      onCard: !!(e.target && e.target.closest && e.target.closest('div.flex-1.flex.flex-col.gap-2'))
    };
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (!downInfo || dragActive) return;
    const dx = e.clientX - downInfo.x, dy = e.clientY - downInfo.y;
    if (downInfo.onCard && dx * dx + dy * dy > 36) {
      dragActive = true;
      colSnapshot = snapshotKeys();
    }
  }, true);
  document.addEventListener('pointerup', () => {
    const wasDrag = dragActive;
    downInfo = null; dragActive = false;
    if (wasDrag) setTimeout(() => { if (!selecting) { adoptNewCards(); applyGroups('drop'); } }, 700);
  }, true);
  function adoptNewCards() {
    if (!colSnapshot) return;
    const keyToGid = {};
    state.groups.forEach((g) => g.keys.forEach((k) => { keyToGid[k] = g.id; }));
    let changed = false;
    getColumns().forEach((col) => {
      const cards = directCards(col.list);
      const before = colSnapshot[col.name] || new Set();
      cards.forEach((c, idx) => {
        const k = cardKey(c);
        if (!k || before.has(k)) return; // двигали внутри колонки или была тут — не трогаем
        const already = state.groups.find((g) => g.keys.includes(k) && g.column === col.name);
        if (already) return;
        const prev = idx > 0 ? cardKey(cards[idx - 1]) : '';
        const next = idx < cards.length - 1 ? cardKey(cards[idx + 1]) : '';
        const target =
          state.groups.find((g) => g.id === keyToGid[next] && g.column === col.name) ||
          state.groups.find((g) => g.id === keyToGid[prev] && g.column === col.name);
        if (!target) return;
        state.groups.forEach((g) => { g.keys = g.keys.filter((x) => x !== k); });
        target.keys.push(k);
        keyToGid[k] = target.id;
        changed = true;
        log('adopted "' + k.substring(0, 40) + '" into "' + target.name + '"');
      });
    });
    colSnapshot = null;
    if (changed) save();
  }

  // ---------- selection UI ----------
  function ensureUI() {
    if (fab) return;
    fab = document.createElement('button');
    fab.id = 'zg-fab'; fab.title = 'Группировка задач'; fab.textContent = '\u229E';
    fab.addEventListener('click', () => (panel ? closePanel() : openPanel()));
    document.body.appendChild(fab);
  }
  function openPanel() {
    ensureUI();
    panel = document.createElement('div');
    panel.id = 'zg-panel';
    panel.innerHTML =
      '<h4>\u229E Группировка задач</h4>' +
      '<div style="display:flex;gap:6px">' +
      '<button id="zg-sel" style="flex:1">\u2714 Выбрать задачи</button>' +
      '<button id="zg-close">\u2715</button></div>' +
      '<div id="zg-form" style="display:none;margin-top:8px">' +
      '<div id="zg-count" style="font-size:12px;margin-bottom:6px"></div>' +
      '<input type="text" id="zg-name" placeholder="Название группы">' +
      '<div id="zg-row"><button class="zg-primary" id="zg-make">Сгруппировать</button>' +
      '<button id="zg-cancel">Отмена</button></div></div>' +
      '<div id="zg-groups"></div>' +
      '<div id="zg-diag" style="font-size:11px;opacity:.6;margin-top:8px"></div>' +
      '<div style="display:flex;gap:6px;margin-top:6px"><button id="zg-reapply" style="flex:1">\u27F3 Применить снова</button></div>' +
      '<div class="zg-hint">Режим выбора: кликай по карточкам (открытие задачи блокируется). Затем введи название и нажми «Сгруппировать». Группы встают вверху колонки, перетаскивание работает как обычно.</div>';
    document.body.appendChild(panel);
    panel.querySelector('#zg-close').addEventListener('click', closePanel);
    panel.querySelector('#zg-sel').addEventListener('click', startSelect);
    panel.querySelector('#zg-cancel').addEventListener('click', stopSelect);
    panel.querySelector('#zg-make').addEventListener('click', makeGroup);
    panel.querySelector('#zg-reapply').addEventListener('click', () => ensureApplied());
    renderPanelGroups();
  }
  function closePanel() {
    stopSelect();
    if (panel) { panel.remove(); panel = null; }
    fab.classList.remove('zg-active');
  }
  function renderPanelGroups() {
    if (!panel) return;
    const box = panel.querySelector('#zg-groups');
    const diag = panel.querySelector('#zg-diag');
    if (diag) diag.textContent = 'Сохранено групп: ' + state.groups.length +
      (lastStats.length ? ' \u00B7 применено: ' + lastStats.map((s) => s.name + ' ' + s.got + '/' + s.want).join(', ') : '');
    if (!state.groups.length) { box.innerHTML = ''; return; }
    box.innerHTML = state.groups.map((g) =>
      '<div class="zg-gitem" data-gid="' + g.id + '"><div class="zg-gname">' + esc(g.name) + '</div>' +
      '<div class="zg-gmeta">' + esc(g.column) + ' \u00B7 ' + g.keys.length + '</div>' +
      '<div class="zg-gbtns"><button data-act="rename">Переименовать</button>' +
      '<button data-act="ungroup" class="zg-danger">Разгруппировать</button></div></div>'
    ).join('');
    box.querySelectorAll('.zg-gitem').forEach((item) => {
      const id = item.dataset.gid;
      item.querySelector('[data-act="rename"]').addEventListener('click', () => {
        const g = state.groups.find((x) => x.id === id);
        const name = prompt('Название группы:', g.name);
        if (name && name.trim()) { g.name = name.trim(); save(); applyGroups(); }
      });
      item.querySelector('[data-act="ungroup"]').addEventListener('click', () => {
        state.groups = state.groups.filter((x) => x.id !== id);
        save(); applyGroups();
      });
    });
  }
  function startSelect() {
    stopSelect(true);
    selecting = true;
    document.body.classList.add('zg-selecting');
    fab.classList.add('zg-active');
    panel.querySelector('#zg-form').style.display = 'block';
    updateCount();
  }
  function stopSelect(silent) {
    selecting = false; selColumn = null; selected = new Set();
    document.body.classList.remove('zg-selecting');
    if (fab) fab.classList.remove('zg-active');
    document.querySelectorAll('.zg-selected').forEach((el) => el.classList.remove('zg-selected'));
    if (panel && !silent) panel.querySelector('#zg-form').style.display = 'none';
  }
  function updateCount() {
    if (!panel) return;
    panel.querySelector('#zg-count').textContent =
      'Выбрано: ' + selected.size + (selColumn ? ' (' + selColumn + ')' : '');
  }
  document.addEventListener('click', (e) => {
    if (!selecting) return;
    if (panel && panel.contains(e.target)) return;
    const cols = getColumns();
    for (const col of cols) {
      if (!col.list.contains(e.target)) continue;
      const card = cardOf(e.target, col.list);
      if (!card) return;
      e.stopPropagation(); e.preventDefault();
      if (selColumn && selColumn !== col.name) {
        alert('Выбирай задачи из одной колонки (' + selColumn + '). Сначала сгруппируй их.');
        return;
      }
      selColumn = col.name;
      const k = cardKey(card);
      if (!k) return;
      card.setAttribute('data-zg-card', '1');
      if (selected.has(k)) { selected.delete(k); card.classList.remove('zg-selected'); }
      else { selected.add(k); card.classList.add('zg-selected'); }
      updateCount();
      return;
    }
  }, true);
  function makeGroup() {
    if (!selected.size) { alert('Выбери хотя бы одну задачу.'); return; }
    const input = panel.querySelector('#zg-name');
    const name = (input.value || '').trim() || ('Группа ' + (state.groups.length + 1));
    state.groups.push({ id: uid(), name, column: selColumn, keys: [...selected], open: true });
    save();
    input.value = '';
    stopSelect();
    panel.querySelector('#zg-form').style.display = 'none';
    applyGroups();
  }

  // ---------- popup messages ----------
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg === 'zg-toggle-panel') { panel ? closePanel() : openPanel(); }
    if (msg === 'zg-ungroup-all') { state.groups = []; save(); applyGroups('popup'); }
    if (msg === 'zg-reapply') { ensureApplied(); }
  });
  chrome.storage.onChanged.addListener((chg) => {
    if (chg[storeKey]) { state = chg[storeKey].newValue || { groups: [] }; applyGroups('storage'); }
  });

  // SPA-навигация без перезагрузки: ключ хранилища зависит от проекта
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      storeKey = calcKey();
      log('route changed, new key=' + storeKey);
      load(() => ensureApplied());
    }
  }, 1000);
  // Данные часто refetch'атся при возврате на вкладку
  window.addEventListener('focus', () => setTimeout(() => { if (!selecting) applyGroups('focus'); }, 800));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(() => { if (!selecting) applyGroups('visible'); }, 800);
  });

  load(() => { ensureUI(); ensureApplied(); });
  window.__zgDebug = () => ({ key: storeKey, state, lastStats, columns: getColumns().map((c) => c.name) });
})();
