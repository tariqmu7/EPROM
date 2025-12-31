import Idea from '../models/Idea.js';
import User from '../models/User.js';

export const submitIdea = async (req, res) => {
  try {
    const { title, description, category, formId, formData } = req.body;

    // Get user to find their department
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const idea = new Idea({
      title,
      description,
      category,
      submittedBy: req.userId,
      department: user.department,
      formUsed: formId,
      formData,
      status: 'submitted'
    });

    await idea.save();
    res.status(201).json({ message: 'Idea submitted successfully', idea });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getEmployeeIdeas = async (req, res) => {
  try {
    const ideas = await Idea.find({ submittedBy: req.userId })
      .populate('submittedBy', 'firstName lastName')
      .populate('reviewedBy', 'firstName lastName')
      .populate('formUsed', 'name category');

    res.status(200).json(ideas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getIdeaById = async (req, res) => {
  try {
    const { ideaId } = req.params;
    const idea = await Idea.findById(ideaId)
      .populate('submittedBy', 'firstName lastName')
      .populate('reviewedBy', 'firstName lastName')
      .populate('formUsed', 'name category');

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    res.status(200).json(idea);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getManagerIdeas = async (req, res) => {
  try {
    // Get all ideas from the manager's department
    const user = await User.findById(req.userId);
    if (!user || user.role !== 'manager') {
      return res.status(403).json({ error: 'Only managers can access this' });
    }

    const ideas = await Idea.find({ department: user.department })
      .populate('submittedBy', 'firstName lastName email')
      .populate('formUsed', 'name category');

    res.status(200).json(ideas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const approveIdea = async (req, res) => {
  try {
    const { ideaId, comments } = req.body;

    const idea = await Idea.findByIdAndUpdate(
      ideaId,
      {
        status: 'approved',
        reviewedBy: req.userId,
        reviewComments: comments,
        reviewedAt: new Date()
      },
      { new: true }
    );

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    res.status(200).json({ message: 'Idea approved', idea });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const rejectIdea = async (req, res) => {
  try {
    const { ideaId, comments } = req.body;

    const idea = await Idea.findByIdAndUpdate(
      ideaId,
      {
        status: 'rejected',
        reviewedBy: req.userId,
        reviewComments: comments,
        reviewedAt: new Date()
      },
      { new: true }
    );

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    res.status(200).json({ message: 'Idea rejected', idea });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllIdeas = async (req, res) => {
  try {
    const ideas = await Idea.find()
      .populate('submittedBy', 'firstName lastName email')
      .populate('department', 'name')
      .populate('reviewedBy', 'firstName lastName')
      .populate('formUsed', 'name category');

    res.status(200).json(ideas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
