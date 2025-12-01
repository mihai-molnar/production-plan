# Production Planning App

A web-based production planning application that optimizes weekly production schedules based on line availability, throughput rates, and setup times.

## Features

- **Configuration Management**
  - Production lines
  - Product references
  - Throughput rates (tons/hour)
  - Line availability (EU week format, Monday-Sunday)
  - Setup times between product changes

- **Production Planning**
  - Add demands with quantities and optional deadlines
  - Automatic optimization considering:
    - Line throughput rates
    - Setup times when switching products
    - Daily availability constraints
    - Load balancing across lines
  - One-week planning horizon

- **Visual Plan Display**
  - Grouped by day and line
  - Clear production and setup time indicators
  - Capacity utilization matrix
  - Remaining hours per line/day
  - Summary statistics

- **Dashboard**
  - Configuration status overview
  - Demand fulfillment tracking
  - Production breakdown by reference
  - Line utilization metrics

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS v4
- **Build Tool**: Vite
- **Storage**: Browser localStorage (client-side only)

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
```

The production build will be in the `dist/` folder.

## Usage

1. **Configure** (Configuration tab)
   - Add production lines (e.g., L01, L02)
   - Add product references (e.g., PVC2005, PVC2035)
   - Set throughput rates for each line-reference combination
   - Configure line availability for each day (Mon-Sun)
   - Set setup times when switching between products

2. **Plan** (Planner tab)
   - Add demands (reference + quantity + optional deadline)
   - Click "Generate Plan"
   - Review the optimized production schedule
   - Check capacity utilization to see remaining hours

3. **Monitor** (Dashboard tab)
   - View configuration status
   - Track demand fulfillment
   - See production breakdown and line utilization

## Data Storage

- All data is stored in browser localStorage
- Data persists across sessions but is local to each browser
- No backend required - perfect for static hosting
- Future: Export/Import functionality can be added for data backup

## Deployment

Automatically deploys to GitHub Pages on push to `main` branch.

Live URL: https://mihai-molnar.github.io/production-plan/

## License

MIT
