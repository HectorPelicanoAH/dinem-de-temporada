/**
 * utils.js — Dinem en Família
 * Utility functions: dates, tags, localStorage, search
 */

/* === Date Utilities === */

const MONTHS_CA = [
  'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny',
  'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'
];

const WEEKDAYS_CA = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'];
const WEEKDAYS_FULL_CA = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte', 'Diumenge'];

const SEASON_MAP = {
  3: 'primavera', 4: 'primavera', 5: 'primavera',
  6: 'estiu', 7: 'estiu', 8: 'estiu',
  9: 'tardor', 10: 'tardor', 11: 'tardor',
  12: 'hivern', 1: 'hivern', 2: 'hivern'
};

const SEASON_LABELS = {
  primavera: 'Primavera 🌱',
  estiu: 'Estiu ☀️',
  tardor: 'Tardor 🍂',
  hivern: 'Hivern ❄️'
};

const SEASON_EMOJIS = {
  primavera: '🌱',
  estiu: '☀️',
  tardor: '🍂',
  hivern: '❄️'
};

/**
 * Format a date string (YYYY-MM-DD) to Catalan long format
 */
function formatDateLong(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dow = date.getDay(); // 0=Sun
  const dowIdx = dow === 0 ? 6 : dow - 1; // Monday=0
  return `${WEEKDAYS_FULL_CA[dowIdx]}, ${day} de ${MONTHS_CA[month - 1]} de ${year}`;
}

/**
 * Format date as "15 gener" (short Catalan format)
 */
function formatDateShort(dateStr) {
  const [, month, day] = dateStr.split('-').map(Number);
  return `${day} ${MONTHS_CA[month - 1].toLowerCase()}`;
}

/**
 * Get ISO date string for today
 */
function getTodayStr() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

/**
 * Get season name for a month number (1-12)
 */
function getSeasonForMonth(month) {
  return SEASON_MAP[month] || 'hivern';
}

/**
 * Get number of days in a month
 */
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Get day of week (0=Mon...6=Sun) for first day of month
 */
function getFirstDayOfMonth(year, month) {
  const d = new Date(year, month - 1, 1).getDay();
  return d === 0 ? 6 : d - 1; // Mon=0
}

/**
 * Build date string from year/month/day
 */
function buildDateStr(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Check if a date string is today
 */
function isToday(dateStr) {
  return dateStr === getTodayStr();
}

/**
 * Check if date is weekend (Sat/Sun)
 */
function isWeekend(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

/* === Tag Rendering === */

const TAG_CONFIG = {
  'BLW':          { cls: 'tag-blw',        label: '👶 BLW' },
  'vegetarià':    { cls: 'tag-vegetarià',   label: '🥦 Vegetarià' },
  'peix':         { cls: 'tag-peix',        label: '🐟 Peix' },
  'carn':         { cls: 'tag-carn',        label: '🥩 Carn' },
  'pasta':        { cls: 'tag-pasta',       label: '🍝 Pasta' },
  'arròs':        { cls: 'tag-arròs',       label: '🍚 Arròs' },
  'llegums':      { cls: 'tag-llegums',     label: '🫘 Llegums' },
  'de temporada': { cls: 'tag-de-temporada', label: '🌿 Temporada' },
};

/**
 * Create a tag element
 */
function createTagEl(tagName) {
  const cfg = TAG_CONFIG[tagName];
  if (!cfg) return null;
  const span = document.createElement('span');
  span.className = `tag ${cfg.cls}`;
  span.textContent = cfg.label;
  return span;
}

/**
 * Render tags into a container element
 */
function renderTags(container, tags) {
  if (!container) return;
  container.innerHTML = '';
  if (!tags || !tags.length) return;
  tags.forEach(tag => {
    const el = createTagEl(tag);
    if (el) container.appendChild(el);
  });
}

/**
 * Get CSS class for a tag (for day cell coloring)
 */
function getTagClass(tags) {
  if (!tags) return '';
  if (tags.includes('peix')) return 'tag-peix';
  if (tags.includes('vegetarià')) return 'tag-vegetaria';
  if (tags.includes('carn')) return 'tag-carn';
  return '';
}

/* === Category Labels === */
const CATEGORY_LABELS = {
  'arròs': 'Arròs',
  'pasta': 'Pasta',
  'peix': 'Peix',
  'carn': 'Carn',
  'llegums': 'Llegums',
  'cremes': 'Cremes i sopes',
  'amanides': 'Amanides',
  'pizza': 'Pizza',
  'forn': 'Plats al forn',
  'catalana': 'Cuina catalana',
  'mediterrània': 'Cuina mediterrània',
  'ous': 'Ous i truites',
  'entrepans': 'Entrepans',
  'acompanyaments': 'Acompanyaments',
};

function getCategoryLabel(cat) {
  return CATEGORY_LABELS[cat] || cat;
}

/* === Difficulty Label === */
function getDifficultyStars(difficulty) {
  const map = { 'Fàcil': '⭐', 'Mitjana': '⭐⭐', 'Difícil': '⭐⭐⭐' };
  return map[difficulty] || difficulty;
}

/* === Time Formatting === */
function formatTime(minutes) {
  if (!minutes) return 'N/D';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/* === localStorage Helpers === */

const STORAGE_KEYS = {
  FAVORITES: 'dinf_favorites',
  HISTORY: 'dinf_history',
  YEAR: 'dinf_year',
  VIEW: 'dinf_view',
  MONTH: 'dinf_month',
};

function storageGet(key) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable
  }
}

/* Favorites */
function getFavorites() {
  return storageGet(STORAGE_KEYS.FAVORITES) || [];
}

function addFavorite(recipeId) {
  const favs = getFavorites();
  if (!favs.includes(recipeId)) {
    favs.push(recipeId);
    storageSet(STORAGE_KEYS.FAVORITES, favs);
  }
}

function removeFavorite(recipeId) {
  const favs = getFavorites().filter(id => id !== recipeId);
  storageSet(STORAGE_KEYS.FAVORITES, favs);
}

function isFavorite(recipeId) {
  return getFavorites().includes(recipeId);
}

function toggleFavorite(recipeId) {
  if (isFavorite(recipeId)) {
    removeFavorite(recipeId);
    return false;
  } else {
    addFavorite(recipeId);
    return true;
  }
}

/* History */
function addToHistory(recipeId) {
  if (!recipeId) return;
  let history = storageGet(STORAGE_KEYS.HISTORY) || [];
  history = history.filter(id => id !== recipeId);
  history.unshift(recipeId);
  history = history.slice(0, 20); // Keep last 20
  storageSet(STORAGE_KEYS.HISTORY, history);
}

function getHistory() {
  return storageGet(STORAGE_KEYS.HISTORY) || [];
}

/* === Search Utilities === */

/**
 * Simple fuzzy match: check if query words appear in text
 */
function fuzzyMatch(text, query) {
  if (!text || !query) return false;
  const lText = text.toLowerCase();
  const lQuery = query.toLowerCase().trim();
  if (lText.includes(lQuery)) return true;
  const words = lQuery.split(/\s+/);
  return words.every(word => lText.includes(word));
}

/**
 * Search recipes by query string
 */
function searchRecipes(recipes, query) {
  if (!query || !query.trim()) return Object.values(recipes);
  const q = query.trim();
  return Object.values(recipes).filter(recipe => {
    if (fuzzyMatch(recipe.title, q)) return true;
    if (recipe.ingredients && recipe.ingredients.some(ing =>
      fuzzyMatch(ing.ingredient || ing, q)
    )) return true;
    if (recipe.tags && recipe.tags.some(tag => fuzzyMatch(tag, q))) return true;
    if (recipe.category && fuzzyMatch(recipe.category, q)) return true;
    return false;
  });
}

/**
 * Filter recipes by category, season, time, tags
 */
function filterRecipes(recipes, { category, season, maxTime, tag } = {}) {
  let list = Object.values(recipes);
  if (category) list = list.filter(r => r.category === category);
  if (season) list = list.filter(r => r.season && r.season.includes(season));
  if (maxTime) list = list.filter(r => r.time && r.time <= parseInt(maxTime));
  if (tag && tag !== 'all') list = list.filter(r => r.tags && r.tags.includes(tag));
  return list;
}

/* === DOM Helpers === */

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setAttr(id, attr, value) {
  const el = document.getElementById(id);
  if (el) el.setAttribute(attr, value);
}

function showEl(id) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) el.hidden = false;
}

function hideEl(id) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) el.hidden = true;
}

function toggleEl(id, show) {
  if (show) showEl(id); else hideEl(id);
}

/* === Debounce === */
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* === Trap Focus in Modal === */
function trapFocus(element) {
  const focusable = element.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  function handleKeydown(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  element.addEventListener('keydown', handleKeydown);
  return () => element.removeEventListener('keydown', handleKeydown);
}

/* === Export for use in other modules === */
// (all functions available as globals in vanilla JS)
