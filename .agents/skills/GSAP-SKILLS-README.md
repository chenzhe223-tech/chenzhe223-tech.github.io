# Official GSAP Skills for DAVYLAB

Source of truth: [GreenSock's official gsap-skills repository](https://github.com/greensock/gsap-skills) (MIT).

These are project-local Agent Skills for AI coding agents working in this repository. They guide implementation and review; they are **not JavaScript assets loaded by the published website at runtime**.

Installed from the upstream `main` branch on 2026-10-27:

- `gsap-core` — core tweens, easing, stagger, responsive motion
- `gsap-timeline` — sequencing and timeline composition
- `gsap-scrolltrigger` — scroll-linked animation and pinning
- `gsap-plugins` — GSAP plugins and registration
- `gsap-utils` — utility helpers
- `gsap-react` — React lifecycle and cleanup
- `gsap-performance` — animation performance and accessibility
- `gsap-frameworks` — Vue, Svelte, and other frameworks

Skill files are stored in `.agents/skills/<skill-name>/SKILL.md`. When a website feature actually uses GSAP, add the runtime dependency and animation code separately, then test reduced-motion preferences, mobile performance, and cleanup.
