import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';

export default function FormBuilder() {
  const [forms, setForms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    fields: []
  });
  const [newField, setNewField] = useState({
    fieldName: '',
    fieldType: 'text',
    label: '',
    required: false,
    options: []
  });

  useEffect(() => {
    fetchForms();
    fetchCategories();
  }, []);

  const fetchForms = async () => {
    try {
      const data = await apiCall('/forms');
      setForms(data);
    } catch (err) {
      setError('Failed to fetch forms');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await apiCall('/forms/categories');
      setCategories(data);
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  const handleAddField = () => {
    if (!newField.fieldName || !newField.label) {
      setError('Field name and label are required');
      return;
    }

    setFormData({
      ...formData,
      fields: [...formData.fields, { ...newField }]
    });

    setNewField({
      fieldName: '',
      fieldType: 'text',
      label: '',
      required: false,
      options: []
    });
  };

  const handleRemoveField = (index) => {
    setFormData({
      ...formData,
      fields: formData.fields.filter((_, i) => i !== index)
    });
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    try {
      if (editingForm) {
        await apiCall(`/forms/${editingForm._id}`, 'PUT', formData);
        setMessage('Form updated successfully');
      } else {
        await apiCall('/forms', 'POST', formData);
        setMessage('Form created successfully');
      }
      fetchForms();
      setShowModal(false);
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteForm = async (formId) => {
    if (window.confirm('Are you sure you want to delete this form?')) {
      try {
        await apiCall(`/forms/${formId}`, 'DELETE');
        setMessage('Form deleted successfully');
        fetchForms();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleEditForm = (form) => {
    setEditingForm(form);
    setFormData({
      name: form.name,
      category: form.category,
      description: form.description,
      fields: form.fields || []
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      description: '',
      fields: []
    });
    setEditingForm(null);
    setNewField({
      fieldName: '',
      fieldType: 'text',
      label: '',
      required: false,
      options: []
    });
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Form Builder</h1>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create New Form
        </button>
      </div>

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

      <div className="grid grid-cols-1 gap-4">
        {forms.map(form => (
          <div key={form._id} className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-600">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-1">{form.name}</h3>
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-semibold">Category:</span> {form.category}
                </p>
                <p className="text-gray-700 mb-2">{form.description}</p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Fields:</span> {form.fields?.length || 0}
                </p>
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => handleEditForm(form)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteForm(form._id)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-8 w-full max-w-2xl my-8">
            <h2 className="text-2xl font-bold mb-4">
              {editingForm ? 'Edit Form' : 'Create New Form'}
            </h2>

            <form onSubmit={handleSaveForm} className="space-y-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Form Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    placeholder="e.g., Technology, Process Improvement"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-gray-100 p-4 rounded-lg">
                <h3 className="font-bold mb-4">Form Fields</h3>
                
                {formData.fields.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {formData.fields.map((field, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-2 rounded">
                        <span className="text-sm">{field.label} ({field.fieldType})</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveField(idx)}
                          className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2 bg-white p-4 rounded">
                  <div>
                    <label className="block text-sm font-medium mb-1">Field Name</label>
                    <input
                      type="text"
                      value={newField.fieldName}
                      onChange={(e) => setNewField({...newField, fieldName: e.target.value})}
                      placeholder="e.g., idea_title"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Label</label>
                    <input
                      type="text"
                      value={newField.label}
                      onChange={(e) => setNewField({...newField, label: e.target.value})}
                      placeholder="e.g., Idea Title"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Field Type</label>
                    <select
                      value={newField.fieldType}
                      onChange={(e) => setNewField({...newField, fieldType: e.target.value})}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="text">Text</option>
                      <option value="textarea">Textarea</option>
                      <option value="select">Select</option>
                      <option value="radio">Radio</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="date">Date</option>
                      <option value="file">File</option>
                    </select>
                  </div>
                  <label className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={newField.required}
                      onChange={(e) => setNewField({...newField, required: e.target.checked})}
                      className="mr-2"
                    />
                    Required field
                  </label>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="w-full px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Add Field
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Form
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
