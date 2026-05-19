const state = {
  dashboard: null,
  activeView: "overview",
  authMode: "login",
  chartMetric: "totalValue",
  chartPeriod: "30d",
  search: "",
  sortDirection: "desc",
  sortKey: "currentValue",
  typeFilter: "all",
  user: null,
};

const colors = ["#2563eb", "#11875d", "#b7791f", "#c24135", "#0f766e", "#6d5bd0", "#64748b"];

const elements = {
  alertBox: document.querySelector("#alertBox"),
  allocationChart: document.querySelector("#allocationChart"),
  allocationLegend: document.querySelector("#allocationLegend"),
  accountBreakdown: document.querySelector("#accountBreakdown"),
  appShell: document.querySelector("#appShell"),
  authShell: document.querySelector("#authShell"),
  cashHint: document.querySelector("#cashHint"),
  cashValue: document.querySelector("#cashValue"),
  chartMetric: document.querySelector("#chartMetric"),
  chartPeriod: document.querySelector("#chartPeriod"),
  connectForm: document.querySelector("#connectForm"),
  connectionMode: document.querySelector("#connectionMode"),
  copyReportButton: document.querySelector("#copyReportButton"),
  disconnectButton: document.querySelector("#disconnectButton"),
  diagnosticsButton: document.querySelector("#diagnosticsButton"),
  diagnosticsResult: document.querySelector("#diagnosticsResult"),
  environmentLabel: document.querySelector("#environmentLabel"),
  historyChart: document.querySelector("#historyChart"),
  historyCaption: document.querySelector("#historyCaption"),
  insightsGrid: document.querySelector("#insightsGrid"),
  investedHint: document.querySelector("#investedHint"),
  investedValue: document.querySelector("#investedValue"),
  loginForm: document.querySelector("#loginForm"),
  logoutButton: document.querySelector("#logoutButton"),
  openSettingsButton: document.querySelector("#openSettingsButton"),
  overviewView: document.querySelector("#overviewView"),
  passwordForm: document.querySelector("#passwordForm"),
  positionSearch: document.querySelector("#positionSearch"),
  positionSummary: document.querySelector("#positionSummary"),
  positionsTable: document.querySelector("#positionsTable"),
  positionsView: document.querySelector("#positionsView"),
  profileEmail: document.querySelector("#profileEmail"),
  profileForm: document.querySelector("#profileForm"),
  profileName: document.querySelector("#profileName"),
  profitHint: document.querySelector("#profitHint"),
  profitValue: document.querySelector("#profitValue"),
  reportPreview: document.querySelector("#reportPreview"),
  reportsView: document.querySelector("#reportsView"),
  savedAccountPreview: document.querySelector("#savedAccountPreview"),
  savedEnvironment: document.querySelector("#savedEnvironment"),
  savedLastSync: document.querySelector("#savedLastSync"),
  settingsConnectionStatus: document.querySelector("#settingsConnectionStatus"),
  settingsEnvironment: document.querySelector("#settingsEnvironment"),
  settingsView: document.querySelector("#settingsView"),
  sortSelect: document.querySelector("#sortSelect"),
  signupForm: document.querySelector("#signupForm"),
  syncButton: document.querySelector("#syncButton"),
  syncStatus: document.querySelector("#syncStatus"),
  topMovers: document.querySelector("#topMovers"),
  totalValue: document.querySelector("#totalValue"),
  totalValueHint: document.querySelector("#totalValueHint"),
  typeAllocation: document.querySelector("#typeAllocation"),
  typeFilter: document.querySelector("#typeFilter"),
  userEmail: document.querySelector("#userEmail"),
  userName: document.querySelector("#userName"),
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  boot();
});

function bindEvents() {
  document.querySelectorAll(".auth-tab").forEach((button) => {
    button.addEventListener("click", () => {
      setAuthMode(button.dataset.authMode);
    });
  });

  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(elements.loginForm);
    await runAuthAction("Logging in", async () => {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      elements.loginForm.reset();
      await boot();
    });
  });

  elements.signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(elements.signupForm);
    await runAuthAction("Creating account", async () => {
      await api("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      elements.signupForm.reset();
      await boot();
    });
  });

  elements.logoutButton.addEventListener("click", async () => {
    await runAction("Logging out", async () => {
      await api("/api/auth/logout", { method: "POST" });
      state.dashboard = null;
      state.user = null;
      showApp(false);
      setAuthMode("login");
    });
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveView(button.dataset.view);
    });
  });

  elements.openSettingsButton.addEventListener("click", () => {
    setActiveView("settings");
  });

  elements.connectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(elements.connectForm);
    const payload = {
      environment: form.get("environment"),
      apiKey: form.get("apiKey"),
      apiSecret: form.get("apiSecret"),
    };

    await runAction("Connecting", async () => {
      const result = await api("/api/connect", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      elements.connectForm.reset();
      await syncDashboard();
      await loadSettings();
      showAlert(`Trading 212 connected. Loaded ${result.positionCount} open positions.`);
    });
  });

  elements.disconnectButton.addEventListener("click", async () => {
    await runAction("Removing connection", async () => {
      await api("/api/disconnect", { method: "POST" });
      await loadDashboard();
      await loadSettings();
    });
  });

  elements.diagnosticsButton.addEventListener("click", async () => {
    await runAction("Checking Trading 212 reachability", async () => {
      elements.diagnosticsResult.textContent = "Checking Trading 212...";
      const diagnostics = await api("/api/diagnostics/trading212");
      elements.diagnosticsResult.textContent = diagnostics.results
        .map((result) => `${titleCase(result.environment)}: ${result.message}`)
        .join(" ");
    });
  });

  elements.chartMetric.addEventListener("change", (event) => {
    state.chartMetric = event.target.value;
    renderCharts();
  });

  elements.chartPeriod.addEventListener("change", (event) => {
    state.chartPeriod = event.target.value;
    renderCharts();
  });

  elements.profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(elements.profileForm);
    await runAction("Saving profile", async () => {
      const result = await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
        }),
      });
      state.user = result.user;
      renderUser();
      renderSettings(result.settings);
      showAlert("Profile saved.");
    });
  });

  elements.passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(elements.passwordForm);
    await runAction("Changing password", async () => {
      await api("/api/password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: form.get("currentPassword"),
          newPassword: form.get("newPassword"),
        }),
      });
      elements.passwordForm.reset();
      showAlert("Password changed.");
    });
  });

  elements.syncButton.addEventListener("click", syncDashboard);

  elements.positionSearch.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    renderPositions();
  });

  elements.typeFilter.addEventListener("change", (event) => {
    state.typeFilter = event.target.value;
    renderPositions();
  });

  elements.sortSelect.addEventListener("change", (event) => {
    const [key, direction] = event.target.value.split(":");
    state.sortKey = key;
    state.sortDirection = direction;
    renderPositions();
  });

  document.querySelectorAll(".sort-header").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.sortKey;
      if (state.sortKey === key) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDirection = key === "ticker" || key === "type" ? "asc" : "desc";
      }
      elements.sortSelect.value = `${state.sortKey}:${state.sortDirection}`;
      renderPositions();
    });
  });

  elements.copyReportButton.addEventListener("click", async () => {
    const text = buildReportText(state.dashboard);
    await navigator.clipboard.writeText(text);
    setStatus("Report copied");
  });

  window.addEventListener("resize", () => {
    if (state.dashboard) {
      renderCharts();
    }
  });
}

async function boot() {
  try {
    const status = await api("/api/status");
    if (!status.authenticated) {
      showApp(false);
      return;
    }

    state.user = status.user;
    showApp(true);
    await loadSettings();
    await loadDashboard();
  } catch (error) {
    showApp(false);
    showAuthError(error.message);
  }
}

async function loadSettings() {
  const settings = await api("/api/settings");
  renderSettings(settings);
}

async function loadDashboard() {
  await runAction("Loading portfolio", async () => {
    const data = await api("/api/dashboard");
    state.dashboard = data;
    render();
  });
}

async function syncDashboard() {
  await runAction("Syncing portfolio", async () => {
    const data = await api("/api/sync", { method: "POST" });
    state.dashboard = data;
    render();
  });
}

async function runAuthAction(label, action) {
  showAuthError("");
  const original = document.title;
  document.title = `${label}...`;
  try {
    await action();
  } catch (error) {
    showAuthError(error.message || "Action failed.");
  } finally {
    document.title = original;
  }
}

async function runAction(label, action) {
  setStatus(label);
  showAlert("");
  try {
    await action();
    setStatus("Updated");
  } catch (error) {
    setStatus("Needs attention");
    showAlert(error.message || "Action failed.");
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed with ${response.status}`);
  }
  return body;
}

function render() {
  const data = state.dashboard;
  const account = data.account;
  const currency = account.currency;

  state.user = data.user || state.user;
  renderUser();

  elements.connectionMode.textContent = data.mode === "api" ? "Connected" : "Mock";
  document.querySelector("#connectionSummary").textContent =
    data.mode === "api"
      ? `Saved ${titleCase(data.environment)} connection.`
      : "Use Settings to connect Trading 212.";
  elements.environmentLabel.textContent = `${titleCase(data.environment)} workspace`;
  elements.totalValue.textContent = money(account.totalValue, currency);
  elements.investedValue.textContent = money(account.investedValue, currency);
  elements.cashValue.textContent = money(account.cashAvailable, currency);
  elements.profitValue.textContent = money(account.unrealizedProfitLoss, currency);
  elements.profitValue.classList.toggle("gain", account.unrealizedProfitLoss >= 0);
  elements.profitValue.classList.toggle("loss", account.unrealizedProfitLoss < 0);

  elements.totalValueHint.textContent = `Synced ${formatDateTime(data.syncedAt)}`;
  elements.investedHint.textContent = `${money(account.totalCost, currency)} cost basis`;
  elements.cashHint.textContent = `${money(account.cashInPies, currency)} in pies`;
  elements.profitHint.textContent = `${percent(account.unrealizedReturn)} unrealized return`;

  if (data.warning) {
    showAlert(data.warning);
  }

  renderCharts();
  renderInsights();
  renderTypeAllocation();
  renderAccountBreakdown();
  renderTopMovers();
  renderPositionFilters();
  renderPositions();
  renderReport();
}

function showApp(isAuthenticated) {
  elements.authShell.classList.toggle("hidden", isAuthenticated);
  elements.appShell.classList.toggle("hidden", !isAuthenticated);
  showAlert("");
}

function renderUser() {
  elements.userName.textContent = state.user?.name || "-";
  elements.userEmail.textContent = state.user?.email || "-";
  elements.profileName.value = state.user?.name || "";
  elements.profileEmail.value = state.user?.email || "";
}

function renderSettings(settings) {
  if (!settings) return;
  state.user = settings.user || state.user;
  renderUser();

  const trading = settings.trading212 || {};
  elements.settingsConnectionStatus.textContent = trading.connected ? "Connected" : "Mock";
  elements.connectionMode.textContent = trading.connected ? "Connected" : "Mock";
  elements.savedEnvironment.textContent = titleCase(trading.environment || "demo");
  elements.settingsEnvironment.value = trading.environment || "demo";
  elements.savedLastSync.textContent = trading.latestSync ? formatDateTime(trading.latestSync) : "Never";
  elements.savedAccountPreview.textContent = trading.accountPreview
    ? `${money(trading.accountPreview.totalValue || 0, trading.accountPreview.currency || "EUR")}`
    : "Not connected";

  document.querySelector("#connectionSummary").textContent = trading.connected
    ? `Saved ${titleCase(trading.environment)} connection.`
    : "Use Settings to connect Trading 212.";

  if (trading.lastError) {
    showAlert(trading.lastError);
  }
}

function setAuthMode(mode) {
  state.authMode = mode === "signup" ? "signup" : "login";
  document.querySelectorAll(".auth-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === state.authMode);
  });
  elements.loginForm.classList.toggle("hidden", state.authMode !== "login");
  elements.signupForm.classList.toggle("hidden", state.authMode !== "signup");
  showAuthError("");
}

function renderCharts() {
  const chartData = getChartData();
  drawHistoryChart(elements.historyChart, chartData.points, state.dashboard.account.currency, chartData.metric);
  drawAllocationChart(elements.allocationChart, state.dashboard.allocation);
  renderAllocationLegend();
}

function getChartData() {
  const metric = chartMetrics[state.chartMetric] || chartMetrics.totalValue;
  const cutoff = getPeriodCutoff(state.chartPeriod);
  const source = state.dashboard.history || [];
  const filtered = cutoff
    ? source.filter((point) => new Date(point.timestamp).getTime() >= cutoff)
    : source;
  const points = filtered.length > 0 ? filtered : source;

  return { metric, points };
}

function getPeriodCutoff(period) {
  const days = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "1y": 365,
  }[period];

  if (!days) return null;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

const chartMetrics = {
  totalValue: {
    key: "totalValue",
    label: "Total value",
    tone: "#2563eb",
  },
  investedValue: {
    key: "investedValue",
    label: "Invested value",
    tone: "#0f766e",
  },
  cashAvailable: {
    key: "cashAvailable",
    label: "Cash",
    tone: "#11875d",
  },
  unrealizedProfitLoss: {
    key: "unrealizedProfitLoss",
    label: "Unrealized P/L",
    tone: "#b7791f",
  },
};

function drawHistoryChart(canvas, history, currency, metric) {
  const context = setupCanvas(canvas);
  const fallbackWidth = canvas.parentElement?.clientWidth || 720;
  const width = Math.max(320, canvas.clientWidth || fallbackWidth);
  const height = Math.max(240, Math.round(width * 0.34));
  canvas.style.height = `${height}px`;
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  context.scale(devicePixelRatio, devicePixelRatio);
  context.clearRect(0, 0, width, height);

  const pad = { top: 18, right: 18, bottom: 52, left: 58 };
  const values = history.map((point) => point[metric.key]).filter((value) => Number.isFinite(value));
  if (values.length === 0) {
    drawEmptyChart(context, width, height, `No ${metric.label.toLowerCase()} data yet`);
    elements.historyCaption.textContent = "Press Sync now after connecting Trading 212 to save chart points.";
    return;
  }

  const baseMin = Math.min(...values);
  const baseMax = Math.max(...values);
  const padding = Math.max((baseMax - baseMin) * 0.12, Math.max(baseMax * 0.015, 50));
  const min = baseMin - padding;
  const max = baseMax + padding;
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  const points = history.map((point, index) => {
    const x =
      history.length === 1
        ? pad.left + plotWidth / 2
        : pad.left + (plotWidth * index) / Math.max(history.length - 1, 1);
    const y = pad.top + plotHeight - ((point[metric.key] - min) / Math.max(max - min, 1)) * plotHeight;
    return { x, y };
  });

  drawGrid(context, pad, width, height, min, max, currency);
  drawDateAxis(context, pad, width, height, history, points);

  context.strokeStyle = metric.tone;
  context.lineWidth = 3;
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  if (points.length > 1) {
    context.stroke();

    const gradient = context.createLinearGradient(0, pad.top, 0, height - pad.bottom);
    gradient.addColorStop(0, colorWithAlpha(metric.tone, 0.16));
    gradient.addColorStop(1, colorWithAlpha(metric.tone, 0));
    context.lineTo(points.at(-1).x, height - pad.bottom);
    context.lineTo(points[0].x, height - pad.bottom);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();
  } else {
    context.strokeStyle = colorWithAlpha(metric.tone, 0.25);
    context.lineWidth = 2;
    context.setLineDash([6, 6]);
    context.beginPath();
    context.moveTo(pad.left, points[0].y);
    context.lineTo(width - pad.right, points[0].y);
    context.stroke();
    context.setLineDash([]);
  }

  points.forEach((point, index) => {
    if (points.length > 1 && index !== 0 && index !== points.length - 1) return;
    context.fillStyle = "#ffffff";
    context.strokeStyle = metric.tone;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(point.x, point.y, points.length === 1 ? 8 : 5, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  });

  const first = values[0];
  const last = values.at(-1);
  const change = last - first;
  const changeText =
    values.length > 1
      ? `${money(change, currency)} change in selected period`
      : "Only one saved sync so far";
  const dateRangeText = getDateRangeText(history);
  elements.historyCaption.textContent = `${metric.label}. ${history.length} saved sync${history.length === 1 ? "" : "s"} shown. ${dateRangeText} ${changeText}.`;
}

function colorWithAlpha(hex, alpha) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawEmptyChart(context, width, height, message) {
  context.fillStyle = "#f1f5f9";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#607085";
  context.font = "14px Inter, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(message, width / 2, height / 2);
}

function drawGrid(context, pad, width, height, min, max, currency) {
  context.strokeStyle = "#dce4ee";
  context.lineWidth = 1;
  context.fillStyle = "#607085";
  context.font = "12px Inter, sans-serif";
  context.textAlign = "right";
  context.textBaseline = "middle";

  for (let index = 0; index <= 4; index += 1) {
    const value = min + ((max - min) * index) / 4;
    const y = height - pad.bottom - ((height - pad.top - pad.bottom) * index) / 4;
    context.beginPath();
    context.moveTo(pad.left, y);
    context.lineTo(width - pad.right, y);
    context.stroke();
    context.fillText(shortMoney(value, currency), pad.left - 10, y);
  }
}

function drawDateAxis(context, pad, width, height, history, points) {
  const labels = getDateAxisLabels(history, points, width);
  const axisY = height - pad.bottom;

  context.save();
  context.strokeStyle = "#cbd5e1";
  context.fillStyle = "#607085";
  context.font = "12px Inter, sans-serif";
  context.textBaseline = "top";

  labels.forEach(({ point, label, align }) => {
    context.beginPath();
    context.moveTo(point.x, axisY);
    context.lineTo(point.x, axisY + 6);
    context.stroke();

    context.textAlign = align;
    context.fillText(label, point.x, axisY + 12);
  });

  context.restore();
}

function getDateAxisLabels(history, points, width) {
  if (history.length === 0 || points.length === 0) return [];

  if (history.length === 1) {
    return [
      {
        point: points[0],
        label: formatChartDate(history[0].timestamp),
        align: "center",
      },
    ];
  }

  const labelIndexes = width < 520 || history.length === 2
    ? [0, history.length - 1]
    : [0, Math.floor((history.length - 1) / 2), history.length - 1];

  return [...new Set(labelIndexes)].map((index) => ({
    point: points[index],
    label: formatChartDate(history[index].timestamp),
    align: index === 0 ? "left" : index === history.length - 1 ? "right" : "center",
  }));
}

function getDateRangeText(history) {
  if (history.length === 0) return "";
  const firstDate = formatChartDate(history[0].timestamp);
  const lastDate = formatChartDate(history.at(-1).timestamp);
  if (!firstDate && !lastDate) return "";
  if (history.length === 1 || firstDate === lastDate) return `Date: ${firstDate || lastDate}.`;
  return `Dates: ${firstDate} - ${lastDate}.`;
}

function drawAllocationChart(canvas, allocation) {
  const context = setupCanvas(canvas);
  const fallbackWidth = canvas.parentElement?.clientWidth || 300;
  const size = Math.min(Math.max(canvas.clientWidth || fallbackWidth, 220), 300);
  canvas.style.height = `${size}px`;
  canvas.width = size * devicePixelRatio;
  canvas.height = size * devicePixelRatio;
  context.scale(devicePixelRatio, devicePixelRatio);
  context.clearRect(0, 0, size, size);

  const total = allocation.reduce((sum, item) => sum + item.value, 0);
  const center = size / 2;
  const radius = Math.max(70, size / 2 - 12);
  const inner = radius * 0.62;
  let start = -Math.PI / 2;

  allocation.forEach((item, index) => {
    const angle = total > 0 ? (item.value / total) * Math.PI * 2 : 0;
    context.beginPath();
    context.moveTo(center, center);
    context.arc(center, center, radius, start, start + angle);
    context.closePath();
    context.fillStyle = colors[index % colors.length];
    context.fill();
    start += angle;
  });

  context.globalCompositeOperation = "destination-out";
  context.beginPath();
  context.arc(center, center, inner, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = "source-over";

  context.fillStyle = "#18212f";
  context.textAlign = "center";
  context.font = "700 18px Inter, sans-serif";
  context.fillText(`${allocation.length}`, center, center - 3);
  context.font = "12px Inter, sans-serif";
  context.fillStyle = "#607085";
  context.fillText("holdings", center, center + 16);
}

function setupCanvas(canvas) {
  return canvas.getContext("2d");
}

function renderAllocationLegend() {
  const html = state.dashboard.allocation.slice(0, 6).map((item, index) => {
    return `
      <div class="legend-item">
        <i class="legend-dot" style="background:${colors[index % colors.length]}"></i>
        <span>${escapeHtml(item.ticker)}</span>
        <strong>${percent(item.share)}</strong>
      </div>
    `;
  });
  elements.allocationLegend.innerHTML = html.join("");
}

function renderInsights() {
  elements.insightsGrid.innerHTML = state.dashboard.insights
    .map(
      (insight) => `
        <article class="insight ${insight.tone}">
          <span>${escapeHtml(insight.label)}</span>
          <strong>${escapeHtml(insight.value)}</strong>
          <p>${escapeHtml(insight.detail)}</p>
        </article>
      `
    )
    .join("");
}

function renderTypeAllocation() {
  const total = state.dashboard.typeAllocation.reduce((sum, item) => sum + item.value, 0);
  elements.typeAllocation.innerHTML = state.dashboard.typeAllocation
    .map((item) => {
      const share = total > 0 ? item.value / total : 0;
      return `
        <div class="bar-row">
          <header>
            <strong>${escapeHtml(item.label)}</strong>
            <span>${percent(share)}</span>
          </header>
          <div class="bar-track">
            <div class="bar-fill" style="width:${Math.round(share * 100)}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderAccountBreakdown() {
  const account = state.dashboard.account;
  const currency = account.currency;
  const total = Math.max(account.totalValue, 1);
  const investedShare = account.investedValue / total;
  const cashShare = account.cashAvailable / total;
  const reserved = account.reservedForOrders || 0;

  elements.accountBreakdown.innerHTML = `
    <div class="stacked-bar" aria-label="Account allocation">
      <span style="width:${Math.max(0, Math.min(100, investedShare * 100))}%"></span>
      <i style="width:${Math.max(0, Math.min(100, cashShare * 100))}%"></i>
    </div>
    <div class="detail-grid">
      <div>
        <span>Invested share</span>
        <strong>${percent(investedShare)}</strong>
      </div>
      <div>
        <span>Cash share</span>
        <strong>${percent(cashShare)}</strong>
      </div>
      <div>
        <span>Reserved</span>
        <strong>${money(reserved, currency)}</strong>
      </div>
      <div>
        <span>Realized P/L</span>
        <strong class="${account.realizedProfitLoss >= 0 ? "gain" : "loss"}">${money(account.realizedProfitLoss, currency)}</strong>
      </div>
    </div>
  `;
}

function renderTopMovers() {
  const currency = state.dashboard.account.currency;
  const positions = [...state.dashboard.positions];
  const byProfit = [...positions].sort((a, b) => b.unrealizedProfitLoss - a.unrealizedProfitLoss);
  const movers = [
    { label: "Best P/L", position: byProfit[0] },
    { label: "Weakest P/L", position: byProfit.at(-1) },
    { label: "Largest value", position: [...positions].sort((a, b) => b.currentValue - a.currentValue)[0] },
  ].filter((item) => item.position);

  elements.topMovers.innerHTML = movers
    .map(({ label, position }) => {
      const profitClass = position.unrealizedProfitLoss >= 0 ? "gain" : "loss";
      return `
        <div class="mover-row">
          <div>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(position.shortName || position.ticker)}</strong>
            <small>${escapeHtml(position.ticker)}</small>
          </div>
          <div>
            <strong>${money(position.currentValue, currency)}</strong>
            <small class="${profitClass}">${money(position.unrealizedProfitLoss, currency)} · ${percent(position.unrealizedReturn)}</small>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderPositionFilters() {
  const types = [...new Set(state.dashboard.positions.map((position) => position.type || "OTHER"))].sort();
  const current = state.typeFilter;
  elements.typeFilter.innerHTML = [
    `<option value="all">All types</option>`,
    ...types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`),
  ].join("");
  elements.typeFilter.value = types.includes(current) ? current : "all";
  state.typeFilter = elements.typeFilter.value;
}

function renderPositions() {
  const currency = state.dashboard.account.currency;
  const filtered = state.dashboard.positions
    .filter((position) => {
      const haystack = `${position.ticker} ${position.name} ${position.type}`.toLowerCase();
      const matchesSearch = haystack.includes(state.search);
      const matchesType = state.typeFilter === "all" || position.type === state.typeFilter;
      return matchesSearch && matchesType;
    })
    .sort(comparePositions);

  const filteredValue = filtered.reduce((total, position) => total + position.currentValue, 0);
  const filteredProfit = filtered.reduce((total, position) => total + position.unrealizedProfitLoss, 0);
  elements.positionSummary.innerHTML = `
    <span>${filtered.length} of ${state.dashboard.positions.length} positions</span>
    <span>${money(filteredValue, currency)} value</span>
    <span class="${filteredProfit >= 0 ? "gain" : "loss"}">${money(filteredProfit, currency)} P/L</span>
  `;

  document.querySelectorAll(".sort-header").forEach((button) => {
    const baseLabel = button.dataset.label || button.textContent.replace(/[ ↑↓]+$/g, "");
    button.dataset.label = baseLabel;
    const active = button.dataset.sortKey === state.sortKey;
    button.classList.toggle("active", active);
    button.textContent = `${baseLabel}${active ? (state.sortDirection === "asc" ? " ↑" : " ↓") : ""}`;
  });

  elements.positionsTable.innerHTML = filtered
    .map((position) => {
      const profitClass = position.unrealizedProfitLoss >= 0 ? "gain" : "loss";
      return `
        <tr>
          <td>
            <div class="instrument-cell">
              <strong>${escapeHtml(position.shortName || position.name)}</strong>
              <span>${escapeHtml(position.ticker)}</span>
            </div>
          </td>
          <td>${escapeHtml(position.type)}</td>
          <td>${number(position.quantity)}</td>
          <td>${money(position.averagePricePaid, position.instrumentCurrency)}</td>
          <td>${money(position.currentPrice, position.instrumentCurrency)}</td>
          <td>${money(position.currentValue, currency)}</td>
          <td class="${profitClass}">
            ${money(position.unrealizedProfitLoss, currency)}
            <br />
            <small>${percent(position.unrealizedReturn)}</small>
          </td>
        </tr>
      `;
    })
    .join("");
}

function comparePositions(a, b) {
  const direction = state.sortDirection === "asc" ? 1 : -1;
  const aValue = a[state.sortKey];
  const bValue = b[state.sortKey];

  if (typeof aValue === "string" || typeof bValue === "string") {
    return String(aValue || "").localeCompare(String(bValue || "")) * direction;
  }

  return ((Number(aValue) || 0) - (Number(bValue) || 0)) * direction;
}

function renderReport() {
  const data = state.dashboard;
  const account = data.account;
  const top = data.allocation[0];
  const currency = account.currency;

  elements.reportPreview.innerHTML = `
    <h3>${formatMonth(new Date())} portfolio monitor</h3>
    <p>Total account value is <strong>${money(account.totalValue, currency)}</strong>, with <strong>${money(account.investedValue, currency)}</strong> invested and <strong>${money(account.cashAvailable, currency)}</strong> available as cash.</p>
    <ul>
      <li>Unrealized profit/loss is <strong class="${account.unrealizedProfitLoss >= 0 ? "gain" : "loss"}">${money(account.unrealizedProfitLoss, currency)}</strong>, equal to ${percent(account.unrealizedReturn)} of current cost basis.</li>
      <li>The largest holding is <strong>${escapeHtml(top?.label || "N/A")}</strong>, representing ${percent(top?.share || 0)} of invested value.</li>
      <li>The portfolio currently contains <strong>${data.positions.length}</strong> open positions across ${data.typeAllocation.length} asset type groups.</li>
    </ul>
  `;
}

function buildReportText(data) {
  const account = data.account;
  const currency = account.currency;
  const top = data.allocation[0];
  return [
    `${formatMonth(new Date())} portfolio monitor`,
    "",
    `Total account value: ${money(account.totalValue, currency)}`,
    `Invested value: ${money(account.investedValue, currency)}`,
    `Available cash: ${money(account.cashAvailable, currency)}`,
    `Unrealized P/L: ${money(account.unrealizedProfitLoss, currency)} (${percent(account.unrealizedReturn)})`,
    `Largest holding: ${top?.label || "N/A"} (${percent(top?.share || 0)} of invested value)`,
    `Open positions: ${data.positions.length}`,
  ].join("\n");
}

function setActiveView(view) {
  state.activeView = view;
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  elements.overviewView.classList.toggle("hidden", view !== "overview");
  elements.positionsView.classList.toggle("hidden", view !== "positions");
  elements.reportsView.classList.toggle("hidden", view !== "reports");
  elements.settingsView.classList.toggle("hidden", view !== "settings");
}

function showAlert(message) {
  elements.alertBox.textContent = message;
  elements.alertBox.classList.toggle("hidden", !message);
}

function showAuthError(message) {
  let authError = document.querySelector("#authError");
  if (!authError) {
    authError = document.createElement("div");
    authError.id = "authError";
    authError.className = "alert auth-error hidden";
    elements.authShell.querySelector(".auth-panel").append(authError);
  }

  authError.textContent = message;
  authError.classList.toggle("hidden", !message);
}

function setStatus(message) {
  elements.syncStatus.textContent = message;
}

function money(value, currency = "EUR") {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: validCurrency(currency),
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  }).format(value || 0);
}

function shortMoney(value, currency) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: validCurrency(currency),
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function number(value) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 4,
  }).format(value || 0);
}

function percent(value) {
  return new Intl.NumberFormat("en", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function validCurrency(currency) {
  return /^[A-Z]{3}$/.test(currency) ? currency : "EUR";
}

function formatDateTime(value) {
  if (!value) return "never";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatChartDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const showYear = date.getFullYear() !== new Date().getFullYear();
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    ...(showYear ? { year: "2-digit" } : {}),
  }).format(date);
}

function formatMonth(date) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function titleCase(value) {
  return `${value || ""}`.slice(0, 1).toUpperCase() + `${value || ""}`.slice(1);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
