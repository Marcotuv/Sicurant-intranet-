
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { 
  Client, Asset, Article, Intervention, Notification, DataContextType, WorkSession, SupabaseConfig, Technician 
} from '../types';
import { 
  INITIAL_CLIENTS, INITIAL_ASSETS, INITIAL_ARTICLES, INITIAL_INTERVENTIONS, INITIAL_NOTIFICATIONS, SERVICES_LIST, ANOMALIES_LIST, MOCK_TECHNICIANS, CHECKLIST_TEMPLATES, CATEGORY_ANOMALIES
} from '../data';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import { get, set } from 'idb-keyval';

const DataContext = createContext<DataContextType | undefined>(undefined);

const getLocalISODate = () => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

const getTimestamp = () => new Date().toISOString();

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  
  // --- STATE ---
  const [clients, setClients] = useState<Client[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [anomalies, setAnomalies] = useState<string[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<Record<string, string[]>>(CHECKLIST_TEMPLATES);
  const [categoryAnomalies, setCategoryAnomalies] = useState<Record<string, string[]>>(CATEGORY_ANOMALIES);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>(MOCK_TECHNICIANS);
  const [isLoading, setIsLoading] = useState(true); // IndexedDB Loading state
  
  const [remoteUrl, setRemoteUrlState] = useState<string>('');
  const [supabaseConfig, setSupabaseConfigState] = useState<SupabaseConfig>({ url: '', key: '' });
  const [isInitialized, setIsInitialized] = useState(false);

  // --- REFS (Stale Closures Prevention for Sync) ---
  const interventionsRef = useRef(interventions);
  const clientsRef = useRef(clients);
  const assetsRef = useRef(assets);
  const sessionsRef = useRef(sessions);

  useEffect(() => { interventionsRef.current = interventions; }, [interventions]);
  useEffect(() => { clientsRef.current = clients; }, [clients]);
  useEffect(() => { assetsRef.current = assets; }, [assets]);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

  // --- INDEXED DB LOADING ---
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [
          storedSessions, storedInterventions, storedClients, storedAssets, storedArticles, 
          storedServices, storedAnomalies, storedChecklists, storedCategoryAnomalies, storedSbConfig, storedRemoteUrl
        ] = await Promise.all([
          get('work_sessions'), get('interventions'), get('clients'), get('assets'), get('articles'),
          get('services'), get('anomalies'), get('checklist_templates'), get('category_anomalies'), get('supabase_config'), get('remote_url')
        ]);

        setSessions(storedSessions || []);
        setInterventions(storedInterventions || INITIAL_INTERVENTIONS);
        setClients(storedClients || INITIAL_CLIENTS);
        setAssets(storedAssets || INITIAL_ASSETS);
        setArticles(storedArticles || INITIAL_ARTICLES);
        setServices(storedServices || SERVICES_LIST);
        setAnomalies(storedAnomalies || ANOMALIES_LIST);
        setChecklistTemplates(storedChecklists || CHECKLIST_TEMPLATES);
        setCategoryAnomalies(storedCategoryAnomalies || CATEGORY_ANOMALIES);
        
        if (storedSbConfig) setSupabaseConfigState(storedSbConfig);
        if (storedRemoteUrl) setRemoteUrlState(storedRemoteUrl);

      } catch (err) {
        console.error("IndexedDB Load Error:", err);
        // Fallback to initial data if IDB fails
        setClients(INITIAL_CLIENTS);
        setAssets(INITIAL_ASSETS);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };
    loadData();
  }, []);

  // --- PERSISTENCE (IndexedDB) ---
  useEffect(() => { if(isInitialized) set('work_sessions', sessions); }, [sessions, isInitialized]);
  useEffect(() => { if(isInitialized) set('interventions', interventions); }, [interventions, isInitialized]);
  useEffect(() => { if(isInitialized) set('clients', clients); }, [clients, isInitialized]);
  useEffect(() => { if(isInitialized) set('assets', assets); }, [assets, isInitialized]);
  useEffect(() => { if(isInitialized) set('articles', articles); }, [articles, isInitialized]);
  useEffect(() => { if(isInitialized) set('services', services); }, [services, isInitialized]);
  useEffect(() => { if(isInitialized) set('anomalies', anomalies); }, [anomalies, isInitialized]);
  useEffect(() => { if(isInitialized) set('checklist_templates', checklistTemplates); }, [checklistTemplates, isInitialized]);
  useEffect(() => { if(isInitialized) set('category_anomalies', categoryAnomalies); }, [categoryAnomalies, isInitialized]);

  const setRemoteUrl = (url: string) => {
      setRemoteUrlState(url);
      set('remote_url', url);
  };

  const setSupabaseConfig = (config: SupabaseConfig) => {
      setSupabaseConfigState(config);
      set('supabase_config', config);
  }

  // --- HELPER SUPABASE ---
  const getSupabaseClient = (url: string, key: string) => {
    if (!url || !key) return null;
    try { return createClient(url, key); } catch (e) { return null; }
  };

  // --- DOWNLOAD CLOUD DATA ---
  const downloadCloudData = useCallback(async (): Promise<{ success: boolean, message?: string }> => {
      if (!supabaseConfig.url || !supabaseConfig.key) return { success: false, message: "Configurazione Cloud mancante." };
      
      const supabase = createClient(supabaseConfig.url, supabaseConfig.key);
      if (!supabase) return { success: false, message: "Client non inizializzato." };

      try {
          // Generic Fetcher
          const fetchTable = async (table: string, currentData: any[], setter: Function) => {
              const { data, error } = await supabase.from(table).select('json_content');
              if (error) throw error;
              if (data) {
                  const remoteItems = data.map((r: any) => r.json_content);
                  setter((prev: any[]) => {
                      const merged = [...prev];
                      remoteItems.forEach((remote: any) => {
                          const idx = merged.findIndex(l => String(l.id) === String(remote.id));
                          if (idx >= 0) {
                              // Conflict Resolution: Last Updated Wins
                              const local = merged[idx];
                              const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
                              const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
                              if (remoteTime > localTime) merged[idx] = remote;
                          } else {
                              merged.push(remote);
                          }
                      });
                      return merged;
                  });
              }
          };

          await Promise.all([
            fetchTable('interventions', interventions, setInterventions),
            fetchTable('clients', clients, setClients),
            fetchTable('assets', assets, setAssets),
            fetchTable('work_sessions', sessions, setSessions)
          ]);
          
          return { success: true, message: "Dati scaricati correttamente." };

      } catch (error: any) {
          console.error("Download Error:", error);
          return { success: false, message: error.message };
      }
  }, [supabaseConfig]);

  // --- AUTO-SYNC ---
  useEffect(() => {
      if (isInitialized && supabaseConfig.url && supabaseConfig.key) {
          downloadCloudData();
      }
  }, [isInitialized, supabaseConfig.url, supabaseConfig.key, downloadCloudData]);

  // --- SYNC (PUSH & PULL) ---
  const syncData = async (): Promise<{ success: boolean; message: string }> => {
      if (supabaseConfig.url && supabaseConfig.key) {
          const supabase = getSupabaseClient(supabaseConfig.url, supabaseConfig.key);
          if (!supabase) return { success: false, message: "Client non valido." };

          try {
              const tables = [
                { name: 'interventions', data: interventionsRef.current },
                { name: 'clients', data: clientsRef.current },
                { name: 'assets', data: assetsRef.current },
                { name: 'work_sessions', data: sessionsRef.current }
              ];

              for (const t of tables) {
                 if (t.data.length > 0) {
                     const { error } = await supabase.from(t.name)
                        .upsert(t.data.map(i => ({ id: i.id, json_content: i })), { onConflict: 'id' });
                     if (error) throw error;
                 }
              }

              await downloadCloudData();
              addNotification({ title: 'Sync Completato', message: 'Dati sincronizzati.', type: 'success' });
              return { success: true, message: "Sincronizzazione Riuscita." };

          } catch (error: any) {
              return { success: false, message: `Errore DB: ${error.message}` };
          }
      } 
      return { success: false, message: "Nessun endpoint configurato." };
  };

  // --- SESSION ACTIONS (Optimized) ---
  const createSession = useCallback((clientId: number) => {
      const existing = sessions.find(s => s.clientId === clientId && s.status === 'OPEN');
      if (existing) return existing;

      const today = getLocalISODate();
      const planned = sessions.find(s => 
        s.clientId === clientId && s.status === 'PLANNED' && s.scheduledDate && s.scheduledDate <= today
      );
      
      const timestamp = getTimestamp();

      if (planned) {
          const updated: WorkSession = { ...planned, status: 'OPEN', startTimestamp: timestamp, updatedAt: timestamp };
          setSessions(prev => prev.map(s => s.id === planned.id ? updated : s));
          return updated;
      }

      const newSession: WorkSession = {
          id: `SESS-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          clientId,
          startTimestamp: timestamp,
          status: 'OPEN',
          generalNotes: '',
          technicianSignature: '',
          technicianSignatureImage: '',
          clientSignature: '',
          clientSignatureImage: '',
          draftInterventions: [],
          interventionIds: [],
          updatedAt: timestamp
      };
      setSessions(prev => [...prev, newSession]);
      return newSession;
  }, [sessions]);

  const scheduleSession = useCallback((clientId: number, date: string, techIds: string[]) => {
      const techNames = technicians.filter(t => techIds.includes(t.id)).map(t => t.name).join(', ');
      const newSession: WorkSession = {
          id: `PLAN-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          clientId,
          startTimestamp: '',
          status: 'PLANNED',
          scheduledDate: date,
          assignedTechId: techIds[0], 
          assignedTechIds: techIds,
          assignedTechName: techNames,
          generalNotes: '',
          technicianSignature: '',
          technicianSignatureImage: '',
          clientSignature: '',
          clientSignatureImage: '',
          draftInterventions: [],
          interventionIds: [],
          updatedAt: getTimestamp()
      };
      setSessions(prev => [...prev, newSession]);
      addNotification({ title: "Pianificato", message: `Intervento per ${techNames}`, type: "success" });
  }, [technicians]);

  const updateSession = useCallback((clientId: number, data: Partial<WorkSession>) => {
      setSessions(prev => prev.map(s => 
          s.clientId === clientId && s.status === 'OPEN' 
          ? { ...s, ...data, updatedAt: getTimestamp() } 
          : s
      ));
  }, []);

  const saveInterventionToSession = useCallback((sessionId: string, intervention: Intervention, metadata?: Partial<WorkSession>) => {
      setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
              const existingIndex = s.draftInterventions.findIndex(i => i.assetId === intervention.assetId);
              let newDrafts = [...s.draftInterventions];
              const interventionWithTime = { ...intervention, updatedAt: getTimestamp() };

              if (existingIndex >= 0) newDrafts[existingIndex] = interventionWithTime;
              else newDrafts.push(interventionWithTime);
              
              return {
                  ...s, ...metadata, 
                  draftInterventions: newDrafts,
                  interventionIds: newDrafts.map(i => i.id),
                  updatedAt: getTimestamp()
              };
          }
          return s;
      }));
  }, []);

  const closeSession = useCallback((sessionId: string, finalMetadata?: Partial<WorkSession>) => {
      setSessions(prev => {
          const session = prev.find(s => s.id === sessionId);
          if (!session) return prev;
          
          const timestamp = getTimestamp();
          const sessionWithMeta = { ...session, ...finalMetadata, status: 'CLOSED' as const, updatedAt: timestamp };

          const finalInterventions = session.draftInterventions.map(i => ({
              ...i,
              generalNotes: sessionWithMeta.generalNotes,
              technicianSignature: sessionWithMeta.technicianSignature,
              technicianSignatureImage: sessionWithMeta.technicianSignatureImage,
              clientSignature: sessionWithMeta.clientSignature,
              clientSignatureImage: sessionWithMeta.clientSignatureImage,
              updatedAt: timestamp
          }));

          setInterventions(oldInt => [...finalInterventions, ...oldInt]); 

          return prev.map(s => s.id === sessionId ? sessionWithMeta : s);
      });
      addNotification({ title: 'Intervento Concluso', message: `Dati salvati.`, type: 'success' });
  }, []);

  const reopenSession = useCallback((clientId: number) => {
      setSessions(prev => {
          const clientSessions = prev.filter(s => s.clientId === clientId && s.status === 'CLOSED');
          const target = clientSessions[clientSessions.length - 1];
          if (!target) return prev;
          return prev.map(s => s.id === target.id ? { ...s, status: 'OPEN', updatedAt: getTimestamp() } : s);
      });
  }, []);

  const deleteSession = (sessionId: string) => setSessions(prev => prev.filter(s => s.id !== sessionId));
  const getOpenSession = (clientId: number) => sessions.find(s => s.clientId === clientId && s.status === 'OPEN');

  // --- CRUD HELPERS ---
  const addClient = (c: Client) => { setClients(p => [...p, { ...c, updatedAt: getTimestamp() }]); addNotification({ title: 'Cliente Aggiunto', message: c.nome, type: 'info' }); };
  const updateClient = (c: Client) => { setClients(p => p.map(o => o.id === c.id ? { ...c, updatedAt: getTimestamp() } : o)); };
  const deleteClient = (id: number) => setClients(p => p.filter(c => c.id !== id));
  const addClientsBulk = (list: Omit<Client, 'id'>[]) => {
      const maxId = clients.reduce((max, c) => Math.max(c.id, max), 0);
      const newItems = list.map((c, i) => ({ ...c, id: maxId + 1 + i, updatedAt: getTimestamp() }));
      setClients(p => [...p, ...newItems]);
  };

  const addAsset = (a: Asset) => setAssets(p => [...p, { ...a, updatedAt: getTimestamp() }]);
  const updateAsset = (a: Asset) => setAssets(p => p.map(o => o.id === a.id ? { ...a, updatedAt: getTimestamp() } : o));
  const deleteAsset = (id: string) => setAssets(p => p.filter(a => a.id !== id));
  const addAssetsBulk = (list: Asset[]) => setAssets(p => [...p, ...list.map(i => ({...i, updatedAt: getTimestamp()}))]);

  const addArticle = (a: Article) => setArticles(p => [...p, { ...a, updatedAt: getTimestamp() }]);
  const deleteArticle = (id: string) => setArticles(p => p.filter(a => a.id !== id));
  const addArticlesBulk = (list: Article[]) => setArticles(p => [...p, ...list.map(i => ({...i, updatedAt: getTimestamp()}))]);

  const addIntervention = (i: Intervention) => setInterventions(p => [ { ...i, updatedAt: getTimestamp() }, ...p]);
  const addInterventionsBulk = (list: Intervention[]) => setInterventions(p => [...list.map(i => ({...i, updatedAt: getTimestamp()})), ...p]);

  const addService = (s: string) => setServices(p => [...p, s]);
  const addAnomaly = (a: string) => setAnomalies(p => [...p, a]);
  const deleteService = (s: string) => setServices(p => p.filter(i => i !== s));
  const deleteAnomaly = (a: string) => setAnomalies(p => p.filter(i => i !== a));

  const updateChecklistTemplate = (category: string, items: string[]) => {
    setChecklistTemplates(prev => ({...prev, [category]: items}));
  };
  
  const updateCategoryAnomaly = (category: string, items: string[]) => {
    setCategoryAnomalies(prev => ({...prev, [category]: items}));
  };

  const addNotification = (n: Omit<Notification, 'id' | 'read' | 'timestamp'>) => {
    setNotifications(prev => [{ id: `NOT-${Date.now()}`, timestamp: new Date().toISOString(), read: false, ...n }, ...prev]);
  };
  const markNotificationAsRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const clearAllNotifications = () => setNotifications([]);

  // Legacy Export/Import
  const exportData = () => {
      const backup = { timestamp: new Date().toISOString(), clients, articles, assets, services, anomalies, checklistTemplates, categoryAnomalies, interventions, sessions };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = `sicurant_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
  };
  const importData = (json: string) => {
      try {
          const d = JSON.parse(json);
          if(d.clients) setClients(d.clients);
          if(d.assets) setAssets(d.assets);
          if(d.interventions) setInterventions(d.interventions);
          if(d.sessions) setSessions(d.sessions);
          if(d.checklistTemplates) setChecklistTemplates(d.checklistTemplates);
          if(d.categoryAnomalies) setCategoryAnomalies(d.categoryAnomalies);
          return true;
      } catch(e) { return false; }
  };

  // MEMOIZED VALUE
  const value = useMemo(() => ({
      clients, articles, assets, services, anomalies, checklistTemplates, categoryAnomalies, interventions, notifications, sessions, technicians, isLoading,
      remoteUrl, setRemoteUrl, supabaseConfig, setSupabaseConfig, syncData, downloadCloudData,
      getOpenSession, createSession, scheduleSession, updateSession, saveInterventionToSession, closeSession, reopenSession, deleteSession,
      addIntervention, addInterventionsBulk, addClient, updateClient, addClientsBulk, deleteClient,
      addArticle, addArticlesBulk, deleteArticle, addAsset, updateAsset, addAssetsBulk, deleteAsset,
      addService, addAnomaly, deleteService, deleteAnomaly, updateChecklistTemplate, updateCategoryAnomaly,
      addNotification, markNotificationAsRead, clearAllNotifications, exportData, importData
  }), [clients, articles, assets, services, anomalies, checklistTemplates, categoryAnomalies, interventions, notifications, sessions, technicians, isLoading, remoteUrl, supabaseConfig]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};
