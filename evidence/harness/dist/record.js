"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const viewports_js_1 = require("./viewports.js");
function listViewports() {
    console.log('INNER:', viewports_js_1.INNER.viewport.width + 'x' + viewports_js_1.INNER.viewport.height, '@ dpr ' + viewports_js_1.INNER.deviceScaleFactor);
    console.log('COVER:', viewports_js_1.COVER.viewport.width + 'x' + viewports_js_1.COVER.viewport.height, '@ dpr ' + viewports_js_1.COVER.deviceScaleFactor);
}
const args = process.argv.slice(2);
if (args.includes('--list')) {
    listViewports();
}
else {
    console.log('Obsidian Curricula Evidence Harness');
    console.log('Usage: npm run evidence -- --list');
    console.log('       npm run evidence -- --milestone <n>');
    console.log('       npm run evidence -- --mode grounded|augmented|knowledge-only');
}
