// PWA Service Worker — 缓存游戏资源支持离线
const CACHE = 'balatro-v2';
const FILES = [
  '/', '/index.html',
  '/css/reset.css', '/css/layout.css', '/css/cards.css', '/css/effects.css', '/css/jokers.css', '/css/overlay.css',
  '/js/main.js', '/js/state.js', '/js/deck.js', '/js/rng.js', '/js/round.js', '/js/shop.js', '/js/scoring.js',
  '/js/hand-eval.js', '/js/serialize.js', '/js/version.js', '/js/save-client.js', '/js/upgrades.js',
  '/js/joker-manager.js', '/js/consumable-manager.js', '/js/boss-effects.js', '/js/tags.js',
  '/js/effects/index.js', '/js/effects/joker-effects.js',
  '/js/data/jokers.js', '/js/data/card-data.js', '/js/data/blinds.js', '/js/data/bosses.js',
  '/js/data/tarots.js', '/js/data/planets.js', '/js/data/spectrals.js', '/js/data/vouchers.js', '/js/data/tags.js',
  '/js/ui/render.js', '/js/ui/card-dom.js', '/js/ui/hand-layout.js', '/js/ui/drag.js',
  '/js/ui/hover-3d.js', '/js/ui/keyboard.js', '/js/ui/score-popup.js', '/js/ui/notifications.js',
  '/js/ui/hand-panel.js',
  '/js/audio/sfx.js', '/js/audio/music.js', '/js/audio/hooks.js',
  '/js/svg/card-face.js', '/js/svg/joker-art.js', '/js/svg/icons.js', '/js/svg/chip-pile.js',
  '/js/shaders/background.js',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(e.request, clone)); }
      return res;
    }))
  );
});
