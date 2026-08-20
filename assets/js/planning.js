const planningState = { menus: {}, recipes: {}, period: 'week', anchor: null };

document.addEventListener('DOMContentLoaded', async () => {
  const [recipes, menus] = await Promise.all([fetchJSON('data/recipes.json'), fetchJSON('data/menus/2026.json')]);
  planningState.recipes = recipes;
  planningState.menus = menus.days || {};
  const params = new URLSearchParams(location.search);
  planningState.anchor = parseLocalDate(params.get('week')) || new Date();
  const initialWeek = mondayOf(planningState.anchor);
  if (addDays(initialWeek, 6) < new Date(2026, 0, 1, 12) || initialWeek > new Date(2026, 11, 31, 12)) planningState.anchor = new Date(2026, 0, 5, 12);
  bindPlanningControls();
  renderPlanningTool();
});

async function fetchJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`No s'ha pogut carregar ${path}`);
  return response.json();
}

function parseLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function isoDate(date) { return buildDateStr(date.getFullYear(), date.getMonth() + 1, date.getDate()); }
function mondayOf(date) { const result = new Date(date); result.setDate(result.getDate() - ((result.getDay() + 6) % 7)); return result; }
function addDays(date, days) { const result = new Date(date); result.setDate(result.getDate() + days); return result; }

function getRange() {
  if (planningState.period === 'year') return [new Date(2026, 0, 1, 12), new Date(2026, 11, 31, 12)];
  if (planningState.period === 'month') return [new Date(planningState.anchor.getFullYear(), planningState.anchor.getMonth(), 1, 12), new Date(planningState.anchor.getFullYear(), planningState.anchor.getMonth() + 1, 0, 12)];
  const start = mondayOf(planningState.anchor);
  return [start, addDays(start, 6)];
}

function rangeLabel() {
  const [start, end] = getRange();
  if (planningState.period === 'year') return String(start.getFullYear());
  if (planningState.period === 'month') return `${MONTHS_CA[start.getMonth()]} ${start.getFullYear()}`;
  return `${start.getDate()} ${MONTHS_CA[start.getMonth()].toLowerCase()} — ${end.getDate()} ${MONTHS_CA[end.getMonth()].toLowerCase()}`;
}

function mealsInRange() {
  const [start, end] = getRange();
  const meals = [];
  for (let date = new Date(start); date <= end; date = addDays(date, 1)) {
    const day = planningState.menus[isoDate(date)];
    if (!day) continue;
    ['lunch', 'dinner'].forEach(slot => {
      const meal = day[slot];
      if (!meal?.recipe) return;
      [meal.recipe, meal.side].filter(Boolean).forEach(id => planningState.recipes[id] && meals.push(planningState.recipes[id]));
    });
  }
  return meals;
}

function primaryMealsInRange() {
  const [start, end] = getRange();
  const meals = [];
  for (let date = new Date(start); date <= end; date = addDays(date, 1)) {
    const day = planningState.menus[isoDate(date)];
    if (!day) continue;
    ['lunch', 'dinner'].forEach(slot => {
      const recipe = planningState.recipes[day[slot]?.recipe];
      if (recipe) meals.push(recipe);
    });
  }
  return meals;
}

function bindPlanningControls() {
  document.querySelector('#period-tabs')?.addEventListener('click', event => {
    const button = event.target.closest('[data-period]');
    if (!button) return;
    planningState.period = button.dataset.period;
    renderPlanningTool();
  });
  document.querySelector('#prev-period')?.addEventListener('click', () => shiftPeriod(-1));
  document.querySelector('#next-period')?.addEventListener('click', () => shiftPeriod(1));
}

function shiftPeriod(amount) {
  const next = new Date(planningState.anchor);
  if (planningState.period === 'year') next.setFullYear(next.getFullYear() + amount);
  else if (planningState.period === 'month') next.setMonth(next.getMonth() + amount);
  else next.setDate(next.getDate() + amount * 7);
  const candidateStart = planningState.period === 'week' ? mondayOf(next) : next;
  const candidateEnd = planningState.period === 'week' ? addDays(candidateStart, 6) : next;
  if (candidateEnd < new Date(2026, 0, 1, 12) || candidateStart > new Date(2026, 11, 31, 12)) return;
  planningState.anchor = next;
  renderPlanningTool();
}

function renderPlanningTool() {
  setText('period-title', rangeLabel());
  document.querySelectorAll('[data-period]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.period === planningState.period)));
  if (document.body.dataset.tool === 'shopping') renderShopping();
  if (document.body.dataset.tool === 'nutrition') renderNutrition();
}

const pantryGroups = [
  ['Fruita i verdura', /tomà|ceba|pastanaga|patata|boniato|carbass|carabass|alberg|bròquil|espàrrec|xampiny|bolet|shiitake|porro|remolat|llimona|enciam|cogombre|pebrot|all/],
  ['Carn i peix', /pollastre|salmó|lluç|orada|tonyina|sèpia|carn|botifarra|xoriço|pernil|cansalada|hamburguesa/],
  ['Làctics i ous', /ou|formatge|llet|nata|mantega|iogurt/],
  ['Rebost', /.*/]
];

function groupForIngredient(name) { return pantryGroups.find(([, pattern]) => pattern.test(name.toLowerCase()))[0]; }

function renderShopping() {
  planningState.period = 'week';
  document.querySelector('#period-tabs')?.setAttribute('hidden', '');
  const ingredients = new Map();
  mealsInRange().forEach(recipe => (recipe.ingredients || []).forEach(item => {
    const name = (item.ingredient || item).trim();
    if (!name) return;
    const key = name.toLocaleLowerCase('ca');
    const current = ingredients.get(key) || { name, count: 0, group: groupForIngredient(name) };
    current.count++;
    ingredients.set(key, current);
  }));
  const groups = Object.groupBy ? Object.groupBy([...ingredients.values()], item => item.group) : [...ingredients.values()].reduce((acc, item) => ((acc[item.group] ||= []).push(item), acc), {});
  const list = document.querySelector('#tool-content');
  const storageKey = `dinf_shopping_${isoDate(getRange()[0])}`;
  const checked = new Set(storageGet(storageKey) || []);
  list.innerHTML = `<div class="shopping-actions"><button class="btn btn-sm btn-outline" id="clear-shopping">Desmarcar tot</button><button class="btn btn-sm" id="print-shopping">Imprimir</button></div><div class="shopping-grid">${pantryGroups.map(([group]) => !groups[group]?.length ? '' : `<section class="shopping-group"><h3>${group}</h3><div class="shopping-list">${groups[group].sort((a,b)=>a.name.localeCompare(b.name,'ca')).map(item => `<label class="shopping-item${checked.has(item.name) ? ' checked' : ''}"><input type="checkbox" value="${item.name}" ${checked.has(item.name) ? 'checked' : ''}><span>${item.name}</span><small>${item.count > 1 ? `${item.count} plats` : ''}</small></label>`).join('')}</div></section>`).join('')}</div>`;
  list.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
    input.closest('label').classList.toggle('checked', input.checked);
    storageSet(storageKey, [...list.querySelectorAll('input:checked')].map(item => item.value));
  }));
  list.querySelector('#clear-shopping')?.addEventListener('click', () => { storageSet(storageKey, []); renderShopping(); });
  list.querySelector('#print-shopping')?.addEventListener('click', () => window.print());
  setText('shopping-count', ingredients.size);
  setText('shopping-meals', mealsInRange().length);
}

const nutritionRules = [
  { key:'vegetables', label:'Verdura i hortalisses', target:10, includeSides:true, match:r => r.tags?.includes('vegetarià') || /amanid|verdura|bròquil|carbass|alberg|tomà|bolet|xampiny|espàrrec|shiitake/.test(`${r.title} ${(r.ingredients||[]).map(i=>i.ingredient).join(' ')}`.toLowerCase()) },
  { key:'fish', label:'Peix', target:3, match:r => r.tags?.includes('peix') },
  { key:'legumes', label:'Llegums', target:4, match:r => /llent|cigr|hummus|seques/.test(`${r.title} ${(r.ingredients||[]).map(i=>i.ingredient).join(' ')}`.toLowerCase()) },
  { key:'eggs', label:'Ous', target:3, match:r => /ou|truita|remenat/.test(`${r.title} ${(r.ingredients||[]).map(i=>i.ingredient).join(' ')}`.toLowerCase()) },
  { key:'meat', label:'Carn', target:3, maximum:true, match:r => r.tags?.includes('carn') },
  { key:'whole', label:'Cereals i tubercles', target:7, match:r => /pasta|arròs|paella|fideu|quinoa|patata|pizza|pa |galet/.test(`${r.title} ${(r.ingredients||[]).map(i=>i.ingredient).join(' ')}`.toLowerCase()) }
];

function renderNutrition() {
  document.querySelector('#period-tabs')?.removeAttribute('hidden');
  const allRecipes = mealsInRange();
  const primaryMeals = primaryMealsInRange();
  const multiplier = Math.max(1, primaryMeals.length / 14);
  const results = nutritionRules.map(rule => ({...rule, count:(rule.includeSides ? allRecipes : primaryMeals).filter(rule.match).length, expected:Math.round(rule.target * multiplier)}));
  const score = Math.round(results.reduce((sum,item)=>sum + (item.maximum ? Math.min(item.expected / Math.max(1,item.count),1) : Math.min(item.count / Math.max(1,item.expected),1)),0) / results.length * 100);
  const findings = results.map(item => {
    const low = !item.maximum && item.count < item.expected * .7;
    const highMeat = item.maximum && item.count > item.expected;
    const missing = Math.max(1, item.expected - item.count);
    const proposal = low && item.key === 'legumes'
      ? `Prova d’afegir ${missing} dinar(s) amb llegums; al vespre, mantén opcions més lleugeres.`
      : low
        ? `Prova d’afegir ${missing} àpat(s) amb ${item.label.toLowerCase()}.`
        : highMeat
          ? 'Canvia algun plat de carn per llegums al migdia, peix o una opció vegetal.'
          : 'Presència adequada dins del menú planificat.';
    return `<div class="nutrition-finding${low || highMeat ? '' : ' good'}"><strong>${low ? 'A reforçar' : highMeat ? 'A moderar' : 'Bon equilibri'} · ${item.label}</strong><span>${proposal}</span></div>`;
  }).join('');
  document.querySelector('#tool-content').innerHTML = `<div class="nutrition-layout"><section class="nutrition-card"><div class="nutrition-score" aria-label="Puntuació orientativa ${score} sobre 100">${score}</div><h3>Lectura global</h3><p>${score >= 85 ? 'El menú és variat i cobreix bé els grans grups.' : score >= 65 ? 'La base és bona, amb alguns grups per reforçar.' : 'Hi ha marge per repartir millor els grups durant el període.'}</p><p class="nutrition-note">Valoració orientativa basada en la varietat del menú. No calcula quantitats ni calories, i no substitueix el consell d’una dietista-nutricionista sanitària.</p></section><section class="nutrition-card"><h3>Freqüència dels grups</h3><div class="nutrition-bars">${results.map(item=>`<div><div class="nutrition-bar-head"><span>${item.label}</span><strong>${item.count} / ${item.expected}</strong></div><div class="nutrition-bar-track"><div class="nutrition-bar-fill" style="width:${Math.min(100,item.count/Math.max(1,item.expected)*100)}%"></div></div></div>`).join('')}</div></section><section class="nutrition-card" style="grid-column:1/-1"><h3>Valoració i propostes</h3><div class="nutrition-findings">${findings}</div></section></div>`;
}
