import fs from 'fs';
import path from 'path';

const projectDir = 'C:\\Users\\kisin\\.gemini\\antigravity\\scratch\\portfolio-agent';

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === '.next' || file === 'dist') return;
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      searchDir(filePath);
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.html') || file.endsWith('.json')) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('sise_high') || content.includes('52week-high') || content.includes('52주')) {
          console.log(`Found in: ${filePath}`);
          // Find occurrences and print line numbers
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.includes('sise_high') || line.includes('52week-high') || line.includes('52주')) {
              console.log(`  Line ${idx+1}: ${line.trim()}`);
            }
          });
        }
      }
    }
  });
}

searchDir(projectDir);
