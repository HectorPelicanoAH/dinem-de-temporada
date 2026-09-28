const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('only members can spend extraction slots and publish; everyone can read recipes', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated;
      grant execute on function auth.uid() to anon,authenticated;
      insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
    `);
    await db.exec(fs.readFileSync('supabase/migrations/001_family.sql', 'utf8'));
    await db.exec(fs.readFileSync('supabase/migrations/002_public_recipes.sql', 'utf8'));
    await db.exec(`
      insert into public.family_documents(family_id,name) values ('10000000-0000-0000-0000-000000000001','Family A');
      insert into public.family_members values ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
    `);
    const asUser = async (role, id) => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']);
      await db.exec(`set role ${role}`);
    };
    const original = Object.values(JSON.parse(fs.readFileSync('data/recipes.json')))[0];
    const recipe = { ...original, image: '', pairings: [], servingsUnit: 'persones' };
    await asUser('authenticated', '00000000-0000-0000-0000-000000000002');
    await assert.rejects(db.query('select public.reserve_recipe_extraction()'), /not_authorized/);
    await assert.rejects(db.query('select public.publish_public_recipe($1)', [JSON.stringify(recipe)]), /not_authorized/);
    await asUser('authenticated', '00000000-0000-0000-0000-000000000001');
    await db.query('select public.reserve_recipe_extraction()');
    await assert.rejects(db.query('select public.reserve_recipe_extraction()'), /quota_exceeded/);
    await assert.rejects(db.query('select public.publish_public_recipe($1)', [JSON.stringify({ ...recipe, title: '' })]), /invalid_recipe/);
    await assert.rejects(db.query('select public.publish_public_recipe($1)', [JSON.stringify({ ...recipe, image: 'https://example.com/private.jpg' })]), /invalid_recipe/);
    const saved = (await db.query('select public.publish_public_recipe($1) as recipe', [JSON.stringify(recipe)])).rows[0].recipe;
    assert.match(saved.id, /^pub-[a-f0-9-]{36}$/);
    assert.equal(saved.title, recipe.title);
    assert.equal(saved.image, '');
    await assert.rejects(db.query("delete from public.public_recipes where id = '" + saved.id + "'"), /permission denied/);
    await asUser('anon');
    assert.equal((await db.query('select recipe from public.public_recipes')).rows[0].recipe.id, saved.id);
    await assert.rejects(db.query('select created_by from public.public_recipes'), /permission denied/);
    await assert.rejects(db.query('select public.publish_public_recipe($1)', [JSON.stringify(recipe)]), /permission denied/);
  } finally { await db.close(); }
});
