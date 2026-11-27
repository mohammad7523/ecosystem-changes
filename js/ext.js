/* الإصدار 11.0 — امتدادات الدرس: المستويات الثلاثة، والخطة العلاجية، والنشاط التعاوني، والدعم الفني،
   ومزامنة التقدم مع الحساب، والإحصاءات المجهولة. يتصل بالتطبيق عبر نقاط الربط X(...) في app.js فقط. */
window.EcoExt = (() => {
  'use strict';
  const C = window.CONTENT, S = window.Store, API = window.EcoApi, CFG = window.ECO_CONFIG || {};
  const A = () => window.EcoApp;
  const L = C.levels;
  const ar = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => (k in v ? (typeof v[k] === 'number' ? ar(v[k]) : v[k]) : ''));
  const level = () => [1, 2, 3].includes(S.get().level) ? S.get().level : 1;
  const t0 = Date.now();

  // ═════ الإحصاءات المجهولة ═════
  const session = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  let me = null; // ملف المستخدم المسجّل (إن وُجد)
  const analyticsOn = () => API && API.enabled && (API.signedIn() || S.get().settings.analytics === true);
  function event(kind, screen, detail, ms) {
    if (!analyticsOn()) return;
    const body = { session, kind };
    if (Number.isInteger(screen)) body.screen = screen;
    if (detail) body.detail = String(detail).toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 40);
    if (Number.isFinite(ms)) body.ms = Math.round(ms);
    API.rpc('rpc_log_event', body).catch(() => { /* الإحصاءات لا توقف الدرس أبدًا */ });
  }
  window.addEventListener('error', e => event('app_error', 0, (e.filename || '').split('/').pop() + '.' + (e.lineno || 0)));
  window.addEventListener('load', () => {
    event('session_start', 0, 'l' + level());
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (nav) event('perf', 0, 'load', nav.loadEventStart || nav.duration);
  });

  // ═════ مزامنة التقدم مع الحساب ═════
  let syncTimer = null;
  function snapshot() {
    const s = S.get(), q = s.quiz, a0 = q && q.attempts[0];
    const errors = Object.assign({}, s.errors || {});
    (s.firstGoals || []).forEach((ok, i) => { if (!ok) errors['q' + (i + 1)] = 1; });
    return {
      level: level(), done: s.done.slice(),
      first_score: a0 && a0.finished ? a0.score : null,
      first_goals: s.firstGoals && s.firstGoals.length === 4 ? s.firstGoals : null,
      retake_scores: q ? q.attempts.slice(1).filter(x => x.finished).map(x => x.score) : [],
      errors, remediation_count: (s.counts || {}).remediation || 0, enrichment_count: (s.counts || {}).enrichment || 0,
      level_results: Object.fromEntries(Object.entries(s.levelResults || {}).map(([k, v]) => [k, { score: v.score, total: 3 }])),
    };
  }
  // نقل التقدم المحفوظ على الجهاز إلى الحساب لا يتم إلا بموافقة صريحة من صفحة «حسابي»
  const migrationPending = () => { let d = null; try { d = sessionStorage.getItem('eco.mig.v1'); } catch (e) { /* */ } return !d && S.hasSaved(); };
  function scheduleSync() {
    if (!me || me.role !== 'student' || migrationPending()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { API.rpc('rpc_save_progress', snapshot()).catch(() => { /* يُعاد عند التغيير التالي */ }); }, 1200);
  }
  const origUpdate = S.update.bind(S);
  S.update = fn => { origUpdate(fn); scheduleSync(); };
  // دخول من جهاز آخر: يُدمج التقدم المحفوظ في الحساب مع الجلسة دون أن يُنسب لغير صاحبه
  async function pullAccount() {
    if (!API || !API.enabled || !API.signedIn()) return;
    try { me = await API.rpc('rpc_me'); } catch (e) { me = null; if (e.status === 401) API.forget(); return; }
    if (!me || me.role !== 'student') return;
    let p = null; try { p = await API.rpc('rpc_my_progress'); } catch (e) { return; }
    if (!p) { scheduleSync(); if (A()) A().render(); return; }
    origUpdate(s => {
      s.done = Array.from(new Set([...(s.done || []), ...(p.done || [])])).sort();
      if ([1, 2, 3].includes(p.level)) s.level = p.level;
      for (const [k, v] of Object.entries(p.level_results || {})) if (!s.levelResults[k]) s.levelResults[k] = { score: v.score, total: 3, restored: true };
      if (p.first_score !== null && p.first_score !== undefined && !(s.quiz && s.quiz.attempts[0] && s.quiz.attempts[0].finished)) {
        s.quiz = { attempts: [{ answers: {}, score: p.first_score, finished: true, restored: true }], badge: p.first_score === 4 };
      }
      if (p.first_goals && !s.firstGoals) s.firstGoals = p.first_goals;
      s.counts = { remediation: Math.max((s.counts || {}).remediation || 0, p.remediation_count || 0), enrichment: Math.max((s.counts || {}).enrichment || 0, p.enrichment_count || 0) };
    });
    if (A()) A().render();
  }
  pullAccount();

  // ═════ أداة سؤال صغيرة (اختبار المستوى والتحقق العلاجي) ═════
  function miniQuestion(item, { onFirst, onCorrect, explain = true } = {}) {
    const { el, icon, pic } = A();
    const fb = el('div', { class: 'feedback', 'aria-live': 'polite' });
    const opts = el('div', { class: 'options' });
    const box = el('fieldset', { class: 'question mini-q' }, el('legend', { text: item.q }));
    if (item.image) box.append(el('figure', { class: 'scene mini-img' }, pic(item.image, { loading: 'lazy' })));
    box.append(opts);
    let first = true, done = false;
    item.options.forEach((o, i) => {
      const b = el('button', { type: 'button', class: 'option', 'data-i': i },
        el('span', { class: 'key', 'aria-hidden': 'true', text: o.key }), el('span', { class: 'otext', text: o.text }), el('span', { class: 'mark' }));
      b.addEventListener('click', () => {
        if (done || b.disabled) return;
        if (first) { first = false; onFirst && onFirst(!!o.correct, o.key); }
        fb.textContent = '';
        if (o.correct) {
          done = true; b.classList.add('is-right'); b.querySelector('.mark').append(icon('ok'));
          opts.querySelectorAll('button').forEach(x => { x.disabled = true; });
          fb.className = 'feedback correct';
          fb.append(el('p', { class: 'fb-head' }, icon('ok'), el('b', { text: C.marks.correct })), explain && item.explain ? el('p', { text: item.explain }) : null);
          onCorrect && onCorrect();
        } else {
          b.classList.add('is-wrong'); b.disabled = true; b.querySelector('.mark').append(icon('no'));
          fb.className = 'feedback wrong';
          fb.append(el('p', { class: 'fb-head' }, icon('no'), el('b', { text: C.marks.wrong })), el('p', { text: o.hint || C.levels.minimalHint }));
        }
      });
      opts.append(b);
    });
    return el('div', { class: 'mini' }, box, fb);
  }

  // ═════ شريط المستوى وصندوقه في كل شاشة ═════
  function setLevel(n) {
    if (n === level()) return;
    S.update(s => { s.level = n; });
    event('level_change', A().current(), 'l' + n);
    A().toast(fill(L.changed, { n }));
    A().render();
  }
  function levelBar() {
    const { el } = A();
    const n = level();
    return el('nav', { class: 'lvl-bar', 'aria-label': L.title },
      el('span', { class: 'lvl-label', text: L.title }),
      el('div', { class: 'lvl-seg', role: 'group', 'aria-label': L.title }, [1, 2, 3].map(k =>
        el('button', { type: 'button', class: 'lvl-btn', 'aria-pressed': String(k === n), title: L.about[k], onclick: () => setLevel(k) },
          el('span', { class: 'lvl-num', 'aria-hidden': 'true', text: ar(k) }), el('span', { text: L.names[k] })))));
  }
  function levelBox(screenNo) {
    const { el } = A();
    const n = level(), T = L.screens[screenNo];
    if (!T) return null;
    if (n === 1) return el('aside', { class: 'lvl-box l1' }, el('p', { class: 'lvl-box-title', text: L.focusLabel + ' (' + L.names[1] + ')' }), el('p', { text: T.focus }));
    const [q, ans] = n === 2 ? T.why : T.whatif;
    const ansP = el('p', { class: 'think-ans', hidden: true, text: ans });
    const btn = el('button', { type: 'button', class: 'btn small-btn', 'aria-expanded': 'false', text: L.show });
    btn.addEventListener('click', () => {
      const open = ansP.hidden; ansP.hidden = !open; btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? L.hide : L.show;
      if (open && n === 3) { S.update(s => { s.counts = s.counts || { remediation: 0, enrichment: 0 }; s.counts.enrichment++; }); event('enrichment', screenNo, 'whatif'); }
    });
    return el('aside', { class: 'lvl-box l' + n }, el('p', { class: 'lvl-box-title', text: L.thinkLabel[n] + ' (' + L.names[n] + ')' }),
      el('p', { class: 'think-q', text: q }), el('p', { class: 'small', text: L.thinkNote }), btn, ansP);
  }
  function collabBlock() {
    const { el } = A(), K = C.collab;
    return el('details', { class: 'collab4' }, el('summary', { text: K.title }),
      el('p', { class: 'small', text: K.lead }),
      el('ul', { class: 'roles' }, K.roles.map(([r, d]) => el('li', {}, el('b', { text: r + ': ' }), el('span', { text: d })))),
      el('ol', {}, K.steps.map(t => el('li', { text: t }))),
      el('p', { class: 'small', text: K.alone }));
  }

  // ═════ النتيجة: نتائج منفصلة + اختبار المستوى + الخطة العلاجية ═════
  function resultsCard() {
    const { el } = A(), s = S.get(), a0 = s.quiz && s.quiz.attempts[0];
    return el('section', { class: 'lvl-results' }, el('h2', { class: 'corr-title', text: L.resultsTitle }),
      el('ul', {}, el('li', { text: fill(L.resultsBasic, { s: a0 && a0.finished ? a0.score : 0 }) }),
        [1, 2, 3].map(k => el('li', { text: s.levelResults[k] ? fill(L.resultsLevel, { n: k, s: s.levelResults[k].score }) : fill(L.resultsLevel, { n: k, s: '—' }).replace('— من ٣', L.resultsNone) }))));
  }
  function levelQuiz() {
    const { el } = A(), n = level(), items = L.quizzes[n];
    const wrap = el('section', { class: 'lvl-quiz' }, el('h2', { class: 'corr-title', text: fill(L.quizTitle, { n, name: L.names[n] }) }),
      el('p', { class: 'small', text: L.quizNote }));
    const area = el('div', {});
    const startBtn = el('button', { type: 'button', class: 'btn primary', text: L.quizStart });
    const draw = () => {
      area.textContent = '';
      const firsts = {};
      let correct = 0;
      const summary = el('div', { class: 'lq-summary', 'aria-live': 'polite' });
      items.forEach((it, i) => area.append(miniQuestion(it, {
        onFirst: ok => { firsts[i] = ok; if (Object.keys(firsts).length === items.length) record(); },
        onCorrect: () => { correct++; if (correct === items.length) summarize(); },
      })));
      area.append(summary);
      function record() {
        if (!S.get().levelResults[n] || S.get().levelResults[n].restored) {
          const score = Object.values(firsts).filter(Boolean).length;
          if (!S.get().levelResults[n]) {
            S.update(s => { s.levelResults[n] = { score, total: 3 }; });
            event('level_quiz', 6, 'l' + n + '_' + score);
          }
        }
      }
      function summarize() {
        const r = S.get().levelResults[n]; if (!r) return;
        summary.textContent = '';
        summary.append(el('p', { class: 'score6', text: fill(L.quizResult, { n, s: r.score }) }),
          el('p', { text: r.score >= 2 ? (n === 3 ? L.quizDoneAll : L.quizPass) : L.quizFail }));
        if (r.score >= 2 && n < 3) summary.append(el('button', { type: 'button', class: 'btn primary', text: fill(L.nextLevel, { n: n + 1 }), onclick: () => setLevel(n + 1) }));
        summary.append(el('button', { type: 'button', class: 'btn', text: L.quizPractice, onclick: draw }));
      }
    };
    startBtn.addEventListener('click', () => { startBtn.remove(); draw(); });
    wrap.append(startBtn, area);
    return wrap;
  }
  function remedialPlan(goalsOk) {
    const { el, go } = A(), R = C.remedial, goals = C.screens[0].objectives.items, n = level();
    const link = { 1: 2, 2: 3, 3: 4, 4: 5 };
    const missing = goalsOk.map((ok, i) => ok ? null : i + 1).filter(Boolean);
    if (!missing.length) return null;
    const sec = el('section', { class: 'rem-plan' }, el('h2', { class: 'corr-title', text: R.title }),
      el('p', { class: 'small', text: R.lead }), el('p', { class: 'small', text: R.levelNote + R.levelHint[n] }));
    missing.forEach(g => {
      const s = link[g];
      const passed = !!(S.get().remedial || {})[g];
      const card = el('div', { class: 'rem-goal' + (passed ? ' passed' : '') }, el('h3', { text: goals[g - 1].text }),
        el('ol', {}, R.steps.map(t => el('li', { text: fill(t, { s, a: R.activity[g] }) }))),
        el('button', { type: 'button', class: 'btn', text: fill(R.goTo, { s }), onclick: () => { S.update(x => { x.reviewReturn = true; }); event('remediation', s, 'g' + g + '_open'); go(s); } }));
      const checkArea = el('div', {});
      if (passed) checkArea.append(el('p', { class: 'rem-ok', text: R.passed }));
      else {
        const b = el('button', { type: 'button', class: 'btn primary', text: R.check });
        b.addEventListener('click', () => {
          b.remove();
          checkArea.append(miniQuestion(R.checks[g], {
            explain: false,
            onCorrect: () => {
              S.update(x => { x.remedial = x.remedial || {}; x.remedial[g] = true; x.counts = x.counts || { remediation: 0, enrichment: 0 }; x.counts.remediation++; });
              event('remediation', s, 'g' + g + '_pass');
              checkArea.append(el('p', { class: 'rem-ok', text: R.passed }));
            },
          }));
        });
        checkArea.append(b);
      }
      card.append(checkArea);
      sec.append(card);
    });
    return sec;
  }

  // ═════ الدعم الفني (6.2.2 و9.1.1) ═════
  const newRef = () => 'ECO-' + Array.from(crypto.getRandomValues(new Uint8Array(6)), x => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');
  function supportBlock(screenNo) {
    const { el } = A(), P = C.support;
    const box = el('section', { class: 'support-box', 'aria-labelledby': 'sup-h' }, el('h3', { id: 'sup-h', text: P.title }));
    if (!CFG.supportEmail || !CFG.supportEmailConfirmed) { box.append(el('p', { class: 'small', text: P.off })); return box; }
    const ref = newRef();
    const body = fill(P.body, { ref }) + (Number.isInteger(screenNo) ? '\n\n(الشاشة ' + screenNo + '، المستوى ' + level() + ')' : '');
    const href = 'mailto:' + CFG.supportEmail + '?subject=' + encodeURIComponent(fill(P.subject, { ref })) + '&body=' + encodeURIComponent(body);
    box.append(el('p', { class: 'small', text: P.selfFirst }),
      el('p', {}, el('a', { href: 'support.html', text: P.selfHelp })),
      el('p', { class: 'small warn', role: 'note', text: P.warn }),
      el('a', { class: 'btn wide', href, text: P.link + ' (' + ref + ')' }),
      el('p', { class: 'small', dir: 'auto' }, el('span', { text: fill(P.address, { e: '' }) }), el('span', { dir: 'ltr', class: 'email', text: CFG.supportEmail })),
      el('p', { class: 'small', text: P.noApp }),
      el('p', { class: 'small', text: P.time }),
      el('p', { class: 'small', text: fill(P.follow, { ref }) }),
      el('p', { class: 'small', text: P.minor }));
    return box;
  }

  // ═════ أرسل ملاحظتك (9.2.3) ═════
  function feedbackForm(screenNo) {
    const { el } = A(), F = C.feedback;
    const id = 'fb-' + Math.random().toString(36).slice(2, 7);
    const fs = el('fieldset', { class: 'fb-kinds' }, el('legend', { text: F.kind }),
      Object.entries(F.cats).map(([k, t]) => el('label', { class: 'check-row' }, el('input', { type: 'radio', name: id + '-k', value: k }), el('span', { text: t }))));
    const ta = el('textarea', { id: id + '-m', rows: 3, maxlength: 500, dir: 'auto' });
    const count = el('span', { class: 'small', 'aria-live': 'off', text: ar(0) + ' / ٥٠٠' });
    ta.addEventListener('input', () => { count.textContent = ar(ta.value.length) + ' / ٥٠٠'; });
    const msg = el('p', { class: 'fb-msg', role: 'status', hidden: true });
    const btn = el('button', { type: 'submit', class: 'btn primary', text: F.send });
    const form = el('form', { class: 'fb-form', novalidate: true }, fs,
      el('label', { for: id + '-m', class: 'fb-label', text: F.message }), ta, count,
      el('p', { class: 'small', text: F.privacy }), btn, msg);
    const show = (t, ok) => { msg.hidden = false; msg.textContent = t; msg.className = 'fb-msg ' + (ok ? 'ok' : 'err'); };
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const k = (form.querySelector('input[type=radio]:checked') || {}).value, m = ta.value.trim();
      if (!k || m.length < 3) return show(F.invalid, false);
      if (API && API.enabled) {
        btn.disabled = true;
        try {
          const r = await API.rpc('rpc_submit_feedback', { category: k, message: m, screen: screenNo || 0, lang: 'ar', session });
          if (r && r.ok) { show(fill(F.sent, { ref: r.ref }), true); ta.value = ''; count.textContent = ar(0) + ' / ٥٠٠'; }
          else show(r && r.error === 'too_many' ? F.tooMany : F.failed, false);
        } catch (e) { show(F.failed, false); } finally { btn.disabled = false; }
      } else if (CFG.supportEmail && CFG.supportEmailConfirmed) {
        // دون خادم: رسالة بريد جاهزة إلى مدير الموقع وحده
        location.href = 'mailto:' + CFG.supportEmail + '?subject=' + encodeURIComponent(fill(F.mailSubject, { c: F.cats[k] })) + '&body=' + encodeURIComponent(m + '\n\n(الشاشة ' + (screenNo || 0) + ')');
        show(F.viaMail, true);
      } else show(F.failed, false);
    });
    return el('section', { class: 'fb-box', 'aria-labelledby': id + '-h' }, el('h3', { id: id + '-h', text: F.title }), el('p', { class: 'small', text: F.lead }), form);
  }

  // ═════ نقاط الربط ═════
  return {
    help(box, n) { box.append(supportBlock(n), feedbackForm(n)); },
    hintMode() { const n = level(); return n === 1 ? 'supported' : n === 3 ? 'minimal' : 'standard'; },
    error(id) { origUpdate(s => { s.errors = s.errors || {}; s.errors[id] = Math.min((s.errors[id] || 0) + 1, 1000); }); scheduleSync(); },
    event,
    screen(n, main) {
      event('screen_view', n);
      if (me && me.role === 'student' && migrationPending()) {
        const { el } = A();
        main.prepend(el('p', { class: 'mig-banner', role: 'status' }, el('span', { text: C.accounts.migrateBanner + ' ' }), el('a', { href: 'account.html', text: C.accounts.open })));
      }
      const h = main.querySelector('h1');
      const bar = levelBar(), box = levelBox(n);
      if (h) h.after(bar); else main.prepend(bar);
      if (box) bar.after(box);
      if (n === 4) { const peer = main.querySelector('.peer4'); const c = collabBlock(); if (peer) peer.after(c); else main.append(c); }
    },
    quizDone(score, first) {
      if (first) event('lesson_complete', 6, 's' + score, Date.now() - t0);
      scheduleSync();
    },
    result(body, last, isRetake, goalsOk) {
      if (!isRetake && !last.restored && !S.get().firstGoals) origUpdate(s => { s.firstGoals = goalsOk.slice(); });
      const goals = last.restored ? (S.get().firstGoals || [true, true, true, true]) : goalsOk;
      const plan = remedialPlan(goals);
      if (plan) body.append(plan);
      body.append(resultsCard(), levelQuiz());
      scheduleSync();
    },
    menu(box) {
      const { el } = A();
      const n = level();
      box.append(el('h3', { text: L.title }), el('p', { class: 'small', text: L.note }),
        el('div', { class: 'lvl-seg menu-lvl', role: 'group', 'aria-label': L.title }, [1, 2, 3].map(k =>
          el('button', { type: 'button', class: 'lvl-btn', 'aria-pressed': String(k === n), onclick: () => { A().closeLayer(true); setLevel(k); } },
            el('span', { class: 'lvl-num', 'aria-hidden': 'true', text: ar(k) }), el('span', { text: L.names[k] + ' — ' + L.short[k] })))),
        el('p', { class: 'small', text: L.about[n] }));
      if (API && API.enabled) {
        box.append(el('a', { class: 'btn wide', href: 'account.html', text: C.accounts.open }));
        if (!API.signedIn()) {
          const cb = el('input', { type: 'checkbox', id: 'an-toggle' });
          cb.checked = S.get().settings.analytics === true;
          cb.addEventListener('change', () => S.update(s => { s.settings.analytics = cb.checked; }));
          box.append(el('label', { class: 'check-row', for: 'an-toggle' }, cb, el('span', { text: C.privacy.analytics })), el('p', { class: 'small', text: C.privacy.analyticsNote }));
        }
      }
      box.append(el('p', { class: 'small' }, el('a', { href: 'guides/student.html', text: C.accounts.studentGuide })), supportBlock());
    },
    // للاختبارات وصفحة الحساب
    _snapshot: snapshot, _migrationPending: migrationPending,
  };
})();
