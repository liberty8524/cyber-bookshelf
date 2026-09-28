// One shared actor travels between the shelf and cover. Layout is read once;
// animation frames change only transform and opacity (Web Animations API).
let active = null;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function cancelBookMotion() {
  if (!active) return;
  const current = active;
  active = null;
  current.animations.forEach(animation => animation.cancel());
  current.actor.remove();
  current.source.classList.remove('book-away');
  current.cover.style.visibility = '';
  current.neighbors.forEach(node => node.classList.remove('make-room-left','make-room-right'));
}
export async function moveBook(source, cover, returning = false) {
  cancelBookMotion();
  if (!source?.isConnected || !cover?.isConnected || reducedMotion()) return;
  const from = source.getBoundingClientRect(), to = cover.getBoundingClientRect();
  const scale = from.height / to.height;
  const featured = source.classList.contains('face-out');
  const actor = document.createElement('div');
  actor.className = 'book-flight';
  actor.setAttribute('aria-hidden','true');
  actor.style.width = to.width + 'px';
  actor.style.height = to.height + 'px';
  actor.style.setProperty('--flight-spine-width', from.width / scale + 'px');
  const front = cover.cloneNode(true);
  front.classList.add('flight-front');
  const spine = source.cloneNode(true);
  spine.removeAttribute('data-id');
  spine.removeAttribute('title');
  spine.removeAttribute('aria-label');
  spine.tabIndex = -1;
  spine.classList.remove('book-away','face-out');
  spine.classList.add('flight-spine');
  actor.append(front,spine);
  document.body.append(actor);
  const neighbors = [source.previousElementSibling,source.nextElementSibling].filter(node => node?.classList.contains('book'));
  neighbors.forEach(node => node.classList.add(node === source.previousElementSibling ? 'make-room-left' : 'make-room-right'));
  source.classList.add('book-away');
  cover.style.visibility = 'hidden';
  const frames = [
    {transform:`translate3d(${from.x}px,${from.y}px,0) scale(${scale})`,offset:0},
    {transform:`translate3d(${from.x-12}px,${from.y-22}px,0) scale(${scale*1.08})`,offset:.28},
    {transform:`translate3d(${to.x}px,${to.y}px,0) scale(1)`,offset:1}
  ];
  const faceFrames = [
    {transform:`perspective(1100px) rotateY(${featured ? -5 : -76}deg)`,opacity:featured?1:0,offset:0},
    {transform:'perspective(1100px) rotateY(-56deg)',opacity:1,offset:.35},
    {transform:'perspective(1100px) rotateY(0deg)',opacity:1,offset:1}
  ];
  const spineFrames = [{opacity:featured?0:1,transform:'translateZ(2px) rotateY(0deg)',offset:0},
    {opacity:featured?0:1,transform:'translateZ(2px) rotateY(18deg)',offset:.22},
    {opacity:0,transform:'translateZ(2px) rotateY(80deg)',offset:.7},
    {opacity:0,transform:'translateZ(2px) rotateY(80deg)',offset:1}];
  const options = {duration:returning?480:620,easing:'cubic-bezier(.22,.72,.18,1)',fill:'both',direction:returning?'reverse':'normal'};
  const animations = [actor.animate(frames,options),front.animate(faceFrames,options),spine.animate(spineFrames,options)];
  const current = {actor,source,cover,neighbors,animations};
  active = current;
  try { await Promise.all(animations.map(animation => animation.finished)); } catch {}
  if (active === current) {
    actor.remove();
    cover.style.visibility = '';
    source.classList.remove('book-away');
    neighbors.forEach(node => node.classList.remove('make-room-left','make-room-right'));
    active = null;
  }
}
