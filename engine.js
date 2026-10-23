/* 麻雀エンジン：牌・鳴き・和了判定・役・符・点数。状態はすべてJSONで持つ。 */
(function (root) {
  'use strict';

  // 牌ID 0..135、種類 = id>>2。0-8 萬子, 9-17 筒子, 18-26 索子, 27-30 東南西北, 31 白 32 發 33 中
  const RED_IDS = [16, 52, 88];
  const kindOf = (id) => id >> 2;
  const isHonor = (k) => k >= 27;
  const isTerm = (k) => k < 27 && (k % 9 === 0 || k % 9 === 8);
  const isYao = (k) => isHonor(k) || isTerm(k);
  const suitOf = (k) => (k < 27 ? Math.floor(k / 9) : 3);
  const WIND_NAMES = ['東', '南', '西', '北'];

  function counts(ids) {
    const c = new Array(34).fill(0);
    for (const id of ids) c[kindOf(id)]++;
    return c;
  }

  function doraFromIndicator(k) {
    if (k < 27) return k % 9 === 8 ? k - 8 : k + 1;
    if (k <= 30) return k === 30 ? 27 : k + 1;
    return k === 33 ? 31 : k + 1;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- 向聴数 ---------- */

  function shantenNormal(c, meldCount) {
    let best = 8;
    const need = 4 - meldCount;
    function rec(i, m, t, p) {
      while (i < 34 && c[i] === 0) i++;
      if (i >= 34) {
        const tt = Math.min(t, need - m);
        const s = 8 - 2 * (m + meldCount) - tt - p;
        if (s < best) best = s;
        return;
      }
      if (c[i] >= 3) { c[i] -= 3; rec(i, m + 1, t, p); c[i] += 3; }
      if (i < 27 && i % 9 <= 6 && c[i + 1] && c[i + 2]) {
        c[i]--; c[i + 1]--; c[i + 2]--; rec(i, m + 1, t, p); c[i]++; c[i + 1]++; c[i + 2]++;
      }
      if (c[i] >= 2) {
        if (!p) { c[i] -= 2; rec(i, m, t, 1); c[i] += 2; }
        c[i] -= 2; rec(i, m, t + 1, p); c[i] += 2;
      }
      if (i < 27 && i % 9 <= 7 && c[i + 1]) { c[i]--; c[i + 1]--; rec(i, m, t + 1, p); c[i]++; c[i + 1]++; }
      if (i < 27 && i % 9 <= 6 && c[i + 2]) { c[i]--; c[i + 2]--; rec(i, m, t + 1, p); c[i]++; c[i + 2]++; }
      c[i]--; rec(i, m, t, p); c[i]++;
    }
    rec(0, 0, 0, 0);
    return best;
  }

  function shantenChiitoi(c) {
    let pairs = 0, kinds = 0;
    for (let k = 0; k < 34; k++) { if (c[k] >= 1) kinds++; if (c[k] >= 2) pairs++; }
    return 6 - pairs + Math.max(0, 7 - kinds);
  }

  function shantenKokushi(c) {
    let kinds = 0, pair = 0;
    for (let k = 0; k < 34; k++) if (isYao(k) && c[k]) { kinds++; if (c[k] >= 2) pair = 1; }
    return 13 - kinds - pair;
  }

  function shanten(c, meldCount) {
    let s = shantenNormal(c.slice(), meldCount);
    if (meldCount === 0) s = Math.min(s, shantenChiitoi(c), shantenKokushi(c));
    return s;
  }

  // 待ち牌の種類（13枚相当の手で）
  function waits(handIds, meldCount) {
    const c = counts(handIds);
    const out = [];
    for (let k = 0; k < 34; k++) {
      if (c[k] >= 4) continue;
      c[k]++;
      if (shanten(c, meldCount) === -1) out.push(k);
      c[k]--;
    }
    return out;
  }

  /* ---------- 面子分解 ---------- */

  function decompose(c) {
    const res = [];
    function sets(i, acc, pair) {
      while (i < 34 && c[i] === 0) i++;
      if (i === 34) { res.push({ pair, sets: acc.slice() }); return; }
      if (c[i] >= 3) { c[i] -= 3; acc.push({ t: 'k', k: i }); sets(i, acc, pair); acc.pop(); c[i] += 3; }
      if (i < 27 && i % 9 <= 6 && c[i + 1] && c[i + 2]) {
        c[i]--; c[i + 1]--; c[i + 2]--; acc.push({ t: 's', k: i });
        sets(i, acc, pair);
        acc.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
      }
    }
    for (let p = 0; p < 34; p++) {
      if (c[p] >= 2) { c[p] -= 2; sets(0, [], p); c[p] += 2; }
    }
    return res;
  }

  /* ---------- 点数 ---------- */

  const ceil100 = (x) => Math.ceil(x / 100) * 100;

  function basePoints(han, fu, yakumanCount) {
    if (yakumanCount) return 8000 * yakumanCount;
    if (han >= 13) return 8000;
    if (han >= 11) return 6000;
    if (han >= 8) return 4000;
    if (han >= 6) return 3000;
    const b = fu * Math.pow(2, han + 2);
    return Math.min(b, 2000);
  }

  function limitName(han, fu, yakumanCount) {
    if (yakumanCount >= 2) return yakumanCount + '倍役満';
    if (yakumanCount) return '役満';
    if (han >= 13) return '数え役満';
    if (han >= 11) return '三倍満';
    if (han >= 8) return '倍満';
    if (han >= 6) return '跳満';
    if (basePoints(han, fu, 0) >= 2000) return '満貫';
    return '';
  }

  // ctx: {hand(ids, 和了牌込み), melds, winTile, tsumo, seatWind(27..30), roundWind, dealer,
  //       riichi, doubleRiichi, ippatsu, haitei, houtei, rinshan, chankan, tenhou, chiihou,
  //       doraInd[], uraInd[], aka}
  function scoreHand(ctx) {
    const c = counts(ctx.hand);
    const meldCount = ctx.melds.length;
    if (shanten(c, meldCount) !== -1) return null;
    const winK = kindOf(ctx.winTile);
    const menzen = ctx.melds.every((m) => m.type === 'ankan');
    const allIds = ctx.hand.concat(...ctx.melds.map((m) => m.tiles));
    const allC = counts(allIds);
    const candidates = [];

    // 状況役（形に依らない）
    function situational(yaku) {
      if (ctx.doubleRiichi) yaku.push(['ダブル立直', 2]);
      else if (ctx.riichi) yaku.push(['立直', 1]);
      if (ctx.riichi && ctx.ippatsu) yaku.push(['一発', 1]);
      if (menzen && ctx.tsumo) yaku.push(['門前清自摸和', 1]);
      if (ctx.haitei) yaku.push(['海底摸月', 1]);
      if (ctx.houtei) yaku.push(['河底撈魚', 1]);
      if (ctx.rinshan) yaku.push(['嶺上開花', 1]);
      if (ctx.chankan) yaku.push(['槍槓', 1]);
    }
    function situationalYakuman(ym) {
      if (ctx.tenhou) ym.push(['天和', 1]);
      if (ctx.chiihou) ym.push(['地和', 1]);
    }
    function colorYaku(yaku, ym, open) {
      const suits = new Set(); let honors = false, allYao = true, allHonor = true, allTerm = true, green = true;
      for (let k = 0; k < 34; k++) {
        if (!allC[k]) continue;
        if (k >= 27) honors = true; else suits.add(suitOf(k));
        if (!isYao(k)) allYao = false;
        if (k < 27) allHonor = false;
        if (!isTerm(k)) allTerm = false;
        if (![19, 20, 21, 23, 25, 32].includes(k)) green = false;
      }
      if (allHonor) ym.push(['字一色', 1]);
      if (allTerm) ym.push(['清老頭', 1]);
      if (green) ym.push(['緑一色', 1]);
      if (suits.size === 1 && !honors) yaku.push(['清一色', open ? 5 : 6]);
      else if (suits.size === 1 && honors) yaku.push(['混一色', open ? 2 : 3]);
      return { allYao };
    }

    // 国士無双
    if (meldCount === 0 && shantenKokushi(c) === -1) {
      const ym = [['国士無双', 1]]; situationalYakuman(ym);
      candidates.push({ yaku: [], ym, fu: 0 });
    }

    // 七対子
    if (meldCount === 0 && shantenChiitoi(c) === -1) {
      const yaku = [], ym = [];
      situational(yaku); situationalYakuman(ym);
      yaku.push(['七対子', 2]);
      const { allYao } = colorYaku(yaku, ym, false);
      if (!allC.some((n, k) => n && isYao(k))) yaku.push(['断幺九', 1]);
      if (allYao && !ym.some((y) => y[0] === '字一色' || y[0] === '清老頭')) yaku.push(['混老頭', 2]);
      candidates.push({ yaku, ym, fu: 25 });
    }

    // 一般形
    for (const d of decompose(c.slice())) {
      // 和了牌をどの面子に当てるか
      const slots = [];
      if (d.pair === winK) slots.push({ i: -1, wait: 'tanki' });
      d.sets.forEach((s, i) => {
        if (s.t === 'k' && s.k === winK) slots.push({ i, wait: 'shanpon' });
        if (s.t === 's' && winK >= s.k && winK <= s.k + 2) {
          let w = 'ryanmen';
          if (winK === s.k + 1) w = 'kanchan';
          else if (winK === s.k + 2 && s.k % 9 === 0) w = 'penchan';
          else if (winK === s.k && s.k % 9 === 6) w = 'penchan';
          slots.push({ i, wait: w });
        }
      });
      for (const slot of slots) candidates.push(evalStandard(d, slot));
    }

    function evalStandard(d, slot) {
      const groups = d.sets.map((s, i) => ({
        t: s.t, k: s.k,
        closed: !(s.t === 'k' && !ctx.tsumo && i === slot.i),
        kan: false,
      }));
      for (const m of ctx.melds) {
        const k = kindOf(m.tiles[0]);
        if (m.type === 'chi') {
          groups.push({ t: 's', k: Math.min(...m.tiles.map(kindOf)), closed: false, kan: false });
        } else {
          groups.push({ t: 'k', k, closed: m.type === 'ankan', kan: m.type !== 'pon' });
        }
      }
      const yaku = [], ym = [];
      situational(yaku); situationalYakuman(ym);
      const open = !menzen;
      const seatW = ctx.seatWind, roundW = ctx.roundWind;
      const isValuePair = (k) => k >= 31 || k === seatW || k === roundW;
      const shun = groups.filter((g) => g.t === 's');
      const kou = groups.filter((g) => g.t === 'k');
      const pinfu = menzen && shun.length === 4 && !isValuePair(d.pair) && slot.wait === 'ryanmen';

      if (pinfu) yaku.push(['平和', 1]);
      if (!allC.some((n, k) => n && isYao(k))) yaku.push(['断幺九', 1]);
      if (menzen) {
        const cnt = {};
        for (const g of shun) cnt[g.k] = (cnt[g.k] || 0) + 1;
        let peko = 0;
        for (const k in cnt) peko += Math.floor(cnt[k] / 2);
        if (peko === 2) yaku.push(['二盃口', 3]);
        else if (peko === 1) yaku.push(['一盃口', 1]);
      }
      for (const g of kou) {
        if (g.k === 31) yaku.push(['役牌 白', 1]);
        if (g.k === 32) yaku.push(['役牌 發', 1]);
        if (g.k === 33) yaku.push(['役牌 中', 1]);
        if (g.k === seatW) yaku.push(['自風 ' + WIND_NAMES[seatW - 27], 1]);
        if (g.k === roundW) yaku.push(['場風 ' + WIND_NAMES[roundW - 27], 1]);
      }
      for (let n = 0; n < 7; n++) {
        if (shun.some((g) => g.k === n) && shun.some((g) => g.k === n + 9) && shun.some((g) => g.k === n + 18)) {
          yaku.push(['三色同順', open ? 1 : 2]); break;
        }
      }
      for (let s = 0; s < 3; s++) {
        if ([0, 3, 6].every((o) => shun.some((g) => g.k === s * 9 + o))) { yaku.push(['一気通貫', open ? 1 : 2]); break; }
      }
      const groupHasYao = (g) => (g.t === 'k' ? isYao(g.k) : g.k % 9 === 0 || g.k % 9 === 6);
      const groupHasHonor = (g) => g.t === 'k' && g.k >= 27;
      if (shun.length && groups.every(groupHasYao) && isYao(d.pair)) {
        if (groups.some(groupHasHonor) || d.pair >= 27) yaku.push(['混全帯幺九', open ? 1 : 2]);
        else yaku.push(['純全帯幺九', open ? 2 : 3]);
      }
      if (kou.length === 4) yaku.push(['対々和', 2]);
      const anko = kou.filter((g) => g.closed).length;
      if (anko === 4) ym.push(['四暗刻', 1]);
      else if (anko === 3) yaku.push(['三暗刻', 2]);
      const kans = kou.filter((g) => g.kan).length;
      if (kans === 4) ym.push(['四槓子', 1]);
      else if (kans === 3) yaku.push(['三槓子', 2]);
      for (let n = 0; n < 9; n++) {
        if ([n, n + 9, n + 18].every((k) => kou.some((g) => g.k === k))) { yaku.push(['三色同刻', 2]); break; }
      }
      const dragonKou = kou.filter((g) => g.k >= 31).length;
      if (dragonKou === 3) ym.push(['大三元', 1]);
      else if (dragonKou === 2 && d.pair >= 31) yaku.push(['小三元', 2]);
      const windKou = kou.filter((g) => g.k >= 27 && g.k <= 30).length;
      if (windKou === 4) ym.push(['大四喜', 1]);
      else if (windKou === 3 && d.pair >= 27 && d.pair <= 30) ym.push(['小四喜', 1]);
      const { allYao } = colorYaku(yaku, ym, open);
      if (allYao && !ym.some((y) => y[0] === '字一色' || y[0] === '清老頭')) yaku.push(['混老頭', 2]);
      // 九蓮宝燈
      if (menzen && meldCount === 0) {
        const s = suitOf(winK);
        if (s < 3 && c.every((n, k) => !n || suitOf(k) === s)) {
          const base = [3, 1, 1, 1, 1, 1, 1, 1, 3];
          if (base.every((b, i) => c[s * 9 + i] >= b)) ym.push(['九蓮宝燈', 1]);
        }
      }

      // 符
      let fu;
      if (pinfu) fu = ctx.tsumo ? 20 : 30;
      else {
        fu = 20;
        if (menzen && !ctx.tsumo) fu += 10;
        if (ctx.tsumo) fu += 2;
        if (['kanchan', 'penchan', 'tanki'].includes(slot.wait)) fu += 2;
        if (d.pair >= 31) fu += 2;
        if (d.pair === seatW) fu += 2;
        if (d.pair === roundW) fu += 2;
        for (const g of kou) {
          let f = 2;
          if (isYao(g.k)) f *= 2;
          if (g.closed) f *= 2;
          if (g.kan) f *= 4;
          fu += f;
        }
        fu = Math.ceil(fu / 10) * 10;
        if (fu === 20) fu = 30; // 喰い平和形
      }
      return { yaku, ym, fu };
    }

    // ドラ
    let dora = 0, ura = 0, aka = 0;
    for (const ind of ctx.doraInd) if (ind != null) dora += allC[doraFromIndicator(kindOf(ind))];
    if (ctx.riichi) for (const ind of ctx.uraInd) if (ind != null) ura += allC[doraFromIndicator(kindOf(ind))];
    if (ctx.aka) aka = allIds.filter((id) => RED_IDS.includes(id)).length;

    let best = null;
    for (const cand of candidates) {
      const ymCount = cand.ym.reduce((a, y) => a + y[1], 0);
      let han = cand.yaku.reduce((a, y) => a + y[1], 0);
      if (!ymCount && han === 0) continue;
      let yakuList;
      if (ymCount) yakuList = cand.ym.map(([n]) => ({ name: n, han: '役満' }));
      else {
        yakuList = cand.yaku.map(([n, h]) => ({ name: n, han: h }));
        if (dora) yakuList.push({ name: 'ドラ', han: dora });
        if (aka) yakuList.push({ name: '赤ドラ', han: aka });
        if (ctx.riichi) yakuList.push({ name: '裏ドラ', han: ura });
        han += dora + aka + ura;
      }
      const base = basePoints(han, cand.fu, ymCount);
      const total = ctx.dealer ? (ctx.tsumo ? ceil100(base * 2) * 3 : ceil100(base * 6))
        : (ctx.tsumo ? ceil100(base * 2) + ceil100(base) * 2 : ceil100(base * 4));
      if (!best || total > best.total || (total === best.total && han > best.han)) {
        best = { han, fu: cand.fu, yakuman: ymCount, yaku: yakuList, base, total, limit: limitName(han, cand.fu, ymCount) };
      }
    }
    return best;
  }

  /* ---------- 局の進行 ---------- */

  const clone = (o) => JSON.parse(JSON.stringify(o));

  function newGame(rules) {
    return {
      v: 1, phase: 'lobby', seq: 0,
      rules: Object.assign({ length: 'hanchan', aka: true }, rules || {}),
      seats: [0, 1, 2, 3].map(() => ({ uid: null, bot: false })),
      scores: [25000, 25000, 25000, 25000],
      kyoku: 0, honba: 0, kyotaku: 0, startDealer: 0,
      players: [], log: [],
    };
  }

  function dealerOf(S) { return (S.startDealer + S.kyoku) % 4; }
  function seatWind(S, seat) { return 27 + ((seat - dealerOf(S) + 4) % 4); }
  function roundWind(S) { return 27 + Math.floor(S.kyoku / 4); }
  function roundLabel(S) { return WIND_NAMES[Math.floor(S.kyoku / 4)] + ((S.kyoku % 4) + 1) + '局'; }

  function startGame(S) {
    S.scores = [25000, 25000, 25000, 25000];
    S.kyoku = 0; S.honba = 0; S.kyotaku = 0;
    S.startDealer = Math.floor(Math.random() * 4);
    S.result = null; S.final = null;
    startHand(S);
  }

  function startHand(S) {
    const wall = shuffle([...Array(136).keys()]);
    S.dead = wall.splice(wall.length - 14, 14);
    S.wall = wall;
    S.doraCount = 1; S.kanCount = 0; S.rinshanUsed = 0;
    S.noCalls = true; S.rinshan = false; S.claim = null; S.result = null; S.drawn = null;
    S.lastDiscard = null;
    S.players = [0, 1, 2, 3].map(() => ({
      hand: [], melds: [], river: [], riichi: false, doubleRiichi: false, ippatsu: false,
      riichiPending: false, furitenTemp: false, furitenRiichi: false, kuikae: null,
    }));
    const d = dealerOf(S);
    for (let r = 0; r < 13; r++) for (let i = 0; i < 4; i++) S.players[(d + i) % 4].hand.push(S.wall.shift());
    S.players.forEach((p) => sortHand(p.hand));
    S.phase = 'turn';
    draw(S, d);
  }

  function sortHand(h) { h.sort((a, b) => a - b); }
  function doraIndicators(S) { return S.dead.slice(4, 4 + S.doraCount); }
  function uraIndicators(S) { return S.dead.slice(9, 9 + S.doraCount); }

  function draw(S, seat) {
    if (S.wall.length === 0) return exhaustiveDraw(S);
    const p = S.players[seat];
    const t = S.wall.shift();
    p.hand.push(t);
    p.furitenTemp = false;
    S.drawn = t; S.turn = seat; S.phase = 'turn'; S.rinshan = false;
  }

  function rinshanDraw(S, seat) {
    const p = S.players[seat];
    const t = S.dead[S.rinshanUsed++];
    S.wall.pop();
    S.doraCount++;
    p.hand.push(t);
    S.drawn = t; S.turn = seat; S.phase = 'turn'; S.rinshan = true;
  }

  function isMenzen(p) { return p.melds.every((m) => m.type === 'ankan'); }

  function isFuriten(p) {
    if (p.furitenTemp || p.furitenRiichi) return true;
    const w = waits(p.hand, p.melds.length);
    const discarded = new Set(p.river.map((r) => kindOf(r.id)));
    return w.some((k) => discarded.has(k));
  }

  function winContext(S, seat, winTile, opts) {
    const p = S.players[seat];
    const hand = opts.tsumo ? p.hand.slice() : p.hand.concat([winTile]);
    const first = S.noCalls && p.river.length === 0;
    return {
      hand, melds: p.melds, winTile, tsumo: !!opts.tsumo,
      seatWind: seatWind(S, seat), roundWind: roundWind(S), dealer: seat === dealerOf(S),
      riichi: p.riichi, doubleRiichi: p.doubleRiichi, ippatsu: p.ippatsu,
      haitei: opts.tsumo && S.wall.length === 0 && !S.rinshan,
      houtei: !opts.tsumo && !opts.chankan && S.wall.length === 0,
      rinshan: opts.tsumo && S.rinshan, chankan: !!opts.chankan,
      tenhou: opts.tsumo && first && seat === dealerOf(S),
      chiihou: opts.tsumo && first && seat !== dealerOf(S),
      doraInd: doraIndicators(S), uraInd: uraIndicators(S), aka: S.rules.aka,
    };
  }

  // 手番のプレイヤーができること
  function turnOptions(S, seat) {
    const p = S.players[seat];
    const o = { tsumo: null, riichi: [], kans: [], discardable: [] };
    if (S.phase !== 'turn' || S.turn !== seat) return o;
    if (S.drawn !== null) {
      const sc = scoreHand(winContext(S, seat, S.drawn, { tsumo: true }));
      if (sc) o.tsumo = sc;
    }
    const c = counts(p.hand);
    // 打牌できる牌
    if (p.riichi) o.discardable = [S.drawn];
    else {
      const forb = p.kuikae || [];
      o.discardable = p.hand.filter((id) => !forb.includes(kindOf(id)));
      if (!o.discardable.length) o.discardable = p.hand.slice();
    }
    // 立直
    if (!p.riichi && isMenzen(p) && S.drawn !== null && S.scores[seat] >= 1000 && S.wall.length >= 4 &&
        shanten(c, p.melds.length) <= 0) {
      const seen = new Set();
      for (const id of p.hand) {
        const k = kindOf(id);
        if (seen.has(k)) continue;
        seen.add(k);
        const rest = p.hand.slice(); rest.splice(rest.indexOf(id), 1);
        if (waits(rest, p.melds.length).length) o.riichi.push(k);
      }
    }
    // 槓
    if (S.drawn !== null && S.wall.length > 0 && S.kanCount < 4) {
      for (let k = 0; k < 34; k++) {
        if (c[k] === 4) {
          if (p.riichi) {
            if (kindOf(S.drawn) !== k) continue;
            const before = p.hand.filter((id) => id !== S.drawn);
            const after = p.hand.filter((id) => kindOf(id) !== k);
            const w1 = waits(before, p.melds.length).join(), w2 = waits(after, p.melds.length + 1).join();
            if (w1 !== w2 || !w1) continue;
          }
          o.kans.push({ type: 'ankan', k });
        }
      }
      if (!p.riichi) for (const m of p.melds) {
        const k = kindOf(m.tiles[0]);
        if (m.type === 'pon' && c[k] >= 1) o.kans.push({ type: 'kakan', k });
      }
    }
    return o;
  }

  // 捨て牌に対して他家ができること
  function claimOptions(S, seat, tileId, from, isChankan) {
    const p = S.players[seat];
    const k = kindOf(tileId);
    const opts = [];
    const withTile = counts(p.hand); withTile[k]++;
    if (shanten(withTile, p.melds.length) === -1 && !isFuriten(p)) {
      const sc = scoreHand(winContext(S, seat, tileId, { tsumo: false, chankan: isChankan }));
      if (sc) opts.push({ t: 'ron' });
    }
    if (isChankan || p.riichi || S.wall.length === 0) return opts;
    const same = p.hand.filter((id) => kindOf(id) === k);
    if (same.length >= 2) opts.push({ t: 'pon', tiles: pickTiles(same, 2) });
    if (same.length >= 3 && S.kanCount < 4) opts.push({ t: 'kan', tiles: same.slice(0, 3) });
    if (seat === (from + 1) % 4 && k < 27) {
      const n = k % 9;
      const combos = [[-2, -1], [-1, 1], [1, 2]];
      for (const [a, b] of combos) {
        if (n + a < 0 || n + b > 8) continue;
        const ta = p.hand.filter((id) => kindOf(id) === k + a);
        const tb = p.hand.filter((id) => kindOf(id) === k + b);
        if (ta.length && tb.length) opts.push({ t: 'chi', tiles: [pickTiles(ta, 1)[0], pickTiles(tb, 1)[0]] });
      }
    }
    return opts;
  }

  // 鳴くときは赤ドラを優先して使う
  function pickTiles(ids, n) {
    return ids.slice().sort((a, b) => (RED_IDS.includes(b) ? 1 : 0) - (RED_IDS.includes(a) ? 1 : 0)).slice(0, n);
  }

  function apply(S, a) {
    switch (a.type) {
      case 'discard': return doDiscard(S, a.seat, a.id, !!a.riichi);
      case 'tsumo': return doTsumo(S, a.seat);
      case 'kan': return doKan(S, a.seat, a.kanType, a.k);
      case 'respond': return doRespond(S, a.seat, a.resp);
      case 'next': return doNext(S);
      default: throw new Error('不明な操作');
    }
  }

  function assertTurn(S, seat) {
    if (S.phase !== 'turn' || S.turn !== seat) throw new Error('手番ではありません');
  }

  function doDiscard(S, seat, id, riichi) {
    assertTurn(S, seat);
    const p = S.players[seat];
    const o = turnOptions(S, seat);
    if (!o.discardable.includes(id)) throw new Error('その牌は切れません');
    if (riichi && !o.riichi.includes(kindOf(id))) throw new Error('立直できません');
    if (p.riichi && !p.riichiPending) p.ippatsu = false;
    p.hand.splice(p.hand.indexOf(id), 1);
    sortHand(p.hand);
    p.kuikae = null;
    const tsumogiri = id === S.drawn;
    if (riichi) {
      p.riichi = true; p.riichiPending = true; p.ippatsu = true;
      p.doubleRiichi = S.noCalls && p.river.length === 0;
    }
    p.river.push({ id, tsumogiri, riichi, called: false });
    S.drawn = null; S.rinshan = false;
    S.lastDiscard = { seat, id };
    openClaim(S, id, seat, 'discard');
  }

  function openClaim(S, tileId, from, kind) {
    const options = {};
    let any = false;
    for (let i = 1; i < 4; i++) {
      const s = (from + i) % 4;
      const o = claimOptions(S, s, tileId, from, kind === 'chankan');
      if (o.length) { options[s] = o; any = true; }
    }
    S.claim = { tile: tileId, from, kind, options, responses: {} };
    if (!any) return resolveClaim(S);
    S.phase = 'claim';
    // CPUは即答する
    for (const s in options) if (S.seats[s].bot) S.claim.responses[s] = botClaim(S, +s, options[s]);
    maybeResolve(S);
  }

  function doRespond(S, seat, resp) {
    if (S.phase !== 'claim') throw new Error('鳴きの受付は終わっています');
    const opts = S.claim.options[seat];
    if (!opts) throw new Error('鳴ける牌ではありません');
    if (S.claim.responses[seat]) throw new Error('もう選択済みです');
    if (resp.t !== 'pass') {
      const ok = opts.some((o) => o.t === resp.t && (!o.tiles || JSON.stringify(o.tiles) === JSON.stringify(resp.tiles)));
      if (!ok) throw new Error('選べない操作です');
    }
    S.claim.responses[seat] = resp;
    maybeResolve(S);
  }

  function maybeResolve(S) {
    const cl = S.claim;
    const prio = (t) => ({ ron: 3, pon: 2, kan: 2, chi: 1 }[t] || 0);
    let best = 0;
    for (const s in cl.responses) best = Math.max(best, prio(cl.responses[s].t));
    // 全員が答えたら処理。まだの人がいても、その人の選択肢が出ている宣言より弱ければ待たない
    // （ロン同士は同格なのでダブロンのために待つ）
    const waiting = Object.keys(cl.options).filter((s) => !cl.responses[s]);
    const maxPrio = (s) => Math.max(...cl.options[s].map((o) => prio(o.t)));
    if (!waiting.length || (best > 0 && waiting.every((s) => maxPrio(s) < best))) resolveClaim(S);
  }

  function resolveClaim(S) {
    const cl = S.claim;
    const order = [1, 2, 3].map((i) => (cl.from + i) % 4);
    const rons = order.filter((s) => cl.responses[s] && cl.responses[s].t === 'ron');
    // ロンを見逃した人はフリテン
    for (const s of order) {
      const opt = cl.options[s];
      const r = cl.responses[s];
      if (opt && opt.some((o) => o.t === 'ron') && r && r.t !== 'ron') {
        const p = S.players[s];
        p.furitenTemp = true;
        if (p.riichi) p.furitenRiichi = true;
      }
    }
    if (rons.length) return winRon(S, rons, cl.tile, cl.from, cl.kind === 'chankan');

    const discarder = S.players[cl.from];
    if (discarder.riichiPending) {
      discarder.riichiPending = false;
      S.scores[cl.from] -= 1000; S.kyotaku++;
    }
    S.phase = 'turn';
    if (cl.kind === 'chankan') { S.claim = null; return rinshanDraw(S, cl.from); }

    const caller = order.find((s) => cl.responses[s] && ['pon', 'kan'].includes(cl.responses[s].t))
      ?? order.find((s) => cl.responses[s] && cl.responses[s].t === 'chi');
    S.claim = null;
    if (caller === undefined) return draw(S, (cl.from + 1) % 4);

    const r = cl.responses[caller];
    const p = S.players[caller];
    for (const id of r.tiles) p.hand.splice(p.hand.indexOf(id), 1);
    discarder.river[discarder.river.length - 1].called = true;
    const tiles = r.tiles.concat([cl.tile]).sort((a, b) => a - b);
    S.players.forEach((q) => { q.ippatsu = false; });
    S.noCalls = false;
    const k = kindOf(cl.tile);
    if (r.t === 'kan') {
      p.melds.push({ type: 'minkan', tiles, from: cl.from, called: cl.tile });
      S.kanCount++;
      return rinshanDraw(S, caller);
    }
    p.melds.push({ type: r.t, tiles, from: cl.from, called: cl.tile });
    if (r.t === 'pon') p.kuikae = [k];
    else {
      const ks = r.tiles.map(kindOf).sort((a, b) => a - b);
      p.kuikae = [k];
      if (ks[0] === k + 1 && k % 9 <= 5) p.kuikae.push(k + 3);
      if (ks[1] === k - 1 && k % 9 >= 3) p.kuikae.push(k - 3);
    }
    p.furitenTemp = false;
    S.turn = caller; S.drawn = null; S.phase = 'turn';
  }

  function doKan(S, seat, type, k) {
    assertTurn(S, seat);
    const o = turnOptions(S, seat);
    if (!o.kans.some((x) => x.type === type && x.k === k)) throw new Error('槓できません');
    const p = S.players[seat];
    S.players.forEach((q) => { q.ippatsu = false; });
    S.noCalls = false;
    if (type === 'ankan') {
      const tiles = p.hand.filter((id) => kindOf(id) === k);
      p.hand = p.hand.filter((id) => kindOf(id) !== k);
      p.melds.push({ type: 'ankan', tiles, from: seat, called: null });
      S.kanCount++;
      return rinshanDraw(S, seat);
    }
    const id = p.hand.find((x) => kindOf(x) === k);
    p.hand.splice(p.hand.indexOf(id), 1);
    const m = p.melds.find((x) => x.type === 'pon' && kindOf(x.tiles[0]) === k);
    m.type = 'kakan'; m.tiles.push(id); m.added = id;
    S.kanCount++;
    S.drawn = null;
    openClaim(S, id, seat, 'chankan');
  }

  function doTsumo(S, seat) {
    assertTurn(S, seat);
    const sc = scoreHand(winContext(S, seat, S.drawn, { tsumo: true }));
    if (!sc) throw new Error('和了できません');
    const d = dealerOf(S);
    const delta = [0, 0, 0, 0];
    for (let s = 0; s < 4; s++) {
      if (s === seat) continue;
      let pay = seat === d ? ceil100(sc.base * 2) : (s === d ? ceil100(sc.base * 2) : ceil100(sc.base));
      pay += 100 * S.honba;
      delta[s] -= pay; delta[seat] += pay;
    }
    delta[seat] += S.kyotaku * 1000;
    finishHand(S, {
      type: 'tsumo',
      wins: [{ seat, from: null, tile: S.drawn, score: sc, hand: S.players[seat].hand.slice(), melds: S.players[seat].melds, ura: S.players[seat].riichi }],
      delta, renchan: seat === d,
    });
  }

  function winRon(S, seats, tile, from, chankan) {
    const d = dealerOf(S);
    const delta = [0, 0, 0, 0];
    const wins = [];
    seats.forEach((seat, i) => {
      const sc = scoreHand(winContext(S, seat, tile, { tsumo: false, chankan }));
      let pay = sc.total;
      if (i === 0) pay += 300 * S.honba;
      delta[from] -= pay; delta[seat] += pay;
      if (i === 0) delta[seat] += S.kyotaku * 1000;
      wins.push({ seat, from, tile, score: sc, hand: S.players[seat].hand.concat([tile]), melds: S.players[seat].melds, ura: S.players[seat].riichi });
    });
    finishHand(S, { type: 'ron', wins, delta, renchan: seats.includes(d) });
  }

  function exhaustiveDraw(S) {
    const tenpai = S.players.map((p) => waits(p.hand, p.melds.length).length > 0);
    const n = tenpai.filter(Boolean).length;
    const delta = [0, 0, 0, 0];
    if (n > 0 && n < 4) for (let s = 0; s < 4; s++) delta[s] = tenpai[s] ? 3000 / n : -3000 / (4 - n);
    finishHand(S, { type: 'draw', tenpai, hands: S.players.map((p, s) => (tenpai[s] ? p.hand.slice() : null)), delta, renchan: tenpai[dealerOf(S)] });
  }

  function finishHand(S, res) {
    for (let s = 0; s < 4; s++) S.scores[s] += res.delta[s];
    if (res.type !== 'draw') S.kyotaku = 0;
    res.label = roundLabel(S) + ' ' + S.honba + '本場';
    res.doraInd = doraIndicators(S);
    res.uraInd = uraIndicators(S);
    S.result = res;
    S.phase = 'result';
    S.claim = null;
    S.ready = {};
  }

  function rankOrder(S) {
    // 同点は起家に近い順
    return [0, 1, 2, 3].sort((a, b) => S.scores[b] - S.scores[a] || ((a - S.startDealer + 4) % 4) - ((b - S.startDealer + 4) % 4));
  }

  function doNext(S) {
    if (S.phase !== 'result') throw new Error('まだ局の途中です');
    const res = S.result;
    const d = dealerOf(S);
    const total = S.rules.length === 'tonpu' ? 4 : 8;
    const isLast = S.kyoku === total - 1;
    let over = S.scores.some((x) => x < 0);
    if (!over) {
      if (res.renchan) {
        if (isLast && rankOrder(S)[0] === d) over = true; // アガリやめ・テンパイやめ
        else S.honba++;
      } else {
        S.honba = res.type === 'draw' ? S.honba + 1 : 0;
        S.kyoku++;
        if (S.kyoku >= total) over = true;
      }
    }
    if (over) return endGame(S);
    startHand(S);
  }

  function endGame(S) {
    const order = rankOrder(S);
    S.scores[order[0]] += S.kyotaku * 1000;
    S.kyotaku = 0;
    const uma = [20, 10, -10, -20];
    const pts = [0, 0, 0, 0];
    order.forEach((s, r) => { pts[s] = Math.round(((S.scores[s] - 30000) / 1000 + uma[r]) * 10) / 10; });
    const rest = order.slice(1).reduce((a, s) => a + pts[s], 0);
    pts[order[0]] = Math.round(-rest * 10) / 10;
    S.final = { order, pts };
    S.phase = 'end';
  }

  /* ---------- CPU ---------- */

  function botClaim(S, seat, opts) {
    if (opts.some((o) => o.t === 'ron')) return { t: 'ron' };
    const pon = opts.find((o) => o.t === 'pon');
    if (pon) {
      const k = kindOf(pon.tiles[0]);
      if (k >= 31 || k === seatWind(S, seat) || k === roundWind(S)) return pon;
    }
    return { t: 'pass' };
  }

  function botTurn(S, seat) {
    const p = S.players[seat];
    const o = turnOptions(S, seat);
    if (o.tsumo) return { type: 'tsumo', seat };
    if (p.riichi) return { type: 'discard', seat, id: S.drawn };
    let best = null;
    const meld = p.melds.length;
    const visible = counts([].concat(...S.players.map((q) => q.river.map((r) => r.id)), ...S.players.map((q) => [].concat(...q.melds.map((m) => m.tiles))), doraIndicators(S)));
    const doraKinds = doraIndicators(S).map((i) => doraFromIndicator(kindOf(i)));
    const seen = new Set();
    for (const id of o.discardable) {
      const k = kindOf(id);
      if (seen.has(k + (RED_IDS.includes(id) ? 'r' : ''))) continue;
      seen.add(k + (RED_IDS.includes(id) ? 'r' : ''));
      const rest = p.hand.slice(); rest.splice(rest.indexOf(id), 1);
      const c = counts(rest);
      const sh = shanten(c, meld);
      let uke = 0;
      for (let j = 0; j < 34; j++) {
        if (c[j] >= 4) continue;
        c[j]++;
        if (shanten(c, meld) < sh) uke += Math.max(0, 4 - c[j] + 1 - visible[j]);
        c[j]--;
      }
      let value = 0;
      if (doraKinds.includes(k)) value += 3;
      if (RED_IDS.includes(id) && S.rules.aka) value += 3;
      if (k >= 31 || k === seatWind(S, seat) || k === roundWind(S)) value += counts(p.hand)[k] >= 2 ? 4 : 1;
      if (k < 27 && !isTerm(k)) value += 1;
      const score = -sh * 1000 + uke * 10 - value;
      if (!best || score > best.score) best = { id, score, sh };
    }
    const riichi = best.sh === 0 && o.riichi.includes(kindOf(best.id));
    return { type: 'discard', seat, id: best.id, riichi };
  }

  // CPUがいま何かすべきなら、その操作を返す
  function pendingBotAction(S) {
    if (S.phase === 'turn' && S.seats[S.turn].bot) return botTurn(S, S.turn);
    if (S.phase === 'claim') {
      for (const s in S.claim.options) {
        if (S.seats[s].bot && !S.claim.responses[s]) {
          return { type: 'respond', seat: +s, resp: botClaim(S, +s, S.claim.options[s]) };
        }
      }
    }
    return null;
  }

  const MJ = {
    RED_IDS, WIND_NAMES, kindOf, isHonor, counts, shanten, waits, scoreHand, doraFromIndicator,
    newGame, startGame, apply, turnOptions, claimOptions, pendingBotAction, botTurn,
    dealerOf, seatWind, roundWind, roundLabel, doraIndicators, isFuriten, rankOrder, clone,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = MJ;
  else root.MJ = MJ;
})(this);
