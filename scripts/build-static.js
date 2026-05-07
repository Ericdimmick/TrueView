const fs = require("fs/promises");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public");

const STATIC_FILES = [
  "index.html",
  "styles.css",
  "app.js",
  "offline-db.js",
  "sync-service.js",
  "manifest.webmanifest",
  "sw.js",
  "offline.html",
  "icon.svg",
  "trueview-logo.svg",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png"
];

async function build() {
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  await Promise.all(
    STATIC_FILES.map(async (file) => {
      await fs.copyFile(path.join(ROOT, file), path.join(OUT_DIR, file));
    })
  );

  console.log(`Static PWA build written to ${path.relative(ROOT, OUT_DIR)}`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
