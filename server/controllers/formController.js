import Form from '../models/Form.js';

export const createForm = async (req, res) => {
  try {
    const { name, category, description, fields } = req.body;

    const form = new Form({
      name,
      category,
      description,
      fields,
      createdBy: req.userId
    });

    await form.save();
    res.status(201).json({ message: 'Form created successfully', form });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllForms = async (req, res) => {
  try {
    const forms = await Form.find().populate('createdBy', 'firstName lastName');
    res.status(200).json(forms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFormsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const forms = await Form.find({ category }).populate('createdBy', 'firstName lastName');
    res.status(200).json(forms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFormById = async (req, res) => {
  try {
    const { formId } = req.params;
    const form = await Form.findById(formId).populate('createdBy', 'firstName lastName');
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    res.status(200).json(form);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateForm = async (req, res) => {
  try {
    const { formId } = req.params;
    const { name, category, description, fields } = req.body;

    const form = await Form.findByIdAndUpdate(
      formId,
      { name, category, description, fields, updatedAt: new Date() },
      { new: true }
    );

    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    res.status(200).json({ message: 'Form updated successfully', form });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteForm = async (req, res) => {
  try {
    const { formId } = req.params;
    await Form.findByIdAndDelete(formId);
    res.status(200).json({ message: 'Form deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await Form.distinct('category');
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
