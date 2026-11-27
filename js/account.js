/* صفحة «حسابي»: الدخول والتسجيل والاستعادة، والصفوف، والمهام، وموعد المراجعة، ونقل التقدم، والحذف. */
(() => {
  'use strict';
  const { C, API, el, main, fill, ar, date, errText, msg, field, input, confirmInline, busy, card, say } = window.P;
  const T = C.accounts, L = C.levels;
  document.title = T.pageTitle;
  if (!API.enabled) { window.P.disabledPage(); return; }

  // ═════ غير مسجّل ═════
  function guest(tab = 'login') {
    const tabs = el('div', { class: 'p-tabs', role: 'tablist' });
    const panel = el('div', { class: 'p-panel', role: 'tabpanel', id: 'acc-panel' });
    ['login', 'signup', 'recover'].forEach(k => tabs.append(el('button', { type: 'button', role: 'tab', id: 'tab-' + k, 'aria-selected': String(k === tab), 'aria-controls': 'acc-panel', text: T.tabs[k], onclick: () => guest(k) })));
    panel.append(tab === 'login' ? loginForm() : tab === 'signup' ? signupForm() : recoverForm());
    main().replaceChildren(card(T.open, el('p', { class: 'small', text: T.sessionNote }), tabs, panel, el('details', { class: 'p-policy' }, el('summary', { text: T.readPolicy }), el('p', { text: C.privacy.detail }))));
  }
  function loginForm() {
    const u = input('u', 'text', { autocomplete: 'username', 'aria-describedby': 'u-h' }), p = input('p', 'password', { autocomplete: 'current-password' });
    const m = el('p', { class: 'p-msg', hidden: true, role: 'alert' });
    const b = el('button', { type: 'submit', class: 'btn primary', text: T.loginBtn });
    const f = el('form', { novalidate: true }, field('u', T.username, u, T.usernameHint), field('p', T.password, p), m, b);
    f.addEventListener('submit', ev => { ev.preventDefault(); busy(b, async () => {
      try { await API.signIn(u.value, p.value); p.value = ''; await home(); } catch (e) { p.value = ''; msg(m, errText(e)); }
    }); });
    return f;
  }
  function signupForm() {
    const u = input('su', 'text', { autocomplete: 'username', 'aria-describedby': 'su-h', maxlength: 20 });
    const d = input('sd', 'text', { maxlength: 30, dir: 'auto', autocomplete: 'off' });
    const p = input('sp', 'password', { autocomplete: 'new-password', 'aria-describedby': 'sp-h', maxlength: 72 });
    const p2 = input('sp2', 'password', { autocomplete: 'new-password', maxlength: 72 });
    const c = el('input', { type: 'checkbox', id: 'sc' });
    const m = el('p', { class: 'p-msg', hidden: true, role: 'alert' });
    const b = el('button', { type: 'submit', class: 'btn primary', text: T.signupBtn });
    const f = el('form', { novalidate: true }, field('su', T.username, u, T.usernameHint), field('sd', T.displayName, d, T.displayHint),
      field('sp', T.password, p, T.passwordHint), field('sp2', T.password2, p2),
      el('label', { class: 'check-row', for: 'sc' }, c, el('span', { text: T.consent })), m, b);
    f.addEventListener('submit', ev => { ev.preventDefault();
      if (!API.okUser(u.value)) return msg(m, T.errors.invalid_username);
      if (!API.strong(p.value)) return msg(m, T.errors.weak_password);
      if (p.value !== p2.value) return msg(m, T.errors.mismatch);
      if (!c.checked) return msg(m, T.consentNeeded);
      busy(b, async () => {
        try { await API.signUp(u.value, p.value, d.value || u.value, true); p.value = p2.value = ''; const code = await API.rpc('rpc_new_recovery_code'); await home(code.code); }
        catch (e) { p.value = p2.value = ''; msg(m, errText(e)); }
      });
    });
    return f;
  }
  function recoverForm() {
    const u = input('ru', 'text', { autocomplete: 'username' }), k = input('rk', 'text', { autocomplete: 'off', maxlength: 11, placeholder: 'XXXXX-XXXXX' });
    const p = input('rp', 'password', { autocomplete: 'new-password', 'aria-describedby': 'rp-h', maxlength: 72 });
    const m = el('p', { class: 'p-msg', hidden: true, role: 'alert' });
    const b = el('button', { type: 'submit', class: 'btn primary', text: T.recoverBtn });
    const f = el('form', { novalidate: true }, el('p', { class: 'small', text: T.recoverLead }), field('ru', T.username, u), field('rk', T.recoveryCode, k), field('rp', T.newPassword, p, T.passwordHint), m, b);
    f.addEventListener('submit', ev => { ev.preventDefault();
      if (!API.strong(p.value)) return msg(m, T.errors.weak_password);
      busy(b, async () => {
        try { const r = await API.recover(u.value, k.value.trim().toUpperCase(), p.value); p.value = ''; if (r && r.error) throw new API.ApiError(r.error); msg(m, T.recovered, 'ok'); }
        catch (e) { p.value = ''; msg(m, errText(e)); }
      });
    });
    return f;
  }

  // ═════ مسجّل ═════
  async function home(freshCode) {
    const me = await window.P.me();
    if (!me) return guest();
    const out = el('button', { type: 'button', class: 'btn', text: T.logout, onclick: async () => {
      await API.signOut();
      try { sessionStorage.removeItem('eco.session.v1'); sessionStorage.removeItem('eco.mig.v1'); } catch (e) { /* */ }
      guest();
    } });
    const head = card(fill(T.hello, { name: me.display_name }), el('p', { class: 'small', text: T.username + ': ' + me.username }), el('p', { class: 'small', text: T.sessionNote }),
      el('div', { class: 'p-row' }, el('a', { class: 'btn primary', href: 'index.html', text: T.backToLesson }),
        me.role === 'teacher' ? el('a', { class: 'btn', href: 'teacher.html', text: T.teacherOpen }) : null,
        me.role === 'admin' ? el('a', { class: 'btn', href: 'admin.html', text: T.adminOpen }) : null, out),
      el('p', { class: 'small' }, el('a', { href: me.role === 'student' ? 'guides/student.html' : 'guides/teacher.html', text: me.role === 'student' ? T.studentGuide : T.teacherGuide })));
    const parts = [head];
    if (freshCode) parts.push(codeCard(freshCode));
    if (me.role === 'student') {
      const mig = migrationCard(); if (mig) parts.push(mig);
      parts.push(await tasksCard(), await progressCard(), await classesCard(), reviewPlaceholder);
    }
    parts.push(recoveryCard(), me.role === 'student' ? teacherReqCard(me) : null, dataCard(me), card(C.support.title, window.P.supportLink()));
    main().replaceChildren(...parts.filter(Boolean));
    if (me.role === 'student') fillReview();
  }

  function codeCard(code) {
    return el('section', { class: 'p-card code-card', role: 'alert' }, el('h2', { text: T.codeTitle }), el('p', { text: T.codeLead }), el('p', { class: 'code-big', dir: 'ltr', text: code }));
  }
  function recoveryCard() {
    const host = el('div', {});
    const b = el('button', { type: 'button', class: 'btn', text: T.codeNew });
    b.addEventListener('click', () => confirmInline(host, T.codeWarn, T.codeNew, async () => {
      try { const r = await API.rpc('rpc_new_recovery_code'); host.replaceChildren(codeCard(r.code)); } catch (e) { host.append(el('p', { class: 'p-msg err', text: errText(e) })); }
    }));
    return card(T.codeTitle, el('p', { class: 'small', text: T.codeLead }), b, host);
  }

  // نقل التقدم المحفوظ على الجهاز: بموافقة صريحة فقط
  function readSaved() { try { const v = JSON.parse(localStorage.getItem('eco.saved.v1')); return v && Date.now() - v.ts < 30 * 864e5 ? v : null; } catch (e) { return null; } }
  function migrationCard() {
    let decided = null; try { decided = sessionStorage.getItem('eco.mig.v1'); } catch (e) { /* */ }
    const v = readSaved(); if (!v || decided) return null;
    const m = el('p', { class: 'p-msg', hidden: true, role: 'status' });
    const yes = el('button', { type: 'button', class: 'btn primary', text: T.migrateYes });
    const no = el('button', { type: 'button', class: 'btn', text: T.migrateNo });
    const box = card(T.migrateTitle, el('p', { text: T.migrateLead }), el('p', { class: 'small', text: fill(T.screensDone, { n: (v.done || []).length }) }), el('div', { class: 'p-row' }, yes, no), m);
    yes.addEventListener('click', () => busy(yes, async () => {
      try {
        await API.rpc('rpc_save_progress', { level: [1, 2, 3].includes(v.level) ? v.level : 1, done: (v.done || []).filter(n => Number.isInteger(n) && n >= 1 && n <= 6),
          first_score: typeof v.quizFirstScore === 'number' ? v.quizFirstScore : null, first_goals: null, retake_scores: [], errors: {}, remediation_count: 0, enrichment_count: 0,
          level_results: Object.fromEntries(Object.entries(v.levelResults || {}).map(([k, r]) => [k, { score: r.score, total: 3 }])) });
        localStorage.removeItem('eco.saved.v1'); sessionStorage.setItem('eco.mig.v1', 'yes');
        box.replaceChildren(el('h2', { text: T.migrateTitle }), el('p', { class: 'p-msg ok', text: T.migrated })); say(T.migrated);
      } catch (e) { msg(m, errText(e)); }
    }));
    no.addEventListener('click', () => {
      // التقدم ليس لهذا الطالب: لا يُنقل ولا يُمسح من الجهاز، وتبدأ هذه الجلسة من الصفر على أنه جهاز مشترك
      try { sessionStorage.setItem('eco.mig.v1', 'no'); sessionStorage.setItem('eco.session.v1', JSON.stringify({ device: 'shared', save: false })); } catch (e) { /* */ }
      box.remove();
    });
    return box;
  }

  async function tasksCard() {
    let r; try { r = await API.rpc('rpc_my_tasks'); } catch (e) { return card(T.tasksTitle, el('p', { class: 'p-msg err', text: errText(e) })); }
    const list = el('ul', { class: 'p-list' });
    (r.tasks || []).forEach(t => {
      const st = t.status;
      const href = t.kind === 'screen' ? 'index.html#s' + t.ref : t.kind === 'collab' ? 'index.html#s4' : 'index.html#s6';
      const li = el('li', { class: 'task st-' + st }, el('p', {}, el('b', { text: t.title || fill(T.taskKinds[t.kind] || '', { n: t.ref || 0 }) })),
        el('p', { class: 'small', text: t.class_name + ' · ' + fill(T.taskKinds[t.kind] || '', { n: t.ref || 0 }) + ' · ' + (t.due_at ? fill(T.due, { d: date(t.due_at) }) : T.noDue) }),
        el('p', { class: 'badge-st', text: T.taskStatus[st] || st }), el('a', { class: 'btn small-btn', href, text: T.openTask }));
      if (t.kind === 'collab' && st !== 'done') li.append(el('button', { type: 'button', class: 'btn small-btn', text: T.markDone, onclick: async ev => { await busy(ev.currentTarget, async () => { try { await API.rpc('rpc_mark_collab_done', { task_id: t.id }); home(); } catch (e) { say(errText(e)); } }); } }));
      list.append(li);
    });
    const body = [list.children.length ? list : el('p', { text: T.noTasks })];
    // مهام مقترحة من الأهداف غير المتقنة في المحاولة الأولى
    let p = null; try { p = await API.rpc('rpc_my_progress'); } catch (e) { /* */ }
    if (p && Array.isArray(p.first_goals)) {
      const goals = C.screens[0].objectives.items, link = { 1: 2, 2: 3, 3: 4, 4: 5 };
      const miss = p.first_goals.map((ok, i) => ok ? null : i + 1).filter(Boolean);
      body.push(el('h3', { text: T.suggestedTitle }), miss.length
        ? el('ul', { class: 'p-list' }, el('li', { class: 'small', text: T.suggestedLead }), miss.map(g => el('li', {}, el('a', { href: 'index.html#s' + link[g], text: fill(T.suggestedItem, { g: goals[g - 1].text }) }))))
        : el('p', { text: T.suggestedNone }));
    }
    return card(T.tasksTitle, ...body);
  }
  async function progressCard() {
    let p = null; try { p = await API.rpc('rpc_my_progress'); } catch (e) { /* */ }
    const lr = (p && p.level_results) || {};
    return card(T.progressTitle,
      el('p', { text: fill(T.screensDone, { n: p ? (p.done || []).length : 0 }) }),
      el('p', { text: fill(L.current, { n: L.names[(p && p.level) || 1] }) }),
      el('p', { text: fill(L.resultsBasic, { s: p && p.first_score !== null && p.first_score !== undefined ? p.first_score : 0 }) + (p && p.first_score !== null && p.first_score !== undefined ? '' : ' — ' + L.resultsNone) }),
      el('ul', {}, [1, 2, 3].map(k => el('li', { text: lr[k] ? fill(L.resultsLevel, { n: k, s: lr[k].score }) : ar(k) + ': ' + L.resultsNone }))));
  }
  async function classesCard() {
    let list = []; try { list = await API.rpc('rpc_my_classes'); } catch (e) { /* */ }
    const code = input('jc', 'text', { maxlength: 6, autocomplete: 'off', style: null });
    const m = el('p', { class: 'p-msg', hidden: true, role: 'status' });
    const b = el('button', { type: 'submit', class: 'btn primary', text: T.joinBtn });
    const f = el('form', { novalidate: true }, el('p', { class: 'small', text: T.joinLead }), field('jc', T.joinCode, code), b, m);
    f.addEventListener('submit', ev => { ev.preventDefault(); busy(b, async () => {
      try { const r = await API.rpc('rpc_join_class', { code: code.value.trim().toUpperCase() }); if (r.error) throw new API.ApiError(r.error); code.value = ''; await home(); say(fill(T.joined, { c: r.class_name, s: T.status[r.status] })); }
      catch (e) { msg(m, errText(e)); }
    }); });
    const ul = el('ul', { class: 'p-list' }, list.map(c => el('li', {}, el('b', { text: c.class_name }), el('span', { class: 'small', text: ' — ' + (c.teacher || '') + ' · ' + (T.status[c.status] || c.status) + ' ' }),
      ['approved', 'pending'].includes(c.status) ? el('button', { type: 'button', class: 'btn small-btn', text: T.leave, onclick: ev => confirmInline(ev.currentTarget.parentNode, T.leave + '؟', T.leave, async () => { await API.rpc('rpc_leave_class', { class_id: c.class_id }); home(); }) }) : null)));
    return card(T.classesTitle, list.length ? ul : el('p', { text: T.noClasses }), f);
  }
  // موعد المراجعة (يُملأ بعد رسم الصفحة)
  const reviewPlaceholder = el('section', { class: 'p-card', id: 'review-card' });
  async function fillReview() {
    let r = {}; try { r = await API.rpc('rpc_my_tasks'); } catch (e) { /* */ }
    const at = r.review_at;
    const toLocal = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
    const inp = input('rv', 'datetime-local', { min: toLocal(new Date()), max: toLocal(Date.now() + 364 * 864e5) });
    if (at) inp.value = toLocal(at);
    const m = el('p', { class: 'p-msg', hidden: true, role: 'status' });
    const save = el('button', { type: 'button', class: 'btn primary', text: T.reviewSave, onclick: ev => busy(ev.currentTarget, async () => {
      if (!inp.value) return;
      try { const x = await API.rpc('rpc_set_review', { review_at: new Date(inp.value).toISOString() }); msg(m, fill(T.reviewSet, { d: date(x.review_at) }), 'ok'); } catch (e) { msg(m, errText(e)); }
    }) });
    const clear = el('button', { type: 'button', class: 'btn', text: T.reviewClear, onclick: async () => { try { await API.rpc('rpc_set_review', { review_at: null }); inp.value = ''; msg(m, T.reviewNone, 'ok'); } catch (e) { msg(m, errText(e)); } } });
    const due = at && new Date(at) <= new Date();
    reviewPlaceholder.replaceChildren(...[el('h2', { text: T.reviewTitle }), el('p', { class: 'small', text: T.reviewLead }),
      due ? el('p', { class: 'p-msg warn', role: 'status', text: T.reviewDue }) : null,
      el('p', { text: at ? fill(T.reviewSet, { d: date(at) }) : T.reviewNone }), field('rv', T.reviewTitle, inp), el('div', { class: 'p-row' }, save, clear), m].filter(Boolean));
  }

  function teacherReqCard(me) {
    if (me.teacher_status && me.teacher_status !== 'none') return card(T.teacherTitle, el('p', { text: T.teacherStatus[me.teacher_status] || '' }));
    const s = input('ts', 'text', { maxlength: 80, dir: 'auto' }), n = el('textarea', { id: 'tn', maxlength: 300, rows: 2 });
    const m = el('p', { class: 'p-msg', hidden: true, role: 'status' });
    const b = el('button', { type: 'submit', class: 'btn', text: T.teacherBtn });
    const f = el('form', { novalidate: true }, el('p', { class: 'small', text: T.teacherLead }), field('ts', T.school, s), field('tn', T.note, n), b, m);
    f.addEventListener('submit', ev => { ev.preventDefault(); if (!s.value.trim()) return msg(m, T.errors.generic);
      busy(b, async () => { try { await API.rpc('rpc_request_teacher', { school: s.value.trim(), note: n.value.trim() }); home(); } catch (e) { msg(m, errText(e)); } }); });
    return el('details', { class: 'p-card' }, el('summary', { text: T.teacherTitle }), f);
  }
  function dataCard(me) {
    const host = el('div', {});
    const delData = me.role === 'student' ? el('button', { type: 'button', class: 'btn', text: T.deleteData, onclick: () => confirmInline(host, T.deleteDataQ, T.yes, async () => {
      try { await API.rpc('rpc_delete_my_data'); try { sessionStorage.removeItem('eco.session.v1'); } catch (e) { /* */ } host.replaceChildren(el('p', { class: 'p-msg ok', text: T.deleted })); } catch (e) { host.append(el('p', { class: 'p-msg err', text: errText(e) })); }
    }) }) : null;
    const delAcc = el('button', { type: 'button', class: 'btn danger', text: T.deleteAccount, onclick: () => confirmInline(host, T.deleteAccountQ, T.yes, async () => {
      try { await API.fn('delete-account', { confirm: 'DELETE' }); API.forget(); try { sessionStorage.removeItem('eco.session.v1'); sessionStorage.removeItem('eco.mig.v1'); } catch (e) { /* */ }
        main().replaceChildren(card(T.dataTitle, el('p', { class: 'p-msg ok', text: T.deleted }), el('a', { class: 'btn primary', href: 'index.html', text: T.backToLesson }))); }
      catch (e) { host.append(el('p', { class: 'p-msg err', text: errText(e) })); }
    }) });
    return card(T.dataTitle, el('details', {}, el('summary', { text: T.readPolicy }), el('p', { text: C.privacy.detail })), el('div', { class: 'p-row' }, delData, delAcc), host);
  }

  (API.signedIn() ? home() : Promise.resolve(guest())).catch(() => guest());
})();
