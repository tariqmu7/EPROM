import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, initializeFirestore, collection, addDoc, query, where, 
  onSnapshot, doc, updateDoc, deleteDoc, getDocs, arrayUnion 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  Users, FileText, CheckCircle, XCircle, 
  LogOut, Plus, Trash2, MessageSquare, Briefcase, 
  UserPlus, Layout, Filter, ChevronDown, ChevronUp, Send, 
  BarChart3, Settings, Search, Menu, ImageOff, X, Upload, ExternalLink, Paperclip, Loader2, FileCheck
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

// 2. Google Apps Script Web App URL (PASTE YOUR DEPLOYED SCRIPT URL HERE)
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
  DEPARTMENTS: 'departments'
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

// --- Helper Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false }) => {
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
};

const Input = ({ label, type = "text", value, onChange, placeholder, required = false }) => (
  <div className="mb-5">
    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
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

// Modal Component
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

// --- Main App Component ---

export default function IdeaBankApp() {
  const [authUser, setAuthUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('login'); 
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      await signInAnonymously(auth);
    };
    initAuth();
    
    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) setLoading(false);
    });
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = async (email, password, requestedRole) => {
    setLoading(true);
    try {
      if (email === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) {
        if (requestedRole !== ROLES.ADMIN) throw new Error("Invalid portal for these credentials.");
        setCurrentUser({ ...DEFAULT_ADMIN, id: 'admin-master' });
        setView('admin');
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
      if (userData.role !== requestedRole) throw new Error(`Access denied for ${requestedRole} portal.`);

      setCurrentUser(userData);
      setView(userData.role);

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
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

  if (!authUser && loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
      <div className="w-8 h-8 border-4 border-slate-600 border-t-white rounded-full animate-spin mb-4"></div>
      <div className="text-sm font-medium tracking-widest uppercase">Initializing Secure Connection</div>
    </div>
  );

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
                    {/* Fixed Path & Size */}
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
                <Button variant="ghost" onClick={() => { setCurrentUser(null); setView('login'); }} className="text-slate-400 hover:text-white hover:bg-slate-800">
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

// --- Auth Components ---

const LoginPage = ({ onLogin, onGoRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(ROLES.EMPLOYEE);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Left: Brand Side */}
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

      {/* Right: Login Form */}
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

          <Card className="p-1 mb-8 bg-slate-50 border-none">
            <div className="flex">
              {[ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.ADMIN].map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wide rounded-sm transition-all ${
                    role === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </Card>

          <form onSubmit={(e) => { e.preventDefault(); onLogin(email, password, role); }} className="space-y-4">
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

// --- Portal Components ---

const AdminPortal = ({ showToast }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [forms, setForms] = useState([]);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS), s => setUsers(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub2 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS), s => setForms(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub3 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEPARTMENTS), s => setDepartments(s.docs.map(d => ({id:d.id, ...d.data()}))));
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const approveUser = async (id, role, dept) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS, id), {
      status: STATUS.APPROVED, role, department: dept
    });
    showToast("User access granted.");
  };

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
          {activeTab === 'users' && <UserManagement users={users} departments={departments} onApprove={approveUser} />}
          {activeTab === 'forms' && <FormBuilder forms={forms} showToast={showToast} />}
          {activeTab === 'departments' && <DepartmentManager departments={departments} showToast={showToast} />}
        </div>
      </div>
    </div>
  );
};

// --- Employee Portal ---

const EmployeePortal = ({ currentUser, showToast }) => {
  const [departments, setDepartments] = useState([]);
  const [forms, setForms] = useState([]);
  const [myIdeas, setMyIdeas] = useState([]);
  const [activeForm, setActiveForm] = useState(null);
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

  const handleFileUpload = async (file, label) => {
    if (!file) return;
    setUploading(true);
    
    // Google Apps Script Upload Strategy
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      // Clean Base64 string
      const base64 = reader.result.split(',')[1];
      const payload = {
        filename: file.name,
        mimeType: file.type,
        bytes: base64
      };

      try {
        // Send to Google Script
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetDept) return showToast("Please select a target department", "error");
    
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS), {
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      status: STATUS.PENDING,
      formTitle: activeForm.title,
      formData: submission,
      mainDepartment: targetDept,
      subDepartments: subDepts,
      submittedAt: new Date().toISOString(),
      comments: []
    });
    showToast("Proposal Submitted Successfully");
    setActiveForm(null); setSubmission({}); setTargetDept(''); setSubDepts([]);
  };

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
            <button key={form.id} onClick={() => setActiveForm(form)} className="flex items-start p-6 bg-white border border-slate-200 rounded-sm hover:border-slate-400 hover:shadow-md transition-all text-left group">
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
        <Modal isOpen={!!activeForm} onClose={() => setActiveForm(null)} title={activeForm?.title || "New Submission"}>
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
                      onChange={e => setSubmission({...submission, [f.label]: e.target.value})} 
                    />
                  ) : f.type === 'file' ? (
                     <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm">
                        <div className="flex items-center gap-4">
                           <label className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-sm cursor-pointer hover:bg-slate-700 transition-colors">
                              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                              <span>{uploading ? "Uploading to Drive..." : "Select File"}</span>
                              <input 
                                type="file" 
                                className="hidden" 
                                onChange={(e) => handleFileUpload(e.target.files[0], f.label)}
                                disabled={uploading}
                              />
                           </label>
                           {submission[f.label] ? (
                             <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                               <FileCheck className="w-4 h-4" /> Uploaded to Drive
                             </div>
                           ) : <span className="text-xs text-slate-400">Supported formats: PDF, IMG, DOC</span>}
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
                 <Button variant="ghost" onClick={() => setActiveForm(null)}>Cancel</Button>
                 <Button variant="primary" type="submit" className="px-8" disabled={uploading}>Submit Proposal</Button>
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
             <IdeaCard key={idea.id} idea={idea} isEmployeeView={true} />
           ))}
        </div>
      </div>
    </div>
  );
};