# 🐾 WhiskerWatch

> AI-powered cat pain assessment using the clinically validated Feline Grimace Scale

**WhiskerWatch** helps everyday cat owners understand their cat's comfort level by analysing a photo through the same scoring system veterinarians use — the [Feline Grimace Scale (FGS)](https://www.felinegrimacescale.com/). Upload a photo, get a plain-English assessment, and know when to call your vet.

---

## ✨ Features

- **FGS-based scoring** — evaluates all five facial action units: ear position, orbital tightening, muzzle tension, whisker position, and head position
- **Three-layer AI pipeline** — vision model observation → clinical rules engine → owner-facing plain English output
- **Cat profiles** — name your cat and get personalised results throughout ("Mochi is showing signs of mild discomfort")
- **Interactive dimension gauges** — tap any of the five FGS gauges to reveal the exact AI observation that drove the score
- **Session history** — past assessments saved locally, expandable inline to review full results
- **Smart rejection handling** — detects multiple cats, non-cat images, and low-quality photos before attempting a score
- **Light squint detection** — automatically adjusts orbital scores when camera flash likely caused the squinting, not pain
- **Copy summary** — one tap copies a formatted assessment summary to share with your vet
- **Warm, approachable UI** — designed for anxious cat owners, not clinical dashboards

---

## 🏗️ Architecture

WhiskerWatch is built as a three-layer pipeline:

```
Photo upload
     │
     ▼
┌─────────────────────────────────────────┐
│  Layer 1 — Vision (GPT-4o)              │
│  Five targeted FGS prompts              │
│  Returns: A/B/C choice + confidence     │
│  per dimension + image validity check   │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Layer 2 — Clinical Rules Engine        │
│  • Confidence gating (reject if ≥3      │
│    dimensions unclear)                  │
│  • A/B/C → 0/1/2 score mapping          │
│  • Light squint conflict detection      │
│  • Total score + tier assignment        │
│  Returns: structured assessment object  │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Layer 3 — Owner Response               │
│  Template-based plain English output    │
│  Calibrated to worried cat owners       │
│  Returns: headline, message, vet advice │
└─────────────────────────────────────────┘
```

### FGS Score Tiers

| Score | Tier | Guidance |
|-------|------|----------|
| 0–2 | Comfortable | No action needed |
| 3–4 | Mild discomfort | Monitor at home |
| 5–6 | Moderate discomfort | Contact vet within 24hrs |
| 7–10 | Significant discomfort | Seek veterinary attention |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Python, FastAPI |
| Vision AI | OpenAI GPT-4o Vision API |
| Image processing | Pillow (compression + resize before API call) |
| Session storage | Browser localStorage |
| Frontend hosting | Vercel |
| Backend hosting | Railway |

---

## 🚀 Running Locally

### Prerequisites

- Node.js 22+
- Python 3.11+
- OpenAI API key

### Backend

```bash
cd backend
pip install -r requirements.txt

# Create .env file
echo "OPENAI_API_KEY=your_key_here" > .env

uvicorn main:app --reload
# Running at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Running at http://localhost:5173
```

---

## 📁 Project Structure

```
WhiskerWatch/
├── backend/
│   ├── main.py          # FastAPI app, image compression, vision API call (Layer 1)
│   ├── layer2.py        # Clinical rules engine — scoring, gating, conflict detection
│   ├── layer3.py        # Owner-facing response generation
│   ├── requirements.txt
│   └── .env             # OPENAI_API_KEY (never commit this)
│
└── frontend/
    ├── src/
    │   ├── App.jsx      # Full single-page application
    │   └── main.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## 🔬 How the Vision Prompt Works

Rather than asking "is this cat in pain?", the prompt asks five separate, constrained questions — one per FGS dimension. Each question gives GPT-4o a multiple-choice rubric (A/B/C) describing what relaxed, mildly affected, and significantly affected looks like for that specific feature. This approach produces consistent, scoreable output rather than open-ended commentary.

A pre-flight image check runs before any scoring to detect:
- Non-cat animals
- Multiple cats in frame
- Images where the face is not clearly visible

---

## ⚠️ Disclaimer

WhiskerWatch is not a substitute for veterinary care. Always consult a professional if you're concerned about your cat's health. The Feline Grimace Scale is a screening tool — not a diagnosis.

---

## 📚 References

- [Feline Grimace Scale — McGill University](https://www.felinegrimacescale.com/)
- Evangelista, M.C. et al. (2019). *Facial expressions of pain in cats.* Scientific Reports.

---

*Built at ASU Claude Builder's 2026 hackathon 🐱*
