/* Supabase REST client. Private data is never silently replaced by public data on errors. */
(function () {
  'use strict';
  const config = window.FAMILY_CONFIG || {};
  const sessionKey = 'dinf_family_session_v1';
  const demoKey = 'dinf_family_demo_v1';
  let current = null, refreshPromise = null, publicRecipesPromise = null;
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
      email: session.user?.email || read(sessionKey)?.email || '', user_id: session.user?.id || read(sessionKey)?.user_id
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
  async function publicRecipes() {
    if (!configured() || demo()) return {};
    if (!publicRecipesPromise) publicRecipesPromise = request('/rest/v1/public_recipes?select=recipe', undefined, undefined, 'GET').then(rows => {
      const recipes = {};
      for (const row of rows) {
        const recipe = row.recipe;
        FamilyModel.validateRecipe(recipe, recipe?.id);
        recipes[recipe.id] = recipe;
      }
      return recipes;
    }).catch(() => {
      // The static catalogue remains usable while the optional public table is
      // being migrated or when the public endpoint is temporarily unavailable.
      publicRecipesPromise = null;
      return {};
    });
    return publicRecipesPromise;
  }
  function withPublicRecipes(data, published) {
    if (!Object.keys(published).length) return data;
    return { ...data, recipes: { ...published, ...data.recipes } };
  }
  async function extractRecipe(images) {
    if (demo()) throw new Error('Entra amb Google per processar fotografies.');
    const response = await fetch(`${config.supabaseUrl}/functions/v1/extract-recipe`, {
      method: 'POST', headers: { apikey: config.publishableKey, Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }), signal: AbortSignal.timeout(80000)
    }).catch(() => { throw new Error('No hi ha connexió amb el processador de fotos.'); });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || 'No s’ha pogut llegir la recepta.');
    return result.recipe;
  }
  async function publishRecipe(recipe) {
    if (demo()) throw new Error('Entra amb Google per publicar una recepta.');
    FamilyModel.validateRecipe(recipe, recipe.id);
    const published = await request('/rest/v1/rpc/publish_public_recipe_with_image', { payload: recipe }, await token());
    publicRecipesPromise = null;
    return published;
  }
  async function uploadRecipeImage(blob) {
    if (demo()) throw new Error('Entra amb Google per desar fotografies.');
    if (blob.type !== 'image/jpeg' || blob.size > 2000000) throw new Error('La foto processada ha de ser JPEG i ocupar menys de 2 MB.');
    const userId = read(sessionKey)?.user_id;
    if (!/^[a-f0-9-]{36}$/.test(userId || '')) throw new Error('La sessió ha caducat. Torna a entrar.');
    const path = `recipe-images/${userId}/${crypto.randomUUID()}.jpg`;
    let response;
    try {
      response = await fetch(`${config.supabaseUrl}/storage/v1/object/${path}`, {
        method: 'POST', headers: { apikey: config.publishableKey, Authorization: `Bearer ${await token()}`, 'Content-Type': 'image/jpeg' },
        body: blob, signal: AbortSignal.timeout(30000)
      });
    } catch { throw new Error('No s’ha pogut pujar la fotografia. Conserva-la i torna-ho a provar.'); }
    if (!response.ok) throw new Error('No s’ha pogut desar la fotografia. Comprova els permisos de Storage i torna-ho a provar.');
    return path;
  }
  async function setPublicRecipeImage(recipeId, imagePath) {
    if (demo()) throw new Error('Entra amb Google per publicar fotografies.');
    const saved = await request('/rest/v1/rpc/set_public_recipe_image', { recipe_id: recipeId, image_path: imagePath }, await token());
    publicRecipesPromise = null;
    return saved;
  }
  function imageUrl(path) {
    if (/^assets\/images\/[a-zA-Z0-9/_.,-]+$/.test(path || '')) return path;
    return FamilyModel.imagePath(path) && path.startsWith('recipe-images/') && configured()
      ? `${config.supabaseUrl}/storage/v1/object/public/${path}` : '';
  }
  async function base() {
    const results = await Promise.all(['data/menus/2026.json', 'data/recipes.json'].map(async path => {
      const response = await fetch(path);
      if (!response.ok) throw new Error('No s’ha pogut carregar la biblioteca inicial.');
      return response.json();
    }));
    return FamilyModel.validate(withPublicRecipes({ menus: results[0], recipes: results[1] }, await publicRecipes()));
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
    if (current.data) {
      current.data = withPublicRecipes(current.data, await publicRecipes());
      FamilyModel.validate(current.data);
    }
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
    if (family?.data) return family.data;
    return withPublicRecipes(publicData, await publicRecipes());
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
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    if (!refreshToken) throw new Error('No s’ha pogut validar l’accés amb Google. Torna-ho a provar.');
    const userResponse = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20000)
    });
    const user = await userResponse.json().catch(() => null);
    if (!userResponse.ok || !user?.id || !user?.email) throw new Error('No s’ha pogut validar l’accés amb Google. Torna-ho a provar.');
    saveSession({ access_token: accessToken, refresh_token: refreshToken, expires_at: Math.floor(Date.now() / 1000) + Number(hash.get('expires_in') || 3600), user });
    return true;
  }
  window.FamilyStore = {
    configured, demo, signedIn, base, load, save, resolve, publicRecipes, extractRecipe, publishRecipe, uploadRecipeImage, setPublicRecipeImage, imageUrl, logout, signInWithGoogle, consumeOAuthCallback,
    email: () => read(sessionKey)?.email || '',
    isCurrentAuthor: id => read(sessionKey)?.user_id === id,
    async startDemo() {
      const data = await base();
      const entry = { family_id: 'demo', name: 'Família de prova', revision: 0, data, updated_at: null };
      localStorage.setItem(demoKey, JSON.stringify(entry));
      return load();
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
