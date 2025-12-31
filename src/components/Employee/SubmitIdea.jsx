import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';

export default function SubmitIdea() {
  const [categories, setCategories] = useState([]);
  const [forms, setForms] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedForm, setSelectedForm] = useState('');
  const [idea, setIdea] = useState({
    title: '',
    description: '',
    category: ''
  });
  const [formData, setFormData] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      fetchFormsByCategory(selectedCategory);
    }
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const data = await apiCall('/forms/categories');
      setCategories(data);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch categories');
      setLoading(false);
    }
  };

  const fetchFormsByCategory = async (category) => {
    try {
      const data = await apiCall(`/forms/category/${category}`);
      setForms(data);
      setSelectedForm(data.length > 0 ? data[0]._id : '');
      setFormData({});
    } catch (err) {
      console.error('Failed to fetch forms', err);
    }
  };

  const handleFormFieldChange = (fieldName, value) => {
    setFormData({
      ...formData,
      [fieldName]: value
    });
  };

  const handleSubmitIdea = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      await apiCall('/ideas', 'POST', {
        title: idea.title,
        description: idea.description,
        category: selectedCategory,
        formId: selectedForm,
        formData
      });

      setMessage('Idea submitted successfully! Your manager will review it soon.');
      setIdea({ title: '', description: '', category: '' });
      setSelectedCategory('');
      setSelectedForm('');
      setFormData({});
    } catch (err) {
      setError(err.message || 'Failed to submit idea');
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  const currentForm = forms.find(f => f._id === selectedForm);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Submit Your Idea</h1>

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

      <div className="bg-white p-8 rounded-lg shadow-lg">
        <form onSubmit={handleSubmitIdea} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Idea Title</label>
              <input
                type="text"
                value={idea.title}
                onChange={(e) => setIdea({...idea, title: e.target.value})}
                placeholder="Give your idea a title"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={idea.description}
              onChange={(e) => setIdea({...idea, description: e.target.value})}
              placeholder="Describe your idea in detail"
              rows="4"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Form Fields */}
          {selectedCategory && forms.length > 0 && (
            <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-500">
              <h2 className="text-lg font-bold mb-4">Additional Information</h2>
              <p className="text-sm text-gray-600 mb-4">Form: {currentForm?.name}</p>

              {currentForm?.fields?.map((field, idx) => (
                <div key={idx} className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
                  </label>

                  {field.fieldType === 'text' && (
                    <input
                      type="text"
                      value={formData[field.fieldName] || ''}
                      onChange={(e) => handleFormFieldChange(field.fieldName, e.target.value)}
                      required={field.required}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}

                  {field.fieldType === 'textarea' && (
                    <textarea
                      value={formData[field.fieldName] || ''}
                      onChange={(e) => handleFormFieldChange(field.fieldName, e.target.value)}
                      required={field.required}
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}

                  {field.fieldType === 'select' && (
                    <select
                      value={formData[field.fieldName] || ''}
                      onChange={(e) => handleFormFieldChange(field.fieldName, e.target.value)}
                      required={field.required}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select an option</option>
                      {field.options?.map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {field.fieldType === 'radio' && (
                    <div className="space-y-2">
                      {field.options?.map((opt, i) => (
                        <label key={i} className="flex items-center">
                          <input
                            type="radio"
                            name={field.fieldName}
                            value={opt}
                            checked={formData[field.fieldName] === opt}
                            onChange={(e) => handleFormFieldChange(field.fieldName, e.target.value)}
                            className="mr-2"
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}

                  {field.fieldType === 'checkbox' && (
                    <div className="space-y-2">
                      {field.options?.map((opt, i) => (
                        <label key={i} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={(formData[field.fieldName] || []).includes(opt)}
                            onChange={(e) => {
                              const current = formData[field.fieldName] || [];
                              if (e.target.checked) {
                                handleFormFieldChange(field.fieldName, [...current, opt]);
                              } else {
                                handleFormFieldChange(field.fieldName, current.filter(v => v !== opt));
                              }
                            }}
                            className="mr-2"
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}

                  {field.fieldType === 'date' && (
                    <input
                      type="date"
                      value={formData[field.fieldName] || ''}
                      onChange={(e) => handleFormFieldChange(field.fieldName, e.target.value)}
                      required={field.required}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}

                  {field.fieldType === 'file' && (
                    <input
                      type="file"
                      onChange={(e) => handleFormFieldChange(field.fieldName, e.target.files[0]?.name || '')}
                      required={field.required}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            Submit Idea
          </button>
        </form>
      </div>
    </div>
  );
}
