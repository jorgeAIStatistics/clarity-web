import {flushSync} from 'react-dom';
import './navigation.css';

let pending = null;
let running = false;
let committing = false;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));

function focusDestination() {
  const heading = [...document.querySelectorAll('main h1, h1')].find(node => node.getClientRects().length);
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({preventScroll: true});
  }
}

async function fade(node, from, to, duration) {
  if (!node?.animate || reducedMotion()) return;
  const animation = node.animate([{opacity: from}, {opacity: to}], {
    duration, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards',
  });
  try { await animation.finished; } catch { /* A superseding render may cancel it. */ }
  node.style.opacity = String(to);
  animation.cancel();
}

// Retain the outgoing page until it has faded out. The latest queued navigation
// wins before the swap, so rapid clicks do not cause stale routes to flash.
export async function transitionView(update, {focus = true} = {}) {
  if (committing) return update();
  pending = {update, focus};
  if (running) return;
  running = true;
  const shell = document.querySelector('[data-route-surface]');
  try {
    while (pending) {
      await fade(shell, 1, 0, 140);
      const next = pending;
      pending = null;
      committing = true;
      try { flushSync(next.update); } finally { committing = false; }
      await frame();
      await fade(shell, 0, 1, 260);
      if (next.focus && !pending) focusDestination();
    }
  } finally {
    if (shell) shell.style.removeProperty('opacity');
    running = false;
  }
}
export const withTransition = fn => (...args) => transitionView(() => fn(...args));

const disclosures = new WeakMap();
export function animateDisclosure(event) {
  const summary = event.target.closest?.('summary');
  const details = summary?.parentElement;
  if (!details || details.tagName !== 'DETAILS' || reducedMotion() || !details.animate) return false;
  event.preventDefault();
  const previous = disclosures.get(details);
  const opening = previous ? !previous.opening : !details.open;
  const start = details.getBoundingClientRect().height;
  previous?.animation.cancel();
  details.open = true;
  const end = opening ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height +
    parseFloat(getComputedStyle(details).paddingTop) + parseFloat(getComputedStyle(details).paddingBottom) +
    parseFloat(getComputedStyle(details).borderTopWidth) + parseFloat(getComputedStyle(details).borderBottomWidth);
  details.style.overflow = 'hidden';
  const animation = details.animate([{height: `${start}px`}, {height: `${end}px`}], {
    duration: 240, easing: 'cubic-bezier(.22,1,.36,1)',
  });
  disclosures.set(details, {animation, opening});
  animation.finished.then(() => {
    if (disclosures.get(details)?.animation !== animation) return;
    details.open = opening;
    details.style.removeProperty('overflow');
    disclosures.delete(details);
  }).catch(() => {});
  return true;
}
