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
  UserPlus, Layout, Filter, ChevronDown, ChevronUp, Send, 
  BarChart3, Settings, Search, Menu, ImageOff, X, Upload, ExternalLink, Paperclip, Loader2, FileCheck, Pencil, Save, Share2, Globe, Lock, Eye, Printer, FileDown, Sparkles, BrainCircuit, Rocket, ArrowLeft, Target, Award, MoreHorizontal
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
          <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #1e293b; text-transform: uppercase;">Idea Bank Report</h1>
          <p style="margin: 5px 0 0; color: #64748b; font-size: 12px;">CONFIDENTIAL INTERNAL DOCUMENT</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 12px; color: #64748b;">Ref: #${idea.id.slice(0, 8)}</p>
          <p style="margin: 0; font-size: 12px; color: #64748b;">Date: ${new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div style="background-color: #f8fafc; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
        <h2 style="font-size: 24px; font-weight: bold; color: #0f172a; margin-top: 0;">${idea.formTitle}</h2>
        <div style="display: flex; gap: 20px; margin-top: 10px; font-size: 14px;">
          <p><strong>Submitted By:</strong> ${idea.employeeName}</p>
          <p><strong>Department:</strong> ${idea.mainDepartment}</p>
          <p><strong>Date:</strong> ${new Date(idea.submittedAt).toLocaleDateString()}</p>
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
                 <a href="${valStr}" target="_blank" style="color: #2563eb; text-decoration: underline; font-size: 14px; word-break: break-all; display: inline-flex; align-items: center;">
                   View Attachment / Link 🔗
                 </a>
               </div>
             `;
             
             if (isLikelyImage) {
                const imgSrc = getDirectLink(valStr);
                contentHtml += `
                  <img src="${imgSrc}" style="max-width: 100%; max-height: 400px; border-radius: 4px; border: 1px solid #e2e8f0; display: block; margin: 10px 0;" crossorigin="anonymous" onerror="this.style.display='none'" />
                `;
             }
          } else {
             contentHtml = `<div style="font-size: 16px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${valStr}</div>`;
          }

          return `
            <div style="margin-bottom: 25px; page-break-inside: avoid;">
              <h3 style="font-size: 14px; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">${k}</h3>
              ${contentHtml}
            </div>
          `;
        }).join('')}
      </div>

      <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
        <h3 style="font-size: 16px; font-weight: bold; color: #1e293b; margin-bottom: 15px;">Executive Feedback & Approval Status</h3>
        <div style="margin-bottom: 20px;">
           <span style="background-color: ${idea.status === 'approved' ? '#dcfce7' : '#f1f5f9'}; color: ${idea.status === 'approved' ? '#166534' : '#475569'}; padding: 5px 10px; border-radius: 4px; font-weight: bold; text-transform: uppercase; font-size: 12px;">
             Current Status: ${idea.status}
           </span>
        </div>
        ${idea.comments && idea.comments.length > 0 ? idea.comments.map(c => `
          <div style="background-color: #fff; padding: 10px; border-left: 3px solid #cbd5e1; margin-bottom: 10px; font-size: 13px;">
            <p style="margin: 0 0 5px;"><strong>${c.author}</strong> <span style="color: #94a3b8;">${new Date(c.date).toLocaleDateString()}</span></p>
            <p style="margin: 0; color: #334155;">${c.text}</p>
          </div>
        `).join('') : '<p style="font-size: 13px; color: #94a3b8;">No comments recorded.</p>'}
      </div>

      <div style="margin-top: 50px; text-align: center; font-size: 10px; color: #cbd5e1;">
        Generated by Idea Bank • EPROM Enterprise Solutions
      </div>
    </div>
  `;

  const opt = {
    margin: 0.5,
    filename: `Report-${idea.formTitle.replace(/\s+/g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  window.html2pdf().set(opt).from(element).save();
};

// --- Helper Components ---

const LoadingScreen = ({ message = "Loading..." }) => (
  <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
    <div className="w-8 h-8 border-4 border-slate-600 border-t-white rounded-full animate-spin mb-4"></div>
    <div className="text-sm font-medium tracking-widest uppercase">{message}</div>
  </div>
);

// Removing React.memo to ensure stability in all environments
const Button = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false }) => {
  const baseStyle = "px-5 py-2.5 text-sm font-semibold tracking-wide transition-colors duration-200 flex items-center justify-center gap-2 rounded-sm focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-500 disabled:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 disabled:bg-red-200",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-600 disabled:bg-emerald-200",
    ai: "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 focus:ring-indigo-500",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  };

  return (
    <button type={type} onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} disabled={disabled}>
      {children}
    </button>
  );
};

const Input = ({ label, type = "text", value, onChange, placeholder, required = false }) => (
  <div className="mb-5">
    {label && (
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
    )}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-900 text-sm rounded-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all placeholder-slate-400"
      required={required}
    />
  </div>
);

const Card = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-white border border-slate-200 shadow-sm rounded-sm ${className} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
    {children}
  </div>
);

const Badge = ({ status, isPublic, rating }) => {
  const styles = {
    [STATUS.PENDING]: "bg-amber-50 text-amber-700 border-amber-200",
    [STATUS.APPROVED]: "bg-emerald-50 text-emerald-700 border-emerald-200",
    [STATUS.REJECTED]: "bg-red-50 text-red-700 border-red-200",
    [ROLES.ADMIN]: "bg-slate-100 text-slate-700 border-slate-200",
    [ROLES.MANAGER]: "bg-blue-50 text-blue-700 border-blue-200",
    [ROLES.EMPLOYEE]: "bg-gray-50 text-gray-600 border-gray-200"
  };
  
  const getGradeColor = (g) => {
    if(g === 'A') return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if(g === 'B') return "bg-blue-100 text-blue-800 border-blue-300";
    if(g === 'C') return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border rounded-sm ${styles[status] || "bg-gray-100"}`}>
        {status}
      </span>
      {rating && (
        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border rounded-sm flex items-center gap-1 ${getGradeColor(rating.grade)}`}>
          <Award className="w-3 h-3" /> Grade {rating.grade} ({rating.percentage}%)
        </span>
      )}
      {isPublic && (
        <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border rounded-sm bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1">
          <Globe className="w-3 h-3" /> Public
        </span>
      )}
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-sm shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-up">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-8 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Shared Components (Defined BEFORE Portals) ---

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

const IdeaCard = ({ idea, isManager, canApprove, onStatus, onComment, onUpdateComment, isEmployeeView, onEditIdea, onDeleteIdea, currentUser, onTogglePublic, onRate, kpis }) => {
  const [comment, setComment] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [tempCommentText, setTempCommentText] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState(idea.aiSummary || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Helper to detect if a string is a URL
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
      className={`transition-all duration-200 hover:shadow-md cursor-pointer ${isManager && canApprove && idea.status === STATUS.PENDING ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-transparent'}`}
    >
      <div className="p-5">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge status={idea.status} isPublic={idea.isPublic} rating={idea.rating} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{idea.mainDepartment}</span>
              {idea.reviewedBy && (
                 <span className="text-[10px] text-slate-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Reviewed by {idea.reviewedBy}</span>
              )}
            </div>
            <h4 className="font-bold text-lg text-slate-900 leading-tight">{idea.formTitle}</h4>
            <div className="text-xs text-slate-500 mt-1 font-medium">
              By {idea.employeeName} • {new Date(idea.submittedAt).toLocaleDateString()}
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button 
                onClick={copyShareLink}
                className="p-2 text-slate-400 hover:text-emerald-600 bg-slate-50 rounded-full transition-colors z-10"
                title="Copy Guest Link"
             >
                <Share2 className="w-4 h-4" />
             </button>
             
             {isEmployeeView && isEditable && (
               <>
                 {onEditIdea && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); onEditIdea(idea); }} 
                     className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-full transition-colors z-10"
                     title="Edit Proposal"
                   >
                     <Pencil className="w-4 h-4" />
                   </button>
                 )}
                 {onDeleteIdea && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); if(confirm('Delete this idea?')) onDeleteIdea(idea.id); }} 
                     className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-full transition-colors z-10"
                     title="Delete Proposal"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                 )}
               </>
             )}
             <div className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 rounded-full transition-colors">
               <ExternalLink className="w-4 h-4" />
             </div>
          </div>
        </div>
        
        {idea.subDepartments && idea.subDepartments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {idea.subDepartments.map(sub => (
              <span key={sub} className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-sm">{sub}</span>
            ))}
          </div>
        )}
      </div>
    </Card>

    <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={idea.formTitle}>
        <div className="mb-6 flex justify-between items-center border-b border-slate-100 pb-4">
           <div className="flex items-center gap-4">
             <Badge status={idea.status} isPublic={idea.isPublic} rating={idea.rating} />
             <div className="text-sm text-slate-500">
                Submitted by <span className="font-bold text-slate-900">{idea.employeeName}</span> on {new Date(idea.submittedAt).toLocaleDateString()}
             </div>
           </div>
           
           <div className="flex gap-2">
             {/* Public Publish Button for Managers */}
             {isManager && canApprove && idea.status === STATUS.APPROVED && (
               <Button 
                 variant={idea.isPublic ? "secondary" : "ai"} 
                 onClick={() => onTogglePublic && onTogglePublic(idea.id, !idea.isPublic)} 
                 className="px-3 py-1.5 text-xs h-8"
               >
                 <Globe className="w-4 h-4 mr-1" /> {idea.isPublic ? "Unpublish" : "Publish to Showcase"}
               </Button>
             )}
             
             <Button variant="secondary" onClick={() => generatePDF(idea, aiAnalysis)} className="px-3 py-1.5 text-xs h-8">
               <FileDown className="w-4 h-4 mr-1" /> Download Report
             </Button>
           </div>
        </div>

        {/* AI Analysis Section */}
        <div className="mb-6">
          {!aiAnalysis ? (
            <Button variant="ai" onClick={handleAnalyze} disabled={isAnalyzing} className="w-full">
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
              {isAnalyzing ? "Analyzing Proposal..." : "Generate AI Executive Summary"}
            </Button>
          ) : (
            <div className="bg-violet-50 border border-violet-100 p-4 rounded-sm animate-fade-in">
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-sm font-bold text-violet-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> AI Analysis
                </h4>
                <button onClick={() => setAiAnalysis(null)} className="text-violet-400 hover:text-violet-600 text-xs">Reset</button>
              </div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{aiAnalysis}</div>
            </div>
          )}
        </div>

        {/* Manager Rating System */}
        {isManager && (
          <RatingSystem idea={idea} onRate={onRate} kpis={kpis} />
        )}
        
        {/* Read-only Rating View for Employee */}
        {isEmployeeView && idea.rating && (
           <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-sm mb-6">
             <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-2 mb-2">
                <Award className="w-4 h-4" /> Manager Evaluation
             </h4>
             <div className="flex items-center gap-4">
                <div className="text-3xl font-extrabold text-emerald-900">Grade {idea.rating.grade}</div>
                <div className="text-sm text-emerald-700">{idea.rating.percentage}% Impact Score</div>
             </div>
           </div>
        )}

        <div className="grid grid-cols-1 gap-6 py-2">
            {Object.entries(idea.formData).map(([k, v]) => {
                let valStr = '';
                if (Array.isArray(v)) {
                  valStr = v.join(', ');
                } else {
                  valStr = v ? v.toString() : '';
                }
                
                const isUrlVal = valStr.startsWith('http');
                const isImageVal = isUrlVal && (valStr.includes('drive.google.com') && !valStr.includes('view?usp=drivesdk') || valStr.match(/\.(jpeg|jpg|gif|png)$/i) || valStr.includes('googleusercontent'));
                
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
                       // If it looks like an image link, try to render it
                       isImageVal ? (
                         <div className="mt-2 border rounded p-2 bg-slate-50">
                           <img src={getDirectLink(valStr)} alt={k} className="max-w-full h-auto rounded shadow-sm max-h-96" />
                           <a href={valStr} target="_blank" rel="noreferrer" className="block text-xs text-blue-500 mt-2 hover:underline text-center">View Full Resolution</a>
                         </div>
                       ) : (
                         <a href={valStr} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:underline font-medium bg-blue-50 px-3 py-2 rounded-sm border border-blue-100">
                            <Paperclip className="w-4 h-4" /> View Attachment / Download
                         </a>
                       )
                    ) : (
                       <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-sm border border-slate-100 whitespace-pre-wrap">{valStr}</p>
                    )}
                  </div>
                );
            })}
        </div>

        <div className="mt-8 bg-slate-50 border border-slate-100 p-6 rounded-sm">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
               <MessageSquare className="w-3 h-3" /> Executive Feedback
            </h5>
            {idea.comments && idea.comments.length > 0 ? (
              <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
                {idea.comments.map((c, i) => (
                  <div key={c.id || i} className="text-sm bg-white p-4 rounded-sm border border-slate-200 shadow-sm group">
                    <div className="flex justify-between items-center mb-1">
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
                          className="flex-1 border border-slate-300 px-2 py-1 text-sm rounded-sm"
                          value={tempCommentText}
                          onChange={e => setTempCommentText(e.target.value)}
                        />
                        <button onClick={saveEditedComment} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded"><Save className="w-4 h-4" /></button>
                        <button onClick={() => setEditingCommentId(null)} className="text-red-600 hover:bg-red-50 p-1 rounded"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <span className="text-slate-600">{c.text} {c.editedAt && <span className="text-[9px] text-slate-400 italic ml-1">(edited)</span>}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-slate-400 italic mb-4">No feedback recorded yet.</p>}
            
            {(isManager || isEmployeeView) && (
               <div className="flex gap-2">
                 <input 
                   className="flex-1 text-sm px-4 py-3 border border-slate-300 rounded-sm focus:outline-none focus:border-slate-500" 
                   placeholder="Type your comment..." 
                   value={comment} 
                   onChange={e => setComment(e.target.value)} 
                   onKeyDown={e => { if (e.key === 'Enter') handleCommentSubmit(); }}
                 />
                 {onComment && (
                   <button onClick={handleCommentSubmit} disabled={!comment.trim()} className="bg-slate-800 text-white hover:bg-slate-700 px-4 py-2 rounded-sm disabled:bg-slate-300">
                     <Send className="w-4 h-4" />
                   </button>
                 )}
               </div>
            )}
        </div>

        {isManager && canApprove && (
            <div className="flex gap-3 pt-6 mt-6 border-t border-slate-100">
              {idea.status !== STATUS.REJECTED && (
                <Button variant="danger" className="flex-1" onClick={() => { onStatus(idea.id, STATUS.REJECTED); setShowModal(false); }}>
                   {idea.status === STATUS.APPROVED ? "Revoke Approval & Reject" : "Reject Proposal"}
                </Button>
              )}
              
              {idea.status !== STATUS.APPROVED && (
                <Button variant="success" className="flex-1" onClick={() => { onStatus(idea.id, STATUS.APPROVED); setShowModal(false); }}>
                   {idea.status === STATUS.REJECTED ? "Reconsider & Approve" : "Authorize"}
                </Button>
              )}
            </div>
        )}
           
        {isManager && !canApprove && (
            <div className="text-center text-xs text-slate-400 italic pt-6 mt-6 border-t border-slate-100 flex items-center justify-center gap-2">
              <XCircle className="w-4 h-4" /> Read Only: Authority lies with {idea.mainDepartment}
            </div>
        )}
    </Modal>
    </>
  );
};

// ... [Existing UserApprovalRow, UserManagement, GuestManagement, DepartmentManager, FormBuilder components]

const UserApprovalRow = ({ user, depts, onApprove, isEditMode, onUpdate, onDelete }) => {
  const [role, setRole] = useState(user.role || ROLES.EMPLOYEE);
  const [dept, setDept] = useState(user.department || '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setRole(user.role || ROLES.EMPLOYEE);
    setDept(user.department || '');
  }, [user]);

  const handleAction = () => {
    if (isEditMode) {
      if (isEditing) {
        onUpdate(user.id, { role, department: dept });
        setIsEditing(false);
      } else {
        setIsEditing(true);
      }
    } else {
      onApprove(user.id, role, dept);
    }
  };

  const showInputs = !isEditMode || isEditing;

  return (
    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-sm border border-slate-200">
      {showInputs ? (
        <>
          <select className="text-xs border-none bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer" value={role} onChange={e => setRole(e.target.value)}>
            <option value={ROLES.EMPLOYEE}>Employee</option><option value={ROLES.MANAGER}>Manager</option>
          </select>
          <div className="w-px h-4 bg-slate-300"></div>
          <select className="text-xs border-none bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer w-32" value={dept} onChange={e => setDept(e.target.value)}>
            <option value="">Select Dept...</option>{depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </>
      ) : (
        <div className="flex items-center gap-2 px-2 text-xs font-medium text-slate-600">
          <span>{role}</span>
          <span className="text-slate-300">|</span>
          <span>{dept}</span>
        </div>
      )}
      
      <Button 
        variant={isEditMode && isEditing ? "primary" : "success"} 
        onClick={handleAction} 
        disabled={showInputs && !dept} 
        className="py-1 px-3 text-xs h-7"
      >
        {isEditMode ? (isEditing ? <Save className="w-3 h-3" /> : <Pencil className="w-3 h-3" />) : "Approve"}
      </Button>
      
      {/* Delete User Button for Admin */}
      {onDelete && (
        <button 
          onClick={() => { if(confirm("Are you sure you want to remove this user?")) onDelete(user.id); }} 
          className="text-slate-400 hover:text-red-600 p-1 ml-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

const UserManagement = ({ users, departments, onApprove, onUpdate, onDelete }) => {
  const pending = useMemo(() => users.filter(u => u.status === STATUS.PENDING), [users]);
  const active = useMemo(() => users.filter(u => u.status === STATUS.APPROVED && u.role !== ROLES.ADMIN), [users]);
  
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
           <UserPlus className="w-5 h-5 text-slate-900" />
           <h3 className="font-bold text-lg text-slate-900">Pending Access Requests</h3>
        </div>
        {pending.length === 0 ? (
          <div className="text-slate-400 text-sm italic py-4">No pending requests.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pending.map(u => (
              <div key={u.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="font-bold text-slate-900">{u.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{u.email}</div>
                </div>
                <UserApprovalRow user={u} depts={departments} onApprove={onApprove} onDelete={onDelete} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
           <Users className="w-5 h-5 text-slate-900" />
           <h3 className="font-bold text-lg text-slate-900">Active Directory</h3>
        </div>
        {active.length === 0 ? (
          <div className="text-slate-400 text-sm italic py-4">No active users found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {active.map(u => (
              <div key={u.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="font-bold text-slate-900">{u.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{u.email}</div>
                </div>
                <UserApprovalRow 
                  user={u} 
                  depts={departments} 
                  isEditMode={true} 
                  onUpdate={onUpdate}
                  onDelete={onDelete} 
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

const GuestManagement = ({ guests, onApprove, onAdd, onDelete }) => {
  const [newEmail, setNewEmail] = useState('');
  
  return (
    <Card className="p-6">
      <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
        <Globe className="w-5 h-5" /> Guest Access Control
      </h3>
      
      <div className="flex gap-2 mb-8 p-4 bg-slate-50 rounded-sm border border-slate-200">
        <input 
          className="flex-1 bg-white border border-slate-300 rounded-sm px-3 py-2 text-sm" 
          placeholder="Pre-approve Guest Email" 
          value={newEmail} 
          onChange={e => setNewEmail(e.target.value)} 
        />
        <Button onClick={() => { onAdd(newEmail); setNewEmail(''); }} disabled={!newEmail}>Add Guest</Button>
      </div>

      <div className="space-y-2">
        {guests.length === 0 && <div className="text-slate-400 text-sm italic">No guests configured.</div>}
        {guests.map(g => (
          <div key={g.id} className="flex justify-between items-center p-3 border rounded-sm hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${g.status === STATUS.APPROVED ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="font-mono text-sm">{g.email}</span>
              {g.status === STATUS.PENDING && <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Pending Request</span>}
            </div>
            <div className="flex gap-2">
              {g.status === STATUS.PENDING && (
                <Button variant="success" className="px-3 py-1 text-xs h-8" onClick={() => onApprove(g.id)}>Approve</Button>
              )}
              <button onClick={() => onDelete(g.id)} className="text-slate-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const DepartmentManager = ({ departments, showToast }) => {
  const [name, setName] = useState('');
  const add = async () => {
    if(!name) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEPARTMENTS), { name });
    setName(''); showToast("Organization unit added");
  };
  return (
    <Card className="p-6">
      <h3 className="font-bold text-lg text-slate-900 mb-6">Organizational Structure</h3>
      <div className="flex gap-2 mb-8">
        <div className="flex-1">
          <input className="w-full px-4 py-2 border border-slate-300 rounded-sm focus:outline-none focus:border-slate-900" value={name} onChange={e => setName(e.target.value)} placeholder="New Department Name" />
        </div>
        <Button onClick={add} variant="primary" className="h-full">Add Unit</Button>
      </div>
      <div className="flex flex-wrap gap-3">
        {departments.map(d => (
          <div key={d.id} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-sm text-sm font-semibold shadow-sm flex items-center gap-2">
            <Briefcase className="w-3 h-3 text-slate-400" />
            {d.name}
          </div>
        ))}
      </div>
    </Card>
  );
};

const FormBuilder = ({ forms, showToast }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [newForm, setNewForm] = useState({ category: '', title: '', fields: DEFAULT_FORM_FIELDS });
  const [field, setField] = useState({ label: '', type: 'text', options: '' });

  const startEdit = (form) => {
    setNewForm(form);
    setEditingId(form.id);
    setIsCreating(true);
  };

  const save = async () => {
    // Process default fields or new fields if options string exists
    const processedFields = newForm.fields.map(f => {
      if ((f.type === 'dropdown' || f.type === 'checkbox') && typeof f.options === 'string') {
         return { ...f, options: f.options.split(',').map(o => o.trim()) };
      }
      return f;
    });

    const formToSave = { ...newForm, fields: processedFields };

    if (editingId) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS, editingId), formToSave);
      showToast("Template Updated");
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS), formToSave);
      showToast("Template Saved");
    }
    setIsCreating(false);
    setEditingId(null);
    setNewForm({ category: '', title: '', fields: DEFAULT_FORM_FIELDS });
  };

  const cancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setNewForm({ category: '', title: '', fields: DEFAULT_FORM_FIELDS });
  };

  const addField = () => {
    if (field.label) {
      // If options provided as string, keep as string for display until save
      // or split immediately. Splitting immediately is safer for UI rendering preview.
      let newField = { ...field };
      if ((field.type === 'dropdown' || field.type === 'checkbox') && field.options) {
         newField.options = field.options.split(',').map(o => o.trim());
      }
      
      setNewForm(prev => ({...prev, fields: [...prev.fields, newField]}));
      setField({label:'', type:'text', options: ''});
    }
  };

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
            <button onClick={() => startEdit(f)} className="text-slate-400 hover:text-indigo-600 p-2 rounded-full hover:bg-white">
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <Card className="p-8 border-l-4 border-l-slate-900">
      <h3 className="font-bold text-xl text-slate-900 mb-6">{editingId ? 'Edit Template' : 'Design New Template'}</h3>
      <div className="space-y-4 mb-8">
        <Input label="Category" value={newForm.category} onChange={e => setNewForm({...newForm, category: e.target.value})} placeholder="e.g. Health & Safety" />
        <Input label="Title" value={newForm.title} onChange={e => setNewForm({...newForm, title: e.target.value})} placeholder="e.g. Incident Report" />
      </div>

      <div className="bg-slate-50 p-6 rounded-sm border border-slate-200 mb-8">
        <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4">Field Configuration</h4>
        <div className="flex gap-3 mb-4 items-end">
          <div className="flex-1">
             <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Field Name</label>
             <input className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm" placeholder="e.g. Cost Estimate" value={field.label} onChange={e => setField({...field, label: e.target.value})} />
          </div>
          <div className="w-1/3">
             <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Type</label>
             <select className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm bg-white" value={field.type} onChange={e => setField({...field, type: e.target.value})}>
              <option value="text">Text Input</option>
              <option value="textarea">Text Area</option>
              <option value="number">Numeric</option>
              <option value="date">Date Picker</option>
              <option value="dropdown">Dropdown List</option>
              <option value="checkbox">Checkbox Group</option>
              <option value="file">File Attachment</option>
              <option value="image">Image Upload</option>
            </select>
          </div>
          {(field.type === 'dropdown' || field.type === 'checkbox') && (
            <div className="flex-1">
               <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Options (comma separated)</label>
               <input className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm" placeholder="Option 1, Option 2" value={field.options} onChange={e => setField({...field, options: e.target.value})} />
            </div>
          )}
          <Button onClick={addField} variant="secondary">Add</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {newForm.fields.map((f, i) => (
            <div key={i} className="bg-white border border-slate-300 px-3 py-1 rounded-sm text-xs font-mono text-slate-600 flex items-center gap-2 group relative">
              {f.label} <span className="opacity-50">({f.type})</span>
              <button 
                onClick={() => setNewForm(prev => ({...prev, fields: prev.fields.filter((_, idx) => idx !== i)}))}
                className="text-red-500 hover:text-red-700 ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={cancel}>Discard</Button>
        <Button onClick={save} variant="primary">{editingId ? 'Update Template' : 'Publish Template'}</Button>
      </div>
    </Card>
  );
};

// --- Portal Components (Defined AFTER dependencies) ---

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
        <h1 className="text-2xl font-bold text-slate-900">System Administration</h1>
        <p className="text-slate-500">Manage users, forms, and organizational structure.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-3 space-y-2">
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
              className={`w-full text-left px-4 py-3 rounded-sm flex items-center gap-3 transition-colors ${
                activeTab === tab.id 
                ? 'bg-slate-900 text-white font-medium shadow-sm' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-transparent'
              }`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
        <div className="md:col-span-9">
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

const EmployeePortal = ({ currentUser, showToast }) => {
  const [departments, setDepartments] = useState([]);
  const [forms, setForms] = useState([]);
  const [myIdeas, setMyIdeas] = useState([]);
  const [activeForm, setActiveForm] = useState(null);
  const [editingIdeaId, setEditingIdeaId] = useState(null); // Track idea edit
  const [submission, setSubmission] = useState({});
  const [targetDept, setTargetDept] = useState('');
  const [subDepts, setSubDepts] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEPARTMENTS), s => setDepartments(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub2 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS), s => setForms(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS), where('employeeId', '==', currentUser.id));
    const unsub3 = onSnapshot(q, s => setMyIdeas(s.docs.map(d => ({id:d.id, ...d.data()}))));
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [currentUser]);

  // Load idea into edit mode
  const handleEditIdea = (idea) => {
    const matchingForm = forms.find(f => f.title === idea.formTitle && f.category === idea.category) || 
                         forms.find(f => f.title === idea.formTitle); 
    
    if (matchingForm) {
      setActiveForm(matchingForm);
      setSubmission(idea.formData);
      setTargetDept(idea.mainDepartment);
      setSubDepts(idea.subDepartments || []);
      setEditingIdeaId(idea.id);
    } else {
      showToast("Original Form Template not found. Cannot edit.", "error");
    }
  };

  const handleDeleteIdea = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id));
    showToast("Idea deleted.");
  };

  const handleFileUpload = useCallback(async (file, label) => {
    if (!file) return;
    
    // 5MB Limit
    if (file.size > 5 * 1024 * 1024) {
      showToast("File is too large. Max size is 5MB.", "error");
      return;
    }

    setUploading(true);
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const payload = {
        filename: file.name,
        mimeType: file.type,
        bytes: base64
      };

      try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
           setSubmission(prev => ({ ...prev, [label]: data.url }));
           showToast("File uploaded to Corporate Drive securely.", "success");
        } else {
           throw new Error(data.message || "Script Error");
        }
      } catch (error) {
        console.error("Upload Error:", error);
        showToast("Upload failed. Ensure Script URL is correct.", "error");
      } finally {
        setUploading(false);
      }
    };
  }, [showToast]);

  const handleRefine = async (fieldLabel, currentText) => {
    if (!currentText) return;
    const prompt = `Rewrite the following text to be professional, concise, and suitable for a corporate proposal:\n\n"${currentText}"`;
    showToast("Refining text with AI...", "success");
    
    const refinedText = await callGemini(prompt);
    setSubmission(prev => ({ ...prev, [fieldLabel]: refinedText }));
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!targetDept) return showToast("Please select a target department", "error");
    
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
    };

    if (editingIdeaId) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, editingIdeaId), ideaData);
      showToast("Proposal Updated Successfully");
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS), {
        ...ideaData,
        comments: [] 
      });
      showToast("Proposal Submitted Successfully");
    }

    setActiveForm(null); setSubmission({}); setTargetDept(''); setSubDepts([]); setEditingIdeaId(null);
  }, [activeForm, currentUser, showToast, submission, subDepts, targetDept, editingIdeaId]);

  const handleComment = useCallback(async (id, text) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id), {
      comments: arrayUnion({ 
        id: Date.now(), 
        author: currentUser.name, 
        text, 
        date: new Date().toISOString() 
      })
    });
    showToast("Reply added");
  }, [currentUser, showToast]);

  const handleUpdateComment = useCallback(async (ideaId, updatedComments) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, ideaId), {
      comments: updatedComments
    });
    showToast("Comment updated");
  }, [showToast]);

  const toggleSubDept = (deptName) => {
    setSubDepts(prev => prev.includes(deptName) ? prev.filter(d => d !== deptName) : [...prev, deptName]);
  };

  // Helper for checkbox change
  const handleCheckboxChange = (label, option) => {
    const currentValues = submission[label] || [];
    if (currentValues.includes(option)) {
      setSubmission(prev => ({ ...prev, [label]: currentValues.filter(v => v !== option) }));
    } else {
      setSubmission(prev => ({ ...prev, [label]: [...currentValues, option] }));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        
        <div className="mb-6">
           <h2 className="text-xl font-bold text-slate-900">Submit New Proposal</h2>
           <p className="text-slate-500">Select a category to begin your submission.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {forms.map(form => (
            <button key={form.id} onClick={() => { setActiveForm(form); setEditingIdeaId(null); setSubmission({}); }} className="flex items-start p-6 bg-white border border-slate-200 rounded-sm hover:border-slate-400 hover:shadow-md transition-all text-left group">
              <div className="mr-4 bg-slate-100 p-3 rounded-sm group-hover:bg-slate-200">
                <FileText className="w-6 h-6 text-slate-700" />
              </div>
              <div>
                <div className="font-bold text-lg text-slate-800 group-hover:text-slate-900">{form.title}</div>
                <div className="text-sm text-slate-500 mt-1 uppercase tracking-wide text-[10px]">{form.category}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Modal for Form Submission */}
        <Modal isOpen={!!activeForm} onClose={() => { setActiveForm(null); setEditingIdeaId(null); }} title={editingIdeaId ? `Edit: ${activeForm?.title}` : (activeForm?.title || "New Submission")}>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="mb-6 pb-4 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Category: {activeForm?.category}</span>
              </div>
              {activeForm?.fields.map((f, i) => (
                <div key={i}>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </label>
                  {f.type === 'textarea' ? (
                    <div className="relative">
                      <textarea 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-sm focus:outline-none focus:border-slate-500 focus:bg-white transition-all min-h-[120px]" 
                        required={f.required} 
                        value={submission[f.label] || ''}
                        onChange={e => setSubmission({...submission, [f.label]: e.target.value})} 
                      />
                      <button
                        type="button"
                        onClick={() => handleRefine(f.label, submission[f.label])}
                        className="absolute right-2 bottom-2 text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-100 flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                        title="Rewrite professionally with AI"
                      >
                        <Sparkles className="w-3 h-3" /> Refine with AI
                      </button>
                    </div>
                  ) : f.type === 'dropdown' ? (
                     <select 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-sm focus:outline-none focus:border-slate-500 focus:bg-white"
                        required={f.required}
                        value={submission[f.label] || ''}
                        onChange={e => setSubmission({...submission, [f.label]: e.target.value})}
                     >
                        <option value="">Select an option...</option>
                        {f.options && f.options.map((opt, idx) => (
                           <option key={idx} value={opt}>{opt}</option>
                        ))}
                     </select>
                  ) : f.type === 'checkbox' ? (
                     <div className="flex flex-wrap gap-3">
                        {f.options && f.options.map((opt, idx) => (
                           <label key={idx} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input 
                                 type="checkbox" 
                                 className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                 checked={(submission[f.label] || []).includes(opt)}
                                 onChange={() => handleCheckboxChange(f.label, opt)}
                              />
                              {opt}
                           </label>
                        ))}
                     </div>
                  ) : (f.type === 'file' || f.type === 'image') ? (
                     <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm">
                        <div className="flex items-center gap-4">
                           <label className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-sm cursor-pointer hover:bg-slate-700 transition-colors">
                              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                              <span>{uploading ? "Uploading..." : "Select File"}</span>
                              <input 
                                type="file" 
                                className="hidden" 
                                accept={f.type === 'image' ? "image/*" : "*/*"}
                                onChange={(e) => handleFileUpload(e.target.files[0], f.label)}
                                disabled={uploading}
                              />
                           </label>
                           {submission[f.label] ? (
                             <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                               <FileCheck className="w-4 h-4" /> Uploaded
                             </div>
                           ) : <span className="text-xs text-slate-400">Format: {f.type === 'image' ? 'Images only' : 'Any Document'}</span>}
                        </div>
                        {submission[f.label] && (
                          <input type="hidden" value={submission[f.label]} required={f.required} />
                        )}
                     </div>
                  ) : (
                    <input 
                      type={f.type} 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-sm focus:outline-none focus:border-slate-500 focus:bg-white transition-all" 
                      required={f.required} 
                      value={submission[f.label] || ''}
                      onChange={e => setSubmission({...submission, [f.label]: e.target.value})} 
                    />
                  )}
                </div>
              ))}

              <div className="bg-slate-50 p-6 rounded-sm border border-slate-200 space-y-6 mt-8">
                <div>
                  <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Primary Authority (Approval)</label>
                  <select className="w-full p-3 bg-white border border-slate-300 rounded-sm text-sm" value={targetDept} onChange={e => setTargetDept(e.target.value)} required>
                    <option value="">Select Department...</option>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Cross-Functional Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {departments.map(d => (
                      <button type="button" key={d.id} onClick={() => toggleSubDept(d.name)}
                        className={`px-3 py-1.5 rounded-sm text-xs font-semibold border transition-colors ${subDepts.includes(d.name) ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'}`}>
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                 <Button variant="ghost" onClick={() => { setActiveForm(null); setEditingIdeaId(null); }}>Cancel</Button>
                 <Button variant="primary" type="submit" className="px-8" disabled={uploading}>{editingIdeaId ? "Update Proposal" : "Submit Proposal"}</Button>
              </div>
            </form>
        </Modal>

      </div>

      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-slate-400" />
          My History
        </h3>
        <div className="space-y-4">
           {myIdeas.length === 0 && <div className="text-sm text-slate-400 italic">No submissions found.</div>}
           {myIdeas.map(idea => (
             <IdeaCard 
                key={idea.id} 
                idea={idea} 
                isEmployeeView={true} 
                onComment={handleComment} 
                onUpdateComment={handleUpdateComment}
                onEditIdea={handleEditIdea}
                onDeleteIdea={idea.status === STATUS.PENDING || idea.status === STATUS.REJECTED ? handleDeleteIdea : null}
                currentUser={currentUser}
             />
           ))}
        </div>
      </div>
    </div>
  );
};

const ManagerPortal = ({ currentUser, showToast }) => {
  const [ideas, setIdeas] = useState([]);
  const [filter, setFilter] = useState('all');
  const [kpis, setKpis] = useState([]); // Fetch KPIs for Manager

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS), s => {
      setIdeas(s.docs.map(d => ({id:d.id, ...d.data()})));
    });
    
    // Fetch KPIs
    const unsub2 = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.KPIS, 'config'), s => {
      if (s.exists()) setKpis(s.data().list);
      else setKpis(DEFAULT_KPIS);
    });

    return () => { unsub1(); unsub2(); };
  }, []);

  const handleStatus = useCallback(async (id, status) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id), {
      status, reviewedBy: currentUser.name, reviewedAt: new Date().toISOString()
    });
    showToast(`Proposal status updated: ${status}`);
  }, [currentUser, showToast]);

  const handleComment = useCallback(async (id, text) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id), {
      comments: arrayUnion({ 
        id: Date.now(), 
        author: currentUser.name, 
        text, 
        date: new Date().toISOString() 
      })
    });
    showToast("Feedback recorded");
  }, [currentUser, showToast]);

  const handleUpdateComment = useCallback(async (ideaId, updatedComments) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, ideaId), {
      comments: updatedComments
    });
    showToast("Comment updated");
  }, [showToast]);

  const handleTogglePublic = useCallback(async (id, isPublic) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id), {
      isPublic: isPublic
    });
    showToast(isPublic ? "Idea published to showcase" : "Idea unpublished");
  }, [showToast]);

  const handleRate = useCallback(async (id, ratingResult) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id), {
       rating: ratingResult
    });
    showToast("Rating saved successfully.");
  }, [showToast]);

  const myDeptIdeas = useMemo(() => ideas.filter(i => i.mainDepartment === currentUser.department), [ideas, currentUser]);
  const otherIdeas = useMemo(() => ideas.filter(i => i.mainDepartment !== currentUser.department), [ideas, currentUser]);
  const displayedIdeas = useMemo(() => filter === 'myDept' ? myDeptIdeas : [...myDeptIdeas, ...otherIdeas], [filter, myDeptIdeas, otherIdeas]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Executive Overview</h2>
          <p className="text-slate-500">Review and approve operational proposals.</p>
        </div>
        <div className="flex bg-white rounded-sm shadow-sm border border-slate-200 p-1">
          <button onClick={() => setFilter('all')} className={`px-6 py-2 text-sm rounded-sm font-semibold transition-all ${filter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-900'}`}>Global View</button>
          <button onClick={() => setFilter('myDept')} className={`px-6 py-2 text-sm rounded-sm font-semibold transition-all ${filter === 'myDept' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-900'}`}>My Department</button>
        </div>
      </div>

      <div className="space-y-4">
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
            onRate={handleRate} // Pass rating handler
            kpis={kpis} // Pass KPIs
          />
        ))}
        {displayedIdeas.length === 0 && (
          <div className="p-12 text-center border-2 border-dashed border-slate-300 rounded-sm">
             <div className="text-slate-400 font-medium">No pending proposals found in this view.</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ... [Include other existing components: GuestView, LoginPage, RegisterPage, PublicShowcase, IdeaBankApp main component]

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