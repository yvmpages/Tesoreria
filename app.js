// ==========================================================================
// CONSTANTS & CONFIGURATION
// ==========================================================================

const PREDEFINED_RUBROS = [
  "Esfuerzos Colectivos de Enseñanza",
  "Jóvenes",
  "Visitas Regulares a las Comunidades",
  "Convenciones regionales",
  "Elecciones de Asambleas",
  "Gasto del Transporte del Facilitador",
  "Gastos de Transporte del secretario",
  "Material de Oficina",
  "Reuniones de Evaluación y Planeación",
  "Reuniones de Reflexión",
  "Transporte miembros del comité",
  "Adquisición de Materiales",
  "Materiales de Pre-jóvenes y Niños"
];

const SPECIAL_RUBROS = [
  "Visitas Regulares a las Comunidades",
  "Gasto del Transporte del Facilitador",
  "Gastos de Transporte del secretario"
];

const MONTHS_ORDER = [
  { key: "mayo", label: "Mayo" },
  { key: "junio", label: "Junio" },
  { key: "julio", label: "Julio" },
  { key: "agosto", label: "Agosto" },
  { key: "septiembre", label: "Septiembre" },
  { key: "octubre", label: "Octubre" },
  { key: "noviembre", label: "Noviembre" },
  { key: "diciembre", label: "Diciembre" },
  { key: "enero", label: "Enero" },
  { key: "febrero", label: "Febrero" },
  { key: "marzo", label: "Marzo" },
  { key: "abril", label: "Abril" }
];

// LocalStorage key
const STORAGE_KEY = "tesoreria_app_state";

function getAllRubros() {
  if (!state || !state.rubros) return [];
  return state.rubros.map(r => r.name);
}

function isCaja(rubroName) {
  if (!rubroName) return false;
  if (!state || !state.rubros) return false;
  const r = state.rubros.find(x => x.name.toLowerCase() === rubroName.toLowerCase());
  return r ? !!r.isCaja : false;
}

// ==========================================================================
// APPLICATION STATE
// ==========================================================================

let state = {
  periods: [],
  activePeriodId: null,
  activeMonthKey: "mayo",
  trash: [], // Deleted elements storage
  rubros: [] // Unified rubros list
};

// ==========================================================================
// AUTHENTICATION SYSTEM
// ==========================================================================

function checkAuth() {
  const isLoggedIn = sessionStorage.getItem("tesoreria_logged_in") === "true";
  const loginScreen = document.getElementById("login-screen");
  const appContainer = document.querySelector(".app-container");
  
  if (isLoggedIn) {
    if (loginScreen) loginScreen.classList.add("hidden");
    if (appContainer) appContainer.style.display = "";
  } else {
    if (loginScreen) loginScreen.classList.remove("hidden");
    if (appContainer) appContainer.style.display = "none";
  }
}

function handleLogin(username, password) {
  if (username === "Tesoreria/NC" && password === "Norte*del*Cauca/934_tesoreria") {
    sessionStorage.setItem("tesoreria_logged_in", "true");
    checkAuth();
    return true;
  } else {
    alert("Usuario o contraseña Incorrecta");
    return false;
  }
}

function handleLogout() {
  sessionStorage.removeItem("tesoreria_logged_in");
  checkAuth();
  
  // Reset login fields
  const usernameInput = document.getElementById("login-username");
  const passwordInput = document.getElementById("login-password");
  if (usernameInput) usernameInput.value = "";
  if (passwordInput) passwordInput.value = "";
}

// ==========================================================================
// DATA INITIALIZATION HELPERS
// ==========================================================================

function createEmptyPeriod(startYear) {
  const endYear = startYear + 1;
  const id = `${startYear}-${endYear}`;
  const name = `Mayo ${startYear} - Abril ${endYear}`;
  
  const budgets = {};
  getAllRubros().forEach(rubro => {
    budgets[rubro] = 0;
  });

  const months = {};
  MONTHS_ORDER.forEach((m, index) => {
    const isNextYear = index >= 8;
    const year = isNextYear ? endYear : startYear;
    
    months[m.key] = {
      year: year,
      rubros: {}, 
      tax4x1000: [],
      aportesFondo: []
    };
  });

  return {
    id,
    name,
    startYear,
    budgets,
    months
  };
}

function initializeDefaultState() {
  const currentYear = new Date().getFullYear();
  state.rubros = [
    ...PREDEFINED_RUBROS.map(name => ({
      name: name,
      isCaja: SPECIAL_RUBROS.includes(name)
    }))
  ];
  state.customRubros = [];
  const defaultPeriod = createEmptyPeriod(currentYear);
  state.periods.push(defaultPeriod);
  state.activePeriodId = defaultPeriod.id;
  state.activeMonthKey = "mayo";
  state.trash = [];
  saveState();
}

function migrateState(s) {
  if (!s.rubros || !Array.isArray(s.rubros) || s.rubros.length === 0) {
    s.rubros = [
      ...PREDEFINED_RUBROS.map(name => ({
        name: name,
        isCaja: SPECIAL_RUBROS.includes(name)
      })),
      ...(s.customRubros || []).map(r => {
        if (typeof r === 'string') {
          return { name: r, isCaja: false };
        }
        return r;
      })
    ];
  }
  // Remove duplicates in s.rubros case-insensitively
  const uniqueRubros = [];
  const seen = new Set();
  s.rubros.forEach(r => {
    const key = r.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRubros.push(r);
    }
  });
  s.rubros = uniqueRubros;
  return s;
}

function loadState() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (rawData) {
      state = JSON.parse(rawData);
      
      // Perform migration
      state = migrateState(state);
      
      // Safety checks
      if (!state.periods || !Array.isArray(state.periods) || state.periods.length === 0) {
        initializeDefaultState();
        return;
      }
      
      // Ensure all months in all periods have aportesFondo
      state.periods.forEach(p => {
        if (p.months) {
          MONTHS_ORDER.forEach(m => {
            if (p.months[m.key] && !p.months[m.key].aportesFondo) {
              p.months[m.key].aportesFondo = [];
            }
          });
        }
      });

      if (state.periods.length > 0 && !state.periods.find(p => p.id === state.activePeriodId)) {
        state.activePeriodId = state.periods[0].id;
      }
      if (!state.activeMonthKey) {
        state.activeMonthKey = "mayo";
      }
      if (!state.trash) {
        state.trash = [];
      }
      if (!state.customRubros) {
        state.customRubros = [];
      } else {
        // Migrate legacy string array to object array
        state.customRubros = state.customRubros.map(r => {
          if (typeof r === 'string') {
            return { name: r, isCaja: false };
          }
          return r;
        });
      }
    } else {
      initializeDefaultState();
    }
  } catch (error) {
    console.error("Error cargando el estado:", error);
    initializeDefaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Error guardando el estado:", error);
    alert("Error al guardar datos. Es posible que el almacenamiento esté lleno.");
  }
}

function getActivePeriod() {
  return state.periods.find(p => p.id === state.activePeriodId) || null;
}

// ==========================================================================
// CALCULATIONS AND BUSINESS LOGIC
// ==========================================================================

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2
  }).format(amount);
}

function parseNumeric(val) {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
}

function calculateMonthRubroStats(monthData, rubroName) {
  const rubroMonthData = monthData.rubros[rubroName];
  if (!rubroMonthData) {
    return { budget: 0, spent: 0, income: 0, remaining: 0 };
  }

  const budget = rubroMonthData.monthlyBudget || 0;
  let spent = 0;
  let income = 0;

  rubroMonthData.movements.forEach(m => {
    if (m.type === "envio") {
      spent += m.value;
    } else if (m.type === "ingreso") {
      income += m.value;
    }
  });

  const remaining = budget + income - spent;

  return { budget, spent, income, remaining };
}

function calculateMonthStats(monthData) {
  if (!monthData) {
    return {
      requested: 0,
      spent: 0,
      income: 0,
      taxSpent: 0,
      fundTotal: 0,
      remaining: 0,
      remainingWithFund: 0
    };
  }
  let requested = 0; 
  let spent = 0;     
  let income = 0;    

  Object.keys(monthData.rubros || {}).forEach(rubroName => {
    const stats = calculateMonthRubroStats(monthData, rubroName);
    requested += stats.budget;
    spent += stats.spent;
    income += stats.income;
  });

  let taxSpent = 0;
  (monthData.tax4x1000 || []).forEach(t => {
    taxSpent += t.value;
  });
  spent += taxSpent;

  let fundTotal = 0;
  const aportes = monthData.aportesFondo || [];
  aportes.forEach(a => {
    fundTotal += a.value;
  });

  const remaining = requested + income - spent;
  const remainingWithFund = remaining + fundTotal;

  return {
    requested,
    spent,
    income,
    taxSpent,
    fundTotal,
    remaining,
    remainingWithFund
  };
}

function calculateAnnualRubroStats(period, rubroName) {
  const initialBudget = period.budgets[rubroName] || 0;
  let totalIncome = 0;
  let totalSpentReal = 0; 

  const isSpecial = isCaja(rubroName);

  MONTHS_ORDER.forEach(m => {
    const monthData = period.months[m.key];
    if (monthData && monthData.rubros[rubroName]) {
      const rubroMonthData = monthData.rubros[rubroName];
      rubroMonthData.movements.forEach(move => {
        if (move.type === "ingreso") {
          totalIncome += move.value;
        } else if (move.type === "envio") {
          if (isSpecial) {
            totalSpentReal += (move.realSpent !== undefined && move.realSpent !== null) 
              ? move.realSpent 
              : move.value;
          } else {
            totalSpentReal += move.value;
          }
        }
      });
    }
  });

  const remaining = initialBudget + totalIncome - totalSpentReal;

  return {
    initialBudget,
    totalIncome,
    totalSpentReal,
    remaining
  };
}

function calculateAnnualTaxStats(period) {
  let totalSpent = 0;
  MONTHS_ORDER.forEach(m => {
    const monthData = period.months[m.key];
    if (monthData && monthData.tax4x1000) {
      monthData.tax4x1000.forEach(t => {
        totalSpent += t.value;
      });
    }
  });
  return totalSpent;
}

// ==========================================================================
// CUSTOM CONFIRMATION MODAL SYSTEM
// ==========================================================================

function showConfirmModal(title, message, submessage, onAccept) {
  document.getElementById("confirm-title").innerHTML = title;
  document.getElementById("confirm-message").textContent = message;
  document.getElementById("confirm-submessage").textContent = submessage;
  
  const acceptBtn = document.getElementById("btn-confirm-accept");
  const newAcceptBtn = acceptBtn.cloneNode(true);
  acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);
  
  newAcceptBtn.addEventListener("click", () => {
    onAccept();
    closeModal();
  });
  
  openModal("modal-confirm-action");
}

// ==========================================================================
// UI RENDERERS
// ==========================================================================

function updatePeriodTitle() {
  const period = getActivePeriod();
  const titleEl = document.getElementById("current-period-title");
  const badgeEl = document.getElementById("current-period-badge");
  
  if (period) {
    titleEl.innerHTML = `<i class="fa-solid fa-calendar-week"></i> Registros ${period.name}`;
    badgeEl.textContent = `Período: ${period.id}`;
  } else {
    titleEl.textContent = "No hay períodos creados";
    badgeEl.textContent = "-";
  }
}

function renderPeriodsDropdown() {
  const selector = document.getElementById("period-selector");
  selector.innerHTML = "";
  
  state.periods.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    opt.selected = p.id === state.activePeriodId;
    selector.appendChild(opt);
  });
}

function updateTrashBadge() {
  const badge = document.getElementById("trash-count-badge");
  if (badge) {
    badge.textContent = state.trash.length;
    badge.style.display = state.trash.length > 0 ? "inline-block" : "none";
  }
}

// RENDER TAB 1: SUMMARY
function renderSummaryTab() {
  const period = getActivePeriod();
  if (!period) return;

  const tbody = document.getElementById("rubros-summary-body");
  tbody.innerHTML = "";

  let totalBudget = 0;
  let totalIncome = 0;
  let totalSpent = 0;
  let totalRemaining = 0;

  getAllRubros().forEach(rubro => {
    const stats = calculateAnnualRubroStats(period, rubro);
    
    totalBudget += stats.initialBudget;
    totalIncome += stats.totalIncome;
    totalSpent += stats.totalSpentReal;
    totalRemaining += stats.remaining;

    const tr = document.createElement("tr");
    
    const tdName = document.createElement("td");
    let nameHtml = `<strong>${rubro}</strong>`;
    if (isCaja(rubro)) {
      nameHtml += ` <span class="special-tag" title="Monto entregado completo en el mes, gasto real anual.">Caja</span>`;
    }
    tdName.innerHTML = nameHtml;
    tr.appendChild(tdName);

    const formattedBudget = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(stats.initialBudget || 0);

    const tdBudget = document.createElement("td");
    tdBudget.className = "budget-input-cell text-right";
    tdBudget.innerHTML = `
      <div class="budget-setter">
        <span class="currency-symbol">$</span>
        <input type="text" 
               class="table-budget-input annual-budget-input" 
               data-rubro="${rubro}" 
               value="${formattedBudget}" 
               placeholder="0">
      </div>
    `;
    tr.appendChild(tdBudget);

    const tdSpent = document.createElement("td");
    tdSpent.className = "text-right val-negative";
    tdSpent.textContent = stats.totalSpentReal > 0 ? formatCurrency(stats.totalSpentReal) : "$0.00";
    tr.appendChild(tdSpent);

    const tdRemaining = document.createElement("td");
    tdRemaining.className = `text-right ${stats.remaining >= 0 ? 'val-positive' : 'val-negative'}`;
    tdRemaining.textContent = formatCurrency(stats.remaining);
    tr.appendChild(tdRemaining);

    // Acciones cell
    const tdActions = document.createElement("td");
    tdActions.className = "text-center";
    tdActions.innerHTML = `
      <div class="action-buttons-cell" style="display: flex; justify-content: center; gap: 8px;">
        <button type="button" class="btn-action-icon btn-edit-custom-rubro" data-rubro="${rubro}" title="Editar rubro" style="background: none; border: none; color: var(--primary); cursor: pointer; padding: 4px; font-size: 0.95rem;">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button type="button" class="btn-action-icon btn-delete-custom-rubro" data-rubro="${rubro}" title="Eliminar rubro" style="background: none; border: none; color: var(--danger); cursor: pointer; padding: 4px; font-size: 0.95rem;">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });

  const taxSpent = calculateAnnualTaxStats(period);
  totalSpent += taxSpent;
  totalRemaining -= taxSpent;

  const trTax = document.createElement("tr");
  trTax.innerHTML = `
    <td><strong>Impuesto Bancario 4 x 1000</strong> <span class="badge" style="background: rgba(56,189,248,0.1); color: var(--info); border-color: rgba(56,189,248,0.2)">Banco</span></td>
    <td class="text-right val-neutral">$0.00</td>
    <td class="text-right val-negative">${taxSpent > 0 ? formatCurrency(taxSpent) : "$0.00"}</td>
    <td class="text-right ${-taxSpent >= 0 ? 'val-neutral' : 'val-negative'}">${formatCurrency(-taxSpent)}</td>
    <td></td>
  `;
  tbody.appendChild(trTax);

  document.getElementById("total-annual-budget").textContent = formatCurrency(totalBudget);
  document.getElementById("total-annual-spent").textContent = formatCurrency(totalSpent);
  
  const totalRemEl = document.getElementById("total-annual-remaining");
  totalRemEl.textContent = formatCurrency(totalRemaining);
  totalRemEl.className = `text-right ${totalRemaining >= 0 ? 'val-positive' : 'val-negative'}`;

  renderMonthlyFlowSummary(period);
  renderFundSummaryTable(period);
}

function renderMonthlyFlowSummary(period) {
  const tbody = document.getElementById("monthly-summary-body");
  tbody.innerHTML = "";

  let grandRequested = 0;
  let grandSpent = 0;
  let grandDiff = 0;

  MONTHS_ORDER.forEach(m => {
    const monthData = period.months ? period.months[m.key] : null;
    if (!monthData) return;
    const stats = calculateMonthStats(monthData);

    grandRequested += stats.requested;
    grandSpent += stats.spent;
    
    const monthBalance = stats.requested + stats.income - stats.spent;
    grandDiff += monthBalance;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${m.label} ${monthData.year}</strong></td>
      <td class="text-right">${formatCurrency(stats.requested)}</td>
      <td class="text-right val-negative">${formatCurrency(stats.spent)}</td>
      <td class="text-right ${monthBalance >= 0 ? 'val-positive' : 'val-negative'}">${formatCurrency(monthBalance)}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("total-monthly-requested").textContent = formatCurrency(grandRequested);
  document.getElementById("total-monthly-spent").textContent = formatCurrency(grandSpent);
  
  const grandDiffEl = document.getElementById("total-monthly-difference");
  grandDiffEl.textContent = formatCurrency(grandDiff);
  grandDiffEl.className = `text-right ${grandDiff >= 0 ? 'val-positive' : 'val-negative'}`;
}

function renderFundSummaryTable(period) {
  const tbody = document.getElementById("fund-summary-body");
  tbody.innerHTML = "";

  let grandTotal = 0;

  MONTHS_ORDER.forEach(m => {
    const monthData = period.months ? period.months[m.key] : null;
    if (!monthData) return;
    const aportes = monthData.aportesFondo || [];
    let monthlyTotal = 0;
    aportes.forEach(a => {
      monthlyTotal += a.value;
    });

    grandTotal += monthlyTotal;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${m.label} ${monthData.year}</strong></td>
      <td class="text-right val-positive">${formatCurrency(monthlyTotal)}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("total-annual-funds").textContent = formatCurrency(grandTotal);
}

// RENDER TAB 2: MOVIMIENTOS
function renderMonthDropdown() {
  const selector = document.getElementById("month-dropdown-selector");
  if (!selector) return;
  selector.innerHTML = "";

  const period = getActivePeriod();
  if (!period) return;

  MONTHS_ORDER.forEach(m => {
    const monthData = period.months ? period.months[m.key] : null;
    if (!monthData) return;
    const stats = calculateMonthStats(monthData);

    const opt = document.createElement("option");
    opt.value = m.key;
    opt.textContent = `${m.label} ${monthData.year} (Gasto: ${formatCurrency(stats.spent).split(',')[0]})`;
    opt.selected = m.key === state.activeMonthKey;
    selector.appendChild(opt);
  });
}

function renderMovementsTab() {
  const period = getActivePeriod();
  if (!period) return;

  renderMonthDropdown();

  const monthKey = state.activeMonthKey;
  const monthData = period.months[monthKey];
  const label = MONTHS_ORDER.find(m => m.key === monthKey).label;

  document.getElementById("active-month-title").textContent = `Mes de ${label}`;
  document.getElementById("active-month-year").textContent = monthData.year;

  const stats = calculateMonthStats(monthData);

  document.getElementById("month-metric-requested").textContent = formatCurrency(stats.requested);
  document.getElementById("month-metric-spent").textContent = formatCurrency(stats.spent);
  
  const remEl = document.getElementById("month-metric-remaining");
  remEl.textContent = formatCurrency(stats.remaining);
  remEl.className = `metric-value-sm ${stats.remaining >= 0 ? 'val-positive' : 'val-negative'}`;

  const remWithFundEl = document.getElementById("month-metric-remaining-with-fund");
  remWithFundEl.textContent = formatCurrency(stats.remainingWithFund);
  remWithFundEl.className = `metric-value-sm ${stats.remainingWithFund >= 0 ? 'val-positive' : 'val-negative'}`;

  renderMonthRubrosList(monthData);
  renderMonthTaxList(monthData);
  renderMonthFundList(monthData);
}

function renderMonthRubrosList(monthData) {
  const container = document.getElementById("month-rubros-container");
  container.innerHTML = "";

  const activeRubroNames = Object.keys(monthData.rubros);

  if (activeRubroNames.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-folder-open empty-icon"></i>
        <p>No hay rubros agregados a este mes.</p>
        <p class="small text-muted">Haz clic en "Agregar Rubro al Mes" para comenzar.</p>
      </div>
    `;
    return;
  }

  activeRubroNames.forEach(rubroName => {
    const rubroData = monthData.rubros[rubroName];
    const rubroStats = calculateMonthRubroStats(monthData, rubroName);
    const isSpecial = isCaja(rubroName);

    const card = document.createElement("div");
    card.className = "month-rubro-card";

    // Card Header
    const cardHeader = document.createElement("div");
    cardHeader.className = "rubro-card-header";
    
    const titleContainer = document.createElement("div");
    titleContainer.className = "rubro-card-title";
    titleContainer.innerHTML = `<h5>${rubroName}</h5>`;
    if (isSpecial) {
      titleContainer.innerHTML += ` <span class="special-tag" title="Monto entregado completo en el mes, gasto real anual.">Caja</span>`;
    }
    cardHeader.appendChild(titleContainer);

    // Edit/Delete Actions in header
    const actionsContainer = document.createElement("div");
    actionsContainer.className = "rubro-card-actions";
    
    const btnAddMov = document.createElement("button");
    btnAddMov.className = "btn btn-primary btn-sm btn-add-movement-trigger";
    btnAddMov.setAttribute("data-rubro", rubroName);
    btnAddMov.innerHTML = `<i class="fa-solid fa-plus"></i> Movimiento`;
    actionsContainer.appendChild(btnAddMov);

    const btnEditRubro = document.createElement("button");
    btnEditRubro.className = "btn-edit-item btn-edit-rubro-trigger";
    btnEditRubro.setAttribute("data-rubro", rubroName);
    btnEditRubro.setAttribute("title", "Editar categoría de rubro");
    btnEditRubro.innerHTML = `<i class="fa-solid fa-pen"></i>`;
    actionsContainer.appendChild(btnEditRubro);

    const btnRemoveRubro = document.createElement("button");
    btnRemoveRubro.className = "btn-delete-item btn-remove-rubro-trigger";
    btnRemoveRubro.setAttribute("data-rubro", rubroName);
    btnRemoveRubro.setAttribute("title", "Quitar rubro de este mes");
    btnRemoveRubro.innerHTML = `<i class="fa-solid fa-trash-can"></i>`;
    actionsContainer.appendChild(btnRemoveRubro);

    cardHeader.appendChild(actionsContainer);
    card.appendChild(cardHeader);

    // Budget Settings Row
    const budgetSettings = document.createElement("div");
    budgetSettings.className = "rubro-budget-settings";
    const formattedMonthlyBudget = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(rubroData.monthlyBudget || 0);
    budgetSettings.innerHTML = `
      <div class="budget-setter">
        <label for="budget-input-${rubroName.replace(/\s+/g, '-')}">Asignado:</label>
        <span class="currency-symbol">$</span>
        <input type="text" 
               id="budget-input-${rubroName.replace(/\s+/g, '-')}"
               class="budget-month-input" 
               data-rubro="${rubroName}" 
               value="${formattedMonthlyBudget}">
      </div>
      <div class="rubro-card-stats">
        <div class="rubro-stat-item">
          <span class="stat-label">Gastado:</span>
          <span class="val-negative font-weight-500">${formatCurrency(rubroStats.spent)}</span>
        </div>
        <div class="rubro-stat-item">
          <span class="stat-label">Sobrante:</span>
          <span class="${rubroStats.remaining >= 0 ? 'val-positive' : 'val-negative'} font-weight-500">${formatCurrency(rubroStats.remaining)}</span>
        </div>
      </div>
    `;
    card.appendChild(budgetSettings);

    // Movements Table
    const movementsTable = document.createElement("div");
    movementsTable.className = "table-responsive";

    if (rubroData.movements.length === 0) {
      movementsTable.innerHTML = `<p class="small text-muted text-center" style="padding: 10px 0;">No hay movimientos registrados.</p>`;
    } else {
      let tableHtml = `
        <table class="movements-mini-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Detalle</th>
              <th class="text-right">Valor</th>
              ${isSpecial ? `<th class="text-right">Gasto Real</th>` : ''}
              <th class="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
      `;

      rubroData.movements.forEach(m => {
        const realSpentVal = (m.realSpent !== undefined && m.realSpent !== null) ? m.realSpent : m.value;

        tableHtml += `
          <tr class="movement-row" data-rubro="${rubroName}" data-mov-id="${m.id}">
            <td>${m.date}</td>
            <td title="${m.reason}">${m.reason.length > 25 ? m.reason.substring(0, 22) + '...' : m.reason}</td>
            <td class="text-right font-weight-500">${formatCurrency(m.value)}</td>
            ${isSpecial ? `<td class="text-right font-weight-500 val-neutral">${m.type === 'envio' ? formatCurrency(realSpentVal) : '-'}</td>` : ''}
            <td class="text-center">
              <div class="action-buttons-cell" style="display: flex; justify-content: center; gap: 4px;">
                <button class="btn-notes-item btn-notes-movement-trigger" 
                        data-rubro="${rubroName}" 
                        data-mov-id="${m.id}" 
                        title="Notas del movimiento">
                  <i class="fa-solid fa-comment-dots"></i>
                </button>
                <button class="btn-edit-item btn-edit-movement-trigger" 
                        data-rubro="${rubroName}" 
                        data-mov-id="${m.id}" 
                        title="Editar movimiento">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="btn-delete-item btn-delete-movement-trigger" 
                        data-rubro="${rubroName}" 
                        data-mov-id="${m.id}" 
                        title="Eliminar movimiento">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      });

      tableHtml += `
          </tbody>
        </table>
      `;
      movementsTable.innerHTML = tableHtml;
    }

    card.appendChild(movementsTable);
    container.appendChild(card);
  });
}

function renderMonthTaxList(monthData) {
  const tbody = document.getElementById("month-tax-body");
  tbody.innerHTML = "";

  let total = 0;
  monthData.tax4x1000.forEach(t => {
    total += t.value;
  });

  document.getElementById("month-tax-total").textContent = formatCurrency(total);

  if (monthData.tax4x1000.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted small" style="padding: 12px;">No hay cobros registrados.</td>
      </tr>
    `;
    return;
  }

  monthData.tax4x1000.forEach(t => {
    const tr = document.createElement("tr");
    tr.className = "movement-row";
    tr.setAttribute("data-rubro", "4x1000");
    tr.setAttribute("data-mov-id", t.id);
    tr.innerHTML = `
      <td>${t.date}</td>
      <td title="${t.reason}">${t.reason.length > 15 ? t.reason.substring(0, 12) + '...' : t.reason}</td>
      <td class="text-right val-negative font-weight-500">${formatCurrency(t.value)}</td>
      <td class="text-center">
        <div class="action-buttons-cell" style="display: flex; justify-content: center; gap: 4px;">
          <button class="btn-notes-item btn-notes-movement-trigger" data-rubro="4x1000" data-mov-id="${t.id}" title="Notas del cobro">
            <i class="fa-solid fa-comment-dots"></i>
          </button>
          <button class="btn-edit-item btn-edit-tax-trigger" data-tax-id="${t.id}" title="Editar cobro">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-delete-item btn-delete-tax-trigger" data-tax-id="${t.id}" title="Eliminar cobro">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMonthFundList(monthData) {
  const tbody = document.getElementById("month-fund-body");
  tbody.innerHTML = "";

  const aportes = monthData.aportesFondo || [];
  let total = 0;
  aportes.forEach(a => {
    total += a.value;
  });

  document.getElementById("month-fund-total").textContent = formatCurrency(total);

  if (aportes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted small" style="padding: 12px;">No hay aportes registrados.</td>
      </tr>
    `;
    return;
  }

  aportes.forEach(a => {
    const tr = document.createElement("tr");
    tr.className = "movement-row";
    tr.setAttribute("data-rubro", "aporteFondo");
    tr.setAttribute("data-mov-id", a.id);
    tr.innerHTML = `
      <td>${a.date}</td>
      <td title="${a.reason}">${a.reason.length > 15 ? a.reason.substring(0, 12) + '...' : a.reason}</td>
      <td class="text-right val-positive font-weight-500">${formatCurrency(a.value)}</td>
      <td class="text-center">
        <div class="action-buttons-cell" style="display: flex; justify-content: center; gap: 4px;">
          <button class="btn-notes-item btn-notes-movement-trigger" data-rubro="aporteFondo" data-mov-id="${a.id}" title="Notas del aporte">
            <i class="fa-solid fa-comment-dots"></i>
          </button>
          <button class="btn-edit-item btn-edit-fund-trigger" data-fund-id="${a.id}" title="Editar aporte">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-delete-item btn-delete-fund-trigger" data-fund-id="${a.id}" title="Eliminar aporte">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// RENDER TAB 3: PAPELERA (RECYCLE BIN)
function renderTrashTab() {
  updateTrashBadge();

  const emptyState = document.getElementById("trash-empty-state");
  const trashList = document.getElementById("trash-items-list");
  const emptyBtn = document.getElementById("btn-empty-trash");

  trashList.innerHTML = "";

  if (state.trash.length === 0) {
    emptyState.style.display = "flex";
    emptyBtn.style.display = "none";
    return;
  }

  emptyState.style.display = "none";
  emptyBtn.style.display = "inline-flex";

  // Render items newest first
  const reversedTrash = [...state.trash].reverse();

  reversedTrash.forEach(item => {
    const card = document.createElement("div");
    card.className = "trash-item-card";
    
    let iconClass = "type-period fa-calendar-days";
    let typeLabel = "Período Anual";
    let detailsLabel = "";

    if (item.type === "rubro") {
      iconClass = "type-movements-trash fa-money-bill-transfer";
      typeLabel = "Rubro Mensual";
      const monthLabel = MONTHS_ORDER.find(m => m.key === item.originalMonthKey)?.label || item.originalMonthKey;
      detailsLabel = `Rubro "${item.originalRubroName}" en el mes de ${monthLabel} (Monto: ${formatCurrency(item.data.monthlyBudget)})`;
    } else if (item.type === "customRubro") {
      iconClass = "type-summary-trash fa-chart-pie";
      typeLabel = "Rubro Personalizado";
      detailsLabel = `Definición del rubro "${item.data.name}" (Caja: ${item.data.isCaja ? 'Sí' : 'No'})`;
    } else if (item.type === "movement") {
      iconClass = "type-movement fa-money-bill-transfer";
      typeLabel = "Movimiento";
      const monthLabel = MONTHS_ORDER.find(m => m.key === item.originalMonthKey)?.label || item.originalMonthKey;
      const moveType = item.data.type === "envio" ? "Envío" : "Ingreso";
      detailsLabel = `${moveType} de ${formatCurrency(item.data.value)} en rubro "${item.originalRubroName}" (${monthLabel}) - Detalle: "${item.data.reason}"`;
    } else if (item.type === "tax") {
      iconClass = "type-tax fa-building-columns";
      typeLabel = "Impuesto 4x1000";
      const monthLabel = MONTHS_ORDER.find(m => m.key === item.originalMonthKey)?.label || item.originalMonthKey;
      detailsLabel = `Cobro bancario de ${formatCurrency(item.data.value)} en el mes de ${monthLabel} - Detalle: "${item.data.reason}"`;
    } else if (item.type === "aporteFondo") {
      iconClass = "type-movement fa-piggy-bank";
      typeLabel = "Aporte al Fondo";
      const monthLabel = MONTHS_ORDER.find(m => m.key === item.originalMonthKey)?.label || item.originalMonthKey;
      detailsLabel = `Aporte al fondo de ${formatCurrency(item.data.value)} en el mes de ${monthLabel} - Detalle: "${item.data.reason}"`;
    } else if (item.type === "note") {
      iconClass = "type-note fa-sticky-note";
      typeLabel = "Nota";
      const monthLabel = MONTHS_ORDER.find(m => m.key === item.originalMonthKey)?.label || item.originalMonthKey;
      let targetLabel = item.originalRubroName;
      if (item.originalRubroName === "4x1000") targetLabel = "Cobro Bancario";
      else if (item.originalRubroName === "aporteFondo") targetLabel = "Aporte al Fondo";
      else targetLabel = `Rubro "${item.originalRubroName}"`;
      detailsLabel = `Nota del ${item.data.date}: "${item.data.content}" en ${targetLabel} (${monthLabel})`;
    } else { // period
      detailsLabel = `Período completo "${item.data.name}" (${item.data.id})`;
    }

    const deleteDate = new Date(item.deletedAt).toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    card.innerHTML = `
      <div class="trash-item-details">
        <div class="trash-item-icon-box ${iconClass.split(' ')[0]}">
          <i class="fa-solid ${iconClass.split(' ')[1]}"></i>
        </div>
        <div class="trash-item-info">
          <span class="badge" style="align-self: flex-start; margin-bottom: 2px; font-size: 0.7rem;">${typeLabel}</span>
          <span class="trash-item-title">${detailsLabel}</span>
          <div class="trash-item-meta">
            <span class="trash-meta-item"><i class="fa-solid fa-clock"></i> Eliminado: ${deleteDate}</span>
            <span class="trash-meta-item"><i class="fa-solid fa-link"></i> Período Orig: ${item.originalPeriodId}</span>
          </div>
        </div>
      </div>
      <div class="trash-item-actions">
        <button class="btn btn-success btn-sm btn-restore-trash" data-trash-id="${item.id}" title="Restaurar elemento">
          <i class="fa-solid fa-trash-arrow-up"></i> Restaurar
        </button>
        <button class="btn btn-danger-outline btn-sm btn-delete-perm-trash" data-trash-id="${item.id}" title="Eliminar definitivamente">
          <i class="fa-solid fa-trash"></i> Borrar
        </button>
      </div>
    `;
    trashList.appendChild(card);
  });
}

// ==========================================================================
// RESTORE AND PERMANENT DELETE LOGIC
// ==========================================================================

function restoreTrashItem(itemId) {
  const itemIndex = state.trash.findIndex(t => t.id === itemId);
  if (itemIndex === -1) return;

  const item = state.trash[itemIndex];

  if (item.type === "period") {
    // Check if period ID already exists
    if (state.periods.find(p => p.id === item.data.id)) {
      alert(`No se puede restaurar. Ya existe un período activo con el ID "${item.data.id}".`);
      return;
    }
    state.periods.push(item.data);
    state.periods.sort((a, b) => b.startYear - a.startYear);
    state.activePeriodId = item.data.id;
  } 
  else if (item.type === "customRubro") {
    // Re-insert rubro definition
    if (!state.rubros) state.rubros = [];
    const alreadyExists = state.rubros.some(r => 
      r.name.toLowerCase() === item.data.name.toLowerCase()
    );
    if (!alreadyExists) {
      state.rubros.push({ name: item.data.name, isCaja: item.data.isCaja });
    }
    
    // Restore budgets in all periods
    state.periods.forEach(p => {
      if (p.budgets && item.data.budgets && item.data.budgets[p.id] !== undefined) {
        p.budgets[item.data.name] = item.data.budgets[p.id];
      }
    });
    
    // Restore monthly occurrences in all periods
    state.periods.forEach(p => {
      if (p.months && item.data.monthlyOccurrences && item.data.monthlyOccurrences[p.id]) {
        const periodOccurrences = item.data.monthlyOccurrences[p.id];
        Object.keys(periodOccurrences).forEach(monthKey => {
          if (p.months[monthKey]) {
            p.months[monthKey].rubros[item.data.name] = periodOccurrences[monthKey];
          }
        });
      }
    });
    
    // Remove from trash list
    state.trash.splice(itemIndex, 1);
    saveState();
    refreshUI();
    return;
  }
  else {
    // Check if original period exists
    const period = state.periods.find(p => p.id === item.originalPeriodId);
    if (!period) {
      alert(`No se puede restaurar. El período original "${item.originalPeriodId}" de este elemento fue eliminado. Debe restaurar el período primero.`);
      return;
    }

    const monthData = period.months[item.originalMonthKey];

    if (item.type === "rubro") {
      // Re-insert monthly rubro (or merge if category already active)
      if (monthData.rubros[item.originalRubroName]) {
        // Merge movements and budgets
        monthData.rubros[item.originalRubroName].monthlyBudget += item.data.monthlyBudget;
        monthData.rubros[item.originalRubroName].movements.push(...item.data.movements);
        monthData.rubros[item.originalRubroName].movements.sort((a,b) => new Date(a.date) - new Date(b.date));
      } else {
        monthData.rubros[item.originalRubroName] = item.data;
      }
    } 
    else if (item.type === "movement") {
      // Re-insert movement. Recreate monthly rubro if deleted
      if (!monthData.rubros[item.originalRubroName]) {
        monthData.rubros[item.originalRubroName] = {
          monthlyBudget: 0,
          movements: []
        };
      }
      monthData.rubros[item.originalRubroName].movements.push(item.data);
      monthData.rubros[item.originalRubroName].movements.sort((a,b) => new Date(a.date) - new Date(b.date));
    } 
    else if (item.type === "tax") {
      // Re-insert tax 4x1000
      monthData.tax4x1000.push(item.data);
      monthData.tax4x1000.sort((a,b) => new Date(a.date) - new Date(b.date));
    }
    else if (item.type === "aporteFondo") {
      // Re-insert Aporte al Fondo
      monthData.aportesFondo = monthData.aportesFondo || [];
      monthData.aportesFondo.push(item.data);
      monthData.aportesFondo.sort((a,b) => new Date(a.date) - new Date(b.date));
    }
    else if (item.type === "note") {
      // Re-insert Note
      let movement;
      if (item.originalRubroName === "4x1000") {
        movement = monthData.tax4x1000.find(t => t.id === item.originalMovementId);
      } else if (item.originalRubroName === "aporteFondo") {
        movement = monthData.aportesFondo.find(a => a.id === item.originalMovementId);
      } else {
        movement = monthData.rubros[item.originalRubroName]?.movements.find(m => m.id === item.originalMovementId);
      }
      
      if (movement) {
        movement.notes = movement.notes || [];
        movement.notes.push(item.data);
        movement.notes.sort((a,b) => new Date(a.date) - new Date(b.date));
      } else {
        alert("No se pudo restaurar la nota porque el movimiento o registro original ya no existe.");
        return;
      }
    }
  }

  // Remove from trash list
  state.trash.splice(itemIndex, 1);
  saveState();
  refreshUI();
}

function deleteTrashItemPermanently(itemId) {
  const itemIndex = state.trash.findIndex(t => t.id === itemId);
  if (itemIndex === -1) return;

  const item = state.trash[itemIndex];
  
  showConfirmModal(
    `<i class="fa-solid fa-triangle-exclamation text-danger"></i> Borrado Permanente`,
    `¿Desea eliminar definitivamente este elemento?`,
    `Esta acción es irreversible y los datos no se podrán recuperar.`,
    () => {
      state.trash.splice(itemIndex, 1);
      saveState();
      renderTrashTab();
    }
  );
}

function emptyTrash() {
  showConfirmModal(
    `<i class="fa-solid fa-dumpster-fire text-danger"></i> Vaciar Papelera`,
    `¿Está seguro de vaciar toda la papelera de reciclaje?`,
    `Se borrarán permanentemente los ${state.trash.length} elementos de la papelera. Esta acción no se puede deshacer.`,
    () => {
      state.trash = [];
      saveState();
      renderTrashTab();
    }
  );
}

// ==========================================================================
// ACTIONS AND DELETION WITH TRASH ROUTING
// ==========================================================================

function handleCreatePeriod(startYearVal) {
  const startYear = parseInt(startYearVal);
  if (isNaN(startYear) || startYear < 2000 || startYear > 2100) {
    alert("Ingrese un año válido.");
    return false;
  }

  const periodId = `${startYear}-${startYear + 1}`;
  if (state.periods.find(p => p.id === periodId)) {
    alert("Este período de registro ya existe.");
    return false;
  }

  const newPeriod = createEmptyPeriod(startYear);
  state.periods.push(newPeriod);
  state.periods.sort((a, b) => b.startYear - a.startYear);
  state.activePeriodId = periodId;
  saveState();
  return true;
}

// Delete Period (routed to trash)
function handleDeletePeriod(periodId) {
  showConfirmModal(
    `<i class="fa-solid fa-triangle-exclamation text-danger"></i> Eliminar Período`,
    `¿Está seguro de enviar a la papelera el período completo "${periodId}"?`,
    `Se guardarán todos sus movimientos y presupuestos en la papelera para poder recuperarlos después.`,
    () => {
      const idx = state.periods.findIndex(p => p.id === periodId);
      if (idx === -1) return;
      
      const periodData = state.periods[idx];
      state.periods.splice(idx, 1);

      // Route to trash
      state.trash.push({
        id: "trash-" + Date.now() + "-" + Math.floor(Math.random()*1000),
        type: "period",
        deletedAt: new Date().toISOString(),
        originalPeriodId: periodId,
        data: periodData
      });

      if (state.periods.length > 0) {
        state.activePeriodId = state.periods[0].id;
      } else {
        initializeDefaultState(); // Keep at least one period
      }

      saveState();
      refreshUI();
    }
  );
}

function handleAddRubroToMonth(rubroName, initialBudget) {
  const period = getActivePeriod();
  if (!period) return false;

  const monthKey = state.activeMonthKey;
  const monthData = period.months[monthKey];

  if (monthData.rubros[rubroName]) {
    alert("Este rubro ya está activo en este mes.");
    return false;
  }

  monthData.rubros[rubroName] = {
    monthlyBudget: initialBudget,
    movements: []
  };

  saveState();
  return true;
}

// Edit Category / Rubro on the Month Card
function handleEditRubroMonthName(oldName, newName) {
  const period = getActivePeriod();
  if (!period) return false;
  const monthKey = state.activeMonthKey;
  const monthData = period.months[monthKey];

  if (!monthData.rubros[oldName]) return false;
  if (oldName === newName) return true;

  if (monthData.rubros[newName]) {
    alert(`El rubro "${newName}" ya está activo en este mes. No se puede transferir.`);
    return false;
  }

  // Copy data under new key and delete old key
  monthData.rubros[newName] = monthData.rubros[oldName];
  delete monthData.rubros[oldName];

  saveState();
  return true;
}

// Delete Rubro from Month (routed to trash)
function handleRemoveRubroFromMonth(rubroName) {
  const period = getActivePeriod();
  if (!period) return;

  const monthKey = state.activeMonthKey;
  const monthData = period.months[monthKey];
  const rubroData = monthData.rubros[rubroName];

  const monthLabel = MONTHS_ORDER.find(m => m.key === monthKey).label;
  const movCount = rubroData.movements.length;

  showConfirmModal(
    `<i class="fa-solid fa-triangle-exclamation text-warning"></i> Quitar Rubro del Mes`,
    `¿Desea enviar a la papelera el rubro "${rubroName}" de ${monthLabel}?`,
    movCount > 0 
      ? `Se guardarán también los ${movCount} movimientos de este rubro en la papelera para poder recuperarlos.` 
      : `El rubro se guardará en la papelera de reciclaje.`,
    () => {
      delete monthData.rubros[rubroName];

      state.trash.push({
        id: "trash-" + Date.now() + "-" + Math.floor(Math.random()*1000),
        type: "rubro",
        deletedAt: new Date().toISOString(),
        originalPeriodId: period.id,
        originalMonthKey: monthKey,
        originalRubroName: rubroName,
        data: rubroData
      });

      saveState();
      renderMovementsTab();
      updateTrashBadge();
    }
  );
}

// Add or edit movement inside month-rubro
function handleSaveMovement(rubroName, date, type, value, reason, realSpentVal, movId) {
  const period = getActivePeriod();
  if (!period) return false;

  const monthKey = state.activeMonthKey;
  const monthData = period.months[monthKey];
  const rubroMonthData = monthData.rubros[rubroName];

  if (!rubroMonthData) {
    alert("El rubro no está activo en este mes.");
    return false;
  }

  const isSpecial = isCaja(rubroName);
  let finalRealSpent = undefined;
  
  if (isSpecial && type === "envio") {
    finalRealSpent = (realSpentVal === "" || realSpentVal === null || realSpentVal === undefined) 
      ? value 
      : realSpentVal;
  }

  if (movId) {
    // EDIT MODE
    const movIndex = rubroMonthData.movements.findIndex(m => m.id === movId);
    if (movIndex === -1) return false;

    const existingMov = rubroMonthData.movements[movIndex];
    existingMov.date = date;
    existingMov.type = type;
    existingMov.value = value;
    existingMov.reason = reason;

    if (finalRealSpent !== undefined) {
      existingMov.realSpent = finalRealSpent;
    } else {
      delete existingMov.realSpent;
    }
  } else {
    // ADD MODE
    const newId = "mov-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    const movement = {
      id: newId,
      date,
      type,
      value,
      reason
    };

    if (finalRealSpent !== undefined) {
      movement.realSpent = finalRealSpent;
    }

    rubroMonthData.movements.push(movement);
  }

  rubroMonthData.movements.sort((a, b) => new Date(a.date) - new Date(b.date));
  saveState();
  return true;
}

// Delete Movement (routed to trash)
function handleDeleteMovement(rubroName, movId) {
  const period = getActivePeriod();
  if (!period) return;

  const monthKey = state.activeMonthKey;
  const monthData = period.months[monthKey];
  const rubroMonthData = monthData.rubros[rubroName];
  if (!rubroMonthData) return;

  const idx = rubroMonthData.movements.findIndex(m => m.id === movId);
  if (idx === -1) return;

  const movData = rubroMonthData.movements[idx];

  showConfirmModal(
    `<i class="fa-solid fa-trash-can text-danger"></i> Eliminar Movimiento`,
    `¿Desea enviar a la papelera el movimiento "${movData.reason}" por ${formatCurrency(movData.value)}?`,
    `Podrás recuperar este movimiento en cualquier momento desde la pestaña Papelera.`,
    () => {
      rubroMonthData.movements.splice(idx, 1);

      // Route to trash
      state.trash.push({
        id: "trash-" + Date.now() + "-" + Math.floor(Math.random()*1000),
        type: "movement",
        deletedAt: new Date().toISOString(),
        originalPeriodId: period.id,
        originalMonthKey: monthKey,
        originalRubroName: rubroName,
        data: movData
      });

      saveState();
      renderMovementsTab();
      updateTrashBadge();
    }
  );
}

// ==========================================================================
// MOVEMENT NOTES MANAGEMENT LÓGICA
// ==========================================================================

function handleOpenMovementNotes(rubroName, movId, readOnly = false) {
  const period = getActivePeriod();
  if (!period) return;

  const monthKey = state.activeMonthKey;
  const monthData = period.months[monthKey];
  
  let movement;
  let displayName = rubroName;
  let displayType = "";
  
  if (rubroName === "4x1000") {
    movement = monthData.tax4x1000.find(t => t.id === movId);
    displayName = "Impuesto Bancario 4 x 1000";
    displayType = "Gasto Bancario";
  } else if (rubroName === "aporteFondo") {
    movement = monthData.aportesFondo.find(a => a.id === movId);
    displayName = "Aporte al Fondo";
    displayType = "Aporte (Entrada)";
  } else {
    const rubroMonthData = monthData.rubros[rubroName];
    if (rubroMonthData) {
      movement = rubroMonthData.movements.find(m => m.id === movId);
      displayType = movement ? (movement.type === "envio" ? "Envío" : "Ingreso") : "";
    }
  }

  if (!movement) return;

  // Render Movement Info in Modal
  document.getElementById("note-detail-rubro").textContent = displayName;
  document.getElementById("note-detail-date").textContent = movement.date;
  document.getElementById("note-detail-type").textContent = displayType;
  
  const isEnvio = rubroName === "4x1000" || (movement && movement.type === "envio");
  document.getElementById("note-detail-value").textContent = formatCurrency(movement.value);
  document.getElementById("note-detail-value").className = isEnvio ? "val-negative" : "val-positive";
  
  const realSpentWrapper = document.getElementById("note-detail-real-spent-wrapper");
  const isSpecial = isCaja(rubroName);
  if (isSpecial && movement.type === "envio") {
    realSpentWrapper.style.display = "block";
    const realSpentVal = (movement.realSpent !== undefined && movement.realSpent !== null) ? movement.realSpent : movement.value;
    document.getElementById("note-detail-real-spent").textContent = formatCurrency(realSpentVal);
  } else {
    realSpentWrapper.style.display = "none";
  }
  
  document.getElementById("note-detail-reason").textContent = movement.reason;

  // Set hidden inputs
  document.getElementById("note-rubro-id").value = rubroName;
  document.getElementById("note-mov-id").value = movId;
  document.getElementById("note-id").value = ""; // Clear edit note ID
  
  // Set note form title and button text back to default
  document.getElementById("note-form-title").textContent = "Nueva Nota";
  const submitBtn = document.querySelector("#form-add-note button[type='submit']");
  if (submitBtn) {
    submitBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Agregar Nota`;
  }

  // Set default note date to today
  const today = new Date();
  const dayStr = today.getDate() < 10 ? '0' + today.getDate() : today.getDate();
  const monthStr = (today.getMonth() + 1) < 10 ? '0' + (today.getMonth() + 1) : (today.getMonth() + 1);
  document.getElementById("note-date").value = `${today.getFullYear()}-${monthStr}-${dayStr}`;
  document.getElementById("note-content").value = "";

  // Show or hide the form and details panel based on readOnly
  const noteForm = document.getElementById("form-add-note");
  const detailsPanel = document.querySelector(".movement-details-panel");
  const modalHeaderTitle = document.querySelector("#modal-movement-notes .modal-header h3");

  if (readOnly) {
    noteForm.style.display = "none";
    if (detailsPanel) detailsPanel.style.display = "flex";
    if (modalHeaderTitle) modalHeaderTitle.textContent = "Detalles del Registro";
  } else {
    noteForm.style.display = "block";
    if (detailsPanel) detailsPanel.style.display = "none";
    if (modalHeaderTitle) modalHeaderTitle.textContent = "Notas del Registro";
  }

  // Render Notes List
  renderMovementNotesList(movement, rubroName, readOnly);

  openModal("modal-movement-notes");
}

function renderMovementNotesList(movement, rubroName, readOnly) {
  const container = document.getElementById("movement-notes-list");
  container.innerHTML = "";

  const notes = movement.notes || [];

  if (notes.length === 0) {
    container.innerHTML = `<p class="small text-muted text-center" style="padding: 10px 0;">No hay notas registradas para este movimiento.</p>`;
    return;
  }

  notes.forEach(note => {
    const item = document.createElement("div");
    item.className = "movement-note-item";
    item.innerHTML = `
      <div class="movement-note-header">
        <span class="movement-note-date"><i class="fa-solid fa-calendar-day"></i> ${note.date}</span>
        ${!readOnly ? `
        <div style="display: flex; gap: 4px;">
          <button class="btn-edit-note" data-note-id="${note.id}" data-rubro="${rubroName}" data-mov-id="${movement.id}" title="Editar nota" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 2px;">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-delete-note" data-note-id="${note.id}" data-rubro="${rubroName}" data-mov-id="${movement.id}" title="Eliminar nota" style="background: transparent; border: none; color: var(--danger); cursor: pointer; padding: 2px;">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
        ` : ''}
      </div>
      <p class="movement-note-content">${note.content}</p>
    `;
    container.appendChild(item);
  });
}

function handleSaveMovementNote(rubroName, movId, date, content, noteId) {
  const period = getActivePeriod();
  if (!period) return false;

  const monthKey = state.activeMonthKey;
  const monthData = period.months[monthKey];
  
  let movement;
  if (rubroName === "4x1000") {
    movement = monthData.tax4x1000.find(t => t.id === movId);
  } else if (rubroName === "aporteFondo") {
    movement = monthData.aportesFondo.find(a => a.id === movId);
  } else {
    const rubroMonthData = monthData.rubros[rubroName];
    if (rubroMonthData) {
      movement = rubroMonthData.movements.find(m => m.id === movId);
    }
  }

  if (!movement) return false;

  if (!movement.notes) {
    movement.notes = [];
  }

  if (noteId) {
    // EDIT MODE FOR NOTE
    const note = movement.notes.find(n => n.id === noteId);
    if (note) {
      note.date = date;
      note.content = content;
    }
  } else {
    // ADD MODE FOR NOTE
    const newNoteId = "note-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    movement.notes.push({
      id: newNoteId,
      date,
      content
    });
  }

  // Sort notes by date
  movement.notes.sort((a, b) => new Date(a.date) - new Date(b.date));

  saveState();
  return movement;
}

function handleDeleteMovementNote(rubroName, movId, noteId) {
  const period = getActivePeriod();
  if (!period) return false;

  const monthKey = state.activeMonthKey;
  const monthData = period.months[monthKey];
  
  let movement;
  if (rubroName === "4x1000") {
    movement = monthData.tax4x1000.find(t => t.id === movId);
  } else if (rubroName === "aporteFondo") {
    movement = monthData.aportesFondo.find(a => a.id === movId);
  } else {
    const rubroMonthData = monthData.rubros[rubroName];
    if (rubroMonthData) {
      movement = rubroMonthData.movements.find(m => m.id === movId);
    }
  }

  if (!movement || !movement.notes) return false;

  const idx = movement.notes.findIndex(n => n.id === noteId);
  if (idx === -1) return false;

  const noteData = movement.notes[idx];
  
  // Route note to trash!
  state.trash.push({
    id: "trash-" + Date.now() + "-" + Math.floor(Math.random()*1000),
    type: "note",
    deletedAt: new Date().toISOString(),
    originalPeriodId: period.id,
    originalMonthKey: monthKey,
    originalRubroName: rubroName,
    originalMovementId: movId,
    data: noteData
  });

  movement.notes.splice(idx, 1);
  saveState();
  updateTrashBadge();
  return movement;
}

// Add or edit manual 4x1000
function handleSaveTax(date, value, reason, taxId) {
  const period = getActivePeriod();
  if (!period) return false;

  const monthKey = state.activeMonthKey;
  const monthData = period.months[monthKey];

  if (taxId) {
    // EDIT MODE
    const idx = monthData.tax4x1000.findIndex(t => t.id === taxId);
    if (idx === -1) return false;
    
    monthData.tax4x1000[idx].date = date;
    monthData.tax4x1000[idx].value = value;
    monthData.tax4x1000[idx].reason = reason;
  } else {
    // ADD MODE
    const newId = "tax-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    monthData.tax4x1000.push({
      id: newId,
      date,
      value,
      reason
    });
  }

  monthData.tax4x1000.sort((a, b) => new Date(a.date) - new Date(b.date));
  saveState();
  return true;
}

// Delete Tax 4x1000 (routed to trash)
function handleDeleteTax(taxId) {
  const period = getActivePeriod();
  if (!period) return;

  const monthKey = state.activeMonthKey;
  const monthData = period.months[monthKey];
  const idx = monthData.tax4x1000.findIndex(t => t.id === taxId);
  if (idx === -1) return;

  const taxData = monthData.tax4x1000[idx];

  showConfirmModal(
    `<i class="fa-solid fa-trash-can text-danger"></i> Eliminar Cobro Bancario`,
    `¿Desea enviar a la papelera el cobro de 4x1000 "${taxData.reason}" por ${formatCurrency(taxData.value)}?`,
    `Se guardará en la papelera para poder restaurarlo después.`,
    () => {
      monthData.tax4x1000.splice(idx, 1);

      // Route to trash
      state.trash.push({
        id: "trash-" + Date.now() + "-" + Math.floor(Math.random()*1000),
        type: "tax",
        deletedAt: new Date().toISOString(),
        originalPeriodId: period.id,
        originalMonthKey: monthKey,
        data: taxData
      });

      saveState();
      renderMovementsTab();
      updateTrashBadge();
    }
  );
}

// Add or edit manual Aporte al Fondo
function handleSaveFund(date, value, reason, fundId) {
  const period = getActivePeriod();
  if (!period) return false;

  const monthKey = state.activeMonthKey;
  const monthData = period.months[monthKey];

  if (!monthData.aportesFondo) {
    monthData.aportesFondo = [];
  }

  if (fundId) {
    // EDIT MODE
    const idx = monthData.aportesFondo.findIndex(a => a.id === fundId);
    if (idx === -1) return false;
    
    monthData.aportesFondo[idx].date = date;
    monthData.aportesFondo[idx].value = value;
    monthData.aportesFondo[idx].reason = reason;
  } else {
    // ADD MODE
    const newId = "fund-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    monthData.aportesFondo.push({
      id: newId,
      date,
      value,
      reason,
      notes: []
    });
  }

  monthData.aportesFondo.sort((a, b) => new Date(a.date) - new Date(b.date));
  saveState();
  return true;
}

// Delete Aporte al Fondo (routed to trash)
function handleDeleteFund(fundId) {
  const period = getActivePeriod();
  if (!period) return;

  const monthKey = state.activeMonthKey;
  const monthData = period.months[monthKey];
  const idx = monthData.aportesFondo.findIndex(a => a.id === fundId);
  if (idx === -1) return;

  const fundData = monthData.aportesFondo[idx];

  showConfirmModal(
    `<i class="fa-solid fa-trash-can text-danger"></i> Eliminar Aporte al Fondo`,
    `¿Desea enviar a la papelera el aporte al fondo de "${fundData.reason}" por ${formatCurrency(fundData.value)}?`,
    `Se guardará en la papelera para poder restaurarlo después.`,
    () => {
      monthData.aportesFondo.splice(idx, 1);

      // Route to trash
      state.trash.push({
        id: "trash-" + Date.now() + "-" + Math.floor(Math.random()*1000),
        type: "aporteFondo",
        deletedAt: new Date().toISOString(),
        originalPeriodId: period.id,
        originalMonthKey: monthKey,
        data: fundData
      });

      saveState();
      renderMovementsTab();
      updateTrashBadge();
    }
  );
}

// Create dynamic custom rubro
function handleCreateCustomRubro(name, isCajaVal = false) {
  if (!name) return false;
  
  const trimmedName = name.trim();
  if (trimmedName === "") return false;
  
  // Case-insensitive duplicate check
  const exists = (state.rubros || []).some(r => 
    r.name.toLowerCase() === trimmedName.toLowerCase()
  );
  
  if (exists) {
    alert("El rubro ya existe.");
    return false;
  }
  
  if (!state.rubros) {
    state.rubros = [];
  }
  state.rubros.push({ name: trimmedName, isCaja: isCajaVal });
  
  // Initialize budgets to 0 for this new rubro in all existing periods
  state.periods.forEach(p => {
    if (p.budgets && p.budgets[trimmedName] === undefined) {
      p.budgets[trimmedName] = 0;
    }
  });
  
  saveState();
  return true;
}

// Delete custom rubro and backup to trash
function handleDeleteCustomRubro(rubroName) {
  const rubroIdx = (state.rubros || []).findIndex(r => 
    r.name.toLowerCase() === rubroName.toLowerCase()
  );
  if (rubroIdx === -1) return;
  
  const rubro = state.rubros[rubroIdx];
  const name = rubro.name;
  const isCajaVal = !!rubro.isCaja;
  
  // Backup budgets across all periods
  const budgetsBackup = {};
  state.periods.forEach(p => {
    budgetsBackup[p.id] = p.budgets[name] || 0;
  });
  
  // Backup monthly occurrences across all periods
  const occurrencesBackup = {};
  state.periods.forEach(p => {
    occurrencesBackup[p.id] = {};
    if (p.months) {
      Object.keys(p.months).forEach(monthKey => {
        const mData = p.months[monthKey];
        if (mData && mData.rubros && mData.rubros[name]) {
          occurrencesBackup[p.id][monthKey] = mData.rubros[name];
        }
      });
    }
  });
  
  // Create trash item
  const trashItem = {
    id: "trash-" + Date.now(),
    type: "customRubro",
    deletedAt: new Date().toISOString(),
    originalPeriodId: state.activePeriodId,
    originalRubroName: name,
    data: {
      name: name,
      isCaja: isCajaVal,
      budgets: budgetsBackup,
      monthlyOccurrences: occurrencesBackup
    }
  };
  
  state.trash.push(trashItem);
  
  // Remove from state.rubros
  state.rubros.splice(rubroIdx, 1);
  
  // Clean up from active period / all periods
  state.periods.forEach(p => {
    if (p.budgets) {
      delete p.budgets[name];
    }
    if (p.months) {
      Object.keys(p.months).forEach(monthKey => {
        const mData = p.months[monthKey];
        if (mData && mData.rubros) {
          delete mData.rubros[name];
        }
      });
    }
  });
  
  saveState();
  refreshUI();
}

// Edit custom rubro name and Caja status
function handleSaveEditCustomRubro(oldName, newName, isCajaVal) {
  if (!newName) return false;
  
  const trimmedNewName = newName.trim();
  if (trimmedNewName === "") return false;
  
  // If name changed, check for duplicates
  if (trimmedNewName.toLowerCase() !== oldName.toLowerCase()) {
    const exists = (state.rubros || []).some(r => 
      r.name.toLowerCase() === trimmedNewName.toLowerCase()
    );
    
    if (exists) {
      alert("Ya existe un rubro con ese nombre.");
      return false;
    }
  }
  
  // Update state.rubros
  const idx = (state.rubros || []).findIndex(r => 
    r.name.toLowerCase() === oldName.toLowerCase()
  );
  
  if (idx !== -1) {
    state.rubros[idx] = { name: trimmedNewName, isCaja: isCajaVal };
  } else {
    return false;
  }
  
  // If name changed, rename keys in budgets and months
  if (trimmedNewName !== oldName) {
    state.periods.forEach(p => {
      // Budgets
      if (p.budgets && p.budgets[oldName] !== undefined) {
        p.budgets[trimmedNewName] = p.budgets[oldName];
        delete p.budgets[oldName];
      }
      // Monthly rubros
      if (p.months) {
        Object.keys(p.months).forEach(monthKey => {
          const monthData = p.months[monthKey];
          if (monthData && monthData.rubros && monthData.rubros[oldName] !== undefined) {
            monthData.rubros[trimmedNewName] = monthData.rubros[oldName];
            delete monthData.rubros[oldName];
          }
        });
      }
    });
    
    // Rename in trash
    state.trash.forEach(item => {
      if (item.originalRubroName === oldName) {
        item.originalRubroName = trimmedNewName;
      }
      if (item.type === "customRubro" && item.data && item.data.name === oldName) {
        item.data.name = trimmedNewName;
      }
    });
  }
  
  saveState();
  return true;
}

// Update Annual budget for a rubro
function handleUpdateAnnualBudget(rubroName, value) {
  const period = getActivePeriod();
  if (!period) return;

  period.budgets[rubroName] = value;
  saveState();
  updateSummaryTotals();
}

function updateSummaryTotals() {
  const period = getActivePeriod();
  if (!period) return;

  let totalBudget = 0;
  let totalIncome = 0;
  let totalSpent = 0;
  let totalRemaining = 0;

  getAllRubros().forEach(rubro => {
    const stats = calculateAnnualRubroStats(period, rubro);
    totalBudget += stats.initialBudget;
    totalIncome += stats.totalIncome;
    totalSpent += stats.totalSpentReal;
    totalRemaining += stats.remaining;
  });

  const taxSpent = calculateAnnualTaxStats(period);
  totalSpent += taxSpent;
  totalRemaining -= taxSpent;

  document.getElementById("total-annual-budget").textContent = formatCurrency(totalBudget);
  document.getElementById("total-annual-spent").textContent = formatCurrency(totalSpent);
  
  const totalRemEl = document.getElementById("total-annual-remaining");
  totalRemEl.textContent = formatCurrency(totalRemaining);
  totalRemEl.className = `text-right ${totalRemaining >= 0 ? 'val-positive' : 'val-negative'}`;

  renderMonthlyFlowSummary(period);
  renderFundSummaryTable(period);
}

function handleUpdateMonthlyBudget(rubroName, value) {
  const period = getActivePeriod();
  if (!period) return;

  const monthKey = state.activeMonthKey;
  const monthData = period.months[monthKey];
  
  if (monthData.rubros[rubroName]) {
    monthData.rubros[rubroName].monthlyBudget = value;
    saveState();

    const stats = calculateMonthStats(monthData);
    document.getElementById("month-metric-requested").textContent = formatCurrency(stats.requested);
    document.getElementById("month-metric-spent").textContent = formatCurrency(stats.spent);
    
    const remEl = document.getElementById("month-metric-remaining");
    remEl.textContent = formatCurrency(stats.remaining);
    remEl.parentElement.className = `metric-info ${stats.remaining >= 0 ? 'val-positive' : 'val-negative'}`;

    const rubroStats = calculateMonthRubroStats(monthData, rubroName);
    const cardEl = document.querySelector(`.month-rubro-card input[data-rubro="${rubroName}"]`).closest('.month-rubro-card');
    if (cardEl) {
      const statsList = cardEl.querySelector('.rubro-card-stats');
      statsList.innerHTML = `
        <div class="rubro-stat-item">
          <span class="stat-label">Gastado:</span>
          <span class="val-negative font-weight-500">${formatCurrency(rubroStats.spent)}</span>
        </div>
        <div class="rubro-stat-item">
          <span class="stat-label">Sobrante:</span>
          <span class="${rubroStats.remaining >= 0 ? 'val-positive' : 'val-negative'} font-weight-500">${formatCurrency(rubroStats.remaining)}</span>
        </div>
      `;
    }
  }
}

// Backup Export/Import
function handleExport() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  
  const timestamp = new Date().toISOString().slice(0,10);
  downloadAnchor.setAttribute("download", `respaldo_tesoreria_${timestamp}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function handleImport(event) {
  const fileReader = new FileReader();
  const file = event.target.files[0];
  if (!file) return;

  fileReader.onload = function(e) {
    try {
      let importedData = JSON.parse(e.target.result);
      if (importedData && Array.isArray(importedData.periods) && importedData.activePeriodId) {
        importedData = migrateState(importedData);
        state = importedData;
        
        // Ensure trash exists
        if (!state.trash) state.trash = [];

        saveState();
        refreshUI();
        alert("Copia de seguridad restaurada correctamente.");
      } else {
        alert("El archivo JSON no tiene un formato válido para esta aplicación.");
      }
    } catch (err) {
      alert("Error al leer el archivo JSON.");
    }
  };
  fileReader.readAsText(file);
}

// ==========================================================================
// MODAL MANAGEMENT SYSTEM
// ==========================================================================

function openModal(modalId) {
  document.getElementById("modal-backdrop").classList.add("active");
  document.getElementById(modalId).classList.add("active");
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.remove("active");
  document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));
}

// ==========================================================================
// MAIN UI REFRESH
// ==========================================================================

function refreshUI() {
  updatePeriodTitle();
  renderPeriodsDropdown();
  renderSummaryTab();
  renderMovementsTab();
  renderTrashTab();
}

// ==========================================================================
// INITIAL SETUP & EVENT ATTACHMENTS
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Check authentication status first
  checkAuth();

  // 1. Load data
  loadState();

  // 2. Refresh everything
  refreshUI();

  // ================ 3. EVENT DELEGATIONS & LISTENERS ================

  // Login form submission
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const userVal = document.getElementById("login-username").value.trim();
      const passVal = document.getElementById("login-password").value.trim();
      handleLogin(userVal, passVal);
    });
  }

  // Toggle password visibility
  const togglePassBtn = document.getElementById("toggle-password");
  if (togglePassBtn) {
    togglePassBtn.addEventListener("click", () => {
      const passwordInput = document.getElementById("login-password");
      const icon = togglePassBtn.querySelector("i");
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
      } else {
        passwordInput.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
      }
    });
  }

  // Logout button
  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  // Mobile Hamburger Toggle
  const sidebar = document.getElementById("app-sidebar");
  document.getElementById("sidebar-toggle").addEventListener("click", () => {
    sidebar.classList.toggle("active");
  });

  // Tab switching
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("data-tab");
      if (!targetId) return; // Ignore buttons that are not tabs
      
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.remove("active"));
      document.getElementById(targetId).classList.add("active");

      // Mobile close menu on click
      sidebar.classList.remove("active");

      // Render tab-specific things
      if (targetId === "summary-section") {
        renderSummaryTab();
      } else if (targetId === "movements-section") {
        renderMovementsTab();
      } else if (targetId === "trash-section") {
        renderTrashTab();
      }
    });
  });

  // Period Selector Change
  document.getElementById("period-selector").addEventListener("change", (e) => {
    state.activePeriodId = e.target.value;
    saveState();
    refreshUI();
  });

  // Delete Period Button
  document.getElementById("btn-delete-period-trigger").addEventListener("click", () => {
    if (state.activePeriodId) {
      handleDeletePeriod(state.activePeriodId);
    }
  });

  // Create Period Trigger Button
  document.getElementById("btn-new-period").addEventListener("click", () => {
    const nextStartYear = state.periods.length > 0 ? (state.periods[0].startYear + 1) : new Date().getFullYear();
    document.getElementById("period-start-year").value = nextStartYear;
    document.getElementById("period-name-preview").textContent = `Mayo ${nextStartYear} - Abril ${nextStartYear + 1}`;
    openModal("modal-create-period");
  });

  document.getElementById("period-start-year").addEventListener("input", (e) => {
    const year = parseInt(e.target.value);
    if (!isNaN(year)) {
      document.getElementById("period-name-preview").textContent = `Mayo ${year} - Abril ${year + 1}`;
    }
  });

  document.getElementById("form-create-period").addEventListener("submit", (e) => {
    e.preventDefault();
    const startYear = document.getElementById("period-start-year").value;
    if (handleCreatePeriod(startYear)) {
      closeModal();
      refreshUI();
    }
  });

  // Inline annual budget modifications
  document.getElementById("rubros-summary-body").addEventListener("input", (e) => {
    if (e.target.classList.contains("annual-budget-input")) {
      const rubro = e.target.getAttribute("data-rubro");
      
      // Save cursor position
      let selectionStart = e.target.selectionStart;
      let originalLength = e.target.value.length;
      
      // Remove all non-digits to get raw value
      let rawVal = e.target.value.replace(/\D/g, "");
      
      if (rawVal === "") {
        e.target.value = "";
        handleUpdateAnnualBudget(rubro, 0);
        return;
      }
      
      const numericVal = parseInt(rawVal, 10);
      
      // Format numeric value with dots
      const formatted = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(numericVal);
      e.target.value = formatted;
      
      // Restore cursor position
      let newLength = formatted.length;
      let cursorPosition = selectionStart + (newLength - originalLength);
      e.target.setSelectionRange(cursorPosition, cursorPosition);
      
      handleUpdateAnnualBudget(rubro, numericVal);
    }
  });

  // Export/Import triggers
  document.getElementById("btn-export").addEventListener("click", handleExport);
  document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });
  document.getElementById("import-file").addEventListener("change", handleImport);

  // Close modals clicking outside or on close buttons
  document.getElementById("modal-backdrop").addEventListener("click", closeModal);
  document.querySelectorAll(".btn-close-modal").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
    });
  });

  // Month select dropdown change
  document.getElementById("month-dropdown-selector").addEventListener("change", (e) => {
    state.activeMonthKey = e.target.value;
    saveState();
    renderMovementsTab();
  });

  // Inline monthly budget modifications
  document.getElementById("month-rubros-container").addEventListener("input", (e) => {
    if (e.target.classList.contains("budget-month-input")) {
      const rubro = e.target.getAttribute("data-rubro");
      
      // Save cursor position
      let selectionStart = e.target.selectionStart;
      let originalLength = e.target.value.length;
      
      // Remove all non-digits to get raw value
      let rawVal = e.target.value.replace(/\D/g, "");
      
      if (rawVal === "") {
        e.target.value = "";
        handleUpdateMonthlyBudget(rubro, 0);
        return;
      }
      
      const numericVal = parseInt(rawVal, 10);
      
      // Format numeric value with dots
      const formatted = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(numericVal);
      e.target.value = formatted;
      
      // Restore cursor position
      let newLength = formatted.length;
      let cursorPosition = selectionStart + (newLength - originalLength);
      e.target.setSelectionRange(cursorPosition, cursorPosition);
      
      handleUpdateMonthlyBudget(rubro, numericVal);
    }
  });

  // Open modal: Add Rubro to Month
  document.getElementById("btn-add-month-rubro").addEventListener("click", () => {
    const period = getActivePeriod();
    if (!period) return;
    
    const monthData = period.months[state.activeMonthKey];
    const select = document.getElementById("rubro-select-input");
    select.innerHTML = "";

    const unusedRubros = getAllRubros().filter(r => !monthData.rubros[r]);

    if (unusedRubros.length === 0) {
      alert("Todos los rubros ya están agregados en este mes.");
      return;
    }

    unusedRubros.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      select.appendChild(opt);
    });

    document.getElementById("rubro-monthly-budget").value = "0";
    openModal("modal-add-rubro");
  });

  document.getElementById("form-add-rubro").addEventListener("submit", (e) => {
    e.preventDefault();
    const rubro = document.getElementById("rubro-select-input").value;
    const rawVal = document.getElementById("rubro-monthly-budget").value.replace(/\D/g, "");
    const budget = rawVal === "" ? 0 : parseInt(rawVal, 10);
    
    if (handleAddRubroToMonth(rubro, budget)) {
      closeModal();
      renderMovementsTab();
    }
  });

  // Open modal: Create New Rubro
  document.querySelectorAll(".btn-new-rubro-trigger").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("new-rubro-name").value = "";
      document.getElementById("new-rubro-is-caja").checked = false;
      openModal("modal-create-rubro");
    });
  });

  // Submit form: Create New Rubro
  document.getElementById("form-create-rubro").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("new-rubro-name").value.trim();
    const isCajaVal = document.getElementById("new-rubro-is-caja").checked;
    if (handleCreateCustomRubro(name, isCajaVal)) {
      closeModal();
      refreshUI();
    }
  });

  // Edit custom rubro delegation in Summary Table
  document.getElementById("rubros-summary-body").addEventListener("click", (e) => {
    const btnEdit = e.target.closest(".btn-edit-custom-rubro");
    if (btnEdit) {
      const rubroName = btnEdit.getAttribute("data-rubro");
      const custom = (state.rubros || []).find(r => 
        r.name.toLowerCase() === rubroName.toLowerCase()
      );
      
      const isCajaVal = custom ? !!custom.isCaja : false;
      const displayName = custom ? custom.name : rubroName;
      
      document.getElementById("edit-custom-rubro-old-name").value = displayName;
      document.getElementById("edit-custom-rubro-name").value = displayName;
      document.getElementById("edit-custom-rubro-is-caja").checked = isCajaVal;
      
      openModal("modal-edit-custom-rubro");
    }
    
    const btnDelete = e.target.closest(".btn-delete-custom-rubro");
    if (btnDelete) {
      const rubroName = btnDelete.getAttribute("data-rubro");
      
      showConfirmModal(
        `<i class="fa-solid fa-trash-can text-danger"></i> Eliminar Rubro`,
        `¿Está seguro de enviar el rubro "${rubroName}" a la papelera?`,
        `Se eliminará de la vista y de los meses del período activo. Podrás restaurarlo desde la Papelera.`,
        () => {
          handleDeleteCustomRubro(rubroName);
        }
      );
    }
  });

  // Submit form: Edit Custom Rubro
  document.getElementById("form-edit-custom-rubro").addEventListener("submit", (e) => {
    e.preventDefault();
    const oldName = document.getElementById("edit-custom-rubro-old-name").value;
    const newName = document.getElementById("edit-custom-rubro-name").value.trim();
    const isCajaVal = document.getElementById("edit-custom-rubro-is-caja").checked;
    
    if (handleSaveEditCustomRubro(oldName, newName, isCajaVal)) {
      closeModal();
      refreshUI();
    }
  });

  // Formatting for monthly budget input in modal
  const rubroMonthlyBudgetInput = document.getElementById("rubro-monthly-budget");
  if (rubroMonthlyBudgetInput) {
    rubroMonthlyBudgetInput.addEventListener("input", (e) => {
      let selectionStart = e.target.selectionStart;
      let originalLength = e.target.value.length;
      let rawVal = e.target.value.replace(/\D/g, "");
      if (rawVal === "") {
        e.target.value = "";
        return;
      }
      const numericVal = parseInt(rawVal, 10);
      const formatted = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(numericVal);
      e.target.value = formatted;
      let newLength = formatted.length;
      let cursorPosition = selectionStart + (newLength - originalLength);
      e.target.setSelectionRange(cursorPosition, cursorPosition);
    });
  }

  // Open Modal: Edit Rubro Category
  document.getElementById("month-rubros-container").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-edit-rubro-trigger");
    if (btn) {
      const rubro = btn.getAttribute("data-rubro");
      const period = getActivePeriod();
      const monthData = period.months[state.activeMonthKey];
      const monthLabel = MONTHS_ORDER.find(m => m.key === state.activeMonthKey).label;

      document.getElementById("edit-rubro-old-name").value = rubro;
      document.getElementById("edit-rubro-current-name").textContent = rubro;
      document.getElementById("edit-rubro-month-label").textContent = `${monthLabel} ${monthData.year}`;

      // Populate new categories option (13 predefined minus already active ones, but keep current one as selected)
      const select = document.getElementById("edit-rubro-select-input");
      select.innerHTML = "";
      
      getAllRubros().forEach(r => {
        // Show if not active, or if it is the current one
        if (!monthData.rubros[r] || r === rubro) {
          const opt = document.createElement("option");
          opt.value = r;
          opt.textContent = r;
          opt.selected = r === rubro;
          select.appendChild(opt);
        }
      });

      openModal("modal-edit-rubro");
    }
  });

  // Confirm Edit Rubro Category
  document.getElementById("form-edit-rubro").addEventListener("submit", (e) => {
    e.preventDefault();
    const oldName = document.getElementById("edit-rubro-old-name").value;
    const newName = document.getElementById("edit-rubro-select-input").value;
    
    if (handleEditRubroMonthName(oldName, newName)) {
      closeModal();
      renderMovementsTab();
    }
  });

  // Remove Rubro Trigger from Month
  document.getElementById("month-rubros-container").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-remove-rubro-trigger");
    if (btn) {
      const rubro = btn.getAttribute("data-rubro");
      handleRemoveRubroFromMonth(rubro);
    }
  });

  // Open Modal: Add Movement
  document.getElementById("month-rubros-container").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-add-movement-trigger");
    if (btn) {
      const rubro = btn.getAttribute("data-rubro");
      const period = getActivePeriod();
      const monthData = period.months[state.activeMonthKey];

      // Form header and labels
      document.getElementById("movement-modal-title").textContent = "Registrar Movimiento";
      document.getElementById("btn-submit-movement").textContent = "Registrar";
      
      document.getElementById("movement-rubro-id").value = rubro;
      document.getElementById("movement-id").value = ""; // Empty = Add Mode
      document.getElementById("movement-rubro-name").textContent = rubro;
      
      // Auto date
      const currentDay = new Date().getDate();
      const dayStr = currentDay < 10 ? '0' + currentDay : currentDay;
      const monthIndex = MONTHS_ORDER.findIndex(m => m.key === state.activeMonthKey);
      const calendarMonth = (monthIndex + 4) % 12 + 1;
      const calMonthStr = calendarMonth < 10 ? '0' + calendarMonth : calendarMonth;
      
      document.getElementById("movement-date").value = `${monthData.year}-${calMonthStr}-${dayStr}`;
      document.getElementById("movement-value").value = "";
      document.getElementById("movement-reason").value = "";
      document.getElementById("movement-type").value = "envio";
      document.getElementById("movement-real-spent").value = "";

      const isSpecial = isCaja(rubro);
      document.getElementById("special-rubro-fields").style.display = isSpecial ? "block" : "none";

      openModal("modal-add-movement");
    }
  });

  // Open Modal: Edit Movement
  document.getElementById("month-rubros-container").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-edit-movement-trigger");
    if (btn) {
      const rubro = btn.getAttribute("data-rubro");
      const movId = btn.getAttribute("data-mov-id");
      
      const period = getActivePeriod();
      const monthData = period.months[state.activeMonthKey];
      const rubroData = monthData.rubros[rubro];
      const movement = rubroData.movements.find(m => m.id === movId);
      if (!movement) return;

      // Edit Mode labels
      document.getElementById("movement-modal-title").textContent = "Editar Movimiento";
      document.getElementById("btn-submit-movement").textContent = "Guardar Cambios";

      document.getElementById("movement-rubro-id").value = rubro;
      document.getElementById("movement-id").value = movId; // Filled = Edit Mode
      document.getElementById("movement-rubro-name").textContent = rubro;
      
      document.getElementById("movement-date").value = movement.date;
      document.getElementById("movement-value").value = movement.value;
      document.getElementById("movement-reason").value = movement.reason;
      document.getElementById("movement-type").value = movement.type;
      
      const isSpecial = isCaja(rubro);
      const specialBox = document.getElementById("special-rubro-fields");
      
      if (isSpecial && movement.type === "envio") {
        specialBox.style.display = "block";
        document.getElementById("movement-real-spent").value = (movement.realSpent !== undefined) ? movement.realSpent : "";
      } else {
        specialBox.style.display = "none";
        document.getElementById("movement-real-spent").value = "";
      }

      openModal("modal-add-movement");
    }
  });

  // Live toggle special rubro fields
  document.getElementById("movement-type").addEventListener("change", (e) => {
    const rubro = document.getElementById("movement-rubro-id").value;
    const isSpecial = isCaja(rubro);
    const type = e.target.value;
    const specialBox = document.getElementById("special-rubro-fields");
    
    if (isSpecial && type === "envio") {
      specialBox.style.display = "block";
    } else {
      specialBox.style.display = "none";
    }
  });

  // Confirm Add/Edit Movement
  document.getElementById("form-add-movement").addEventListener("submit", (e) => {
    e.preventDefault();
    const rubro = document.getElementById("movement-rubro-id").value;
    const date = document.getElementById("movement-date").value;
    const type = document.getElementById("movement-type").value;
    const value = parseNumeric(document.getElementById("movement-value").value);
    const reason = document.getElementById("movement-reason").value;
    const movId = document.getElementById("movement-id").value; // Empty in add, text in edit
    
    let realSpentVal = undefined;
    if (isCaja(rubro) && type === "envio") {
      const rawReal = document.getElementById("movement-real-spent").value;
      realSpentVal = rawReal === "" ? undefined : parseNumeric(rawReal);
    }

    if (handleSaveMovement(rubro, date, type, value, reason, realSpentVal, movId)) {
      closeModal();
      renderMovementsTab();
    }
  });

  // Delete Movement Trigger
  document.getElementById("month-rubros-container").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-delete-movement-trigger");
    if (btn) {
      const rubro = btn.getAttribute("data-rubro");
      const movId = btn.getAttribute("data-mov-id");
      handleDeleteMovement(rubro, movId);
    }
  });

  // Open Modal: Movement Notes (either by clicking the Notes button or the row itself)
  document.getElementById("month-rubros-container").addEventListener("click", (e) => {
    // Check if clicked notes button
    const notesBtn = e.target.closest(".btn-notes-movement-trigger");
    if (notesBtn) {
      e.stopPropagation();
      const rubro = notesBtn.getAttribute("data-rubro");
      const movId = notesBtn.getAttribute("data-mov-id");
      handleOpenMovementNotes(rubro, movId, false);
      return;
    }

    // Check if clicked row itself, but ignore if clicked other action buttons (edit / delete)
    const row = e.target.closest(".movement-row");
    if (row) {
      if (e.target.closest("button") || e.target.closest("a")) {
        return; 
      }
      const rubro = row.getAttribute("data-rubro");
      const movId = row.getAttribute("data-mov-id");
      handleOpenMovementNotes(rubro, movId, true);
    }
  });

  // Open Modal: Add Tax (4x1000)
  document.getElementById("btn-add-tax").addEventListener("click", () => {
    const period = getActivePeriod();
    const monthData = period.months[state.activeMonthKey];

    document.getElementById("tax-modal-title").textContent = "Registrar Cobro Bancario (4 x 1000)";
    document.getElementById("btn-submit-tax").textContent = "Registrar Cobro";
    
    document.getElementById("tax-id").value = ""; // Empty = Add Mode

    const currentDay = new Date().getDate();
    const dayStr = currentDay < 10 ? '0' + currentDay : currentDay;
    const monthIndex = MONTHS_ORDER.findIndex(m => m.key === state.activeMonthKey);
    const calendarMonth = (monthIndex + 4) % 12 + 1;
    const calMonthStr = calendarMonth < 10 ? '0' + calendarMonth : calendarMonth;

    document.getElementById("tax-date").value = `${monthData.year}-${calMonthStr}-${dayStr}`;
    document.getElementById("tax-value").value = "";
    document.getElementById("tax-reason").value = "";
    
    openModal("modal-add-tax");
  });

  // Open Modal: Edit Tax (4x1000)
  document.getElementById("sec-tax").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-edit-tax-trigger");
    if (btn) {
      const taxId = btn.getAttribute("data-tax-id");
      const period = getActivePeriod();
      const monthData = period.months[state.activeMonthKey];
      const tax = monthData.tax4x1000.find(t => t.id === taxId);
      if (!tax) return;

      document.getElementById("tax-modal-title").textContent = "Editar Cobro Bancario (4 x 1000)";
      document.getElementById("btn-submit-tax").textContent = "Guardar Cambios";

      document.getElementById("tax-id").value = taxId; // Filled = Edit Mode
      
      document.getElementById("tax-date").value = tax.date;
      document.getElementById("tax-value").value = tax.value;
      document.getElementById("tax-reason").value = tax.reason;

      openModal("modal-add-tax");
    }
  });

  // Confirm Add/Edit Tax
  document.getElementById("form-add-tax").addEventListener("submit", (e) => {
    e.preventDefault();
    const date = document.getElementById("tax-date").value;
    const value = parseNumeric(document.getElementById("tax-value").value);
    const reason = document.getElementById("tax-reason").value;
    const taxId = document.getElementById("tax-id").value;

    if (handleSaveTax(date, value, reason, taxId)) {
      closeModal();
      renderMovementsTab();
    }
  });

  // Delete Tax Trigger
  document.getElementById("month-tax-body").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-delete-tax-trigger");
    if (btn) {
      const taxId = btn.getAttribute("data-tax-id");
      handleDeleteTax(taxId);
    }
  });

  // Open notes/details for bank taxes
  document.getElementById("month-tax-body").addEventListener("click", (e) => {
    const notesBtn = e.target.closest(".btn-notes-movement-trigger");
    if (notesBtn) {
      e.stopPropagation();
      const movId = notesBtn.getAttribute("data-mov-id");
      handleOpenMovementNotes("4x1000", movId, false);
      return;
    }

    const row = e.target.closest(".movement-row");
    if (row) {
      if (e.target.closest("button") || e.target.closest("a")) {
        return; 
      }
      const movId = row.getAttribute("data-mov-id");
      handleOpenMovementNotes("4x1000", movId, true);
    }
  });

  // Open Modal: Add Aporte al Fondo
  document.getElementById("btn-add-fund-aporte").addEventListener("click", () => {
    const period = getActivePeriod();
    const monthData = period.months[state.activeMonthKey];

    document.getElementById("fund-modal-title").textContent = "Registrar Aporte al Fondo";
    document.getElementById("btn-submit-fund").textContent = "Registrar Aporte";
    
    document.getElementById("fund-id").value = ""; // Empty = Add Mode

    const currentDay = new Date().getDate();
    const dayStr = currentDay < 10 ? '0' + currentDay : currentDay;
    const monthIndex = MONTHS_ORDER.findIndex(m => m.key === state.activeMonthKey);
    const calendarMonth = (monthIndex + 4) % 12 + 1;
    const calMonthStr = calendarMonth < 10 ? '0' + calendarMonth : calendarMonth;

    document.getElementById("fund-date").value = `${monthData.year}-${calMonthStr}-${dayStr}`;
    document.getElementById("fund-value").value = "";
    document.getElementById("fund-reason").value = "";
    
    openModal("modal-add-fund");
  });

  // Edit/Delete/Notes clicks on Fund Contributions
  document.getElementById("month-fund-body").addEventListener("click", (e) => {
    // 1. Edit Aporte
    const btnEdit = e.target.closest(".btn-edit-fund-trigger");
    if (btnEdit) {
      e.stopPropagation();
      const fundId = btnEdit.getAttribute("data-fund-id");
      const period = getActivePeriod();
      const monthData = period.months[state.activeMonthKey];
      const aporte = monthData.aportesFondo.find(a => a.id === fundId);
      if (!aporte) return;

      document.getElementById("fund-modal-title").textContent = "Editar Aporte al Fondo";
      document.getElementById("btn-submit-fund").textContent = "Guardar Cambios";

      document.getElementById("fund-id").value = fundId; // Filled = Edit Mode
      
      document.getElementById("fund-date").value = aporte.date;
      document.getElementById("fund-value").value = aporte.value;
      document.getElementById("fund-reason").value = aporte.reason;

      openModal("modal-add-fund");
      return;
    }

    // 2. Delete Aporte
    const btnDelete = e.target.closest(".btn-delete-fund-trigger");
    if (btnDelete) {
      e.stopPropagation();
      const fundId = btnDelete.getAttribute("data-fund-id");
      handleDeleteFund(fundId);
      return;
    }

    // 3. Notes Button Click
    const btnNotes = e.target.closest(".btn-notes-movement-trigger");
    if (btnNotes) {
      e.stopPropagation();
      const movId = btnNotes.getAttribute("data-mov-id");
      handleOpenMovementNotes("aporteFondo", movId, false);
      return;
    }

    // 4. Row Click (Read-only notes/details)
    const row = e.target.closest(".movement-row");
    if (row) {
      if (e.target.closest("button") || e.target.closest("a")) {
        return; 
      }
      const movId = row.getAttribute("data-mov-id");
      handleOpenMovementNotes("aporteFondo", movId, true);
    }
  });

  // Confirm Add/Edit Aporte al Fondo
  document.getElementById("form-add-fund").addEventListener("submit", (e) => {
    e.preventDefault();
    const date = document.getElementById("fund-date").value;
    const value = parseNumeric(document.getElementById("fund-value").value);
    const reason = document.getElementById("fund-reason").value;
    const fundId = document.getElementById("fund-id").value;

    if (handleSaveFund(date, value, reason, fundId)) {
      closeModal();
      renderMovementsTab();
    }
  });

  // Recycle Bin triggers: Restore / Permanent Delete
  document.getElementById("trash-items-list").addEventListener("click", (e) => {
    const btnRestore = e.target.closest(".btn-restore-trash");
    if (btnRestore) {
      const id = btnRestore.getAttribute("data-trash-id");
      restoreTrashItem(id);
    }

    const btnDeletePerm = e.target.closest(".btn-delete-perm-trash");
    if (btnDeletePerm) {
      const id = btnDeletePerm.getAttribute("data-trash-id");
      deleteTrashItemPermanently(id);
    }
  });

  // Empty Trash trigger
  document.getElementById("btn-empty-trash").addEventListener("click", () => {
    if (state.trash.length > 0) {
      emptyTrash();
    }
  });

  // Submit new note form
  document.getElementById("form-add-note").addEventListener("submit", (e) => {
    e.preventDefault();
    const rubroName = document.getElementById("note-rubro-id").value;
    const movId = document.getElementById("note-mov-id").value;
    const noteId = document.getElementById("note-id").value;
    const date = document.getElementById("note-date").value;
    const content = document.getElementById("note-content").value;

    const updatedMov = handleSaveMovementNote(rubroName, movId, date, content, noteId);
    if (updatedMov) {
      document.getElementById("note-id").value = "";
      document.getElementById("note-content").value = "";
      document.getElementById("note-form-title").textContent = "Nueva Nota";
      const submitBtn = document.querySelector("#form-add-note button[type='submit']");
      if (submitBtn) {
        submitBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Agregar Nota`;
      }
      renderMovementNotesList(updatedMov, rubroName, false);
    }
  });

  // Notes history click delegation (Edit Note / Delete Note)
  document.getElementById("movement-notes-list").addEventListener("click", (e) => {
    // 1. Edit Note
    const btnEdit = e.target.closest(".btn-edit-note");
    if (btnEdit) {
      e.stopPropagation();
      const noteId = btnEdit.getAttribute("data-note-id");
      const rubroName = btnEdit.getAttribute("data-rubro");
      const movId = btnEdit.getAttribute("data-mov-id");
      
      const period = getActivePeriod();
      const monthData = period.months[state.activeMonthKey];
      let movement;
      if (rubroName === "4x1000") {
        movement = monthData.tax4x1000.find(t => t.id === movId);
      } else if (rubroName === "aporteFondo") {
        movement = monthData.aportesFondo.find(a => a.id === movId);
      } else {
        movement = monthData.rubros[rubroName]?.movements.find(m => m.id === movId);
      }
      
      if (movement && movement.notes) {
        const note = movement.notes.find(n => n.id === noteId);
        if (note) {
          document.getElementById("note-id").value = noteId;
          document.getElementById("note-date").value = note.date;
          document.getElementById("note-content").value = note.content;
          
          document.getElementById("note-form-title").textContent = "Editar Nota";
          const submitBtn = document.querySelector("#form-add-note button[type='submit']");
          if (submitBtn) {
            submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios`;
          }
        }
      }
      return;
    }

    // 2. Delete Note
    const btnDelete = e.target.closest(".btn-delete-note");
    if (btnDelete) {
      e.stopPropagation();
      const noteId = btnDelete.getAttribute("data-note-id");
      const rubroName = btnDelete.getAttribute("data-rubro");
      const movId = btnDelete.getAttribute("data-mov-id");

      showConfirmModal(
        `<i class="fa-solid fa-trash-can text-danger"></i> Eliminar Nota`,
        `¿Está seguro de enviar esta nota a la papelera?`,
        `Podrás recuperarla en cualquier momento desde la pestaña Papelera.`,
        () => {
          const updatedMov = handleDeleteMovementNote(rubroName, movId, noteId);
          if (updatedMov) {
            renderMovementNotesList(updatedMov, rubroName, false);
          }
        }
      );
    }
  });

  // Shared Sub-navigation Toggling (for both Resumen and Movimientos tabs)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-subnav");
    if (btn) {
      const tabPane = btn.closest(".tab-pane");
      if (!tabPane) return;
      
      const targetId = btn.getAttribute("data-target");
      
      // Update only buttons in the same tab pane
      tabPane.querySelectorAll(".btn-subnav").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      // Update only content panels in the same tab pane
      tabPane.querySelectorAll(".subnav-section-content").forEach(panel => {
        panel.classList.remove("active");
      });
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }
    }
  });
});
