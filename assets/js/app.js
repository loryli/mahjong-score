/* 麻将计分 · Vue 应用（M1：手动账本） */
(function () {
  'use strict';

  const { createApp, reactive, ref, computed } = Vue;

  createApp({
    setup() {
      const screen = ref('home');
      const game = ref(null);
      const hands = ref([]);
      const resumeGame = ref(null);
      const toast = ref('');

      const setup = reactive({
        names: ['', '', '', ''],
        B: 1, F: 3, R: 2, K: 1, startScore: 0
      });

      const entry = reactive({
        open: false, edit: false, hand: null,
        deltas: ['', '', '', ''], note: ''
      });
      const settle = reactive({ open: false });

      const toInt = v => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      const totals = computed(() =>
        game.value ? Rules.computeTotals(game.value, hands.value) : [0, 0, 0, 0]);

      const entrySum = computed(() =>
        entry.deltas.reduce((a, v) => a + toInt(v), 0));
      const entryConserved = computed(() => entrySum.value === 0);

      const net = computed(() =>
        game.value ? Rules.netScores(game.value, totals.value) : [0, 0, 0, 0]);
      const pays = computed(() => Rules.netPayments(net.value));

      function scoreClass(v) {
        return v > 0 ? 'win' : v < 0 ? 'lose' : 'zero';
      }
      /* 计分板颜色按净输赢（扣除起始分） */
      function cellClass(i) {
        if (!game.value) return 'zero';
        return scoreClass(totals.value[i] - Number(game.value.startScore || 0));
      }
      function signed(n) { return n > 0 ? '+' + n : String(n); }
      function signedDelta(h, i) {
        return signed(Math.round(Rules.handDeltas(h, game.value.rules)[i]));
      }
      function fmtTime(ts) {
        const d = new Date(ts);
        const p = x => String(x).padStart(2, '0');
        return p(d.getHours()) + ':' + p(d.getMinutes());
      }

      let toastTimer = null;
      function showToast(msg) {
        toast.value = msg;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => (toast.value = ''), 1800);
      }

      async function boot() {
        await DB.init();
        resumeGame.value = await DB.getOpenGame();
      }

      async function startGame() {
        if (resumeGame.value) {
          showToast('请先继续并结束当前场次');
          return;
        }
        const names = setup.names.map((n, i) => (n && n.trim()) || ('玩家' + (i + 1)));
        if (new Set(names).size < 4) {
          showToast('四个人的名字不能重复');
          return;
        }
        const g = {
          id: DB.uuid(),
          names,
          startScore: toInt(setup.startScore),
          rules: {
            B: toInt(setup.B) || 1,
            F: toInt(setup.F) || 1,
            R: toInt(setup.R) || 1,
            K: toInt(setup.K) || 1
          },
          status: 'active',
          createdAt: Date.now(),
          endedAt: null
        };
        await DB.putGame(g);
        await loadGame(g.id);
      }

      async function continueGame() {
        if (resumeGame.value) await loadGame(resumeGame.value.id);
      }

      async function loadGame(id) {
        const g = await DB.getGame(id);
        if (!g) { showToast('没找到这场'); return; }
        game.value = g;
        hands.value = await DB.getHands(id);
        screen.value = 'game';
      }

      async function goHome() {
        screen.value = 'home';
        resumeGame.value = await DB.getOpenGame();
      }

      function openEntry() {
        entry.open = true;
        entry.edit = false;
        entry.hand = null;
        entry.deltas = ['', '', '', ''];
        entry.note = '';
      }

      function openEdit(h) {
        entry.open = true;
        entry.edit = true;
        entry.hand = h;
        entry.deltas = Rules.handDeltas(h, game.value.rules).slice();
        entry.note = h.note || '';
      }

      function closeEntry() { entry.open = false; }

      async function saveEntry() {
        const deltas = entry.deltas.map(toInt);
        if (deltas.reduce((a, b) => a + b, 0) !== 0) {
          showToast('本手四个数之和必须为 0');
          return;
        }
        if (entry.edit) {
          const h = entry.hand;
          h.events = [{ type: 'manual', deltas }];
          h.deltas = deltas;
          h.note = entry.note;
          h.time = Date.now();
          await DB.putHand(h);
        } else {
          const seq = hands.value.reduce((m, h) => Math.max(m, h.seq), 0) + 1;
          const h = {
            id: DB.uuid(),
            gameId: game.value.id,
            seq,
            time: Date.now(),
            events: [{ type: 'manual', deltas }],
            deltas,
            note: entry.note
          };
          await DB.putHand(h);
        }
        entry.open = false;
        await reloadHands();
      }

      async function removeCurrent() {
        if (!entry.edit) return;
        await DB.deleteHand(entry.hand.id);
        entry.open = false;
        await reloadHands();
        showToast('已删除该手');
      }

      async function reloadHands() {
        hands.value = await DB.getHands(game.value.id);
      }

      async function undoLast() {
        const h = hands.value[hands.value.length - 1];
        if (!h) return;
        await DB.deleteHand(h.id);
        await reloadHands();
        showToast('已撤销第 ' + h.seq + ' 手');
      }

      function endGame() { settle.open = true; }
      function closeSettle() { settle.open = false; }

      async function share() {
        const text = Rules.shareText(game.value, net.value, pays.value);
        if (navigator.share) {
          try { await navigator.share({ title: '麻将战绩', text }); }
          catch (_) { /* 用户取消 */ }
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(text);
          showToast('战绩已复制，去群里粘贴吧');
        } else {
          window.prompt('复制战绩：', text);
        }
      }

      async function confirmEnd() {
        game.value.status = 'ended';
        game.value.endedAt = Date.now();
        await DB.putGame(game.value);
        settle.open = false;
        game.value = null;
        hands.value = [];
        screen.value = 'home';
        resumeGame.value = await DB.getOpenGame();
        showToast('本场已结束');
      }

      boot();

      return {
        screen, game, hands, resumeGame, setup, entry, settle, toast,
        totals, entrySum, entryConserved, net, pays,
        Rules,
        scoreClass, cellClass, signed, signedDelta, fmtTime,
        startGame, continueGame, goHome,
        openEntry, openEdit, closeEntry, saveEntry, removeCurrent,
        undoLast, endGame, closeSettle, share, confirmEnd
      };
    }
  }).mount('#app');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
