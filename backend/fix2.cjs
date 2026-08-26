const fs = require('fs');
let c = fs.readFileSync('market_cap_tracker.js', 'utf8');
c = c.replace(/\\n/g, '\n');
fs.writeFileSync('market_cap_tracker.js', c);
