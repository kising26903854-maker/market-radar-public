const fs = require('fs');

let c = fs.readFileSync('server.js', 'utf8');

const route = `
  app.get('/api/stock/:code/market-cap', async (req, res) => {
    try {
      const { getMarketCapData } = await import('./market_cap_tracker.js');
      const data = await getMarketCapData(req.params.code);
      res.json(data);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
`;

c = c.replace('const PORT = process.env.PORT || 6001', route + '\n\n  const PORT = process.env.PORT || 6001');

fs.writeFileSync('server.js', c);
console.log('Route added!');
