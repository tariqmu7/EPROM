import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';

export default function AllIdeas() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchIdeas();
  }, []);

  const fetchIdeas = async () => {
    try {
      const data = await apiCall('/ideas/manager/pending');
      setIdeas(data);
    } catch (err) {
      setError('Failed to fetch ideas');
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

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">All Ideas Overview</h1>

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

      <div className="space-y-8">
        {groupedIdeas.submitted.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4 border-b-2 border-yellow-500 pb-2">Pending Review</h2>
            <div className="space-y-3">
              {groupedIdeas.submitted.map(idea => (
                <div key={idea._id} className="bg-yellow-50 p-4 rounded border-l-4 border-yellow-500">
                  <h3 className="font-bold">{idea.title}</h3>
                  <p className="text-sm text-gray-600">by {idea.submittedBy.firstName} {idea.submittedBy.lastName}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {groupedIdeas.approved.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4 border-b-2 border-green-500 pb-2">Approved</h2>
            <div className="space-y-3">
              {groupedIdeas.approved.map(idea => (
                <div key={idea._id} className="bg-green-50 p-4 rounded border-l-4 border-green-500">
                  <h3 className="font-bold">{idea.title}</h3>
                  <p className="text-sm text-gray-600">by {idea.submittedBy.firstName} {idea.submittedBy.lastName}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {groupedIdeas.rejected.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4 border-b-2 border-red-500 pb-2">Rejected</h2>
            <div className="space-y-3">
              {groupedIdeas.rejected.map(idea => (
                <div key={idea._id} className="bg-red-50 p-4 rounded border-l-4 border-red-500">
                  <h3 className="font-bold">{idea.title}</h3>
                  <p className="text-sm text-gray-600">by {idea.submittedBy.firstName} {idea.submittedBy.lastName}</p>
                  {idea.reviewComments && (
                    <p className="text-sm text-gray-700 mt-2"><span className="font-semibold">Feedback:</span> {idea.reviewComments}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
