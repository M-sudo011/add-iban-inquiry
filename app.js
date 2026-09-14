(() => {
  "use strict";

  const DEFAULT_IBAN = "120560000000001234567890";

  const DEVICES = {
    reference: { label: "Reference Android", width: 360, height: 800 },
    "galaxy-s8": { label: "Galaxy S8+", width: 360, height: 740 },
    "galaxy-s20": { label: "Galaxy S20 Ultra", width: 412, height: 915 },
    "pixel-5": { label: "Pixel 5", width: 393, height: 851 },
    "pixel-7": { label: "Pixel 7", width: 412, height: 915 },
  };

  const SCREEN_LABELS = {
    entry: "IBAN entry",
    loading: "Inquiry in progress",
    success: "Inquiry result",
    failure: "Inquiry failed",
    manual: "Manual holder details",
    saved: "Saved account",
  };

  const state = {
    flow: "add",
    outcome: "success",
    delay: 3000,
    device: "reference",
    screen: "entry",
    iban: DEFAULT_IBAN,
    manualFirstName: "",
    manualLastName: "",
    savedAccount: null,
    validationError: false,
    pendingOutcome: null,
  };

  let inquiryTimer = null;

  const elements = {
    appRoot: document.querySelector("#appRoot"),
    device: document.querySelector("#device"),
    deviceWrap: document.querySelector("#deviceWrap"),
    launcher: document.querySelector("#controlLauncher"),
    panel: document.querySelector("#controlPanel"),
    close: document.querySelector("#controlClose"),
    devicePreset: document.querySelector("#devicePreset"),
    currentState: document.querySelector("#currentState"),
    reset: document.querySelector("#resetPrototype"),
    liveRegion: document.querySelector("#liveRegion"),
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeDigits(value) {
    const persian = "۰۱۲۳۴۵۶۷۸۹";
    const arabic = "٠١٢٣٤٥٦٧٨٩";
    return String(value)
      .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
      .replace(/^IR/i, "")
      .replace(/\D/g, "")
      .slice(0, 24);
  }

  function formatIban(digits) {
    if (!digits) return "";
    const first = digits.slice(0, 2);
    const rest = digits.slice(2).match(/.{1,4}/g) || [];
    return [first, ...rest].join(" ");
  }

  function maskedIban(digits) {
    const tail = digits.slice(-6);
    return `IR${digits.slice(0, 2)} •••• •••• •••• ${tail.slice(0, 4)} ${tail.slice(4)}`;
  }

  function isIbanReady() {
    return state.iban.length === 24;
  }

  function holderForSuccessfulInquiry() {
    if (state.flow === "edit") {
      return { firstName: "سارا", lastName: "اسکندری", bank: "بانک پارسیان" };
    }
    return { firstName: "میرمحمد", lastName: "اسکندری", bank: "بانک سامان" };
  }

  function statusBar() {
    const isLate = ["success", "failure", "manual", "saved"].includes(state.screen);
    return `
      <div class="status-bar" aria-hidden="true">
        <div class="status-cluster">
          <span>${isLate ? "18:25" : "10:54"}</span>
          <span class="status-symbol">●</span>
          <span class="status-symbol">◆</span>
          <span class="status-symbol">in</span>
        </div>
        <div class="status-cluster">
          <span class="status-symbol">⌁</span>
          <span class="status-symbol">◉</span>
          <span class="status-symbol">⌁</span>
          <span class="status-signal">▂▄▆█</span>
          <span>${isLate ? "75" : "88"}%</span>
          <span class="battery-icon"></span>
        </div>
      </div>`;
  }

  function appHeader(title) {
    return `
      <header class="app-header">
        <button class="app-header__arrow" type="button" data-action="back" aria-label="بازگشت">→</button>
        <strong>${escapeHtml(title)}</strong>
      </header>`;
  }

  function androidNav() {
    return `
      <div class="android-nav" aria-hidden="true">
        <span class="nav-recents">Ⅱ</span>
        <span class="nav-home"></span>
        <span class="nav-back"></span>
      </div>`;
  }

  function errorBanner(text) {
    return `
      <div class="error-banner" role="alert">
        <span class="error-banner__icon">!</span>
        <span>${escapeHtml(text)}</span>
      </div>`;
  }

  function ibanField({ label, readonly = false, disabled = false }) {
    return `
      <label class="field">
        <span class="field__label">${escapeHtml(label)}</span>
        <span class="input-shell iban-shell${readonly ? " input-shell--readonly" : ""}">
          <span class="iban-prefix" aria-hidden="true">IR |</span>
          <input
            class="iban-input"
            data-field="iban"
            inputmode="numeric"
            autocomplete="off"
            aria-label="شماره شبا"
            value="${escapeHtml(formatIban(state.iban))}"
            placeholder="00 0000 0000 0000 0000 0000 00"
            ${readonly ? "readonly" : ""}
            ${disabled ? "disabled" : ""}
          />
        </span>
      </label>`;
  }

  function textField({ label, field, value }) {
    return `
      <label class="field">
        <span class="field__label">${escapeHtml(label)}</span>
        <span class="input-shell">
          <input
            class="text-input"
            data-field="${escapeHtml(field)}"
            autocomplete="off"
            value="${escapeHtml(value)}"
          />
        </span>
      </label>`;
  }

  function primaryButton(label, action, { disabled = false, loading = false } = {}) {
    return `
      <button class="primary-button" type="button" data-action="${escapeHtml(action)}" ${disabled ? "disabled" : ""}>
        ${
          loading
            ? `<span class="loading-row"><span class="spinner" aria-hidden="true"></span><span>${escapeHtml(label)}</span></span>`
            : escapeHtml(label)
        }
      </button>`;
  }

  function secondaryButton(label, action) {
    return `<button class="secondary-button" type="button" data-action="${escapeHtml(action)}">${escapeHtml(label)}</button>`;
  }

  function currentAccountCard() {
    return `
      <section aria-label="حساب فعلی">
        <h2 class="section-label">حساب فعلی</h2>
        <div class="current-account">
          <p class="current-account__name">بانک سامان · میرمحمد اسکندری</p>
          <p class="current-account__iban">IR45 •••• •••• •••• 3321 08</p>
        </div>
      </section>`;
  }

  function entryContent({ loading = false } = {}) {
    if (state.flow === "edit") {
      return `
        ${currentAccountCard()}
        ${ibanField({ label: "شماره شبای جدید", readonly: loading, disabled: loading })}
        <p class="helper-text">حساب فعلی تا زمان ذخیره تغییرات حفظ می‌شود.</p>
        ${primaryButton(loading ? "در حال استعلام…" : "استعلام حساب جدید", "inquire", {
          disabled: loading || !isIbanReady(),
          loading,
        })}`;
    }

    return `
      ${ibanField({ label: "شماره شبا یا شماره‌ی اوزون کارت", readonly: loading, disabled: loading })}
      <p class="helper-text">حساب می‌تواند به نام خودتان یا شخص دیگری باشد.</p>
      ${primaryButton(loading ? "در حال استعلام…" : "استعلام حساب", "inquire", {
        disabled: loading || !isIbanReady(),
        loading,
      })}`;
  }

  function entryScreen({ loading = false } = {}) {
    const title = state.flow === "edit" ? "ویرایش شماره شبا" : "افزودن شماره شبا";
    const invalidBanner = state.validationError ? errorBanner("شماره شبا نامعتبر است") : "";
    return `
      ${invalidBanner || appHeader(title)}
      <main class="app-content${invalidBanner ? " app-content--under-toast" : ""}">
        <div class="form-stack">${entryContent({ loading })}</div>
      </main>`;
  }

  function successScreen() {
    const result = holderForSuccessfulInquiry();
    return `
      ${appHeader(state.flow === "edit" ? "تایید حساب جدید" : "تایید اطلاعات حساب")}
      <main class="app-content">
        ${ibanField({ label: "شماره شبا", readonly: true })}
        <section class="result-card" aria-label="اطلاعات استعلام‌شده حساب">
          <div class="result-row"><span>نام</span><strong>${result.firstName}</strong></div>
          <div class="result-row"><span>نام خانوادگی</span><strong>${result.lastName}</strong></div>
          <div class="result-row"><span>بانک</span><strong>${result.bank}</strong></div>
        </section>
        <p class="helper-text helper-text--compact">متفاوت بودن نام دارنده حساب با نام راننده مانع ثبت حساب نیست.</p>
        ${primaryButton(state.flow === "edit" ? "ذخیره تغییرات" : "تایید حساب", "save-success")}
        ${secondaryButton("ویرایش شماره شبا", "edit-iban")}
      </main>`;
  }

  function failureScreen() {
    return `
      ${errorBanner(state.flow === "edit" ? "استعلام حساب جدید انجام نشد" : "استعلام حساب انجام نشد")}
      <main class="app-content app-content--under-toast">
        ${ibanField({ label: "شماره شبا", readonly: true })}
        <p class="helper-text helper-text--compact">در حال حاضر امکان دریافت اطلاعات این حساب وجود ندارد.</p>
        <p class="helper-text helper-text--compact">این خطا به معنی نامعتبر بودن شماره شبا نیست.</p>
        ${state.flow === "edit" ? '<p class="helper-text">حساب فعلی تا زمان ذخیره تغییرات بدون تغییر می‌ماند.</p>' : ""}
        ${primaryButton("تلاش مجدد", "retry")}
        ${secondaryButton("ادامه بدون استعلام", "continue-manual")}
        <button class="text-action" type="button" data-action="edit-iban">ویرایش شماره شبا</button>
      </main>`;
  }

  function manualScreen() {
    return `
      ${appHeader(state.flow === "edit" ? "ویرایش شماره شبا" : "افزودن شماره شبا")}
      <main class="app-content">
        <div class="form-stack">
          ${textField({ label: "نام", field: "manualFirstName", value: state.manualFirstName })}
          ${textField({ label: "نام خانوادگی", field: "manualLastName", value: state.manualLastName })}
          ${ibanField({ label: "شماره شبا یا شماره‌ی اوزون کارت", readonly: true })}
          <p class="helper-text">
            ${
              state.flow === "edit"
                ? "اطلاعات حساب جدید توسط بانک بررسی نشده است. حساب فعلی پس از ذخیره جایگزین می‌شود."
                : "نام واردشده توسط بانک بررسی و تایید نمی‌شود."
            }
          </p>
          ${primaryButton(state.flow === "edit" ? "ذخیره تغییرات" : "تایید", "save-manual", {
            disabled: !state.manualFirstName.trim() || !state.manualLastName.trim(),
          })}
        </div>
      </main>`;
  }

  function savedScreen() {
    const account = state.savedAccount || holderForSuccessfulInquiry();
    const hasBank = Boolean(account.bank);
    return `
      ${appHeader("حساب‌های بانکی")}
      <main class="app-content">
        <article class="account-card">
          ${hasBank ? `<p class="account-card__bank">${escapeHtml(account.bank)}</p>` : ""}
          <p class="account-card__holder">${escapeHtml(`${account.firstName} ${account.lastName}`)}</p>
          <p class="account-card__iban">${escapeHtml(maskedIban(state.iban))}</p>
          <p class="account-card__footer">حساب پیش‌فرض تسویه</p>
        </article>
      </main>`;
  }

  function screenMarkup() {
    switch (state.screen) {
      case "loading":
        return entryScreen({ loading: true });
      case "success":
        return successScreen();
      case "failure":
        return failureScreen();
      case "manual":
        return manualScreen();
      case "saved":
        return savedScreen();
      case "entry":
      default:
        return entryScreen();
    }
  }

  function render() {
    elements.appRoot.innerHTML = `
      <section class="app-screen">
        ${statusBar()}
        ${screenMarkup()}
        ${androidNav()}
      </section>`;
    updateControls();
  }

  function updateControls() {
    document.querySelectorAll("[data-control]").forEach((button) => {
      const key = button.dataset.control;
      const value = key === "delay" ? Number(button.dataset.value) : button.dataset.value;
      button.setAttribute("aria-pressed", String(state[key] === value));
    });
    elements.devicePreset.value = state.device;
    elements.currentState.textContent = `${state.flow === "add" ? "Add" : "Edit"} · ${SCREEN_LABELS[state.screen]}`;
  }

  function announce(message) {
    elements.liveRegion.textContent = "";
    window.setTimeout(() => {
      elements.liveRegion.textContent = message;
    }, 20);
  }

  function cancelInquiry() {
    if (inquiryTimer !== null) {
      window.clearTimeout(inquiryTimer);
      inquiryTimer = null;
    }
    state.pendingOutcome = null;
  }

  function resetFlow() {
    cancelInquiry();
    state.screen = "entry";
    state.iban = DEFAULT_IBAN;
    state.manualFirstName = "";
    state.manualLastName = "";
    state.savedAccount = null;
    state.validationError = false;
    render();
  }

  function beginInquiry() {
    if (!isIbanReady()) {
      state.validationError = true;
      state.screen = "entry";
      render();
      announce("شماره شبا نامعتبر است");
      return;
    }

    cancelInquiry();
    state.validationError = false;
    state.pendingOutcome = state.outcome;
    state.screen = "loading";
    render();
    announce("استعلام حساب آغاز شد");

    const selectedOutcome = state.pendingOutcome;
    inquiryTimer = window.setTimeout(() => {
      inquiryTimer = null;
      state.pendingOutcome = null;
      state.screen = selectedOutcome === "success" ? "success" : "failure";
      render();
      announce(selectedOutcome === "success" ? "استعلام با موفقیت انجام شد" : "استعلام حساب انجام نشد");
    }, state.delay);
  }

  function saveSuccessfulInquiry() {
    state.savedAccount = holderForSuccessfulInquiry();
    state.screen = "saved";
    render();
    announce("حساب ذخیره شد");
  }

  function saveManualAccount() {
    if (!state.manualFirstName.trim() || !state.manualLastName.trim()) return;
    state.savedAccount = {
      firstName: state.manualFirstName.trim(),
      lastName: state.manualLastName.trim(),
      bank: null,
    };
    state.screen = "saved";
    render();
    announce("حساب ذخیره شد");
  }

  function handleAction(action) {
    switch (action) {
      case "inquire":
      case "retry":
        beginInquiry();
        break;
      case "edit-iban":
        cancelInquiry();
        state.screen = "entry";
        state.validationError = false;
        render();
        break;
      case "continue-manual":
        state.screen = "manual";
        state.manualFirstName = "";
        state.manualLastName = "";
        render();
        break;
      case "save-success":
        saveSuccessfulInquiry();
        break;
      case "save-manual":
        saveManualAccount();
        break;
      case "back":
        if (state.screen === "entry") return;
        if (state.screen === "saved") {
          resetFlow();
          return;
        }
        cancelInquiry();
        state.screen = state.screen === "manual" ? "failure" : "entry";
        render();
        break;
      default:
        break;
    }
  }

  function handleAppClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    handleAction(button.dataset.action);
  }

  function handleAppInput(event) {
    const field = event.target.dataset.field;
    if (!field) return;

    if (field === "iban") {
      state.iban = normalizeDigits(event.target.value);
      state.validationError = false;
      event.target.value = formatIban(state.iban);
      const button = elements.appRoot.querySelector('[data-action="inquire"]');
      if (button) button.disabled = !isIbanReady();
      return;
    }

    if (field === "manualFirstName" || field === "manualLastName") {
      state[field] = event.target.value;
      const button = elements.appRoot.querySelector('[data-action="save-manual"]');
      if (button) button.disabled = !state.manualFirstName.trim() || !state.manualLastName.trim();
    }
  }

  function setControl(key, rawValue) {
    const value = key === "delay" ? Number(rawValue) : rawValue;
    if (state[key] === value) return;
    state[key] = value;
    if (key === "flow") {
      resetFlow();
    } else {
      updateControls();
    }
  }

  function applyDevice() {
    const preset = DEVICES[state.device] || DEVICES.reference;
    document.documentElement.style.setProperty("--device-width", `${preset.width}px`);
    document.documentElement.style.setProperty("--device-height", `${preset.height}px`);

    const availableWidth = Math.max(280, window.innerWidth - 32);
    const availableHeight = Math.max(420, window.innerHeight - 32);
    const scale = Math.min(1, availableWidth / preset.width, availableHeight / preset.height);

    elements.device.style.transform = `scale(${scale})`;
    elements.deviceWrap.style.width = `${preset.width * scale}px`;
    elements.deviceWrap.style.height = `${preset.height * scale}px`;
    elements.device.setAttribute("aria-label", `${preset.label}, ${preset.width} by ${preset.height}`);
  }

  function openControls() {
    elements.panel.hidden = false;
    elements.launcher.setAttribute("aria-expanded", "true");
    elements.close.focus();
  }

  function closeControls({ restoreFocus = true } = {}) {
    elements.panel.hidden = true;
    elements.launcher.setAttribute("aria-expanded", "false");
    if (restoreFocus) elements.launcher.focus();
  }

  elements.appRoot.addEventListener("click", handleAppClick);
  elements.appRoot.addEventListener("input", handleAppInput);

  elements.launcher.addEventListener("click", () => {
    if (elements.panel.hidden) openControls();
    else closeControls();
  });
  elements.close.addEventListener("click", () => closeControls());

  elements.panel.addEventListener("click", (event) => {
    const control = event.target.closest("[data-control]");
    if (!control) return;
    setControl(control.dataset.control, control.dataset.value);
  });

  elements.devicePreset.addEventListener("change", (event) => {
    state.device = event.target.value;
    applyDevice();
    updateControls();
  });

  elements.reset.addEventListener("click", resetFlow);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.panel.hidden) closeControls();
  });

  window.addEventListener("resize", applyDevice);

  applyDevice();
  render();
})();
