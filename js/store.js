// التخزين حسب القرار ١٩ وجدول الجلسة في القسم ٦ من الخطة:
// - الافتراضي: ذاكرة الجلسة (sessionStorage) فقط، وتُمحى بإنهاء الجلسة أو إغلاق التبويب.
// - على «جهازي» مع «احفظ تقدمي»: يُنسخ إلى localStorage الشاشات المكتملة والمحاولات والإعدادات فقط،
//   وتنتهي صلاحيتها بعد ٣٠ يومًا من آخر استخدام. لا يُحفظ أي نص يكتبه الطالب.
'use strict';

window.Store = (() => {
  const SK = 'eco.session.v1';
  const LK = 'eco.saved.v1';
  const TTL = 30 * 24 * 60 * 60 * 1000;
  const POLICY = (window.CONTENT && window.CONTENT.privacy.policyVersion) || '1.0'; // نسخة سياسة الخصوصية
  const memory = {};

  const safe = (fn, fallback) => { try { return fn(); } catch (e) { return fallback; } };
  const ss = {
    get: k => safe(() => sessionStorage.getItem(k), memory[k] ?? null),
    set: (k, v) => safe(() => sessionStorage.setItem(k, v), (memory[k] = v)),
    del: k => safe(() => sessionStorage.removeItem(k), delete memory[k]),
  };
  const ls = {
    get: k => safe(() => localStorage.getItem(k), null),
    set: (k, v) => safe(() => localStorage.setItem(k, v), null),
    del: k => safe(() => localStorage.removeItem(k), null),
  };

  const fresh = () => ({
    device: null,          // 'mine' | 'shared' | null قبل الاختيار
    save: false,           // يُسمح به على «جهازي» فقط
    done: [],              // أرقام الشاشات المكتملة
    diag: {},              // { رقم الشاشة: { choice, correct } } أول إجابة فقط، لا تُستبدل؛ في الجلسة فقط ولا تُنسخ إلى الجهاز
    attempts: {},          // { رقم الشاشة: { rounds, total } } محاولات التدريب، منفصلة عن الإجابة الأولى
    quiz: null,            // الشاشة ٦: { attempts: [{ answers, score, finished }], badge } الإجابات في الجلسة فقط؛ درجة المحاولة الأولى وحدها تُحفظ على الجهاز
    reviewReturn: false,   // الطالب فتح شاشة من روابط المراجعة في النتيجة
    s4: null,              // الشاشة ٤: { first, improved, checks, modelShown } نص الطالب، في الجلسة فقط ولا يُنسخ إلى الجهاز
    settings: { large: false, contrast: false, muted: false, captions: true },
    // 11.0: المستويات والعلاج والإثراء. نتيجة المستوى منفصلة عن نتيجة التقويم الأساسي
    level: 1,              // ١ ألاحظ وأتعرف، ٢ أفسر وأربط، ٣ أتنبأ وأحل المشكلات
    levelResults: {},      // { رقم المستوى: { score, total, answers } } المحاولة الأولى لاختبار المستوى
    remedial: {},          // { رقم الهدف: true } اجتاز سؤال التحقق العلاجي
    counts: { remediation: 0, enrichment: 0 },
    errors: {},            // { معرّف النشاط: عدد الأخطاء } للتقرير فقط
  });

  let state = fresh();

  function load() {
    const raw = ss.get(SK);
    if (raw) { state = Object.assign(fresh(), safe(() => JSON.parse(raw), {})); return state; }
    // لا جلسة حالية: نسترجع المحفوظ على الجهاز الشخصي إن وُجد ولم تنتهِ صلاحيته
    const saved = safe(() => JSON.parse(ls.get(LK)), null);
    if (saved && Date.now() - saved.ts < TTL) {
      state = Object.assign(fresh(), { device: 'mine', save: true, done: saved.done || [], attempts: saved.attempts || {}, settings: Object.assign(fresh().settings, saved.settings),
        level: [1, 2, 3].includes(saved.level) ? saved.level : 1, levelResults: saved.levelResults || {} });
      // 10.2: تنبيه محلي مرة واحدة إذا تغيّرت نسخة سياسة الخصوصية منذ آخر حفظ (لا خادم)
      if (saved.policy && saved.policy !== POLICY) state.policyNotice = true;
      // درجة المحاولة الأولى في التقويم الختامي فقط (دون الإجابات)
      if (typeof saved.quizFirstScore === 'number') state.quiz = { attempts: [{ answers: {}, score: saved.quizFirstScore, finished: true, restored: true }], badge: !!saved.quizBadge };
      persist();
    } else if (saved) ls.del(LK);
    return state;
  }

  function persist() {
    ss.set(SK, JSON.stringify(state));
    if (state.device === 'mine' && state.save) {
      // الحقول المسموح بها فقط؛ diag وأي نص مكتوب لا تُنسخ
      const q = state.quiz && state.quiz.attempts[0];
      ls.set(LK, JSON.stringify({ ts: Date.now(), policy: POLICY, done: state.done, attempts: state.attempts, settings: state.settings,
        quizFirstScore: q && q.finished ? q.score : undefined, quizBadge: state.quiz && state.quiz.badge ? true : undefined,
        level: state.level, levelResults: Object.keys(state.levelResults || {}).length ? Object.fromEntries(Object.entries(state.levelResults).map(([k, v]) => [k, { score: v.score, total: v.total }])) : undefined }));
    }
  }

  return {
    load,
    get: () => state,
    update(fn) { fn(state); persist(); },
    setSave(on) {
      state.save = !!on && state.device === 'mine';
      if (!state.save) ls.del(LK);
      persist();
    },
    // 10.4 — إنهاء الجلسة: تُمحى ذاكرة الجلسة كلها (الإجابات والنص المكتوب)، ويبقى ما حُفظ على الجهاز الشخصي باختيار الطالب
    endSession() { ss.del(SK); for (const k in memory) delete memory[k]; state = fresh(); },
    // هل على هذا الجهاز تقدم محفوظ صالح؟
    hasSaved() { const v = safe(() => JSON.parse(ls.get(LK)), null); return !!(v && Date.now() - v.ts < TTL); },
    // مسح البيانات («مسح بيانات الجلسة» و«امسح تقدمي»): يُمحى كل شيء من ذاكرة الجلسة ومن الجهاز
    clearAll() { ss.del(SK); ls.del(LK); for (const k in memory) delete memory[k]; state = fresh(); },
    // العودة للبداية تمسح التقدم وتُبقي اختيار الجهاز والإعدادات
    resetProgress() { state.done = []; state.attempts = {}; state.diag = {}; state.s4 = null; state.quiz = null; state.reviewReturn = false; state.levelResults = {}; state.remedial = {}; state.counts = { remediation: 0, enrichment: 0 }; state.errors = {}; persist(); },
  };
})();
