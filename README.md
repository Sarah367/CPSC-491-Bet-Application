# CPSC-491-Bet-Application

Team

* Hai-Duong To
* Sarah Agnihotri
* Gilbert Banuelos
* Muhammad Shahwar Shamim


Bet is a social betting app for creating and managing friendly wagers with friends, family, or other users. The goal is to make casual betting more transparent by clearly defining wager terms, participants, results, and payouts.

Features

* Create public or private bets
* Invite friends to participate
* Join and track active bets
* Email account verification
* Vote on bet outcomes
* View past bets and user stats
* Automated payout handling
* Bet status notifications

Tech Stack

* Frontend: React.js
* Backend:
* Database:
* Payments: Stripe API
* Authentication:

Getting Started

Prerequisites

* Node.js (v18+) and npm
* A Firebase project (Authentication + a service account key for the backend)

Installation

Clone the repo, then install dependencies for both apps:

```bash
git clone <repo-url>
cd CPSC-491-Bet-Application

cd backend && npm install
cd ../frontend && npm install
```

Configuration

**Backend** — copy `backend/.env.example` to `backend/.env` and fill in the values:

```bash
cd backend
cp .env.example .env
```

* `PORT` — defaults to `5001` (avoid `5000`, it conflicts with macOS AirPlay Receiver)
* `FIREBASE_SERVICE_ACCOUNT_PATH` — path to your Firebase service account JSON key (download it from Firebase Console > Project settings > Service accounts). Never commit this file.

**Frontend** — copy `frontend/.env.example` to `frontend/.env` and fill in your Firebase web app config:

```bash
cd frontend
cp .env.example .env
```

* `VITE_FIREBASE_*` — from Firebase Console > Project settings > Your apps
* `VITE_API_BASE_URL` — the backend's URL, e.g. `http://localhost:5001/api`

Run

Start the backend (from `backend/`):

```bash
npm run dev    # with auto-reload (nodemon)
npm start      # without auto-reload
```

Start the frontend (from `frontend/`, in a separate terminal):

```bash
npm run dev
```

The frontend runs on Vite's dev server (default `http://localhost:5173`) and talks to the backend at the `VITE_API_BASE_URL` you configured above.

Testing

```bash
cd backend && npm test    # Jest
cd frontend && npm test   # Vitest
```
