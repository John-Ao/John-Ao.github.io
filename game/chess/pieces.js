// Original SVG silhouettes, shared geometry for both sides.
const shapes = {
  p: '<circle cx="32" cy="17" r="8"/><path d="M27 25h10l-2 9 6 14H23l6-14z"/>',
  r: '<path d="M18 11h7v7h4v-7h6v7h4v-7h7v15l-7 5 3 16H22l3-16-7-5z"/><path d="M19 25h26M25 31h14M24 42h16" fill="none" stroke="var(--piece-detail)"/><path d="M21 45h22v3H21z"/>',
  n: '<path d="M20 48c0-9 6-16 14-21l-7 1-5 5-8-3q-2-1 0-4l9-12 5-2 1-6 7 6c12 3 16 20 10 36z"/><path d="m29 8 3 9-7 1M36 17c8 6 10 16 6 25M33 32c-5 4-8 8-8 12" fill="none" stroke="var(--piece-detail)"/><path d="m16 27 5 1" fill="none" stroke="var(--piece-detail)"/><circle cx="26" cy="22" r="1.7" fill="var(--piece-detail)" stroke="none"/>',
  b: '<path d="M32 7c-2 6-13 11-13 20 0 6 6 10 10 11l-7 10h20l-7-10c4-1 10-5 10-11 0-9-11-14-13-20z"/><path d="m35 18-7 11M25 39h14" fill="none"/>',
  q: '<path d="m18 20 8 9 6-15 6 15 8-9-6 24H24z"/><circle cx="17" cy="17" r="4"/><circle cx="32" cy="11" r="4"/><circle cx="47" cy="17" r="4"/><path d="M23 43h18v5H23z"/>',
  k: '<path d="M29 7h6v6h6v6h-6v7h-6v-7h-6v-6h6z"/><path d="M25 47c0-11-9-13-9-20 0-8 11-10 16 0 5-10 16-8 16 0 0 7-9 9-9 20z"/><path d="M24 40h16" fill="none"/>'
};
export const names = {p:'兵',r:'车',n:'马',b:'象',q:'后',k:'王'};
export function pieceSVG(type,color) {
 return `<svg class="piece" viewBox="0 0 64 64" aria-hidden="true" style="--piece-detail:${color==='w'?'#504a3f':'#b8c0b5'}"><g fill="${color==='w'?'#fffaf0':'#343936'}" stroke="${color==='w'?'#504a3f':'#b8c0b5'}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${shapes[type]}<path d="M22 48h20l4 7H18z"/><path d="M17 55h30v4H17z"/></g></svg>`;
}
