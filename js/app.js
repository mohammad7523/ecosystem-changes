// منطق الواجهة. كل النصوص تأتي من content.js، وتُعرض بـ textContent فقط.
'use strict';

(() => {
  const C = window.CONTENT;
  const S = window.Store;
  const $ = s => document.querySelector(s);
  const AR = '٠١٢٣٤٥٦٧٨٩';
  const ar = n => String(n).replace(/\d/g, d => AR[d]);
  const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => ar(v[k]));
  const pick = path => path.split('.').reduce((o, k) => o && o[k], C);

  // إنشاء عنصر: النصوص دائمًا عبر textContent
  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null) n.append(c instanceof Node ? c : document.createTextNode(c));
    return n;
  }
  // صورة بنسختين: ٧٢٠ بكسل للهاتف والأصلية للشاشات الأكبر أو الأعلى كثافة (10.5)
  const SZ = {
    full: '(max-width: 860px) calc(100vw - 32px), 828px',
    half700: '(max-width: 699px) calc(100vw - 32px), (max-width: 860px) calc(50vw - 23px), 407px',
    half640: '(max-width: 639px) calc(100vw - 32px), (max-width: 860px) calc(50vw - 23px), 407px',
    side760: '(max-width: 759px) calc(100vw - 32px), 440px'
  };
  function pic(o, extra = {}, sz = 'full') {
    return el('img', Object.assign({ src: o.src, srcset: o.small ? o.small + ' 720w, ' + o.src + ' ' + o.width + 'w' : null,
      sizes: o.small ? SZ[sz] : null, alt: o.alt, width: o.width, height: o.height, decoding: 'async' }, extra));
  }
  // أيقونات ثابتة من الكود نفسه (لا تحمل نصًا من مدخلات)
  const ICONS = {
    change: '<path d="M6 16a10 10 0 0 1 17-7l3-3v9h-9l3-3a6 6 0 0 0-10 4z"/><path d="M26 16a10 10 0 0 1-17 7l-3 3v-9h9l-3 3a6 6 0 0 0 10-4z"/>',
    sort: '<path d="M8 6c6 0 9 4 9 10-6 0-9-4-9-10z"/><path d="M17 16v10"/><rect x="20" y="6" width="8" height="8" rx="2"/><path d="M22 18l4 4m0-4l-4 4"/>',
    move: '<circle cx="9" cy="22" r="3"/><circle cx="16" cy="14" r="3"/><path d="M20 10h8m-3-3 3 3-3 3"/>',
    protect: '<path d="M16 3l11 4v8c0 7-5 11-11 14C10 26 5 22 5 15V7z"/><path d="M11 17c4 0 6-3 6-7-4 0-6 3-6 7zm0 0 6-6"/>',
    ok: '<path d="M6 17l7 7L27 9"/>',
    no: '<path d="M9 9l14 14M23 9 9 23"/>',
    info: '<circle cx="16" cy="16" r="12"/><path d="M16 14v9M16 9v1"/>',
    sprout: '<path d="M16 28V15"/><path d="M16 17c0-6-4-9-10-9 0 6 4 9 10 9zM16 15c0-5 3-8 9-8 0 5-3 8-9 8z"/>',
    stone: '<path d="M5 24l4-10 8-4 9 5 2 9z"/><path d="M12 16l3 3"/>',
    pause: '<rect x="9" y="8" width="5" height="16" rx="1"/><rect x="18" y="8" width="5" height="16" rx="1"/>',
    replay: '<path d="M8 12a9 9 0 1 1-1 8"/><path d="M7 5v7h7"/>',
    cc: '<rect x="4" y="7" width="24" height="18" rx="3"/><path d="M14 13a3 3 0 1 0 0 6M23 13a3 3 0 1 0 0 6"/>',
    play: '<path d="M10 7v18l15-9z"/>',
    stop: '<rect x="9" y="9" width="14" height="14" rx="2"/>',
    search: '<circle cx="14" cy="14" r="8"/><path d="M20 20l7 7"/>',
  };
  function icon(name, cls = 'ico') {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 32 32'); s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name];
    return s;
  }
  const announce = t => { const l = $('#live'); l.textContent = ''; setTimeout(() => { l.textContent = t; }, 50); };

  // ---------- الإعدادات ----------
  function applySettings() {
    const st = S.get().settings, r = document.documentElement.classList;
    r.toggle('large', st.large); r.toggle('contrast', st.contrast);
  }

  // ---------- طبقات الحوار (نافذة منبثقة واحدة في كل مرة) ----------
  let lastFocus = null;
  function openLayer(node, { label, onEscape, panel } = {}) {
    closeLayer(true);
    lastFocus = document.activeElement;
    const box = el('div', { class: panel ? 'panel' : 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': label });
    box.append(node);
    const back = el('div', { class: 'backdrop', onclick: e => { if (e.target === back && onEscape) onEscape(); } }, box);
    back._esc = onEscape;
    $('#layer').append(back);
    document.body.classList.add('locked');
    const first = box.querySelector('button, [href], input, summary');
    (first || box).focus();
    return box;
  }
  function closeLayer(silent) {
    const l = $('#layer');
    if (!l.firstChild) return;
    l.textContent = '';
    document.body.classList.remove('locked');
    if (!silent && lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  document.addEventListener('keydown', e => {
    const back = $('#layer').firstChild;
    if (!back) return;
    if (e.key === 'Escape' && back._esc) { e.preventDefault(); back._esc(); }
    if (e.key === 'Tab') { // إبقاء التركيز داخل النافذة
      const f = [...back.querySelectorAll('button, [href], input, summary')].filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });
  function confirmBox(cfg, onYes, yesKey = 'yes', noKey = 'no', onNo = null) {
    const no = () => { if (onNo) { closeLayer(true); onNo(); } else closeLayer(); }; // onNo: إعادة الطبقة السابقة (نهاية الجلسة)
    const node = el('div', {},
      el('p', { class: 'dialog-text', text: cfg.text }),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn', text: cfg[noKey], onclick: no }),
        el('button', { type: 'button', class: 'btn primary', text: cfg[yesKey], onclick: () => { closeLayer(true); onYes(); } })));
    openLayer(node, { label: cfg.text, onEscape: no });
  }

  // ---------- الترحيب وسؤال الجهاز (قا١٩) ----------
  function welcome() {
    const W = C.welcome;
    const body = el('div', { class: 'welcome' });
    const choose = device => {
      S.update(s => { s.device = device; s.save = false; });
      body.querySelector('.choices').remove();
      if (device === 'shared') {
        body.append(el('p', { class: 'note-box', text: W.sharedNote }), startBtn());
      } else {
        const saveRow = el('div', { class: 'choices' },
          el('p', { class: 'q', text: W.saveQ }),
          el('div', { class: 'row' },
            el('button', { type: 'button', class: 'btn', text: W.saveYes, onclick: () => { S.setSave(true); saveRow.remove(); body.append(startBtn()); } }),
            el('button', { type: 'button', class: 'btn', text: W.saveNo, onclick: () => { S.setSave(false); saveRow.remove(); body.append(startBtn()); } })));
        body.append(saveRow);
      }
      const f = body.querySelector('button'); if (f) f.focus();
    };
    const startBtn = () => {
      const b = el('button', { type: 'button', class: 'btn primary wide', text: W.start, onclick: () => { closeLayer(true); go(1); } });
      setTimeout(() => b.focus(), 0);
      return b;
    };
    body.append(
      el('h2', { text: W.title }),
      el('p', { text: W.text }),
      el('div', { class: 'choices' },
        el('p', { class: 'q', text: W.deviceQ }),
        el('div', { class: 'row' },
          el('button', { type: 'button', class: 'btn', text: W.mine, onclick: () => choose('mine') }),
          el('button', { type: 'button', class: 'btn', text: W.shared, onclick: () => choose('shared') }))),
      el('p', { class: 'small', text: W.note }));
    // إغلاق السؤال دون اختيار = جهاز مشترك (الافتراضي الآمن)
    openLayer(body, { label: W.title, onEscape: () => { if (!S.get().device) S.update(s => { s.device = 'shared'; }); closeLayer(); } });
  }

  // ---------- التقدم ----------
  function renderProgress(n) {
    $('#progress-label').textContent = fill(C.site.progress, { n });
    const ol = $('#progress-steps'); ol.textContent = '';
    const done = S.get().done;
    C.screens.forEach(sc => {
      const isDone = done.includes(sc.id);
      const li = el('li', { class: 'step' + (sc.id === n ? ' current' : '') + (isDone ? ' done' : ''), 'aria-current': sc.id === n ? 'step' : null },
        el('span', { class: 'dot', 'aria-hidden': 'true', text: isDone ? '★' : ar(sc.id) }),
        el('span', { class: 'step-name', text: sc.short }),
        isDone ? el('span', { class: 'sr-only', text: fill(C.site.screenDone, { n: sc.id }) }) : null);
      ol.append(li);
    });
  }

  // ---------- الصوت ----------
  let player = null;
  function listenButton(src, statusEl) {
    if (!src) return document.createComment('audio-pending'); // 10.6: لا زر لصوت غير موجود، ولا تشغيل لتسجيل لا يطابق النص
    const btn = el('button', { type: 'button', class: 'btn listen', 'aria-pressed': 'false' });
    const setUi = playing => {
      btn.textContent = '';
      btn.append(icon(playing ? 'stop' : 'play'), el('span', { text: playing ? C.buttons.stopAudio : C.buttons.listen }));
      btn.setAttribute('aria-pressed', String(playing));
    };
    setUi(false);
    btn.addEventListener('click', () => {
      if (player && !player.paused) { player.pause(); player.currentTime = 0; setUi(false); return; }
      stopAudio();
      player = new Audio(src);
      player.addEventListener('ended', () => setUi(false));
      player.addEventListener('error', () => { setUi(false); statusEl.textContent = C.alerts.audioFail; });
      statusEl.textContent = '';
      player.play().then(() => setUi(true)).catch(() => { setUi(false); statusEl.textContent = C.alerts.audioFail; });
    });
    return btn;
  }
  let activeVideo = null;
  function stopAudio() { if (player) { player.pause(); player = null; } }
  function stopVideo() { if (activeVideo) { activeVideo.pause(); activeVideo = null; } }

  // ---------- الشاشة ١ ----------
  function screen1(sc) {
    const st = S.get();
    const wrap = el('section', { class: 'screen' });
    wrap.append(header(sc));

    const obj = el('details', { class: 'objectives', open: !st.done.includes(1) },
      el('summary', {}, el('span', { text: sc.objectives.heading })),
      el('p', { text: sc.objectives.lead }),
      el('ol', {}, sc.objectives.items.map((o, i) =>
        el('li', {}, icon(o.icon, 'obj-ico'), el('span', { class: 'num', 'aria-hidden': 'true', text: ar(i + 1) + '.' }), el('span', { text: o.text })))));
    // 10.6: الأهداف مسموعة أيضًا (AUD-13)
    if (sc.objectives.audio && !st.settings.muted) { const oStatus = el('p', { class: 'audio-status', role: 'status' }); obj.append(listenButton(sc.objectives.audio, oStatus), oStatus); }
    wrap.append(obj);

    // الصورة مع طبقة بطاقات المراجعة (تظهر بعد الخطأ الثاني)
    const cards = el('div', { class: 'review-cards', hidden: true },
      sc.reviewCards.map(c => {
        // أيقونة نبتة للحي وحجر لغير الحي (لا ✓/✗ حتى لا تُفهم صوابًا وخطأ)
        const card = el('p', { class: 'rcard ' + (c.living ? 'living' : 'nonliving') + ' a-' + c.align + ' p-' + (c.pointer || 'none') }, icon(c.living ? 'sprout' : 'stone'), el('b', { text: c.label }), el('span', { text: c.text }));
        if (c.align === 'right') card.style.right = (100 - c.x) + '%'; else card.style.left = c.x + '%'; // إحداثيات الصورة من يسارها
        card.style.top = c.y + '%';
        return card;
      }));
    const fig = el('figure', { class: 'scene' }, pic(sc.image), cards);
    wrap.append(fig);

    const audioStatus = el('p', { class: 'audio-status', role: 'status' });
    const instr = el('div', { class: 'instruction' }, el('p', { text: sc.instruction }));
    if (!st.settings.muted) instr.append(listenButton(sc.audio, audioStatus));
    wrap.append(instr, audioStatus);

    const qnode = choiceQuestion({
      screen: 1, id: 'q1', question: sc.question, options: sc.options, feedback: sc.feedback,
      showReview: on => { cards.hidden = !on; },
    });
    wrap.append(qnode);
    return wrap;
  }

  // ---------- سؤال اختيار من متعدد (قا٢: تلميح ← مراجعة مصورة ← الإجابة مع التفسير وإعادة التدريب) ----------
  // - أول إجابة في الجلسة تُسجَّل فور الضغط (صحيحة أو خاطئة) في diag، ولا تُستبدل أبدًا.
  // - المحاولات اللاحقة وإعادة التدريب تُسجَّل منفصلة في attempts (تدريب).
  // - الخيار الخاطئ الذي جُرّب يُقفل، فلا يُطلب من الطالب تكرار خطأ.
  //   إذا نفدت الخيارات الخاطئة قبل الخطأ الثالث (سؤال بخيارين خاطئين) تُعرض المراجعة المصورة
  //   والإجابة مع التفسير معًا عند الخطأ الثاني، بدل أن تبقى الإجابة الصحيحة متاحة بالحذف.
  // - قفل معالجة يمنع احتساب الضغط المزدوج أو المتكرر محاولةً إضافية.
  function choiceQuestion(cfg) {
    const fb = el('div', { class: 'feedback', 'aria-live': 'polite' });
    const opts = el('div', { class: 'options' });                              // اسم المجموعة من legend وحده (10.5: كان يُقرأ مرتين)
    const q = el('fieldset', { class: 'question' }, el('legend', { id: cfg.id, text: cfg.question }), opts);
    const box = el('div', {}, q, fb);
    let wrongs = 0, finished = false, busy = false;
    const tried = new Set();

    const optBtns = cfg.options.map((o, i) => {
      const b = el('button', { type: 'button', class: 'option', 'data-i': i },
        el('span', { class: 'key', 'aria-hidden': 'true', text: o.key }), el('span', { class: 'otext', text: o.text }), el('span', { class: 'mark' }));
      b.addEventListener('click', () => answer(i));
      opts.append(b);
      return b;
    });
    const rightIdx = cfg.options.findIndex(x => x.correct);
    const wrongTotal = cfg.options.length - 1;

    function showFeedback(kind, text, extra) {
      fb.textContent = '';
      fb.className = 'feedback ' + kind;
      const word = kind === 'correct' ? C.marks.correct : kind === 'reveal' ? C.marks.reveal : C.marks.wrong;
      fb.append(el('p', { class: 'fb-head' }, icon(kind === 'correct' ? 'ok' : kind === 'reveal' ? 'info' : 'no'), el('b', { text: word })), el('p', { text }));
      if (extra) fb.append(...[].concat(extra).filter(Boolean));
      fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    function markBtn(b, kind) {
      b.classList.add(kind);
      const m = b.querySelector('.mark'); m.textContent = '';
      m.append(icon(kind === 'is-right' ? 'ok' : 'no'), el('span', { class: 'sr-only', text: kind === 'is-right' ? C.marks.correct : C.marks.wrong }));
    }
    function record(i) {
      const o = cfg.options[i];
      S.update(s => {
        s.diag = s.diag || {};
        if (!s.diag[cfg.screen]) s.diag[cfg.screen] = { choice: o.key, correct: !!o.correct }; // الإجابة الأولى فقط
        const a = s.attempts[cfg.screen] || { rounds: 1, total: 0 };
        a.total++;                                                                        // كل محاولة بعد الأولى تدريب
        s.attempts[cfg.screen] = a;
      });
    }
    function complete() {
      finished = true;
      optBtns.forEach(b => { b.disabled = true; });
      S.update(s => { if (!s.done.includes(cfg.screen)) s.done.push(cfg.screen); });
      renderProgress(cfg.screen);
      if (cfg.onComplete) cfg.onComplete();
    }
    function reveal() {
      markBtn(optBtns[rightIdx], 'is-right');
      if (cfg.showReview) cfg.showReview(true);
      const again = el('button', { type: 'button', class: 'btn', text: C.buttons.retrain, onclick: retrain });
      showFeedback('reveal', cfg.feedback.wrong3, [cfg.reviewButton ? cfg.reviewButton() : null, again]);
      complete();
    }
    function answer(i) {
      const b = optBtns[i];
      if (finished || busy || tried.has(i)) return;
      busy = true;                         // يُفك بعد عرض التوجيه
      optBtns.forEach(x => x.setAttribute('aria-busy', 'true'));
      record(i);
      if (cfg.options[i].correct) {
        markBtn(b, 'is-right');
        // الإثراء عند الإتقان فقط: الإجابة الأولى في الجلسة صحيحة (القرار ٤)، لا بعد خطأ أو إعادة تدريب
        const mastered = S.get().diag[cfg.screen]?.correct === true && wrongs === 0;
        showFeedback('correct', cfg.feedback.correct, mastered && cfg.enrichment ? cfg.enrichment() : null);
        complete();
      } else {
        wrongs++; tried.add(i);
        markBtn(b, 'is-wrong'); b.disabled = true;
        const noWrongLeft = tried.size >= wrongTotal;
        if (wrongs >= 3 || (wrongs >= 2 && noWrongLeft)) reveal();
        else if (wrongs === 2) { if (cfg.showReview) cfg.showReview(true); showFeedback('wrong', cfg.feedback.wrong2, cfg.reviewButton ? cfg.reviewButton() : null); }
        else showFeedback('wrong', cfg.options[i].hint || cfg.feedback.wrong1); // 10.6: تلميح بحسب الخيار الخاطئ نفسه
      }
      setTimeout(() => { busy = false; optBtns.forEach(x => x.removeAttribute('aria-busy')); }, 350);
    }
    function retrain() {
      wrongs = 0; finished = false; busy = false; tried.clear();
      if (cfg.showReview) cfg.showReview(false);
      optBtns.forEach(b => { b.disabled = false; b.className = 'option'; b.querySelector('.mark').textContent = ''; });
      fb.textContent = ''; fb.className = 'feedback';
      S.update(s => { const a = s.attempts[cfg.screen] || { rounds: 1, total: 0 }; a.rounds++; s.attempts[cfg.screen] = a; });
      optBtns[0].focus();
    }
    return box;
  }

  // ---------- الشاشة ٢ (النموذج: صورتا المقارنة فقط) ----------
  function screen2(sc) {
    const wrap = el('section', { class: 'screen' }, header(sc), el('p', { class: 'transition', text: sc.transition }));
    const st = S.get();
    const aStatus = el('p', { class: 'audio-status', role: 'status' });
    const instr = el('div', { class: 'instruction' }, el('p', { class: 'instruction-text', text: sc.instruction }));
    if (sc.audio && !st.settings.muted) instr.append(listenButton(sc.audio, aStatus)); // AUD-14 (10.6)
    wrap.append(instr, aStatus);
    // 10.6: التنبؤ قبل المشاهدة — لا درجة، ولا يُحفظ على الجهاز (الجلسة فقط)، ولا يُغلق الفيديو
    const P = sc.predict;
    const pStatus = el('p', { class: 'small predict-status', role: 'status' });
    const pBtns = P.options.map((t, i) => el('button', { type: 'button', class: 'choice3 pbtn', 'aria-pressed': String(st.predict === i), text: t, onclick: () => {
      S.update(s => { s.predict = i; });
      pBtns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
      pStatus.textContent = P.saved;
    } }));
    if (typeof st.predict === 'number') pStatus.textContent = P.saved;
    wrap.append(el('fieldset', { class: 'predict2' }, el('legend', { text: P.title }), el('p', { class: 'pq', text: P.question }),
      el('div', { class: 'choices3' }, pBtns), pStatus));
    wrap.append(videoBlock(sc.video));
    const cmpLine = el('p', { class: 'predict-compare', hidden: true });
    const showCompare = () => { const v = S.get().predict; if (typeof v === 'number') { cmpLine.textContent = fill(P.compare, { p: '«' + P.options[v] + '»' }); cmpLine.hidden = false; } };

    // صورتا المقارنة مع بطاقات المراجعة المصورة (تظهر عند الخطأ الثاني وتكبر الصورتان)
    const compare = el('div', { class: 'compare', tabindex: '-1' }, sc.compare.map((c, i) =>
      el('figure', { class: 'cmp ' + (i ? 'after' : 'before') },
        el('div', { class: 'cmp-img' },
          pic(c, {}, 'half700'),
          el('div', { class: 'review-cards', hidden: true }, c.cards.map(k => {
            const card = el('p', { class: 'rcard info ' + (i ? 'after' : 'before') + ' p-none' }, el('b', { text: k.label + ':' }), el('span', { text: k.text }));
            card.style.left = k.x + '%'; card.style.top = k.y + '%';
            return card;
          }))),
        el('figcaption', { text: c.caption }))));
    wrap.append(compare);

    const showReview = on => {
      compare.classList.toggle('review', on);
      compare.querySelectorAll('.review-cards').forEach(r => { r.hidden = !on; });
    };
    const reviewButton = () => el('button', { type: 'button', class: 'btn', text: sc.reviewAgain, onclick: () => {
      showReview(true);
      compare.scrollIntoView({ block: 'start', behavior: 'smooth' });
      compare.focus({ preventScroll: true });
    } });
    const enrichment = () => {
      const card = el('aside', { class: 'enrich' },
        el('p', { class: 'enrich-title', text: C.buttons.enrichTitle }),
        el('p', { text: sc.enrichment }),
        el('button', { type: 'button', class: 'btn small-btn', text: C.buttons.skip, onclick: () => card.remove() }));
      return card;
    };
    wrap.append(choiceQuestion({
      screen: 2, id: 'q2', question: sc.question, options: sc.options, feedback: sc.feedback,
      showReview, reviewButton, enrichment, onComplete: showCompare,
    }));
    wrap.append(cmpLine);
    if (S.get().done.includes(2)) showCompare();
    return wrap;
  }

  // ---------- مشغل الفيديو: أزرار عربية كبيرة، ترجمة، نص مكتوب، وبديل عند التعذر ----------
  const mmss = t => { t = Math.max(0, Math.floor(t || 0)); return ar(Math.floor(t / 60)) + ':' + ar(String(t % 60).padStart(2, '0')); };
  function videoBlock(v) {
    const st = S.get();
    const vid = el('video', { preload: 'metadata', poster: v.poster, playsinline: true, width: v.width || 1280, height: v.height || 720, 'aria-label': v.label || C.screens[1].title });
    const dur = v.duration || 60;
    // مسار ترجمة يُبنى من نصوص content.js مباشرة، فلا يعتمد على تحميل ملف إضافي
    const track = vid.addTextTrack('captions', 'العربية', 'ar');
    v.cues.forEach(([a, b, t]) => track.addCue(new VTTCue(a, b, t)));
    const setCaptions = on => { track.mode = on ? 'showing' : 'hidden'; capBtn.setAttribute('aria-pressed', String(on)); };

    const playBtn = el('button', { type: 'button', class: 'btn primary' });
    const setPlayUi = playing => { playBtn.textContent = ''; playBtn.append(icon(playing ? 'pause' : 'play'), el('span', { text: playing ? C.buttons.pause : C.buttons.play })); };
    setPlayUi(false);
    const replayBtn = el('button', { type: 'button', class: 'btn' }, icon('replay'), el('span', { text: C.buttons.replay }));
    const capBtn = el('button', { type: 'button', class: 'btn', 'aria-pressed': String(st.settings.captions) }, icon('cc'), el('span', { text: C.buttons.captions }));
    const trBtn = el('button', { type: 'button', class: 'btn', 'aria-expanded': 'false' }, el('span', { text: C.buttons.transcript }));
    const time = el('span', { class: 'vtime', 'aria-hidden': 'true', text: mmss(0) + ' / ' + mmss(dur) });
    const bar = el('div', { class: 'vbar', 'aria-hidden': 'true' }, el('span', {}));
    const transcript = el('p', { class: 'transcript', hidden: true, text: v.transcript });
    const fail = el('div', { class: 'vfail', role: 'alert', hidden: true },
      el('p', { text: v.fail }),
      el('button', { type: 'button', class: 'btn', text: C.buttons.retry, onclick: () => { fail.hidden = true; box.classList.remove('failed'); vid.src = v.src; vid.load(); } }));

    vid.src = v.src;
    vid.muted = !!st.settings.muted; // «الصوت: مكتوم» يكتم تعليق الفيديو أيضًا
    vid.addEventListener('loadedmetadata', () => { setCaptions(S.get().settings.captions); time.textContent = mmss(vid.currentTime) + ' / ' + mmss(vid.duration); });
    vid.addEventListener('timeupdate', () => { time.textContent = mmss(vid.currentTime) + ' / ' + mmss(vid.duration); bar.firstChild.style.width = (vid.currentTime / (vid.duration || dur) * 100) + '%'; });
    vid.addEventListener('play', () => setPlayUi(true));
    vid.addEventListener('pause', () => setPlayUi(false));
    vid.addEventListener('ended', () => setPlayUi(false));
    vid.addEventListener('error', () => {
      // يبقى الدرس ممكنًا: الصورتان أسفل الفيديو، والنص المكتوب يظهر تلقائيًا
      fail.hidden = false; box.classList.add('failed'); transcript.hidden = false; trBtn.setAttribute('aria-expanded', 'true'); setPlayUi(false);
    });
    playBtn.addEventListener('click', () => { if (vid.paused) { stopAudio(); vid.play().catch(() => {}); } else vid.pause(); });
    vid.addEventListener('click', () => playBtn.click());
    replayBtn.addEventListener('click', () => { vid.currentTime = 0; stopAudio(); vid.play().catch(() => {}); });
    capBtn.addEventListener('click', () => { const on = capBtn.getAttribute('aria-pressed') !== 'true'; S.update(s => { s.settings.captions = on; }); setCaptions(on); });
    trBtn.addEventListener('click', () => { transcript.hidden = !transcript.hidden; trBtn.setAttribute('aria-expanded', String(!transcript.hidden)); });

    const box = el('div', { class: 'video' + (v.portrait ? ' portrait' : '') }, el('div', { class: 'vframe' }, vid), bar,
      el('div', { class: 'vcontrols' }, playBtn, replayBtn, capBtn, time), fail, trBtn, transcript);
    if (!v.panel) activeVideo = vid; // فيديو المساعدة لا يحل محل فيديو الشاشة ٢
    return box;
  }
  // ---------- الشاشة ٣: تصنيف أربع صور (طبيعي / بفعل الإنسان) ----------
  // كل بطاقة سؤال بخيارين مستقل: أول اختيار لكل بطاقة يُسجَّل فورًا في diag[3] ولا يُستبدل.
  // مسار المحاولات لكل بطاقة كما في ملف النصوص: خطأ أول ← تلميح، خطأ ثانٍ ← مثال مبسط، خطأ ثالث ← الإجابة وتفسيرها و«إعادة التدريب».
  // لا يُقفل الخيار الخاطئ هنا: البطاقة لها خياران فقط، فالقفل يكشف الإجابة بعد أول خطأ ويُلغي التلميح والمثال المعتمدين.
  function screen3(sc) {
    const st = S.get();
    const wrap = el('section', { class: 'screen' }, header(sc), el('p', { class: 'transition', text: sc.transition }));
    const audioStatus = el('p', { class: 'audio-status', role: 'status' });
    const instr = el('div', { class: 'instruction' }, el('p', { text: sc.instruction }));
    if (!st.settings.muted) instr.append(listenButton(sc.audio, audioStatus));
    wrap.append(instr, audioStatus);

    const resolved = {};                       // بطاقات حُسمت في هذه الجولة (صحيحة أو بعد عرض الإجابة)
    let busy = false;
    const summary = el('div', { class: 'summary3', 'aria-live': 'polite' });
    const fillT = (t, card) => t.replace('{choice}', sc.choices[card.answer]).replace('{why}', card.why);

    const grid = el('div', { class: 'cards3' }, sc.cards.map((card, ci) => {
      const fb = el('div', { class: 'feedback small-fb', 'aria-live': 'polite' });
      let wrongs = 0;
      const labelId = 'c3-' + card.id;
      const btns = ['natural', 'human'].map(k => {
        const b = el('button', { type: 'button', class: 'choice3', 'data-k': k }, el('span', { class: 'otext', text: sc.choices[k] }), el('span', { class: 'mark' }));
        b.addEventListener('click', () => answer(k, b));
        return b;
      });
      const mark = (b, kind) => {
        b.classList.remove('is-right', 'is-wrong'); b.classList.add(kind);
        const m = b.querySelector('.mark'); m.textContent = '';
        m.append(icon(kind === 'is-right' ? 'ok' : 'no'), el('span', { class: 'sr-only', text: kind === 'is-right' ? C.marks.correct : C.marks.wrong }));
      };
      const clearMarks = () => btns.forEach(b => { b.classList.remove('is-right', 'is-wrong'); b.querySelector('.mark').textContent = ''; });
      const show = (kind, text, extra) => {
        fb.textContent = ''; fb.className = 'feedback small-fb ' + kind;
        const word = kind === 'correct' ? C.marks.correct : kind === 'reveal' ? C.marks.reveal : C.marks.wrong;
        fb.append(el('p', { class: 'fb-head' }, icon(kind === 'correct' ? 'ok' : kind === 'reveal' ? 'info' : 'no'), el('b', { text: word })), el('p', { text }));
        if (extra) fb.append(extra);
      };
      const resolve = () => { btns.forEach(b => { b.disabled = true; }); resolved[card.id] = true; fig.classList.add('done'); update(); };
      function answer(k, b) {
        if (busy || resolved[card.id]) return;
        busy = true;
        S.update(s => {
          s.diag[3] = s.diag[3] || {};
          if (!s.diag[3][card.id]) s.diag[3][card.id] = { choice: k, correct: k === card.answer }; // الإجابة الأولى لهذه الصورة فقط
          const a = s.attempts[3] || { rounds: 1, total: 0 }; a.total++; s.attempts[3] = a;
        });
        clearMarks();
        if (k === card.answer) { mark(b, 'is-right'); show('correct', fillT(sc.feedback.correct, card)); resolve(); }
        else {
          wrongs++; mark(b, 'is-wrong');
          if (wrongs === 1) show('wrong', (k === 'natural' ? sc.feedback.wrongAsNatural : sc.feedback.wrongAsHuman) || sc.feedback.wrong1); // 10.6: بحسب اتجاه الخطأ
          else if (wrongs === 2) show('wrong', sc.feedback.wrong2);
          else {
            mark(btns.find(x => x.dataset.k === card.answer), 'is-right');
            const again = el('button', { type: 'button', class: 'btn small-btn', text: C.buttons.retrain, onclick: retrain });
            show('reveal', fillT(sc.feedback.wrong3, card), again);
            resolve();
          }
        }
        setTimeout(() => { busy = false; }, 350);
      }
      function retrain() {
        wrongs = 0; delete resolved[card.id]; busy = false; fig.classList.remove('done');
        btns.forEach(b => { b.disabled = false; }); clearMarks();
        fb.textContent = ''; fb.className = 'feedback small-fb';
        S.update(s => { const a = s.attempts[3] || { rounds: 1, total: 0 }; a.rounds++; s.attempts[3] = a; });
        update(); btns[0].focus();
      }
      const fig = el('figure', { class: 'card3' },
        pic(card, {}, 'half640'),
        el('figcaption', {},
          el('p', { class: 'card3-label', id: labelId, text: ar(ci + 1) + '. ' + card.label }),
          el('div', { class: 'choices3', role: 'group', 'aria-labelledby': labelId }, btns),
          fb));
      return fig;
    }));
    wrap.append(grid, summary);

    let enrichShown = false;
    function update() {
      const all = sc.cards.every(c => resolved[c.id]);
      if (!all) { if (!enrichShown) summary.textContent = ''; return; }
      S.update(s => { if (!s.done.includes(3)) s.done.push(3); });
      renderProgress(3);
      if (summary.querySelector('.complete3')) return;
      summary.prepend(el('div', { class: 'feedback correct complete3' },
        el('p', { class: 'fb-head' }, icon('ok'), el('b', { text: C.marks.correct })), el('p', { text: sc.feedback.complete })));
      // الإثراء: فقط إذا كانت الإجابة الأولى للصور الأربع كلها صحيحة (القرار ٤)
      const d = S.get().diag[3] || {};
      if (!enrichShown && sc.cards.every(c => d[c.id] && d[c.id].correct)) { enrichShown = true; summary.append(enrichment3()); }
      summary.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    function enrichment3() {
      const E = sc.enrichment;
      const efb = el('div', { class: 'feedback small-fb', 'aria-live': 'polite' });
      const card = el('aside', { class: 'enrich' }, el('p', { class: 'enrich-title', text: C.buttons.enrichTitle }),
        E.image ? el('figure', { class: 'scene enrich-img' }, pic(E.image, { loading: 'lazy' })) : null,
        el('p', { class: 'enrich-q', text: E.question }));
      let ebusy = false;
      const eb = ['natural', 'human'].map(k => el('button', { type: 'button', class: 'choice3', text: sc.choices[k], onclick: () => {
        if (ebusy) return; ebusy = true; setTimeout(() => { ebusy = false; }, 350);
        if (k === E.answer) {
          eb.forEach(b => { b.disabled = true; b.classList.remove('is-wrong'); });
          eb[k === 'natural' ? 0 : 1].classList.add('is-right');
          efb.className = 'feedback small-fb correct'; efb.textContent = '';
          efb.append(el('p', { class: 'fb-head' }, icon('ok'), el('b', { text: C.marks.correct })), el('p', { text: E.correct }));
        } else {
          eb[k === 'natural' ? 0 : 1].classList.add('is-wrong');
          efb.className = 'feedback small-fb wrong'; efb.textContent = '';
          efb.append(el('p', { class: 'fb-head' }, icon('no'), el('b', { text: C.marks.wrong })), el('p', { text: E.wrong }));
        }
      } }));
      card.append(el('div', { class: 'choices3', role: 'group', 'aria-label': E.question }, eb), efb,
        el('button', { type: 'button', class: 'btn small-btn', text: C.buttons.skip, onclick: () => card.remove() }));
      return card;
    }
    return wrap;
  }

  // ---------- الشاشة ٤: مناقشة ثم تفسير مكتوب (قا٦، قا١٥، قا١٧-ب) ----------
  // النص المكتوب يبقى في ذاكرة الجلسة فقط (s4) ولا يُنسخ إلى الجهاز ولا يُرسل إلى أي جهة، ولا يُقيَّم آليًا.
  // الإجابة الأولى تُقفل عند الحفظ ولا تُعدَّل؛ «حسّن إجابتي» يحفظ إجابة ثانية منفصلة.
  let timerId = null;
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
  function screen4(sc) {
    const st = S.get();
    const s4 = () => S.get().s4 || {};
    const wrap = el('section', { class: 'screen' }, header(sc), el('p', { class: 'transition', text: sc.transition }));
    const audioStatus = el('p', { class: 'audio-status', role: 'status' });
    const q = el('div', { class: 'instruction' }, el('p', { class: 'q4', text: sc.question }));
    if (!st.settings.muted) q.append(listenButton(sc.audio, audioStatus));
    wrap.append(q, audioStatus);
    wrap.append(el('figure', { class: 'scene wide' }, pic(sc.image)));

    // الخطوة ١ والمؤقت الاختياري: شريط يمتلئ بهدوء، بلا أرقام ولا صوت ولا انتقال تلقائي
    const bar = el('div', { class: 'tbar', 'aria-hidden': 'true' }, el('span', {}));
    const tmsg = el('p', { class: 'tmsg', role: 'status' });
    const tbtn = el('button', { type: 'button', class: 'btn', text: sc.timer.start });
    const setIdle = () => { stopTimer(); tbtn.textContent = sc.timer.start; tbtn.setAttribute('aria-pressed', 'false'); bar.hidden = true; bar.firstChild.style.width = '0%'; };
    tbtn.addEventListener('click', () => {
      if (timerId) { setIdle(); return; }                  // «إيقاف»
      tmsg.textContent = ''; bar.hidden = false; tbtn.textContent = sc.timer.stop; tbtn.setAttribute('aria-pressed', 'true');
      const t0 = Date.now(), total = sc.timer.seconds * 1000;
      timerId = setInterval(() => {
        const f = Math.min(1, (Date.now() - t0) / total);
        bar.firstChild.style.width = (f * 100) + '%';
        if (f >= 1) { setIdle(); tmsg.textContent = sc.timer.done; }
      }, 250);
    });
    bar.hidden = true;
    wrap.append(el('div', { class: 'step4' },
      el('p', { class: 'step-title' }, el('span', { class: 'step-num', text: fill(sc.stepLabel, { n: 1 }) }), el('span', { text: sc.step1 })),
      tbtn, bar, tmsg));

    // الخطوة ٢: الكتابة
    const step2 = el('div', { class: 'step4' }, el('p', { class: 'step-title' }, el('span', { class: 'step-num', text: fill(sc.stepLabel, { n: 2 }) }), el('label', { for: 'ans4', text: sc.step2 })));
    wrap.append(step2);
    const after = el('div', { class: 'after4' });
    wrap.append(after);

    function writer(id, onSave) {
      const ta = el('textarea', { id, rows: 3, maxlength: sc.maxLength, placeholder: sc.placeholder, autocomplete: 'off', spellcheck: 'false', 'aria-describedby': id + '-note ' + id + '-err' });
      const note = el('p', { class: 'small', id: id + '-note', text: sc.noName });
      const err = el('p', { class: 'err4', id: id + '-err', role: 'alert' });
      let busy = false;
      const btn = el('button', { type: 'button', class: 'btn primary', text: sc.save, onclick: () => {
        if (busy) return;
        const v = ta.value.replace(/\s+/g, ' ').trim();
        if (!v) { err.textContent = sc.empty; ta.focus(); return; }
        busy = true; err.textContent = ''; onSave(v);
      } });
      return { ta, node: el('div', { class: 'writer4' }, ta, note, err, btn) };
    }
    const lockedBox = (title, text, cls) => el('div', { class: 'locked4 ' + (cls || '') }, el('p', { class: 'locked-title', text: title }), el('p', { class: 'locked-text', text }));

    function renderAfterFirst(announce) {
      const v = s4();
      step2.querySelector('.writer4')?.remove();
      after.textContent = '';
      if (announce) after.append(el('p', { class: 'saved4', role: 'status', text: sc.saved }));
      after.append(lockedBox(sc.firstTitle, v.first, 'first'));
      // التقييم الذاتي: لا يغني عن المعلم، ولا يُرسل
      const sc4 = sc.selfCheck;
      after.append(el('fieldset', { class: 'check4' }, el('legend', { text: sc4.title }),
        sc4.items.map((t, i) => {
          const id = 'chk4-' + i;
          const cb = el('input', { type: 'checkbox', id, checked: (v.checks || [])[i] ? true : null });
          cb.addEventListener('change', () => S.update(s => { s.s4.checks = s.s4.checks || []; s.s4.checks[i] = cb.checked; }));
          return el('div', { class: 'chk' }, cb, el('label', { for: id, text: t }));
        }),
        el('p', { class: 'small', text: sc4.note })));
      // 10.6: تقييم الأقران أمام الطالب، وبديله الفردي
      const P4 = sc.peer;
      if (P4) after.append(el('div', { class: 'peer4' }, el('p', { class: 'locked-title', text: P4.title }), el('ol', {}, P4.items.map(t => el('li', { text: t }))), el('p', { class: 'small', text: P4.alone })));
      // النموذج: بعد حفظ الإجابة الأولى فقط، مع تذكير بمراجعة المعلم أولًا
      const modelBox = el('div', { class: 'model4', hidden: !v.modelShown });
      modelBox.append(el('p', { class: 'locked-title', text: sc.model.compare }), el('p', { class: 'locked-text', text: sc.model.text }));
      const mbtn = el('button', { type: 'button', class: 'btn', 'aria-expanded': String(!!v.modelShown), text: sc.model.button, onclick: () => {
        S.update(s => { s.s4.modelShown = true; }); modelBox.hidden = false; mbtn.setAttribute('aria-expanded', 'true');
      } });
      after.append(el('div', { class: 'modelwrap' }, mbtn, el('p', { class: 'small', text: sc.model.caption })), modelBox);
      // التحسين: إجابة ثانية منفصلة؛ الأولى تبقى ظاهرة ومقفلة
      const imp = el('div', { class: 'improve4' });
      after.append(imp);
      renderImprove(imp, false);
    }
    function renderImprove(imp, announce) {
      const v = s4();
      imp.textContent = '';
      if (v.improved && !imp._editing) {
        if (announce) imp.append(el('p', { class: 'saved4', role: 'status', text: sc.saved }));
        imp.append(lockedBox(sc.improve.title, v.improved, 'improved'));
        imp.append(el('button', { type: 'button', class: 'btn', text: sc.improve.button, onclick: () => { imp._editing = true; renderImprove(imp); } }));
        return;
      }
      if (!imp._editing) { imp.append(el('button', { type: 'button', class: 'btn', text: sc.improve.button, onclick: () => { imp._editing = true; renderImprove(imp); } })); return; }
      const w = writer('ans4b', val => { S.update(s => { s.s4.improved = val; s.s4.improvedCount = (s.s4.improvedCount || 0) + 1; }); imp._editing = false; renderImprove(imp, true); });
      if (v.improved) w.ta.value = v.improved;
      imp.append(el('p', { class: 'step-title' }, el('label', { for: 'ans4b', text: sc.improve.title })), w.node);
      w.ta.focus();
    }

    if (s4().first) renderAfterFirst(false);
    else {
      const w = writer('ans4', val => {
        S.update(s => { if (!s.s4 || !s.s4.first) s.s4 = { first: val }; if (!s.done.includes(4)) s.done.push(4); }); // الأولى لا تُستبدل أبدًا
        renderProgress(4); renderAfterFirst(true);
        after.querySelector('.saved4')?.focus?.();
      });
      step2.append(w.node);
    }
    return wrap;
  }

  // ---------- الشاشة ٥: التصرف المناسب ----------
  // السؤال يستخدم مكوّن السؤال المعتمد في الشاشتين ١ و٢ كما هو (إجابة أولى ثابتة، قفل الخيار المجرَّب، قفل الضغط المتكرر).
  // المراجعة المصورة: إطار يبرز الحاوية في الصورة. الإثراء ظاهر دائمًا ومطوي، اختياري ولا يمنع التقدم ولا يُسجَّل.
  function screen5(sc) {
    const st = S.get();
    const wrap = el('section', { class: 'screen' }, header(sc), el('p', { class: 'transition', text: sc.transition }));
    const audioStatus = el('p', { class: 'audio-status', role: 'status' });
    const frame = el('div', { class: 'bin-frame', hidden: true, 'aria-hidden': 'true' });
    frame.style.left = sc.binFrame.x + '%'; frame.style.top = sc.binFrame.y + '%';
    frame.style.width = sc.binFrame.w + '%'; frame.style.height = sc.binFrame.h + '%';
    const fig = el('figure', { class: 'scene' }, pic(sc.image, {}, 'side760'), frame);
    const side = el('div', { class: 'side5' }, el('p', { class: 'situation5', text: sc.situation }));
    if (!st.settings.muted) side.append(listenButton(sc.audio, audioStatus));
    side.append(audioStatus);
    side.append(choiceQuestion({
      screen: 5, id: 'q5', question: sc.question, options: sc.options, feedback: sc.feedback,
      showReview: on => { frame.hidden = !on; if (on) fig.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); },
    }));
    wrap.append(el('div', { class: 'layout5' }, fig, side));

    // الإثراء الاختياري
    const E = sc.enrichment;
    const efb = el('div', { class: 'feedback small-fb', 'aria-live': 'polite' });
    let ebusy = false;
    const eopts = E.options.map(o => {
      const b = el('button', { type: 'button', class: 'option' }, el('span', { class: 'key', 'aria-hidden': 'true', text: o.key }), el('span', { class: 'otext', text: o.text }), el('span', { class: 'mark' }));
      b.addEventListener('click', () => {
        if (ebusy || b.disabled) return; ebusy = true; setTimeout(() => { ebusy = false; }, 350);
        efb.textContent = '';
        const m = b.querySelector('.mark'); m.textContent = '';
        if (o.correct) {
          eopts.forEach(x => { x.disabled = true; });
          b.classList.add('is-right'); m.append(icon('ok'), el('span', { class: 'sr-only', text: C.marks.correct }));
          efb.className = 'feedback small-fb correct';
          efb.append(el('p', { class: 'fb-head' }, icon('ok'), el('b', { text: C.marks.correct })), el('p', { text: E.correct }));
        } else {
          b.classList.add('is-wrong'); b.disabled = true; m.append(icon('no'), el('span', { class: 'sr-only', text: C.marks.wrong }));
          efb.className = 'feedback small-fb wrong';
          efb.append(el('p', { class: 'fb-head' }, icon('no'), el('b', { text: C.marks.wrong })), el('p', { text: E.wrong }));
        }
      });
      return b;
    });
    const eStatus = el('p', { class: 'audio-status', role: 'status' });
    wrap.append(el('details', { class: 'enrich5' },
      el('summary', {}, el('span', { text: E.title })),
      E.image ? el('figure', { class: 'scene enrich-img' }, pic(E.image, { loading: 'lazy' })) : null,
      E.audio && !st.settings.muted ? listenButton(E.audio, eStatus) : null, eStatus,
      el('div', { class: 'options', role: 'group', 'aria-label': E.title }, eopts), efb));
    return wrap;
  }

  // ---------- الشاشة ٦: التقويم الختامي (قا١٦-ب) ----------
  // سؤال واحد في كل مرة. أول اختيار في كل سؤال يُقفل ويُحتسب، ولا يظهر الصواب قبل نهاية الأسئلة الأربعة.
  // المحاولة الأولى (attempts[0]) لا تتغير أبدًا؛ «إعادة التقويم» تضيف محاولة تدريب منفصلة.
  function screen6(sc) {
    const st = S.get();
    if (st.reviewReturn) S.update(s => { s.reviewReturn = false; });
    const wrap = el('section', { class: 'screen' }, header(sc));
    const audioStatus = el('p', { class: 'audio-status', role: 'status' });
    const intro = el('div', { class: 'instruction' }, el('p', { text: sc.instruction }));
    if (!st.settings.muted) intro.append(listenButton(sc.audio, audioStatus));
    wrap.append(intro, el('p', { class: 'note6', text: sc.note }), audioStatus);
    const body = el('div', { class: 'quiz6' });
    wrap.append(body);

    const Q = () => S.get().quiz;
    const cur = () => { const q = Q(); return q && q.attempts[q.attempts.length - 1]; };
    if (!Q()) S.update(s => { s.quiz = { attempts: [{ answers: {}, score: null, finished: false }], badge: false }; });
    const isRight = (q, a) => q.type === 'choice' ? !!(q.options.find(o => o.key === a) || {}).correct
      : !!a && q.items.every(it => a[it.id] === it.answer);                       // س٢: درجة واحدة إذا صُنّف المثالان معًا صحيحًا
    const answered = (q, a) => q.type === 'choice' ? !!a : !!a && q.items.every(it => a[it.id]);

    function draw() {
      body.textContent = '';
      const at = cur();
      if (at.finished) return drawResult();
      const step = sc.questions.findIndex(q => !answered(q, at.answers[q.id]));
      drawQuestion(step < 0 ? 3 : step);
    }

    function drawQuestion(i) {
      const q = sc.questions[i];
      let busy = false;
      const card = el('div', { class: 'qcard6' }, el('p', { class: 'qcount6', text: fill(sc.counter, { n: i + 1 }) }));
      const qStatus = el('p', { class: 'audio-status', role: 'status' });
      const qh = el('div', { class: 'qhead6' }, el('p', { class: 'qtext6', id: 'qt6', text: q.text }));
      if (!S.get().settings.muted) qh.append(listenButton(q.audio, qStatus));
      card.append(qh, qStatus);
      const after = el('div', { class: 'after6', 'aria-live': 'polite' });
      const picked = b => { b.classList.add('is-picked'); const m = b.querySelector('.mark'); if (m) { m.textContent = ''; m.append(icon('ok'), el('span', { class: 'sr-only', text: 'اخترت هذه الإجابة' })); } };
      const save = (fn) => {
        if (busy) return false; busy = true; setTimeout(() => { busy = false; }, 350);
        let ok = false;
        S.update(s => { const a = s.quiz.attempts[s.quiz.attempts.length - 1]; ok = fn(a.answers); });
        return ok;
      };
      const showSaved = () => {
        if (after.firstChild) return;
        const last = i === 3;
        after.append(el('p', { class: 'saved6' }, icon('ok'), el('span', { text: sc.saved })),
          el('button', { type: 'button', class: 'btn primary wide', text: last ? sc.showResult : sc.nextQ, onclick: () => {
            if (last) finish(); else draw();
            body.querySelector('h2, .qcount6, .res6')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
          } }));
        after.querySelector('button').focus();
      };
      if (q.type === 'choice') {
        const opts = el('div', { class: 'options', role: 'group', 'aria-labelledby': 'qt6' });
        const btns = q.options.map(o => {
          const b = el('button', { type: 'button', class: 'option' }, el('span', { class: 'key', 'aria-hidden': 'true', text: o.key }), el('span', { class: 'otext', text: o.text }), el('span', { class: 'mark' }));
          b.addEventListener('click', () => {
            if (cur().answers[q.id]) return;
            if (!save(ans => { if (ans[q.id]) return false; ans[q.id] = o.key; return true; })) return;
            btns.forEach(x => { x.disabled = true; }); picked(b); showSaved();
          });
          return b;
        });
        opts.append(...btns); card.append(opts);
      } else {
        const rows = q.items.map(it => {
          const lid = 'c6-' + it.id;
          const bs = ['natural', 'human'].map(k => {
            const b = el('button', { type: 'button', class: 'choice3', 'data-k': k }, el('span', { class: 'otext', text: q.choices[k] }), el('span', { class: 'mark' }));
            b.addEventListener('click', () => {
              const a = cur().answers[q.id];
              if (a && a[it.id]) return;
              if (!save(ans => { ans[q.id] = ans[q.id] || {}; if (ans[q.id][it.id]) return false; ans[q.id][it.id] = k; return true; })) return;
              bs.forEach(x => { x.disabled = true; }); b.classList.add('is-right-neutral'); picked(b);
              if (answered(q, cur().answers[q.id])) showSaved();
            });
            return b;
          });
          return el('div', { class: 'crow6' }, el('p', { class: 'card3-label', id: lid, text: it.label }), el('div', { class: 'choices3', role: 'group', 'aria-labelledby': lid }, bs));
        });
        card.append(...rows);
      }
      card.append(after);
      body.append(card);
    }

    function finish() {
      let score = 0, first = false;
      S.update(s => {
        const a = s.quiz.attempts[s.quiz.attempts.length - 1];
        a.score = sc.questions.reduce((n, q) => n + (isRight(q, a.answers[q.id]) ? 1 : 0), 0);
        a.finished = true; score = a.score; first = s.quiz.attempts.length === 1;
        if (score === 4) s.quiz.badge = true;                                      // الشارة عند ٤/٤ في أي محاولة
        if (first && !s.done.includes(6)) s.done.push(6);
      });
      renderProgress(6);
      draw();
    }

    function answerText(q, a) {
      if (q.type === 'choice') { const o = q.options.find(x => x.key === a); return o ? o.key + '. ' + o.text : ''; }
      return q.items.map(it => it.label + ': ' + q.choices[(a || {})[it.id]]).join('، ');
    }
    function correctText(q) {
      if (q.type === 'choice') { const o = q.options.find(x => x.correct); return o.key + '. ' + o.text; }
      return q.items.map(it => it.label + ': ' + q.choices[it.answer]).join('، ');
    }

    function drawResult() {
      const qz = Q(), first = qz.attempts[0], last = cur(), isRetake = qz.attempts.length > 1;
      const res = el('div', { class: 'res6', tabindex: '-1' });
      res.append(el('p', { class: 'score6', text: fill(sc.result, { n: first.score }) }));
      if (isRetake) res.append(el('p', { class: 'score6 retake', text: fill(sc.retakeResult, { n: last.score }) }));
      const sCur = last.score;
      res.append(el('p', { class: 'msg6', text: sCur === 4 ? sc.messages[4] : sCur >= 2 ? sc.messages.mid : sc.messages.low }));
      if (qz.badge) res.append(el('div', { class: 'badge6' }, icon('sprout', 'ico badge-ico'), el('b', { text: sc.badge })));
      body.append(res);

      // الإجابات نفسها لا تُحفظ بعد الجلسة، فلا بطاقة ولا تصحيح لمحاولة مستعادة
      if (!last.restored) {
        // «ماذا تعلّمت؟» (10.5): كل هدف من سؤاله، من المحاولة المعروضة نفسها. لا يغيّر الدرجة ولا يُحفظ
        const L = sc.learned, goals = C.screens[0].objectives.items;
        body.append(el('section', { class: 'learned6', 'aria-labelledby': 'learned6-t' },
          el('h2', { class: 'corr-title', id: 'learned6-t', text: L.title }),
          el('p', { class: 'small', text: isRetake ? L.basisRetake : L.basisFirst }),
          el('ul', { class: 'learned-list' }, sc.questions.map(q => {
            const ok = isRight(q, last.answers[q.id]);
            return el('li', { class: ok ? 'ok' : 'no' }, icon(ok ? 'ok' : 'replay'),
              el('span', { class: 'lg-text', text: goals[q.goal - 1].text }),
              el('b', { class: 'lg-state', text: ok ? L.ok : L.review }));
          }))));
        // التصحيح: لا باللون وحده (أيقونة وكلمات)
        const corr = el('div', { class: 'corr6' }, el('h2', { class: 'corr-title', text: sc.correctionTitle }));
        sc.questions.forEach((q, i) => {
          const a = last.answers[q.id], ok = isRight(q, a);
          corr.append(el('div', { class: 'cline ' + (ok ? 'ok' : 'no') },
            el('p', { class: 'cline-head' }, icon(ok ? 'ok' : 'no'),
              el('span', { text: ok ? fill(sc.lineRight, { n: i + 1 }) : fill(sc.lineWrong.replace('{a}', answerText(q, a)).replace('{c}', correctText(q)), { n: i + 1 }) })),
            el('p', { class: 'cline-ex', text: q.explain })));
        });
        body.append(corr);
        // طريق المراجعة (10.5): لكل سؤال خاطئ، مرتبًا بترتيب شاشات الدرس، مع رقم الخطوة
        const wrong = sc.questions.filter(q => !isRight(q, last.answers[q.id])).sort((a, b) => a.link - b.link);
        if (wrong.length) {
          body.append(el('div', { class: 'review6' }, el('h2', { class: 'corr-title', text: sc.reviewTitle }),
            el('p', { class: 'small', text: wrong.length > 1 ? sc.path.leadMany : sc.path.leadOne }),
            el('ol', { class: 'path6' }, wrong.map((q, k) => {
              const n = sc.questions.indexOf(q) + 1, target = C.screens[q.link - 1];
              return el('li', {}, el('button', { type: 'button', class: 'link6', onclick: () => { S.update(s => { s.reviewReturn = true; }); go(q.link); } },
                el('span', { class: 'step6', 'aria-hidden': 'true', text: ar(k + 1) }),
                el('span', { text: fill(sc.path.step.replace('{q}', 'س' + ar(n)).replace('{t}', target.title), { s: q.link }) })));
            }))));
        }
      }
      body.append(el('p', { class: 'small retake-note', text: sc.retakeNote }),
        el('div', { class: 'actions6' },
          el('button', { type: 'button', class: 'btn primary', text: sc.buttons.retake, onclick: () => {
            S.update(s => { s.quiz.attempts.push({ answers: {}, score: null, finished: false }); }); draw();
            body.querySelector('.qcount6')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
          } }),
          el('button', { type: 'button', class: 'btn', text: sc.buttons.restart, onclick: () => confirmBox(C.alerts.home, () => { S.resetProgress(); go(1); }) }),
          el('button', { type: 'button', class: 'btn danger', text: sc.buttons.end, onclick: () => confirmBox(endAlert(), endSession) })));
    }
    draw();
    return wrap;
  }

  function screenLater(sc) {
    return el('section', { class: 'screen' }, header(sc), el('p', { class: 'proto-note', text: C.proto.later }));
  }
  function header(sc) {
    return el('div', { class: 'screen-head' },
      el('h1', { tabindex: '-1', text: sc.title }),
      el('span', { class: 'time' }, el('span', { class: 'sr-only', text: 'الزمن: ' }), sc.time));
  }

  // ---------- القائمة ----------
  function menu() {
    const M = C.menu, st = S.get();
    const box = el('div', {});
    box.append(el('div', { class: 'panel-head' }, el('h2', { text: C.buttons.menu }),
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': C.buttons.close, onclick: () => closeLayer() }, el('span', { 'aria-hidden': 'true', text: '✕' }))));

    box.append(el('button', { type: 'button', class: 'btn wide search-btn', onclick: glossary }, icon('search'), el('span', { text: C.glossary.title })));
    box.append(el('h3', { text: M.index }), el('ol', { class: 'index' }, C.screens.map(sc =>
      el('li', {}, el('button', { type: 'button', class: 'index-link' + (sc.id === current ? ' current' : ''), onclick: () => { closeLayer(true); go(sc.id); } },
        el('span', { class: 'dot', 'aria-hidden': 'true', text: st.done.includes(sc.id) ? '★' : ar(sc.id) }),
        el('span', { text: sc.title }),
        st.done.includes(sc.id) ? el('span', { class: 'sr-only', text: fill(C.site.screenDone, { n: sc.id }) }) : null)))));

    box.append(el('h3', { text: M.settings }));
    const seg = (cfg, key, vals = [false, true]) => {
      const [label, a, b] = cfg;
      const g = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
      [[a, vals[0]], [b, vals[1]]].forEach(([t, val]) => {
        const r = el('button', { type: 'button', role: 'radio', 'aria-checked': String(st.settings[key] === val), text: t, onclick: () => {
          S.update(s => { s.settings[key] = val; }); applySettings();
          g.querySelectorAll('[role=radio]').forEach(x => x.setAttribute('aria-checked', String(x === r)));
          if (key === 'muted') { stopAudio(); render(); }
          if (key === 'muted' && activeVideo) activeVideo.muted = val;
          if (key === 'captions' && activeVideo) for (const t of activeVideo.textTracks) t.mode = val ? 'showing' : 'hidden';
        } });
        g.append(r);
      });
      return el('div', { class: 'setting' }, el('span', { class: 'setting-label', text: label }), g);
    };
    box.append(seg(C.settings.fontSize, 'large'), seg(C.settings.contrast, 'contrast'), seg(C.settings.sound, 'muted'), seg(C.settings.captions, 'captions', [true, false]));

    const P = C.privacy;
    box.append(el('h3', { text: M.privacy }), el('p', { text: P.text }),
      el('details', { class: 'faq' }, el('summary', { text: P.detailTitle }), el('p', { text: P.detail }), el('p', { text: P.noPassword })));
    if (st.device === 'mine') {
      const msg = el('p', { class: 'small', role: 'status' });
      const tg = el('button', { type: 'button', role: 'switch', class: 'switch', 'aria-checked': String(st.save), onclick: () => {
        const on = tg.getAttribute('aria-checked') !== 'true';
        S.setSave(on); tg.setAttribute('aria-checked', String(on));
        msg.textContent = on ? '' : P.off;
      } }, el('span', { class: 'knob', 'aria-hidden': 'true' }), el('span', { text: P.toggle }));
      box.append(tg, el('p', { class: 'small', text: P.toggleNote }), msg);
    }
    box.append(el('button', { type: 'button', class: 'btn', text: P.clear, onclick: () => confirmBox(C.alerts.clear, () => { stopAudio(); S.clearAll(); applySettings(); toast(C.alerts.cleared); restart(); }) }));
    box.append(el('hr'), el('button', { type: 'button', class: 'btn danger wide', text: M.endSession, onclick: () => confirmBox(endAlert(), endSession) }));
    // قسم المعلم في آخر القائمة حتى لا يزاحم واجهة الطالب
    box.append(el('hr'), el('h3', { text: M.teacher }), el('div', { class: 'row teacher-row' },
      el('button', { type: 'button', class: 'btn', text: M.guideBtn, onclick: teacherGuide }),
      el('button', { type: 'button', class: 'btn', text: M.summaryBtn, onclick: summary })));
    box.append(el('p', { class: 'small version', text: versionLine() }),
      el('details', { class: 'faq' }, el('summary', { text: M.whatsNew }), el('ul', {}, C.version.changes.map(c => el('li', { text: c })))));
    openLayer(box, { label: C.buttons.menu, onEscape: () => closeLayer(), panel: true });
  }

  // ---------- لوحة عامة برأس وزر إغلاق ----------
  function panelBox(title) {
    const box = el('div', {});
    box.append(el('div', { class: 'panel-head' }, el('h2', { text: title }),
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': C.buttons.close, onclick: () => closeLayer() }, el('span', { 'aria-hidden': 'true', text: '✕' }))));
    return box;
  }

  // ---------- البحث في المسرد (10.2) ----------
  // يتجاهل «ال» والهمزات والتشكيل كما في ملف النصوص، ويبحث في المصطلح وكلماته المرادفة.
  const norm = t => String(t).normalize('NFC')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .split(/\s+/).map(w => w.replace(/^(وال|بال|فال|كال|ال)(?=..)/, '')).join(' ').trim();
  function searchGlossary(q) {
    const G = C.glossary.terms, nq = norm(q);
    if (!nq) return G.slice();
    const hits = [];
    G.forEach((t, i) => {
      const cands = [t.term, ...t.words].map(norm);
      let rank = -1;
      if (cands[0] === nq) rank = 0;
      else if (cands.some(c => c === nq)) rank = 1;
      else if (cands.some(c => c.includes(nq) || (c.length >= 3 && nq.includes(c)))) rank = 2;
      if (rank >= 0) hits.push({ t, rank, i });
    });
    return hits.sort((a, b) => a.rank - b.rank || a.i - b.i).map(h => h.t);
  }
  function glossary() {
    const G = C.glossary;
    const box = panelBox(G.title);
    const input = el('input', { type: 'search', id: 'gl-q', class: 'gl-input', placeholder: G.placeholder, autocomplete: 'off', enterkeyhint: 'search', dir: 'rtl' });
    const status = el('p', { class: 'small', role: 'status', 'aria-live': 'polite' });
    const list = el('ul', { class: 'gl-list' });
    const draw = () => {
      const res = searchGlossary(input.value);
      list.textContent = '';
      status.textContent = res.length ? fill(G.count, { n: res.length }) : G.none;
      res.forEach(t => list.append(el('li', { class: 'gl-item' },
        el('p', { class: 'gl-term', text: t.term }),
        el('p', { class: 'gl-def', text: t.def }),
        el('button', { type: 'button', class: 'btn small-btn', text: fill(G.go, { n: t.screen }), onclick: () => { closeLayer(true); go(t.screen); } }))));
    };
    input.addEventListener('input', draw);
    box.append(el('label', { class: 'gl-label', for: 'gl-q', text: G.label }), input, status, list);
    draw();
    openLayer(box, { label: G.title, onEscape: () => closeLayer(), panel: true });
    input.focus();
  }

  const versionLine = () => C.version.line.replace('{v}', C.version.number).replace('{d}', C.version.date);

  // ---------- دليل المعلم (10.2) ----------
  function teacherGuide() {
    const T = C.teacher, V = C.version;
    const box = panelBox(T.title);
    const sec = (title, ...kids) => el('section', { class: 'tg-sec' }, el('h3', { text: title }), ...kids);
    box.append(el('p', { text: T.intro }),
      sec(T.objectivesTitle, el('ol', {}, T.objectives.map(o => el('li', { text: o })))),
      sec(T.timelineTitle, el('div', { class: 'tbl-wrap' }, el('table', { class: 'tg-table' },
        el('thead', {}, el('tr', {}, T.timelineHead.map(h => el('th', { scope: 'col', text: h })))),
        el('tbody', {}, T.timeline.map(r => el('tr', {}, r.map((c, i) => el(i ? 'td' : 'th', i ? { text: c } : { scope: 'row', text: c })))))))),
      sec(T.beforeTitle, el('ul', {}, T.before.map(b => el('li', { text: b })))),
      sec(T.discussTitle, el('p', { text: T.discussClass }), el('p', { text: T.discussAlone })),
      sec(T.peerTitle, el('ol', {}, T.peer.map(b => el('li', { text: b }))), el('p', { text: T.peerAlone })),
      sec(T.criterionTitle, el('p', { text: T.criterion })),
      sec(T.skillsMapTitle, el('div', { class: 'tbl-wrap' }, el('table', { class: 'tg-table' },
        el('thead', {}, el('tr', {}, T.skillsMapHead.map(h => el('th', { scope: 'col', text: h })))),
        el('tbody', {}, T.skillsMap.map(r => el('tr', {}, r.map((c, i) => el(i ? 'td' : 'th', i ? { text: c } : { scope: 'row', text: c })))))))),
      sec(T.resultNoteTitle, el('p', { text: T.resultNote })),
      sec(T.scienceTitle, el('p', { text: T.science })),
      sec(T.summaryTitle, el('p', { text: T.summaryText }), el('p', { text: T.summaryExtra }),
        el('button', { type: 'button', class: 'btn', text: C.menu.summaryBtn, onclick: summary })),
      sec(T.supportTitle, el('p', { text: T.support })),
      sec(T.skillsTitle, el('p', { text: T.skills })),
      sec(T.updateTitle, el('p', { text: T.update }), el('p', { class: 'small', text: versionLine() })),
      el('p', { class: 'small', text: T.lastReview }));
    openLayer(box, { label: T.title, onEscape: () => closeLayer(), panel: true });
  }

  // ---------- ملخص الجلسة (قا١٥): من الجلسة الحالية فقط، لا يُرسل شيء ----------
  function summary() {
    const M = C.summary, st = S.get(), sc = C.screens;
    const box = panelBox(M.title);
    box.append(el('p', { class: 'note-box', text: M.note }));
    const dl = el('dl', { class: 'sum' });
    const row = (k, ...v) => dl.append(el('dt', { text: k }), el('dd', {}, ...v));
    const optText = (s, key) => (sc[s - 1].options.find(o => o.key === key) || {}).text || key;
    const verdict = ok => el('span', { class: 'tag ' + (ok ? 'ok' : 'no'), text: ok ? M.right : M.wrong });
    const practice = s => { const a = st.attempts[s]; return a && a.total ? el('span', { class: 'small', text: ' · ' + fill(M.practice, { n: a.total }) }) : null; };
    const restored = !!(st.quiz && st.quiz.attempts[0] && st.quiz.attempts[0].restored);

    box.append(el('h3', { text: M.done }), st.done.length
      ? el('ul', { class: 'plain' }, [...st.done].sort().map(n => el('li', { text: ar(n) + '. ' + sc[n - 1].title })))
      : el('p', { text: M.noneDone }));

    box.append(el('h3', { text: M.firstTitle }));
    if (restored && !Object.keys(st.diag).length) box.append(el('p', { class: 'small', text: M.restoredFirst }));
    const single = (label, s) => {
      const d = st.diag[s];
      row(label, ...(d ? [el('span', { text: d.choice + ': ' + optText(s, d.choice) + ' — ' }), verdict(d.correct), practice(s)] : [M.notYet]));
    };
    single(M.pre, 1);
    if (typeof st.predict === 'number') row(M.predict, sc[1].predict.options[st.predict]); // 10.6
    single(M.s2, 2);
    const d3 = st.diag[3] || {};
    row(M.s3, ...(Object.keys(d3).length ? [el('ul', { class: 'plain' }, sc[2].cards.map(c => {
      const d = d3[c.id];
      return el('li', {}, el('span', { text: c.label + ': ' }), ...(d ? [el('span', { text: sc[2].choices[d.choice] + ' — ' }), verdict(d.correct)] : [M.notYet]));
    })), practice(3)] : [M.notYet]));
    single(M.s5, 5);
    box.append(dl);

    box.append(el('h3', { text: M.s4Title }));
    if (st.s4 && st.s4.first) {
      box.append(el('p', { class: 'sum-label', text: M.s4First }), el('blockquote', { class: 'sum-quote', text: st.s4.first }));
      if (st.s4.improved) box.append(el('p', { class: 'sum-label', text: M.s4Improved }), el('blockquote', { class: 'sum-quote', text: st.s4.improved }));
    } else box.append(el('p', { text: M.s4None }));

    box.append(el('h3', { text: M.quizTitle }));
    const q = st.quiz;
    if (!q) box.append(el('p', { text: M.quizNone }));
    else {
      const [first, ...rest] = q.attempts;
      box.append(el('p', { class: 'sum-score', text: first.finished ? fill(M.quizFirst, { n: first.score }) : M.quizPending }));
      if (first.restored) box.append(el('p', { class: 'small', text: M.restored }));
      const done = rest.filter(a => a.finished);
      if (done.length) box.append(el('ul', {}, done.map((a, i) => el('li', { text: fill(M.quizRetake, { i: i + 1, n: a.score }) }))));
    }
    openLayer(box, { label: M.title, onEscape: () => closeLayer(), panel: true });
  }

  // ---------- المساعدة ----------
  function help() {
    const H = C.help, sc = C.screens[current - 1];
    const box = panelBox(C.buttons.help);
    if (sc.help) box.append(el('p', { class: 'help-now', text: sc.help }));
    box.append(el('h3', { text: H.stepsTitle }), el('ol', { class: 'steps' }, H.steps.map(s => el('li', { text: s }))));
    // فيديو المساعدة VID-02
    box.append(el('h3', { text: H.videoTitle }), videoBlock(Object.assign({ panel: true }, H.video)));
    // صور التنقل المشروحة SHOT-01–04
    box.append(el('h3', { text: C.shots.title }), el('div', { class: 'shots' }, C.shots.items.map(s =>
      el('figure', { class: 'shot' }, el('img', { src: s.src, alt: s.caption, width: s.width, height: s.height, loading: 'lazy', decoding: 'async' }), el('figcaption', { text: s.caption })))));
    box.append(el('h3', { text: H.faqTitle }), ...H.faq.map(([q, a]) => el('details', { class: 'faq' }, el('summary', { text: q }), el('p', { text: a }))));
    box.append(el('h3', { text: H.brokenTitle }), el('ol', {}, H.broken.map(s => el('li', { text: s }))), el('p', { class: 'small', text: H.contact }));
    openLayer(box, { label: C.buttons.help, onEscape: () => closeLayer(), panel: true });
  }

  function toast(t) {
    const n = el('p', { class: 'toast', role: 'status', text: t });
    document.body.append(n); setTimeout(() => n.remove(), 3000);
  }

  // ---------- التوجيه ----------
  let current = 1;
  const SCREENS = { 1: screen1, 2: screen2, 3: screen3, 4: screen4, 5: screen5, 6: screen6 };
  const ACTIVITY = [1, 2, 3, 4, 5];
  function parse() { const m = location.hash.match(/^#s([1-6])$/); return m ? +m[1] : 1; }
  // 10.4: تنبيه مغادرة التقويم الختامي قبل إنهائه — المحاولة الأولى فقط وبعد إجابة سؤال واحد على الأقل، ولا يظهر بعد إكمالها
  const quizPending = () => { const q = S.get().quiz, a = q && q.attempts[0]; return !!a && q.attempts.length === 1 && !a.finished && Object.keys(a.answers).length > 0; };
  const leavingQuiz = n => current === 6 && n !== 6 && quizPending();
  let leaveOK = false;   // انتقال أكّده الطالب أو لا يحتاج تنبيهًا، فلا يُعترض عند hashchange
  function setHash(n) { if (location.hash !== '#s' + n) { leaveOK = true; location.hash = '#s' + n; } else render(); }
  function go(n) { if (leavingQuiz(n)) confirmBox(C.alerts.leaveQuiz, () => setHash(n), 'go', 'stay'); else setHash(n); }
  function onHash() {
    const n = parse();
    if (!leaveOK && leavingQuiz(n)) {   // زر الرجوع في المتصفح أو تعديل العنوان
      history.pushState(null, '', '#s6');   // يبقى في #s6، والضغط على الرجوع مرة أخرى يعيد التنبيه
      confirmBox(C.alerts.leaveQuiz, () => setHash(n), 'go', 'stay');
      return;
    }
    leaveOK = false;
    render();
  }
  function render() {
    stopAudio(); stopVideo(); stopTimer();
    current = parse();
    const sc = C.screens[current - 1];
    const main = $('#main'); main.textContent = '';
    if (S.get().reviewReturn && current !== 6) {
      // زر أعلى الشاشة المراجَعة عند فتحها من روابط المراجعة في النتيجة
      main.append(el('button', { type: 'button', class: 'btn back6', onclick: () => go(6) }, el('span', { 'aria-hidden': 'true', text: '→' }), el('span', { text: C.screens[5].backToResult })));
    }
    main.append((SCREENS[current] || screenLater)(sc));
    renderProgress(current);
    document.title = sc.title + ' — ' + C.site.title;
    $('#btn-prev').disabled = current === 1;
    $('#btn-next').disabled = current === 6;
    const h = main.querySelector('h1'); if (h && !$('#layer').firstChild) h.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  function toStart() { if (location.hash !== '#s1') { leaveOK = true; location.hash = '#s1'; } render(); }
  function restart() { closeLayer(true); toStart(); welcome(); }

  // ---------- نهاية الجلسة (10.4): حالة ختامية بعد التأكيد، وليست شاشة تعليمية ----------
  // 10.4.1: نص التأكيد بحسب وضع الجهاز؛ لا يغيّر ما يُمسح
  const endAlert = () => { const s = S.get(); return s.device === 'mine' && s.save ? C.alerts.endSessionSaved : C.alerts.endSession; };
  function endSession() {
    stopAudio(); stopVideo(); stopTimer();
    S.endSession(); applySettings();
    $('#main').textContent = ''; $('#progress-steps').textContent = '';   // لا يبقى شيء من الجلسة ظاهرًا خلف الرسالة
    showEnd();
  }
  function showEnd() {
    const E = C.endSession;
    const saved = S.hasSaved();
    const body = el('div', { class: 'welcome end-session' }, el('p', { class: 'end-text', text: saved ? E.textSaved : E.text }));
    if (saved) {
      body.append(el('div', { class: 'note-box end-saved' },
        el('p', { text: E.saved }),
        el('button', { type: 'button', class: 'btn', text: E.clearSaved, onclick: () => confirmBox(C.alerts.clear, () => {
          S.clearAll(); applySettings(); toast(C.alerts.cleared); showEnd();
        }, 'yes', 'no', showEnd) })));
    }
    const start = el('button', { type: 'button', class: 'btn primary wide', text: E.start, onclick: startNew });
    body.append(start);
    openLayer(body, { label: saved ? E.textSaved : E.text });
    start.focus();
  }
  function startNew() {
    closeLayer(true);
    S.load(); applySettings();
    toStart();
    if (!S.get().device) welcome();
    if (S.get().policyNotice) { toast(C.privacy.changed); S.update(s => { delete s.policyNotice; }); }
  }

  // ---------- الربط ----------
  document.querySelectorAll('[data-t]').forEach(n => { n.textContent = pick(n.dataset.t); });
  $('#btn-menu').addEventListener('click', menu);
  $('#btn-help').addEventListener('click', help);
  $('#btn-prev').addEventListener('click', () => go(Math.max(1, current - 1)));
  $('#btn-next').addEventListener('click', () => {
    const needs = ACTIVITY.includes(current) && !S.get().done.includes(current); // الشاشات المبنية ذات النشاط فقط
    const next = () => go(Math.min(6, current + 1));
    if (needs) confirmBox(C.alerts.leaveIncomplete, next, 'go', 'stay'); else next();
  });
  $('#btn-home').addEventListener('click', () => confirmBox(C.alerts.home, () => { S.resetProgress(); go(1); }));
  window.addEventListener('hashchange', onHash);

  S.load();
  applySettings();
  render();
  if (!S.get().device) welcome();
  if (S.get().policyNotice) { toast(C.privacy.changed); S.update(s => { delete s.policyNotice; }); }
})();
