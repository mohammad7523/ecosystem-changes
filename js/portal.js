/* أدوات مشتركة لصفحات الحساب ولوحة المعلم والإدارة. لا تُخزَّن كلمات المرور في أي مكان. */
window.P = (() => {
  'use strict';
  const C = window.CONTENT, API = window.EcoApi;
  const ar = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const fill = (t, v) => String(t).replace(/\{(\w+)\}/g, (_, k) => (k in v ? (typeof v[k] === 'number' ? ar(v[k]) : String(v[k])) : ''));
  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'hidden') e.hidden = !!v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    const add = x => { if (x === null || x === undefined || x === false) return; if (Array.isArray(x)) x.forEach(add); else e.append(x instanceof Node ? x : document.createTextNode(String(x))); };
    kids.forEach(add);
    return e;
  }
  const main = () => document.getElementById('main');
  const say = t => { const l = document.getElementById('live'); l.textContent = ''; setTimeout(() => { l.textContent = t; }, 30); };
  const date = iso => { if (!iso) return ''; try { return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)); } catch (e) { return iso; } };
  const errText = e => {
    const E = C.accounts.errors, c = (e && e.code) || 'generic';
    if (E[c]) return E[c];
    if (/already|registered|exists/i.test(c)) return E.user_already_exists;
    if (/invalid.*(grant|login|credentials)/i.test(c)) return E.invalid_grant;
    if (/rate|too many|429/i.test(c) || (e && e.status === 429)) return E.too_many;
    if (/consent/.test(c)) return C.accounts.consentNeeded;
    return E.generic;
  };
  const msg = (box, text, kind = 'err') => { box.textContent = text; box.className = 'p-msg ' + kind; box.hidden = !text; if (text) say(text); };
  const field = (id, label, input, hint) => el('div', { class: 'p-field' }, el('label', { for: id, text: label }), input, hint ? el('p', { class: 'small', id: id + '-h', text: hint }) : null);
  const input = (id, type = 'text', extra = {}) => el('input', Object.assign({ id, name: id, type, dir: type === 'text' || type === 'password' ? 'ltr' : null, autocapitalize: 'none', spellcheck: 'false' }, extra));
  // تأكيد داخل الصفحة بدل نوافذ المتصفح
  function confirmInline(host, question, yesText, onYes) {
    const box = el('div', { class: 'p-confirm', role: 'alertdialog', 'aria-label': question }, el('p', { text: question }));
    const no = el('button', { type: 'button', class: 'btn', text: C.accounts.no, onclick: () => box.remove() });
    const yes = el('button', { type: 'button', class: 'btn danger', text: yesText, onclick: async () => { yes.disabled = true; try { await onYes(); } finally { box.remove(); } } });
    box.append(el('div', { class: 'p-row' }, yes, no));
    host.append(box); no.focus();
  }
  async function busy(btn, fn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); try { return await fn(); } finally { btn.disabled = false; btn.removeAttribute('aria-busy'); } }
  function card(title, ...kids) { return el('section', { class: 'p-card' }, el('h2', { text: title }), ...kids); }
  async function me() { if (!API.enabled || !API.signedIn()) return null; try { return await API.rpc('rpc_me'); } catch (e) { if (e.status === 401 || e.code === 'session_expired') API.forget(); return null; } }
  function disabledPage() { main().replaceChildren(card(C.accounts.open, el('p', { text: C.accounts.disabled }), el('a', { class: 'btn primary', href: 'index.html', text: C.accounts.backToLesson }))); }
  function supportLink() {
    const CFG = window.ECO_CONFIG || {}, S = C.support;
    if (!CFG.supportEmail || !CFG.supportEmailConfirmed) return el('p', { class: 'small', text: S.off });
    const ref = 'ECO-' + Array.from(crypto.getRandomValues(new Uint8Array(6)), x => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');
    const f = t => t.replace('{ref}', ref);
    return el('div', {}, el('p', { class: 'small warn', text: S.warn }),
      el('a', { class: 'btn', href: 'mailto:' + CFG.supportEmail + '?subject=' + encodeURIComponent(f(S.subject)) + '&body=' + encodeURIComponent(f(S.body)), text: S.link + ' (' + ref + ')' }),
      el('p', { class: 'small' }, el('span', { text: S.address.replace('{e}', '') }), el('span', { class: 'email', dir: 'ltr', text: CFG.supportEmail })),
      el('p', { class: 'small', text: S.time }), el('p', { class: 'small', text: f(S.follow) }), el('p', { class: 'small' }, el('a', { href: 'support.html', text: S.selfHelp })));
  }
  return { C, API, ar, fill, el, main, say, date, errText, msg, field, input, confirmInline, busy, card, me, disabledPage, supportLink };
})();
