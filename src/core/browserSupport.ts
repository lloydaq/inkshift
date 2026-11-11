/**
 * Feature detection for the ink transition. Capabilities are detected, never inferred
 * from the browser's name.
 */

/** `document.startViewTransition` exists. */
export function supportsViewTransitions(doc: Document = document): boolean {
  return typeof doc.startViewTransition === 'function';
}

/**
 * Web Animations can target a pseudo-element. The splat animates
 * `::view-transition-new(root)`: without this the mask would land on the live page.
 */
export function supportsPseudoElementAnimation(): boolean {
  return (
    typeof KeyframeEffect !== 'undefined' &&
    'pseudoElement' in KeyframeEffect.prototype &&
    typeof Element !== 'undefined' &&
    typeof Element.prototype.animate === 'function'
  );
}

/** CSS masks with multiple layers, unprefixed or `-webkit-` prefixed. */
export function supportsMask(): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
  return CSS.supports('mask-image', 'none, none') || CSS.supports('-webkit-mask-image', 'none, none');
}

/** Everything the ink bleed needs. Without it, Inkshift cross-fades instead. */
export function supportsInkTransition(doc: Document = document): boolean {
  return supportsViewTransitions(doc) && supportsPseudoElementAnimation() && supportsMask();
}
