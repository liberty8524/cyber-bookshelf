// Stable, category-aware art direction shared by the shelf and the detail cover.
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function designFor(book) {
  const seed = book.theme_style_seed >>> 0;
  const genre = ['技术','学习'].includes(book.category) ? 'technical' : book.category === '历史' ? 'heritage' : ['文学','小说'].includes(book.category) ? 'literary' : 'journal';
  const material = genre === 'heritage' ? 'leather' : genre === 'technical' ? 'matte' : seed % 3 === 0 ? 'paper' : 'cloth';
  return {seed, genre, material, edition: seed % 4, color: seed % 8,
    height: 183 + seed % 53, width: (genre === 'heritage' ? 56 : genre === 'technical' ? 43 : 46) + seed % 14,
    lean: seed % 6 === 0 ? -2 : seed % 9 === 0 ? 1.5 : 0,
    symbol: genre === 'technical' ? '⊞' : genre === 'heritage' ? '❧' : '✦'};
}
export function bookStyle(book) {
  const d = designFor(book);
  return `--book:var(--book-color-${d.color});--ink:var(--book-ink-${d.color});--height:${d.height}px;--width:${d.width}px;--lean:${d.lean}deg;--edition:${d.edition}`;
}
export function designClasses(book) {
  const d = designFor(book);
  return `genre-${d.genre} material-${d.material} edition-${d.edition}`;
}
export function coverContents(book) {
  const d = designFor(book);
  return `<span class="cover-imprint">藏 间 藏 书 · PERSONAL LIBRARY</span>
    <div class="cover-art" aria-hidden="true"><span></span><span></span><span></span><b>${d.symbol}</b></div>
    <div class="cover-titles"><span class="cover-category">${escape(book.category)}</span><h2>${escape(book.title)}</h2><p>${escape(book.author || '佚名')}</p></div>
    <span class="cover-colophon">THE READING ROOM <b>${String(d.seed % 99 + 1).padStart(2,'0')}</b></span>`;
}
export function coverMarkup(book) {
  return `<div class="cover ${designClasses(book)}" style="${bookStyle(book)}">${coverContents(book)}</div>`;
}
export function spineMarkup(book, index, featured = false) {
  const d = designFor(book);
  return `<button class="book ${designClasses(book)} ${featured ? 'face-out' : ''}" data-id="${book.id}"
    title="${escape(book.title)} · ${escape(book.author || '佚名')}" aria-label="查看《${escape(book.title)}》"
    style="${bookStyle(book)};--delay:${index * 22}ms">
      <span class="spine-face"><span class="spine-cap"></span><span class="spine-emblem">${d.symbol}</span>
      <span class="spine-title">${escape(book.title)}</span><span class="spine-author">${escape(book.author || '佚名')}</span>
      <span class="spine-footer"><span>${String(d.seed % 99 + 1).padStart(2,'0')}</span><b>藏</b></span></span>
      ${featured ? `<span class="front-face">${coverContents(book)}</span>` : ''}
      <span class="book-top" aria-hidden="true"></span>
      ${book.current_page > 1 ? '<span class="bookmark" aria-hidden="true"></span>' : ''}
    </button>`;
}
