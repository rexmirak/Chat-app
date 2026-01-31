# CH Group Chat

Modern chat MVP built with Next.js + WebSockets + Prisma. Includes AI assistant support (optional), chat list, presence, notifications, and a clean UI.

## Tech stack
- Next.js (App Router)
- WebSockets (custom `server.js`)
- Prisma + SQLite (swap for Postgres in production)
- JWT auth
- Google Gemini AI (optional)

## Local setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env`:
   ```bash
   cp .env.example .env
   ```
3. Update `.env` values:
   - `DATABASE_URL` (SQLite for dev or Postgres for prod)
   - `JWT_SECRET`
   - `GEMINI_API_KEY` (optional — AI features only)
4. Run the dev server:
   ```bash
   npm run dev
   ```

## Scripts
- `npm run lint`
- `npm run build`
- `npm run dev`

## AI credentials
Gemini is optional. If `GEMINI_API_KEY` is missing, AI calls will return a friendly error but the app still works.

## Local CI before push
This repo includes a `pre-push` hook that runs lint + build.
```bash
git config core.hooksPath .githooks
```
Now every `git push` runs:
```bash
npm run lint && npm run build
```

## CI/CD to GCP (GitHub Actions + Compute Engine)
Workflows:
- `.github/workflows/ci.yml` → lint + build + npm audit
- `.github/workflows/deploy-gce.yml` → build Docker image, push to Artifact Registry, deploy to GCE

### Step-by-step manual
1. **Create a GitHub repo** (if not already):
   ```bash
   git remote add origin <YOUR_GITHUB_REPO_URL>
   git branch -M main
   git push -u origin main
   ```
2. **Enable GitHub Actions** in your repo (default is on).

3. **GCP setup**
   - Create a project.
   - Enable APIs:
     - Artifact Registry
     - Compute Engine
   - Create an Artifact Registry repo (Docker):
     - Example name: `ch-group-chat`
     - Region: `us-central1` (or your choice)
   - Create a small Compute Engine instance (e2-micro/e2-small).
   - Install Docker on the VM:
     ```bash
     sudo apt-get update
     sudo apt-get install -y docker.io
     sudo systemctl enable --now docker
     ```
   - Open port **80** on the VM firewall.

4. **Service account + key**
   - Create a service account with roles:
     - Artifact Registry Writer
     - Compute Instance Admin (v1)
     - Service Account User
   - Create a JSON key for the service account.

5. **Add GitHub Secrets**
   In your GitHub repo → Settings → Secrets and variables → Actions:
   - `GCP_SA_KEY` (service account JSON)
   - `GCP_PROJECT_ID`
   - `GCP_REGION` (Artifact Registry region, e.g. `us-central1`)
   - `GCP_AR_REPO` (Artifact Registry repo name, e.g. `ch-group-chat`)
   - `GCE_INSTANCE` (VM name)
   - `GCE_ZONE` (VM zone, e.g. `us-central1-a`)
   - `DATABASE_URL` (use Postgres in prod or SQLite + volume mount)
   - `JWT_SECRET`
   - `GEMINI_API_KEY` (optional)

6. **Point your domain**
   - Create an A record in your DNS pointing to the VM external IP.
   - Optional: install SSL (e.g. with `certbot` + Nginx reverse proxy).

7. **Deploy**
   - Push to `main` or run the workflow manually in GitHub Actions.
   - The workflow will build a Docker image and deploy to your VM.

### Notes
- If you want SQLite persistence, mount a host folder and set `DATABASE_URL=file:/data/dev.db`.
- For production, a managed Postgres database is recommended.

___