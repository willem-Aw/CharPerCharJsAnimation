/**
 * CharReveal.js
 * ---------------------------------------------------------------------------
 * Small dependency-free library for animating text character by character
 * (or word by word) when it enters the viewport.
 *
 * How it works:
 *   1. Resolve the target element(s) from a selector.
 *   2. Split their text into <span class="cr-unit"> elements (one span per
 *      character, or per word according to `split`), preserving whitespace
 *      as real text nodes so natural line wrapping is not broken.
 *   3. A single shared IntersectionObserver watches these elements. When an
 *      element enters the viewport, its units are animated with the Web
 *      Animations API (element.animate), using an increasing delay (stagger)
 *      between each unit.
 *
 * Compatibility:
 *   - Web Animations API: all evergreen browsers (Safari since 13.1,
 *     Chrome/Firefox/Edge for many years).
 *   - IntersectionObserver: all evergreen browsers. If unavailable, the
 *     library degrades gracefully: text is shown immediately without
 *     animation rather than remaining invisible.
 *   - prefers-reduced-motion is respected by default: when the user has
 *     requested reduced animation, the text appears immediately.
 *
 * Minimal usage:
 *   new CharReveal('.mon-titre');
 *
 * Full usage:
 *   const reveal = new CharReveal('.mon-titre', {
 *     split: 'chars',            // 'chars' | 'words'
 *     trajectory: 'up',          // 'up' | 'down' | 'left' | 'right' |
 *                                // 'scale' | 'rotate' | 'blur' | 'bounce' |
 *                                // 'none' | une fonction (distance) => keyframes
 *     distance: 20,              // movement amplitude, in px
 *     speed: 30,                 // ms between each character (the "stagger")
 *     duration: 500,             // duration of each character animation, in ms
 *     delay: 0,                  // delay before the first character, in ms
 *     easing: 'cubic-bezier(0.2, 0.6, 0.2, 1)',
 *     order: 'normal',           // 'normal' | 'reverse' | 'center' | 'random'
 *     once: true,                // false = replay on every entry/exit
 *     threshold: 0.4,            // visibility threshold for triggering (0-1)
 *     rootMargin: '0px',
 *     root: null,                // scrollable container, instead of the window
 *     respectReducedMotion: true,
 *     onEnter: (el) => {},       // called when animation starts on an element
 *     onComplete: (el) => {},    // called when the last character finishes
 *   });
 *
 *   reveal.replay();   // replay the animation on all elements
 *   reveal.destroy();  // disconnect the observer and release resources
 * ---------------------------------------------------------------------------
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CharReveal = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /**
  * Default trajectories. Each is a function that receives `distance` (px)
  * and returns an array of keyframes compatible with element.animate(). A
  * custom function can also be passed through the `trajectory` option.
  */
  var TRAJECTORIES = {
    up: function (d) {
      return [
        { opacity: 0, transform: 'translateY(' + d + 'px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ];
    },
    down: function (d) {
      return [
        { opacity: 0, transform: 'translateY(-' + d + 'px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ];
    },
    left: function (d) {
      return [
        { opacity: 0, transform: 'translateX(' + d + 'px)' },
        { opacity: 1, transform: 'translateX(0)' }
      ];
    },
    right: function (d) {
      return [
        { opacity: 0, transform: 'translateX(-' + d + 'px)' },
        { opacity: 1, transform: 'translateX(0)' }
      ];
    },
    scale: function () {
      return [
        { opacity: 0, transform: 'scale(0)' },
        { opacity: 1, transform: 'scale(1)' }
      ];
    },
    rotate: function (d) {
      return [
        { opacity: 0, transform: 'rotate(-40deg) translateY(' + d + 'px)' },
        { opacity: 1, transform: 'rotate(0) translateY(0)' }
      ];
    },
    blur: function (d) {
      return [
        { opacity: 0, filter: 'blur(' + Math.max(d, 4) + 'px)' },
        { opacity: 1, filter: 'blur(0)' }
      ];
    },
    bounce: function (d) {
      return [
        { opacity: 0, transform: 'translateY(' + d + 'px) scale(0.3)', offset: 0 },
        { opacity: 1, transform: 'translateY(-' + Math.round(d * 0.25) + 'px) scale(1.1)', offset: 0.6 },
        { opacity: 1, transform: 'translateY(0) scale(1)', offset: 1 }
      ];
    },
    none: function () {
      return [{ opacity: 0 }, { opacity: 1 }];
    }
  };

  var DEFAULTS = {
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
    unitClassName: 'cr-unit',
    onEnter: null,
    onComplete: null
  };

  function extend(base, extra) {
    var out = {};
    var k;
    for (k in base) if (base.hasOwnProperty(k)) out[k] = base[k];
    for (k in extra) if (extra.hasOwnProperty(k)) out[k] = extra[k];
    return out;
  }

  // Recursively split a node's content into spans while preserving nested
  // elements (for example, <strong>) and whitespace.
  function splitNode(node, units, mode, unitClassName) {
    var children = Array.prototype.slice.call(node.childNodes);
    children.forEach(function (child) {
      if (child.nodeType === 3) {
        var frag = document.createDocumentFragment();
        var pieces = mode === 'words'
          ? child.textContent.split(/(\s+)/)
          : Array.from(child.textContent);

        pieces.forEach(function (piece) {
          if (piece === '') return;
          if (/^\s+$/.test(piece)) {
            // Keep whitespace as plain text so the browser's natural line
            // wrapping continues to work.
            frag.appendChild(document.createTextNode(piece));
            return;
          }
          var span = document.createElement('span');
          span.className = unitClassName;
          span.style.display = 'inline-block';
          span.style.opacity = '0';
          span.style.willChange = 'transform, opacity';
          span.textContent = piece;
          units.push(span);
          frag.appendChild(span);
        });

        node.replaceChild(frag, child);
      } else if (child.nodeType === 1) {
        splitNode(child, units, mode, unitClassName);
      }
    });
  }

  function computeOrder(total, mode) {
    var indices = [];
    var i;
    for (i = 0; i < total; i++) indices.push(i);

    if (mode === 'reverse') {
      return indices.map(function (i) { return total - 1 - i; });
    }

    if (mode === 'center') {
      var mid = (total - 1) / 2;
      var byDistance = indices.slice().sort(function (a, b) {
        return Math.abs(a - mid) - Math.abs(b - mid);
      });
      var order = new Array(total);
      byDistance.forEach(function (originalIndex, rank) { order[originalIndex] = rank; });
      return order;
    }

    if (mode === 'random') {
      var shuffled = indices.slice();
      for (var j = shuffled.length - 1; j > 0; j--) {
        var k = Math.floor(Math.random() * (j + 1));
        var tmp = shuffled[j];
        shuffled[j] = shuffled[k];
        shuffled[k] = tmp;
      }
      var randomOrder = new Array(total);
      shuffled.forEach(function (originalIndex, rank) { randomOrder[originalIndex] = rank; });
      return randomOrder;
    }

    return indices; // 'normal'
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function CharReveal(selector, options) {
    this.opts = extend(DEFAULTS, options || {});
    this.elements = this._resolveElements(selector);
    this.observer = null;

    this._prepare();

    var skipAnimation =
      (this.opts.respectReducedMotion && prefersReducedMotion()) ||
      !('IntersectionObserver' in window) ||
      !('animate' in document.createElement('span'));

    if (skipAnimation) {
      // Graceful fallback: IntersectionObserver or the Web Animations API is
      // unavailable, or the user prefers reduced motion. Show the text
      // immediately rather than leaving it invisible.
      var self = this;
      this.elements.forEach(function (el) { self._showInstantly(el); });
      return;
    }

    this._setupObserver();
  }

  CharReveal.prototype._resolveElements = function (selector) {
    if (typeof selector === 'string') {
      return Array.prototype.slice.call(document.querySelectorAll(selector));
    }
    if (selector instanceof NodeList || Array.isArray(selector)) {
      return Array.prototype.slice.call(selector);
    }
    if (selector instanceof Element) {
      return [selector];
    }
    return [];
  };

  CharReveal.prototype._prepare = function () {
    var opts = this.opts;
    this.elements.forEach(function (el) {
      if (el.hasAttribute('data-cr-ready')) return; // déjà découpé
      var units = [];
      splitNode(el, units, opts.split, opts.unitClassName);
      el.__crUnits = units;
      el.setAttribute('data-cr-ready', 'true');
      el.setAttribute('aria-label', el.textContent); // garde un texte lisible pour les lecteurs d'écran
    });
  };

  CharReveal.prototype._setupObserver = function () {
    var self = this;
    var opts = this.opts;

    this.observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        if (entry.isIntersecting) {
          self._play(el);
          if (opts.once) self.observer.unobserve(el);
        } else if (!opts.once) {
          self._reset(el);
        }
      });
    }, {
      threshold: opts.threshold,
      rootMargin: opts.rootMargin,
      root: opts.root
    });

    this.elements.forEach(function (el) { self.observer.observe(el); });
  };

  CharReveal.prototype._play = function (el) {
    var opts = this.opts;
    var units = el.__crUnits || [];
    var total = units.length;
    if (!total) return;

    var trajectoryFn = typeof opts.trajectory === 'function'
      ? opts.trajectory
      : (TRAJECTORIES[opts.trajectory] || TRAJECTORIES.up);

    var order = computeOrder(total, opts.order);

    if (typeof opts.onEnter === 'function') opts.onEnter(el);

    var finished = 0;
    units.forEach(function (unit, i) {
      var rank = order[i];
      var anim = unit.animate(trajectoryFn(opts.distance), {
        duration: opts.duration,
        delay: opts.delay + rank * opts.speed,
        easing: opts.easing,
        fill: 'forwards'
      });
      anim.onfinish = function () {
        finished++;
        if (finished === total && typeof opts.onComplete === 'function') {
          opts.onComplete(el);
        }
      };
    });
  };

  CharReveal.prototype._reset = function (el) {
    var units = el.__crUnits || [];
    units.forEach(function (unit) {
      if (typeof unit.getAnimations === 'function') {
        unit.getAnimations().forEach(function (a) { a.cancel(); });
      }
      unit.style.opacity = '0';
    });
  };

  CharReveal.prototype._showInstantly = function (el) {
    var units = el.__crUnits || [];
    units.forEach(function (unit) { unit.style.opacity = '1'; });
  };

  // Replay the animation. Without an argument, replay all elements in the
  // instance. With an element or selector, replay only that target.
  CharReveal.prototype.replay = function (target) {
    var self = this;
    var list = target ? this._resolveElements(target) : this.elements;
    list.forEach(function (el) {
      self._reset(el);
      // Force a reflow so the animation restarts cleanly from opacity: 0.
      void el.offsetWidth;
      self._play(el);
    });
  };

  CharReveal.prototype.destroy = function () {
    if (this.observer) this.observer.disconnect();
    this.elements = [];
  };

  return CharReveal;
});
