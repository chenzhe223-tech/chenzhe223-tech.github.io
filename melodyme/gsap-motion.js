/* MelodyMe GSAP motion layer.
 * Progressive enhancement only: the app remains usable if GSAP/CDN is unavailable.
 * Motion is transform/opacity-first, short, touch-safe, and respects reduced motion.
 */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined") return;

  var motionPreference = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var gsap = window.gsap;
  if ((motionPreference && motionPreference.matches) || !gsap) return;

  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  var routePath = null;
  var routePulse = null;
  var mapCard = null;
  var audio = null;
  var observedMap = null;
  var observedPoster = null;
  var observedResults = null;
  var posterMotionKey = "";
  var posterEpoch = 0;
  var resultsWereShown = false;

  function animateHero() {
    var hero = document.querySelector(".hero");
    if (!hero || hero.dataset.gsapIntro === "done") return;
    hero.dataset.gsapIntro = "done";
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

  function animateSections() {
    if (!window.ScrollTrigger) return;
    gsap.utils.toArray(".section .secthead, .section .layout > .card").forEach(function (el) {
      if (el.closest(".hidden") || el.dataset.gsapReveal === "done") return;
      el.dataset.gsapReveal = "done";
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
    window.ScrollTrigger.refresh();
  }

  function observeSections() {
    if (!window.MutationObserver) return;
    document.querySelectorAll(".section").forEach(function (section) {
      new MutationObserver(function () {
        if (!section.classList.contains("hidden")) animateSections();
      }).observe(section, { attributes: true, attributeFilter: ["class"] });
    });
  }

  function routeProgress() {
    if (!routePath || !audio) return;
    // Keep the initial route reveal visible until playback starts; metadata events
    // can fire while paused at time zero and must not hide the route again.
    if (audio.paused && !(audio.currentTime > 0)) return;
    var duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    var progress = duration ? Math.max(0, Math.min(1, (audio.currentTime || 0) / duration)) : 0;
    // The SVG uses pathLength="1", making audio progress independent of map dimensions.
    gsap.set(routePath, { strokeDasharray: 1, strokeDashoffset: 1 - progress });
  }

  function syncRoutePulse() {
    if (!routePath || !mapCard) return;
    if (mapCard.classList.contains("is-playing")) {
      if (routePulse) routePulse.kill();
      routePulse = gsap.to(routePath, {
        opacity: 0.76,
        duration: 0.7,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
        overwrite: true
      });
    } else {
      if (routePulse) routePulse.kill();
      routePulse = null;
      gsap.to(routePath, { opacity: 1, duration: 0.18, overwrite: true });
    }
  }

  function bindRouteIfPresent() {
    var nextPath = document.querySelector("#cityMapCanvas #cityRoutePath");
    if (nextPath && nextPath !== routePath) {
      if (routePulse) routePulse.kill();
      routePulse = null;
      routePath = nextPath;

      // Override the legacy CSS keyframe only when GSAP is available.
      // Audio events below are the source of truth for route progress and pause/resume.
      routePath.style.animation = "none";
      gsap.set(routePath, { strokeDasharray: 1, strokeDashoffset: 1, opacity: 1 });

      var pins = routePath.parentNode ? routePath.parentNode.querySelectorAll(".city-map-pin") : [];
      gsap.fromTo(routePath,
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 0.85, ease: "power2.out", overwrite: true }
      );
      if (pins.length) {
        gsap.from(pins, {
          scale: 0.72,
          autoAlpha: 0,
          transformOrigin: "center center",
          duration: 0.42,
          stagger: 0.1,
          delay: 0.16,
          ease: "back.out(1.5)",
          clearProps: "transform"
        });
      }
      routeProgress();
      syncRoutePulse();
    }
  }

  function initAudioSync() {
    audio = document.querySelector("#cityAudio");
    mapCard = document.querySelector(".city-map-card");
    if (!audio || audio.dataset.gsapSync === "done") return;
    audio.dataset.gsapSync = "done";

    ["timeupdate", "seeking", "seeked", "loadedmetadata", "durationchange"].forEach(function (name) {
      audio.addEventListener(name, routeProgress, { passive: true });
    });
    audio.addEventListener("play", function () {
      bindRouteIfPresent();
      routeProgress();
      syncRoutePulse();
    });
    audio.addEventListener("pause", function () {
      routeProgress();
      syncRoutePulse();
    });
    audio.addEventListener("ended", function () {
      if (routePath) gsap.set(routePath, { strokeDasharray: 1, strokeDashoffset: 0, opacity: 1 });
      syncRoutePulse();
    });
    if (mapCard && window.MutationObserver) {
      new MutationObserver(syncRoutePulse).observe(mapCard, {
        attributes: true,
        attributeFilter: ["class"]
      });
    }
  }

  function animatePoster() {
    var results = document.querySelector("#results");
    var poster = document.querySelector("#poster");
    if (!results || !poster || !results.classList.contains("show")) return;

    var title = poster.querySelector("#postertitle");
    var image = poster.querySelector("#aiCoverImage[data-loaded='true']");
    var key = posterEpoch + "|" + (title ? title.textContent : "") + "|" + (image ? (image.currentSrc || image.src) : "");
    if (key === posterMotionKey) return;
    posterMotionKey = key;

    var copy = poster.querySelectorAll(".poster-copy > small, .poster-copy h3, .poster-copy p");
    if (copy.length) {
      gsap.fromTo(copy,
        { y: 12, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.42, stagger: 0.055, ease: "power2.out", overwrite: true }
      );
    }
    if (image) {
      gsap.fromTo(image,
        { scale: 1.035, autoAlpha: 0.72 },
        { scale: 1, autoAlpha: 1, duration: 0.75, ease: "power2.out", overwrite: true }
      );
    }
  }

  function observePoster() {
    var poster = document.querySelector("#poster");
    var results = document.querySelector("#results");
    if (poster && window.MutationObserver && poster !== observedPoster) {
      observedPoster = poster;
      new MutationObserver(function (mutations) {
        var relevant = mutations.some(function (mutation) {
          if (mutation.type === "attributes") return mutation.attributeName === "data-loaded";
          return true;
        });
        if (relevant) animatePoster();
      }).observe(poster, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["data-loaded"]
      });
    }
    if (results && window.MutationObserver && results !== observedResults) {
      observedResults = results;
      new MutationObserver(function () {
        var shown = results.classList.contains("show");
        if (shown && !resultsWereShown) posterEpoch += 1;
        resultsWereShown = shown;
        animatePoster();
      }).observe(results, {
        attributes: true,
        attributeFilter: ["class"]
      });
    }
    animatePoster();
  }

  function initButtonFeedback() {
    document.querySelectorAll(".primary, .heroactions .ghost").forEach(function (button) {
      if (button.dataset.gsapPress === "done") return;
      button.dataset.gsapPress = "done";
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

  function init() {
    animateHero();
    animateSections();
    observeSections();
    initAudioSync();
    initButtonFeedback();
    observePoster();
    bindRouteIfPresent();

    // The map SVG is created after the user submits four cities, so watch for
    // route replacement rather than assuming it exists at initial page load.
    // The city-map canvas may itself be inserted only after the user starts
    // the four-city flow. Observe the stable document body so late-created
    // canvases and route SVGs are detected as well.
    var observerRoot = document.body;
    if (observerRoot && window.MutationObserver && observerRoot !== observedMap) {
      observedMap = observerRoot;
      new MutationObserver(function (mutations) {
        var mapChanged = mutations.some(function (mutation) {
          var target = mutation.target;
          if (target && (target.id === "cityMapCanvas" ||
              (target.closest && target.closest("#cityMapCanvas")))) return true;
          return Array.prototype.some.call(mutation.addedNodes || [], function (node) {
            if (!node || node.nodeType !== 1) return false;
            return (node.matches && node.matches("#cityMapCanvas, #cityRoutePath")) ||
              (node.querySelector && node.querySelector("#cityMapCanvas, #cityRoutePath"));
          });
        });
        // Always re-check the stable route selector after DOM insertions.
        // Some renderers replace SVG descendants without exposing the expected
        // wrapper as MutationRecord.target, so a narrow filter can miss the route.
        if (mapChanged || document.querySelector("#cityMapCanvas #cityRoutePath")) {
          bindRouteIfPresent();
          initButtonFeedback();
          if (window.ScrollTrigger) window.ScrollTrigger.refresh();
        }
      }).observe(observerRoot, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  // If the system preference changes while the page is open, stop running tweens.
  if (motionPreference && motionPreference.addEventListener) {
    motionPreference.addEventListener("change", function (event) {
      if (event.matches) gsap.globalTimeline.pause();
      else gsap.globalTimeline.resume();
    });
  }
})();
