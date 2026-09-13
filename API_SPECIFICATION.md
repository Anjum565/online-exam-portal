# REST API Specification

Base URL: `https://<your-render-backend>.onrender.com/api` (Production) / `http://localhost:5000/api` (Local)

All authenticated endpoints require an `Authorization` header:
`Authorization: Bearer <jwt_token>`

---

## 1. Authentication Routes (`/auth`)

| Endpoint | Method | Access | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/auth/register` | `POST` | Public | Register a Teacher or Student account | `{ name, email, password, role }` | `201 Created`: `{ token, user }` |
| `/auth/login` | `POST` | Public | Authenticate user & issue JWT | `{ email, password }` | `200 OK`: `{ token, user }` |
| `/auth/me` | `GET` | Authenticated | Fetch current user session details | None | `200 OK`: `{ user }` |

---

## 2. Exam Management Routes (`/exams`)

| Endpoint | Method | Access | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/exams` | `GET` | Authenticated | List exams (Teachers see owned exams; Students see published/available exams) | None | `200 OK`: `[ exam1, exam2, ... ]` |
| `/exams` | `POST` | Teacher | Create a new exam draft definition | `{ title, subject, topic, difficulty, questionCount, durationMinutes, startTime, endTime }` | `201 Created`: `{ exam }` |
| `/exams/:id` | `GET` | Authenticated | Get detailed exam info & questions (questions visible during exam window or to teacher) | None | `200 OK`: `{ exam }` |
| `/exams/:id` | `PUT` | Teacher | Update exam settings, questions, or status (`published`/`completed`) | `{ title, startTime, endTime, status, ... }` | `200 OK`: `{ exam }` |
| `/exams/:id/generate-questions` | `POST` | Teacher | Trigger AI question generation via Gemini API for given exam topic | `{ topic, difficulty, questionCount, types }` | `200 OK`: `{ questions, exam }` |
| `/exams/:id/publish-results` | `POST` | Teacher | Publish grades & feedback for all graded student submissions | None | `200 OK`: `{ message, exam }` |

---

## 3. Student Submissions & Session (`/submissions`)

| Endpoint | Method | Access | Description | Request Body / Form | Success Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/submissions/:examId/upload` | `POST` | Student | Upload scanned handwritten answer sheet (PDF/Image) | `multipart/form-data`: `script` (File) | `201 Created`: `{ submission }` |
| `/submissions/:examId/my` | `GET` | Student | View own submission status, uploaded file link, and assigned grade/feedback | None | `200 OK`: `{ submission }` |

---

## 4. Teacher Grading Workflow (`/grading`)

| Endpoint | Method | Access | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/grading/exam/:examId` | `GET` | Teacher | Fetch list of all student submissions for a specific exam | None | `200 OK`: `[ submission1, submission2, ... ]` |
| `/grading/submission/:submissionId` | `PUT` | Teacher | Enter marks obtained & feedback comments for a student script | `{ marksObtained, feedback }` | `200 OK`: `{ submission }` |
