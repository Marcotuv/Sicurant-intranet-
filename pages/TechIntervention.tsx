
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { CheckCircle, AlertTriangle, FileText, Wrench, Save, X, MapPin, Hash, Search, PenTool, ClipboardCheck, Eraser, FileCheck, ArrowLeft, Download, RefreshCw, Play, ChevronDown, User, UploadCloud, Calendar, Printer, Camera } from 'lucide-react';
import { Asset, Intervention, Client } from '../types';
import { CATEGORY_STANDARDS } from '../data';
// @ts-ignore
import { FixedSizeList as List } from 'react-window';

// Debounce Hook (Inline for single file constraint)
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

// Signature Pad (Keep existing logic)
const SignaturePad: React.FC<{
    onEnd: (dataUrl: string) => void;
    onClear: () => void;
    label: string;
}> = ({ onEnd, onClear, label }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(ratio, ratio);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    }, []);

    const getPos = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const start = (e: any) => { if(e.cancelable) e.preventDefault(); setIsDrawing(true); const pos = getPos(e); const ctx = canvasRef.current?.getContext('2d'); ctx?.beginPath(); ctx?.moveTo(pos.x, pos.y); };
    const move = (e: any) => { if(e.cancelable) e.preventDefault(); if (!isDrawing) return; const pos = getPos(e); const ctx = canvasRef.current?.getContext('2d'); ctx?.lineTo(pos.x, pos.y); ctx?.stroke(); };
    const stop = (e: any) => { if(e.cancelable) e.preventDefault(); if (isDrawing) { setIsDrawing(false); onEnd(canvasRef.current?.toDataURL("image/png") || ""); } };

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-2"><span className="text-xs font-semibold text-gray-500 uppercase">{label}</span><button onClick={() => { onClear(); const c = canvasRef.current; const ctx = c?.getContext('2d'); ctx?.clearRect(0,0,c!.width,c!.height); }} className="text-xs text-red-500 flex items-center hover:underline"><Eraser size={12} className="mr-1"/> Cancella</button></div>
            <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded bg-white touch-none overflow-hidden relative h-32 w-full">
                <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop} onTouchStart={start} onTouchMove={move} onTouchEnd={stop} />
            </div>
        </div>
    );
};

const TechIntervention: React.FC = () => {
  const { 
      clients, assets, anomalies: genericAnomalies, checklistTemplates, categoryAnomalies, sessions, createSession, updateSession, saveInterventionToSession, 
      closeSession, reopenSession, interventions, addNotification, syncData, downloadCloudData, remoteUrl, updateAsset, isLoading
  } = useData();
  const navigate = useNavigate();
  
  const [selectedClientId, setSelectedClientId] = useState<number | string>("");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const debouncedClientSearch = useDebounce(clientSearchTerm, 300); // Debounce Client Search

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedAssetSearch = useDebounce(searchTerm, 300); // Debounce Asset Search
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterLocation, setFilterLocation] = useState<string>("All");

  const [generalNotes, setGeneralNotes] = useState("");
  const [technicianSignature, setTechnicianSignature] = useState("");
  const [clientSignature, setClientSignature] = useState("");
  const [techSigImage, setTechSigImage] = useState<string>("");
  const [clientSigImage, setClientSigImage] = useState<string>("");
  const [lastLoadedSessionId, setLastLoadedSessionId] = useState<string>("");

  const [checkedServices, setCheckedServices] = useState<string[]>([]);
  const [checkedAnomalies, setCheckedAnomalies] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [activeChecklist, setActiveChecklist] = useState<string[]>([]);
  const [activeStandard, setActiveStandard] = useState<string>("");
  const [specificAnomalies, setSpecificAnomalies] = useState<string[]>([]);

  // Ref for list height
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(400);

  const currentSession = useMemo(() => {
      if (!selectedClientId) return undefined;
      const clientSessions = sessions.filter(s => s.clientId === Number(selectedClientId));
      const openSession = clientSessions.find(s => s.status === 'OPEN');
      if (openSession) return openSession;
      if (clientSessions.length > 0) return clientSessions[clientSessions.length - 1];
      return undefined;
  }, [sessions, selectedClientId]);

  useEffect(() => {
    if (currentSession && currentSession.id !== lastLoadedSessionId) {
        setGeneralNotes(currentSession.generalNotes || "");
        setTechnicianSignature(currentSession.technicianSignature || "");
        setClientSignature(currentSession.clientSignature || "");
        setTechSigImage(currentSession.technicianSignatureImage || "");
        setClientSigImage(currentSession.clientSignatureImage || "");
        setLastLoadedSessionId(currentSession.id);
        if (currentSession.status === 'CLOSED') setIsSessionComplete(true);
        else setIsSessionComplete(false);
    } else if (!currentSession) {
        setLastLoadedSessionId("");
    }
  }, [currentSession?.id]);

  const handleSelectClient = (client: Client) => {
    setSelectedClientId(client.id);
    setClientSearchTerm(client.nome);
    setIsClientDropdownOpen(false);
    setSelectedAsset(null);
    setIsSessionComplete(false);
    setIsDraftSaved(false);
    setLastLoadedSessionId(""); 
    setSearchTerm("");
    setFilterCategory("All");
    setFilterLocation("All");
    createSession(client.id);
  };

  const openInterventionModal = (asset: Asset) => {
    setSelectedAsset(asset);
    const category = asset.categoria || "Generico";
    
    // Dynamic Checklist from Context
    const checklist = checklistTemplates[category] || checklistTemplates["Generico"] || [];
    setActiveChecklist(checklist);
    setActiveStandard(CATEGORY_STANDARDS[category] || "");

    // Specific Anomalies for this category FROM CONTEXT
    setSpecificAnomalies(categoryAnomalies[category] || []);

    const existing = currentSession?.draftInterventions.find(i => i.assetId === asset.id);
    if (existing) {
        setCheckedServices(existing.services);
        setCheckedAnomalies(existing.anomalies);
        setNotes(existing.notes);
    } else {
        setCheckedServices([]);
        setCheckedAnomalies([]);
        setNotes("");
    }
    setIsModalOpen(true);
  };

  const handleSaveAssetIntervention = () => {
    if (!selectedAsset || !currentSession) return;
    const client = clients.find(c => c.id === Number(selectedClientId));
    const existing = currentSession?.draftInterventions.find(i => i.assetId === selectedAsset.id);
    const id = existing ? existing.id : `INT-${String(Date.now()).slice(-6)}`;

    const newIntervention: Intervention = {
      id: id,
      timestamp: new Date().toISOString(),
      clientId: Number(selectedClientId),
      clientName: client?.nome || 'Unknown',
      assetId: selectedAsset.id,
      assetName: selectedAsset.tipo,
      services: checkedServices,
      anomalies: checkedAnomalies,
      notes: notes,
    };

    const currentSessionMetadata = { generalNotes, technicianSignature, clientSignature, technicianSignatureImage: techSigImage, clientSignatureImage: clientSigImage };
    saveInterventionToSession(currentSession.id, newIntervention, currentSessionMetadata);
    
    // Auto Update Expiry (+6 months)
    const nextExpiry = new Date();
    nextExpiry.setMonth(nextExpiry.getMonth() + 6);
    updateAsset({ ...selectedAsset, dataUltimaRevisione: new Date().toISOString().split('T')[0], scadenza: nextExpiry.toISOString().split('T')[0] });
    
    setIsModalOpen(false);
  };
  
  const handlePartialSave = async () => {
      if (!selectedClientId) return;
      updateSession(Number(selectedClientId), { generalNotes, technicianSignature, clientSignature, technicianSignatureImage: techSigImage, clientSignatureImage: clientSigImage });
      if (remoteUrl) { setIsSyncing(true); await syncData(); setIsSyncing(false); }
      addNotification({ title: "Sessione Salvata", message: "Salvataggio locale effettuato.", type: "success" });
      setIsDraftSaved(true);
  };

  const handleGlobalSave = async () => {
      if (!currentSession) return;
      if (!window.confirm("Confermi chiusura intervento?")) return;
      if (currentSession.draftInterventions.length === 0) { alert("Nessun intervento eseguito."); return; }
      
      setIsSyncing(true);
      closeSession(currentSession.id, { generalNotes, technicianSignature, clientSignature, technicianSignatureImage: techSigImage, clientSignatureImage: clientSigImage });
      if (remoteUrl) await syncData();
      setIsSyncing(false);
      setIsSessionComplete(true);
      window.scrollTo(0, 0);
  };

  const handlePrint = () => { window.print(); };

  // --- FILTERS & VIRTUALIZATION ---
  const allClientAssets = useMemo(() => selectedClientId ? assets.filter(a => a.clientId === Number(selectedClientId)) : [], [assets, selectedClientId]);
  const categories = useMemo(() => Array.from(new Set(allClientAssets.map(a => a.categoria || 'Altro'))).sort(), [allClientAssets]);

  const filteredAssets = useMemo(() => {
      return allClientAssets.filter(asset => {
          const s = debouncedAssetSearch.toLowerCase();
          const matchesSearch = !s || asset.tipo.toLowerCase().includes(s) || asset.matricola?.toLowerCase().includes(s) || asset.id.toLowerCase().includes(s);
          const matchesCategory = filterCategory === "All" || asset.categoria === filterCategory;
          const matchesLocation = filterLocation === "All" || (asset.ubicazione && asset.ubicazione.startsWith(filterLocation));
          return matchesSearch && matchesCategory && matchesLocation;
      });
  }, [allClientAssets, debouncedAssetSearch, filterCategory, filterLocation]);

  // MOVED USE EFFECT HERE (After filteredAssets is defined)
  useEffect(() => {
      const updateHeight = () => {
          if (listContainerRef.current) {
              setListHeight(listContainerRef.current.clientHeight);
          }
      };
      window.addEventListener('resize', updateHeight);
      updateHeight(); // Initial measurement
      // Small timeout to allow layout to settle
      setTimeout(updateHeight, 100);
      return () => window.removeEventListener('resize', updateHeight);
  }, [selectedClientId, filteredAssets]);

  const draftAssetIds = currentSession ? currentSession.draftInterventions.map(i => i.assetId) : [];
  const completedCount = filteredAssets.filter(a => draftAssetIds.includes(a.id)).length;
  const progress = filteredAssets.length > 0 ? Math.round((completedCount / filteredAssets.length) * 100) : 0;

  const filteredClients = useMemo(() => {
      if (!debouncedClientSearch && !isClientDropdownOpen) return [];
      return clients.filter(c => c.nome.toLowerCase().includes(debouncedClientSearch.toLowerCase())).slice(0, 50);
  }, [debouncedClientSearch, clients, isClientDropdownOpen]);

  // Virtualized Row Render
  const Row = ({ index, style }: { index: number, style: any }) => {
      const asset = filteredAssets[index];
      const isDraft = draftAssetIds.includes(asset.id);
      const isExpired = !isDraft && new Date(asset.scadenza) < new Date();

      return (
        <div style={style} className="p-1">
            <div className={`flex justify-between items-center p-3 border rounded-lg shadow-sm ${isDraft ? 'bg-green-50 border-green-500' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700'}`}>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 dark:text-gray-100">{asset.tipo}</span>
                        {isDraft && <span className="text-xs bg-green-100 text-green-700 px-2 rounded font-bold">ESEGUITO</span>}
                        {isExpired && <span className="text-xs bg-red-100 text-red-600 px-2 rounded font-bold animate-pulse">SCADUTO</span>}
                    </div>
                    <div className="text-xs text-gray-500 flex gap-4 mt-1">
                        <span>Matr: {asset.matricola}</span>
                        <span>{asset.ubicazione}</span>
                    </div>
                </div>
                <button onClick={() => openInterventionModal(asset)} className={`px-4 py-2 rounded-md text-sm font-medium ${isDraft ? 'border border-green-500 text-green-700' : 'bg-primary-600 text-white'}`}>
                    <Wrench size={16}/>
                </button>
            </div>
        </div>
      );
  };

  // --- VIEWS ---
  if (isLoading) return <div className="p-10 text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div><p className="mt-4 text-gray-500">Caricamento risorse...</p></div>;

  if (isDraftSaved) return (
      <div className="max-w-4xl mx-auto py-10 space-y-6">
          <div className="bg-orange-50 border-l-4 border-orange-500 p-8 rounded text-center">
              <h2 className="text-2xl font-bold mb-4">Salvataggio Locale Effettuato</h2>
              <div className="flex justify-center gap-4">
                  <button onClick={() => navigate('/')} className="bg-gray-200 px-6 py-3 rounded">Dashboard</button>
                  <button onClick={() => setIsDraftSaved(false)} className="bg-orange-500 text-white px-6 py-3 rounded">Continua</button>
              </div>
          </div>
      </div>
  );

  if (isSessionComplete) {
      return (
          <div className="max-w-4xl mx-auto space-y-6">
              <div className="no-print bg-emerald-50 border-l-4 border-emerald-500 p-6 rounded flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Intervento Concluso</h2>
                    <p className="text-gray-600">Dati salvati correttamente.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center"><Printer size={18} className="mr-2"/> STAMPA REPORT</button>
                    <button onClick={() => navigate('/')} className="bg-gray-200 px-4 py-2 rounded">Esci</button>
                  </div>
              </div>
              
              {/* PRINTABLE REPORT */}
              <div className="bg-white p-8 shadow-lg print-only" id="report">
                  <div className="border-b-2 border-red-600 pb-4 mb-6 flex justify-between">
                      <div><h1 className="text-2xl font-bold">RAPPORTO INTERVENTO</h1><p>Sicur. Ant Antincendio</p></div>
                      <div className="text-right"><p className="font-bold">{clients.find(c => c.id === Number(selectedClientId))?.nome}</p><p>{new Date().toLocaleDateString()}</p></div>
                  </div>
                  <table className="w-full text-sm mb-6">
                      <thead><tr className="bg-gray-100"><th className="p-2 border">Asset</th><th className="p-2 border">Lavorazioni</th><th className="p-2 border">Anomalie</th></tr></thead>
                      <tbody>
                          {currentSession?.draftInterventions.map((int, i) => (
                              <tr key={i}>
                                  <td className="p-2 border font-bold">{int.assetName} <span className="text-gray-500 font-normal">({int.assetId})</span></td>
                                  <td className="p-2 border">{int.services.join(', ')}</td>
                                  <td className="p-2 border text-red-600">{int.anomalies.join(', ')}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  <div className="border p-4 mb-6"><h4 className="font-bold mb-2">Note Generali</h4><p>{generalNotes}</p></div>
                  <div className="grid grid-cols-2 gap-10">
                      <div className="text-center border-t pt-4"><p className="font-bold">Firma Tecnico</p>{techSigImage && <img src={techSigImage} className="h-16 mx-auto"/>}</div>
                      <div className="text-center border-t pt-4"><p className="font-bold">Firma Cliente</p>{clientSigImage && <img src={clientSigImage} className="h-16 mx-auto"/>}</div>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="no-print border-b pb-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-red-600 flex items-center"><Wrench className="mr-3"/> Gestione Intervento</h2>
        {selectedClientId && <button onClick={() => setSelectedClientId("")} className="text-sm text-gray-500">Annulla</button>}
      </div>

      {!selectedClientId ? (
         <div className="max-w-4xl mx-auto w-full">
            <div className="relative">
                <Search className="absolute left-4 top-4 text-gray-400"/>
                <input 
                    type="text" 
                    className="w-full p-4 pl-12 border rounded-lg shadow-sm text-lg outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white bg-white dark:bg-slate-800 dark:border-slate-700" 
                    placeholder="Cerca cliente..." 
                    value={clientSearchTerm} 
                    onChange={(e) => { setClientSearchTerm(e.target.value); setIsClientDropdownOpen(true); }} 
                />
                {isClientDropdownOpen && filteredClients.length > 0 && (
                    <ul className="absolute w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg shadow-xl mt-1 max-h-80 overflow-y-auto z-50">
                        {filteredClients.map(c => (
                            <li key={c.id} onClick={() => handleSelectClient(c)} className="p-4 border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer">
                                <span className="font-bold block text-gray-900 dark:text-gray-100">{c.nome}</span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">{c.indirizzo}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
         </div>
      ) : (
         <div className="flex flex-col h-full gap-4">
             {/* HEADER STATS */}
             <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow flex justify-between items-center">
                 <div>
                     <h3 className="font-bold text-primary-700">{clients.find(c => c.id === Number(selectedClientId))?.nome}</h3>
                     <p className="text-xs text-gray-500">{progress}% Completato</p>
                 </div>
                 <div className="w-1/3 bg-gray-200 h-2 rounded-full overflow-hidden"><div className="bg-primary-600 h-full transition-all" style={{width: `${progress}%`}}></div></div>
             </div>

             {/* FILTERS */}
             <div className="flex gap-2">
                 <input 
                    type="text" 
                    placeholder="Cerca asset..." 
                    className="flex-1 p-2 border rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-slate-700" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                 />
                 <select 
                    className="p-2 border rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-slate-700" 
                    value={filterCategory} 
                    onChange={(e) => setFilterCategory(e.target.value)}
                 >
                    <option value="All">Tutte Categorie</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
             </div>

             {/* VIRTUALIZED LIST */}
             <div ref={listContainerRef} className="flex-1 border rounded-lg bg-gray-50 dark:bg-slate-900 overflow-hidden" style={{ minHeight: '400px' }}>
                <List
                    height={listHeight}
                    itemCount={filteredAssets.length}
                    itemSize={80}
                    width={'100%'}
                >
                    {Row}
                </List>
             </div>
         </div>
      )}

      {/* MODAL ASSET INTERVENTION */}
      {isModalOpen && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-6 border-b border-gray-100 dark:border-slate-700 pb-2">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                            {selectedAsset.tipo}
                            <span className="ml-2 text-sm bg-gray-100 dark:bg-slate-700 text-gray-500 px-2 py-0.5 rounded">{selectedAsset.matricola}</span>
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedAsset.ubicazione}</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={24}/></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* LEFT: CHECKLIST */}
                    <div>
                        <h4 className="font-bold text-primary-700 dark:text-blue-400 mb-3 flex items-center border-b pb-1">
                            <ClipboardCheck size={18} className="mr-2"/> Checklist {selectedAsset.categoria}
                        </h4>
                        <div className="text-xs text-gray-500 mb-3 italic">Rif: {activeStandard}</div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {activeChecklist.length > 0 ? activeChecklist.map((item, idx) => (
                                <label key={idx} className="flex items-start space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded cursor-pointer border border-transparent hover:border-gray-200">
                                    <input 
                                        type="checkbox" 
                                        className="mt-1 w-4 h-4 text-primary-600 rounded focus:ring-primary-500 border-gray-300"
                                        checked={checkedServices.includes(item)}
                                        onChange={(e) => {
                                            if(e.target.checked) setCheckedServices([...checkedServices, item]);
                                            else setCheckedServices(checkedServices.filter(s => s !== item));
                                        }}
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300 leading-tight">{item}</span>
                                </label>
                            )) : <p className="text-gray-400 italic">Nessuna voce checklist disponibile.</p>}
                        </div>
                    </div>

                    {/* RIGHT: ANOMALIES */}
                    <div>
                        <h4 className="font-bold text-red-600 dark:text-red-400 mb-3 flex items-center border-b pb-1">
                            <AlertTriangle size={18} className="mr-2"/> Rilevazione Anomalie
                        </h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                             {/* Specific Anomalies */}
                             {specificAnomalies.length > 0 && (
                                 <div className="mb-2">
                                     <p className="text-xs font-bold text-gray-400 uppercase mb-1">Specifiche</p>
                                     {specificAnomalies.map((item, idx) => (
                                        <label key={`spec-${idx}`} className="flex items-start space-x-3 p-2 hover:bg-red-50 dark:hover:bg-red-900/10 rounded cursor-pointer group">
                                            <input 
                                                type="checkbox" 
                                                className="mt-1 w-4 h-4 text-red-600 rounded focus:ring-red-500 border-gray-300"
                                                checked={checkedAnomalies.includes(item)}
                                                onChange={(e) => {
                                                    if(e.target.checked) setCheckedAnomalies([...checkedAnomalies, item]);
                                                    else setCheckedAnomalies(checkedAnomalies.filter(s => s !== item));
                                                }}
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300 leading-tight group-hover:text-red-700 dark:group-hover:text-red-300">{item}</span>
                                        </label>
                                     ))}
                                 </div>
                             )}

                             {/* Generic Anomalies */}
                             <div>
                                 <p className="text-xs font-bold text-gray-400 uppercase mb-1">Generiche</p>
                                 {genericAnomalies.map((item, idx) => (
                                    <label key={`gen-${idx}`} className="flex items-start space-x-3 p-2 hover:bg-red-50 dark:hover:bg-red-900/10 rounded cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            className="mt-1 w-4 h-4 text-red-600 rounded focus:ring-red-500 border-gray-300"
                                            checked={checkedAnomalies.includes(item)}
                                            onChange={(e) => {
                                                if(e.target.checked) setCheckedAnomalies([...checkedAnomalies, item]);
                                                else setCheckedAnomalies(checkedAnomalies.filter(s => s !== item));
                                            }}
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300 leading-tight group-hover:text-red-700 dark:group-hover:text-red-300">{item}</span>
                                    </label>
                                 ))}
                             </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Note Aggiuntive</label>
                    <textarea 
                        className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                        rows={3}
                        placeholder="Dettagli aggiuntivi sull'intervento..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>

                <div className="mt-8 flex justify-end space-x-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                    <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Annulla</button>
                    <button onClick={handleSaveAssetIntervention} className="px-8 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-md transition-all flex items-center">
                        <Save size={18} className="mr-2"/> Salva Asset
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* SESSION FOOTER (Sticky) */}
      {selectedClientId && (
        <div className="no-print bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-4 shadow-lg sticky bottom-0 z-10">
            <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="w-full md:w-1/2 flex items-center gap-2">
                   <FileText className="text-gray-400" size={20}/>
                   <input 
                      type="text" 
                      placeholder="Note Generali Sessione..." 
                      className="flex-1 p-2 border border-gray-300 dark:border-slate-600 rounded bg-gray-50 dark:bg-slate-900 text-sm"
                      value={generalNotes}
                      onChange={(e) => setGeneralNotes(e.target.value)}
                   />
                </div>

                <div className="flex gap-2">
                    <button onClick={handlePartialSave} disabled={isSyncing} className="bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded flex items-center hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors">
                        {isSyncing ? <RefreshCw className="animate-spin mr-2"/> : <Save size={18} className="mr-2"/>}
                        Salva Bozza
                    </button>
                    
                    <button 
                        onClick={() => {
                           const sigDialog = document.getElementById('signature-dialog') as HTMLDialogElement;
                           if(sigDialog) sigDialog.showModal();
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded font-bold shadow-md flex items-center transition-colors"
                    >
                        <FileCheck size={18} className="mr-2"/> Chiudi Intervento
                    </button>
                </div>
            </div>
            
            {/* SIGNATURE DIALOG */}
            <dialog id="signature-dialog" className="bg-transparent p-0 w-full max-w-2xl backdrop:bg-black/50 rounded-lg shadow-xl">
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-lg space-y-6">
                     <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Firme e Chiusura</h3>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <SignaturePad 
                             label="Firma Tecnico" 
                             onEnd={(data) => setTechSigImage(data)} 
                             onClear={() => setTechSigImage("")} 
                         />
                         <SignaturePad 
                             label="Firma Cliente" 
                             onEnd={(data) => setClientSigImage(data)} 
                             onClear={() => setClientSigImage("")} 
                         />
                     </div>

                     <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
                         <button onClick={() => (document.getElementById('signature-dialog') as HTMLDialogElement).close()} className="px-4 py-2 text-gray-600 dark:text-gray-300">Indietro</button>
                         <button onClick={handleGlobalSave} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-bold shadow">Conferma Chiusura</button>
                     </div>
                 </div>
            </dialog>
        </div>
      )}
    </div>
  );
};

export default TechIntervention;
