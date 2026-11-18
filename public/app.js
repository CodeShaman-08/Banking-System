const app = document.querySelector("#app");
const topbarRight = document.querySelector("#topbar-right");
const toast = document.querySelector("#toast");
const SESSION_KEY = "commonplace.session";
const ACCOUNTS_KEY = "commonplace.accounts";

let activeMode = "login";
let toastTimer;

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function readAccounts() {
  try {
    const accounts = JSON.parse(sessionStorage.getItem(ACCOUNTS_KEY) || "[]");
    return Array.isArray(accounts) ? accounts : [];
  } catch {
    sessionStorage.removeItem(ACCOUNTS_KEY);
    return [];
  }
}

function escapeHtml(value = "") {
  const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(value).replace(/[&<>"']/g, (character) => entities[character]);
}

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(
    () => toast.classList.remove("is-visible"),
    3200,
  );
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.message || "Something went wrong. Please try again.");
  return body;
}

function setSession(payload) {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ token: payload.token, user: payload.user }),
  );
  sessionStorage.setItem(ACCOUNTS_KEY, "[]");
  render();
}

function authHeaders() {
  const session = readSession();
  return session?.token
    ? { Authorization: `Bearer ${session.token}` }
    : {};
}

function money(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function renderTopbar(session) {
  if (!session?.user) {
    topbarRight.innerHTML =
      '<span class="user-caption">A calmer way to get started</span>';
    return;
  }
  topbarRight.innerHTML = `
    <span class="user-caption">${escapeHtml(session.user.name || session.user.email)}</span>
    <button class="quiet-button" id="logout-button" type="button" aria-label="Sign out">Sign out</button>
  `;
  document
    .querySelector("#logout-button")
    .addEventListener("click", logout);
}

function renderAuth() {
  const isRegister = activeMode === "register";
  app.innerHTML = `
    <section class="auth-layout" aria-label="Account access">
      <div class="welcome-panel">
        <p class="eyebrow welcome-topline">Money, made more manageable</p>
        <div class="welcome-copy">
          <h1>Your accounts, in good order.</h1>
          <p>A clear place to begin. Create your account, then set up the accounts you need.</p>
        </div>
        <div class="ledger-art" aria-hidden="true">
          <div class="ledger-art-head"><span>A steadier view</span><span>01 / 01</span></div>
          <div class="ledger-bars"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
        </div>
        <span class="welcome-foot">A LITTLE MORE CLARITY, EVERY DAY</span>
      </div>
      <div class="auth-panel">
        <div class="auth-inner">
          <div class="auth-heading">
            <p class="eyebrow">WELCOME ${isRegister ? "ABOARD" : "BACK"}</p>
            <h2>${isRegister ? "Create your account" : "Sign in"}</h2>
            <p>${isRegister ? "Start with the essentials. You can build from there." : "Pick up right where you left off."}</p>
          </div>
          <div class="mode-tabs" role="tablist" aria-label="Authentication mode">
            <button class="mode-tab" type="button" role="tab" data-mode="login" aria-selected="${!isRegister}">Sign in</button>
            <button class="mode-tab" type="button" role="tab" data-mode="register" aria-selected="${isRegister}">Create account</button>
          </div>
          <form class="form-stack" id="auth-form" novalidate>
            ${
              isRegister
                ? `
              <div class="field">
                <label for="name">Your name</label>
                <input id="name" name="name" type="text" autocomplete="name" placeholder="e.g. Alex Morgan" required />
              </div>
              <div class="field">
                <label for="username">Username</label>
                <input id="username" name="username" type="text" autocomplete="username" placeholder="Choose a username" required />
              </div>
            `
                : ""
            }
            <div class="field">
              <label for="email">Email address</label>
              <input id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
            </div>
            <div class="field">
              <label for="password">Password</label>
              <input id="password" name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" placeholder="${isRegister ? "At least 6 characters" : "Enter your password"}" minlength="6" required />
            </div>
            <p class="form-message" id="form-message" role="alert"></p>
            <button class="primary-button form-submit" type="submit">
              <span>${isRegister ? "Create account" : "Sign in"}</span>
              <svg class="button-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
          </form>
          <p class="auth-note">Your sign-in details are used only to access your account.</p>
        </div>
      </div>
    </section>
  `;

  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeMode = tab.dataset.mode;
      renderAuth();
    });
  });
  document
    .querySelector("#auth-form")
    .addEventListener("submit", submitAuthForm);
}

async function submitAuthForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const credentials = Object.fromEntries(new FormData(form).entries());
  const message = document.querySelector("#form-message");
  const submit = form.querySelector("[type=submit]");
  message.textContent = "";
  if (!form.reportValidity()) return;

  submit.disabled = true;
  submit.querySelector("span").textContent =
    activeMode === "register" ? "Creating account..." : "Signing in...";
  try {
    let payload;
    if (activeMode === "register") {
      await requestJson("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      try {
        payload = await requestJson("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(credentials),
        });
      } catch {
        throw new Error(
          "Your account was created. Please sign in to continue.",
        );
      }
    } else {
      payload = await requestJson("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
    }
    setSession(payload);
    let accountLoadError;
    try {
      await refreshAccounts();
    } catch (error) {
      accountLoadError = error;
    }
    if (accountLoadError) {
      showToast(`Signed in, but accounts could not load: ${accountLoadError.message}`, true);
    } else {
      showToast(
        activeMode === "register"
          ? "Your account is ready."
          : `Welcome back, ${payload.user.name}.`,
      );
    }
  } catch (error) {
    message.textContent = error.message;
    submit.disabled = false;
    submit.querySelector("span").textContent =
      activeMode === "register" ? "Create account" : "Sign in";
  }
}

function renderAccount({ account, balance }) {
  const accountId = account._id || account.id || "Account";
  const date = account.createdAt
    ? new Date(account.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Just created";
  return `
    <article class="account-row">
      <span class="account-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 9.5h17M7 14h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
      <span class="account-info">
        <span class="account-name">${escapeHtml(account.currency || "INR")} account</span>
        <span class="account-balance">${money(balance, account.currency || "INR")}</span>
        <span class="account-meta" title="${escapeHtml(accountId)}">${escapeHtml(accountId)} · Created ${escapeHtml(date)}</span>
      </span>
      <span class="account-actions">
        <button class="copy-account" type="button" data-account-id="${escapeHtml(accountId)}">Use ID</button>
        <span class="account-status"><span class="status-dot"></span>${escapeHtml((account.status || "active").toLowerCase())}</span>
      </span>
    </article>
  `;
}

function renderDashboard(session) {
  const accountBalances = readAccounts();
  const accounts = accountBalances.map(({ account }) => account);
  const totalBalance = accountBalances.reduce(
    (total, item) => total + Number(item.balance || 0),
    0,
  );
  const firstName = (session.user.name || "").trim().split(/\s+/)[0] || "there";
  app.innerHTML = `
    <section class="dashboard">
      <div class="dashboard-head">
        <div>
          <p class="eyebrow">YOUR SPACE</p>
          <h1>Good to have you, ${escapeHtml(firstName)}.</h1>
          <p>Your accounts, gathered in one place.</p>
        </div>
        <button class="primary-button create-button" id="create-account-button" type="button">
          <svg class="button-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
          Create account
        </button>
      </div>
      <div class="account-summary">
        <span class="summary-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 19V9m5 10V5m5 14v-7m5 7V3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
        <span class="summary-copy"><strong>${money(totalBalance)}</strong><span>Total balance across ${accounts.length} account${accounts.length === 1 ? "" : "s"}</span></span>
      </div>
      <div class="section-label"><h2>Your accounts</h2><span>${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}</span></div>
      <div class="accounts-list" id="accounts-list">
        ${
          accountBalances.length
            ? accountBalances.map(renderAccount).join("")
            : `
          <div class="empty-state">
            <span class="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 9.5h17M7 14h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
            <h3>A good place to begin</h3>
            <p>Create your first account to see it here.</p>
          </div>
        `
        }
      </div>
        <section class="transfer-panel" aria-labelledby="transfer-title">
          <div class="transfer-heading">
            <p class="eyebrow">MOVE MONEY</p>
            <h2 id="transfer-title">Send a little further.</h2>
            <p>Securely transfer funds to another account.</p>
          </div>
          <form class="transfer-form" id="transfer-form">
            <div class="field">
              <label for="from-account">From account</label>
              <select id="from-account" name="fromAccount" required ${accounts.length ? "" : "disabled"}>
                ${
                  accounts.length
                    ? accounts.map((account, index) => `<option value="${escapeHtml(account._id)}">${escapeHtml(account.currency || "INR")} account ${index + 1} · ${escapeHtml(account._id.slice(-6))}</option>`).join("")
                    : '<option value="">Create an account first</option>'
                }
              </select>
            </div>
            <div class="field">
              <label for="to-account">Recipient account ID</label>
              <input id="to-account" name="toAccount" type="text" placeholder="Paste their account ID" required ${accounts.length ? "" : "disabled"} />
            </div>
            <div class="field">
              <label for="transfer-amount">Amount (INR)</label>
              <input id="transfer-amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required ${accounts.length ? "" : "disabled"} />
            </div>
            <p class="form-message" id="transfer-message" role="alert"></p>
            <button class="primary-button transfer-submit" type="submit" ${accounts.length ? "" : "disabled"}>
              <span>Send securely</span>
              <svg class="button-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
          </form>
        </section>
    </section>
  `;
  document
    .querySelector("#create-account-button")
    .addEventListener("click", createAccount);
  document
    .querySelector("#transfer-form")
    .addEventListener("submit", submitTransfer);
  document
    .querySelector("#accounts-list")
    .addEventListener("click", useAccountId);
}

async function refreshAccounts() {
  const { accounts } = await requestJson("/api/accounts", {
    headers: authHeaders(),
  });
  const accountBalances = await Promise.all(
    accounts.map(async (account) => {
      const { balance } = await requestJson(
        `/api/accounts/balance/${encodeURIComponent(account._id)}`,
        { headers: authHeaders() },
      );
      return { account, balance };
    }),
  );
  sessionStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accountBalances));
  const session = readSession();
  if (session?.token) renderDashboard(session);
}

async function useAccountId(event) {
  const button = event.target.closest("[data-account-id]");
  if (!button) return;
  const recipient = document.querySelector("#to-account");
  if (!recipient) return;
  recipient.value = button.dataset.accountId;
  try {
    await navigator.clipboard.writeText(button.dataset.accountId);
    showToast("Account ID copied and added as recipient.");
  } catch {
    showToast("Account ID added as recipient.");
  }
  recipient.focus();
}

async function submitTransfer(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form).entries());
  values.amount = Number(values.amount);
  values.idempotencyKey =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const message = document.querySelector("#transfer-message");
  const submit = form.querySelector("[type=submit]");
  message.textContent = "";
  submit.disabled = true;
  submit.querySelector("span").textContent = "Sending...";
  try {
    await requestJson("/api/transaction", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(values),
    });
    form.reset();
    await refreshAccounts();
    showToast("Transfer complete. Your balances are up to date.");
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.querySelector("span").textContent = "Send securely";
  }
}

async function createAccount(event) {
  const button = event.currentTarget;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    const payload = await requestJson("/api/accounts", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    await refreshAccounts();
    showToast("Account created.");
  } catch (error) {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    showToast(error.message, true);
  }
}

async function logout() {
  try {
    await requestJson("/api/auth/logout", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
  } catch (error) {
    showToast(error.message, true);
    return;
  }
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(ACCOUNTS_KEY);
  activeMode = "login";
  render();
}

function render() {
  const session = readSession();
  renderTopbar(session);
  if (session?.token && session?.user) renderDashboard(session);
  else renderAuth();
}

render();

if (readSession()?.token) {
  refreshAccounts().catch((error) => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(ACCOUNTS_KEY);
    render();
    showToast(error.message, true);
  });
}
