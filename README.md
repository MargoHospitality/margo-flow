# Margo Flow

Transport booking system for Margo Hospitality riads in Morocco.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ & npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Git
- Supabase account (for backend)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/MargoHospitality/margo-flow.git
cd margo-flow

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your Supabase credentials (see below)

# 4. Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Environment Variables

Create a `.env` file at the root with your Supabase credentials:

```env
VITE_SUPABASE_PROJECT_ID="your_project_id"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your_anon_public_key"
```

**Where to find these values:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Settings → API
4. Copy the values from "Project URL" and "anon public" key

### Supabase Setup

The backend uses Supabase for:
- PostgreSQL database
- Authentication
- Edge Functions (14 serverless functions)

**Database & Edge Functions are already deployed.** You only need the connection credentials above.

---

## 📦 Tech Stack

### Frontend
- **React 18.3** - UI framework
- **TypeScript 5.8** - Type safety
- **Vite 5.4** - Build tool & dev server
- **Shadcn/ui** - Component library (Radix + Tailwind)
- **TanStack Query** - Server state management
- **React Hook Form + Zod** - Form validation
- **React Router 6.30** - Client-side routing

### Backend
- **Supabase** (PostgreSQL + Auth + Edge Functions)
- **14 Edge Functions** (Deno runtime)
- **Cloudbeds API** - Reservation management
- **Twilio** - WhatsApp notifications
- **Resend** - Email notifications

### Hosting
- **Frontend:** Vercel (staging + production)
- **Backend:** Supabase (managed)

---

## 🏗️ Architecture

```
Guest Flow:
1. Guest visits app → enters reservation ID + selects riad
2. App queries Supabase → validates reservation
3. Guest fills transport form
4. Form submitted → Edge Functions triggered:
   - create_transport_request (validation + DB insert)
   - send-client-confirmation (Email + WhatsApp)
   - notify-manager (WhatsApp urgent notification)
   - cloudbeds-add-note (POST note to Cloudbeds API)
5. Manager sees request in backoffice → confirms/rejects
```

### Project Structure

```
src/
├── components/
│   ├── guest/         # Guest-facing UI (transport form)
│   ├── backoffice/    # Manager dashboard
│   ├── admin/         # Super-admin panel
│   └── ui/            # Shadcn/ui reusable components
├── hooks/             # Custom React hooks
├── integrations/      # Supabase client setup
├── lib/               # Utilities
└── pages/             # Route pages (6 total)

supabase/
├── functions/         # 14 Edge Functions (Deno)
└── migrations/        # 26 SQL migrations (versioned)
```

---

## 🛠️ Development

### Available Scripts

```bash
# Development server (with HMR)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Lint code
npm run lint
```

### Code Quality

- **TypeScript strict mode** enabled
- **ESLint** configured
- **Zod schemas** for runtime validation
- **RLS policies** for database security

---

## 🚀 Deployment

### Staging (Vercel)
Automatic deployment on push to `main`:
- URL: `margo-flow-*.vercel.app`
- Environment: Production Supabase

### Production
Custom domain configured via Vercel:
- Settings → Domains → Add Domain
- Configure DNS (A/CNAME records)

---

## 🔒 Security

### Row Level Security (RLS)
All Supabase tables have RLS policies:
- **Guests (anon):** Can only INSERT transport requests
- **Managers (authenticated):** Read/write their assigned riads
- **Super-admins:** Full access

### Environment Variables
**Never commit `.env` to Git.** Use `.env.example` for templates.

Supabase keys used:
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Safe for client-side (public anon key)
- Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` (server-only, not exposed)

---

## 📊 Database Schema

### Key Tables
- `riads` - Properties (26 riads)
- `reservations` - Synced from Cloudbeds
- `transport_offers` - Global catalog (airport, train, etc.)
- `riad_transport_offers` - Property-specific pricing overrides
- `transport_requests` - Guest bookings
- `user_roles` - Admin/manager permissions

See `supabase/migrations/` for complete schema.

---

## 🔗 Integrations

### Cloudbeds API
- **Endpoint:** `https://api.cloudbeds.com/api/v1.3/`
- **Auth:** Bearer token (configured in Edge Functions env)
- **Usage:** Reservation lookup + note posting

### Twilio WhatsApp
- **Templates:** 3 templates (client FR/EN, manager urgent)
- **Variables:** Guest name, property, arrival datetime, link
- **Configuration:** Environment variables in Supabase Edge Functions

### Resend Email
- **Transactional emails** for confirmations
- **Configuration:** API key in Edge Functions

---

## 🧪 Testing

**Status:** Tests à venir (roadmap item #4)

Planned:
- Edge Functions critical paths (Deno Test)
- Frontend validation (Vitest)

---

## 📝 Contributing

### Branch Strategy
- `main` - Production-ready code
- Feature branches: `feature/description`
- Hotfixes: `hotfix/description`

### Commit Convention
```
feat: Add rate limiting to guest form
fix: Cloudbeds idempotency check
docs: Update README setup section
refactor: Extract CORS handler to shared
```

---

## 📄 License

Proprietary - Margo Hospitality © 2026

---

## 🆘 Support

**Issues:** Contact Baptiste Parent (baptiste@margo-hospitality.com)

**Documentation:**
- [Supabase Docs](https://supabase.com/docs)
- [Vite Docs](https://vitejs.dev)
- [Shadcn/ui](https://ui.shadcn.com)
