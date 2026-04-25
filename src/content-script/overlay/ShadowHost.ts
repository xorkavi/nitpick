import { render, h } from 'preact';
import { OverlayApp } from './OverlayApp';
import overlayStyles from './styles.css?inline';
import { showCommentBubble } from '../signals';
import { effect } from '@preact/signals';

// Import Arcade token CSS as inline text (Vite ?inline query)
import arcadeCoreTokens from '../../tokens/arcade/core.css?inline';
import arcadeLightTokens from '../../tokens/arcade/light.css?inline';
import arcadeComponentTokens from '../../tokens/arcade/component.css?inline';

let shadowRoot: ShadowRoot | null = null;
let hostElement: HTMLElement | null = null;
let disposeEffect: (() => void) | null = null;

export function mountOverlay(): ShadowRoot {
  if (shadowRoot) return shadowRoot;

  hostElement = document.createElement('nitpick-overlay');
  hostElement.style.cssText = [
    'all: initial',
    'position: fixed',
    'top: 0',
    'left: 0',
    'width: 100vw',
    'height: 100vh',
    'z-index: 2147483647',
    'pointer-events: none',
  ].join('; ');

  shadowRoot = hostElement.attachShadow({ mode: 'closed' });

  // Inject tokens + overlay styles into shadow DOM
  const style = document.createElement('style');
  style.textContent = [
    arcadeCoreTokens,        // 90 core color/font variables
    arcadeLightTokens,       // 292 semantic light mode aliases
    arcadeComponentTokens,   // 317 component-level tokens
    overlayStyles,           // Overlay-specific rules referencing tokens
  ].join('\n');
  shadowRoot.appendChild(style);

  const mountPoint = document.createElement('div');
  mountPoint.id = 'nitpick-mount';
  shadowRoot.appendChild(mountPoint);

  render(h(OverlayApp, null), mountPoint);

  document.documentElement.appendChild(hostElement);

  disposeEffect = effect(() => {
    if (showCommentBubble.value) {
      document.documentElement.style.cursor = '';
    } else {
      document.documentElement.style.cursor = 'none';
    }
  });

  return shadowRoot;
}

export function unmountOverlay(): void {
  if (disposeEffect) {
    disposeEffect();
    disposeEffect = null;
  }
  document.documentElement.style.cursor = '';

  if (hostElement) {
    if (shadowRoot) {
      const mount = shadowRoot.getElementById('nitpick-mount');
      if (mount) render(null, mount);
    }
    hostElement.remove();
    hostElement = null;
    shadowRoot = null;
  }
}
