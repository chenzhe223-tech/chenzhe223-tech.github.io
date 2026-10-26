/* MelodyMe GSAP motion layer.
 * Progressive enhancement only: the app remains usable if GSAP/CDN is unavailable.
 * Keep animations short, transform/opacity-first, and respectful of reduced motion.
 */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined") return;

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var gsap = window.gsap;
  if (reduced || !gsap) return;

  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  function init() {
    var hero = document.querySelector(".hero");
    if (hero) {
      var intro = hero.querySelectorAll(".eyebrow, h1, p, .heroactions, .hint");
      if (intro.length) {
        gsap.from(intro, {
          y: 14,
          autoAlpha: 0,
          duration: 0.65,
          stagger: 0.075,
          ease: "power2.out",
          clearProps: "transform"
        });
      }
      var map = hero.querySelector(".map");
      if (map) gsap.from(map, {
        y: 12,
        autoAlpha: 0,
        scale: 0.985,
        duration: 0.8,
        delay: 0.12,
        ease: "power2.out",
        clearProps: "transform"
      });
    }

    if (window.ScrollTrigger) {
      gsap.utils.toArray(".section .secthead, .section .layout > .card").forEach(function (el) {
        gsap.from(el, {
          y: 16,
          autoAlpha: 0,
          duration: 0.55,
          ease: "power2.out",
          clearProps: "transform",
          scrollTrigger: {
            trigger: el,
            start: "top 90%",
            once: true
          }
        });
      });
    }

    // The route's existing playback logic remains the source of truth.
    // GSAP only adds a restrained visual pulse while the existing playing class is present.
    var mapCard = document.querySelector(".city-map-card");
    var route = document.querySelector("#cityRoutePath");
    if (mapCard && route && window.MutationObserver) {
      var pulse = null;
      function syncRouteMotion() {
        if (mapCard.classList.contains("is-playing")) {
          if (pulse) pulse.kill();
          pulse = gsap.to(route, {
            opacity: 0.72,
            duration: 0.7,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut"
          });
        } else {
          if (pulse) pulse.kill();
          pulse = null;
          gsap.to(route, { opacity: 1, duration: 0.18, overwrite: true });
        }
      }
      new MutationObserver(syncRouteMotion).observe(mapCard, {
        attributes: true,
        attributeFilter: ["class"]
      });
      syncRouteMotion();
    }

    // Small touch-safe press feedback. Avoid changing layout dimensions.
    document.querySelectorAll(".primary, .heroactions .ghost").forEach(function (button) {
      button.addEventListener("pointerdown", function () {
        gsap.to(button, { scale: 0.985, duration: 0.1, overwrite: true });
      }, { passive: true });
      ["pointerup", "pointercancel", "pointerleave"].forEach(function (eventName) {
        button.addEventListener(eventName, function () {
          gsap.to(button, { scale: 1, duration: 0.18, ease: "power2.out", overwrite: true });
        }, { passive: true });
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
