/**
 * QRCraft — app.js
 * Full QR code generator logic.
 * Handles: type switching, dynamic fields, validation,
 * QR generation, download, copy, localStorage persistence,
 * color customization, theme, toast notifications.
 */

'use strict';

/* ── STORAGE KEYS ── */
const LS_LAST_QR    = 'qrc_last_qr';
const LS_THEME      = 'qrc_theme';

/* ── QR TYPE FIELD DEFINITIONS ── */
const QR_TYPES = {
  url: {
    label: 'URL',
    fields: [
      {
        id: 'url',
        label: 'Website URL',
        type: 'url',
        placeholder: 'https://example.com',
        hint: 'Include https:// for best results.',
        required: true,
        validate: v => /^https?:\/\/.+\..+/.test(v) ? null : 'Enter a valid URL starting with https:// or http://',
      },
    ],
    encode: data => data.url.trim(),
  },
  phone: {
    label: 'Phone',
    fields: [
      {
        id: 'phone',
        label: 'Phone Number',
        type: 'tel',
        placeholder: '+234 800 000 0000',
        hint: 'Include country code for international use.',
        required: true,
        validate: v => /^\+?[0-9\s\-().]{7,20}$/.test(v) ? null : 'Enter a valid phone number.',
      },
    ],
    encode: data => 'tel:' + data.phone.replace(/\s/g, ''),
  },
  whatsapp: {
    label: 'WhatsApp',
    fields: [
      {
        id: 'waPhone',
        label: 'WhatsApp Number',
        type: 'tel',
        placeholder: '+234 800 000 0000',
        hint: 'International format with country code, e.g. +2348012345678',
        required: true,
        validate: v => /^\+?[0-9\s\-().]{7,20}$/.test(v) ? null : 'Enter a valid phone number with country code.',
      },
      {
        id: 'waMessage',
        label: 'Pre-filled Message (optional)',
        type: 'textarea',
        placeholder: 'Hello, I would like to enquire about your services.',
        hint: 'This message will be pre-filled when the user opens WhatsApp.',
        required: false,
        validate: () => null,
      },
    ],
    encode: data => {
      const num = data.waPhone.replace(/[\s\-().+]/g, '');
      const msg = data.waMessage ? encodeURIComponent(data.waMessage.trim()) : '';
      return 'https://wa.me/' + num + (msg ? '?text=' + msg : '');
    },
  },
  email: {
    label: 'Email',
    fields: [
      {
        id: 'emailAddr',
        label: 'Email Address',
        type: 'email',
        placeholder: 'hello@example.com',
        hint: '',
        required: true,
        validate: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Enter a valid email address.',
      },
      {
        id: 'emailSubject',
        label: 'Subject (optional)',
        type: 'text',
        placeholder: 'Business Enquiry',
        hint: '',
        required: false,
        validate: () => null,
      },
      {
        id: 'emailBody',
        label: 'Body (optional)',
        type: 'textarea',
        placeholder: 'I would like to learn more about your services.',
        hint: '',
        required: false,
        validate: () => null,
      },
    ],
    encode: data => {
      let str = 'mailto:' + data.emailAddr.trim();
      const params = [];
      if (data.emailSubject && data.emailSubject.trim()) params.push('subject=' + encodeURIComponent(data.emailSubject.trim()));
      if (data.emailBody    && data.emailBody.trim())    params.push('body='    + encodeURIComponent(data.emailBody.trim()));
      if (params.length) str += '?' + params.join('&');
      return str;
    },
  },
  text: {
    label: 'Text',
    fields: [
      {
        id: 'plainText',
        label: 'Plain Text',
        type: 'textarea',
        placeholder: 'Enter any text you want to encode into the QR code.',
        hint: 'Maximum 500 characters recommended for reliable scanning.',
        required: true,
        validate: v => v.trim().length > 0 ? null : 'Please enter some text.',
      },
    ],
    encode: data => data.plainText.trim(),
  },
  wifi: {
    label: 'WiFi',
    fields: [
      {
        id: 'wifiSsid',
        label: 'Network Name (SSID)',
        type: 'text',
        placeholder: 'MyWiFiNetwork',
        hint: 'Exact name of the WiFi network.',
        required: true,
        validate: v => v.trim().length > 0 ? null : 'Enter the network name (SSID).',
      },
      {
        id: 'wifiPassword',
        label: 'Password',
        type: 'text',
        placeholder: 'Enter WiFi password',
        hint: 'Leave blank for open networks.',
        required: false,
        validate: () => null,
      },
      {
        id: 'wifiSecurity',
        label: 'Security Type',
        type: 'select',
        options: ['WPA', 'WPA2', 'WEP', 'nopass'],
        optionLabels: ['WPA', 'WPA2', 'WEP', 'None (Open Network)'],
        required: true,
        hint: 'Most modern routers use WPA2.',
        validate: () => null,
      },
    ],
    encode: data => {
      const ssid = data.wifiSsid.trim().replace(/[\\;,"]/g, c => '\\' + c);
      const pass = (data.wifiPassword || '').trim().replace(/[\\;,"]/g, c => '\\' + c);
      const sec  = data.wifiSecurity || 'WPA2';
      return `WIFI:T:${sec};S:${ssid};P:${pass};;`;
    },
  },
};

/* ── STATE ── */
const state = {
  currentType:  'url',
  qrInstance:   null,
  lastEncoded:  '',
  hasQR:        false,
};

/* ── INIT ── */
function init() {
  applyTheme();
  bindNav();
  bindTypeGrid();
  bindColorPickers();
  renderFields('url');
  restoreLastQR();
  bindScrollEvents();
}

/* ── THEME ── */
function applyTheme() {
  const saved = localStorage.getItem(LS_THEME) || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = saved === 'dark' ? 'Light Mode' : 'Dark Mode';
}

function toggleTheme() {
  const cur  = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(LS_THEME, next);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = next === 'dark' ? 'Light Mode' : 'Dark Mode';
}

/* ── NAV ── */
function bindNav() {
  const themeBtn  = document.getElementById('themeToggle');
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');

  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', function () {
      const open = mobileNav.classList.toggle('open');
      this.classList.toggle('open', open);
      this.setAttribute('aria-expanded', String(open));
    });
    // Close mobile nav on link click
    mobileNav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }
}

/* ── TYPE GRID ── */
function bindTypeGrid() {
  const grid = document.getElementById('typeGrid');
  if (!grid) return;
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.type-btn');
    if (!btn) return;
    const type = btn.dataset.type;
    if (!type || type === state.currentType) return;
    // Update active state
    grid.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Update badge
    const badge = document.getElementById('selectedTypeBadge');
    if (badge) badge.textContent = btn.querySelector('.type-icon')?.textContent || type.toUpperCase();
    state.currentType = type;
    renderFields(type);
    clearQR();
  });
}

/* ── RENDER DYNAMIC FIELDS ── */
function renderFields(type) {
  const container = document.getElementById('dynamicFields');
  if (!container) return;
  const def = QR_TYPES[type];
  if (!def) return;

  container.innerHTML = def.fields.map(f => {
    const reqMark = f.required ? ' <span style="color:var(--danger)">*</span>' : '';

    if (f.type === 'textarea') {
      return `
        <div class="fi-group" id="fg_${f.id}">
          <label class="fi-label" for="${f.id}">${f.label}${reqMark}</label>
          <textarea id="${f.id}" class="fi" rows="3"
            placeholder="${esc(f.placeholder || '')}"
            oninput="QRApp.clearError('${f.id}')"
            aria-label="${esc(f.label)}">${''}</textarea>
          ${f.hint ? `<span class="fi-hint">${f.hint}</span>` : ''}
          <span class="fi-error" id="err_${f.id}"></span>
        </div>`;
    }

    if (f.type === 'select') {
      const opts = (f.options || []).map((o, i) =>
        `<option value="${esc(o)}">${esc(f.optionLabels?.[i] || o)}</option>`
      ).join('');
      return `
        <div class="fi-group" id="fg_${f.id}">
          <label class="fi-label" for="${f.id}">${f.label}${reqMark}</label>
          <select id="${f.id}" class="fi" aria-label="${esc(f.label)}">
            ${opts}
          </select>
          ${f.hint ? `<span class="fi-hint">${f.hint}</span>` : ''}
          <span class="fi-error" id="err_${f.id}"></span>
        </div>`;
    }

    return `
      <div class="fi-group" id="fg_${f.id}">
        <label class="fi-label" for="${f.id}">${f.label}${reqMark}</label>
        <input id="${f.id}" class="fi" type="${f.type}"
          placeholder="${esc(f.placeholder || '')}"
          oninput="QRApp.clearError('${f.id}')"
          aria-label="${esc(f.label)}"
          ${f.required ? 'required' : ''}
        />
        ${f.hint ? `<span class="fi-hint">${f.hint}</span>` : ''}
        <span class="fi-error" id="err_${f.id}"></span>
      </div>`;
  }).join('');
}

/* ── COLLECT FIELD VALUES ── */
function collectData(type) {
  const def = QR_TYPES[type];
  const data = {};
  def.fields.forEach(f => {
    const el = document.getElementById(f.id);
    data[f.id] = el ? el.value : '';
  });
  return data;
}

/* ── VALIDATE ── */
function validate(type) {
  const def  = QR_TYPES[type];
  const data = collectData(type);
  let valid  = true;

  def.fields.forEach(f => {
    const val = (data[f.id] || '').trim();
    let err   = null;

    if (f.required && !val) {
      err = 'This field is required.';
    } else if (val && f.validate) {
      err = f.validate(val);
    }

    const errEl = document.getElementById('err_' + f.id);
    const input = document.getElementById(f.id);

    if (err) {
      valid = false;
      if (errEl)  { errEl.textContent = err; errEl.classList.add('show'); }
      if (input)  { input.classList.add('error'); }
    } else {
      if (errEl)  { errEl.classList.remove('show'); }
      if (input)  { input.classList.remove('error'); }
    }
  });

  return valid;
}

/* ── CLEAR ERROR ON INPUT ── */
function clearError(fieldId) {
  const errEl = document.getElementById('err_' + fieldId);
  const input = document.getElementById(fieldId);
  if (errEl) errEl.classList.remove('show');
  if (input) input.classList.remove('error');
}

/* ── GENERATE QR ── */
function generate() {
  if (!validate(state.currentType)) {
    toast('Please fix the errors above before generating.', 'error');
    return;
  }

  const def     = QR_TYPES[state.currentType];
  const data    = collectData(state.currentType);
  const encoded = def.encode(data);
  const fgColor = getColorVal('qrFgColor', '#4f46e5');
  const bgColor = getColorVal('qrBgColor', '#ffffff');
  const size    = parseInt(document.getElementById('qrSize')?.value || '300');

  state.lastEncoded = encoded;

  const output = document.getElementById('qrOutput');
  output.innerHTML = '';

  try {
    state.qrInstance = new QRCode(output, {
      text:         encoded,
      width:        size,
      height:       size,
      colorDark:    fgColor,
      colorLight:   bgColor,
      correctLevel: QRCode.CorrectLevel.M,
    });
  } catch (e) {
    output.innerHTML = '<div class="qr-placeholder"><div class="qr-placeholder-icon">ERR</div><p>Failed to generate QR. The encoded data may be too long.</p></div>';
    toast('QR generation failed. Try shorter input.', 'error');
    return;
  }

  state.hasQR = true;

  // Update UI state
  setButtonsEnabled(true);
  const statusBadge = document.getElementById('qrStatus');
  if (statusBadge) statusBadge.textContent = 'Ready';

  const meta = document.getElementById('qrMeta');
  if (meta) meta.textContent = 'Type: ' + def.label + ' — Size: ' + size + 'px — Click Download to save.';

  // Persist last QR
  try {
    localStorage.setItem(LS_LAST_QR, JSON.stringify({
      type:    state.currentType,
      data:    data,
      encoded: encoded,
      fgColor,
      bgColor,
      size,
    }));
  } catch { /* storage full */ }

  toast('QR code generated successfully.', 'success');
}

/* ── RESTORE LAST QR ── */
function restoreLastQR() {
  try {
    const raw = localStorage.getItem(LS_LAST_QR);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || !saved.type || !QR_TYPES[saved.type]) return;

    // Restore type
    state.currentType = saved.type;
    const typeGrid = document.getElementById('typeGrid');
    if (typeGrid) {
      typeGrid.querySelectorAll('.type-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.type === saved.type);
      });
    }
    const badge = document.getElementById('selectedTypeBadge');
    if (badge) badge.textContent = QR_TYPES[saved.type].label.toUpperCase();

    // Restore fields
    renderFields(saved.type);

    // Restore field values
    if (saved.data) {
      setTimeout(() => {
        Object.entries(saved.data).forEach(([id, val]) => {
          const el = document.getElementById(id);
          if (el) el.value = val;
        });
        // Restore colors
        if (saved.fgColor) setColorInputs('qrFgColor', 'qrFgColorPicker', saved.fgColor);
        if (saved.bgColor) setColorInputs('qrBgColor', 'qrBgColorPicker', saved.bgColor);
        if (saved.size) {
          const sizeEl = document.getElementById('qrSize');
          if (sizeEl) sizeEl.value = String(saved.size);
        }
        // Regenerate
        generate();
      }, 80);
    }
  } catch { /* ignore corrupt storage */ }
}

/* ── DOWNLOAD ── */
function download() {
  if (!state.hasQR) return;
  const output = document.getElementById('qrOutput');
  const canvas = output.querySelector('canvas');
  const img    = output.querySelector('img');

  let dataUrl;
  if (canvas) {
    dataUrl = canvas.toDataURL('image/png');
  } else if (img) {
    dataUrl = img.src;
  } else {
    toast('QR code not ready for download.', 'error');
    return;
  }

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'qrcode-' + state.currentType + '-' + Date.now() + '.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('QR code downloaded as PNG.', 'success');
}

/* ── COPY DATA ── */
function copyData() {
  if (!state.lastEncoded) return;
  navigator.clipboard.writeText(state.lastEncoded)
    .then(() => toast('Encoded data copied to clipboard.', 'success'))
    .catch(() => {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = state.lastEncoded;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Encoded data copied to clipboard.', 'success');
    });
}

/* ── CLEAR ── */
function clearQR() {
  const output = document.getElementById('qrOutput');
  if (output) {
    output.innerHTML = `
      <div class="qr-placeholder">
        <div class="qr-placeholder-icon">QR</div>
        <p>Your QR code will appear here after you click Generate.</p>
      </div>`;
  }
  state.qrInstance = null;
  state.lastEncoded = '';
  state.hasQR = false;
  setButtonsEnabled(false);
  const statusBadge = document.getElementById('qrStatus');
  if (statusBadge) statusBadge.textContent = 'Waiting';
  const meta = document.getElementById('qrMeta');
  if (meta) meta.textContent = 'Fill in your details and click Generate to create your QR code.';
}

function clear() {
  clearQR();
  renderFields(state.currentType);
  localStorage.removeItem(LS_LAST_QR);
  toast('QR code cleared.', 'success');
}

/* ── BUTTON STATE ── */
function setButtonsEnabled(enabled) {
  ['downloadBtn', 'copyBtn', 'clearBtn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !enabled;
  });
}

/* ── COLOR PICKERS ── */
function bindColorPickers() {
  bindColorPair('qrFgColorPicker', 'qrFgColor');
  bindColorPair('qrBgColorPicker', 'qrBgColor');
}

function bindColorPair(pickerId, textId) {
  const picker = document.getElementById(pickerId);
  const text   = document.getElementById(textId);
  if (!picker || !text) return;

  picker.addEventListener('input', () => {
    text.value = picker.value;
  });
  text.addEventListener('input', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(text.value)) {
      picker.value = text.value;
    }
  });
}

function setColorInputs(textId, pickerId, val) {
  const text   = document.getElementById(textId);
  const picker = document.getElementById(pickerId);
  if (text)   text.value   = val;
  if (picker) picker.value = val;
}

function getColorVal(textId, fallback) {
  const el = document.getElementById(textId);
  const v  = el ? el.value.trim() : '';
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

/* ── SCROLL ── */
function bindScrollEvents() {
  window.addEventListener('scroll', () => {
    const btt = document.getElementById('btt');
    if (btt) btt.classList.toggle('vis', window.scrollY > 400);
    // Active nav link
    const sections = ['generator','how-it-works','features','reviews'];
    let active = '';
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= 80) active = id;
    });
    document.querySelectorAll('.nav-links a').forEach(a => {
      const href = a.getAttribute('href');
      a.classList.toggle('active', href === '#' + active || (active === 'generator' && href === '#generator'));
    });
  }, { passive: true });
}

/* ── TOAST ── */
function toast(msg, type = 'success') {
  const region = document.getElementById('toastRegion');
  if (!region) return;
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<span class="toast-dot"></span><span>${msg}</span>`;
  region.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 350);
  }, 3500);
}

/* ── UTILITY ── */
function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── PUBLIC API ── */
window.QRApp = {
  generate,
  download,
  copyData,
  clear,
  clearError,
};

document.addEventListener('DOMContentLoaded', init);