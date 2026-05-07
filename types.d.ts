export type SyncStatus = "pending" | "syncing" | "synced" | "failed" | "conflict";
export type ReportStatus = "Draft" | "In Progress" | "Ready for Review" | "Finalized" | "Synced" | "Sync Pending" | "Conflict";

export interface InspectionReport {
  id: string;
  localId?: string;
  remoteId?: string;
  deviceId?: string;
  createdAt: string;
  updatedAt: string;
  lastSavedAt: string;
  exportedAt?: string;
  reportStatus: ReportStatus;
  syncStatus: SyncStatus;
  currentSectionId: string;
  inspection: InspectionSetup;
  sections: ReportSectionInstance[];
}

export interface InspectionSetup {
  propertyAddress: string;
  cityStateZip: string;
  inspectionDate: string;
  clientName: string;
  agentName: string;
  agentPhone: string;
  agentEmail: string;
  companyName: string;
  inspectorName: string;
  companyPhone: string;
  companyEmail: string;
  weather: string;
  occupancy: string;
  logoPhotoId: string;
  propertyPhotoId: string;
}

export interface ReportSectionInstance {
  id: string;
  sectionId: string;
  sectionType: string;
  templateId: string;
  code: string;
  title: string;
  displayName: string;
  customDisplayName: boolean;
  sortOrder: number;
  isRequired: boolean;
  isRepeatable: boolean;
  isApplicable: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  items: InspectionItem[];
}

export interface SectionTemplate {
  templateId: string;
  sectionType: string;
  label: string;
  subtitle: string;
  items: string[];
  isRequired: boolean;
  isRepeatable: boolean;
}

export interface InspectionItem {
  id: string;
  title: string;
  status: "" | "NA" | "IN" | "NI" | "NP";
  condition: "satisfactory" | "fair" | "poor";
  observations: Observation[];
}

export interface Observation {
  id: string;
  title: string;
  severity: "maintenance" | "repair" | "safety";
  location: string;
  note: string;
  recommendation: string;
  photoIds: string[];
}

export interface SyncQueueRecord {
  localId: string;
  remoteId?: string;
  entity: "report" | "section" | "item" | "photo" | "settings";
  entityLocalId: string;
  mutationType: string;
  status: SyncStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  deviceId: string;
}
