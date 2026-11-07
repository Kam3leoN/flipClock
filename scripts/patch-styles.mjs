import fs from 'fs';

let scss = fs.readFileSync('src/styles.scss', 'utf8');

const fallback = `// FlipClock — Material You Expressive tokens + original flip geometry.

:root {
  color-scheme: dark;
  --md-sys-color-background: #0f0f0f;
  --md-sys-color-on-surface: #e6e1e5;
  --md-sys-color-surface-container: #211f22;
  --md-sys-color-surface-container-high: #2b292d;
  --md-sys-color-surface-container-highest: #363438;
  --md-sys-color-surface-container-low: #1d1b1e;
  --md-sys-color-primary: #d0bcff;
  --md-sys-color-on-primary: #381e72;
  --md-sys-color-primary-container: #4f378b;
  --md-sys-color-on-primary-container: #eaddff;
  --md-sys-color-outline: #938f99;
  --md-sys-color-outline-variant: #49454f;
  --md-sys-color-shadow: #000000;
  --md-sys-shape-corner-extra-large: 28px;
  --md-sys-shape-corner-large: 16px;
  --md-sys-shape-corner-full: 9999px;
  --md-sys-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --md-sys-motion-easing-emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
  --md-sys-motion-duration-short4: 200ms;
  --md-sys-motion-duration-medium2: 300ms;
  --md-sys-spacing-space100: 8px;
  --md-sys-spacing-space150: 12px;
  --md-sys-spacing-space200: 16px;
  --flip-digit: color-mix(in srgb, var(--md-sys-color-on-surface) 71.1%, transparent);
  --flip-face-top: var(--md-sys-color-surface-container-high);
  --flip-face-bottom: var(--md-sys-color-surface-container);
  --flip-face-inner-top: var(--md-sys-color-surface-container-highest);
  --flip-face-inner-bottom: var(--md-sys-color-surface-container-high);
  --flip-gap: var(--md-sys-color-background);
  --flip-seam-top: color-mix(in srgb, var(--md-sys-color-outline) 35%, transparent);
  --flip-seam-bottom: color-mix(in srgb, var(--md-sys-color-outline-variant) 55%, transparent);
  --flip-shadow: color-mix(in srgb, var(--md-sys-color-shadow) 50%, transparent);
}

`;

scss = scss.replace(/^\/\/ Fliqlo styles[\s\S]*?\n\n/, '');

const exact = [
  ['background-color: #000;', 'background-color: var(--md-sys-color-background);'],
  ['color: #fff;', 'color: var(--md-sys-color-on-surface);'],
  ['color: rgba(255, 255, 255, 0.711);', 'color: var(--flip-digit);'],
  ['color: rgba(255, 255, 255, 0.9);', 'color: color-mix(in srgb, var(--md-sys-color-on-surface) 90%, transparent);'],
  ['background-image: linear-gradient(to bottom, #161616, #0c0c0c);', 'background-image: linear-gradient(to bottom, var(--flip-face-top), var(--flip-face-bottom));'],
  ['background-image: linear-gradient(to bottom, #111, #0b0b0b);', 'background-image: linear-gradient(to bottom, var(--flip-face-inner-top), var(--flip-face-inner-bottom));'],
  ['border-bottom: solid 1px #080808;', 'border-bottom: solid 1px var(--flip-seam-top);'],
  ['border-top: solid 1px #151515;', 'border-top: solid 1px var(--flip-seam-bottom);'],
  ['border-bottom-color: #000;', 'border-bottom-color: var(--flip-gap);'],
  ['border-top-color: #000;', 'border-top-color: var(--flip-gap);'],
  ['box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);', 'box-shadow: 0 0 20px var(--flip-shadow);'],
];

for (const [a, b] of exact) {
  if (!scss.includes(a)) console.warn('MISSING', a);
  scss = scss.split(a).join(b);
}

scss = scss.replace(
  /(\.flip \{[\s\S]*?)background-color: var\(--md-sys-color-background\);/,
  '$1background-color: var(--flip-gap);',
);

const settingsOverride = `

/* —— Settings chrome (Material You Expressive) —— */
#settings {
  transform-origin: bottom center;
  position: absolute;
  display: inline-flex;
  box-sizing: border-box;
  left: 50%;
  bottom: var(--md-sys-spacing-space200);
  transform: translate(-50%, 0);
  z-index: 104;
  color: var(--md-sys-color-on-surface);
  padding: var(--md-sys-spacing-space100) var(--md-sys-spacing-space150);
  background-color: color-mix(in srgb, var(--md-sys-color-surface-container-high) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 60%, transparent);
  border-radius: var(--md-sys-shape-corner-extra-large);
  font-size: 13px;
  line-height: 1;
  gap: var(--md-sys-spacing-space100);
  backdrop-filter: blur(20px);
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--md-sys-color-shadow) 20%, transparent),
    0 8px 24px color-mix(in srgb, var(--md-sys-color-shadow) 24%, transparent);
  transition:
    opacity var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized),
    visibility var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized),
    transform var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized-decelerate);
}

body:not(.hover):not(.pause) #settings {
  opacity: 0;
  visibility: hidden;
  transform: translate(-50%, 8px);
}

body.hover #settings,
body.pause #settings {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, 0);
}

#settings dl {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: nowrap;
  margin: 0;
  gap: var(--md-sys-spacing-space100);
}

#settings dt {
  display: none;
}

#settings dd {
  position: relative;
  display: flex;
  align-items: center;
  height: 40px;
  margin: 0;
  overflow: visible;
  white-space: nowrap;
  padding: 0;
}

#settings dd > label {
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  min-width: 40px;
  padding: 0 var(--md-sys-spacing-space100);
  border-radius: var(--md-sys-shape-corner-full);
  overflow: hidden;
  transition: background-color var(--md-sys-motion-duration-short4)
    var(--md-sys-motion-easing-emphasized);
}

#settings dd > label:hover,
#settings dd > label:active {
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
}

#tf-container {
  display: inline-flex;
  position: relative;
  height: 40px;
  min-width: 40px;
  align-items: center;
  justify-content: center;
  padding: 0 var(--md-sys-spacing-space100);
  opacity: 1;
  overflow: hidden;
  border-radius: var(--md-sys-shape-corner-full);
}

#tf-container::before {
  content: attr(data-tf);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--md-sys-color-on-primary-container);
  background: var(--md-sys-color-primary-container);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  width: 32px;
  height: 32px;
  text-align: center;
  border-radius: var(--md-sys-shape-corner-full);
  box-sizing: border-box;
  border: 0;
  font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif;
  pointer-events: none;
  letter-spacing: 0;
  text-indent: 0;
}

#tf-container[data-tf='12']::before {
  text-indent: 0;
  letter-spacing: -0.5px;
}

#settings dd input[type='checkbox'] {
  display: none;
  outline: 0;
}

#settings dd input[type='checkbox'] + label {
  display: inline-flex;
  box-sizing: border-box;
  position: relative;
  height: 40px;
  width: 40px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 0;
  padding: 0;
  opacity: 1;
  border-radius: var(--md-sys-shape-corner-full);
}

#settings dd input[type='checkbox'] + label::before {
  content: '';
  display: inline-block;
  box-sizing: border-box;
  border: 2px solid var(--md-sys-color-outline);
  border-radius: 6px;
  width: 18px;
  height: 18px;
  margin: 0;
  background-color: transparent;
  transition:
    background-color var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-emphasized),
    border-color var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-emphasized);
}

#settings dd input[type='checkbox'] + label::after {
  display: none;
}

#settings input[type='checkbox']:checked + label::before {
  border-color: var(--md-sys-color-primary);
  background-color: var(--md-sys-color-primary);
  background-image: none;
  box-shadow: inset 0 0 0 3px var(--md-sys-color-on-primary);
}

#settings input[type='checkbox']:checked + label::after {
  display: none;
}

#brightness-container,
#scale-container {
  padding: 0 var(--md-sys-spacing-space100) 0 36px;
  min-width: 110px;
}

#scale-container::before,
#scale-container::after,
#brightness-container::before {
  opacity: 0.9;
  border-color: var(--md-sys-color-on-surface-variant, var(--md-sys-color-outline));
}

#theme-container {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  width: 40px;
  border-radius: var(--md-sys-shape-corner-full);
  border: 0;
  background: transparent;
  color: var(--md-sys-color-on-surface);
  cursor: pointer;
  font-size: 0;
  padding: 0;
  transition: background-color var(--md-sys-motion-duration-short4)
    var(--md-sys-motion-easing-emphasized);
}

#theme-container:hover {
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
}

#theme-container::before {
  content: '';
  width: 18px;
  height: 18px;
  border-radius: var(--md-sys-shape-corner-full);
  background: var(--md-sys-color-primary);
  box-shadow: inset -5px -2px 0 0 var(--md-sys-color-surface-container-high);
}

html[data-theme='light'] #theme-container::before {
  box-shadow: none;
  background: radial-gradient(
    circle at center,
    var(--md-sys-color-primary) 40%,
    transparent 41%
  );
  box-shadow:
    0 -7px 0 -4px var(--md-sys-color-primary),
    0 7px 0 -4px var(--md-sys-color-primary),
    7px 0 0 -4px var(--md-sys-color-primary),
    -7px 0 0 -4px var(--md-sys-color-primary),
    5px 5px 0 -4px var(--md-sys-color-primary),
    -5px 5px 0 -4px var(--md-sys-color-primary),
    5px -5px 0 -4px var(--md-sys-color-primary),
    -5px -5px 0 -4px var(--md-sys-color-primary);
}

input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 72px;
  height: 4px;
  box-sizing: content-box;
  margin: 0;
  padding: 0;
  background-color: color-mix(in srgb, var(--md-sys-color-outline) 40%, transparent);
  border-radius: var(--md-sys-shape-corner-full);
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  outline: 0;
}

input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--md-sys-color-shadow) 30%, transparent);
  border: 0;
  height: 16px;
  width: 16px;
  border-radius: var(--md-sys-shape-corner-full);
  background: var(--md-sys-color-primary);
}

#main {
  transform-origin: center center;
}

#loader {
  transition:
    opacity var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized);
}
`;

// Drop original #settings ... input[type=range] thumb block by cutting from #settings to before #main
const settingsStart = scss.indexOf('#settings {');
const mainStart = scss.indexOf('#main {');
if (settingsStart >= 0 && mainStart > settingsStart) {
  scss = scss.slice(0, settingsStart) + scss.slice(mainStart);
}

fs.writeFileSync('src/styles.scss', fallback + scss + settingsOverride);
console.log('written', fs.statSync('src/styles.scss').size);
console.log('anmTop', scss.includes('@keyframes anmTop'));
console.log('flip-digit', (fallback + scss).includes('--flip-digit'));
