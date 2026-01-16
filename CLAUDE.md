# JWMAP - 오늘 오디가?

Seoul restaurant discovery web application with interactive map integration.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Maps:** Kakao Maps API, Naver Maps API (deeplinks)
- **Deployment:** Vercel

## Project Structure

```
project/
├── src/
│   ├── components/     # React components
│   │   ├── App.tsx           # Main app, state management
│   │   ├── Map.tsx           # Kakao Maps integration
│   │   ├── LocationCard.tsx  # Location details & editing
│   │   ├── TopSearchBar.tsx  # LLM natural language search
│   │   ├── AddLocationModal.tsx
│   │   ├── CategoryButton.tsx
│   │   ├── EventBanner.tsx
│   │   └── Footer.tsx
│   ├── data/           # Static data
│   ├── types/          # TypeScript definitions
│   │   ├── kakao.d.ts        # Kakao Maps types
│   │   └── location.ts       # Location model
│   └── utils/          # API clients
│       ├── apiClient.ts      # Axios setup
│       └── supabase.ts       # Supabase client & CRUD
├── api/                # Vercel serverless functions
│   └── search.ts             # LLM-powered search endpoint
├── public/             # Static assets, markers
├── backend/            # Express.js (legacy/optional)
└── dist/               # Build output
```

## Commands

```bash
cd project
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # Run ESLint
npm run preview  # Preview build
```

## Environment Variables

Create `.env` in `/project`:

```
# Frontend (VITE_ prefix for client-side access)
VITE_KAKAO_APP_API_KEY=        # Kakao Maps SDK
VITE_KAKAO_RESTFUL_API_KEY=    # Kakao Places API
VITE_NAVER_CLIENT_ID=          # Naver API
VITE_NAVER_CLIENT_SECRET=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CLOUDINARY_CLOUD_NAME=    # Cloudinary cloud name
VITE_CLOUDINARY_UPLOAD_PRESET= # Cloudinary unsigned upload preset

# Backend API (Vercel serverless - set in Vercel dashboard)
SUPABASE_URL=                  # Same as VITE_SUPABASE_URL
SUPABASE_SERVICE_KEY=          # Service role key (not anon)
GOOGLE_API_KEY=                # Google Gemini API for LLM search
```

## Key Types

```typescript
interface Location {
  id: string;
  name: string;
  region: Region;           // 19 Seoul districts
  subRegion?: string;       // e.g. "한남동", "이태원역"
  category: Category;       // legacy single category
  lon: number;
  lat: number;
  memo: string;             // long personal note
  shortDesc?: string;       // one-line summary for list/LLM
  address: string;
  rating: number;
  priceLevel?: 1|2|3|4;
  features?: {              // boolean attributes
    solo_ok?: boolean;
    quiet?: boolean;
    no_wait?: boolean;
    // ... extensible
  };
  naverPlaceId?: string;    // for direct deeplink
  kakaoPlaceId?: string;    // for direct deeplink
  imageUrl: string;
  eventTags?: string[];
  visitDate?: string;
}

interface Tag {
  id: string;
  name: string;
  type: 'mood' | 'occasion' | 'food' | 'constraint' | 'general';
}

interface LocationTag {
  locationId: string;
  tagId: string;
  weight: number;           // 0~1
  source: 'manual' | 'llm' | 'user';
}
```

## Database (Supabase)

### Table: `locations`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| name | text | |
| region | text | e.g. "서울 용산구" |
| sub_region | text? | e.g. "한남동" |
| category | text | legacy single category |
| lon, lat | double | coordinates |
| address | text | |
| memo | text | long personal note |
| short_desc | text? | one-line summary |
| features | jsonb | `{solo_ok, quiet, no_wait, ...}` |
| rating | double | |
| price_level | smallint? | 1~4 |
| naver_place_id | text? | for Naver map deeplink |
| kakao_place_id | text? | for Kakao map deeplink |
| image_url | text | |
| event_tags | jsonb | |
| visit_date | date? | |
| created_at | timestamptz | |

### Table: `tags`
| Column | Type |
|--------|------|
| id | uuid |
| name | text |
| type | text (mood/occasion/food/constraint/general) |

### Table: `location_tags`
| Column | Type |
|--------|------|
| location_id | uuid FK |
| tag_id | uuid FK |
| weight | float (0~1) |
| source | text (manual/llm/user) |

### Table: `search_logs`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Trace ID (passed from API) |
| query | text | Raw user query |
| parsed | jsonb | LLMQuery output |
| result_count | int | Number of results |
| llm_ms | int | LLM parsing latency |
| db_ms | int | Database query latency |
| total_ms | int | Total request latency |
| created_at | timestamptz | |

### Table: `click_logs`
| Column | Type |
|--------|------|
| id | uuid |
| search_id | uuid? |
| location_id | uuid |
| action_type | text (open_detail/open_naver/open_kakao/select_on_map) |
| created_at | timestamptz |

API converts snake_case <-> camelCase automatically.

## LLM Search Rules

1. LLM = query interpreter only, outputs structured `LLMQuery`
2. Never invents places - all results from `locations` table
3. Use `tags` + `features` for filtering/ranking
4. Prefer `naver_place_id`/`kakao_place_id` for map deeplinks
5. Log searches to `search_logs`, clicks to `click_logs`

## API Endpoints

### POST /api/search
LLM-powered natural language search.

**Request:**
```json
{ "text": "서울 용산 혼밥 맛집" }
```

**Response:**
```json
{
  "places": [Location, ...],
  "query": {
    "region": ["용산/이태원/한남"],
    "category": [],
    "keywords": ["혼밥", "맛집"],
    "constraints": { "solo_ok": true },
    "sort": "relevance"
  },
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "timing": {
    "llmMs": 245,
    "dbMs": 32,
    "totalMs": 285
  }
}
```

**Pipeline:**
1. Parse natural language → `LLMQuery` (LangChain + Gemini Flash)
2. Filter `locations` by region, category, price_level
3. Match `tags` via `location_tags` for keyword boosting
4. Filter by `features` (solo_ok, quiet, no_wait)
5. Text search in name, memo, short_desc
6. Sort: tag matches first, then by rating
7. Log to `search_logs`

**Stack:** LangChain (`@langchain/google-genai`) + Supabase

## Important Patterns

1. **State Management:** React hooks in App.tsx
2. **Map Markers:** Custom SVG markers in `/public` for categorieMain
3. **Deeplinks:** Kakao/Naver map app links with 700ms web fallback
4. **Filtering:** Region -> Category cascade, event tag filtering
5. **Responsive:** Mobile-first, breakpoint at 768px

## Common Tasks

### Add New Category
1. Update `Category` type in `src/types/location.ts`
2. Add marker SVG to `/public` if custom marker needed
3. Update marker logic in `src/components/Map.tsx`

### Add New Region
1. Update `Region` type in `src/types/location.ts`
2. Add to regions array in `src/components/App.tsx`

### Modify Location Card
Edit `src/components/LocationCard.tsx` - handles display, edit mode, map links

### Update Supabase Queries
Edit `src/utils/supabase.ts` - locationApi object contains all CRUD methods
