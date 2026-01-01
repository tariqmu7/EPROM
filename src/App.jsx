import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, query, where, 
  onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDocs 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  Lightbulb, Users, FileText, CheckCircle, XCircle, 
  LogOut, Plus, Trash2, Settings, ChevronRight, UserPlus, 
  Briefcase, Layout, Shield, AlertCircle 
} from 'lucide-react';

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

// This appId is used for the database collecton path logic in the code
const appId = "eprom-production-v1"; 

// --- Constants & Utilities ---
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
  password: 'admin123', // In a real app, hash this!
  role: ROLES.ADMIN,
  name: 'System Admin',
  status: STATUS.APPROVED
};

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100",
    danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
    success: "bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100"
  };

  return (
    <button 
      type={type} 
      onClick={onClick} 
      className={`${baseStyle} ${variants[variant]} ${className}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

const Input = ({ label, type = "text", value, onChange, placeholder, required = false, name }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      required={required}
    />
  </div>
);

const Select = ({ label, value, onChange, options, required = false }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select
      value={value}
      onChange={onChange}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
    >
      <option value="">Select an option</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
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

// --- Main Application ---

export default function IdeaBankApp() {
  const [authUser, setAuthUser] = useState(null); // Firebase Auth User
  const [currentUser, setCurrentUser] = useState(null); // Firestore User Data
  const [view, setView] = useState('login'); // login, register, admin, manager, employee
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // --- Auth & Init ---
  useEffect(() => {
  const initAuth = async () => {
    // Just sign in anonymously or rely on persisted auth state
    await signInAnonymously(auth);
  };
  initAuth();

  return onAuthStateChanged(auth, (user) => {
    setAuthUser(user);
    if (!user) setLoading(false);
  });
}, []);


  // Show Toast
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Login Logic ---
  const handleLogin = async (email, password, requestedRole) => {
    setLoading(true);
    try {
      // Special case for Default Admin (Simulated)
      if (email === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) {
        if (requestedRole !== ROLES.ADMIN) {
          throw new Error("Invalid portal for these credentials.");
        }
        setCurrentUser({ ...DEFAULT_ADMIN, id: 'admin-master' });
        setView('admin');
        setLoading(false);
        return;
      }

      // Normal User Login Query
      const q = query(
        collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS),
        where('email', '==', email),
        where('password', '==', password) // In production, never query passwords directly. Use Auth.
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        throw new Error("Invalid email or password.");
      }

      const userData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

      if (userData.status !== STATUS.APPROVED) {
        throw new Error("Your account is pending approval by the Admin.");
      }

      if (userData.role !== requestedRole) {
        throw new Error(`Access denied. You are not authorized for the ${requestedRole} portal.`);
      }

      setCurrentUser(userData);
      setView(userData.role);

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('login');
  };

  const handleRegister = async (data) => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS), {
        ...data,
        role: 'unassigned', // Admin assigns role later
        status: STATUS.PENDING,
        createdAt: new Date().toISOString()
      });
      showToast("Registration request sent to Admin!", "success");
      setView('login');
    } catch (err) {
      showToast("Registration failed", "error");
    }
  };

  if (!authUser && loading) return <div className="h-screen flex items-center justify-center text-indigo-600">Initializing Security...</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium animate-fade-in-down ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.message}
        </div>
      )}

      {/* Main Content Switch */}
      {view === 'login' && <LoginPage onLogin={handleLogin} onGoRegister={() => setView('register')} />}
      {view === 'register' && <RegisterPage onRegister={handleRegister} onBack={() => setView('login')} />}
      
      {/* Protected Portals */}
      {currentUser && (
        <>
          <nav className="bg-indigo-700 text-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-6 h-6 text-yellow-300" />
                  <span className="font-bold text-xl tracking-tight">Idea Bank</span>
                  <span className="ml-2 px-2 py-0.5 rounded text-xs bg-indigo-800 text-indigo-200 uppercase">
                    {currentUser.role} Portal
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-indigo-200">
                    Welcome, {currentUser.name}
                  </div>
                  <Button variant="ghost" onClick={handleLogout} className="text-white hover:bg-indigo-600 hover:text-white">
                    <LogOut className="w-4 h-4" /> Logout
                  </Button>
                </div>
              </div>
            </div>
          </nav>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {view === ROLES.ADMIN && <AdminPortal currentUser={currentUser} showToast={showToast} />}
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
  const [selectedRole, setSelectedRole] = useState(ROLES.EMPLOYEE);

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email, password, selectedRole);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-blue-100">
      <div className="mb-8 flex flex-col items-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
          <Lightbulb className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900">Idea Bank</h1>
        <p className="text-gray-600 mt-2">Where innovation meets execution</p>
      </div>

      <Card className="w-full max-w-md p-8 shadow-xl border-t-4 border-indigo-600">
        <h2 className="text-2xl font-bold mb-6 text-center">Sign In</h2>
        
        {/* Role Toggles */}
        <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
          {[ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.ADMIN].map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`flex-1 py-2 text-sm font-medium rounded-md capitalize transition-all ${
                selectedRole === role 
                  ? 'bg-white text-indigo-700 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {role}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <Input 
            label="Email Address" 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="you@company.com" 
            required 
          />
          <Input 
            label="Password" 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            placeholder="••••••••" 
            required 
          />
          
          <Button variant="primary" type="submit" className="w-full mt-4 h-11 text-lg">
            Login to {selectedRole} Portal
          </Button>
        </form>

        <div className="mt-6 text-center pt-6 border-t border-gray-100">
          <p className="text-sm text-gray-500 mb-3">New to the company?</p>
          <Button variant="secondary" onClick={onGoRegister} className="w-full">
            Request Access / Sign Up
          </Button>
        </div>
      </Card>
      
      <div className="mt-8 text-center text-xs text-gray-400">
        <p>Demo Admin Login: admin@ideabank.com / admin123</p>
      </div>
    </div>
  );
};

const RegisterPage = ({ onRegister, onBack }) => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="flex items-center gap-2 mb-6 text-indigo-600">
          <UserPlus className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Request Access</h2>
        </div>
        <p className="text-gray-600 mb-6 text-sm">
          Submit your details. The administrator will review your request and assign your department.
        </p>

        <form onSubmit={(e) => { e.preventDefault(); onRegister(formData); }}>
          <Input 
            label="Full Name" 
            value={formData.name} 
            onChange={(e) => setFormData({...formData, name: e.target.value})} 
            required 
          />
          <Input 
            label="Work Email" 
            type="email" 
            value={formData.email} 
            onChange={(e) => setFormData({...formData, email: e.target.value})} 
            required 
          />
          <Input 
            label="Create Password" 
            type="password" 
            value={formData.password} 
            onChange={(e) => setFormData({...formData, password: e.target.value})} 
            required 
          />
          
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={onBack} className="flex-1">Back</Button>
            <Button variant="primary" type="submit" className="flex-1">Submit Request</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

// --- Admin Portal ---

const AdminPortal = ({ currentUser, showToast }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [forms, setForms] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Load Data
  useEffect(() => {
    if (!currentUser) return;

    // Users
    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Forms
    const unsubForms = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS), (snap) => {
      setForms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Departments
    const unsubDepts = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEPARTMENTS), (snap) => {
      setDepartments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubUsers(); unsubForms(); unsubDepts(); };
  }, [currentUser]);

  // Actions
  const handleApproveUser = async (user, role, dept) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS, user.id), {
      status: STATUS.APPROVED,
      role: role,
      department: dept,
      password: 'ideabank-default' // Setting default password as requested
    });
    showToast(`User approved. Default password set: ideabank-default`);
  };

  const handleCreateDepartment = async (name) => {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEPARTMENTS), { name });
    showToast('Department added');
  };

  const handleDeleteForm = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS, id));
    showToast('Form deleted');
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Sidebar */}
      <div className="col-span-12 md:col-span-3">
        <Card className="p-4 h-full">
          <div className="space-y-2">
            {[
              { id: 'users', label: 'User Management', icon: Users },
              { id: 'forms', label: 'Form Builder', icon: Layout },
              { id: 'depts', label: 'Departments', icon: Briefcase }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === item.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="col-span-12 md:col-span-9">
        {activeTab === 'users' && <UserManagement users={users} departments={departments} onApprove={handleApproveUser} />}
        {activeTab === 'forms' && <FormBuilder forms={forms} onDelete={handleDeleteForm} showToast={showToast} />}
        {activeTab === 'depts' && <DepartmentManager departments={departments} onCreate={handleCreateDepartment} />}
      </div>
    </div>
  );
};

const UserManagement = ({ users, departments, onApprove }) => {
  const pendingUsers = users.filter(u => u.status === STATUS.PENDING);
  const activeUsers = users.filter(u => u.status === STATUS.APPROVED && u.role !== 'admin');

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-indigo-600" />
          Pending Approvals
        </h3>
        {pendingUsers.length === 0 ? (
          <p className="text-gray-400 italic">No pending requests.</p>
        ) : (
          <div className="space-y-4">
            {pendingUsers.map(user => (
              <UserApprovalRow key={user.id} user={user} departments={departments} onApprove={onApprove} />
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">Active Directory</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 font-medium text-gray-500">Department</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {activeUsers.map(user => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3"><Badge status={user.role} /></td>
                  <td className="px-4 py-3 text-gray-600">{user.department}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const UserApprovalRow = ({ user, departments, onApprove }) => {
  const [role, setRole] = useState(ROLES.EMPLOYEE);
  const [dept, setDept] = useState('');

  return (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between">
      <div>
        <div className="font-bold text-gray-900">{user.name}</div>
        <div className="text-sm text-gray-500">{user.email}</div>
      </div>
      <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
        <select 
          value={role} 
          onChange={(e) => setRole(e.target.value)}
          className="px-3 py-2 rounded border text-sm"
        >
          <option value={ROLES.EMPLOYEE}>Employee</option>
          <option value={ROLES.MANAGER}>Manager</option>
        </select>
        <select 
          value={dept} 
          onChange={(e) => setDept(e.target.value)}
          className="px-3 py-2 rounded border text-sm"
        >
          <option value="">Select Dept</option>
          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <Button 
          variant="success" 
          onClick={() => onApprove(user, role, dept)}
          disabled={!dept}
          className="text-xs"
        >
          Approve
        </Button>
      </div>
    </div>
  );
};

const DepartmentManager = ({ departments, onCreate }) => {
  const [newDept, setNewDept] = useState('');

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold mb-4">Manage Departments</h3>
      <div className="flex gap-2 mb-6">
        <Input 
          value={newDept} 
          onChange={(e) => setNewDept(e.target.value)} 
          placeholder="New Department Name" 
          className="flex-1"
        />
        <Button onClick={() => { onCreate(newDept); setNewDept(''); }} disabled={!newDept} variant="primary">
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {departments.map(d => (
          <div key={d.id} className="bg-white border rounded-lg p-3 text-center shadow-sm font-medium text-gray-700">
            {d.name}
          </div>
        ))}
      </div>
    </Card>
  );
};

const FormBuilder = ({ forms, onDelete, showToast }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newForm, setNewForm] = useState({ category: '', title: '', fields: [] });
  const [newField, setNewField] = useState({ label: '', type: 'text', required: false });

  const addField = () => {
    if (!newField.label) return;
    setNewForm(prev => ({ ...prev, fields: [...prev.fields, newField] }));
    setNewField({ label: '', type: 'text', required: false });
  };

  const removeField = (idx) => {
    setNewForm(prev => ({ ...prev, fields: prev.fields.filter((_, i) => i !== idx) }));
  };

  const saveForm = async () => {
    if (!newForm.category || !newForm.title || newForm.fields.length === 0) {
      showToast("Please fill all form details and add at least one field", "error");
      return;
    }
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS), newForm);
    showToast("Form created successfully");
    setIsCreating(false);
    setNewForm({ category: '', title: '', fields: [] });
  };

  if (isCreating) {
    return (
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold">Create New Idea Form</h3>
          <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="Category Name" 
            placeholder="e.g. Cost Saving, Process Improvement" 
            value={newForm.category}
            onChange={(e) => setNewForm({...newForm, category: e.target.value})}
          />
          <Input 
            label="Form Title" 
            placeholder="e.g. Cost Reduction Proposal" 
            value={newForm.title}
            onChange={(e) => setNewForm({...newForm, title: e.target.value})}
          />
        </div>

        <div className="mt-6 border-t pt-6">
          <h4 className="font-medium text-gray-700 mb-3">Add Fields</h4>
          <div className="flex items-end gap-2 mb-4">
            <div className="flex-1">
              <Input 
                label="Field Label" 
                placeholder="Question or Prompt" 
                value={newField.label}
                onChange={(e) => setNewField({...newField, label: e.target.value})}
              />
            </div>
            <div className="w-32 mb-4">
               <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
               <select 
                 className="w-full border rounded px-2 py-2"
                 value={newField.type}
                 onChange={(e) => setNewField({...newField, type: e.target.value})}
               >
                 <option value="text">Short Text</option>
                 <option value="textarea">Long Text</option>
                 <option value="number">Number</option>
                 <option value="date">Date</option>
               </select>
            </div>
            <div className="mb-4 pt-8">
               <Button onClick={addField} variant="secondary">Add Field</Button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
             {newForm.fields.length === 0 && <p className="text-gray-400 text-sm">No fields added yet.</p>}
             {newForm.fields.map((f, i) => (
               <div key={i} className="flex justify-between items-center bg-white p-3 rounded border shadow-sm">
                 <div>
                   <span className="font-medium">{f.label}</span>
                   <span className="text-xs text-gray-500 ml-2 uppercase">({f.type})</span>
                 </div>
                 <button onClick={() => removeField(i)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
               </div>
             ))}
          </div>
          
          <div className="mt-6 flex justify-end">
             <Button onClick={saveForm} variant="primary">Save Form Template</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Existing Forms</h3>
        <Button onClick={() => setIsCreating(true)} variant="primary">
          <Plus className="w-4 h-4" /> Create New Form
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {forms.map(form => (
           <Card key={form.id} className="p-4 hover:shadow-md transition-shadow">
             <div className="flex justify-between items-start mb-2">
               <div>
                 <h4 className="font-bold text-lg">{form.category}</h4>
                 <p className="text-gray-500 text-sm">{form.title}</p>
               </div>
               <button onClick={() => onDelete(form.id)} className="text-gray-400 hover:text-red-600">
                 <Trash2 className="w-5 h-5" />
               </button>
             </div>
             <div className="mt-4 pt-4 border-t">
               <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                 {form.fields ? form.fields.length : 0} Fields
               </span>
             </div>
           </Card>
        ))}
      </div>
    </div>
  );
};

// --- Manager Portal ---

const ManagerPortal = ({ currentUser, showToast }) => {
  const [ideas, setIdeas] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    // Managers only see ideas from their department with pending status
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS),
      where('department', '==', currentUser.department)
    );
    const unsub = onSnapshot(q, (snap) => {
      setIdeas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [currentUser]);

  const handleDecision = async (ideaId, status) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS, ideaId), {
      status: status,
      reviewedBy: currentUser.email,
      reviewedAt: new Date().toISOString()
    });
    showToast(`Idea ${status}`);
  };

  const pendingIdeas = ideas.filter(i => i.status === STATUS.PENDING);
  const history = ideas.filter(i => i.status !== STATUS.PENDING);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Department Review: {currentUser.department}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {pendingIdeas.length === 0 ? (
             <div className="col-span-full p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
               <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                 <CheckCircle className="w-6 h-6 text-gray-400" />
               </div>
               <h3 className="text-gray-900 font-medium">All caught up!</h3>
               <p className="text-gray-500">No pending ideas to review.</p>
             </div>
           ) : (
             pendingIdeas.map(idea => (
               <IdeaReviewCard key={idea.id} idea={idea} onDecision={handleDecision} />
             ))
           )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="pt-8 border-t">
           <h3 className="text-xl font-bold mb-4 text-gray-700">Review History</h3>
           <div className="bg-white rounded-lg border overflow-hidden">
             {history.map(idea => (
               <div key={idea.id} className="p-4 border-b last:border-0 flex justify-between items-center hover:bg-gray-50">
                 <div>
                   <div className="font-medium">{idea.formTitle}</div>
                   <div className="text-sm text-gray-500">Submitted by: {idea.employeeEmail}</div>
                 </div>
                 <div className="flex items-center gap-4">
                   <span className="text-sm text-gray-400">{new Date(idea.submittedAt).toLocaleDateString()}</span>
                   <Badge status={idea.status} />
                 </div>
               </div>
             ))}
           </div>
        </div>
      )}
    </div>
  );
};

const IdeaReviewCard = ({ idea, onDecision }) => {
  return (
    <Card className="p-6 border-l-4 border-l-yellow-400">
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{idea.category}</span>
          <h3 className="text-xl font-bold mt-1">{idea.formTitle}</h3>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium">{idea.employeeName}</div>
          <div className="text-xs text-gray-500">{new Date(idea.submittedAt).toLocaleDateString()}</div>
        </div>
      </div>

      <div className="bg-gray-50 rounded p-4 mb-6 space-y-3">
        {Object.entries(idea.formData).map(([key, value]) => (
          <div key={key}>
            <div className="text-xs text-gray-500 uppercase font-semibold">{key}</div>
            <div className="text-gray-800">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2 border-t">
        <Button 
          variant="danger" 
          className="flex-1" 
          onClick={() => onDecision(idea.id, STATUS.REJECTED)}
        >
          <XCircle className="w-4 h-4" /> Reject
        </Button>
        <Button 
          variant="success" 
          className="flex-1" 
          onClick={() => onDecision(idea.id, STATUS.APPROVED)}
        >
          <CheckCircle className="w-4 h-4" /> Approve
        </Button>
      </div>
    </Card>
  );
};

// --- Employee Portal ---

const EmployeePortal = ({ currentUser, showToast }) => {
  const [categories, setCategories] = useState([]);
  const [forms, setForms] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activeForm, setActiveForm] = useState(null);
  const [submissionData, setSubmissionData] = useState({});
  const [myIdeas, setMyIdeas] = useState([]);

  // Load Forms & My Ideas
  useEffect(() => {
    if (!currentUser) return;
    
    // Forms
    const unsubForms = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FORMS), (snap) => {
      const formsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setForms(formsList);
      // Extract unique categories
      const uniqueCats = [...new Set(formsList.map(f => f.category))];
      setCategories(uniqueCats);
    });

    // My Ideas
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS),
      where('employeeId', '==', currentUser.id)
    );
    const unsubIdeas = onSnapshot(q, (snap) => {
      setMyIdeas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubForms(); unsubIdeas(); };
  }, [currentUser]);

  // Handle Category Selection
  useEffect(() => {
    if (selectedCategory) {
      const matchedForm = forms.find(f => f.category === selectedCategory);
      setActiveForm(matchedForm || null);
      setSubmissionData({});
    } else {
      setActiveForm(null);
    }
  }, [selectedCategory, forms]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeForm) return;

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.IDEAS), {
        employeeId: currentUser.id,
        employeeName: currentUser.name,
        employeeEmail: currentUser.email,
        department: currentUser.department,
        status: STATUS.PENDING,
        category: activeForm.category,
        formTitle: activeForm.title,
        formData: submissionData,
        submittedAt: new Date().toISOString()
      });
      showToast("Idea submitted successfully!", "success");
      setSelectedCategory('');
    } catch (err) {
      showToast("Submission failed", "error");
    }
  };

  const handleInputChange = (label, value) => {
    setSubmissionData(prev => ({ ...prev, [label]: value }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Submission Column */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-indigo-900 rounded-xl p-6 text-white shadow-lg">
           <h2 className="text-2xl font-bold mb-2">Submit New Idea</h2>
           <p className="text-indigo-200 mb-6">Select a category to get started.</p>
           
           <div className="bg-white/10 p-1 rounded-lg inline-flex flex-wrap gap-2">
             {categories.map(cat => (
               <button
                 key={cat}
                 onClick={() => setSelectedCategory(cat)}
                 className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                   selectedCategory === cat ? 'bg-white text-indigo-900 shadow' : 'text-indigo-100 hover:bg-white/5'
                 }`}
               >
                 {cat}
               </button>
             ))}
           </div>
        </div>

        {activeForm ? (
          <Card className="p-8 animate-fade-in">
            <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-4">{activeForm.title}</h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              {activeForm.fields.map((field, idx) => (
                <div key={idx}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {field.label}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      required={field.required}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[120px]"
                      onChange={(e) => handleInputChange(field.label, e.target.value)}
                    />
                  ) : (
                    <input
                      type={field.type}
                      required={field.required}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      onChange={(e) => handleInputChange(field.label, e.target.value)}
                    />
                  )}
                </div>
              ))}
              <div className="pt-4">
                <Button type="submit" variant="primary" className="w-full h-12 text-lg">
                  Submit for Review
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <div className="h-64 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-400">
            Select a category above to load the form
          </div>
        )}
      </div>

      {/* Sidebar: My Ideas */}
      <div className="lg:col-span-1">
        <h3 className="text-lg font-bold mb-4 text-gray-700">My Submissions</h3>
        <div className="space-y-4">
          {myIdeas.length === 0 ? (
             <p className="text-gray-500 text-sm italic">You haven't submitted any ideas yet.</p>
          ) : (
             myIdeas.map(idea => (
               <Card key={idea.id} className="p-4 border-l-4 border-l-indigo-500">
                 <div className="flex justify-between items-start mb-2">
                   <h4 className="font-bold text-gray-900">{idea.formTitle}</h4>
                   <Badge status={idea.status} />
                 </div>
                 <p className="text-xs text-gray-500 mb-2">
                   {new Date(idea.submittedAt).toLocaleDateString()}
                 </p>
                 {idea.status === STATUS.REJECTED && (
                   <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                     Declined by manager
                   </div>
                 )}
               </Card>
             ))
          )}
        </div>
      </div>
    </div>
  );
};