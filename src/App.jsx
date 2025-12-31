import React, { useState, useEffect } from 'react';
import { 
  Lightbulb, Users, FileText, CheckCircle, XCircle, 
  Settings, Plus, Trash2, LogOut, ChevronRight, 
  Shield, UserCheck, Layout, Lock, AlertTriangle, Paperclip, Calendar, KeyRound 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword, signInAnonymously 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, 
  doc, onSnapshot, query, where, serverTimestamp, setDoc, getDocs 
} from 'firebase/firestore';

// --- Firebase Config (Production Ready) ---
const firebaseConfig = {
  apiKey: "AIzaSyAMOU-IK6UfKk75UR0P_Rs80z0uEsssQ9o",
  authDomain: "epromdeploy.firebaseapp.com",
  projectId: "epromdeploy",
  storageBucket: "epromdeploy.firebasestorage.app",
  messagingSenderId: "179394609832",
  appId: "1:179394609832:web:cf8d21ea2eef70990cb89d",
  measurementId: "G-X5GVRLDBQQ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = 'idea-bank-production';
const DEFAULT_PASSWORD = 'password123'; // Default password for first-time users

// --- Utility Components ---
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = "primary", className = "", type = "button", disabled = false }) => {
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300",
    danger: "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300",
    outline: "border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:text-slate-300",
    ghost: "text-slate-600 hover:bg-slate-100"
  };
  return (
    <button 
      type={type}
      onClick={onClick} 
      disabled={disabled}
      className={`px-4 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Badge = ({ status }) => {
  const styles = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-rose-100 text-rose-800",
    review: "bg-blue-100 text-blue-800"
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
};

// --- Main App Component ---

export default function IdeaBankApp() {
  const [user, setUser] = useState(null); 
  const [userData, setUserData] = useState(null); 
  const [view, setView] = useState('login'); // login, change-password, admin, manager, employee
  const [loading, setLoading] = useState(true);

  // --- Auth Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u && u.email) {
        setUser(u);
        // Fetch User Data
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('email', '==', u.email));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
          setUserData(data);
          
          // Check for Default Password Flag
          if (data.isDefaultPassword) {
            setView('change-password');
          } else {
            setView(data.role);
          }
        }
      } else {
        setUser(null);
        setUserData(null);
        setView('login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Seed Database ---
  const seedDatabase = async () => {
    try {
        if (!auth.currentUser) await signInAnonymously(auth);

        const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
        const templatesRef = collection(db, 'artifacts', appId, 'public', 'data', 'templates');
        const deptsRef = collection(db, 'artifacts', appId, 'public', 'data', 'departments');

        // Create Departments
        await addDoc(deptsRef, { name: 'IT' });
        await addDoc(deptsRef, { name: 'HR' });
        await addDoc(deptsRef, { name: 'Sales' });
        await addDoc(deptsRef, { name: 'Operations' });

        // Create Users with isDefaultPassword flag
        await addDoc(usersRef, { email: 'adminT124@EPROM.com', role: 'admin', name: 'Main Admin', status: 'active', dept: 'Management', isDefaultPassword: true });
        await addDoc(usersRef, { email: 'manager@eprom.com', role: 'manager', dept: 'IT', name: 'IT Manager', status: 'active', isDefaultPassword: true });
        await addDoc(usersRef, { email: 'employee@eprom.com', role: 'employee', dept: 'IT', name: 'John Doe', status: 'active', isDefaultPassword: true });

        // Create Template
        await addDoc(templatesRef, {
        category: 'Cost Saving',
        fields: [
            { id: 1, label: 'Estimated Savings ($)', type: 'number', required: true },
            { id: 2, label: 'Implementation Date', type: 'date', required: true },
            { id: 3, label: 'Priority Level', type: 'select', required: true, options: 'High,Medium,Low' },
            { id: 4, label: 'Supporting Document', type: 'file', required: false },
            { id: 5, label: 'Description', type: 'textarea', required: true }
        ]
        });

        alert("Database Seeded! Login with 'adminT124@EPROM.com' and password 'password123'");
    } catch (error) {
        console.error("Seeding Error:", error);
        alert("Error: " + error.message);
    }
  };

  // --- Components ---

  const ChangePassword = () => {
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [error, setError] = useState('');

    const handleChange = async (e) => {
      e.preventDefault();
      if (newPass !== confirmPass) {
        setError("Passwords do not match");
        return;
      }
      if (newPass.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }

      try {
        await updatePassword(user, newPass);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userData.id), {
          isDefaultPassword: false
        });
        alert("Password updated successfully!");
        setView(userData.role);
      } catch (err) {
        setError(err.message);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-6 h-6 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Set New Password</h2>
            <p className="text-sm text-slate-500 mt-2">
              You are using the default system password. For security, please set a new personal password.
            </p>
          </div>
          
          <form onSubmit={handleChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full p-2 border rounded" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
              <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="w-full p-2 border rounded" required />
            </div>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <Button type="submit" className="w-full">Update Password</Button>
          </form>
        </Card>
      </div>
    );
  };

  const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
      e.preventDefault();
      setError('');
      
      try {
        // Attempt normal login
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        // Handle "First Time Login" simulation
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
           // If user tries default password
           if (password === DEFAULT_PASSWORD) {
               // Check if they exist in Firestore (Seeded user)
               const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('email', '==', email));
               const snapshot = await getDocs(q);
               
               if (!snapshot.empty) {
                   // User exists in DB but not Auth -> Create Auth account now
                   try {
                       await createUserWithEmailAndPassword(auth, email, password);
                       return; // Auth listener handles the rest
                   } catch (createErr) {
                       setError("Error creating account: " + createErr.message);
                   }
               } else {
                   setError("User not found. Please contact admin.");
               }
           } else {
               setError("Invalid credentials.");
           }
        } else {
           setError(err.message);
        }
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Lightbulb className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Idea Bank</h1>
            <p className="text-slate-500">EPROM Innovation Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="user@eprom.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full">Login</Button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
             <p className="text-xs text-slate-400 mb-2">First time setup?</p>
             <button onClick={seedDatabase} className="text-xs text-slate-500 hover:text-slate-800 underline">
               Seed Database (Reset App)
             </button>
             <p className="text-[10px] text-slate-400 mt-2">Default Password: <strong>{DEFAULT_PASSWORD}</strong></p>
          </div>
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
        // When approving, ensure isDefaultPassword is true so they must set password
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userId), { status: 'active', dept, role, isDefaultPassword: true });
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
                            <Button variant="success" onClick={() => approveUser(u.id, document.getElementById(`dept-${u.id}`).value, document.getElementById(`role-${u.id}`).value)}>Approve & Reset Pass</Button>
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
      {view === 'login' && <Login />}
      {view === 'change-password' && <ChangePassword />}
      {view === 'admin' && <AdminPortal />}
      {view === 'manager' && <ManagerPortal />}
      {view === 'employee' && <EmployeePortal />}
    </div>
  );
}