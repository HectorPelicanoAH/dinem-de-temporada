const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
test('PostgreSQL permissions isolate families, prevent direct writes and reject stale saves', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated;
      grant execute on function auth.uid() to anon,authenticated;
      insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
    `);
    await db.exec(fs.readFileSync('supabase/migrations/001_family.sql', 'utf8'));
    await db.exec(`
      insert into public.family_documents(family_id,name) values ('10000000-0000-0000-0000-000000000001','Family A'),('10000000-0000-0000-0000-000000000002','Family B');
      insert into public.family_members values
        ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
        ('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001'),
        ('00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002');
    `);
    const asUser = async user => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      await db.exec('set role authenticated');
    };
    const a = '10000000-0000-0000-0000-000000000001', b = '10000000-0000-0000-0000-000000000002';
    const payload = { menus: JSON.parse(fs.readFileSync('data/menus/2026.json')), recipes: JSON.parse(fs.readFileSync('data/recipes.json')) };
    const save = (family, revision, data = payload) => db.query('select * from public.save_family_document($1,$2,$3)', [family,revision,JSON.stringify(data)]);
    await asUser('00000000-0000-0000-0000-000000000001');
    assert.equal((await db.query('select * from public.family_documents')).rows.length,1);
    assert.equal((await db.query('select * from public.family_members')).rows.length,1);
    assert.equal((await save(a,0)).rows[0].revision,1);
    await assert.rejects(save(b,0), /not_authorized/);
    await assert.rejects(db.exec("update public.family_documents set name='hacked'"), /permission denied/);
    await assert.rejects(db.exec(`insert into public.family_members values ('00000000-0000-0000-0000-000000000001','${b}')`), /permission denied/);
    await asUser('00000000-0000-0000-0000-000000000002');
    await assert.rejects(save(a,0), /revision_conflict/);
    await assert.rejects(save(a,null), /revision_conflict/);
    assert.equal((await save(a,1)).rows[0].revision,2);
    assert.equal((await db.query('select * from public.family_history')).rows.length,1);
    await assert.rejects(save(a,2,{}), /invalid_document/);
    await asUser('00000000-0000-0000-0000-000000000003');
    assert.equal((await db.query('select name from public.family_documents')).rows[0].name,'Family B');
    assert.equal((await db.query('select * from public.family_history')).rows.length,0);
    await assert.rejects(save(a,2), /not_authorized/);
    await asUser('00000000-0000-0000-0000-000000000001');
    for (let revision=2;revision<23;revision++) await save(a,revision);
    assert.equal((await db.query('select * from public.family_history')).rows.length,20);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from public.family_documents'), /permission denied/);
    await assert.rejects(save(a,23), /permission denied/);
  } finally { await db.close(); }
});
