# Idea Bank - Complete Setup Guide

## Project Structure

```
EPROM/
├── server/                      # Backend (Node.js + Express)
│   ├── models/                  # MongoDB schemas
│   ├── routes/                  # API routes
│   ├── controllers/             # Business logic
│   ├── middleware/              # Auth & validation
│   ├── config/                  # Database config
│   ├── server.js               # Main server file
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
└── src/                        # Frontend (React + Vite)
    ├── pages/                  # Page components
    ├── components/
    │   ├── Auth/              # Login/Register
    │   ├── Admin/             # Admin portal components
    │   ├── Manager/           # Manager portal components
    │   └── Employee/          # Employee portal components
    ├── context/               # AuthContext
    ├── utils/                 # API utility functions
    ├── App.jsx               # Main routing
    └── main.jsx
```

## Installation & Setup

### 1. Backend Setup

```bash
cd server
npm install
```

**Configure `.env` file:**
```
MONGODB_URI=mongodb://localhost:27017/idea-bank
JWT_SECRET=your_secure_jwt_secret_key
PORT=5000
NODE_ENV=development
```

**Start MongoDB locally** (if using local instance):
```bash
mongod
```

**Start the backend server:**
```bash
npm run dev    # For development with nodemon
npm start      # For production
```

### 2. Frontend Setup

```bash
cd ../
npm install
```

**Configure `.env` file:**
```
VITE_API_URL=http://localhost:5000/api
```

**Start the frontend:**
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Features Overview

### 1. **Admin Portal**
- **Signup Requests**: Approve/reject employee signup requests and assign to departments
- **Department Management**: Create, edit, and manage departments
- **Form Builder**: Create custom forms with various field types for different categories
- **User Management**: View all users and manage their roles

### 2. **Manager Portal**
- **Pending Ideas**: Review ideas submitted by employees in their department
- **Approve/Reject**: Approve or reject ideas with comments
- **Ideas Overview**: View all ideas grouped by status

### 3. **Employee Portal**
- **Submit Idea**: Submit ideas using admin-created forms tailored by category
- **My Ideas**: View submitted ideas and their status
- **Track Progress**: See manager feedback on approved/rejected ideas

## Authentication Flow

1. **Register**: Employees fill out signup form with company email
2. **Pending Approval**: Request awaits admin approval
3. **Admin Assigns**: Admin approves and assigns employee to department
4. **Login**: Employee can now login with assigned role
5. **Role-Based Access**: System ensures users can only access their portal

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new employee
- `POST /api/auth/login` - Login user
- `POST /api/auth/create-admin` - Create admin (for initial setup)

### Admin Routes
- `GET /api/admin/signup-requests` - Get pending requests
- `POST /api/admin/signup-requests/approve` - Approve request
- `POST /api/admin/signup-requests/reject` - Reject request
- `POST /api/admin/departments` - Create department
- `GET /api/admin/departments` - Get all departments
- `PUT /api/admin/departments/:id` - Update department
- `DELETE /api/admin/departments/:id` - Delete department

### Form Routes
- `POST /api/forms` - Create form (admin only)
- `GET /api/forms` - Get all forms
- `GET /api/forms/category/:category` - Get forms by category
- `PUT /api/forms/:id` - Update form (admin only)
- `DELETE /api/forms/:id` - Delete form (admin only)

### Idea Routes
- `POST /api/ideas` - Submit idea (employee)
- `GET /api/ideas/employee/my-ideas` - Get employee's ideas
- `GET /api/ideas/manager/pending` - Get pending ideas (manager)
- `POST /api/ideas/manager/approve` - Approve idea (manager)
- `POST /api/ideas/manager/reject` - Reject idea (manager)
- `GET /api/ideas` - Get all ideas (admin)

## User Roles & Permissions

### Admin
- ✅ Manage users and departments
- ✅ Create/edit/delete forms
- ✅ View all ideas
- ✅ Approve signup requests

### Manager
- ✅ Review and approve/reject ideas from their department
- ✅ Provide feedback on ideas
- ✅ View all ideas in their department

### Employee
- ✅ Submit ideas using forms
- ✅ View their submitted ideas
- ✅ See manager feedback

## Technology Stack

**Backend:**
- Node.js with Express
- MongoDB with Mongoose
- JWT for authentication
- bcryptjs for password hashing

**Frontend:**
- React with Vite
- React Router for navigation
- Tailwind CSS for styling
- Context API for state management

## Initial Setup Steps

1. **Start MongoDB**
   ```bash
   mongod
   ```

2. **Start Backend Server**
   ```bash
   cd server
   npm run dev
   ```

3. **Start Frontend**
   ```bash
   npm run dev
   ```

4. **Create Admin User** (via API call or login page)
   - Use the special admin creation endpoint
   - Or send POST request to `/api/auth/create-admin`

5. **Access the Application**
   - Go to `http://localhost:5173`
   - Login as admin to set up departments and forms
   - Register as employee to test employee portal

## Form Customization

The admin can create forms with the following field types:
- **Text**: Single-line text input
- **Textarea**: Multi-line text
- **Select**: Dropdown menu
- **Radio**: Single choice
- **Checkbox**: Multiple choices
- **Date**: Date picker
- **File**: File upload

Each form belongs to a category, and employees see the appropriate form based on their idea's category.

## Security Features

- JWT token-based authentication
- Password hashing with bcryptjs
- Role-based access control (RBAC)
- Email validation
- Protected API routes
- Token expiration (7 days)

## Troubleshooting

**MongoDB Connection Error**
- Ensure MongoDB is running: `mongod`
- Check connection string in `.env`

**API Connection Error**
- Verify backend is running on port 5000
- Check CORS configuration in server.js
- Verify VITE_API_URL in frontend .env

**Authentication Issues**
- Clear browser localStorage
- Logout and login again
- Check JWT_SECRET is set correctly in server .env

## Next Steps

1. Configure proper environment variables for production
2. Set up email notifications for approvals
3. Add audit logging
4. Implement idea archiving
5. Add advanced search and filtering
6. Set up deployment pipeline

---

**Happy Idea Banking! 💡**
