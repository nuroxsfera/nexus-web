import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('index.html', 'utf8');
const logic = fs.readFileSync('app-logic.js', 'utf8');
const data = fs.readFileSync('app-data.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const config = fs.readFileSync('api/config.js', 'utf8');
const health = fs.readFileSync('api/health.js', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const vault = fs.readFileSync('health-vault.js', 'utf8');
const auth = fs.readFileSync('auth.js', 'utf8');

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
assert.ok(sw.includes("'/health-vault.js'"));
assert.ok(sw.includes("'/auth.js'"));
const swAssets=[...sw.matchAll(/'\/(.+?)'/g)].map(match=>match[1]).filter(path=>!path.includes('://'));
for(const asset of swAssets)assert.ok(fs.existsSync(asset),`PWA precache asset is missing: ${asset}`);
assert.ok(config.includes('SUPABASE_PUBLISHABLE_KEY'));
assert.ok(config.includes('SUPABASE_ANON_KEY'));
assert.ok(!config.includes('SUPABASE_SERVICE_ROLE_KEY'));
assert.ok(health.includes('backendConfigured'));
assert.ok(vault.includes("iterations:310000"));
assert.ok(vault.includes("name:'AES-GCM'"));
assert.ok(vault.includes('async function lock(db)'));
assert.ok(vault.includes('async function exportEncrypted()'));
assert.ok(vault.includes('async function importEncrypted(bundle)'));
assert.ok(auth.includes('/auth/v1/signup'));
assert.ok(sql.includes("new.raw_user_meta_data->>'username'"));
assert.ok(sql.includes('fallback_username'));
assert.ok(auth.includes('/auth/v1/token?grant_type=password'));
assert.ok(auth.includes('sessionStorage'));
assert.ok(auth.includes('hasSession:function()'));
assert.ok(app.includes("load('/auth.js')"));
assert.ok(logic.includes('function exportLocalData()'));
assert.ok(logic.includes('async function importHealthVaultBackup(input)'));
assert.ok(logic.includes('async function optimizeImageFile(file)'));
assert.ok(logic.includes("isVideo?100:40"));
assert.ok(logic.includes('function refreshMediaCache()'));
assert.ok(logic.includes('async function resetDemoData()'));
assert.ok(logic.includes('Зашифрованный сейф здоровья останется отдельно'));
assert.ok(html.includes('id="health-vault-import-file"'));
assert.ok(app.includes("load('/health-vault.js')"));
assert.ok(data.includes('HEALTH_VAULT.persist(DB)'));
assert.ok(data.includes('snapshot.healthVaultUnlocked=false'));
assert.ok(logic.includes('Личный сейф здоровья'));
assert.ok(logic.includes('lockHealthVault'));
assert.ok(logic.includes('function openAuth(mode'));
assert.ok(logic.includes('async function submitAuth()'));
const closeSheetBlock=logic.slice(logic.indexOf('function closeSheet'),logic.indexOf('\n}',logic.indexOf('function closeSheet')));
for(const match of html.matchAll(/<div id=\"([^\"]+)\" class=\"sheet\"/g))assert.ok(closeSheetBlock.includes(match[1]),`Sheet is missing from closeSheet(): ${match[1]}`);
assert.ok(logic.includes('backend-status'));
assert.ok(logic.includes("fetch('/api/health'"));
assert.ok(!logic.includes('Заказ оформлен ✓'), 'Do not simulate a successful checkout without a backend');
console.log('Nexus quality checks passed.');
