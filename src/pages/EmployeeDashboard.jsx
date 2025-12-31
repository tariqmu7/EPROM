import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SubmitIdea from './SubmitIdea';
import MyIdeas from './MyIdeas';

export default function EmployeeDashboard() {
  const [activeTab, setActiveTab] = useState('submit');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-purple-600 text-white p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Employee Portal - Idea Bank</h1>
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
            onClick={() => setActiveTab('submit')}
            className={`px-6 py-4 font-semibold border-b-2 transition ${
              activeTab === 'submit'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Submit Idea
          </button>
          <button
            onClick={() => setActiveTab('my-ideas')}
            className={`px-6 py-4 font-semibold border-b-2 transition ${
              activeTab === 'my-ideas'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            My Ideas
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {activeTab === 'submit' && <SubmitIdea />}
        {activeTab === 'my-ideas' && <MyIdeas />}
      </div>
    </div>
  );
}
