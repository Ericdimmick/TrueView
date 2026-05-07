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

const CLIENT_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_TRUEVIEW_SYNC_SPACE_ID"
];

async function build() {
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  await Promise.all(
    STATIC_FILES.map(async (file) => {
      await fs.copyFile(path.join(ROOT, file), path.join(OUT_DIR, file));
    })
  );
  await fs.writeFile(path.join(OUT_DIR, "env-config.js"), buildEnvConfig(), "utf8");

  console.log(`Static PWA build written to ${path.relative(ROOT, OUT_DIR)}`);
}

function buildEnvConfig() {
  const env = {};
  CLIENT_ENV_KEYS.forEach((key) => {
    env[key] = process.env[key] || "";
  });
  return `window.TrueViewEnv = ${JSON.stringify(env, null, 2)};\n`;
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
