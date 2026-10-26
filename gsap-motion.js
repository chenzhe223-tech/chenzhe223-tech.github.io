/* DAVYLAB motion layer — progressive enhancement, GSAP 3 + ScrollTrigger.
   Keep content visible if CDN/network fails; respect reduced-motion preferences. */
(() => {
  const boot = () => {
    if (!window.gsap) return;
    const gsap = window.gsap;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      gsap.set(".hero .eyebrow, .hero h1, .hero p, .hero .actions, .hero .hero-note, .visual .orbit-tag, .visual .core, .ticker, #products .section-head, .market-tools, .shelf-tools, .app-card, #philosophy .manifesto, #process .step, #service .offer, #about .section-head, #contact .contact-section-head, #contact .contact-form-card, #contact .contact-wechat-card", { clearProps: "opacity,visibility,transform" });
      return;
    }

    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);
    gsap.set(".hero .eyebrow, .hero h1, .hero p, .hero .actions, .hero .hero-note", { autoAlpha: 0, y: 16 });
    gsap.set(".visual .orbit-tag", { autoAlpha: 0, y: 10 });
    gsap.set(".visual .core", { autoAlpha: 0, scale: 0.92 });
    gsap.set(".visual .orbit", { autoAlpha: 0, scale: 0.94 });
    const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro.to(".hero .eyebrow", { autoAlpha: 1, y: 0, duration: 0.55 })
      .to(".hero h1", { autoAlpha: 1, y: 0, duration: 0.75 }, "-=0.28")
      .to(".hero p", { autoAlpha: 1, y: 0, duration: 0.65 }, "-=0.38")
      .to(".hero .actions", { autoAlpha: 1, y: 0, duration: 0.55 }, "-=0.32")
      .to(".hero .hero-note", { autoAlpha: 1, y: 0, duration: 0.45 }, "-=0.25")
      .to(".visual .orbit", { autoAlpha: 1, scale: 1, duration: 0.8 }, 0.18)
      .to(".visual .core", { autoAlpha: 1, scale: 1, duration: 0.8, ease: "back.out(1.5)" }, 0.35)
      .to(".visual .orbit-tag", { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.09 }, 0.55);

    if (window.ScrollTrigger) {
      const revealGroups = [
        ["#products .section-head", "#products .market-tools", "#products .shelf-tools"],
        ["#philosophy .manifesto"],
        ["#process .step"],
        ["#service .offer"],
        ["#about .section-head"],
        ["#contact .contact-section-head", "#contact .contact-form-card", "#contact .contact-wechat-card"]
      ];
      revealGroups.forEach((selectors) => {
        selectors.forEach((selector) => {
          if (!document.querySelector(selector)) return;
          gsap.from(selector, {
            autoAlpha: 0, y: 22, duration: 0.7, ease: "power2.out",
            scrollTrigger: { trigger: selector, start: "top 88%", once: true }
          });
        });
      });

      // Product cards are rendered by the existing search/filter logic after page load.
      const shelf = document.querySelector("#shelf");
      if (shelf) {
        const animateCards = () => {
          const cards = shelf.querySelectorAll(".app-card:not([data-motion-ready])");
          if (!cards.length) return;
          cards.forEach((card) => card.setAttribute("data-motion-ready", "true"));
          gsap.fromTo(cards, { autoAlpha: 0 }, {
            autoAlpha: 1, duration: 0.38, stagger: 0.035, ease: "power1.out", clearProps: "opacity,visibility"
          });
        };
        animateCards();
        new MutationObserver(animateCards).observe(shelf, { childList: true });
      }
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
