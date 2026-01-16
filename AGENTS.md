1. Project Identity
	•	This service lists only places personally visited and verified by the owner.
	•	Scope: Seoul only
	•	Purpose: help a friend decide fast → go immediately.
	•	The product value is curation + decision speed, not discovery at scale.

⸻

2. Core UX Flow (Invariant)
	1.	User finds a place via:
	•	region/category filters OR
	•	natural language search (LLM-powered)
	2.	A list of places is shown.
	3.	A map preview highlights the selected place.
	4.	User taps:
	•	PC → web map page
	•	Mobile → map app via deeplink (Naver/Kakao)

⚠️ This flow must never be broken or replaced.

⸻

3. Data Rules (Critical)
	•	LLM must never invent places.
	•	All results must come from our internal DB only.
	•	If no match:
	•	Return empty list
	•	Provide a UX hint (e.g. “용산에는 아직 등록된 곳이 없어요”)

⸻

4. Place Data Model (Minimal)
```typescript
Place {
  id: string
  name: string
  region: string        // e.g. "서울 용산구"
  address?: string
  memo: string          // personal experience note
  tags?: string[]       // short keywords
  rating?: number
  placeId?: string | number // for map deeplink
}
```
5. LLM Usage Policy

LLM Role
	•	LLM is a query interpreter, not a recommender.
	•	Output must be structured JSON only.
	•	No prose, no explanations.

LLM Output Schema
```typescript
LLMQuery {
  region?: string[]       // inferred administrative areas
  category?: string[]
  keywords?: string[]
  constraints?: {
    solo_ok?: boolean
    wait_short?: boolean
  }
  sort?: "relevance" | "rating"
}
```

6. Search Pipeline (Fixed)
	1.	Structured filter
	•	region, category
	2.	Semantic match
	•	memo, tags, short descriptions
	3.	Rule-based ranking
	•	relevance > rating > recency (if available)

LLM does not rank results.

⸻

7. Map Integration Rules
	•	PC: open web map page
	•	Mobile: use app deeplink
	•	Prefer placeId if available
	•	If not, fallback to search by name
	•	Deeplink must be triggered only by user interaction

⸻

8. Engineering Constraints
	•	Stack: Next.js + TypeScript
	•	Client/Server separation respected
	•	window access only on client
	•	No unnecessary external libraries
	•	Output code must be production-ready

⸻

9. Prompting Contract

When this file exists:
	•	Do not restate these rules in prompts
	•	Prompts should include only:
	•	Goal
	•	Delta / Deliverables
	•	Assume this document is always in effect
