/**
 * app.js — Dinem en Família
 * Main application initialization and orchestration
 */

/* === App State === */
const App = {
  recipes: {},
  menus: {},
  isIndexPage: false,
  isRecipePage: false
};

/* === Entry Point === */
document.addEventListener('DOMContentLoaded', async () => {
  // Determine page
  const path = window.location.pathname;
  App.isRecipePage = path.includes('recepta.html');
  App.isIndexPage = !App.isRecipePage;

  // Set footer year
  setText('footer-year', new Date().getFullYear());

  // Mobile menu toggle
  initMobileMenu();

  // Load data
  try {
    const loadingOverlay = document.getElementById('loading-overlay');

    if (App.isIndexPage) {
      // Load both recipes and menus
      const [recipesData, menusData] = await Promise.all([
        fetchJSON('data/recipes.json'),
        fetchMenusForYear(2026)
      ]);

      App.recipes = recipesData;
      App.menus = menusData;

      // Init calendar
      initCalendar(App.menus, App.recipes);

    } else if (App.isRecipePage) {
      // Load only recipes
      App.recipes = await fetchJSON('data/recipes.json');

      // Check if showing detail or index
      const params = new URLSearchParams(window.location.search);
      const recipeId = params.get('id');

      if (recipeId) {
        initRecipeDetail(App.recipes);
      } else {
        initRecipeIndex(App.recipes);
      }
    }

    // Hide loading overlay
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      setTimeout(() => loadingOverlay.remove(), 400);
    }

  } catch (err) {
    console.error('Error carregant dades:', err);
    showDataError(err);
  }
});

/* === Data Fetching === */

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Error carregant ${path}: ${res.status}`);
  return res.json();
}

async function fetchMenusForYear(year) {
  try {
    return await fetchJSON(`data/menus/${year}.json`);
  } catch {
    // If year data not found, return empty structure
    console.warn(`No s'han trobat menús per l'any ${year}`);
    return { year, days: {} };
  }
}

/* === Mobile Menu === */

function initMobileMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  if (!toggle || !mobileNav) return;

  toggle.addEventListener('click', () => {
    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isExpanded));
    mobileNav.hidden = isExpanded;

    // Update nav link tabindex
    mobileNav.querySelectorAll('.nav-link').forEach(link => {
      link.tabIndex = isExpanded ? -1 : 0;
    });
  });

  // Close mobile nav on outside click
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !mobileNav.contains(e.target)) {
      toggle.setAttribute('aria-expanded', 'false');
      mobileNav.hidden = true;
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      toggle.setAttribute('aria-expanded', 'false');
      mobileNav.hidden = true;
      toggle.focus();
    }
  });
}

/* === Error Display === */

function showDataError(err) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.innerHTML = `
      <div style="text-align:center; padding:2rem; max-width:400px;">
        <div style="font-size:3rem; margin-bottom:1rem;">⚠️</div>
        <h2 style="font-family:var(--font-serif); color:var(--color-primary); margin-bottom:0.5rem;">Error carregant les dades</h2>
        <p style="color:var(--color-text-muted); margin-bottom:1.5rem; font-size:0.875rem;">
          No s'han pogut carregar els menús i receptes.<br>
          Comprova la connexió o torna-ho a intentar.
        </p>
        <button onclick="location.reload()" class="btn">Tornar a intentar</button>
      </div>
    `;
  }
}
