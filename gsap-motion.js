/* DAVYLAB Motion System — GSAP 3 + ScrollTrigger.
   Progressive enhancement only: page content remains readable without the CDN.
   Motion is transform/opacity-led, tuned for touch devices, and respects reduced motion. */
(() => {
  const boot = () => {
    const gsap = window.gsap;
    if (!gsap) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motionTargets = [
      ".hero .eyebrow", ".hero h1", ".hero p", ".hero .actions", ".hero .hero-note",
      ".visual .orbit-tag", ".visual .core", ".visual .orbit",
      ".ticker", "#products .section-head", ".market-tools", ".shelf-tools", ".app-card",
      "#philosophy .manifesto", "#philosophy .value", "#process .step",
      "#service .offer-main", "#service .offer-note", "#about .section-head",
      "#contact .contact-section-head", "#contact .contact-form-card",
      "#contact .contact-wechat-card", "#contact .contact-panel"
    ].join(", ");

    if (reduceMotion) {
      gsap.set(motionTargets, { clearProps: "opacity,visibility,transform" });
      return;
    }

    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // A slim scroll progress rail gives the long-form portfolio a clear sense of movement.
      let progress = document.querySelector(".motion-progress");
      if (!progress) {
        progress = document.createElement("div");
        progress.className = "motion-progress";
        progress.setAttribute("aria-hidden", "true");
        Object.assign(progress.style, {
          position: "fixed", inset: "0 auto auto 0", width: "100%", height: "2px",
          zIndex: "120", pointerEvents: "none", transformOrigin: "left center",
          transform: "scaleX(0)", opacity: ".9",
          background: "linear-gradient(90deg,#8be6ff 0%,#b8a7ff 52%,#d7ff74 100%)",
          boxShadow: "0 0 14px rgba(139,230,255,.38)"
        });
        document.body.appendChild(progress);
      }
      if (window.ScrollTrigger) {
        gsap.to(progress, {
          scaleX: 1, ease: "none",
          scrollTrigger: { trigger: document.documentElement, start: "top top", end: "bottom bottom", scrub: 0.25 }
        });
      }

      // Hero choreography: readable text first, then the orbiting brand mark.
      gsap.set(".hero .eyebrow, .hero h1, .hero p, .hero .actions, .hero .hero-note", {
        autoAlpha: 0, y: coarsePointer ? 12 : 18
      });
      gsap.set(".visual .orbit-tag", { autoAlpha: 0, y: 12 });
      gsap.set(".visual .core", { autoAlpha: 0, scale: 0.88, transformOrigin: "50% 50%" });
      gsap.set(".visual .orbit", { autoAlpha: 0, scale: 0.9, transformOrigin: "50% 50%" });

      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro.to(".hero .eyebrow", { autoAlpha: 1, y: 0, duration: 0.48 })
        .to(".hero h1", { autoAlpha: 1, y: 0, duration: 0.72 }, "-=0.22")
        .to(".hero p", { autoAlpha: 1, y: 0, duration: 0.56 }, "-=0.34")
        .to(".hero .actions", { autoAlpha: 1, y: 0, duration: 0.48 }, "-=0.28")
        .to(".hero .hero-note", { autoAlpha: 1, y: 0, duration: 0.4 }, "-=0.2")
        .to(".visual .orbit", { autoAlpha: 1, scale: 1, duration: 0.72 }, 0.12)
        .to(".visual .core", { autoAlpha: 1, scale: 1, duration: 0.72, ease: "back.out(1.45)" }, 0.28)
        .to(".visual .orbit-tag", { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.075 }, 0.45);

      // The hero stays alive after the intro. Coarse pointers get gentler movement.
      gsap.to(".visual .orbit", { rotation: "+=360", duration: coarsePointer ? 72 : 48, ease: "none", repeat: -1 });
      gsap.to(".visual .core", {
        y: coarsePointer ? -5 : -9, rotation: coarsePointer ? 2 : 4,
        duration: coarsePointer ? 3.4 : 2.7, ease: "sine.inOut", repeat: -1, yoyo: true
      });
      gsap.to(".visual .orbit-tag", {
        y: (i) => (i % 2 ? -5 : 5), duration: coarsePointer ? 3.8 : 2.8,
        ease: "sine.inOut", repeat: -1, yoyo: true, stagger: { each: 0.24, from: "edges" }
      });
      gsap.to(".ticker i", {
        scale: 1.65, opacity: 0.48, duration: 1.15, ease: "sine.inOut",
        repeat: -1, yoyo: true, stagger: { each: 0.16, from: "random" }
      });
      gsap.to(".brand-icon", {
        scale: 1.045, duration: 2.4,
        ease: "sine.inOut", repeat: -1, yoyo: true, transformOrigin: "50% 50%"
      });

      if (window.ScrollTrigger) {
        const revealGroups = [
          ["#products .section-head", "#products .market-tools", "#products .shelf-tools"],
          ["#philosophy .manifesto"],
          ["#philosophy .value"],
          ["#process .step"],
          ["#service .offer-main", "#service .offer-note"],
          ["#about .section-head"],
          ["#contact .contact-section-head", "#contact .contact-form-card", "#contact .contact-wechat-card", "#contact .contact-panel"]
        ];
        revealGroups.forEach((selectors) => selectors.forEach((selector) => {
          document.querySelectorAll(selector).forEach((element) => {
            gsap.fromTo(element,
              { autoAlpha: 0, y: coarsePointer ? 15 : 24 },
              {
                autoAlpha: 1, y: 0, duration: coarsePointer ? 0.48 : 0.68,
                ease: "power2.out", clearProps: "opacity,visibility,transform",
                scrollTrigger: { trigger: element, start: "top 90%", once: true }
              }
            );
          });
        }));

        // Subtle parallax on the hero illustration; keep it transform-only.
        gsap.to(".visual", {
          y: coarsePointer ? 14 : 28, ease: "none",
          scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.8 }
        });

        // Product cards are dynamically replaced by search/filter. Animate each new batch once.
        const shelf = document.querySelector("#shelf");
        if (shelf) {
          const animateCards = () => {
            const cards = shelf.querySelectorAll(".app-card:not([data-motion-ready])");
            if (!cards.length) return;
            cards.forEach((card) => card.setAttribute("data-motion-ready", "true"));
            gsap.fromTo(cards, { autoAlpha: 0, y: 10, scale: 0.985 }, {
              autoAlpha: 1, y: 0, scale: 1, duration: coarsePointer ? 0.28 : 0.38,
              stagger: coarsePointer ? 0.025 : 0.045, ease: "power1.out",
              clearProps: "opacity,visibility,transform"
            });
          };
          animateCards();
          const observer = new MutationObserver(animateCards);
          observer.observe(shelf, { childList: true });
          // Disconnect when the document is hidden to avoid unnecessary work in background tabs.
          document.addEventListener("visibilitychange", () => {
            if (document.hidden) gsap.globalTimeline.pause();
            else gsap.globalTimeline.resume();
          });
        }

        // Give touch users a tactile response without relying on hover states.
        if (coarsePointer && shelf) {
          shelf.addEventListener("pointerdown", (event) => {
            const card = event.target.closest(".app-card");
            if (!card) return;
            gsap.to(card, { scale: 0.985, duration: 0.09, overwrite: "auto" });
          }, { passive: true });
          shelf.addEventListener("pointerup", (event) => {
            const card = event.target.closest(".app-card");
            if (card) gsap.to(card, { scale: 1, duration: 0.22, ease: "back.out(2)", overwrite: "auto" });
          }, { passive: true });
          shelf.addEventListener("pointercancel", () => gsap.to(".app-card", { scale: 1, duration: 0.2, overwrite: "auto" }), { passive: true });
        }
      }
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
