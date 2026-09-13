const githubRoot =
  "https://github.com/Ankitch1012/ProjectSandClaude/tree/main/";

const projects = [
  {
    name: "Seat Spring Survey",
    discipline: "Furniture conservation",
    description:
      "An underside survey that preserves physical cord identity across crossings, chair orientation, evidence, and treatment review.",
    stack: ["React", "Express", "SVG topology"],
    categories: ["field", "analysis"],
    image: "/assets/seat-spring.png",
    imagePosition: "center 24%",
    source:
      "sandwich-4e718574-9109-4db7-92b0-3614ab91c56c-returned-2/environment/app",
    accent: "#e6bb42",
  },
  {
    name: "Reel Paper Bench",
    discipline: "Machine setup",
    description:
      "A reel-mower contact bench for recording paper cuts, balancing bedbar movement, and releasing a mechanically coherent setup.",
    stack: ["React", "Express", "Responsive bench"],
    categories: ["field", "analysis"],
    image: "/assets/reel-paper.png",
    imagePosition: "center 18%",
    source: "reel-paper-bench/environment/app",
    accent: "#f06643",
  },
  {
    name: "Countback Variance Desk",
    discipline: "Inventory operations",
    description:
      "A stock-reconciliation desk where recount history, transit quantities, serialized evidence, and linked transpositions stay in register.",
    stack: ["React", "Express", "Session state"],
    categories: ["operations"],
    image: "/assets/countback.png",
    imagePosition: "center 38%",
    source: "countback-variance-desk/environment/app",
    accent: "#7186ff",
  },
  {
    name: "FoldMark Signature Proof",
    discipline: "Print production",
    description:
      "A physical imposition proof for duplex signatures, revision-safe validation, and release against the exact saved press setup.",
    stack: ["Vanilla JS", "Node", "Geometry"],
    categories: ["operations", "analysis"],
    image: "/assets/foldmark.png",
    imagePosition: "center",
    source: "foldmark-signature-proof/environment/app",
    accent: "#ff714a",
    featured: true,
  },
  {
    name: "RifflePair Leafpack Contrast",
    discipline: "Stream ecology",
    description:
      "A colocated leaf-pack analysis joining spatial anchors, hydroperiod interpolation, lab corrections, and paired recovery contrasts.",
    stack: ["Python", "Vanilla JS", "Field analysis"],
    categories: ["field", "analysis"],
    image: "/assets/rifflepair.png",
    imagePosition: "center",
    source:
      "rifflepair-final-check-2/rifflepair-leafpack-contrast/environment/app",
    accent: "#83e0d1",
  },
  {
    name: "Cleftwood Graft Season",
    discipline: "Orchard planning",
    description:
      "A seasonal field notebook where weather, scion condition, tree readiness, and prior work determine the next valid grafting visit.",
    stack: ["Vanilla JS", "Node", "Narrative state"],
    categories: ["field", "operations"],
    image: "/assets/cleftwood.png",
    imagePosition: "center 20%",
    source: "work/cleftwood-graft-season/environment/app",
    accent: "#92b66f",
  },
  {
    name: "Bywash Lock Flight",
    discipline: "Canal operations",
    description:
      "A lock-flight planning instrument that reconciles pounds, chamber state, boat movement, and strict water-accounting interlocks.",
    stack: ["Vanilla JS", "Node", "Water model"],
    categories: ["field", "operations"],
    image: "/assets/bywash.png",
    imagePosition: "center 23%",
    source: "work2/bywash-lock-flight/environment/app",
    accent: "#5bb7ca",
  },
  {
    name: "Cribstave Dance Desk",
    discipline: "Dance notation",
    description:
      "A devisor’s desk that turns compact Scottish dance cribs into phrase ranges, figure checks, and a coherent four-couple set.",
    stack: ["Vanilla JS", "Node", "Notation parser"],
    categories: ["analysis"],
    image: "/assets/cribstave.png",
    imagePosition: "center",
    source: "work3/cribstave-dance-desk/environment/app",
    accent: "#9c83d7",
  },
  {
    name: "Cavitation Lab",
    discipline: "Computational physics",
    description:
      "A browser hydrodynamics lab for repeatable trials, paused checkpoints, immutable telemetry samples, and A/B drag comparisons.",
    stack: ["Canvas", "ES modules", "Local persistence"],
    categories: ["analysis", "live"],
    image: "/assets/cavitation.png",
    imagePosition: "center 24%",
    source:
      "task_0109-155-physics-vibe-physics-2d-computational-fluid-dy-workspace/fixed-repo",
    demo: "/demos/cavitation/",
    accent: "#f2ad3e",
  },
  {
    name: "CycleCount Pivot",
    discipline: "Browser operations",
    description:
      "The compact, browser-only variance desk: physical counts, neighboring-bin exchanges, decision evidence, and reversible local history.",
    stack: ["Vanilla JS", "Local persistence", "Live demo"],
    categories: ["operations", "live"],
    source: "cyclecount-pivot-staging/fixed-repo",
    demo: "/demos/countback/",
    accent: "#d8ff47",
    mark: "↔",
  },
];

const grid = document.querySelector("#project-grid");
const count = document.querySelector("#project-count");
const search = document.querySelector("#project-search");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const dialog = document.querySelector("#preview-dialog");
const previewImage = document.querySelector("#preview-image");
const previewTitle = document.querySelector("#preview-title");
const previewNumber = document.querySelector("#preview-number");
const previewCaption = document.querySelector("#preview-caption");
const previewClose = document.querySelector("#preview-close");

let activeFilter = "all";

const sourceUrl = (path) =>
  githubRoot + path.split("/").map(encodeURIComponent).join("/");

const cardTemplate = (project, index) => {
  const projectNumber = String(index + 1).padStart(2, "0");
  const tags = project.stack.map((tag) => `<span>${tag}</span>`).join("");
  const visual = project.image
    ? `
      <button
        class="project-visual"
        type="button"
        data-preview="${index}"
        aria-label="Open a larger preview of ${project.name}"
        style="--image-position: ${project.imagePosition}"
      >
        <img src="${project.image}" alt="${project.name} finished interface" loading="lazy" />
        <span class="visual-action">Inspect view</span>
      </button>`
    : `
      <div
        class="project-visual is-generated"
        data-mark="${project.mark}"
        aria-label="${project.name} graphic"
      ></div>`;

  const demoLink = project.demo
    ? `<a class="card-link primary" href="${project.demo}" target="_blank">
        Run live <span aria-hidden="true">↗</span>
      </a>`
    : "";

  return `
    <article
      class="project-card${project.featured ? " is-featured" : ""}"
      data-categories="${project.categories.join(" ")}"
      data-search="${[
        project.name,
        project.discipline,
        project.description,
        ...project.stack,
      ]
        .join(" ")
        .toLowerCase()}"
      style="--accent: ${project.accent}"
    >
      <div class="card-index">
        <span>${projectNumber} / ${String(projects.length).padStart(2, "0")}</span>
        <span>${project.discipline}</span>
      </div>
      ${visual}
      <div class="project-body">
        <div>
          <h2>${project.name}</h2>
          <p>${project.description}</p>
        </div>
        <div class="card-links">
          ${demoLink}
          <a
            class="card-link"
            href="${sourceUrl(project.source)}"
            target="_blank"
            rel="noreferrer"
          >
            Source <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
      <div class="card-tags">${tags}</div>
    </article>`;
};

grid.innerHTML =
  projects.map(cardTemplate).join("") +
  `<div class="empty-state" hidden>
    <strong>No instrument found.</strong>
    Try a broader archive filter or a different search.
  </div>`;

const cards = [...grid.querySelectorAll(".project-card")];
const emptyState = grid.querySelector(".empty-state");

function updateResults() {
  const query = search.value.trim().toLowerCase();
  let visible = 0;

  cards.forEach((card) => {
    const categoryMatch =
      activeFilter === "all" ||
      card.dataset.categories.split(" ").includes(activeFilter);
    const searchMatch = !query || card.dataset.search.includes(query);
    card.hidden = !(categoryMatch && searchMatch);
    if (!card.hidden) visible += 1;
  });

  count.textContent = `${visible} ${visible === 1 ? "project" : "projects"} shown`;
  emptyState.hidden = visible !== 0;
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) =>
      item.classList.toggle("is-active", item === button),
    );
    updateResults();
  });
});

search.addEventListener("input", updateResults);

grid.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-preview]");
  if (!trigger) return;

  const index = Number(trigger.dataset.preview);
  const project = projects[index];
  previewImage.src = project.image;
  previewImage.alt = `${project.name} finished interface`;
  previewTitle.textContent = project.name;
  previewNumber.textContent = `${String(index + 1).padStart(2, "0")} / ${String(
    projects.length,
  ).padStart(2, "0")}`;
  previewCaption.textContent = `${project.discipline} — ${project.description}`;
  dialog.showModal();
});

previewClose.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
