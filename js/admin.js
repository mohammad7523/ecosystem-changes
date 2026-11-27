/* الإدارة: اعتماد المعلمين، وتقارير أداء التطبيق المجمّعة المجهولة. لا تعرض أي بيانات طالب بعينه. */
(() => {
  'use strict';
  const { C, API, el, main, fill, ar, date, errText, card, say } = window.P;
  const M = C.admin, A = C.accounts;
  document.title = M.pageTitle;
  if (!API.enabled) { window.P.disabledPage(); return; }

  async function start() {
    const me = await window.P.me();
    if (!me || me.role !== 'admin') { main().replaceChildren(card(M.notAdmin, el('a', { class: 'btn', href: 'account.html', text: A.open }))); return; }
    main().replaceChildren(await requestsCard(), await feedbackCard(), await improvementsCard(), await reportCard(30));
  }
  async function requestsCard() {
    let list = []; try { list = await API.rpc('rpc_admin_teacher_requests'); } catch (e) { return card(M.teacherRequests, el('p', { class: 'p-msg err', text: errText(e) })); }
    const decide = async (r, ok) => { try { await API.rpc('rpc_admin_decide_teacher', { user_id: r.user_id, approve: ok }); start(); } catch (e) { say(errText(e)); } };
    return card(M.teacherRequests, list.length ? el('ul', { class: 'p-list' }, list.map(r => el('li', {},
      el('b', { text: r.display_name }), el('span', { class: 'small', dir: 'ltr', text: ' @' + r.username }),
      el('p', { class: 'small', text: fill(M.school, { s: r.school || '' }) + (r.note ? ' — ' + r.note : '') + ' · ' + date(r.requested_at) }),
      el('button', { type: 'button', class: 'btn small-btn primary', text: M.approve, onclick: () => decide(r, true) }),
      el('button', { type: 'button', class: 'btn small-btn', text: M.reject, onclick: () => decide(r, false) })))) : el('p', { text: M.noRequests }));
  }
  async function reportCard(days) {
    let r; try { r = await API.rpc('rpc_app_report', { days }); } catch (e) { return card(M.report, el('p', { class: 'p-msg err', text: errText(e) })); }
    const sel = el('select', { id: 'days', 'aria-label': M.report }, [7, 30, 90, 365].map(d => el('option', { value: d, selected: d === r.days ? true : null, text: fill(M.period, { d }) })));
    sel.addEventListener('change', async () => { const n = await reportCard(+sel.value); document.getElementById('app-report').replaceWith(n); });
    const head = [el('h2', { text: M.report }), sel, el('p', { class: 'small', text: M.defs })];
    if (!r.events_total) { const s = el('section', { class: 'p-card', id: 'app-report' }, ...head, el('p', { text: M.empty })); return s; }
    const R = M.rows, obj = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ': ' + ar(n)).join('، ') || M.none;
    const pct = r.sessions ? Math.round(100 * r.completed / r.sessions) : 0;
    const rows = [
      [R.sessions, ar(r.sessions)], [R.active, ar(r.active_sessions_7d || 0)],
      [R.completion, ar(pct) + '٪ (' + ar(r.completed) + ')'],
      [R.median, r.median_complete_ms ? fill(M.minutes, { m: Math.round(r.median_complete_ms / 60000) }) : M.none],
      [R.stops, Object.entries(r.last_screen || {}).map(([k, n]) => 'ش' + ar(k) + ': ' + ar(n)).join('، ') || M.none],
      [R.help, ar(r.help_open)], [R.remediation, ar(r.remediation)], [R.enrichment, ar(r.enrichment)],
      [R.levels, obj(r.level_changes)], [R.media, obj(r.media_errors)], [R.errors, obj(r.app_errors)],
      [R.perf, r.perf_load_ms_median ? fill(M.ms, { m: (r.perf_load_ms_median / 1000).toFixed(1) }) : M.none], [R.events, ar(r.events_total)],
    ];
    return el('section', { class: 'p-card', id: 'app-report' }, ...head,
      el('table', { class: 'p-table' }, el('tbody', {}, rows.map(([k, v]) => el('tr', {}, el('th', { scope: 'row', text: k }), el('td', { text: v }))))));
  }
  // ═════ ملاحظات المستخدمين: مراجعة وتصنيف وتوثيق الإجراء ═════
  let fbCache = [];
  async function feedbackCard(status) {
    let list = []; try { list = await API.rpc('rpc_admin_feedback', status ? { status } : {}); } catch (e) { return card(M.fbTitle, el('p', { class: 'p-msg err', text: errText(e) })); }
    if (!status) fbCache = list;
    const sel = el('select', { id: 'fb-filter', 'aria-label': M.fbTitle }, el('option', { value: '', text: M.fbAll }), Object.entries(M.fbStatus).map(([k, t]) => el('option', { value: k, selected: k === status ? true : null, text: t })));
    sel.addEventListener('change', async () => document.getElementById('fb-card').replaceWith(await feedbackCard(sel.value || undefined)));
    const rows = list.map(f => {
      const st = el('select', { 'aria-label': M.fbStatus.new }, Object.entries(M.fbStatus).map(([k, t]) => el('option', { value: k, selected: k === f.status ? true : null, text: t })));
      const cat = el('select', { 'aria-label': M.fbClassify }, el('option', { value: '', text: '—' }), Object.entries(M.fbCat).map(([k, t]) => el('option', { value: k, selected: k === f.admin_category ? true : null, text: t })));
      const act = el('textarea', { rows: 2, maxlength: 500, dir: 'auto', 'aria-label': M.fbAction }); act.value = f.action || '';
      const note = el('span', { class: 'small', role: 'status' });
      const save = el('button', { type: 'button', class: 'btn small-btn primary', text: M.fbSave, onclick: async () => {
        try { await API.rpc('rpc_admin_update_feedback', { id: f.id, status: st.value, admin_category: cat.value || null, action: act.value }); note.textContent = M.fbSaved; } catch (e) { note.textContent = errText(e); }
      } });
      return el('li', { class: 'fb-item' },
        el('p', {}, el('b', { text: '#' + ar(f.id) + ' · ' + C.feedback.cats[f.category] }), el('span', { class: 'small', text: ' · ' + date(f.at) + ' · ' + fill(M.fbScreen, { n: f.screen || 0 }) + ' · ' + (M.fbLang[f.lang] || f.lang) })),
        el('p', { class: 'fb-text', dir: 'auto', text: f.message }),
        el('div', { class: 'p-row' }, st, cat), el('label', { class: 'small', text: M.fbAction }), act, el('div', { class: 'p-row' }, save, note));
    });
    return el('section', { class: 'p-card', id: 'fb-card' }, el('h2', { text: M.fbTitle + ' (' + ar(list.length) + ')' }), sel,
      list.length ? el('ul', { class: 'p-list' }, rows) : el('p', { text: M.fbEmpty }));
  }
  // ═════ سجل التحسينات: كل تحسين مربوط بملاحظة فعلية ═════
  async function improvementsCard() {
    let list = []; try { list = await API.rpc('rpc_admin_improvements'); } catch (e) { return card(M.impTitle, el('p', { class: 'p-msg err', text: errText(e) })); }
    const log = list.length ? el('table', { class: 'p-table' }, el('thead', {}, el('tr', {}, [M.impVersion, M.impName, M.impLinks].map(t => el('th', { scope: 'col', text: t })))),
      el('tbody', {}, list.map(i => el('tr', {}, el('td', { text: i.version }), el('td', {}, el('b', { text: i.title }), i.detail ? el('p', { class: 'small', text: i.detail }) : null),
        el('td', { text: (i.feedback || []).map(f => '#' + ar(f.id) + ' ' + C.feedback.cats[f.category]).join('، ') })))))
      : el('p', { text: M.impEmpty });
    const v = el('input', { id: 'imp-v', type: 'text', dir: 'ltr', maxlength: 12, placeholder: '11.2' }), t = el('input', { id: 'imp-t', type: 'text', dir: 'auto', maxlength: 120 });
    const d = el('textarea', { id: 'imp-d', rows: 2, maxlength: 1000, dir: 'auto' });
    const picks = el('fieldset', { class: 'fb-kinds' }, el('legend', { text: M.impLinks }), fbCache.map(f => el('label', { class: 'check-row' }, el('input', { type: 'checkbox', value: f.id }), el('span', { text: '#' + ar(f.id) + ' ' + C.feedback.cats[f.category] + ': ' + f.message.slice(0, 60) }))));
    const m = el('p', { class: 'p-msg', hidden: true, role: 'status' });
    const add = el('button', { type: 'submit', class: 'btn primary', text: M.impAdd });
    const f = el('form', { novalidate: true }, window.P.field('imp-v', M.impVersion, v), window.P.field('imp-t', M.impName, t), window.P.field('imp-d', M.impDetail, d), picks, add, m);
    f.addEventListener('submit', async ev => { ev.preventDefault();
      const ids = [...picks.querySelectorAll('input:checked')].map(x => +x.value);
      if (!ids.length) return window.P.msg(m, M.impNeedFb);
      try { await API.rpc('rpc_admin_add_improvement', { version: v.value.trim(), title: t.value.trim(), detail: d.value.trim(), feedback_ids: ids }); start(); } catch (e) { window.P.msg(m, errText(e)); }
    });
    return card(M.impTitle, el('p', { class: 'small', text: M.impLead }), log, fbCache.length ? f : null);
  }
  start().catch(e => main().replaceChildren(card(M.report, el('p', { class: 'p-msg err', text: errText(e) }))));
})();
