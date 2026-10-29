/* DAVYLAB Visual DNA Motion System — framework-neutral GSAP adapter.
   Load GSAP + (optionally) ScrollTrigger before this file.
   Motion for React and Three.js are documented as separate, opt-in adapters. */
(function (global) {
  "use strict";

  function prefersReducedMotion() {
    return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function canAnimate() {
    return !prefersReducedMotion() && !!global.gsap;
  }

  function noop() {
    return function () {};
  }

  function scope(root, build) {
    var gsap = global.gsap;
    if (!gsap || typeof build !== "function" || prefersReducedMotion()) return noop();

    if (typeof gsap.context === "function") {
      var context = gsap.context(function () {
        build(gsap);
      }, root || document);
      return function cleanupScope() {
        context.revert();
      };
    }

    // Older GSAP fallback: caller should return/kill its own timelines.
    var cleanup = build(gsap);
    return typeof cleanup === "function" ? cleanup : noop();
  }

  function reveal(target, options) {
    var gsap = global.gsap;
    if (!gsap || prefersReducedMotion() || !target) return null;
    var opts = Object.assign({
      y: 18,
      duration: 0.56,
      delay: 0,
      ease: "power3.out",
      stagger: 0,
      clearProps: "opacity,visibility,transform"
    }, options || {});

    return gsap.fromTo(target,
      { autoAlpha: 0, y: opts.y },
      {
        autoAlpha: 1,
        y: 0,
        duration: opts.duration,
        delay: opts.delay,
        ease: opts.ease,
        stagger: opts.stagger,
        clearProps: opts.clearProps,
        overwrite: "auto"
      }
    );
  }

  function scrollReveal(target, options) {
    var gsap = global.gsap;
    if (!gsap || !global.ScrollTrigger || prefersReducedMotion() || !target) return null;
    gsap.registerPlugin(global.ScrollTrigger);
    var opts = Object.assign({
      start: "top 88%",
      y: 18,
      duration: 0.56,
      ease: "power2.out",
      once: true
    }, options || {});

    return gsap.fromTo(target,
      { autoAlpha: 0, y: opts.y },
      {
        autoAlpha: 1,
        y: 0,
        duration: opts.duration,
        ease: opts.ease,
        clearProps: "opacity,visibility,transform",
        scrollTrigger: {
          trigger: opts.trigger || target,
          start: opts.start,
          once: opts.once
        }
      }
    );
  }

  function stopAmbientOnHidden(timeline) {
    if (!timeline || !document || !document.addEventListener) return noop();
    var onVisibilityChange = function () {
      if (document.hidden) timeline.pause();
      else timeline.resume();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return function cleanupVisibilityListener() {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }

  function resolveTargets(target) {
    if (!target) return [];
    if (typeof target === "string") {
      return global.document ? Array.prototype.slice.call(global.document.querySelectorAll(target)) : [];
    }
    if (target.nodeType === 1 && typeof target.animate === "function") return [target];
    if (typeof target.length === "number") return Array.prototype.slice.call(target).filter(function (item) {
      return item && item.nodeType === 1 && typeof item.animate === "function";
    });
    return [];
  }

  function applyPreset(target, config) {
    var options = config || {};
    var targets = resolveTargets(target);
    if (!targets.length || prefersReducedMotion()) return noop();

    var effect = options.effect || "fade-up";
    var rawDuration = Number(options.durationMs);
    var durationMs = Math.max(100, Math.min(5000, Number.isFinite(rawDuration) ? rawDuration : 560));
    var rawIntensity = Number(options.intensityPercent);
    var intensity = Math.max(0, Math.min(1.5, (Number.isFinite(rawIntensity) ? rawIntensity : 100) / 100));
    var rawDistance = Number(options.distancePx);
    var distance = Math.max(0, Math.min(200, Number.isFinite(rawDistance) ? rawDistance : 18)) * intensity;
    var rawStagger = Number(options.globalTokens && options.globalTokens.staggerMs);
    var staggerMs = Math.max(0, Math.min(1000, Number.isFinite(rawStagger) ? rawStagger : 0));
    var easing = typeof options.easing === "string" ? options.easing : "cubic-bezier(.2,.75,.25,1)";
    var looping = options.playback === "loop";
    var cycleDuration = looping ? Math.max(100, durationMs / 2) : durationMs;
    var iterations = looping ? 2 : 1;
    var direction = options.direction || "up";
    var offset = { up: [0, -distance], down: [0, distance], left: [-distance, 0], right: [distance, 0] }[direction] || [0, -distance];
    var animations = [];

    function transform(x, y, scale, rotate) {
      return "translate(" + x + "px," + y + "px) scale(" + scale + ") rotate(" + rotate + "deg)";
    }

    targets.forEach(function (element, index) {
      var frames;
      if (effect === "spring") {
        frames = [
          { transform: transform(0, 0, 0.82, 0) },
          { transform: transform(0, 0, 1.08, 0) },
          { transform: transform(0, 0, 0.97, 0) },
          { transform: transform(0, 0, 1, 0) }
        ];
      } else if (effect === "slide") {
        frames = [
          { opacity: 0, transform: transform(offset[0], offset[1], 0.98, 0) },
          { opacity: 1, transform: transform(0, 0, 1, 0) }
        ];
      } else if (effect === "blur") {
        frames = [
          { opacity: 0, filter: "blur(" + (10 * intensity) + "px)", transform: transform(0, 0, 0.98, 0) },
          { opacity: 1, filter: "blur(0px)", transform: transform(0, 0, 1, 0) }
        ];
      } else if (effect === "orbit") {
        frames = [
          { transform: transform(0, 0, 0.96, -18 * intensity) },
          { transform: transform(0, 0, 1, 342 * intensity) }
        ];
      } else if (effect === "stagger" || effect === "fade-up") {
        frames = [
          { opacity: 0, transform: transform(effect === "stagger" ? 0 : offset[0], effect === "stagger" ? -distance * 0.5 : offset[1], 0.96, 0) },
          { opacity: 1, transform: transform(0, 0, 1, 0) }
        ];
      } else {
        // Unknown IDs fail safely to a restrained fade-up instead of throwing.
        frames = [
          { opacity: 0, transform: transform(0, -distance, 0.98, 0) },
          { opacity: 1, transform: transform(0, 0, 1, 0) }
        ];
      }

      animations.push(element.animate(frames, {
        duration: cycleDuration,
        delay: effect === "stagger" ? staggerMs * index : 0,
        easing: easing,
        fill: "both",
        iterations: iterations
      }));
    });

    return function cleanupPreset() {
      animations.forEach(function (animation) {
        try { animation.cancel(); } catch (error) { /* no-op cleanup */ }
      });
    };
  }

  global.DAVYLABMotion = Object.freeze({
    version: "0.2.0",
    prefersReducedMotion: prefersReducedMotion,
    canAnimate: canAnimate,
    scope: scope,
    reveal: reveal,
    scrollReveal: scrollReveal,
    applyPreset: applyPreset,
    stopAmbientOnHidden: stopAmbientOnHidden
  });
})(window);
