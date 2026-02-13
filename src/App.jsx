import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, Users, Calendar, Settings, Play, Activity, 
  ChevronRight, Plus, Trash2, Save, ArrowLeft, Menu, 
  X, Award, Clock, CheckCircle2, Lock, LogIn, MonitorPlay,
  TrendingUp, Hash
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, updateDoc, 
  doc, onSnapshot, query, orderBy, deleteDoc, setDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, 
  signInWithCustomToken 
} from 'firebase/auth';

/**
 * VOLLEYBALL TOURNAMENT MANAGER (Pro Edition)
 * -------------------------------------------
 * Features:
 * - Broadcast-style UI (Glassmorphism, Vibrant Gradients)
 * - Advanced Standings Logic (Points > Set Ratio > Point Ratio)
 * - Complete Admin Settings
 */

// --- Configuration ---
const ADMIN_PASSWORD = "RPL@vb"; 

// --- Firebase Init ---
const firebaseConfig = {
  apiKey: "AIzaSyBsMd5nMt6vHhSqWd06j0vrXOlTy8FgVDs",
  authDomain: "volleyball-manager-14e26.firebaseapp.com",
  projectId: "volleyball-manager-14e26",
  storageBucket: "volleyball-manager-14e26.firebasestorage.app",
  messagingSenderId: "216415058710",
  appId: "1:216415058710:web:dca500703c7c1c2bd76e37",
  measurementId: "G-76Z59K7S1L";
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Default Rules Config ---
const DEFAULT_CONFIG = {
  pointsPerSet: 25,
  setsPerMatch: 3, 
  tieBreakerPoints: 15,
  tournamentName: 'PRO VOLLEY LEAGUE 2024'
};

// --- Helpers ---
const getTeam = (teams, id) => teams.find(t => t.id === id) || { name: '...', color: 'bg-slate-700' };

// --- Components ---

// Standard Admin Card
const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
    {children}
  </div>
);

// Broadcast Style Glass Card
const GlassCard = ({ children, className = '' }) => (
  <div className={`relative overflow-hidden bg-slate-900/40 backdrop-blur-md border border-white/10 shadow-xl rounded-xl ${className}`}>
    {children}
  </div>
);

const Badge = ({ status }) => {
  const styles = {
    live: 'bg-red-500 text-white animate-pulse border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]',
    finished: 'bg-slate-700/50 text-slate-300 border-slate-600',
    scheduled: 'bg-blue-500/20 text-blue-200 border-blue-500/30',
  };
  return (
    <span className={`px-3 py-1 text-[10px] font-black tracking-wider uppercase rounded border ${styles[status] || styles.scheduled}`}>
      {status === 'live' ? 'LIVE' : status === 'finished' ? 'FT' : 'UPCOMING'}
    </span>
  );
};

// --- Navigation ---
const Navigation = ({ config, view, setView, isAdmin }) => (
  <nav className={`sticky top-0 z-50 transition-all duration-300 ${view === 'public' ? 'bg-slate-950/80 backdrop-blur-lg border-b border-white/5' : 'bg-slate-900 shadow-md'}`}>
    <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
      <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('public')}>
        <div className={`p-2 rounded-lg transform transition-transform group-hover:scale-110 ${view === 'public' ? 'bg-gradient-to-br from-pink-500 to-orange-500 shadow-lg' : 'bg-orange-500'}`}>
          <Trophy size={24} className="text-white" />
        </div>
        <div className="flex flex-col">
          <span className={`font-black text-xl tracking-tighter uppercase leading-none ${view === 'public' ? 'text-white' : 'text-slate-100'}`}>
            {config.tournamentName}
          </span>
          <span className={`text-[10px] font-bold tracking-[0.2em] uppercase ${view === 'public' ? 'text-blue-400' : 'text-slate-400'}`}>
            Official Hub
          </span>
        </div>
      </div>
      
      <div className="flex gap-2">
        <button 
          onClick={() => setView('public')}
          className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
            view === 'public' 
              ? 'bg-white text-slate-900 shadow-[0_0_20px_rgba(255,255,255,0.3)]' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Public Hub
        </button>
        <button 
          onClick={() => isAdmin ? setView('admin-dashboard') : setView('login')}
          className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
            view.startsWith('admin') || view === 'login' 
              ? 'bg-blue-600 text-white shadow-lg' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Admin
        </button>
      </div>
    </div>
  </nav>
);

// --- Login View ---
const LoginView = ({ loginInput, setLoginInput, handleAdminLogin, setView }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950"></div>
    <GlassCard className="w-full max-w-sm p-8 z-10 border-white/10">
      <div className="flex justify-center mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-2xl shadow-2xl">
          <Lock className="text-white" size={32} />
        </div>
      </div>
      <h2 className="text-3xl font-black text-center text-white mb-2 uppercase tracking-tight">Admin Access</h2>
      <p className="text-slate-400 text-center text-sm mb-8">Authorized Personnel Only</p>
      
      <form onSubmit={handleAdminLogin} className="space-y-4">
        <div>
          <input
            type="password"
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl p-4 text-center tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none transition-all placeholder:text-slate-600 placeholder:tracking-normal"
            placeholder="ENTER PASSWORD"
            autoFocus
          />
        </div>
        <button 
          type="submit"
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all transform active:scale-95 shadow-lg flex items-center justify-center gap-2 uppercase tracking-wider text-sm"
        >
          <LogIn size={18} /> Authenticate
        </button>
        <button 
          type="button"
          onClick={() => setView('public')}
          className="w-full text-slate-500 text-xs font-bold uppercase tracking-widest py-4 hover:text-white transition-colors"
        >
          Return to Public Hub
        </button>
      </form>
    </GlassCard>
  </div>
);

// --- Match Card Public ---
const MatchCardPublic = ({ match, teams, config }) => {
  const teamA = getTeam(teams, match.teamA);
  const teamB = getTeam(teams, match.teamB);
  const date = new Date(match.startTime);

  return (
    <GlassCard className="group hover:bg-slate-800/50 transition-colors">
      {/* Header */}
      <div className="bg-white/5 px-4 py-2 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{config.tournamentName}</span>
        </div>
        <Badge status={match.status} />
      </div>

      {/* Content */}
      <div className="p-6 relative">
        <div className="flex justify-between items-center relative z-10">
          {/* Team A */}
          <div className="flex flex-col items-center gap-3 w-1/3">
            <div className={`w-16 h-16 rounded-2xl ${teamA.color} shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center justify-center text-white font-black text-3xl transform group-hover:scale-105 transition-transform border-2 border-white/10`}>
              {teamA.name[0]}
            </div>
            <div className="text-center">
              <h3 className="text-white font-bold uppercase tracking-wide leading-tight text-sm md:text-base">{teamA.name}</h3>
            </div>
          </div>

          {/* Score/Versus */}
          <div className="flex flex-col items-center justify-center w-1/3">
            {match.status === 'scheduled' ? (
              <div className="text-center">
                  <div className="text-4xl font-black text-white/20 italic tracking-tighter">VS</div>
                  <div className="mt-2 flex flex-col items-center text-blue-400">
                    <Calendar size={14} className="mb-1" />
                    <span className="text-xs font-bold uppercase tracking-wider">{date.toLocaleDateString([], {month:'short', day:'numeric'})}</span>
                    <span className="text-xs font-mono">{date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                  </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                  <div className="flex items-center gap-4">
                    <span className={`text-4xl md:text-5xl font-black ${match.winner === match.teamA ? 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]' : 'text-white'}`}>{match.setsA}</span>
                    <span className="text-white/20 text-2xl font-black">-</span>
                    <span className={`text-4xl md:text-5xl font-black ${match.winner === match.teamB ? 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]' : 'text-white'}`}>{match.setsB}</span>
                  </div>
                  {match.status === 'live' && (
                    <div className="mt-2 px-3 py-1 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-[10px] font-black uppercase tracking-widest animate-pulse">
                      Set {match.scores.length}
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* Team B */}
          <div className="flex flex-col items-center gap-3 w-1/3">
            <div className={`w-16 h-16 rounded-2xl ${teamB.color} shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center justify-center text-white font-black text-3xl transform group-hover:scale-105 transition-transform border-2 border-white/10`}>
              {teamB.name[0]}
            </div>
            <div className="text-center">
              <h3 className="text-white font-bold uppercase tracking-wide leading-tight text-sm md:text-base">{teamB.name}</h3>
            </div>
          </div>
        </div>

        {/* Set Scores Detail */}
        {(match.status === 'finished' || match.status === 'live') && match.scores && (
          <div className="mt-6 flex justify-center gap-1">
            {match.scores.map((set, idx) => (
              <div key={idx} className="flex flex-col items-center bg-black/20 rounded px-2 py-1 min-w-[40px] border border-white/5">
                <span className="text-[9px] text-white/40 font-bold uppercase mb-1">Set {idx + 1}</span>
                <span className="text-sm font-mono font-bold text-white tracking-widest">
                  {set.a}-{set.b}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
};

// --- Admin Scorer ---
const AdminScorer = ({ match, teams, config, handleScore, setView }) => {
  if (!match) return <div className="p-10">Loading Match...</div>;

  const teamA = getTeam(teams, match.teamA);
  const teamB = getTeam(teams, match.teamB);
  const currentScores = match.scores.length > 0 ? match.scores : [{a:0, b:0}];
  const setIdx = currentScores.length;
  const scores = currentScores[setIdx - 1];

  // Calculate Target
  const isDecider = setIdx === config.setsPerMatch;
  const base = isDecider ? config.tieBreakerPoints : config.pointsPerSet;
  const maxScore = Math.max(scores.a, scores.b);
  const target = Math.max(base, (maxScore >= base - 1 ? maxScore + 2 : base));

  return (
    <div className="h-[calc(100vh-80px)] bg-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <button onClick={() => setView('admin-dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold">
          <ArrowLeft size={20} /> Exit Scorer
        </button>
        <div className="flex flex-col items-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Match Control</span>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-2xl font-black text-slate-800">SET {setIdx}</span>
            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded border border-yellow-200">Target: {target}</span>
          </div>
        </div>
        <div className="w-24"></div> {/* Spacer */}
      </div>

      {/* Main Controls */}
      <div className="flex-1 grid grid-cols-2">
        {/* Team A */}
        <div 
          onClick={() => handleScore('A')}
          className="relative flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 active:bg-slate-200 transition-colors border-r border-slate-200 select-none group"
        >
            <div className={`absolute top-0 left-0 right-0 h-4 ${teamA.color}`} />
            <h2 className="text-3xl font-bold text-slate-700 mb-6 uppercase tracking-tight">{teamA.name}</h2>
            <div className="text-[180px] font-black text-slate-900 leading-none tracking-tighter tabular-nums group-active:scale-95 transition-transform">
              {scores.a}
            </div>
            <div className="mt-8 flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest">
              Sets Won <span className="bg-slate-800 text-white px-3 py-1 rounded-full text-lg">{match.setsA}</span>
            </div>
        </div>

        {/* Team B */}
        <div 
          onClick={() => handleScore('B')}
          className="relative flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 active:bg-slate-200 transition-colors select-none group"
        >
            <div className={`absolute top-0 left-0 right-0 h-4 ${teamB.color}`} />
            <h2 className="text-3xl font-bold text-slate-700 mb-6 uppercase tracking-tight">{teamB.name}</h2>
            <div className="text-[180px] font-black text-slate-900 leading-none tracking-tighter tabular-nums group-active:scale-95 transition-transform">
              {scores.b}
            </div>
            <div className="mt-8 flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest">
              Sets Won <span className="bg-slate-800 text-white px-3 py-1 rounded-full text-lg">{match.setsB}</span>
            </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="bg-white border-t border-slate-200 p-6 flex justify-center gap-4">
        <button onClick={() => alert("Undo requires history implementation")} className="flex items-center gap-2 px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition-colors">
          <ArrowLeft size={18} /> Undo Last Point
        </button>
      </div>
    </div>
  );
};

// --- Admin Dashboard ---
const AdminDashboard = ({ 
  teams, matches, config, updateConfig, setIsAdmin, setView, 
  adminTab, setAdminTab, createFixture, startMatch, deleteDoc, addDoc, db, appId 
}) => {
  const [newItem, setNewItem] = useState('');
  const [fixture, setFixture] = useState({ ta: '', tb: '', d: '', t: '' });
  const [localConfig, setLocalConfig] = useState(config);

  const handleSaveRules = (e) => {
    e.preventDefault();
    updateConfig(localConfig);
    alert("Rules updated!");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Admin Dashboard</h1>
        <button onClick={() => { setIsAdmin(false); setView('public'); }} className="text-red-500 font-bold hover:underline">Log Out</button>
      </div>

      <div className="grid md:grid-cols-[250px_1fr] gap-8">
        <div className="flex flex-col gap-2">
          {[
            { id: 'fixtures', icon: Calendar, label: 'Match Schedule' },
            { id: 'teams', icon: Users, label: 'Manage Teams' },
            { id: 'settings', icon: Settings, label: 'Rules & Config' },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setAdminTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-colors text-left ${adminTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {/* FIXTURES TAB */}
          {adminTab === 'fixtures' && (
            <>
              <Card className="p-6 bg-slate-50">
                <h3 className="font-bold text-lg mb-4 text-slate-700">Schedule New Match</h3>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if(fixture.ta && fixture.tb && fixture.ta !== fixture.tb) {
                    createFixture({ teamA: fixture.ta, teamB: fixture.tb, date: fixture.d, time: fixture.t });
                    setFixture({ ta: '', tb: '', d: '', t: '' });
                  }
                }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <select className="p-3 rounded border" value={fixture.ta} onChange={e => setFixture({...fixture, ta: e.target.value})}>
                      <option value="">Select Team A</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select className="p-3 rounded border" value={fixture.tb} onChange={e => setFixture({...fixture, tb: e.target.value})}>
                      <option value="">Select Team B</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="date" className="p-3 rounded border" value={fixture.d} onChange={e => setFixture({...fixture, d: e.target.value})} required />
                    <input type="time" className="p-3 rounded border" value={fixture.t} onChange={e => setFixture({...fixture, t: e.target.value})} required />
                  </div>
                  <button className="w-full py-3 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">Add to Schedule</button>
                </form>
              </Card>

              <div className="space-y-3">
                  {matches.sort((a,b) => new Date(a.startTime) - new Date(b.startTime)).map(m => (
                    <Card key={m.id} className="p-4 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-800">{getTeam(teams, m.teamA).name} vs {getTeam(teams, m.teamB).name}</div>
                        <div className="text-xs text-slate-500">{new Date(m.startTime).toLocaleString()}</div>
                      </div>
                      <div className="flex gap-2">
                        {m.status !== 'finished' && (
                          <button onClick={() => startMatch(m.id)} className="px-4 py-2 bg-green-600 text-white rounded font-bold text-sm hover:bg-green-700">
                            {m.status === 'live' ? 'Resume' : 'Start'}
                          </button>
                        )}
                        <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', m.id))} className="p-2 text-red-400 hover:bg-red-50 rounded">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </Card>
                  ))}
              </div>
            </>
          )}

          {/* TEAMS TAB */}
          {adminTab === 'teams' && (
            <>
                <Card className="p-6">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if(newItem) {
                    const colors = ['bg-red-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-indigo-500', 'bg-cyan-500'];
                    addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'teams'), { name: newItem, color: colors[Math.floor(Math.random()*colors.length)] });
                    setNewItem('');
                  }
                }} className="flex gap-3">
                  <input className="flex-1 p-3 border rounded" placeholder="Team Name" value={newItem} onChange={e => setNewItem(e.target.value)} />
                  <button className="px-6 bg-blue-600 text-white font-bold rounded">Add</button>
                </form>
                </Card>
                <div className="grid gap-3">
                  {teams.map(t => (
                    <Card key={t.id} className="p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded ${t.color}`} />
                        <span className="font-bold">{t.name}</span>
                      </div>
                      <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teams', t.id))} className="text-red-400"><Trash2 size={18} /></button>
                    </Card>
                  ))}
                </div>
            </>
          )}

          {/* SETTINGS TAB */}
          {adminTab === 'settings' && (
            <Card className="p-8">
              <h3 className="text-xl font-bold mb-6 border-b pb-4">Tournament Configuration</h3>
              <form onSubmit={handleSaveRules} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Tournament Name</label>
                    <input 
                      type="text" 
                      className="w-full p-3 border border-slate-300 rounded-lg"
                      value={localConfig.tournamentName} 
                      onChange={e => setLocalConfig({...localConfig, tournamentName: e.target.value})} 
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Points per Set</label>
                      <input 
                        type="number" 
                        className="w-full p-3 border border-slate-300 rounded-lg"
                        value={localConfig.pointsPerSet === '' ? '' : localConfig.pointsPerSet}
                        onChange={e => setLocalConfig({...localConfig, pointsPerSet: e.target.value === '' ? '' : parseInt(e.target.value)})} 
                      />
                      <p className="text-xs text-slate-500 mt-1">Standard set target (e.g. 25)</p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Tie-Breaker Points</label>
                      <input 
                        type="number" 
                        className="w-full p-3 border border-slate-300 rounded-lg"
                        value={localConfig.tieBreakerPoints === '' ? '' : localConfig.tieBreakerPoints}
                        onChange={e => setLocalConfig({...localConfig, tieBreakerPoints: e.target.value === '' ? '' : parseInt(e.target.value)})} 
                      />
                      <p className="text-xs text-slate-500 mt-1">Deciding set target (e.g. 15)</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Sets per Match (Best Of)</label>
                    <select 
                      className="w-full p-3 border border-slate-300 rounded-lg"
                      value={localConfig.setsPerMatch} 
                      onChange={e => setLocalConfig({...localConfig, setsPerMatch: parseInt(e.target.value)})}
                    >
                      <option value={1}>1 Set</option>
                      <option value={3}>3 Sets</option>
                      <option value={5}>5 Sets</option>
                    </select>
                  </div>

                  <button className="w-full py-4 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors flex justify-center items-center gap-2">
                    <Save size={18} /> Save Configuration
                  </button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [config, setAppConfig] = useState(DEFAULT_CONFIG);
  const [view, setView] = useState('public');
  const [activeTab, setActiveTab] = useState('standings');
  const [adminTab, setAdminTab] = useState('fixtures');
  const [loginInput, setLoginInput] = useState('');
  const [scorerMatchId, setScorerMatchId] = useState(null);

  // --- Firebase ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubTeams = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'teams'), 
      (snap) => setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMatches = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'matches'), 
      (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), 
      (snap) => snap.exists() && setAppConfig(snap.data()));
    return () => { unsubTeams(); unsubMatches(); unsubConfig(); };
  }, [user]);

  // --- Logic ---
  
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (loginInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setLoginInput('');
      setView('admin-dashboard');
    } else {
      alert("Access Denied");
    }
  };

  const updateConfig = async (newConfig) => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), newConfig);
    setAppConfig(newConfig); // Optimistic update
  };

  // --- Match Management ---
  const createFixture = async (data) => {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'matches'), {
      teamA: data.teamA,
      teamB: data.teamB,
      status: 'scheduled',
      setsA: 0, setsB: 0, scores: [], winner: null,
      startTime: `${data.date}T${data.time}`
    });
  };

  const startMatch = async (matchId) => {
    if (!isAdmin) return;
    setScorerMatchId(matchId);
    const match = matches.find(m => m.id === matchId);
    if (match && match.status !== 'live') await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', matchId), { status: 'live' });
    setView('admin-scorer');
  };

  // --- Scorer Engine ---
  const handleScore = async (team) => {
    const match = matches.find(m => m.id === scorerMatchId);
    if (!match) return;

    let currentScores = [...match.scores];
    if (currentScores.length === 0) currentScores.push({ a: 0, b: 0 });

    const currentSetIndex = currentScores.length - 1;
    const currentSet = currentScores[currentSetIndex];
    
    const newSetScore = {
      a: team === 'A' ? currentSet.a + 1 : currentSet.a,
      b: team === 'B' ? currentSet.b + 1 : currentSet.b
    };
    currentScores[currentSetIndex] = newSetScore;

    const isDecidingSet = currentScores.length === config.setsPerMatch;
    const targetPoints = isDecidingSet ? config.tieBreakerPoints : config.pointsPerSet;
    const diff = Math.abs(newSetScore.a - newSetScore.b);
    const hasReachedTarget = (newSetScore.a >= targetPoints || newSetScore.b >= targetPoints);

    let updates = { scores: currentScores };

    if (hasReachedTarget && diff >= 2) {
       const setWinner = newSetScore.a > newSetScore.b ? 'A' : 'B';
       const newSetsA = setWinner === 'A' ? match.setsA + 1 : match.setsA;
       const newSetsB = setWinner === 'B' ? match.setsB + 1 : match.setsB;
       
       updates.setsA = newSetsA;
       updates.setsB = newSetsB;

       const setsNeededToWin = Math.ceil(config.setsPerMatch / 2);
       if (newSetsA === setsNeededToWin) {
         updates.status = 'finished';
         updates.winner = match.teamA;
         setTimeout(() => setView('admin-dashboard'), 2000);
       } else if (newSetsB === setsNeededToWin) {
         updates.status = 'finished';
         updates.winner = match.teamB;
         setTimeout(() => setView('admin-dashboard'), 2000);
       } else {
         updates.scores = [...currentScores, { a: 0, b: 0 }];
       }
    }
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', scorerMatchId), updates);
  };

  // --- Standings Calculation ---
  const standings = useMemo(() => {
    const stats = teams.map(team => {
      const teamMatches = matches.filter(m => (m.teamA === team.id || m.teamB === team.id) && m.status === 'finished');
      
      let played = 0, won = 0, lost = 0;
      let setsWon = 0, setsLost = 0;
      let pointsWon = 0, pointsLost = 0;
      let leaguePoints = 0;

      teamMatches.forEach(m => {
        played++;
        const isTeamA = m.teamA === team.id;
        
        // Match Result
        if (m.winner === team.id) {
          won++;
          leaguePoints += 2;
        } else {
          lost++;
        }

        // Sets
        setsWon += isTeamA ? m.setsA : m.setsB;
        setsLost += isTeamA ? m.setsB : m.setsA;

        // Points (Iterate through all set scores)
        m.scores.forEach(s => {
          pointsWon += isTeamA ? s.a : s.b;
          pointsLost += isTeamA ? s.b : s.a;
        });
      });

      // Ratios (Avoid division by zero)
      const setRatio = setsLost === 0 ? setsWon : setsWon / setsLost;
      const pointRatio = pointsLost === 0 ? pointsWon : pointsWon / pointsLost;

      return {
        ...team,
        played, won, lost,
        setsWon, setsLost, setRatio,
        pointsWon, pointsLost, pointRatio,
        leaguePoints
      };
    });

    // Sort Order: League Points -> Set Ratio -> Point Ratio
    return stats.sort((a, b) => {
      if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
      if (b.setRatio !== a.setRatio) return b.setRatio - a.setRatio;
      return b.pointRatio - a.pointRatio;
    });
  }, [teams, matches]);


  // --- Sub-Components ---
  const PublicView = () => {
    const liveMatches = matches.filter(m => m.status === 'live');
    const upcomingMatches = matches.filter(m => m.status === 'scheduled').sort((a,b) => new Date(a.startTime) - new Date(b.startTime));
    const finishedMatches = matches.filter(m => m.status === 'finished').sort((a,b) => new Date(b.startTime) - new Date(a.startTime));

    return (
      <div className="min-h-screen bg-slate-950 font-sans text-slate-100 pb-20 relative overflow-hidden">
        {/* Dynamic Background */}
        <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-blue-900/30 via-slate-950 to-slate-950 pointer-events-none" />
        <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-[200px] -left-[200px] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
          
          {/* Live Section */}
          {liveMatches.length > 0 && (
            <section className="mb-12 animate-fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-red-500 rounded-lg animate-pulse">
                  <Activity size={20} className="text-white" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-widest text-white">Live Action</h2>
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                {liveMatches.map(m => <MatchCardPublic key={m.id} match={m} teams={teams} config={config} />)}
              </div>
            </section>
          )}

          {/* Tab Navigation */}
          <div className="flex justify-center mb-8">
            <div className="bg-white/5 backdrop-blur-md p-1 rounded-2xl flex gap-1 border border-white/10">
              {[
                { id: 'standings', label: 'Standings', icon: TrendingUp },
                { id: 'fixtures', label: 'Matches', icon: Calendar },
                { id: 'results', label: 'Results', icon: CheckCircle2 }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${
                    activeTab === tab.id 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <tab.icon size={16} /> {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="min-h-[400px]">
            {activeTab === 'fixtures' && (
              <div className="grid md:grid-cols-2 gap-6">
                {upcomingMatches.length === 0 && <div className="col-span-2 text-center text-slate-500 py-12 italic">No upcoming matches scheduled</div>}
                {upcomingMatches.map(m => <MatchCardPublic key={m.id} match={m} teams={teams} config={config} />)}
              </div>
            )}

            {activeTab === 'results' && (
              <div className="grid md:grid-cols-2 gap-6">
                 {finishedMatches.length === 0 && <div className="col-span-2 text-center text-slate-500 py-12 italic">No matches finished yet</div>}
                 {finishedMatches.map(m => <MatchCardPublic key={m.id} match={m} teams={teams} config={config} />)}
              </div>
            )}

            {activeTab === 'standings' && (
              <GlassCard className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-white/10">
                      <th className="p-5">Rank</th>
                      <th className="p-5">Team</th>
                      <th className="p-5 text-center">Played</th>
                      <th className="p-5 text-center">W-L</th>
                      <th className="p-5 text-center hidden sm:table-cell">Set Ratio</th>
                      <th className="p-5 text-center hidden sm:table-cell">Point Ratio</th>
                      <th className="p-5 text-center bg-white/5 text-blue-300">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {standings.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-slate-500 italic">No teams registered</td></tr>}
                    {standings.map((team, idx) => (
                      <tr key={team.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-5 font-mono text-slate-500 font-bold w-16">{idx + 1}</td>
                        <td className="p-5">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg ${team.color} flex items-center justify-center font-black text-white shadow-lg`}>
                              {team.name[0]}
                            </div>
                            <span className="font-bold text-lg text-white group-hover:text-blue-300 transition-colors">{team.name}</span>
                          </div>
                        </td>
                        <td className="p-5 text-center font-mono text-slate-300">{team.played}</td>
                        <td className="p-5 text-center font-mono">
                          <span className="text-green-400 font-bold">{team.won}</span>
                          <span className="text-slate-600 mx-1">/</span>
                          <span className="text-red-400 font-bold">{team.lost}</span>
                        </td>
                        <td className="p-5 text-center font-mono text-sm hidden sm:table-cell text-slate-400">
                          {team.setRatio.toFixed(3)}
                        </td>
                        <td className="p-5 text-center font-mono text-sm hidden sm:table-cell text-slate-400">
                          {team.pointRatio.toFixed(3)}
                        </td>
                        <td className="p-5 text-center bg-white/5">
                          <span className="text-2xl font-black text-blue-400">{team.leaguePoints}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- Router ---
  if (view === 'admin-scorer') return <AdminScorer match={matches.find(m => m.id === scorerMatchId)} teams={teams} config={config} handleScore={handleScore} setView={setView} />;
  if (view === 'login') return <div className="min-h-screen"><Navigation config={config} view={view} setView={setView} isAdmin={isAdmin} /><LoginView loginInput={loginInput} setLoginInput={setLoginInput} handleAdminLogin={handleAdminLogin} setView={setView} /></div>;

  return (
    <div className="min-h-screen">
      <Navigation config={config} view={view} setView={setView} isAdmin={isAdmin} />
      {view === 'public' ? <PublicView /> : 
        <AdminDashboard 
          teams={teams} matches={matches} config={config} updateConfig={updateConfig} 
          setIsAdmin={setIsAdmin} setView={setView} adminTab={adminTab} setAdminTab={setAdminTab} 
          createFixture={createFixture} startMatch={startMatch} deleteDoc={deleteDoc} addDoc={addDoc} db={db} appId={appId}
        />}
    </div>
  );
}
