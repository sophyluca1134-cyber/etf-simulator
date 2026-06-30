const STORAGE_KEY = "covered-call-etf-simulator-v2";

const text = {
  saved: "保存済み",
  saving: "保存中",
  empty: "保有口数を入力すると、ここに分配金の見込みが表示されます。",
  yearAverage: "今年平均",
  inputDistribution: "入力値",
  currentYearDistributions: "今年の分配金",
  noCurrentYearDistributions: "今年の分配データなし",
  newEtf: "新しいETF",
  fxWaiting: "自動取得待ち",
  fxLoading: "取得中...",
  fxUpdated: "更新済み",
  fxFailed: "取得失敗。手入力で調整できます。",
  marketWaiting: "自動取得待ち",
  marketLoading: "取得中...",
  marketUpdated: "市場データ更新済み",
  marketPartial: "一部の銘柄は手入力値を維持しました",
  marketFailed: "取得できませんでした。手入力値を維持します。",
  marketSource: "取得",
};

const defaultFunds = [
  { ticker: "452A", name: "iShares S&P 500 Premium Income ETF", price: 1000, distribution: 0, yearDistributions: [], frequency: 12, currency: "JPY", marketSymbol: "452A.T" },
  { ticker: "453A", name: "iShares 20+ Year US Treasury Bond Premium Income ETF", price: 1000, distribution: 0, yearDistributions: [], frequency: 12, currency: "JPY", marketSymbol: "453A.T" },
  { ticker: "563A", name: "Global X Nasdaq 100 Daily Covered Call ETF", price: 1000, distribution: 0, yearDistributions: [], frequency: 12, currency: "JPY", marketSymbol: "563A.T" },
  { ticker: "IGDL", name: "IGDL", price: 50, distribution: 0, yearDistributions: [], frequency: 12, currency: "USD", marketSymbol: "IGDL" },
];

const TAX_RATES = {
  jpDistribution: 0.20315,
  doubleTaxAdjusted: 0.12,
  usWithholding: 0.1,
};

let state = loadState();

const elements = {
  monthlyIncome: document.querySelector("#monthlyIncome"),
  annualIncome: document.querySelector("#annualIncome"),
  marketValue: document.querySelector("#marketValue"),
  yieldOnCost: document.querySelector("#yieldOnCost"),
  tickerSelect: document.querySelector("#tickerSelect"),
  holdingsBody: document.querySelector("#holdingsBody"),
  fundGrid: document.querySelector("#fundGrid"),
  fundDataStatus: document.querySelector("#fundDataStatus"),
  holdingForm: document.querySelector("#holdingForm"),
  fxInput: document.querySelector("#fxInput"),
  fxStatus: document.querySelector("#fxStatus"),
  refreshFxButton: document.querySelector("#refreshFxButton"),
  unitsInput: document.querySelector("#unitsInput"),
  costInput: document.querySelector("#costInput"),
  noteInput: document.querySelector("#noteInput"),
  savedStatus: document.querySelector("#savedStatus"),
  addFundButton: document.querySelector("#addFundButton"),
  refreshFundsButton: document.querySelector("#refreshFundsButton"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  resetButton: document.querySelector("#resetButton"),
  fundCardTemplate: document.querySelector("#fundCardTemplate"),
};

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return createDefaultState();
  }

  try {
    const parsed = JSON.parse(stored);
    return {
      funds: mergeDefaultFunds(normalizeFunds(Array.isArray(parsed.funds) && parsed.funds.length ? parsed.funds : defaultFunds)),
      holdings: Array.isArray(parsed.holdings) ? parsed.holdings : [],
      fxRate: Number(parsed.fxRate || 160),
      fxUpdatedAt: parsed.fxUpdatedAt || "",
    };
  } catch {
    return createDefaultState();
  }
}

function createDefaultState() {
  return { funds: structuredClone(defaultFunds), holdings: [], fxRate: 160, fxUpdatedAt: "" };
}

function mergeDefaultFunds(funds) {
  const existingTickers = new Set(funds.map((fund) => String(fund.ticker || "").trim().toUpperCase()));
  const missingDefaults = defaultFunds.filter((fund) => !existingTickers.has(fund.ticker));
  return [...funds, ...structuredClone(missingDefaults)];
}

function normalizeFunds(funds) {
  return funds.map((fund) => {
    const ticker = String(fund.ticker || "").trim().toUpperCase();
    return {
      ...fund,
      ticker,
      frequency: Number(fund.frequency || 12),
      marketSymbol: fund.marketSymbol || defaultMarketSymbol(ticker),
      yearDistributions: normalizeYearDistributions(fund.yearDistributions),
    };
  });
}

function normalizeYearDistributions(distributions) {
  if (!Array.isArray(distributions)) {
    return [];
  }

  return distributions
    .map((item) => ({
      date: String(item.date || ""),
      amount: Number(item.amount || 0),
    }))
    .filter((item) => item.date && Number.isFinite(item.amount) && item.amount > 0);
}

function defaultMarketSymbol(ticker) {
  if (/^\d+[A-Z]$/.test(ticker)) {
    return `${ticker}.T`;
  }
  return ticker;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  elements.savedStatus.textContent = text.saved;
}

function markDirty() {
  elements.savedStatus.textContent = text.saving;
  window.clearTimeout(markDirty.timer);
  markDirty.timer = window.setTimeout(() => {
    saveState();
    renderTickerOptions();
    renderHoldings();
  }, 180);
}

function yen(value) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function money(value, currency) {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "ja-JP", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function displayMoney(value, fund) {
  const currency = fund.currency;
  const digits = usesOneDecimalDisplay(fund) ? 1 : currency === "USD" ? 2 : 0;
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "ja-JP", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function distributionMoney(value, currency) {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "ja-JP", {
    style: "currency",
    currency,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

function percent(value) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(2)}%`;
}

function inputNumber(value, digits) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) {
    return "";
  }
  return digits > 0 ? number.toFixed(digits) : String(number);
}

function holdingMoney(value, currency, jpyValue) {
  const main = money(value, currency);
  if (currency !== "USD") {
    return main;
  }

  return `${main}<br><span class="jpy-subvalue">(${yen(jpyValue)})</span>`;
}

function holdingIncomeMoney(netValue, currency, netJpyValue, grossValue, grossJpyValue) {
  const main = holdingMoney(netValue, currency, netJpyValue);
  const gross = currency === "USD" ? `${money(grossValue, currency)} / ${yen(grossJpyValue)}` : money(grossValue, currency);
  return `${main}<br><span class="tax-subvalue">税前 ${gross}</span>`;
}

function holdingYield(netValue, grossValue) {
  return `${percent(netValue)}<br><span class="tax-subvalue">税前 ${percent(grossValue)}</span>`;
}

function getFund(ticker) {
  return state.funds.find((fund) => fund.ticker === ticker);
}

function annualDistributionPerUnit(fund) {
  return effectiveDistributionPerUnit(fund) * Number(fund.frequency || 0);
}

function annualDistributionAfterTaxPerUnit(fund) {
  return annualDistributionPerUnit(fund) * taxKeepRate(fund);
}

function effectiveDistributionPerUnit(fund) {
  return currentYearDistributionAverage(fund) || Number(fund.distribution || 0);
}

function currentYearDistributionAverage(fund) {
  const distributions = currentYearDistributions(fund);
  if (!distributions.length) {
    return 0;
  }

  const total = distributions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return total / distributions.length;
}

function currentYearDistributions(fund) {
  const currentYear = new Date().getFullYear();
  return normalizeYearDistributions(fund.yearDistributions).filter((item) => Number(item.date.slice(0, 4)) === currentYear);
}

function distributionYield(fund) {
  const price = Number(fund.price || 0);
  return price > 0 ? (annualDistributionPerUnit(fund) / price) * 100 : 0;
}

function distributionYieldAfterTax(fund) {
  const price = Number(fund.price || 0);
  return price > 0 ? (annualDistributionAfterTaxPerUnit(fund) / price) * 100 : 0;
}

function taxKeepRate(fund) {
  if (isUsUnadjustedFund(fund)) {
    return (1 - TAX_RATES.usWithholding) * (1 - TAX_RATES.jpDistribution);
  }

  return 1 - TAX_RATES.doubleTaxAdjusted;
}

function taxTreatmentLabel(fund) {
  return isUsUnadjustedFund(fund) ? "米国10%+国内20.315%" : "二重課税調整後・概算12%";
}

function isUsUnadjustedFund(fund) {
  const ticker = String(fund.ticker || "").trim().toUpperCase();
  const symbol = String(fund.marketSymbol || "").trim().toUpperCase();
  return ticker === "IGDL" || ticker === "IGLD" || symbol === "IGDL" || symbol === "IGLD";
}

function usesOneDecimalDisplay(fund) {
  const ticker = String(fund.ticker || "").trim().toUpperCase();
  const symbol = String(fund.marketSymbol || "").trim().toUpperCase();
  return ticker === "452A" || ticker === "453A" || symbol === "452A.T" || symbol === "453A.T";
}

function calculateHolding(holding) {
  const fund = getFund(holding.ticker);
  if (!fund) {
    return null;
  }

  const units = Number(holding.units || 0);
  const cost = Number(holding.cost || 0);
  const marketValue = units * Number(fund.price || 0);
  const grossAnnualIncome = units * annualDistributionPerUnit(fund);
  const annualIncome = grossAnnualIncome * taxKeepRate(fund);
  const grossMonthlyIncome = grossAnnualIncome / 12;
  const monthlyIncome = annualIncome / 12;
  const bookValue = units * cost;
  const conversion = fund.currency === "USD" ? Number(state.fxRate || 0) : 1;
  const grossYieldOnCost = bookValue > 0 ? (grossAnnualIncome / bookValue) * 100 : distributionYield(fund);

  return {
    fund,
    units,
    note: holding.note || "",
    marketValue,
    marketValueJpy: marketValue * conversion,
    annualIncome,
    annualIncomeJpy: annualIncome * conversion,
    grossAnnualIncome,
    grossAnnualIncomeJpy: grossAnnualIncome * conversion,
    monthlyIncome,
    monthlyIncomeJpy: monthlyIncome * conversion,
    grossMonthlyIncome,
    grossMonthlyIncomeJpy: grossMonthlyIncome * conversion,
    bookValue,
    bookValueJpy: bookValue * conversion,
    yieldOnCost: bookValue > 0 ? (annualIncome / bookValue) * 100 : distributionYieldAfterTax(fund),
    grossYieldOnCost,
  };
}

function render() {
  elements.fxInput.value = state.fxRate;
  renderFxStatus();
  renderFundDataStatus();
  renderTickerOptions();
  renderHoldings();
  renderFunds();
  saveState();
}

function renderFundDataStatus(message) {
  elements.fundDataStatus.textContent = message || text.marketWaiting;
}

function renderFxStatus(message) {
  if (message) {
    elements.fxStatus.textContent = message;
    return;
  }

  if (!state.fxUpdatedAt) {
    elements.fxStatus.textContent = text.fxWaiting;
    return;
  }

  const updatedAt = new Date(state.fxUpdatedAt);
  const formatted = new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(updatedAt);
  elements.fxStatus.textContent = `${text.fxUpdated} ${formatted}`;
}

function renderTickerOptions() {
  const selected = elements.tickerSelect.value;
  elements.tickerSelect.innerHTML = state.funds
    .map((fund) => `<option value="${escapeHtml(fund.ticker)}">${escapeHtml(fund.ticker)} ${escapeHtml(fund.name)}</option>`)
    .join("");

  if (selected && getFund(selected)) {
    elements.tickerSelect.value = selected;
  }
}

function renderHoldings() {
  const rows = state.holdings.map(calculateHolding).filter(Boolean);
  const totals = rows.reduce(
    (sum, row) => {
      sum.monthlyIncome += row.monthlyIncomeJpy;
      sum.annualIncome += row.annualIncomeJpy;
      sum.marketValue += row.marketValueJpy;
      sum.bookValue += row.bookValueJpy;
      return sum;
    },
    { monthlyIncome: 0, annualIncome: 0, marketValue: 0, bookValue: 0 },
  );

  elements.monthlyIncome.textContent = yen(totals.monthlyIncome);
  elements.annualIncome.textContent = yen(totals.annualIncome);
  elements.marketValue.textContent = yen(totals.marketValue);
  elements.yieldOnCost.textContent = percent(totals.bookValue > 0 ? (totals.annualIncome / totals.bookValue) * 100 : 0);

  if (!rows.length) {
    elements.holdingsBody.innerHTML = `<tr class="empty-row"><td colspan="7">${text.empty}</td></tr>`;
    return;
  }

  elements.holdingsBody.innerHTML = rows
    .map((row) => {
      const note = row.note ? ` <span class="note">${escapeHtml(row.note)}</span>` : "";
      return `
        <tr>
          <td><strong>${escapeHtml(row.fund.ticker)}</strong>${note}<br><small>${escapeHtml(row.fund.name)}</small></td>
          <td>${row.units.toLocaleString("ja-JP")}</td>
          <td>${holdingMoney(row.marketValue, row.fund.currency, row.marketValueJpy)}</td>
          <td>${holdingIncomeMoney(row.monthlyIncome, row.fund.currency, row.monthlyIncomeJpy, row.grossMonthlyIncome, row.grossMonthlyIncomeJpy)}</td>
          <td>${holdingIncomeMoney(row.annualIncome, row.fund.currency, row.annualIncomeJpy, row.grossAnnualIncome, row.grossAnnualIncomeJpy)}</td>
          <td>${holdingYield(row.yieldOnCost, row.grossYieldOnCost)}</td>
          <td><button class="delete-row icon-button" type="button" data-ticker="${escapeHtml(row.fund.ticker)}" title="delete" aria-label="delete">&times;</button></td>
        </tr>
      `;
    })
    .join("");
}

function renderFunds() {
  elements.fundGrid.innerHTML = "";
  state.funds.forEach((fund, index) => {
    const node = elements.fundCardTemplate.content.cloneNode(true);
    const card = node.querySelector(".fund-card");
    const tickerInput = node.querySelector(".ticker-input");
    const nameInput = node.querySelector(".name-input");
    const priceInput = node.querySelector(".price-input");
    const distributionInput = node.querySelector(".distribution-input");
    const currencyInput = node.querySelector(".currency-input");

    card.dataset.index = index;
    tickerInput.value = fund.ticker;
    nameInput.value = fund.name;
    priceInput.value = inputNumber(fund.price, usesOneDecimalDisplay(fund) ? 1 : 2);
    distributionInput.value = inputNumber(fund.distribution, usesOneDecimalDisplay(fund) ? 1 : 4);
    currencyInput.value = fund.currency;
    updateFundCardStats(card, fund);
    renderYearDistributions(card, fund);

    elements.fundGrid.appendChild(node);
  });
}

function updateFundCardStats(card, fund) {
  const stats = card.querySelector(".fund-stats");
  const source = fund.marketSymbol ? ` / ${text.marketSource} ${fund.marketSymbol}` : "";
  const updatedAt = fund.marketUpdatedAt ? ` / 価格時刻 ${formatMarketDateTime(fund.marketUpdatedAt)}` : "";
  const distributionLabel = currentYearDistributions(fund).length ? text.yearAverage : text.inputDistribution;
  const latest = Number(fund.distribution || 0);
  const latestText = latest > 0 ? ` / 直近 ${displayMoney(latest, fund)}` : "";
  stats.textContent = `${distributionLabel} ${displayMoney(effectiveDistributionPerUnit(fund), fund)}${latestText} / 税後年間 ${displayMoney(annualDistributionAfterTaxPerUnit(fund), fund)} / 税後利回り ${percent(distributionYieldAfterTax(fund))} / ${taxTreatmentLabel(fund)}${source}${updatedAt}`;
}

function renderYearDistributions(card, fund) {
  const container = card.querySelector(".yearly-distributions");
  const distributions = currentYearDistributions(fund);
  if (!distributions.length) {
    container.innerHTML = `<span class="distribution-empty">${text.noCurrentYearDistributions}</span>`;
    return;
  }

  const average = currentYearDistributionAverage(fund);
  container.innerHTML = `
    <label class="distribution-history-label">
      ${text.currentYearDistributions}
      <select class="distribution-history-select" aria-label="${text.currentYearDistributions}">
        <option>${text.yearAverage}: ${distributionMoney(average, fund.currency)} (${distributions.length})</option>
        ${distributions
          .map((item) => `<option>${escapeHtml(formatDistributionDate(item.date))} ${distributionMoney(item.amount, fund.currency)}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

function formatDistributionDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", { month: "2-digit", day: "2-digit" }).format(date);
}

function formatMarketDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function upsertHolding(event) {
  event.preventDefault();
  const ticker = elements.tickerSelect.value;
  const units = Number(elements.unitsInput.value || 0);
  const cost = Number(elements.costInput.value || 0);
  const note = elements.noteInput.value.trim();

  if (!ticker || units < 0) {
    return;
  }

  const existing = state.holdings.find((holding) => holding.ticker === ticker);
  if (existing) {
    existing.units = units;
    existing.cost = cost;
    existing.note = note;
  } else {
    state.holdings.push({ ticker, units, cost, note });
  }

  elements.unitsInput.value = "";
  elements.costInput.value = "";
  elements.noteInput.value = "";
  render();
}

function updateFxRate() {
  state.fxRate = Number(elements.fxInput.value || 0);
  state.fxUpdatedAt = "";
  renderFxStatus();
  renderHoldings();
  markDirty();
}

async function refreshFxRate() {
  elements.refreshFxButton.disabled = true;
  renderFxStatus(text.fxLoading);

  try {
    const { rate, source } = await fetchUsdJpyRate();
    state.fxRate = Number(rate.toFixed(2));
    state.fxUpdatedAt = new Date().toISOString();
    elements.fxInput.value = state.fxRate;
    renderFxStatus(`${text.fxUpdated} ${source}`);
    renderHoldings();
    saveState();
  } catch {
    renderFxStatus(text.fxFailed);
  } finally {
    elements.refreshFxButton.disabled = false;
  }
}

async function fetchUsdJpyRate() {
  const response = await fetch("/api/usd-jpy", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("USD/JPY rate unavailable");
  }

  const data = await response.json();
  const rate = Number(data?.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("USD/JPY rate unavailable");
  }

  return { rate, source: data?.source || "server" };
}

function updateFundFromInput(input) {
  const card = input.closest(".fund-card");
  const index = Number(card.dataset.index);
  const fund = state.funds[index];
  if (!fund) {
    return;
  }

  const previousTicker = fund.ticker;
  fund.ticker = card.querySelector(".ticker-input").value.trim().toUpperCase() || previousTicker;
  fund.name = card.querySelector(".name-input").value.trim() || fund.ticker;
  fund.price = Number(card.querySelector(".price-input").value || 0);
  fund.distribution = Number(card.querySelector(".distribution-input").value || 0);
  fund.frequency = Number(fund.frequency || 12);
  fund.currency = card.querySelector(".currency-input").value;
  fund.marketSymbol = fund.marketSymbol || defaultMarketSymbol(fund.ticker);

  if (input.classList.contains("distribution-input") || previousTicker !== fund.ticker) {
    fund.yearDistributions = [];
  }

  if (previousTicker !== fund.ticker) {
    state.holdings.forEach((holding) => {
      if (holding.ticker === previousTicker) {
        holding.ticker = fund.ticker;
      }
    });
  }

  updateFundCardStats(card, fund);
  renderYearDistributions(card, fund);
  renderTickerOptions();
  renderHoldings();
  markDirty();
}

function deleteHolding(ticker) {
  state.holdings = state.holdings.filter((holding) => holding.ticker !== ticker);
  render();
}

function addFund() {
  const nextNumber = state.funds.length + 1;
  state.funds.push({ ticker: `NEW${nextNumber}`, name: text.newEtf, price: 0, distribution: 0, yearDistributions: [], frequency: 12, currency: "JPY", marketSymbol: `NEW${nextNumber}` });
  render();
}

async function refreshFundMarketData() {
  elements.refreshFundsButton.disabled = true;
  renderFundDataStatus(text.marketLoading);

  const results = await Promise.allSettled(state.funds.map(refreshSingleFund));
  const updated = results.filter((result) => result.status === "fulfilled" && result.value.updated).length;
  const failed = results.length - updated;

  renderFunds();
  renderTickerOptions();
  renderHoldings();
  saveState();

  if (updated && failed) {
    renderFundDataStatus(`${text.marketUpdated}: ${updated} / ${results.length}. ${text.marketPartial}`);
  } else if (updated) {
    renderFundDataStatus(`${text.marketUpdated}: ${updated} / ${results.length}`);
  } else {
    renderFundDataStatus(text.marketFailed);
  }

  elements.refreshFundsButton.disabled = false;
}

async function refreshSingleFund(fund) {
  const candidates = marketSymbolCandidates(fund);

  for (const symbol of candidates) {
    const marketData = await fetchYahooChart(symbol);
    if (!marketData) {
      continue;
    }

    fund.marketSymbol = symbol;
    if (marketData.name) {
      fund.name = marketData.name;
    }
    if (Number.isFinite(marketData.price) && marketData.price > 0) {
      fund.price = roundValue(marketData.price, usesOneDecimalDisplay(fund) ? 1 : marketData.currency === "JPY" ? 0 : 2);
    }
    if (Number.isFinite(marketData.distribution) && marketData.distribution > 0) {
      fund.distribution = roundValue(marketData.distribution, usesOneDecimalDisplay(fund) ? 1 : marketData.currency === "JPY" ? 2 : 4);
    }
    if (marketData.yearDistributions.length) {
      fund.yearDistributions = marketData.yearDistributions;
    }
    if (marketData.currency === "JPY" || marketData.currency === "USD") {
      fund.currency = marketData.currency;
    }
    if (marketData.marketUpdatedAt) {
      fund.marketUpdatedAt = marketData.marketUpdatedAt;
    }
    fund.frequency = Number(fund.frequency || 12);
    return { updated: true };
  }

  return { updated: false };
}

function marketSymbolCandidates(fund) {
  const ticker = String(fund.ticker || "").trim().toUpperCase();
  const candidates = [fund.marketSymbol, defaultMarketSymbol(ticker), ticker];
  if (ticker === "IGDL") {
    candidates.push("IGLD");
  }
  return [...new Set(candidates.filter(Boolean))];
}

async function fetchYahooChart(symbol) {
  try {
    const url = `/api/yahoo-chart?symbol=${encodeURIComponent(symbol)}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return null;
    }

    const dividends = Object.values(result.events?.dividends || {}).sort((a, b) => Number(b.date || 0) - Number(a.date || 0));
    const yearDistributions = dividends
      .map((item) => ({ date: formatYahooDate(item.date), amount: Number(item.amount || 0) }))
      .filter((item) => item.date && Number.isFinite(item.amount) && item.amount > 0);
    return {
      currency: result.meta?.currency,
      name: result.meta?.longName || result.meta?.shortName || "",
      price: Number(result.meta?.regularMarketPrice),
      distribution: Number(dividends[0]?.amount || 0),
      yearDistributions,
      marketUpdatedAt: formatYahooDateTime(result.meta?.regularMarketTime),
    };
  } catch {
    return null;
  }
}

function formatYahooDateTime(timestamp) {
  const date = new Date(Number(timestamp || 0) * 1000);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

function formatYahooDate(timestamp) {
  const date = new Date(Number(timestamp || 0) * 1000);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function roundValue(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function deleteFund(index) {
  const fund = state.funds[index];
  if (!fund) {
    return;
  }
  state.funds.splice(index, 1);
  state.holdings = state.holdings.filter((holding) => holding.ticker !== fund.ticker);
  render();
}

function exportCsv() {
  const header = ["ticker", "name", "price", "distribution", "frequency", "currency", "units", "cost", "note", "fxRate", "marketSymbol", "yearDistributions"];
  const rows = state.funds.map((fund) => {
    const holding = state.holdings.find((item) => item.ticker === fund.ticker) || {};
    return [
      fund.ticker,
      fund.name,
      fund.price,
      fund.distribution,
      fund.frequency,
      fund.currency,
      holding.units || 0,
      holding.cost || 0,
      holding.note || "",
      state.fxRate,
      fund.marketSymbol || "",
      JSON.stringify(fund.yearDistributions || []),
    ].map(csvCell).join(",");
  });

  const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "covered-call-etf-simulator.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function importCsv(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const lines = String(reader.result || "").split(/\r?\n/).filter(Boolean);
    const [, ...dataLines] = lines;
    const importedFunds = [];
    const importedHoldings = [];
    let importedFxRate = state.fxRate;

    dataLines.forEach((line) => {
      const [ticker, name, price, distribution, frequency, currency, units, cost, note, fxRate, marketSymbol, yearDistributions] = parseCsvLine(line);
      if (!ticker) {
        return;
      }
      importedFunds.push({
        ticker,
        name: name || ticker,
        price: Number(price || 0),
        distribution: Number(distribution || 0),
        frequency: Number(frequency || 12),
        currency: currency === "USD" ? "USD" : "JPY",
        marketSymbol: marketSymbol || defaultMarketSymbol(ticker),
        yearDistributions: parseYearDistributions(yearDistributions),
      });
      if (Number(units || 0) > 0) {
        importedHoldings.push({ ticker, units: Number(units || 0), cost: Number(cost || 0), note: note || "" });
      }
      if (Number(fxRate || 0) > 0) {
        importedFxRate = Number(fxRate);
      }
    });

    if (importedFunds.length) {
      state = { funds: normalizeFunds(importedFunds), holdings: importedHoldings, fxRate: importedFxRate };
      render();
    }
  };
  reader.readAsText(file);
}

function parseYearDistributions(value) {
  try {
    return normalizeYearDistributions(JSON.parse(value || "[]"));
  } catch {
    return [];
  }
}

function csvCell(value) {
  const valueText = String(value ?? "");
  return /[",\n]/.test(valueText) ? `"${valueText.replaceAll('"', '""')}"` : valueText;
}

function parseCsvLine(line) {
  const result = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }

  result.push(cell);
  return result;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

elements.holdingForm.addEventListener("submit", upsertHolding);
elements.fxInput.addEventListener("input", updateFxRate);
elements.refreshFxButton.addEventListener("click", refreshFxRate);
elements.addFundButton.addEventListener("click", addFund);
elements.refreshFundsButton.addEventListener("click", refreshFundMarketData);
elements.exportButton.addEventListener("click", exportCsv);
elements.importInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) {
    importCsv(file);
  }
});
elements.resetButton.addEventListener("click", () => {
  state = createDefaultState();
  render();
  refreshFxRate();
});

elements.holdingsBody.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-row");
  if (button) {
    deleteHolding(button.dataset.ticker);
  }
});

elements.fundGrid.addEventListener("input", (event) => {
  if (event.target.matches(".distribution-history-select")) {
    return;
  }
  if (event.target.matches("input, select")) {
    updateFundFromInput(event.target);
  }
});

elements.fundGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-fund");
  if (button) {
    deleteFund(Number(button.closest(".fund-card").dataset.index));
  }
});

render();
refreshFxRate();
refreshFundMarketData();
