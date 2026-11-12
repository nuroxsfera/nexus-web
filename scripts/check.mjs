import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('index.html', 'utf8');
const logic = fs.readFileSync('app-logic.js', 'utf8');
const data = fs.readFileSync('app-data.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

for (const id of ['feed','stories','compose-text','compose-file-input','story-file-input','story-viewer','bnav']) {
  assert.ok(html.includes(`id="${id}"`) || html.includes(`id='${id}'`), `Missing required UI element: ${id}`);
}
for (const fn of ['renderFeed','renderStories','openStory','handleComposeFiles','handleStoryFiles','publishPost','openChat','sendMsg','renderExplore']) {
  assert.ok(logic.includes(`function ${fn}(`) || logic.includes(`async function ${fn}(`), `Missing app function: ${fn}`);
}
assert.ok(logic.includes('async function saveMediaFile'));
assert.ok(logic.includes('async function shareProfile'));
assert.ok(logic.includes('function esc('));
assert.ok(data.includes('localStorage.getItem(LS)'));
assert.ok(sw.includes("'/app-logic.js'"));
assert.ok(!logic.includes('Заказ оформлен ✓'), 'Do not simulate a successful checkout without a backend');
console.log('Nexus quality checks passed.');
