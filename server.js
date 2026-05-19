const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const APP_SECRET_FILE = path.join(DATA_DIR, "app-secret.txt");

const ENVIRONMENTS = {
  demo: "https://demo.trading212.com/api/v0",
  live: "https://live.trading212.com/api/v0",
};

loadDotEnv();
fs.mkdirSync(DATA_DIR, { recursive: true });

const appKey = crypto.createHash("sha256").update(getAppSecret()).digest();
const sessions = new Map();

const mockSnapshot = {
  mode: "mock",
  syncedAt: new Date().toISOString(),
  account: {
    id: "DEMO",
    currency: "EUR",
    cash: {
      availableToTrade: 2380.45,
      inPies: 420.0,
      reservedForOrders: 0,
    },
    investments: {
      currentValue: 18840.2,
      totalCost: 17120.4,
      unrealizedProfitLoss: 1719.8,
      realizedProfitLoss: 280.15,
    },
    totalValue: 21640.65,
  },
  positions: [
    {
      averagePricePaid: 176.1,
      currentPrice: 211.2,
      createdAt: "2025-08-12T09:12:00Z",
      instrument: {
        currency: "USD",
        isin: "US0378331005",
        name: "Apple",
        ticker: "AAPL_US_EQ",
        type: "STOCK",
      },
      quantity: 18,
      quantityAvailableForTrading: 18,
      quantityInPies: 0,
      walletImpact: {
        currency: "EUR",
        currentValue: 3506.8,
        fxImpact: -31.4,
        totalCost: 2937.4,
        unrealizedProfitLoss: 569.4,
      },
    },
    {
      averagePricePaid: 413.5,
      currentPrice: 452.7,
      createdAt: "2025-10-03T13:42:00Z",
      instrument: {
        currency: "USD",
        isin: "US5949181045",
        name: "Microsoft",
        ticker: "MSFT_US_EQ",
        type: "STOCK",
      },
      quantity: 10,
      quantityAvailableForTrading: 10,
      quantityInPies: 0,
      walletImpact: {
        currency: "EUR",
        currentValue: 4168.2,
        fxImpact: 24.8,
        totalCost: 3805.9,
        unrealizedProfitLoss: 362.3,
      },
    },
    {
      averagePricePaid: 96.2,
      currentPrice: 108.6,
      createdAt: "2025-06-18T10:24:00Z",
      instrument: {
        currency: "EUR",
        isin: "IE00B4L5Y983",
        name: "iShares Core MSCI World UCITS ETF",
        ticker: "IWDA_AS_EQ",
        type: "ETF",
      },
      quantity: 76,
      quantityAvailableForTrading: 76,
      quantityInPies: 12,
      walletImpact: {
        currency: "EUR",
        currentValue: 8253.6,
        fxImpact: 0,
        totalCost: 7311.2,
        unrealizedProfitLoss: 942.4,
      },
    },
    {
      averagePricePaid: 78.4,
      currentPrice: 82.5,
      createdAt: "2026-01-07T15:00:00Z",
      instrument: {
        currency: "EUR",
        isin: "IE00B1XNHC34",
        name: "iShares Core Euro Government Bond UCITS ETF",
        ticker: "IEGA_LN_EQ",
        type: "ETF",
      },
      quantity: 35.3,
      quantityAvailableForTrading: 35.3,
      quantityInPies: 0,
      walletImpact: {
        currency: "EUR",
        currentValue: 2911.6,
        fxImpact: 0,
        totalCost: 2765.9,
        unrealizedProfitLoss: 145.7,
      },
    },
  ],
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (requestUrl.pathname.startsWith("/api/")) {
      await handleApi(req, res, requestUrl);
      return;
    }

    await serveStatic(res, requestUrl.pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, error.status || 500, {
      error: error.status ? error.message : "Something went wrong inside the local server.",
    });
  }
});

const port = Number(process.env.PORT || 4173);
server.listen(port, () => {
  console.log(`Investment assistant running at http://localhost:${port}`);
});

async function handleApi(req, res, requestUrl) {
  const currentUser = getCurrentUser(req);

  if (req.method === "GET" && requestUrl.pathname === "/api/status") {
    sendJson(res, 200, buildStatus(currentUser));
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/auth/signup") {
    const body = await readJsonBody(req);
    const user = createUser(body);
    createSession(res, user.id);
    sendJson(res, 201, { user: publicUser(user), status: buildStatus(user) });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/auth/login") {
    const body = await readJsonBody(req);
    const user = authenticateUser(body);
    createSession(res, user.id);
    sendJson(res, 200, { user: publicUser(user), status: buildStatus(user) });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/auth/logout") {
    destroySession(req, res);
    sendJson(res, 200, { ok: true });
    return;
  }

  const user = requireUser(req, res);
  if (!user) return;

  if (req.method === "GET" && requestUrl.pathname === "/api/settings") {
    sendJson(res, 200, buildSettings(user));
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/diagnostics/trading212") {
    const diagnostics = await checkTrading212Reachability();
    sendJson(res, 200, diagnostics);
    return;
  }

  if (req.method === "PUT" && requestUrl.pathname === "/api/profile") {
    const body = await readJsonBody(req);
    const updated = updateProfile(user, body);
    sendJson(res, 200, { user: publicUser(updated), settings: buildSettings(updated) });
    return;
  }

  if (req.method === "PUT" && requestUrl.pathname === "/api/password") {
    const body = await readJsonBody(req);
    changePassword(user, body);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/connect") {
    const body = await readJsonBody(req);
    const environment = body.environment === "live" ? "live" : "demo";
    const apiKey = String(body.apiKey || "").trim();
    const apiSecret = String(body.apiSecret || "").trim();

    if (!apiKey || !apiSecret) {
      sendJson(res, 400, { error: "API key and API secret are both required." });
      return;
    }

    const credentials = { environment, apiKey, apiSecret };

    try {
      const [account, positions] = await Promise.all([
        trading212Fetch(credentials, "/equity/account/summary"),
        trading212Fetch(credentials, "/equity/positions"),
      ]);
      const syncedAt = new Date().toISOString();
      const payload = {
        mode: "api",
        syncedAt,
        account,
        positions: Array.isArray(positions) ? positions : [],
      };

      updateUser(user.id, (draft) => {
        draft.trading212 = {
          connectedAt: syncedAt,
          environment,
          credentials: encryptJson(credentials),
          lastError: null,
          latestSync: syncedAt,
          accountPreview: {
            currency: account.currency || null,
            totalValue: account.totalValue || null,
          },
        };
      });
      writeSnapshots(user.id, appendSnapshot(readSnapshots(user.id), payload));

      sendJson(res, 200, {
        connected: true,
        environment,
        positionCount: Array.isArray(positions) ? positions.length : 0,
        accountPreview: {
          currency: account.currency,
          totalValue: account.totalValue,
        },
      });
    } catch (error) {
      const readableError = readableTradingError(error);
      updateUser(user.id, (draft) => {
        draft.trading212 = {
          ...(draft.trading212 || {}),
          environment,
          lastError: readableError,
        };
      });
      sendJson(res, 502, { error: readableError });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/disconnect") {
    updateUser(user.id, (draft) => {
      draft.trading212 = {
        environment: "demo",
        credentials: null,
        connectedAt: null,
        latestSync: null,
        lastError: null,
        accountPreview: null,
      };
    });
    sendJson(res, 200, buildStatus(getUserById(user.id)));
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/dashboard") {
    const data = await getDashboardData(user);
    sendJson(res, 200, data);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/sync") {
    const data = await getDashboardData(user, { forceApi: true, saveSnapshot: true });
    sendJson(res, 200, data);
    return;
  }

  sendJson(res, 404, { error: "Unknown API route." });
}

function buildStatus(user) {
  const trading212 = user?.trading212 || {};
  return {
    authenticated: Boolean(user),
    user: user ? publicUser(user) : null,
    connected: Boolean(trading212.credentials),
    environment: trading212.environment || "demo",
    mode: trading212.credentials ? "api" : "mock",
    latestSync: trading212.latestSync || null,
    lastError: trading212.lastError || null,
  };
}

function buildSettings(user) {
  const trading212 = user.trading212 || {};
  return {
    user: publicUser(user),
    trading212: {
      connected: Boolean(trading212.credentials),
      environment: trading212.environment || "demo",
      connectedAt: trading212.connectedAt || null,
      latestSync: trading212.latestSync || null,
      lastError: trading212.lastError || null,
      accountPreview: trading212.accountPreview || null,
    },
  };
}

async function getDashboardData(user, options = {}) {
  const latestUser = getUserById(user.id) || user;
  const credentials = readUserCredentials(latestUser);
  const snapshots = readSnapshots(latestUser.id);

  if (!credentials?.apiKey) {
    const seeded = ensureMockHistory(snapshots);
    return buildDashboardResponse(mockSnapshot, seeded, "mock", latestUser);
  }

  try {
    const [account, positions] = await Promise.all([
      trading212Fetch(credentials, "/equity/account/summary"),
      trading212Fetch(credentials, "/equity/positions"),
    ]);

    const payload = {
      mode: "api",
      syncedAt: new Date().toISOString(),
      account,
      positions: Array.isArray(positions) ? positions : [],
    };

    updateUser(latestUser.id, (draft) => {
      draft.trading212 = {
        ...(draft.trading212 || {}),
        environment: credentials.environment,
        latestSync: payload.syncedAt,
        lastError: null,
        accountPreview: {
          currency: account.currency || null,
          totalValue: account.totalValue || null,
        },
      };
    });

    let nextSnapshots = snapshots;
    if (options.saveSnapshot) {
      nextSnapshots = appendSnapshot(snapshots, payload);
      writeSnapshots(latestUser.id, nextSnapshots);
    }

    return buildDashboardResponse(payload, nextSnapshots, "api", getUserById(latestUser.id));
  } catch (error) {
    const readableError = readableTradingError(error);
    updateUser(latestUser.id, (draft) => {
      draft.trading212 = {
        ...(draft.trading212 || {}),
        lastError: readableError,
      };
    });

    if (options.forceApi) {
      throw error;
    }

    const seeded = ensureMockHistory(snapshots);
    return {
      ...buildDashboardResponse(mockSnapshot, seeded, "mock", getUserById(latestUser.id)),
      warning: readableError,
    };
  }
}

function buildDashboardResponse(payload, snapshots, mode, user) {
  const positions = payload.positions.map(normalisePosition);
  const history = snapshots.length > 0 ? snapshots : [buildSnapshot(payload)];
  const currency = payload.account.currency || positions[0]?.currency || "EUR";
  const totalValue = numberOr(payload.account.totalValue, 0);
  const investedValue = numberOr(payload.account.investments?.currentValue, sum(positions, "currentValue"));
  const cashAvailable = numberOr(payload.account.cash?.availableToTrade, 0);
  const totalCost = numberOr(payload.account.investments?.totalCost, sum(positions, "totalCost"));
  const unrealizedProfitLoss = numberOr(
    payload.account.investments?.unrealizedProfitLoss,
    investedValue - totalCost
  );

  const allocation = positions
    .map((position) => ({
      label: position.shortName || position.name || position.ticker,
      ticker: position.ticker,
      type: position.type,
      value: position.currentValue,
      share: investedValue > 0 ? position.currentValue / investedValue : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const typeAllocation = Object.values(
    positions.reduce((groups, position) => {
      const type = position.type || "OTHER";
      groups[type] ||= { label: type, value: 0 };
      groups[type].value += position.currentValue;
      return groups;
    }, {})
  ).sort((a, b) => b.value - a.value);

  return {
    mode,
    environment: user?.trading212?.environment || "demo",
    user: user ? publicUser(user) : null,
    connected: Boolean(user?.trading212?.credentials),
    syncedAt: payload.syncedAt,
    account: {
      id: payload.account.id,
      currency,
      cashAvailable,
      cashInPies: numberOr(payload.account.cash?.inPies, 0),
      reservedForOrders: numberOr(payload.account.cash?.reservedForOrders, 0),
      investedValue,
      totalCost,
      totalValue,
      realizedProfitLoss: numberOr(payload.account.investments?.realizedProfitLoss, 0),
      unrealizedProfitLoss,
      unrealizedReturn: totalCost > 0 ? unrealizedProfitLoss / totalCost : 0,
    },
    positions,
    allocation,
    typeAllocation,
    insights: buildInsights({ positions, investedValue, totalValue, cashAvailable, unrealizedProfitLoss }),
    history: history.slice(-60),
  };
}

function buildInsights({ positions, investedValue, totalValue, cashAvailable, unrealizedProfitLoss }) {
  const insights = [];
  const top = [...positions].sort((a, b) => b.currentValue - a.currentValue)[0];
  const cashShare = totalValue > 0 ? cashAvailable / totalValue : 0;
  const positive = positions.filter((position) => position.unrealizedProfitLoss > 0).length;

  if (top && investedValue > 0) {
    insights.push({
      label: "Largest holding",
      value: `${top.shortName || top.name || top.ticker}`,
      detail: `${formatPercent(top.currentValue / investedValue)} of invested value`,
      tone: top.currentValue / investedValue > 0.35 ? "watch" : "neutral",
    });
  }

  insights.push({
    label: "Cash buffer",
    value: formatPercent(cashShare),
    detail: "Available cash as a share of total account value",
    tone: cashShare < 0.03 ? "watch" : "neutral",
  });

  insights.push({
    label: "Open positions",
    value: String(positions.length),
    detail: `${positive} currently positive by unrealized P/L`,
    tone: "neutral",
  });

  insights.push({
    label: "Unrealized P/L",
    value: formatCompact(unrealizedProfitLoss),
    detail: "Based on current position values",
    tone: unrealizedProfitLoss >= 0 ? "good" : "watch",
  });

  return insights;
}

function normalisePosition(position) {
  const instrument = position.instrument || {};
  const walletImpact = position.walletImpact || {};
  const currentValue = numberOr(walletImpact.currentValue, numberOr(position.currentPrice, 0) * numberOr(position.quantity, 0));
  const totalCost = numberOr(walletImpact.totalCost, numberOr(position.averagePricePaid, 0) * numberOr(position.quantity, 0));
  const unrealizedProfitLoss = numberOr(walletImpact.unrealizedProfitLoss, currentValue - totalCost);

  return {
    ticker: instrument.ticker || position.ticker || "UNKNOWN",
    name: instrument.name || position.name || "Unknown instrument",
    shortName: instrument.shortName || instrument.name || position.ticker || "Unknown",
    type: instrument.type || position.type || "OTHER",
    instrumentCurrency: instrument.currency || instrument.currencyCode || "N/A",
    currency: walletImpact.currency || instrument.currency || "EUR",
    quantity: numberOr(position.quantity, 0),
    quantityInPies: numberOr(position.quantityInPies, 0),
    averagePricePaid: numberOr(position.averagePricePaid, position.averagePrice || 0),
    currentPrice: numberOr(position.currentPrice, 0),
    currentValue,
    totalCost,
    fxImpact: numberOr(walletImpact.fxImpact, position.fxPpl || 0),
    unrealizedProfitLoss,
    unrealizedReturn: totalCost > 0 ? unrealizedProfitLoss / totalCost : 0,
    createdAt: position.createdAt || position.initialFillDate || null,
  };
}

async function trading212Fetch(credentials, apiPath) {
  const baseUrl = ENVIRONMENTS[credentials.environment] || ENVIRONMENTS.demo;
  const url = `${baseUrl}${apiPath}`;
  const headers = {
    Accept: "application/json",
  };

  const token = Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString("base64");
  headers.Authorization = `Basic ${token}`;

  const response = await fetch(url, { headers });
  const bodyText = await response.text();
  let body = null;

  if (bodyText) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = bodyText;
    }
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body?.message
        ? body.message
        : `Trading 212 returned ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

async function checkTrading212Reachability() {
  const endpoints = [
    ["demo", `${ENVIRONMENTS.demo}/equity/account/summary`],
    ["live", `${ENVIRONMENTS.live}/equity/account/summary`],
  ];

  const results = [];
  for (const [environment, url] of endpoints) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: "Basic invalid",
        },
      });
      results.push({
        environment,
        reachable: response.status === 401 || response.status === 403,
        status: response.status,
        message:
          response.status === 401 || response.status === 403
            ? "Trading 212 is reachable from this server."
            : `Trading 212 responded with HTTP ${response.status}.`,
      });
    } catch (error) {
      results.push({
        environment,
        reachable: false,
        status: null,
        message: readableTradingError(error),
      });
    }
  }

  return {
    ok: results.every((result) => result.reachable),
    results,
  };
}

function createUser(body) {
  const name = String(body.name || "").trim();
  const email = normaliseEmail(body.email);
  const password = String(body.password || "");

  if (name.length < 2) {
    const error = new Error("Name must be at least 2 characters.");
    error.status = 400;
    throw error;
  }
  if (!email.includes("@") || email.length < 5) {
    const error = new Error("Enter a valid email address.");
    error.status = 400;
    throw error;
  }
  if (password.length < 8) {
    const error = new Error("Password must be at least 8 characters.");
    error.status = 400;
    throw error;
  }

  const users = readUsers();
  if (users.some((user) => user.email === email)) {
    const error = new Error("An account with this email already exists.");
    error.status = 409;
    throw error;
  }

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    password: hashPassword(password),
    createdAt: new Date().toISOString(),
    trading212: {
      environment: "demo",
      credentials: null,
      connectedAt: null,
      latestSync: null,
      lastError: null,
      accountPreview: null,
    },
  };

  writeUsers([...users, user]);
  return user;
}

function authenticateUser(body) {
  const email = normaliseEmail(body.email);
  const password = String(body.password || "");
  const user = readUsers().find((candidate) => candidate.email === email);

  if (!user || !verifyPassword(password, user.password)) {
    const error = new Error("Email or password is incorrect.");
    error.status = 401;
    throw error;
  }

  return user;
}

function updateProfile(user, body) {
  const name = String(body.name || "").trim();
  const email = normaliseEmail(body.email);

  if (name.length < 2) {
    const error = new Error("Name must be at least 2 characters.");
    error.status = 400;
    throw error;
  }
  if (!email.includes("@") || email.length < 5) {
    const error = new Error("Enter a valid email address.");
    error.status = 400;
    throw error;
  }

  const users = readUsers();
  if (users.some((candidate) => candidate.id !== user.id && candidate.email === email)) {
    const error = new Error("Another account already uses this email.");
    error.status = 409;
    throw error;
  }

  return updateUser(user.id, (draft) => {
    draft.name = name;
    draft.email = email;
    draft.updatedAt = new Date().toISOString();
  });
}

function changePassword(user, body) {
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");

  if (!verifyPassword(currentPassword, user.password)) {
    const error = new Error("Current password is incorrect.");
    error.status = 401;
    throw error;
  }
  if (newPassword.length < 8) {
    const error = new Error("New password must be at least 8 characters.");
    error.status = 400;
    throw error;
  }

  updateUser(user.id, (draft) => {
    draft.password = hashPassword(newPassword);
    draft.updatedAt = new Date().toISOString();
  });
}

function getCurrentUser(req) {
  const sessionId = parseCookies(req.headers.cookie || "").session;
  if (!sessionId) return null;

  const session = sessions.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  return getUserById(session.userId);
}

function requireUser(req, res) {
  const user = getCurrentUser(req);
  if (!user) {
    sendJson(res, 401, { error: "Create an account or log in first." });
    return null;
  }
  return user;
}

function createSession(res, userId) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  sessions.set(sessionId, {
    userId,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
  });
  res.setHeader(
    "Set-Cookie",
    `session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}`
  );
}

function destroySession(req, res) {
  const sessionId = parseCookies(req.headers.cookie || "").session;
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.setHeader("Set-Cookie", "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function parseCookies(cookieHeader) {
  return cookieHeader.split(";").reduce((cookies, pair) => {
    const separator = pair.indexOf("=");
    if (separator === -1) return cookies;
    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function getUserById(id) {
  return readUsers().find((user) => user.id === id) || null;
}

function updateUser(id, updater) {
  const users = readUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) return null;

  const draft = structuredClone(users[index]);
  updater(draft);
  users[index] = draft;
  writeUsers(users);
  return draft;
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function normaliseEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 210_000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected) return false;

  const actual = hashPassword(password, salt).split(":")[1];
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function encryptJson(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", appKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
}

function decryptJson(payload) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", appKey, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

function readUserCredentials(user) {
  if (!user?.trading212?.credentials) return null;
  try {
    return decryptJson(user.trading212.credentials);
  } catch {
    return null;
  }
}

function getAppSecret() {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  if (fs.existsSync(APP_SECRET_FILE)) {
    return fs.readFileSync(APP_SECRET_FILE, "utf8").trim();
  }

  const secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(APP_SECRET_FILE, secret);
  return secret;
}

function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function snapshotFileForUser(userId) {
  const safeId = String(userId).replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(DATA_DIR, `snapshots-${safeId}.json`);
}

function readSnapshots(userId) {
  try {
    const snapshotFile = snapshotFileForUser(userId);
    if (!fs.existsSync(snapshotFile)) return [];
    const parsed = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSnapshots(userId, snapshots) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(snapshotFileForUser(userId), JSON.stringify(snapshots.slice(-365), null, 2));
}

function appendSnapshot(snapshots, payload) {
  const normalised = buildSnapshot(payload);
  const withoutSameMinute = snapshots.filter((snapshot) => {
    return snapshot.timestamp.slice(0, 16) !== normalised.timestamp.slice(0, 16);
  });

  return [...withoutSameMinute, normalised];
}

function buildSnapshot(payload) {
  const positions = payload.positions.map(normalisePosition);
  return {
    timestamp: payload.syncedAt,
    totalValue: numberOr(payload.account.totalValue, 0),
    investedValue: numberOr(payload.account.investments?.currentValue, sum(positions, "currentValue")),
    cashAvailable: numberOr(payload.account.cash?.availableToTrade, 0),
    unrealizedProfitLoss: numberOr(
      payload.account.investments?.unrealizedProfitLoss,
      sum(positions, "unrealizedProfitLoss")
    ),
  };
}

function ensureMockHistory(snapshots) {
  if (snapshots.length > 5) {
    return snapshots;
  }

  const today = new Date();
  const values = [19860, 20120, 19940, 20710, 21130, 20980, 21640.65];
  return values.map((value, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (values.length - index - 1) * 5);
    return {
      timestamp: date.toISOString(),
      totalValue: value,
      investedValue: value - 2380.45,
      cashAvailable: 2380.45,
      unrealizedProfitLoss: value - 19920,
    };
  });
}

async function serveStatic(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendText(res, 404, "Not found");
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, {
    "Content-Type": contentTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

function sendJson(res, status, data) {
  if (data?.error && status >= 400) {
    status = data.status || status;
  }
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end(text);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function readableTradingError(error) {
  const code = error.cause?.code || error.code || "";
  const message = String(error.message || "");

  if (message === "fetch failed" || code) {
    if (code === "EACCES") {
      return "This server process is blocked from reaching Trading 212. If you are using the Codex preview server, stop it and run the app with run-app.bat, then refresh the browser.";
    }
    return "Could not reach Trading 212 from this computer. Check internet, firewall, VPN, DNS, or Trading 212 IP restrictions, then try again.";
  }
  if (error.status === 401 || error.status === 403) {
    return "Trading 212 rejected the credentials or account access. Check the API key, secret, and selected environment.";
  }
  if (error.status === 429) {
    return "Trading 212 rate limit was reached. Wait a moment, then sync again.";
  }
  return error.message || "Trading 212 request failed.";
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sum(items, key) {
  return items.reduce((total, item) => total + numberOr(item[key], 0), 0);
}

function formatPercent(value) {
  return new Intl.NumberFormat("en", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCompact(value) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
