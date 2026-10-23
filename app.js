/* ===== QuickInvoice – free invoice generator. Vanilla JS, everything stays in the browser. ===== */
(function () {
  'use strict';

  const C = window.APP_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  const LS = { state: 'qi_state', history: 'qi_history' };
  const FREE_HISTORY_LIMIT = 3;
  const DEFAULT_ACCENT = '#2563eb';
  const TEMPLATES = ['classic', 'modern', 'minimal'];
  const FREE_TEMPLATES = ['classic'];
  const CURRENCY_LOCALE = {
    USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', CAD: 'en-CA', AUD: 'en-AU',
    MXN: 'es-MX', BRL: 'pt-BR', ARS: 'es-AR', INR: 'en-IN', JPY: 'ja-JP'
  };

  // ---------- helpers ----------
  const pad2 = (n) => String(n).padStart(2, '0');
  function toISO(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayISO() { return toISO(new Date()); }
  function addDaysISO(iso, days) {
    const [y, m, d] = (iso || todayISO()).split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    return toISO(dt);
  }
  function fmtDate(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function num(v) { const n = parseFloat(v); return isFinite(n) ? n : 0; }
  function clampPos(n) { return n < 0 ? 0 : n; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const fmtCache = {};
  function money(amount, currency) {
    currency = currency || 'USD';
    if (!fmtCache[currency]) {
      try {
        fmtCache[currency] = new Intl.NumberFormat(CURRENCY_LOCALE[currency] || 'en-US', { style: 'currency', currency });
      } catch (e) {
        fmtCache[currency] = { format: (n) => currency + ' ' + n.toFixed(2) };
      }
    }
    return fmtCache[currency].format(amount);
  }
  function pct(n) { return (Math.round(n * 100) / 100).toString() + '%'; }
  function nextNumber(current) {
    const m = String(current || '').match(/^(.*?)(\d+)$/);
    if (!m) return (current ? current + '-' : 'INV-') + '0001';
    const width = m[2].length;
    return m[1] + String(parseInt(m[2], 10) + 1).padStart(width, '0');
  }
  function lsGet(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { toast('Could not save – browser storage is full. Try a smaller logo.'); return false; }
  }
  function debounce(fn, ms) { let t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function templateAllowed(t) { return isPro() || FREE_TEMPLATES.includes(t); }

  // ---------- state ----------
  function sampleState() {
    const today = todayISO();
    return {
      biz: {
        name: 'Northwind Design Studio',
        email: 'hello@northwinddesign.co',
        address: '412 Market Street, Suite 300\nSan Francisco, CA 94105\nTax ID: 94-1234567',
        logo: ''
      },
      client: {
        name: 'Acme Robotics Inc.',
        email: 'accounts@acmerobotics.com',
        address: '88 Innovation Way\nAustin, TX 78701'
      },
      number: 'INV-0001',
      issueDate: today,
      dueDate: addDaysISO(today, 14),
      currency: 'USD',
      items: [
        { desc: 'Website redesign – homepage and 4 inner pages', qty: 1, price: 2400 },
        { desc: 'Logo refresh and brand guidelines PDF', qty: 1, price: 850 },
        { desc: 'Hosting setup and deployment (hours)', qty: 2, price: 95 }
      ],
      taxRate: 8.5,
      discountType: 'percent',
      discountValue: 5,
      shipping: 0,
      notes: 'Payment due within 14 days by bank transfer or PayPal.\nBank: First Bay Bank · Account 0012 3456 789 · Routing 121000358\nThank you for your business!',
      accent: DEFAULT_ACCENT,
      template: 'classic'
    };
  }
  function blankItem() { return { desc: '', qty: 1, price: 0 }; }
  function normalize(s) {
    const base = sampleState();
    s = s && typeof s === 'object' ? s : {};
    const out = {
      biz: Object.assign({ name: '', email: '', address: '', logo: '' }, s.biz || {}),
      client: Object.assign({ name: '', email: '', address: '' }, s.client || {}),
      number: s.number || base.number,
      issueDate: s.issueDate || base.issueDate,
      dueDate: s.dueDate || base.dueDate,
      currency: CURRENCY_LOCALE[s.currency] ? s.currency : 'USD',
      items: Array.isArray(s.items) && s.items.length ? s.items.map(i => ({ desc: String(i.desc || ''), qty: num(i.qty), price: num(i.price) })) : [blankItem()],
      taxRate: num(s.taxRate), discountType: s.discountType === 'fixed' ? 'fixed' : 'percent',
      discountValue: num(s.discountValue), shipping: num(s.shipping),
      notes: String(s.notes || ''),
      accent: /^#[0-9a-f]{6}$/i.test(s.accent || '') ? s.accent : DEFAULT_ACCENT,
      template: TEMPLATES.includes(s.template) ? s.template : 'classic'
    };
    if (!templateAllowed(out.template)) out.template = 'classic';
    return out;
  }

  let state = normalize(lsGet(LS.state, null) || sampleState());
  let history = lsGet(LS.history, []);
  if (!Array.isArray(history)) history = [];

  const saveState = debounce(() => lsSet(LS.state, state), 350);

  // ---------- totals ----------
  function compute(s) {
    const subtotal = s.items.reduce((sum, it) => sum + clampPos(num(it.qty)) * clampPos(num(it.price)), 0);
    let discount = s.discountType === 'percent' ? subtotal * clampPos(num(s.discountValue)) / 100 : clampPos(num(s.discountValue));
    if (discount > subtotal) discount = subtotal;
    const taxable = subtotal - discount;
    const tax = taxable * clampPos(num(s.taxRate)) / 100;
    const shipping = clampPos(num(s.shipping));
    const total = taxable + tax + shipping;
    return { subtotal, discount, taxable, tax, shipping, total };
  }

  // ---------- form <-> state ----------
  const F = {};
  ['bizName', 'bizEmail', 'bizAddress', 'bizLogo', 'logoThumb', 'removeLogo',
    'clientName', 'clientEmail', 'clientAddress',
    'invoiceNumber', 'issueDate', 'dueDate', 'currency',
    'itemsBody', 'addItem', 'taxRate', 'discountType', 'discountValue', 'shipping', 'notes',
    'accentColor', 'resetAccent', 'invoicePreview',
    'btnNew', 'btnDownload', 'btnPrint', 'btnCopy', 'btnSave',
    'historyList', 'historyCount', 'historyLimit', 'historyEmpty'
  ].forEach(id => { F[id] = $(id); });

  function itemRow(it, idx) {
    const tr = document.createElement('tr');
    tr.dataset.idx = idx;
    tr.innerHTML =
      '<td><input type="text" class="it-desc" placeholder="Describe the product or service" aria-label="Item ' + (idx + 1) + ' description" value="' + esc(it.desc) + '"></td>' +
      '<td><input type="number" class="it-qty" min="0" step="any" inputmode="decimal" aria-label="Item ' + (idx + 1) + ' quantity" value="' + esc(it.qty) + '"></td>' +
      '<td><input type="number" class="it-price" min="0" step="0.01" inputmode="decimal" aria-label="Item ' + (idx + 1) + ' unit price" value="' + esc(it.price) + '"></td>' +
      '<td class="num it-amount">' + esc(money(clampPos(num(it.qty)) * clampPos(num(it.price)), state.currency)) + '</td>' +
      '<td><button type="button" class="btn btn-sm btn-danger it-del" aria-label="Remove item ' + (idx + 1) + '" title="Remove item">✕</button></td>';
    return tr;
  }
  function renderItems() {
    F.itemsBody.innerHTML = '';
    state.items.forEach((it, i) => F.itemsBody.appendChild(itemRow(it, i)));
    updateRemoveButtons();
  }
  function updateRemoveButtons() {
    const single = state.items.length <= 1;
    F.itemsBody.querySelectorAll('.it-del').forEach(b => { b.disabled = single; });
  }
  function updateAmounts() {
    F.itemsBody.querySelectorAll('tr').forEach((tr, i) => {
      const it = state.items[i]; if (!it) return;
      tr.querySelector('.it-amount').textContent = money(clampPos(num(it.qty)) * clampPos(num(it.price)), state.currency);
    });
  }

  function writeForm() {
    F.bizName.value = state.biz.name; F.bizEmail.value = state.biz.email; F.bizAddress.value = state.biz.address;
    F.clientName.value = state.client.name; F.clientEmail.value = state.client.email; F.clientAddress.value = state.client.address;
    F.invoiceNumber.value = state.number; F.issueDate.value = state.issueDate; F.dueDate.value = state.dueDate;
    F.currency.value = state.currency;
    F.taxRate.value = state.taxRate || ''; F.discountType.value = state.discountType;
    F.discountValue.value = state.discountValue || ''; F.shipping.value = state.shipping || '';
    F.notes.value = state.notes; F.accentColor.value = state.accent;
    renderItems(); renderLogoThumb(); renderTemplateButtons();
  }

  function readForm() {
    state.biz.name = F.bizName.value; state.biz.email = F.bizEmail.value; state.biz.address = F.bizAddress.value;
    state.client.name = F.clientName.value; state.client.email = F.clientEmail.value; state.client.address = F.clientAddress.value;
    state.number = F.invoiceNumber.value.trim(); state.issueDate = F.issueDate.value; state.dueDate = F.dueDate.value;
    state.currency = F.currency.value;
    state.taxRate = num(F.taxRate.value); state.discountType = F.discountType.value;
    state.discountValue = num(F.discountValue.value); state.shipping = num(F.shipping.value);
    state.notes = F.notes.value; state.accent = F.accentColor.value || DEFAULT_ACCENT;
    state.items = Array.from(F.itemsBody.querySelectorAll('tr')).map(tr => ({
      desc: tr.querySelector('.it-desc').value,
      qty: num(tr.querySelector('.it-qty').value),
      price: num(tr.querySelector('.it-price').value)
    }));
    if (!state.items.length) state.items = [blankItem()];
  }

  // ---------- logo ----------
  function renderLogoThumb() {
    if (state.biz.logo) {
      F.logoThumb.innerHTML = '<img alt="Your logo" src="' + state.biz.logo + '">';
      F.removeLogo.classList.remove('hidden');
    } else {
      F.logoThumb.innerHTML = '<span class="hint">No logo</span>';
      F.removeLogo.classList.add('hidden');
    }
  }
  function handleLogoFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('Please choose an image file (PNG, JPG, SVG, WebP).'); return; }
    if (file.size > 4 * 1024 * 1024) { toast('Logo is too large (max 4 MB).'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (file.type === 'image/svg+xml') { setLogo(dataUrl); return; }
      // Downscale raster logos so they fit comfortably in localStorage.
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX || h > MAX) { const r = Math.min(MAX / w, MAX / h); w = Math.round(w * r); h = Math.round(h * r); }
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        try { setLogo(canvas.toDataURL('image/png')); } catch (e) { setLogo(dataUrl); }
      };
      img.onerror = () => setLogo(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = () => toast('Could not read that file.');
    reader.readAsDataURL(file);
  }
  function setLogo(dataUrl) {
    state.biz.logo = dataUrl;
    renderLogoThumb(); renderPreview(); saveState();
    toast('Logo added');
  }

  // ---------- preview ----------
  function renderPreview() {
    const s = state, t = compute(s), cur = s.currency;
    const root = F.invoicePreview;
    root.className = 'invoice-preview tpl-' + s.template;
    root.style.setProperty('--inv-accent', s.accent);

    const rows = s.items.length && s.items.some(i => i.desc || i.qty || i.price)
      ? s.items.map(it => {
        const q = clampPos(num(it.qty)), p = clampPos(num(it.price));
        return '<tr><td>' + (esc(it.desc) || '<span class="it-empty">Untitled item</span>') + '</td>' +
          '<td class="num">' + esc(q) + '</td>' +
          '<td class="num">' + esc(money(p, cur)) + '</td>' +
          '<td class="num">' + esc(money(q * p, cur)) + '</td></tr>';
      }).join('')
      : '<tr><td colspan="4" class="it-empty">Add a line item to get started</td></tr>';

    const discountLabel = s.discountType === 'percent' ? 'Discount (' + pct(num(s.discountValue)) + ')' : 'Discount';
    const totals =
      '<div class="t-row"><span>Subtotal</span><span>' + esc(money(t.subtotal, cur)) + '</span></div>' +
      (t.discount > 0 ? '<div class="t-row"><span>' + esc(discountLabel) + '</span><span>−' + esc(money(t.discount, cur)) + '</span></div>' : '') +
      (num(s.taxRate) > 0 ? '<div class="t-row"><span>Tax (' + esc(pct(num(s.taxRate))) + ')</span><span>' + esc(money(t.tax, cur)) + '</span></div>' : '') +
      (t.shipping > 0 ? '<div class="t-row"><span>Shipping</span><span>' + esc(money(t.shipping, cur)) + '</span></div>' : '') +
      '<div class="t-row t-total"><span>Total due</span><span>' + esc(money(t.total, cur)) + '</span></div>';

    root.innerHTML =
      '<div class="inv-bar"></div>' +
      '<header class="inv-head">' +
        '<div class="inv-biz">' +
          (s.biz.logo ? '<img class="inv-logo" alt="" src="' + s.biz.logo + '">' : '') +
          '<div class="inv-biz-name">' + (esc(s.biz.name) || 'Your business name') + '</div>' +
          '<div class="inv-biz-meta">' + esc([s.biz.email, s.biz.address].filter(Boolean).join('\n')) + '</div>' +
        '</div>' +
        '<div class="inv-title"><h2>INVOICE</h2><div class="inv-number">' + (esc(s.number) || '—') + '</div></div>' +
      '</header>' +
      '<section class="inv-meta">' +
        '<div class="inv-billto"><span class="inv-label">Bill to</span>' +
          '<div class="inv-client-name">' + (esc(s.client.name) || 'Client name') + '</div>' +
          '<div class="inv-client-meta">' + esc([s.client.email, s.client.address].filter(Boolean).join('\n')) + '</div>' +
        '</div>' +
        '<div class="inv-dates">' +
          '<span class="inv-label">Issue date</span><span>' + esc(fmtDate(s.issueDate)) + '</span>' +
          '<span class="inv-label">Due date</span><span>' + esc(fmtDate(s.dueDate)) + '</span>' +
          '<span class="inv-label">Currency</span><span>' + esc(cur) + '</span>' +
        '</div>' +
      '</section>' +
      '<table class="inv-items"><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<section class="inv-bottom">' +
        '<div class="inv-notes">' + (s.notes.trim() ? '<span class="inv-label">Notes / payment terms</span><p>' + esc(s.notes) + '</p>' : '') + '</div>' +
        '<div class="inv-totals">' + totals + '</div>' +
      '</section>' +
      '<footer class="inv-footer">' +
        '<span class="inv-thanks">Thank you for your business.</span>' +
        (isPro() ? '' : '<span class="inv-brand">Generated with QuickInvoice – free invoice generator</span>') +
      '</footer>';
  }

  // ---------- templates ----------
  function renderTemplateButtons() {
    document.querySelectorAll('.tpl-btn').forEach(b => {
      const t = b.dataset.template;
      b.classList.toggle('active', t === state.template);
      b.setAttribute('aria-pressed', t === state.template ? 'true' : 'false');
      const lock = b.querySelector('.lock');
      if (lock) lock.classList.toggle('hidden', templateAllowed(t));
    });
  }
  function selectTemplate(t) {
    if (!TEMPLATES.includes(t)) return;
    if (!templateAllowed(t)) { openPro('template'); toast('Modern and Minimal templates are part of Pro'); return; }
    state.template = t;
    renderTemplateButtons(); renderPreview(); saveState();
    track('template_change', { template: t });
  }

  // ---------- history ----------
  function saveHistory() { lsSet(LS.history, history); }
  function renderHistory() {
    F.historyList.innerHTML = '';
    history.forEach(h => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML =
        '<button type="button" class="load" data-id="' + esc(h.id) + '" title="Load this invoice">' +
          '<span class="h-num">' + esc(h.number || '—') + '</span>' +
          '<span class="h-client">' + (esc(h.client) || '<em>No client</em>') + '</span>' +
          '<span class="h-total">' + esc(h.total) + '</span>' +
          '<span class="h-date">Issued ' + esc(fmtDate(h.date)) + ' · saved ' + esc(new Date(h.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) + '</span>' +
        '</button>' +
        '<button type="button" class="btn btn-sm btn-danger del" data-id="' + esc(h.id) + '" aria-label="Delete saved invoice ' + esc(h.number) + '" title="Delete">✕</button>';
      F.historyList.appendChild(li);
    });
    F.historyCount.textContent = history.length;
    F.historyEmpty.style.display = history.length ? 'none' : 'block';
    F.historyLimit.textContent = isPro() ? 'Unlimited · Pro' : history.length + ' of ' + FREE_HISTORY_LIMIT + ' free slots used';
  }
  function saveInvoice() {
    readForm();
    const t = compute(state);
    const existingIdx = history.findIndex(h => h.number && h.number === state.number);
    if (existingIdx === -1 && !isPro() && history.length >= FREE_HISTORY_LIMIT) {
      openPro('history');
      toast('Free plan keeps ' + FREE_HISTORY_LIMIT + ' saved invoices. Go Pro for unlimited.');
      return;
    }
    const entry = {
      id: existingIdx > -1 ? history[existingIdx].id : 'inv_' + Date.now().toString(36),
      number: state.number, client: state.client.name, total: money(t.total, state.currency),
      date: state.issueDate, savedAt: Date.now(),
      state: JSON.parse(JSON.stringify(state))
    };
    if (existingIdx > -1) { history.splice(existingIdx, 1); history.unshift(entry); toast('Invoice ' + state.number + ' updated'); }
    else { history.unshift(entry); toast('Invoice ' + state.number + ' saved'); }
    if (saveHistory()) { renderHistory(); track('save_invoice', { count: history.length }); }
  }
  function loadInvoice(id) {
    const h = history.find(x => x.id === id); if (!h) return;
    state = normalize(h.state);
    writeForm(); renderPreview(); saveState();
    toast('Loaded ' + h.number);
    F.invoiceNumber.focus({ preventScroll: true });
    document.querySelector('.tool-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function deleteInvoice(id) {
    const idx = history.findIndex(x => x.id === id); if (idx === -1) return;
    const removed = history.splice(idx, 1)[0];
    saveHistory(); renderHistory();
    toast('Deleted ' + (removed.number || 'invoice'));
  }

  // ---------- actions ----------
  function newInvoice() {
    readForm();
    let n = nextNumber(state.number);
    let guard = 0;
    while (history.some(h => h.number === n) && guard++ < 1000) n = nextNumber(n);
    const today = todayISO();
    state = normalize({
      biz: state.biz, client: { name: '', email: '', address: '' },
      number: n, issueDate: today, dueDate: addDaysISO(today, 14), currency: state.currency,
      items: [blankItem()], taxRate: state.taxRate, discountType: 'percent', discountValue: 0, shipping: 0,
      notes: state.notes, accent: state.accent, template: state.template
    });
    writeForm(); renderPreview(); saveState();
    track('generate', { number: n });
    toast('New invoice ' + n);
    F.clientName.focus({ preventScroll: true });
  }
  function downloadPDF(source) {
    readForm(); renderPreview();
    track(source === 'print' ? 'print' : 'download', { template: state.template, currency: state.currency });
    if (source !== 'print') toast('Choose "Save as PDF" in the print dialog');
    setTimeout(() => window.print(), 60);
  }
  function shareText() {
    const s = state, t = compute(s), cur = s.currency;
    const lines = [];
    lines.push('Invoice ' + s.number + (s.biz.name ? ' from ' + s.biz.name : ''));
    if (s.client.name) lines.push('Bill to: ' + s.client.name);
    lines.push('Issued: ' + fmtDate(s.issueDate) + ' · Due: ' + fmtDate(s.dueDate));
    lines.push('');
    s.items.forEach(it => {
      const q = clampPos(num(it.qty)), p = clampPos(num(it.price));
      lines.push((it.desc || 'Item') + ' — ' + q + ' × ' + money(p, cur) + ' = ' + money(q * p, cur));
    });
    lines.push('');
    lines.push('Subtotal: ' + money(t.subtotal, cur));
    if (t.discount > 0) lines.push('Discount: -' + money(t.discount, cur));
    if (num(s.taxRate) > 0) lines.push('Tax (' + pct(num(s.taxRate)) + '): ' + money(t.tax, cur));
    if (t.shipping > 0) lines.push('Shipping: ' + money(t.shipping, cur));
    lines.push('TOTAL DUE: ' + money(t.total, cur));
    if (s.notes.trim()) { lines.push(''); lines.push(s.notes.trim()); }
    return lines.join('\n');
  }
  function copyShare() {
    readForm();
    const text = shareText();
    const done = () => { toast('Invoice summary copied'); track('copy', {}); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed – select the text manually'); }
    document.body.removeChild(ta);
  }

  // ---------- pro / UI refresh ----------
  function refreshUI() {
    if (!templateAllowed(state.template)) state.template = 'classic';
    renderTemplateButtons(); renderPreview(); renderHistory();
  }
  function setProPrice() {
    const price = C.PRO_PRICE || '$12';
    const el = $('proPrice'); if (el) el.textContent = price;
    document.querySelectorAll('[data-pro-price]').forEach(e => { e.textContent = price; });
  }

  // ---------- wiring ----------
  function onFormInput() { readForm(); updateAmounts(); renderPreview(); saveState(); }

  const formCard = document.querySelector('.tool-card');
  formCard.addEventListener('input', (e) => {
    if (e.target === F.bizLogo) return;
    if (e.target === F.currency) { renderItems(); }
    onFormInput();
  });
  formCard.addEventListener('change', (e) => {
    if (e.target === F.bizLogo) { handleLogoFile(e.target.files && e.target.files[0]); e.target.value = ''; return; }
    if (e.target === F.issueDate && F.issueDate.value && (!F.dueDate.value || F.dueDate.value < F.issueDate.value)) {
      F.dueDate.value = addDaysISO(F.issueDate.value, 14);
    }
    onFormInput();
  });

  F.itemsBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.it-del'); if (!btn) return;
    readForm();
    const idx = Number(btn.closest('tr').dataset.idx);
    if (state.items.length <= 1) return;
    state.items.splice(idx, 1);
    renderItems(); renderPreview(); saveState();
  });
  F.itemsBody.addEventListener('keydown', (e) => {
    // Enter on the last price field adds a new row – fast data entry.
    if (e.key === 'Enter' && e.target.classList.contains('it-price')) {
      const tr = e.target.closest('tr');
      if (tr === F.itemsBody.lastElementChild) { e.preventDefault(); addItem(); }
    }
  });
  function addItem() {
    readForm(); state.items.push(blankItem());
    renderItems(); renderPreview(); saveState();
    const last = F.itemsBody.lastElementChild;
    if (last) last.querySelector('.it-desc').focus({ preventScroll: true });
  }
  F.addItem.addEventListener('click', addItem);
  F.removeLogo.addEventListener('click', () => { state.biz.logo = ''; renderLogoThumb(); renderPreview(); saveState(); toast('Logo removed'); });
  F.resetAccent.addEventListener('click', () => { F.accentColor.value = DEFAULT_ACCENT; onFormInput(); });

  document.querySelectorAll('.tpl-btn').forEach(b => b.addEventListener('click', () => selectTemplate(b.dataset.template)));

  F.btnNew.addEventListener('click', newInvoice);
  F.btnDownload.addEventListener('click', () => downloadPDF('download'));
  F.btnPrint.addEventListener('click', () => downloadPDF('print'));
  F.btnCopy.addEventListener('click', copyShare);
  F.btnSave.addEventListener('click', saveInvoice);

  F.historyList.addEventListener('click', (e) => {
    const load = e.target.closest('.load'); if (load) { loadInvoice(load.dataset.id); return; }
    const del = e.target.closest('.del'); if (del) { deleteInvoice(del.dataset.id); }
  });

  // Ctrl/Cmd + P prints the invoice preview (same as Download PDF).
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); downloadPDF('print'); }
  });
  window.addEventListener('beforeprint', () => { readForm(); renderPreview(); });

  document.addEventListener('pro:changed', refreshUI);

  // ---------- init ----------
  setProPrice();
  writeForm();
  renderPreview();
  renderHistory();
  if (!localStorage.getItem(LS.state)) lsSet(LS.state, state); // first visit: persist sample so the number sequence is stable
})();
