const fs = require('fs');
let c = fs.readFileSync('../frontend/src/App.jsx', 'utf8');

// Find the end of WallstreetDetailModal by finding "function WallstreetDetailModal"
// then finding the next "function FearGreedModal" and injecting before it.

const startIdx = c.indexOf('function WallstreetDetailModal');
const endIdx = c.indexOf('function FearGreedModal', startIdx);

if (startIdx > -1 && endIdx > -1) {
  const modalText = c.substring(startIdx, endIdx);
  // Find the last </div> before the end
  const lastDivIdx = modalText.lastIndexOf('</div>');
  const parentDivIdx = modalText.lastIndexOf('</div>', lastDivIdx - 1);
  const grandparentDivIdx = modalText.lastIndexOf('</div>', parentDivIdx - 1);

  // Instead of guessing divs, let's inject just after the last inner div, which is probably the scroll area.
  // We can look for "        {/* 스크롤 끝 */}" or something. Let's just find "        </div>\n      </div>\n    </div>\n  )\n}"
  
  const injectTarget = `        </div>\n      </div>\n    </div>\n  )\n}`;
  const modifiedModal = modalText.replace(
    '        </div>\n      </div>\n    </div>\n  )\n}', 
    '          <MarketCapTrackerChart code={stock.code} />\n        </div>\n      </div>\n    </div>\n  )\n}'
  );
  
  if (modifiedModal !== modalText) {
     c = c.slice(0, startIdx) + modifiedModal + c.slice(endIdx);
     fs.writeFileSync('../frontend/src/App.jsx', c);
     console.log('Successfully injected MarketCapTrackerChart into WallstreetDetailModal');
  } else {
     // fallback 
     const fallbackTarget = 'onClick={e => e.stopPropagation()}\n      >';
     const fallbackReplace = fallbackTarget + '\n        <MarketCapTrackerChart code={stock.code} />';
     const fallbackModal = modalText.replace(fallbackTarget, fallbackReplace);
     if(fallbackModal !== modalText) {
        c = c.slice(0, startIdx) + fallbackModal + c.slice(endIdx);
        fs.writeFileSync('../frontend/src/App.jsx', c);
        console.log('Successfully injected MarketCapTrackerChart at the top of WallstreetDetailModal');
     } else {
        console.log('Failed to find injection target');
     }
  }
} else {
  console.log('Could not find modal boundaries');
}
