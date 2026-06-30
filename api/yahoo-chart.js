module.exports = async (request, response) => {
  const symbol = request.query?.symbol;
  if (!symbol) {
    response.status(400).json({ error: "symbol required" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d&events=div`;

  try {
    const yahooResponse = await fetch(yahooUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    });
    const body = await yahooResponse.text();
    response.setHeader("Cache-Control", "no-store");
    response.status(yahooResponse.status).send(body);
  } catch {
    response.status(502).json({ error: "market data unavailable" });
  } finally {
    clearTimeout(timeout);
  }
};
