/* 麻将计分 · 纯规则函数（无 DOM 依赖，可单测） */
(function (global) {
  'use strict';

  const EPS = 1e-9;

  /* 番种定义（成都主流），chip 多选 */
  const FAN_DEFS = [
    { key: 'dadui',     name: '大对子',   fan: 1 },
    { key: 'qingyise',  name: '清一色',   fan: 2 },
    { key: 'qidui',     name: '七对',     fan: 2 },
    { key: 'longqidui', name: '龙七对',   fan: 3 },
    { key: 'gangshanghua', name: '杠上花', fan: 1 },
    { key: 'gangshangpao', name: '杠上炮', fan: 1 },
    { key: 'qianggang', name: '抢杠胡',   fan: 1 },
    { key: 'haidilao',  name: '海底捞月', fan: 1 },
    { key: 'haidipao',  name: '海底炮',   fan: 1 }
  ];

  function emptyDeltas() { return [0, 0, 0, 0]; }

  function addInto(acc, d) { for (let i = 0; i < 4; i++) acc[i] += d[i]; return acc; }

  /* 实际番数：勾选番种 + 根（每根 +1） */
  function fanCount(hu) {
    let f = hu.roots || 0;
    const picked = hu.fans || [];
    for (const def of FAN_DEFS) if (picked.includes(def.key)) f += def.fan;
    return f;
  }

  /* 和牌分值 V = B × 2^min(番, 封顶) */
  function huValue(rules, fan) {
    return rules.B * Math.pow(2, Math.min(fan, rules.F));
  }

  /* 和牌事件 → 4 人增量 */
  function huDeltas(hu, rules) {
    const d = emptyDeltas();
    const v = huValue(rules, fanCount(hu));
    const w = hu.winner;
    if (hu.selfDraw) {
      // 自摸：默认另外三家付；血战中已和牌者可通过 payers 剔除
      const payers = (hu.payers && hu.payers.length)
        ? hu.payers
        : [0, 1, 2, 3].filter(i => i !== w);
      payers.forEach(i => { d[i] -= v; d[w] += v; });
    } else {
      // 点炮：点炮者一家赔
      d[w] += v; d[hu.discarder] -= v;
    }
    return d;
  }

  /* 杠（雨）事件 → 即时增量，单价 U = B × R */
  function kongDeltas(k, rules) {
    const d = emptyDeltas();
    const U = rules.B * rules.R;
    const p = k.player;
    if (k.kind === 'ming') {
      // 点杠/大明杠：点杠者一家付
      d[p] += U; d[k.provider] -= U;
    } else if (k.kind === 'an') {
      // 暗杠：其余三家各付
      d[p] += 3 * U;
      for (let i = 0; i < 4; i++) if (i !== p) d[i] -= U;
    }
    return d;
  }

  /* 流局：查叫（查大叫）+ 查花猪，满赔 Vmax = B × 2^F */
  function drawDeltas(dr, rules) {
    const d = emptyDeltas();
    const V = rules.B * Math.pow(2, rules.F);
    // 未下叫者 赔给 每个下叫者（本手已和牌者不在两组内）
    (dr.notWaiting || []).forEach(n => {
      (dr.waiting || []).forEach(w => { d[n] -= V; d[w] += V; });
    });
    // 花猪者 赔给其余三家
    (dr.huaZhu || []).forEach(h => {
      for (let i = 0; i < 4; i++) if (i !== h) { d[h] -= V; d[i] += V; }
    });
    return d;
  }

  /* 一手牌：汇总事件流（杠→和牌→流局，可多个） */
  function handDeltas(hand, rules) {
    const acc = emptyDeltas();
    (hand.events || []).forEach(ev => {
      if (ev.type === 'kong') addInto(acc, kongDeltas(ev, rules));
      else if (ev.type === 'hu') addInto(acc, huDeltas(ev, rules));
      else if (ev.type === 'draw') addInto(acc, drawDeltas(ev, rules));
      else if (ev.type === 'manual') addInto(acc, ev.deltas);
    });
    return acc;
  }

  function isConserved(d) { return Math.abs(d[0] + d[1] + d[2] + d[3]) < EPS; }

  /* 累计总分（含统一起始分） */
  function computeTotals(game, hands) {
    const rules = numRules(game.rules);
    const totals = [0, 1, 2, 3].map(() => Number(game.startScore || 0));
    hands.slice().sort((a, b) => a.seq - b.seq).forEach(h => {
      addInto(totals, handDeltas(h, rules));
    });
    return totals;
  }

  /* 净输赢 = 总分 - 起始分 */
  function netScores(game, totals) {
    return totals.map(t => t - Number(game.startScore || 0));
  }

  /* 贪心轧差：返回最少转账笔数 [{from,to,points}] */
  function netPayments(net) {
    const creditors = net.map((v, i) => ({ i, v }))
      .filter(x => x.v > EPS).sort((a, b) => b.v - a.v);
    const debtors = net.map((v, i) => ({ i, v: -v }))
      .filter(x => x.v > EPS).sort((a, b) => b.v - a.v);
    const pays = [];
    let c = 0, d = 0;
    while (c < creditors.length && d < debtors.length) {
      const amt = Math.min(creditors[c].v, debtors[d].v);
      pays.push({ from: debtors[d].i, to: creditors[c].i, points: amt });
      creditors[c].v -= amt; debtors[d].v -= amt;
      if (creditors[c].v < EPS) c++;
      if (debtors[d].v < EPS) d++;
    }
    return pays;
  }

  /* 金额：points × K（K=每分多少元），去掉多余小数 */
  function yuan(points, K) {
    const v = Math.abs(points * K);
    const r = Math.round(v * 100) / 100;
    if (Number.isInteger(r)) return String(r);
    return r.toFixed(2).replace(/0$/, '');
  }

  function sign(n) { return n > 0 ? '+' : (n < 0 ? '' : ''); }

  /* 散场文字战绩 */
  function shareText(game, net, pays) {
    const K = Number(game.rules.K || 1);
    const L = [];
    L.push('🀄 麻将战绩');
    L.push(game.names.map((nm, i) => `${nm} ${sign(net[i])}${fmtInt(net[i])}`).join('　'));
    L.push(`（每分 ¥${K}）`);
    if (!pays.length) {
      L.push('✅ 四人两清，无需转账');
    } else {
      pays.forEach(p => {
        L.push(`${game.names[p.from]} → ${game.names[p.to]} ¥${yuan(p.points, K)}`);
      });
    }
    return L.join('\n');
  }

  function fmtInt(n) { return String(Math.round(n)); }

  function numRules(r) {
    return {
      B: Number(r.B),
      F: Number(r.F),
      R: Number(r.R),
      K: Number(r.K)
    };
  }

  const api = {
    FAN_DEFS, fanCount, huValue, huDeltas, kongDeltas, drawDeltas,
    handDeltas, isConserved, computeTotals, netScores, netPayments,
    yuan, shareText, numRules, emptyDeltas
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
