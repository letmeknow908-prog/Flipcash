#!/bin/bash
echo "🚀 FORCING RAILWAY REBUILD..."
echo "Current package.json version:"
node -e "console.log(require('./package.json').version)"

# Force update version
node -e "
const fs = require('fs');
const package = require('./package.json');
package.version = '4.0.0-' + Date.now();
fs.writeFileSync('./package.json', JSON.stringify(package, null, 2));
console.log('✅ Updated to version:', package.version);
"

# Clear npm cache
npm cache clean --force

# Install fresh
npm install
