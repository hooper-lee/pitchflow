# PitchFlow

**AI-Powered B2B Sales Development Platform for Global Trade**

PitchFlow is an intelligent customer development system designed for export-oriented businesses. It automates the entire sales pipeline—from prospect discovery and AI-driven research to personalized outreach, automated follow-up, and high-intent alerts—all in one seamless workflow.

## Business Value

### Drive Revenue Growth
- **Smart Prospect Discovery**: Automatically identify qualified prospects by industry, keywords, and geography, eliminating manual research
- **AI-Powered Lead Scoring**: Leverage advanced research scoring across 5 critical dimensions to prioritize high-value opportunities
- **Personalized Outreach at Scale**: Generate contextual, personalized emails based on company research, not templates
- **Conversion Acceleration**: Multi-channel follow-up automation (email, Feishu, WeChat Work) ensures no lead falls through the cracks

### Key Capabilities

| Feature | Benefit |
|---------|---------|
| **Website Identification Engine** | Filters noise and identifies real customer websites using 5-dimensional scoring |
| **Company Intelligence** | Extracts company size, type, products, target markets, and decision-makers automatically |
| **Tiered Lead Management** | Distinguish "worth adding to database" from "worth contacting first" with dual scoring |
| **Email Campaign Management** | Flexible email templates with independent sender addresses for brand consistency |
| **Activity Management & Auto-Follow-Up** | Keep all touchpoints consistent through the sales cycle with unified email tracking |
| **High-Intent Alerts** | Instant notifications via email, Feishu, or WeChat Work when prospects open, click, or reply |

## How It Works

```
Industry/Keyword Search
  → Website Identification & Deduplication
  → Prospect Database Entry
  → AI Research & 5D Scoring
  → A/B/C/D Lead Tier Segmentation
  → Create Sales Campaign
  → Send Personalized Outreach
  → Auto Follow-Up & Intent Tracking
```

## Landing Page Demos

Get an instant understanding of system capabilities:

- **Prospect Discovery Results**: See how search results include scoring and why certain websites are worth pursuing
- **AI Research Output**: Structured company profiles, 5D scoring, composite scores, and recommended next actions—not just text summaries

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + React + Tailwind CSS + shadcn/ui |
| Backend | Next.js API Routes + Drizzle ORM |
| Database | PostgreSQL |
| Authentication | NextAuth.js |
| Search Engine | SearXNG (self-hosted, unlimited) |
| Web Scraping | Cheerio (Playwright fallback) |
| Email Service | Resend |
| AI | OpenAI-compatible API (Claude / custom) |

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with at minimum:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/pitchflow
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
```

For full platform capabilities, also configure:

- `CUSTOM_AI_BASE_URL`
- `CUSTOM_AI_API_KEY`
- `CUSTOM_AI_MODEL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SEARXNG_BASE_URL`

### 3. Start Search Engine (SearXNG)

```bash
docker run -d --name searxng -p 8888:8080 \
  -v $(pwd)/searxng/settings.yml:/etc/searxng/settings.yml \
  searxng/searxng
```

Verify:

```bash
curl http://localhost:8888/search?q=test&format=json
```

### 4. Initialize Database

```bash
npm run db:push
```

### 5. Seed Detector Blacklist

```bash
npx tsx scripts/seed-detector.ts
```

### 6. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 7. Create Admin Account

Visit [http://localhost:3000/register](http://localhost:3000/register) to register the first account (auto-promoted to super admin).

## Admin Configuration

Access `/admin` for platform configuration:

- **System Settings** `(/admin/configs)`: AI models, email service, search engine, scoring weights, and prompts
- **Website Detector** `(/admin/detector)`: Domain blacklists, TLD filters, scoring weights, Playwright settings

## Prospect Discovery Process

```
Keyword Search → SearXNG (multi-page aggregation)
    ↓
URL Blacklist Filtering (domain + TLD suffixes)
    ↓
Cheerio Batch Crawl (with Playwright fallback)
    ↓
5-Dimension Signal Extraction + 100-Point Scoring
    ↓
Sort by Score & Filter >= 25 points
    ↓
Contact Information Extraction (email/phone/company)
    ↓
3-Level Fallback: Direct → Hunter/Snov → Pattern Inference
    ↓
Add to Database with Search Score Preserved
```

## Research & Outreach Rules

- **Dual Scoring System**:
  - `Search Score`: Indicates website relevance for database entry
  - `Research Score`: Indicates lead quality for prioritized contact
- **Research Deliverables**:
  - Company profile
  - 5D scoring breakdown
  - A/B/C/D lead tier
  - Recommended action
- **Email Sending Logic**:
  - Template with configured sender: use template sender
  - No template or unconfigured: use account email
  - Once campaign starts, sender email is locked in for all follow-ups

## Project Structure

```
├── app/
│   ├── (dashboard)/          # Main platform pages
│   │   ├── prospects/        # Prospect mgmt + discovery + research
│   │   ├── campaigns/        # Sales campaigns
│   │   ├── templates/        # Email templates
│   │   └── settings/         # User settings & alerts
│   ├── admin/                # Admin dashboard
│   │   ├── configs/          # System configuration
│   │   └── detector/         # Website detector config
│   └── api/v1/               # REST API
├── components/
│   ├── landing/              # Landing page components
│   ├── prospects/            # Prospect discovery components
│   ├── campaigns/            # Campaign components
│   └── templates/            # Template editor
├── lib/
│   ├── detector/             # Website ID engine (filter/fetch/score/extract)
│   ├── integrations/         # External services (SearXNG/Resend/Hunter/Snov)
│   ├── services/             # Business logic layer
│   ├── db/                   # Database schema + connection + migrations
│   └── utils/                # Utility functions
└── scripts/                  # Seed data scripts
```