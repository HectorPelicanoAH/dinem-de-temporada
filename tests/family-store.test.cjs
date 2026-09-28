const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const model = require('../assets/js/family-model.js');
function storage() { const values = new Map(); return { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) }; }
function setup(fetcher, sharedStorage = storage()) {
  const context = { FAMILY_CONFIG: { supabaseUrl: 'https://example.supabase.co', publishableKey: 'public-test-key' }, FamilyModel: model, sessionStorage: storage(), localStorage: sharedStorage, document: { addEventListener() {} }, fetch: fetcher, AbortSignal, Date, URL, URLSearchParams, console };
  context.window = context;
  vm.runInNewContext(fs.readFileSync('assets/js/family-store.js','utf8'), context);
  return context;
}
const baseFetch = async path => ({ ok:true, json: async () => JSON.parse(fs.readFileSync(path)) });
function login(ctx, expired = false) { ctx.sessionStorage.setItem('dinf_family_session_v1', JSON.stringify({ access_token:'test-access', refresh_token:'test-refresh', expires_at: expired ? 0 : Date.now()/1000+3600 })); }
test('public mode makes no private requests', async () => {
  const ctx = setup(() => { throw new Error('Must not fetch'); });
  const publicData = { recipes: {} }; assert.equal(await ctx.FamilyStore.resolve(publicData), publicData);
});
test('two local editors detect stale revisions without overwriting the first save', async () => {
  const shared = storage(), a = setup(baseFetch, shared), b = setup(baseFetch, shared);
  const first = await a.FamilyStore.startDemo(); await b.FamilyStore.load();
  const changed = model.editRecipe(first.data, { ...first.data.recipes['pasta-bolonyesa'], title: 'First writer' });
  await a.FamilyStore.save(changed);
  await assert.rejects(b.FamilyStore.save(first.data), error => error.conflict === true);
  assert.equal((await b.FamilyStore.load()).data.recipes['pasta-bolonyesa'].title, 'First writer');
});
test('private read failures never fall back to public data', async () => {
  const ctx = setup(async () => ({ ok:false, status:403, json:async () => ({}) })); login(ctx);
  await assert.rejects(ctx.FamilyStore.resolve({ recipes: {} }));
});
test('refresh rotates tokens before private request', async () => {
  const requests=[];
  const ctx = setup(async (path, options) => {
    requests.push([path,options]);
    return {ok:true,json:async () => path.includes('/token?') ? {access_token:'new-access',refresh_token:'new-refresh',expires_in:3600,user:{email:'test@example.org'}} : [{name:'Family',data:null,revision:0}]};
  }); login(ctx,true);
  await ctx.FamilyStore.load();
  assert.ok(requests[0][0].includes('grant_type=refresh_token'));
  assert.equal(requests[1][1].headers.Authorization,'Bearer new-access');
});
test('Google callback validates the user, stores the session and removes tokens from the URL', async () => {
  const requests = [];
  const ctx = setup(async (path, options) => {
    requests.push([path, options]);
    return { ok: true, json: async () => ({ id: 'family-member', email: 'test@example.org' }) };
  });
  ctx.location = { hash: '#access_token=google-access&refresh_token=google-refresh&expires_in=3600', pathname: '/familia.html', search: '' };
  ctx.history = { replaceState(_state, _title, path) { assert.equal(path, '/familia.html'); ctx.location.hash = ''; } };
  assert.equal(await ctx.FamilyStore.consumeOAuthCallback(), true);
  assert.equal(ctx.FamilyStore.email(), 'test@example.org');
  assert.equal(ctx.location.hash, '');
  assert.equal(requests[0][1].headers.Authorization, 'Bearer google-access');
});
test('Google callback removes tokens from the URL even when validation fails', async () => {
  const ctx = setup(async () => ({ ok: false, status: 401, json: async () => ({}) }));
  ctx.location = { hash: '#access_token=invalid&refresh_token=invalid', pathname: '/familia.html', search: '' };
  ctx.history = { replaceState() { ctx.location.hash = ''; } };
  await assert.rejects(ctx.FamilyStore.consumeOAuthCallback());
  assert.equal(ctx.location.hash, '');
  assert.equal(ctx.FamilyStore.signedIn(), false);
});
test('logout clears local session when the network fails', async () => {
  const ctx = setup(async () => ({ ok:true, json:async()=>({}) }));
  login(ctx); ctx.fetch = async () => { throw new Error('offline'); };
  assert.equal(await ctx.FamilyStore.logout(),true);
  assert.equal(ctx.FamilyStore.signedIn(),false);
});
