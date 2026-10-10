/* IndexedDB 轻封装：games / hands 两个仓库 */
(function (global) {
  'use strict';

  const DB_NAME = 'mahjong-score';
  const DB_VERSION = 1;
  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('games')) {
          const g = db.createObjectStore('games', { keyPath: 'id' });
          g.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains('hands')) {
          const h = db.createObjectStore('hands', { keyPath: 'id' });
          h.createIndex('gameId', 'gameId', { unique: false });
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  function tx(store, mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const r = fn(s);
      t.oncomplete = () => resolve(r && r.result !== undefined ? r.result : undefined);
      t.onerror = () => reject(t.error);
    }));
  }

  function reqAsPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function uuid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  const DB = {
    init: open,
    uuid,

    putGame(game) { return tx('games', 'readwrite', s => s.put(game)); },
    getGame(id) { return tx('games', 'readonly', s => s.get(id)); },

    getOpenGame() {
      return open().then(db => new Promise((resolve, reject) => {
        const t = db.transaction('games', 'readonly');
        const idx = t.objectStore('games').index('status');
        const r = idx.getAll('active');
        r.onsuccess = () => resolve((r.result || [])[0] || null);
        r.onerror = () => reject(r.error);
      }));
    },

    putHand(hand) { return tx('hands', 'readwrite', s => s.put(hand)); },

    getHands(gameId) {
      return open().then(db => new Promise((resolve, reject) => {
        const t = db.transaction('hands', 'readonly');
        const idx = t.objectStore('hands').index('gameId');
        const r = idx.getAll(gameId);
        r.onsuccess = () => resolve((r.result || []).sort((a, b) => a.seq - b.seq));
        r.onerror = () => reject(r.error);
      }));
    },

    deleteHand(id) { return tx('hands', 'readwrite', s => s.delete(id)); }
  };

  global.DB = DB;
})(window);
