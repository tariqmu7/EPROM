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
  BarChart3, Settings, Search, Menu, ImageOff
} from 'lucide-react';

// --- Firebase Configuration ---
// Your Personal Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAMOU-IK6UfKk75UR0P_Rs80z0uEsssQ9o",
  authDomain: "epromdeploy.firebaseapp.com",
  projectId: "epromdeploy",
  storageBucket: "epromdeploy.firebasestorage.app",
  messagingSenderId: "179394609832",
  appId: "1:179394609832:web:cf8d21ea2eef70990cb89d",
  measurementId: "G-X5GVRLDBQQ"
};

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

// --- Helper Components (Redesigned) ---

const Button = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false }) => {
  // Industrial, flat design style
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

const Card = ({ children, className = '' }) => (
  <div className={`bg-white border border-slate-200 shadow-sm rounded-sm ${className}`}>
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
          {/* Logo with Fallback and Larger Size */}
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

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEPARTMENTS), s => setDepartments(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub2 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS), s => setForms(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS), where('employeeId', '==', currentUser.id));
    const unsub3 = onSnapshot(q, s => setMyIdeas(s.docs.map(d => ({id:d.id, ...d.data()}))));
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [currentUser]);

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
        {!activeForm ? (
           <>
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
           </>
        ) : (
          <Card className="p-8">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">{activeForm.title}</h3>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">New Submission</span>
              </div>
              <Button variant="ghost" onClick={() => setActiveForm(null)}>Cancel</Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {activeForm.fields.map((f, i) => (
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
              <div className="pt-4">
                 <Button variant="primary" type="submit" className="w-full h-12 text-base">Submit Proposal</Button>
              </div>
            </form>
          </Card>
        )}
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

// --- Manager Portal ---

const ManagerPortal = ({ currentUser, showToast }) => {
  const [ideas, setIdeas] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS), s => {
      setIdeas(s.docs.map(d => ({id:d.id, ...d.data()})));
    });
    return () => unsub();
  }, []);

  const handleStatus = async (id, status) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id), {
      status, reviewedBy: currentUser.name, reviewedAt: new Date().toISOString()
    });
    showToast(`Proposal status updated: ${status}`);
  };

  const handleComment = async (id, text) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id), {
      comments: arrayUnion({ author: currentUser.name, text, date: new Date().toISOString() })
    });
    showToast("Feedback recorded");
  };

  const myDeptIdeas = ideas.filter(i => i.mainDepartment === currentUser.department);
  const otherIdeas = ideas.filter(i => i.mainDepartment !== currentUser.department);
  const displayedIdeas = filter === 'myDept' ? myDeptIdeas : [...myDeptIdeas, ...otherIdeas];

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

// --- Shared Idea Card Component ---

const IdeaCard = ({ idea, isManager, canApprove, onStatus, onComment, isEmployeeView }) => {
  const [comment, setComment] = useState('');
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${isManager && canApprove && idea.status === STATUS.PENDING ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-transparent'}`}>
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
          <button onClick={() => setExpanded(!expanded)} className="ml-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
        
        {idea.subDepartments && idea.subDepartments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {idea.subDepartments.map(sub => (
              <span key={sub} className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-sm">{sub}</span>
            ))}
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 animate-fade-in">
          <div className="grid grid-cols-1 gap-6 py-6">
            {Object.entries(idea.formData).map(([k, v]) => (
              <div key={k} className="group">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 group-hover:text-slate-600 transition-colors">{k}</span>
                <p className="text-sm text-slate-800 leading-relaxed">{v}</p>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 border border-slate-100 p-4 rounded-sm mb-6">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
               <MessageSquare className="w-3 h-3" /> Executive Feedback
            </h5>
            {idea.comments && idea.comments.length > 0 ? (
              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                {idea.comments.map((c, i) => (
                  <div key={i} className="text-sm bg-white p-3 rounded-sm border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-900 text-xs">{c.author}</span>
                      <span className="text-[10px] text-slate-400">{new Date(c.date).toLocaleDateString()}</span>
                    </div>
                    <span className="text-slate-600">{c.text}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-slate-400 italic mb-4">No feedback recorded yet.</p>}
            
            {(isManager || isEmployeeView) && (
               <div className="flex gap-2">
                 <input 
                   className="flex-1 text-sm px-3 py-2 border border-slate-300 rounded-sm focus:outline-none focus:border-slate-500" 
                   placeholder="Type your comment..." 
                   value={comment} 
                   onChange={e => setComment(e.target.value)} 
                   onKeyDown={e => { if (e.key === 'Enter' && comment.trim() && onComment) { onComment(idea.id, comment); setComment(''); }}}
                 />
                 {onComment && (
                   <button onClick={() => { onComment(idea.id, comment); setComment(''); }} disabled={!comment.trim()} className="bg-slate-800 text-white hover:bg-slate-700 px-3 py-2 rounded-sm disabled:bg-slate-300">
                     <Send className="w-4 h-4" />
                   </button>
                 )}
               </div>
            )}
          </div>

          {isManager && canApprove && idea.status === STATUS.PENDING && (
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <Button variant="danger" className="flex-1" onClick={() => onStatus(idea.id, STATUS.REJECTED)}>Reject Proposal</Button>
              <Button variant="success" className="flex-1" onClick={() => onStatus(idea.id, STATUS.APPROVED)}>Authorize</Button>
            </div>
          )}
           
          {isManager && !canApprove && (
            <div className="text-center text-xs text-slate-400 italic pt-2 flex items-center justify-center gap-2">
              <XCircle className="w-4 h-4" /> Read Only: Authority lies with {idea.mainDepartment}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

// --- Admin Sub-Components ---

const UserManagement = ({ users, departments, onApprove }) => {
  const pending = users.filter(u => u.status === STATUS.PENDING);
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
         <UserPlus className="w-5 h-5 text-slate-900" />
         <h3 className="font-bold text-lg text-slate-900">Pending Access Requests</h3>
      </div>
      {pending.length === 0 ? (
        <div className="text-slate-400 text-sm italic py-4">No pending requests at this time.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {pending.map(u => (
            <div key={u.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="font-bold text-slate-900">{u.name}</div>
                <div className="text-xs text-slate-500 font-mono">{u.email}</div>
              </div>
              <UserApprovalRow user={u} depts={departments} onApprove={onApprove} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

const UserApprovalRow = ({ user, depts, onApprove }) => {
  const [role, setRole] = useState(ROLES.EMPLOYEE);
  const [dept, setDept] = useState('');
  return (
    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-sm border border-slate-200">
      <select className="text-xs border-none bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer" value={role} onChange={e => setRole(e.target.value)}>
        <option value={ROLES.EMPLOYEE}>Employee</option><option value={ROLES.MANAGER}>Manager</option>
      </select>
      <div className="w-px h-4 bg-slate-300"></div>
      <select className="text-xs border-none bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer w-32" value={dept} onChange={e => setDept(e.target.value)}>
        <option value="">Select Dept...</option>{depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
      </select>
      <Button variant="success" onClick={() => onApprove(user.id, role, dept)} disabled={!dept} className="py-1 px-3 text-xs h-7">Approve</Button>
    </div>
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
  const [newForm, setNewForm] = useState({ category: '', title: '', fields: [] });
  const [field, setField] = useState({ label: '', type: 'text' });

  const save = async () => {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS), newForm);
    showToast("Template Saved"); setIsCreating(false); setNewForm({ category: '', title: '', fields: [] });
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
            <span className="font-bold text-slate-800">{f.title}</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{f.category}</span>
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <Card className="p-8 border-l-4 border-l-slate-900">
      <h3 className="font-bold text-xl text-slate-900 mb-6">Design New Template</h3>
      <div className="space-y-4 mb-8">
        <Input label="Category" value={newForm.category} onChange={e => setNewForm({...newForm, category: e.target.value})} placeholder="e.g. Health & Safety" />
        <Input label="Title" value={newForm.title} onChange={e => setNewForm({...newForm, title: e.target.value})} placeholder="e.g. Incident Report" />
      </div>

      <div className="bg-slate-50 p-6 rounded-sm border border-slate-200 mb-8">
        <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4">Field Configuration</h4>
        <div className="flex gap-3 mb-4">
          <input className="flex-1 px-3 py-2 border border-slate-300 rounded-sm text-sm" placeholder="Field Label" value={field.label} onChange={e => setField({...field, label: e.target.value})} />
          <select className="px-3 py-2 border border-slate-300 rounded-sm text-sm bg-white" value={field.type} onChange={e => setField({...field, type: e.target.value})}>
            <option value="text">Text Input</option><option value="textarea">Text Area</option><option value="number">Numeric</option><option value="date">Date Picker</option>
          </select>
          <Button onClick={() => { if(field.label) { setNewForm(prev => ({...prev, fields: [...prev.fields, field]})); setField({label:'', type:'text'}); }}} variant="secondary">Add</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {newForm.fields.map((f, i) => (
            <span key={i} className="bg-white border border-slate-300 px-3 py-1 rounded-sm text-xs font-mono text-slate-600 flex items-center gap-2">
              {f.label} <span className="opacity-50">({f.type})</span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={() => setIsCreating(false)}>Discard</Button>
        <Button onClick={save} variant="primary">Publish Template</Button>
      </div>
    </Card>
  );
};