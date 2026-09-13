# Project Directory Structure

```
exam-system/
├── ARCHITECTURE.md                  # System architecture diagram & free-tier specifications
├── DATABASE_SCHEMA.md               # Data models & entity relationship documentation
├── API_SPECIFICATION.md             # REST API endpoint reference
├── DIRECTORY_STRUCTURE.md           # Visual tree of the complete full-stack repository
├── DEPLOYMENT_GUIDE.md              # Step-by-step free-tier deployment instructions
├── .env.example                     # Environment variable template with free-tier key placeholders
│
├── backend/                         # Node.js + Express API Server
│   ├── package.json                 # Server dependencies (express, mongoose, jsonwebtoken, multer, @google/genai, cors)
│   ├── server.js                    # Express app initialization & HTTP server listener
│   ├── config/
│   │   └── db.js                    # MongoDB Mongoose connection handler with fallback memory store
│   ├── models/
│   │   ├── User.js                  # User model (Teacher / Student roles)
│   │   ├── Exam.js                  # Exam & embedded Question model
│   │   └── Submission.js            # Handwritten answer script submission model
│   ├── middleware/
│   │   ├── auth.js                  # JWT token verify & RBAC role guards (isTeacher/isStudent)
│   │   └── upload.js                # Multer file upload handler (PDF/JPG/PNG max 5MB)
│   ├── services/
│   │   ├── geminiService.js         # Google Gemini AI question generation service
│   │   └── storageService.js        # File storage helper (Cloudinary / Supabase / Local storage)
│   └── routes/
│       ├── authRoutes.js            # User Auth endpoints (/api/auth)
│       ├── examRoutes.js            # Exam CRUD & Question Generation (/api/exams)
│       ├── submissionRoutes.js      # Student script uploads (/api/submissions)
│       └── gradingRoutes.js         # Teacher manual grading endpoints (/api/grading)
│
└── frontend/                        # React + Vite Single Page Application
    ├── package.json                 # Frontend dependencies (react, react-router-dom, lucide-react, axios)
    ├── vite.config.js               # Vite build configuration & API proxy setup
    ├── index.html                   # HTML5 entry with Google Fonts (Inter / Outfit)
    └── src/
        ├── main.jsx                 # React root renderer
        ├── App.jsx                  # Main router setup & state provider wrappers
        ├── index.css                # Custom Vanilla CSS design system (Dark slate, glassmorphism, micro-animations)
        ├── context/
        │   └── AuthContext.jsx      # Global user auth context & JWT persistent state
        ├── components/
        │   ├── Navbar.jsx           # Dynamic navigation header based on user role
        │   ├── ColdStartBanner.jsx  # Render free-tier cold start indicator banner
        │   ├── ExamTimer.jsx        # Live exam countdown timer & auto-lock notice
        │   └── InlineScriptViewer.jsx # PDF & Image viewer for grading handwritten scripts
        └── pages/
            ├── LoginPage.jsx        # Login screen for teachers & students
            ├── RegisterPage.jsx     # Registration screen with role picker
            ├── TeacherDashboard.jsx # Teacher dashboard (manage exams, generate questions, view submissions)
            ├── CreateExamPage.jsx   # Create exam form & trigger AI question generation
            ├── ReviewQuestionsPage.jsx # AI-generated questions review & approval editor
            ├── StudentDashboard.jsx # Student portal (upcoming exams, take exam, view results)
            ├── ExamSessionPage.jsx  # Live exam screen displaying questions & upload widget
            └── GradingViewPage.jsx  # Teacher grading interface (view script side-by-side with marking fields)
```
