/* عميل الخدمة الخلفية (Supabase) دون مكتبات: واجهة Auth وواجهة REST للدوال فقط.
   جلسة الدخول في sessionStorage لهذا التبويب وحده؛ كلمة المرور لا تُخزَّن في أي مكان على الجهاز. */
window.EcoApi = (() => {
  'use strict';
  const CFG = window.ECO_CONFIG || {};
  const URL_ = (CFG.supabaseUrl || '').replace(/\/$/, '');
  const KEY = CFG.supabaseAnonKey || '';
  const SK = 'eco.auth.v1';
  const enabled = !!URL_ && !!KEY;
  let sess = null;
  try { sess = JSON.parse(sessionStorage.getItem(SK)); } catch (e) { sess = null; }
  const save = s => { sess = s; try { if (s) sessionStorage.setItem(SK, JSON.stringify(s)); else sessionStorage.removeItem(SK); } catch (e) { /* */ } };
  const email = u => String(u || '').trim().toLowerCase() + '@' + (CFG.usernameDomain || 'users.eco-lesson.invalid');
  const okUser = u => /^[a-z0-9_]{3,20}$/.test(String(u || '').trim().toLowerCase());
  const strong = p => typeof p === 'string' && p.length >= 8 && p.length <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p);

  class ApiError extends Error { constructor(code, status) { super(code); this.code = code; this.status = status; } }

  async function req(path, { method = 'POST', body, auth = true } = {}) {
    if (!enabled) throw new ApiError('disabled', 0);
    const h = { apikey: KEY, 'Content-Type': 'application/json' };
    h.Authorization = 'Bearer ' + (auth && sess ? sess.access_token : KEY);
    let r;
    try { r = await fetch(URL_ + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch (e) { throw new ApiError('network', 0); }
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    if (r.ok) return j;
    const code = (j && (j.error_code || j.error || j.message || j.msg)) || 'generic';
    throw new ApiError(String(code), r.status);
  }
  function setSession(j) {
    if (!j || !j.access_token) throw new ApiError('generic', 0);
    save({ access_token: j.access_token, refresh_token: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60e3, user: j.user && j.user.id });
  }
  async function refreshIfNeeded() {
    if (!sess || Date.now() < sess.exp) return;
    try { setSession(await req('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: sess.refresh_token }, auth: false })); }
    catch (e) { save(null); throw new ApiError('session_expired', 401); }
  }

  return {
    enabled, ApiError, okUser, strong,
    signedIn: () => !!sess,
    async signUp(username, password, displayName, consent) {
      if (!okUser(username)) throw new ApiError('invalid_username', 0);
      if (!strong(password)) throw new ApiError('weak_password', 0);
      if (!consent) throw new ApiError('consent_required', 0);
      const j = await req('/auth/v1/signup', { auth: false, body: { email: email(username), password,
        data: { display_name: String(displayName || '').trim().slice(0, 30), guardian_consent: true, policy: (window.CONTENT && window.CONTENT.privacy.policyVersion) || '2.0' } } });
      setSession(j);
    },
    async signIn(username, password) {
      if (!okUser(username)) throw new ApiError('invalid_grant', 0);
      setSession(await req('/auth/v1/token?grant_type=password', { auth: false, body: { email: email(username), password } }));
    },
    async signOut() {
      try { if (sess) await req('/auth/v1/logout', { body: {} }); } catch (e) { /* يُمسح محليًا على أي حال */ }
      save(null);
    },
    async rpc(fn, body = {}) {
      await refreshIfNeeded();
      return req('/rest/v1/rpc/' + fn, { body, auth: !!sess });
    },
    async fn(name, body = {}) {
      await refreshIfNeeded();
      return req('/functions/v1/' + name, { body, auth: !!sess });
    },
    async recover(username, code, newPassword) {
      if (!strong(newPassword)) throw new ApiError('weak_password', 0);
      return req('/functions/v1/account-recovery', { auth: false, body: { username: String(username).trim().toLowerCase(), code, new_password: newPassword } });
    },
    forget() { save(null); },
  };
})();
