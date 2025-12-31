import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';

export default function MyIdeas() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchIdeas();
  }, []);

  const fetchIdeas = async () => {
    try {
      const data = await apiCall('/ideas/employee/my-ideas');
      setIdeas(data);
    } catch (err) {
      setError('Failed to fetch your ideas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  const groupedIdeas = {
    submitted: ideas.filter(i => i.status === 'submitted'),
    approved: ideas.filter(i => i.status === 'approved'),
    rejected: ideas.filter(i => i.status === 'rejected')
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted':
        return 'border-yellow-500 bg-yellow-50';
      case 'approved':
        return 'border-green-500 bg-green-50';
      case 'rejected':
        return 'border-red-500 bg-red-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">My Ideas</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-yellow-100 p-6 rounded-lg">
          <p className="text-gray-600 text-sm">Pending Review</p>
          <p className="text-3xl font-bold text-yellow-600">{groupedIdeas.submitted.length}</p>
        </div>
        <div className="bg-green-100 p-6 rounded-lg">
          <p className="text-gray-600 text-sm">Approved</p>
          <p className="text-3xl font-bold text-green-600">{groupedIdeas.approved.length}</p>
        </div>
        <div className="bg-red-100 p-6 rounded-lg">
          <p className="text-gray-600 text-sm">Rejected</p>
          <p className="text-3xl font-bold text-red-600">{groupedIdeas.rejected.length}</p>
        </div>
      </div>

      <div className="space-y-4">
        {ideas.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-600 text-lg">You haven't submitted any ideas yet</p>
          </div>
        ) : (
          ideas.map(idea => (
            <div
              key={idea._id}
              className={`p-6 rounded-lg shadow border-l-4 ${getStatusColor(idea.status)} bg-white`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">{idea.title}</h3>
                  <p className="text-gray-700 mb-3">{idea.description}</p>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="font-semibold">Category:</span>
                      <p>{idea.category}</p>
                    </div>
                    <div>
                      <span className="font-semibold">Status:</span>
                      <p className="font-semibold capitalize">{idea.status.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <span className="font-semibold">Submitted:</span>
                      <p>{new Date(idea.submittedAt).toLocaleDateString()}</p>
                    </div>
                    {idea.reviewedAt && (
                      <div>
                        <span className="font-semibold">Reviewed:</span>
                        <p>{new Date(idea.reviewedAt).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>

                  {idea.reviewComments && (
                    <div className="bg-gray-100 p-3 rounded mt-3">
                      <p className="text-sm">
                        <span className="font-semibold">Manager Feedback:</span>
                      </p>
                      <p className="text-sm text-gray-700">{idea.reviewComments}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
