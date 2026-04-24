import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { Clock, User, Calendar, Check, X, ChevronUp, ChevronDown, Download, Shield, Trash2, Edit2, Save, FilterX, Hash, History, Undo2 } from 'lucide-react';

// --- DESIGN SYSTEM ---
const Button = ({ children, onClick, type = "button", variant = "primary", className = "", title="" }) => {
  const base = "flex items-center justify-center gap-2 py-3 px-6 font-bold tracking-widest uppercase text-xs transition-all duration-200 active:scale-95 ";
  const variants = {
    primary: "bg-white hover:bg-zinc-200 text-black shadow-[0_0_15px_rgba(255,255,255,0.1)]",
    outline: "bg-transparent border border-zinc-500 hover:border-white text-zinc-300 hover:text-white",
    danger: "bg-transparent border border-zinc-700 hover:border-zinc-300 text-zinc-400 hover:text-white",
    action: "p-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-500 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
  };
  return <button type={type} onClick={onClick} className={`${base} ${variants[variant]} ${className}`} title={title}>{children}</button>;
};

const Input = ({ type, value, onChange, placeholder, className = "", required = false, onFocus }) => (
  <input type={type} required={required} value={value} onChange={onChange} onFocus={onFocus} placeholder={placeholder} className={`w-full bg-black border border-zinc-800 p-4 text-white focus:outline-none focus:border-white transition-all placeholder:text-zinc-700 ${className}`} />
);

const Label = ({ children, className="" }) => <label className={`block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3 ${className}`}>{children}</label>;
const Card = ({ children, className = "" }) => <div className={`bg-[#050505] border border-zinc-800 p-6 md:p-8 ${className}`}>{children}</div>;

// --- UX PATCH: SMART TIME STEPPER ---
const TimeStepper = ({ label, value, onChange }) => {
  const [hour, min] = value.split(':').map(Number);
  
  const adjustTime = (type, amount) => {
    let newHour = hour; let newMin = min;
    if (type === 'min') { newMin += amount; if (newMin >= 60) { newMin = 0; newHour = (newHour + 1) % 24; } if (newMin < 0) { newMin = 45; newHour = (newHour - 1 + 24) % 24; } }
    if (type === 'hour') { newHour = (newHour + amount + 24) % 24; }
    onChange(`${String(newHour).padStart(2, '0')}:${String(newMin).padStart(2, '0')}`);
  };

  const handleTyping = (type, e) => {
    let val = e.target.value;
    if (val === '') { // Tillad tomt felt mens der skrives
      onChange(`${String(type === 'hour' ? 0 : hour).padStart(2, '0')}:${String(type === 'min' ? 0 : min).padStart(2, '0')}`);
      return;
    }
    val = val.replace(/\D/g, ''); 
    let parsed = parseInt(val, 10);
    if (isNaN(parsed)) parsed = 0;
    if (type === 'hour' && parsed > 23) parsed = 23; 
    if (type === 'min' && parsed > 59) parsed = 59;
    onChange(`${String(type === 'hour' ? parsed : hour).padStart(2, '0')}:${String(type === 'min' ? parsed : min).padStart(2, '0')}`);
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center justify-between p-4 bg-black border border-zinc-800 focus-within:border-white transition-colors">
        <div className="flex flex-col items-center">
          <button type="button" onClick={() => adjustTime('hour', 1)} className="p-2 text-zinc-600 hover:text-white active:scale-90"><ChevronUp size={24}/></button>
          <input 
            type="text" value={String(hour).padStart(2, '0')} 
            onChange={(e) => handleTyping('hour', e)} 
            onFocus={(e) => e.target.select()} // PATCH: Auto-select tekst ved klik
            className="text-4xl font-black text-white tracking-tighter w-16 text-center bg-transparent focus:outline-none focus:bg-zinc-900 rounded tabular-nums" 
          />
          <button type="button" onClick={() => adjustTime('hour', -1)} className="p-2 text-zinc-600 hover:text-white active:scale-90"><ChevronDown size={24}/></button>
        </div>
        <span className="text-2xl font-black text-zinc-700">:</span>
        <div className="flex flex-col items-center">
          <button type="button" onClick={() => adjustTime('min', 15)} className="p-2 text-zinc-600 hover:text-white active:scale-90"><ChevronUp size={24}/></button>
          <input 
            type="text" value={String(min).padStart(2, '0')} 
            onChange={(e) => handleTyping('min', e)} 
            onFocus={(e) => e.target.select()} // PATCH: Auto-select tekst ved klik
            className="text-4xl font-black text-white tracking-tighter w-16 text-center bg-transparent focus:outline-none focus:bg-zinc-900 rounded tabular-nums" 
          />
          <button type="button" onClick={() => adjustTime('min', -15)} className="p-2 text-zinc-600 hover:text-white active:scale-90"><ChevronDown size={24}/></button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APPLICATION ---
export default function App() {
  const [view, setView] = useState('KIOSK'); 
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]); 
  const [tags, setTags] = useState([]); 
  const today = new Date().toISOString().split('T')[0];
  const API_URL = "https://logbog.fekdesign.dk/api.php";
  
  const [activeUser, setActiveUser] = useState(null);
  const [formData, setFormData] = useState({ date: today, start: '09:00', end: '15:00', task: '' });
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [showCustomTask, setShowCustomTask] = useState(false); 

  // --- UX PATCH: UNDO STATE ---
  const [showToast, setShowToast] = useState(false);
  const [lastLogId, setLastLogId] = useState(null);
  const [lastLogHours, setLastLogHours] = useState(0);

  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [chartFilter, setChartFilter] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ date: '', start: '', end: '', task: '' });
  const [newNodeName, setNewNodeName] = useState('');
  const [newTagName, setNewTagName] = useState('');

  // INITIALIZATION
  useEffect(() => {
    fetch(API_URL).then(res => res.json()).then(data => {
      const formattedData = data.map(log => ({
        id: log.id, user: log.user || log.USER || "UNKNOWN", 
        date: log.work_date || log.date, start: log.start_time ? log.start_time.substring(0, 5) : log.start,
        end: log.end_time ? log.end_time.substring(0, 5) : log.end, hours: parseFloat(log.hours), task: log.task
      }));
      setLogs(formattedData);
    }).catch(err => console.error("API Error:", err));

    fetch(`${API_URL}?action=nodes`).then(res => res.json()).then(data => setEmployees(data.map(n => ({id: n.id, name: n.USER || n.user || n.name}))));
    fetch(`${API_URL}?action=tags`).then(res => res.json()).then(data => setTags(data));
  }, []);

  // TOAST AUTO-HIDE LOGIC
  useEffect(() => {
    let t;
    if (showToast) {
      t = setTimeout(() => setShowToast(false), 6000); // Luk toast efter 6 sekunder
    }
    return () => clearTimeout(t);
  }, [showToast]);

  const calculateHours = (start, end) => {
    const startObj = new Date(`1970-01-01T${start}:00`); const endObj = new Date(`1970-01-01T${end}:00`);
    let diff = (endObj - startObj) / (1000 * 60 * 60); return diff < 0 ? diff + 24 : diff;
  };

  // --- UX PATCH: PERSISTENT USER & TOAST ---
  const saveLog = () => {
    if (isSubmitting || !formData.task) return; 
    setIsSubmitting(true);

    const diffHours = parseFloat(calculateHours(formData.start, formData.end).toFixed(2));
    const newLog = { ...formData, user: activeUser, hours: diffHours };
  
    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newLog) })
    .then(res => res.json())
    .then(data => {
      setLogs([{ ...newLog, id: data.id }, ...logs]); 
      
      // Sæt Toast Data
      setLastLogId(data.id);
      setLastLogHours(diffHours);
      setShowToast(true);
      
      // Ryd KUN formular, ikke Active User
      setFormData({ date: today, start: '09:00', end: '15:00', task: '' });
      setShowCustomTask(false);
    })
    .finally(() => setIsSubmitting(false));
  };

  // --- UX PATCH: Lydløs Undo Funktion ---
  const handleUndo = () => {
    if (!lastLogId) return;
    setIsSubmitting(true);
    fetch(API_URL, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lastLogId }) })
    .then(() => {
      setLogs(logs.filter(l => l.id !== lastLogId)); // Fjern fra UI
      setShowToast(false); // Gem toast
      setLastLogId(null);
    })
    .finally(() => setIsSubmitting(false));
  };

  const handleTagClick = (tagName) => {
    if (tagName === 'ANDET') {
      setShowCustomTask(true);
      setFormData({...formData, task: ''});
    } else {
      setShowCustomTask(false);
      setFormData({...formData, task: tagName});
    }
  };

  // --- CRUD FUNKTIONER ---
  const deleteLog = (id) => { if(window.confirm("Bekræft sletning.")) fetch(API_URL, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id }) }).then(() => setLogs(logs.filter(l => l.id !== id))); };
  const saveEdit = () => {
    const updatedHours = parseFloat(calculateHours(editForm.start, editForm.end).toFixed(2));
    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editForm, id: editingId, hours: updatedHours, action: 'edit_log' }) })
    .then(() => { setLogs(logs.map(l => l.id === editingId ? { ...l, ...editForm, hours: updatedHours } : l)); setEditingId(null); });
  };
  const startEdit = (log) => { setEditingId(log.id); setEditForm({ date: log.date, start: log.start, end: log.end, task: log.task }); };
  const addNode = (e) => { e.preventDefault(); if(!newNodeName.trim()) return; fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_node', name: newNodeName.trim() }) }).then(res => res.json()).then(data => { setEmployees([...employees, { id: data.id, name: data.name }]); setNewNodeName(''); }); };
  const deleteNode = (id) => { if(window.confirm("Slet operatør?")) fetch(API_URL, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_node', id: id }) }).then(() => setEmployees(employees.filter(emp => emp.id !== id))); };
  
  const addTag = (e) => { e.preventDefault(); if(!newTagName.trim()) return; fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_tag', name: newTagName.trim() }) }).then(res => res.json()).then(data => { setTags([...tags, { id: data.id, name: data.name }]); setNewTagName(''); }); };
  const deleteTag = (id) => { if(window.confirm("Slet tag?")) fetch(API_URL, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_tag', id: id }) }).then(() => setTags(tags.filter(t => t.id !== id))); };

  const handleAdminLogin = async (e) => {
    e.preventDefault(); setAuthError('VERIFICERER...'); 
    try {
      const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'authenticate', password: password }) });
      if (response.ok) { setView('DASHBOARD'); setPassword(''); setAuthError(''); } else { setAuthError('AFVIST'); }
    } catch (err) { setAuthError('NETVÆRKSFEJL'); }
  };

  const filteredLogs = logs.filter(log => {
    if (chartFilter && log.user !== chartFilter) return false;
    if (!dateFilter.start && !dateFilter.end) return true;
    const logDate = new Date(log.date); const start = dateFilter.start ? new Date(dateFilter.start) : new Date('1970-01-01'); const end = dateFilter.end ? new Date(dateFilter.end) : new Date('2099-12-31'); return logDate >= start && logDate <= end;
  });

  const exportExcel = () => { const ws = XLSX.utils.json_to_sheet(filteredLogs); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Ledger"); XLSX.writeFile(wb, `Eksport_${today}.xlsx`); };
  const totalHours = filteredLogs.reduce((acc, log) => acc + log.hours, 0);
  const chartData = employees.map(emp => ({ name: emp.name, timer: logs.filter(log => { if (!dateFilter.start && !dateFilter.end) return true; const logDate = new Date(log.date); const start = dateFilter.start ? new Date(dateFilter.start) : new Date('1970-01-01'); const end = dateFilter.end ? new Date(dateFilter.end) : new Date('2099-12-31'); return logDate >= start && logDate <= end; }).filter(l => l.user === emp.name).reduce((acc, l) => acc + l.hours, 0) }));

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-black font-sans text-zinc-100 p-4 md:p-8 selection:bg-white selection:text-black">
      
      {/* NY UX: KOMPAKT UNDO TOAST */}
      {showToast && (
        <div className="fixed bottom-8 right-8 z-50 bg-[#0a2010] border border-green-900 p-5 flex items-center gap-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-green-500/20 rounded-full"><Check size={20} className="text-green-500" /></div>
            <div>
              <h3 className="text-green-400 font-black uppercase tracking-widest text-[10px]">Log Gemt</h3>
              <p className="text-green-700 font-mono text-xs mt-1">{lastLogHours} Timer registreret</p>
            </div>
          </div>
          <div className="h-8 w-px bg-green-900/50"></div>
          <button onClick={handleUndo} className="flex items-center gap-2 text-green-500 hover:text-green-300 text-[10px] font-bold uppercase tracking-widest transition-colors p-2 hover:bg-green-900/30 rounded">
            <Undo2 size={14}/> Fortryd
          </button>
        </div>
      )}

      <header className="max-w-6xl mx-auto flex justify-between items-end mb-16 pb-8 border-b border-zinc-800 pt-4">
        <div><h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">Terminal</h1><p className="text-xs font-bold text-zinc-500 mt-2 uppercase tracking-[0.3em]">Medarbejder Logbog</p></div>
        <button onClick={() => { setView(view === 'KIOSK' ? 'AUTH' : 'KIOSK'); setChartFilter(null); setActiveUser(null); }} className="w-14 h-14 bg-[#050505] border border-zinc-800 flex items-center justify-center hover:border-white transition-all text-zinc-400 hover:text-white">{view === 'KIOSK' ? <Shield size={24} /> : <Clock size={24} />}</button>
      </header>

      <main className="max-w-6xl mx-auto">
        {view === 'KIOSK' && (
          <div className="animate-in fade-in duration-700">
            {!activeUser ? (
              <Card className="max-w-4xl mx-auto text-center">
                <Label>Operatør Valg</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">
                  {employees.map(emp => <button key={emp.id} onClick={() => setActiveUser(emp.name)} className="py-8 px-4 bg-black border border-zinc-800 text-lg font-bold text-zinc-400 hover:border-white hover:text-white hover:bg-zinc-900 transition-all uppercase tracking-wider">{emp.name}</button>)}
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Højre Panel: Context / Hukommelse */}
                <div className="lg:col-span-4 order-2 lg:order-1">
                  <div className="sticky top-8">
                    <div className="flex items-center gap-3 mb-6"><History className="text-zinc-500" size={18}/><Label className="!mb-0">Seneste Historik</Label></div>
                    <div className="space-y-4">
                      {logs.filter(l => l.user === activeUser).slice(0, 4).map((log, i) => (
                        <div key={i} className="p-4 bg-[#050505] border border-zinc-800/50 flex flex-col gap-2">
                          <div className="flex justify-between items-center text-xs font-mono text-zinc-500">
                            <span>{log.date}</span><span>{log.hours}t</span>
                          </div>
                          <span className="text-sm font-bold uppercase tracking-wider text-zinc-300 truncate">{log.task}</span>
                        </div>
                      ))}
                      {logs.filter(l => l.user === activeUser).length === 0 && <p className="text-xs text-zinc-600 font-mono">Ingen tidligere historik fundet for {activeUser}.</p>}
                    </div>
                  </div>
                </div>

                {/* Venstre Panel: Formular */}
                <Card className="lg:col-span-8 order-1 lg:order-2 shadow-[0_0_50px_rgba(255,255,255,0.02)]">
                  <div className="flex justify-between items-center mb-12 border-b border-zinc-800 pb-8">
                    <div><Label>Aktiv Session</Label><h2 className="text-3xl font-black uppercase tracking-widest flex items-center gap-4"><User className="text-zinc-600" size={32} /> {activeUser}</h2></div>
                    <button onClick={() => setActiveUser(null)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors border-b border-transparent hover:border-white pb-1"><X size={14}/> Skift Bruger</button>
                  </div>

                  <form className="space-y-12" onSubmit={(e) => { e.preventDefault(); saveLog(); }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <TimeStepper label="Start Tidspunkt" value={formData.start} onChange={(val) => setFormData({...formData, start: val})} />
                      <TimeStepper label="Slut Tidspunkt" value={formData.end} onChange={(val) => setFormData({...formData, end: val})} />
                    </div>
                    
                    <div><Label>Dato</Label><div className="relative"><Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} /><Input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="pl-12 font-mono w-full md:w-1/2" /></div></div>
                    
                    <div>
                      <Label>Opgavekategori *</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                        {tags.map(tag => (
                          <button 
                            key={tag.id} type="button" onClick={() => handleTagClick(tag.name)}
                            className={`p-4 text-xs font-bold uppercase tracking-widest transition-all ${formData.task === tag.name && !showCustomTask ? 'bg-white text-black' : 'bg-black border border-zinc-800 text-zinc-400 hover:border-zinc-500'}`}
                          >
                            {tag.name}
                          </button>
                        ))}
                        <button 
                          type="button" onClick={() => handleTagClick('ANDET')}
                          className={`p-4 text-xs font-bold uppercase tracking-widest transition-all ${showCustomTask ? 'bg-white text-black' : 'bg-black border border-zinc-800 text-zinc-400 hover:border-zinc-500'}`}
                        >
                          Andet...
                        </button>
                      </div>

                      {showCustomTask && (
                        <textarea required autoFocus rows="2" value={formData.task} onChange={e => setFormData({...formData, task: e.target.value})} placeholder="Beskriv handlinger manuelt..." className="w-full mt-4 bg-black border border-zinc-800 p-4 text-white focus:outline-none focus:border-white transition-all placeholder:text-zinc-700 resize-none font-mono animate-in fade-in slide-in-from-top-2"></textarea>
                      )}
                    </div>

                    <Button type="submit" className={`w-full py-6 text-lg ${isSubmitting || !formData.task ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {isSubmitting ? 'GEMMER...' : 'INDSEND LOG'}
                    </Button>
                  </form>
                </Card>

              </div>
            )}
          </div>
        )}

        {view === 'AUTH' && (
          <div className="max-w-md mx-auto animate-in fade-in"><Card className="text-center"><Shield className="mx-auto text-white mb-8" size={48} strokeWidth={1} /><h2 className="text-2xl font-black mb-10 uppercase tracking-widest">Admin Adgang</h2><form onSubmit={handleAdminLogin}><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mb-6 text-center tracking-[1em] font-mono text-xl" />{authError && <p className="text-white bg-zinc-900 border border-zinc-700 py-3 text-xs font-bold uppercase tracking-widest mb-6">{authError}</p>}<Button type="submit" className="w-full py-4">Dekrypter</Button></form></Card></div>
        )}

        {view === 'DASHBOARD' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <Card className="flex flex-wrap items-end gap-6 border-zinc-800 relative"><div><Label>Fra Dato</Label><Input type="date" value={dateFilter.start} onChange={e => setDateFilter({...dateFilter, start: e.target.value})} className="py-3 px-4 font-mono text-sm"/></div><div><Label>Til Dato</Label><Input type="date" value={dateFilter.end} onChange={e => setDateFilter({...dateFilter, end: e.target.value})} className="py-3 px-4 font-mono text-sm"/></div><Button variant="outline" onClick={() => {setDateFilter({start: '', end: ''}); setChartFilter(null);}} className="h-[50px] px-8">Nulstil Alt</Button><div className="flex-1"></div><Button onClick={exportExcel} className="h-[50px]"><Download size={18}/> Eksporter CSV</Button></Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{[{ label: 'Totale Timer (Filtreret)', value: totalHours.toFixed(2) }, { label: 'Registreringer', value: filteredLogs.length }, { label: 'Aktive Noder', value: new Set(filteredLogs.map(l => l.user)).size }].map((kpi, i) => (<Card key={i}><Label>{kpi.label}</Label><p className="text-5xl font-black tracking-tighter text-white mt-4">{kpi.value}</p></Card>))}</div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card><div className="flex justify-between items-start mb-8"><Label>Ressourcefordeling (Klik for at filtrere)</Label>{chartFilter && <button onClick={() => setChartFilter(null)} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white bg-zinc-900 px-3 py-1 border border-zinc-700 rounded-full transition-colors"><FilterX size={12}/> Ryd {chartFilter}</button>}</div><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:0, right:0, left:-20, bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1a1a1c"/><XAxis dataKey="name" tick={{fontSize: 10, fill: '#71717a', textTransform: 'uppercase', fontWeight: 'bold'}} axisLine={false} tickLine={false} dy={10}/><YAxis tick={{fontSize: 12, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false}/><Tooltip cursor={{fill: '#111'}} contentStyle={{backgroundColor: '#000', border: '1px solid #333', borderRadius: '0', color: '#fff', fontFamily: 'monospace'}}/><Bar dataKey="timer" onClick={(d) => { if(chartFilter === d.name) setChartFilter(null); else setChartFilter(d.name); }} cursor="pointer">{chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={!chartFilter || chartFilter === entry.name ? '#ffffff' : '#333333'} className="transition-all duration-300"/>)}</Bar></BarChart></ResponsiveContainer></div></Card>
              <div className="bg-[#050505] border border-zinc-800 flex flex-col overflow-hidden relative"><div className="p-6 border-b border-zinc-800 flex justify-between items-center"><Label className="mb-0">Rådata Ledger</Label>{chartFilter && <span className="text-xs font-bold uppercase tracking-widest text-white border-b border-white">Låst til: {chartFilter}</span>}</div><div className="overflow-auto flex-1 h-80 p-2"><table className="w-full text-left border-collapse text-sm"><thead className="sticky top-0 bg-[#050505] z-10 shadow-[0_10px_10px_-10px_rgba(0,0,0,1)]"><tr><th className="p-4 text-zinc-600 font-bold uppercase text-[10px] tracking-widest">Dato</th><th className="p-4 text-zinc-600 font-bold uppercase text-[10px] tracking-widest">Node</th><th className="p-4 text-zinc-600 font-bold uppercase text-[10px] tracking-widest">Tid</th><th className="p-4 text-zinc-600 font-bold uppercase text-[10px] tracking-widest">Opgave</th><th className="p-4"></th></tr></thead><tbody className="divide-y divide-zinc-900 font-mono">{filteredLogs.map(log => (<tr key={log.id} className="hover:bg-[#111] group transition-colors">{editingId === log.id ? (<><td className="p-2"><input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="bg-black border border-zinc-700 p-2 w-full text-xs text-white"/></td><td className="p-2 font-sans font-bold uppercase text-white tracking-wider">{log.user}</td><td className="p-2 flex gap-1"><input type="time" value={editForm.start} onChange={e => setEditForm({...editForm, start: e.target.value})} className="bg-black border border-zinc-700 p-2 w-full text-xs text-white"/><input type="time" value={editForm.end} onChange={e => setEditForm({...editForm, end: e.target.value})} className="bg-black border border-zinc-700 p-2 w-full text-xs text-white"/></td><td className="p-2"><input type="text" value={editForm.task} onChange={e => setEditForm({...editForm, task: e.target.value})} className="bg-black border border-zinc-700 p-2 w-full text-xs text-white"/></td><td className="p-2 flex justify-end gap-2"><Button variant="action" onClick={saveEdit} title="Gem"><Save size={16}/></Button><Button variant="action" onClick={() => setEditingId(null)} title="Annuller"><X size={16}/></Button></td></>) : (<><td className="p-4 text-zinc-500 whitespace-nowrap text-xs">{log.date}</td><td className="p-4 font-sans font-bold uppercase tracking-widest text-white">{log.user}</td><td className="p-4 text-zinc-300">{log.hours}t</td><td className="p-4 text-zinc-500 truncate max-w-[150px] font-sans" title={log.task}>{log.task}</td><td className="p-4 text-right"><div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="action" onClick={() => startEdit(log)} title="Rediger"><Edit2 size={14}/></Button><Button variant="action" onClick={() => deleteLog(log.id)} title="Slet"><Trash2 size={14}/></Button></div></td></>)}</tr>))}{filteredLogs.length === 0 && <tr><td colSpan="5" className="p-10 text-center text-zinc-700 font-bold uppercase tracking-widest text-xs">Ingen data for valgt parameter</td></tr>}</tbody></table></div></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
              <Card><Label>Node Registry (Operatører)</Label><div className="flex flex-col md:flex-row gap-4 mb-8 mt-4"><Input value={newNodeName} onChange={e => setNewNodeName(e.target.value)} placeholder="Nyt operatørnavn..." className="flex-1 py-4 text-sm font-mono uppercase tracking-widest" /><Button onClick={addNode} className="h-[56px] px-8">Tilføj</Button></div><div className="flex flex-wrap gap-4">{employees.map(emp => <div key={emp.id} className="flex items-center gap-3 bg-[#050505] border border-zinc-700 py-2 pl-4 pr-2 text-sm font-bold uppercase tracking-wider text-zinc-300 group hover:border-zinc-500 transition-colors">{emp.name} <button onClick={() => deleteNode(emp.id)} className="text-zinc-700 hover:text-red-500 transition-colors p-1 bg-black rounded"><X size={14}/></button></div>)}</div></Card>
              <Card><Label>Tag Registry (Kategorier)</Label><div className="flex flex-col md:flex-row gap-4 mb-8 mt-4"><Input value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Ny opgavekategori..." className="flex-1 py-4 text-sm font-mono uppercase tracking-widest" /><Button onClick={addTag} className="h-[56px] px-8">Tilføj</Button></div><div className="flex flex-wrap gap-4">{tags.map(tag => <div key={tag.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-700 py-2 pl-4 pr-2 text-sm font-bold uppercase tracking-wider text-white group hover:border-zinc-500 transition-colors"><Hash size={12} className="text-zinc-500"/> {tag.name} <button onClick={() => deleteTag(tag.id)} className="text-zinc-700 hover:text-red-500 transition-colors p-1 bg-black rounded"><X size={14}/></button></div>)}</div></Card>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}