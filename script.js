const halo = document.querySelector(".pink-glow");
const motionButton = document.querySelector(".motion-toggle");

const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
);

const finePointer = window.matchMedia("(any-pointer: fine)");

// Increase this number for slower movement.
const FOLLOW_TIME = 500;

let paused = false;
let frame = null;
let lastTime = null;

let x = window.innerWidth / 2;
let y = window.innerHeight * 0.95;
let targetX = x;
let targetY = y;

function canFollow() {
  return (
    halo &&
    !paused &&
    !reducedMotion.matches &&
    finePointer.matches
  );
}

function render() {
  if (!halo) return;

  halo.style.setProperty("--halo-x", `${x}px`);
  halo.style.setProperty("--halo-y", `${y}px`);
}

function stop() {
  if (frame !== null) {
    cancelAnimationFrame(frame);
  }

  frame = null;
  lastTime = null;
}

function animate(time) {
  frame = null;

  if (!canFollow()) return;

  const elapsed =
    lastTime === null
      ? 16.67
      : Math.min(time - lastTime, 64);

  lastTime = time;

  const ease = 1 - Math.exp(-elapsed / FOLLOW_TIME);

  x += (targetX - x) * ease;
  y += (targetY - y) * ease;

  if (Math.hypot(targetX - x, targetY - y) < 0.2) {
    x = targetX;
    y = targetY;
    render();
    lastTime = null;
    return;
  }

  render();
  frame = requestAnimationFrame(animate);
}

function start() {
  if (canFollow() && frame === null) {
    lastTime = null;
    frame = requestAnimationFrame(animate);
  }
}

window.addEventListener(
  "pointermove",
  (event) => {
    if (event.pointerType === "touch" || !canFollow()) return;

    targetX = event.clientX;
    targetY = event.clientY;

    start();
  },
  { passive: true }
);

function updateControls() {
  stop();

  const unavailable =
    reducedMotion.matches || !finePointer.matches;

  if (unavailable) {
    x = targetX = window.innerWidth / 2;
    y = targetY = window.innerHeight * 0.95;
    render();
  }

  if (motionButton) {
    motionButton.hidden = unavailable || !halo;
    motionButton.setAttribute("aria-pressed", String(paused));
    motionButton.setAttribute(
      "aria-label",
      paused ? "Resume cursor halo" : "Pause cursor halo"
    );
  }

  if (!unavailable && !paused) {
    start();
  }
}

motionButton?.addEventListener("click", () => {
  paused = !paused;
  updateControls();
});

reducedMotion.addEventListener("change", updateControls);
finePointer.addEventListener("change", updateControls);

window.addEventListener("resize", () => {
  targetX = Math.min(targetX, window.innerWidth);
  targetY = Math.min(targetY, window.innerHeight);

  if (canFollow()) {
    start();
  } else {
    updateControls();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stop();
  } else {
    start();
  }
});

render();
updateControls();
/* Shared glass styling and Explore navigation */
(() => {
    const projects = [
      {
        name: "Mehroma",
        file: "mehroma.html",
        image: "images/red2.jpg"
      },
      {
        name: "Labeling Ontology",
        file: "labeling_ontology.html",
        image: "images/ontol1.jpg"
      },
      {
        name: "Museum Educator",
        file: "museum_educator.html",
        image: "images/mus1.jpg"
      },
      {
        name: "Spatial Design",
        file: "spatial_design.html",
        image: "images/bench_render2.png"
      },
      {
        name: "AlgoBuild",
        file: "algobuild.html",
        image: "images/algo2.JPG"
      }
    ];
  
    const currentPage = decodeURIComponent(
      location.pathname.split("/").pop()
    ).toLowerCase();
  
    document.querySelectorAll(".explore-grid").forEach(grid => {
      grid.classList.add("glass-projects");
  
      grid.replaceChildren(
        ...projects
          .filter(project => project.file !== currentPage)
          .map(project => {
            const link = document.createElement("a");
            link.href = project.file;
            link.className = "glass-project";
  
            const frame = document.createElement("div");
            frame.className = "glass-frame";
  
            const photo = document.createElement("div");
            photo.className = "glass-photo";
  
            const img = document.createElement("img");
            img.src = project.image;
            img.alt = project.name;
            img.loading = "lazy";
  
            if (project.name === "AlgoBuild") {
              photo.classList.add("glass-algo");
            }
  
            if (project.name === "Mehroma") {
              photo.classList.add("glass-mehroma");
            }
  
            const caption = document.createElement("span");
            caption.textContent = project.name;
  
            photo.append(img);
            frame.append(photo);
            link.append(frame, caption);
  
            return link;
          })
      );
    });
  
    const style = document.createElement("style");
  
    style.textContent = `
      /* Shared glass material */
      body .portfolio-cards .portfolio-card,
      body .explore .glass-frame {
        background:
          linear-gradient(
            135deg,
            rgba(255,255,255,.34) 0%,
            rgba(255,255,255,.09) 38%,
            rgba(244,218,239,.10) 70%,
            rgba(255,255,255,.22) 100%
          );
        border: 1px solid rgba(255,255,255,.32);
        -webkit-backdrop-filter: blur(18px) saturate(125%);
        backdrop-filter: blur(18px) saturate(125%);
        box-shadow:
          inset 0 1px 1px rgba(255,255,255,.75),
          inset 1px 0 1px rgba(255,255,255,.25),
          inset 0 -1px 2px rgba(90,65,85,.12),
          0 8px 24px rgba(65,45,60,.07),
          0 1px 3px rgba(65,45,60,.05);
      }
  
      /* Homepage: rounded square images */
      body .portfolio-cards .portfolio-card {
        border-radius: 26px;
        overflow: hidden;
        transition:
          transform 420ms ease,
          box-shadow 420ms ease,
          filter 420ms ease,
          opacity 420ms ease;
      }
  
      body .portfolio-cards .portfolio-picture {
        border-radius: 17px;
        overflow: hidden;
        clip-path: inset(0 round 17px);
        aspect-ratio: 1;
        min-height: 0;
      }
  
      body .portfolio-cards .portfolio-picture > img {
        border-radius: 17px;
      }
  
      /* Fill the square so the white image itself has rounded corners */
      body .portfolio-cards .card-spatial .portfolio-picture > img {
        object-fit: cover;
        padding: 0;
        border-radius: 17px;
      }
  
      body .portfolio-cards .portfolio-category,
      body .portfolio-cards .portfolio-arrow {
        color: #685b66;
      }
  
      /* Explore layout */
      body .explore {
        padding: 75px 6vw 85px;
        background: rgba(165,142,139,.27);
        color: #282625;
      }
  
      body .explore::before {
        content: none;
      }
  
      body .explore > h2 {
        color: #282625;
        margin-bottom: 45px;
      }
  
      body .explore .explore-grid.glass-projects {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 28px;
        width: 100%;
        max-width: 1180px;
        margin: 0 auto;
        align-items: start;
      }
  
      body .explore .glass-projects > a.glass-project {
        display: block;
        position: relative;
        min-width: 0;
        width: auto;
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
        text-decoration: none;
        color: #282625;
        transition:
          transform 420ms ease,
          filter 420ms ease,
          opacity 420ms ease;
      }
  
      /* Remove the old white outline entirely */
      body .explore .glass-projects > a::before,
      body .explore .glass-projects > a::after {
        content: none;
      }
  
      body .explore .glass-frame {
        position: relative;
        width: 100%;
        aspect-ratio: 1;
        box-sizing: border-box;
        padding: 12px;
        border-radius: 26px;
        overflow: hidden;
        transition: box-shadow 420ms ease;
      }
  
      /* A soft reflected highlight along the glass rim */
      body .explore .glass-frame::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background: linear-gradient(
          125deg,
          rgba(255,255,255,.26),
          transparent 27%,
          transparent 78%,
          rgba(255,255,255,.12)
        );
        opacity: .55;
      }
  
      body .explore .glass-photo {
        position: relative;
        width: 100%;
        height: 100%;
        border-radius: 15px;
        overflow: hidden;
        clip-path: inset(0 round 15px);
        background: rgba(255,255,255,.12);
      }
  
      body .explore .glass-photo img {
        display: block;
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        max-width: none;
        margin: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
        object-fit: cover;
        object-position: center;
        transform: none;
      }
  
      body .explore .glass-mehroma img {
        transform: scale(1.08);
      }
  
      body .explore .glass-algo img {
        transform: rotate(-90deg);
      }
  
      body .explore .glass-projects > a > span {
        display: block;
        margin: 20px 0 0;
        color: #282625;
        font-size: clamp(16px, 1.08vw, 21px);
        line-height: 1.4;
        text-align: center;
      }
  
      /* Same hover behavior on both layouts */
      @media (hover: hover) and (pointer: fine) {
        body .portfolio-cards:has(.portfolio-card:hover)
          .portfolio-card:not(:hover):not(:focus-visible),
        body .explore .glass-projects:has(> a:hover)
          > a:not(:hover):not(:focus-visible) {
          filter: blur(3px);
          opacity: .62;
        }
  
        body .portfolio-cards .portfolio-card:hover,
        body .explore .glass-projects > a:hover {
          transform: translateY(-6px);
          filter: none;
          opacity: 1;
        }
  
        body .portfolio-cards .portfolio-card:hover,
        body .explore .glass-project:hover .glass-frame {
          box-shadow:
            inset 0 1px 2px rgba(255,255,255,.9),
            inset 1px 0 1px rgba(255,255,255,.4),
            inset 0 -1px 2px rgba(90,65,85,.12),
            0 18px 36px rgba(65,45,60,.12),
            0 3px 8px rgba(65,45,60,.05);
          border-color: rgba(255,255,255,.5);
        }
      }
  
      body .explore .glass-project:focus-visible {
        outline: 2px solid #95758d;
        outline-offset: 6px;
        border-radius: 26px;
      }
  
      @media (max-width: 750px) {
        body .explore .explore-grid.glass-projects {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          max-width: 550px;
          gap: 30px 20px;
        }
      }
  
      @media (max-width: 450px) {
        body .explore .glass-frame {
          padding: 9px;
          border-radius: 22px;
        }
  
        body .explore .glass-photo {
          border-radius: 13px;
          clip-path: inset(0 round 13px);
        }
      }
  
      @media (prefers-reduced-motion: reduce) {
        body .portfolio-cards .portfolio-card,
        body .explore .glass-projects > a,
        body .explore .glass-frame {
          transition: none;
        }
  
        body .portfolio-cards .portfolio-card:hover,
        body .explore .glass-projects > a:hover {
          transform: none;
        }
      }
    `;
  
    document.head.append(style);
  })();
  /* Shared phone and tablet improvements */
(() => {
    const mobileStyle = document.createElement("style");
  
    mobileStyle.textContent = `
      /* Allow grid children and long text to shrink naturally */
      body main,
      body section,
      body figure,
      body .portfolio-copy {
        min-width: 0;
      }
  
      body p,
      body h1,
      body h2,
      body h3,
      body figcaption {
        overflow-wrap: break-word;
      }
  
      body .site-header a,
      body .social-link,
      body .email-link {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
  
      /* Tablets */
      @media (max-width: 900px) {
        body .site-header {
          padding: 20px 5vw;
          gap: 15px;
          flex-wrap: wrap;
        }
  
        body .site-header nav {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
        }
  
        body .explore .explore-grid.glass-projects {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          max-width: 600px;
          gap: 30px 22px;
        }
  
        body .museum-intro,
        body .project-intro,
        body .ontology-layout,
        body .bench-intro,
        body .sundial,
        body .restoration {
          grid-template-columns: minmax(0, 1fr);
          gap: 35px;
        }
  
        body .site-footer {
          display: flex;
          flex-wrap: wrap;
          gap: 35px;
        }
  
        body .footer-contact {
          flex-wrap: wrap;
          gap: 18px;
        }
      }
  
      /* Phones */
      @media (max-width: 600px) {
        body {
          font-size: 17px;
          line-height: 1.6;
        }
  
        body .site-header {
          padding: 16px 6vw;
        }
  
        body .site-header nav {
          gap: 18px;
        }
  
        body .about {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 28px;
          padding: 45px 6vw;
        }
  
        body .about .portrait {
          width: 100%;
          max-width: 100%;
          height: auto;
        }
  
        body .projects {
          padding: 45px 6vw 70px;
        }
  
        body .projects > h2 {
          margin-bottom: 30px;
        }
  
        /* Homepage cards become vertical */
        body .portfolio-cards {
          width: 100%;
          padding: 0;
          gap: 25px;
        }
  
        body .portfolio-cards .portfolio-card {
          grid-template-columns: minmax(0, 1fr);
          padding: 12px;
          border-radius: 24px;
        }
  
        body .portfolio-cards .portfolio-picture {
          width: 100%;
          height: auto;
          min-height: 0;
          aspect-ratio: 1;
        }
  
        body .portfolio-cards .portfolio-copy {
          padding: 24px 14px 42px;
        }
  
        body .portfolio-cards .portfolio-category {
          font-size: 13px;
        }
  
        body .portfolio-cards .portfolio-copy h3 {
          font-size: 28px;
        }
  
        body .portfolio-cards .portfolio-copy p {
          font-size: 17px;
          line-height: 1.6;
          max-width: none;
        }
  
        /* Project galleries and rules */
        body .component-grid,
        body .rules-grid,
        body .bench-render-grid,
        body .sun-render-grid,
        body .pavilion-grid,
        body .restoration-gallery {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 30px;
        }
  
        body .component,
        body .rules-image,
        body .provenance-excerpt,
        body .critique img {
          width: 100%;
          max-width: 100%;
        }
  
        body .artwork-overview,
        body .provenance,
        body .structure {
          grid-template-columns: minmax(0, 1fr);
          gap: 30px;
        }
  
        body .artwork-details {
          text-align: left;
        }
  
        body .axes {
          grid-template-columns: minmax(0, 1fr);
          gap: 28px;
        }
  
        body .object-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 30px 18px;
        }
  
        /* Explore: two rounded squares per row */
        body .explore {
          padding: 50px 6vw 75px;
        }
  
        body .explore .explore-grid.glass-projects {
          width: 100%;
          gap: 28px 16px;
        }
  
        body .explore .glass-projects > a > span {
          font-size: 16px;
          margin-top: 15px;
        }
  
        body .site-footer {
          flex-direction: column;
          padding: 45px 6vw 60px;
        }
  
        body .footer-contact {
          align-self: flex-start;
        }
  
        body .footer-details p,
        body .footer-bio p {
          font-size: 16px;
        }
      }
  
      /* Touch devices: no sticky hover or blurred cards */
      @media (hover: none), (pointer: coarse) {
        body .portfolio-cards .portfolio-card,
        body .portfolio-cards .portfolio-card:hover,
        body .explore .glass-projects > a,
        body .explore .glass-projects > a:hover {
          filter: none !important;
          opacity: 1 !important;
          transform: none !important;
        }
  
        body .portfolio-arrow {
          transform: none !important;
        }
  
        /* Lighter glass rendering for mobile scrolling */
        body .portfolio-cards .portfolio-card,
        body .explore .glass-frame {
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
        }
      }
    `;
  
    document.head.append(mobileStyle);
  })();