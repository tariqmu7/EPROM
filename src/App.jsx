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
  UserPlus, Layout, Filter, ChevronDown, ChevronUp, Send
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

// --- Helper Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100",
    danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
    success: "bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100"
  };

  return (
    <button type={type} onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} disabled={disabled}>
      {children}
    </button>
  );
};

const Input = ({ label, type = "text", value, onChange, placeholder, required = false }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
      required={required}
    />
  </div>
);

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
    {children}
  </div>
);

const Badge = ({ status }) => {
  const styles = {
    [STATUS.PENDING]: "bg-yellow-100 text-yellow-800",
    [STATUS.APPROVED]: "bg-green-100 text-green-800",
    [STATUS.REJECTED]: "bg-red-100 text-red-800",
    [ROLES.ADMIN]: "bg-purple-100 text-purple-800",
    [ROLES.MANAGER]: "bg-blue-100 text-blue-800",
    [ROLES.EMPLOYEE]: "bg-gray-100 text-gray-800"
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide ${styles[status] || "bg-gray-100"}`}>
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
      showToast("Request sent to Admin!", "success");
      setView('login');
    } catch (err) {
      showToast("Registration failed", "error");
    }
  };

  if (!authUser && loading) return <div className="h-screen flex items-center justify-center text-indigo-600">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.message}
        </div>
      )}

      {view === 'login' && <LoginPage onLogin={handleLogin} onGoRegister={() => setView('register')} />}
      {view === 'register' && <RegisterPage onRegister={handleRegister} onBack={() => setView('login')} />}
      
      {currentUser && (
        <>
          <nav className="bg-indigo-700 text-white shadow-md sticky top-0 z-30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-2">
                  <img src="/logo.jpg" alt="Idea Bank" className="w-8 h-8 rounded-full object-cover border border-indigo-400 bg-white" />
                  <span className="font-bold text-xl">Idea Bank</span>
                  <span className="ml-2 px-2 py-0.5 rounded text-xs bg-indigo-800 text-indigo-200 uppercase">
                    {currentUser.role}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-indigo-200 hidden md:inline">
                    {currentUser.name} | {currentUser.department || 'Admin'}
                  </span>
                  <Button variant="ghost" onClick={() => { setCurrentUser(null); setView('login'); }} className="text-white hover:bg-indigo-600">
                    <LogOut className="w-4 h-4" /> <span className="hidden md:inline">Logout</span>
                  </Button>
                </div>
              </div>
            </div>
          </nav>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {view === ROLES.ADMIN && <AdminPortal showToast={showToast} />}
            {view === ROLES.MANAGER && <ManagerPortal currentUser={currentUser} showToast={showToast} />}
            {view === ROLES.EMPLOYEE && <EmployeePortal currentUser={currentUser} showToast={showToast} />}
          </main>
        </>
      )}
    </div>
  );
}

// --- Auth Components ---

const LoginPage = ({ onLogin, onGoRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(ROLES.EMPLOYEE);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-blue-100">
      <div className="mb-8 flex flex-col items-center text-center">
        {/* LOGO IMPLEMENTATION */}
        <img src="/logo.jpg" alt="Idea Bank Logo" className="w-24 h-24 rounded-2xl shadow-lg mb-6 object-cover border-4 border-white" />
        <h1 className="text-4xl font-extrabold text-gray-900">Idea Bank</h1>
        <p className="text-gray-600 mt-2">Innovate. Collaborate. Execute.</p>
      </div>

      <Card className="w-full max-w-md p-8 shadow-xl border-t-4 border-indigo-600">
        <h2 className="text-2xl font-bold mb-6 text-center">Welcome Back</h2>
        
        <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
          {[ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.ADMIN].map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                role === r ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onLogin(email, password, role); }}>
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button variant="primary" type="submit" className="w-full mt-4 h-11">Login</Button>
        </form>

        <div className="mt-6 text-center pt-6 border-t border-gray-100">
          <p className="text-sm text-gray-500 mb-3">No account yet?</p>
          <Button variant="secondary" onClick={onGoRegister} className="w-full">Request Access</Button>
        </div>
      </Card>
      <p className="mt-8 text-xs text-gray-400">Admin Demo: admin@ideabank.com / admin123</p>
    </div>
  );
};

const RegisterPage = ({ onRegister, onBack }) => {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <h2 className="text-2xl font-bold mb-2 text-indigo-700">Join the Team</h2>
        <p className="text-gray-600 mb-6 text-sm">Create an account to start submitting ideas.</p>
        <form onSubmit={(e) => { e.preventDefault(); onRegister(form); }}>
          <Input label="Full Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} required />
          <div className="flex gap-3 mt-6">
            <Button variant="ghost" onClick={onBack} className="flex-1">Cancel</Button>
            <Button variant="primary" type="submit" className="flex-1">Submit</Button>
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
    // FIX: Removed password reset logic so user keeps original password
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS, id), {
      status: STATUS.APPROVED,
      role,
      department: dept
    });
    showToast("User approved successfully");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="space-y-2">
        {['users', 'forms', 'departments'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full text-left px-4 py-3 rounded-lg capitalize ${activeTab === tab ? 'bg-indigo-100 text-indigo-700 font-bold' : 'bg-white hover:bg-gray-50'}`}>
            {tab}
          </button>
        ))}
      </div>
      <div className="md:col-span-3">
        {activeTab === 'users' && <UserManagement users={users} departments={departments} onApprove={approveUser} />}
        {activeTab === 'forms' && <FormBuilder forms={forms} showToast={showToast} />}
        {activeTab === 'departments' && <DepartmentManager departments={departments} showToast={showToast} />}
      </div>
    </div>
  );
};

// --- Employee Portal (Updated for Routing) ---

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
      mainDepartment: targetDept, // Routing Logic
      subDepartments: subDepts,   // Categorization Logic
      submittedAt: new Date().toISOString(),
      comments: []
    });
    showToast("Idea Submitted!");
    setActiveForm(null); setSubmission({}); setTargetDept(''); setSubDepts([]);
  };

  const toggleSubDept = (deptName) => {
    setSubDepts(prev => prev.includes(deptName) ? prev.filter(d => d !== deptName) : [...prev, deptName]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        {!activeForm ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {forms.map(form => (
              <button key={form.id} onClick={() => setActiveForm(form)} className="p-6 bg-white rounded-xl shadow-sm border hover:border-indigo-500 hover:shadow-md transition-all text-left group">
                <div className="font-bold text-lg text-gray-800 group-hover:text-indigo-600">{form.title}</div>
                <div className="text-sm text-gray-500 mt-1">{form.category}</div>
              </button>
            ))}
          </div>
        ) : (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold">{activeForm.title}</h3>
              <Button variant="ghost" onClick={() => setActiveForm(null)}>Cancel</Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Dynamic Fields */}
              {activeForm.fields.map((f, i) => (
                <div key={i}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea className="w-full px-3 py-2 border rounded-md" required={f.required} onChange={e => setSubmission({...submission, [f.label]: e.target.value})} />
                  ) : (
                    <input type={f.type} className="w-full px-3 py-2 border rounded-md" required={f.required} onChange={e => setSubmission({...submission, [f.label]: e.target.value})} />
                  )}
                </div>
              ))}

              {/* Routing & Categorization */}
              <div className="bg-indigo-50 p-4 rounded-lg space-y-4">
                <div>
                  <label className="block text-sm font-bold text-indigo-900 mb-2">Target Department (Approval Authority)</label>
                  <select className="w-full p-2 rounded border border-indigo-200" value={targetDept} onChange={e => setTargetDept(e.target.value)} required>
                    <option value="">Select Department...</option>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-indigo-900 mb-2">Related Categories (Select Multiple)</label>
                  <div className="flex flex-wrap gap-2">
                    {departments.map(d => (
                      <button type="button" key={d.id} onClick={() => toggleSubDept(d.name)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${subDepts.includes(d.name) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <Button type="submit" className="w-full h-12">Submit Idea</Button>
            </form>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-gray-700">My Ideas</h3>
        {myIdeas.map(idea => (
          <IdeaCard key={idea.id} idea={idea} isEmployeeView={true} />
        ))}
      </div>
    </div>
  );
};

// --- Manager Portal (Updated for Logic) ---

const ManagerPortal = ({ currentUser, showToast }) => {
  const [ideas, setIdeas] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' or 'myDept'

  useEffect(() => {
    // Fetch ALL ideas so manager can comment on everything
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS), s => {
      setIdeas(s.docs.map(d => ({id:d.id, ...d.data()})));
    });
    return () => unsub();
  }, []);

  const handleStatus = async (id, status) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id), {
      status, reviewedBy: currentUser.name, reviewedAt: new Date().toISOString()
    });
    showToast(`Idea ${status}`);
  };

  const handleComment = async (id, text) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, id), {
      comments: arrayUnion({ author: currentUser.name, text, date: new Date().toISOString() })
    });
    showToast("Comment added");
  };

  const myDeptIdeas = ideas.filter(i => i.mainDepartment === currentUser.department);
  const otherIdeas = ideas.filter(i => i.mainDepartment !== currentUser.department);
  const displayedIdeas = filter === 'myDept' ? myDeptIdeas : [...myDeptIdeas, ...otherIdeas];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Manager Dashboard</h2>
        <div className="flex bg-white rounded-lg shadow-sm border p-1">
          <button onClick={() => setFilter('all')} className={`px-4 py-1.5 text-sm rounded-md font-medium ${filter === 'all' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500'}`}>All Ideas</button>
          <button onClick={() => setFilter('myDept')} className={`px-4 py-1.5 text-sm rounded-md font-medium ${filter === 'myDept' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500'}`}>My Department ({myDeptIdeas.length})</button>
        </div>
      </div>

      <div className="grid gap-6">
        {displayedIdeas.map(idea => (
          <IdeaCard 
            key={idea.id} 
            idea={idea} 
            isManager={true} 
            canApprove={idea.mainDepartment === currentUser.department} // ONLY approve if main dept matches
            onStatus={handleStatus} 
            onComment={handleComment} 
          />
        ))}
        {displayedIdeas.length === 0 && <div className="text-center py-12 text-gray-400">No ideas found.</div>}
      </div>
    </div>
  );
};

// --- Shared Idea Card Component ---

const IdeaCard = ({ idea, isManager, canApprove, onStatus, onComment, isEmployeeView }) => {
  const [comment, setComment] = useState('');
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`p-5 transition-all ${isManager && canApprove && idea.status === STATUS.PENDING ? 'border-l-4 border-l-yellow-400' : 'border-l-4 border-l-gray-300'}`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge status={idea.status} />
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">{idea.mainDepartment}</span>
          </div>
          <h4 className="font-bold text-lg text-gray-900">{idea.formTitle}</h4>
          <div className="text-xs text-gray-500 mt-1">
            Submitted by {idea.employeeName} on {new Date(idea.submittedAt).toLocaleDateString()}
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-indigo-600">
          {expanded ? <ChevronUp /> : <ChevronDown />}
        </button>
      </div>
      
      {/* Sub Categories Tags */}
      {idea.subDepartments && idea.subDepartments.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {idea.subDepartments.map(sub => (
            <span key={sub} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border">{sub}</span>
          ))}
        </div>
      )}

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {Object.entries(idea.formData).map(([k, v]) => (
              <div key={k}>
                <span className="text-xs font-bold text-gray-400 uppercase">{k}</span>
                <p className="text-sm text-gray-800">{v}</p>
              </div>
            ))}
          </div>

          {/* Comment Section */}
          <div className="bg-gray-50 rounded p-3 mb-4">
            <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">Discussion</h5>
            {idea.comments && idea.comments.length > 0 ? (
              <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                {idea.comments.map((c, i) => (
                  <div key={i} className="text-sm bg-white p-2 rounded border border-gray-100">
                    <span className="font-bold text-indigo-600 text-xs mr-2">{c.author}</span>
                    <span className="text-gray-700">{c.text}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-gray-400 italic mb-2">No comments yet.</p>}
            
            {(isManager || isEmployeeView) && (
               <div className="flex gap-2">
                 <input 
                   className="flex-1 text-sm px-3 py-1.5 border rounded" 
                   placeholder="Add a comment..." 
                   value={comment} 
                   onChange={e => setComment(e.target.value)} 
                   onKeyDown={e => {
                     if (e.key === 'Enter' && comment.trim()) {
                       // Employees can't technically add comments in this prototype unless we pass onComment to them too.
                       // For now, only Managers are hooked up via props.
                       if(onComment) { onComment(idea.id, comment); setComment(''); }
                     }
                   }}
                 />
                 {onComment && (
                   <button onClick={() => { onComment(idea.id, comment); setComment(''); }} disabled={!comment.trim()} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded">
                     <Send className="w-4 h-4" />
                   </button>
                 )}
               </div>
            )}
          </div>

          {/* Manager Actions (Only if Main Dept matches) */}
          {isManager && canApprove && idea.status === STATUS.PENDING && (
            <div className="flex gap-2 pt-2">
              <Button variant="danger" className="flex-1 py-1.5 text-sm" onClick={() => onStatus(idea.id, STATUS.REJECTED)}>Reject</Button>
              <Button variant="success" className="flex-1 py-1.5 text-sm" onClick={() => onStatus(idea.id, STATUS.APPROVED)}>Approve</Button>
            </div>
          )}
           
          {isManager && !canApprove && (
            <div className="text-center text-xs text-gray-400 italic pt-2">
              View only mode (Decision belongs to {idea.mainDepartment})
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

// --- Admin Sub-Components ---
// Simplified for brevity, same logic as before but with departments hook
const UserManagement = ({ users, departments, onApprove }) => {
  const pending = users.filter(u => u.status === STATUS.PENDING);
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-bold mb-4">Pending Approvals</h3>
        {pending.length === 0 ? <p className="text-gray-400">No requests.</p> : pending.map(u => (
          <div key={u.id} className="flex justify-between items-center bg-gray-50 p-3 rounded mb-2">
            <div><div className="font-bold">{u.name}</div><div className="text-xs text-gray-500">{u.email}</div></div>
            <UserApprovalRow user={u} depts={departments} onApprove={onApprove} />
          </div>
        ))}
      </Card>
    </div>
  );
};

const UserApprovalRow = ({ user, depts, onApprove }) => {
  const [role, setRole] = useState(ROLES.EMPLOYEE);
  const [dept, setDept] = useState('');
  return (
    <div className="flex gap-2">
      <select className="text-sm border rounded" value={role} onChange={e => setRole(e.target.value)}>
        <option value={ROLES.EMPLOYEE}>Employee</option><option value={ROLES.MANAGER}>Manager</option>
      </select>
      <select className="text-sm border rounded" value={dept} onChange={e => setDept(e.target.value)}>
        <option value="">Dept...</option>{depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
      </select>
      <Button variant="success" onClick={() => onApprove(user.id, role, dept)} disabled={!dept} className="px-2 py-1 text-xs">OK</Button>
    </div>
  );
};

const DepartmentManager = ({ departments, showToast }) => {
  const [name, setName] = useState('');
  const add = async () => {
    if(!name) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEPARTMENTS), { name });
    setName(''); showToast("Dept added");
  };
  return (
    <Card className="p-4">
      <h3 className="font-bold mb-4">Departments</h3>
      <div className="flex gap-2 mb-4"><Input value={name} onChange={e => setName(e.target.value)} placeholder="New Dept" /><Button onClick={add}><Plus className="w-4" /></Button></div>
      <div className="flex flex-wrap gap-2">{departments.map(d => <span key={d.id} className="bg-gray-100 px-3 py-1 rounded border">{d.name}</span>)}</div>
    </Card>
  );
};

const FormBuilder = ({ forms, showToast }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newForm, setNewForm] = useState({ category: '', title: '', fields: [] });
  const [field, setField] = useState({ label: '', type: 'text' });

  const save = async () => {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS), newForm);
    showToast("Form Saved"); setIsCreating(false); setNewForm({ category: '', title: '', fields: [] });
  };

  if(!isCreating) return (
    <Card className="p-4">
      <div className="flex justify-between mb-4"><h3 className="font-bold">Forms</h3><Button onClick={() => setIsCreating(true)}>Create</Button></div>
      <div className="grid gap-2">{forms.map(f => <div key={f.id} className="p-3 border rounded">{f.title} <span className="text-xs text-gray-500">({f.category})</span></div>)}</div>
    </Card>
  );

  return (
    <Card className="p-4">
      <h3 className="font-bold mb-4">New Form</h3>
      <Input label="Category" value={newForm.category} onChange={e => setNewForm({...newForm, category: e.target.value})} />
      <Input label="Title" value={newForm.title} onChange={e => setNewForm({...newForm, title: e.target.value})} />
      <div className="bg-gray-50 p-3 rounded mb-4">
        <h4 className="font-bold text-xs mb-2">Add Field</h4>
        <div className="flex gap-2">
          <input className="flex-1 border rounded px-2" placeholder="Label" value={field.label} onChange={e => setField({...field, label: e.target.value})} />
          <select className="border rounded px-2" value={field.type} onChange={e => setField({...field, type: e.target.value})}><option value="text">Text</option><option value="textarea">Area</option><option value="number">Num</option><option value="date">Date</option></select>
          <Button onClick={() => { setNewForm(prev => ({...prev, fields: [...prev.fields, field]})); setField({label:'', type:'text'}); }}>Add</Button>
        </div>
        <div className="mt-2 text-xs">{newForm.fields.map((f, i) => <span key={i} className="mr-2 bg-white border px-1 rounded">{f.label}</span>)}</div>
      </div>
      <div className="flex gap-2"><Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button><Button onClick={save}>Save</Button></div>
    </Card>
  );
};