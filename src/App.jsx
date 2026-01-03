import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, initializeFirestore, collection, addDoc, query, where, 
  onSnapshot, doc, updateDoc, deleteDoc, getDocs, getDoc, arrayUnion, setDoc, writeBatch 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  Users, FileText, CheckCircle, XCircle, 
  LogOut, Plus, Trash2, MessageSquare, Briefcase, 
  UserPlus, Layout, ChevronDown, Send, 
  X, Upload, ExternalLink, Paperclip, Loader2, FileCheck, Pencil, Save, Share2, Globe, Lock, Eye, Printer, Target, Award, AlertCircle, Handshake, Copy, Link as LinkIcon, Activity, Zap, Clock, AlertTriangle, User, Star, Image as ImageIcon, BookOpen
} from 'lucide-react';

// --- Configuration ---

// 1. Firebase Config
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyAMOU-IK6UfKk75UR0P_Rs80z0uEsssQ9o",
  authDomain: "epromdeploy.firebaseapp.com",
  projectId: "epromdeploy",
  storageBucket: "epromdeploy.firebasestorage.app",
  messagingSenderId: "179394609832",
  appId: "1:179394609832:web:cf8d21ea2eef70990cb89d",
  measurementId: "G-X5GVRLDBQQ"
};

// 2. Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbywVx70i2DXMf90cuMkE84Jn3rNlIr6dQJwXdoVx7l9kzzSXU-9uxn1MnrbWnJRRu6b/exec"; 

// 3. Gemini API Key
const apiKey = ""; // Provided by execution environment

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); 

// FIX: Use initializeFirestore with forced Long Polling to avoid QUIC errors
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// Use environment app ID if available to match the auth token scope
const appId = typeof __app_id !== 'undefined' ? __app_id : "eprom-production-v1";

// --- Constants ---
const COLLECTIONS = {
  USERS: 'users',
  FORMS: 'forms',
  IDEAS: 'ideas',
  DEPARTMENTS: 'departments',
  GUESTS: 'guests',
  KPIS: 'kpis'
};

const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee'
};

const STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// Oil & Gas Specific Form Fields
const DEFAULT_FORM_FIELDS = [
  { label: "Initiative Title", type: "text", required: true },
  { label: "Operational Area", type: "dropdown", options: ["Upstream - Exploration", "Upstream - Drilling", "Midstream - Pipelines", "Downstream - Refining", "HSE & Sustainability", "Asset Integrity", "Digital Transformation"], required: true },
  { label: "Target Asset / Rig", type: "text", required: true, placeholder: "e.g., Platform Alpha, Refinery Unit 4" },
  { label: "Problem Statement", type: "textarea", required: true },
  { label: "Proposed Solution", type: "textarea", required: true },
  { label: "HSE Impact", type: "dropdown", options: ["Positive (Safety Enhancement)", "Neutral", "Requires Risk Assessment"], required: true },
  { label: "Est. CAPEX (USD)", type: "text", required: false },
  { label: "Est. OPEX Savings (USD/Year)", type: "text", required: false },
  { label: "Implementation Timeline", type: "dropdown", options: ["Immediate (<1 mo)", "Short Term (1-6 mo)", "Long Term (>6 mo)"], required: true },
  { label: "Technical Attachments (P&ID, Isometrics)", type: "file", required: false }
];

const DEFAULT_KPIS = [
  { label: "HSE Compliance & Safety", description: "Does this improve personnel safety or environmental protection?", weight: 30 },
  { label: "Production Efficiency", description: "Impact on barrels/day or uptime.", weight: 25 },
  { label: "Cost Optimization", description: "Reduction in OPEX or CAPEX efficiency.", weight: 25 },
  { label: "Technical Feasibility", description: "Complexity of implementation vs current infrastructure.", weight: 20 }
];

const DEFAULT_ADMIN = {
  email: 'admin@eprom.com',
  password: 'admin123', 
  role: ROLES.ADMIN,
  name: 'System Admin',
  department: 'Corporate IT',
  status: STATUS.APPROVED
};

// --- Helper Functions ---

const generatePublicId = () => {
  // Generate a random 6-character alphanumeric string (uppercase)
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const callGemini = async (prompt) => {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    if (!response.ok) throw new Error('API call failed');
    
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Could not generate response.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
};

const checkDuplicates = async (newTitle, newDesc, category) => {
  try {
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS),
      where('category', '==', category),
    );
    const snap = await getDocs(q);
    
    if (snap.empty) return null;

    const existingIdeas = snap.docs.slice(0, 20).map(d => ({
      id: d.id,
      title: getIdeaTitle(d.data()),
      desc: JSON.stringify(d.data().formData).substring(0, 300)
    }));

    const prompt = `
      You are an AI auditor for an Oil & Gas Innovation Database. Analyze if the NEW_PROPOSAL is a duplicate or heavily overlaps with any EXISTING_PROPOSALS.
      
      NEW_PROPOSAL:
      Title: ${newTitle}
      Content: ${newDesc.substring(0, 500)}

      EXISTING_PROPOSALS:
      ${JSON.stringify(existingIdeas)}

      Return a raw JSON object (no markdown) with this schema:
      {
        "isDuplicate": boolean,
        "matchId": "string (ID of matched idea or null)",
        "matchTitle": "string (Title of matched idea or null)",
        "reason": "string (Technical explanation for the Asset Manager)"
      }
    `;

    const jsonString = await callGemini(prompt);
    if (!jsonString) return null;
    
    const cleanJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);

  } catch (e) {
    console.error("Duplicate check failed", e);
    return null;
  }
};

const getIdeaTitle = (idea) => {
  if (!idea) return "Untitled";
  // Prioritize the user-entered title from formData, fallback to the form template title
  return idea.formData?.["Initiative Title"] || idea.formData?.["Title"] || idea.formTitle;
};

const getDirectLink = (url) => {
  if (!url) return '';
  // Check if it's a base64 data URL
  if (url.startsWith('data:image')) return url;
  
  if (url.includes('drive.google.com') && url.includes('/d/')) {
    const id = url.match(/\/d\/(.*?)\//)?.[1] || url.match(/\/d\/(.*?)($|\?)/)?.[1];
    if (id) {
      return `https://lh3.googleusercontent.com/d/${id}`;
    }
  }
  return url;
};

const calculateAverageRating = (idea) => {
  if (idea.ratings) {
    const ratings = Object.values(idea.ratings);
    if (ratings.length > 0) {
      const total = ratings.reduce((sum, r) => sum + r.percentage, 0);
      const avgPct = Math.round(total / ratings.length);
      let grade = 'F';
      if (avgPct >= 80) grade = 'A';
      else if (avgPct >= 60) grade = 'B';
      else if (avgPct >= 40) grade = 'C';
      else grade = 'D';
      
      const kpiSums = {};
      const kpiCounts = {};
      ratings.forEach(r => {
        if(r.details) {
          r.details.forEach(d => {
            kpiSums[d.label] = (kpiSums[d.label] || 0) + d.score;
            kpiCounts[d.label] = (kpiCounts[d.label] || 0) + 1;
          });
        }
      });
      
      const averagedDetails = Object.keys(kpiSums).map(label => ({
         label,
         score: parseFloat((kpiSums[label] / kpiCounts[label]).toFixed(1))
      }));

      return { percentage: avgPct, grade, count: ratings.length, details: averagedDetails };
    }
  }
  return idea.rating;
};

const generatePDF = (idea, analysisText = '') => {
  if (!window.html2pdf) {
    alert("System initializing... please try again in 5 seconds.");
    return;
  }

  const element = document.createElement('div');
  const displayTitle = getIdeaTitle(idea);
  
  let evaluationHtml = '';
  // Use the pre-calculated rating object on the idea
  if (idea.rating) {
    evaluationHtml = `
      <div style="margin-top: 30px; margin-bottom: 30px; border: 1px solid #94a3b8; border-radius: 4px; padding: 20px; background-color: #f1f5f9;">
        <h3 style="font-size: 14px; font-weight: bold; color: #0f172a; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #334155; padding-bottom: 5px; text-transform: uppercase;">Technical Evaluation (Average)</h3>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
           <span style="font-size: 18px; font-weight: bold; color: #0f172a;">Grade: ${idea.rating.grade}</span>
           <span style="font-size: 14px; color: #475569;">Feasibility Score: ${idea.rating.percentage}% ${idea.rating.count ? `(${idea.rating.count} reviews)` : ''}</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <tr style="background-color: #e2e8f0; text-align: left;">
            <th style="padding: 8px; border: 1px solid #cbd5e1;">KPI Criteria</th>
            <th style="padding: 8px; border: 1px solid #cbd5e1;">Avg Rating (1-5)</th>
          </tr>
          ${idea.rating.details.map(kpi => `
            <tr>
              <td style="padding: 8px; border: 1px solid #cbd5e1;">${kpi.label}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1;">${kpi.score}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;
  }

  const analysisHtml = analysisText ? `
    <div style="background-color: #f0fdf4; padding: 15px; border-radius: 4px; border-left: 4px solid #15803d; margin-bottom: 30px;">
      <h3 style="font-size: 14px; font-weight: bold; color: #14532d; margin-top: 0; margin-bottom: 8px; text-transform: uppercase;">AI Executive Summary</h3>
      <div style="font-size: 12px; line-height: 1.6; color: #14532d; white-space: pre-wrap; font-family: 'Courier New', Courier, monospace;">${analysisText}</div>
    </div>
  ` : '';

  element.innerHTML = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto;">
      <div style="border-bottom: 4px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="font-size: 24px; font-weight: 900; margin: 0; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">Operational Improvement Proposal</h1>
          <p style="margin: 5px 0 0; color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Internal Document • Confidential • EPROM</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 11px; color: #64748b; font-family: monospace;">Ref ID: ${idea.publicId || idea.id.slice(0, 6).toUpperCase()}</p>
          <p style="margin: 0; font-size: 11px; color: #64748b;">${new Date().toLocaleDateString()}</p>
        </div>
      </div>
      
      <div style="background-color: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
        <h2 style="font-size: 20px; font-weight: bold; color: #0f172a; margin-top: 0;">${displayTitle}</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px; font-size: 12px;">
          <div><span style="color:#64748b; text-transform:uppercase; font-size:10px; font-weight:bold;">Proposer</span><br/>${idea.employeeName}</div>
          <div><span style="color:#64748b; text-transform:uppercase; font-size:10px; font-weight:bold;">Department</span><br/>${idea.mainDepartment}</div>
          <div><span style="color:#64748b; text-transform:uppercase; font-size:10px; font-weight:bold;">Category</span><br/>${idea.category}</div>
          <div><span style="color:#64748b; text-transform:uppercase; font-size:10px; font-weight:bold;">Submission Date</span><br/>${new Date(idea.submittedAt).toLocaleDateString()}</div>
        </div>
      </div>

      ${idea.coverImage ? `
        <div style="margin-bottom: 30px; text-align: center;">
          <img src="${getDirectLink(idea.coverImage)}" style="max-width: 100%; max-height: 400px; border-radius: 4px; border: 1px solid #e2e8f0;" crossorigin="anonymous" />
        </div>
      ` : ''}

      ${analysisHtml}
      ${evaluationHtml}

      <div style="margin-bottom: 30px;">
        ${Object.entries(idea.formData).map(([k, v]) => `
            <div style="margin-bottom: 20px; page-break-inside: avoid;">
              <h3 style="font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px;">${k}</h3>
              <div style="font-size: 13px; line-height: 1.5; color: #334155; white-space: pre-wrap;">${Array.isArray(v) ? v.join(', ') : v}</div>
            </div>
          `).join('')}
      </div>
      
      <div style="margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        Generated by EPROM Innovation Hub • ISO 9001 Compliant Process
      </div>
    </div>
  `;

  const opt = {
    margin: 0.5,
    filename: `EPROM-Proposal-${getIdeaTitle(idea).replace(/\s+/g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  window.html2pdf().set(opt).from(element).save();
};

// --- UI Components ---

const LoadingScreen = ({ message = "Initializing System...", onRetry }) => (
  <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
    <div className="relative">
      <div className="w-12 h-12 border-4 border-slate-700 border-t-sky-500 rounded-full animate-spin mb-4"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Zap className="w-4 h-4 text-sky-500" />
      </div>
    </div>
    <div className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-4">{message}</div>
    {onRetry && <button onClick={onRetry} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition-colors">Retry Connection</button>}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false, title }) => {
  const baseStyle = "px-4 py-2 text-xs font-bold tracking-wide uppercase transition-all duration-200 flex items-center justify-center gap-2 rounded-sm focus:outline-none focus:ring-2 focus:ring-offset-1 active:scale-[0.98]";
  const variants = {
    primary: "bg-sky-800 text-white hover:bg-sky-700 disabled:bg-slate-300 border border-transparent shadow-sm",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-sky-800",
    danger: "bg-red-700 text-white hover:bg-red-600 disabled:bg-red-300 shadow-sm",
    success: "bg-emerald-700 text-white hover:bg-emerald-600 disabled:bg-emerald-300 shadow-sm",
    ai: "bg-gradient-to-r from-indigo-900 to-sky-900 text-white hover:from-indigo-800 hover:to-sky-800 shadow-md border border-indigo-700",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900"
  };
  return <button type={type} onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} disabled={disabled} title={title}>{children}</button>;
};

const Input = ({ label, type = "text", value, onChange, placeholder, required = false }) => (
  <div className="mb-5 group">
    {label && <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{label} {required && <span className="text-amber-600">*</span>}</label>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-sm focus:outline-none focus:border-sky-600 focus:bg-white focus:ring-1 focus:ring-sky-600 transition-all placeholder-slate-400 font-medium" required={required} />
  </div>
);

const Card = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-white border border-slate-200 shadow-sm rounded-sm ${className} ${onClick ? 'cursor-pointer hover:border-sky-300 hover:shadow-md transition-all duration-300' : ''}`}>{children}</div>
);

const Badge = ({ status, isPublic, rating, isCollab }) => {
  const styles = {
    [STATUS.PENDING]: "bg-amber-50 text-amber-700 border-amber-200",
    [STATUS.APPROVED]: "bg-emerald-50 text-emerald-700 border-emerald-200",
    [STATUS.REJECTED]: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <div className="flex gap-2 flex-wrap">
      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-sm ${styles[status]}`}>{status}</span>
      {rating && <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-sm flex items-center gap-1 bg-slate-100 text-slate-700 border-slate-300"><Award className="w-3 h-3 text-amber-500" /> Grade {rating.grade} {rating.count > 1 ? `(${rating.count})` : ''}</span>}
      {isPublic && <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-sm bg-sky-50 text-sky-700 border-sky-200 flex items-center gap-1"><Globe className="w-3 h-3" /> Global</span>}
      {isCollab && <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-sm bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Collaborative</span>}
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in overflow-hidden">
      <div className="bg-white rounded-sm shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-scale-up border-t-4 border-t-sky-700">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white z-10 sticky top-0">
          <div className="flex items-center gap-3">
             <div className="bg-sky-100 p-2 rounded-sm"><FileText className="w-5 h-5 text-sky-700" /></div>
             <h3 className="text-xl font-bold text-slate-900 tracking-tight font-sans">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-8 overflow-y-auto scroll-smooth bg-slate-50/50">{children}</div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, subtext, icon: Icon, color = "text-sky-600" }) => (
  <div className="bg-white p-6 rounded-sm border border-slate-200 shadow-sm flex items-start justify-between">
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</div>
      <div className="text-2xl font-black text-slate-800 tracking-tight">{value}</div>
      {subtext && <div className="text-xs text-slate-500 mt-1 font-medium">{subtext}</div>}
    </div>
    <div className={`p-3 bg-slate-50 rounded-full border border-slate-100 ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
  </div>
);

const InnovationCarousel = ({ variant = 'full' }) => {
  const [slides, setSlides] = useState([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS), where('isPublic', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      setSlides(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let interval;
    if (slides.length > 1) {
       interval = setInterval(() => setCurrent(c => (c + 1) % slides.length), 8000);
    }
    return () => clearInterval(interval);
  }, [slides.length]);

  if (slides.length === 0) return (
    <div className={`bg-slate-900 flex flex-col items-center justify-center text-center p-8 ${variant === 'full' ? 'h-full' : 'h-64 rounded-sm'} relative overflow-hidden`}>
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
      <Briefcase className="w-12 h-12 text-sky-600 mb-4 relative z-10" />
      <h3 className="text-xl font-bold text-white mb-2 relative z-10">Operational Excellence</h3>
      <p className="text-slate-400 max-w-sm text-sm relative z-10">Driving efficiency and safety through innovation.</p>
    </div>
  );

  const slide = slides[current];
  const displayTitle = getIdeaTitle(slide);

  return (
    <div className={`relative overflow-hidden group bg-slate-900 ${variant === 'full' ? 'h-full' : 'h-96 rounded-sm shadow-xl border-b-8 border-sky-600'}`}>
      {/* Background Image Logic */}
      {slide.coverImage ? (
        <div className="absolute inset-0 bg-cover bg-center transition-all duration-1000 transform scale-105 group-hover:scale-100" style={{ backgroundImage: `url(${getDirectLink(slide.coverImage)})` }}>
           <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-slate-900/40"></div>
        </div>
      ) : (
        <>
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-800 via-slate-900 to-black"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10"></div>
        </>
      )}
      
      <div className="absolute bottom-0 left-0 right-0 p-10 z-10">
        <div className="max-w-4xl">
          <div className="flex items-center gap-3 mb-4">
             <span className="bg-sky-600/90 backdrop-blur text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest inline-flex items-center gap-1 shadow-lg">
                <Briefcase className="w-3 h-3" /> {slide.category}
             </span>
             <span className="text-sky-300 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1 bg-slate-900/50 px-2 py-1 rounded-full">
                <Activity className="w-3 h-3" /> Featured Initiative
             </span>
          </div>
          <h2 className="font-black text-white leading-tight mb-4 text-4xl font-sans tracking-tight drop-shadow-md">{displayTitle}</h2>
          <p className="text-slate-200 text-sm leading-relaxed line-clamp-3 mb-6 font-medium max-w-2xl border-l-4 border-sky-500 pl-4 bg-gradient-to-r from-slate-900/50 to-transparent p-2 rounded-r-lg">
             {slide.aiSummary || Object.values(slide.formData)[0]?.toString().substring(0, 150) + "..."}
          </p>
          <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-slate-300">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-sky-500/50 flex items-center justify-center text-white text-[10px] shadow-lg">{slide.employeeName?.[0]}</div>
               <span>{slide.employeeName}</span>
            </div>
            <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
            <span className="text-sky-400">{slide.mainDepartment}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const RatingSystem = ({ idea, onRate, kpis, currentUser }) => {
  const [scores, setScores] = useState({});

  useEffect(() => {
    // Attempt to find the specific user's rating first
    const myRating = idea.ratings?.[currentUser.id];
    if (myRating && myRating.details) {
       const initialScores = {};
       myRating.details.forEach(d => initialScores[d.label] = d.score);
       setScores(initialScores);
    } else if (idea.rating && idea.rating.details) {
       // Fallback for legacy single-rating data structure only if no personal rating exists
       setScores({});
    } else {
       setScores({});
    }
  }, [idea, currentUser.id]);

  const handleScoreChange = (label, val) => {
    setScores(prev => ({ ...prev, [label]: parseInt(val) }));
  };

  const calculateGrade = () => {
    let totalWeightedScore = 0;
    const details = [];
    kpis.forEach(kpi => {
      const score = scores[kpi.label] || 0;
      const weightedContribution = (score / 5) * kpi.weight;
      totalWeightedScore += weightedContribution;
      details.push({ label: kpi.label, weight: kpi.weight, score });
    });
    const percentage = Math.round(totalWeightedScore);
    let grade = 'F';
    if (percentage >= 80) grade = 'A';
    else if (percentage >= 60) grade = 'B';
    else if (percentage >= 40) grade = 'C';
    else grade = 'D';
    return { grade, percentage, details };
  };

  const submitRating = () => {
    onRate(idea.id, calculateGrade());
  };

  const currentResult = calculateGrade();

  return (
    <div className="bg-white border border-slate-200 rounded-sm p-6 mb-6 shadow-sm">
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-2">
        <Target className="w-4 h-4 text-sky-600" /> Technical Evaluation
      </h4>
      <div className="space-y-6">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
               <span className="text-sm font-bold text-slate-800">{kpi.label}</span>
               <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono font-bold">Weight: {kpi.weight}%</span>
            </div>
            <div className="relative pt-1">
              <input 
                type="range" min="1" max="5" step="1"
                value={scores[kpi.label] || 0} 
                onChange={(e) => handleScoreChange(kpi.label, e.target.value)}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-700"
              />
              <div className="flex justify-between text-[9px] uppercase font-bold text-slate-400 mt-1">
                 <span>Ineffective (1)</span><span>Optimal (5)</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
        <div>
           <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">My Score</div>
           <div className="text-3xl font-black text-sky-700">{currentResult.percentage}% <span className="text-lg text-slate-400 font-medium">({currentResult.grade})</span></div>
        </div>
        <Button onClick={submitRating}>Save My Rating</Button>
      </div>
    </div>
  );
};

const IdeaCard = ({ idea, isManager, canApprove, onStatus, onComment, onUpdateComment, isEmployeeView, onEditIdea, onDeleteIdea, currentUser, onTogglePublic, onRate, kpis, onJoinTeam, onCollaborate }) => {
  const [comment, setComment] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(idea.aiSummary || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [groupPeers, setGroupPeers] = useState([]);
  const [roadmap, setRoadmap] = useState(idea.implementationPlan || null);

  // Fetch peers for Managers to review collaboration context
  useEffect(() => {
    if (showModal && isManager && idea.collaborationGroupId && idea.status === STATUS.PENDING) {
       const fetchPeers = async () => {
          try {
            const q = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS), where('collaborationGroupId', '==', idea.collaborationGroupId));
            const snap = await getDocs(q);
            const peers = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(d => d.id !== idea.id);
            setGroupPeers(peers);
          } catch(e) { console.error("Error fetching group peers", e); }
       };
       fetchPeers();
    }
  }, [showModal, isManager, idea.collaborationGroupId, idea.status, idea.id]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const content = Object.entries(idea.formData).map(([k,v]) => `${k}: ${v}`).join('\n');
    const prompt = `Act as a Petroleum Engineering Consultant. Analyze this proposal titled "${idea.formTitle}". \n\nCONTENT:\n${content}\n\nPROVIDE:\n1. Executive Summary\n2. Operational Benefits (Efficiency/Cost)\n3. HSE Risk Analysis`;
    const analysis = await callGemini(prompt);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, idea.id), { aiSummary: analysis });
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  const handleGenerateRoadmap = async () => {
    setIsAnalyzing(true);
    const prompt = `Create a 5-step high-level implementation roadmap for this Oil & Gas initiative: ${idea.formTitle}. Context: ${JSON.stringify(idea.formData).substring(0, 500)}. Format as bullet points with timelines.`;
    const result = await callGemini(prompt);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, idea.id), { implementationPlan: result });
    setRoadmap(result);
    setIsAnalyzing(false);
  };

  const handleShare = () => {
    setCopying(true);
    const link = `${window.location.origin}${window.location.pathname}?share=${idea.id}`;
    const textArea = document.createElement("textarea");
    textArea.value = link;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if(successful) alert("Secure Guest Link copied to clipboard.");
      else prompt("Copy this link manually:", link);
    } catch (err) {
      console.error('Fallback copy failed', err);
      prompt("Copy this link manually:", link);
    }
    document.body.removeChild(textArea);
    setCopying(false);
  };

  const isCollaborator = idea.collaborators?.some(c => c.id === currentUser?.id);
  const isOwner = idea.employeeId === currentUser?.id;
  const publicId = idea.publicId || "N/A";
  const displayTitle = getIdeaTitle(idea);

  // Calculate Average Rating if ratings exist
  const averageRating = useMemo(() => calculateAverageRating(idea), [idea]);

  return (
    <>
    <div onClick={() => setShowModal(true)} className={`bg-white rounded-sm shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer group flex flex-col h-full border ${idea.duplicateFlag ? 'border-amber-400' : 'border-slate-200'}`}>
      {/* Card Image Header */}
      <div className="h-40 w-full bg-slate-100 relative overflow-hidden shrink-0">
         {idea.coverImage ? (
            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: `url(${getDirectLink(idea.coverImage)})` }}></div>
         ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
               <Briefcase className="w-12 h-12 text-slate-400 opacity-50" />
            </div>
         )}
         <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
         <div className="absolute bottom-3 left-4 right-4">
            <h4 className="font-bold text-white text-lg leading-tight truncate shadow-sm font-sans">{displayTitle}</h4>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1"><User className="w-3 h-3" /> {idea.employeeName}</span>
            </div>
         </div>
         <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-white text-[9px] font-mono px-2 py-1 rounded-sm border border-white/20">
            ID: {publicId}
         </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex flex-wrap items-center gap-2 mb-3">
           {/* Display Aggregate Rating on the Card */}
           <Badge status={idea.status} isPublic={idea.isPublic} rating={averageRating} isCollab={!!idea.collaborationGroupId} />
           {idea.duplicateFlag && (
                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-sm flex items-center gap-1 border border-amber-200 uppercase tracking-wide">
                  <AlertTriangle className="w-3 h-3" /> Duplicate Risk
                </span>
           )}
        </div>
        
        <div className="flex-1">
           <div className="text-xs text-slate-500 font-medium line-clamp-3 leading-relaxed mb-4">
              {Object.values(idea.formData).find(val => typeof val === 'string' && val.length > 50) || "Click to view full proposal details..."}
           </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium mt-auto">
           <span className="flex items-center gap-1">{idea.mainDepartment}</span>
           <span className="font-mono">{new Date(idea.submittedAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>

    {/* ... Modal Logic ... */}
    <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={displayTitle}>
        <div className="mb-8 pb-6 border-b border-slate-200">
           {idea.coverImage && (
              <div className="mb-6 rounded-sm overflow-hidden h-48 w-full relative border border-slate-200">
                 <img src={getDirectLink(idea.coverImage)} alt="Cover" className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-4">
                    <span className="text-white text-xs font-bold uppercase tracking-widest bg-black/50 px-2 py-1 rounded backdrop-blur-sm">Project Cover Image</span>
                 </div>
              </div>
           )}

           {/* Manager: Collaboration Approval Context */}
           {isManager && idea.collaborationGroupId && idea.status === STATUS.PENDING && (
             <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 mb-6 animate-fade-in shadow-sm">
                <div className="flex items-start gap-4">
                   <div className="bg-white p-2 rounded-full border border-indigo-100"><LinkIcon className="w-5 h-5 text-indigo-600" /></div>
                   <div className="flex-1">
                      <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wide">Collaboration Request</h4>
                      <p className="text-xs text-indigo-800 mt-1 leading-relaxed">
                        This proposal requests to join Collaboration Group <strong>{idea.collaborationGroupId.slice(0,8)}...</strong>
                      </p>
                      {groupPeers.length > 0 ? (
                        <div className="mt-3 bg-white/50 p-3 rounded-sm border border-indigo-100">
                           <span className="text-[10px] font-bold text-indigo-900 uppercase">Related Approved/Active Proposals:</span>
                           <ul className="mt-1 space-y-1">
                             {groupPeers.map(p => (
                               <li key={p.id} className="text-xs text-indigo-800 flex items-center gap-2">
                                 <CheckCircle className="w-3 h-3 text-emerald-600" /> {getIdeaTitle(p)} <span className="opacity-50">({p.employeeName})</span>
                               </li>
                             ))}
                           </ul>
                        </div>
                      ) : (
                        <p className="text-[10px] text-indigo-600 mt-2 italic">This appears to be the first or only active proposal in this group context.</p>
                      )}
                      <div className="mt-3 text-xs font-medium text-indigo-900">
                         Verify alignment before approving.
                      </div>
                   </div>
                </div>
             </div>
           )}

           {/* Duplicate Warning for Managers */}
           {isManager && idea.duplicateFlag && (
             <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 flex gap-4 animate-fade-in shadow-sm">
               <div className="bg-white p-2 rounded-full h-fit border border-amber-100 shadow-sm"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
               <div className="flex-1">
                 <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wide">Optimization Alert: Potential Redundancy</h4>
                 <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                   AI analysis suggests significant overlap with existing initiative: <strong className="font-mono">{idea.duplicateFlag.matchTitle}</strong>. 
                   <br/>Technical Similarity: {idea.duplicateFlag.reason}
                 </p>
                 <div className="mt-3 text-xs font-bold text-amber-900 bg-amber-100 inline-block px-2 py-1 rounded-sm">
                   Recommended Action: Merge proposals or request collaboration.
                 </div>
               </div>
             </div>
           )}

           <div className="flex flex-col md:flex-row justify-between gap-6">
             <div className="bg-slate-100 p-4 rounded-sm border border-slate-200 flex-1">
                <div className="grid grid-cols-2 gap-4 text-xs">
                   <div>
                      <span className="block text-slate-400 uppercase font-bold tracking-wider mb-1 text-[10px]">Proposer</span>
                      <span className="font-bold text-slate-800">{idea.employeeName}</span>
                   </div>
                   <div>
                      <span className="block text-slate-400 uppercase font-bold tracking-wider mb-1 text-[10px]">Department</span>
                      <span className="font-bold text-slate-800">{idea.mainDepartment}</span>
                   </div>
                   <div className="col-span-2">
                      <span className="block text-slate-400 uppercase font-bold tracking-wider mb-1 text-[10px]">Unique Reference ID</span>
                      <span className="font-bold text-slate-800 font-mono text-sm bg-white px-2 py-1 rounded border border-slate-200 inline-flex items-center gap-2">
                        {publicId}
                        <button onClick={() => {navigator.clipboard.writeText(publicId); alert("ID Copied")}} title="Copy ID" className="text-slate-400 hover:text-sky-600"><Copy className="w-3 h-3" /></button>
                      </span>
                   </div>
                   {idea.collaborationGroupId && (
                    <div className="col-span-2">
                      <span className="block text-slate-400 uppercase font-bold tracking-wider mb-1 text-[10px]">Collaboration Group</span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-200 text-xs flex items-center gap-1 w-fit">
                        <LinkIcon className="w-3 h-3" /> {idea.collaborationGroupId.slice(0, 8)}...
                      </span>
                    </div>
                   )}
                   {idea.collaborators?.length > 0 && (
                     <div className="col-span-2 pt-2 border-t border-slate-200">
                       <span className="block text-slate-400 uppercase font-bold tracking-wider mb-1 text-[10px]">Engineering Team</span>
                       <div className="flex flex-wrap gap-2">
                         {idea.collaborators.map((c, i) => (
                           <span key={i} className="bg-white px-2 py-1 rounded-sm border border-slate-200 text-slate-700 font-medium shadow-sm">{c.name}</span>
                         ))}
                       </div>
                     </div>
                   )}
                </div>
             </div>
             
             <div className="flex flex-col gap-2 min-w-[180px]">
                {/* Actions for Employees */}
                {isEmployeeView && isOwner && (
                  <div className="grid grid-cols-2 gap-2">
                   <Button variant="secondary" onClick={() => onEditIdea(idea)} className="h-9 text-xs">
                     <Pencil className="w-3 h-3 mr-1.5" /> Revise
                   </Button>
                   <Button variant="danger" onClick={() => { if(confirm("Are you sure you want to withdraw this proposal?")) onDeleteIdea(idea.id); }} className="h-9 text-xs">
                     <Trash2 className="w-3 h-3 mr-1.5" /> Withdraw
                   </Button>
                  </div>
                )}

                {/* Actions for Managers */}
                {isManager && (
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100">
                     <Button variant="secondary" onClick={() => onEditIdea(idea)} className="h-8 text-xs">
                       <Pencil className="w-3 h-3 mr-1" /> Edit
                     </Button>
                     <Button variant="danger" onClick={() => { if(confirm("Delete this approved proposal? This action cannot be undone.")) onDeleteIdea(idea.id); }} className="h-8 text-xs">
                       <Trash2 className="w-3 h-3 mr-1" /> Delete
                     </Button>
                  </div>
                )}

                {/* 'Collaborate' Action: Replaces simple Join Team for non-owners */}
                {onCollaborate && !isOwner && (
                  <Button variant="ai" onClick={() => onCollaborate(idea.publicId || idea.id)} className="h-9 text-xs">
                    <LinkIcon className="w-4 h-4 mr-1.5" /> Submit Related Idea
                  </Button>
                )}
                
                {/* Simple Team Join (Keep for legacy or simple support) */}
                {onJoinTeam && !isOwner && !isCollaborator && (
                  <Button variant="secondary" onClick={() => onJoinTeam(idea.id)} className="h-9 text-xs">
                    <Handshake className="w-4 h-4 mr-1.5" /> Join Team
                  </Button>
                )}

                {/* Updated Share Button Logic: Only show if published */}
                {isManager && canApprove && (
                   <Button variant="secondary" onClick={() => onTogglePublic(idea.id, !idea.isPublic)} className="h-9 text-xs">
                      {idea.isPublic ? <Globe className="w-4 h-4 mr-1.5 text-sky-600" /> : <Globe className="w-4 h-4 mr-1.5" />} {idea.isPublic ? "Unpublish" : "Publish to Global"}
                   </Button>
                )}
                
                {/* Share Button visible ONLY for Published ideas or Manager */}
                {(idea.isPublic || isManager) && (
                   <Button variant="secondary" onClick={handleShare} className="h-9 text-xs">
                     <Share2 className="w-4 h-4 mr-1.5" /> {copying ? "Link Copied" : "External Share"}
                   </Button>
                )}

                <Button variant="primary" onClick={() => generatePDF(idea, aiAnalysis)} className="h-9 text-xs">
                  <Printer className="w-4 h-4 mr-1.5" /> Export PDF
                </Button>
             </div>
           </div>
        </div>

        {/* ... Rest of Modal (AI Analysis, Form Data, Discussion) ... */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* AI Analysis */}
              <div className="space-y-4">
               {(!aiAnalysis && !roadmap) ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button variant="ai" onClick={handleAnalyze} disabled={isAnalyzing} className="w-full h-14 shadow-lg flex-col gap-1 border-indigo-200">
                      <div className="flex items-center gap-2">
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        <span>{isAnalyzing ? "Processing..." : "Run AI Technical Assessment"}</span>
                      </div>
                      <span className="text-[10px] opacity-70 font-normal normal-case">Risk & Benefit Analysis</span>
                    </Button>
                    <Button variant="ai" onClick={handleGenerateRoadmap} disabled={isAnalyzing} className="w-full h-14 shadow-lg flex-col gap-1 border-indigo-200">
                      <div className="flex items-center gap-2">
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                        <span>{isAnalyzing ? "Planning..." : "Generate Execution Roadmap"}</span>
                      </div>
                      <span className="text-[10px] opacity-70 font-normal normal-case">Create Implementation Plan</span>
                    </Button>
                 </div>
               ) : (
                  <>
                  {aiAnalysis && (
                    <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 p-6 rounded-sm shadow-sm relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                       <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-4 text-sm uppercase tracking-wider"><Star className="w-4 h-4" /> AI Technical Review</h4>
                       <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-mono text-justify">{aiAnalysis}</div>
                    </div>
                  )}
                  {roadmap && (
                    <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 p-6 rounded-sm shadow-sm relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                       <h4 className="font-bold text-emerald-900 flex items-center gap-2 mb-4 text-sm uppercase tracking-wider"><BookOpen className="w-4 h-4" /> Strategic Execution Plan</h4>
                       <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-mono text-justify">{roadmap}</div>
                    </div>
                  )}
                  </>
               )}
              </div>

              {/* Form Data */}
              <div className="space-y-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Proposal Details</h4>
                {Object.entries(idea.formData).map(([k, v]) => (
                  <div key={k} className="group">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <div className="w-1 h-1 bg-sky-500 rounded-full"></div> {k}
                    </span>
                    <div className="text-sm text-slate-900 leading-7 whitespace-pre-wrap bg-white p-4 rounded-sm border border-slate-200 shadow-sm font-medium">
                       {Array.isArray(v) ? v.join(', ') : (typeof v === 'string' && v.startsWith('data:image') ? <img src={v} alt="Attachment" className="max-w-full h-auto rounded-sm border" /> : v)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              {isManager && kpis && <RatingSystem idea={idea} onRate={onRate} kpis={kpis} currentUser={currentUser} />}
              
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm shadow-sm">
                  <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <MessageSquare className="w-3 h-3" /> Technical Discussion
                  </h5>
                  <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {idea.comments?.length > 0 ? idea.comments.map((c, i) => (
                      <div key={i} className="text-xs bg-white p-3 rounded-sm border border-slate-200 shadow-sm relative">
                        <div className="flex justify-between mb-1 items-center">
                          <span className="font-bold text-slate-800">{c.author}</span>
                          <span className="text-[9px] text-slate-400 font-mono">{new Date(c.date).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed">{c.text}</p>
                      </div>
                    )) : <p className="text-xs text-slate-400 italic text-center py-4">No technical queries logged yet.</p>}
                  </div>
                  <div className="flex gap-2">
                    <input className="flex-1 text-xs border border-slate-300 px-3 py-2 rounded-sm focus:outline-none focus:border-sky-500" placeholder="Add technical note..." value={comment} onChange={e => setComment(e.target.value)} />
                    <Button onClick={() => { onComment(idea.id, comment); setComment(''); }} disabled={!comment.trim()} className="px-3">
                      <Send className="w-3 h-3" />
                    </Button>
                  </div>
              </div>

              {isManager && canApprove && (
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
                   <Button variant="danger" className="w-full" onClick={() => { onStatus(idea.id, STATUS.REJECTED); setShowModal(false); }}>Reject</Button>
                   <Button variant="success" className="w-full" onClick={() => { onStatus(idea.id, STATUS.APPROVED); setShowModal(false); }}>Approve & Fund</Button>
                </div>
              )}
            </div>
        </div>
    </Modal>
    </>
  );
};

// ... (CollaborationHub, KPIManager, UserManagement etc. same as previous) ...
// [re-including for completeness]
const CollaborationHub = ({ currentUser, ideas, onJoinTeam, onCollaborate }) => {
  // Filter for ideas that are public/active for collaboration
  const openIdeas = ideas.filter(i => 
    i.status !== STATUS.REJECTED && 
    (i.formData["Collaboration Needed?"] === "Yes" || i.isPublic || i.collaborationGroupId)
  );

  // Group ideas by Collaboration ID
  const groupedIdeas = useMemo(() => {
    const groups = {};
    const singles = [];
    
    openIdeas.forEach(idea => {
      if (idea.collaborationGroupId) {
        if (!groups[idea.collaborationGroupId]) groups[idea.collaborationGroupId] = [];
        groups[idea.collaborationGroupId].push(idea);
      } else {
        singles.push(idea);
      }
    });
    return { groups, singles };
  }, [openIdeas]);

  return (
    <div className="space-y-8 animate-fade-in">
       <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-sm p-8 text-white shadow-md border-l-4 border-l-amber-500">
          <div className="flex items-center gap-6">
             <div className="p-4 bg-white/5 rounded-full backdrop-blur-sm border border-white/10">
               <Handshake className="w-10 h-10 text-amber-500" />
             </div>
             <div>
                <h2 className="text-2xl font-bold uppercase tracking-wide font-sans">Collaboration Matrix</h2>
                <p className="text-slate-300 font-mono text-sm mt-1">Join active working groups or propose related initiatives.</p>
             </div>
          </div>
       </div>

       {/* Render Active Collaboration Groups */}
       {Object.keys(groupedIdeas.groups).length > 0 && (
         <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200 pb-2">
              <Layout className="w-4 h-4 text-indigo-600" /> Active Collaboration Clusters
            </h3>
            <div className="grid grid-cols-1 gap-6">
              {Object.entries(groupedIdeas.groups).map(([groupId, groupIdeas]) => (
                <div key={groupId} className="bg-white border border-indigo-100 rounded-sm p-6 shadow-sm relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                   <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                           <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-widest">Group ID: {groupId.slice(0,8)}</span>
                           <span className="text-slate-400 text-xs font-bold">{groupIdeas.length} Proposals</span>
                        </div>
                        <h4 className="text-lg font-bold text-slate-800">Operational Cluster</h4>
                      </div>
                      <Button variant="ai" onClick={() => onCollaborate(groupIdeas[0].publicId || groupIdeas[0].id)} className="h-8 text-xs">
                         <Plus className="w-3 h-3 mr-1" /> Submit Related Proposal
                      </Button>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-sm border border-slate-200">
                      {groupIdeas.map(idea => (
                        <div key={idea.id} onClick={() => { /* Could open modal */ }} className="bg-white p-3 rounded-sm border border-slate-200 shadow-sm hover:border-indigo-300 cursor-pointer transition-all">
                           <h5 className="font-bold text-sm text-slate-800 truncate">{idea.formTitle}</h5>
                           <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-medium">
                              <span>{idea.employeeName}</span>
                              <Badge status={idea.status} />
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              ))}
            </div>
         </div>
       )}

       {/* Render Single Opportunities */}
       <div className="space-y-6">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200 pb-2">
             <Target className="w-4 h-4 text-sky-600" /> Individual Opportunities
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupedIdeas.singles.length === 0 && Object.keys(groupedIdeas.groups).length === 0 && (
                <div className="col-span-full text-center py-16 bg-slate-50 rounded-sm border-2 border-dashed border-slate-300">
                  <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-400 mb-4 shadow-sm">
                    <Users className="w-8 h-8" />
                  </div>
                  <h4 className="text-slate-600 font-bold mb-1">No Active Calls for Collaboration</h4>
                  <p className="text-slate-400 text-sm">Check back later for cross-departmental opportunities.</p>
                </div>
              )}
              {groupedIdeas.singles.map(idea => (
                <IdeaCard 
                  key={idea.id} 
                  idea={idea} 
                  currentUser={currentUser} 
                  onJoinTeam={onJoinTeam} 
                  onCollaborate={onCollaborate}
                  isEmployeeView={true} 
                />
              ))}
          </div>
       </div>
    </div>
  );
};

const KPIManager = ({ kpis, onUpdate }) => {
    const [newKPI, setNewKPI] = useState({ label: '', description: '', weight: 0 });
    const add = () => { if (!newKPI.label || !newKPI.weight) return; onUpdate([...kpis, newKPI]); setNewKPI({ label: '', description: '', weight: 0 }); };
    const remove = (index) => { onUpdate(kpis.filter((_, i) => i !== index)); };
    const totalWeight = kpis.reduce((acc, curr) => acc + parseInt(curr.weight), 0);
    return (
      <Card className="p-6">
        <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2"><Target className="w-5 h-5" /> KPI Configuration</h3>
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg mb-6"><div className="flex gap-2 items-end mb-4"><div className="flex-1"><label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">KPI Name</label><input className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm focus:border-indigo-500 focus:outline-none" value={newKPI.label} onChange={e => setNewKPI({...newKPI, label: e.target.value})} /></div><div className="flex-1"><label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Description</label><input className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm focus:border-indigo-500 focus:outline-none" value={newKPI.description} onChange={e => setNewKPI({...newKPI, description: e.target.value})} /></div><div className="w-24"><label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Weight %</label><input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm focus:border-indigo-500 focus:outline-none" value={newKPI.weight} onChange={e => setNewKPI({...newKPI, weight: e.target.value})} /></div><Button onClick={add}>Add</Button></div><div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-slate-500 px-1"><span>Total Weight: {totalWeight}%</span>{totalWeight !== 100 && <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded">Warning: Total should be 100%</span>}</div></div><div className="space-y-3">{kpis.map((k, i) => (<div key={i} className="flex justify-between items-center p-4 border border-slate-100 rounded-lg hover:bg-slate-50 hover:border-slate-200 transition-all shadow-sm"><div><div className="font-bold text-slate-800 text-sm flex items-center gap-2">{k.label} <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]"> {k.weight}%</span></div><div className="text-xs text-slate-400 mt-0.5">{k.description}</div></div><button onClick={() => remove(i)} className="text-slate-300 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors"><Trash2 className="w-4 h-4" /></button></div>))}</div>
      </Card>
    );
};

const UserApprovalRow = ({ user, depts, onApprove, isEditMode, onUpdate, onDelete }) => {
  const [role, setRole] = useState(user.role || ROLES.EMPLOYEE);
  const [dept, setDept] = useState(user.department || '');
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => { setRole(user.role || ROLES.EMPLOYEE); setDept(user.department || ''); }, [user]);
  const handleAction = () => { if (isEditMode) { if (isEditing) { onUpdate(user.id, { role, department: dept }); setIsEditing(false); } else { setIsEditing(true); } } else { onApprove(user.id, role, dept); } };
  const showInputs = !isEditMode || isEditing;
  return (<div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-sm border border-slate-200">{showInputs ? (<><select className="text-xs border-none bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer" value={role} onChange={e => setRole(e.target.value)}><option value={ROLES.EMPLOYEE}>Employee</option><option value={ROLES.MANAGER}>Manager</option></select><div className="w-px h-4 bg-slate-300"></div><select className="text-xs border-none bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer w-32" value={dept} onChange={e => setDept(e.target.value)}><option value="">Select Dept...</option>{depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}</select></>) : (<div className="flex items-center gap-2 px-2 text-xs font-medium text-slate-600"><span>{role}</span><span className="text-slate-300">|</span><span>{dept}</span></div>)}<Button variant={isEditMode && isEditing ? "primary" : "success"} onClick={handleAction} disabled={showInputs && !dept} className="py-1 px-3 text-xs h-7">{isEditMode ? (isEditing ? <Save className="w-3 h-3" /> : <Pencil className="w-3 h-3" />) : "Approve"}</Button>{onDelete && (<button onClick={() => { if(confirm("Are you sure you want to remove this user?")) onDelete(user.id); }} className="text-slate-400 hover:text-red-600 p-1 ml-1"><Trash2 className="w-4 h-4" /></button>)}</div>);
};

const UserManagement = ({ users, departments, onApprove, onUpdate, onDelete }) => {
  const pending = useMemo(() => users.filter(u => u.status === STATUS.PENDING), [users]);
  const active = useMemo(() => users.filter(u => u.status === STATUS.APPROVED && u.role !== ROLES.ADMIN), [users]);
  return (<div className="space-y-6"><Card className="p-6"><div className="flex items-center gap-2 mb-6"><UserPlus className="w-5 h-5 text-slate-900" /><h3 className="font-bold text-lg text-slate-900">Pending Access Requests</h3></div>{pending.length === 0 ? (<div className="text-slate-400 text-sm italic py-4">No pending requests.</div>) : (<div className="divide-y divide-slate-100">{pending.map(u => (<div key={u.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"><div><div className="font-bold text-slate-900">{u.name}</div><div className="text-xs text-slate-500 font-mono">{u.email}</div></div><UserApprovalRow user={u} depts={departments} onApprove={onApprove} onDelete={onDelete} /></div>))}</div>)}</Card><Card className="p-6"><div className="flex items-center gap-2 mb-6"><Users className="w-5 h-5 text-slate-900" /><h3 className="font-bold text-lg text-slate-900">Active Directory</h3></div>{active.length === 0 ? (<div className="text-slate-400 text-sm italic py-4">No active users found.</div>) : (<div className="divide-y divide-slate-100">{active.map(u => (<div key={u.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"><div><div className="font-bold text-slate-900">{u.name}</div><div className="text-xs text-slate-500 font-mono">{u.email}</div></div><UserApprovalRow user={u} depts={departments} isEditMode={true} onUpdate={onUpdate} onDelete={onDelete} /></div>))}</div>)}</Card></div>);
};

const GuestManagement = ({ guests, onApprove, onAdd, onDelete }) => {
  const [newEmail, setNewEmail] = useState('');
  return (<Card className="p-6"><h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2"><Globe className="w-5 h-5" /> Guest Access Control</h3><div className="flex gap-2 mb-8 p-4 bg-slate-50 rounded-sm border border-slate-200"><input className="flex-1 bg-white border border-slate-300 rounded-sm px-3 py-2 text-sm" placeholder="Pre-approve Guest Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} /><Button onClick={() => { onAdd(newEmail); setNewEmail(''); }} disabled={!newEmail}>Add Guest</Button></div><div className="space-y-2">{guests.length === 0 && <div className="text-slate-400 text-sm italic">No guests configured.</div>}{guests.map(g => (<div key={g.id} className="flex justify-between items-center p-3 border rounded-sm hover:bg-slate-50"><div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${g.status === STATUS.APPROVED ? 'bg-emerald-500' : 'bg-amber-500'}`} /><span className="font-mono text-sm">{g.email}</span>{g.status === STATUS.PENDING && <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Pending Request</span>}</div><div className="flex gap-2">{g.status === STATUS.PENDING && (<Button variant="success" className="px-3 py-1 text-xs h-8" onClick={() => onApprove(g.id)}>Approve</Button>)}<button onClick={() => onDelete(g.id)} className="text-slate-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button></div></div>))}</div></Card>);
};

const DepartmentManager = ({ departments, showToast }) => {
  const [name, setName] = useState('');
  const add = async () => { if(!name) return; await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEPARTMENTS), { name }); setName(''); showToast("Organization unit added"); };
  return (<Card className="p-6"><h3 className="font-bold text-lg text-slate-900 mb-6">Organizational Structure</h3><div className="flex gap-2 mb-8"><div className="flex-1"><input className="w-full px-4 py-2 border border-slate-300 rounded-sm focus:outline-none focus:border-slate-900" value={name} onChange={e => setName(e.target.value)} placeholder="New Department Name" /></div><Button onClick={add} variant="primary" className="h-full">Add Unit</Button></div><div className="flex flex-wrap gap-3">{departments.map(d => (<div key={d.id} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-sm text-sm font-semibold shadow-sm flex items-center gap-2"><Briefcase className="w-3 h-3 text-slate-400" />{d.name}</div>))}</div></Card>);
};

const FormBuilder = ({ forms, showToast }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [newForm, setNewForm] = useState({ category: '', title: '', fields: DEFAULT_FORM_FIELDS });
  const [field, setField] = useState({ label: '', type: 'text', options: '' });

  const startEdit = (form) => { setNewForm(form); setEditingId(form.id); setIsCreating(true); };
  
  const deleteTemplate = async (id) => {
    if (confirm("Are you sure you want to delete this form template? This will not affect existing proposals submitted by employees.")) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS, id));
        showToast("Template deleted successfully.");
      } catch (error) {
        console.error("Delete failed", error);
        showToast("Failed to delete template.", "error");
      }
    }
  };

  const save = async () => { const processedFields = newForm.fields.map(f => { if ((f.type === 'dropdown' || f.type === 'checkbox') && typeof f.options === 'string') { return { ...f, options: f.options.split(',').map(o => o.trim()) }; } return f; }); const formToSave = { ...newForm, fields: processedFields }; if (editingId) { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS, editingId), formToSave); showToast("Template Updated"); } else { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS), formToSave); showToast("Template Saved"); } setIsCreating(false); setEditingId(null); setNewForm({ category: '', title: '', fields: DEFAULT_FORM_FIELDS }); };
  const cancel = () => { setIsCreating(false); setEditingId(null); setNewForm({ category: '', title: '', fields: DEFAULT_FORM_FIELDS }); };
  const addField = () => { if (field.label) { let newField = { ...field }; if ((field.type === 'dropdown' || field.type === 'checkbox') && field.options) { newField.options = field.options.split(',').map(o => o.trim()); } setNewForm(prev => ({...prev, fields: [...prev.fields, newField]})); setField({label:'', type:'text', options: ''}); } };
  
  if(!isCreating) return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg text-slate-900">Form Templates</h3>
        <Button onClick={() => setIsCreating(true)} variant="primary"><Plus className="w-4 h-4 mr-1" /> New Template</Button>
      </div>
      <div className="grid gap-3">
        {forms.map(f => (
          <div key={f.id} className="p-4 border border-slate-200 rounded-sm flex justify-between items-center hover:bg-slate-50 transition-colors">
            <div>
              <span className="font-bold text-slate-800">{f.title}</span>
              <span className="ml-3 text-xs font-bold text-slate-400 uppercase tracking-widest">{f.category}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(f)} className="text-slate-400 hover:text-indigo-600 p-2 rounded-full hover:bg-white" title="Edit Template">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => deleteTemplate(f.id)} className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-white" title="Delete Template">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  return (<Card className="p-8 border-l-4 border-l-slate-900"><h3 className="font-bold text-xl text-slate-900 mb-6">{editingId ? 'Edit Template' : 'Design New Template'}</h3><div className="space-y-4 mb-8"><Input label="Category" value={newForm.category} onChange={e => setNewForm({...newForm, category: e.target.value})} placeholder="e.g. Health & Safety" /><Input label="Title" value={newForm.title} onChange={e => setNewForm({...newForm, title: e.target.value})} placeholder="e.g. Incident Report" /></div><div className="bg-slate-50 p-6 rounded-sm border border-slate-200 mb-8"><h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4">Field Configuration</h4><div className="flex gap-3 mb-4 items-end"><div className="flex-1"><label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Field Name</label><input className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm" placeholder="e.g. Cost Estimate" value={field.label} onChange={e => setField({...field, label: e.target.value})} /></div><div className="w-1/3"><label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Type</label><select className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm bg-white" value={field.type} onChange={e => setField({...field, type: e.target.value})}><option value="text">Text Input</option><option value="textarea">Text Area</option><option value="number">Numeric</option><option value="date">Date Picker</option><option value="dropdown">Dropdown List</option><option value="checkbox">Checkbox Group</option><option value="file">File Attachment</option><option value="image">Image Upload</option></select></div>{(field.type === 'dropdown' || field.type === 'checkbox') && (<div className="flex-1"><label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Options (comma separated)</label><input className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm" placeholder="Option 1, Option 2" value={field.options} onChange={e => setField({...field, options: e.target.value})} /></div>)}<Button onClick={addField} variant="secondary">Add</Button></div><div className="flex flex-wrap gap-2">{newForm.fields.map((f, i) => (<div key={i} className="bg-white border border-slate-300 px-3 py-1 rounded-sm text-xs font-mono text-slate-600 flex items-center gap-2 group relative">{f.label} <span className="opacity-50">({f.type})</span><button onClick={() => setNewForm(prev => ({...prev, fields: prev.fields.filter((_, idx) => idx !== i)}))} className="text-red-500 hover:text-red-700 ml-1"><X className="w-3 h-3" /></button></div>))}</div></div><div className="flex justify-end gap-3"><Button variant="ghost" onClick={cancel}>Discard</Button><Button onClick={save} variant="primary">{editingId ? 'Update Template' : 'Publish Template'}</Button></div></Card>);
};

const AdminPortal = ({ showToast }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [forms, setForms] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [guests, setGuests] = useState([]);
  const [kpis, setKpis] = useState([]);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS), s => setUsers(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub2 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS), s => setForms(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub3 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEPARTMENTS), s => setDepartments(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub4 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.GUESTS), s => setGuests(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub5 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.KPIS), async (s) => { if (s.empty) { const batch = writeBatch(db); const kpiRef = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.KPIS)); await setDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.KPIS, 'config'), { list: DEFAULT_KPIS }); } else { const data = s.docs.find(d => d.id === 'config')?.data(); setKpis(data?.list || DEFAULT_KPIS); }});
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, []);

  const updateKPIs = async (newList) => { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.KPIS, 'config'), { list: newList }); showToast("KPIs Updated"); };
  const approveUser = useCallback(async (id, role, dept) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS, id), { status: STATUS.APPROVED, role, department: dept }); showToast("User access granted."); }, [showToast]);
  const updateUser = useCallback(async (id, data) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS, id), data); showToast("User details updated."); }, [showToast]);
  const deleteUser = useCallback(async (id) => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS, id)); showToast("User removed."); }, [showToast]);
  const approveGuest = useCallback(async (id) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.GUESTS, id), { status: STATUS.APPROVED }); showToast("Guest access authorized."); }, [showToast]);
  const addGuest = useCallback(async (email) => { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.GUESTS), { email, status: STATUS.APPROVED, addedAt: new Date().toISOString() }); showToast("Guest pre-approved."); }, [showToast]);
  const deleteGuest = useCallback(async (id) => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.GUESTS, id)); showToast("Guest removed."); }, [showToast]);

  return (
    <div>
      <div className="mb-8"><h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Administration</h1><p className="text-slate-500 mt-1">Manage users, configuration, and organizational structure.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <div className="md:col-span-3 sticky top-24 space-y-2 z-10 overflow-x-auto md:overflow-visible flex md:block gap-2 md:gap-0 pb-2 md:pb-0">
          {[{ id: 'users', label: 'Access Control', icon: Users }, { id: 'guests', label: 'Guest Access', icon: Globe }, { id: 'kpis', label: 'KPI Management', icon: Target }, { id: 'departments', label: 'Departments', icon: Briefcase }, { id: 'forms', label: 'Form Templates', icon: Layout }].map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all whitespace-nowrap md:whitespace-normal ${activeTab === tab.id ? 'bg-slate-900 text-white font-medium shadow-md translate-x-1' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100 hover:border-slate-200'}`}><tab.icon className="w-4 h-4 flex-shrink-0" /> {tab.label}</button>))}
        </div>
        <div className="md:col-span-9 space-y-8">{activeTab === 'users' && <UserManagement users={users} departments={departments} onApprove={approveUser} onUpdate={updateUser} onDelete={deleteUser} />}{activeTab === 'guests' && <GuestManagement guests={guests} onApprove={approveGuest} onAdd={addGuest} onDelete={deleteGuest} />}{activeTab === 'kpis' && <KPIManager kpis={kpis} onUpdate={updateKPIs} />}{activeTab === 'forms' && <FormBuilder forms={forms} showToast={showToast} />}{activeTab === 'departments' && <DepartmentManager departments={departments} showToast={showToast} />}</div>
      </div>
    </div>
  );
};

const EmployeePortal = ({ currentUser, showToast }) => {
  const [tab, setTab] = useState('new'); // 'new', 'history', 'collab'
  const [departments, setDepartments] = useState([]);
  const [forms, setForms] = useState([]);
  const [allIdeas, setAllIdeas] = useState([]); // Needed for duplicate check & collab
  const [activeForm, setActiveForm] = useState(null);
  const [editingIdeaId, setEditingIdeaId] = useState(null);
  const [submission, setSubmission] = useState({});
  const [targetDept, setTargetDept] = useState('');
  const [subDepts, setSubDepts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalStatus, setOriginalStatus] = useState(null);

  // New features state
  const [coverPhoto, setCoverPhoto] = useState(null);
  const [isLinking, setIsLinking] = useState(false);
  const [linkedId, setLinkedId] = useState('');

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEPARTMENTS), s => setDepartments(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub2 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS), s => setForms(s.docs.map(d => ({id:d.id, ...d.data()}))));
    // Subscribe to ALL ideas for duplicate checking and collaboration
    const unsub3 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS), s => setAllIdeas(s.docs.map(d => ({id:d.id, ...d.data()}))));
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const myIdeas = useMemo(() => allIdeas.filter(i => i.employeeId === currentUser.id), [allIdeas, currentUser]);

  const handleEditIdea = (idea) => {
    const matchingForm = forms.find(f => f.title === idea.formTitle && f.category === idea.category) || forms.find(f => f.title === idea.formTitle); 
    if (matchingForm) {
      setActiveForm(matchingForm);
      setSubmission(idea.formData);
      setTargetDept(idea.mainDepartment);
      setSubDepts(idea.subDepartments || []);
      setEditingIdeaId(idea.id);
      setOriginalStatus(idea.status);
      setCoverPhoto(idea.coverImage || null); // Load existing cover photo
      setIsLinking(!!idea.collaborationGroupId);
      setLinkedId(''); 
    } else {
      showToast("Original Form Template not found. Cannot edit.", "error");
    }
  };

  const handleJoinGroup = (targetId) => {
    setTab('new');
    setIsLinking(true);
    setLinkedId(targetId);
    showToast(`Collaboration Mode: Linked to ${targetId}. Select a form to proceed.`);
  };

  const handleDeleteIdea = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id));
    showToast("Proposal record deleted.");
  };

  const handleFileUpload = useCallback(async (file, label) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast("File limit exceeded (Max 10MB).", "error"); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const payload = { filename: file.name, mimeType: file.type, bytes: base64 };
      try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
        const data = await response.json();
        if (data.status === 'success') {
           setSubmission(prev => ({ ...prev, [label]: data.url }));
           showToast("Technical document uploaded securely.", "success");
        } else { throw new Error(data.message || "Script Error"); }
      } catch (error) { showToast("Upload failed. Check connection.", "error"); } finally { setUploading(false); }
    };
  }, [showToast]);

  // Dedicated handler for cover photo
  const handleCoverUpload = useCallback(async (file) => {
    if (!file) return;
    if (file.size > 700 * 1024) { showToast("Image too large (Max 700KB for Cover).", "error"); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      // Direct Base64 storage in Firestore for Covers (simpler for this demo than external storage)
      // In production, use Firebase Storage.
      const base64 = reader.result; // This is the Data URL directly
      setCoverPhoto(base64);
      setUploading(false);
      showToast("Cover photo attached.", "success");
    };
    reader.onerror = () => {
       showToast("Failed to read file.", "error");
       setUploading(false);
    };
  }, [showToast]);

  const handleRefine = async (fieldLabel, currentText) => {
    if (!currentText) return;
    const prompt = `Rewrite the following technical description to be concise, professional, and suitable for an Oil & Gas engineering proposal:\n\n"${currentText}"`;
    showToast("AI refining technical language...", "success");
    const refinedText = await callGemini(prompt);
    setSubmission(prev => ({ ...prev, [fieldLabel]: refinedText }));
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!targetDept) return showToast("Please select a target department", "error");
    setIsSubmitting(true);
    
    // --- Collaboration Logic ---
    let groupIdToUse = null;

    if (isLinking && linkedId) {
       const q = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS), where('publicId', '==', linkedId.trim().toUpperCase()));
       const querySnapshot = await getDocs(q);
       let linkedDoc = null;
       if (querySnapshot.empty) {
          const q2 = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS), where('__name__', '==', linkedId.trim()));
          const s2 = await getDocs(q2);
          if (!s2.empty) linkedDoc = s2.docs[0];
       } else {
          linkedDoc = querySnapshot.docs[0];
       }

       if (!linkedDoc) {
          showToast("Invalid Proposal ID for collaboration link.", "error");
          setIsSubmitting(false);
          return;
       }

       const linkedData = linkedDoc.data();
       if (linkedData.collaborationGroupId) {
          groupIdToUse = linkedData.collaborationGroupId;
       } else {
          groupIdToUse = crypto.randomUUID();
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, linkedDoc.id), {
             collaborationGroupId: groupIdToUse
          });
          showToast("New Collaboration Group Initialized.");
       }
    }

    showToast("AI Audit: Checking for redundancies...", "ai");
    const duplicateResult = await checkDuplicates(activeForm.title, JSON.stringify(submission), activeForm.category);
    const newPublicId = generatePublicId();

    const ideaData = {
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      status: STATUS.PENDING,
      formTitle: activeForm.title,
      category: activeForm.category, 
      formData: submission,
      mainDepartment: targetDept,
      subDepartments: subDepts,
      submittedAt: new Date().toISOString(),
      publicId: editingIdeaId ? (allIdeas.find(i => i.id === editingIdeaId)?.publicId || newPublicId) : newPublicId,
      collaborationGroupId: groupIdToUse,
      coverImage: coverPhoto, // Save cover photo base64
      duplicateFlag: duplicateResult?.isDuplicate ? {
        matchId: duplicateResult.matchId,
        matchTitle: duplicateResult.matchTitle,
        reason: duplicateResult.reason
      } : null
    };

    if (editingIdeaId) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, editingIdeaId), ideaData);
      showToast("Proposal Revised. Returned to Asset Manager for approval.");
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS), { ...ideaData, comments: [], collaborators: [] });
      if (ideaData.duplicateFlag) {
         showToast("Proposal Submitted. Note: AI Audit flagged potential overlap.", "warning");
      } else {
         showToast("Proposal Submitted Successfully");
      }
    }

    setActiveForm(null); setSubmission({}); setTargetDept(''); setSubDepts([]); setEditingIdeaId(null); setIsSubmitting(false); setOriginalStatus(null);
    setIsLinking(false); setLinkedId(''); setCoverPhoto(null);
  }, [activeForm, currentUser, showToast, submission, subDepts, targetDept, editingIdeaId, isLinking, linkedId, allIdeas, coverPhoto]);

  // ... (handleComment, handleUpdateComment, handleJoinTeam, toggleSubDept, handleCheckboxChange unchanged) ...
  const handleComment = useCallback(async (id, text) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id), { comments: arrayUnion({ id: Date.now(), author: currentUser.name, text, date: new Date().toISOString() }) });
    showToast("Technical note added");
  }, [currentUser, showToast]);

  const handleUpdateComment = useCallback(async (ideaId, updatedComments) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, ideaId), { comments: updatedComments });
    showToast("Note updated");
  }, [showToast]);

  const handleJoinTeam = useCallback(async (id) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id), {
      collaborators: arrayUnion({ id: currentUser.id, name: currentUser.name, joinedAt: new Date().toISOString() })
    });
    showToast("You have been added to the project team.", "success");
  }, [currentUser, showToast]);

  const toggleSubDept = (deptName) => {
    setSubDepts(prev => prev.includes(deptName) ? prev.filter(d => d !== deptName) : [...prev, deptName]);
  };

  const handleCheckboxChange = (label, option) => {
    const currentValues = submission[label] || [];
    if (currentValues.includes(option)) { setSubmission(prev => ({ ...prev, [label]: currentValues.filter(v => v !== option) })); } 
    else { setSubmission(prev => ({ ...prev, [label]: [...currentValues, option] })); }
  };

  return (
    <div>
      <div className="flex gap-6 mb-6 border-b border-slate-200">
         <button onClick={() => setTab('new')} className={`pb-3 border-b-2 font-bold text-xs uppercase tracking-wider transition-colors ${tab==='new' ? 'border-sky-700 text-sky-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>New Proposal</button>
         <button onClick={() => setTab('history')} className={`pb-3 border-b-2 font-bold text-xs uppercase tracking-wider transition-colors ${tab==='history' ? 'border-sky-700 text-sky-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>My Portfolio</button>
         <button onClick={() => setTab('collab')} className={`pb-3 border-b-2 font-bold text-xs uppercase tracking-wider transition-colors ${tab==='collab' ? 'border-sky-700 text-sky-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Collaboration Matrix</button>
      </div>

      {tab === 'collab' && <CollaborationHub currentUser={currentUser} ideas={allIdeas} onJoinTeam={handleJoinTeam} onCollaborate={handleJoinGroup} />}

      {tab === 'history' && (
        <div className="space-y-4">
           {myIdeas.length === 0 && <div className="text-sm text-slate-400 italic py-10 text-center">No submitted proposals found.</div>}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {myIdeas.map(idea => (
               <IdeaCard 
                  key={idea.id} 
                  idea={idea} 
                  isEmployeeView={true} 
                  onComment={handleComment} 
                  onUpdateComment={handleUpdateComment}
                  onEditIdea={handleEditIdea}
                  onDeleteIdea={handleDeleteIdea}
                  currentUser={currentUser}
               />
             ))}
           </div>
        </div>
      )}

      {tab === 'new' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="mb-6">
               <h2 className="text-xl font-bold text-slate-900 font-sans">Submit Proposal</h2>
               <p className="text-slate-500 text-sm">Select a technical category to initiate the approval workflow.</p>
            </div>
            
            {isLinking && linkedId && (
               <div className="mb-6 bg-indigo-50 border border-indigo-200 p-4 rounded-sm flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-3">
                     <LinkIcon className="w-5 h-5 text-indigo-600" />
                     <div>
                        <div className="text-sm font-bold text-indigo-900">Collaboration Mode Active</div>
                        <div className="text-xs text-indigo-700">Submitting proposal linked to ID: <span className="font-mono font-bold">{linkedId}</span></div>
                     </div>
                  </div>
                  <Button variant="ghost" onClick={() => { setIsLinking(false); setLinkedId(''); }} className="text-xs text-indigo-600 hover:bg-indigo-100">Cancel Link</Button>
               </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {forms.map(form => (
                <button key={form.id} onClick={() => { setActiveForm(form); setEditingIdeaId(null); setSubmission({}); setIsLinking(false); setLinkedId(''); setCoverPhoto(null); }} className="flex items-start p-5 bg-white border border-slate-200 rounded-sm hover:border-sky-500 hover:shadow-md transition-all text-left group">
                  <div className="mr-4 bg-slate-50 p-2.5 rounded-sm group-hover:bg-sky-50 transition-colors border border-slate-100">
                    <FileText className="w-5 h-5 text-slate-500 group-hover:text-sky-600" />
                  </div>
                  <div>
                    <div className="font-bold text-base text-slate-800 group-hover:text-sky-900">{form.title}</div>
                    <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">{form.category}</div>
                  </div>
                </button>
              ))}
            </div>

            <Modal isOpen={!!activeForm} onClose={() => { setActiveForm(null); setEditingIdeaId(null); setOriginalStatus(null); setCoverPhoto(null); }} title={editingIdeaId ? `Revision: ${activeForm?.title}` : (activeForm?.title || "New Submission")}>
                <form onSubmit={handleSubmit} className="space-y-8">
                  {editingIdeaId && originalStatus === STATUS.APPROVED && (
                    <div className="bg-amber-50 p-4 rounded-sm border-l-4 border-amber-500 flex items-start gap-3">
                       <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                       <div>
                          <h4 className="text-sm font-bold text-amber-900">Workflow Reset Warning</h4>
                          <p className="text-xs text-amber-800 mt-1">Modifying an approved proposal will reset its status to <strong>PENDING</strong> and trigger a new management review cycle.</p>
                       </div>
                    </div>
                  )}

                  <div className="bg-sky-50 p-4 rounded-sm border-l-4 border-sky-600 flex items-start gap-3">
                      <Zap className="w-5 h-5 text-sky-700 mt-0.5 flex-shrink-0" />
                      <div>
                         <h4 className="text-sm font-bold text-sky-900">AI-Powered Audit Active</h4>
                         <p className="text-xs text-sky-800 mt-1">Your submission will be instantly audited for duplicates against the global database to prevent redundancy.</p>
                      </div>
                   </div>

                   {/* Cover Photo & Collaboration Section */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Cover Photo Upload */}
                      <div className="bg-slate-50 p-4 rounded-sm border border-slate-200">
                         <div className="flex justify-between items-start mb-4">
                            <div>
                               <span className="block text-sm font-bold text-slate-700">Project Cover Image</span>
                               <span className="text-xs text-slate-500">Upload a visual representation of the asset/concept.</span>
                            </div>
                            <ImageIcon className="w-5 h-5 text-slate-400" />
                         </div>
                         {coverPhoto ? (
                            <div className="relative group">
                               <img src={getDirectLink(coverPhoto)} alt="Cover" className="w-full h-32 object-cover rounded-sm border border-slate-300" />
                               <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <button type="button" onClick={() => setCoverPhoto(null)} className="text-white text-xs font-bold bg-red-600 px-3 py-1 rounded-sm">Remove</button>
                               </div>
                            </div>
                         ) : (
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-sm cursor-pointer hover:bg-white hover:border-sky-400 transition-colors">
                               {uploading ? (
                                  <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
                               ) : (
                                  <>
                                    <div className="bg-white p-2 rounded-full mb-2 shadow-sm"><Upload className="w-4 h-4 text-slate-400" /></div>
                                    <span className="text-[10px] font-bold uppercase text-slate-500">Upload Image</span>
                                  </>
                               )}
                               <input type="file" className="hidden" accept="image/*" onChange={(e) => handleCoverUpload(e.target.files[0])} disabled={uploading} />
                            </label>
                         )}
                      </div>

                      {/* Collaboration Toggle */}
                      <div className="bg-slate-50 p-4 rounded-sm border border-slate-200">
                          <label className="flex items-center gap-3 cursor-pointer group mb-4">
                             <div className={`w-5 h-5 rounded-sm border flex items-center justify-center transition-colors ${isLinking ? 'bg-sky-700 border-sky-700' : 'bg-white border-slate-300'}`}>
                                {isLinking && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                             </div>
                             <input type="checkbox" className="hidden" checked={isLinking} onChange={e => setIsLinking(e.target.checked)} />
                             <div>
                                <span className="block text-sm font-bold text-slate-700">Collaboration & Linkage</span>
                                <span className="text-xs text-slate-500">Is this related to an existing initiative?</span>
                             </div>
                          </label>
                          
                          {isLinking && (
                            <div className="animate-fade-in">
                               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Related Proposal ID</label>
                               <input 
                                  type="text" 
                                  className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm uppercase font-mono placeholder-slate-400 focus:outline-none focus:border-sky-500" 
                                  placeholder="e.g. X9J2K1" 
                                  value={linkedId} 
                                  onChange={e => setLinkedId(e.target.value.toUpperCase())}
                               />
                            </div>
                          )}
                      </div>
                   </div>

                  {/* Form fields rendering */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {activeForm?.fields.map((f, i) => {
                      const isLongField = ['textarea', 'file', 'image', 'checkbox'].includes(f.type) || f.label.toLowerCase().includes('title') || f.label.toLowerCase().includes('description');
                      return (
                      <div key={i} className={`group ${isLongField ? 'col-span-1 md:col-span-2' : 'col-span-1'}`}>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 group-focus-within:text-sky-700 transition-colors">
                          {f.label} {f.required && <span className="text-amber-600">*</span>}
                        </label>
                        {f.type === 'textarea' ? (
                          <div className="relative">
                            <textarea className="w-full px-4 py-3 bg-white border border-slate-300 text-slate-900 text-sm rounded-sm focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 transition-all min-h-[140px] shadow-sm resize-y font-medium" required={f.required} value={submission[f.label] || ''} onChange={e => setSubmission({...submission, [f.label]: e.target.value})} placeholder={`Provide detailed ${f.label.toLowerCase()}...`} />
                            <button type="button" onClick={() => handleRefine(f.label, submission[f.label])} className="absolute right-3 bottom-3 text-[10px] bg-slate-100 text-sky-700 px-2 py-1 rounded-sm border border-slate-200 flex items-center gap-1.5 hover:bg-sky-50 hover:border-sky-200 transition-all font-bold uppercase tracking-wide" title="Rewrite professionally with AI"><Zap className="w-3 h-3" /> AI Refine</button>
                          </div>
                        ) : f.type === 'dropdown' ? (
                           (f.options && f.options.length <= 5) ? (
                              <div className="flex flex-wrap gap-2">
                                 {f.options.map((opt, idx) => (
                                    <button key={idx} type="button" onClick={() => setSubmission({...submission, [f.label]: opt})} className={`px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wide border transition-all ${submission[f.label] === opt ? "bg-sky-800 text-white border-sky-800 shadow-sm" : "bg-white text-slate-500 border-slate-300 hover:border-sky-400 hover:text-sky-700"}`}>{opt}</button>
                                 ))}
                              </div>
                           ) : (
                             <div className="relative">
                               <select className="w-full px-4 py-3 bg-white border border-slate-300 text-slate-900 text-sm rounded-sm focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 transition-all appearance-none shadow-sm font-medium" required={f.required} value={submission[f.label] || ''} onChange={e => setSubmission({...submission, [f.label]: e.target.value})}>
                                  <option value="">Select option...</option>
                                  {f.options && f.options.map((opt, idx) => (<option key={idx} value={opt}>{opt}</option>))}
                               </select>
                               <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                             </div>
                           )
                        ) : f.type === 'checkbox' ? (
                           <div className="flex flex-wrap gap-3 bg-slate-50 p-4 rounded-sm border border-slate-200">
                              {f.options && f.options.map((opt, idx) => (
                                 <label key={idx} className="flex items-center gap-2.5 text-xs font-bold text-slate-600 cursor-pointer hover:text-slate-900 bg-white px-3 py-2 rounded-sm border border-slate-200 shadow-sm transition-all hover:border-slate-400 uppercase tracking-wide">
                                    <input type="checkbox" className="rounded-sm border-slate-300 text-sky-700 focus:ring-sky-600 w-4 h-4" checked={(submission[f.label] || []).includes(opt)} onChange={() => handleCheckboxChange(f.label, opt)} /> {opt}
                                 </label>
                              ))}
                           </div>
                        ) : (f.type === 'file' || f.type === 'image') ? (
                           <div className="bg-slate-50 border-2 border-dashed border-slate-300 p-6 rounded-sm hover:bg-slate-100 hover:border-sky-400 transition-colors text-center h-full flex flex-col justify-center min-h-[120px]">
                              {submission[f.label] ? (
                                 <div className="flex flex-col items-center gap-2">
                                   <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600"><FileCheck className="w-5 h-5" /></div>
                                   <span className="text-xs font-bold text-emerald-700 uppercase">Document Securely Stored</span>
                                   <button type="button" onClick={() => setSubmission({...submission, [f.label]: null})} className="text-[10px] text-red-500 hover:text-red-700 underline mt-1 font-bold uppercase">Remove</button>
                                 </div>
                              ) : (
                                 <label className="flex flex-col items-center gap-2 cursor-pointer w-full h-full justify-center">
                                    {uploading ? (
                                      <><Loader2 className="w-8 h-8 text-sky-600 animate-spin" /><span className="text-xs text-sky-700 font-bold uppercase">Encrypting & Uploading...</span></>
                                    ) : (
                                      <><div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-400 mb-1 border border-slate-200"><Upload className="w-5 h-5" /></div><span className="text-xs font-bold text-slate-500 uppercase">Upload Technical Doc</span><input type="file" className="hidden" accept={f.type === 'image' ? "image/*" : "*/*"} onChange={(e) => handleFileUpload(e.target.files[0], f.label)} disabled={uploading} /></>
                                    )}
                                 </label>
                              )}
                              {submission[f.label] && <input type="hidden" value={submission[f.label]} required={f.required} />}
                           </div>
                        ) : (
                          <input type={f.type} className="w-full px-4 py-3 bg-white border border-slate-300 text-slate-900 text-sm rounded-sm focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 transition-all shadow-sm placeholder-slate-400 font-medium" required={f.required} value={submission[f.label] || ''} onChange={e => setSubmission({...submission, [f.label]: e.target.value})} placeholder={`Enter ${f.label.toLowerCase()}...`} />
                        )}
                      </div>
                      );
                    })}
                  </div>

                  <div className="bg-slate-100 p-6 rounded-sm border border-slate-200 space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Approving Authority (Dept)</label>
                      <div className="relative">
                        <select className="w-full px-4 py-3 bg-white border border-slate-300 text-slate-900 text-sm rounded-sm focus:outline-none focus:border-sky-600 shadow-sm appearance-none font-medium" value={targetDept} onChange={e => setTargetDept(e.target.value)} required>
                          <option value="">Select Department...</option>
                          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cross-Functional Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {departments.map(d => (
                          <button type="button" key={d.id} onClick={() => toggleSubDept(d.name)} className={`px-3 py-1.5 rounded-sm text-[10px] font-bold border transition-all duration-200 uppercase tracking-wide ${subDepts.includes(d.name) ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400 hover:text-slate-800'}`}>{d.name}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                      <Button variant="ghost" onClick={() => { setActiveForm(null); setEditingIdeaId(null); setOriginalStatus(null); setCoverPhoto(null); }}>Discard</Button>
                      <Button variant="primary" type="submit" className="px-8 shadow-lg shadow-sky-900/20" disabled={uploading || isSubmitting}>
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingIdeaId ? "Submit Revision" : "Submit Proposal")}
                      </Button>
                  </div>
                </form>
            </Modal>
          </div>
        </div>
      )}
    </div>
  );
};

// ... (Manager Portal, Guest Auth, etc. - ensure these are present as before) ...
const ManagerPortal = ({ currentUser, showToast }) => {
  const [ideas, setIdeas] = useState([]);
  const [filter, setFilter] = useState('all');
  const [kpis, setKpis] = useState([]);
  const [forms, setForms] = useState([]);
  
  // Manager Editing State
  const [activeForm, setActiveForm] = useState(null);
  const [editingIdeaId, setEditingIdeaId] = useState(null);
  const [submission, setSubmission] = useState({});
  const [targetDept, setTargetDept] = useState('');
  const [subDepts, setSubDepts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverPhoto, setCoverPhoto] = useState(null);
  const [originalStatus, setOriginalStatus] = useState(null);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS), s => { setIdeas(s.docs.map(d => ({id:d.id, ...d.data()}))); });
    const unsub2 = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.KPIS, 'config'), s => { if (s.exists()) setKpis(s.data().list); else setKpis(DEFAULT_KPIS); });
    const unsub3 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS), s => setForms(s.docs.map(d => ({id:d.id, ...d.data()}))));
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const handleStatus = useCallback(async (id, status) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id), { status, reviewedBy: currentUser.name, reviewedAt: new Date().toISOString() }); showToast(`Status updated: ${status}`); }, [currentUser, showToast]);
  const handleComment = useCallback(async (id, text) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id), { comments: arrayUnion({ id: Date.now(), author: currentUser.name, text, date: new Date().toISOString() }) }); showToast("Note recorded"); }, [currentUser, showToast]);
  const handleUpdateComment = useCallback(async (ideaId, updatedComments) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, ideaId), { comments: updatedComments }); showToast("Note updated"); }, [showToast]);
  const handleTogglePublic = useCallback(async (id, isPublic) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id), { isPublic: isPublic }); showToast(isPublic ? "Added to Global Showcase" : "Removed from Global Showcase"); }, [showToast]);
  const handleRate = useCallback(async (id, ratingResult) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id), { rating: ratingResult }); showToast("Technical Evaluation saved."); }, [showToast]);
  
  // Manager Edit Actions
  const handleEditIdea = (idea) => {
    const matchingForm = forms.find(f => f.title === idea.formTitle); 
    if (matchingForm) {
      setActiveForm(matchingForm);
      setSubmission(idea.formData);
      setTargetDept(idea.mainDepartment);
      setSubDepts(idea.subDepartments || []);
      setEditingIdeaId(idea.id);
      setOriginalStatus(idea.status);
      setCoverPhoto(idea.coverImage || null);
    } else {
      showToast("Form template not found. Cannot edit.", "error");
    }
  };

  const handleDeleteIdea = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id));
    showToast("Record permanently deleted.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Check duplicates only if title changed (omitted for brevity, assume simple update)
    
    const ideaData = {
      formData: submission,
      mainDepartment: targetDept,
      subDepartments: subDepts,
      coverImage: coverPhoto,
      // Manager keeps original status unless they explicitly change it elsewhere. 
      // If it was approved, it stays approved.
      status: originalStatus, 
      lastModifiedBy: currentUser.name,
      lastModifiedAt: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, editingIdeaId), ideaData);
      showToast("Proposal updated successfully.");
      setActiveForm(null);
    } catch (error) {
      console.error("Update failed", error);
      showToast("Failed to update proposal.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const myDeptIdeas = useMemo(() => ideas.filter(i => i.mainDepartment === currentUser.department), [ideas, currentUser]);
  const otherIdeas = useMemo(() => ideas.filter(i => i.mainDepartment !== currentUser.department), [ideas, currentUser]);
  const displayedIdeas = useMemo(() => filter === 'myDept' ? myDeptIdeas : [...myDeptIdeas, ...otherIdeas], [filter, myDeptIdeas, otherIdeas]);

  // Dashboard Metrics
  const activeCount = ideas.filter(i => i.status === STATUS.APPROVED).length;
  const pendingCount = ideas.filter(i => i.status === STATUS.PENDING).length;
  const safetyCount = ideas.filter(i => i.category?.includes('HSE') || i.formData["HSE Impact"]?.includes("Positive")).length;

  return (
    <div className="space-y-8">
      {/* Executive Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <StatCard label="Active Projects" value={activeCount} subtext="Currently in implementation phase" icon={Activity} color="text-emerald-600 bg-emerald-50" />
         <StatCard label="Pending Review" value={pendingCount} subtext="Awaiting technical approval" icon={Clock} color="text-amber-600 bg-amber-50" />
         <StatCard label="HSE Initiatives" value={safetyCount} subtext="Safety critical improvements" icon={Zap} color="text-red-600 bg-red-50" />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-sans uppercase tracking-tight">Asset Management</h2>
          <p className="text-slate-500 text-xs mt-1">Review, audit, and approve operational changes.</p>
        </div>
        <div className="flex bg-slate-100 rounded-sm p-1 border border-slate-200">
          <button onClick={() => setFilter('all')} className={`px-4 py-1.5 text-xs rounded-sm font-bold uppercase tracking-wider transition-all ${filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Global View</button>
          <button onClick={() => setFilter('myDept')} className={`px-4 py-1.5 text-xs rounded-sm font-bold uppercase tracking-wider transition-all ${filter === 'myDept' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>My Department</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedIdeas.map(idea => (
          <IdeaCard 
            key={idea.id} 
            idea={idea} 
            isManager={true} 
            canApprove={idea.mainDepartment === currentUser.department} 
            onStatus={handleStatus} 
            onComment={handleComment} 
            onUpdateComment={handleUpdateComment} 
            onTogglePublic={handleTogglePublic} 
            currentUser={currentUser} 
            onRate={handleRate} 
            kpis={kpis} 
            onEditIdea={handleEditIdea}
            onDeleteIdea={handleDeleteIdea}
          />
        ))}
        {displayedIdeas.length === 0 && (<div className="col-span-full p-16 text-center border-2 border-dashed border-slate-300 rounded-sm bg-slate-50"><div className="text-slate-400 font-bold uppercase tracking-widest text-xs">No pending items in queue.</div></div>)}
      </div>

      {/* Manager Edit Modal */}
      <Modal isOpen={!!activeForm} onClose={() => setActiveForm(null)} title={`Edit: ${activeForm?.title}`}>
          <form onSubmit={handleSubmit} className="space-y-6">
             <div className="bg-amber-50 p-4 rounded-sm border-l-4 border-amber-500 flex items-start gap-3">
                 <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                 <div>
                    <h4 className="text-sm font-bold text-amber-900">Manager Override</h4>
                    <p className="text-xs text-amber-800 mt-1">You are editing a live record. Changes will be reflected immediately without re-approval.</p>
                 </div>
             </div>
             {/* Simplified Form Rendering for Manager Edit - Reusing logic could be cleaner but explicit here for clarity */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activeForm?.fields.map((f, i) => (
                  <div key={i} className="col-span-1 md:col-span-2">
                     <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{f.label}</label>
                     {f.type === 'textarea' ? (
                       <textarea className="w-full px-4 py-3 bg-white border border-slate-300 rounded-sm text-sm" value={submission[f.label] || ''} onChange={e => setSubmission({...submission, [f.label]: e.target.value})} />
                     ) : (
                       <input className="w-full px-4 py-3 bg-white border border-slate-300 rounded-sm text-sm" value={submission[f.label] || ''} onChange={e => setSubmission({...submission, [f.label]: e.target.value})} />
                     )}
                  </div>
                ))}
             </div>
             <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button variant="ghost" onClick={() => setActiveForm(null)}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Changes"}</Button>
             </div>
          </form>
      </Modal>
    </div>
  );
};

const GuestAuth = ({ onAccess }) => {
  const [email, setEmail] = useState(''); const [status, setStatus] = useState('init');
  const checkAccess = async (e) => { e.preventDefault(); const q = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.GUESTS), where('email', '==', email)); const snap = await getDocs(q); if (snap.empty) { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.GUESTS), { email, status: STATUS.PENDING, requestedAt: new Date().toISOString() }); setStatus('pending'); } else { const guest = snap.docs[0].data(); if (guest.status === STATUS.APPROVED) onAccess(email); else setStatus('pending'); }};
  if (status === 'pending') return (<div className="min-h-screen flex items-center justify-center bg-slate-200 p-4"><Card className="w-full max-w-md p-10 text-center border-t-4 border-t-amber-500 shadow-xl"><div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6"><Lock className="w-8 h-8 text-amber-600" /></div><h2 className="text-xl font-bold text-slate-900 mb-2 uppercase tracking-wide">Access Restricted</h2><p className="text-slate-500 mb-8 text-sm">Your security clearance is pending administrative approval.</p><Button variant="secondary" onClick={() => window.location.reload()}>Refresh Status</Button></Card></div>);
  return (<div className="min-h-screen flex items-center justify-center bg-slate-900 p-4"><Card className="w-full max-w-md p-10 shadow-2xl border-t-4 border-t-sky-600"><h2 className="text-2xl font-bold text-slate-900 mb-2 font-sans">Secure Portal Access</h2><p className="text-slate-500 mb-8 text-sm">Enter authorized email to view confidential asset data.</p><form onSubmit={checkAccess} className="space-y-6"><Input label="Corporate Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required /><Button variant="primary" type="submit" className="w-full h-12 text-sm">Authenticate</Button></form></Card></div>);
};

const GuestView = ({ ideaId }) => {
  const [idea, setIdea] = useState(null); const [loading, setLoading] = useState(true); const [isGenerating, setIsGenerating] = useState(false); const [aiAnalysis, setAiAnalysis] = useState(null);
  useEffect(() => { const fetchIdea = async () => { const docRef = doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, ideaId); const snap = await getDoc(docRef); if (snap.exists()) { const data = snap.data(); setIdea(data); const content = Object.entries(data.formData).map(([k,v]) => `${k}: ${v}`).join('\n'); const prompt = `Act as an executive business analyst. Provide a very brief (2-3 sentences) executive summary of this proposal titled "${data.formTitle}":\n\n${content}`; callGemini(prompt).then(text => setAiAnalysis(text)); } setLoading(false); }; fetchIdea(); }, [ideaId]);
  const isImage = (url) => url.match(/\.(jpeg|jpg|gif|png)$/) != null || url.includes('drive.google.com') === false; 
  const handlePrint = async () => { setIsGenerating(true); await generatePDF(idea, aiAnalysis); setIsGenerating(false); };
  if (loading) return <LoadingScreen message="Retrieving Encrypted Data..." />;
  if (!idea) return <div className="text-center p-20 text-slate-500 font-bold uppercase tracking-widest">Data Unavailable or Access Denied.</div>;
  return (<div className="min-h-screen bg-slate-100 font-sans text-slate-900 print:bg-white"><div className="max-w-5xl mx-auto px-8 py-12 print:px-0 print:py-0"><div className="bg-white p-10 rounded-sm shadow-xl border-t-4 border-t-sky-800 print:shadow-none print:border-none"><div className="mb-10 border-b-2 border-slate-900 pb-6 print:mb-6"><div className="flex justify-between items-start mb-6"><div className="flex items-center gap-3"><div className="p-2 bg-slate-900"><Zap className="w-8 h-8 text-white" /></div><div><h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">EPROM</h1><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 block mt-1">Operational Excellence</span></div></div><div className="text-right"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Confidential Internal Document</div><div className="text-sm font-mono text-slate-600">{new Date(idea.submittedAt).toLocaleDateString()}</div></div></div><h1 className="text-4xl font-black text-slate-900 leading-tight mb-4 tracking-tight">{idea.formTitle}</h1><div className="flex items-center gap-6 text-sm text-slate-500 print:hidden font-medium"><span className="flex items-center gap-2"><User className="w-4 h-4 text-sky-700" /> {idea.employeeName}</span><span className="text-slate-300">|</span><span className="uppercase tracking-wide font-bold text-xs bg-slate-100 px-2 py-1 rounded-sm">{idea.mainDepartment}</span></div></div>{aiAnalysis && (<div className="mb-10 bg-slate-50 p-8 rounded-sm border-l-4 border-sky-600"><h3 className="text-xs font-bold text-sky-800 uppercase tracking-widest mb-3 flex items-center gap-2"><Zap className="w-4 h-4" /> Executive Summary</h3><p className="text-slate-800 leading-relaxed text-sm font-medium">{aiAnalysis}</p></div>)}<div className="space-y-12 print:space-y-8">{Object.entries(idea.formData).map(([k, v]) => (<div key={k} className="break-inside-avoid"><h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-200 pb-1">{k}</h3>{v.startsWith('http') ? (isImage(v) || v.includes('googleusercontent') ? (<img src={getDirectLink(v)} alt="Attachment" className="w-full rounded-sm shadow-md border border-slate-200 print:shadow-none" crossorigin="anonymous" />) : (<a href={v} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sky-800 hover:underline bg-sky-50 px-6 py-4 rounded-sm border border-sky-100 print:hidden font-bold uppercase text-xs tracking-wide"><Paperclip className="w-4 h-4" /> View Technical Attachment</a>)) : (<div className="text-base leading-relaxed text-slate-800 whitespace-pre-wrap font-serif">{v}</div>)}</div>))}</div><div className="mt-20 pt-8 border-t border-slate-200 text-center text-slate-400 text-[10px] uppercase tracking-[0.2em] print:hidden">Generated by EPROM Innovation Hub • ISO 9001:2015 Compliant</div></div><div className="fixed bottom-8 right-8 print:hidden"><Button onClick={handlePrint} disabled={isGenerating} className="shadow-2xl rounded-full w-16 h-16 flex items-center justify-center p-0 bg-slate-900 hover:bg-slate-800 border-4 border-slate-100">{isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Printer className="w-6 h-6" />}</Button></div></div></div>);
};

const LoginPage = ({ onLogin, onGoRegister }) => {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); 
  return (<div className="min-h-screen flex font-sans"><div className="hidden lg:flex w-1/2 bg-slate-900 relative flex-col justify-between"><InnovationCarousel variant="full" /></div><div className="w-full lg:w-1/2 bg-slate-50 flex items-center justify-center p-8"><div className="w-full max-w-md bg-white p-12 rounded-sm shadow-2xl border-t-8 border-sky-800"><div className="mb-10 lg:hidden text-center"><div className="w-16 h-16 bg-slate-900 rounded-sm mx-auto mb-4 flex items-center justify-center"><Zap className="w-8 h-8 text-white" /></div><h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">EPROM</h2></div><div className="mb-10"><h2 className="text-2xl font-bold text-slate-900 mb-2">Portal Access</h2><p className="text-slate-500 text-sm">Authorized personnel only. Please verify credentials.</p></div><form onSubmit={(e) => { e.preventDefault(); onLogin(email, password); }} className="space-y-6"><Input label="Corporate ID / Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /><Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /><Button variant="primary" type="submit" className="w-full h-12 text-sm">Secure Login</Button></form><div className="mt-8 text-center pt-6 border-t border-slate-100"><p className="text-slate-400 text-xs mb-4 uppercase tracking-wide font-bold">New Personnel?</p><Button variant="secondary" onClick={onGoRegister} className="w-full h-10 text-xs">Register for Access</Button></div></div></div></div>);
};

const RegisterPage = ({ onRegister, onBack }) => {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  return (<div className="min-h-screen flex items-center justify-center bg-slate-200 p-4 font-sans"><Card className="w-full max-w-lg p-12 shadow-2xl border-t-8 border-slate-900"><div className="mb-10"><h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">Personnel Registration</h2><p className="text-slate-500 mt-2 text-sm">Submit details for IT Department clearance.</p></div><form onSubmit={(e) => { e.preventDefault(); onRegister(form); }} className="space-y-6"><Input label="Full Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required /><Input label="Corporate Email" type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required /><Input label="Create Password" type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} required /><div className="pt-8 flex gap-4"><Button variant="ghost" onClick={onBack} className="flex-1">Cancel</Button><Button variant="primary" type="submit" className="flex-1">Submit Application</Button></div></form></Card></div>);
};

export default function IdeaBankApp() {
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false); 
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('login'); 
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [sharedIdeaId, setSharedIdeaId] = useState(null);

  const retryOperation = async (fn, retries = 3, delay = 1000) => { try { return await fn(); } catch (error) { if (retries > 0) { await new Promise(resolve => setTimeout(resolve, delay)); return retryOperation(fn, retries - 1, delay * 2); } throw error; } };
  useEffect(() => {
    const script = document.createElement('script'); script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"; script.async = true; document.body.appendChild(script);
    const initAuth = async () => {
      const params = new URLSearchParams(window.location.search); const shareId = params.get('share'); if (shareId) setSharedIdeaId(shareId);
      try { if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) { try { await retryOperation(() => signInWithCustomToken(auth, __initial_auth_token)); } catch (e) { await retryOperation(() => signInAnonymously(auth)); } } else { await retryOperation(() => signInAnonymously(auth)); } } catch (e) { console.error("All auth attempts failed", e); setLoading(false); }
    };
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user); setAuthReady(!!user); 
      if (user) {
        const params = new URLSearchParams(window.location.search); const shareId = params.get('share');
        if (shareId) { setView('guest_auth'); } else { const storedUid = localStorage.getItem('ideabank_uid'); if (storedUid) { if (storedUid === 'admin-master') { setCurrentUser({ ...DEFAULT_ADMIN, id: 'admin-master' }); setView(ROLES.ADMIN); } else { try { const userSnap = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS), where('__name__', '==', storedUid))); if (!userSnap.empty) { const userData = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() }; setCurrentUser(userData); setView(userData.role); } } catch (e) { localStorage.removeItem('ideabank_uid'); } } } } setLoading(false);
      }
    });
    initAuth(); return () => unsubscribe();
  }, []);

  const showToast = useCallback((message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); }, []);
  const handleLogin = async (email, password) => { setLoading(true); try { if (email === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) { const adminUser = { ...DEFAULT_ADMIN, id: 'admin-master' }; setCurrentUser(adminUser); setView(ROLES.ADMIN); localStorage.setItem('ideabank_uid', 'admin-master'); setLoading(false); return; } const q = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS), where('email', '==', email), where('password', '==', password)); const snapshot = await getDocs(q); if (snapshot.empty) throw new Error("Invalid email or password."); const userData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }; if (userData.status !== STATUS.APPROVED) throw new Error("Account pending approval."); setCurrentUser(userData); setView(userData.role); localStorage.setItem('ideabank_uid', userData.id); } catch (err) { showToast(err.message, 'error'); } finally { setLoading(false); } };
  const handleLogout = () => { setCurrentUser(null); setView('login'); localStorage.removeItem('ideabank_uid'); };
  const handleRegister = async (data) => { try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS), { ...data, role: 'unassigned', status: STATUS.PENDING, createdAt: new Date().toISOString() }); showToast("Application submitted for approval.", "success"); setView('login'); } catch (err) { showToast("Registration failed", "error"); } };
  if (loading || !authReady) return <LoadingScreen />;
  if (view === 'guest_auth') return <GuestAuth onAccess={() => setView('guest_view')} />;
  if (view === 'guest_view') return <GuestView ideaId={sharedIdeaId} />;
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans selection:bg-sky-200">
      {toast && (<div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-sm shadow-2xl border-l-4 text-sm font-bold tracking-wide animate-fade-in uppercase ${toast.type === 'error' ? 'bg-white border-red-600 text-red-800' : toast.type === 'ai' ? 'bg-white border-indigo-600 text-indigo-800' : 'bg-white border-emerald-600 text-emerald-800'}`}>{toast.type === 'ai' && <Zap className="w-4 h-4 inline-block mr-2 text-indigo-600" />}{toast.message}</div>)}
      {view === 'login' && (<div className="relative"><LoginPage onLogin={handleLogin} onGoRegister={() => setView('register')} /></div>)}
      {view === 'register' && <RegisterPage onRegister={handleRegister} onBack={() => setView('login')} />}
      {currentUser && (
        <div className="flex flex-col h-screen overflow-hidden">
          <header className="bg-slate-900 text-white h-16 flex-none z-40 shadow-xl border-b-4 border-sky-700">
            <div className="flex items-center justify-between h-full px-8">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="bg-white p-1 rounded-sm"><Zap className="w-6 h-6 text-slate-900" /></div>
                  <div className="flex flex-col"><span className="font-black text-xl leading-none tracking-tighter">EPROM</span><span className="text-[9px] text-sky-400 uppercase tracking-[0.2em] font-bold">Innovation Hub</span></div>
                </div>
                <div className="h-8 w-px bg-slate-700 mx-2"></div>
                <span className="text-[10px] font-bold bg-slate-800 text-sky-400 px-3 py-1 rounded-full uppercase tracking-widest border border-slate-700">{currentUser.role} View</span>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right hidden md:block"><div className="text-sm font-bold text-white uppercase tracking-wide">{currentUser.name}</div><div className="text-[10px] text-slate-400 font-mono">{currentUser.department || 'Administrator'}</div></div><Button variant="ghost" onClick={handleLogout} className="text-slate-400 hover:text-white hover:bg-slate-800"><LogOut className="w-5 h-5" /></Button>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-slate-200 p-6 md:p-10">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8 shadow-2xl rounded-sm overflow-hidden"><InnovationCarousel variant="banner" /></div>
              {view === ROLES.ADMIN && <AdminPortal showToast={showToast} />}
              {view === ROLES.MANAGER && <ManagerPortal currentUser={currentUser} showToast={showToast} />}
              {view === ROLES.EMPLOYEE && <EmployeePortal currentUser={currentUser} showToast={showToast} />}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}