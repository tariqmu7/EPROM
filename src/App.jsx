import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, initializeFirestore, collection, addDoc, query, where, 
  onSnapshot, doc, updateDoc, deleteDoc, getDocs, getDoc, arrayUnion, setDoc, writeBatch 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Users, FileText, CheckCircle, XCircle, 
  LogOut, Plus, Trash2, MessageSquare, Briefcase, 
  UserPlus, Layout, ChevronDown, ChevronUp, Send, 
  Settings, Search, Menu, ImageOff, X, Upload, ExternalLink, Paperclip, Loader2, FileCheck, Pencil, Save, Share2, Globe, Lock, Eye, Printer, FileDown, Sparkles, BrainCircuit, Rocket, ArrowLeft, Target, Award, MoreHorizontal
} from 'lucide-react';

// --- Configuration ---

// 1. Firebase Config
const firebaseConfig = {
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

const appId = "eprom-production-v1";

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

const DEFAULT_FORM_FIELDS = [
  { label: "Idea Title", type: "text", required: true },
  { label: "Idea Description", type: "textarea", required: true },
  { label: "Category / Area", type: "dropdown", options: ["Operations", "Safety", "Cost Reduction", "Innovation", "HR", "IT", "Maintenance"], required: true },
  { label: "Benefits / Value Proposition", type: "textarea", required: true },
  { label: "Estimated Cost", type: "text", required: false },
  { label: "Implementation Feasibility", type: "dropdown", options: ["Easy (Quick Win)", "Moderate (Project)", "Complex (Strategic)"], required: true },
  { label: "Priority Level", type: "dropdown", options: ["Low", "Medium", "High", "Critical"], required: false },
  { label: "Expected Timeline", type: "dropdown", options: ["Short-term (< 3 mo)", "Medium-term (3-12 mo)", "Long-term (> 1 yr)"], required: false },
  { label: "Collaboration Needed?", type: "dropdown", options: ["Yes", "No"], required: false },
  { label: "Attachments / Supporting Docs", type: "file", required: false }
];

const DEFAULT_KPIS = [
  { label: "Impact on Business Goals", description: "Does it reduce cost, increase revenue, or improve safety?", weight: 30 },
  { label: "Feasibility", description: "How easy is it to implement?", weight: 20 },
  { label: "Cost vs. Benefit Ratio", description: "Estimated cost compared to expected benefits.", weight: 20 },
  { label: "Innovation Level", description: "Is it a new approach or incremental improvement?", weight: 15 },
  { label: "Risk Level", description: "Does it introduce operational or safety risks?", weight: 15 }
];

const DEFAULT_ADMIN = {
  email: 'admin@ideabank.com',
  password: 'admin123', 
  role: ROLES.ADMIN,
  name: 'System Admin',
  status: STATUS.APPROVED
};

// --- Helper Functions ---

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
    return "AI Service Unavailable. Please try again later.";
  }
};

const getDirectLink = (url) => {
  if (!url) return '';
  if (url.includes('drive.google.com') && url.includes('/d/')) {
    const id = url.match(/\/d\/(.*?)\//)?.[1] || url.match(/\/d\/(.*?)($|\?)/)?.[1];
    if (id) {
      return `https://lh3.googleusercontent.com/d/${id}`;
    }
  }
  return url;
};

const generatePDF = (idea, analysisText = '') => {
  if (!window.html2pdf) {
    alert("PDF Generator is loading... please try again in 5 seconds.");
    return;
  }

  const element = document.createElement('div');
  
  // Evaluation HTML
  let evaluationHtml = '';
  if (idea.rating) {
    evaluationHtml = `
      <div style="margin-top: 30px; margin-bottom: 30px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 20px; background-color: #f8fafc;">
        <h3 style="font-size: 16px; font-weight: bold; color: #1e293b; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">Manager Evaluation</h3>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
           <span style="font-size: 20px; font-weight: bold; color: #0f172a;">Grade: ${idea.rating.grade}</span>
           <span style="font-size: 16px; color: #64748b;">Score: ${idea.rating.percentage}%</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <tr style="background-color: #e2e8f0; text-align: left;">
            <th style="padding: 10px; border: 1px solid #cbd5e1;">KPI</th>
            <th style="padding: 10px; border: 1px solid #cbd5e1;">Weight</th>
            <th style="padding: 10px; border: 1px solid #cbd5e1;">Score (1-5)</th>
          </tr>
          ${idea.rating.details.map(kpi => `
            <tr>
              <td style="padding: 10px; border: 1px solid #cbd5e1;">${kpi.label}</td>
              <td style="padding: 10px; border: 1px solid #cbd5e1;">${kpi.weight}%</td>
              <td style="padding: 10px; border: 1px solid #cbd5e1;">${kpi.score}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;
  }

  const analysisHtml = analysisText ? `
    <div style="background-color: #f0fdf4; padding: 20px; border-radius: 6px; border: 1px solid #bbf7d0; margin-bottom: 30px;">
      <h3 style="font-size: 16px; font-weight: bold; color: #166534; margin-top: 0; margin-bottom: 10px;">AI Executive Summary</h3>
      <div style="font-size: 14px; line-height: 1.6; color: #14532d; white-space: pre-wrap;">${analysisText}</div>
    </div>
  ` : '';

  element.innerHTML = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto;">
      <div style="border-bottom: 2px solid #1e293b; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #1e293b; text-transform: uppercase; letter-spacing: 1px;">Idea Bank Report</h1>
          <p style="margin: 5px 0 0; color: #64748b; font-size: 12px; letter-spacing: 0.5px;">CONFIDENTIAL INTERNAL DOCUMENT</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 12px; color: #64748b;">Ref: #${idea.id.slice(0, 8)}</p>
          <p style="margin: 0; font-size: 12px; color: #64748b;">Date: ${new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div style="background-color: #f1f5f9; padding: 25px; border-radius: 8px; margin-bottom: 35px; border-left: 5px solid #1e293b;">
        <h2 style="font-size: 24px; font-weight: bold; color: #0f172a; margin-top: 0;">${idea.formTitle}</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 15px; font-size: 14px; border-top: 1px solid #cbd5e1; padding-top: 15px;">
          <div><span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: bold;">Submitted By</span><br/>${idea.employeeName}</div>
          <div><span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: bold;">Department</span><br/>${idea.mainDepartment}</div>
          <div><span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: bold;">Date</span><br/>${new Date(idea.submittedAt).toLocaleDateString()}</div>
        </div>
      </div>

      ${analysisHtml}
      ${evaluationHtml}

      <div style="margin-bottom: 30px;">
        ${Object.entries(idea.formData).map(([k, v]) => {
          let valStr = '';
          if (Array.isArray(v)) {
            valStr = v.join(', ');
          } else {
            valStr = v ? v.toString() : '';
          }
          
          const isUrl = valStr.startsWith('http');
          const isLikelyImage = isUrl && (valStr.match(/\.(jpeg|jpg|gif|png)$/i) || valStr.includes('googleusercontent') || valStr.includes('drive.google.com'));
          
          let contentHtml = '';
          
          if (isUrl) {
             contentHtml = `
               <div style="margin-bottom: 10px;">
                 <a href="${valStr}" target="_blank" style="color: #2563eb; text-decoration: none; border-bottom: 1px dotted #2563eb; font-size: 14px; word-break: break-all;">
                   View Attachment / Link 🔗
                 </a>
               </div>
             `;
             
             if (isLikelyImage) {
                const imgSrc = getDirectLink(valStr);
                contentHtml += `
                  <img src="${imgSrc}" style="max-width: 100%; max-height: 500px; border-radius: 6px; border: 1px solid #e2e8f0; display: block; margin: 15px 0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);" crossorigin="anonymous" onerror="this.style.display='none'" />
                `;
             }
          } else {
             contentHtml = `<div style="font-size: 16px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${valStr}</div>`;
          }

          return `
            <div style="margin-bottom: 30px; page-break-inside: avoid;">
              <h3 style="font-size: 13px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">${k}</h3>
              ${contentHtml}
            </div>
          `;
        }).join('')}
      </div>

      <div style="margin-top: 50px; border-top: 2px solid #1e293b; padding-top: 20px;">
        <h3 style="font-size: 16px; font-weight: bold; color: #1e293b; margin-bottom: 20px;">Executive Feedback & Approval Status</h3>
        <div style="margin-bottom: 25px;">
           <span style="background-color: ${idea.status === 'approved' ? '#dcfce7' : '#f1f5f9'}; color: ${idea.status === 'approved' ? '#166534' : '#475569'}; padding: 6px 12px; border-radius: 4px; font-weight: bold; text-transform: uppercase; font-size: 12px; border: 1px solid ${idea.status === 'approved' ? '#86efac' : '#cbd5e1'};">
             Current Status: ${idea.status}
           </span>
        </div>
        ${idea.comments && idea.comments.length > 0 ? idea.comments.map(c => `
          <div style="background-color: #fff; padding: 15px; border-left: 4px solid #1e293b; margin-bottom: 15px; font-size: 14px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
            <p style="margin: 0 0 5px; font-weight: bold; color: #0f172a;">${c.author} <span style="font-weight: normal; color: #94a3b8; font-size: 12px; margin-left: 10px;">${new Date(c.date).toLocaleDateString()}</span></p>
            <p style="margin: 0; color: #475569;">${c.text}</p>
          </div>
        `).join('') : '<p style="font-size: 13px; color: #94a3b8; font-style: italic;">No comments recorded.</p>'}
      </div>

      <div style="margin-top: 60px; text-align: center; font-size: 10px; color: #cbd5e1; letter-spacing: 1px;">
        GENERATED BY IDEA BANK • EPROM ENTERPRISE SOLUTIONS
      </div>
    </div>
  `;

  const opt = {
    margin: [0.5, 0.5, 0.5, 0.5],
    filename: `Report-${idea.formTitle.replace(/\s+/g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  window.html2pdf().set(opt).from(element).save();
};

// --- Helper Components (Primitives) ---

const LoadingScreen = ({ message = "Loading..." }) => (
  <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -mt-2">
         <Rocket className="w-6 h-6 text-indigo-400 animate-pulse" />
      </div>
    </div>
    <div className="text-sm font-bold tracking-[0.2em] uppercase text-slate-400 animate-pulse">{message}</div>
  </div>
);

// Memoized UI Components for Performance
const Button = React.memo(({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false, title }) => {
  const baseStyle = "px-4 py-2 text-sm font-medium tracking-wide transition-all duration-200 flex items-center justify-center gap-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 active:scale-[0.98]";
  
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm hover:shadow-md",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-500 disabled:bg-slate-50 shadow-sm",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 disabled:bg-red-300 shadow-sm hover:shadow-red-200",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-600 disabled:bg-emerald-300 shadow-sm hover:shadow-emerald-200",
    ai: "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 focus:ring-indigo-500 shadow-sm hover:shadow-indigo-200",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900"
  };

  return (
    <button type={type} onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} disabled={disabled} title={title}>
      {children}
    </button>
  );
});

const Input = React.memo(({ label, type = "text", value, onChange, placeholder, required = false }) => (
  <div className="mb-5 group">
    {label && (
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 group-focus-within:text-indigo-600 transition-colors">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
    )}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-900 text-sm rounded-md focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-400 hover:border-slate-300"
      required={required}
    />
  </div>
));

const Card = React.memo(({ children, className = '', onClick }) => (
  <div 
    onClick={onClick} 
    className={`bg-white border border-slate-200 shadow-sm rounded-lg ${className} ${onClick ? 'cursor-pointer hover:shadow-lg hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-300' : ''}`}
  >
    {children}
  </div>
));

const Badge = React.memo(({ status, isPublic, rating }) => {
  const styles = {
    [STATUS.PENDING]: "bg-amber-50 text-amber-700 border-amber-200 ring-amber-100",
    [STATUS.APPROVED]: "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100",
    [STATUS.REJECTED]: "bg-red-50 text-red-700 border-red-200 ring-red-100",
  };
  
  const getGradeColor = (g) => {
    if(g === 'A') return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if(g === 'B') return "bg-blue-100 text-blue-800 border-blue-300";
    if(g === 'C') return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border rounded-full shadow-sm ring-1 ring-offset-0 ${styles[status] || "bg-gray-100"}`}>
        {status}
      </span>
      {rating && (
        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border rounded-full flex items-center gap-1 shadow-sm ${getGradeColor(rating.grade)}`}>
          <Award className="w-3 h-3" /> Grade {rating.grade} ({rating.percentage}%)
        </span>
      )}
      {isPublic && (
        <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border rounded-full bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1 shadow-sm">
          <Globe className="w-3 h-3" /> Public
        </span>
      )}
    </div>
  );
});

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in overflow-hidden">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-scale-up border border-slate-200">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white/80 backdrop-blur-sm z-10 sticky top-0">
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-8 overflow-y-auto scroll-smooth">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Shared Components ---

const RatingSystem = ({ idea, onRate, kpis }) => {
  const [scores, setScores] = useState({});

  useEffect(() => {
    if (idea.rating && idea.rating.details) {
      const initialScores = {};
      idea.rating.details.forEach(d => initialScores[d.label] = d.score);
      setScores(initialScores);
    }
  }, [idea]);

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
    const result = calculateGrade();
    onRate(idea.id, result);
  };

  const currentResult = calculateGrade();

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-6 shadow-inner">
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-600" /> Manager Evaluation
        </h4>
        {idea.rating && <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">Rating Saved</span>}
      </div>
      
      <div className="space-y-6">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-slate-200 pb-4 last:border-0 last:pb-0">
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-800">{kpi.label} <span className="text-indigo-500 text-xs font-medium ml-1">({kpi.weight}%)</span></div>
              <div className="text-xs text-slate-500 mt-0.5">{kpi.description}</div>
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="range" 
                min="1" 
                max="5" 
                value={scores[kpi.label] || 0} 
                onChange={(e) => handleScoreChange(kpi.label, e.target.value)}
                className="w-32 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
              />
              <span className={`w-8 h-8 flex items-center justify-center font-bold text-sm border rounded-full transition-colors ${scores[kpi.label] > 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200'}`}>
                {scores[kpi.label] || '-'}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
           <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grade</div>
           <div className="w-px h-6 bg-slate-200"></div>
           <div className="flex items-baseline gap-2">
             <span className={`text-2xl font-extrabold ${currentResult.percentage > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>{currentResult.grade}</span>
             <span className="text-sm font-medium text-slate-500">({currentResult.percentage}%)</span>
           </div>
        </div>
        <Button onClick={submitRating} className="px-8 shadow-indigo-100">Save & Update Rating</Button>
      </div>
    </div>
  );
};

const IdeaCard = React.memo(({ idea, isManager, canApprove, onStatus, onComment, onUpdateComment, isEmployeeView, onEditIdea, onDeleteIdea, currentUser, onTogglePublic, onRate, kpis }) => {
  const [comment, setComment] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [tempCommentText, setTempCommentText] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState(idea.aiSummary || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const isUrl = (str) => {
    try { return Boolean(new URL(str)); } catch(e){ return false; }
  };
  const isImageLink = (url) => {
    return (url.includes('drive.google.com') && !url.includes('view?usp=drivesdk')) || url.match(/\.(jpeg|jpg|gif|png)$/) != null || url.includes('googleusercontent');
  };

  const copyShareLink = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?share=${idea.id}`;
    navigator.clipboard.writeText(url);
    alert("Guest Link Copied to Clipboard!");
  };

  const handleCommentSubmit = useCallback(() => {
    if (comment.trim() && onComment) {
      onComment(idea.id, comment);
      setComment('');
    }
  }, [comment, onComment, idea.id]);

  const startEditComment = (c) => {
    setEditingCommentId(c.id);
    setTempCommentText(c.text);
  };

  const saveEditedComment = () => {
    if (onUpdateComment && tempCommentText.trim()) {
      const updatedComments = idea.comments.map(c => 
        c.id === editingCommentId ? { ...c, text: tempCommentText, editedAt: new Date().toISOString() } : c
      );
      onUpdateComment(idea.id, updatedComments);
      setEditingCommentId(null);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const content = Object.entries(idea.formData).map(([k,v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
    const prompt = `Act as an executive business analyst. Analyze this proposal titled "${idea.formTitle}". \n\nCONTENT:\n${content}\n\nPROVIDE:\n1. Executive Summary (1-2 sentences)\n2. 3 Key Benefits\n3. 1 Potential Risk`;
    
    const analysis = await callGemini(prompt);
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, idea.id), {
      aiSummary: analysis
    });

    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  const isEditable = idea.status !== STATUS.APPROVED;

  return (
    <>
    <Card 
      onClick={() => setShowModal(true)} 
      className={`transition-all duration-300 hover:shadow-lg cursor-pointer group ${isManager && canApprove && idea.status === STATUS.PENDING ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-transparent'}`}
    >
      <div className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <Badge status={idea.status} isPublic={idea.isPublic} rating={idea.rating} />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">{idea.mainDepartment}</span>
            </div>
            <h4 className="font-bold text-lg text-slate-900 leading-tight mb-2 truncate pr-4">{idea.formTitle}</h4>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                {idea.employeeName.charAt(0)}
              </div>
              {idea.employeeName}
              <span className="text-slate-300">•</span>
              {new Date(idea.submittedAt).toLocaleDateString()}
              {idea.reviewedBy && (
                 <span className="ml-2 text-[10px] text-emerald-600 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded"><CheckCircle className="w-3 h-3" /> Reviewed</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
             <button 
                onClick={copyShareLink}
                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                title="Copy Guest Link"
             >
                <Share2 className="w-4 h-4" />
             </button>
             
             {isEmployeeView && isEditable && (
               <>
                 {onEditIdea && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); onEditIdea(idea); }} 
                     className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                     title="Edit Proposal"
                   >
                     <Pencil className="w-4 h-4" />
                   </button>
                 )}
                 {onDeleteIdea && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); if(confirm('Delete this idea?')) onDeleteIdea(idea.id); }} 
                     className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                     title="Delete Proposal"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                 )}
               </>
             )}
             <div className="p-2 text-slate-300">
               <ChevronDown className="w-4 h-4" />
             </div>
          </div>
        </div>
        
        {idea.subDepartments && idea.subDepartments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-50">
            {idea.subDepartments.map(sub => (
              <span key={sub} className="text-[10px] font-semibold bg-slate-50 text-slate-500 px-2 py-1 rounded-md border border-slate-100">{sub}</span>
            ))}
          </div>
        )}
      </div>
    </Card>

    <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={idea.formTitle}>
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-6 gap-4">
           <div className="flex flex-col gap-2">
             <div className="flex items-center gap-3">
               <Badge status={idea.status} isPublic={idea.isPublic} rating={idea.rating} />
               <span className="text-sm text-slate-400">|</span>
               <span className="text-sm font-medium text-slate-600">{idea.mainDepartment}</span>
             </div>
             <div className="text-sm text-slate-500 flex items-center gap-1">
                Submitted by <span className="font-bold text-slate-900">{idea.employeeName}</span> on {new Date(idea.submittedAt).toLocaleDateString()}
             </div>
           </div>
           
           <div className="flex gap-3 w-full md:w-auto">
             {/* Public Publish Button for Managers */}
             {isManager && canApprove && idea.status === STATUS.APPROVED && (
               <Button 
                 variant={idea.isPublic ? "secondary" : "ai"} 
                 onClick={() => onTogglePublic && onTogglePublic(idea.id, !idea.isPublic)} 
                 className="flex-1 md:flex-none text-xs h-9"
               >
                 <Globe className="w-4 h-4 mr-1.5" /> {idea.isPublic ? "Unpublish" : "Publish"}
               </Button>
             )}
             
             <Button variant="secondary" onClick={() => generatePDF(idea, aiAnalysis)} className="flex-1 md:flex-none text-xs h-9">
               <FileDown className="w-4 h-4 mr-1.5" /> Report
             </Button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* AI Analysis Section */}
              <div className="relative">
                {!aiAnalysis ? (
                  <Button variant="ai" onClick={handleAnalyze} disabled={isAnalyzing} className="w-full h-12 shadow-md shadow-indigo-100">
                    {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
                    {isAnalyzing ? "Analyzing Proposal..." : "Generate AI Executive Summary"}
                  </Button>
                ) : (
                  <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 p-6 rounded-xl animate-fade-in shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-sm font-bold text-violet-800 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> AI Analysis
                      </h4>
                      <button onClick={() => setAiAnalysis(null)} className="text-violet-400 hover:text-violet-600 text-xs font-medium">Reset</button>
                    </div>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{aiAnalysis}</div>
                  </div>
                )}
              </div>

              <div className="space-y-8">
                  {Object.entries(idea.formData).map(([k, v]) => (
                    <div key={k} className="group">
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-indigo-600 transition-colors">{k}</span>
                      {Array.isArray(v) ? (
                        <div className="flex flex-wrap gap-2">
                          {v.map((val, idx) => (
                            <span key={idx} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-medium border border-slate-200">{val}</span>
                          ))}
                        </div>
                      ) : isUrl(v) ? (
                        isImageLink(getDirectLink(v)) ? (
                          <div className="mt-2 border rounded-lg p-2 bg-slate-50 inline-block max-w-full">
                            <img src={getDirectLink(v)} alt={k} className="max-w-full h-auto rounded shadow-sm max-h-96 object-contain" />
                            <a href={v} target="_blank" rel="noreferrer" className="block text-xs text-indigo-500 mt-2 hover:underline text-center font-medium">View Full Resolution</a>
                          </div>
                        ) : (
                          <a href={v} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 font-medium bg-white px-4 py-3 rounded-lg border border-slate-200 transition-colors shadow-sm">
                              <Paperclip className="w-4 h-4" /> View Attachment
                          </a>
                        )
                      ) : (
                        <div className="text-sm text-slate-800 leading-7 whitespace-pre-wrap bg-slate-50/50 p-4 rounded-lg border border-slate-100/50">{v}</div>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
               {/* Manager Rating System */}
              {isManager && (
                <RatingSystem idea={idea} onRate={onRate} kpis={kpis} />
              )}
              
              {/* Read-only Rating View for Employee */}
              {isEmployeeView && idea.rating && (
                <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-xl shadow-sm">
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                      <Award className="w-4 h-4" /> Manager Evaluation
                  </h4>
                  <div className="flex items-center gap-4 mb-4">
                      <div className="text-4xl font-black text-emerald-900">{idea.rating.grade}</div>
                      <div className="h-10 w-px bg-emerald-200"></div>
                      <div className="text-sm font-bold text-emerald-700">{idea.rating.percentage}% Score</div>
                  </div>
                  <div className="space-y-2">
                    {idea.rating.details.map((d, i) => (
                      <div key={i} className="flex justify-between text-xs text-emerald-800/80 border-b border-emerald-100/50 pb-1 last:border-0">
                        <span>{d.label}</span>
                        <span className="font-bold">{d.score}/5</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm h-fit sticky top-6">
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <MessageSquare className="w-3 h-3" /> Discussion
                  </h5>
                  <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {idea.comments && idea.comments.length > 0 ? idea.comments.map((c, i) => (
                      <div key={c.id || i} className="text-sm bg-slate-50 p-3 rounded-lg border border-slate-100 group">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-bold text-slate-900 text-xs">{c.author}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">{new Date(c.date).toLocaleDateString()}</span>
                            {currentUser && currentUser.name === c.author && (
                              <button onClick={() => startEditComment(c)} className="text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {editingCommentId === c.id ? (
                          <div className="flex gap-2 mt-2">
                            <input 
                              className="flex-1 border border-slate-300 px-2 py-1 text-xs rounded shadow-sm focus:outline-none focus:border-indigo-500"
                              value={tempCommentText}
                              onChange={e => setTempCommentText(e.target.value)}
                              autoFocus
                            />
                            <button onClick={saveEditedComment} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded"><Save className="w-3 h-3" /></button>
                            <button onClick={() => setEditingCommentId(null)} className="text-red-600 hover:bg-red-50 p-1 rounded"><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <span className="text-slate-600 leading-relaxed block">{c.text} {c.editedAt && <span className="text-[9px] text-slate-400 italic ml-1">(edited)</span>}</span>
                        )}
                      </div>
                    )) : <p className="text-xs text-slate-400 italic text-center py-4">No comments yet.</p>}
                  </div>
                  
                  {(isManager || isEmployeeView) && (
                    <div className="flex gap-2 items-center bg-slate-50 p-1.5 rounded-lg border border-slate-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                      <input 
                        className="flex-1 text-sm px-3 py-2 bg-transparent border-none focus:outline-none" 
                        placeholder="Type a comment..." 
                        value={comment} 
                        onChange={e => setComment(e.target.value)} 
                        onKeyDown={e => { if (e.key === 'Enter') handleCommentSubmit(); }}
                      />
                      <button 
                        onClick={handleCommentSubmit} 
                        disabled={!comment.trim()} 
                        className="bg-slate-900 text-white hover:bg-slate-800 p-2 rounded-md disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                        <Send className="w-3 h-3" />
                      </button>
                    </div>
                  )}
              </div>
            </div>
        </div>

        {/* Manager Approval Actions */}
        {isManager && canApprove && (
            <div className="flex gap-4 pt-8 mt-8 border-t border-slate-100">
              {idea.status !== STATUS.REJECTED && (
                <Button variant="danger" className="flex-1 h-12 shadow-red-100" onClick={() => { onStatus(idea.id, STATUS.REJECTED); setShowModal(false); }}>
                   {idea.status === STATUS.APPROVED ? "Revoke Approval" : "Reject Proposal"}
                </Button>
              )}
              
              {idea.status !== STATUS.APPROVED && (
                <Button variant="success" className="flex-1 h-12 shadow-emerald-100" onClick={() => { onStatus(idea.id, STATUS.APPROVED); setShowModal(false); }}>
                   {idea.status === STATUS.REJECTED ? "Reconsider" : "Approve & Authorize"}
                </Button>
              )}
            </div>
        )}
           
        {isManager && !canApprove && (
            <div className="bg-slate-50 text-center text-xs text-slate-500 italic p-4 rounded-lg mt-8 border border-slate-200 flex items-center justify-center gap-2">
              <Lock className="w-3 h-3" /> Read Only: Authority lies with {idea.mainDepartment}
            </div>
        )}
    </Modal>
    </>
  );
});

// ... [Existing KPIManager, UserApprovalRow, UserManagement, GuestManagement, DepartmentManager, FormBuilder components]

const KPIManager = ({ kpis, onUpdate }) => {
  const [newKPI, setNewKPI] = useState({ label: '', description: '', weight: 0 });

  const add = () => {
    if (!newKPI.label || !newKPI.weight) return;
    const updated = [...kpis, newKPI];
    onUpdate(updated);
    setNewKPI({ label: '', description: '', weight: 0 });
  };

  const remove = (index) => {
    const updated = kpis.filter((_, i) => i !== index);
    onUpdate(updated);
  };

  const totalWeight = kpis.reduce((acc, curr) => acc + parseInt(curr.weight), 0);

  return (
    <Card className="p-6">
      <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
        <Target className="w-5 h-5" /> KPI Configuration
      </h3>
      
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg mb-6">
        <div className="flex gap-2 items-end mb-4">
          <div className="flex-1">
             <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">KPI Name</label>
             <input className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm focus:border-indigo-500 focus:outline-none" value={newKPI.label} onChange={e => setNewKPI({...newKPI, label: e.target.value})} />
          </div>
          <div className="flex-1">
             <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Description</label>
             <input className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm focus:border-indigo-500 focus:outline-none" value={newKPI.description} onChange={e => setNewKPI({...newKPI, description: e.target.value})} />
          </div>
          <div className="w-24">
             <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Weight %</label>
             <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm focus:border-indigo-500 focus:outline-none" value={newKPI.weight} onChange={e => setNewKPI({...newKPI, weight: e.target.value})} />
          </div>
          <Button onClick={add}>Add</Button>
        </div>
        <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-slate-500 px-1">
           <span>Total Weight: {totalWeight}%</span>
           {totalWeight !== 100 && <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded">Warning: Total should be 100%</span>}
        </div>
      </div>

      <div className="space-y-3">
        {kpis.map((k, i) => (
          <div key={i} className="flex justify-between items-center p-4 border border-slate-100 rounded-lg hover:bg-slate-50 hover:border-slate-200 transition-all shadow-sm">
            <div>
              <div className="font-bold text-slate-800 text-sm flex items-center gap-2">{k.label} <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]"> {k.weight}%</span></div>
              <div className="text-xs text-slate-400 mt-0.5">{k.description}</div>
            </div>
            <button onClick={() => remove(i)} className="text-slate-300 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </Card>
  );
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
    
    // Load KPIs (or set default if empty)
    const unsub5 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.KPIS), async (s) => {
       if (s.empty) {
         const batch = writeBatch(db);
         const kpiRef = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.KPIS));
         await setDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.KPIS, 'config'), { list: DEFAULT_KPIS });
       } else {
         const data = s.docs.find(d => d.id === 'config')?.data();
         setKpis(data?.list || DEFAULT_KPIS);
       }
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, []);

  const updateKPIs = async (newList) => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.KPIS, 'config'), { list: newList });
    showToast("KPIs Updated");
  };

  const approveUser = useCallback(async (id, role, dept) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS, id), { status: STATUS.APPROVED, role, department: dept });
    showToast("User access granted.");
  }, [showToast]);

  const updateUser = useCallback(async (id, data) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS, id), data);
    showToast("User details updated.");
  }, [showToast]);

  const deleteUser = useCallback(async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS, id));
    showToast("User removed.");
  }, [showToast]);

  const approveGuest = useCallback(async (id) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.GUESTS, id), { status: STATUS.APPROVED });
    showToast("Guest access authorized.");
  }, [showToast]);

  const addGuest = useCallback(async (email) => {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.GUESTS), { email, status: STATUS.APPROVED, addedAt: new Date().toISOString() });
    showToast("Guest pre-approved.");
  }, [showToast]);

  const deleteGuest = useCallback(async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.GUESTS, id));
    showToast("Guest removed.");
  }, [showToast]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Administration</h1>
        <p className="text-slate-500 mt-1">Manage users, configuration, and organizational structure.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Sticky Sidebar for Desktop */}
        <div className="md:col-span-3 sticky top-24 space-y-2 z-10 overflow-x-auto md:overflow-visible flex md:block gap-2 md:gap-0 pb-2 md:pb-0">
          {[
            { id: 'users', label: 'Access Control', icon: Users },
            { id: 'guests', label: 'Guest Access', icon: Globe },
            { id: 'kpis', label: 'KPI Management', icon: Target },
            { id: 'departments', label: 'Departments', icon: Briefcase },
            { id: 'forms', label: 'Form Templates', icon: Layout }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all whitespace-nowrap md:whitespace-normal ${
                activeTab === tab.id 
                ? 'bg-slate-900 text-white font-medium shadow-md translate-x-1' 
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100 hover:border-slate-200'
              }`}
            >
              <tab.icon className="w-4 h-4 flex-shrink-0" /> {tab.label}
            </button>
          ))}
        </div>
        
        <div className="md:col-span-9 space-y-8">
          {activeTab === 'users' && <UserManagement users={users} departments={departments} onApprove={approveUser} onUpdate={updateUser} onDelete={deleteUser} />}
          {activeTab === 'guests' && <GuestManagement guests={guests} onApprove={approveGuest} onAdd={addGuest} onDelete={deleteGuest} />}
          {activeTab === 'kpis' && <KPIManager kpis={kpis} onUpdate={updateKPIs} />}
          {activeTab === 'forms' && <FormBuilder forms={forms} showToast={showToast} />}
          {activeTab === 'departments' && <DepartmentManager departments={departments} showToast={showToast} />}
        </div>
      </div>
    </div>
  );
};

// ... [Include other components: EmployeePortal, ManagerPortal, GuestView, etc. from previous context]

// ... [Include GuestView component]

const GuestView = ({ ideaId }) => {
  const [idea, setIdea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);

  useEffect(() => {
    const fetchIdea = async () => {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, ideaId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setIdea(data);
        const content = Object.entries(data.formData).map(([k,v]) => `${k}: ${v}`).join('\n');
        const prompt = `Act as an executive business analyst. Provide a very brief (2-3 sentences) executive summary of this proposal titled "${data.formTitle}":\n\n${content}`;
        callGemini(prompt).then(text => setAiAnalysis(text));
      }
      setLoading(false);
    };
    fetchIdea();
  }, [ideaId]);

  const isImage = (url) => {
    return url.match(/\.(jpeg|jpg|gif|png)$/) != null || url.includes('drive.google.com') === false; 
  };

  const handlePrint = async () => {
    setIsGenerating(true);
    await generatePDF(idea, aiAnalysis);
    setIsGenerating(false);
  };

  if (loading) return <LoadingScreen message="Loading Report..." />;
  if (!idea) return <div className="text-center p-20 text-slate-500">Report not found or access denied.</div>;

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans text-slate-900 print:bg-white flex flex-col items-center">
      <div className="max-w-5xl w-full mx-auto px-6 py-12 print:px-0 print:py-0">
        <div className="bg-white shadow-xl rounded-2xl p-10 md:p-16 border border-slate-100 relative overflow-hidden">
            {/* Top decorative bar */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900"></div>

            <div className="mb-12 border-b border-slate-200 pb-8 print:border-none print:mb-6">
              <div className="flex justify-between items-start mb-8">
                 <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <img src="./logo.jpg" alt="Logo" className="w-16 h-16 object-cover rounded" />
                 </div>
                 <div className="text-right">
                    <div className="text-xs font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-1">Confidential Report</div>
                    <div className="text-sm font-medium text-slate-600">{new Date(idea.submittedAt).toLocaleDateString()}</div>
                 </div>
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight mb-6 tracking-tight">{idea.formTitle}</h1>
              <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500 print:hidden bg-slate-50 py-3 px-4 rounded-lg inline-flex">
                <span className="flex items-center gap-2 font-medium"><Users className="w-4 h-4 text-indigo-500" /> {idea.employeeName}</span>
                <span className="w-px h-4 bg-slate-300"></span>
                <span className="uppercase tracking-wide font-bold text-xs text-indigo-900">{idea.mainDepartment}</span>
              </div>
            </div>

            {aiAnalysis && (
              <div className="mb-12 bg-gradient-to-br from-white to-violet-50/50 p-8 rounded-xl border border-violet-100 shadow-sm relative">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-400 rounded-l-xl"></div>
                <h3 className="text-xs font-bold text-violet-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Executive Summary
                </h3>
                <p className="text-slate-700 leading-relaxed text-base font-medium">{aiAnalysis}</p>
              </div>
            )}

            <div className="space-y-12 print:space-y-6">
              {Object.entries(idea.formData).map(([k, v]) => (
                <div key={k} className="break-inside-avoid">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em] mb-4 pb-2 border-b border-slate-100">{k}</h3>
                  {v.startsWith('http') ? (
                     isImage(v) || v.includes('googleusercontent') ? (
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 inline-block">
                           <img src={getDirectLink(v)} alt="Attachment" className="max-w-full rounded-lg shadow-sm border border-slate-100 print:shadow-none" crossorigin="anonymous" />
                        </div>
                     ) : (
                        <a href={v} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 font-semibold bg-white px-5 py-3 rounded-lg border border-slate-200 transition-all shadow-sm print:hidden group">
                           <div className="bg-blue-100 p-2 rounded-full group-hover:bg-blue-200 transition-colors"><Paperclip className="w-4 h-4 text-blue-600" /></div> View Attached Document
                        </a>
                     )
                  ) : (
                     <div className="text-lg leading-relaxed text-slate-800 whitespace-pre-wrap">{v}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-20 pt-8 border-t border-slate-200 text-center text-slate-400 text-xs uppercase tracking-widest print:hidden font-medium">
               Generated by Idea Bank • EPROM Enterprise Solutions
            </div>
        </div>

        {/* Floating Print Button for Guest */}
        <div className="fixed bottom-8 right-8 print:hidden z-50">
          <Button onClick={handlePrint} disabled={isGenerating} className="shadow-2xl rounded-full w-16 h-16 flex items-center justify-center p-0 bg-slate-900 hover:bg-slate-800 hover:scale-105 transition-all">
            {isGenerating ? <Loader2 className="w-8 h-8 animate-spin" /> : <FileDown className="w-8 h-8" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ... [LoginPage, RegisterPage, IdeaBankApp main component remain same, ensuring proper imports and structure]

const LoginPage = ({ onLogin, onGoRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [imgError, setImgError] = useState(false);

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative flex-col justify-between p-12 text-white">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516937941348-c09645f3a2eb?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        <div className="relative z-10">
          {!imgError ? (
            <img 
              src="./logo.jpg" 
              alt="Logo" 
              onError={() => setImgError(true)}
              className="w-40 h-40 rounded-sm mb-6 border-4 border-slate-700 shadow-2xl object-cover" 
            />
          ) : (
            <div className="w-40 h-40 rounded-sm mb-6 border-4 border-slate-700 bg-slate-800 flex items-center justify-center">
               <ImageOff className="w-16 h-16 text-slate-600" />
            </div>
          )}
          <h1 className="text-5xl font-bold tracking-tight mb-4">Idea Bank</h1>
          <p className="text-xl text-slate-400 font-light max-w-md">Empowering our workforce to drive operational excellence and sustainable innovation.</p>
        </div>
        <div className="relative z-10 text-xs text-slate-600 uppercase tracking-widest">
          © 2026 Enterprise Operations • Secure Access
        </div>
      </div>

      <div className="w-full lg:w-1/2 bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden text-center">
             {!imgError ? (
              <img 
                src="./logo.jpg" 
                alt="Logo" 
                onError={() => setImgError(true)}
                className="w-24 h-24 rounded-sm mx-auto mb-4 border border-slate-200 object-cover" 
              />
             ) : null}
            <h2 className="text-2xl font-bold text-slate-900">Idea Bank</h2>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Sign In</h2>
            <p className="text-slate-500">Access your dashboard using your company credentials.</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); onLogin(email, password); }} className="space-y-4">
            <Input label="Corporate Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button variant="primary" type="submit" className="w-full h-12 text-base mt-2">AuthenticatE</Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-slate-500 text-sm mb-4">Don't have access yet?</p>
            <Button variant="secondary" onClick={onGoRegister} className="w-full">Request Account Setup</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const RegisterPage = ({ onRegister, onBack }) => {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-lg p-8 md:p-10 shadow-lg border-t-4 border-t-slate-900">
        <div className="mb-8">
           <h2 className="text-2xl font-bold text-slate-900">Request Access</h2>
           <p className="text-slate-500 mt-1">Fill in your details for administrative approval.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onRegister(form); }} className="space-y-4">
          <Input label="Full Legal Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
          <Input label="Corporate Email" type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required />
          <Input label="Set Password" type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} required />
          
          <div className="pt-6 flex gap-4">
            <Button variant="ghost" onClick={onBack} className="flex-1">Cancel</Button>
            <Button variant="primary" type="submit" className="flex-1">Submit Request</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

// --- Main App Component ---

export default function IdeaBankApp() {
  const [authUser, setAuthUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('login'); 
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [sharedIdeaId, setSharedIdeaId] = useState(null);

  useEffect(() => {
    // Inject PDF Library
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.async = true;
    document.body.appendChild(script);

    const restoreSession = async () => {
      // Check for shared link in URL
      const params = new URLSearchParams(window.location.search);
      const shareId = params.get('share');
      if (shareId) {
        setSharedIdeaId(shareId);
        setView('guest_auth');
        setLoading(false);
        return;
      }

      // Normal Auth Flow
      const authPromise = new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, (user) => {
          if (user) resolve(user);
          else signInAnonymously(auth).then((result) => resolve(result.user));
        });
      });

      await authPromise;
      setAuthUser(auth.currentUser);

      const storedUid = localStorage.getItem('ideabank_uid');
      if (storedUid) {
        if (storedUid === 'admin-master') {
           setCurrentUser({ ...DEFAULT_ADMIN, id: 'admin-master' });
           setView(ROLES.ADMIN);
        } else {
           try {
             const userSnap = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS), where('__name__', '==', storedUid))); 
             
             if (!userSnap.empty) {
                const userData = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
                setCurrentUser(userData);
                setView(userData.role);
             }
           } catch (e) {
             console.error("Session restore failed", e);
             localStorage.removeItem('ideabank_uid');
           }
        }
      }
      setLoading(false);
    };

    restoreSession();
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleLogin = async (email, password) => {
    setLoading(true);
    try {
      if (email === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) {
        const adminUser = { ...DEFAULT_ADMIN, id: 'admin-master' };
        setCurrentUser(adminUser);
        setView(ROLES.ADMIN); 
        localStorage.setItem('ideabank_uid', 'admin-master'); 
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS),
        where('email', '==', email),
        where('password', '==', password)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) throw new Error("Invalid email or password.");
      
      const userData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

      if (userData.status !== STATUS.APPROVED) throw new Error("Account pending approval.");
      
      setCurrentUser(userData);
      setView(userData.role);
      localStorage.setItem('ideabank_uid', userData.id);

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null); 
    setView('login');
    localStorage.removeItem('ideabank_uid');
  };

  const handleRegister = async (data) => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS), {
        ...data,
        role: 'unassigned', 
        status: STATUS.PENDING,
        createdAt: new Date().toISOString()
      });
      showToast("Request submitted to System Admin.", "success");
      setView('login');
    } catch (err) {
      showToast("Registration failed", "error");
    }
  };

  if (loading) return <LoadingScreen message="Loading System..." />;

  // Special Routes
  if (view === 'guest_auth') return <GuestAuth onAccess={() => setView('guest_view')} />;
  if (view === 'guest_view') return <GuestView ideaId={sharedIdeaId} />;
  
  // Show Public Showcase if logged in and navigating
  if (view === 'showcase') return <PublicShowcase onBack={() => setView('login')} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-slate-200">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-sm shadow-lg border-l-4 text-sm font-medium animate-fade-in ${toast.type === 'error' ? 'bg-white border-red-600 text-red-700' : 'bg-white border-emerald-600 text-emerald-700'}`}>
          {toast.message}
        </div>
      )}

      {view === 'login' && (
        <div className="relative">
          <LoginPage onLogin={handleLogin} onGoRegister={() => setView('register')} />
          {/* Public Showcase Access for Non-logged-in Users */}
          <div className="absolute top-6 right-6 z-20">
            <Button variant="ghost" onClick={() => setView('showcase')} className="text-white bg-slate-800/50 hover:bg-slate-800 border border-slate-700">
              <Rocket className="w-4 h-4 mr-2" /> Innovation Showcase
            </Button>
          </div>
        </div>
      )}
      
      {view === 'register' && <RegisterPage onRegister={handleRegister} onBack={() => setView('login')} />}
      
      {currentUser && (
        <div className="flex flex-col h-screen overflow-hidden">
          {/* Top Enterprise Header */}
          <header className="bg-slate-900 text-white h-16 flex-none z-40 shadow-md">
            <div className="flex items-center justify-between h-full px-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-white p-0.5 rounded-sm">
                    <img 
                      src="./logo.jpg" 
                      alt="Logo" 
                      onError={(e) => { e.target.onerror = null; e.target.src = ''; e.target.style.display = 'none'; }}
                      className="w-10 h-10 rounded-sm object-cover" 
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-lg leading-none tracking-tight">IDEA BANK</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest">Enterprise Innovation</span>
                  </div>
                </div>
                <div className="h-6 w-px bg-slate-700 mx-2"></div>
                <span className="text-xs font-bold bg-slate-800 text-slate-300 px-3 py-1 rounded-full uppercase tracking-wide">
                  {currentUser.role} Portal
                </span>
              </div>
              
              <div className="flex items-center gap-6">
                <Button variant="ghost" onClick={() => setView('showcase')} className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs">
                  <Globe className="w-4 h-4 mr-1" /> Public Showcase
                </Button>
                <div className="text-right hidden md:block">
                  <div className="text-sm font-medium text-white">{currentUser.name}</div>
                  <div className="text-xs text-slate-400">{currentUser.department || 'System Admin'}</div>
                </div>
                <Button variant="ghost" onClick={handleLogout} className="text-slate-400 hover:text-white hover:bg-slate-800">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </header>

          {/* Main Dashboard Area */}
          <main className="flex-1 overflow-auto bg-slate-100 p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
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

// ... [Include PublicShowcase Component from previous context - Essential for the Showcase View]
const PublicShowcase = ({ onBack }) => {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState(null); 

  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS), where('isPublic', '==', true));
    const unsub = onSnapshot(q, s => {
       setIdeas(s.docs.map(d => ({id: d.id, ...d.data()})));
       setLoading(false);
    });
    return () => unsub();
  }, []);

  const getCoverImage = (idea) => {
    const values = Object.values(idea.formData);
    for (const v of values) {
      if (typeof v === 'string') {
        const url = getDirectLink(v);
        if (url && (url.includes('googleusercontent') || url.match(/\.(jpeg|jpg|gif|png)$/i))) {
          return url;
        }
      }
    }
    return null;
  };
  
  // Re-declare helpers locally for this isolated component (or could move to global)
  const isUrl = (str) => {
    try { return Boolean(new URL(str)); } catch(e){ return false; }
  };
  const isImageLink = (url) => {
    return (url.includes('drive.google.com') && !url.includes('view?usp=drivesdk')) || url.match(/\.(jpeg|jpg|gif|png)$/) != null || url.includes('googleusercontent');
  };


  if (loading) return <LoadingScreen message="Loading Innovation Showcase..." />;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-900 text-white py-12 px-6 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] bg-cover opacity-20"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <Button variant="ghost" onClick={onBack} className="text-slate-300 hover:text-white mb-6 -ml-4"><ArrowLeft className="w-4 h-4" /> Back to Login</Button>
          <div className="flex items-center gap-4 mb-4">
             <Rocket className="w-12 h-12 text-indigo-400" />
             <h1 className="text-4xl font-bold tracking-tight">Innovation Showcase</h1>
          </div>
          <p className="text-xl text-slate-300 max-w-2xl">Celebrating the breakthrough ideas driving our future. Explore the outstanding contributions from our team.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {ideas.length === 0 && <div className="col-span-full text-center text-slate-400 py-12">No showcased ideas yet. Check back soon!</div>}
           {ideas.map(idea => {
             const coverImg = getCoverImage(idea);
             return (
               <div 
                 key={idea.id} 
                 onClick={() => setSelectedIdea(idea)}
                 className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow flex flex-col h-full border border-slate-200 cursor-pointer"
               >
                 <div className="h-48 bg-slate-200 relative">
                   {coverImg ? (
                     <img src={coverImg} alt="Cover" className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Sparkles className="w-16 h-16 text-white/20" />
                     </div>
                   )}
                   <div className="absolute top-4 right-4 flex gap-2">
                      <span className="bg-white/90 text-slate-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{idea.mainDepartment}</span>
                      {idea.rating && (
                        <span className="bg-emerald-100/90 text-emerald-800 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 border border-emerald-200">
                          <Award className="w-3 h-3" /> {idea.rating.grade}
                        </span>
                      )}
                   </div>
                 </div>
                 <div className="p-6 flex-1 flex flex-col">
                   <h3 className="text-xl font-bold text-slate-900 mb-2">{idea.formTitle}</h3>
                   <div className="text-sm text-slate-600 line-clamp-3 mb-4 flex-1">
                     {idea.aiSummary || Object.values(idea.formData).find(v => typeof v === 'string' && v.length > 50) || "Click to view full details."}
                   </div>
                   <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                     <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs">
                       {idea.employeeName.charAt(0)}
                     </div>
                     <div className="text-xs">
                       <div className="font-bold text-slate-900">{idea.employeeName}</div>
                       <div className="text-slate-400">{new Date(idea.submittedAt).toLocaleDateString()}</div>
                     </div>
                   </div>
                 </div>
               </div>
             );
           })}
        </div>
      </div>
      
      {/* Detail Modal for Public Showcase - Reused Modal Logic */}
      <Modal isOpen={!!selectedIdea} onClose={() => setSelectedIdea(null)} title={selectedIdea?.formTitle}>
        {selectedIdea && (
          <>
            <div className="mb-6 flex justify-between items-center border-b border-slate-100 pb-4">
               <div className="flex items-center gap-4">
                 <Badge status={selectedIdea.status} isPublic={true} rating={selectedIdea.rating} />
                 <div className="text-sm text-slate-500">
                    Submitted by <span className="font-bold text-slate-900">{selectedIdea.employeeName}</span> on {new Date(selectedIdea.submittedAt).toLocaleDateString()}
                 </div>
               </div>
               <Button variant="secondary" onClick={() => generatePDF(selectedIdea, selectedIdea.aiSummary)} className="px-3 py-1.5 text-xs h-8">
                 <FileDown className="w-4 h-4 mr-1" /> Download Report
               </Button>
            </div>

            {selectedIdea.aiSummary && (
                <div className="bg-violet-50 border border-violet-100 p-4 rounded-sm mb-6">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-bold text-violet-800 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> AI Executive Summary
                    </h4>
                  </div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedIdea.aiSummary}</div>
                </div>
            )}
            
            {/* Display Rating in Showcase Detail */}
            {selectedIdea.rating && (
               <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-sm mb-6">
                 <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-2 mb-2">
                    <Award className="w-4 h-4" /> Excellence Rating
                 </h4>
                 <div className="flex items-center gap-4">
                    <div className="text-3xl font-extrabold text-emerald-900">Grade {selectedIdea.rating.grade}</div>
                    <div className="text-sm text-emerald-700">{selectedIdea.rating.percentage}% Impact Score</div>
                 </div>
               </div>
            )}

            <div className="grid grid-cols-1 gap-6 py-2">
                {Object.entries(selectedIdea.formData).map(([k, v]) => {
                  const isUrlVal = typeof v === 'string' && v.startsWith('http');
                  const isImageVal = isUrlVal && (v.includes('drive.google.com') && !v.includes('view?usp=drivesdk') || v.match(/\.(jpeg|jpg|gif|png)$/i) || v.includes('googleusercontent'));
                  return (
                  <div key={k} className="group">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{k}</span>
                    {Array.isArray(v) ? (
                       <div className="flex flex-wrap gap-2 mt-1">
                         {v.map((val, idx) => (
                           <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs border border-slate-200">{val}</span>
                         ))}
                       </div>
                    ) : isUrlVal ? (
                       isImageVal ? (
                         <div className="mt-2 border rounded p-2 bg-slate-50">
                           <img src={getDirectLink(v)} alt={k} className="max-w-full h-auto rounded shadow-sm max-h-96" />
                         </div>
                       ) : (
                         <a href={v} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:underline font-medium bg-blue-50 px-3 py-2 rounded-sm border border-blue-100">
                            <Paperclip className="w-4 h-4" /> View Attachment / Download
                         </a>
                       )
                    ) : (
                       <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-sm border border-slate-100 whitespace-pre-wrap">{v}</p>
                    )}
                  </div>
                  );
                })}
            </div>
          </>
        )}
      </Modal>

    </div>
  );
};