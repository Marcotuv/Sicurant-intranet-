
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { CalendarRange, ChevronLeft, ChevronRight, User, Plus, Trash2, Calendar, MapPin, Briefcase, CalendarCheck, Clock, AlertTriangle, Users } from 'lucide-react';
import { Client, WorkSession } from '../types';

const Planning: React.FC = () => {
    const { clients, assets, technicians, sessions, scheduleSession, deleteSession } = useData();
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Modal Form State (Changed to Array for Multi-Select)
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedTechIds, setSelectedTechIds] = useState<string[]>([]);

    // --- LOGIC: BACKLOG (Clients with expiring assets, NOT PLANNED AT ALL) ---
    const backlogClients = useMemo(() => {
        const today = new Date();
        const nextMonth = new Date(today);
        nextMonth.setDate(today.getDate() + 45); // 45 days lookahead
        const nextMonthStr = new Date(nextMonth.getTime() - (nextMonth.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

        // 1. Find assets expiring soon
        const relevantAssets = assets.filter(asset => {
            if (!asset.scadenza) return false;
            return asset.scadenza <= nextMonthStr;
        });

        const clientIds = new Set(relevantAssets.map(a => a.clientId));
        
        // 2. Filter out clients who already have a PLANNED or OPEN session
        return clients.filter(c => {
            if (!clientIds.has(c.id)) return false;
            
            const hasExistingSession = sessions.some(s => 
                s.clientId === c.id && 
                (s.status === 'OPEN' || s.status === 'PLANNED')
            );
            
            // Return true only if NO active/planned session exists
            return !hasExistingSession;
        });
    }, [assets, clients, sessions]);

    // --- LOGIC: PLANNED SESSIONS LIST ---
    const plannedSessions = useMemo(() => {
        // Filter sessions that are PLANNED
        return sessions
            .filter(s => s.status === 'PLANNED' && s.scheduledDate)
            .sort((a, b) => new Date(a.scheduledDate!).getTime() - new Date(b.scheduledDate!).getTime());
    }, [sessions]);


    // --- RIGHT COLUMN: CALENDAR LOGIC ---
    const handlePrevMonth = () => {
        const d = new Date(viewDate);
        d.setMonth(d.getMonth() - 1);
        setViewDate(d);
    };

    const handleNextMonth = () => {
        const d = new Date(viewDate);
        d.setMonth(d.getMonth() + 1);
        setViewDate(d);
    };

    const getCalendarDays = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // Start from Monday
        let startDay = firstDay.getDay() - 1;
        if (startDay === -1) startDay = 6;

        const days = [];
        // Padding prev month
        for (let i = 0; i < startDay; i++) {
             days.push(null);
        }
        // Current month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    const days = getCalendarDays();
    const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

    const getSessionsForDate = (date: Date) => {
        const dateStr = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        return sessions.filter(s => 
            s.status === 'PLANNED' && s.scheduledDate === dateStr
        );
    };

    // --- ACTIONS ---
    const openPlanModal = (client: Client) => {
        setSelectedClient(client);
        setSelectedDate(new Date().toISOString().split('T')[0]);
        // Default to first technician initially
        setSelectedTechIds(technicians.length > 0 ? [technicians[0].id] : []);
        setIsModalOpen(true);
    };

    const toggleTechSelection = (techId: string) => {
        setSelectedTechIds(prev => 
            prev.includes(techId) 
            ? prev.filter(id => id !== techId) 
            : [...prev, techId]
        );
    };

    const handleSavePlan = () => {
        if (selectedClient && selectedDate && selectedTechIds.length > 0) {
            scheduleSession(selectedClient.id, selectedDate, selectedTechIds);
            setIsModalOpen(false);
            setSelectedClient(null);
            setSelectedTechIds([]);
        } else {
            alert("Seleziona almeno un tecnico.");
        }
    };

    // Helper to get technicians for a session
    const getTechsForSession = (session: WorkSession) => {
        // Fallback to single ID if array is empty (legacy compatibility)
        const ids = (session.assignedTechIds && session.assignedTechIds.length > 0) 
            ? session.assignedTechIds 
            : (session.assignedTechId ? [session.assignedTechId] : []);
            
        return technicians.filter(t => ids.includes(t.id));
    };

    return (
        <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
            <div className="border-b border-gray-200 dark:border-slate-700 pb-4 shrink-0">
                <h2 className="text-2xl font-bold text-primary-700 dark:text-blue-400 flex items-center">
                    <CalendarRange className="mr-3" /> Pianificazione Turni
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Gestisci il backlog delle scadenze e assegna gli interventi ai tecnici.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
                
                {/* --- LEFT COLUMN (SPLIT: BACKLOG + PLANNED) --- */}
                <div className="w-full lg:w-1/3 flex flex-col gap-4 h-full overflow-hidden">
                    
                    {/* 1. BACKLOG (Da Pianificare) */}
                    <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-200 dark:border-slate-700 min-h-0">
                        <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-red-50 dark:bg-red-900/10 shrink-0">
                            <h3 className="font-bold text-red-700 dark:text-red-400 flex items-center">
                                <Calendar size={18} className="mr-2"/> Da Pianificare ({backlogClients.length})
                            </h3>
                        </div>
                        <div className="overflow-y-auto p-2 space-y-2 custom-scrollbar flex-1">
                            {backlogClients.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 italic text-sm">
                                    Nessuna scadenza imminente.
                                </div>
                            ) : (
                                backlogClients.map(client => (
                                    <div key={client.id} className="p-3 border border-gray-200 dark:border-slate-600 rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-slate-900 group">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm">{client.nome}</h4>
                                                <p className="text-xs text-gray-500 flex items-center mt-1"><MapPin size={10} className="mr-1"/>{client.indirizzo}</p>
                                                <p className="text-xs text-gray-400 flex items-center mt-0.5"><Briefcase size={10} className="mr-1"/>{client.commessa || 'N/D'}</p>
                                            </div>
                                            <button 
                                                onClick={() => openPlanModal(client)}
                                                className="bg-blue-600 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-700 shadow"
                                                title="Pianifica"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 2. PLANNED LIST (In Programma) */}
                    <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-200 dark:border-slate-700 min-h-0">
                        <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-green-50 dark:bg-green-900/10 shrink-0">
                            <h3 className="font-bold text-green-700 dark:text-green-400 flex items-center">
                                <CalendarCheck size={18} className="mr-2"/> In Programma ({plannedSessions.length})
                            </h3>
                        </div>
                        <div className="overflow-y-auto p-2 space-y-2 custom-scrollbar flex-1">
                            {plannedSessions.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 italic text-sm">
                                    Nessun intervento programmato.
                                </div>
                            ) : (
                                plannedSessions.map(session => {
                                    const client = clients.find(c => c.id === session.clientId);
                                    const assignedTechs = getTechsForSession(session);
                                    const todayStr = new Date().toISOString().split('T')[0];
                                    const isOverdue = session.scheduledDate && session.scheduledDate < todayStr;
                                    
                                    // Use the first tech's color for the border
                                    const borderColor = assignedTechs.length > 0 ? assignedTechs[0].color : '#ccc';

                                    return (
                                        <div key={session.id} className={`p-3 border-l-4 border border-gray-200 dark:border-slate-600 rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-slate-900 relative group`} style={{borderLeftColor: isOverdue ? '#ef4444' : borderColor}}>
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">{client?.nome || 'Cliente rimosso'}</h4>
                                                    <div className="flex items-center mt-1 text-xs text-gray-600 dark:text-gray-400">
                                                        {isOverdue ? <AlertTriangle size={12} className="mr-1 text-red-500"/> : <Clock size={12} className="mr-1"/>}
                                                        <span className={`font-semibold mr-2 ${isOverdue ? 'text-red-500' : ''}`}>
                                                            {new Date(session.scheduledDate!).toLocaleDateString('it-IT')}
                                                            {isOverdue && " (Scaduto)"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center mt-1 text-xs text-gray-500">
                                                        {assignedTechs.length > 1 ? <Users size={12} className="mr-1"/> : <User size={12} className="mr-1"/>}
                                                        {assignedTechs.length > 0 ? assignedTechs.map(t => t.name).join(', ') : 'Nessun Tecnico'}
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => { if(confirm('Rimuovere pianificazione?')) deleteSession(session.id); }}
                                                    className="text-gray-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                </div>

                {/* --- RIGHT COLUMN: CALENDAR --- */}
                <div className="w-full lg:w-2/3 flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-200 dark:border-slate-700 h-full">
                    
                    {/* Calendar Header */}
                    <div className="p-4 flex justify-between items-center border-b border-gray-100 dark:border-slate-700 shrink-0">
                         <div className="flex items-center space-x-4">
                             <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><ChevronLeft/></button>
                             <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 capitalize">
                                 {viewDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
                             </h3>
                             <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><ChevronRight/></button>
                         </div>
                         <div className="flex -space-x-2">
                             {technicians.map(t => (
                                 <div key={t.id} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white dark:border-slate-800 cursor-help" style={{backgroundColor: t.color}} title={t.name}>
                                     {t.name.charAt(0)}
                                 </div>
                             ))}
                         </div>
                    </div>

                    {/* Calendar Grid Header */}
                    <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 shrink-0">
                        {weekDays.map(d => (
                            <div key={d} className="py-2 text-center text-xs font-bold text-gray-500 uppercase">{d}</div>
                        ))}
                    </div>

                    {/* Calendar Grid Body */}
                    <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-y-auto">
                        {days.map((date, idx) => {
                            if (!date) return <div key={idx} className="bg-gray-50/50 dark:bg-slate-900/50 border-b border-r border-gray-100 dark:border-slate-700"></div>;
                            
                            const sessionsOnDay = getSessionsForDate(date);
                            const isToday = new Date().toDateString() === date.toDateString();

                            return (
                                <div key={idx} className={`min-h-[100px] border-b border-r border-gray-100 dark:border-slate-700 p-2 relative transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/30 ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                                    <span className={`text-sm font-medium ${isToday ? 'text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full' : 'text-gray-700 dark:text-gray-300'}`}>
                                        {date.getDate()}
                                    </span>
                                    
                                    <div className="mt-1 space-y-1">
                                        {sessionsOnDay.map(s => {
                                            const assignedTechs = getTechsForSession(s);
                                            const client = clients.find(c => c.id === s.clientId);
                                            
                                            // Primary color from first tech
                                            const bgColor = assignedTechs.length > 0 ? assignedTechs[0].color : '#9ca3af';
                                            
                                            return (
                                                <div key={s.id} className="text-[10px] p-1.5 rounded text-white shadow-sm flex justify-between items-center group relative cursor-pointer hover:shadow-md transition-all" style={{backgroundColor: bgColor}}>
                                                    <div className="flex flex-col truncate pr-1">
                                                        <span className="font-semibold truncate">{client?.nome}</span>
                                                        <span className="text-[9px] opacity-90 truncate">
                                                            {assignedTechs.map(t => t.name.split(' ')[0]).join(', ')}
                                                        </span>
                                                    </div>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); if(confirm('Eliminare pianificazione?')) deleteSession(s.id); }}
                                                        className="hidden group-hover:block hover:text-red-200"
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* --- PLAN MODAL --- */}
            {isModalOpen && selectedClient && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-1 text-gray-800 dark:text-gray-100">Pianifica Intervento</h3>
                        <p className="text-sm text-gray-500 mb-4">{selectedClient.nome}</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Data Prevista</label>
                                <input 
                                    type="date" 
                                    className="w-full p-2 border rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Assegna Tecnici</label>
                                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                    {technicians.map(t => {
                                        const isSelected = selectedTechIds.includes(t.id);
                                        return (
                                            <div 
                                                key={t.id}
                                                onClick={() => toggleTechSelection(t.id)}
                                                className={`flex items-center p-3 border rounded cursor-pointer transition-colors ${
                                                    isSelected
                                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                                    : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                                                }`}
                                            >
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold mr-3" style={{backgroundColor: t.color}}>
                                                    {t.name.charAt(0)}
                                                </div>
                                                <span className="font-medium text-gray-800 dark:text-gray-200 flex-1">{t.name}</span>
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                                                    {isSelected && <Plus size={14} className="text-white"/>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-gray-500 mt-2 text-right">Selezionati: {selectedTechIds.length}</p>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-700">Annulla</button>
                            <button onClick={handleSavePlan} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow">Conferma Pianificazione</button>
                        </div>
                    </div>
                 </div>
            )}
        </div>
    );
};

export default Planning;
