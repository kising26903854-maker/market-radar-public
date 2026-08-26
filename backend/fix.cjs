const fs = require('fs');
let c = fs.readFileSync('market_cap_tracker.js', 'utf8');
c = c.replace(/\\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync('market_cap_tracker.js', c);
