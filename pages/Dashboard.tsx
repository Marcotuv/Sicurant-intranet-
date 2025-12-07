
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plane, Receipt, Book, Clock, MessageCircle, ArrowRight,
  Activity, AlertCircle, CalendarDays, CheckCircle, Briefcase, 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { Client, Asset } from '../types';

const Dashboard: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { interventions, assets, clients, sessions } = useData();

  // --- CALENDAR STATE ---
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month');
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- LOGICA RAGGRUPPATA PER CLIENTE/COMMESSA (SCADENZE) ---
  const groupedExpiries = useMemo(() => {
      const today = new Date();
      // FIX: Use consistent Local Date String for comparisons
      const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      
      const nextMonth = new Date(today);
      nextMonth.setDate(today.getDate() + 30);
      const nextMonthStr = new Date(nextMonth.getTime() - (nextMonth.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

      // 1. Filtra asset rilevanti (Scaduti O in scadenza a breve)
      const relevantAssets = assets.filter(asset => {
          if (!asset.scadenza) return false;
          return asset.scadenza <= nextMonthStr;
      });

      // 2. Raggruppa per Cliente
      const groups: Record<number, { 
          client: Client | undefined, 
          expiredCount: number,
          expiringCount: number,
          minDate: string // Solo per ordinamento
      }> = {};

      relevantAssets.forEach(asset => {
          const cid = asset.clientId;
          const expDateStr = asset.scadenza;
          
          if (!groups[cid]) {
              groups[cid] = {
                  client: clients.find(c => c.id === cid),
                  expiredCount: 0,
                  expiringCount: 0,
                  minDate: asset.scadenza
              };
          }

          if (expDateStr < todayStr) {
              groups[cid].expiredCount++;
          } else {
              groups[cid].expiringCount++;
          }
          
          // Mantieni la data più vecchia per ordinare i blocchi per urgenza
          if (expDateStr < groups[cid].minDate) {
              groups[cid].minDate = asset.scadenza;
          }
      });

      // 3. Converte in array e ordina per urgenza
      return Object.values(groups)
        .sort((a, b) => a.minDate.localeCompare(b.minDate))
        .slice(0, 6); 

  }, [assets, clients]);

  // --- CALENDAR LOGIC ---
  const handlePrev = () => {
      const newDate = new Date(viewDate);
      if (calendarView === 'month') {
          newDate.setMonth(newDate.getMonth() - 1);
      } else {
          newDate.setDate(newDate.getDate() - 7);
      }
      setViewDate(newDate);
  };

  const handleNext = () => {
      const newDate = new Date(viewDate);
      if (calendarView === 'month') {
          newDate.setMonth(newDate.getMonth() + 1);
      } else {
          newDate.setDate(newDate.getDate() + 7);
      }
      setViewDate(newDate);
  };

  const getCalendarDays = () => {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      
      const firstDayOfMonth = new Date(year, month, 1);
      const startingDayOfWeek = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1; // 0 = Lunedì

      const days = [];
      
      // Giorni mese precedente
      const prevMonthLastDate = new Date(year, month, 0).getDate();
      for (let i = startingDayOfWeek; i > 0; i--) {
          days.push({ day: prevMonthLastDate - i + 1, type: 'prev', date: new Date(year, month - 1, prevMonthLastDate - i + 1) });
      }

      // Giorni mese corrente
      const lastDate = new Date(year, month + 1, 0).getDate();
      for (let i = 1; i <= lastDate; i++) {
          days.push({ day: i, type: 'current', date: new Date(year, month, i) });
      }

      // Giorni mese successivo (fino a riempire 35 o 42 celle)
      const remaining = (calendarView === 'month' ? 42 : 7) - days.length; // Se month view usiamo griglia 7x6, se week view filtriamo dopo
      for (let i = 1; i <= remaining; i++) {
          days.push({ day: i, type: 'next', date: new Date(year, month + 1, i) });
      }

      if (calendarView === 'week') {
          // Filtra solo la settimana corrente basata su viewDate
          const currentDay = viewDate.getDay() === 0 ? 6 : viewDate.getDay() - 1;
          // Troviamo l'inizio della settimana del viewDate
          const diff = viewDate.getDate() - currentDay + (currentDay === 0 ? -6 : 1); 
          // Logica semplificata: se viewMode è week, ricalcoliamo i 7 giorni specifici
          const startOfWeek = new Date(viewDate);
          const day = startOfWeek.getDay() || 7; 
          if(day !== 1) startOfWeek.setHours(-24 * (day - 1));
          
          const weekDays = [];
          for(let i=0; i<7; i++) {
              const d = new Date(startOfWeek);
              d.setDate(startOfWeek.getDate() + i);
              weekDays.push({ day: d.getDate(), type: d.getMonth() === month ? 'current' : 'other', date: d });
          }
          return weekDays;
      }

      return days.slice(0, 35); // Limitiamo a 5 righe per compattezza nella dashboard
  };

  const calendarGrid = getCalendarDays();
  const weekDaysName = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  // Helper per trovare eventi in una data
  const getEventsForDate = (date: Date) => {
      // FIX: Local Date comparison
      const dateStr = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      
      // Sessioni: sia schedulate per questa data, sia aperte/chiuse iniziate in questa data
      const plannedCount = sessions.filter(s => s.status === 'PLANNED' && s.scheduledDate === dateStr).length;
      const activeCount = sessions.filter(s => s.status !== 'PLANNED' && s.startTimestamp.startsWith(dateStr)).length;
      
      const interventionCount = interventions.filter(i => i.timestamp.startsWith(dateStr)).length;
      
      return { plannedCount, activeCount, interventionCount };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-slate-700 pb-4">
        <div>
           <h2 className="text-2xl font-bold text-primary-700 dark:text-blue-400">Panoramica Aziendale</h2>
           <p className="text-gray-500 dark:text-gray-400">Bentornato sulla tua dashboard operativa.</p>
        </div>
        <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {currentTime.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-xl font-bold text-primary-700 dark:text-blue-400">
                {currentTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* WIDGET SCADENZE RAGGRUPPATE (Priorità Commesse) */}
        <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border-l-4 border-red-500 p-5 col-span-1 lg:col-span-2 transition-transform hover:-translate-y-1 duration-300">
          <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-slate-700 pb-2">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center">
              <AlertCircle className="mr-2" size={20} /> Priorità Commesse
            </h3>
            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-bold">
                {groupedExpiries.length} Clienti
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
             {groupedExpiries.length > 0 ? (
                 groupedExpiries.map((group, idx) => {
                     const hasExpired = group.expiredCount > 0;
                     return (
                        <div key={idx} className={`flex flex-col p-3 rounded-lg border shadow-sm transition-all bg-white dark:bg-slate-900 ${hasExpired ? 'border-l-4 border-l-red-500 border-gray-200 dark:border-slate-700' : 'border-l-4 border-l-orange-400 border-gray-200 dark:border-slate-700'}`}>
                            <div className="mb-3">
                                <h4 className="font-bold text-gray-800 dark:text-gray-100 truncate text-sm" title={group.client?.nome}>
                                    {group.client?.nome || 'Cliente Sconosciuto'}
                                </h4>
                                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    <Briefcase size={10} className="mr-1"/> 
                                    {group.client?.commessa || 'Nessuna commessa'}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-auto">
                                <div className={`flex flex-col items-center justify-center p-2 rounded ${group.expiredCount > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200' : 'bg-gray-50 text-gray-400 dark:bg-slate-800'}`}>
                                    <span className="text-xl font-bold leading-none">{group.expiredCount}</span>
                                    <span className="text-[9px] uppercase font-bold mt-1">Scaduti</span>
                                </div>
                                <div className={`flex flex-col items-center justify-center p-2 rounded ${group.expiringCount > 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200' : 'bg-gray-50 text-gray-400 dark:bg-slate-800'}`}>
                                    <span className="text-xl font-bold leading-none">{group.expiringCount}</span>
                                    <span className="text-[9px] uppercase font-bold mt-1">In Scadenza</span>
                                </div>
                            </div>
                        </div>
                     );
                 })
             ) : (
                 <div className="text-center py-8 text-gray-400 col-span-3">
                     <CheckCircle size={32} className="mx-auto mb-2 text-green-400"/>
                     <p>Tutte le commesse sono in regola.</p>
                 </div>
             )}
          </div>
          {groupedExpiries.length > 0 && (
              <div className="mt-4 text-right">
                  {/* MODIFICATO LINK: Ora punta alla Pianificazione */}
                  <Link to="/planning" className="text-xs font-bold uppercase text-primary-600 hover:text-primary-800 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center tracking-wider">
                      Pianifica Turni <ArrowRight size={14} className="ml-1"/>
                  </Link>
              </div>
          )}
        </section>

        {/* CALENDAR WIDGET */}
         <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border-l-4 border-indigo-500 p-5 col-span-1 lg:col-span-1 min-h-[350px] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-slate-700 pb-2">
                <h3 className="text-lg font-bold text-primary-700 dark:text-blue-400 flex items-center">
                   <CalendarIcon className="mr-2" size={20} /> Pianificazione
                </h3>
                <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
                    <button 
                        onClick={() => setCalendarView('month')}
                        className={`px-2 py-0.5 text-xs rounded-md transition-colors ${calendarView === 'month' ? 'bg-white dark:bg-slate-600 shadow text-primary-600' : 'text-gray-500'}`}
                    >
                        Mese
                    </button>
                    <button 
                         onClick={() => setCalendarView('week')}
                         className={`px-2 py-0.5 text-xs rounded-md transition-colors ${calendarView === 'week' ? 'bg-white dark:bg-slate-600 shadow text-primary-600' : 'text-gray-500'}`}
                    >
                        Sett
                    </button>
                </div>
            </div>

            {/* Calendar Controls */}
            <div className="flex justify-between items-center mb-4 px-2">
                <button onClick={handlePrev} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><ChevronLeft size={16}/></button>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200 capitalize">
                    {viewDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={handleNext} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><ChevronRight size={16}/></button>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 flex flex-col">
                <div className="grid grid-cols-7 mb-2">
                    {weekDaysName.map(day => (
                        <div key={day} className="text-center text-[10px] uppercase font-bold text-gray-400">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1 flex-1">
                    {calendarGrid.map((cell, idx) => {
                        const isToday = cell.date.toDateString() === new Date().toDateString();
                        const { plannedCount, activeCount, interventionCount } = getEventsForDate(cell.date);
                        
                        return (
                            <div 
                                key={idx} 
                                className={`
                                    relative p-1 rounded-lg flex flex-col items-center justify-start min-h-[40px] border border-transparent
                                    ${cell.type !== 'current' ? 'opacity-30' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer'}
                                    ${isToday ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}
                                `}
                            >
                                <span className={`text-xs ${isToday ? 'font-bold text-blue-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {cell.day}
                                </span>
                                
                                {/* Event Dots */}
                                <div className="flex gap-0.5 mt-1">
                                    {plannedCount > 0 && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" title={`${plannedCount} Pianificati`}></div>}
                                    {activeCount > 0 && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title={`${activeCount} Attivi`}></div>}
                                    {interventionCount > 0 && <div className="w-1.5 h-1.5 rounded-full bg-green-500" title={`${interventionCount} Chiusi`}></div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-4 flex gap-4 justify-center text-[10px] text-gray-500">
                    <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-yellow-400 mr-1"></span> Piano</div>
                    <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-blue-500 mr-1"></span> Attivi</div>
                    <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span> Fatti</div>
                </div>
            </div>
        </section>

        {/* Quick Actions */}
        <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border-l-4 border-blue-500 p-5">
          <h3 className="text-lg font-bold text-primary-700 dark:text-blue-400 mb-4 pb-2 border-b border-gray-100 dark:border-slate-700 flex items-center">
             <Activity className="mr-2" size={20} /> Azioni Rapide
          </h3>
          <ul className="space-y-2">
            <li>
                <button className="w-full flex items-center p-3 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left text-gray-700 dark:text-gray-300">
                    <Plane className="mr-3 text-blue-500" size={18} /> Richiedi Ferie
                </button>
            </li>
            <li>
                <button className="w-full flex items-center p-3 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left text-gray-700 dark:text-gray-300">
                    <Receipt className="mr-3 text-blue-500" size={18} /> Report Spese
                </button>
            </li>
            <li>
                <button className="w-full flex items-center p-3 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left text-gray-700 dark:text-gray-300">
                    <Book className="mr-3 text-blue-500" size={18} /> Manuale HR
                </button>
            </li>
          </ul>
        </section>

        {/* Events */}
        <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border-l-4 border-yellow-500 p-5">
          <h3 className="text-lg font-bold text-primary-700 dark:text-blue-400 mb-4 pb-2 border-b border-gray-100 dark:border-slate-700 flex items-center">
             <Clock className="mr-2" size={20} /> Prossimi Eventi
          </h3>
          <div className="space-y-4">
             <div className="flex items-start space-x-3">
                <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-500 font-bold p-2 rounded text-center min-w-[3.5rem]">
                    <span className="block text-xs uppercase">Nov</span>
                    <span className="block text-xl">22</span>
                </div>
                <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Riunione Tecnica</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Ore 14:00 - Sala Meeting A</p>
                </div>
             </div>
          </div>
        </section>

        {/* Chat Teaser */}
        <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border-l-4 border-green-500 p-5 col-span-1 md:col-span-2 lg:col-span-1">
          <h3 className="text-lg font-bold text-primary-700 dark:text-blue-400 mb-4 pb-2 border-b border-gray-100 dark:border-slate-700 flex items-center">
             <MessageCircle className="mr-2" size={20} /> Chat Colleghi
          </h3>
          <div className="text-center py-6">
             <p className="text-gray-500 dark:text-gray-400 mb-6 italic">Hai 3 messaggi non letti.</p>
             <Link to="/messages" className="inline-flex items-center justify-center w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md font-semibold transition-colors">
                Apri Chat Completa <ArrowRight className="ml-2" size={18} />
             </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
