# AI-Based Online Exam Proctoring System

A production-quality, secure, and interactive AI-Powered Online Examination & Proctoring system. It uses a modern dark glassmorphic React frontend, Python Flask REST + Socket.IO backend, and MySQL database (with SQLite auto-fallback) to monitor candidate behavior in real time.

This project is fully modular, scalable, clean, and optimized for final-year college project evaluations.

---

## 🌟 Key Features

* **Biometric Face Registration & Verification**: Establishes student identities by comparing camera snapshots against registered face embeddings prior to starting an exam.
* **Continuous AI Behavioral Monitoring**:
  * *Face Not Found & Multiple Faces Detection*: Alerts if the student leaves the screen or another person enters the frame.
  * *Gaze & Head Pose Tracking*: Detects if the student looks Left, Right, Up, or Down.
  * *Eye Closure / Sleeping Check*: Triggers a sleeping flag if the eyes remain closed for more than 2.5 seconds.
  * *Mouth Open / Talking Detection*: Captures speaking movements.
  * *Face Covered*: Catches candidates partially occluding their faces.
  * *Environment Scanning*: Warns on Low Light and Camera Muting (Covered Lens).
* **YOLOv8 Real-Time Object Detection**:
  * Detects and highlights unauthorized items like **Cell Phones** and **Books**.
  * Flags **Person Behind Candidate** if multiple people are visible.
  * Identifies **Unauthorized Objects** (secondary laptops, TV monitors, remotes).
* **Strict Browser Lockdown (Academic Integrity)**:
  * Restricts copy-paste, text selection, and right-clicks.
  * Forces Fullscreen Mode. Automatically tracks and logs Esc key exits, minimized windows, and tab switches.
* **Dynamic Cheating Score & Warning System**:
  * Accumulates infractions into a rolling 0-100 Cheating Index.
  * Throttles warning counts to avoid UI flooding.
  * **Auto-Submits the Exam** if a candidate triggers more than 5 warnings.
  * Auto-captures and saves violation screenshots (with AI visual markers drawn on the frame) directly to the database.
* **Continuous Video Recording**: Saves complete browser camera recording files as WebM, allowing proctors to playback student exams.
* **Live Classroom Monitor Grid**:
  * Admin dashboard grid rendering live webcam snapshots of all active candidates.
  * Real-time metrics counters (warnings count and cheating index gauges).
  * Remote admin actions: Send custom warning alerts directly to student screens or instantly terminate exam sessions.
* **Analytical Dashboards**: Custom Chart.js graphs mapping top infractions, exam volumes, and student grading distributions.
* **Automated PDF Report Generator**: Compiles a printable PDF summary details report containing candidate marks, proctoring stats, and evidence screenshot attachments.
* **MySQL + SQLite Auto-Fallback**: Zero database configuration needed for testing! The backend automatically attempts to connect to MySQL; if unavailable, it compiles and runs instantly using a local SQLite database (`backend/database/proctoring.db`).

---

## 📂 Project Structure

```text
ai-exam-proctoring-system/
├── backend/
│   ├── app.py                  # Main Entrypoint (Flask API + Socket.IO Server)
│   ├── config.py               # Config setups (JWT keys, paths)
│   ├── database/
│   │   ├── db.py               # DB connections & SQLite auto-fallback manager
│   │   ├── schema.sql          # SQL Schema migrations file
│   │   └── seed.py             # Database seeder (Admin, Student, MCQs)
│   ├── models/
│   │   └── models.py           # SQL Queries abstractions (User, Exam, etc.)
│   ├── controllers/
│   │   ├── auth_controller.py  # User profiles & credentials validator
│   │   └── exam_controller.py  # Session states, answers, & grading controller
│   ├── routes/
│   │   ├── auth_routes.py      # /api/auth blueprints
│   │   ├── exam_routes.py      # /api/exams blueprints
│   │   └── report_routes.py    # /api/reports blueprints
│   ├── services/
│   │   ├── ai_service.py       # YOLOv8 + MediaPipe face & pose analyzer
│   │   ├── face_verify.py      # Face biometric registration & matches
│   │   └── report_service.py   # ReportLab PDF compiles engine
│   ├── utils/
│   │   └── security.py         # Bcrypt hashing & JWT wrappers
│   ├── uploads/                # Dynamic media files
│   │   ├── faces/              # Registered candidate biometric photos
│   │   ├── screenshots/        # Auto-saved violation evidence images
│   │   ├── recordings/         # Complete exam WebM video chunks
│   │   └── reports/            # Compiled PDF reports output
│   ├── requirements.txt        # Backend dependencies manifest
│   └── Dockerfile              # Docker specifications for Flask app
├── frontend/
│   ├── src/
│   │   ├── components/         # Glassmorphic Shared Layout modules
│   │   ├── context/            # AuthContext (state persist)
│   │   ├── pages/              # Router Page views (Login, Exam, Dashboard)
│   │   ├── services/
│   │   │   ├── api.js          # Axios API mappings
│   │   │   └── socket.js       # Socket.IO WebSocket triggers
│   │   ├── App.jsx             # Routes mappings and guardians
│   │   ├── index.css           # Glassmorphic styling themes (Tailwind overrides)
│   │   └── main.jsx            # DOM bootstrapping script
│   ├── package.json            # Node dependencies manifest
│   ├── tailwind.config.js      # CSS configuration setups
│   ├── vite.config.js          # Server proxying rule parameters
│   └── index.html              # Frontend DOM page wrapper
├── docs/
│   └── api_docs.md             # API endpoint documentation
├── docker-compose.yml          # Compose orchestration file
└── README.md                   # Project documentation
```

---

## 🚀 Setup & Installation (Localhost)

Follow these steps to run the system locally on your Windows machine:

### Prerequisites
* **Python**: v3.10 or higher
* **Node.js**: v18 or higher

---

### Step 1: Backend Setup
1. Open a terminal in the `backend` directory.
2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```
3. Activate the virtual environment:
   * **Windows (Command Prompt)**: `venv\Scripts\activate.bat`
   * **Windows (PowerShell)**: `.\venv\Scripts\Activate.ps1`
4. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Run the Database Seeder script:
   *(This initializes the database schema—using SQLite by default—and seeds sample users and questions)*
   ```bash
   python database/seed.py
   ```
6. Start the Flask application:
   ```bash
   python app.py
   ```
   *The backend will boot on http://localhost:5000.*

---

### Step 2: Frontend Setup
1. Open a new terminal in the `frontend` directory.
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the React development server:
   ```bash
   npm run dev
   ```
   *The frontend VITE server will boot on http://localhost:3000.*

---

## 🐳 Docker Deployment (MySQL Stack)

To run the full stack (MySQL database, Flask app, and React frontend) inside Docker containers:

1. Open a terminal in the root directory.
2. Run the compose command:
   ```bash
   docker-compose up --build
   ```
3. The orchestration script will:
   * Launch a MySQL container on port 3306.
   * Auto-migrate schema tables.
   * Run the Flask API on port 5000.
   * Run the React app on port 3000.
4. Access the web interface at `http://localhost:3000`.

---

## 🔑 Default Credentials

Use these seeded accounts to test the application:

* **Student Account**:
  * **Email**: `student@college.edu`
  * **Password**: `studentpassword`
* **Administrator Account**:
  * **Email**: `admin@college.edu`
  * **Password**: `adminpassword`

*OTP Validation Code (for testing login)*: `123456`

---

## 🧪 Testing Instructions

To verify the AI proctoring features:
1. Log in as a **Student** and navigate to your profile to **Register Face** (requires webcam).
2. Return to the dashboard and enter the `Introduction to Artificial Intelligence` exam.
3. Complete the pre-exam face verification step.
4. Grant webcam, microphone, and fullscreen permissions, then click **Begin Examination**.
5. Test proctoring behaviors:
   * **Phone Detection**: Hold up a mobile phone to your webcam. You will see a red bounding box and a warning popup.
   * **Looking Away**: Turn your head or look away from the screen to trigger "Looking Left/Right/Up/Down" warnings.
   * **Tab Switch / Minimization**: Press `Esc` to exit fullscreen or switch tabs. A proctor warning modal will appear immediately.
   * **Mic Noise**: Speak aloud to trigger volume fluctuations.
6. Open `http://localhost:3000` in another browser window and log in as the **Admin**.
   * Open the **Live Monitor Grid** to see the student's live feed, warning count, and cheating score updating instantly.
   * Click **Send Warning** to send a custom warning message to the student, or click **Terminate Candidate Exam** to end their session.
7. Finish the exam (either by clicking submit, triggering 5 warnings for auto-submit, or admin termination).
8. Go to the Admin dashboard history panel and click **Report PDF** to download the compiled proctoring report, complete with graded results and screenshots of the infractions!