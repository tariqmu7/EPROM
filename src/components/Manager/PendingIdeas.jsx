import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';

export default function PendingIdeas() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [comments, setComments] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [action, setAction] = useState('');
  const [message, setMessage] = useState('');
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

  const handleOpenModal = (idea, act) => {
    setSelectedIdea(idea);
    setAction(act);
    setComments('');
    setShowModal(true);
  };

  const handleSubmitReview = async () => {
    try {
      if (action === 'approve') {
        await apiCall('/ideas/manager/approve', 'POST', {
          ideaId: selectedIdea._id,
          comments
        });
        setMessage('Idea approved successfully');
      } else {
        await apiCall('/ideas/manager/reject', 'POST', {
          ideaId: selectedIdea._id,
          comments
        });
        setMessage('Idea rejected successfully');
      }

      setShowModal(false);
      fetchIdeas();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  const pendingIdeas = ideas.filter(idea => idea.status === 'submitted');

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Pending Ideas for Review</h1>

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

      {pendingIdeas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">No pending ideas for review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingIdeas.map(idea => (
            <div key={idea._id} className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-500">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">{idea.title}</h3>
                  <p className="text-gray-700 mb-3">{idea.description}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="font-semibold">Submitted by:</span>
                      <p>{idea.submittedBy.firstName} {idea.submittedBy.lastName}</p>
                    </div>
                    <div>
                      <span className="font-semibold">Category:</span>
                      <p>{idea.category}</p>
                    </div>
                    <div>
                      <span className="font-semibold">Status:</span>
                      <p className="text-yellow-600 font-semibold">{idea.status}</p>
                    </div>
                    <div>
                      <span className="font-semibold">Form Used:</span>
                      <p>{idea.formUsed?.name || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-x-2">
                <button
                  onClick={() => handleOpenModal(idea, 'approve')}
                  className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleOpenModal(idea, 'reject')}
                  className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">
              {action === 'approve' ? 'Approve Idea' : 'Reject Idea'}
            </h2>
            <p className="text-gray-600 mb-4">
              <span className="font-semibold">Idea:</span> {selectedIdea?.title}
            </p>
            <div>
              <label className="block text-sm font-medium mb-2">Comments (Optional)</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add your feedback..."
                rows="4"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mt-6 flex gap-4">
              <button
                onClick={handleSubmitReview}
                className={`flex-1 px-4 py-2 text-white rounded-lg ${
                  action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {action === 'approve' ? 'Approve' : 'Reject'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
