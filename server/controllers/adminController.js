import User from '../models/User.js';
import SignupRequest from '../models/SignupRequest.js';
import Department from '../models/Department.js';
import bcryptjs from 'bcryptjs';

export const getAllSignupRequests = async (req, res) => {
  try {
    const requests = await SignupRequest.find().populate('assignedDepartment', 'name');
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const approveSignupRequest = async (req, res) => {
  try {
    const { requestId, departmentId, tempPassword } = req.body;

    const signupRequest = await SignupRequest.findById(requestId);
    if (!signupRequest) {
      return res.status(404).json({ error: 'Signup request not found' });
    }

    const hashedPassword = await bcryptjs.hash(tempPassword, 10);
    const user = new User({
      email: signupRequest.email,
      password: hashedPassword,
      firstName: signupRequest.firstName,
      lastName: signupRequest.lastName,
      role: 'employee',
      department: departmentId,
      isApproved: true
    });

    await user.save();

    // Update signup request
    signupRequest.status = 'approved';
    signupRequest.assignedDepartment = departmentId;
    signupRequest.reviewedAt = new Date();
    signupRequest.reviewedBy = req.userId;
    await signupRequest.save();

    // Add employee to department
    await Department.findByIdAndUpdate(departmentId, {
      $push: { employees: user._id }
    });

    res.status(200).json({ message: 'Signup request approved', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const rejectSignupRequest = async (req, res) => {
  try {
    const { requestId } = req.body;

    const signupRequest = await SignupRequest.findByIdAndUpdate(
      requestId,
      {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: req.userId
      },
      { new: true }
    );

    res.status(200).json({ message: 'Signup request rejected', signupRequest });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createDepartment = async (req, res) => {
  try {
    const { name, description, managerId } = req.body;

    const department = new Department({
      name,
      description,
      manager: managerId
    });

    await department.save();
    res.status(201).json({ message: 'Department created', department });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find()
      .populate('manager', 'firstName lastName email')
      .populate('employees', 'firstName lastName email');
    res.status(200).json(departments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { name, description, managerId } = req.body;

    const department = await Department.findByIdAndUpdate(
      departmentId,
      { name, description, manager: managerId },
      { new: true }
    );

    res.status(200).json({ message: 'Department updated', department });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;

    await Department.findByIdAndDelete(departmentId);
    res.status(200).json({ message: 'Department deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().populate('department', 'name');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateUserDepartment = async (req, res) => {
  try {
    const { userId, departmentId } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { department: departmentId },
      { new: true }
    );

    res.status(200).json({ message: 'User department updated', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
