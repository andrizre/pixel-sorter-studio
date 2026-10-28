// sorter-node.cjs — Node wrapper so test.js can use the browser engine
// in sorter.js without duplicating code. sorter.js uses top-level
// `const`/`function` declarations, which don't attach to globalThis when
// evaluated, so we append an export snapshot inside the evaluated scope.
'use strict';

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'sorter.js'), 'utf8')
  + '\n;globalThis.__SORTER_EXPORTS__ = {'
  + ' METRICS, rgbToHue, sortLine, pixelSort, mulberry32, generateSource, hslToRgb };';

(0, eval)(src);

module.exports = globalThis.__SORTER_EXPORTS__;
