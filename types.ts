
export interface Client {
  id: number;
  nome: string;
  indirizzo: string;
  piva?: string;           // NEW: Partita IVA / Codice Fiscale
  codiceUnivoco?: string;  // NEW: Codice Univoco SDI
  pec?: string;            // NEW: PEC
  referente: string;
  telefono: string;
  email: string;
  commessa?: string;    
  idCommessa?: string;  
  struttura?: string;   
  indirizzoStruttura?: string; // NEW: Indirizzo specifico della struttura
  idStruttura?: string; 
  referenteCommessa?: string; 
  recapitoCommessa?: string;  
  pagamento?: string;
  note?: string;
  updatedAt?: string; // Sync Conflict Handling
}

// Articolo di Listino / Catalogo (Generico)
export interface Article {
  id: string; 
  categoria: string;
  descrizione: string;
  note: string;
  updatedAt?: string;
}

// Presidio Installato (Specifico per Cliente)
export interface Asset {
  id: string; 
  clientId: number; 
  tipo: string; 
  matricola?: string; 
  ubicazione?: string; 
  scadenza: string;
  dataUltimaRevisione?: string;
  categoria?: string;
  note?: string;
  updatedAt?: string;
}

export interface Intervention {
  id: string;
  timestamp: string;
  clientId: number;
  clientName: string;
  assetId: string;
  assetName: string;
  services: string[];
  anomalies: string[];
  notes: string;
  // photos?: string[]; // DISABILITATO PER STABILITA'
  
  // Campi Sessione
  generalNotes?: string;
  technicianSignature?: string; 
  technicianSignatureImage?: string; 
  clientSignature?: string; 
  clientSignatureImage?: string;
  updatedAt?: string;
}

export interface WorkSession {
  id: string; 
  clientId: number;
  startTimestamp: string;
  status: 'PLANNED' | 'OPEN' | 'CLOSED'; 
  
  scheduledDate?: string; 
  assignedTechId?: string; 
  assignedTechIds?: string[];
  assignedTechName?: string; 

  generalNotes: string;
  technicianSignature: string;
  technicianSignatureImage: string;
  clientSignature: string;
  clientSignatureImage: string;
  
  draftInterventions: Intervention[];
  interventionIds: string[];
  updatedAt?: string;
}

export interface Technician {
  id: string;
  name: string;
  email: string;
  color: string; 
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  timestamp: string;
  read: boolean;
}

export interface SupabaseConfig {
  url: string;
  key: string;
}

export interface DataContextType {
  clients: Client[];
  articles: Article[];
  assets: Asset[];
  services: string[];
  anomalies: string[];
  checklistTemplates: Record<string, string[]>; 
  categoryAnomalies: Record<string, string[]>; // NEW: Structured Anomalies
  interventions: Intervention[]; 
  notifications: Notification[];
  sessions: WorkSession[]; 
  technicians: Technician[]; 
  isLoading: boolean; // Loading State per IndexedDB

  // Remote Config
  remoteUrl: string; 
  supabaseConfig: SupabaseConfig;
  setSupabaseConfig: (config: SupabaseConfig) => void;
  setRemoteUrl: (url: string) => void;
  
  // Sync
  syncData: () => Promise<{ success: boolean; message: string }>;
  downloadCloudData: () => Promise<{ success: boolean; message?: string }>; 

  // Session Management
  getOpenSession: (clientId: number) => WorkSession | undefined;
  createSession: (clientId: number) => WorkSession;
  scheduleSession: (clientId: number, date: string, techIds: string[]) => void; 
  updateSession: (clientId: number, data: Partial<WorkSession>) => void;
  
  saveInterventionToSession: (sessionId: string, intervention: Intervention, metadata?: Partial<WorkSession>) => void; 
  closeSession: (sessionId: string, finalMetadata?: Partial<WorkSession>) => void; 
  reopenSession: (clientId: number) => void;
  deleteSession: (sessionId: string) => void; 
  
  addIntervention: (intervention: Intervention) => void;
  addInterventionsBulk: (interventions: Intervention[]) => void;
  
  // Clienti
  addClient: (client: Client) => void;
  updateClient: (client: Client) => void;
  addClientsBulk: (clients: Omit<Client, 'id'>[]) => void;
  deleteClient: (id: number) => void;

  // Articoli
  addArticle: (article: Article) => void;
  addArticlesBulk: (articles: Article[]) => void;
  deleteArticle: (id: string) => void;

  // Asset
  addAsset: (asset: Asset) => void;
  addAssetsBulk: (assets: Asset[]) => void;
  updateAsset: (asset: Asset) => void; 
  deleteAsset: (id: string) => void;

  // Utilities
  addService: (service: string) => void;
  addAnomaly: (anomaly: string) => void;
  deleteService: (service: string) => void;
  deleteAnomaly: (anomaly: string) => void;
  
  // Template Management
  updateChecklistTemplate: (category: string, items: string[]) => void; 
  updateCategoryAnomaly: (category: string, items: string[]) => void; // NEW

  // Notifiche
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'timestamp'>) => void;

  // Data Management
  exportData: () => void;
  importData: (jsonData: string) => boolean;
}

export interface User {
  name: string;
  role: 'admin' | 'tech';
  avatarUrl: string;
}
