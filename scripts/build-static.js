const fs = require("fs/promises");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public");
const VERSIONED_ASSETS = {
  "styles.css": "styles.v25.css",
  "app.js": "app.v25.js",
  "offline-db.js": "offline-db.v25.js",
  "sync-service.js": "sync-service.v25.js"
};

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
  await loadDotEnv();
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  await Promise.all(
    STATIC_FILES.map(async (file) => {
      await fs.copyFile(path.join(ROOT, file), path.join(OUT_DIR, file));
    })
  );
  await Promise.all(
    Object.entries(VERSIONED_ASSETS).map(async ([source, destination]) => {
      await fs.copyFile(path.join(ROOT, source), path.join(OUT_DIR, destination));
    })
  );
  await fs.writeFile(path.join(OUT_DIR, "env-config.js"), buildEnvConfig(), "utf8");
  await fs.writeFile(path.join(OUT_DIR, "env-config.v25.js"), buildEnvConfig(), "utf8");
  await writeLocalPreviewAliases();

  console.log(`Static PWA build written to ${path.relative(ROOT, OUT_DIR)}`);
}

async function loadDotEnv() {
  try {
    const text = await fs.readFile(path.join(ROOT, ".env"), "utf8");
    text.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return;
      const [key, ...parts] = trimmed.split("=");
      if (process.env[key]) return;
      process.env[key] = parts.join("=").replace(/^["']|["']$/g, "");
    });
  } catch {
    // Local .env is optional; Vercel provides these values through build env vars.
  }
}

async function writeLocalPreviewAliases() {
  await Promise.all(
    Object.entries(VERSIONED_ASSETS).map(async ([source, destination]) => {
      await fs.copyFile(path.join(ROOT, source), path.join(ROOT, destination));
    })
  );
  await fs.writeFile(path.join(ROOT, "env-config.js"), buildEnvConfig(), "utf8");
  await fs.writeFile(path.join(ROOT, "env-config.v25.js"), buildEnvConfig(), "utf8");
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
