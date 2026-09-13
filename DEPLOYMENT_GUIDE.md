# Step-by-Step Free-Tier Deployment Guide

This guide walks you through deploying the complete Online Examination System to 100% free-tier cloud platforms without adding a credit card.

---

## 1. Database Setup: MongoDB Atlas (Free M0 Cluster)

1. Sign up for a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).
2. Create a new project, then click **Create Database** -> Choose **M0 Free Cluster** (512 MB).
3. Select any cloud provider region (e.g. AWS us-east-1).
4. Under **Security -> Database Access**, create a user (e.g., `exam_user`) and a secure password.
5. Under **Security -> Network Access**, click **Add IP Address** -> Select **Allow Access from Anywhere (`0.0.0.0/0`)** (required for Render server access).
6. Under **Clusters -> Connect**, choose **Drivers (Node.js)** and copy your connection string:
   `mongodb+srv://exam_user:<password>@cluster0.mongodb.net/exam_db?retryWrites=true&w=majority`

---

## 2. Storage Setup: Cloudinary / Supabase Storage (Free Tier)

### Option A: Cloudinary Free Tier (25 GB free bandwidth)
1. Register at [Cloudinary](https://cloudinary.com/).
2. From the Dashboard, copy your:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

### Option B: Supabase Storage Free Tier (1 GB free storage)
1. Register at [Supabase](https://supabase.com/).
2. Create a public bucket named `answer-scripts`.
3. Copy your project API URL and Service Role Key.

---

## 3. AI Question Generation: Google Gemini API (Free Tier)

1. Navigate to [Google AI Studio](https://aistudio.google.com/).
2. Click **Get API Key** and generate a free-tier API key.
3. Save this key as `GEMINI_API_KEY`. (Free rate limit: 15 requests per minute, 1,500 requests/day).

---

## 4. Backend Deployment: Render (Free Web Service)

1. Push your repository to GitHub / GitLab.
2. Sign up at [Render](https://render.com/).
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repository.
5. Configure the service:
   - **Name**: `online-exam-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free` ($0/mo)
6. Add Environment Variables under **Environment**:
   - `PORT`: `5000`
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `mongodb+srv://exam_user:<password>@cluster0.mongodb.net/exam_db...`
   - `JWT_SECRET`: `your_random_super_secret_jwt_key_123!`
   - `GEMINI_API_KEY`: `AIzaSy...`
   - `CLOUDINARY_CLOUD_NAME`: `your_cloud_name`
   - `CLOUDINARY_API_KEY`: `your_api_key`
   - `CLOUDINARY_API_SECRET`: `your_api_secret`
7. Click **Create Web Service**. Note down the assigned URL: `https://online-exam-backend.onrender.com`.

> [!NOTE]
> Render free instances sleep after 15 minutes of inactivity. The React frontend built-in `ColdStartBanner` automatically handles the initial 15-30s wake-up period.

---

## 5. Frontend Deployment: Vercel / Netlify (Free Tier)

1. Sign up at [Vercel](https://vercel.com/) or [Netlify](https://www.netlify.com/).
2. Click **Add New Project** -> Import your GitHub repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add Environment Variable:
   - `VITE_API_BASE_URL`: `https://online-exam-backend.onrender.com/api`
5. Click **Deploy**.
6. Once deployed, open your live web application URL (e.g. `https://online-exam-system.vercel.app`).

---

## 6. Verification Checklist

- [ ] Register a new Teacher account.
- [ ] Create an Exam topic (e.g. "Biology - Cell Division") & click **Auto-Generate Questions via AI**.
- [ ] Verify questions are generated via Gemini API and populated into the edit grid.
- [ ] Publish the exam schedule.
- [ ] Register/login as a Student on a mobile phone or second browser tab.
- [ ] Take the timed exam, write answers on paper, take a photo/PDF scan, and upload.
- [ ] Return to Teacher account, open **Grading Portal**, view the uploaded student script inline, assign marks/feedback, and publish results.

---

## 7. Automatic Local Windows Startup (Host Mode)

For running the portal directly on your local computer with automatic background startup on Windows boot:

1. **Automatic Boot Startup**:
   - The shortcut `OnlineExamPortalAutostart.lnk` is installed in your Windows Startup directory (`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`).
   - Every time your computer boots and you log in, Windows silently starts the Node.js backend (`server.js`) and the Cloudflare Tunnel.
   - It automatically generates fresh access links and places them directly on your Desktop in `Exam-Portal-Active-Links.txt`.

2. **Desktop Controls**:
   - `Exam-Portal-Active-Links.txt`: Contains current local, Wi-Fi, and public internet URLs.
   - `Open Local Exam Portal.lnk`: Instantly opens `http://localhost:5000` in your default browser.
   - `Open Public Cloudflare Exam Portal.lnk`: Opens the active public link.
   - `Stop Exam Portal.lnk`: Shuts down both the server and Cloudflare tunnel cleanly.
   - `Start Exam Portal.lnk`: Manually restarts the background system if stopped.

