import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('index.html','utf8').replace(/<script[\s\S]*?<\/script>/gi,'');
const dom = new JSDOM(html,{url:'https://nexus.test',runScripts:'outside-only',pretendToBeVisual:true});
const { window } = dom;
window.requestAnimationFrame = callback => window.setTimeout(callback,0);
window.fetch = async () => ({json:async()=>({backendConfigured:false})});
window.console = console;

try {
  window.eval(fs.readFileSync('app-data.js','utf8')+'\n'+fs.readFileSync('app-logic.js','utf8')+'\nwindow.__getDB=()=>DB;');

  window.document.getElementById('new-channel-name').value='Nexus Creators';
  window.document.getElementById('new-channel-desc').value='Наше сообщество авторов';
  window.document.getElementById('new-channel-visibility').value='public';
  window.createChannel();
  let state=window.__getDB();
  const channel=state.channels[0];
  assert.equal(channel.name,'Nexus Creators');
  assert.equal(channel.ownerKey,'me');
  assert.equal(window.document.getElementById('view-channel').classList.contains('active'),true);

  window.openChannelPost();
  window.document.getElementById('compose-text').value='Первый пост канала';
  window.publishPost();
  state=window.__getDB();
  assert.equal(state.posts[0].channelId,channel.id);
  assert.equal(window.document.getElementById('view-channel').classList.contains('active'),true);

  window.document.getElementById('new-shop-name').value='Nexus Market';
  window.document.getElementById('new-shop-desc').value='Магазин сообщества';
  window.document.getElementById('new-shop-visibility').value='public';
  window.createShop();
  state=window.__getDB();
  const shop=state.shops[0];
  assert.equal(shop.name,'Nexus Market');
  assert.equal(shop.ownerKey,'me');
  window.openShopEdit();
  window.document.getElementById('new-shop-name').value='Nexus Market Plus';
  window.createShop();
  state=window.__getDB();
  assert.equal(state.shops[0].name,'Nexus Market Plus');

  window.openProductCreate();
  window.document.getElementById('new-product-name').value='Nexus Hoodie';
  window.document.getElementById('new-product-price').value='3490';
  window.document.getElementById('new-product-desc').value='Плотный хлопок';
  window.createProduct();
  state=window.__getDB();
  assert.equal(state.shops[0].items[0].name,'Nexus Hoodie');
  assert.equal(state.shops[0].items[0].price,3490);
  const productId=state.shops[0].items[0].id;
  window.openProduct(shop.id,productId);
  window.openProductEdit();
  window.document.getElementById('new-product-name').value='Nexus Hoodie Pro';
  window.document.getElementById('new-product-price').value='3990';
  window.createProduct();
  state=window.__getDB();
  assert.equal(state.shops[0].items[0].name,'Nexus Hoodie Pro');
  window.openProduct(shop.id,productId);
  window.deleteProduct();
  state=window.__getDB();
  assert.equal(state.shops[0].items.length,0);

  window.openPrivacySheet();
  window.document.getElementById('privacy-profile-visibility').value='followers';
  window.savePrivacySettings();
  state=window.__getDB();
  assert.equal(state.me.visibility,'followers');

  window.toggleBlock('marley');
  state=window.__getDB();
  assert.equal(state.blocked.marley,true);
  assert.equal(window.document.getElementById('view-settings').classList.contains('active'),false);

  console.log('Nexus UI smoke checks passed: channel, channel post, shop, product, privacy and block flows.');
} finally {
  dom.window.close();
}
