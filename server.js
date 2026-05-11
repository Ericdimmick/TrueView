const http = require("http");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;
const EXPORT_ROOT = process.env.TRUEVIEW_EXPORT_ROOT || process.env.INSPECTFLOW_EXPORT_ROOT || path.join(os.homedir(), "Desktop", "TrueView Reports");
const MAX_BODY_BYTES = 160 * 1024 * 1024;
const VERSIONED_ASSETS = {
  "styles.v21.css": "styles.css",
  "app.v21.js": "app.js",
  "offline-db.v21.js": "offline-db.js",
  "sync-service.v21.js": "sync-service.js"
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf"
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/api/export-report") {
      await handleExport(request, response);
      return;
    }

    if (request.method === "GET" && request.url === "/api/export-root") {
      sendJson(response, 200, { exportRoot: EXPORT_ROOT });
      return;
    }

    if (request.method === "GET" && /^\/env-config(?:\.v\d+)?\.js$/.test(request.url.split("?")[0])) {
      sendEnvConfig(response);
      return;
    }

    if (request.method === "GET" || request.method === "HEAD") {
      await serveStatic(request, response);
      return;
    }

    sendText(response, 405, "Method not allowed");
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, "::", async () => {
  await fs.mkdir(EXPORT_ROOT, { recursive: true });
  console.log(`TrueView running at http://localhost:${PORT}`);
  console.log(`Reports export to ${EXPORT_ROOT}`);
});

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const relativePath = VERSIONED_ASSETS[requestedPath] || requestedPath;
  const filePath = path.resolve(ROOT, relativePath);

  if (!filePath.startsWith(ROOT)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-store"
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    const file = await fs.readFile(filePath);
    response.end(file);
  } catch (error) {
    sendText(response, 404, "Not found");
  }
}

async function handleExport(request, response) {
  const body = await readBody(request);
  const payload = JSON.parse(body);
  const report = payload.report || {};
  const folderName = safeName(report.folderName || report.propertyAddress || "inspection-report");
  const reportFolder = path.join(EXPORT_ROOT, folderName);
  const photosFolder = path.join(reportFolder, "Photos");
  const pdfName = safeName(payload.pdfName || "inspection-report.pdf", ".pdf");
  const pdfPath = path.join(reportFolder, pdfName);

  await fs.mkdir(photosFolder, { recursive: true });
  await fs.writeFile(pdfPath, Buffer.from(payload.pdfBase64 || "", "base64"));

  const writtenPhotos = [];
  for (const photo of payload.photos || []) {
    const fileName = safeName(photo.fileName || `${photo.id || Date.now()}.jpg`, ".jpg");
    const photoPath = path.join(photosFolder, fileName);
    const base64 = String(photo.dataUrl || "").split(",").pop();
    if (!base64) continue;
    await fs.writeFile(photoPath, Buffer.from(base64, "base64"));
    writtenPhotos.push({
      id: photo.id,
      fileName,
      path: photoPath,
      section: photo.section,
      item: photo.item,
      observation: photo.observation
    });
  }

  const metadata = {
    exportedAt: new Date().toISOString(),
    report,
    pdfPath,
    photos: writtenPhotos
  };
  await fs.writeFile(path.join(reportFolder, "report-data.json"), JSON.stringify(metadata, null, 2));

  sendJson(response, 200, {
    ok: true,
    folderName,
    folderPath: reportFolder,
    pdfPath,
    photoCount: writtenPhotos.length
  });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function safeName(value, fallbackExtension = "") {
  const extension = path.extname(String(value));
  const base = String(value)
    .replace(extension, "")
    .trim()
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .slice(0, 120) || "inspection-report";
  return `${base}${extension || fallbackExtension}`;
}

function sendJson(response, status, data) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function sendText(response, status, text) {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(text)
  });
  response.end(text);
}

function sendEnvConfig(response) {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    NEXT_PUBLIC_TRUEVIEW_SYNC_SPACE_ID: process.env.NEXT_PUBLIC_TRUEVIEW_SYNC_SPACE_ID || ""
  };
  const body = `window.TrueViewEnv = ${JSON.stringify(env, null, 2)};\n`;
  response.writeHead(200, {
    "Content-Type": "text/javascript; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  response.end(body);
}
