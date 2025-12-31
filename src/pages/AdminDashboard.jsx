import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SignupRequests from './SignupRequests';
import DepartmentManagement from './DepartmentManagement';
import FormBuilder from './FormBuilder';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('requests');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Portal - Idea Bank</h1>
          <div className="flex items-center gap-4">
            <span>Welcome, {user?.firstName} {user?.lastName}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-300 sticky top-0">
        <div className="max-w-7xl mx-auto flex">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-6 py-4 font-semibold border-b-2 transition ${
              activeTab === 'requests'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Signup Requests
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-6 py-4 font-semibold border-b-2 transition ${
              activeTab === 'departments'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Departments
          </button>
          <button
            onClick={() => setActiveTab('forms')}
            className={`px-6 py-4 font-semibold border-b-2 transition ${
              activeTab === 'forms'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Form Builder
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {activeTab === 'requests' && <SignupRequests />}
        {activeTab === 'departments' && <DepartmentManagement />}
        {activeTab === 'forms' && <FormBuilder />}
      </div>
    </div>
  );
}
