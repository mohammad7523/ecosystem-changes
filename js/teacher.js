/* لوحة المعلم: الصفوف ورموزها، وطلبات الانضمام، والطلاب، والتقارير، والمهام، والتصدير. كل البيانات من دوال محمية في الخادم. */
(() => {
  'use strict';
  const { C, API, el, main, fill, ar, date, errText, msg, field, input, confirmInline, busy, card, say } = window.P;
  const D = C.dash, A = C.accounts, L = C.levels;
  document.title = D.pageTitle;
  if (!API.enabled) { window.P.disabledPage(); return; }
  let me = null;

  async function start() {
    me = await window.P.me();
    if (!me) { main().replaceChildren(card(D.notTeacher, el('a', { class: 'btn primary', href: 'account.html', text: A.tabs.login }))); return; }
    if (me.role !== 'teacher') { main().replaceChildren(card(D.notTeacher, el('a', { class: 'btn', href: 'account.html', text: A.open }))); return; }
    await classesView();
  }

  // ═════ الصفوف ═════
  async function classesView() {
    let list = []; try { list = await API.rpc('rpc_teacher_classes'); } catch (e) { return main().replaceChildren(card(D.classes, el('p', { class: 'p-msg err', text: errText(e) }))); }
    const name = input('cn', 'text', { maxlength: 40, dir: 'auto' });
    const m = el('p', { class: 'p-msg', hidden: true, role: 'status' });
    const b = el('button', { type: 'submit', class: 'btn primary', text: D.create });
    const f = el('form', { novalidate: true, class: 'p-inline' }, field('cn', D.newClass, name), b, m);
    f.addEventListener('submit', ev => { ev.preventDefault(); if (name.value.trim().length < 2) return msg(m, A.errors.generic);
      busy(b, async () => { try { await API.rpc('rpc_create_class', { name: name.value.trim() }); await classesView(); } catch (e) { msg(m, errText(e)); } }); });
    const cards = list.map(c => {
      const host = el('div', {});
      return el('li', { class: 'class-item' },
        el('h3', { text: c.name }),
        el('p', { class: 'code-line' }, el('span', { text: c.code_enabled ? fill(D.code, { c: '' }) : D.codeOff }), c.code_enabled ? el('b', { class: 'code-big', dir: 'ltr', text: c.join_code }) : null),
        el('p', { class: 'small', text: fill(D.counts, { s: c.students, p: c.pending }) }),
        el('div', { class: 'p-row' },
          el('button', { type: 'button', class: 'btn primary', text: D.open, onclick: () => classView(c) }),
          el('button', { type: 'button', class: 'btn', text: D.regenerate, onclick: async () => { try { await API.rpc('rpc_regenerate_code', { class_id: c.id }); classesView(); } catch (e) { say(errText(e)); } } }),
          el('button', { type: 'button', class: 'btn', text: c.code_enabled ? D.disable : D.enable, onclick: async () => { try { await API.rpc('rpc_set_code_enabled', { class_id: c.id, enabled: !c.code_enabled }); classesView(); } catch (e) { say(errText(e)); } } }),
          el('button', { type: 'button', class: 'btn danger', text: D.deleteClass, onclick: () => confirmInline(host, D.deleteClassQ, A.yes, async () => { await API.rpc('rpc_delete_class', { class_id: c.id }); classesView(); }) })),
        host);
    });
    main().replaceChildren(
      card(D.classes, list.length ? el('ul', { class: 'p-list classes' }, cards) : el('p', { text: D.noClasses }), f),
      card(D.guide, el('ul', {}, el('li', {}, el('a', { href: 'guides/class-management.html', text: D.guide })), el('li', {}, el('a', { href: 'guides/teacher.html', text: A.teacherGuide })))),
      card(C.support.title, window.P.supportLink()));
  }

  // ═════ صف واحد ═════
  async function classView(c) {
    const back = el('button', { type: 'button', class: 'btn', text: '← ' + D.classes, onclick: classesView });
    main().replaceChildren(el('div', { class: 'p-row' }, back), el('h1', { class: 'p-h1', text: c.name }), el('p', { class: 'small', text: '…' }));
    let req = [], rep = { students: [] }, tasks = [];
    try { [req, rep, tasks] = await Promise.all([API.rpc('rpc_class_requests', { class_id: c.id }), API.rpc('rpc_class_report', { class_id: c.id }), API.rpc('rpc_class_tasks', { class_id: c.id })]); }
    catch (e) { main().append(el('p', { class: 'p-msg err', text: errText(e) })); return; }
    const S = rep.students || [];
    main().replaceChildren(el('div', { class: 'p-row' }, back), el('h1', { class: 'p-h1', text: c.name }),
      requestsCard(c, req), studentsCard(c, S), reportCard(S), tasksCard(c, S, tasks));
  }
  function requestsCard(c, req) {
    return card(D.requests + ' (' + ar(req.length) + ')', req.length ? el('ul', { class: 'p-list' }, req.map(r => el('li', {},
      el('b', { text: r.display_name }), el('span', { class: 'small', dir: 'ltr', text: ' @' + r.username + ' ' }), el('span', { class: 'small', text: date(r.requested_at) + ' ' }),
      el('button', { type: 'button', class: 'btn small-btn primary', text: D.approve, onclick: () => decide(c, r, true) }),
      el('button', { type: 'button', class: 'btn small-btn', text: D.reject, onclick: () => decide(c, r, false) })))) : el('p', { text: D.noRequests }));
  }
  async function decide(c, r, ok) { try { await API.rpc('rpc_decide_request', { class_id: c.id, student_id: r.student_id, approve: ok }); classView(c); } catch (e) { say(errText(e)); } }

  const goalsCell = g => Array.isArray(g) ? g.map((x, i) => ar(i + 1) + (x ? D.yes : D.no)).join(' ') : D.none;
  const topErr = e => Object.entries(e || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, n]) => (D.errorNames[k] || k) + ' ×' + ar(n)).join('، ') || D.none;
  const lvlRes = r => [1, 2, 3].map(k => r && r[k] ? ar(k) + ': ' + ar(r[k].score) + '/٣' : null).filter(Boolean).join(' · ') || D.none;
  function studentsCard(c, S) {
    if (!S.length) return card(D.students, el('p', { text: D.noStudents }));
    const K = D.cols;
    const host = el('div', {});
    const tbl = el('table', { class: 'p-table' }, el('caption', { class: 'sr-only', text: D.students }),
      el('thead', {}, el('tr', {}, ['name', 'level', 'done', 'first', 'retake', 'goals', 'errors', 'rem', 'levels', 'review', 'actions'].map(k => el('th', { scope: 'col', text: K[k] })))),
      el('tbody', {}, S.map(s => el('tr', {},
        el('th', { scope: 'row' }, el('button', { type: 'button', class: 'link-btn', text: s.display_name, onclick: () => studentReport(s) }), el('span', { class: 'small', dir: 'ltr', text: ' @' + s.username })),
        el('td', { text: s.level ? ar(s.level) + ' ' + L.short[s.level] : D.none }),
        el('td', { text: ar((s.done || []).length) + '/٦' }),
        el('td', { text: s.first_score === null || s.first_score === undefined ? D.none : ar(s.first_score) + '/٤' }),
        el('td', { text: (s.retake_scores || []).length ? (s.retake_scores || []).map(x => ar(x)).join('، ') : D.none }),
        el('td', { text: goalsCell(s.first_goals) }),
        el('td', { text: topErr(s.errors) }),
        el('td', { text: ar(s.remediation_count || 0) + ' / ' + ar(s.enrichment_count || 0) }),
        el('td', { text: lvlRes(s.level_results) }),
        el('td', { text: s.review_at ? date(s.review_at) : D.none }),
        el('td', {},
          el('button', { type: 'button', class: 'btn small-btn', text: D.reset, onclick: () => confirmInline(host, D.resetQ, A.yes, async () => {
            try { const r = await API.fn('teacher-reset', { student_id: s.student_id }); host.replaceChildren(el('p', { class: 'p-msg ok code-big', dir: 'auto', role: 'alert', text: fill(D.resetDone, { p: r.temp_password }) })); }
            catch (e) { host.append(el('p', { class: 'p-msg err', text: errText(e) })); }
          }) }),
          el('button', { type: 'button', class: 'btn small-btn danger', text: D.remove, onclick: () => confirmInline(host, D.removeQ, A.yes, async () => { await API.rpc('rpc_remove_student', { class_id: c.id, student_id: s.student_id }); classView(c); }) }))))));
    const exp = el('button', { type: 'button', class: 'btn', text: D.exportCsv, onclick: () => exportCsv(c, S) });
    return card(D.students + ' (' + ar(S.length) + ')', el('div', { class: 'p-scroll', tabindex: '0', role: 'region', 'aria-label': D.students }, tbl), host, el('div', { class: 'p-row' }, exp), el('p', { class: 'small', text: D.csvNote }));
  }
  function reportCard(S) {
    const firsts = S.filter(s => s.first_score !== null && s.first_score !== undefined);
    if (!firsts.length) return card(D.report, el('p', { text: D.noData }));
    const avg = firsts.reduce((a, s) => a + s.first_score, 0) / firsts.length;
    const withGoals = S.filter(s => Array.isArray(s.first_goals));
    const goals = [0, 1, 2, 3].map(i => withGoals.length ? Math.round(100 * withGoals.filter(s => s.first_goals[i]).length / withGoals.length) : null);
    const errs = {}; S.forEach(s => Object.entries(s.errors || {}).forEach(([k, n]) => { errs[k] = (errs[k] || 0) + 1; }));
    const top = Object.entries(errs).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const lv = { 1: 0, 2: 0, 3: 0 }; S.forEach(s => { if (lv[s.level] !== undefined) lv[s.level]++; });
    const objs = C.screens[0].objectives.items;
    return card(D.report,
      el('p', { text: fill(D.avgFirst, { a: avg.toFixed(1), n: firsts.length }).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]) }),
      el('ul', { class: 'p-bars' }, goals.map((p, i) => p === null ? null : el('li', {}, el('span', { text: fill(D.goalPct, { g: i + 1, p }) + ' — ' + objs[i].text }), el('span', { class: 'bar', 'aria-hidden': 'true' }, el('span', { class: 'fill', style: null, 'data-w': p }))))),
      el('h3', { text: D.topErrors }), top.length ? el('ol', {}, top.map(([k, n]) => el('li', { text: (D.errorNames[k] || k) + ' — ' + ar(n) }))) : el('p', { text: D.none }),
      el('p', { class: 'small', text: [1, 2, 3].map(k => L.names[k] + ': ' + ar(lv[k])).join(' · ') }),
      el('p', { class: 'small', text: D.cols.rem + ': ' + ar(S.reduce((a, s) => a + (s.remediation_count || 0), 0)) + ' / ' + ar(S.reduce((a, s) => a + (s.enrichment_count || 0), 0)) }));
  }
  function studentReport(s) {
    const objs = C.screens[0].objectives.items;
    const dlg = el('section', { class: 'p-card student-report', role: 'dialog', 'aria-modal': 'false', 'aria-label': D.studentReport },
      el('h2', { text: D.studentReport + ': ' + s.display_name }),
      el('ul', {},
        el('li', { text: D.cols.level + ': ' + (s.level ? L.names[s.level] : D.none) }),
        el('li', { text: D.cols.done + ': ' + ar((s.done || []).length) + '/٦ (' + ((s.done || []).map(ar).join('، ') || D.none) + ')' }),
        el('li', { text: D.cols.first + ': ' + (s.first_score === null || s.first_score === undefined ? D.none : ar(s.first_score) + '/٤') }),
        el('li', { text: D.cols.retake + ': ' + ((s.retake_scores || []).map(ar).join('، ') || D.none) }),
        el('li', { text: D.cols.levels + ': ' + lvlRes(s.level_results) }),
        el('li', { text: D.cols.rem + ': ' + ar(s.remediation_count || 0) + ' / ' + ar(s.enrichment_count || 0) }),
        el('li', { text: D.cols.review + ': ' + (s.review_at ? date(s.review_at) : D.none) })),
      el('h3', { text: D.cols.goals }),
      el('ul', {}, objs.map((o, i) => el('li', { text: (Array.isArray(s.first_goals) ? (s.first_goals[i] ? D.yes : D.no) : D.none) + ' ' + o.text }))),
      el('h3', { text: D.cols.errors }), el('p', { text: topErr(s.errors) }),
      el('button', { type: 'button', class: 'btn', text: D.close, onclick: () => dlg.remove() }));
    document.querySelector('.student-report')?.remove();
    main().prepend(dlg); dlg.querySelector('h2').setAttribute('tabindex', '-1'); dlg.querySelector('h2').focus();
  }
  function exportCsv(c, S) {
    const q = v => { const t = String(v === null || v === undefined ? '' : v); return /^[=+\-@\t\r]/.test(t) ? "'" + t : t; }; // يمنع حقن الصيغ في الجداول
    const cell = v => '"' + q(v).replace(/"/g, '""') + '"';
    const head = ['display_name', 'username', 'level', 'screens_done', 'first_score', 'retake_scores', 'goal1', 'goal2', 'goal3', 'goal4', 'level1', 'level2', 'level3', 'remediation', 'enrichment', 'top_errors', 'review_at'];
    const rows = S.map(s => [s.display_name, s.username, s.level, (s.done || []).length, s.first_score, (s.retake_scores || []).join(' '),
      ...[0, 1, 2, 3].map(i => Array.isArray(s.first_goals) ? (s.first_goals[i] ? 1 : 0) : ''),
      ...[1, 2, 3].map(k => s.level_results && s.level_results[k] ? s.level_results[k].score : ''),
      s.remediation_count || 0, s.enrichment_count || 0, Object.keys(s.errors || {}).join(' '), s.review_at || '']);
    const csv = '﻿' + [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
    const a = el('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: 'class-report-' + new Date().toISOString().slice(0, 10) + '.csv' });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ═════ المهام ═════
  function tasksCard(c, S, tasks) {
    const kind = el('select', { id: 'tk' }, ['screen', 'level', 'quiz', 'retake', 'collab'].map(k => el('option', { value: k, text: fill(A.taskKinds[k], { n: '…' }) })));
    const ref = el('select', { id: 'tr' });
    const fillRef = () => { const k = kind.value; ref.replaceChildren(...(k === 'screen' ? [1, 2, 3, 4, 5, 6].map(n => el('option', { value: n, text: fill(A.taskKinds.screen, { n }) })) : k === 'level' ? [1, 2, 3].map(n => el('option', { value: n, text: ar(n) + ' — ' + L.names[n] })) : [])); ref.disabled = !ref.children.length; };
    kind.addEventListener('change', fillRef); fillRef();
    const title = input('tt', 'text', { maxlength: 80, dir: 'auto' });
    const who = el('select', { id: 'tw' }, el('option', { value: '', text: D.wholeClass }), S.map(s => el('option', { value: s.student_id, text: s.display_name })));
    const due = input('td', 'datetime-local');
    const m = el('p', { class: 'p-msg', hidden: true, role: 'status' });
    const b = el('button', { type: 'submit', class: 'btn primary', text: D.addTask });
    const f = el('form', { novalidate: true }, field('tk', D.taskKind, kind), field('tr', D.taskRef, ref), field('tt', D.taskTitle, title), field('tw', D.taskFor, who), field('td', D.taskDue, due), b, m);
    f.addEventListener('submit', ev => { ev.preventDefault();
      const t = title.value.trim() || ref.selectedOptions[0]?.text || kind.selectedOptions[0].text;
      busy(b, async () => {
        try { await API.rpc('rpc_create_task', { class_id: c.id, kind: kind.value, ref: ref.disabled ? null : +ref.value, title: t, student_id: who.value || null, due_at: due.value ? new Date(due.value).toISOString() : null }); classView(c); }
        catch (e) { msg(m, errText(e)); }
      });
    });
    const list = el('ul', { class: 'p-list' }, tasks.map(t => {
      const st = t.statuses || [];
      const n = k => st.filter(x => x.status === k).length;
      return el('li', {}, el('b', { text: t.title }), el('span', { class: 'small', text: ' · ' + (t.student_id ? (S.find(s => s.student_id === t.student_id) || {}).display_name || '' : D.wholeClass) + ' · ' + (t.due_at ? fill(A.due, { d: date(t.due_at) }) : A.noDue) }),
        el('p', { class: 'small', text: fill(D.statusCount, { d: n('done'), i: n('in_progress'), n: n('not_started') }) }),
        el('details', {}, el('summary', { text: D.students }), el('ul', {}, st.map(x => el('li', { text: x.display_name + ': ' + (A.taskStatus[x.status] || x.status) })))),
        el('button', { type: 'button', class: 'btn small-btn danger', text: D.deleteTask, onclick: async () => { try { await API.rpc('rpc_delete_task', { task_id: t.id }); classView(c); } catch (e) { say(errText(e)); } } }));
    }));
    return card(D.tasks, tasks.length ? list : el('p', { text: D.noTasks }), el('details', { class: 'p-new' }, el('summary', { text: D.newTask }), f));
  }

  // أشرطة النسب دون أنماط مضمّنة (CSP: style-src 'self')
  new MutationObserver(() => document.querySelectorAll('.bar .fill[data-w]').forEach(x => { x.className = 'fill w' + Math.round(+x.dataset.w / 10) * 10; x.removeAttribute('data-w'); })).observe(document.body, { childList: true, subtree: true });
  start().catch(e => main().replaceChildren(card(D.classes, el('p', { class: 'p-msg err', text: errText(e) }))));
})();
