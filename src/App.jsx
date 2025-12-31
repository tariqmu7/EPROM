import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminDashboard from './pages/AdminDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import './App.css';

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }) {
  const { user, token } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/manager"
        element={
          <ProtectedRoute allowedRoles={['manager']}>
            <ManagerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/employee"
        element={
          <ProtectedRoute allowedRoles={['employee']}>
            <EmployeeDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;

  const [user, setUser] = useState(null); 
  const [userData, setUserData] = useState(null); 
  const [view, setView] = useState('landing'); // landing, login-admin, login-employee, admin, manager, employee
  const [loading, setLoading] = useState(true);

  // --- Auth Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u && u.email) {
        setUser(u);
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('email', '==', u.email));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
          setUserData(data);
          // Auto-redirect if on login/landing pages
          if (['landing', 'login-admin', 'login-employee'].includes(view) && data.role) {
             setView(data.role);
          }
        } else {
            // Edge Case: User authenticated in Firebase Auth, but missing from Firestore
            if (u.email === 'adminT124@EPROM.com') {
                 // Auto-heal the admin account
                 const newAdmin = { 
                    email: u.email, 
                    role: 'admin', 
                    name: 'Main Admin', 
                    status: 'active', 
                    dept: 'Management',
                    createdAt: serverTimestamp()
                };
                const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'users'), newAdmin);
                setUserData({ id: docRef.id, ...newAdmin });
                setView('admin');
            } else {
                // Unknown user without profile -> Force logout to prevent sticking
                console.log("No profile found for user, signing out.");
                await signOut(auth);
                setUser(null);
                setUserData(null);
            }
        }
      } else {
        setUser(null);
        setUserData(null);
        // Only reset view if we were logged in
        if (['admin', 'manager', 'employee'].includes(view)) {
            setView('landing');
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [view]); // Added view dependency to ensure redirects happen if view state is stale

  // --- Views ---

  const LandingPage = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md p-8 text-center space-y-8">
        <div>
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Lightbulb className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Idea Bank</h1>
            <p className="text-slate-500">Innovation Management System</p>
        </div>
        <div className="space-y-4">
            <button onClick={() => setView('login-employee')} className="w-full p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-indigo-600 hover:bg-indigo-50 transition flex items-center justify-between group shadow-sm hover:shadow-md">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-100 p-2.5 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition"><Users className="w-5 h-5" /></div>
                    <div className="text-left">
                        <span className="block font-bold text-slate-800">Employee Portal</span>
                        <span className="text-xs text-slate-500">Submit & Track Ideas</span>
                    </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600" />
            </button>
            <button onClick={() => setView('login-admin')} className="w-full p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-800 hover:bg-slate-50 transition flex items-center justify-between group shadow-sm hover:shadow-md">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-100 p-2.5 rounded-lg text-slate-600 group-hover:bg-slate-800 group-hover:text-white transition"><Shield className="w-5 h-5" /></div>
                    <div className="text-left">
                        <span className="block font-bold text-slate-800">Admin Portal</span>
                        <span className="text-xs text-slate-500">System Management</span>
                    </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-800" />
            </button>
        </div>
      </Card>
    </div>
  );

  const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoggingIn(true);
        const cleanEmail = email.trim();
        const cleanPass = password.trim();

        try {
            // 1. Try to login
            await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
            
            // 2. Force check profile immediately (don't wait for listener)
            const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('email', '==', cleanEmail));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                 const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                 setUserData(data);
                 setView(data.role);
            } else if (cleanEmail === 'adminT124@EPROM.com') {
                 // Recovery for admin
                 const newAdmin = { 
                    email: cleanEmail, 
                    role: 'admin', 
                    name: 'Main Admin', 
                    status: 'active', 
                    dept: 'Management',
                    createdAt: serverTimestamp()
                };
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'users'), newAdmin);
                setView('admin');
            } else {
                setError("Profile not found.");
                setIsLoggingIn(false);
            }

        } catch (err) {
            // Check if user is trying to use the "Master Key" credentials but failed login (e.g. user doesn't exist yet)
            const isMasterCreds = cleanEmail === 'adminT124@EPROM.com' && cleanPass === '124T124';
            
            if (isMasterCreds) {
                try {
                    // Try creating the account if it didn't exist
                    await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
                    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'users'), { 
                        email: cleanEmail, 
                        role: 'admin', 
                        name: 'Main Admin', 
                        status: 'active', 
                        dept: 'Management',
                        createdAt: serverTimestamp()
                    });
                    setView('admin');
                } catch (createErr) {
                    if (createErr.code === 'auth/email-already-in-use') {
                        setError("Admin account exists, but the password is NOT '124T124'. Please use your actual password.");
                    } else {
                        setError("Setup failed: " + createErr.message);
                    }
                    setIsLoggingIn(false);
                }
            } else {
                setError("Invalid credentials.");
                setIsLoggingIn(false);
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <Card className="w-full max-w-md p-8">
                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Admin Login</h2>
                    <p className="text-sm text-slate-500">Authorized Personnel Only</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div><label className="block text-sm font-medium mb-1">Email</label><input className="w-full p-2.5 border rounded-lg" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
                    <div><label className="block text-sm font-medium mb-1">Password</label><input type="password" className="w-full p-2.5 border rounded-lg" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
                    {error && <p className="text-rose-600 text-sm bg-rose-50 p-2 rounded">{error}</p>}
                    <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={isLoggingIn}>
                        {isLoggingIn ? <span className="flex items-center"><Loader className="w-4 h-4 mr-2 animate-spin"/> Verifying...</span> : "Login to Dashboard"}
                    </Button>
                </form>
                <button onClick={() => setView('landing')} className="w-full text-center mt-6 text-sm text-slate-500 hover:underline">← Back to Portal Selection</button>
            </Card>
        </div>
    );
  };

  const EmployeeAuth = () => {
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoggingIn(true);
        try {
            if (mode === 'signup') {
                await createUserWithEmailAndPassword(auth, email, password);
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'users'), {
                    email, role: 'employee', status: 'pending', dept: 'Unassigned', createdAt: serverTimestamp()
                });
                alert("Account created! Please wait for Admin approval.");
                // Note: Auth listener checks profile. If 'pending', we might want to show a message but for now they can login.
                // We'll let the listener handle the redirect logic.
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                // Listener handles redirect
            }
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                setError("Account exists. Please switch to Login.");
            } else {
                setError(err.message.replace('Firebase: ', ''));
            }
            setIsLoggingIn(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <Card className="w-full max-w-md p-8">
                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Employee Portal</h2>
                    <p className="text-sm text-slate-500">Welcome to Idea Bank</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
                    <button onClick={() => setMode('login')} className={`flex-1 py-2 text-xs font-bold rounded ${mode === 'login' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>Login</button>
                    <button onClick={() => setMode('signup')} className={`flex-1 py-2 text-xs font-bold rounded ${mode === 'signup' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>Sign Up</button>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div><label className="block text-sm font-medium mb-1">Company Email</label><input type="email" className="w-full p-2.5 border rounded-lg" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
                    <div><label className="block text-sm font-medium mb-1">Password</label><input type="password" className="w-full p-2.5 border rounded-lg" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
                    {error && <p className="text-rose-600 text-sm bg-rose-50 p-2 rounded">{error}</p>}
                    <Button type="submit" className="w-full" disabled={isLoggingIn}>
                        {isLoggingIn ? <span className="flex items-center"><Loader className="w-4 h-4 mr-2 animate-spin"/> Processing...</span> : (mode === 'signup' ? 'Create Account' : 'Login')}
                    </Button>
                </form>
                <button onClick={() => setView('landing')} className="w-full text-center mt-6 text-sm text-slate-500 hover:underline">← Back to Portal Selection</button>
            </Card>
        </div>
    );
  };

  // --- Portals ---

  const AdminPortal = () => {
    const [activeTab, setActiveTab] = useState('users'); 
    const [users, setUsers] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [newDept, setNewDept] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [formFields, setFormFields] = useState([{ label: 'Idea Title', type: 'text', required: true, locked: true }]);

    useEffect(() => {
        const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), (snap) => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubTemplates = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'templates'), (snap) => setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubDepts = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'departments'), (snap) => setDepartments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsubUsers(); unsubTemplates(); unsubDepts(); };
    }, []);

    const approveUser = async (userId, dept, role) => {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userId), { status: 'active', dept, role });
    };

    const addDepartment = async () => { if(newDept.trim()) { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'departments'), { name: newDept }); setNewDept(''); }};
    
    const saveTemplate = async () => {
        if (!newCategory || formFields.some(f => !f.label.trim())) return alert("Invalid Form");
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'templates'), { category: newCategory, fields: formFields });
        setNewCategory(''); setFormFields([{ label: 'Idea Title', type: 'text', required: true, locked: true }]);
    };

    const addField = () => setFormFields([...formFields, { label: '', type: 'text', required: false }]);
    const updateField = (idx, k, v) => { const u = [...formFields]; u[idx][k] = v; setFormFields(u); };
    const removeField = (i) => setFormFields(formFields.filter((_, x) => x !== i));

    return (
      <div className="p-6 max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div><h1 className="text-2xl font-bold text-slate-900">Admin Portal</h1><p className="text-slate-500">Logged in as: {userData.email}</p></div>
          <Button variant="outline" onClick={() => signOut(auth)}><LogOut className="w-4 h-4" /> Logout</Button>
        </header>
        <div className="flex gap-4 mb-6 overflow-x-auto pb-2">{['users', 'forms', 'depts'].map(tab => (<Button key={tab} variant={activeTab === tab ? 'primary' : 'outline'} onClick={() => setActiveTab(tab)} className="capitalize">{tab}</Button>))}</div>
        
        {activeTab === 'users' && (
            <div className="grid gap-4">
                <h3 className="font-bold text-lg">Pending Approvals</h3>
                {users.filter(u => u.status === 'pending').map(u => (
                    <Card key={u.id} className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div><div className="font-bold text-slate-800">{u.email}</div><div className="text-sm text-slate-500">New Request</div></div>
                        <div className="flex gap-2 flex-wrap">
                            <select id={`dept-${u.id}`} className="p-2 border rounded text-sm">{departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}</select>
                            <select id={`role-${u.id}`} className="p-2 border rounded text-sm"><option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option></select>
                            <Button variant="success" onClick={() => approveUser(u.id, document.getElementById(`dept-${u.id}`).value, document.getElementById(`role-${u.id}`).value)}>Approve</Button>
                        </div>
                    </Card>
                ))}
                {users.filter(u => u.status === 'pending').length === 0 && <p className="text-slate-400 italic">No pending requests.</p>}
                
                <h3 className="font-bold text-lg mt-8">Active Users</h3>
                <Card className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 border-b"><tr><th className="p-4">Email</th><th className="p-4">Role</th><th className="p-4">Dept</th></tr></thead><tbody>
                    {users.filter(u => u.status === 'active').map(u => (<tr key={u.id} className="border-b hover:bg-slate-50"><td className="p-4">{u.email}</td><td className="p-4 capitalize">{u.role}</td><td className="p-4">{u.dept}</td></tr>))}
                </tbody></table></Card>
            </div>
        )}

        {activeTab === 'depts' && (
             <div className="max-w-2xl"><div className="flex gap-2 mb-6"><input className="flex-1 p-2 border rounded" placeholder="New Department Name" value={newDept} onChange={e => setNewDept(e.target.value)} /><Button onClick={addDepartment} disabled={!newDept}>Add</Button></div><div className="grid grid-cols-2 gap-4">{departments.map(d => (<Card key={d.id} className="p-4 flex justify-between items-center"><span className="font-bold text-slate-700">{d.name}</span><button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'departments', d.id))} className="text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4"/></button></Card>))}</div></div>
        )}

        {activeTab === 'forms' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="p-6 space-y-4">
                    <input className="w-full p-2 border rounded" placeholder="Category Name" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
                    <div className="space-y-3">{formFields.map((field, idx) => (<div key={idx} className="bg-slate-50 p-3 rounded border space-y-2"><div className="flex gap-2"><input className="flex-1 p-1 border rounded text-sm" placeholder="Label" value={field.label} disabled={field.locked} onChange={e => updateField(idx, 'label', e.target.value)} /><select className="p-1 border rounded text-sm" value={field.type} disabled={field.locked} onChange={e => updateField(idx, 'type', e.target.value)}><option value="text">Text</option><option value="number">Number</option><option value="textarea">Long Text</option><option value="date">Date</option><option value="select">Dropdown</option><option value="file">Attachment</option></select>{!field.locked && <button onClick={() => removeField(idx)} className="text-rose-500"><XCircle className="w-5 h-5"/></button>}</div>{field.type === 'select' && <input className="w-full p-1 border rounded text-sm" placeholder="Options (comma separated)" value={field.options || ''} onChange={e => updateField(idx, 'options', e.target.value)} />}</div>))}<Button variant="outline" className="w-full text-sm" onClick={addField}>+ Field</Button></div>
                    <Button className="w-full" onClick={saveTemplate} disabled={!newCategory}>Save Template</Button>
                </Card>
                <div className="space-y-4">{templates.map(t => (<Card key={t.id} className="p-4 flex justify-between"><div><h4 className="font-bold text-indigo-700">{t.category}</h4><p className="text-xs text-slate-500">{t.fields.length} Fields</p></div><button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'templates', t.id))} className="text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button></Card>))}</div>
            </div>
        )}
      </div>
    );
  };

  const ManagerPortal = () => {
    const [ideas, setIdeas] = useState([]);
    useEffect(() => {
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'ideas'), where('department', '==', userData.dept));
        const unsubscribe = onSnapshot(q, (snap) => setIdeas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsubscribe();
    }, [userData]);
    const updateStatus = async (id, status) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'ideas', id), { status }); };

    return (
      <div className="p-6 max-w-6xl mx-auto"><header className="flex justify-between items-center mb-8"><div><h1 className="text-2xl font-bold text-slate-900">Manager Portal</h1><p className="text-slate-500">Dept: {userData.dept}</p></div><Button variant="outline" onClick={() => signOut(auth)}><LogOut className="w-4 h-4" /> Logout</Button></header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ideas.map(idea => (<Card key={idea.id} className="flex flex-col h-full"><div className="p-5 border-b border-slate-100 flex-1"><div className="flex justify-between items-start mb-2"><Badge status={idea.status} /><span className="text-xs text-slate-400">{new Date(idea.createdAt?.seconds * 1000).toLocaleDateString()}</span></div><h3 className="font-bold text-lg text-slate-800 mb-1">{idea.data['Idea Title']}</h3><div className="space-y-2 bg-slate-50 p-3 rounded text-sm mt-4">{Object.entries(idea.data).map(([key, val]) => (key !== 'Idea Title' && (<div key={key}><span className="font-bold text-slate-700 block text-xs uppercase">{key}</span>{key.includes('(Attachment)') ? (<a href={val} download={`attachment_${key}`} className="text-indigo-600 underline flex items-center gap-1"><Paperclip className="w-3 h-3"/> Download</a>) : <span className="text-slate-600 break-words">{val}</span>}</div>)))}</div><div className="mt-4 text-xs text-slate-400">By: {idea.submittedBy}</div></div>{idea.status === 'pending' && (<div className="p-4 bg-slate-50 flex gap-2"><Button variant="success" className="flex-1 text-sm" onClick={() => updateStatus(idea.id, 'approved')}>Approve</Button><Button variant="danger" className="flex-1 text-sm" onClick={() => updateStatus(idea.id, 'rejected')}>Reject</Button></div>)}</Card>))}
        </div>
      </div>
    );
  };

  const EmployeePortal = () => {
    const [activeTab, setActiveTab] = useState('submit');
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [formData, setFormData] = useState({});
    const [myIdeas, setMyIdeas] = useState([]);

    useEffect(() => {
        const unsubT = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'templates'), (snap) => { const data = snap.docs.map(d => ({ id: d.id, ...d.data() })); setTemplates(data); if(data.length > 0) setSelectedTemplate(data[0]); });
        const unsubI = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'ideas'), where('uid', '==', userData.id)), (snap) => setMyIdeas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsubT(); unsubI(); };
    }, [userData]);

    const handleFileChange = (label, e) => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setFormData(prev => ({ ...prev, [`${label} (Attachment)`]: reader.result })); }; reader.readAsDataURL(file); }};
    const submitIdea = async (e) => { e.preventDefault(); const cleanData = {}; Object.keys(formData).forEach(key => { if (formData[key]) cleanData[key] = formData[key]; }); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'ideas'), { uid: userData.id, submittedBy: userData.email, department: userData.dept, category: selectedTemplate.category, data: cleanData, status: 'pending', createdAt: serverTimestamp() }); setFormData({}); setActiveTab('my-ideas'); };

    return (
      <div className="p-6 max-w-6xl mx-auto"><header className="flex justify-between items-center mb-8"><div><h1 className="text-2xl font-bold text-slate-900">Employee Portal</h1><p className="text-slate-500">{userData.email}</p></div><Button variant="outline" onClick={() => signOut(auth)}><LogOut className="w-4 h-4" /> Logout</Button></header>
        <div className="flex gap-4 mb-6"><Button variant={activeTab === 'submit' ? 'primary' : 'outline'} onClick={() => setActiveTab('submit')}>New Idea</Button><Button variant={activeTab === 'my-ideas' ? 'primary' : 'outline'} onClick={() => setActiveTab('my-ideas')}>My Ideas</Button></div>
        {activeTab === 'submit' && (<div className="max-w-2xl mx-auto"><Card className="p-8"><div className="mb-6 flex gap-2 flex-wrap">{templates.map(t => (<button key={t.id} onClick={() => { setSelectedTemplate(t); setFormData({}); }} className={`px-4 py-2 rounded-full border text-sm font-medium transition ${selectedTemplate?.id === t.id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>{t.category}</button>))}</div>{selectedTemplate && (<form onSubmit={submitIdea} className="space-y-4">{selectedTemplate.fields.map((field, idx) => (<div key={idx}><label className="block text-sm font-medium text-slate-700 mb-1">{field.label} {field.required && '*'}</label>{field.type === 'textarea' ? (<textarea required={field.required} className="w-full p-3 border rounded-lg" rows="3" value={formData[field.label] || ''} onChange={e => setFormData({...formData, [field.label]: e.target.value})} />) : field.type === 'select' ? (<select required={field.required} className="w-full p-3 border rounded-lg" value={formData[field.label] || ''} onChange={e => setFormData({...formData, [field.label]: e.target.value})}><option value="">Select...</option>{field.options?.split(',').map(opt => <option key={opt} value={opt.trim()}>{opt.trim()}</option>)}</select>) : field.type === 'file' ? (<input type="file" required={field.required} className="w-full text-sm" onChange={e => handleFileChange(field.label, e)} />) : (<input type={field.type} required={field.required} className="w-full p-3 border rounded-lg" value={formData[field.label] || ''} onChange={e => setFormData({...formData, [field.label]: e.target.value})} />)}</div>))}<Button type="submit" className="w-full mt-4">Submit</Button></form>)}</Card></div>)}
        {activeTab === 'my-ideas' && (<div className="space-y-4">{myIdeas.map(idea => (<Card key={idea.id} className="p-4 flex items-center justify-between"><div><div className="font-bold text-lg">{idea.data['Idea Title']}</div><div className="text-sm text-slate-500">{idea.category}</div></div><Badge status={idea.status} /></Card>))}</div>)}
      </div>
    );
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading Idea Bank...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {view === 'landing' && <LandingPage />}
      {view === 'login-admin' && <AdminLogin />}
      {view === 'login-employee' && <EmployeeAuth />}
      {view === 'admin' && <AdminPortal />}
      {view === 'manager' && <ManagerPortal />}
      {view === 'employee' && <EmployeePortal />}
    </div>
  );