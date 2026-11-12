import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('index.html', 'utf8');
const logic = fs.readFileSync('app-logic.js', 'utf8');
const data = fs.readFileSync('app-data.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const config = fs.readFileSync('api/config.js', 'utf8');
const health = fs.readFileSync('api/health.js', 'utf8');

for (const id of ['feed','stories','compose-text','compose-file-input','story-file-input','story-viewer','bnav','channel-create-sheet','shop-create-sheet','product-create-sheet','new-channel-name','channel-cover-preview','channel-cover-input','new-shop-name','new-product-name','product-create-title','product-save-btn','product-file-input','ch-new-post','ch-edit','sh-add-product','sh-edit-shop','channel-create-title','channel-save-btn','shop-create-title','shop-save-btn','privacy-sheet','blocks-sheet','privacy-profile-visibility','block-list','clip-create-sheet','clip-caption','me-avatar','me-hero','edit-avatar-preview','edit-cover-preview','edit-avatar-file','edit-cover-file','clip-file-input','clip-preview']) {
  assert.ok(html.includes(`id="${id}"`) || html.includes(`id='${id}'`), `Missing required UI element: ${id}`);
}
for (const fn of ['renderFeed','renderStories','openStory','handleComposeFiles','handleStoryFiles','publishPost','openChat','sendMsg','renderExplore','createChannel','openChannelEdit','chooseChannelCover','handleChannelCover','createShop','openShopEdit','createProduct','openProductCreate','openProductEdit','deleteProduct','openChannelPost','openPrivacySheet','savePrivacySettings','openBlockSheet','toggleBlock','openClipCreate','chooseClipVideo','handleClipVideo','createClip','chooseProfileAvatar','chooseProfileCover','handleProfileAvatar','handleProfileCover','renderClips','toggleClipLike','renderPlaylists','openPlaylist','createPlaylist','openTrackCreate','createTrack','renderWatchlists','openWatchlist','createWatchlist','openWatchlistItemCreate','createWatchlistItem','renderFitness','openFitnessProfileEdit','saveFitnessProfile','openWorkoutCreate','createWorkout','openNutritionCreate','createNutritionEntry','renderOrganizations','openOrganization','openOrganizationCreate','createOrganization','openOrganizationLink','saveOrganizationLinks','openOrganizationMembers','saveOrganizationMembers','openSpaceCreate','createSpace','openSpace','openSpaceLink','saveSpaceLinks']) {
  assert.ok(logic.includes(`function ${fn}(`) || logic.includes(`async function ${fn}(`), `Missing app function: ${fn}`);
}
assert.ok(logic.includes('async function saveMediaFile'));
assert.ok(logic.includes('async function shareProfile'));
assert.ok(logic.includes('function esc('));
assert.ok(data.includes('localStorage.getItem(LS)'));
assert.ok(sw.includes("'/app-logic.js'"));
assert.ok(config.includes('SUPABASE_PUBLISHABLE_KEY'));
assert.ok(config.includes('SUPABASE_ANON_KEY'));
assert.ok(!config.includes('SUPABASE_SERVICE_ROLE_KEY'));
assert.ok(health.includes('backendConfigured'));
assert.ok(logic.includes('backend-status'));
assert.ok(logic.includes("fetch('/api/health'"));
assert.ok(!logic.includes('Заказ оформлен ✓'), 'Do not simulate a successful checkout without a backend');
console.log('Nexus quality checks passed.');
