const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const model = require('../assets/js/family-model.js');
const source = () => ({ menus: JSON.parse(fs.readFileSync('data/menus/2026.json')), recipes: JSON.parse(fs.readFileSync('data/recipes.json')) });
test('existing library round trips without losing recipe provenance or metadata', () => {
  const data = source();
  assert.equal(model.validate(data), data);
  assert.equal(Object.keys(data.menus.days).length, 365);
  const recipe = Object.values(data.recipes).at(-1);
  const updated = model.editRecipe(data, { ...recipe, title: 'Nova versió' });
  assert.deepEqual(updated.recipes[recipe.id], { ...recipe, title: 'Nova versió' });
  assert.notEqual(data.recipes[recipe.id].title, 'Nova versió');
});
test('editing a day updates both titles and side references, preserves other days', () => {
  const data = source(), date = '2026-01-01';
  const next = model.editDay(data, date, { lunch: 'pasta-bolonyesa', lunchSide: 'amanida-verda', dinner: 'ous-farcits', dinnerSide: '', quick: 'Pa amb tomàquet' });
  assert.equal(next.menus.days[date].lunch.title, `${data.recipes['pasta-bolonyesa'].title} · ${data.recipes['amanida-verda'].title}`);
  assert.equal(next.menus.days[date].dinner.side, undefined);
  delete next.menus.days[date]; delete data.menus.days[date];
  assert.deepEqual(next, data);
});
test('renaming a recipe updates every principal and side title', () => {
  const data = source();
  const next = model.editRecipe(data, { ...data.recipes['amanida-verda'], title: 'Amanida familiar' });
  for (const day of Object.values(next.menus.days)) for (const slot of ['lunch', 'dinner']) {
    const meal = day[slot];
    if (meal.recipe === 'amanida-verda' || meal.side === 'amanida-verda') assert.ok(meal.title.includes('Amanida familiar'));
  }
});
test('invalid imports reject broken references, invalid dates, scripts in image paths', () => {
  for (const mutate of [
    data => { data.menus.days['2026-01-01'].lunch.recipe = 'missing'; },
    data => { data.menus.days['2026-02-30'] = data.menus.days['2026-01-01']; },
    data => { data.recipes['pasta-bolonyesa'].image = 'javascript:alert(1)'; },
    data => { data.recipes['pasta-bolonyesa'].pairings = ['missing']; },
    data => { data.recipes['pasta-bolonyesa'].time = 'hello'; }
  ]) { const data = source(); mutate(data); assert.throws(() => model.validate(data)); }
});
test('HTML escaping handles user text, attributes and unsafe images', () => {
  const ctx = vm.createContext({ window: { FAMILY_CONFIG: { supabaseUrl: 'https://example.supabase.co' } } }); vm.runInContext(fs.readFileSync('assets/js/utils.js', 'utf8'), ctx);
  assert.equal(ctx.escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(ctx.safeRecipeImage('https://example.org/track.png'), '');
  assert.equal(ctx.safeRecipeImage('assets/images/recipes/pasta.jpg'), 'assets/images/recipes/pasta.jpg');
  const image = 'recipe-images/00000000-0000-0000-0000-000000000001/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg';
  assert.equal(model.imagePath(image), true);
  assert.equal(ctx.safeRecipeImage(image), `https://example.supabase.co/storage/v1/object/public/${image}`);
  assert.equal(model.imagePath('recipe-images/../../private.png'), false);
});
