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

// ==========================================================================
// APPLICATION STATE
// ==========================================================================

let state = {
  periods: [],
  activePeriodId: null,
  activeMonthKey: "mayo",
  trash: [] // Deleted elements storage
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
  PREDEFINED_RUBROS.forEach(rubro => {
    budgets[rubro] = 0;
  });

  const months = {};
  MONTHS_ORDER.forEach((m, index) => {
    const isNextYear = index >= 8;
    const year = isNextYear ? endYear : startYear;
    
    months[m.key] = {
      year: year,
      rubros: {}, 
      tax4x1000: [] 
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
  const defaultPeriod = createEmptyPeriod(currentYear);
  state.periods.push(defaultPeriod);
  state.activePeriodId = defaultPeriod.id;
  state.activeMonthKey = "mayo";
  state.trash = [];
  saveState();
}

function loadState() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (rawData) {
      state = JSON.parse(rawData);
      
      // Safety checks
      if (!state.periods || !Array.isArray(state.periods) || state.periods.length === 0) {
        initializeDefaultState();
        return;
      }
      if (state.periods.length > 0 && !state.periods.find(p => p.id === state.activePeriodId)) {
        state.activePeriodId = state.periods[0].id;
      }
      if (!state.activeMonthKey) {
        state.activeMonthKey = "mayo";
      }
      if (!state.trash) {
        state.trash = [];
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
  let requested = 0; 
  let spent = 0;     
  let income = 0;    

  Object.keys(monthData.rubros).forEach(rubroName => {
    const stats = calculateMonthRubroStats(monthData, rubroName);
    requested += stats.budget;
    spent += stats.spent;
    income += stats.income;
  });

  let taxSpent = 0;
  monthData.tax4x1000.forEach(t => {
    taxSpent += t.value;
  });
  spent += taxSpent;

  const remaining = requested + income - spent;

  return {
    requested,
    spent,
    income,
    taxSpent,
    remaining
  };
}

function calculateAnnualRubroStats(period, rubroName) {
  const initialBudget = period.budgets[rubroName] || 0;
  let totalIncome = 0;
  let totalSpentReal = 0; 

  const isSpecial = SPECIAL_RUBROS.includes(rubroName);

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

  PREDEFINED_RUBROS.forEach(rubro => {
    const stats = calculateAnnualRubroStats(period, rubro);
    
    totalBudget += stats.initialBudget;
    totalIncome += stats.totalIncome;
    totalSpent += stats.totalSpentReal;
    totalRemaining += stats.remaining;

    const tr = document.createElement("tr");
    
    const tdName = document.createElement("td");
    tdName.innerHTML = `<strong>${rubro}</strong>`;
    if (SPECIAL_RUBROS.includes(rubro)) {
      tdName.innerHTML += ` <span class="special-tag" title="Monto entregado en el mes, pero gasto real anual.">Especial</span>`;
    }
    tr.appendChild(tdName);

    const tdBudget = document.createElement("td");
    tdBudget.className = "budget-input-cell text-right";
    tdBudget.innerHTML = `
      <div class="budget-setter">
        <span class="currency-symbol">$</span>
        <input type="number" 
               class="table-budget-input annual-budget-input" 
               data-rubro="${rubro}" 
               value="${stats.initialBudget || 0}" 
               step="any" 
               min="0">
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
  `;
  tbody.appendChild(trTax);

  document.getElementById("total-annual-budget").textContent = formatCurrency(totalBudget);
  document.getElementById("total-annual-spent").textContent = formatCurrency(totalSpent);
  
  const totalRemEl = document.getElementById("total-annual-remaining");
  totalRemEl.textContent = formatCurrency(totalRemaining);
  totalRemEl.className = `text-right ${totalRemaining >= 0 ? 'val-positive' : 'val-negative'}`;

  renderMonthlyFlowSummary(period);
}

function renderMonthlyFlowSummary(period) {
  const tbody = document.getElementById("monthly-summary-body");
  tbody.innerHTML = "";

  let grandRequested = 0;
  let grandSpent = 0;
  let grandDiff = 0;

  MONTHS_ORDER.forEach(m => {
    const monthData = period.months[m.key];
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

// RENDER TAB 2: MOVIMIENTOS
function renderMonthDropdown() {
  const selector = document.getElementById("month-dropdown-selector");
  if (!selector) return;
  selector.innerHTML = "";

  const period = getActivePeriod();
  if (!period) return;

  MONTHS_ORDER.forEach(m => {
    const monthData = period.months[m.key];
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
  remEl.parentElement.className = `metric-info ${stats.remaining >= 0 ? 'val-positive' : 'val-negative'}`;

  renderMonthRubrosList(monthData);
  renderMonthTaxList(monthData);
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
    const isSpecial = SPECIAL_RUBROS.includes(rubroName);

    const card = document.createElement("div");
    card.className = "month-rubro-card";

    // Card Header
    const cardHeader = document.createElement("div");
    cardHeader.className = "rubro-card-header";
    
    const titleContainer = document.createElement("div");
    titleContainer.className = "rubro-card-title";
    titleContainer.innerHTML = `<h5>${rubroName}</h5>`;
    if (isSpecial) {
      titleContainer.innerHTML += ` <span class="special-tag" title="Monto entregado completo en el mes, gasto real anual.">Especial</span>`;
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
    budgetSettings.innerHTML = `
      <div class="budget-setter">
        <label for="budget-input-${rubroName.replace(/\s+/g, '-')}">Asignado:</label>
        <span class="currency-symbol">$</span>
        <input type="number" 
               id="budget-input-${rubroName.replace(/\s+/g, '-')}"
               class="budget-month-input" 
               data-rubro="${rubroName}" 
               value="${rubroData.monthlyBudget || 0}" 
               step="any" 
               min="0">
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
              <th>Tipo</th>
              <th class="text-right">Valor</th>
              ${isSpecial ? `<th class="text-right">Gasto Real</th>` : ''}
              <th class="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
      `;

      rubroData.movements.forEach(m => {
        const typeLabel = m.type === "envio" ? "Envío" : "Ingreso";
        const typeClass = m.type === "envio" ? "val-negative" : "val-positive";
        const realSpentVal = (m.realSpent !== undefined && m.realSpent !== null) ? m.realSpent : m.value;

        tableHtml += `
          <tr>
            <td>${m.date}</td>
            <td title="${m.reason}">${m.reason.length > 25 ? m.reason.substring(0, 22) + '...' : m.reason}</td>
            <td class="${typeClass}"><strong>${typeLabel}</strong></td>
            <td class="text-right font-weight-500">${formatCurrency(m.value)}</td>
            ${isSpecial ? `<td class="text-right font-weight-500 val-neutral">${m.type === 'envio' ? formatCurrency(realSpentVal) : '-'}</td>` : ''}
            <td class="text-center">
              <div class="action-buttons-cell" style="display: flex; justify-content: center; gap: 4px;">
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
    tr.innerHTML = `
      <td>${t.date}</td>
      <td title="${t.reason}">${t.reason.length > 15 ? t.reason.substring(0, 12) + '...' : t.reason}</td>
      <td class="text-right val-negative font-weight-500">${formatCurrency(t.value)}</td>
      <td class="text-center">
        <div class="action-buttons-cell" style="display: flex; justify-content: center; gap: 4px;">
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
      iconClass = "type-rubro fa-folder-open";
      typeLabel = "Rubro Mensual";
      const monthLabel = MONTHS_ORDER.find(m => m.key === item.originalMonthKey)?.label || item.originalMonthKey;
      detailsLabel = `Rubro "${item.originalRubroName}" en el mes de ${monthLabel} (Monto: ${formatCurrency(item.data.monthlyBudget)})`;
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

  const isSpecial = SPECIAL_RUBROS.includes(rubroName);
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

  PREDEFINED_RUBROS.forEach(rubro => {
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
      const importedData = JSON.parse(e.target.result);
      if (importedData && Array.isArray(importedData.periods) && importedData.activePeriodId) {
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
      const userVal = document.getElementById("login-username").value;
      const passVal = document.getElementById("login-password").value;
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
      const val = parseNumeric(e.target.value);
      handleUpdateAnnualBudget(rubro, val);
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
      const val = parseNumeric(e.target.value);
      handleUpdateMonthlyBudget(rubro, val);
    }
  });

  // Open modal: Add Rubro to Month
  document.getElementById("btn-add-month-rubro").addEventListener("click", () => {
    const period = getActivePeriod();
    if (!period) return;
    
    const monthData = period.months[state.activeMonthKey];
    const select = document.getElementById("rubro-select-input");
    select.innerHTML = "";

    const unusedRubros = PREDEFINED_RUBROS.filter(r => !monthData.rubros[r]);

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

    document.getElementById("rubro-monthly-budget").value = 0;
    openModal("modal-add-rubro");
  });

  document.getElementById("form-add-rubro").addEventListener("submit", (e) => {
    e.preventDefault();
    const rubro = document.getElementById("rubro-select-input").value;
    const budget = parseNumeric(document.getElementById("rubro-monthly-budget").value);
    
    if (handleAddRubroToMonth(rubro, budget)) {
      closeModal();
      renderMovementsTab();
    }
  });

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
      
      PREDEFINED_RUBROS.forEach(r => {
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

      const isSpecial = SPECIAL_RUBROS.includes(rubro);
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
      
      const isSpecial = SPECIAL_RUBROS.includes(rubro);
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
    const isSpecial = SPECIAL_RUBROS.includes(rubro);
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
    if (SPECIAL_RUBROS.includes(rubro) && type === "envio") {
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
  document.querySelector(".bank-column").addEventListener("click", (e) => {
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
});
