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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  measurementId: "G-76Z59K7S1L"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Helpers ---
const getTeam = (teams, id) => {
  if (id?.startsWith('PLACEHOLDER:')) {
    const parts = id.split(':');
    if (parts[1] === 'SF') return { name: `Winner ${parts[2]}`, color: 'bg-slate-700' };
    if (parts[1] === 'GRP') return { name: `${parts[2]} ${parts[3] === '1' ? 'Winner' : 'Runner-up'}`, color: 'bg-slate-700' };
    return { name: 'TBD', color: 'bg-slate-700' };
  }
  return (Array.isArray(teams) ? teams.find(t => t.id === id) : null) || { name: '...', color: 'bg-slate-700' };
};

// --- Configuration ---
// Update Config to support stage rules
const DEFAULT_CONFIG = {
  pointsPerSet: 25,
  setsPerMatch: 3,
  tieBreakerPoints: 15,
  tournamentName: 'PRO VOLLEY LEAGUE 2024',
  tournamentType: 'round-robin',
  matchRules: {
    league: { sets: 3, points: 25, tieBreak: 15 },
    semis: { sets: 5, points: 25, tieBreak: 15 },
    final: { sets: 5, points: 25, tieBreak: 15 }
  },
  roadmap: {
    qualifiers: 2, // Number of teams qualifying from each group
    playoffType: 'semis', // 'semis' (A1 vs B2, B1 vs A2) or 'ipl' (Page Playoff) or 'eliminator' (WPL)
    currentStage: 'group', // 'group', 'super_league', 'playoff'
    superStageName: 'Super Six',
    superStageTeams: [], // IDs of teams in Super Stage
    qualificationCount: 4 // Number of teams qualifying from Super Stage to Playoffs
  }
};

// --- Helpers ---
const shuffleArray = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex > 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

// --- Components ---

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white p-10 flex flex-col items-center justify-center">
          <h1 className="text-3xl font-bold text-red-500 mb-4">Something went wrong.</h1>
          <div className="bg-black/50 p-6 rounded-lg font-mono text-xs max-w-2xl overflow-auto whitespace-pre-wrap text-red-300 border border-red-500/30">
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-8 px-6 py-3 bg-blue-600 rounded-lg font-bold hover:bg-blue-500"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

// Admin Glass Card (Darker for readability)
const AdminGlassCard = ({ children, className = '' }) => (
  <div className={`relative overflow-hidden bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-xl rounded-xl ${className}`}>
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

// --- Roadmap View (Bracket Style) ---
const RoadmapView = ({ teams, matches, config, standings }) => {
  const groups = config.tournamentType === 'group'
    ? [...new Set(standings.map(s => s.group || 'A'))].sort()
    : ['League'];

  // Helper to find a match by stage or name
  const findMatch = (stage, name) => matches.find(m => m.stage === stage && (m.matchName === name || m.matchName?.includes(name)));

  // Determine if League is Finished
  const leagueMatches = matches.filter(m => m.stage.startsWith('Group') || m.stage === 'league');
  const isLeagueFinished = leagueMatches.length > 0 && leagueMatches.every(m => m.status === 'finished');

  const getQualifierName = (group, position) => {
    if (!isLeagueFinished) return `${group}${position}`;
    const sortedGroup = standings.filter(s => (s.group || 'A') === group).sort((a, b) => a.rank - b.rank); // Pre-sorted in main standings, filtering preserves order
    return sortedGroup[position - 1]?.name || 'TBD';
  };

  // Semis
  const semi1 = findMatch('semis', 'Semi Final 1');
  const semi2 = findMatch('semis', 'Semi Final 2');

  // Final
  const finalMatch = findMatch('final', 'Final');

  // Resolve Names for Display
  const resolveTeamName = (id, placeholder) => {
    if (!id || id === 'TBD') return placeholder; // If ID is missing or explicit TBD
    const team = teams.find(t => t.id === id);
    return team ? team.name : placeholder; // If ID exists but team not found (rare), or valid team
  };

  return (
    <div className="overflow-x-auto py-10">
      <div className="flex justify-between items-center min-w-[1000px] gap-8">

        {/* STAGE 1: GROUPS / LEAGUE */}
        <div className="flex flex-col gap-4">
          {groups.map(g => (
            <GlassCard key={g} className="p-4 w-56 border-l-4 border-blue-500">
              <h4 className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-3">Group {g} Results</h4>
              <div className="space-y-1">
                {standings.all.filter(s => (s.group || 'A') === g).slice(0, config.roadmap?.qualifiers || 2).map((s, i) => (
                  <div key={s.id} className="text-xs flex justify-between text-slate-300">
                    <span>{i + 1}. {s.name}</span>
                    <span>{s.leaguePoints}pts</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>

        <ChevronRight className="text-slate-600" />

        {/* STAGE 2: SUPER STAGE (Conditional) */}
        {(config.roadmap?.currentStage === 'super_league' || config.roadmap?.currentStage === 'playoff' || (config.roadmap?.superStageTeams?.length > 0)) && (
          <>
            <GlassCard className="p-4 w-64 border-l-4 border-purple-500">
              <h4 className="text-purple-400 font-bold uppercase tracking-widest text-xs mb-3">{config.roadmap?.superStageName || 'Super Stage'}</h4>
              <div className="space-y-1">
                {standings.superStage.map((s, i) => (
                  <div key={s.id} className={`text-xs flex justify-between ${i < (config.roadmap?.qualificationCount || 4) ? 'text-green-300 font-bold' : 'text-slate-400'}`}>
                    <span>{i + 1}. {s.name}</span>
                    <span>{s.leaguePoints}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
            <ChevronRight className="text-slate-600" />
          </>
        )}

        {/* STAGE 3: PLAYOFFS */}
        <div className="flex flex-col justify-around gap-8">
          {/* Dynamic Rendering based on Format */}
          {config.roadmap?.playoffType === 'eliminator' ? (
            <div className="flex flex-col gap-8">
              <GlassCard className="w-64 p-3 border-l-4 border-yellow-500">
                <div className="text-[10px] text-yellow-500 uppercase font-bold">Eliminator (2nd vs 3rd)</div>
                {(() => {
                  const elim = findMatch('playoff', 'Eliminator');
                  return elim ? (
                    <div className="text-sm mt-2">
                      <div className={elim.winner === elim.teamA ? 'text-green-400' : 'text-white'}>{resolveTeamName(elim.teamA, 'Rank 2')} vs</div>
                      <div className={elim.winner === elim.teamB ? 'text-green-400' : 'text-white'}>{resolveTeamName(elim.teamB, 'Rank 3')}</div>
                    </div>
                  ) : <div className="text-xs text-slate-500 mt-2">Scheduled after Super Stage</div>;
                })()}
              </GlassCard>
            </div>
          ) : (
            <>
              {/* Standard Semis */}
              <GlassCard className="w-56 p-2"><div className="text-xs text-center">Semi Final 1</div></GlassCard>
              <GlassCard className="w-56 p-2"><div className="text-xs text-center">Semi Final 2</div></GlassCard>
            </>
          )}
        </div>

        <ChevronRight className="text-slate-600" />

        {/* FINAL */}
        <GlassCard className="w-64 p-6 border-2 border-orange-500 tx-center">
          <Trophy className="mx-auto text-orange-500 mb-2" />
          <div className="text-center font-black text-xl text-white">CHAMPION</div>
          <div className="text-center text-orange-400 text-sm mt-2">{finalMatch?.winner ? resolveTeamName(finalMatch.winner) : '???'}</div>
        </GlassCard>

      </div>
    </div>
  );
};

// --- Auto-Scheduler Helper ---
const checkAndScheduleNextStage = async (matches, teams, standings, db, appId, config) => {
  console.log("Auto-Schedule Triggered", { matches, config });
  let actionTaken = false;

  if (config.tournamentType !== 'group' && config.roadmap?.currentStage === 'group') {
    // If not group type, standard logic applies (Round Robin -> Playoff)
    // But if we are in Super Stage, we handle it differently.
  }

  // --- 1. Semi-Finals Logic ---
  const semisExist = matches.some(m => m.stage === 'semis');

  // A. Create Placeholders if not exist
  if (!semisExist && config.tournamentType === 'group') {
    // Create placeholders immediately
    const now = new Date().toISOString();
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'matches'), {
      teamA: 'PLACEHOLDER:GRP:Group A:1', // Group A Winner
      teamB: 'PLACEHOLDER:GRP:Group B:2', // Group B Runner-up
      status: 'scheduled',
      setsA: 0, setsB: 0, scores: [], winner: null,
      startTime: now,
      isTba: true,
      stage: 'semis',
      matchName: 'Semi Final 1'
    });
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'matches'), {
      teamA: 'PLACEHOLDER:GRP:Group B:1', // Group B Winner
      teamB: 'PLACEHOLDER:GRP:Group A:2', // Group A Runner-up
      status: 'scheduled',
      setsA: 0, setsB: 0, scores: [], winner: null,
      startTime: now,
      isTba: true,
      stage: 'semis',
      matchName: 'Semi Final 2'
    });
    alert("Semi-Finals Scheduled (Placeholders).");
    actionTaken = true;
  }

  // B. Resolve Placeholders (if League Finished)
  const leagueMatches = matches.filter(m => m.stage.startsWith('Group') || m.stage === 'league');
  const isLeagueFinished = leagueMatches.length > 0 && leagueMatches.every(m => m.status === 'finished');

  if (isLeagueFinished && config.tournamentType === 'group') {
    const groupA = standings.filter(s => s.group === 'A');
    const groupB = standings.filter(s => s.group === 'B');

    // Find Semi matches with Placeholders
    const semiMatches = matches.filter(m => m.stage === 'semis');
    let updatesCount = 0;
    for (const match of semiMatches) {
      let update = {};
      if (match.teamA.startsWith('PLACEHOLDER:GRP:Group A:1') && groupA[0]) update.teamA = groupA[0].id;
      if (match.teamA.startsWith('PLACEHOLDER:GRP:Group B:1') && groupB[0]) update.teamA = groupB[0].id;
      if (match.teamA.startsWith('PLACEHOLDER:GRP:Group A:2') && groupA[1]) update.teamA = groupA[1].id;
      if (match.teamA.startsWith('PLACEHOLDER:GRP:Group B:2') && groupB[1]) update.teamA = groupB[1].id;

      if (match.teamB.startsWith('PLACEHOLDER:GRP:Group A:1') && groupA[0]) update.teamB = groupA[0].id;
      if (match.teamB.startsWith('PLACEHOLDER:GRP:Group B:1') && groupB[0]) update.teamB = groupB[0].id;
      if (match.teamB.startsWith('PLACEHOLDER:GRP:Group A:2') && groupA[1]) update.teamB = groupA[1].id;
      if (match.teamB.startsWith('PLACEHOLDER:GRP:Group B:2') && groupB[1]) update.teamB = groupB[1].id;

      if (Object.keys(update).length > 0) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', match.id), update);
        updatesCount++;
      }
    }
    if (updatesCount > 0) {
      alert(`Updated ${updatesCount} Semi-Final matches with qualified teams.`);
      actionTaken = true;
    }
  }

  // --- 2. Finals Logic ---
  const finalExists = matches.some(m => m.stage === 'final');
  // Re-check semisExist in case we just created them
  const currentSemisExist = matches.some(m => m.stage === 'semis') || actionTaken; // approximation

  // A. Create Placeholder Final if not exist
  // Only create Final placeholder if Semis exist
  if (!finalExists && hasSemis(matches)) {
    const now = new Date().toISOString();
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'matches'), {
      teamA: 'PLACEHOLDER:SF:Semi Final 1',
      teamB: 'PLACEHOLDER:SF:Semi Final 2',
      status: 'scheduled',
      setsA: 0, setsB: 0, scores: [], winner: null,
      startTime: now,
      isTba: true,
      stage: 'final',
      matchName: 'Final'
    });
    alert("Final Scheduled (Placeholder).");
    actionTaken = true;
  }

  // B. Resolve Final Placeholders (if Semis Finished)
  const semiMatches = matches.filter(m => m.stage === 'semis');
  const isSemisFinished = semiMatches.length === 2 && semiMatches.every(m => m.status === 'finished');

  if (isSemisFinished) {
    const winner1 = semiMatches.find(m => m.matchName === 'Semi Final 1')?.winner;
    const winner2 = semiMatches.find(m => m.matchName === 'Semi Final 2')?.winner;
    const finalMatch = matches.find(m => m.stage === 'final');

    if (winner1 && winner2 && finalMatch) {
      let update = {};
      if (finalMatch.teamA.startsWith('PLACEHOLDER')) update.teamA = winner1;
      if (finalMatch.teamB.startsWith('PLACEHOLDER')) update.teamB = winner2;

      if (Object.keys(update).length > 0) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', finalMatch.id), update);
        alert("Final Match updated with Semi-Final winners.");
        actionTaken = true;
      }
    }
  }

  if (!actionTaken) {
    alert("Auto-Schedule Check Complete.\n\nStatus:\n- Semis Exist: " + (hasSemis(matches) ? "Yes" : "No") + "\n- League Finished: " + (isLeagueFinished ? "Yes" : "No") + "\n- Final Exists: " + (finalExists ? "Yes" : "No"));
  }
};

// Helper
const hasSemis = (matches) => matches.some(m => m.stage === 'semis');

// --- Navigation ---
const Navigation = ({ config, view, setView, isAdmin }) => (
  <nav className={`sticky top-0 z-50 transition-all duration-300 ${view === 'public' ? 'bg-slate-950/80 backdrop-blur-lg border-b border-white/5' : 'bg-slate-950/90 backdrop-blur-md border-b border-white/5 shadow-md'}`}>
    <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
      <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('public')}>
        <div className={`p-2 rounded-lg transform transition-transform group-hover:scale-110 ${view === 'public' ? 'bg-gradient-to-br from-pink-500 to-orange-500 shadow-lg' : 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg'}`}>
          <Trophy size={24} className="text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-black text-xl tracking-tighter uppercase leading-none text-white">
            {config.tournamentName}
          </span>
          <span className={`text-[10px] font-bold tracking-[0.2em] uppercase ${view === 'public' ? 'text-blue-400' : 'text-blue-300'}`}>
            {view === 'public' ? 'Official Hub' : 'Admin Console'}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setView('public')}
          className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${view === 'public'
            ? 'bg-white text-slate-900 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
            : 'text-slate-400 hover:text-white'
            }`}
        >
          Public Hub
        </button>
        <button
          onClick={() => isAdmin ? setView('admin-dashboard') : setView('login')}
          className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${view.startsWith('admin') || view === 'login'
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
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
const MatchCardPublic = ({ match, teams, players, config, isLiveFeature = false }) => {
  const teamA = getTeam(teams, match.teamA);
  const teamB = getTeam(teams, match.teamB);
  const captainA = players.find(p => p.teamId === match.teamA && p.isCaptain);
  const captainB = players.find(p => p.teamId === match.teamB && p.isCaptain);

  return (
    <GlassCard className={`group hover:bg-slate-800/50 transition-colors ${isLiveFeature ? 'border-blue-500/30' : ''}`}>
      {/* Header */}
      <div className="bg-white/5 px-4 py-3 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-2">
          <Trophy size={12} className="text-blue-400" />
          <span className="text-blue-200/50 text-[10px] font-black uppercase tracking-[0.2em]">{config.tournamentName}</span>
        </div>
        <div className="flex items-center gap-2">
          {match.stage && <span className="text-[10px] uppercase font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded">{match.stage.replace('Group', 'GRP')}</span>}
          <Badge status={match.status} />
        </div>
      </div>

      {/* Content */}
      <div className={`relative ${isLiveFeature ? 'p-8 md:p-12' : 'p-6'}`}>
        <div className="flex justify-between items-center relative z-10">
          {/* Team A */}
          <div className="flex flex-col items-center gap-4 w-1/3">
            <div className={`relative ${isLiveFeature ? 'w-24 h-24 md:w-32 md:h-32 text-5xl md:text-6xl' : 'w-16 h-16 text-3xl'} rounded-2xl ${teamA.color} shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center justify-center text-white font-black transform transition-transform border-4 border-white/10`}>
              {teamA.name[0]}
              {/* Winner Indicator */}
              {match.winner === match.teamA && <div className="absolute -top-3 -right-3 bg-yellow-400 text-black p-1 rounded-full shadow-lg border-2 border-white"><Trophy size={14} /></div>}
            </div>
            <div className="text-center">
              <h3 className={`text-white font-black uppercase tracking-wide leading-none ${isLiveFeature ? 'text-xl md:text-3xl mb-2' : 'text-sm md:text-base'}`}>{teamA.name}</h3>
              {captainA && <div className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest bg-yellow-400/10 px-2 py-0.5 rounded-full inline-block">Captain: {captainA.name}</div>}
            </div>
          </div>

          {/* Score/Versus */}
          <div className="flex flex-col items-center justify-center w-1/3">
            {match.status === 'scheduled' ? (
              <div className="text-center">
                <div className="text-4xl md:text-6xl font-black text-white/10 italic tracking-tighter">VS</div>
                <div className="mt-2 flex flex-col items-center gap-1">
                  {match.isTba ? (
                    <span className="text-xs md:text-sm font-bold text-blue-400 bg-blue-400/10 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-400/20">
                      Time: TBA
                    </span>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 text-blue-400 font-bold uppercase tracking-wider text-xs md:text-sm">
                        <Calendar size={12} /> {new Date(match.startTime).toLocaleDateString()}
                      </div>
                      <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px] md:text-xs">
                        {new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="flex items-center gap-4 md:gap-8">
                  <span className={`text-4xl md:text-6xl font-black tabular-nums tracking-tighter ${match.winner === match.teamA ? 'text-white' : 'text-slate-500'}`}>{match.setsA || 0}</span>
                  <span className="text-xl md:text-3xl font-black text-slate-700">-</span>
                  <span className={`text-4xl md:text-6xl font-black tabular-nums tracking-tighter ${match.winner === match.teamB ? 'text-white' : 'text-slate-500'}`}>{match.setsB || 0}</span>
                </div>
                <div className="mt-2 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest">{match.status === 'live' ? 'Current Score' : 'Final Score'}</div>
              </div>
            )}
          </div>

          {/* Team B */}
          <div className="flex flex-col items-center gap-4 w-1/3">
            <div className={`relative ${isLiveFeature ? 'w-24 h-24 md:w-32 md:h-32 text-5xl md:text-6xl' : 'w-16 h-16 text-3xl'} rounded-2xl ${teamB.color} shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center justify-center text-white font-black transform transition-transform border-4 border-white/10`}>
              {teamB.name[0]}
              {match.winner === match.teamB && <div className="absolute -top-3 -right-3 bg-yellow-400 text-black p-1 rounded-full shadow-lg border-2 border-white"><Trophy size={14} /></div>}
            </div>
            <div className="text-center">
              <h3 className={`text-white font-black uppercase tracking-wide leading-none ${isLiveFeature ? 'text-xl md:text-3xl mb-2' : 'text-sm md:text-base'}`}>{teamB.name}</h3>
              {captainB && <div className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest bg-yellow-400/10 px-2 py-0.5 rounded-full inline-block">Captain: {captainB.name}</div>}
            </div>
          </div>
        </div>

        {/* Set Scores Detail */}
        {(match.status === 'finished' || match.status === 'live') && match.scores && (
          <div className="mt-8 flex justify-center gap-2">
            {match.scores.map((set, idx) => (
              <div key={idx} className={`flex flex-col items-center rounded-lg px-3 py-2 min-w-[50px] border ${isLiveFeature ? 'bg-white/10 border-white/20' : 'bg-black/20 border-white/5'}`}>
                <span className="text-[10px] text-white/60 font-bold uppercase mb-1">Set {idx + 1}</span>
                <span className={`font-mono font-bold text-white tracking-widest ${isLiveFeature ? 'text-xl' : 'text-sm'}`}>
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
const AdminScorer = ({ match, teams = [], config, handleScore, setView, updateDoc, db, appId }) => {
  const [swapSides, setSwapSides] = useState(false); // Visual Only

  // Safe Checks & Defaults to prevent Hooks violation
  const safeMatch = match || { scores: [], teamA: '', teamB: '', stage: 'league' };
  if (!match) {
    // We still render hooks above, but return early here if data missing
    // However, best practice is to condition the RENDER, not the HOOKS.
    // Since we used hooks above, we can return now, but let's just use safe defaults for everything.
  }

  // Safe Team Access
  const safeTeams = Array.isArray(teams) ? teams : [];
  const teamA = getTeam(safeTeams, safeMatch.teamA);
  const teamB = getTeam(safeTeams, safeMatch.teamB);

  // Safe Scores Access
  const currentScores = (safeMatch.scores && safeMatch.scores.length > 0) ? safeMatch.scores : [{ a: 0, b: 0 }];
  const currentSet = currentScores[currentScores.length - 1] || { a: 0, b: 0 };

  // Visual Left/Right Helper
  const leftTeam = swapSides ? teamB : teamA;
  const rightTeam = swapSides ? teamA : teamB;
  const leftScore = swapSides ? currentSet.b : currentSet.a;
  const rightScore = swapSides ? currentSet.a : currentSet.b;

  const setIdx = currentScores.length;

  const stageRules = (config?.matchRules && config.matchRules[safeMatch.stage]) || config?.matchRules?.league || { sets: 3, points: 25, tieBreak: 15 };
  const isDecider = setIdx === stageRules.sets;
  const base = isDecider ? stageRules.tieBreak : stageRules.points;
  const maxScore = Math.max(currentSet.a, currentSet.b);
  const target = Math.max(base, (maxScore >= base - 1 ? maxScore + 2 : base));

  // Swap Alert Logic
  // Swap Alert Logic - REMOVED per user request

  // Return early if no match data, but AFTER hooks and safe calculations
  if (!match) return <div className="p-10 text-white">Loading Match...</div>;

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-slate-950 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 bg-slate-900/80 backdrop-blur-md border-b border-white/10 px-6 py-4 flex justify-between items-center shadow-lg">
        <button onClick={() => setView('admin-dashboard')} className="flex items-center gap-2 text-slate-400 hover:text-white font-bold transition-colors">
          <ArrowLeft size={20} /> Exit
        </button>
        <div className="flex flex-col items-center">
          <span className="text-xs font-bold text-red-500 uppercase tracking-[0.2em] animate-pulse">Live</span>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-2xl font-black text-white italic tracking-tighter">SET {setIdx}</span>
            <span className="px-3 py-1 bg-white/10 text-blue-300 text-xs font-bold rounded border border-white/10 uppercase tracking-wider">Target: {target}</span>
          </div>

        </div>
        <button onClick={() => setSwapSides(!swapSides)} className="px-3 py-1 text-xs font-bold border border-white/20 rounded hover:bg-white/10">
          Swap Sides
        </button>
      </div>

      {/* Main Controls - Dynamic Left/Right */}
      <div className="relative z-10 flex-1 grid grid-cols-2">
        {/* LEFT SIDE */}
        <div
          onClick={() => handleScore(swapSides ? 'B' : 'A')}
          className="relative flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 active:bg-blue-600/20 transition-all border-r border-white/10 select-none group"
        >
          <div className={`absolute top-0 left-0 right-0 h-2 ${leftTeam.color} shadow-[0_0_20px_rgba(0,0,0,0.5)]`} />
          <h2 className="text-2xl md:text-4xl font-black text-white mb-8 uppercase tracking-wide opacity-50 group-hover:opacity-100 transition-opacity">{leftTeam.name}</h2>
          <div className="text-[120px] md:text-[220px] font-black text-white leading-none tracking-tighter tabular-nums drop-shadow-2xl group-active:scale-95 transition-transform group-active:text-blue-400">
            {leftScore}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div
          onClick={() => handleScore(swapSides ? 'A' : 'B')}
          className="relative flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 active:bg-red-600/20 transition-all select-none group"
        >
          <div className={`absolute top-0 left-0 right-0 h-2 ${rightTeam.color} shadow-[0_0_20px_rgba(0,0,0,0.5)]`} />
          <h2 className="text-2xl md:text-4xl font-black text-white mb-8 uppercase tracking-wide opacity-50 group-hover:opacity-100 transition-opacity">{rightTeam.name}</h2>
          <div className="text-[120px] md:text-[220px] font-black text-white leading-none tracking-tighter tabular-nums drop-shadow-2xl group-active:scale-95 transition-transform group-active:text-red-400">
            {rightScore}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="relative z-10 bg-slate-900/80 backdrop-blur-md border-t border-white/10 p-6 flex justify-center gap-4">
        <button className="flex items-center gap-2 px-8 py-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold transition-all border border-white/5 uppercase tracking-wider text-sm">
          <ArrowLeft size={18} /> Undo
        </button>
      </div>
    </div>
  );
};

// --- Admin Dashboard ---
const AdminDashboard = ({
  teams, matches, players, config, updateConfig, setIsAdmin, setView,
  adminTab, setAdminTab, createFixture, startMatch, deleteDoc, addDoc, updateDoc, db, appId, standings, generatePlayoffs
}) => {
  const [newItem, setNewItem] = useState('');
  const [newPlayer, setNewPlayer] = useState({ name: '', teamId: '', isCaptain: false });
  const [csvFile, setCsvFile] = useState(null);
  const [fixture, setFixture] = useState({ ta: '', tb: '', d: '', t: '', stage: 'league' });
  const [localConfig, setLocalConfig] = useState(config);
  const [showTossModal, setShowTossModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [tossDetails, setTossDetails] = useState({ winner: '', choice: 'Serve' });
  const [numGroups, setNumGroups] = useState(2);

  // Sync localConfig with prop and ensure defaults
  useEffect(() => {
    setLocalConfig({
      ...DEFAULT_CONFIG,
      ...config,
      matchRules: {
        ...DEFAULT_CONFIG.matchRules,
        ...(config.matchRules || {}),
        league: { ...DEFAULT_CONFIG.matchRules.league, ...(config.matchRules?.league || {}) },
        playoff: { ...DEFAULT_CONFIG.matchRules.playoff, ...(config.matchRules?.playoff || {}) }
      }
    });
  }, [config]);

  const handleSaveRules = (e) => {
    e.preventDefault();
    updateConfig(localConfig);
    alert("Rules updated!");
  };

  const processCSV = (e) => {
    e.preventDefault();
    if (!csvFile) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      const text = event.target.result;
      const rows = text.split('\n').slice(1); // Skip header
      let count = 0;

      rows.forEach(row => {
        const cols = row.split(',');
        if (cols.length >= 2) {
          const name = cols[0].trim();
          const teamName = cols[1].trim();
          const isCapt = cols[2]?.trim().toLowerCase() === 'true';

          const team = teams.find(t => t.name.toLowerCase() === teamName.toLowerCase());
          if (name && team) {
            addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'players'), {
              name: name,
              teamId: team.id,
              isCaptain: isCapt
            });
            count++;
          }
        }
      });
      alert(`Imported ${count} players successfully!`);
      setCsvFile(null);
    };
    reader.readAsText(csvFile);
  };

  const generateFixtures = () => {
    if (config.tournamentType === 'round-robin') {
      const generated = [];
      const teamIds = teams.map(t => t.id);
      for (let i = 0; i < teamIds.length; i++) {
        for (let j = i + 1; j < teamIds.length; j++) {
          generated.push({
            teamA: teamIds[i],
            teamB: teamIds[j],
            date: new Date().toISOString().split('T')[0],
            time: '18:00',
            stage: 'league',
            matchName: `League Match ${generated.length + 1}`
          });
        }
      }
      generated.forEach(g => createFixture(g));
      alert(`Generated ${generated.length} matches!`);
    } else if (config.tournamentType === 'group') {
      const groups = {};
      teams.forEach(team => {
        const g = team.group || 'A'; // Default to A if not set
        if (!groups[g]) groups[g] = [];
        groups[g].push(team.id);
      });

      let generated = 0;
      Object.entries(groups).forEach(([groupName, groupTeams]) => {
        for (let i = 0; i < groupTeams.length; i++) {
          for (let j = i + 1; j < groupTeams.length; j++) {
            createFixture({
              teamA: groupTeams[i],
              teamB: groupTeams[j],
              date: new Date().toISOString().split('T')[0],
              time: '18:00',
              stage: `Group ${groupName}`,
              matchName: `Group ${groupName} Match`
            });
            generated++;
          }
        }
      });
      alert(`Generated ${generated} matches across ${Object.keys(groups).length} groups!`);
    } else {
      alert("Only Round Robin & Group generation supported.");
    }
  };

  const handleStartMatchClick = (match) => {
    setSelectedMatch(match);
    setShowTossModal(true);
  };

  const confirmStartMatch = () => {
    if (selectedMatch && tossDetails.winner) {
      startMatch(selectedMatch.id, tossDetails);
      setShowTossModal(false);
      setTossDetails({ winner: '', choice: 'Serve' });
    } else {
      alert("Please select Toss Winner");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 pb-20 relative overflow-hidden">
      {/* Dynamic Background for Admin */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute top-[100px] right-[100px] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black uppercase tracking-wide text-white">Dashboard</h1>
          <button onClick={() => { setIsAdmin(false); setView('public'); }} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-lg transition-colors border border-red-500/20">Log Out</button>
        </div>

        <div className="grid md:grid-cols-[260px_1fr] gap-8">
          <div className="flex flex-col gap-3">
            {[
              { id: 'fixtures', icon: Calendar, label: 'Match Schedule' },
              { id: 'teams', icon: Users, label: 'Manage Teams' },
              { id: 'players', icon: Users, label: 'Manage Players' },
              { id: 'settings', icon: Settings, label: 'Configuration' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setAdminTab(tab.id)}
                className={`flex items-center gap-3 px-5 py-4 rounded-xl font-bold transition-all text-left ${adminTab === tab.id
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}
              >
                <tab.icon size={20} /> <span className="uppercase tracking-wider text-xs">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {/* FIXTURES TAB */}
            {adminTab === 'fixtures' && (
              <>
                <AdminGlassCard className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-white">{fixture.id ? 'Edit Match' : 'Schedule New Match'}</h3>
                    <div className="flex gap-2">
                      {!fixture.id && config.tournamentType === 'group' && (
                        <select className="bg-slate-800 text-white text-xs p-2 rounded" value={numGroups} onChange={e => setNumGroups(parseInt(e.target.value))}>
                          <option value={2}>2 Groups</option>
                          <option value={3}>3 Groups</option>
                          <option value={4}>4 Groups</option>
                        </select>
                      )}
                      {!fixture.id && <button onClick={generateFixtures} className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded font-bold uppercase tracking-wider">Auto-Generate Fixtures</button>}
                      {!fixture.id && <button onClick={() => checkAndScheduleNextStage(matches, teams, standings, db, appId, config)} className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded font-bold uppercase tracking-wider">Check Auto-Schedule</button>}
                      {fixture.id && <button onClick={() => setFixture({ ta: '', tb: '', d: '', t: '', stage: 'league' })} className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-3 py-2 rounded font-bold uppercase tracking-wider">Cancel Edit</button>}
                    </div>
                  </div>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (fixture.ta && fixture.tb && fixture.ta !== fixture.tb) {
                      if (fixture.id) {
                        // Update existing match
                        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', fixture.id), {
                          teamA: fixture.ta,
                          teamB: fixture.tb,
                          startTime: `${fixture.d}T${fixture.t}`,
                          stage: fixture.stage,
                          matchName: fixture.matchName || ''
                        });
                        alert("Match Updated!");
                      } else {
                        // Create new
                        createFixture({ teamA: fixture.ta, teamB: fixture.tb, date: fixture.d, time: fixture.t, stage: fixture.stage, matchName: fixture.matchName });
                      }
                      setFixture({ ta: '', tb: '', d: '', t: '', stage: 'league' });
                    }
                  }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <select className="p-3 rounded bg-slate-800 border border-slate-700 text-white focus:border-blue-500 outline-none" value={fixture.ta} onChange={e => setFixture({ ...fixture, ta: e.target.value })}>
                        <option value="">Select Team A</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <select className="p-3 rounded bg-slate-800 border border-slate-700 text-white focus:border-blue-500 outline-none" value={fixture.tb} onChange={e => setFixture({ ...fixture, tb: e.target.value })}>
                        <option value="">Select Team B</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input type="text" className="p-3 rounded bg-slate-800 border border-slate-700 text-white focus:border-blue-500 outline-none" placeholder="Match Name (e.g. Qualifier 1)" value={fixture.matchName || ''} onChange={e => setFixture({ ...fixture, matchName: e.target.value })} />
                      <select className="p-3 rounded bg-slate-800 border border-slate-700 text-white focus:border-blue-500 outline-none" value={fixture.stage} onChange={e => setFixture({ ...fixture, stage: e.target.value })}>
                        <option value="league">League Rule Set</option>
                        <option value="playoff">Playoff Rule Set</option>
                        <option value="super_league">Super Stage Rule Set</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input type="date" className="p-3 rounded bg-slate-800 border border-slate-700 text-white focus:border-blue-500 outline-none" value={fixture.d} onChange={e => setFixture({ ...fixture, d: e.target.value })} required />
                      <input type="time" className="p-3 rounded bg-slate-800 border border-slate-700 text-white focus:border-blue-500 outline-none" value={fixture.t} onChange={e => setFixture({ ...fixture, t: e.target.value })} required />
                    </div>
                    <button className={`w-full py-3 ${fixture.id ? 'bg-orange-600 hover:bg-orange-500' : 'bg-blue-600 hover:bg-blue-500'} text-white font-bold rounded transition-colors uppercase tracking-wider text-sm shadow-lg`}>
                      {fixture.id ? 'Update Match' : 'Add to Schedule'}
                    </button>
                  </form>
                </AdminGlassCard>

                <div className="space-y-3">
                  {matches.sort((a, b) => new Date(a.startTime) - new Date(b.startTime)).map(m => (
                    <AdminGlassCard key={m.id} className="p-4 flex justify-between items-center group hover:bg-slate-800/80 transition-colors">
                      <div>
                        <div className="font-bold text-white text-lg">{getTeam(teams, m.teamA).name} vs {getTeam(teams, m.teamB).name}</div>
                        <div className="text-xs text-slate-400 font-mono mt-1">
                          {new Date(m.startTime).toLocaleString()}
                          {m.matchName && <span className="ml-2 px-2 py-0.5 rounded bg-blue-900 text-blue-200">{m.matchName}</span>}
                          <span className="ml-2 px-2 py-0.5 rounded bg-slate-700 text-slate-300 uppercase">{m.stage || 'league'}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {/* Edit Button */}
                        {m.status === 'scheduled' && (
                          <button onClick={() => {
                            const d = new Date(m.startTime);
                            setFixture({
                              id: m.id,
                              ta: m.teamA,
                              tb: m.teamB,
                              d: d.toISOString().split('T')[0],
                              t: d.toTimeString().slice(0, 5),
                              stage: m.stage || 'league',
                              matchName: m.matchName || ''
                            });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold text-xs uppercase tracking-wider">
                            Edit
                          </button>
                        )}

                        {/* Only show Start/Resume if not finished */}
                        {m.status !== 'finished' && (
                          <button onClick={() => startMatch(m.id)} className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded font-bold text-xs uppercase tracking-wider shadow-lg shadow-green-500/20">
                            {m.status === 'live' ? 'Resume' : 'Start Match'}
                          </button>
                        )}
                        <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', m.id))} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </AdminGlassCard>
                  ))}
                </div>
              </>
            )}

            {/* TEAMS TAB */}
            {adminTab === 'teams' && (
              <>
                <AdminGlassCard className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-white">Manage Teams</h3>
                    <div className="flex gap-2">
                      {config.tournamentType === 'group' && (
                        <button
                          onClick={() => {
                            if (!confirm("This will shuffle all teams into groups randomly. Continue?")) return;
                            const shuffled = shuffleArray([...teams]);
                            const groups = Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i)); // ['A', 'B', ...]
                            shuffled.forEach((team, idx) => {
                              const group = groups[idx % numGroups];
                              updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teams', team.id), { group });
                            });
                            alert("Teams assigned to groups randomly!");
                          }}
                          className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded font-bold uppercase tracking-wider text-xs"
                        >
                          Random Group Gen
                        </button>
                      )}
                    </div>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (newItem) {
                      const colors = ['bg-red-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-indigo-500', 'bg-cyan-500'];
                      addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'teams'), {
                        name: newItem,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        group: 'A'
                      });
                      setNewItem('');
                    }
                  }} className="flex gap-3 mb-6">
                    <input className="flex-1 p-3 bg-slate-800 border border-slate-700 rounded text-white focus:border-blue-500 outline-none" placeholder="Enter Team Name" value={newItem} onChange={e => setNewItem(e.target.value)} />
                    <button className="px-6 bg-blue-600 text-white font-bold rounded hover:bg-blue-500 uppercase tracking-wider text-sm">Add Team</button>
                  </form>

                  <div className="grid gap-3">
                    {teams.map(t => (
                      <AdminGlassCard key={t.id} className="p-4 flex justify-between items-center group">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg ${t.color} shadow-lg`} />
                          <div>
                            <span className="font-bold text-white text-lg block">{t.name}</span>
                            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider">
                              <span>Squad: {players.filter(p => p.teamId === t.id).length}</span>
                              {config.tournamentType === 'group' && (
                                <>
                                  <span className="text-slate-600">|</span>
                                  <div className="flex items-center gap-1">
                                    <span>Group:</span>
                                    <select
                                      value={t.group || 'A'}
                                      onChange={(e) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teams', t.id), { group: e.target.value })}
                                      className="bg-slate-800 text-blue-300 font-bold border-none rounded p-1 cursor-pointer outline-none hover:bg-slate-700"
                                    >
                                      {Array.from({ length: 4 }, (_, i) => String.fromCharCode(65 + i)).map(g => (
                                        <option key={g} value={g}>{g}</option>
                                      ))}
                                    </select>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teams', t.id))} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={18} /></button>
                      </AdminGlassCard>
                    ))}
                  </div>
                </AdminGlassCard>
              </>
            )}

            {/* PLAYERS TAB */}
            {adminTab === 'players' && (
              <>
                {/* CSV Import */}
                <AdminGlassCard className="p-6 mb-4">
                  <h3 className="font-bold text-lg mb-2 text-white">Bulk Import Players</h3>
                  <p className="text-xs text-slate-400 mb-4">Upload CSV with headers: <code>Name, Team Name, IsCaptain (true/false)</code></p>
                  <form onSubmit={processCSV} className="flex gap-4">
                    <input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files[0])} className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500" />
                    <button type="submit" disabled={!csvFile} className="px-4 py-2 bg-green-600 disabled:bg-slate-700 text-white rounded text-xs font-bold uppercase tracking-wider">Import CSV</button>
                  </form>
                </AdminGlassCard>

                {/* Add Player Form */}
                <AdminGlassCard className="p-6">
                  <h3 className="font-bold text-lg mb-4 text-white">Add New Player</h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (newPlayer.name) {
                      addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'players'), newPlayer);
                      setNewPlayer({ name: '', teamId: '', isCaptain: false });
                    }
                  }} className="space-y-4">
                    <input
                      type="text"
                      className="w-full p-3 rounded bg-slate-800 border border-slate-700 text-white focus:border-blue-500 outline-none"
                      placeholder="Player Name"
                      value={newPlayer.name}
                      onChange={e => setNewPlayer({ ...newPlayer, name: e.target.value })}
                    />
                    <select
                      className="w-full p-3 rounded bg-slate-800 border border-slate-700 text-white focus:border-blue-500 outline-none"
                      value={newPlayer.teamId}
                      onChange={e => setNewPlayer({ ...newPlayer, teamId: e.target.value })}
                    >
                      <option value="">Select Team (Optional)</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPlayer.isCaptain}
                        onChange={e => setNewPlayer({ ...newPlayer, isCaptain: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-bold">Set as Team Captain</span>
                    </label>
                    <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded hover:bg-blue-500 uppercase tracking-wider text-sm shadow-lg">Add Player</button>
                  </form>
                </AdminGlassCard>

                {/* Player List */}
                <div className="space-y-4">
                  {teams.map(team => {
                    const teamPlayers = players.filter(p => p.teamId === team.id);
                    if (teamPlayers.length === 0) return null;
                    return (
                      <AdminGlassCard key={team.id} className="p-4">
                        <h4 className={`font-bold text-lg mb-3 ${team.color.replace('bg-', 'text-')}`}>{team.name}</h4>
                        <div className="space-y-2">
                          {teamPlayers.map(p => (
                            <div key={p.id} className="flex justify-between items-center bg-slate-800/50 p-3 rounded border border-white/5">
                              <div className="flex items-center gap-2">
                                {p.isCaptain && <span className="bg-yellow-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded">C</span>}
                                <span className={`text-slate-200 ${p.isCaptain ? 'font-bold' : ''}`}>{p.name}</span>
                              </div>
                              <div className="flex gap-3">
                                <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', p.id), { isCaptain: !p.isCaptain })} className="text-xs text-blue-400 font-bold hover:underline hover:text-blue-300">
                                  {p.isCaptain ? 'Demote' : 'Promote'}
                                </button>
                                <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', p.id))} className="text-slate-600 hover:text-red-400">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </AdminGlassCard>
                    );
                  })}
                </div>
              </>
            )}

            {/* SETTINGS TAB */}
            {adminTab === 'settings' && (
              <AdminGlassCard className="p-8">
                <h3 className="text-xl font-bold mb-6 text-white border-b border-white/10 pb-4">Tournament Configuration</h3>
                <form onSubmit={handleSaveRules} className="space-y-8">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tournament Name</label>
                    <input
                      type="text"
                      className="w-full p-3 bg-slate-800 border border-slate-700 rounded text-white focus:border-blue-500 outline-none"
                      value={localConfig.tournamentName}
                      onChange={e => setLocalConfig({ ...localConfig, tournamentName: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tournament Type</label>
                    <select
                      className="w-full p-3 bg-slate-800 border border-slate-700 rounded text-white focus:border-blue-500 outline-none"
                      value={localConfig.tournamentType || 'round-robin'}
                      onChange={e => setLocalConfig({ ...localConfig, tournamentType: e.target.value })}
                    >
                      <option value="round-robin">Round Robin (League)</option>
                      <option value="knockout">Knockout</option>
                      <option value="group">Group Stage</option>
                    </select>
                  </div>

                  {/* League Rules */}
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-white/5">
                    <h4 className="text-yellow-400 font-bold mb-4 uppercase tracking-wider text-sm">League Stage Rules</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sets</label>
                        <input type="number" className="w-full p-2 bg-slate-800 rounded text-white text-sm" value={localConfig.matchRules?.league?.sets || 3} onChange={e => setLocalConfig({ ...localConfig, matchRules: { ...localConfig.matchRules, league: { ...(localConfig.matchRules?.league || {}), sets: parseInt(e.target.value) } } })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Points</label>
                        <input type="number" className="w-full p-2 bg-slate-800 rounded text-white text-sm" value={localConfig.matchRules?.league?.points || 25} onChange={e => setLocalConfig({ ...localConfig, matchRules: { ...localConfig.matchRules, league: { ...(localConfig.matchRules?.league || {}), points: parseInt(e.target.value) } } })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tie-Break</label>
                        <input type="number" className="w-full p-2 bg-slate-800 rounded text-white text-sm" value={localConfig.matchRules?.league?.tieBreak || 15} onChange={e => setLocalConfig({ ...localConfig, matchRules: { ...localConfig.matchRules, league: { ...(localConfig.matchRules?.league || {}), tieBreak: parseInt(e.target.value) } } })} />
                      </div>
                    </div>
                  </div>

                  {/* Playoff Rules */}
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-white/5">
                    <h4 className="text-red-400 font-bold mb-4 uppercase tracking-wider text-sm">Playoff Rules (Semis/Finals)</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sets</label>
                        <input type="number" className="w-full p-2 bg-slate-800 rounded text-white text-sm" value={localConfig.matchRules?.playoff?.sets || 5} onChange={e => setLocalConfig({ ...localConfig, matchRules: { ...localConfig.matchRules, playoff: { ...(localConfig.matchRules?.playoff || {}), sets: parseInt(e.target.value) } } })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Points</label>
                        <input type="number" className="w-full p-2 bg-slate-800 rounded text-white text-sm" value={localConfig.matchRules?.playoff?.points || 25} onChange={e => setLocalConfig({ ...localConfig, matchRules: { ...localConfig.matchRules, playoff: { ...(localConfig.matchRules?.playoff || {}), points: parseInt(e.target.value) } } })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tie-Break</label>
                        <input type="number" className="w-full p-2 bg-slate-800 rounded text-white text-sm" value={localConfig.matchRules?.playoff?.tieBreak || 15} onChange={e => setLocalConfig({ ...localConfig, matchRules: { ...localConfig.matchRules, playoff: { ...(localConfig.matchRules?.playoff || {}), tieBreak: parseInt(e.target.value) } } })} />
                      </div>
                    </div>
                  </div>

                  {/* Roadmap Configuration */}
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-white/5">
                    <h4 className="text-purple-400 font-bold mb-4 uppercase tracking-wider text-sm">Roadmap Configuration</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qualifiers per Group (to Super Stage)</label>
                        <input type="number" className="w-full p-2 bg-slate-800 rounded text-white text-sm" value={localConfig.roadmap?.qualifiers || 2} onChange={e => setLocalConfig({ ...localConfig, roadmap: { ...localConfig.roadmap, qualifiers: parseInt(e.target.value) } })} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Playoff Format</label>
                        <select className="w-full p-2 bg-slate-800 rounded text-white text-sm" value={localConfig.roadmap?.playoffType || 'semis'} onChange={e => setLocalConfig({ ...localConfig, roadmap: { ...localConfig.roadmap, playoffType: e.target.value } })}>
                          <option value="semis">Standard Semis (A1 vs B2, B1 vs A2)</option>
                          <option value="eliminator">WPL / Eliminator (1->Final, 2vs3->Final)</option>
                          <option value="ipl">Page Playoff (Qualifier 1, Eliminator, Qualifier 2)</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <div className="bg-slate-800/50 p-4 rounded mt-2">
                          <h5 className="font-bold text-white text-xs uppercase mb-2">Stage Progression Control</h5>
                          <div className="flex gap-4 items-center">
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Name of Super Stage</label>
                              <input className="w-full p-2 bg-slate-800 rounded text-white text-xs" value={localConfig.roadmap?.superStageName || 'Super Six'} onChange={e => setLocalConfig({ ...localConfig, roadmap: { ...localConfig.roadmap, superStageName: e.target.value } })} />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                // Transition Logic
                                if (config.roadmap?.currentStage === 'playoff') { alert("Already in Playoff Stage"); return; }

                                // Select Teams for Super Stage
                                const qualCount = config.roadmap?.qualifiers || 2;
                                // Quick hack: Get top N from each group in standings
                                const groups = ['A', 'B']; // Assume 2 groups for now
                                let qualifiedIds = [];
                                groups.forEach(g => {
                                  const groupTeams = standings.all.filter(s => (s.group || 'A') === g);
                                  qualifiedIds.push(...groupTeams.slice(0, qualCount).map(t => t.id));
                                });

                                if (confirm(`Promote ${qualifiedIds.length} teams to ${localConfig.roadmap?.superStageName}?`)) {
                                  updateConfig({
                                    ...config,
                                    roadmap: {
                                      ...config.roadmap,
                                      currentStage: 'super_league',
                                      superStageTeams: qualifiedIds,
                                      superStageName: localConfig.roadmap?.superStageName
                                    }
                                  });
                                  alert("Stage Updated to Super League!");
                                }
                              }}
                              className="px-4 py-2 bg-purple-600 text-white rounded font-bold text-xs uppercase tracking-wider hover:bg-purple-500"
                            >
                              Start Super Stage
                            </button>
                            <button
                              type="button"
                              onClick={generatePlayoffs}
                              className="px-4 py-2 bg-yellow-600 text-white rounded font-bold text-xs uppercase tracking-wider hover:bg-yellow-500"
                            >
                              Generate Playoffs ({localConfig.roadmap?.playoffType})
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg hover:from-blue-500 hover:to-indigo-500 transition-all flex justify-center items-center gap-2 shadow-lg uppercase tracking-wider text-sm">
                    <Save size={18} /> Save Configuration
                  </button>
                </form>
              </AdminGlassCard>
            )}
          </div>
        </div>
      </div>
      {/* Toss Modal - REMOVED */}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
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
    const unsubPlayers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'players'),
      (snap) => setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMatches = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'matches'),
      (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'),
      (snap) => snap.exists() && setAppConfig({ ...DEFAULT_CONFIG, ...snap.data() }));
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
      startTime: `${data.date}T${data.time}`,
      stage: data.stage || 'league',
      matchName: data.matchName || ''
    });
  };

  const startMatch = async (matchId) => {
    if (!isAdmin) return;
    setScorerMatchId(matchId);
    const match = matches.find(m => m.id === matchId);
    if (match && match.status !== 'live') {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', matchId), { status: 'live' });
    }
    setView('admin-scorer');
  };

  // --- Scorer Engine ---
  const handleScore = async (team) => {
    const match = matches.find(m => m.id === scorerMatchId);
    if (!match || match.status === 'finished') return; // Prevent extra sets

    let currentScores = match.scores ? [...match.scores] : [];
    if (currentScores.length === 0) currentScores.push({ a: 0, b: 0 });

    const currentSetIndex = currentScores.length - 1;
    const currentSet = currentScores[currentSetIndex];

    const newSetScore = {
      a: team === 'A' ? currentSet.a + 1 : currentSet.a,
      b: team === 'B' ? currentSet.b + 1 : currentSet.b
    };
    currentScores[currentSetIndex] = newSetScore;

    // RULE SELECTION
    const stageRules = (config?.matchRules && config.matchRules[match.stage]) || config?.matchRules?.league || { sets: 3, points: 25, tieBreak: 15 };
    const setsToWin = Math.ceil(stageRules.sets / 2);

    // Check if decider
    const isDecidingSet = currentScores.length === stageRules.sets;
    const targetPoints = isDecidingSet ? stageRules.tieBreak : stageRules.points;
    const diff = Math.abs(newSetScore.a - newSetScore.b);
    const hasReachedTarget = (newSetScore.a >= targetPoints || newSetScore.b >= targetPoints);

    let updates = { scores: currentScores };

    if (hasReachedTarget && diff >= 2) {
      const setWinner = newSetScore.a > newSetScore.b ? 'A' : 'B';
      const newSetsA = setWinner === 'A' ? match.setsA + 1 : match.setsA;
      const newSetsB = setWinner === 'B' ? match.setsB + 1 : match.setsB;

      updates.setsA = newSetsA;
      updates.setsB = newSetsB;

      const setsNeededToWin = Math.ceil(stageRules.sets / 2);
      if (newSetsA === setsNeededToWin) {
        updates.status = 'finished';
        updates.winner = match.teamA;
        setTimeout(() => setView('admin-dashboard'), 2000);
      } else if (newSetsB === setsNeededToWin) {
        updates.status = 'finished';
        updates.winner = match.teamB;
        setTimeout(() => setView('admin-dashboard'), 2000);
      }
      if (newSetsA > (stageRules.sets / 2) || newSetsB > (stageRules.sets / 2)) {
        const winner = newSetsA > newSetsB ? match.teamA : match.teamB;
        updates.status = 'finished';
        updates.winner = winner;
        alert(`Match Finished! Winner: ${winner === match.teamA ? 'Team A' : 'Team B'}`);

        // Auto-Schedule Hook
        // We need to wait for the update to propagate or pass the new state
        // passing updated matches list would be ideal, but here we just trigger it.
        // The helper needs the *latest* data. Since we are updating firestore,
        // we can assume firestore update will trigger a re-render/re-fetch,
        // but we want to trigger scheduling *now*.
        // Let's pass the *anticipated* new matches state?
        // Actually, let's just wait a tick or call it with the knowledge of this match finishing.
        setTimeout(() => {
          // We need to fetch latest matches or use current + update.
          // Since we don't have easy access to "latest from DB" here without listening,
          // we will construct a temporary matches array with this match updated.
          const updatedMatches = matches.map(m => m.id === match.id ? { ...m, ...updates } : m);
          checkAndScheduleNextStage(updatedMatches, teams, standings, db, appId, config);
        }, 1000);
      } else {
        // Only create new set if match not finished and max sets not reached
        updates.scores = [...currentScores, { a: 0, b: 0 }];
      }
    }
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', scorerMatchId), updates);
  };

  // --- Standings Calculation ---
  const standings = useMemo(() => {
    // Determine which teams/matches to consider based on view context or stage
    // For general standings, valid logic is:
    // 1. Group Stage: All matches.
    // 2. Super Stage: Only matches between Qualified Teams (carry forward group results if applicable).

    // We calculate "Global" stats first, but we need stage-specific tables.
    // Let's create a helper to calculate stats for a specific set of teams and matches.

    const calculateStats = (teamsList, matchesList) => {
      return teamsList.map(team => {
        // Filter matches: Must involve this team AND opponent must be in the teamsList (for Super Stage isolation)
        const relevantMatches = matchesList.filter(m => {
          const isInvolved = (m.teamA === team.id || m.teamB === team.id);
          if (!isInvolved) return false;
          if (m.status !== 'finished') return false;

          // Strict filtering for Super Stage: Opponent must also be in the list
          const opponentId = m.teamA === team.id ? m.teamB : m.teamA;
          const opponentInList = teamsList.some(t => t.id === opponentId);
          return opponentInList;
        });

        let played = 0, won = 0, lost = 0;
        let setsWon = 0, setsLost = 0;
        let pointsWon = 0, pointsLost = 0;
        let leaguePoints = 0;

        relevantMatches.forEach(m => {
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

          // Points
          if (m.scores) {
            m.scores.forEach(s => {
              pointsWon += isTeamA ? s.a : s.b;
              pointsLost += isTeamA ? s.b : s.a;
            });
          }
        });

        const setRatio = setsLost === 0 ? setsWon : setsWon / setsLost;
        const pointRatio = pointsLost === 0 ? pointsWon : pointsWon / pointsLost;

        return {
          ...team,
          played, won, lost,
          setsWon, setsLost, setRatio,
          pointsWon, pointsLost, pointRatio,
          leaguePoints,
          squadSize: players.filter(p => p.teamId === team.id).length
        };
      }).sort((a, b) => {
        if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
        if (b.setRatio !== a.setRatio) return b.setRatio - a.setRatio;
        return b.pointRatio - a.pointRatio;
      });
    };

    // 1. Global/Group Standings (All Teams, All Matches)
    // Actually for Group stage, we want all matches.
    // For Super Stage, we only want matches between Super Teams.

    return {
      all: calculateStats(teams, matches),
      superStage: config.roadmap?.superStageTeams?.length > 0
        ? calculateStats(teams.filter(t => config.roadmap.superStageTeams.includes(t.id)), matches)
        : []
    };
  }, [teams, matches, config.roadmap, players]);


  const generatePlayoffs = async () => {
    // Determine qualified teams from Super Stage
    const qualifiedTeams = standings.superStage.slice(0, config.roadmap?.qualificationCount || 4);
    if (qualifiedTeams.length < 3) {
      alert("Not enough qualified teams to generate playoffs!");
      return;
    }

    if (config.roadmap?.playoffType === 'eliminator') {
      // WPL Format: 
      // 1. Eliminator: Rank 2 vs Rank 3
      // 2. Final: Rank 1 vs Winner of Eliminator

      const rank1 = qualifiedTeams[0];
      const rank2 = qualifiedTeams[1];
      const rank3 = qualifiedTeams[2];

      await createFixture({
        teamA: rank2.id,
        teamB: rank3.id,
        date: new Date().toISOString().split('T')[0],
        time: '18:00',
        stage: 'playoff',
        matchName: 'Eliminator'
      });

      await createFixture({
        teamA: rank1.id,
        teamB: 'PLACEHOLDER:ELIM:Winner', // Placeholder logic needed in StartMatch/Scorer to resolve or just manual
        date: new Date().toISOString().split('T')[0],
        time: '20:00',
        stage: 'final',
        matchName: 'Final'
      });

      alert("Generated WPL Style Playoffs: Eliminator & Final (Placeholder).");

    } else {
      // Standard Semis
      // 1 vs 4, 2 vs 3
      if (qualifiedTeams.length < 4) { alert("Need 4 teams for Standard Semis"); return; }

      await createFixture({ teamA: qualifiedTeams[0].id, teamB: qualifiedTeams[3].id, date: new Date().toISOString().split('T')[0], time: '18:00', stage: 'semis', matchName: 'Semi Final 1' });
      await createFixture({ teamA: qualifiedTeams[1].id, teamB: qualifiedTeams[2].id, date: new Date().toISOString().split('T')[0], time: '20:00', stage: 'semis', matchName: 'Semi Final 2' });
      alert("Generated Standard Semi Finals.");
    }

    // Update Stage
    updateConfig({ ...config, roadmap: { ...config.roadmap, currentStage: 'playoff' } });
  };

  // --- Sub-Components ---
  const PublicView = () => {
    const [expandedTeamId, setExpandedTeamId] = useState(null);
    const liveMatches = matches.filter(m => m.status === 'live');
    const upcomingMatches = matches.filter(m => m.status === 'scheduled').sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    const finishedMatches = matches.filter(m => m.status === 'finished').sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    // Pass players to AdminDashboard etc but here we use standings which already has squadSize calculated
    // For MatchCardPublic, we might want to show captains later, but for now Squad Size is in Standings.

    return (
      <div className="min-h-screen bg-slate-950 font-sans text-slate-100 pb-20 relative overflow-hidden">
        {/* Dynamic Background */}
        <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-blue-900/30 via-slate-950 to-slate-950 pointer-events-none" />
        <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-[200px] -left-[200px] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

        <style>{`
          @media print {
            @page { margin: 20px; }
            body { background: white; color: black; -webkit-print-color-adjust: exact; }
            nav, button, .no-print { display: none !important; }
            .bg-slate-950 { background: white !important; overflow: visible !important; height: auto !important; }
            .text-white { color: black !important; }
            .text-slate-400 { color: #555 !important; }
            .bg-white\\/5 { background: #fff !important; border: 1px solid #ddd !important; break-inside: avoid; }
            .bg-white\\/10 { background: #eee !important; }
            .absolute { display: none !important; }
            .min-h-screen { min-height: auto !important; height: auto !important; overflow: visible !important; }
            .grid { display: block !important; } 
            .col-span-2 { display: block !important; width: 100% !important; }
            .gap-6 { gap: 10px !important; }
            /* Header Display */
            .print-header { display: block !important; text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .print-header h1 { font-size: 24pt; font-weight: 900; margin: 0; }
            .print-header p { font-size: 12pt; margin: 0; }
            /* Card Tweaks */
            .p-6, .p-8, .md\\:p-12 { padding: 10px !important; margin-bottom: 10px !important; }
            table { width: 100%; border-collapse: collapse; font-size: 10pt; }
            th, td { border: 1px solid #ccc; padding: 4px; color: black !important; }
          }
        `}</style>

        {/* Print Only Header */}
        <div className="print-header hidden text-black">
          <h1>RPL26 Volleyball</h1>
          <p>Official Schedule & Results</p>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
          {/* Live Section */}
          {liveMatches.length > 0 && (
            <section className="mb-12 animate-fade-in text-center no-print">
              <div className="inline-flex items-center gap-3 mb-8 px-6 py-2 bg-red-500/10 rounded-full border border-red-500/20">
                <div className="p-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                  <Activity size={16} className="text-white" />
                </div>
                <h2 className="text-lg font-black uppercase tracking-[0.2em] text-red-400">Live Commentary</h2>
              </div>
              <div className="flex justify-center">
                <div className="w-full max-w-4xl">
                  {liveMatches.map(m => <MatchCardPublic key={m.id} match={m} teams={teams} players={players} config={config} isLiveFeature={true} />)}
                </div>
              </div>
            </section>
          )}

          {/* Tab Navigation */}
          <div className="flex justify-center mb-8 no-print">
            <div className="bg-white/5 backdrop-blur-md p-1 rounded-2xl flex gap-1 border border-white/10">
              {[
                { id: 'standings', label: 'Standings', icon: TrendingUp },
                { id: 'fixtures', label: 'Matches', icon: Calendar },
                { id: 'results', label: 'Results', icon: CheckCircle2 },
                { id: 'roadmap', label: 'Roadmap', icon: Activity } // Using Activity as placeholder for Network/Map
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <tab.icon size={16} /> {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Print Button Replacement */}
          <div className="flex justify-end mb-4 no-print">
            <button onClick={() => {
              const doc = new jsPDF();

              // Header
              doc.setFontSize(22);
              doc.setTextColor(40, 40, 40);
              doc.text(config.tournamentName || 'Tournament Schedule', 14, 20);
              doc.setFontSize(10);
              doc.setTextColor(100, 100, 100);
              doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 28);

              // Data Preparation
              const allMatches = matches.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
              const tableBody = allMatches.map(m => ([
                new Date(m.startTime).toLocaleDateString(),
                m.isTba ? 'TBA' : new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                m.stage || '-',
                `${getTeam(teams, m.teamA).name} vs ${getTeam(teams, m.teamB).name}`,
                m.status === 'finished' ? `${m.setsA}-${m.setsB}` : m.status
              ]));

              autoTable(doc, {
                startY: 35,
                head: [['Date', 'Time', 'Group/Stage', 'Match', 'Result/Status']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: [66, 133, 244], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 247, 250] },
                styles: { fontSize: 9, cellPadding: 3 }
              });

              doc.save('tournament-schedule.pdf');
            }} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold uppercase tracking-wider text-xs border border-white/10 transition-colors">
              <span className="text-lg">📄</span> Download Schedule
            </button>
          </div>

          {/* Content */}
          <div className="min-h-[400px]">
            {activeTab === 'roadmap' && <RoadmapView teams={teams} matches={matches} config={config} standings={standings} />}

            {activeTab === 'fixtures' && (
              <div className="grid md:grid-cols-2 gap-6">
                {upcomingMatches.length === 0 && <div className="col-span-2 text-center text-slate-500 py-12 italic">No upcoming matches scheduled</div>}
                {upcomingMatches.map(m => <MatchCardPublic key={m.id} match={m} teams={teams} players={players} config={config} />)}
              </div>
            )}

            {activeTab === 'results' && (
              <div className="grid md:grid-cols-2 gap-6">
                {finishedMatches.length === 0 && <div className="col-span-2 text-center text-slate-500 py-12 italic">No matches finished yet</div>}
                {finishedMatches.map(m => <MatchCardPublic key={m.id} match={m} teams={teams} players={players} config={config} />)}
              </div>
            )}

            {activeTab === 'standings' && (
              <div className="space-y-8">
                {(() => {
                  const groups = config.tournamentType === 'group'
                    ? [...new Set(standings.map(s => s.group || 'A'))].sort()
                    : ['ALL'];

                  return groups.map(groupName => {
                    const groupStandings = config.tournamentType === 'group'
                      ? standings.all.filter(s => (s.group || 'A') === groupName)
                      : standings.all;

                    return (
                      <GlassCard key={groupName} className="p-0 overflow-x-auto">
                        {config.tournamentType === 'group' && (
                          <div className="p-4 bg-white/5 border-b border-white/10">
                            <h3 className="text-xl font-black text-white uppercase tracking-widest">Group {groupName}</h3>
                          </div>
                        )}
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-white/5 text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-white/10">
                              <th className="p-5">Rank</th>
                              <th className="p-5">Team</th>
                              <th className="p-5 text-center">Played</th>
                              <th className="p-5 text-center">W-L</th>
                              <th className="p-5 text-center hidden sm:table-cell">Set Ratio</th>
                              <th className="p-5 text-center hidden sm:table-cell">Point Ratio</th>
                              <th className="p-5 text-center hidden sm:table-cell">Squad Size</th>
                              <th className="p-5 text-center bg-white/5 text-blue-300">PTS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {groupStandings.length === 0 && <tr><td colSpan="8" className="p-8 text-center text-slate-500 italic">No teams registered</td></tr>}
                            {groupStandings.map((team, idx) => {
                              const isQualified = config.tournamentType === 'group' && idx < (config.roadmap?.qualifiers || 2);
                              return (
                                <React.Fragment key={team.id}>
                                  <tr onClick={() => setExpandedTeamId(expandedTeamId === team.id ? null : team.id)} className={`hover:bg-white/5 transition-colors group cursor-pointer ${isQualified ? 'bg-green-500/5' : ''}`}>
                                    <td className="p-5 font-mono text-slate-500 font-bold w-16">{idx + 1}</td>
                                    <td className="p-5">
                                      <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-lg ${team.color} flex items-center justify-center font-black text-white shadow-lg relative`}>
                                          {team.name[0]}
                                          {isQualified && <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900" title="Qualified" />}
                                        </div>
                                        <div>
                                          <span className="font-bold text-lg text-white group-hover:text-blue-300 transition-colors">{team.name}</span>
                                        </div>
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
                                    <td className="p-5 text-center font-mono text-sm hidden sm:table-cell text-slate-400">
                                      {team.squadSize}
                                    </td>
                                    <td className="p-5 text-center bg-white/5">
                                      <span className="text-2xl font-black text-blue-400">{team.leaguePoints}</span>
                                    </td>
                                  </tr>
                                  {/* Expanded Details */}
                                  {expandedTeamId === team.id && (
                                    <tr className="bg-slate-900/50 animate-fade-in text-sm">
                                      <td colSpan="8" className="p-6 border-b border-white/5">
                                        <div className="grid md:grid-cols-2 gap-8">
                                          <div>
                                            <h4 className="text-slate-400 font-bold uppercase tracking-wider mb-3 text-xs">Recent Results</h4>
                                            <div className="space-y-2">
                                              {matches.filter(m => (m.teamA === team.id || m.teamB === team.id) && m.status === 'finished').length === 0 && <p className="text-slate-600 italic">No finished matches.</p>}
                                              {matches.filter(m => (m.teamA === team.id || m.teamB === team.id) && m.status === 'finished').map(m => {
                                                const isA = m.teamA === team.id;
                                                const opp = isA ? m.teamB : m.teamA;
                                                const win = m.winner === team.id;
                                                return (
                                                  <div key={m.id} className="flex justify-between items-center p-2 bg-slate-950 rounded border border-white/5">
                                                    <span className="text-slate-300">vs <strong className="text-white">{getTeam(teams, opp).name}</strong></span>
                                                    <span className={`font-mono font-bold ${win ? 'text-green-400' : 'text-red-400'}`}>
                                                      {isA ? m.setsA : m.setsB}-{isA ? m.setsB : m.setsA}
                                                    </span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                          <div>
                                            <h4 className="text-slate-400 font-bold uppercase tracking-wider mb-3 text-xs">Upcoming Schedule</h4>
                                            <div className="space-y-2">
                                              {matches.filter(m => (m.teamA === team.id || m.teamB === team.id) && m.status === 'scheduled').length === 0 && <p className="text-slate-600 italic">No upcoming matches.</p>}
                                              {matches.filter(m => (m.teamA === team.id || m.teamB === team.id) && m.status === 'scheduled').map(m => {
                                                const isA = m.teamA === team.id;
                                                const opp = isA ? m.teamB : m.teamA;
                                                return (
                                                  <div key={m.id} className="flex justify-between items-center p-2 bg-slate-950 rounded border border-white/5">
                                                    <span className="text-slate-300">vs <strong className="text-white">{getTeam(teams, opp).name}</strong></span>
                                                    <span className="text-xs text-blue-400 font-bold">
                                                      {new Date(m.startTime).toLocaleDateString()} {new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </GlassCard>
                    );
                  });
                })()}

                {/* SUPER STAGE TABLE API */}
                {config.roadmap?.currentStage !== 'group' && standings.superStage?.length > 0 && (
                  <GlassCard className="p-0 overflow-x-auto border-t-4 border-purple-500">
                    <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
                      <h3 className="text-xl font-black text-white uppercase tracking-widest">{config.roadmap?.superStageName || 'Super Stage'}</h3>
                      <span className="text-xs text-purple-300 font-bold uppercase tracking-wider">Top {config.roadmap?.qualificationCount || 4} Qualify</span>
                    </div>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white/5 text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-white/10">
                          <th className="p-5">Rank</th>
                          <th className="p-5">Team</th>
                          <th className="p-5 text-center">P</th>
                          <th className="p-5 text-center">W/L</th>
                          <th className="p-5 text-center">NRR/Ratio</th>
                          <th className="p-5 text-center text-blue-300">PTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.superStage.map((team, idx) => {
                          const isQualified = idx < (config.roadmap?.qualificationCount || 4);
                          return (
                            <tr key={team.id} className={`border-b border-white/5 ${isQualified ? 'bg-green-500/5' : ''}`}>
                              <td className="p-5 font-mono text-slate-400">{idx + 1}</td>
                              <td className="p-5 font-bold text-white flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${team.color}`} /> {team.name}
                                {isQualified && <CheckCircle2 size={12} className="text-green-500" />}
                              </td>
                              <td className="p-5 text-center text-slate-400">{team.played}</td>
                              <td className="p-5 text-center text-slate-300">{team.won}/{team.lost}</td>
                              <td className="p-5 text-center text-slate-500 text-xs">{team.setRatio.toFixed(2)}</td>
                              <td className="p-5 text-center font-black text-blue-400">{team.leaguePoints}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </GlassCard>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- Router ---
  if (view === 'admin-scorer') return <AdminScorer match={matches.find(m => m.id === scorerMatchId)} teams={teams} config={config} handleScore={handleScore} setView={setView} updateDoc={updateDoc} db={db} appId={appId} />;
  if (view === 'login') return <div className="min-h-screen"><Navigation config={config} view={view} setView={setView} isAdmin={isAdmin} /><LoginView loginInput={loginInput} setLoginInput={setLoginInput} handleAdminLogin={handleAdminLogin} setView={setView} /></div>;

  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        <Navigation config={config} view={view} setView={setView} isAdmin={isAdmin} />
        {view === 'public' ? <PublicView /> :
          <AdminDashboard
            teams={teams} matches={matches} players={players} config={config} updateConfig={updateConfig}
            setIsAdmin={setIsAdmin} setView={setView} adminTab={adminTab} setAdminTab={setAdminTab}
            createFixture={createFixture} startMatch={startMatch} deleteDoc={deleteDoc} addDoc={addDoc} updateDoc={updateDoc} db={db} appId={appId} standings={standings} generatePlayoffs={generatePlayoffs}
          />}
      </div>
    </ErrorBoundary>
  );
}
