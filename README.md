# TrustLens AI

TrustLens is a monorepo with three apps:
- `apps/web`: Next.js 14 App Router UI (Vercel)
- `apps/api`: Express + TypeScript API (Railway)
- `apps/ai`: FastAPI AI service (Railway)

## Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB connection string
- Firebase project (Authentication enabled)
- RevenueCat project + entitlement id `pro`
- HuggingFace API token (optional but recommended)

## Repo Layout
```
apps/
  web/   # Next.js frontend
  api/   # Express API
  ai/    # FastAPI AI service
```

## Local Development

1. Install Node dependencies at repo root:
```
npm install
```

2. Configure env files:
- `apps/web/.env.example` -> `apps/web/.env.local`
- `apps/api/.env.example` -> `apps/api/.env`
- `apps/ai/.env.example` -> `apps/ai/.env`
- For Firebase:
  - Add Firebase Web SDK config vars in `apps/web/.env.local`
  - Add Firebase Admin service account vars in `apps/api/.env`

3. Start each app:

### AI service
```
cd apps/ai
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

### API service
```
cd apps/api
npm run dev
```

### Web
```
cd apps/web
npm run dev
```

### Seed community reports
```
cd apps/api
npm run seed:reports
```

## Deployment

### Railway (API + AI)
Create two services from the same repo.

**API service**
- Root Directory: `apps/api`
- Build Command: `npm ci && npm run build`
- Start Command: `npm run start`

**AI service**
- Root Directory: `apps/ai`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Vercel (Web)
- Root Directory: `apps/web`
- Framework: Next.js
- Set both env vars:
  - `API_BASE_URL` = your public API URL (example: `https://your-api.up.railway.app`)
  - `NEXT_PUBLIC_API_BASE_URL` = same public API URL
- Do not use `*.railway.internal` in Vercel env vars (private Railway network only).

## RevenueCat Setup
- Create entitlement id: `pro`
- Use the Web SDK public API key in `NEXT_PUBLIC_REVENUECAT_WEB_PUBLIC_API_KEY`
- Web paywall is presented on `/paywall`
- Server-side verification uses `REVENUECAT_SECRET_API_KEY`

## Firebase Authentication Setup
1. Firebase Console -> create/select project.
2. Authentication -> Sign-in method -> enable:
   - Email/Password
   - Google (optional but supported by UI)
3. Authentication -> Settings -> Authorized domains:
   - Add `localhost`
   - Add `127.0.0.1`
   - Add your deployed frontend domain (for example `your-app.vercel.app`)
   - Add any custom domain you use
4. Project settings -> General -> your web app -> copy:
   - API key
   - Auth domain
   - Project ID
   - App ID
5. Add these to `apps/web/.env.local`.
6. Project settings -> Service accounts -> Generate new private key.
7. Put service account values in `apps/api/.env`:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
8. For `FIREBASE_PRIVATE_KEY`, keep line breaks as escaped `\\n` in `.env`.

## Environment Variables

### apps/web
- `API_BASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_REVENUECAT_WEB_PUBLIC_API_KEY`
- `NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### apps/api
- `MONGODB_URI`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `AI_SERVICE_URL`
- `AI_SERVICE_TOKEN`
- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_ENTITLEMENT_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `LOG_LEVEL`

### apps/ai
- `AI_SERVICE_TOKEN`
- `HF_API_TOKEN`
- `OPENAI_API_KEY`
- `MODEL_MODE`
- `LOG_LEVEL`

## Notes
- The API uses httpOnly cookies for auth; ensure `CORS_ORIGIN` matches the web origin.
- AI service validates `X-AI-TOKEN` header.
- URL intel uses HEAD requests only and never fetches full content.

## AI Models Used
- Scam classifier (SMS): `mariagrandury/distilbert-base-uncased-finetuned-sms-spam-detection`
- Phishing email classifier: `cybersectony/phishing-email-detection-distilbert_v2.1`
- Behavioral zero-shot model: `tasksource/deberta-small-long-nli`
- Embeddings/community similarity: `intfloat/multilingual-e5-small`
- Graph anomaly risk: `PyGOD`
- Proof mode token attribution (local mode): `transformers-interpret`
