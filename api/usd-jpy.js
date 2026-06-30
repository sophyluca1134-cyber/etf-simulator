module.exports = async (_request, response) => {
  const providers = [
    {
      name: "Yahoo Finance",
      url: "https://query1.finance.yahoo.com/v8/finance/chart/USDJPY=X?range=1d&interval=1m",
      parse: (data) => data?.chart?.result?.[0]?.meta?.regularMarketPrice,
      updatedAt: (data) => {
        const timestamp = data?.chart?.result?.[0]?.meta?.regularMarketTime;
        return timestamp ? new Date(Number(timestamp) * 1000).toISOString() : new Date().toISOString();
      },
    },
    {
      name: "Frankfurter",
      url: "https://api.frankfurter.app/latest?from=USD&to=JPY",
      parse: (data) => data?.rates?.JPY,
      updatedAt: () => new Date().toISOString(),
    },
    {
      name: "ExchangeRate-API",
      url: "https://open.er-api.com/v6/latest/USD",
      parse: (data) => data?.rates?.JPY,
      updatedAt: () => new Date().toISOString(),
    },
  ];

  for (const provider of providers) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const apiResponse = await fetch(provider.url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: controller.signal,
      });

      if (!apiResponse.ok) {
        continue;
      }

      const data = await apiResponse.json();
      const rate = Number(provider.parse(data));
      if (Number.isFinite(rate) && rate > 0) {
        response.setHeader("Cache-Control", "no-store");
        response.status(200).json({
          rate,
          source: provider.name,
          updatedAt: provider.updatedAt(data),
        });
        return;
      }
    } catch {
      // Try the next source.
    } finally {
      clearTimeout(timeout);
    }
  }

  response.status(502).json({ error: "USD/JPY rate unavailable" });
};
