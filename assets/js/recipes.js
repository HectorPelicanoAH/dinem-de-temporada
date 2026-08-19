/**
 * recipes.js — Dinem en Família
 * Recipe loading, display, and search functionality
 */

/* === Recipe Index Page === */

/**
 * Initialize the recipe index page
 */
function initRecipeIndex(recipes) {
  const grid = document.getElementById('recipe-grid');
  const countEl = document.getElementById('recipe-count');
  if (!grid) return;

  let currentFilters = {
    query: '',
    category: '',
    season: '',
    maxTime: '',
    tag: 'all'
  };

  // Render all recipes initially
  renderRecipeGrid(grid, Object.values(recipes), countEl);

  // Search input
  const searchInput = document.getElementById('recipe-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      currentFilters.query = searchInput.value;
      applyFilters();
    }, 300));
  }

  // Category filter
  const categoryFilter = document.getElementById('filter-category');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      currentFilters.category = categoryFilter.value;
      applyFilters();
    });
  }

  // Season filter
  const seasonFilter = document.getElementById('filter-season');
  if (seasonFilter) {
    seasonFilter.addEventListener('change', () => {
      currentFilters.season = seasonFilter.value;
      applyFilters();
    });
  }

  // Time filter
  const timeFilter = document.getElementById('filter-time');
  if (timeFilter) {
    timeFilter.addEventListener('change', () => {
      currentFilters.maxTime = timeFilter.value;
      applyFilters();
    });
  }

  // Tag filters
  const tagFilters = document.querySelectorAll('.recipe-filters .tag-filter');
  tagFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      tagFilters.forEach(b => {
        b.setAttribute('aria-pressed', 'false');
        b.classList.remove('active');
      });
      btn.setAttribute('aria-pressed', 'true');
      btn.classList.add('active');
      currentFilters.tag = btn.dataset.tag;
      applyFilters();
    });
  });

  function applyFilters() {
    let results = Object.values(recipes);

    // Text search
    if (currentFilters.query) {
      results = searchRecipes(recipes, currentFilters.query);
    }

    // Additional filters
    results = results.filter(recipe => {
      if (currentFilters.category && recipe.category !== currentFilters.category) return false;
      if (currentFilters.season && !(recipe.season && recipe.season.includes(currentFilters.season))) return false;
      if (currentFilters.maxTime && recipe.time > parseInt(currentFilters.maxTime)) return false;
      if (currentFilters.tag && currentFilters.tag !== 'all' && !(recipe.tags && recipe.tags.includes(currentFilters.tag))) return false;
      return true;
    });

    renderRecipeGrid(grid, results, countEl);
  }
}

/**
 * Render a grid of recipe cards
 */
function renderRecipeGrid(container, recipes, countEl) {
  container.innerHTML = '';

  if (countEl) {
    countEl.textContent = `${recipes.length} recepta${recipes.length !== 1 ? 's' : ''} trobada${recipes.length !== 1 ? 'es' : ''}`;
  }

  if (recipes.length === 0) {
    container.innerHTML = `
      <div class="no-results" style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--color-text-muted);">
        <div style="font-size:3rem;margin-bottom:1rem;">🔍</div>
        <p>No s'han trobat receptes amb aquests filtres.</p>
      </div>`;
    return;
  }

  recipes.forEach(recipe => {
    const card = createRecipeCard(recipe);
    container.appendChild(card);
  });
}

/**
 * Create a recipe card DOM element
 */
function createRecipeCard(recipe) {
  const a = document.createElement('a');
  a.href = `recepta.html?id=${recipe.id}`;
  a.className = 'recipe-card';
  a.setAttribute('role', 'listitem');
  a.setAttribute('aria-label', `Recepta: ${recipe.title}`);

  const tagsHTML = (recipe.tags || []).slice(0, 3).map(tag => {
    const cfg = TAG_CONFIG[tag];
    if (!cfg) return '';
    return `<span class="tag ${cfg.cls}">${cfg.label}</span>`;
  }).join('');

  const categoryLabel = getCategoryLabel(recipe.category);
  const seasons = (recipe.season || []).map(s => SEASON_EMOJIS[s] || '').join(' ');

  a.innerHTML = `
    <div class="recipe-card-image">
      ${recipe.image
        ? `<img src="${recipe.image}" alt="${recipe.title}" loading="lazy" />`
        : `<div class="recipe-card-placeholder">
            <span>🍽️</span>
            <span>Fotografia pròximament</span>
          </div>`
      }
    </div>
    <div class="recipe-card-body">
      <div class="recipe-card-category">${categoryLabel}</div>
      <h3 class="recipe-card-title">${recipe.title}</h3>
      <div class="recipe-card-meta">
        <span>⏱ ${formatTime(recipe.time)}</span>
        <span>${getDifficultyStars(recipe.difficulty)}</span>
        <span>${seasons}</span>
      </div>
      <div class="recipe-card-tags">${tagsHTML}</div>
    </div>
  `;

  return a;
}

/* === Recipe Detail Page === */

/**
 * Initialize recipe detail page from URL param
 */
function initRecipeDetail(recipes) {
  const params = new URLSearchParams(window.location.search);
  const recipeId = params.get('id');

  if (!recipeId) return false;

  const recipe = recipes[recipeId];
  if (!recipe) {
    showRecipeNotFound(recipeId);
    return false;
  }

  // Track history
  addToHistory(recipeId);

  // Show detail, hide index
  const detail = document.getElementById('recipe-detail');
  const index = document.getElementById('recipe-index');
  if (detail) showEl(detail);
  if (index) hideEl(index);

  // Inject Schema.org
  injectRecipeSchema(recipe);

  // Update page title
  document.title = `${recipe.title} — Dinem en Família`;

  // Populate all fields
  populateRecipeDetail(recipe, recipes);

  return true;
}

/**
 * Populate all recipe detail fields
 */
function populateRecipeDetail(recipe, allRecipes) {
  // Header
  const categoryBadge = document.getElementById('recipe-category-badge');
  if (categoryBadge) categoryBadge.textContent = getCategoryLabel(recipe.category);

  setText('recipe-title', recipe.title);
  setText('recipe-time', formatTime(recipe.time));
  setText('recipe-difficulty', recipe.difficulty || 'N/D');
  setText('recipe-servings', `${recipe.servings || 4} persones`);

  const seasonEl = document.getElementById('recipe-season');
  if (seasonEl) {
    seasonEl.textContent = (recipe.season || []).map(s => SEASON_LABELS[s]).join(', ') || 'Tot l\'any';
  }

  // Tags
  const tagsContainer = document.getElementById('recipe-tags');
  if (tagsContainer) renderTags(tagsContainer, recipe.tags);

  // Image
  if (recipe.image) {
    const img = document.getElementById('recipe-image');
    const placeholder = document.getElementById('recipe-image-placeholder');
    if (img && placeholder) {
      img.src = recipe.image;
      img.alt = recipe.title;
      img.hidden = false;
      placeholder.hidden = true;
    }
  }

  // Ingredients
  const ingredientsList = document.getElementById('recipe-ingredients');
  if (ingredientsList && recipe.ingredients) {
    ingredientsList.innerHTML = recipe.ingredients.map(ing => {
      const amount = ing.amount ? `<span class="ingredient-amount">${ing.amount} ${ing.unit || ''}</span>` : '';
      const name = `<span class="ingredient-name">${ing.ingredient || ing}</span>`;
      return `<li class="ingredient-item">${amount}${name}</li>`;
    }).join('');
  }

  // Steps
  const stepsList = document.getElementById('recipe-steps');
  if (stepsList && recipe.steps) {
    stepsList.innerHTML = recipe.steps.map((step, i) =>
      `<li class="step-item">
        <span class="step-number" aria-label="Pas ${i + 1}">${i + 1}</span>
        <span>${step}</span>
      </li>`
    ).join('');
  }

  // Allergens
  if (recipe.allergens && recipe.allergens.length > 0) {
    const allergensContainer = document.getElementById('recipe-allergens');
    if (allergensContainer) {
      allergensContainer.innerHTML = recipe.allergens.map(a =>
        `<span class="allergen-badge">⚠️ ${a}</span>`
      ).join('');
    }
  } else {
    const allergensSection = document.getElementById('allergens-container');
    if (allergensSection) hideEl(allergensSection);
  }

  // Baby Notes
  if (recipe.babyNotes) {
    setHTML('recipe-baby-notes', recipe.babyNotes);
  } else {
    const babySection = document.getElementById('baby-container');
    if (babySection) hideEl(babySection);
  }

  // Variants of the same preparation
  const optionsSection = document.getElementById('options-container');
  const optionsList = document.getElementById('recipe-options');
  if (optionsSection && optionsList && recipe.variations?.length) {
    optionsList.innerHTML = recipe.variations.map(option => `<span>${option}</span>`).join('');
    showEl(optionsSection);
  }

  // Suggested combinations and side dishes
  const pairingsSection = document.getElementById('pairings-container');
  const pairingsGrid = document.getElementById('recipe-pairings');
  if (pairingsSection && pairingsGrid && recipe.pairings?.length) {
    const pairings = recipe.pairings.map(id => allRecipes[id]).filter(Boolean);
    if (pairings.length) {
      renderRecipeGrid(pairingsGrid, pairings);
      showEl(pairingsSection);
    }
  }

  // Favorite button state
  const favBtn = document.getElementById('toggle-favorite');
  const favText = document.getElementById('favorite-text');
  if (favBtn) {
    const fav = isFavorite(recipe.id);
    favBtn.setAttribute('aria-pressed', String(fav));
    favBtn.style.color = fav ? 'var(--color-accent)' : '';
    if (favText) favText.textContent = fav ? 'Treure dels favorits' : 'Afegir als favorits';

    favBtn.addEventListener('click', () => {
      const nowFav = toggleFavorite(recipe.id);
      favBtn.setAttribute('aria-pressed', String(nowFav));
      favBtn.style.color = nowFav ? 'var(--color-accent)' : '';
      if (favText) favText.textContent = nowFav ? 'Treure dels favorits' : 'Afegir als favorits';
    });
  }

  // Print button
  const printBtn = document.getElementById('print-recipe');
  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }

  // Related recipes
  if (allRecipes) renderRelatedRecipes(recipe, allRecipes);
}

/**
 * Render related recipes section
 */
function renderRelatedRecipes(recipe, allRecipes) {
  const container = document.getElementById('related-recipes');
  const section = document.getElementById('related-container');
  if (!container) return;

  // Find recipes with same category or tags
  const related = Object.values(allRecipes)
    .filter(r => r.id !== recipe.id)
    .filter(r => {
      if (r.category === recipe.category) return true;
      if (r.tags && recipe.tags) {
        return r.tags.some(tag => recipe.tags.includes(tag));
      }
      return false;
    })
    .slice(0, 4);

  if (related.length === 0) {
    if (section) hideEl(section);
    return;
  }

  container.innerHTML = '';
  related.forEach(r => {
    const card = createRecipeCard(r);
    card.setAttribute('role', 'listitem');
    container.appendChild(card);
  });
}

/**
 * Inject Schema.org Recipe structured data
 */
function injectRecipeSchema(recipe) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    "name": recipe.title,
    "recipeCategory": getCategoryLabel(recipe.category),
    "recipeCuisine": "Mediterrània",
    "totalTime": `PT${recipe.time}M`,
    "recipeYield": `${recipe.servings || 4} persones`,
    "description": `Recepta de ${recipe.title} — cuina mediterrània casolana, de temporada i apta per a nadons.`,
    "keywords": (recipe.tags || []).join(', '),
    "recipeIngredient": (recipe.ingredients || []).map(ing =>
      `${ing.amount || ''} ${ing.unit || ''} ${ing.ingredient || ing}`.trim()
    ),
    "recipeInstructions": (recipe.steps || []).map((step, i) => ({
      "@type": "HowToStep",
      "position": i + 1,
      "text": step
    }))
  };

  if (recipe.image) schema.image = recipe.image;

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

/**
 * Show recipe not found message
 */
function showRecipeNotFound(recipeId) {
  const detail = document.getElementById('recipe-detail');
  const index = document.getElementById('recipe-index');
  if (detail) {
    showEl(detail);
    detail.innerHTML = `
      <div style="text-align:center; padding:4rem 2rem;">
        <div style="font-size:4rem; margin-bottom:1rem;">🍽️</div>
        <h1 style="font-family:var(--font-serif);color:var(--color-primary);">Recepta no trobada</h1>
        <p style="color:var(--color-text-muted);margin:1rem 0 2rem;">No hem trobat la recepta "${recipeId}".</p>
        <a href="recepta.html" class="btn">← Totes les receptes</a>
      </div>`;
  }
  if (index) hideEl(index);
}

/* === Calendar Modal Recipe Info === */

/**
 * Populate recipe info in day modal
 */
function populateMealInfo(mealSection, mealData, recipes, prefix) {
  if (!mealData) return;

  setText(`${prefix}-title`, mealData.title);

  // Try to get recipe data for tags/ingredients
  const recipeId = mealData.recipe;
  if (recipeId && recipes && recipes[recipeId]) {
    const recipe = recipes[recipeId];

    // Tags
    const tagsContainer = document.getElementById(`${prefix}-tags`);
    if (tagsContainer) renderTags(tagsContainer, recipe.tags);

    // Ingredients preview (first 4)
    const ingredientsContainer = document.getElementById(`${prefix}-ingredients`);
    if (ingredientsContainer && recipe.ingredients && recipe.ingredients.length) {
      const preview = recipe.ingredients.slice(0, 4)
        .map(ing => ing.ingredient || ing)
        .join(', ');
      ingredientsContainer.textContent = preview + (recipe.ingredients.length > 4 ? '...' : '');
    }

    // Link
    const link = document.getElementById(`${prefix}-recipe-link`);
    if (link) {
      link.href = `recepta.html?id=${recipeId}`;
      link.style.display = '';
      link.hidden = false;
      link.textContent = mealData.side ? 'Veure recepta principal →' : 'Veure recepta →';
      link.setAttribute('aria-label', `Veure recepta: ${recipe.title}`);
    }

    // Optional linked side dish
    const sideLink = document.getElementById(`${prefix}-side-recipe-link`);
    const sideRecipe = mealData.side && recipes[mealData.side];
    if (sideLink && sideRecipe) {
      sideLink.href = `recepta.html?id=${sideRecipe.id}`;
      sideLink.hidden = false;
      sideLink.setAttribute('aria-label', `Veure recepta acompanyant: ${sideRecipe.title}`);
    } else if (sideLink) {
      sideLink.hidden = true;
      sideLink.removeAttribute('href');
    }
  } else {
    // Hide tag/ingredient/link elements if no recipe found
    const tagsContainer = document.getElementById(`${prefix}-tags`);
    const ingredientsContainer = document.getElementById(`${prefix}-ingredients`);
    const link = document.getElementById(`${prefix}-recipe-link`);
    const sideLink = document.getElementById(`${prefix}-side-recipe-link`);
    if (tagsContainer) tagsContainer.innerHTML = '';
    if (ingredientsContainer) ingredientsContainer.textContent = '';
    if (link) link.style.display = 'none';
    if (sideLink) sideLink.hidden = true;
  }
}
