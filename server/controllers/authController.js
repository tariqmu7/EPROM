import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import SignupRequest from '../models/SignupRequest.js';

const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export const register = async (req, res) => {
  try {
    const { email, firstName, lastName } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Check if signup request already exists
    const existingRequest = await SignupRequest.findOne({ email });
    if (existingRequest) {
      return res.status(400).json({ error: 'Signup request already exists' });
    }

    // Create signup request
    const signupRequest = new SignupRequest({
      email,
      firstName,
      lastName
    });

    await signupRequest.save();
    res.status(201).json({ message: 'Signup request submitted. Awaiting admin approval.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Validate required fields
    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password, and role are required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is approved
    if (!user.isApproved) {
      return res.status(403).json({ error: 'Your account is not yet approved by admin' });
    }

    // Check if user has the requested role
    if (user.role !== role) {
      return res.status(403).json({ error: `You are not authorized to access the ${role} portal` });
    }

    // Verify password
    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user);
    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createAdminUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    const hashedPassword = await bcryptjs.hash(password, 10);
    const admin = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'admin',
      isApproved: true
    });

    await admin.save();
    res.status(201).json({ message: 'Admin user created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
