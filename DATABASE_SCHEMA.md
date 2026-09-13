# Database Schema Specification

This document details the MongoDB / Mongoose schema definitions powering the Online Examination System.

## Collections & Schemas

### 1. Users Collection (`users`)
Stores teacher and student user accounts.

```javascript
{
  _id: ObjectId,
  name: String,            // Required, e.g., "Dr. Alan Turing" or "Jane Doe"
  email: String,           // Required, Unique, lowercase, indexed
  passwordHash: String,    // Required, bcrypt encrypted hash
  role: String,            // Required, enum: ["teacher", "student"]
  createdAt: Date          // Default: Date.now
}
```

### 2. Exams Collection (`exams`)
Stores exam definitions, schedules, state, and embedded or referenced questions.

```javascript
{
  _id: ObjectId,
  title: String,           // Required, e.g., "Midterm Exam - Data Structures"
  subject: String,         // Required, e.g., "Computer Science"
  topic: String,           // Required, e.g., "Binary Search Trees & Graphs"
  difficulty: String,      // Enum: ["easy", "medium", "hard"]
  questionCount: Number,   // Intended question count
  durationMinutes: Number, // Exam duration in minutes, e.g., 60
  startTime: Date,         // Scheduled exam window start
  endTime: Date,           // Scheduled exam window end
  totalMarks: Number,      // Calculated sum of maxMarks for questions
  status: String,          // Enum: ["draft", "published", "completed"]
  createdBy: ObjectId,     // Reference to User (_id where role === "teacher")
  questions: [
    {
      _id: ObjectId,
      type: String,        // Enum: ["mcq", "short", "long"]
      prompt: String,      // The question text
      options: [String],   // Array of strings if type === "mcq"
      suggestedAnswer: String, // Answer key / marking guide for teacher reference
      maxMarks: Number,    // Points allocated to this question
      order: Number        // Display order (1-indexed)
    }
  ],
  isResultsPublished: Boolean, // Default: false
  createdAt: Date
}
```

### 3. Submissions Collection (`submissions`)
Stores student exam attempts, uploaded handwritten script references, marks, and feedback.

```javascript
{
  _id: ObjectId,
  examId: ObjectId,        // Reference to Exams collection (_id)
  studentId: ObjectId,     // Reference to Users collection (_id)
  submittedAt: Date,       // Timestamp when answer script was uploaded
  scriptUrl: String,       // CDN / Storage URL for scanned PDF/JPG/PNG
  fileType: String,        // Enum: ["pdf", "image/png", "image/jpeg"]
  originalFileName: String,// Original uploaded file name
  fileSize: Number,        // Uploaded size in bytes (max 5,242,880 = 5MB)
  marksObtained: Number,   // Teacher entered marks (null until graded)
  feedback: String,        // Teacher comments / breakdown
  status: String,          // Enum: ["submitted", "graded"]
  gradedAt: Date,          // Timestamp when teacher graded the script
  gradedBy: ObjectId       // Reference to Teacher User (_id)
}
```

---

## Entity Relationship Summary

```
+----------------+          1 : N          +----------------+
|     USERS      | ----------------------< |     EXAMS      |
| (Teacher/Stud) |                         | (Sched/Status) |
+----------------+                         +----------------+
        |                                           |
        | 1                                         | 1
        |                                           |
        v N                                         v N
+-----------------------------------------------------------+
|                        SUBMISSIONS                        |
|   (studentId, examId, scriptUrl, marksObtained, feedback) |
+-----------------------------------------------------------+
```
