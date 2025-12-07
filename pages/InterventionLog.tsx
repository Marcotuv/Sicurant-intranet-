
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { ClipboardList, Eye, Search, X, Calendar, User, Box, FileText, Printer, Camera } from 'lucide-react';
import { Intervention } from '../types';

const InterventionLog: React.FC = () => {
  const { interventions } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);

  const filtered = interventions
    .filter(i => i.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || i.assetName.toLowerCase().includes(searchTerm.toLowerCase()) || i.id.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // NATIVE PRINT
  const handlePrint = () => {
      window.print();
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col md:flex-row justify-between md:items-center border-b pb-4 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-primary-700 dark:text-blue-400 flex items-center"><ClipboardList className="mr-3" /> Registro Interventi</h2>
        </div>
        <div className="relative">
            <input type="text" placeholder="Cerca..." className="pl-10 pr-4 py-2 border rounded-lg w-full md:w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        </div>
      </div>

      <div className="no-print bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="bg-primary-700 text-white text-sm uppercase"><th className="p-4">Data</th><th className="p-4">Cliente</th><th className="p-4">Asset</th><th className="p-4">Stato</th><th className="p-4">Azioni</th></tr>
                </thead>
                <tbody className="divide-y">
                    {filtered.map(int => (
                        <tr key={int.id} className="hover:bg-gray-50">
                            <td className="p-4">{new Date(int.timestamp).toLocaleDateString()}</td>
                            <td className="p-4 font-medium">{int.clientName}</td>
                            <td className="p-4">{int.assetName}</td>
                            <td className="p-4">{int.anomalies.length > 0 ? <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">Anomalia</span> : <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Ok</span>}</td>
                            <td className="p-4"><button onClick={() => setSelectedIntervention(int)} className="p-2 bg-emerald-500 text-white rounded"><Eye size={16} /></button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </div>
      </div>

      {/* DETAIL VIEW (PRINTABLE) */}
      {selectedIntervention && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:static print:bg-white print:p-0">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto text-gray-900 print:shadow-none print:max-w-none print:max-h-none print:overflow-visible">
                <div className="no-print flex justify-between items-center p-5 border-b bg-gray-50">
                    <h3 className="text-lg font-bold">Dettagli {selectedIntervention.id}</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="text-blue-600 hover:bg-blue-50 p-2 rounded flex items-center"><Printer size={20} className="mr-1"/> Stampa</button>
                        <button onClick={() => setSelectedIntervention(null)} className="text-gray-400 hover:text-red-500 p-2"><X size={24} /></button>
                    </div>
                </div>
                
                <div className="p-6 space-y-4 print-only">
                    <h1 className="text-2xl font-bold mb-4 border-b pb-2">Rapporto Intervento Singolo</h1>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                        <div><strong>Cliente:</strong> {selectedIntervention.clientName}</div>
                        <div><strong>Data:</strong> {new Date(selectedIntervention.timestamp).toLocaleString()}</div>
                        <div><strong>Asset:</strong> {selectedIntervention.assetName} ({selectedIntervention.assetId})</div>
                        <div><strong>ID:</strong> {selectedIntervention.id}</div>
                    </div>

                    <div className="mb-4">
                        <h4 className="font-bold border-b mb-2">Lavorazioni</h4>
                        <p>{selectedIntervention.services.join(', ') || "Nessuna"}</p>
                    </div>

                    <div className="mb-4">
                        <h4 className="font-bold border-b mb-2 text-red-600">Anomalie</h4>
                        <p>{selectedIntervention.anomalies.join(', ') || "Nessuna"}</p>
                    </div>

                    <div className="mb-4">
                        <h4 className="font-bold border-b mb-2">Note</h4>
                        <p className="bg-gray-50 p-2 border">{selectedIntervention.notes || "-"}</p>
                    </div>

                    {/* FIRME SECTION (Solo se presenti nel record sessione associato, qui mostriamo placeholder se salvate nel contesto globale) */}
                    <div className="mt-8 grid grid-cols-2 gap-8 border-t pt-4">
                         <div className="text-center">
                             <p className="font-bold text-xs uppercase mb-4">Firma Tecnico</p>
                             {selectedIntervention.technicianSignatureImage ? <img src={selectedIntervention.technicianSignatureImage} className="h-16 mx-auto"/> : <div className="h-16 border-b"></div>}
                         </div>
                         <div className="text-center">
                             <p className="font-bold text-xs uppercase mb-4">Firma Cliente</p>
                             {selectedIntervention.clientSignatureImage ? <img src={selectedIntervention.clientSignatureImage} className="h-16 mx-auto"/> : <div className="h-16 border-b"></div>}
                         </div>
                    </div>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default InterventionLog;
