# Installation

## Prerequisites

- Python 3.11 or later — [python.org](https://www.python.org/downloads/)
- Node.js (any recent LTS version) — [nodejs.org](https://nodejs.org/)
- Git

## 1. Clone the repository

```bash
git clone https://github.com/vygstep/subsidence.git
cd subsidence
```

## 2. Backend setup

Create and activate a virtual environment:

**Windows (PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install Python dependencies:

```bash
pip install -e "app/[dev]"
```

This installs the `subsidence` backend package in editable mode along with all required dependencies (FastAPI, SQLAlchemy, PyArrow, pandas, etc.).

## 3. Frontend setup

```bash
cd frontend
npm install
cd ..
```

## 4. Verify

Start the backend and check it responds:

**Windows:**
```powershell
$env:PYTHONPATH = "$PWD\app\src"
uvicorn subsidence.api.main:app --host 127.0.0.1 --port 8000
```

**macOS / Linux:**
```bash
PYTHONPATH=./app/src uvicorn subsidence.api.main:app --host 127.0.0.1 --port 8000
```

Open [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) — you should see `{"status": "ok"}`.

Start the frontend:

```bash
cd frontend
npm run dev -- --host 127.0.0.1
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).
