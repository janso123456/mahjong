/* 牌の絵柄：34種類＋赤5を、SVGで描いてCSSの背景画像にする。
   クラス名は f<種類番号>（赤5は f<番号>r）。描画は 60×80 の座標系。 */
(function () {
  'use strict';
  const G = '#1d7a46', B = '#1f4a9e', R = '#c8282a', K = '#1b1b1b';
  const SERIF = "'Hiragino Mincho ProN','Yu Mincho','YuMincho','Noto Serif JP','MS Mincho',serif";

  // 筒子の丸
  const circ = (x, y, r, c) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x}" cy="${y}" r="${r * .74}" fill="#fff"/>` +
    `<circle cx="${x}" cy="${y}" r="${r * .52}" fill="${c}"/><circle cx="${x}" cy="${y}" r="${r * .2}" fill="#fff"/>`;

  // 索子の竹（節つき）。a は傾き
  const stick = (x, y, h, c, a) => {
    const w = 7.5;
    const t = a ? ` transform="rotate(${a} ${x} ${y + h / 2})"` : '';
    return `<g${t}><rect x="${x - w / 2}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c}"/>` +
      `<rect x="${x - 1}" y="${y + 2}" width="2" height="${h - 4}" rx="1" fill="#fff" opacity=".35"/>` +
      `<rect x="${x - w / 2 - .6}" y="${y + h / 2 - 1}" width="${w + 1.2}" height="2" rx="1" fill="${c}"/>` +
      `<rect x="${x - w / 2 - .6}" y="${y - .6}" width="${w + 1.2}" height="2.2" rx="1" fill="${c}"/>` +
      `<rect x="${x - w / 2 - .6}" y="${y + h - 1.6}" width="${w + 1.2}" height="2.2" rx="1" fill="${c}"/></g>`;
  };

  const text = (s, x, y, size, c, weight) =>
    `<text x="${x}" y="${y}" font-family="${SERIF}" font-size="${size}" font-weight="${weight || 700}" fill="${c}" text-anchor="middle" dominant-baseline="central">${s}</text>`;

  function pin(n, red) {
    const c = (col) => (red ? R : col);
    switch (n) {
      case 1: return circ(30, 40, 22, B) + `<circle cx="30" cy="40" r="7" fill="${R}"/><circle cx="30" cy="40" r="2.6" fill="#fff"/>` +
        [0, 45, 90, 135, 180, 225, 270, 315].map((d) => { const r = d * Math.PI / 180; return `<circle cx="${30 + Math.cos(r) * 12.5}" cy="${40 + Math.sin(r) * 12.5}" r="1.8" fill="${G}"/>`; }).join('');
      case 2: return circ(30, 21, 12, G) + circ(30, 59, 12, B);
      case 3: return circ(15, 15, 10, B) + circ(30, 40, 10, R) + circ(45, 65, 10, G);
      case 4: return circ(17, 22, 11, B) + circ(43, 22, 11, G) + circ(17, 58, 11, G) + circ(43, 58, 11, B);
      case 5: return circ(16, 17, 10, c(B)) + circ(44, 17, 10, c(G)) + circ(30, 40, 10, R) + circ(16, 63, 10, c(G)) + circ(44, 63, 10, c(B));
      case 6: return circ(18, 15, 9, G) + circ(42, 15, 9, G) + [44, 66].map((y) => circ(18, y, 9, R) + circ(42, y, 9, R)).join('');
      case 7: return circ(13, 11, 7.5, G) + circ(30, 19, 7.5, G) + circ(47, 27, 7.5, G) + [49, 69].map((y) => circ(18, y, 8.5, R) + circ(42, y, 8.5, R)).join('');
      case 8: return [11, 30.5, 50, 69.5].map((y) => circ(18, y, 8.6, B) + circ(42, y, 8.6, B)).join('');
      case 9: return [[15, B], [40, R], [65, G]].map(([y, col]) => circ(12.5, y, 8.6, col) + circ(30, y, 8.6, col) + circ(47.5, y, 8.6, col)).join('');
    }
    return '';
  }

  function sou(n, red) {
    const c = (col) => (red ? R : col);
    switch (n) {
      case 1: // 鳥
        return `<path d="M30 58 C18 70 10 66 12 56 C16 64 24 60 28 52Z" fill="${B}"/>` +
          `<path d="M30 58 C42 70 50 66 48 56 C44 64 36 60 32 52Z" fill="${R}"/>` +
          `<path d="M30 60 C27 72 33 72 30 60Z" fill="${G}" stroke="${G}" stroke-width="3"/>` +
          `<ellipse cx="30" cy="44" rx="10" ry="13" fill="${G}"/>` +
          `<ellipse cx="27" cy="45" rx="4" ry="8" fill="#fff" opacity=".35"/>` +
          `<circle cx="30" cy="24" r="7.5" fill="${G}"/><circle cx="32.5" cy="22.5" r="1.8" fill="#fff"/><circle cx="32.8" cy="22.5" r=".9" fill="${K}"/>` +
          `<path d="M37 25 L45 27 L37 29Z" fill="${R}"/>` +
          `<path d="M26 17 C24 10 30 8 30 14 C31 8 37 10 33 17Z" fill="${R}"/>`;
      case 2: return stick(30, 8, 26, G) + stick(30, 46, 26, B);
      case 3: return stick(30, 8, 26, B) + stick(17, 46, 26, G) + stick(43, 46, 26, G);
      case 4: return [8, 46].map((y) => stick(17, y, 26, y < 40 ? G : B) + stick(43, y, 26, y < 40 ? B : G)).join('');
      case 5: return [8, 48].map((y) => stick(14, y, 24, c(G)) + stick(46, y, 24, c(B))).join('') + stick(30, 28, 24, R);
      case 6: return [8, 46].map((y) => stick(13, y, 26, G) + stick(30, y, 26, G) + stick(47, y, 26, G)).join('');
      case 7: return stick(30, 4, 20, R) + [30, 55].map((y) => stick(13, y, 21, G) + stick(30, y, 21, G) + stick(47, y, 21, G)).join('');
      case 8: return [[8, 1], [46, -1]].map(([y, s]) =>
        stick(11, y, 26, G) + stick(23, y, 26, G, 22 * s) + stick(37, y, 26, G, -22 * s) + stick(49, y, 26, G)).join('');
      case 9: return [5, 30, 55].map((y) => stick(13, y, 20, G) + stick(30, y, 20, R) + stick(47, y, 20, G)).join('');
    }
    return '';
  }

  const MAN = '一二三四五六七八九';
  function man(n, red) {
    return text(MAN[n - 1], 30, 21, 30, red ? R : K) + text('萬', 30, 57, 34, R);
  }

  function honor(k) {
    if (k === 31) return ''; // 白は無地
    const ch = '東南西北 發中'[k - 27];
    const col = k === 32 ? G : k === 33 ? R : K;
    return text(ch, 30, 41, 46, col);
  }

  function face(k, red) {
    let body;
    if (k < 9) body = man(k + 1, red);
    else if (k < 18) body = pin(k - 8, red);
    else if (k < 27) body = sou(k - 17, red);
    else body = honor(k);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80">${body}</svg>`;
  }

  const url = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  let css = '';
  for (let k = 0; k < 34; k++) css += `.f${k}{background-image:${url(face(k, false))}}\n`;
  for (const k of [4, 13, 22]) css += `.f${k}r{background-image:${url(face(k, true))}}\n`;
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
})();
