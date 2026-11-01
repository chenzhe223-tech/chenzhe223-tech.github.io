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
      // Add a visible animated light field around the hero mark.
      const visual = document.querySelector(".visual");
      if (visual && !visual.querySelector(".motion-ambient")) {
        const ambient = document.createElement("div");
        ambient.className = "motion-ambient";
        Object.assign(ambient.style, {
          position: "absolute", inset: "4%", borderRadius: "50%", pointerEvents: "none",
          zIndex: "0", opacity: ".72", filter: "blur(18px)",
          background: "radial-gradient(circle at 35% 35%,rgba(91,190,255,.42),transparent 35%),radial-gradient(circle at 70% 65%,rgba(184,137,255,.38),transparent 42%),radial-gradient(circle at 50% 50%,rgba(215,255,116,.14),transparent 62%)"
        });
        visual.prepend(ambient);
        const particleSpecs = [
          { left: "13%", top: "27%", size: "9px", color: "#8be6ff" },
          { left: "78%", top: "24%", size: "6px", color: "#d6a9d9" },
          { left: "72%", top: "78%", size: "8px", color: "#d7ff74" },
          { left: "20%", top: "75%", size: "5px", color: "#b8a7ff" }
        ];
        particleSpecs.forEach((spec, index) => {
          const particle = document.createElement("span");
          particle.className = "motion-particle";
          Object.assign(particle.style, {
            position: "absolute", left: spec.left, top: spec.top, width: spec.size,
            height: spec.size, borderRadius: "50%", background: spec.color, zIndex: "2",
            pointerEvents: "none", boxShadow: "0 0 18px " + spec.color,
            opacity: ".95", willChange: "transform,opacity"
          });
          visual.appendChild(particle);
          gsap.to(particle, {
            x: index % 2 ? -18 : 18, y: index % 2 ? 22 : -22,
            scale: index % 2 ? 1.55 : .72, opacity: .42,
            duration: coarsePointer ? 2.1 + index * .18 : 1.7 + index * .16,
            ease: "sine.inOut", repeat: -1, yoyo: true, delay: index * .12
          });
        });
        gsap.to(ambient, {
          scale: 1.13, opacity: .94, duration: coarsePointer ? 2.8 : 2.2,
          ease: "sine.inOut", repeat: -1, yoyo: true
        });
      }

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
      gsap.set(".visual .orbit-tag", { autoAlpha: 0, y: 18, zIndex: 4 });
      gsap.set(".visual .core", { autoAlpha: 0, scale: 0.78, transformOrigin: "50% 50%", zIndex: 3 });
      gsap.set(".visual .orbit", { autoAlpha: 0, scale: 0.84, transformOrigin: "50% 50%", zIndex: 1 });

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
      gsap.to(".visual .orbit", { rotation: "+=360", duration: coarsePointer ? 26 : 34, ease: "none", repeat: -1 });
      gsap.to(".visual .core", {
        y: coarsePointer ? -10 : -14, rotation: coarsePointer ? 4 : 7,
        duration: coarsePointer ? 3.4 : 2.7, ease: "sine.inOut", repeat: -1, yoyo: true
      });
      gsap.to(".visual .orbit-tag", {
        y: (i) => (i % 2 ? -10 : 10), duration: coarsePointer ? 2.7 : 2.3,
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
