import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('index.html', 'utf8');
const logic = fs.readFileSync('app-logic.js', 'utf8');
const data = fs.readFileSync('app-data.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

for (const id of ['feed','stories','compose-text','compose-file-input','story-file-input','story-viewer','bnav']) {
  assert.match(html, new RegExp('id=["\\']' + id + '["\\']'), `Missing required UI element: ${id}`);
}
for (const fn of ['renderFeed','renderStories','openStory','handleComposeFiles','handleStoryFiles','publishPost','openChat','sendMsg','renderExplore']) {
  assert.match(logic, new RegExp('function\\s+' + fn + '\\s*\\('), `Missing app function: ${fn}`);
}
assert.match(logic, /async function saveMediaFile/);
assert.match(logic, /async function shareProfile/);
assert.match(logic, /function esc\\(/);
assert.match(data, /localStorage\\.getItem\\(LS\\)/);
assert.match(sw, /['"]\\/app-logic\\.js['"]/);
assert.doesNotMatch(logic, /Заказ оформлен ✓/);
console.log('Nexus quality checks passed.');
