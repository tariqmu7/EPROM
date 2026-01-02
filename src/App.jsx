import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, initializeFirestore, collection, addDoc, query, where, 
  onSnapshot, doc, updateDoc, deleteDoc, getDocs, getDoc, arrayUnion, setDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  Users, FileText, CheckCircle, XCircle, 
  LogOut, Plus, Trash2, MessageSquare, Briefcase, 
  UserPlus, Layout, Filter, ChevronDown, ChevronUp, Send, 
  BarChart3, Settings, Search, Menu, ImageOff, X, Upload, ExternalLink, Paperclip, Loader2, FileCheck, Pencil, Save, Share2, Globe, Lock, Eye, Printer
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
  GUESTS: 'guests'
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

const DEFAULT_ADMIN = {
  email: 'admin@ideabank.com',
  password: 'admin123', 
  role: ROLES.ADMIN,
  name: 'System Admin',
  status: STATUS.APPROVED
};

// --- Helper Components (Primitives) ---

const LoadingScreen = ({ message = "Loading..." }) => (
  <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
    <div className="w-8 h-8 border-4 border-slate-600 border-t-white rounded-full animate-spin mb-4"></div>
    <div className="text-sm font-medium tracking-widest uppercase">{message}</div>
  </div>
);

const Button = React.memo(({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false }) => {
  const baseStyle = "px-5 py-2.5 text-sm font-semibold tracking-wide transition-colors duration-200 flex items-center justify-center gap-2 rounded-sm focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-500 disabled:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 disabled:bg-red-200",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-600 disabled:bg-emerald-200",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  };

  return (
    <button type={type} onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} disabled={disabled}>
      {children}
    </button>
  );
});

const Input = React.memo(({ label, type = "text", value, onChange, placeholder, required = false }) => (
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
));

const Card = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-white border border-slate-200 shadow-sm rounded-sm ${className} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
    {children}
  </div>
);

const Badge = ({ status }) => {
  const styles = {
    [STATUS.PENDING]: "bg-amber-50 text-amber-700 border-amber-200",
    [STATUS.APPROVED]: "bg-emerald-50 text-emerald-700 border-emerald-200",
    [STATUS.REJECTED]: "bg-red-50 text-red-700 border-red-200",
    [ROLES.ADMIN]: "bg-slate-100 text-slate-700 border-slate-200",
    [ROLES.MANAGER]: "bg-blue-50 text-blue-700 border-blue-200",
    [ROLES.EMPLOYEE]: "bg-gray-50 text-gray-600 border-gray-200"
  };
  return (
    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border rounded-sm ${styles[status] || "bg-gray-100"}`}>
      {status}
    </span>
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

const IdeaCard = React.memo(({ idea, isManager, canApprove, onStatus, onComment, onUpdateComment, isEmployeeView, onEditIdea, onDeleteIdea, currentUser }) => {
  const [comment, setComment] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [tempCommentText, setTempCommentText] = useState('');

  // Helper to detect if a string is a URL
  const isUrl = (str) => {
    try { return Boolean(new URL(str)); } catch(e){ return false; }
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
              <Badge status={idea.status} />
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
        <div className="mb-6 flex items-center gap-4 border-b border-slate-100 pb-4">
           <Badge status={idea.status} />
           <div className="text-sm text-slate-500">
              Submitted by <span className="font-bold text-slate-900">{idea.employeeName}</span> on {new Date(idea.submittedAt).toLocaleDateString()}
           </div>
        </div>

        <div className="grid grid-cols-1 gap-6 py-2">
            {Object.entries(idea.formData).map(([k, v]) => (
              <div key={k} className="group">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 group-hover:text-slate-600 transition-colors">{k}</span>
                {isUrl(v) ? (
                   <a href={v} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:underline font-medium bg-blue-50 px-3 py-2 rounded-sm border border-blue-100">
                      <Paperclip className="w-4 h-4" /> View Attachment / Download
                   </a>
                ) : (
                   <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-sm border border-slate-100">{v}</p>
                )}
              </div>
            ))}
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
});

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
  const [newForm, setNewForm] = useState({ category: '', title: '', fields: [] });
  const [field, setField] = useState({ label: '', type: 'text' });

  const startEdit = (form) => {
    setNewForm(form);
    setEditingId(form.id);
    setIsCreating(true);
  };

  const save = async () => {
    if (editingId) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS, editingId), newForm);
      showToast("Template Updated");
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS), newForm);
      showToast("Template Saved");
    }
    setIsCreating(false);
    setEditingId(null);
    setNewForm({ category: '', title: '', fields: [] });
  };

  const cancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setNewForm({ category: '', title: '', fields: [] });
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
        <div className="flex gap-3 mb-4">
          <input className="flex-1 px-3 py-2 border border-slate-300 rounded-sm text-sm" placeholder="Field Label" value={field.label} onChange={e => setField({...field, label: e.target.value})} />
          <select className="px-3 py-2 border border-slate-300 rounded-sm text-sm bg-white" value={field.type} onChange={e => setField({...field, type: e.target.value})}>
            <option value="text">Text Input</option>
            <option value="textarea">Text Area</option>
            <option value="number">Numeric</option>
            <option value="date">Date Picker</option>
            <option value="file">File Attachment</option>
            <option value="image">Image Upload</option> {/* Added Image Type */}
          </select>
          <Button onClick={() => { if(field.label) { setNewForm(prev => ({...prev, fields: [...prev.fields, field]})); setField({label:'', type:'text'}); }}} variant="secondary">Add</Button>
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

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS), s => setUsers(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub2 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS), s => setForms(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub3 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEPARTMENTS), s => setDepartments(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub4 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.GUESTS), s => setGuests(s.docs.map(d => ({id:d.id, ...d.data()}))));
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, []);

  const approveUser = useCallback(async (id, role, dept) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS, id), {
      status: STATUS.APPROVED, role, department: dept
    });
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
                    <textarea 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-sm focus:outline-none focus:border-slate-500 focus:bg-white transition-all min-h-[120px]" 
                      required={f.required} 
                      value={submission[f.label] || ''}
                      onChange={e => setSubmission({...submission, [f.label]: e.target.value})} 
                    />
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

const GuestAuth = ({ onAccess }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('init'); // init, pending, approved

  const checkAccess = async (e) => {
    e.preventDefault();
    // Check if guest exists
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.GUESTS), where('email', '==', email));
    const snap = await getDocs(q);

    if (snap.empty) {
      // Request Access
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.GUESTS), { 
        email, status: STATUS.PENDING, requestedAt: new Date().toISOString() 
      });
      setStatus('pending');
    } else {
      const guest = snap.docs[0].data();
      if (guest.status === STATUS.APPROVED) {
        onAccess(email);
      } else {
        setStatus('pending');
      }
    }
  };

  if (status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Pending</h2>
          <p className="text-slate-500 mb-6">Your request has been sent to the administrator. Please wait for approval.</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>Check Again</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <Card className="w-full max-w-md p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Secure Report Access</h2>
        <p className="text-slate-500 mb-6">Please enter your email to view this confidential report.</p>
        <form onSubmit={checkAccess} className="space-y-4">
          <Input label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <Button variant="primary" type="submit" className="w-full h-12">View Report</Button>
        </form>
      </Card>
    </div>
  );
};

const GuestView = ({ ideaId }) => {
  const [idea, setIdea] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIdea = async () => {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, ideaId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setIdea(snap.data());
      }
      setLoading(false);
    };
    fetchIdea();
  }, [ideaId]);

  const isImage = (url) => {
    return url.match(/\.(jpeg|jpg|gif|png)$/) != null || url.includes('drive.google.com') === false; // Crude check, assuming Script returns direct links mostly
  };

  const printReport = () => {
    window.print();
  };

  if (loading) return <LoadingScreen message="Loading Report..." />;
  if (!idea) return <div className="text-center p-20 text-slate-500">Report not found or access denied.</div>;

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 print:bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12 print:px-0 print:py-0">
        <div className="mb-12 border-b border-slate-200 pb-8 print:border-none print:mb-6">
          <div className="flex justify-between items-start mb-6">
             <img src="./logo.jpg" alt="Logo" className="w-16 h-16 object-cover rounded-sm" />
             <div className="text-right">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Confidential Report</div>
                <div className="text-sm font-medium text-slate-600">{new Date(idea.submittedAt).toLocaleDateString()}</div>
             </div>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 leading-tight mb-4">{idea.formTitle}</h1>
          <div className="flex items-center gap-4 text-sm text-slate-500 print:hidden">
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {idea.employeeName}</span>
            <span>•</span>
            <span className="uppercase tracking-wide font-bold text-xs">{idea.mainDepartment}</span>
          </div>
        </div>

        <div className="space-y-12 print:space-y-6">
          {Object.entries(idea.formData).map(([k, v]) => (
            <div key={k} className="break-inside-avoid">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">{k}</h3>
              {v.startsWith('http') ? (
                 // Check if image or file link
                 isImage(v) || v.includes('googleusercontent') ? (
                    <img src={v} alt="Attachment" className="w-full rounded-lg shadow-md border border-slate-100 print:shadow-none" />
                 ) : (
                    <a href={v} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:underline bg-blue-50 px-4 py-3 rounded-md border border-blue-100 print:hidden">
                       <Paperclip className="w-5 h-5" /> View Attached Document
                    </a>
                 )
              ) : (
                 <div className="text-lg leading-relaxed text-slate-800 whitespace-pre-wrap">{v}</div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-slate-200 text-center text-slate-400 text-xs uppercase tracking-widest print:hidden">
           Generated by Idea Bank System • {new Date().getFullYear()}
        </div>

        {/* Floating Print Button for Guest */}
        <div className="fixed bottom-8 right-8 print:hidden">
          <Button onClick={printReport} className="shadow-xl rounded-full w-14 h-14 flex items-center justify-center p-0">
            <Printer className="w-6 h-6" />
          </Button>
        </div>
      </div>
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-slate-200">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-sm shadow-lg border-l-4 text-sm font-medium animate-fade-in ${toast.type === 'error' ? 'bg-white border-red-600 text-red-700' : 'bg-white border-emerald-600 text-emerald-700'}`}>
          {toast.message}
        </div>
      )}

      {view === 'login' && <LoginPage onLogin={handleLogin} onGoRegister={() => setView('register')} />}
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