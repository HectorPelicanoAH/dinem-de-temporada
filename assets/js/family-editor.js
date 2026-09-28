(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let data = null, pendingImport = null, pendingDraft = null, dirty = false, busy = false;
  let pendingCoverFile = null, pendingCoverPath = '', coverPreviewUrl = '';
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
    pendingCoverFile = null; pendingCoverPath = ''; $('recipe-cover').value = '';
    showCoverPreview(FamilyStore.imageUrl(recipe.image));
    $('save-public-cover').hidden = !id.startsWith('pub-');
    for (const key of ['category', 'difficulty']) {
      if (recipe[key] && ![...$(`recipe-${key}`).options].some(o => o.value === recipe[key])) $(`recipe-${key}`).add(new Option(recipe[key], recipe[key]));
    }
    for (const key of ['title', 'category', 'difficulty', 'time', 'servings', 'servingsUnit', 'babyNotes']) $(`recipe-${key}`).value = recipe[key] ?? (key === 'servingsUnit' ? 'persones' : '');
    for (const key of ['season', 'tags', 'allergens']) $(`recipe-${key}`).value = (recipe[key] || []).join(', ');
    for (const key of ['steps', 'variations']) $(`recipe-${key}`).value = (recipe[key] || []).join('\n');
    $('recipe-ingredients').value = (recipe.ingredients || []).map(i => [i.ingredient, i.amount, i.unit].join(' | ')).join('\n');
    $('recipe-reviewed').checked = false;
    $('photo-warnings').textContent = '';
  }
  function showCoverPreview(source) {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    coverPreviewUrl = '';
    $('recipe-cover-preview').hidden = !source;
    $('recipe-cover-preview').src = source || '';
  }
  function chooseCover(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10000000) throw new Error('La foto ha de ser JPG, PNG o WebP i ocupar menys de 10 MB.');
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    pendingCoverFile = file; pendingCoverPath = '';
    coverPreviewUrl = URL.createObjectURL(file);
    $('recipe-cover-preview').src = coverPreviewUrl;
    $('recipe-cover-preview').hidden = false;
  }
  function recipeFromForm(id, previous = {}, image = previous.image || '') {
    const recipe = {
      ...previous, id, image, pairings: previous.pairings || [],
      title: value('recipe-title'), category: value('recipe-category'), difficulty: value('recipe-difficulty'),
      time: Number(value('recipe-time')), servings: Number(value('recipe-servings')), servingsUnit: value('recipe-servingsUnit'),
      ingredients: lines('recipe-ingredients').map(line => {
        const parts = line.split('|').map(s => s.trim());
        if (parts.length > 3 || !parts[0]) throw new Error('Revisa els ingredients: nom | quantitat | unitat.');
        return { ingredient: parts[0], amount: parts[1] || '', unit: parts[2] || '' };
      }), steps: lines('recipe-steps'), season: list('recipe-season'), tags: list('recipe-tags'),
      allergens: list('recipe-allergens'), babyNotes: value('recipe-babyNotes'), variations: lines('recipe-variations')
    };
    if (!recipe.ingredients.length || !recipe.steps.length) throw new Error('La recepta necessita ingredients i passos.');
    FamilyModel.validateRecipe(recipe, id);
    return recipe;
  }
  async function compressPhoto(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10000000) throw new Error('Cada foto ha de ser JPG, PNG o WebP i ocupar menys de 10 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      if (dataUrl.length > 3000000) throw new Error('Una foto continua sent massa gran després de reduir-la.');
      return dataUrl;
    } finally { bitmap.close(); }
  }
  async function processedCover(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10000000) throw new Error('La foto ha de ser JPG, PNG o WebP i ocupar menys de 10 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (let attempt = 0; attempt < 6; attempt++) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .82));
        if (blob && blob.size <= 1900000) return blob;
        const smaller = document.createElement('canvas');
        smaller.width = Math.max(1, Math.round(canvas.width * .8));
        smaller.height = Math.max(1, Math.round(canvas.height * .8));
        smaller.getContext('2d').drawImage(canvas, 0, 0, smaller.width, smaller.height);
        canvas.width = smaller.width; canvas.height = smaller.height;
        canvas.getContext('2d').drawImage(smaller, 0, 0);
      }
      throw new Error('La foto continua sent massa gran després de reduir-la.');
    } finally { bitmap.close(); }
  }
  async function coverImagePath(previous = '') {
    if (!pendingCoverFile) return previous;
    if (!pendingCoverPath) pendingCoverPath = await FamilyStore.uploadRecipeImage(await processedCover(pendingCoverFile));
    return pendingCoverPath;
  }
  function fillExtractedRecipe(draft) {
    showRecipe('');
    for (const key of ['category', 'difficulty']) {
      if (draft[key] && ![...$(`recipe-${key}`).options].some(option => option.value === draft[key])) $(`recipe-${key}`).add(new Option(draft[key], draft[key]));
    }
    for (const key of ['title', 'category', 'difficulty', 'time', 'servings', 'servingsUnit', 'babyNotes']) $(`recipe-${key}`).value = draft[key] ?? '';
    for (const key of ['season', 'tags', 'allergens']) $(`recipe-${key}`).value = (draft[key] || []).join(', ');
    for (const key of ['steps', 'variations']) $(`recipe-${key}`).value = (draft[key] || []).join('\n');
    $('recipe-ingredients').value = (draft.ingredients || []).map(item => [item.ingredient, item.amount, item.unit].join(' | ')).join('\n');
    const warnings = [...(draft.warnings || [])];
    if (draft.time == null) warnings.push('Falta el temps total.');
    if (draft.servings == null) warnings.push('Falten les racions o unitats.');
    if (!draft.servingsUnit) warnings.push('Indica si són persones, racions o unitats.');
    $('photo-warnings').textContent = warnings.length ? `Revisa abans de publicar: ${warnings.join(' ')}` : 'Esborrany preparat. Comprova’l amb les fotos abans de publicar.';
    dirty = true; dirtyForms.add('recipe-form');
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
    $('not-configured').hidden = FamilyStore.configured();
    $('google-login').hidden = !FamilyStore.configured();
    $('google-login').addEventListener('click', () => run(async () => FamilyStore.signInWithGoogle()));
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
    $('recipe-cover').addEventListener('change', () => run(async () => {
      chooseCover($('recipe-cover').files[0]);
      dirty = true; dirtyForms.add('recipe-form');
    }));
    for (const form of ['day-form', 'recipe-form']) $(form).addEventListener('input', event => { if (event.target.id !== 'day-date') { dirty = true; dirtyForms.add(form); } });
    $('day-form').addEventListener('submit', event => { event.preventDefault(); run(async () => {
      const next = FamilyModel.editDay(data, value('day-date'), { lunch: value('lunch'), lunchSide: value('lunch-side'), dinner: value('dinner'), dinnerSide: value('dinner-side'), quick: value('quick') });
      await persist(next, 'Dia desat. Ja es mostra al calendari i a la llista de la compra.', 'day-form');
    }); });
    $('recipe-form').addEventListener('submit', event => { event.preventDefault(); run(async () => {
      const previous = data.recipes[selectedRecipe];
      if (selectedRecipe.startsWith('pub-') && pendingCoverFile) throw new Error('Per canviar la foto d’una recepta pública, prem «Desar foto pública».');
      const recipe = recipeFromForm(selectedRecipe || `recepta-${crypto.randomUUID()}`, previous);
      const image = await coverImagePath(previous?.image || '');
      recipe.image = image;
      const next = FamilyModel.editRecipe(data, recipe);
      await persist(next, 'Recepta desada i menús actualitzats.', 'recipe-form');
      showRecipe(recipe.id);
    }); });
    $('extract-recipe').addEventListener('click', () => run(async () => {
      const files = [...$('recipe-photos').files];
      if (files.length < 1 || files.length > 4) throw new Error('Tria entre una i quatre fotos de la mateixa recepta.');
      if (!confirmDiscard()) return;
      message('Llegint les fotos…');
      const images = await Promise.all(files.map(compressPhoto));
      const draft = await FamilyStore.extractRecipe(images);
      fillExtractedRecipe(draft);
      chooseCover(files[0]);
      message('Esborrany preparat. Revisa i completa la recepta abans de publicar.');
    }));
    $('publish-recipe').addEventListener('click', () => {
      if (!$('recipe-form').reportValidity()) return;
      run(async () => {
      if (selectedRecipe) throw new Error('Tria «Nova recepta» per publicar-ne una de nova.');
      if (!$('recipe-reviewed').checked) throw new Error('Confirma que has revisat la fitxa abans de publicar-la.');
      const recipe = recipeFromForm(`pub-${crypto.randomUUID()}`);
      const image = await coverImagePath();
      recipe.image = image;
      const published = await FamilyStore.publishRecipe(recipe);
      data.recipes[published.id] = published;
      dirtyForms.delete('recipe-form'); dirty = dirtyForms.size > 0;
      refreshOptions(); showRecipe(published.id);
      $('recipe-photos').value = '';
      message(`«${published.title}» ja és pública per a tothom.`);
      });
    });
    $('save-public-cover').addEventListener('click', () => run(async () => {
      if (!selectedRecipe.startsWith('pub-') || !pendingCoverFile) throw new Error('Tria una foto nova per a aquesta recepta pública.');
      const imagePath = await coverImagePath();
      const saved = await FamilyStore.setPublicRecipeImage(selectedRecipe, imagePath);
      data.recipes[saved.id] = saved;
      pendingCoverFile = null; pendingCoverPath = ''; $('recipe-cover').value = '';
      showCoverPreview(FamilyStore.imageUrl(imagePath));
      message('Foto pública desada. Els altres canvis del formulari, si n’hi ha, encara no s’han desat.');
    }));
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
