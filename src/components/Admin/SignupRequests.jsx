import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';

export default function SignupRequests() {
  const [requests, setRequests] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState({});
  const [tempPasswords, setTempPasswords] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRequests();
    fetchDepartments();
  }, []);

  const fetchRequests = async () => {
    try {
      const data = await apiCall('/admin/signup-requests');
      setRequests(data);
    } catch (err) {
      setError('Failed to fetch signup requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const data = await apiCall('/admin/departments');
      setDepartments(data);
    } catch (err) {
      console.error('Failed to fetch departments', err);
    }
  };

  const handleApprove = async (requestId) => {
    if (!selectedDept[requestId] || !tempPasswords[requestId]) {
      setError('Please select department and set temporary password');
      return;
    }

    try {
      await apiCall('/admin/signup-requests/approve', 'POST', {
        requestId,
        departmentId: selectedDept[requestId],
        tempPassword: tempPasswords[requestId]
      });

      setMessage('Signup request approved successfully');
      fetchRequests();
      setSelectedDept(prev => ({ ...prev, [requestId]: '' }));
      setTempPasswords(prev => ({ ...prev, [requestId]: '' }));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReject = async (requestId) => {
    try {
      await apiCall('/admin/signup-requests/reject', 'POST', { requestId });
      setMessage('Signup request rejected');
      fetchRequests();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Signup Requests</h1>

      {message && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="border p-3 text-left">Name</th>
              <th className="border p-3 text-left">Email</th>
              <th className="border p-3 text-left">Status</th>
              <th className="border p-3 text-left">Department</th>
              <th className="border p-3 text-left">Temp Password</th>
              <th className="border p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(request => (
              <tr key={request._id} className="hover:bg-gray-100">
                <td className="border p-3">{request.firstName} {request.lastName}</td>
                <td className="border p-3">{request.email}</td>
                <td className="border p-3">
                  <span className={`px-3 py-1 rounded text-sm font-semibold ${
                    request.status === 'pending' ? 'bg-yellow-200' :
                    request.status === 'approved' ? 'bg-green-200' :
                    'bg-red-200'
                  }`}>
                    {request.status}
                  </span>
                </td>
                <td className="border p-3">
                  {request.status === 'pending' ? (
                    <select
                      value={selectedDept[request._id] || ''}
                      onChange={(e) => setSelectedDept(prev => ({ ...prev, [request._id]: e.target.value }))}
                      className="px-3 py-1 border border-gray-300 rounded"
                    >
                      <option value="">Select Department</option>
                      {departments.map(dept => (
                        <option key={dept._id} value={dept._id}>{dept.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span>{request.assignedDepartment?.name || '-'}</span>
                  )}
                </td>
                <td className="border p-3">
                  {request.status === 'pending' ? (
                    <input
                      type="password"
                      placeholder="Temp password"
                      value={tempPasswords[request._id] || ''}
                      onChange={(e) => setTempPasswords(prev => ({ ...prev, [request._id]: e.target.value }))}
                      className="px-3 py-1 border border-gray-300 rounded w-full"
                    />
                  ) : '-'}
                </td>
                <td className="border p-3">
                  {request.status === 'pending' && (
                    <div className="space-x-2">
                      <button
                        onClick={() => handleApprove(request._id)}
                        className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(request._id)}
                        className="px-4 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
