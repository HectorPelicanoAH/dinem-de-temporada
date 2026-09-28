/* Shared, dependency-free validation and editing rules. */
(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const idPattern = /^[a-z0-9][a-z0-9-]{0,119}$/;
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function text(value, label, max = 12000) {
    assert(typeof value === 'string' && value.length <= max, `${label}: text no vàlid.`);
  }
  function imagePath(value) {
    return typeof value === 'string' && (value === '' || /^assets\/images\/[a-zA-Z0-9/_.,-]+$/.test(value)
      || /^recipe-images\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.jpg$/.test(value));
  }
  function validateRecipe(recipe, id) {
    assert(idPattern.test(id) && recipe && recipe.id === id, 'Identificador de recepta no vàlid.');
    text(recipe.title, 'Nom', 200);
    assert(recipe.title.trim(), 'Escriu el nom de la recepta.');
    assert(Number.isFinite(recipe.time) && recipe.time >= 0 && recipe.time <= 10080, 'Temps no vàlid.');
    assert(Number.isFinite(recipe.servings) && recipe.servings > 0 && recipe.servings <= 1000, 'Racions no vàlides.');
    for (const key of ['category', 'difficulty', 'babyNotes']) text(recipe[key] ?? '', key);
    if (recipe.servingsUnit !== undefined) text(recipe.servingsUnit, 'Unitat de racions', 100);
    assert(imagePath(recipe.image || ''), 'La imatge ha de ser un fitxer de la biblioteca o una foto de recepta.');
    for (const key of ['season', 'tags', 'steps', 'allergens', 'variations', 'pairings']) {
      assert(Array.isArray(recipe[key] || []) && (recipe[key] || []).length <= 200, `${key}: llista no vàlida.`);
      for (const value of recipe[key] || []) text(value, key);
    }
    assert(Array.isArray(recipe.ingredients) && recipe.ingredients.length <= 200, 'Ingredients no vàlids.');
    for (const item of recipe.ingredients) {
      assert(item && typeof item === 'object', 'Ingredient no vàlid.');
      for (const key of ['ingredient', 'amount', 'unit']) text(item[key] ?? '', key, 500);
    }
  }
  function validate(data) {
    assert(data && data.menus && data.recipes && typeof data.recipes === 'object' && !Array.isArray(data.recipes), 'Còpia familiar no vàlida.');
    assert(data.menus.year === 2026 && data.menus.days && typeof data.menus.days === 'object' && !Array.isArray(data.menus.days), 'El calendari ha de ser de 2026.');
    assert(Object.keys(data.recipes).length <= 2000, 'Hi ha massa receptes en aquesta còpia.');
    for (const [id, recipe] of Object.entries(data.recipes)) validateRecipe(recipe, id);
    for (const recipe of Object.values(data.recipes)) {
      for (const id of recipe.pairings || []) assert(own(data.recipes, id), `Acompanyament inexistent: ${id}`);
    }
    for (const [date, day] of Object.entries(data.menus.days)) {
      assert(/^2026-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date, 'Data no vàlida.');
      assert(day && typeof day === 'object', 'Menú no vàlid.');
      for (const slot of ['lunch', 'dinner']) {
        const meal = day[slot];
        assert(meal && typeof meal === 'object', 'Àpat no vàlid.');
        text(meal.title, 'Títol del menú', 500);
        assert(own(data.recipes, meal.recipe), `Recepta inexistent: ${meal.recipe}`);
        if (meal.side) assert(own(data.recipes, meal.side), `Acompanyament inexistent: ${meal.side}`);
      }
      text(day.quickOption?.title ?? '', 'Opció ràpida', 500);
    }
    assert(JSON.stringify(data).length <= 3000000, 'La còpia és massa gran.');
    return data;
  }
  function meal(recipes, main, side, previous = {}) {
    assert(own(recipes, main) && (!side || own(recipes, side)), 'Selecciona una recepta vàlida.');
    const result = { ...previous, recipe: main, title: recipes[main].title };
    delete result.side;
    if (side) { result.side = side; result.title += ` · ${recipes[side].title}`; }
    return result;
  }
  function editDay(data, date, fields) {
    const next = clone(data), previous = next.menus.days[date] || {};
    next.menus.days[date] = {
      ...previous,
      lunch: meal(next.recipes, fields.lunch, fields.lunchSide, previous.lunch),
      dinner: meal(next.recipes, fields.dinner, fields.dinnerSide, previous.dinner),
      quickOption: { ...previous.quickOption, title: fields.quick }
    };
    return validate(next);
  }
  function editRecipe(data, recipe) {
    const next = clone(data);
    validateRecipe(recipe, recipe.id);
    next.recipes[recipe.id] = clone(recipe);
    for (const day of Object.values(next.menus.days)) {
      for (const slot of ['lunch', 'dinner']) {
        const entry = day[slot];
        if (entry.recipe === recipe.id || entry.side === recipe.id) day[slot] = meal(next.recipes, entry.recipe, entry.side, entry);
      }
    }
    return validate(next);
  }
  const api = { clone, validate, validateRecipe, editDay, editRecipe, imagePath };
  root.FamilyModel = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
