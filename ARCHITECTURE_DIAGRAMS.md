# Idea Bank - Complete Architecture & Workflow Diagrams

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        IDEA BANK SYSTEM                           │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER (Frontend)                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Browser (React + Vite)                                 │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │  Login Page                                        │ │   │
│  │  │  ├─ Select Portal (Admin/Manager/Employee)       │ │   │
│  │  │  ├─ Enter Credentials                             │ │   │
│  │  │  └─ Route to Appropriate Dashboard                │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                           │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │  Protected Routes                                  │ │   │
│  │  │  ├─ Admin → AdminDashboard                         │ │   │
│  │  │  ├─ Manager → ManagerDashboard                     │ │   │
│  │  │  └─ Employee → EmployeeDashboard                   │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↕
                    Secure HTTP + JWT
                            ↕
┌─────────────────────────────────────────────────────────────────┐
│                  SERVER LAYER (Backend)                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Express.js REST API                                   │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │  /api/auth                                         │ │   │
│  │  │  ├─ POST /register (new user request)             │ │   │
│  │  │  ├─ POST /login (authenticate & token)            │ │   │
│  │  │  └─ POST /create-admin (initial setup)            │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                           │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │  /api/admin (Admin Only)                           │ │   │
│  │  │  ├─ GET/POST signup-requests                      │ │   │
│  │  │  ├─ GET/POST/PUT/DELETE departments              │ │   │
│  │  │  └─ GET/PUT user management                       │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                           │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │  /api/forms (Admin Creates, All Read)             │ │   │
│  │  │  ├─ POST /create form                              │ │   │
│  │  │  ├─ GET / (all forms)                              │ │   │
│  │  │  ├─ GET /category/:cat (by category)              │ │   │
│  │  │  └─ PUT/DELETE (admin only)                        │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                           │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │  /api/ideas (Role-Based)                           │ │   │
│  │  │  ├─ POST / (employees submit)                      │ │   │
│  │  │  ├─ GET /employee/my-ideas                         │ │   │
│  │  │  ├─ GET /manager/pending (manager review)          │ │   │
│  │  │  ├─ POST /manager/approve|reject                   │ │   │
│  │  │  └─ GET / (admin view all)                         │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Middleware Stack                                       │   │
│  │  ├─ CORS (cross-origin requests)                       │   │
│  │  ├─ JWT Verification (token validation)                │   │
│  │  ├─ Role Authorization (RBAC checks)                   │   │
│  │  └─ Error Handling                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↕
                     Mongoose ORM
                            ↕
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER (Database)                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  MongoDB Atlas / Local Instance                         │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │  Collections:                                      │ │   │
│  │  │  ├─ users (auth, roles, departments)             │ │   │
│  │  │  ├─ departments (name, manager, employees)        │ │   │
│  │  │  ├─ signuprequests (pending approvals)            │ │   │
│  │  │  ├─ forms (templates with fields)                 │ │   │
│  │  │  └─ ideas (submissions & reviews)                 │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Role Flow Diagram

```
                          ┌─────────────────┐
                          │  New Employee   │
                          └────────┬────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │  Register via Email  │
                        │  (SignupRequest)     │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │  Pending Approval    │
                        │  (Admin Review)      │
                        └──────┬───────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
            ┌─────────────┐        ┌──────────────┐
            │  Approved   │        │  Rejected    │
            │ (Create Acc)│        │ (Decline Msg)│
            └──────┬──────┘        └──────────────┘
                   │
                   ▼
        ┌─────────────────────────────┐
        │  Employee Account Created   │
        │  + Department Assignment    │
        └──────────┬──────────────────┘
                   │
                   ▼
        ┌─────────────────────────────┐
        │  Can Login as EMPLOYEE      │
        │  ├─ Submit Ideas            │
        │  ├─ View My Ideas           │
        │  └─ See Manager Feedback    │
        └─────────────────────────────┘
```

---

## Idea Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│                    IDEA LIFECYCLE                             │
└──────────────────────────────────────────────────────────────┘

EMPLOYEE PORTAL
┌────────────────────────────────────────┐
│  1. Select Category                    │ ← Admin-created categories
│     (e.g., Technology, Process Imp.)   │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│  2. Fill Dynamic Form                  │ ← Form varies by category
│     (text fields, dropdowns, dates)    │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│  3. Submit Idea                        │
│     Status: SUBMITTED                  │
│     → Stored in Database               │
└────────────────┬───────────────────────┘
                 │
                 ▼
                 
MANAGER PORTAL
┌────────────────────────────────────────┐
│  4. Idea Appears in Pending Review     │
│     Status: SUBMITTED                  │
│     ← Manager sees all team ideas      │
└────────────────┬───────────────────────┘
                 │
                 ▼
                 
         ┌───────┴──────────┐
         ▼                  ▼
    ┌─────────┐      ┌─────────────┐
    │ APPROVE │      │   REJECT    │
    │  with   │      │    with     │
    │feedback │      │  feedback   │
    └────┬────┘      └──────┬──────┘
         │                  │
         ▼                  ▼
    ┌──────────┐     ┌───────────────┐
    │ APPROVED │     │   REJECTED    │
    │ Status   │     │   Status      │
    └────┬─────┘     └────┬──────────┘
         │                │
         └────────┬───────┘
                  ▼
                  
EMPLOYEE PORTAL (Feedback)
┌────────────────────────────────────────┐
│  5. View Decision in "My Ideas"        │
│     See Manager's Comments/Feedback    │
│     Status: APPROVED or REJECTED       │
└────────────────────────────────────────┘
```

---

## Authentication & Authorization Flow

```
┌──────────────────────────────────────────────────────────────┐
│              LOGIN & AUTHORIZATION FLOW                       │
└──────────────────────────────────────────────────────────────┘

CLIENT                              SERVER
  │                                   │
  ├─ Submit Login Form ──────────────>│
  │  (email, password, role)          │
  │                                   │
  │                            Check User Exists
  │                            ├─ Email correct?
  │                            ├─ Password hash valid?
  │                            └─ Role assigned?
  │                                   │
  │  <──── Generate JWT Token ────────┤
  │  (expires in 7 days)              │
  │  {                                │
  │    userId: "...",                 │
  │    email: "...",                  │
  │    role: "employee|manager|admin" │
  │  }                                │
  │                                   │
  │  Store Token in localStorage      │
  │                                   │
  │  GET /api/admin/users             │
  │  Header: Authorization Bearer ... │─────────────>│
  │                            JWT Verification
  │                            ├─ Token valid?
  │                            ├─ Not expired?
  │                            └─ Role authorized?
  │                                   │
  │  <────── Return Admin Data ───────┤
  │                                   │
  │  OR                               │
  │                                   │
  │  X Unauthorized Error             │
```

---

## Database Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                 MONGODB RELATIONSHIPS                         │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐
│   USERS      │
├──────────────┤
│ _id          │
│ email ◆      │ (unique)
│ password     │
│ firstName    │
│ lastName     │
│ role         │ ─────┐
│ department ──┼──┐   │
│ isApproved   │  │   │
│ createdAt    │  │   │
└──────────────┘  │   │
       ▲          │   │
       │          │   │
       │    ┌─────▼───┴──────────┐
       │    │   DEPARTMENTS      │
       │    ├────────────────────┤
       ├─── │ _id                │
       │    │ name               │
       │    │ description        │
       └─── │ manager (ref User) │
            │ employees []       │
            └────────────────────┘

┌──────────────────────────┐
│   SIGNUPREQUESTS        │
├──────────────────────────┤
│ _id                      │
│ email                    │
│ firstName, lastName      │
│ status (pending/...)     │
│ assignedDepartment ─┐    │
│ reviewedBy ────┐    │    │
│ requestedAt    │    │    │
└───────────────┼────┼────┘
                │    │
                │    └──> to DEPARTMENTS._id
                └──> to USERS._id

┌──────────────────────────┐
│   FORMS                 │
├──────────────────────────┤
│ _id                      │
│ name                     │
│ category                 │
│ description              │
│ fields []                │
│  ├─ fieldName           │
│  ├─ fieldType           │
│  ├─ label               │
│  ├─ required            │
│  └─ options             │
│ createdBy ───┐          │
│ createdAt    │          │
└──────────────┼──────────┘
               └──> to USERS._id

┌──────────────────────────┐
│   IDEAS                 │
├──────────────────────────┤
│ _id                      │
│ title                    │
│ description              │
│ category                 │
│ submittedBy ──┐         │
│ department ───┼──┐      │
│ formUsed ─────┼──┼──┐   │
│ formData      │  │  │   │
│ status        │  │  │   │
│ reviewedBy ┐  │  │  │   │
│ comments   │  │  │  │   │
│ timestamps │  │  │  │   │
└────────────┼──┼──┼──┼───┘
             │  │  │  │
             └─ └──┼──┤──> to USERS._id
                   └─────> to DEPARTMENTS._id
                   └────> to FORMS._id
```

---

## Admin Portal - Data Management Flow

```
ADMIN DASHBOARD
├─ TAB 1: SIGNUP REQUESTS
│  ├─ Load all signuprequests (status: pending)
│  ├─ Display:
│  │  ├─ Email
│  │  ├─ Name
│  │  ├─ Select Department dropdown
│  │  ├─ Enter Temp Password
│  │  └─ Approve/Reject buttons
│  │
│  ├─ On Approve:
│  │  ├─ Create new USER document
│  │  ├─ Hash temporary password
│  │  ├─ Add to selected department
│  │  ├─ Set role to 'employee'
│  │  ├─ Mark as isApproved = true
│  │  └─ Update SignupRequest status = 'approved'
│  │
│  └─ On Reject:
│     └─ Update SignupRequest status = 'rejected'
│
├─ TAB 2: DEPARTMENTS
│  ├─ Load all departments
│  ├─ Display as cards with:
│  │  ├─ Name
│  │  ├─ Description
│  │  ├─ Manager name
│  │  ├─ Employee count
│  │  └─ Delete button
│  │
│  └─ Add New Department:
│     ├─ Form: name, description
│     └─ Create new DEPARTMENT document
│
└─ TAB 3: FORM BUILDER
   ├─ Load all forms grouped by category
   ├─ Create New Form:
   │  ├─ Category name
   │  ├─ Form name
   │  ├─ Description
   │  └─ Add Fields:
   │     ├─ Field name (fieldName)
   │     ├─ Label (display name)
   │     ├─ Type (text/textarea/select/date/file/etc)
   │     ├─ Required? (checkbox)
   │     └─ Options (for select/radio/checkbox)
   │
   ├─ Save Form:
   │  └─ Create new FORM document with all fields
   │
   └─ Edit/Delete Forms:
      └─ Update or remove from database
```

---

## Employee Idea Submission Flow

```
EMPLOYEE DASHBOARD - SUBMIT IDEA TAB

Step 1: Select Category
  ├─ Load all unique categories from FORMS collection
  ├─ Display as buttons/dropdown
  └─ Trigger: Load forms for that category

Step 2: Auto-Select Form
  ├─ Query FORMS where category = selected
  ├─ Display first form (or let user choose)
  └─ Load form fields definition

Step 3: Fill Basic Info
  ├─ Title (text input)
  ├─ Description (textarea)
  └─ Category (already selected)

Step 4: Dynamic Form Fields
  ├─ Loop through form.fields
  ├─ Render appropriate input based on fieldType
  │  ├─ text → <input type="text">
  │  ├─ textarea → <textarea>
  │  ├─ select → <select><option>
  │  ├─ radio → <input type="radio">
  │  ├─ checkbox → <input type="checkbox">
  │  ├─ date → <input type="date">
  │  └─ file → <input type="file">
  └─ Show required indicator (*)

Step 5: Submit
  ├─ Validate required fields
  ├─ Collect form data
  ├─ POST /api/ideas with:
  │  ├─ title
  │  ├─ description
  │  ├─ category
  │  ├─ formId
  │  └─ formData (key-value pairs)
  │
  └─ On Success:
     ├─ Create IDEA document:
     │  ├─ submittedBy = current user._id
     │  ├─ department = current user.department
     │  ├─ formUsed = selected form._id
     │  ├─ status = 'submitted'
     │  └─ formData = collected data
     │
     ├─ Show success message
     └─ Redirect to My Ideas tab
```

---

## Manager Review Workflow

```
MANAGER DASHBOARD - PENDING REVIEW TAB

Step 1: Load Pending Ideas
  ├─ Query IDEAS where:
  │  ├─ department = manager's department
  │  └─ status = 'submitted'
  │
  └─ Display each idea as card with:
     ├─ Title
     ├─ Description
     ├─ Category
     ├─ Submitted by (employee name)
     ├─ Date submitted
     └─ All form data fields

Step 2: Review Options
  ├─ APPROVE Button
  │  └─ Opens modal with:
  │     ├─ Idea title (read-only)
  │     ├─ Comments textarea (optional)
  │     └─ Confirm button
  │
  └─ REJECT Button
     └─ Opens modal with:
        ├─ Idea title (read-only)
        ├─ Feedback textarea (required)
        └─ Confirm button

Step 3: Submit Decision
  ├─ POST /api/ideas/manager/approve OR reject
  ├─ Body:
  │  ├─ ideaId
  │  └─ comments
  │
  └─ Updates IDEA document:
     ├─ status = 'approved' or 'rejected'
     ├─ reviewedBy = manager user._id
     ├─ reviewComments = provided feedback
     └─ reviewedAt = timestamp

Step 4: Refresh View
  ├─ Remove approved/rejected idea from pending list
  └─ Show success message
```

---

## Complete User Workflows

### New Employee Registration to Idea Approval

```
DAY 1 - EMPLOYEE SIGNUP
1. Visit app → Click "Register"
2. Enter: email@company.com, First, Last
3. Submit → Request saved as PENDING
4. See: "Awaiting admin approval" message

DAY 2 - ADMIN APPROVAL
1. Admin logs in → Goes to Signup Requests
2. Sees: email@company.com, First, Last
3. Selects: Department dropdown
4. Enters: Temporary Password
5. Clicks: Approve
6. System:
   ├─ Creates USER with temp password
   ├─ Adds to department
   ├─ Sets role = 'employee'
   └─ Marks approved

DAY 3 - EMPLOYEE FIRST LOGIN
1. Employee receives notification
2. Logs in: email@company.com + temp password
3. System redirects to Employee Portal
4. Employee updates password (optional)

DAY 4 - SUBMIT IDEA
1. Employee: Submit Idea tab
2. Selects: "Technology" category
3. Form auto-loads with tech-specific fields
4. Fills:
   ├─ Idea Title: "AI Chatbot"
   ├─ Description: "..."
   ├─ Impact: High
   └─ Timeline: 2024-06-01
5. Clicks: Submit
6. Idea status: SUBMITTED

DAY 5 - MANAGER REVIEW
1. Manager logs in → Pending Review
2. Sees: "AI Chatbot" by employee
3. Reviews all data
4. Clicks: Approve
5. Adds: "Great! Let's implement"
6. System updates idea to APPROVED

DAY 6 - EMPLOYEE SEES RESULT
1. Employee: My Ideas tab
2. Sees idea status: APPROVED
3. Reads feedback: "Great! Let's implement"
4. Celebrates! 🎉
```

---

**This comprehensive architecture ensures a scalable, secure, and user-friendly idea management system!**
