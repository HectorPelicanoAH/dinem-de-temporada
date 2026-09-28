(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let data = null, pendingImport = null, pendingDraft = null, dirty = false, busy = false, sentEmail = '';
  const dirtyForms = new Set();
  let selectedRecipe = '', selectedDate = '';
  const value = id => $(id).value.trim();
  const lines = id => value(id).split('\n').map(s => s.trim()).filter(Boolean);
  const list = id => value(id).split(',').map(s => s.trim()).filter(Boolean);
  function message(text, error = false) { $('family-status').textContent = text; $('family-status').dataset.error = String(error); }
  async function run(task) {
    if (busy) return;
    busy = true;
    const controls = [...document.querySelectorAll('button,input,select,textarea')].map(element => [element, element.disabled]);
    controls.forEach(([element]) => { element.disabled = true; });
    try { await task(); } catch (error) { message(error.message, true); }
    finally { busy = false; controls.forEach(([element, disabled]) => { element.disabled = disabled; }); }
  }
  function options(select, entries, empty) {
    select.replaceChildren();
    if (empty !== undefined) select.add(new Option(empty, ''));
    for (const [id, label] of entries) select.add(new Option(label, id));
  }
  function refreshOptions() {
    const entries = Object.values(data.recipes).sort((a, b) => a.title.localeCompare(b.title, 'ca')).map(r => [r.id, r.title]);
    for (const id of ['lunch', 'dinner']) options($(id), entries, 'Selecciona un plat');
    for (const id of ['lunch-side', 'dinner-side']) options($(id), entries, 'Sense acompanyament');
    options($('recipe-picker'), entries, 'Nova recepta');
  }
  function showDay() {
    const day = data.menus.days[value('day-date')];
    for (const slot of ['lunch', 'dinner']) {
      $(slot).value = day?.[slot]?.recipe || '';
      $(`${slot}-side`).value = day?.[slot]?.side || '';
    }
    $('quick').value = day?.quickOption?.title || '';
    selectedDate = value('day-date');
  }
  function showRecipe(id = '') {
    selectedRecipe = id;
    $('recipe-picker').value = id;
    const recipe = data.recipes[id] || { time: 30, servings: 4, season: ['primavera', 'estiu', 'tardor', 'hivern'], difficulty: 'Fàcil', category: 'mediterrània' };
    for (const key of ['category', 'difficulty']) {
      if (recipe[key] && ![...$(`recipe-${key}`).options].some(o => o.value === recipe[key])) $(`recipe-${key}`).add(new Option(recipe[key], recipe[key]));
    }
    for (const key of ['title', 'category', 'difficulty', 'time', 'servings', 'babyNotes']) $(`recipe-${key}`).value = recipe[key] ?? '';
    for (const key of ['season', 'tags', 'allergens']) $(`recipe-${key}`).value = (recipe[key] || []).join(', ');
    for (const key of ['steps', 'variations']) $(`recipe-${key}`).value = (recipe[key] || []).join('\n');
    $('recipe-ingredients').value = (recipe.ingredients || []).map(i => [i.ingredient, i.amount, i.unit].join(' | ')).join('\n');
  }
  function display(entry) {
    $('access').hidden = true;
    $('workspace').hidden = false;
    $('family-name').textContent = entry.name;
    $('account').textContent = FamilyStore.demo() ? 'Prova local · Només en aquest navegador' : FamilyStore.email();
    $('save-info').textContent = entry.updated_at ? `Versió ${entry.revision} · Desat el ${new Date(entry.updated_at).toLocaleString('ca')}${entry.updated_by ? ` · ${entry.updated_by === 'Prova local' ? 'Prova local' : FamilyStore.isCurrentAuthor(entry.updated_by) ? 'Tu' : 'Un membre de la família'}` : ''}` : 'Encara no hi ha canvis desats.';
    $('initialize').hidden = !!entry.data;
    $('editors').hidden = !entry.data;
    $('export').hidden = !entry.data;
    data = entry.data;
    if (!data) return;
    refreshOptions();
    if (!value('day-date')) {
      const today = new Date().toLocaleDateString('sv-SE');
      const requested = new URLSearchParams(location.search).get('date');
      $('day-date').value = /^2026-\d{2}-\d{2}$/.test(requested || '') ? requested : today.startsWith('2026') ? today : '2026-01-01';
    }
    showDay();
    showRecipe(data.recipes[selectedRecipe] ? selectedRecipe : '');
  }
  function confirmDiscard() { return !dirty || window.confirm('Hi ha canvis sense desar. Vols descartar-los?'); }
  function download(payload, name) {
    const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function persist(next, success, savedForm) {
    const otherForm = savedForm === 'day-form' ? 'recipe-form' : 'day-form';
    const keepOther = savedForm && dirtyForms.has(otherForm);
    const otherValues = keepOther ? [...$(otherForm).querySelectorAll('input,textarea,select')].map(el => [el.id, el.value]) : [];
    pendingDraft = next;
    dirty = true;
    const entry = await FamilyStore.save(next);
    pendingDraft = null;
    if (savedForm) dirtyForms.delete(savedForm); else dirtyForms.clear();
    dirty = dirtyForms.size > 0;
    display(entry);
    for (const [id, val] of otherValues) $(id).value = val;
    message(success);
  }
  document.addEventListener('DOMContentLoaded', () => {
    const categories = ['arròs', 'pasta', 'peix', 'carn', 'llegums', 'cremes', 'amanides', 'pizza', 'forn', 'catalana', 'mediterrània'];
    options($('recipe-category'), categories.map(c => [c, c]));
    $('login-form').hidden = !FamilyStore.configured();
    $('not-configured').hidden = FamilyStore.configured();
    $('google-login').hidden = !FamilyStore.configured();
    $('google-login').addEventListener('click', () => run(async () => FamilyStore.signInWithGoogle()));
    $('login-form').addEventListener('submit', event => { event.preventDefault(); run(async () => {
      const email = value('email');
      await FamilyStore.sendCode(email); sentEmail = email;
      $('code-form').hidden = false;
      $('code').value = ''; setTimeout(() => $('code').focus(), 0);
      message('Si el compte té accés, rebràs un codi. Revisa també el correu brossa.');
    }); });
    $('code-form').addEventListener('submit', event => { event.preventDefault(); run(async () => {
      await FamilyStore.verifyCode(sentEmail, value('code'));
      $('code').value = '';
      $('access').hidden = true; $('workspace').hidden = false;
      display(await FamilyStore.load()); message('Ja ets al teu espai familiar.');
    }); });
    $('start-demo').addEventListener('click', () => run(async () => { display(await FamilyStore.startDemo()); message('Còpia local creada. Els canvis d’aquesta prova no es comparteixen.'); }));
    $('initialize-button').addEventListener('click', () => run(async () => persist(await FamilyStore.base(), 'El calendari familiar ja està preparat.')));
    $('logout').addEventListener('click', () => run(async () => {
      if (!confirmDiscard()) return;
      if (FamilyStore.demo() && !window.confirm('Sortir de la prova esborrarà aquesta còpia local. Si la vols conservar, cancel·la i descarrega-la primer. Vols sortir?')) return;
      const warning = await FamilyStore.logout(); dirty = false;
      if (warning) {
        data = null; pendingDraft = null;
        $('workspace').hidden = true; $('access').hidden = false;
        document.querySelector('.family-context')?.remove();
        message('Has sortit d’aquest navegador. No s’ha pogut revocar la sessió al servidor per un problema de connexió.', true);
      } else location.reload();
    }));
    $('reload').addEventListener('click', () => run(async () => {
      if (!confirmDiscard()) return;
      const entry = await FamilyStore.load(); display(entry); dirty = false; dirtyForms.clear(); pendingDraft = null;
      message('Dades actualitzades.');
    }));
    $('export').addEventListener('click', () => {
      download({ formato: 'dinem-calendario-compartible', version: 1, ...(pendingDraft || data) }, pendingDraft ? 'calendario-familiar-esborrany.json' : 'calendario-familiar-2026.json');
      message(pendingDraft ? 'Esborrany descarregat. Encara no està desat al calendari compartit.' : 'Còpia de les dades desades descarregada. Els camps pendents del formulari no s’hi inclouen.');
    });
    $('day-date').addEventListener('change', () => {
      if (confirmDiscard()) { dirty = false; dirtyForms.clear(); pendingDraft = null; showDay(); showRecipe(selectedRecipe); }
      else $('day-date').value = selectedDate;
    });
    $('recipe-picker').addEventListener('change', () => {
      if (confirmDiscard()) { dirty = false; dirtyForms.clear(); pendingDraft = null; showDay(); showRecipe(value('recipe-picker')); }
      else $('recipe-picker').value = selectedRecipe;
    });
    for (const form of ['day-form', 'recipe-form']) $(form).addEventListener('input', event => { if (event.target.id !== 'day-date') { dirty = true; dirtyForms.add(form); } });
    $('day-form').addEventListener('submit', event => { event.preventDefault(); run(async () => {
      const next = FamilyModel.editDay(data, value('day-date'), { lunch: value('lunch'), lunchSide: value('lunch-side'), dinner: value('dinner'), dinnerSide: value('dinner-side'), quick: value('quick') });
      await persist(next, 'Dia desat. Ja es mostra al calendari i a la llista de la compra.', 'day-form');
    }); });
    $('recipe-form').addEventListener('submit', event => { event.preventDefault(); run(async () => {
      const previous = data.recipes[selectedRecipe];
      const recipe = {
        ...(previous || { id: `recepta-${crypto.randomUUID()}`, image: '', pairings: [] }),
        title: value('recipe-title'), category: value('recipe-category'), difficulty: value('recipe-difficulty'),
        time: Number(value('recipe-time')), servings: Number(value('recipe-servings')),
        ingredients: lines('recipe-ingredients').map(line => {
          const parts = line.split('|').map(s => s.trim());
          if (parts.length > 3 || !parts[0]) throw new Error('Revisa els ingredients: nom | quantitat | unitat.');
          return { ingredient: parts[0], amount: parts[1] || '', unit: parts[2] || '' };
        }), steps: lines('recipe-steps'), season: list('recipe-season'), tags: list('recipe-tags'),
        allergens: list('recipe-allergens'), babyNotes: value('recipe-babyNotes'), variations: lines('recipe-variations')
      };
      const next = FamilyModel.editRecipe(data, recipe);
      await persist(next, 'Recepta desada i menús actualitzats.', 'recipe-form');
      showRecipe(recipe.id);
    }); });
    $('import-file').addEventListener('change', () => run(async () => {
      pendingImport = null; $('import-confirm').hidden = true; $('import-summary').textContent = '';
      const file = $('import-file').files[0]; if (!file) return;
      if (file.size > 6000000) throw new Error('L’arxiu és massa gran (màxim 6 MB).');
      const source = JSON.parse(await file.text());
      pendingImport = FamilyModel.validate({ menus: source.menus, recipes: source.recipes });
      $('import-summary').textContent = `${Object.keys(pendingImport.menus.days).length} dies i ${Object.keys(pendingImport.recipes).length} receptes. Substituirà tot el calendari i la biblioteca familiars. Descarrega una còpia abans si la vols conservar.`;
      $('import-confirm').hidden = false;
    }));
    $('import-confirm').addEventListener('click', () => run(async () => {
      if (!pendingImport || !confirmDiscard() || !window.confirm('Vols substituir el calendari i les receptes de tota la família amb aquesta còpia?')) return;
      await persist(pendingImport, 'Còpia importada.'); pendingImport = null;
      $('import-confirm').hidden = true; $('import-file').value = ''; $('import-summary').textContent = '';
    }));
    window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
    if (FamilyStore.signedIn() || FamilyStore.demo()) run(async () => {
      $('access').hidden = true; $('workspace').hidden = false;
      display(await FamilyStore.load());
    });
    else if (FamilyStore.configured() && window.location.hash.includes('access_token')) run(async () => {
      await FamilyStore.consumeOAuthCallback();
      $('access').hidden = true; $('workspace').hidden = false;
      display(await FamilyStore.load()); message('Ja ets al teu espai familiar.');
    });
  });
})();
