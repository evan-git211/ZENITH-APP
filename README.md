# ZENITH ✦

> Your exams have deadlines. Your study plan should too.

ZENITH is a smart study planner that reverse-engineers your exam schedule into a day-by-day action plan — so you always know exactly what to study and never cram the night before.

---

## Features

- **Exam Scheduling** — set exams, topics, and effort levels; the algorithm builds your burndown plan automatically
- **Today's Panel** — one focused view of what to study right now
- **Study Timer** — track active study sessions per topic
- **Streak Heatmap** — GitHub-style consistency tracker to keep momentum
- **Burndown Chart** — visual progress toward each exam
- **Todo Tab** — drag-and-drop task management alongside your study plan
- **Settings & Profile** — avatar cropping, preferences, keyboard shortcuts
- **PWA** — installable on desktop and mobile

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Backend | Supabase (auth + database) |
| Build | Vite |
| Tests | Vitest |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

Set up a `.env` file with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

---

## Project Structure

```
src/
├── components/     # UI components (charts, modals, timers, etc.)
├── pages/          # HomePage, ExamSchedulePage
├── lib/            # Supabase services, scheduling algorithm, utilities
├── hooks/          # Custom React hooks
├── contexts/       # Preferences context
└── types/          # TypeScript types for DB schema
```

---

Built with React + Supabase. Designed for students who want a system, not just a schedule.
