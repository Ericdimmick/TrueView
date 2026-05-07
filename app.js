const STORE_KEY = "inspectflow.inspection.v1";
const LIBRARY_KEY = "inspectflow.library.v1";
const PHOTO_DB_NAME = "inspectflow.photos.v1";
const PHOTO_STORE = "photos";
const EXPORT_ENDPOINT = "/api/export-report";
const DEFAULT_COMPANY_NAME = "TrueView Home Inspections";
const DEFAULT_APP_NAME = "TrueView";

const TRUEVIEW_MARK_SVG = `
  <svg class="trueview-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <rect x="4" y="4" width="40" height="40" rx="10" fill="#142321"/>
    <path d="M13.5 25.2 24 16.3l10.5 8.9" fill="none" stroke="#f5fbf8" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M17.4 25.5v9.4h13.2v-9.4" fill="none" stroke="#f5fbf8" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="24" cy="28.6" r="6.1" fill="none" stroke="#79d6dc" stroke-width="2.7"/>
    <path d="m21.1 28.8 2.1 2.2 4-4.7" fill="none" stroke="#79d6dc" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

const PDF_COLORS = {
  paperTop: "#fdfdfb",
  paperBottom: "#f3f7f5",
  ink: "#17211f",
  muted: "#64736f",
  faint: "#edf3f1",
  line: "rgba(63, 78, 75, 0.16)",
  lineStrong: "rgba(63, 78, 75, 0.28)",
  brand: "#0f6f79",
  brandDeep: "#142321",
  brandSoft: "rgba(15, 111, 121, 0.11)",
  maintenance: "#2a658f",
  repair: "#98651d",
  safety: "#a13d37"
};

const STATUS_OPTIONS = [
  { value: "NA", label: "NA", name: "Not Applicable" },
  { value: "IN", label: "IN", name: "Inspected" },
  { value: "NI", label: "NI", name: "Not Inspected" },
  { value: "NP", label: "NP", name: "Not Present" }
];

const CONDITION_OPTIONS = [
  { value: "satisfactory", label: "Satisfactory" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" }
];

const SEVERITY_OPTIONS = [
  { value: "maintenance", label: "Maintenance Item" },
  { value: "repair", label: "Repair Recommended" },
  { value: "safety", label: "Safety Hazard" }
];

const PROPERTY_FIELDS = [
  { key: "propertyAddress", label: "Property Address", wide: true, placeholder: "1046 Dunham St SE" },
  { key: "cityStateZip", label: "City, State ZIP", placeholder: "Grand Rapids, MI 49506" },
  { key: "inspectionDate", label: "Date", type: "date" },
  { key: "clientName", label: "Client", placeholder: "Client name" },
  { key: "agentName", label: "Agent", placeholder: "Agent name" },
  { key: "agentPhone", label: "Agent Phone", type: "tel", placeholder: "616-000-0000" },
  { key: "agentEmail", label: "Agent Email", type: "email", placeholder: "agent@example.com" },
  { key: "companyName", label: "Company", placeholder: DEFAULT_COMPANY_NAME },
  { key: "inspectorName", label: "Inspector", placeholder: "Inspector name" },
  { key: "companyPhone", label: "Company Phone", type: "tel", placeholder: "616-000-0000" },
  { key: "companyEmail", label: "Company Email", type: "email", placeholder: "you@example.com" },
  { key: "weather", label: "Weather", placeholder: "Clear, 72 F" },
  { key: "occupancy", label: "Occupancy", placeholder: "Occupied" }
];

const COMMENT_TEMPLATES = [
  {
    label: "Roof shingle",
    title: "Unsealed or unsecured shingles",
    severity: "repair",
    location: "Roof",
    note: "Asphalt shingles were observed loose, lifted, or not fully sealed. This can allow wind damage and moisture intrusion.",
    recommendation: "Contact a qualified roofing professional for evaluation and repair."
  },
  {
    label: "GFCI",
    title: "GFCI protection missing",
    severity: "safety",
    location: "Wet or exterior location",
    note: "A receptacle in a location requiring ground-fault protection did not appear to be GFCI protected at the time of inspection.",
    recommendation: "Contact a qualified electrical contractor to install or repair GFCI protection."
  },
  {
    label: "Drainage",
    title: "Drainage toward foundation",
    severity: "repair",
    location: "Exterior",
    note: "Grading or drainage appears to direct water toward the structure. This can increase the risk of foundation moisture intrusion.",
    recommendation: "Correct grading and drainage so water flows away from the foundation."
  },
  {
    label: "Moisture stain",
    title: "Moisture staining observed",
    severity: "maintenance",
    location: "Interior",
    note: "Staining was observed that may be related to prior or active moisture. No invasive testing was performed.",
    recommendation: "Monitor the area and contact a qualified professional if staining changes or moisture is detected."
  },
  {
    label: "Loose toilet",
    title: "Toilet loose at floor",
    severity: "repair",
    location: "Bathroom",
    note: "The toilet was loose at the floor. Movement can damage the wax seal and may lead to leakage.",
    recommendation: "Contact a qualified plumbing professional to secure the toilet and evaluate the seal."
  },
  {
    label: "HVAC service",
    title: "Service recommended",
    severity: "maintenance",
    location: "HVAC equipment",
    note: "The equipment would benefit from cleaning, servicing, or further evaluation based on visible condition or service history.",
    recommendation: "Contact a qualified HVAC professional for cleaning and service."
  }
];

let state;
let library;
let photoDb;
let photoCache = new Map();
let activeObservation = null;
let toastTimer = null;
let saveStatusTimer = null;

const app = document.getElementById("app");
const sectionList = document.getElementById("sectionList");
const fieldDashboard = document.getElementById("fieldDashboard");
const propertyFields = document.getElementById("propertyFields");
const statusLegend = document.getElementById("statusLegend");
const saveStatus = document.getElementById("saveStatus");
const sectionEditor = document.getElementById("sectionEditor");
const summaryCards = document.getElementById("summaryCards");
const reportPreview = document.getElementById("reportPreview");
const observationSheet = document.getElementById("observationSheet");
const sheetBackdrop = document.getElementById("sheetBackdrop");
const sectionDrawer = document.getElementById("sectionDrawer");
const reportDrawer = document.getElementById("reportDrawer");
const libraryDrawer = document.getElementById("libraryDrawer");
const mobileMenuDrawer = document.getElementById("mobileMenuDrawer");
const toast = document.getElementById("toast");
const printRoot = document.getElementById("printRoot");

boot();

async function boot() {
  library = loadLibrary();
  state = getActiveReport();
  await initPhotoStorage();
  registerServiceWorker();
  render();
}

function createDefaultState() {
  const now = new Date().toISOString();
  const sections = createSections();
  return {
    id: uid("report"),
    createdAt: now,
    updatedAt: now,
    lastSavedAt: now,
    exportedAt: "",
    exportFolderName: "",
    exportFolder: "",
    exportPdfPath: "",
    currentSectionId: "roof",
    inspection: {
      propertyAddress: "",
      cityStateZip: "",
      inspectionDate: new Date().toISOString().slice(0, 10),
      clientName: "",
      agentName: "",
      agentPhone: "",
      agentEmail: "",
      companyName: DEFAULT_COMPANY_NAME,
      inspectorName: "",
      companyPhone: "",
      companyEmail: "",
      weather: "",
      occupancy: "",
      logoPhotoId: "",
      propertyPhotoId: ""
    },
    sections
  };
}

function createSections() {
  const groups = [
    {
      id: "details",
      code: "1",
      title: "Inspection Details",
      subtitle: "Scope, attendance, property conditions, and report context.",
      items: [
        "Inspection Scope",
        "Occupancy",
        "Weather Conditions",
        "Utilities",
        "Limitations"
      ]
    },
    {
      id: "roof",
      code: "2",
      title: "Roof",
      subtitle: "Roof covering, drainage, flashing, penetrations, and visible roof condition.",
      items: [
        "Roof",
        "Roof Drainage Systems",
        "Roof Flashings",
        "Skylights, Chimneys and Other Roof Penetrations"
      ]
    },
    {
      id: "exterior",
      code: "3",
      title: "Exterior",
      subtitle: "Siding, trim, drainage, walks, porches, decks, doors, windows, and attached components.",
      items: [
        "Wall Covering",
        "Eaves, Soffits and Fascia",
        "Exterior Doors",
        "Windows",
        "Decks, Balconies, Porches and Steps",
        "Driveways and Walkways",
        "Grading and Drainage",
        "Vegetation and Retaining Walls",
        "Exterior Faucets"
      ]
    },
    {
      id: "garage",
      code: "4",
      title: "Garage or Pole Barn",
      subtitle: "Vehicle doors, openers, fire separation, slab, electrical, and visible structure.",
      items: [
        "Vehicle Door",
        "Door Opener",
        "Fire Separation",
        "Garage Floor",
        "Garage Walls and Ceiling",
        "Garage Electrical",
        "Man Door",
        "Garage Roof Structure"
      ]
    },
    {
      id: "attic",
      code: "5",
      title: "Attic",
      subtitle: "Access, insulation, ventilation, framing, sheathing, and exhaust routing.",
      items: [
        "Attic Access",
        "Insulation",
        "Ventilation",
        "Roof Framing",
        "Sheathing",
        "Bathroom Exhaust Fans",
        "Visible Moisture or Staining"
      ]
    },
    makeRoomSection("master-bedroom", "6", "Master Bedroom"),
    makeRoomSection("bedroom-2", "7", "Bedroom 2"),
    makeRoomSection("bedroom-3", "8", "Bedroom 3"),
    makeBathroomSection("bathroom-1", "9", "Bathroom 1"),
    makeBathroomSection("half-bathroom-1", "10", "Half Bathroom 1"),
    makeRoomSection("living-area", "11", "Living Area", ["Fireplace", "Stairs and Railings"]),
    makeRoomSection("dining-area", "12", "Dining Area"),
    {
      id: "kitchen",
      code: "13",
      title: "Kitchen",
      subtitle: "Cabinets, counters, sink, visible plumbing, outlets, ventilation, and appliances.",
      items: [
        "Cabinets and Counters",
        "Sink and Faucet",
        "Drain and Trap",
        "Dishwasher",
        "Range, Oven and Cooktop",
        "Range Hood or Exhaust",
        "Refrigerator",
        "Built-in Microwave",
        "Kitchen Electrical and GFCI",
        "Floors, Walls and Ceiling"
      ]
    },
    {
      id: "misc-interior",
      code: "14",
      title: "Misc. Interior",
      subtitle: "Interior systems or observations that do not fit a single room.",
      items: [
        "Interior Doors",
        "Windows",
        "Stairs and Railings",
        "Floors",
        "Walls and Ceilings",
        "Closets",
        "General Interior"
      ]
    },
    {
      id: "basement-structure",
      code: "15",
      title: "Basement, Crawlspace and Structure",
      subtitle: "Foundation, framing, moisture, access, ventilation, and visible structure.",
      items: [
        "Foundation",
        "Floor Structure",
        "Wall Structure",
        "Posts and Beams",
        "Crawlspace Access",
        "Crawlspace Ventilation",
        "Basement Moisture",
        "Sump Pump",
        "Vapor Barrier"
      ]
    },
    {
      id: "laundry",
      code: "16",
      title: "Laundry Appliances",
      subtitle: "Laundry area plumbing, dryer vent, electrical, and installed appliances.",
      items: [
        "Washer Connections",
        "Dryer Connections",
        "Dryer Vent",
        "Laundry Sink",
        "Laundry Electrical",
        "Laundry Appliances"
      ]
    },
    {
      id: "electrical",
      code: "17",
      title: "Electrical",
      subtitle: "Service, panels, breakers, visible wiring, receptacles, and safety devices.",
      items: [
        "Service Entrance",
        "Main Panel",
        "Sub Panels",
        "Breakers and Fuses",
        "Grounding and Bonding",
        "Branch Wiring",
        "Receptacles",
        "GFCI and AFCI Protection",
        "Light Fixtures and Switches",
        "Exterior Electrical"
      ]
    },
    {
      id: "plumbing",
      code: "18",
      title: "Plumbing",
      subtitle: "Water supply, distribution, drains, vents, fixtures, and water heating equipment.",
      items: [
        "Main Water Shutoff",
        "Water Supply Piping",
        "Drain, Waste and Vent Piping",
        "Water Heater",
        "Fuel Shutoff",
        "Fixtures",
        "Functional Flow",
        "Functional Drainage",
        "Visible Leaks"
      ]
    },
    {
      id: "hvac",
      code: "19",
      title: "HVAC",
      subtitle: "Heating, cooling, distribution, thermostats, filters, and visible venting.",
      items: [
        "Heating Equipment",
        "Cooling Equipment",
        "Thermostat",
        "Ductwork",
        "Air Filter",
        "Flue and Venting",
        "Condensate Drain",
        "Combustion Air",
        "Distribution and Registers"
      ]
    },
    {
      id: "smoke-co",
      code: "20",
      title: "Smoke Alarms and Carbon Monoxide Detectors",
      subtitle: "Visible alarms, detector placement, and reportable safety observations.",
      items: [
        "Smoke Alarms",
        "Carbon Monoxide Detectors",
        "Bedrooms and Hallways",
        "Basement Alarm Coverage",
        "Garage or Fuel Burning Appliance Area"
      ]
    },
    {
      id: "standards",
      code: "SOP",
      title: "Standards of Practice",
      subtitle: "Reference notes, exclusions, and inspection limitations.",
      items: [
        "General Standards",
        "Limitations",
        "Excluded Systems",
        "Client Acknowledgement"
      ]
    }
  ];

  return groups.map((section) => ({
    ...section,
    items: section.items.map((title, index) => createItem(section.id, title, index))
  }));
}

function makeRoomSection(id, code, title, extras = []) {
  return {
    id,
    code,
    title,
    subtitle: "Floors, walls, ceiling, windows, doors, electrical, heat source, and room-specific concerns.",
    items: [
      "Floors",
      "Walls and Ceiling",
      "Windows",
      "Interior Doors",
      "Electrical",
      "Heat Source",
      "Closet",
      ...extras
    ]
  };
}

function makeBathroomSection(id, code, title) {
  return {
    id,
    code,
    title,
    subtitle: "Fixtures, visible plumbing, ventilation, GFCI protection, floors, walls, and ceiling.",
    items: [
      "Sink and Faucet",
      "Toilet",
      "Tub or Shower",
      "Drain and Trap",
      "Ventilation",
      "Electrical and GFCI",
      "Floors",
      "Walls and Ceiling"
    ]
  };
}

function createItem(sectionId, title, index) {
  return {
    id: `${sectionId}-${index + 1}`,
    title,
    status: "",
    condition: "satisfactory",
    observations: []
  };
}

function loadLibrary() {
  try {
    const savedLibrary = localStorage.getItem(LIBRARY_KEY);
    if (savedLibrary) {
      const parsedLibrary = JSON.parse(savedLibrary);
      if (Array.isArray(parsedLibrary.reports) && parsedLibrary.reports.length) {
        const reports = parsedLibrary.reports.map((report) => migrateState(report));
        const activeReportId = reports.some((report) => report.id === parsedLibrary.activeReportId)
          ? parsedLibrary.activeReportId
          : reports[0].id;
        return { activeReportId, reports };
      }
    }

    const saved = localStorage.getItem(STORE_KEY);
    if (!saved) return createLibraryWithReport(createDefaultState());
    const parsed = JSON.parse(saved);
    if (!parsed.sections || !parsed.inspection) return createLibraryWithReport(createDefaultState());
    return createLibraryWithReport(migrateState(parsed));
  } catch (error) {
    console.warn(error);
    return createLibraryWithReport(createDefaultState());
  }
}

function createLibraryWithReport(report) {
  return {
    activeReportId: report.id,
    reports: [report]
  };
}

function migrateState(saved) {
  const fresh = createDefaultState();
  const sectionMap = new Map((saved.sections || []).map((section) => [section.id, section]));

  fresh.sections = fresh.sections.map((section) => {
    const existingSection = sectionMap.get(section.id);
    if (!existingSection) return section;
    const itemMap = new Map((existingSection.items || []).map((item) => [item.id, item]));
    return {
      ...section,
      items: section.items.map((item) => {
        const existingItem = itemMap.get(item.id);
        if (!existingItem) return item;
        return {
          ...item,
          status: existingItem.status || "",
          condition: existingItem.condition || "satisfactory",
          observations: (existingItem.observations || []).map(normalizeObservation)
        };
      })
    };
  });

  const inspection = { ...fresh.inspection, ...saved.inspection };
  if (!inspection.companyName || inspection.companyName === "My Inspection Company" || inspection.companyName === "Inspection Company") {
    inspection.companyName = DEFAULT_COMPANY_NAME;
  }

  return {
    ...fresh,
    ...saved,
    id: saved.id || fresh.id,
    createdAt: saved.createdAt || fresh.createdAt,
    updatedAt: saved.updatedAt || saved.lastSavedAt || fresh.updatedAt,
    lastSavedAt: saved.lastSavedAt || saved.updatedAt || fresh.lastSavedAt,
    exportedAt: saved.exportedAt || "",
    exportFolderName: saved.exportFolderName || "",
    exportFolder: saved.exportFolder || "",
    exportPdfPath: saved.exportPdfPath || "",
    inspection,
    sections: fresh.sections,
    currentSectionId: saved.currentSectionId || fresh.currentSectionId
  };
}

function normalizeObservation(observation) {
  return {
    id: observation.id || uid("obs"),
    title: observation.title || "",
    severity: observation.severity || "repair",
    location: observation.location || "",
    note: observation.note || "",
    recommendation: observation.recommendation || "",
    photoIds: observation.photoIds || observation.photos || []
  };
}

function getActiveReport() {
  const active = library.reports.find((report) => report.id === library.activeReportId);
  if (active) return active;
  library.activeReportId = library.reports[0].id;
  return library.reports[0];
}

function saveState(options = {}) {
  const now = new Date().toISOString();
  state.updatedAt = now;
  state.lastSavedAt = now;
  upsertCurrentReport();
  persistLibrary();
  updateSaveStatus(options.manual ? "Saved now" : "Saved locally");
}

function upsertCurrentReport() {
  const index = library.reports.findIndex((report) => report.id === state.id);
  if (index >= 0) library.reports[index] = state;
  else library.reports.unshift(state);
  library.activeReportId = state.id;
}

function persistLibrary() {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

async function initPhotoStorage() {
  if (!("indexedDB" in window)) return;

  photoDb = await new Promise((resolve, reject) => {
    const request = indexedDB.open(PHOTO_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    console.warn(error);
    return null;
  });

  if (!photoDb) return;

  const records = await new Promise((resolve) => {
    const transaction = photoDb.transaction(PHOTO_STORE, "readonly");
    const request = transaction.objectStore(PHOTO_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });

  records.forEach((record) => photoCache.set(record.id, record.dataUrl));
}

async function savePhoto(id, dataUrl) {
  photoCache.set(id, dataUrl);
  if (!photoDb) return;
  await new Promise((resolve) => {
    const transaction = photoDb.transaction(PHOTO_STORE, "readwrite");
    transaction.objectStore(PHOTO_STORE).put({ id, dataUrl, createdAt: Date.now() });
    transaction.oncomplete = resolve;
    transaction.onerror = resolve;
  });
}

async function deletePhoto(id) {
  photoCache.delete(id);
  if (!photoDb) return;
  await new Promise((resolve) => {
    const transaction = photoDb.transaction(PHOTO_STORE, "readwrite");
    transaction.objectStore(PHOTO_STORE).delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = resolve;
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function render() {
  renderHeader();
  renderDashboard();
  renderPropertyFields();
  renderStatusLegend();
  renderSectionList();
  renderSectionEditor();
  renderSummary();
  renderPreview();
}

function renderHeader() {
  const line = state.inspection.propertyAddress || "New residential inspection";
  document.getElementById("propertyLine").textContent = line;
  const brandTitle = document.getElementById("brandTitle");
  if (brandTitle) brandTitle.textContent = DEFAULT_APP_NAME;
  const brandMark = document.querySelector(".brand-mark");
  const logoSrc = state.inspection.logoPhotoId ? photoCache.get(state.inspection.logoPhotoId) : "";
  if (brandMark) {
    brandMark.classList.toggle("has-photo", Boolean(logoSrc));
    brandMark.innerHTML = logoSrc ? `<img src="${escapeAttr(logoSrc)}" alt="">` : TRUEVIEW_MARK_SVG;
  }
  const progress = Math.round(getOverallProgress() * 100);
  document.getElementById("sectionProgress").textContent = `${progress}%`;
  updateSaveStatus("Saved locally");
}

function updateSaveStatus(prefix = "Saved locally") {
  if (!saveStatus) return;
  clearTimeout(saveStatusTimer);
  const savedAt = state.lastSavedAt ? formatTime(state.lastSavedAt) : "not saved yet";
  const exported = state.exportedAt ? ` | Exported ${formatTime(state.exportedAt)}` : "";
  saveStatus.textContent = `${prefix} ${savedAt}${exported}`;
  saveStatusTimer = setTimeout(() => {
    if (!saveStatus) return;
    saveStatus.textContent = `Saved locally ${formatTime(state.lastSavedAt)}${exported}`;
  }, 1800);
}

function renderDashboard() {
  const totals = getInspectionTotals();
  const counts = getSeverityCounts();
  const current = getCurrentSection();
  const progress = Math.round(getOverallProgress() * 100);
  fieldDashboard.innerHTML = `
    <div class="progress-card">
      <div class="progress-ring" style="--progress:${progress}%">
        <span>${progress}%</span>
      </div>
      <div>
        <p class="eyebrow">Field progress</p>
        <strong>${totals.complete}/${totals.total} items filled</strong>
        <span>${escapeHtml(current.title)} is active</span>
      </div>
    </div>
    <div class="dashboard-metric maintenance">
      <strong>${counts.maintenance}</strong>
      <span>Maintenance</span>
    </div>
    <div class="dashboard-metric repair">
      <strong>${counts.repair}</strong>
      <span>Repair</span>
    </div>
    <div class="dashboard-metric safety">
      <strong>${counts.safety}</strong>
      <span>Safety</span>
    </div>
  `;
}

function renderPropertyFields() {
  propertyFields.innerHTML = `
    ${renderSetupMediaFields()}
    ${PROPERTY_FIELDS.map((field) => {
    const value = state.inspection[field.key] || "";
    const inputType = field.type || "text";
    const className = field.wide ? "field wide" : "field";
    return `
      <label class="${className}">
        <span>${escapeHtml(field.label)}</span>
        <input
          data-property="${escapeHtml(field.key)}"
          type="${escapeHtml(inputType)}"
          value="${escapeAttr(value)}"
          placeholder="${escapeAttr(field.placeholder || "")}"
          autocomplete="off"
        >
      </label>
    `;
    }).join("")}
  `;
}

function renderSetupMediaFields() {
  return `
    <div class="setup-media full">
      ${renderSetupMediaCard({
        key: "logoPhotoId",
        title: "Company Logo",
        label: "Add Logo",
        hint: "Optional override for the TrueView mark",
        capture: false
      })}
      ${renderSetupMediaCard({
        key: "propertyPhotoId",
        title: "Property Front Photo",
        label: "Take Photo",
        hint: "Shown large on the PDF cover",
        capture: true
      })}
    </div>
  `;
}

function renderSetupMediaCard(config) {
  const photoId = state.inspection[config.key];
  const src = photoId ? photoCache.get(photoId) : "";
  return `
    <div class="setup-media-card">
      <div>
        <span>${escapeHtml(config.title)}</span>
        <small>${escapeHtml(config.hint)}</small>
      </div>
      <label class="media-drop">
        ${src ? `<img src="${src}" alt="">` : `<strong>${escapeHtml(config.label)}</strong>`}
        <input
          type="file"
          accept="image/*"
          ${config.capture ? "capture=\"environment\"" : ""}
          data-setup-photo="${escapeAttr(config.key)}"
        >
      </label>
      ${src ? `<button class="ghost-button compact" type="button" data-action="remove-setup-photo" data-photo-key="${escapeAttr(config.key)}">Remove</button>` : ""}
    </div>
  `;
}

function renderStatusLegend() {
  statusLegend.innerHTML = `
    <div class="legend-title">Status key</div>
    ${STATUS_OPTIONS.map((option) => `
      <div class="legend-item">
        <strong>${escapeHtml(option.label)}</strong>
        <span>${escapeHtml(option.name)}</span>
      </div>
    `).join("")}
  `;
}

function renderSectionList() {
  sectionList.innerHTML = state.sections.map((section) => {
    const progress = getSectionProgress(section);
    const active = section.id === state.currentSectionId ? " active" : "";
    return `
      <button class="section-button${active}" type="button" data-action="choose-section" data-section-id="${section.id}">
        <span class="section-code">${escapeHtml(section.code)}</span>
        <span class="section-name">${escapeHtml(section.title)}</span>
        <span class="section-meta">${Math.round(progress * 100)}%</span>
      </button>
    `;
  }).join("");
}

function renderSectionEditor() {
  const section = getCurrentSection();
  if (!section) return;
  const stats = getSectionStats(section);

  sectionEditor.innerHTML = `
    <section class="glass section-card">
      <div class="section-headline">
        <div>
          <p class="eyebrow">Section ${escapeHtml(section.code)}</p>
          <h2>${escapeHtml(section.title)}</h2>
          <p>${escapeHtml(section.subtitle)}</p>
        </div>
        <div class="section-stats">
          <span class="stat-pill">${stats.complete}/${stats.total} filled</span>
          <span class="stat-pill">${stats.observations} observations</span>
          <button class="ghost-button compact" type="button" data-action="mark-section-inspected">Mark IN</button>
        </div>
      </div>
      <div class="items">
        ${section.items.map((item) => renderItem(section, item)).join("")}
      </div>
    </section>
  `;
}

function renderItem(section, item) {
  return `
    <article class="item-card">
      <div class="item-main">
        <div class="item-title">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(statusLabel(item.status))} | ${escapeHtml(conditionLabel(item.condition))}</span>
        </div>
        <div class="control-stack">
          <div>
            <div class="field-label">Status</div>
            <div class="segmented">
              ${STATUS_OPTIONS.map((option) => `
                <button
                  type="button"
                  class="chip-button status-button ${item.status === option.value ? "active" : ""}"
                  data-action="set-status"
                  data-section-id="${section.id}"
                  data-item-id="${item.id}"
                  data-value="${option.value}"
                  title="${escapeAttr(option.name)}"
                ><strong>${option.label}</strong><span>${escapeHtml(option.name)}</span></button>
              `).join("")}
            </div>
          </div>
          <div>
            <div class="field-label">Condition</div>
            <div class="segmented three">
              ${CONDITION_OPTIONS.map((option) => `
                <button
                  type="button"
                  class="chip-button condition-${option.value} ${item.condition === option.value ? "active" : ""}"
                  data-action="set-condition"
                  data-section-id="${section.id}"
                  data-item-id="${item.id}"
                  data-value="${option.value}"
                >${option.label}</button>
              `).join("")}
            </div>
          </div>
        </div>
      </div>
      <div class="item-footer">
        <div class="observation-list">
          ${item.observations.length ? item.observations.map((observation) => renderObservationRow(section, item, observation)).join("") : ""}
        </div>
        <div class="item-actions">
          <button class="ghost-button compact" type="button" data-action="add-observation" data-section-id="${section.id}" data-item-id="${item.id}">Add Observation</button>
        </div>
      </div>
    </article>
  `;
}

function renderObservationRow(section, item, observation) {
  const severity = getSeverity(observation.severity);
  const photoCount = observation.photoIds.length;
  const location = observation.location ? ` | ${observation.location}` : "";
  const photos = photoCount ? ` | ${photoCount} photo${photoCount === 1 ? "" : "s"}` : "";
  return `
    <div class="observation-row ${escapeHtml(observation.severity)}">
      <div class="observation-text">
        <strong>${escapeHtml(observation.title || "Untitled observation")}</strong>
        <span>${escapeHtml(severity.label)}${escapeHtml(location)}${escapeHtml(photos)}</span>
      </div>
      <button class="ghost-button compact" type="button" data-action="edit-observation" data-section-id="${section.id}" data-item-id="${item.id}" data-observation-id="${observation.id}">Edit</button>
    </div>
  `;
}

function renderSummary() {
  const counts = getSeverityCounts();
  const totals = getInspectionTotals();
  summaryCards.innerHTML = `
    <div class="summary-card maintenance">
      <strong>${counts.maintenance}</strong>
      <span>Maintenance</span>
    </div>
    <div class="summary-card repair">
      <strong>${counts.repair}</strong>
      <span>Repair</span>
    </div>
    <div class="summary-card safety">
      <strong>${counts.safety}</strong>
      <span>Safety</span>
    </div>
    <div class="summary-progress">
      <span>Checklist</span>
      <strong>${totals.complete}/${totals.total}</strong>
    </div>
  `;
}

function renderPreview() {
  const observations = getAllObservations();
  if (!observations.length) {
    reportPreview.innerHTML = `
      <div class="empty-state">No flagged observations yet.</div>
    `;
    return;
  }

  reportPreview.innerHTML = observations.slice(0, 10).map((entry) => `
    <article class="preview-section ${escapeHtml(entry.observation.severity)}">
      <strong>${escapeHtml(entry.observation.title || "Untitled observation")}</strong>
      <p>${escapeHtml(entry.section.title)} | ${escapeHtml(entry.item.title)} | ${escapeHtml(getSeverity(entry.observation.severity).label)}</p>
    </article>
  `).join("");
}

function renderObservationSheet() {
  if (!activeObservation) return;
  const draft = activeObservation.draft;
  const item = findItem(activeObservation.sectionId, activeObservation.itemId);
  const section = findSection(activeObservation.sectionId);

  observationSheet.innerHTML = `
    <div class="sheet-header">
      <div>
        <p class="eyebrow">${escapeHtml(section.title)} | ${escapeHtml(item.title)}</p>
        <h2>${activeObservation.isNew ? "Add Observation" : "Edit Observation"}</h2>
      </div>
      <button class="ghost-button compact" type="button" data-action="close-sheet">Close</button>
    </div>

    <div class="sheet-grid">
      <label class="field full">
        <span>Quick Comments</span>
        <div class="template-row">
          ${COMMENT_TEMPLATES.map((template, index) => `
            <button class="template-chip" type="button" data-action="use-template" data-template-index="${index}">${escapeHtml(template.label)}</button>
          `).join("")}
        </div>
      </label>

      <label class="field full">
        <span>Title</span>
        <input data-draft="title" value="${escapeAttr(draft.title)}" placeholder="Observation title">
      </label>

      <label class="field">
        <span>Severity</span>
        <select data-draft="severity">
          ${SEVERITY_OPTIONS.map((option) => `
            <option value="${option.value}" ${draft.severity === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>
          `).join("")}
        </select>
      </label>

      <label class="field">
        <span>Location</span>
        <input data-draft="location" value="${escapeAttr(draft.location)}" placeholder="North wall, bathroom, roof valley">
      </label>

      <label class="field full">
        <span>Notes</span>
        <textarea data-draft="note" placeholder="Describe what was observed.">${escapeHtml(draft.note)}</textarea>
      </label>

      <label class="field full">
        <span>Recommendation</span>
        <textarea data-draft="recommendation" placeholder="Recommended action.">${escapeHtml(draft.recommendation)}</textarea>
      </label>

      <label class="field full">
        <span>Photos</span>
        <input type="file" accept="image/*" capture="environment" multiple data-photo-input="true">
      </label>

      <div class="field full">
        <div class="photo-grid">
          ${draft.photoIds.map((id) => renderPhotoTile(id)).join("")}
        </div>
      </div>
    </div>

    <div class="sheet-actions">
      ${activeObservation.isNew ? "" : `<button class="danger-button" type="button" data-action="delete-observation">Delete</button>`}
      <span class="spacer"></span>
      <button class="ghost-button" type="button" data-action="close-sheet">Cancel</button>
      <button class="primary-button" type="button" data-action="save-observation">Save</button>
    </div>
  `;

  observationSheet.hidden = false;
  sheetBackdrop.hidden = false;
}

function renderPhotoTile(id) {
  const src = photoCache.get(id);
  if (!src) return "";
  return `
    <div class="photo-tile">
      <img src="${src}" alt="">
      <button type="button" data-action="remove-photo" data-photo-id="${id}" aria-label="Remove photo">x</button>
    </div>
  `;
}

function renderSectionDrawer() {
  sectionDrawer.innerHTML = `
    <div class="sheet-header">
      <div>
        <p class="eyebrow">Jump to</p>
        <h2>Sections</h2>
      </div>
      <button class="ghost-button compact" type="button" data-action="close-sheet">Close</button>
    </div>
    <div class="section-list">
      ${state.sections.map((section) => {
        const active = section.id === state.currentSectionId ? " active" : "";
        return `
          <button class="section-button${active}" type="button" data-action="choose-section" data-section-id="${section.id}">
            <span class="section-code">${escapeHtml(section.code)}</span>
            <span class="section-name">${escapeHtml(section.title)}</span>
            <span class="section-meta">${Math.round(getSectionProgress(section) * 100)}%</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
  sectionDrawer.hidden = false;
  sheetBackdrop.hidden = false;
}

function renderReportDrawer() {
  reportDrawer.innerHTML = `
    <div class="sheet-header">
      <div>
        <p class="eyebrow">Live report</p>
        <h2>Summary</h2>
      </div>
      <button class="ghost-button compact" type="button" data-action="close-sheet">Close</button>
    </div>
    <div class="drawer-summary">
      <div class="summary-cards">${summaryCards.innerHTML}</div>
      <div class="report-preview">${reportPreview.innerHTML}</div>
    </div>
    <div class="sheet-actions">
      <button class="ghost-button" type="button" data-action="print-report">Print</button>
      <button class="ghost-button" type="button" data-action="export-current-report">Save Files</button>
      <span class="spacer"></span>
      <button class="primary-button" type="button" data-action="share-pdf">Share PDF</button>
    </div>
  `;
  reportDrawer.hidden = false;
  sheetBackdrop.hidden = false;
}

function renderLibraryDrawer() {
  const reports = getSortedReports();
  libraryDrawer.innerHTML = `
    <div class="sheet-header">
      <div>
        <p class="eyebrow">Saved inspections</p>
        <h2>Report Library</h2>
      </div>
      <button class="ghost-button compact" type="button" data-action="close-sheet">Close</button>
    </div>
    <div class="library-toolbar">
      <button class="primary-button" type="button" data-action="new-report">New Report</button>
      <button class="ghost-button" type="button" data-action="save-progress">Save Current</button>
      <button class="ghost-button" type="button" data-action="export-current-report">Save PDF + Photos</button>
    </div>
    <div class="library-list">
      ${reports.map((report) => renderLibraryRow(report)).join("")}
    </div>
  `;
  libraryDrawer.hidden = false;
  sheetBackdrop.hidden = false;
}

function renderMobileMenuDrawer() {
  const current = getCurrentSection();
  const progress = Math.round(getOverallProgress() * 100);
  mobileMenuDrawer.innerHTML = `
    <div class="sheet-header">
      <div>
        <p class="eyebrow">Field menu</p>
        <h2>${escapeHtml(current.title)}</h2>
      </div>
      <button class="ghost-button compact" type="button" data-action="close-sheet">Close</button>
    </div>
    <div class="mobile-menu-progress">
      <span>${progress}% complete</span>
      <strong>${escapeHtml(state.inspection.propertyAddress || "New inspection")}</strong>
    </div>
    <div class="mobile-menu-grid">
      <button class="mobile-menu-item reports" type="button" data-action="open-library">
        <span class="menu-symbol" aria-hidden="true"></span>
        <strong>Reports</strong>
      </button>
      <button class="mobile-menu-item sections" type="button" data-action="open-sections">
        <span class="menu-symbol" aria-hidden="true"></span>
        <strong>Sections</strong>
      </button>
      <button class="mobile-menu-item report" type="button" data-action="open-report">
        <span class="menu-symbol" aria-hidden="true"></span>
        <strong>Summary</strong>
      </button>
      <button class="mobile-menu-item save" type="button" data-action="save-progress">
        <span class="menu-symbol" aria-hidden="true"></span>
        <strong>Save</strong>
      </button>
      <button class="mobile-menu-item pdf" type="button" data-action="share-pdf">
        <span class="menu-symbol" aria-hidden="true"></span>
        <strong>Share PDF</strong>
      </button>
      <button class="mobile-menu-item new-report" type="button" data-action="new-report">
        <span class="menu-symbol" aria-hidden="true"></span>
        <strong>New</strong>
      </button>
    </div>
    <div class="mobile-menu-steps">
      <button class="ghost-button" type="button" data-action="prev-section">Back</button>
      <button class="ghost-button" type="button" data-action="next-section">Next</button>
    </div>
  `;
  mobileMenuDrawer.hidden = false;
  sheetBackdrop.hidden = false;
}

function renderLibraryRow(report) {
  const title = getReportTitle(report);
  const subtitle = getReportSubtitle(report);
  const totals = getReportTotals(report);
  const counts = getReportSeverityCounts(report);
  const active = report.id === state.id ? " active" : "";
  const exportLine = report.exportFolder
    ? `Exported ${formatDate(report.exportedAt)}`
    : "Not exported yet";
  return `
    <article class="library-row${active}">
      <div class="library-row-main">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(subtitle)}</span>
        <small>${totals.complete}/${totals.total} filled | ${counts.total} observations | Saved ${formatDate(report.lastSavedAt || report.updatedAt)}</small>
        <small>${escapeHtml(exportLine)}</small>
      </div>
      <div class="library-row-actions">
        <button class="ghost-button compact" type="button" data-action="open-saved-report" data-report-id="${escapeAttr(report.id)}">Open</button>
        <button class="ghost-button compact" type="button" data-action="export-saved-report" data-report-id="${escapeAttr(report.id)}">Export</button>
        <button class="danger-button compact" type="button" data-action="delete-saved-report" data-report-id="${escapeAttr(report.id)}">Delete</button>
      </div>
    </article>
  `;
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  const fromMobileMenu = Boolean(target.closest("#mobileMenuDrawer"));

  if (action === "choose-section") {
    state.currentSectionId = target.dataset.sectionId;
    saveState();
    closeOverlays();
    render();
    return;
  }

  if (action === "set-status") {
    const item = findItem(target.dataset.sectionId, target.dataset.itemId);
    item.status = item.status === target.dataset.value ? "" : target.dataset.value;
    saveState();
    render();
    return;
  }

  if (action === "set-condition") {
    const item = findItem(target.dataset.sectionId, target.dataset.itemId);
    item.condition = target.dataset.value;
    if (!item.status) item.status = "IN";
    saveState();
    render();
    return;
  }

  if (action === "mark-section-inspected") {
    const section = getCurrentSection();
    section.items.forEach((item) => {
      if (!item.status) item.status = "IN";
    });
    saveState();
    render();
    showToast("Section marked inspected.");
    return;
  }

  if (action === "add-observation") {
    openObservation(target.dataset.sectionId, target.dataset.itemId);
    return;
  }

  if (action === "edit-observation") {
    openObservation(target.dataset.sectionId, target.dataset.itemId, target.dataset.observationId);
    return;
  }

  if (action === "close-sheet") {
    closeOverlays();
    return;
  }

  if (action === "use-template") {
    const template = COMMENT_TEMPLATES[Number(target.dataset.templateIndex)];
    activeObservation.draft = { ...activeObservation.draft, ...template };
    renderObservationSheet();
    return;
  }

  if (action === "remove-photo") {
    const id = target.dataset.photoId;
    activeObservation.draft.photoIds = activeObservation.draft.photoIds.filter((photoId) => photoId !== id);
    if (activeObservation.addedPhotoIds.includes(id)) {
      activeObservation.addedPhotoIds = activeObservation.addedPhotoIds.filter((photoId) => photoId !== id);
      await deletePhoto(id);
    } else if (!activeObservation.removedPhotoIds.includes(id)) {
      activeObservation.removedPhotoIds.push(id);
    }
    renderObservationSheet();
    return;
  }

  if (action === "remove-setup-photo") {
    const key = target.dataset.photoKey;
    const id = state.inspection[key];
    if (id) await deletePhoto(id);
    state.inspection[key] = "";
    saveState();
    render();
    showToast("Image removed.");
    return;
  }

  if (action === "save-observation") {
    saveActiveObservation();
    await cleanupRemovedPhotos();
    closeOverlays();
    saveState();
    render();
    showToast("Observation saved.");
    return;
  }

  if (action === "delete-observation") {
    await deleteActiveObservation();
    closeOverlays();
    saveState();
    render();
    showToast("Observation deleted.");
    return;
  }

  if (action === "prev-section") {
    moveSection(-1);
    if (fromMobileMenu) closeOverlays();
    return;
  }

  if (action === "next-section") {
    moveSection(1);
    if (fromMobileMenu) closeOverlays();
    return;
  }

  if (action === "open-mobile-menu") {
    renderMobileMenuDrawer();
    return;
  }

  if (action === "open-sections") {
    closeOverlays();
    renderSectionDrawer();
    return;
  }

  if (action === "open-report") {
    closeOverlays();
    renderReportDrawer();
    return;
  }

  if (action === "open-library") {
    closeOverlays();
    renderLibraryDrawer();
    return;
  }

  if (action === "save-progress") {
    saveState({ manual: true });
    render();
    if (fromMobileMenu) closeOverlays();
    showToast("Progress saved.");
    return;
  }

  if (action === "new-report") {
    createNewReport();
    return;
  }

  if (action === "open-saved-report") {
    openSavedReport(target.dataset.reportId);
    return;
  }

  if (action === "delete-saved-report") {
    await deleteSavedReport(target.dataset.reportId);
    return;
  }

  if (action === "export-current-report") {
    await exportCurrentReport();
    return;
  }

  if (action === "export-saved-report") {
    await exportSavedReport(target.dataset.reportId);
    return;
  }

  if (action === "print-report") {
    printReport();
    return;
  }

  if (action === "generate-pdf") {
    if (fromMobileMenu) closeOverlays();
    await generatePdf("download");
    return;
  }

  if (action === "share-pdf") {
    if (fromMobileMenu) closeOverlays();
    await generatePdf("share");
  }
});

document.addEventListener("input", (event) => {
  const propertyKey = event.target.dataset.property;
  if (propertyKey) {
    state.inspection[propertyKey] = event.target.value;
    saveState();
    renderHeader();
    return;
  }

  const draftKey = event.target.dataset.draft;
  if (draftKey && activeObservation) {
    activeObservation.draft[draftKey] = event.target.value;
  }
});

document.addEventListener("change", async (event) => {
  const draftKey = event.target.dataset.draft;
  if (draftKey && activeObservation) {
    activeObservation.draft[draftKey] = event.target.value;
  }

  if (event.target.dataset.photoInput && activeObservation) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    showToast("Adding photos...");
    for (const file of files) {
      const dataUrl = await resizeImageFile(file);
      const id = uid("photo");
      await savePhoto(id, dataUrl);
      activeObservation.draft.photoIds.push(id);
      activeObservation.addedPhotoIds.push(id);
    }
    renderObservationSheet();
    showToast("Photos added.");
  }

  const setupPhotoKey = event.target.dataset.setupPhoto;
  if (setupPhotoKey) {
    const file = Array.from(event.target.files || [])[0];
    if (!file) return;
    showToast("Adding image...");
    const oldId = state.inspection[setupPhotoKey];
    const dataUrl = await resizeImageFile(file, setupPhotoKey === "logoPhotoId" ? 900 : 1800);
    const id = uid("setup");
    await savePhoto(id, dataUrl);
    state.inspection[setupPhotoKey] = id;
    if (oldId) await deletePhoto(oldId);
    saveState();
    render();
    showToast("Image added.");
  }
});

sheetBackdrop.addEventListener("click", closeOverlays);

function createNewReport() {
  saveState();
  state = createDefaultState();
  library.activeReportId = state.id;
  library.reports.unshift(state);
  persistLibrary();
  closeOverlays();
  render();
  showToast("New inspection started.");
}

function openSavedReport(reportId) {
  const report = library.reports.find((entry) => entry.id === reportId);
  if (!report) {
    showToast("Report not found.");
    return;
  }
  saveState();
  library.activeReportId = report.id;
  state = report;
  persistLibrary();
  closeOverlays();
  render();
  showToast("Inspection opened.");
}

async function deleteSavedReport(reportId) {
  const report = library.reports.find((entry) => entry.id === reportId);
  if (!report) return;
  if (!window.confirm(`Delete "${getReportTitle(report)}" from this app? Exported files on your Desktop will stay in place.`)) return;

  for (const id of getReportPhotoIds(report)) {
    await deletePhoto(id);
  }

  library.reports = library.reports.filter((entry) => entry.id !== reportId);
  if (!library.reports.length) {
    const replacement = createDefaultState();
    library.reports.push(replacement);
    library.activeReportId = replacement.id;
    state = replacement;
  } else if (state.id === reportId) {
    library.activeReportId = getSortedReports()[0].id;
    state = getActiveReport();
  }
  persistLibrary();
  render();
  renderLibraryDrawer();
  showToast("Report deleted.");
}

function getReportPhotoIds(report) {
  return [
    report.inspection.logoPhotoId,
    report.inspection.propertyPhotoId,
    ...getReportObservations(report).flatMap((entry) => entry.observation.photoIds || [])
  ].filter(Boolean);
}

function openObservation(sectionId, itemId, observationId = null) {
  const item = findItem(sectionId, itemId);
  const existing = observationId ? item.observations.find((observation) => observation.id === observationId) : null;
  activeObservation = {
    sectionId,
    itemId,
    observationId,
    isNew: !existing,
    addedPhotoIds: [],
    removedPhotoIds: [],
    draft: existing
      ? cloneObject(existing)
      : {
          id: uid("obs"),
          title: "",
          severity: "repair",
          location: "",
          note: "",
          recommendation: "Contact a qualified professional for evaluation and repair.",
          photoIds: []
        }
  };
  renderObservationSheet();
}

function saveActiveObservation() {
  if (!activeObservation) return;
  const item = findItem(activeObservation.sectionId, activeObservation.itemId);
  const draft = normalizeObservation(activeObservation.draft);
  draft.title = draft.title.trim() || "Observation";

  if (!item.status) item.status = "IN";
  if (draft.severity === "safety") item.condition = "poor";
  if (draft.severity === "repair" && item.condition === "satisfactory") item.condition = "fair";

  const index = item.observations.findIndex((observation) => observation.id === draft.id);
  if (index >= 0) item.observations[index] = draft;
  else item.observations.push(draft);
}

async function cleanupRemovedPhotos() {
  if (!activeObservation) return;
  for (const id of activeObservation.removedPhotoIds) {
    await deletePhoto(id);
  }
}

async function deleteActiveObservation() {
  if (!activeObservation) return;
  const item = findItem(activeObservation.sectionId, activeObservation.itemId);
  const observation = item.observations.find((entry) => entry.id === activeObservation.observationId);
  if (observation) {
    for (const id of observation.photoIds) {
      await deletePhoto(id);
    }
  }
  item.observations = item.observations.filter((entry) => entry.id !== activeObservation.observationId);
}

async function clearAllPhotos() {
  photoCache.clear();
  if (!photoDb) return;
  await new Promise((resolve) => {
    const transaction = photoDb.transaction(PHOTO_STORE, "readwrite");
    transaction.objectStore(PHOTO_STORE).clear();
    transaction.oncomplete = resolve;
    transaction.onerror = resolve;
  });
}

function closeOverlays() {
  observationSheet.hidden = true;
  sectionDrawer.hidden = true;
  reportDrawer.hidden = true;
  libraryDrawer.hidden = true;
  mobileMenuDrawer.hidden = true;
  sheetBackdrop.hidden = true;
  activeObservation = null;
}

function moveSection(direction) {
  const currentIndex = state.sections.findIndex((section) => section.id === state.currentSectionId);
  const nextIndex = Math.min(state.sections.length - 1, Math.max(0, currentIndex + direction));
  state.currentSectionId = state.sections[nextIndex].id;
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function findSection(sectionId) {
  return state.sections.find((section) => section.id === sectionId);
}

function findItem(sectionId, itemId) {
  const section = findSection(sectionId);
  return section.items.find((item) => item.id === itemId);
}

function getCurrentSection() {
  return findSection(state.currentSectionId) || state.sections[0];
}

function getSectionStats(section) {
  const total = section.items.length;
  const complete = section.items.filter((item) => item.status).length;
  const observations = section.items.reduce((sum, item) => sum + item.observations.length, 0);
  return { total, complete, observations };
}

function getSectionProgress(section) {
  const stats = getSectionStats(section);
  if (!stats.total) return 1;
  return stats.complete / stats.total;
}

function getOverallProgress() {
  const totals = getInspectionTotals();
  return totals.total ? totals.complete / totals.total : 1;
}

function getInspectionTotals() {
  return state.sections.reduce((acc, section) => {
    const stats = getSectionStats(section);
    acc.total += stats.total;
    acc.complete += stats.complete;
    return acc;
  }, { total: 0, complete: 0 });
}

function getReportTotals(report) {
  return report.sections.reduce((acc, section) => {
    const total = section.items.length;
    const complete = section.items.filter((item) => item.status).length;
    acc.total += total;
    acc.complete += complete;
    return acc;
  }, { total: 0, complete: 0 });
}

function getSortedReports() {
  return [...library.reports].sort((a, b) => {
    const dateA = new Date(a.lastSavedAt || a.updatedAt || a.createdAt).getTime();
    const dateB = new Date(b.lastSavedAt || b.updatedAt || b.createdAt).getTime();
    return dateB - dateA;
  });
}

function getReportTitle(report) {
  return report.inspection.propertyAddress || "Untitled inspection";
}

function getReportSubtitle(report) {
  const pieces = [
    report.inspection.cityStateZip,
    report.inspection.clientName ? `Client: ${report.inspection.clientName}` : "",
    report.inspection.inspectionDate
  ].filter(Boolean);
  return pieces.join(" | ") || "No property details yet";
}

function getReportSeverityCounts(report) {
  return getReportObservations(report).reduce((counts, entry) => {
    counts[entry.observation.severity] = (counts[entry.observation.severity] || 0) + 1;
    counts.total += 1;
    return counts;
  }, { maintenance: 0, repair: 0, safety: 0, total: 0 });
}

function getReportObservations(report) {
  const rows = [];
  report.sections.forEach((section) => {
    section.items.forEach((item) => {
      item.observations.forEach((observation) => {
        rows.push({ section, item, observation });
      });
    });
  });
  return rows;
}

function getAllObservations() {
  const rows = [];
  state.sections.forEach((section) => {
    section.items.forEach((item) => {
      item.observations.forEach((observation) => {
        rows.push({ section, item, observation });
      });
    });
  });
  return rows;
}

function getSeverityCounts() {
  return getAllObservations().reduce((counts, entry) => {
    counts[entry.observation.severity] = (counts[entry.observation.severity] || 0) + 1;
    return counts;
  }, { maintenance: 0, repair: 0, safety: 0 });
}

function getSeverity(value) {
  return SEVERITY_OPTIONS.find((option) => option.value === value) || SEVERITY_OPTIONS[1];
}

function statusLabel(value) {
  if (!value) return "Not filled";
  const match = STATUS_OPTIONS.find((option) => option.value === value);
  return match ? match.name : value;
}

function statusReportLabel(value) {
  if (!value) return "Not filled";
  const match = STATUS_OPTIONS.find((option) => option.value === value);
  return match ? `${match.label} - ${match.name}` : value;
}

function conditionLabel(value) {
  const match = CONDITION_OPTIONS.find((option) => option.value === value);
  return match ? match.label : "Satisfactory";
}

function uid(prefix) {
  if ("crypto" in window && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneObject(value) {
  if ("structuredClone" in window) return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function safeFileName(value) {
  const cleaned = String(value || "inspection-report")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "inspection-report";
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(value) {
  const parts = String(value || DEFAULT_COMPANY_NAME).trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return initials || "TV";
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

async function resizeImageFile(file, maxSide = 1300) {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.76);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function printReport() {
  printRoot.innerHTML = buildPrintHtml();
  window.print();
}

function buildPrintHtml() {
  const inspection = state.inspection;
  const counts = getSeverityCounts();
  const observations = getAllObservations();

  return `
    <section class="print-page print-cover">
      <p>${escapeHtml(getCompanyName(inspection))}</p>
      <h1>Room-by-Room Residential Report</h1>
      <h2>${escapeHtml(inspection.propertyAddress || "Property Address")}</h2>
      <p>${escapeHtml(inspection.cityStateZip || "")}</p>
      <p>${escapeHtml(inspection.clientName || "Client")} | ${escapeHtml(inspection.inspectionDate || "")}</p>
    </section>

    <section class="print-page">
      <h2>Summary</h2>
      <p>Maintenance: ${counts.maintenance} | Repair: ${counts.repair} | Safety: ${counts.safety}</p>
      ${observations.map((entry) => `
        <div class="print-observation">
          <h3>${escapeHtml(entry.observation.title)}</h3>
          <p>${escapeHtml(entry.section.title)} | ${escapeHtml(entry.item.title)} | ${escapeHtml(getSeverity(entry.observation.severity).label)}</p>
          ${entry.observation.location ? `<p><strong>Location:</strong> ${escapeHtml(entry.observation.location)}</p>` : ""}
          ${entry.observation.note ? `<p>${escapeHtml(entry.observation.note)}</p>` : ""}
        </div>
      `).join("")}
    </section>

    ${state.sections.map((section) => `
      <section class="print-page">
        <h2>${escapeHtml(section.code)}: ${escapeHtml(section.title)}</h2>
        <table class="print-table">
          <thead>
            <tr><th>Item</th><th>Status</th><th>Condition</th></tr>
          </thead>
          <tbody>
            ${section.items.map((item) => `
              <tr>
                <td>${escapeHtml(item.title)}</td>
                <td>${escapeHtml(statusReportLabel(item.status))}</td>
                <td>${escapeHtml(conditionLabel(item.condition))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        ${section.items.flatMap((item) => item.observations.map((observation) => ({ item, observation }))).map(({ item, observation }) => `
          <div class="print-observation">
            <h3>${escapeHtml(observation.title)}</h3>
            <p>${escapeHtml(item.title)} | ${escapeHtml(getSeverity(observation.severity).label)}</p>
            ${observation.location ? `<p><strong>Location:</strong> ${escapeHtml(observation.location)}</p>` : ""}
            ${observation.note ? `<p>${escapeHtml(observation.note)}</p>` : ""}
            ${observation.recommendation ? `<p><strong>Recommendation:</strong> ${escapeHtml(observation.recommendation)}</p>` : ""}
            ${observation.photoIds.length ? `
              <div class="print-photos">
                ${observation.photoIds.map((id) => {
                  const src = photoCache.get(id);
                  return src ? `<img src="${src}" alt="">` : "";
                }).join("")}
              </div>
            ` : ""}
          </div>
        `).join("")}
      </section>
    `).join("")}
  `;
}

async function generatePdf(mode) {
  showToast("Building PDF...");
  try {
    const blob = await createPdfBlob();
    const base = safeFileName(state.inspection.propertyAddress || "inspection-report");
    const filename = `${base}-inspection-report.pdf`;
    let exported = false;

    try {
      await exportReportToFolder(blob);
      exported = true;
    } catch (error) {
      console.warn(error);
    }

    if (mode === "share" && navigator.share) {
      const file = new File([blob], filename, { type: "application/pdf" });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "Inspection Report",
          text: "Residential inspection report",
          files: [file]
        });
        showToast(exported ? "Saved and share sheet opened." : "Share sheet opened.");
        return;
      }
    }

    downloadBlob(blob, filename);
    showToast(exported ? "PDF saved and downloaded." : "PDF downloaded.");
  } catch (error) {
    console.error(error);
    showToast("PDF could not be generated.");
  }
}

async function exportCurrentReport() {
  saveState({ manual: true });
  showToast("Saving report files...");
  try {
    const blob = await createPdfBlob();
    const result = await exportReportToFolder(blob);
    render();
    renderLibraryDrawer();
    showToast(`Saved to ${result.folderName}.`);
  } catch (error) {
    console.error(error);
    showToast("Could not save to Desktop folder.");
  }
}

async function exportSavedReport(reportId) {
  const report = library.reports.find((entry) => entry.id === reportId);
  if (!report) return;
  const previousState = state;
  const previousActiveId = library.activeReportId;
  state = report;
  library.activeReportId = report.id;
  try {
    await exportCurrentReport();
  } finally {
    state = previousState;
    library.activeReportId = previousActiveId;
    persistLibrary();
    render();
    renderLibraryDrawer();
  }
}

async function exportReportToFolder(pdfBlob) {
  const pdfBase64 = await blobToBase64(pdfBlob);
  const folderName = getReportFolderName(state);
  const pdfName = `${safeFileName(state.inspection.propertyAddress || "inspection-report")}-inspection-report.pdf`;
  const photos = buildExportPhotos(state);
  const response = await fetch(EXPORT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      report: {
        id: state.id,
        folderName,
        propertyAddress: state.inspection.propertyAddress,
        clientName: state.inspection.clientName,
        inspectionDate: state.inspection.inspectionDate,
        updatedAt: state.updatedAt
      },
      pdfName,
      pdfBase64,
      photos
    })
  });

  if (!response.ok) {
    throw new Error(`Export failed with ${response.status}`);
  }

  const result = await response.json();
  state.exportedAt = new Date().toISOString();
  state.exportFolderName = result.folderName || folderName;
  state.exportFolder = result.folderPath || "";
  state.exportPdfPath = result.pdfPath || "";
  saveState({ manual: true });
  return result;
}

function getReportFolderName(report) {
  if (report.exportFolderName) return report.exportFolderName;
  const date = report.inspection.inspectionDate || new Date().toISOString().slice(0, 10);
  const base = safeFileName(report.inspection.propertyAddress || "untitled-inspection");
  const shortId = String(report.id || uid("report")).split("-").slice(-1)[0].slice(0, 8);
  report.exportFolderName = `${date}-${base}-${shortId}`;
  return report.exportFolderName;
}

function buildExportPhotos(report) {
  const photos = [];
  [
    { id: report.inspection.logoPhotoId, fileName: "company-logo.jpg", section: "Field Setup", item: "Company Logo", observation: "Company logo" },
    { id: report.inspection.propertyPhotoId, fileName: "property-front-photo.jpg", section: "Field Setup", item: "Property Front Photo", observation: "Property front photo" }
  ].forEach((coverPhoto) => {
    if (!coverPhoto.id) return;
    const dataUrl = photoCache.get(coverPhoto.id);
    if (!dataUrl) return;
    photos.push({ ...coverPhoto, dataUrl });
  });
  getReportObservations(report).forEach((entry, entryIndex) => {
    (entry.observation.photoIds || []).forEach((id, photoIndex) => {
      const dataUrl = photoCache.get(id);
      if (!dataUrl) return;
      photos.push({
        id,
        fileName: `${String(entryIndex + 1).padStart(2, "0")}-${safeFileName(entry.section.title)}-${safeFileName(entry.item.title)}-${photoIndex + 1}.jpg`,
        section: entry.section.title,
        item: entry.item.title,
        observation: entry.observation.title,
        dataUrl
      });
    });
  });
  return photos;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

async function createPdfBlob() {
  const canvases = await renderReportCanvases();
  const images = canvases.map((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    bytes: dataUrlToBytes(canvas.toDataURL("image/jpeg", 0.86))
  }));
  return buildPdfFromJpegs(images, 595.28, 841.89);
}

async function renderReportCanvases() {
  const pageWidth = 1240;
  const pageHeight = 1754;
  const margin = 88;
  const bottom = pageHeight - 96;
  const pages = [];
  let page = null;

  const inspection = state.inspection;
  const counts = getSeverityCounts();
  const observations = getAllObservations();
  const headerLogoSrc = inspection.logoPhotoId ? photoCache.get(inspection.logoPhotoId) : "";
  const headerLogoImage = headerLogoSrc ? await loadImage(headerLogoSrc).catch(() => null) : null;

  function startPage(title) {
    const canvas = document.createElement("canvas");
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    const ctx = canvas.getContext("2d");
    drawPdfPageBackground(ctx, pageWidth, pageHeight);
    drawGlassPanel(ctx, margin, 34, pageWidth - margin * 2, 82, 18, { shadowBlur: 18, shadowOffsetY: 8 });
    if (headerLogoImage) {
      drawImageContain(ctx, headerLogoImage, margin + 18, 51, 48, 48, {
        fill: "#ffffff",
        stroke: PDF_COLORS.line,
        radius: 10,
        padding: 5
      });
    } else {
      drawTrueViewLogo(ctx, margin + 18, 51, 48);
    }
    ctx.fillStyle = PDF_COLORS.ink;
    ctx.font = "700 23px Arial";
    ctx.fillText(getCompanyName(inspection), margin + 82, 65);
    ctx.fillStyle = PDF_COLORS.muted;
    ctx.font = "400 18px Arial";
    ctx.fillText(inspection.propertyAddress || "Residential Inspection", margin + 82, 90);
    ctx.textAlign = "right";
    ctx.fillStyle = PDF_COLORS.brand;
    ctx.font = "700 19px Arial";
    ctx.fillText(title || "Inspection Report", pageWidth - margin - 18, 78);
    ctx.textAlign = "left";
    return { canvas, ctx, y: 166, title };
  }

  function finishPage() {
    if (!page) return;
    page.ctx.strokeStyle = PDF_COLORS.line;
    page.ctx.lineWidth = 2;
    page.ctx.beginPath();
    page.ctx.moveTo(margin, pageHeight - 86);
    page.ctx.lineTo(pageWidth - margin, pageHeight - 86);
    page.ctx.stroke();
    page.ctx.fillStyle = PDF_COLORS.muted;
    page.ctx.font = "400 18px Arial";
    page.ctx.fillText(getCompanyName(inspection), margin, pageHeight - 54);
    page.ctx.textAlign = "right";
    page.ctx.fillText(`Page ${pages.length + 1}`, pageWidth - margin, pageHeight - 54);
    page.ctx.textAlign = "left";
    pages.push(page.canvas);
    page = null;
  }

  function ensure(height, title) {
    if (!page) page = startPage(title);
    if (page.y + height > bottom) {
      finishPage();
      page = startPage(title);
    }
  }

  page = startPage("Room-by-Room Residential");
  await drawCover(page.ctx, inspection, counts, pageWidth, pageHeight, margin);
  finishPage();

  page = startPage("Summary");
  drawSummaryCards(page.ctx, counts, margin, page.y);
  page.y += 185;
  page.y = drawStatusKey(page.ctx, margin, page.y, pageWidth - margin * 2);
  page.y += 32;
  page.ctx.fillStyle = PDF_COLORS.ink;
  page.ctx.font = "700 32px Arial";
  page.ctx.fillText("Observation Summary", margin, page.y);
  page.y += 42;

  if (!observations.length) {
    drawMutedText(page.ctx, "No reportable observations have been added.", margin, page.y, pageWidth - margin * 2, 28);
    page.y += 54;
  }

  for (const entry of observations) {
    const height = measureObservation(page.ctx, entry.observation, pageWidth - margin * 2, true);
    ensure(height + 24, "Summary");
    drawObservationSummary(page.ctx, entry, margin, page.y, pageWidth - margin * 2);
    page.y += height + 22;
  }
  finishPage();

  page = startPage("Report Map");
  drawReportMap(page.ctx, state.sections, margin, page.y, pageWidth - margin * 2);
  finishPage();

  for (const section of state.sections) {
    page = startPage(`${section.code}: ${section.title}`);
    page.ctx.fillStyle = PDF_COLORS.ink;
    page.ctx.font = "700 38px Arial";
    page.ctx.fillText(`${section.code}: ${section.title}`, margin, page.y);
    page.y += 44;
    page.y = drawWrapped(page.ctx, section.subtitle, margin, page.y, pageWidth - margin * 2, 26, PDF_COLORS.muted, "400 21px Arial");
    page.y += 28;

    drawChecklistHeader(page.ctx, margin, page.y, pageWidth - margin * 2);
    page.y += 48;
    for (const item of section.items) {
      ensure(46, `${section.code}: ${section.title}`);
      drawChecklistRow(page.ctx, item, margin, page.y, pageWidth - margin * 2);
      page.y += 46;
    }
    page.y += 22;

    const sectionObservations = section.items.flatMap((item) => item.observations.map((observation) => ({ section, item, observation })));
    if (!sectionObservations.length) {
      ensure(58, `${section.code}: ${section.title}`);
      drawMutedText(page.ctx, "No reportable observations in this section.", margin, page.y, pageWidth - margin * 2, 26);
      page.y += 58;
    }

    for (const entry of sectionObservations) {
      const height = measureObservation(page.ctx, entry.observation, pageWidth - margin * 2, false);
      ensure(height + 28, `${section.code}: ${section.title}`);
      page.y = await drawFullObservation(page.ctx, entry, margin, page.y, pageWidth - margin * 2);
      page.y += 24;
    }
    finishPage();
  }

  return pages;
}

async function drawCover(ctx, inspection, counts, width, height, margin) {
  const coverWidth = width - margin * 2;
  const propertySrc = inspection.propertyPhotoId ? photoCache.get(inspection.propertyPhotoId) : "";
  const logoSrc = inspection.logoPhotoId ? photoCache.get(inspection.logoPhotoId) : "";
  const companyName = getCompanyName(inspection);

  drawGlassPanel(ctx, margin, 170, coverWidth, 396, 26, { shadowBlur: 26, shadowOffsetY: 12 });
  if (propertySrc) {
    const propertyImage = await loadImage(propertySrc);
    drawImageContain(ctx, propertyImage, margin + 24, 194, coverWidth - 48, 348, {
      fill: "#edf2f0",
      stroke: PDF_COLORS.line,
      radius: 22,
      padding: 0
    });
  } else {
    drawTrueViewLogo(ctx, margin + 42, 250, 104);
    ctx.fillStyle = PDF_COLORS.ink;
    ctx.font = "800 54px Arial";
    wrapAndDraw(ctx, "Residential Inspection Report", margin + 178, 292, coverWidth - 230, 58);
    ctx.fillStyle = PDF_COLORS.muted;
    ctx.font = "700 22px Arial";
    ctx.fillText("Clear findings, prioritized recommendations, and field photos", margin + 178, 420);
  }

  drawGlassPanel(ctx, margin, 610, coverWidth, 214, 20, { shadowBlur: 20, shadowOffsetY: 9 });
  if (logoSrc) {
    const logoImage = await loadImage(logoSrc);
    drawImageContain(ctx, logoImage, margin + 30, 638, 116, 116, {
      fill: "#ffffff",
      stroke: PDF_COLORS.line,
      radius: 16,
      padding: 8
    });
  } else {
    drawTrueViewLogo(ctx, margin + 30, 638, 116);
  }

  const textX = margin + 178;
  ctx.fillStyle = PDF_COLORS.brand;
  ctx.font = "800 20px Arial";
  ctx.fillText(companyName.toUpperCase(), textX, 656);
  ctx.fillStyle = PDF_COLORS.ink;
  ctx.font = "700 38px Arial";
  wrapAndDraw(ctx, inspection.propertyAddress || "Property Address", textX, 704, width - textX - margin - 28, 42);
  ctx.fillStyle = PDF_COLORS.muted;
  ctx.font = "400 22px Arial";
  wrapAndDraw(ctx, inspection.cityStateZip || "", textX, 755, width - textX - margin - 28, 30);
  wrapAndDraw(ctx, `${inspection.clientName || "Client"} | ${inspection.inspectionDate || ""}`, textX, 786, width - textX - margin - 28, 30);

  const cardY = 880;
  const metricGap = 22;
  const metricWidth = (coverWidth - metricGap * 2) / 3;
  drawMetricCard(ctx, margin, cardY, metricWidth, 142, counts.maintenance, "Maintenance", PDF_COLORS.maintenance);
  drawMetricCard(ctx, margin + metricWidth + metricGap, cardY, metricWidth, 142, counts.repair, "Repair", PDF_COLORS.repair);
  drawMetricCard(ctx, margin + metricWidth * 2 + metricGap * 2, cardY, metricWidth, 142, counts.safety, "Safety", PDF_COLORS.safety);

  drawStatusKey(ctx, margin, 1084, width - margin * 2);

  drawGlassPanel(ctx, margin, height - 286, width - margin * 2, 154, 18, { shadowBlur: 18, shadowOffsetY: 8 });
  ctx.fillStyle = PDF_COLORS.ink;
  ctx.font = "700 28px Arial";
  ctx.fillText(companyName, margin + 28, height - 228);
  ctx.fillStyle = PDF_COLORS.muted;
  ctx.font = "400 22px Arial";
  wrapAndDraw(ctx, [inspection.inspectorName, inspection.companyPhone, inspection.companyEmail].filter(Boolean).join(" | "), margin + 28, height - 188, width - margin * 2 - 56, 30);
}

function drawMetricCard(ctx, x, y, w, h, value, label, color) {
  drawGlassPanel(ctx, x, y, w, h, 16, { shadowBlur: 16, shadowOffsetY: 7 });
  roundedRect(ctx, x + 18, y + 18, 46, 7, 4, color, null);
  ctx.fillStyle = color;
  ctx.font = "800 56px Arial";
  ctx.fillText(String(value), x + 22, y + 82);
  ctx.fillStyle = PDF_COLORS.muted;
  ctx.font = "700 20px Arial";
  ctx.fillText(label, x + 22, y + 116);
}

function drawSummaryCards(ctx, counts, x, y) {
  drawMetricCard(ctx, x, y, 310, 135, counts.maintenance, "Maintenance", PDF_COLORS.maintenance);
  drawMetricCard(ctx, x + 340, y, 310, 135, counts.repair, "Repair", PDF_COLORS.repair);
  drawMetricCard(ctx, x + 680, y, 310, 135, counts.safety, "Safety", PDF_COLORS.safety);
}

function drawStatusKey(ctx, x, y, width) {
  drawGlassPanel(ctx, x, y, width, 78, 14, { shadowBlur: 14, shadowOffsetY: 6 });
  ctx.fillStyle = PDF_COLORS.muted;
  ctx.font = "700 17px Arial";
  ctx.fillText("STATUS KEY", x + 18, y + 31);
  const cellWidth = (width - 180) / STATUS_OPTIONS.length;
  STATUS_OPTIONS.forEach((option, index) => {
    const cellX = x + 160 + index * cellWidth;
    roundedRect(ctx, cellX, y + 18, 48, 34, 8, PDF_COLORS.brandSoft, "rgba(15, 111, 121, 0.22)");
    ctx.fillStyle = PDF_COLORS.brand;
    ctx.font = "800 16px Arial";
    ctx.fillText(option.label, cellX + 13, y + 41);
    ctx.fillStyle = PDF_COLORS.muted;
    ctx.font = "700 15px Arial";
    ctx.fillText(option.name, cellX + 58, y + 40);
  });
  return y + 78;
}

function drawReportMap(ctx, sections, x, y, width) {
  ctx.fillStyle = PDF_COLORS.ink;
  ctx.font = "700 36px Arial";
  ctx.fillText("Report Map", x, y);
  y += 50;
  ctx.fillStyle = PDF_COLORS.muted;
  ctx.font = "400 21px Arial";
  y = wrapAndDraw(ctx, "Each section below contains the checklist status table and any reportable observations for that area.", x, y, width, 28);
  y += 30;

  const colGap = 24;
  const colWidth = (width - colGap) / 2;
  sections.forEach((section, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const cellX = x + col * (colWidth + colGap);
    const cellY = y + row * 76;
    const stats = getSectionStats(section);
    drawGlassPanel(ctx, cellX, cellY, colWidth, 58, 10, { shadowBlur: 10, shadowOffsetY: 4 });
    roundedRect(ctx, cellX + 12, cellY + 12, 42, 34, 8, PDF_COLORS.brandSoft, null);
    ctx.fillStyle = PDF_COLORS.brand;
    ctx.font = "800 15px Arial";
    ctx.fillText(section.code, cellX + 22, cellY + 34);
    ctx.fillStyle = PDF_COLORS.ink;
    ctx.font = "700 18px Arial";
    trimText(ctx, section.title, cellX + 66, cellY + 25, colWidth - 190);
    ctx.fillStyle = PDF_COLORS.muted;
    ctx.font = "400 15px Arial";
    ctx.fillText(`${stats.total} items | ${stats.observations} observations`, cellX + 66, cellY + 45);
  });
}

function drawObservationSummary(ctx, entry, x, y, width) {
  const observation = entry.observation;
  const height = measureObservation(ctx, observation, width, true);
  drawGlassPanel(ctx, x, y, width, height, 14, { shadowBlur: 14, shadowOffsetY: 6 });
  ctx.fillStyle = getSeverityColor(observation.severity);
  roundedRect(ctx, x + 16, y + 18, 6, height - 36, 3, getSeverityColor(observation.severity), null);
  drawSeverityPill(ctx, observation.severity, x + 18, y + 22);
  ctx.fillStyle = PDF_COLORS.ink;
  ctx.font = "700 24px Arial";
  ctx.fillText(observation.title || "Observation", x + 18, y + 78);
  ctx.fillStyle = PDF_COLORS.muted;
  ctx.font = "400 19px Arial";
  ctx.fillText(`${entry.section.title} | ${entry.item.title}${observation.location ? " | " + observation.location : ""}`, x + 18, y + 108);
  drawWrapped(ctx, observation.note, x + 18, y + 142, width - 36, 26, PDF_COLORS.ink, "400 20px Arial");
}

function drawChecklistHeader(ctx, x, y, width) {
  drawGlassPanel(ctx, x, y, width, 42, 10, { shadowBlur: 8, shadowOffsetY: 3 });
  ctx.fillStyle = PDF_COLORS.muted;
  ctx.font = "700 17px Arial";
  ctx.fillText("Item", x + 12, y + 26);
  ctx.fillText("Status", x + width - 360, y + 26);
  ctx.fillText("Condition", x + width - 160, y + 26);
}

function drawChecklistRow(ctx, item, x, y, width) {
  ctx.strokeStyle = PDF_COLORS.line;
  ctx.beginPath();
  ctx.moveTo(x, y + 40);
  ctx.lineTo(x + width, y + 40);
  ctx.stroke();
  ctx.fillStyle = PDF_COLORS.ink;
  ctx.font = "400 20px Arial";
  trimText(ctx, item.title, x + 12, y + 27, width - 390);
  ctx.fillStyle = PDF_COLORS.muted;
  ctx.font = "700 18px Arial";
  trimText(ctx, statusReportLabel(item.status), x + width - 360, y + 27, 175);
  ctx.fillText(conditionLabel(item.condition), x + width - 160, y + 27);
}

function measureObservation(ctx, observation, width, compact) {
  const noteLines = wrapLines(ctx, observation.note || "", width - 36, "400 20px Arial");
  const recLines = wrapLines(ctx, observation.recommendation || "", width - 36, "400 20px Arial");
  let height = compact ? 168 : 220;
  height += noteLines.length * 26;
  if (!compact) height += recLines.length * 26;
  if (!compact && observation.photoIds.length) {
    const rows = Math.ceil(Math.min(observation.photoIds.length, 4) / 2);
    height += rows * 385 + 20;
  }
  return Math.max(compact ? 160 : 230, height);
}

async function drawFullObservation(ctx, entry, x, y, width) {
  const observation = entry.observation;
  const height = measureObservation(ctx, observation, width, false);
  drawGlassPanel(ctx, x, y, width, height, 14, { shadowBlur: 14, shadowOffsetY: 6 });
  roundedRect(ctx, x + 16, y + 18, 6, height - 36, 3, getSeverityColor(observation.severity), null);
  drawSeverityPill(ctx, observation.severity, x + 18, y + 22);

  ctx.fillStyle = PDF_COLORS.ink;
  ctx.font = "700 26px Arial";
  ctx.fillText(observation.title || "Observation", x + 18, y + 78);
  ctx.fillStyle = PDF_COLORS.muted;
  ctx.font = "400 19px Arial";
  ctx.fillText(`${entry.item.title}${observation.location ? " | " + observation.location : ""}`, x + 18, y + 110);

  let currentY = y + 148;
  if (observation.note) {
    currentY = drawWrapped(ctx, observation.note, x + 18, currentY, width - 36, 26, PDF_COLORS.ink, "400 20px Arial");
    currentY += 18;
  }

  if (observation.recommendation) {
    ctx.fillStyle = PDF_COLORS.ink;
    ctx.font = "700 20px Arial";
    ctx.fillText("Recommendation", x + 18, currentY);
    currentY += 28;
    currentY = drawWrapped(ctx, observation.recommendation, x + 18, currentY, width - 36, 26, PDF_COLORS.ink, "400 20px Arial");
    currentY += 18;
  }

  const photos = observation.photoIds.slice(0, 4).map((id) => photoCache.get(id)).filter(Boolean);
  if (photos.length) {
    const photoWidth = (width - 54) / 2;
    const photoHeight = 360;
    for (let index = 0; index < photos.length; index += 1) {
      const image = await loadImage(photos[index]);
      const px = x + 18 + (index % 2) * (photoWidth + 18);
      const py = currentY + Math.floor(index / 2) * (photoHeight + 18);
      drawImageContain(ctx, image, px, py, photoWidth, photoHeight, {
        fill: PDF_COLORS.faint,
        stroke: PDF_COLORS.line,
        radius: 12
      });
    }
  }

  return y + height;
}

function drawSeverityPill(ctx, severity, x, y) {
  const option = getSeverity(severity);
  const color = getSeverityColor(severity);
  ctx.font = "700 17px Arial";
  const width = ctx.measureText(option.label).width + 28;
  roundedRect(ctx, x, y, width, 34, 17, `${color}22`, `${color}44`);
  ctx.fillStyle = color;
  ctx.fillText(option.label, x + 14, y + 23);
}

function getSeverityColor(severity) {
  if (severity === "safety") return PDF_COLORS.safety;
  if (severity === "repair") return PDF_COLORS.repair;
  return PDF_COLORS.maintenance;
}

function drawMutedText(ctx, text, x, y, width, lineHeight) {
  return drawWrapped(ctx, text, x, y, width, lineHeight, PDF_COLORS.muted, "400 21px Arial");
}

function drawWrapped(ctx, text, x, y, width, lineHeight, color, font) {
  ctx.fillStyle = color;
  ctx.font = font;
  return wrapAndDraw(ctx, text, x, y, width, lineHeight);
}

function wrapAndDraw(ctx, text, x, y, width, lineHeight) {
  const lines = wrapLines(ctx, text || "", width, ctx.font);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function wrapLines(ctx, text, width, font) {
  ctx.font = font;
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= width) {
      line = test;
      return;
    }
    if (line) lines.push(line);
    line = word;
  });
  if (line) lines.push(line);
  return lines;
}

function trimText(ctx, text, x, y, width) {
  const value = String(text || "");
  if (ctx.measureText(value).width <= width) {
    ctx.fillText(value, x, y);
    return;
  }
  let trimmed = value;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}...`).width > width) {
    trimmed = trimmed.slice(0, -1);
  }
  ctx.fillText(`${trimmed}...`, x, y);
}

function getCompanyName(inspection = state.inspection) {
  return inspection.companyName || DEFAULT_COMPANY_NAME;
}

function drawPdfPageBackground(ctx, width, height) {
  const paper = ctx.createLinearGradient(0, 0, 0, height);
  paper.addColorStop(0, PDF_COLORS.paperTop);
  paper.addColorStop(1, PDF_COLORS.paperBottom);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);

  const sheen = ctx.createLinearGradient(0, 0, width, 0);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0)");
  sheen.addColorStop(0.42, "rgba(255, 255, 255, 0.52)");
  sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, width, 148);

  ctx.fillStyle = "rgba(15, 111, 121, 0.025)";
  ctx.fillRect(0, 0, width, 5);
}

function drawGlassPanel(ctx, x, y, width, height, radius, options = {}) {
  const fill = ctx.createLinearGradient(x, y, x + width, y + height);
  fill.addColorStop(0, options.fillStart || "rgba(255, 255, 255, 0.94)");
  fill.addColorStop(0.52, options.fillMid || "rgba(247, 251, 250, 0.78)");
  fill.addColorStop(1, options.fillEnd || "rgba(255, 255, 255, 0.88)");

  ctx.save();
  ctx.shadowColor = options.shadowColor || "rgba(23, 33, 31, 0.10)";
  ctx.shadowBlur = options.shadowBlur === undefined ? 20 : options.shadowBlur;
  ctx.shadowOffsetY = options.shadowOffsetY === undefined ? 8 : options.shadowOffsetY;
  roundedRect(ctx, x, y, width, height, radius, fill, null);
  ctx.restore();

  roundedRect(ctx, x, y, width, height, radius, null, options.stroke || PDF_COLORS.line);

  const highlight = ctx.createLinearGradient(x, y, x + width, y + height * 0.38);
  highlight.addColorStop(0, "rgba(255, 255, 255, 0.58)");
  highlight.addColorStop(0.55, "rgba(255, 255, 255, 0.12)");
  highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.save();
  ctx.globalAlpha = options.highlightAlpha === undefined ? 0.8 : options.highlightAlpha;
  roundedRect(ctx, x + 2, y + 2, width - 4, Math.min(height * 0.52, 72), Math.max(4, radius - 2), highlight, null);
  ctx.restore();
}

function drawTrueViewLogo(ctx, x, y, size) {
  const radius = Math.max(8, size * 0.22);
  roundedRect(ctx, x, y, size, size, radius, PDF_COLORS.brandDeep, null);

  const highlight = ctx.createLinearGradient(x, y, x + size, y + size);
  highlight.addColorStop(0, "rgba(255, 255, 255, 0.30)");
  highlight.addColorStop(0.42, "rgba(255, 255, 255, 0)");
  highlight.addColorStop(1, "rgba(121, 214, 220, 0.18)");
  roundedRect(ctx, x, y, size, size, radius, highlight, "rgba(255, 255, 255, 0.22)");

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "#f5fbf8";
  ctx.lineWidth = Math.max(2, size * 0.058);
  ctx.beginPath();
  ctx.moveTo(x + size * 0.24, y + size * 0.53);
  ctx.lineTo(x + size * 0.5, y + size * 0.32);
  ctx.lineTo(x + size * 0.76, y + size * 0.53);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + size * 0.32, y + size * 0.55);
  ctx.lineTo(x + size * 0.32, y + size * 0.74);
  ctx.lineTo(x + size * 0.68, y + size * 0.74);
  ctx.lineTo(x + size * 0.68, y + size * 0.55);
  ctx.stroke();

  ctx.strokeStyle = "#79d6dc";
  ctx.lineWidth = Math.max(2, size * 0.052);
  ctx.beginPath();
  ctx.arc(x + size * 0.5, y + size * 0.6, size * 0.14, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + size * 0.43, y + size * 0.6);
  ctx.lineTo(x + size * 0.49, y + size * 0.66);
  ctx.lineTo(x + size * 0.6, y + size * 0.53);
  ctx.stroke();
  ctx.restore();
}

function roundedRect(ctx, x, y, width, height, radius, fill, stroke) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawImageCover(ctx, image, x, y, width, height) {
  roundedRect(ctx, x, y, width, height, 12, PDF_COLORS.faint, PDF_COLORS.line);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const frameRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;
  if (imageRatio > frameRatio) {
    sw = image.naturalHeight * frameRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = image.naturalWidth / frameRatio;
    sy = (image.naturalHeight - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  ctx.restore();
}

function drawImageContain(ctx, image, x, y, width, height, options = {}) {
  const fill = options.fill === undefined ? PDF_COLORS.faint : options.fill;
  const stroke = options.stroke === undefined ? PDF_COLORS.line : options.stroke;
  const radius = options.radius === undefined ? 12 : options.radius;
  roundedRect(ctx, x, y, width, height, radius, fill, stroke);

  const padding = options.padding === undefined ? 12 : options.padding;
  const innerX = x + padding;
  const innerY = y + padding;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const frameRatio = innerWidth / innerHeight;
  let drawWidth = innerWidth;
  let drawHeight = innerHeight;

  if (imageRatio > frameRatio) {
    drawHeight = innerWidth / imageRatio;
  } else {
    drawWidth = innerHeight * imageRatio;
  }

  const dx = innerX + (innerWidth - drawWidth) / 2;
  const dy = innerY + (innerHeight - drawHeight) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
  ctx.restore();
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function buildPdfFromJpegs(images, pageWidth, pageHeight) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let length = 0;

  function addAscii(text) {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    length += bytes.length;
  }

  function addBytes(bytes) {
    chunks.push(bytes);
    length += bytes.length;
  }

  function beginObject(id) {
    offsets[id] = length;
    addAscii(`${id} 0 obj\n`);
  }

  function endObject() {
    addAscii("\nendobj\n");
  }

  const pageObjects = images.map((_, index) => 3 + index * 3);
  const objectCount = 2 + images.length * 3;

  addAscii("%PDF-1.4\n");

  beginObject(1);
  addAscii("<< /Type /Catalog /Pages 2 0 R >>");
  endObject();

  beginObject(2);
  addAscii(`<< /Type /Pages /Count ${images.length} /Kids [${pageObjects.map((id) => `${id} 0 R`).join(" ")}] >>`);
  endObject();

  images.forEach((image, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const content = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im${index} Do Q`;

    beginObject(pageId);
    addAscii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im${index} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    endObject();

    beginObject(contentId);
    addAscii(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    endObject();

    beginObject(imageId);
    addAscii(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`);
    addBytes(image.bytes);
    addAscii("\nendstream");
    endObject();
  });

  const xrefOffset = length;
  addAscii(`xref\n0 ${objectCount + 1}\n`);
  addAscii("0000000000 65535 f \n");
  for (let id = 1; id <= objectCount; id += 1) {
    addAscii(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  addAscii(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const blob = new Blob(chunks, { type: "application/pdf" });
  return blob;
}
