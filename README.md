# CharReveal.js

CharReveal.js is a small, dependency-free JavaScript library that reveals text character by character or word by word when it enters the viewport.

It uses the browser's [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API) and `IntersectionObserver`, so the animation is triggered only when the text is visible. It also respects `prefers-reduced-motion` by default and displays the text immediately when animation APIs are unavailable.

## Demo

Open [`demo.html`](demo.html) in a browser, or serve this directory with any local static file server. The demo contains examples of the available trajectories, split modes, animation orders, replay behavior, and completion callbacks.

## Installation

### Browser script

Copy [`char-reveal.js`](char-reveal.js) into your project and load it before the code that creates an instance:

```html
<script src="char-reveal.js"></script>
<script>
  new CharReveal('.headline');
</script>
```

The library exposes the `CharReveal` constructor globally.

### CommonJS

The file also supports CommonJS environments:

```js
const CharReveal = require('./char-reveal.js');

const reveal = new CharReveal('.headline');
```

Because the library uses browser APIs, create an instance after the DOM and `window` are available.

## Basic use

Add a selector to the text you want to animate, then create an instance:

```html
<h1 class="headline">A more expressive headline.</h1>

<script src="char-reveal.js"></script>
<script>
  new CharReveal('.headline');
</script>
```

By default, text is split into characters and each character moves upward into place with a short stagger.

The constructor accepts a CSS selector, an `Element`, a `NodeList`, or an array of elements:

```js
new CharReveal('.headline');
new CharReveal(document.querySelector('.headline'));
new CharReveal(document.querySelectorAll('[data-reveal]'));
```

## Configuration

```js
const reveal = new CharReveal('.headline', {
  split: 'chars',
  trajectory: 'up',
  distance: 20,
  speed: 30,
  duration: 500,
  delay: 0,
  easing: 'cubic-bezier(0.2, 0.6, 0.2, 1)',
  order: 'normal',
  once: true,
  threshold: 0.4,
  rootMargin: '0px',
  root: null,
  respectReducedMotion: true,
  onEnter: function (element) {},
  onComplete: function (element) {}
});
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `split` | `'chars' \| 'words'` | `'chars'` | Animates individual characters or whitespace-separated words. Whitespace remains ordinary text so line wrapping is preserved. |
| `trajectory` | string or function | `'up'` | Entry animation. See the trajectory list below, or provide a custom keyframe function. |
| `distance` | number | `20` | Movement or blur distance in pixels. Used by trajectories that accept a distance. |
| `speed` | number | `30` | Delay in milliseconds between consecutive units. |
| `duration` | number | `500` | Duration in milliseconds for each unit animation. |
| `delay` | number | `0` | Initial delay in milliseconds before the first unit starts. |
| `easing` | string | `'cubic-bezier(0.2, 0.6, 0.2, 1)'` | CSS timing function passed to `element.animate()`. |
| `order` | `'normal' \| 'reverse' \| 'center' \| 'random'` | `'normal'` | Controls the order in which units start. |
| `once` | boolean | `true` | When `true`, the element animates once. When `false`, it resets and animates each time it leaves and re-enters the viewport. |
| `threshold` | number | `0.4` | Visible proportion required to trigger the animation. |
| `rootMargin` | string | `'0px'` | Margin around the observer root, using `IntersectionObserver` syntax. |
| `root` | `Element \| null` | `null` | Optional scroll container. `null` observes visibility in the browser viewport. |
| `respectReducedMotion` | boolean | `true` | Shows text immediately when the user has enabled reduced motion. |
| `onEnter` | function | `null` | Called with the target element when its animation starts. |
| `onComplete` | function | `null` | Called with the target element after its final unit finishes. |

## Trajectories and order

Built-in trajectories are:

- `up`: enters from below.
- `down`: enters from above.
- `left`: enters from the right.
- `right`: enters from the left.
- `scale`: grows from zero.
- `rotate`: rotates and moves into place.
- `blur`: fades in from a blur.
- `bounce`: moves past its final position and settles.
- `none`: fades in without movement.

The `order` option supports these patterns:

- `normal`: first unit to last unit.
- `reverse`: last unit to first unit.
- `center`: starts near the center and expands outward.
- `random`: starts in a random order.

## Custom trajectories

Pass a function that receives `distance` and returns an array of Web Animations API keyframes:

```js
new CharReveal('.headline', {
  distance: 32,
  trajectory: function (distance) {
    return [
      { opacity: 0, transform: 'translateY(' + distance + 'px) rotate(8deg)' },
      { opacity: 1, transform: 'translateY(0) rotate(0)' }
    ];
  }
});
```

## Common use cases

### Reveal several headings with one configuration

```html
<h2 class="reveal-heading">First section</h2>
<h2 class="reveal-heading">Second section</h2>

<script>
  new CharReveal('.reveal-heading', {
    trajectory: 'blur',
    split: 'words',
    speed: 80
  });
</script>
```

### Replay on every viewport entry

```js
new CharReveal('.repeating-heading', {
  trajectory: 'bounce',
  once: false,
  threshold: 0.6
});
```

### Start another effect after the reveal

```js
new CharReveal('.status', {
  onEnter: function (element) {
    element.classList.add('is-entering');
  },
  onComplete: function (element) {
    element.classList.add('is-complete');
  }
});
```

### Animate text inside a scrollable container

```js
const panel = document.querySelector('.scroll-panel');

new CharReveal('.panel-heading', {
  root: panel,
  rootMargin: '0px 0px -15% 0px',
  threshold: 0.5
});
```

## Instance methods

### `replay([target])`

Resets and replays every element managed by the instance. Pass an element or selector to replay only matching elements:

```js
reveal.replay();
reveal.replay('.headline');
```

### `destroy()`

Disconnects the shared observer for the instance and releases its element references. Use it when removing an animated section from a single-page application.

## Accessibility and browser behavior

- The original text is copied to `aria-label` on each target element so screen readers receive a complete, readable label rather than individual animated spans.
- Whitespace is not wrapped in spans, preserving normal browser line wrapping.
- When `respectReducedMotion` is `true` and the user prefers reduced motion, all units are shown immediately.
- If `IntersectionObserver` or the Web Animations API is unavailable, the text is shown immediately instead of remaining hidden.
- Modern evergreen browsers are supported. The Web Animations API is supported in Safari 13.1 and later, as well as current Chrome, Firefox, and Edge releases.

## Development

This project has no build step or runtime dependencies. Edit `char-reveal.js`, then open [`demo.html`](demo.html) in a browser to verify changes. A local server is useful when browser security policies prevent opening files directly:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/demo.html`.

## License

No license file is currently included in this repository. Add a license before distributing the library publicly.