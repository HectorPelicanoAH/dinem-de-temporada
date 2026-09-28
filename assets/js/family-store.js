/* Supabase REST client. Private data is never silently replaced by public data on errors. */
(function () {
  'use strict';
  const config = window.FAMILY_CONFIG || {};
  const sessionKey = 'dinf_family_session_v1';
  const demoKey = 'dinf_family_demo_v1';
  let current = null, refreshPromise = null;
  function read(key, storage = sessionStorage) {
    try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; }
  }
  function configured() { return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl || '') && !!config.publishableKey; }
  function demo() { return !read(sessionKey) && !!read(demoKey, localStorage); }
  function signedIn() { return !!read(sessionKey); }
  function saveSession(session) {
    sessionStorage.setItem(sessionKey, JSON.stringify({
      access_token: session.access_token, refresh_token: session.refresh_token,
      expires_at: session.expires_at || Math.floor(Date.now() / 1000) + session.expires_in,
      email: session.user?.email || '', user_id: session.user?.id
    }));
    localStorage.removeItem(demoKey);
  }
  async function request(path, body, token, method = 'POST') {
    if (!configured()) throw new Error('La connexió familiar encara no està configurada.');
    let response;
    try {
      response = await fetch(`${config.supabaseUrl}${path}`, {
        method, headers: { apikey: config.publishableKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000)
      });
    } catch { throw new Error('No hi ha connexió amb el servei. Conserva el formulari i torna-ho a provar.'); }
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(result?.message === 'revision_conflict'
        ? 'Algú ha desat canvis abans que tu. Descarrega el teu esborrany i recarrega les dades abans de tornar a editar.'
        : response.status === 429 ? 'Massa intents. Espera un minut abans de tornar-ho a provar.'
        : response.status === 401 ? 'La sessió ha caducat. Torna a entrar des de Família.'
        : 'No s’ha pogut completar l’operació. Comprova el codi, els permisos o la connexió.');
      error.status = response.status;
      error.conflict = result?.message === 'revision_conflict';
      throw error;
    }
    return result;
  }
  async function token() {
    let session = read(sessionKey);
    if (!session) throw new Error('Entra al teu espai familiar.');
    if (session.expires_at < Date.now() / 1000 + 60) {
      if (!refreshPromise) refreshPromise = request('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token })
        .then(saveSession).finally(() => { refreshPromise = null; });
      await refreshPromise;
      session = read(sessionKey);
    }
    return session.access_token;
  }
  async function base() {
    const results = await Promise.all(['data/menus/2026.json', 'data/recipes.json'].map(async path => {
      const response = await fetch(path);
      if (!response.ok) throw new Error('No s’ha pogut carregar la biblioteca inicial.');
      return response.json();
    }));
    return FamilyModel.validate({ menus: results[0], recipes: results[1] });
  }
  async function load() {
    if (demo()) {
      current = read(demoKey, localStorage);
      FamilyModel.validate(current.data);
      return current;
    }
    if (!signedIn()) { current = null; return null; }
    const rows = await request('/rest/v1/family_documents?select=family_id,name,revision,data,updated_at,updated_by', undefined, await token(), 'GET');
    if (rows.length !== 1) throw new Error('El teu compte encara no té un espai familiar assignat.');
    current = rows[0];
    if (current.data) FamilyModel.validate(current.data);
    return current;
  }
  async function save(data) {
    FamilyModel.validate(data);
    if (!current) throw new Error('Carrega primer el teu espai familiar.');
    if (demo()) {
      const latest = read(demoKey, localStorage);
      if (latest.revision !== current.revision) {
        const error = new Error('La còpia local ha canviat en una altra pestanya. Descarrega l’esborrany i recarrega.');
        error.conflict = true;
        throw error;
      }
      const next = { ...current, revision: current.revision + 1, data, updated_at: new Date().toISOString(), updated_by: 'Prova local' };
      localStorage.setItem(demoKey, JSON.stringify(next));
      current = next;
    } else {
      const rows = await request('/rest/v1/rpc/save_family_document', {
        target_family: current.family_id, expected_revision: current.revision, next_data: data
      }, await token());
      current = rows[0];
    }
    return current;
  }
  async function resolve(publicData) {
    const family = await load();
    if (family && !family.data) throw new Error('Obre Família per crear la còpia inicial del calendari.');
    return family?.data || publicData;
  }
  async function logout() {
    let warning = false;
    if (signedIn()) {
      try { await request('/auth/v1/logout?scope=local', {}, await token()); } catch { warning = true; }
    }
    sessionStorage.removeItem(sessionKey);
    localStorage.removeItem(demoKey);
    current = null;
    return warning;
  }
  function signInWithGoogle() {
    if (!configured()) throw new Error('La connexió familiar encara no està configurada.');
    const redirect = new URL('familia.html', window.location.href).href;
    window.location.assign(`${config.supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`);
  }
  async function consumeOAuthCallback() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hash.get('access_token');
    if (!accessToken) return false;
    const refreshToken = hash.get('refresh_token');
    const userResponse = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20000)
    });
    const user = await userResponse.json().catch(() => null);
    if (!userResponse.ok || !user?.id || !user?.email) throw new Error('No s’ha pogut validar l’accés amb Google.');
    saveSession({ access_token: accessToken, refresh_token: refreshToken, expires_at: Math.floor(Date.now() / 1000) + Number(hash.get('expires_in') || 3600), user });
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    return true;
  }
  window.FamilyStore = {
    configured, demo, signedIn, base, load, save, resolve, logout, signInWithGoogle, consumeOAuthCallback,
    email: () => read(sessionKey)?.email || '',
    isCurrentAuthor: id => read(sessionKey)?.user_id === id,
    async startDemo() {
      const data = await base();
      const entry = { family_id: 'demo', name: 'Família de prova', revision: 0, data, updated_at: null };
      localStorage.setItem(demoKey, JSON.stringify(entry));
      return load();
    },
    async sendCode(email) { await request('/auth/v1/otp', { email, create_user: false }); },
    async verifyCode(email, code) {
      const session = await request('/auth/v1/verify', { email, token: code, type: 'email' });
      if (!session?.access_token) throw new Error('No s’ha pogut iniciar la sessió.');
      saveSession(session);
    }
  };
  document.addEventListener('DOMContentLoaded', () => {
    if (!demo() && !signedIn()) return;
    const banner = document.createElement('aside');
    banner.className = 'family-context';
    const link = document.createElement('a');
    link.href = 'familia.html';
    link.textContent = demo() ? 'Prova local · Canvis només en aquest navegador · Obrir Família' : 'Espai familiar privat · Editar calendari i receptes';
    banner.append(link);
    document.querySelector('header')?.after(banner);
  });
})();
