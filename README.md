# Sai Kumar — portfolio

A static, scroll-driven 3D portfolio. No build step and no framework: plain HTML, CSS and JavaScript, with GSAP, Lenis and Three.js loaded from CDNs.

## Run it

Any static server works:

```bash
npx serve .
# or
python3 -m http.server 4173
```

Then open the printed URL. Opening `index.html` straight from disk (`file://`) won't work, because the ES-module import map needs a server.

## Folder

```
index.html            page shell (semantic landmarks; all copy is injected from data.js)
css/style.css         every style; colour tokens at the top
js/data.js            ALL content: copy, projects, skills, timeline, ERD, terminals
js/main.js            scroll engine (Lenis + ScrollTrigger + scrub helper), loader, nav,
                      cursor and every chapter's DOM/scroll logic
js/three-scenes.js    WebGL (ES module): hero monolith, About re-framing, toolset sphere
assets/og.png         social preview image
assets/logo/          SAI▍ logo set (SVG, PNG); open assets/logo/logo.html for the preview sheet
reference/            the previous portfolio (source of truth for copy; not shipped)
```

## Change copy, projects, skills or the timeline

Edit `js/data.js` only. You never need to touch HTML or JS logic.

- `PROFILE`: name, role, hero line, sub, email and links. A link set to `null` is not rendered at all.
- `CHAPTERS`: each chapter's eyebrow and headline. Wrap the one emphasised word in `*asterisks*` and it renders in Instrument Serif italic.
- `ABOUT`, `SKILLS`, `PROJECTS`, `PROCESS`, `TIMELINE`, `ERD`, `TERMINALS`, `EXPERIENCE`, `MARQUEE`, `LAYERS`: content for each section.

**Add the resume:** put the PDF in `assets/` (keep it under 300 KB) and set `PROFILE.links.resume` to its path, for example `"assets/sai-kumar-resume.pdf"`. A "Download resume" button then appears under the hero headline and in Contact.

## Change colours

- **Site palette:** the custom properties at the top of `css/style.css` (`--bg`, `--text`, `--accent`, `--accent-2`, `--highlight`, …).
- **Layer colours:** `LAYERS[].colour` in `data.js`. One colour per stack layer, used by the hero slabs and tags, the About monolith and the request path.
- **Project theatre colours:** `PROJECTS[].colour` (background) and `PROJECTS[].textColour` (text on that background; use `#F5F7FA` on dark colours and `#08090A` on light ones).
- **Skill group colours:** `SKILLS[].colour`.

## Add a project

Append an object to `PROJECTS` in `js/data.js` with the same fields as the others:

```js
{
  idx: "05", id: "my-project", category: "Web Application", title: "My Project",
  colour: "#1d3b2a", textColour: "#F5F7FA",
  role: "Full-Stack Developer",
  stack: ["Laravel", "MySQL", "AWS"],          // first three show as pills in the theatre
  problem: "…",                                 // shown in two lines; full text in the case study
  architecture: ["Browser", "Laravel", "MySQL"],
  flow: ["Step one", "Step two", "Step three"], // becomes the exploding node diagram
  features: ["…"],
  challenge: "…",
  result: "…"
}
```

The theatre, its rail, the "01 / 05" counters and the case-study drawer all update automatically. The pinned scroll length grows by one viewport per project.

## How the motion works

- **Scroll engine:** `SITE.scrub(trigger, opts, onProgress)` in `main.js` wraps a ScrollTrigger. It eases a per-scene value toward the trigger's progress, and calls `onProgress` only when that value actually moves. Every scroll effect is a pure function of that value, so scrubbing is exact in both directions and an idle page does no work.
- **Shared renderer:** one WebGL renderer serves the hero, About and the toolset. About and the toolset render into a corner of it and are copied to their own canvases. A scene renders only while its canvas is on screen.
- **Reduced motion:** `prefers-reduced-motion: reduce` turns off Lenis, pins and scrubs. 3D scenes show one static frame, every section appears in its final state and terminals show their full text.
- **No WebGL:** the hero falls back to a static SVG of the exploded stack, About to a lit layer list, and the toolset to its panel with a short note.

## Regenerating the logo

The files in `assets/logo/` were outlined from Satoshi 900 and JetBrains Mono 500 with opentype.js, and the PNGs were exported with sharp. The one-off generator scripts aren't part of the site. If the mark changes, regenerate the set rather than hand-editing the paths. The inline copy of the wordmark in `index.html` (inside the loader) comes from `assets/logo/wordmark-dark.svg`.
