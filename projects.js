(() => {
    const projectKey = document.body.dataset.project;
    const mount = document.getElementById("project-content");
  
    if (!mount) return;
  
    const projects = {
      mehroma: {
        title: "Mehroma",
        image: "red2.jpg",
        page: "mehroma.html"
      },
      ontology: {
        title: "Labeling Ontology",
        image: "ontol2.jpg",
        page: "labeling-ontology.html"
      },
      museum: {
        title: "Museum Educator",
        image: "mus1.jpg",
        page: "museum-educator.html"
      },
      spatial: {
        title: "Spatial Design",
        image: "bench_render1.png",
        page: "spatial-design.html"
      }
    };
  
    const current = projects[projectKey];
  
    if (!current) return;
  
    function image(filename, alt, className = "") {
      return `
        <img
          class="${className}"
          src="images/${filename}"
          alt="${alt}"
          loading="lazy"
        >
      `;
    }
  
    function gallery(files, label) {
      return `
        <div class="detail-gallery">
          ${files.map((file, index) => `
            <figure>
              ${image(file, `${label}, image ${index + 1}`)}
            </figure>
          `).join("")}
        </div>
      `;
    }
  
    function gallerySection(title, files) {
      return `
        <section class="detail-section">
          <h2>${title}</h2>
          ${gallery(files, title)}
        </section>
      `;
    }
  
    function mehromaContent() {
      const rows = [
        [
          ["yellow3.jpg", "Tile"],
          ["yellow2.jpg", "Peela Jhumka"],
          ["yellow1.jpg", "Peela Jhumka"]
        ],
        [
          ["red3.jpg", "Floral motif"],
          ["red2.jpg", "Laal Jhumka"],
          ["red1.jpg", "Laal Jhumka"]
        ],
        [
          ["blue3.png", "Fresco"],
          ["blue2.jpg", "Neela Jhumka"],
          ["blue1.jpg", "Neela Jhumka"]
        ]
      ];
  
      const columns = [
        "Source",
        "Reinterpretation",
        "Material Detail"
      ];
  
      const comparisons = rows.map((row) => `
        <div class="comparison-row">
          ${row.map(([filename, caption], index) => `
            <figure>
              <h3>${columns[index]}</h3>
              ${image(filename, caption)}
              <figcaption>${caption}</figcaption>
            </figure>
          `).join("")}
        </div>
      `).join("");
  
      const steps = [
        "Archival Study",
        "Process Study",
        "Process Abstraction",
        "Motif Interpretation",
        "Palette Abstraction",
        "Hand-Painting",
        "Community Storytelling"
      ];
  
      return `
        <section class="mehroma-intro" aria-label="About Mehroma">
          ${image(
            "meh_intro.jpg",
            "About Mehroma: hand-painted jewelry inspired by Mughal heritage"
          )}
        </section>
  
        <section
          class="comparison"
          aria-label="Source motifs and jewelry reinterpretations"
        >
          ${comparisons}
        </section>
  
        <section class="methodology">
          <div class="method-source">
            ${image("meh7.jpg", "Painted floral architectural motif")}
          </div>
  
          <div class="motif-details" aria-hidden="true">
            ${image("meh7.jpg", "", "motif motif-0")}
            ${image("meh7.jpg", "", "motif motif-1")}
            ${image("meh7.jpg", "", "motif motif-2")}
          </div>
  
          <div class="method-copy">
            <h2>Methodology</h2>
            <ol>
              ${steps.map((step) => `<li>${step}</li>`).join("")}
            </ol>
          </div>
        </section>
  
        <section class="restoration">
          <div class="restoration-copy">
            <h2>Lahore Fort’s Picture Wall Restoration</h2>
  
            <p>
              When I began Mehroma, the 400-year-old Picture Wall was
              still undergoing restoration. The seven-year conservation
              effort was completed in 2025 and brought new life to motifs
              I first encountered while they were deteriorating.
            </p>
  
            <p>
              Mehroma grew from those early encounters with fading
              frescoes, fractured colors, and damaged surfaces.
            </p>
  
            <p>
              The restoration reflects the work of hundreds of artisans
              who revived the Wall through careful pigment matching,
              surface repair, and patient conservation during Lahore’s
              intense summers.
            </p>
          </div>
  
          <figure>
            ${image(
              "meh_wall.png",
              "Picture Wall at Lahore Fort viewed through a brick arch"
            )}
            <figcaption>
              Picture Wall, Lahore Fort.<br>
              <em>Image via Forbes</em>
            </figcaption>
          </figure>
        </section>
  
        <section
          class="restoration-gallery"
          aria-label="Picture Wall restoration photographs"
        >
          ${image(
            "meh_rest1.webp",
            "Floral wall panels during restoration"
          )}
          ${image(
            "meh_rest2.webp",
            "Artisans working on the Picture Wall"
          )}
          ${image(
            "meh_rest3.jpg",
            "An artisan restoring colorful wall motifs"
          )}
  
          <p>
            Artisans amid restoration efforts.<br>
            <em>Images via Forbes</em>
          </p>
        </section>
      `;
    }
  
    function projectContent() {
      if (projectKey === "mehroma") {
        return mehromaContent();
      }
  
      if (projectKey === "ontology") {
        return `
          <section
            class="detail-section"
            aria-label="Labeling Ontology artworks"
          >
            ${gallery(
              ["ontol1.jpg", "ontol2.jpg"],
              "Labeling Ontology artwork"
            )}
          </section>
        `;
      }
  
      if (projectKey === "museum") {
        return `
          <section
            class="detail-section"
            aria-label="Museum Educator gallery"
          >
            ${gallery(
              [
                "mus1.jpg",
                "mus2.jpg",
                "mus3.jpg",
                "mus4.jpg",
                "mus5.jpg"
              ],
              "Museum education portfolio"
            )}
          </section>
        `;
      }
  
      return [
        gallerySection("Bench", [
          "bench_render1.png",
          "bench_render2.png",
          "bench_render3.png",
          "bench_render4.png",
          "bench1.png",
          "bench2.png"
        ]),
  
        gallerySection("Bench sketches", [
          "bench_sketch1.png",
          "bench_sketch2.png",
          "bench_sketch3.png",
          "bench_sketch4.png"
        ]),
  
        gallerySection("Lighting", [
          "lamp1.JPG",
          "lamp2.jpg",
          "lamp3.JPG"
        ]),
  
        gallerySection("Pavilion", [
          "pav1.JPG",
          "pav2.png"
        ]),
  
        gallerySection("Sun studies", [
          "sun1.png",
          "sun2.png",
          "sun3.png",
          "sun_sketch1.png",
          "sun_sketch2.png",
          "sun_sketch3.png"
        ])
      ].join("");
    }
  
    const exploreLinks = Object.entries(projects)
      .filter(([key]) => key !== projectKey)
      .map(([, project]) => `
        <a href="${project.page}">
          ${image(project.image, project.title)}
          <span>${project.title}</span>
        </a>
      `)
      .join("");
  
    mount.innerHTML = `
      <header class="site-header">
        <a class="wordmark" href="index.html">
          Fatima's Portfolio
        </a>
  
        <nav class="site-nav" aria-label="Primary navigation">
          <a href="index.html">Home</a>
          <a href="index.html#projects" aria-current="location">
            Projects
          </a>
        </nav>
      </header>
  
      <main>
        <h1 class="project-title">${current.title}</h1>
  
        ${projectContent()}
  
        <section class="explore">
          <h2>Explore</h2>
  
          <div class="explore-grid">
            ${exploreLinks}
          </div>
  
          <button
            class="motion-toggle"
            type="button"
            aria-label="Pause cursor halo"
            aria-pressed="false"
            hidden
          >
            <svg class="pause-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 5h4v14H7zm6 0h4v14h-4z"/>
            </svg>
            <svg class="play-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m8 5 11 7-11 7z"/>
            </svg>
          </button>
        </section>
      </main>
  
      <footer class="site-footer">
        <div class="footer-details">
          <h2>Fatima Shah</h2>
          <p>Mount Holyoke College, Class of 2026</p>
          <p>Computer Science and Architecture Double Major</p>
        </div>
  
        <div class="footer-contact">
          <h2>Let’s Connect!</h2>
  
          <div class="social-links">
            <button
              class="social-link linkedin"
              type="button"
              aria-label="LinkedIn profile not yet added"
              disabled
            >
              <span aria-hidden="true">in</span>
            </button>
  
            <a
              class="social-link"
              href="mailto:fatimas@andrew.cmu.edu"
              aria-label="Email Fatima Shah"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18v12H3z"/>
                <path d="m3 6 9 7 9-7"/>
              </svg>
            </a>
          </div>
        </div>
      </footer>
    `;
  })();