/* 牌の絵柄：tiles/ フォルダの画像（34種類＋赤5）をCSSの背景画像にする。
   クラス名は f<種類番号>（赤5は f<番号>r）。画像は牌の土台（青い部分）まで含む。 */
(function () {
  'use strict';
  const V = 1; // 画像を差し替えたら上げる（古い画像が残らないように）
  const names = [];
  for (let k = 0; k < 34; k++) names.push(String(k));
  names.push('4r', '13r', '22r');
  const el = document.createElement('style');
  el.textContent = names.map((n) => `.f${n}{background-image:url("tiles/${n}.png?v=${V}")}`).join('\n');
  document.head.appendChild(el);
  // 最初の描画で牌が一瞬消えないよう、先に読み込んでおく
  for (const n of names) { const im = new Image(); im.src = `tiles/${n}.png?v=${V}`; }
})();
