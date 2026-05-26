# ContentedCal

A content calendar and project management app for marketing teams. Plan, schedule, and track content across channels with board, list, calendar, and timeline views.

## Stack

- **Frontend**: React + TypeScript + Tailwind CSS (Vite)
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions, Realtime)
- **Deployment**: Vercel

## Getting started

```bash
npm install
cp .env.example .env   # add your Supabase URL + anon key
npm run dev
```

## Environment variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
