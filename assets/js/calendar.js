/**
 * calendar.js — Dinem en Família
 * Calendar rendering engine (annual + monthly + weekly views)
 */

/* === State === */
let calendarState = {
  view: 'annual',        // 'annual' | 'monthly' | 'weekly'
  year: 2026,
  month: 1,             // for monthly view (1-12)
  weekStart: null,       // ISO date string for weekly view (Monday)
  selectedDate: null,
  filterTag: 'all',
  menus: {},
  recipes: {}
};

/* === Init === */

/**
 * Initialize calendar with data and state
 */
function initCalendar(menus, recipes) {
  calendarState.menus = menus.days || menus || {};
  calendarState.recipes = recipes;

  // The app currently loads one menu file at a time. Keep the calendar on
  // that data year instead of restoring a stale year with no menus.
  const menuYear = Number(menus.year) || calendarState.year;
  calendarState.year = menuYear;

  // Restore saved state
  const savedYear = storageGet(STORAGE_KEYS.YEAR);
  const savedView = storageGet(STORAGE_KEYS.VIEW);
  const savedMonth = storageGet(STORAGE_KEYS.MONTH);

  if (savedYear === menuYear) calendarState.year = savedYear;
  if (savedView) calendarState.view = savedView;
  if (savedMonth) calendarState.month = savedMonth;

  // Bind controls
  bindCalendarControls();

  // Initial render
  renderCalendar();

  // Set year display
  updateYearDisplay();

  // Activate saved view button
  updateViewButtons();
}

/* === Controls === */

function bindCalendarControls() {
  // Year navigation
  document.getElementById('prev-year')?.addEventListener('click', () => {
    calendarState.year--;
    if (calendarState.view === 'weekly') calendarState.weekStart = null;
    storageSet(STORAGE_KEYS.YEAR, calendarState.year);
    updateYearDisplay();
    renderCalendar();
  });

  document.getElementById('next-year')?.addEventListener('click', () => {
    calendarState.year++;
    if (calendarState.view === 'weekly') calendarState.weekStart = null;
    storageSet(STORAGE_KEYS.YEAR, calendarState.year);
    updateYearDisplay();
    renderCalendar();
  });

  // View toggle
  document.getElementById('view-annual')?.addEventListener('click', () => {
    setView('annual');
  });

  document.getElementById('view-monthly')?.addEventListener('click', () => {
    setView('monthly');
  });

  document.getElementById('view-weekly')?.addEventListener('click', () => {
    const today = new Date();
    calendarState.weekStart = dateToISO(getMonday(today));
    calendarState.year = today.getFullYear();
    storageSet(STORAGE_KEYS.YEAR, calendarState.year);
    updateYearDisplay();
    setView('weekly');
  });

  // Search
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      const query = searchInput.value.trim();
      if (query.length > 1) {
        showSearchResults(query);
      } else {
        hideSearchResults();
      }
    }, 300));

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideSearchResults();
    });
  }

  document.getElementById('close-search')?.addEventListener('click', () => {
    hideSearchResults();
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
  });

  document.getElementById('search-btn')?.addEventListener('click', () => {
    const query = document.getElementById('search-input')?.value.trim();
    if (query && query.length > 1) showSearchResults(query);
  });

  // Tag filters
  document.querySelectorAll('.controls-bar .tag-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.controls-bar .tag-filter').forEach(b => {
        b.setAttribute('aria-pressed', 'false');
        b.classList.remove('active');
      });
      btn.setAttribute('aria-pressed', 'true');
      btn.classList.add('active');
      calendarState.filterTag = btn.dataset.tag;
      renderCalendar();
    });
  });
}

function setView(view) {
  calendarState.view = view;
  storageSet(STORAGE_KEYS.VIEW, view);
  updateViewButtons();
  renderCalendar();
}

function updateViewButtons() {
  const annualBtn = document.getElementById('view-annual');
  const monthlyBtn = document.getElementById('view-monthly');
  const weeklyBtn = document.getElementById('view-weekly');
  if (annualBtn) {
    const isAnnual = calendarState.view === 'annual';
    annualBtn.setAttribute('aria-pressed', String(isAnnual));
    annualBtn.classList.toggle('active', isAnnual);
  }
  if (monthlyBtn) {
    const isMonthly = calendarState.view === 'monthly';
    monthlyBtn.setAttribute('aria-pressed', String(isMonthly));
    monthlyBtn.classList.toggle('active', isMonthly);
  }
  if (weeklyBtn) {
    const isWeekly = calendarState.view === 'weekly';
    weeklyBtn.setAttribute('aria-pressed', String(isWeekly));
    weeklyBtn.classList.toggle('active', isWeekly);
  }
}

function updateYearDisplay() {
  setText('current-year-display', calendarState.year);
  setText('footer-year', calendarState.year);
}

/* === Main Render === */

function renderCalendar() {
  const container = document.getElementById('calendar-grid');
  if (!container) return;

  container.innerHTML = '';

  if (calendarState.view === 'annual') {
    renderAnnualCalendar(container);
  } else if (calendarState.view === 'monthly') {
    renderMonthlyCalendar(container);
  } else {
    renderWeeklyCalendar(container);
  }
}

/* === Annual View === */

function renderAnnualCalendar(container) {
  container.className = 'calendar-grid';

  for (let month = 1; month <= 12; month++) {
    const monthCard = createMonthCard(calendarState.year, month);
    container.appendChild(monthCard);
  }
}

function createMonthCard(year, month) {
  const season = getSeasonForMonth(month);
  const card = document.createElement('div');
  card.className = 'month-card';
  card.dataset.season = season;
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', `${MONTHS_CA[month - 1]} ${year}`);

  // Header
  const header = document.createElement('div');
  header.className = 'month-header';
  header.innerHTML = `
    <span class="month-title">${MONTHS_CA[month - 1]} ${year}</span>
    <span class="month-season-badge">${SEASON_LABELS[season]}</span>
  `;
  card.appendChild(header);

  // Weekday labels
  const weekdayHeader = document.createElement('div');
  weekdayHeader.className = 'weekday-header';
  weekdayHeader.setAttribute('aria-hidden', 'true');
  WEEKDAYS_CA.forEach(wd => {
    const span = document.createElement('span');
    span.className = 'weekday-name';
    span.textContent = wd;
    weekdayHeader.appendChild(span);
  });
  card.appendChild(weekdayHeader);

  // Days grid
  const daysGrid = document.createElement('div');
  daysGrid.className = 'days-grid';
  daysGrid.setAttribute('role', 'grid');
  daysGrid.setAttribute('aria-label', `Dies de ${MONTHS_CA[month - 1]}`);

  const firstDay = getFirstDayOfMonth(year, month); // Mon=0
  const totalDays = getDaysInMonth(year, month);

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'day-cell empty';
    empty.setAttribute('aria-hidden', 'true');
    daysGrid.appendChild(empty);
  }

  // Day cells
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = buildDateStr(year, month, day);
    const dayCell = createDayCell(dateStr, day, false);
    daysGrid.appendChild(dayCell);
  }

  card.appendChild(daysGrid);
  return card;
}

/* === Monthly View === */

function renderMonthlyCalendar(container) {
  container.className = 'calendar-grid'; // reuse container

  // Monthly navigation
  const navEl = document.createElement('div');
  navEl.className = 'monthly-nav';
  navEl.innerHTML = `
    <button id="prev-month" class="btn btn-icon" aria-label="Mes anterior">&#8249;</button>
    <h2 class="monthly-title">${MONTHS_CA[calendarState.month - 1]} ${calendarState.year}</h2>
    <button id="next-month" class="btn btn-icon" aria-label="Mes següent">&#8250;</button>
  `;
  container.appendChild(navEl);

  document.getElementById('prev-month')?.addEventListener('click', () => {
    if (calendarState.month === 1) {
      calendarState.month = 12;
      calendarState.year--;
      updateYearDisplay();
    } else {
      calendarState.month--;
    }
    storageSet(STORAGE_KEYS.MONTH, calendarState.month);
    renderCalendar();
  });

  document.getElementById('next-month')?.addEventListener('click', () => {
    if (calendarState.month === 12) {
      calendarState.month = 1;
      calendarState.year++;
      updateYearDisplay();
    } else {
      calendarState.month++;
    }
    storageSet(STORAGE_KEYS.MONTH, calendarState.month);
    renderCalendar();
  });

  // Monthly card
  const monthlyCard = document.createElement('div');
  monthlyCard.className = 'monthly-card';

  // Weekday header
  const wdHeader = document.createElement('div');
  wdHeader.className = 'monthly-weekday-header';
  wdHeader.setAttribute('aria-hidden', 'true');
  WEEKDAYS_CA.forEach(wd => {
    const span = document.createElement('span');
    span.className = 'monthly-weekday-name';
    span.textContent = wd;
    wdHeader.appendChild(span);
  });
  monthlyCard.appendChild(wdHeader);

  // Days
  const daysGrid = document.createElement('div');
  daysGrid.className = 'monthly-days-grid';
  daysGrid.setAttribute('role', 'grid');
  daysGrid.setAttribute('aria-label', `Dies de ${MONTHS_CA[calendarState.month - 1]}`);

  const firstDay = getFirstDayOfMonth(calendarState.year, calendarState.month);
  const totalDays = getDaysInMonth(calendarState.year, calendarState.month);

  // Empty padding
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'monthly-day-cell empty';
    empty.setAttribute('aria-hidden', 'true');
    daysGrid.appendChild(empty);
  }

  // Day cells
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = buildDateStr(calendarState.year, calendarState.month, day);
    const dayCell = createMonthlyDayCell(dateStr, day);
    daysGrid.appendChild(dayCell);
  }

  monthlyCard.appendChild(daysGrid);
  container.appendChild(monthlyCard);
}

/* === Weekly View === */

function dateToISO(date) {
  return buildDateStr(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function getMonday(date) {
  const monday = new Date(date);
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  return monday;
}

function getInitialWeekStart() {
  const today = new Date();
  const reference = today.getFullYear() === calendarState.year
    ? today
    : new Date(calendarState.year, 0, 5, 12);
  return dateToISO(getMonday(reference));
}

function shiftWeek(amount) {
  const start = new Date(`${calendarState.weekStart}T12:00:00`);
  start.setDate(start.getDate() + amount * 7);
  calendarState.weekStart = dateToISO(start);

  // Use Thursday to assign weeks spanning two years to the ISO week year.
  const thursday = new Date(start);
  thursday.setDate(thursday.getDate() + 3);
  calendarState.year = thursday.getFullYear();
  storageSet(STORAGE_KEYS.YEAR, calendarState.year);
  updateYearDisplay();
  renderCalendar();
}

function formatWeekRange(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const startLabel = `${start.getDate()} ${MONTHS_CA[start.getMonth()].toLowerCase()}`;
  const endLabel = `${end.getDate()} ${MONTHS_CA[end.getMonth()].toLowerCase()}`;
  return `${startLabel} — ${endLabel}`;
}

function createPlanningLinks(weekStart, compact = false) {
  const links = document.createElement('div');
  links.className = compact ? 'week-planning-links compact' : 'week-planning-links';
  links.innerHTML = `
    <a href="compra.html?week=${weekStart}" aria-label="Llista de la compra d'aquesta setmana"><span aria-hidden="true">🛒</span>${compact ? '' : ' Llista de la compra'}</a>
    <a href="dieta.html?week=${weekStart}" aria-label="Valorar la dieta d'aquesta setmana"><span aria-hidden="true">🥗</span>${compact ? '' : ' Dieta equilibrada'}</a>
  `;
  links.querySelectorAll('a').forEach(link => link.addEventListener('click', event => event.stopPropagation()));
  return links;
}

function createWeeklyMealCard(mealData, mealLabel) {
  const cell = document.createElement('div');
  cell.className = 'weekly-meal-cell';

  if (!mealData?.recipe || !calendarState.recipes[mealData.recipe]) {
    cell.innerHTML = '<span class="weekly-empty">Per planificar</span>';
    return cell;
  }

  const recipe = calendarState.recipes[mealData.recipe];
  const mainLink = document.createElement('a');
  mainLink.className = 'weekly-meal-card';
  mainLink.href = `recepta.html?id=${recipe.id}`;
  mainLink.setAttribute('aria-label', `${mealLabel}: ${recipe.title}`);
  mainLink.innerHTML = `
    <img src="${recipe.image}" alt="" loading="lazy">
    <span class="weekly-meal-copy">
      <small>${mealLabel}</small>
      <strong>${recipe.title}</strong>
    </span>
  `;
  cell.appendChild(mainLink);

  const sideRecipe = mealData.side && calendarState.recipes[mealData.side];
  if (sideRecipe) {
    const sideLink = document.createElement('a');
    sideLink.className = 'weekly-side-link';
    sideLink.href = `recepta.html?id=${sideRecipe.id}`;
    sideLink.innerHTML = `<span aria-hidden="true">＋</span> ${sideRecipe.title}`;
    sideLink.setAttribute('aria-label', `Acompanyament: ${sideRecipe.title}`);
    cell.appendChild(sideLink);
  }

  return cell;
}

function renderWeeklyCalendar(container) {
  container.className = 'weekly-view';
  if (!calendarState.weekStart) calendarState.weekStart = getInitialWeekStart();

  const start = new Date(`${calendarState.weekStart}T12:00:00`);
  const nav = document.createElement('div');
  nav.className = 'weekly-nav';
  nav.innerHTML = `
    <button class="btn btn-icon" id="prev-week" aria-label="Setmana anterior">&#8249;</button>
    <div>
      <p class="weekly-nav-kicker">Menú setmanal</p>
      <h2>${formatWeekRange(start)}</h2>
    </div>
    <button class="btn btn-icon" id="next-week" aria-label="Setmana següent">&#8250;</button>
  `;
  container.appendChild(nav);

  nav.querySelector('#prev-week').addEventListener('click', () => shiftWeek(-1));
  nav.querySelector('#next-week').addEventListener('click', () => shiftWeek(1));
  container.appendChild(createPlanningLinks(calendarState.weekStart));

  const board = document.createElement('section');
  board.className = 'weekly-board';
  board.setAttribute('aria-label', `Menús de la setmana del ${formatWeekRange(start)}`);
  board.innerHTML = `
    <div class="weekly-columns" aria-hidden="true">
      <span>Dia</span><span>Dinar</span><span>Sopar</span>
    </div>
  `;

  for (let index = 0; index < 7; index++) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateStr = dateToISO(date);
    const menuData = calendarState.menus[dateStr];
    const row = document.createElement('article');
    row.className = `weekly-row${isToday(dateStr) ? ' today' : ''}`;

    const dayButton = document.createElement('button');
    dayButton.className = 'weekly-day';
    dayButton.type = 'button';
    dayButton.setAttribute('aria-label', `Obrir menú de ${formatDateLong(dateStr)}`);
    dayButton.innerHTML = `
      <span>${WEEKDAYS_CA[index]}</span>
      <strong>${date.getDate()}</strong>
      <small>${MONTHS_CA[date.getMonth()].slice(0, 3)}</small>
    `;
    dayButton.addEventListener('click', () => openDayModal(dateStr));
    row.appendChild(dayButton);
    row.appendChild(createWeeklyMealCard(menuData?.lunch, 'Dinar'));
    row.appendChild(createWeeklyMealCard(menuData?.dinner, 'Sopar'));
    board.appendChild(row);
  }

  container.appendChild(board);
}

/* === Day Cell Factory === */

function createDayCell(dateStr, dayNum, isMonthly = false) {
  const cell = document.createElement('button');
  cell.className = 'day-cell';
  cell.textContent = dayNum;
  cell.setAttribute('role', 'gridcell');

  const menuData = calendarState.menus[dateStr];
  const today = isToday(dateStr);
  const selected = calendarState.selectedDate === dateStr;
  const weekend = isWeekend(dateStr);

  if (menuData) {
    cell.classList.add('has-menu');
    const lunchRecipeId = menuData.lunch?.recipe;
    const recipe = lunchRecipeId && calendarState.recipes[lunchRecipeId];
    if (recipe && recipe.tags) {
      const tagClass = getTagClass(recipe.tags);
      if (tagClass) cell.classList.add(tagClass);
    }
    const lunchTitle = menuData.lunch?.title || '';
    const dinnerTitle = menuData.dinner?.title || '';
    cell.setAttribute('aria-label', `${formatDateLong(dateStr)}: Dinar — ${lunchTitle}, Sopar — ${dinnerTitle}`);
  } else {
    cell.setAttribute('aria-label', formatDateLong(dateStr));
  }

  if (today) cell.classList.add('today');
  if (selected) cell.classList.add('selected');
  if (weekend) cell.classList.add('weekend');

  // Filter dim
  if (calendarState.filterTag !== 'all' && menuData) {
    const lunchRecipeId = menuData.lunch?.recipe;
    const recipe = lunchRecipeId && calendarState.recipes[lunchRecipeId];
    const hasTag = recipe && recipe.tags && recipe.tags.includes(calendarState.filterTag);
    if (!hasTag) cell.classList.add('filter-no-match');
    else cell.classList.add('filter-match');
  }

  cell.addEventListener('click', () => openDayModal(dateStr));

  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDayModal(dateStr);
    }
  });

  return cell;
}

function createMonthlyDayCell(dateStr, dayNum) {
  const cell = document.createElement('div');
  cell.className = 'monthly-day-cell';
  cell.setAttribute('role', 'gridcell');
  cell.setAttribute('tabindex', '0');

  const menuData = calendarState.menus[dateStr];
  const today = isToday(dateStr);
  const selected = calendarState.selectedDate === dateStr;
  const weekend = isWeekend(dateStr);

  // Day number
  const numDiv = document.createElement('div');
  numDiv.className = 'monthly-day-num';
  numDiv.textContent = dayNum;
  numDiv.setAttribute('aria-hidden', 'true');
  cell.appendChild(numDiv);

  if (menuData) {
    const preview = document.createElement('div');
    preview.className = 'monthly-meal-preview';
    preview.textContent = menuData.lunch?.title || '';
    cell.appendChild(preview);

    const dot = document.createElement('div');
    dot.className = 'monthly-meal-dot';
    dot.setAttribute('aria-hidden', 'true');
    cell.appendChild(dot);

    cell.setAttribute('aria-label', `${formatDateLong(dateStr)}: ${menuData.lunch?.title || ''}`);
  } else {
    cell.setAttribute('aria-label', formatDateLong(dateStr));
  }

  if (today) cell.classList.add('today');
  if (selected) cell.classList.add('selected');
  if (weekend) cell.classList.add('weekend');

  const date = new Date(`${dateStr}T12:00:00`);
  if (date.getDay() === 1 || dayNum === 1) {
    cell.classList.add('week-start');
    cell.appendChild(createPlanningLinks(dateToISO(getMonday(date)), true));
  }

  cell.addEventListener('click', () => openDayModal(dateStr));
  cell.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDayModal(dateStr);
    }
  });

  return cell;
}

/* === Day Modal === */

function openDayModal(dateStr) {
  // Update selected state
  calendarState.selectedDate = dateStr;
  renderCalendar(); // Re-render to show selected

  const modal = document.getElementById('day-modal');
  if (!modal) return;

  const menuData = calendarState.menus[dateStr];

  // Date badge
  setText('modal-date-badge', formatDateShort(dateStr).toUpperCase());

  // Title — day of week + full date
  const [year, month, day] = dateStr.split('-').map(Number);
  setText('modal-title', `${MONTHS_CA[month - 1]} ${day}, ${year}`);

  // Season tags
  const season = getSeasonForMonth(month);
  const seasonTagsEl = document.getElementById('modal-season-tags');
  if (seasonTagsEl) {
    seasonTagsEl.innerHTML = `<span class="tag tag-de-temporada">${SEASON_LABELS[season]}</span>`;
  }

  if (menuData) {
    // Lunch
    populateMealInfo('lunch', menuData.lunch, calendarState.recipes, 'lunch');
    // Dinner
    populateMealInfo('dinner', menuData.dinner, calendarState.recipes, 'dinner');
    // Quick option
    setText('quick-title', menuData.quickOption?.title || 'Sobres del dia anterior');

    // BLW notes
    const lunchRecipe = menuData.lunch?.recipe && calendarState.recipes[menuData.lunch.recipe];
    const blwBanner = document.getElementById('blw-banner');
    const blwNotes = document.getElementById('blw-notes');
    if (lunchRecipe && lunchRecipe.babyNotes) {
      if (blwBanner) blwBanner.hidden = false;
      if (blwNotes) blwNotes.textContent = lunchRecipe.babyNotes;
    } else {
      if (blwBanner) blwBanner.hidden = true;
    }
  } else {
    setText('lunch-title', 'Menú no disponible per a aquest dia.');
    setText('dinner-title', '');
    setText('quick-title', '');
    hideEl('blw-banner');
  }

  // Show modal
  showEl(modal);
  document.body.style.overflow = 'hidden';

  // Focus close button
  const closeBtn = document.getElementById('modal-close');
  if (closeBtn) {
    closeBtn.focus();
    closeBtn.addEventListener('click', closeDayModal, { once: true });
  }

  // Backdrop click
  const backdrop = document.getElementById('modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', closeDayModal, { once: true });
  }

  // Escape key
  function handleEsc(e) {
    if (e.key === 'Escape') {
      closeDayModal();
      document.removeEventListener('keydown', handleEsc);
    }
  }
  document.addEventListener('keydown', handleEsc);

  // Trap focus
  trapFocus(document.getElementById('modal-panel') || modal);
}

function closeDayModal() {
  const modal = document.getElementById('day-modal');
  if (modal) hideEl(modal);
  document.body.style.overflow = '';
}

/* === Search Results === */

function showSearchResults(query) {
  const resultsEl = document.getElementById('search-results');
  const listEl = document.getElementById('search-results-list');
  if (!resultsEl || !listEl) return;

  const results = searchRecipes(calendarState.recipes, query).slice(0, 12);

  listEl.innerHTML = '';

  if (results.length === 0) {
    listEl.innerHTML = '<p style="color:var(--color-text-muted)">Cap recepta trobada.</p>';
  } else {
    results.forEach(recipe => {
      const card = createRecipeCard(recipe);
      listEl.appendChild(card);
    });
  }

  showEl(resultsEl);
}

function hideSearchResults() {
  hideEl('search-results');
}
