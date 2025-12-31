import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PendingIdeas from './PendingIdeas';
import AllIdeas from './AllIdeas';

export default function ManagerDashboard() {
  const [activeTab, setActiveTab] = useState('pending');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-green-600 text-white p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Manager Portal - Idea Bank</h1>
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
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-4 font-semibold border-b-2 transition ${
              activeTab === 'pending'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Pending Review
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-4 font-semibold border-b-2 transition ${
              activeTab === 'all'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            All Ideas
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {activeTab === 'pending' && <PendingIdeas />}
        {activeTab === 'all' && <AllIdeas />}
      </div>
    </div>
  );
}
