import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bus, Car, Calendar, Clock, MapPin, Users, Settings, 
  Plus, Check, X, AlertCircle, TrendingUp, Shield, 
  LogOut, Briefcase, Map, Home, Truck, UserCircle, Phone, Navigation, Menu
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, 
  doc, onSnapshot, query, serverTimestamp, writeBatch 
} from 'firebase/firestore';

// --- Firebase Configuration & Initialization ---
// Updated with your provided credentials
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
// Use a fixed app ID for your deployment or fallback to the one provided by environment if testing locally
const appId = 'fleet-master-egypt-v2'; 

// --- Constants & Mock Data ---
// Updated for Alexandria HQ + Egypt-wide sites
const AREAS = [
  // Alexandria
  { id: 'smouha', name: 'Alex - Smouha', travelTime: 20 },
  { id: 'miami', name: 'Alex - Miami', travelTime: 30 },
  { id: 'borg', name: 'Alex - Borg El Arab Ind.', travelTime: 60 },
  { id: 'agami', name: 'Alex - Agami', travelTime: 45 },
  // North Coast
  { id: 'alamein', name: 'New Alamein', travelTime: 90 },
  // Cairo / Giza
  { id: 'october', name: 'Cairo - 6th Oct', travelTime: 200 },
  { id: 'maadi', name: 'Cairo - Maadi', travelTime: 220 },
  { id: 'new_cairo', name: 'Cairo - New Cairo', travelTime: 230 },
  // Other
  { id: 'sokhna', name: 'Ain Sokhna', travelTime: 260 },
];

// --- Utility Components ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, type }) => {
  const styles = {
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    error: "bg-rose-100 text-rose-800",
    blue: "bg-blue-100 text-blue-800",
    neutral: "bg-slate-100 text-slate-800",
    tier1: "bg-purple-100 text-purple-800 border border-purple-200",
    tier2: "bg-indigo-50 text-indigo-700",
    tier3: "bg-slate-50 text-slate-600",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${styles[type] || styles.neutral}`}>
      {children}
    </span>
  );
};

// --- Main Application Component ---

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [role, setRole] = useState('admin'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile Menu State
  
  // Data State
  const [vehicles, setVehicles] = useState([]);
  const [requests, setRequests] = useState([]);
  
  // Modal States
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null); 
  const [assignmentMode, setAssignmentMode] = useState('single'); 

  // --- Auth & Data Fetching ---

  useEffect(() => {
    const initAuth = async () => {
      // Simplified auth for production deployment
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Authentication failed:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch Vehicles
    const qVehicles = collection(db, 'artifacts', appId, 'public', 'data', 'vehicles');
    const unsubVehicles = onSnapshot(qVehicles, (snapshot) => {
      const v = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setVehicles(v);
      if (v.length === 0) seedDatabase();
    });

    // Fetch Requests
    const qRequests = collection(db, 'artifacts', appId, 'public', 'data', 'requests');
    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      setRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds));
    });

    return () => {
      unsubVehicles();
      unsubRequests();
    };
  }, [user]);

  const seedDatabase = async () => {
    const batchPromises = [];
    const vehicleCol = collection(db, 'artifacts', appId, 'public', 'data', 'vehicles');
    
    // Seed with Drivers
    const drivers = ["Mohamed Ahmed", "Ali Hassan", "Omar Khaled", "Sayed Mahmoud", "Ibrahim Adel"];
    
    for (let i = 1; i <= 10; i++) {
      batchPromises.push(addDoc(vehicleCol, {
        plate: `ALX-${100 + i}`,
        type: 'sedan',
        model: i <= 4 ? 'Mercedes E200' : 'Toyota Corolla',
        capacity: 4,
        tier: i <= 4 ? 1 : 2,
        status: 'available',
        location: 'Smouha HQ',
        driverName: drivers[i % drivers.length],
        driverPhone: `010${Math.floor(Math.random() * 90000000 + 10000000)}`
      }));
    }
    for (let i = 1; i <= 10; i++) {
      batchPromises.push(addDoc(vehicleCol, {
        plate: `BUS-${200 + i}`,
        type: 'bus',
        model: 'Mercedes MCV',
        capacity: 50,
        tier: i <= 3 ? 1 : 3,
        status: 'available',
        location: 'Borg El Arab Site',
        driverName: `Capt. ${drivers[i % drivers.length]}`,
        driverPhone: `012${Math.floor(Math.random() * 90000000 + 10000000)}`
      }));
    }
    await Promise.all(batchPromises);
  };

  // --- Logic: Smart Grouping & Routing ---

  const groupedTrips = useMemo(() => {
    if (requests.length === 0) return [];
    
    const pending = requests.filter(r => r.status === 'pending');
    const groups = {};

    pending.forEach(req => {
      const timeWindow = req.time.split(':')[0]; 
      const key = `${req.date}_${timeWindow}_${req.area}`;
      
      if (!groups[key]) {
        groups[key] = {
          id: key,
          date: req.date,
          timeWindow: timeWindow,
          area: req.area,
          areaName: AREAS.find(a => a.id === req.area)?.name || req.area,
          destination: req.destination,
          requests: [],
          totalPassengers: 0,
          type: req.type
        };
      }
      groups[key].requests.push(req);
      groups[key].totalPassengers += req.passengers;
    });

    return Object.values(groups).sort((a,b) => b.totalPassengers - a.totalPassengers);
  }, [requests]);

  const calculateRoute = (groupRequests, arrivalTimeStr, areaId) => {
    const area = AREAS.find(a => a.id === areaId) || { travelTime: 45 };
    const arrivalDate = new Date(`2000-01-01T${arrivalTimeStr}`);
    const tripStartTime = new Date(arrivalDate.getTime() - area.travelTime * 60000);
    
    let currentPickupTime = tripStartTime;
    const stops = groupRequests.map((req, index) => {
      const pickup = new Date(currentPickupTime.getTime() - (index * 5 * 60000));
      return {
        ...req,
        estimatedPickup: pickup.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    });

    return {
      startTime: tripStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      stops: stops.reverse(),
      totalDuration: area.travelTime + (groupRequests.length * 5)
    };
  };

  // --- Actions ---

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newReq = {
      type: formData.get('type'),
      destination: formData.get('destination'),
      area: formData.get('area'),
      pickup: formData.get('pickup'),
      date: formData.get('date'),
      time: formData.get('time'),
      passengers: parseInt(formData.get('passengers')),
      notes: formData.get('notes'),
      requesterId: user.uid,
      requesterName: user.isAnonymous ? "Employee" : "User " + user.uid.slice(0,4),
      status: 'pending',
      assignedVehicleId: null,
      createdAt: serverTimestamp()
    };
    
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'requests'), newReq);
    setShowRequestModal(false);
  };

  const handleAssignVehicle = async (vehicleId) => {
    if (!selectedRequest) return;

    const batch = writeBatch(db);
    const vehicleRef = doc(db, 'artifacts', appId, 'public', 'data', 'vehicles', vehicleId);
    
    batch.update(vehicleRef, { status: 'busy' });

    const requestsToUpdate = assignmentMode === 'group' 
      ? selectedRequest.requests 
      : [selectedRequest]; 

    requestsToUpdate.forEach(req => {
      const reqRef = doc(db, 'artifacts', appId, 'public', 'data', 'requests', req.id);
      batch.update(reqRef, {
        status: 'approved',
        assignedVehicleId: vehicleId
      });
    });

    await batch.commit();
    setSelectedRequest(null);
  };

  const handleCompleteTrip = async (req) => {
    const batch = writeBatch(db);
    const reqRef = doc(db, 'artifacts', appId, 'public', 'data', 'requests', req.id);
    batch.update(reqRef, { status: 'completed' });

    if (req.assignedVehicleId) {
      const vehicleRef = doc(db, 'artifacts', appId, 'public', 'data', 'vehicles', req.assignedVehicleId);
      batch.update(vehicleRef, { status: 'available' });
    }

    await batch.commit();
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'vehicles'), {
      plate: formData.get('plate'),
      type: formData.get('type'),
      model: formData.get('model'),
      capacity: parseInt(formData.get('capacity')),
      tier: parseInt(formData.get('tier')),
      driverName: formData.get('driverName'),
      driverPhone: formData.get('driverPhone'),
      status: 'available',
      location: 'Alexandria HQ'
    });
    setShowAddVehicleModal(false);
  };

  // --- UI Components ---

  const Sidebar = () => (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar Content */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-slate-300 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:fixed lg:inset-y-0
      `}>
        <div className="p-6">
          <div className="flex items-center justify-between text-white mb-8">
            <div className="flex items-center space-x-2">
              <Truck className="w-8 h-8 text-blue-500" />
              <span className="text-xl font-bold tracking-tight">FleetMaster</span>
            </div>
            {/* Mobile Close Button */}
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="space-y-1">
            <button onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
              <TrendingUp className="w-5 h-5" /> <span>Dashboard</span>
            </button>
            
            {role === 'admin' && (
              <>
                <button onClick={() => { setActiveTab('smart-dispatch'); setIsSidebarOpen(false); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'smart-dispatch' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'hover:bg-slate-800'}`}>
                  <Navigation className="w-5 h-5" /> <span>Smart Dispatch</span>
                </button>
                <button onClick={() => { setActiveTab('fleet'); setIsSidebarOpen(false); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'fleet' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
                  <Bus className="w-5 h-5" /> <span>Fleet Management</span>
                </button>
              </>
            )}

            <button onClick={() => { setActiveTab('requests'); setIsSidebarOpen(false); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'requests' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
              <Calendar className="w-5 h-5" /> <span>{role === 'admin' ? 'All Requests' : 'My Requests'}</span>
            </button>
          </div>
        </div>

        <div className="mt-auto p-6 border-t border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <UserCircle className="w-8 h-8" />
              <div className="text-sm">
                <div className="text-white font-medium capitalize">{role} View</div>
                <div className="text-xs text-slate-500">Alexandria HQ</div>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setRole(role === 'admin' ? 'employee' : 'admin')}
            className="w-full text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded border border-slate-700"
          >
            Switch to {role === 'admin' ? 'Employee' : 'Admin'} Mode
          </button>
        </div>
      </div>
    </>
  );

  const SmartDispatchView = () => {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center">
              <Navigation className="w-6 h-6 mr-2 text-emerald-600" />
              Smart Trip Planning
            </h2>
            <p className="text-sm text-slate-500 mt-1">Grouped requests by Area & Time.</p>
          </div>
        </div>

        {groupedTrips.length === 0 ? (
           <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
             <Check className="w-12 h-12 mx-auto mb-3 opacity-50 text-emerald-500" />
             <p>All clear! No pending requests to optimize.</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {groupedTrips.map((group) => {
              const routeData = calculateRoute(group.requests, group.requests[0].time, group.area);
              
              return (
                <Card key={group.id} className="border-l-4 border-l-emerald-500 overflow-hidden">
                  <div className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-slate-900 flex items-center flex-wrap">
                            {group.areaName} <span className="text-slate-400 mx-2">→</span> {group.destination}
                          </h3>
                          <Badge type="tier1">{group.requests.length} Requests</Badge>
                        </div>
                        <div className="text-sm text-slate-500 flex flex-wrap items-center gap-4">
                          <span className="flex items-center"><Calendar className="w-4 h-4 mr-1"/> {group.date}</span>
                          <span className="flex items-center"><Clock className="w-4 h-4 mr-1"/> Arrival: {group.timeWindow}:00</span>
                          <span className="flex items-center"><Users className="w-4 h-4 mr-1"/> Pax: {group.totalPassengers}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedRequest(group);
                          setAssignmentMode('group');
                        }}
                        className="w-full md:w-auto bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 shadow-sm transition font-medium flex items-center justify-center"
                      >
                        Assign Vehicle
                      </button>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center">
                        <Map className="w-4 h-4 mr-2" />
                        Pickup Route ({routeData.totalDuration} min)
                      </h4>
                      
                      <div className="relative pl-4 space-y-6 border-l-2 border-slate-200 ml-2">
                        {routeData.stops.map((stop, idx) => (
                          <div key={idx} className="relative">
                            <div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-white border-2 border-blue-500 z-10"></div>
                            <div className="flex justify-between items-start">
                              <div className="pr-2">
                                <p className="font-medium text-slate-800 text-sm break-words">{stop.pickup}</p>
                                <p className="text-xs text-slate-500">{stop.requesterName} (+{stop.passengers - 1})</p>
                              </div>
                              <div className="text-right whitespace-nowrap">
                                <span className="block text-sm font-bold text-blue-600">{stop.estimatedPickup}</span>
                                <span className="text-[10px] text-slate-400">Pickup</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Destination */}
                        <div className="relative">
                           <div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-emerald-500 z-10"></div>
                           <div className="flex justify-between items-start">
                              <div>
                                <p className="font-bold text-slate-900 text-sm">{group.destination}</p>
                                <p className="text-xs text-slate-500">Destination</p>
                              </div>
                              <div className="text-right whitespace-nowrap">
                                <span className="block text-sm font-bold text-emerald-600">{group.timeWindow}:00</span>
                                <span className="text-[10px] text-slate-400">Target</span>
                              </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const VehicleList = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">Fleet</h2>
        <button 
          onClick={() => setShowAddVehicleModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm md:text-base md:px-4 rounded-lg flex items-center space-x-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden md:inline">Add Vehicle</span>
          <span className="md:hidden">Add</span>
        </button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Vehicle</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Driver Info</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Tier</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vehicles.map(v => (
                <tr key={v.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{v.plate}</div>
                    <div className="text-sm text-slate-500">{v.model} ({v.capacity} seats)</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2 text-sm text-slate-700">
                       <UserCircle className="w-4 h-4 text-slate-400" />
                       <span>{v.driverName || 'Unassigned'}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                       <Phone className="w-3 h-3" />
                       <span>{v.driverPhone || 'No Phone'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge type={`tier${v.tier}`}>Tier {v.tier}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge type={v.status === 'available' ? 'success' : v.status === 'busy' ? 'warning' : 'error'}>
                      {v.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                     <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vehicles', v.id))} className="text-rose-600 hover:text-rose-800 p-2">
                        <X className="w-4 h-4" />
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const RequestsList = () => {
     const displayRequests = role === 'admin' 
      ? requests 
      : requests.filter(r => r.requesterId === user?.uid);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl md:text-2xl font-bold text-slate-800">{role === 'admin' ? 'All Requests' : 'My Requests'}</h2>
          <button onClick={() => setShowRequestModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm md:text-base md:px-4 rounded-lg flex items-center space-x-2 transition">
            <Plus className="w-4 h-4" /> 
            <span className="hidden md:inline">New Request</span>
            <span className="md:hidden">New</span>
          </button>
        </div>
        <div className="grid gap-4">
          {displayRequests.map(req => {
            const assignedVehicle = vehicles.find(v => v.id === req.assignedVehicleId);
            return (
              <Card key={req.id} className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-1 w-full">
                   <div className="flex items-center space-x-3 mb-2 flex-wrap gap-y-2">
                    <Badge type={req.type === 'overtime' ? 'blue' : 'tier1'}>{req.type?.toUpperCase()}</Badge>
                    <span className="text-xs text-slate-400">ID: {req.id.slice(0,6).toUpperCase()}</span>
                    {role === 'admin' && <span className="text-xs font-medium text-slate-600 flex items-center"><UserCircle className="w-3 h-3 mr-1" /> {req.requesterName}</span>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-600">
                    <div className="flex items-center"><MapPin className="w-4 h-4 mr-2 text-slate-400 shrink-0" /> <span className="truncate">{req.pickup} ({AREAS.find(a=>a.id===req.area)?.name}) → {req.destination}</span></div>
                    <div className="flex items-center"><Calendar className="w-4 h-4 mr-2 text-slate-400 shrink-0" /> {req.date} @ {req.time}</div>
                  </div>
                </div>
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-2 md:gap-1 min-w-[150px]">
                   {req.status === 'pending' && <Badge type="warning">Pending</Badge>}
                   {req.status === 'approved' && assignedVehicle && (
                     <div className="text-right">
                       <Badge type="success">Approved</Badge>
                       <div className="text-xs text-slate-500 mt-1 hidden md:block">Car: <strong>{assignedVehicle.plate}</strong></div>
                       <div className="text-xs text-blue-600 flex items-center justify-end gap-1 mt-0.5"><Phone className="w-3 h-3"/> {assignedVehicle.driverPhone}</div>
                     </div>
                   )}
                   {req.status === 'completed' && <Badge type="neutral">Completed</Badge>}

                   {role === 'admin' && req.status === 'pending' && (
                     <button onClick={() => { setSelectedRequest(req); setAssignmentMode('single'); }} className="mt-2 text-sm bg-blue-600 text-white px-3 py-2 md:py-1.5 rounded hover:bg-blue-700 transition w-full md:w-auto">Assign Single</button>
                   )}
                   {role === 'admin' && req.status === 'approved' && (
                     <button onClick={() => handleCompleteTrip(req)} className="mt-2 text-sm border border-slate-300 text-slate-600 px-3 py-2 md:py-1.5 rounded hover:bg-slate-50 transition w-full md:w-auto">Mark Complete</button>
                   )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };
  
  // Reuse modal components with slight responsiveness tweaks (mostly w-full max-w-lg is usually fine on mobile, just check padding)
  const AddVehicleModal = () => (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 ${!showAddVehicleModal && 'hidden'}`}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">Add New Vehicle</h3>
          <button onClick={() => setShowAddVehicleModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={handleAddVehicle} className="p-6 space-y-4">
          {/* ... inputs same as before ... */}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Plate Number</label><input name="plate" required className="w-full rounded-lg border-slate-300 border p-2.5 text-slate-700" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Model</label><input name="model" required className="w-full rounded-lg border-slate-300 border p-2.5 text-slate-700" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Type</label><select name="type" className="w-full rounded-lg border-slate-300 border p-2.5 text-slate-700"><option value="sedan">Sedan</option><option value="bus">Bus</option></select></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Capacity</label><input type="number" name="capacity" defaultValue="4" className="w-full rounded-lg border-slate-300 border p-2.5 text-slate-700" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div><label className="block text-sm font-medium text-slate-700 mb-1">Driver Name</label><input name="driverName" className="w-full rounded-lg border-slate-300 border p-2.5 text-slate-700" /></div>
             <div><label className="block text-sm font-medium text-slate-700 mb-1">Driver Phone</label><input name="driverPhone" className="w-full rounded-lg border-slate-300 border p-2.5 text-slate-700" /></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Tier</label><select name="tier" className="w-full rounded-lg border-slate-300 border p-2.5 text-slate-700"><option value="1">Tier 1</option><option value="2">Tier 2</option><option value="3">Tier 3</option></select></div>
          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium transition">Add to Fleet</button>
        </form>
      </div>
    </div>
  );

  const RequestModal = () => (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 ${!showRequestModal && 'hidden'}`}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
         <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">New Trip Request</h3>
          <button onClick={() => setShowRequestModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Trip Type</label>
              <select name="type" className="w-full rounded-lg border-slate-300 border p-2.5 text-slate-700">
                <option value="overtime">Overtime</option>
                <option value="custom">Custom Trip</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target Arrival Time</label>
              <input type="time" name="time" required className="w-full rounded-lg border-slate-300 border p-2.5 text-slate-700" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pickup Area</label>
              <select name="area" className="w-full rounded-lg border-slate-300 border p-2.5 text-slate-700">
                {AREAS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input type="date" name="date" required className="w-full rounded-lg border-slate-300 border p-2.5 text-slate-700" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Exact Pickup Address</label>
            <input type="text" name="pickup" placeholder="e.g. Street 9, Building 4" required className="w-full rounded-lg border-slate-300 border p-2.5 text-slate-700" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Destination</label>
            <input type="text" name="destination" placeholder="e.g. Site A" required className="w-full rounded-lg border-slate-300 border p-2.5 text-slate-700" />
          </div>
          
          <div className="flex gap-4">
            <div className="w-1/3">
               <label className="block text-sm font-medium text-slate-700 mb-1">Passengers</label>
               <input type="number" name="passengers" min="1" max="50" defaultValue="1" className="w-full rounded-lg border-slate-300 border p-2.5 text-slate-700" />
            </div>
             <div className="w-2/3">
               <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
               <input name="notes" className="w-full rounded-lg border-slate-300 border p-2.5 text-slate-700" placeholder="Optional" />
            </div>
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium transition">
            Submit Request
          </button>
        </form>
      </div>
    </div>
  );

  const AssignmentModal = () => {
    if (!selectedRequest) return null;
    
    // Determine total passengers based on mode
    const totalPax = assignmentMode === 'group' 
      ? selectedRequest.totalPassengers 
      : selectedRequest.passengers;
      
    // Recommendation logic
    const reqType = assignmentMode === 'group' ? selectedRequest.type : selectedRequest.type;
    let recommended = vehicles.filter(v => v.status === 'available' && v.capacity >= totalPax);
    
    // Sort logic
    if (reqType === 'custom' || reqType === 'overtime') {
      recommended.sort((a, b) => a.tier - b.tier); // Tier 1 first
    } else {
      recommended.sort((a, b) => b.tier - a.tier); // Tier 3 first
    }

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-xl font-bold text-slate-800">Assign Vehicle to {assignmentMode === 'group' ? 'Trip Group' : 'Request'}</h3>
            <div className="mt-2 bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
              <span className="font-bold">Total Passengers:</span> {totalPax}
              <span className="mx-2">•</span>
              <span className="font-bold">Destination:</span> {selectedRequest.destination}
            </div>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1">
            <div className="grid gap-3">
              {recommended.length > 0 ? recommended.map(v => (
                <button 
                  key={v.id}
                  onClick={() => handleAssignVehicle(v.id)}
                  className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition group text-left"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg ${v.type === 'bus' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                      {v.type === 'bus' ? <Bus className="w-5 h-5"/> : <Car className="w-5 h-5"/>}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{v.plate} <span className="text-slate-400 font-normal">| {v.model}</span></div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center">
                         <UserCircle className="w-3 h-3 mr-1"/> {v.driverName} • <Phone className="w-3 h-3 mx-1"/> {v.driverPhone}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge type={`tier${v.tier}`}>Tier {v.tier}</Badge>
                    <div className="text-xs text-slate-500 mt-1">{v.capacity} Seats</div>
                  </div>
                </button>
              )) : (
                <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg">
                  No suitable available vehicles found for {totalPax} passengers.
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 flex justify-end">
            <button onClick={() => setSelectedRequest(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-4 lg:p-8 transition-all duration-300">
        
        {/* Mobile Header Bar */}
        <div className="lg:hidden flex items-center justify-between bg-white p-4 rounded-xl shadow-sm mb-6 border border-slate-100">
          <div className="flex items-center space-x-2">
            <Truck className="w-6 h-6 text-blue-500" />
            <span className="text-lg font-bold text-slate-900">FleetMaster</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg">
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <div className="max-w-6xl mx-auto">
          {activeTab === 'dashboard' && role === 'admin' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="lg:col-span-2 hidden lg:block"><header className="mb-4"><h1 className="text-3xl font-bold text-slate-900">Dashboard</h1></header></div>
              <SmartDispatchView />
              <RequestsList />
            </div>
          )}
          {activeTab === 'dashboard' && role !== 'admin' && (
            <><header className="mb-8 hidden lg:block"><h1 className="text-3xl font-bold text-slate-900">Dashboard</h1></header><RequestsList /></>
          )}

          {activeTab === 'smart-dispatch' && role === 'admin' && <SmartDispatchView />}
          {activeTab === 'fleet' && role === 'admin' && <VehicleList />}
          {activeTab === 'requests' && <RequestsList />}
        </div>
      </main>
      <RequestModal />
      <AddVehicleModal />
      <AssignmentModal />
    </div>
  );
}