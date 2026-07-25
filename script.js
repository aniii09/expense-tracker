(() => {
  'use strict';

  /* ============================================
     Config
     ============================================ */
  const STORAGE_KEY = 'ledger_transactions_v1';
  const THEME_KEY = 'ledger_theme_v1';
  const CUSTOM_CATEGORY_KEY = 'ledger_custom_categories_v1';
  const CURRENCY = '₹';

  const EXTRA_COLORS = ['#5b7fa6', '#9c6b4a', '#4a9c8a', '#b06b9c', '#7a9c4a', '#c46b6b', '#6b8ac4', '#a68a4a'];

  const CATEGORY_META = {
    expense: {
      'Food & Dining':  '#c08a2e',
      'Transport':      '#5b7fa6',
      'Housing':        '#8c5a3c',
      'Utilities':      '#6e7d8c',
      'Health':         '#a23e2e',
      'Entertainment':  '#7a6baf',
      'Shopping':       '#b5824a',
      'Other':          '#847a5f',
    },
    income: {
      'Salary':      '#3f7d58',
      'Freelance':   '#4a8f6b',
      'Investment':  '#5d9c6c',
      'Gift':        '#7aae7a',
      'Other':       '#847a5f',
    }
  };

  const CATEGORY_KEYWORDS = {
    expense: {
      'Food & Dining': ['coffee','lunch','dinner','breakfast','restaurant','cafe','food','grocery','groceries','snack','pizza','burger','swiggy','zomato','starbucks','tea','brunch'],
      'Transport':     ['uber','ola','metro','bus','train','taxi','cab','fuel','petrol','diesel','parking','flight','auto','rickshaw'],
      'Housing':       ['rent','emi','mortgage','maintenance','society','landlord'],
      'Utilities':     ['electricity','water bill','wifi','internet','gas bill','phone bill','recharge','dth','broadband'],
      'Health':        ['doctor','medicine','pharmacy','hospital','gym','medical','dentist','clinic'],
      'Entertainment': ['movie','netflix','spotify','concert','game','party','subscription','cinema'],
      'Shopping':      ['amazon','flipkart','clothes','shoes','mall','shopping','myntra'],
    },
    income: {
      'Salary':     ['salary','paycheck','pay day','stipend'],
      'Freelance':  ['freelance','client','project','gig','contract'],
      'Investment': ['dividend','interest','stocks','mutual fund','returns','profit'],
      'Gift':       ['gift','bonus','cashback','present'],
    }
  };

  function guessCategory(text, type) {
    const t = text.toLowerCase();
    const table = CATEGORY_KEYWORDS[type] || {};
    for (const [cat, words] of Object.entries(table)) {
      if (words.some(w => t.includes(w))) return cat;
    }
    return null;
  }

  const fmt = (n) => {
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    return `${sign}${CURRENCY}${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  function loadCustomCategories() {
    try {
      const raw = localStorage.getItem(CUSTOM_CATEGORY_KEY);
      if (!raw) return;
      const custom = JSON.parse(raw);
      ['expense', 'income'].forEach(type => {
        if (custom[type]) Object.assign(CATEGORY_META[type], custom[type]);
      });
    } catch (e) { /* ignore, start fresh */ }
  }

  function saveCustomCategory(type, name, color) {
    let custom = { expense: {}, income: {} };
    try {
      const raw = localStorage.getItem(CUSTOM_CATEGORY_KEY);
      if (raw) custom = JSON.parse(raw);
    } catch (e) { /* start fresh */ }
    custom[type] = custom[type] || {};
    custom[type][name] = color;
    try { localStorage.setItem(CUSTOM_CATEGORY_KEY, JSON.stringify(custom)); } catch (e) { /* in-session only */ }
  }

  loadCustomCategories();

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const todayISO = () => new Date().toISOString().slice(0, 10);

  /* ============================================
     State
     ============================================ */
  let transactions = load();
  let currentType = 'expense';
  let activeFilter = 'all';

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through to seed */ }
    return seedData();
  }

  function seedData() {
    const d = new Date();
    const on = (day) => new Date(d.getFullYear(), d.getMonth(), day).toISOString().slice(0, 10);
    return [
      { id: uid(), type: 'income',  description: 'Salary',           category: 'Salary',         amount: 45000, date: on(1) },
      { id: uid(), type: 'expense', description: 'Groceries',        category: 'Food & Dining',   amount: 1850,  date: on(3) },
      { id: uid(), type: 'expense', description: 'Metro pass',       category: 'Transport',       amount: 600,   date: on(4) },
      { id: uid(), type: 'expense', description: 'Electricity bill', category: 'Utilities',       amount: 2200,  date: on(5) },
      { id: uid(), type: 'expense', description: 'Movie night',      category: 'Entertainment',   amount: 450,   date: on(8) },
    ];
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); }
    catch (e) { /* storage unavailable — app still works in-session */ }
  }

  /* ============================================
     DOM refs
     ============================================ */
  const el = {
    form: document.getElementById('entryForm'),
    typeButtons: document.querySelectorAll('.type-btn'),
    descInput: document.getElementById('descInput'),
    amountInput: document.getElementById('amountInput'),
    dateInput: document.getElementById('dateInput'),
    categoryInput: document.getElementById('categoryInput'),
    formError: document.getElementById('formError'),

    balanceValue: document.getElementById('balanceValue'),
    incomeValue: document.getElementById('incomeValue'),
    expenseValue: document.getElementById('expenseValue'),
    txnCount: document.getElementById('txnCount'),
    receipt: document.getElementById('receipt'),

    chart: document.getElementById('chart'),
    chartCenterValue: document.getElementById('chartCenterValue'),
    chartLegend: document.getElementById('chartLegend'),

    searchInput: document.getElementById('searchInput'),
    sortSelect: document.getElementById('sortSelect'),
    filterChips: document.getElementById('filterChips'),
    ledgerList: document.getElementById('ledgerList'),
    emptyState: document.getElementById('emptyState'),

    exportBtn: document.getElementById('exportBtn'),
    clearBtn: document.getElementById('clearBtn'),

    categoryHint: document.getElementById('categoryHint'),
    quickAddInput: document.getElementById('quickAddInput'),
    quickAddBtn: document.getElementById('quickAddBtn'),
    quickAddPreview: document.getElementById('quickAddPreview'),
    insightsList: document.getElementById('insightsList'),

    themeToggle: document.getElementById('themeToggle'),
    greetingText: document.getElementById('greetingText'),
    trendChart: document.getElementById('trendChart'),
    trendLatest: document.getElementById('trendLatest'),
    trendEmpty: document.getElementById('trendEmpty'),

    categoryCustomSelect: document.getElementById('categoryCustomSelect'),
    categoryTrigger: document.getElementById('categoryTrigger'),
    categoryTriggerLabel: document.getElementById('categoryTriggerLabel'),
    categoryPanel: document.getElementById('categoryPanel'),
    categoryOptionsList: document.getElementById('categoryOptionsList'),
    newCategoryInput: document.getElementById('newCategoryInput'),
    addCategoryBtn: document.getElementById('addCategoryBtn'),

    sortCustomSelect: document.getElementById('sortCustomSelect'),
    sortTrigger: document.getElementById('sortTrigger'),
    sortTriggerLabel: document.getElementById('sortTriggerLabel'),
    sortPanel: document.getElementById('sortPanel'),
    sortOptionsList: document.getElementById('sortOptionsList'),
  };

  let categoryTouched = false;
  let pendingQuickAdd = null;

  /* ============================================
     Theme (day / night)
     ============================================ */
  function initTheme() {
    let theme = 'night';
    try { theme = localStorage.getItem(THEME_KEY) || 'night'; } catch (e) { /* default */ }
    document.documentElement.setAttribute('data-theme', theme);
  }

  el.themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'day' ? 'day' : 'night';
    const next = current === 'day' ? 'night' : 'day';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* in-session only */ }
    renderChart();
    renderTrend();
  });

  /* ============================================
     Greeting
     ============================================ */
  function renderGreeting() {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    el.greetingText.textContent = `${part} — let's review today's financial outlook.`;
  }

  /* ============================================
     Category select population
     ============================================ */
  function populateCategorySelect(selectValue) {
    const cats = Object.keys(CATEGORY_META[currentType]);
    el.categoryInput.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');

    el.categoryOptionsList.innerHTML = cats.map(c => {
      const color = CATEGORY_META[currentType][c];
      return `<li role="option" data-cat="${c}"><span class="dot" style="background:${color}"></span>${c}</li>`;
    }).join('');

    const target = selectValue && cats.includes(selectValue) ? selectValue : cats[0];
    setCategoryValue(target, { silent: true });
  }

  function setCategoryValue(cat, opts = {}) {
    el.categoryInput.value = cat;
    el.categoryTriggerLabel.textContent = cat;
    el.categoryOptionsList.querySelectorAll('li').forEach(li => {
      li.classList.toggle('active', li.dataset.cat === cat);
    });
    if (!opts.silent) categoryTouched = true;
  }

  function openCategoryPanel() {
    el.categoryPanel.hidden = false;
    el.categoryCustomSelect.classList.add('open');
    el.categoryTrigger.setAttribute('aria-expanded', 'true');
  }
  function closeCategoryPanel() {
    el.categoryPanel.hidden = true;
    el.categoryCustomSelect.classList.remove('open');
    el.categoryTrigger.setAttribute('aria-expanded', 'false');
    el.newCategoryInput.value = '';
  }

  el.categoryTrigger.addEventListener('click', () => {
    el.categoryPanel.hidden ? openCategoryPanel() : closeCategoryPanel();
  });

  el.categoryOptionsList.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-cat]');
    if (!li) return;
    setCategoryValue(li.dataset.cat);
    closeCategoryPanel();
  });

  document.addEventListener('click', (e) => {
    if (!el.categoryCustomSelect.contains(e.target)) closeCategoryPanel();
    if (!el.sortCustomSelect.contains(e.target)) closeSortPanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeCategoryPanel(); closeSortPanel(); }
  });

  /* ---------- Sort dropdown ---------- */
  const SORT_LABELS = {
    'date-desc': 'Newest first',
    'date-asc': 'Oldest first',
    'amount-desc': 'Highest amount',
    'amount-asc': 'Lowest amount',
  };

  function setSortValue(value) {
    el.sortSelect.value = value;
    el.sortTriggerLabel.textContent = SORT_LABELS[value] || value;
    el.sortOptionsList.querySelectorAll('li').forEach(li => {
      li.classList.toggle('active', li.dataset.sort === value);
    });
  }

  function openSortPanel() {
    el.sortPanel.hidden = false;
    el.sortCustomSelect.classList.add('open');
    el.sortTrigger.setAttribute('aria-expanded', 'true');
  }
  function closeSortPanel() {
    el.sortPanel.hidden = true;
    el.sortCustomSelect.classList.remove('open');
    el.sortTrigger.setAttribute('aria-expanded', 'false');
  }

  el.sortTrigger.addEventListener('click', () => {
    el.sortPanel.hidden ? openSortPanel() : closeSortPanel();
  });

  el.sortOptionsList.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-sort]');
    if (!li) return;
    setSortValue(li.dataset.sort);
    closeSortPanel();
    renderList();
  });

  function addCustomCategory() {
    const name = el.newCategoryInput.value.trim();
    if (!name) return;
    if (CATEGORY_META[currentType][name]) {
      setCategoryValue(name);
      closeCategoryPanel();
      return;
    }
    const usedCount = Object.keys(CATEGORY_META.expense).length + Object.keys(CATEGORY_META.income).length;
    const color = EXTRA_COLORS[usedCount % EXTRA_COLORS.length];
    CATEGORY_META[currentType][name] = color;
    saveCustomCategory(currentType, name, color);
    populateCategorySelect(name);
    closeCategoryPanel();
  }

  el.addCategoryBtn.addEventListener('click', addCustomCategory);
  el.newCategoryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addCustomCategory(); }
  });

  el.typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      el.typeButtons.forEach(b => b.classList.toggle('active', b === btn));
      currentType = btn.dataset.type;
      categoryTouched = false;
      populateCategorySelect();
    });
  });

  /* ============================================
     Feature 1 — Smart auto-categorize
     ============================================ */
  let descDebounce;
  el.descInput.addEventListener('input', () => {
    clearTimeout(descDebounce);
    descDebounce = setTimeout(() => {
      if (categoryTouched || !el.descInput.value.trim()) return;
      const guess = guessCategory(el.descInput.value, currentType);
      if (guess) {
        setCategoryValue(guess, { silent: true });
        flashCategoryHint();
      }
    }, 300);
  });

  function flashCategoryHint() {
    el.categoryHint.classList.add('show');
    clearTimeout(flashCategoryHint._t);
    flashCategoryHint._t = setTimeout(() => el.categoryHint.classList.remove('show'), 1800);
  }

  /* ============================================
     Feature 2 — Natural-language quick add
     ============================================ */
  function parseAmount(text) {
    const m = text.match(/(?:₹|rs\.?|inr)?\s?(\d+(?:,\d{2,3})*(?:\.\d{1,2})?)/i);
    if (!m) return { amount: null, rest: text };
    const amount = parseFloat(m[1].replace(/,/g, ''));
    const rest = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim();
    return { amount, rest };
  }

  function parseDate(text) {
    const t = text.toLowerCase();
    const today = new Date();
    const toISO = (d) => d.toISOString().slice(0, 10);
    let date = null, rest = text;

    if (/\byesterday\b/.test(t)) {
      const d = new Date(today); d.setDate(d.getDate() - 1);
      date = toISO(d);
      rest = text.replace(/yesterday/i, '').trim();
    } else if (/\btoday\b/.test(t)) {
      date = toISO(today);
      rest = text.replace(/today/i, '').trim();
    } else {
      const daysAgoMatch = t.match(/(\d+)\s+days?\s+ago/);
      const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
      if (daysAgoMatch) {
        const d = new Date(today); d.setDate(d.getDate() - parseInt(daysAgoMatch[1], 10));
        date = toISO(d);
        rest = text.replace(daysAgoMatch[0], '').trim();
      } else if (isoMatch) {
        date = isoMatch[1];
        rest = text.replace(isoMatch[0], '').trim();
      }
    }
    if (!date) date = toISO(today);
    return { date, rest };
  }

  function parseQuickAdd(raw) {
    const text = raw.trim();
    const { amount, rest: afterAmount } = parseAmount(text);
    const { date, rest: afterDate } = parseDate(afterAmount);
    let description = afterDate.replace(/\s{2,}/g, ' ').replace(/^[-,\s]+|[-,\s]+$/g, '').trim();
    if (!description) description = currentType === 'income' ? 'Income' : 'Expense';
    description = description.charAt(0).toUpperCase() + description.slice(1);
    const category = guessCategory(text, currentType) || 'Other';
    return { amount, date, description, category };
  }

  el.quickAddBtn.addEventListener('click', runQuickAdd);
  el.quickAddInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); runQuickAdd(); }
  });

  function runQuickAdd() {
    const raw = el.quickAddInput.value.trim();
    if (!raw) return;
    const parsed = parseQuickAdd(raw);
    if (!parsed.amount) {
      el.quickAddPreview.hidden = false;
      el.quickAddPreview.innerHTML = `<p class="preview-desc">Couldn't find an amount — try including a number, e.g. "lunch 250".</p>`;
      return;
    }
    pendingQuickAdd = { type: currentType, ...parsed };
    renderQuickAddPreview(pendingQuickAdd);
  }

  function renderQuickAddPreview(p) {
    const color = (CATEGORY_META[p.type] && CATEGORY_META[p.type][p.category]) || '#847a5f';
    const typeColor = p.type === 'income' ? '#3f7d58' : '#a23e2e';
    const dateLabel = new Date(p.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    el.quickAddPreview.hidden = false;
    el.quickAddPreview.innerHTML = `
      <div class="preview-chips">
        <span class="chip-static" style="background:${typeColor}">${p.type}</span>
        <span class="chip-static">${fmt(p.amount)}</span>
        <span class="chip-static" style="background:${color}">${p.category}</span>
        <span class="chip-static">${dateLabel}</span>
      </div>
      <p class="preview-desc">"${escapeHTML(p.description)}"</p>
      <div class="preview-actions">
        <button type="button" id="quickAddConfirm" class="btn-primary btn-small">Add to ledger</button>
        <button type="button" id="quickAddEdit" class="btn-ghost btn-small">Edit manually</button>
      </div>`;
    document.getElementById('quickAddConfirm').addEventListener('click', confirmQuickAdd);
    document.getElementById('quickAddEdit').addEventListener('click', editQuickAdd);
  }

  function confirmQuickAdd() {
    if (!pendingQuickAdd) return;
    transactions.push({
      id: uid(), type: pendingQuickAdd.type, description: pendingQuickAdd.description,
      category: pendingQuickAdd.category, amount: pendingQuickAdd.amount, date: pendingQuickAdd.date
    });
    save();
    el.quickAddInput.value = '';
    el.quickAddPreview.hidden = true;
    pendingQuickAdd = null;
    renderAll();
    pulseReceipt();
  }

  function editQuickAdd() {
    if (!pendingQuickAdd) return;
    el.descInput.value = pendingQuickAdd.description;
    el.amountInput.value = pendingQuickAdd.amount;
    el.dateInput.value = pendingQuickAdd.date;
    setCategoryValue(pendingQuickAdd.category);
    el.quickAddPreview.hidden = true;
    pendingQuickAdd = null;
    el.descInput.focus();
  }

  /* ============================================
     Form submit
     ============================================ */
  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    el.formError.hidden = true;

    const description = el.descInput.value.trim();
    const amount = parseFloat(el.amountInput.value);
    const date = el.dateInput.value || todayISO();
    const category = el.categoryInput.value;

    if (!description) return showError('Give this entry a short description.');
    if (!amount || amount <= 0) return showError('Enter an amount greater than zero.');

    transactions.push({ id: uid(), type: currentType, description, category, amount, date });
    save();

    el.descInput.value = '';
    el.amountInput.value = '';
    categoryTouched = false;
    el.descInput.focus();

    renderAll();
    pulseReceipt();
  });

  function showError(msg) {
    el.formError.textContent = msg;
    el.formError.hidden = false;
  }

  function pulseReceipt() {
    el.receipt.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.015)' }, { transform: 'scale(1)' }],
      { duration: 260, easing: 'ease-out' }
    );
  }

  /* ============================================
     Summary (animated figures)
     ============================================ */
  const prevFigures = { balance: 0, income: 0, expense: 0 };

  function renderSummary() {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;

    animateFigure(el.incomeValue, prevFigures.income, income);
    animateFigure(el.expenseValue, prevFigures.expense, expense);
    animateFigure(el.balanceValue, prevFigures.balance, balance);

    prevFigures.income = income;
    prevFigures.expense = expense;
    prevFigures.balance = balance;

    el.txnCount.textContent = `${transactions.length} ${transactions.length === 1 ? 'entry' : 'entries'} logged`;
  }

  function animateFigure(node, from, to) {
    const duration = 420;
    const start = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = from + (to - from) * eased;
      node.textContent = fmt(value);
      if (p < 1) requestAnimationFrame(tick);
      else node.textContent = fmt(to);
    }
    requestAnimationFrame(tick);
  }

  /* ============================================
     Donut chart (canvas, no libraries)
     ============================================ */
  function renderChart() {
    const ctx = el.chart.getContext('2d');
    const size = el.chart.width;
    const cx = size / 2, cy = size / 2;
    const rOuter = size / 2 - 6;
    const rInner = rOuter * 0.6;

    ctx.clearRect(0, 0, size, size);

    const byCategory = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });

    const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);

    el.chartCenterValue.textContent = fmt(total).replace('.00', '');

    if (total === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, (rOuter + rInner) / 2, 0, Math.PI * 2);
      ctx.lineWidth = rOuter - rInner;
      ctx.strokeStyle = 'rgba(233,227,207,0.10)';
      ctx.stroke();
      el.chartLegend.innerHTML = `<li class="legend-empty">No expenses logged yet</li>`;
      return;
    }

    let start = -Math.PI / 2;
    entries.forEach(([cat, amount]) => {
      const frac = amount / total;
      const end = start + frac * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, (rOuter + rInner) / 2, start, end);
      ctx.lineWidth = rOuter - rInner;
      ctx.strokeStyle = CATEGORY_META.expense[cat] || '#847a5f';
      ctx.lineCap = entries.length > 1 ? 'butt' : 'round';
      ctx.stroke();
      start = end;
    });

    el.chartLegend.innerHTML = entries.map(([cat, amount]) => {
      const pct = Math.round((amount / total) * 100);
      const color = CATEGORY_META.expense[cat] || '#847a5f';
      return `<li>
        <span class="dot" style="background:${color}"></span>
        <span class="legend-label">${cat}</span>
        <span class="legend-pct">${pct}%</span>
      </li>`;
    }).join('');
  }

  /* ============================================
     Filter chips
     ============================================ */
  function renderFilterChips() {
    const usedCategories = [...new Set(transactions.map(t => t.category))];
    const chips = ['all', ...usedCategories];

    el.filterChips.innerHTML = chips.map(c => {
      const label = c === 'all' ? 'All' : c;
      const active = c === activeFilter ? 'active' : '';
      return `<button type="button" class="chip ${active}" data-filter="${c}">${label}</button>`;
    }).join('');

    el.filterChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        activeFilter = chip.dataset.filter;
        renderFilterChips();
        renderList();
      });
    });
  }

  /* ============================================
     Ledger list
     ============================================ */
  function categoryColor(t) {
    return (CATEGORY_META[t.type] && CATEGORY_META[t.type][t.category]) || '#847a5f';
  }

  function renderList() {
    const query = el.searchInput.value.trim().toLowerCase();
    const sortMode = el.sortSelect.value;

    let rows = transactions.filter(t => {
      const matchesFilter = activeFilter === 'all' || t.category === activeFilter;
      const matchesSearch = !query || t.description.toLowerCase().includes(query) || t.category.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });

    rows.sort((a, b) => {
      switch (sortMode) {
        case 'date-asc': return a.date.localeCompare(b.date);
        case 'amount-desc': return b.amount - a.amount;
        case 'amount-asc': return a.amount - b.amount;
        case 'date-desc':
        default: return b.date.localeCompare(a.date);
      }
    });

    el.emptyState.hidden = rows.length !== 0;
    el.ledgerList.innerHTML = rows.map(t => {
      const color = categoryColor(t);
      const sign = t.type === 'income' ? '+' : '−';
      const dateLabel = new Date(t.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      return `
        <div class="ledger-row" data-id="${t.id}">
          <span class="row-date">${dateLabel}</span>
          <div class="row-main">
            <div class="row-desc">${escapeHTML(t.description)}</div>
            <span class="row-tag" style="background:${color}">${t.category}</span>
          </div>
          <span class="row-amount ${t.type}">${sign} ${fmt(t.amount)}</span>
          <button class="row-delete" data-id="${t.id}" aria-label="Delete entry">×</button>
        </div>`;
    }).join('');

    el.ledgerList.querySelectorAll('.row-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
    });
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function deleteTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    save();
    renderAll();
  }

  /* ============================================
     Toolbar events
     ============================================ */
  el.searchInput.addEventListener('input', renderList);

  /* ============================================
     Export / clear
     ============================================ */
  el.exportBtn.addEventListener('click', () => {
    if (transactions.length === 0) return;
    const header = 'Date,Type,Category,Description,Amount\n';
    const rows = transactions
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      // Date is wrapped as ="YYYY-MM-DD" so Excel keeps it as literal text
      // instead of auto-converting to a date serial and showing ##### when
      // the column is too narrow to fit its default date format.
      .map(t => [`="${t.date}"`, t.type, t.category, `"${t.description.replace(/"/g, '""')}"`, t.amount].join(','))
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-export-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  el.clearBtn.addEventListener('click', () => {
    if (transactions.length === 0) return;
    const ok = confirm('Clear every entry in the ledger? This cannot be undone.');
    if (!ok) return;
    transactions = [];
    save();
    renderAll();
  });

  /* ============================================
     Feature 3 — Spending insights
     ============================================ */
  const CATEGORY_TIPS = {
    'Food & Dining': 'Batch-cooking or a weekly grocery run can trim food spend without much sacrifice.',
    'Transport': 'Bundling errands into fewer trips can cut recurring transport costs.',
    'Housing': 'Housing is usually fixed — worth revisiting only around a lease renewal.',
    'Utilities': 'Check for off-peak tariffs or unused subscriptions bundled into utility bills.',
    'Health': 'Recurring health spend is often worth it — but check if any of it is insurable.',
    'Entertainment': 'A monthly cap on entertainment spend keeps it from creeping up unnoticed.',
    'Shopping': 'Try a 24-hour rule before non-essential purchases to curb impulse buys.',
    'Other': 'Uncategorised spending is worth a closer look next time you log an entry.',
  };

  function generateInsights() {
    if (transactions.length === 0) {
      return [`<li class="insights-empty">Add a few entries and this panel will start noticing patterns.</li>`];
    }

    const expenses = transactions.filter(t => t.type === 'expense');
    const incomes = transactions.filter(t => t.type === 'income');
    const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
    const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);
    const insights = [];

    if (expenses.length) {
      const byCat = {};
      expenses.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
      const [topCat, topAmt] = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
      const pct = Math.round((topAmt / totalExpense) * 100);
      insights.push(`<strong>${topCat}</strong> is your biggest expense category — ${pct}% of everything you've spent (${fmt(topAmt)}).`);

      if (CATEGORY_TIPS[topCat]) insights.push(CATEGORY_TIPS[topCat]);

      const largest = expenses.reduce((a, b) => (b.amount > a.amount ? b : a));
      insights.push(`Your largest single expense was <strong>${fmt(largest.amount)}</strong> on "${escapeHTML(largest.description)}".`);
    }

    if (totalIncome > 0) {
      const savingsRate = Math.round(((totalIncome - totalExpense) / totalIncome) * 100);
      insights.push(savingsRate >= 0
        ? `You're saving <strong>${savingsRate}%</strong> of your income so far.`
        : `You've spent <strong>${Math.abs(savingsRate)}%</strong> more than you've earned in this period — worth a closer look.`
      );
    }

    const dates = transactions.map(t => t.date).sort();
    if (dates.length >= 2 && dates[0] !== dates[dates.length - 1]) {
      insights.push(`Entries span from <strong>${formatDateLabel(dates[0])}</strong> to <strong>${formatDateLabel(dates[dates.length - 1])}</strong>.`);
    }

    return insights.slice(0, 4).map(text => `<li>${text}</li>`);
  }

  function formatDateLabel(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function renderInsights() {
    el.insightsList.innerHTML = generateInsights().join('');
  }

  /* ============================================
     Trend chart — running balance over time (canvas)
     ============================================ */
  function themeColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  function renderTrend() {
    const canvas = el.trendChart;
    const ctx = canvas.getContext('2d');
    const cssWidth = canvas.clientWidth || 900;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssWidth * dpr;
    canvas.height = 220 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, 220);

    const byDate = {};
    transactions.forEach(t => {
      byDate[t.date] = (byDate[t.date] || 0) + (t.type === 'income' ? t.amount : -t.amount);
    });
    const dates = Object.keys(byDate).sort();

    if (dates.length < 2) {
      el.trendEmpty.hidden = false;
      el.trendLatest.textContent = '';
      return;
    }
    el.trendEmpty.hidden = true;

    let running = 0;
    const points = dates.map(d => { running += byDate[d]; return { date: d, balance: running }; });

    const padL = 8, padR = 8, padT = 18, padB = 26;
    const w = cssWidth - padL - padR;
    const h = 220 - padT - padB;

    const values = points.map(p => p.balance);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const range = max - min || 1;

    const x = (i) => padL + (i / (points.length - 1)) * w;
    const y = (v) => padT + h - ((v - min) / range) * h;

    const accent = themeColor('--accent') || '#52c9bd';
    const hairline = themeColor('--hairline') || '#6b7893';

    // zero line
    ctx.beginPath();
    ctx.moveTo(padL, y(0));
    ctx.lineTo(padL + w, y(0));
    ctx.strokeStyle = hairline;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // area fill
    ctx.beginPath();
    ctx.moveTo(x(0), y(points[0].balance));
    points.forEach((p, i) => ctx.lineTo(x(i), y(p.balance)));
    ctx.lineTo(x(points.length - 1), y(0));
    ctx.lineTo(x(0), y(0));
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, padT + h);
    grad.addColorStop(0, hexToRgba(accent, 0.28));
    grad.addColorStop(1, hexToRgba(accent, 0.02));
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    ctx.beginPath();
    points.forEach((p, i) => {
      const px = x(i), py = y(p.balance);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // dots
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(x(i), y(p.balance), i === points.length - 1 ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
    });

    // date labels (first / last)
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillStyle = hairline;
    ctx.textAlign = 'left';
    ctx.fillText(formatDateLabel(points[0].date), padL, 220 - 8);
    ctx.textAlign = 'right';
    ctx.fillText(formatDateLabel(points[points.length - 1].date), padL + w, 220 - 8);

    el.trendLatest.textContent = `Balance: ${fmt(points[points.length - 1].balance)}`;
  }

  function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ============================================
     Render orchestration
     ============================================ */
  function renderAll() {
    renderSummary();
    renderChart();
    renderFilterChips();
    renderList();
    renderInsights();
    renderTrend();
  }

  /* ============================================
     Init
     ============================================ */
  function init() {
    initTheme();
    renderGreeting();
    el.dateInput.value = todayISO();
    populateCategorySelect();
    renderAll();
  }

  let resizeDebounce;
  window.addEventListener('resize', () => {
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(renderTrend, 150);
  });

  document.addEventListener('DOMContentLoaded', init);
})();
