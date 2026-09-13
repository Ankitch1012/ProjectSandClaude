import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const source = resolve(here, "src");
const output = resolve(here, "dist");

const demos = [
  {
    from: "cyclecount-pivot-staging/fixed-repo",
    to: "demos/countback",
  },
  {
    from: "task_0109-155-physics-vibe-physics-2d-computational-fluid-dy-workspace/fixed-repo",
    to: "demos/cavitation",
  },
];

const images = [
  {
    from: "sandwich-4e718574-9109-4db7-92b0-3614ab91c56c-returned-2/environment/problem_assets/target.png",
    to: "seat-spring.png",
  },
  {
    from: "reel-paper-bench/environment/problem_assets/target.png",
    to: "reel-paper.png",
  },
  {
    from: "countback-variance-desk/environment/problem_assets/target.png",
    to: "countback.png",
  },
  {
    from: "foldmark-signature-proof/environment/problem_assets/target.png",
    to: "foldmark.png",
  },
  {
    from: "rifflepair-final-check-2/rifflepair-leafpack-contrast/environment/problem_assets/target.png",
    to: "rifflepair.png",
  },
  {
    from: "work/cleftwood-graft-season/environment/problem_assets/target.png",
    to: "cleftwood.png",
  },
  {
    from: "work2/bywash-lock-flight/environment/problem_assets/target.png",
    to: "bywash.png",
  },
  {
    from: "work3/cribstave-dance-desk/environment/problem_assets/target.png",
    to: "cribstave.png",
  },
  {
    from: "cavitation-folio-screenshots/target.png",
    to: "cavitation.png",
  },
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

for (const demo of demos) {
  await cp(resolve(root, demo.from), resolve(output, demo.to), {
    recursive: true,
  });
}

await mkdir(resolve(output, "assets"), { recursive: true });
for (const image of images) {
  await copyFile(resolve(root, image.from), resolve(output, "assets", image.to));
}

console.log(
  `Built Project Sand Atlas with ${images.length} project images and ${demos.length} live demos.`,
);
