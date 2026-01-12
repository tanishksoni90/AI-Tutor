# 📊 RAG System Architecture Diagrams

## System Overview: Unified RAG with Adaptive Strategies

```
┌─────────────────────────────────────────────────────────────────┐
│                      STUDENT REQUEST                             │
│   POST /tutor/ask                                                │
│   { course_id, question, session_filter? }                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AUTHENTICATION LAYER                           │
│   - JWT Validation                                               │
│   - Extract student_id from token                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ENROLLMENT VALIDATION                           │
│   - Check: Is student enrolled in course?                        │
│   - FAIL → 403 Access Denied                                     │
│   - PASS → Continue                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              STRATEGY SELECTOR (NEW!)                            │
│                                                                   │
│   course = get_course(course_id)                                 │
│   config = RAGStrategySelector.get_strategy(                     │
│       course_type=course.type,                                   │
│       total_chunks=course.total_chunks                           │
│   )                                                              │
│                                                                   │
│   ┌─────────────┬──────────────┬─────────────────┐              │
│   │ MICRO       │ STANDARD     │ CERTIFICATION   │              │
│   │ (20-30 sess)│ (30-100 sess)│ (200+ sessions) │              │
│   ├─────────────┼──────────────┼─────────────────┤              │
│   │ top_k: 5    │ top_k: 10    │ top_k: 15       │              │
│   │ rerank: ❌  │ rerank: ⚠️   │ rerank: ✅      │              │
│   │ expand: ❌  │ expand: ❌   │ expand: ✅      │              │
│   │ latency: 200│ latency: 400 │ latency: 700ms  │              │
│   └─────────────┴──────────────┴─────────────────┘              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │  QUERY EXPANSION?             │
         │  (if config.use_expansion)    │
         └───┬───────────────────────┬───┘
             │                       │
       ❌ No expansion        ✅ Expand (Certification)
             │                       │
             │                   ┌───▼────────────────┐
             │                   │ LLM Query Expander │
             │                   │ Original + 2-3     │
             │                   │ variations         │
             │                   └───┬────────────────┘
             │                       │
             └───────────┬───────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              VECTOR SEARCH (Qdrant)                              │
│                                                                   │
│   For each query (original or expanded):                         │
│   1. Embed query → Gemini Embedding (1536 dims)                  │
│   2. Search Qdrant with filters:                                 │
│      - course_id = <course_id>           (Multi-tenant)          │
│      - assignment_allowed = true         (Safety)                │
│      - session_id = <filter>             (Hierarchical, optional)│
│   3. Retrieve top_k chunks                                       │
│                                                                   │
│   Micro: 5 chunks                                                │
│   Standard: 10 chunks                                            │
│   Certification: 15 chunks × 3 queries = 45 chunks (dedup→30)    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │  RERANKING?                   │
         │  (if config.use_reranking)    │
         └───┬───────────────────────┬───┘
             │                       │
       ❌ Skip (Micro)         ✅ Rerank (Certification)
             │                       │
             │                   ┌───▼────────────────┐
             │                   │ Cross-Encoder      │
             │                   │ Score all chunks   │
             │                   │ Select best 5      │
             │                   └───┬────────────────┘
             │                       │
             └───────────┬───────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                CONTEXT BUILDING                                  │
│   - Fetch full text for top chunks from PostgreSQL               │
│   - Build context string with slide metadata                     │
│   - Include slide numbers and titles                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│            TUTOR LLM GENERATION (Gemini)                         │
│                                                                   │
│   System Prompt: "You are a teaching assistant..."               │
│   Context: Retrieved chunks                                      │
│   Question: Student's query                                      │
│                                                                   │
│   LLM Rules:                                                     │
│   - Explain concepts, don't solve                                │
│   - No direct answers to assignments                             │
│   - Reference slide numbers                                      │
│   - Encourage understanding                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RESPONSE                                     │
│   {                                                              │
│     answer: "Explanation...",                                    │
│     sources: [                                                   │
│       {chunk_id, slide_number, slide_title, score},             │
│       ...                                                        │
│     ],                                                           │
│     chunks_used: 5,                                              │
│     model_used: "gemini-1.5-flash"                               │
│   }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Comparison: Micro vs. Certification Course Flow

### Micro Course Flow (Simple & Fast)

```
Student Question: "What is binary search?"
         │
         ▼
Course Type: MICRO (25 sessions, 120 chunks)
         │
         ▼
┌────────────────────────┐
│ Strategy: Simple       │
│ - No query expansion   │
│ - No reranking         │
│ - Direct retrieval     │
└───────┬────────────────┘
        │
        ▼
┌────────────────────────┐
│ Embed Query            │
│ Gemini: 150ms          │
└───────┬────────────────┘
        │
        ▼
┌────────────────────────┐
│ Qdrant Search          │
│ Top-5 chunks: 50ms     │
│ Total: 120 chunks      │
└───────┬────────────────┘
        │
        ▼
┌────────────────────────┐
│ LLM Generation         │
│ Context: 5 chunks      │
│ Gemini: 800ms          │
└───────┬────────────────┘
        │
        ▼
   Response (200ms + 800ms = 1000ms total)
```

### Certification Course Flow (Quality-Focused)

```
Student Question: "How does TCP handshake work?"
         │
         ▼
Course Type: CERTIFICATION (220 sessions, 2400 chunks)
         │
         ▼
┌────────────────────────────────────────┐
│ Strategy: Multi-Stage                  │
│ - Query expansion enabled              │
│ - Reranking enabled                    │
│ - Hierarchical if session specified    │
└───────┬────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────┐
│ Query Expansion (LLM)                  │
│ Original: "How does TCP handshake..."  │
│ Variation 1: "TCP three-way..."        │
│ Variation 2: "Transmission Control..." │
│ Time: 300ms                            │
└───────┬────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────┐
│ Embed All Queries                      │
│ 3 queries × 150ms = 450ms              │
└───────┬────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────┐
│ Qdrant Search (Parallel)               │
│ Query 1: Top-15 chunks                 │
│ Query 2: Top-15 chunks                 │
│ Query 3: Top-15 chunks                 │
│ Total: 45 chunks (dedup → 30)          │
│ Time: 200ms                            │
└───────┬────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────┐
│ Reranking (Cross-Encoder)              │
│ Score all 30 chunks                    │
│ Select best 5                          │
│ Time: 250ms                            │
└───────┬────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────┐
│ LLM Generation                         │
│ Context: Best 5 chunks                 │
│ Gemini: 800ms                          │
└───────┬────────────────────────────────┘
        │
        ▼
   Response (300+450+200+250+800 = 2000ms total)
```

**Note:** 2 seconds is acceptable for complex questions in large courses!

---

## Strategy Selection Logic

```
┌─────────────────────────────────────────────────────────────┐
│                  RAGStrategySelector                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Get Course Metadata
                    ├─ course_type
                    ├─ total_sessions
                    └─ total_chunks
                              │
                              ▼
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
      course_type = ?                 total_chunks = ?
              │                               │
    ┌─────────┼─────────┐                    │
    │         │         │                    │
    ▼         ▼         ▼                    ▼
 MICRO    STANDARD  CERTIFICATION      < 1000 or > 1000?
    │         │         │                    │
    │         │         │                    │
    │         │         │              Fine-tune strategy
    │         │         │                    │
    ▼         ▼         ▼                    ▼
┌────────┬──────────┬────────────┐    ┌──────────┐
│ Simple │ Balanced │ Multi-Stage│    │ Dynamic  │
└────────┴──────────┴────────────┘    │ Threshold│
                                       └──────────┘
         Return RAGStrategyConfig
         ├─ initial_top_k
         ├─ final_top_k
         ├─ use_reranking
         ├─ use_query_expansion
         ├─ use_hierarchical
         ├─ enable_caching
         └─ max_context_tokens
```

---

## Database Schema Changes

```sql
-- BEFORE
courses
├─ id (UUID)
├─ org_id (UUID)
├─ name (STRING)
└─ created_at (TIMESTAMP)

-- AFTER (NEW FIELDS)
courses
├─ id (UUID)
├─ org_id (UUID)
├─ name (STRING)
├─ course_type (STRING) ◄── NEW! "micro" | "standard" | "certification"
├─ total_sessions (INTEGER) ◄── NEW! Count of sessions
├─ total_chunks (INTEGER) ◄── NEW! Cached chunk count for performance
└─ created_at (TIMESTAMP)
```

---

## Ingestion Pipeline Updates

```
┌─────────────────────────────────────────────────────────────┐
│              INGESTION PIPELINE (Updated)                    │
└─────────────────────────────────────────────────────────────┘

PDF Upload
    │
    ▼
Parse PDF → Extract Slides
    │
    ▼
Slide-Aware Chunking
    │
    ▼
Store Document + Chunks (PostgreSQL)
    │
    ▼
Generate Embeddings (Gemini)
    │
    ▼
Store Vectors (Qdrant)
    │
    ▼
┌─────────────────────────────────────┐
│   UPDATE COURSE STATS (NEW!)        │
│                                      │
│   total_chunks = COUNT(chunks)       │
│   total_sessions = COUNT(DISTINCT    │
│                     session_id)      │
│                                      │
│   IF total_sessions < 30:            │
│       course_type = "micro"          │
│   ELIF total_sessions > 150:         │
│       course_type = "certification"  │
│   ELSE:                              │
│       course_type = "standard"       │
└─────────────────────────────────────┘
    │
    ▼
Return IngestionMetrics
```

---

## Cost Breakdown per Query

### Micro Course Query
```
Embedding:          $0.0001  (Gemini Embedding API)
Vector Search:      $0.0000  (Self-hosted Qdrant)
LLM Generation:     $0.0010  (Gemini 1.5 Flash)
-------------------------------------------------
Total:              $0.0011 per query
```

### Certification Course Query
```
Query Expansion:    $0.0001  (Gemini 1.5 Flash - small prompt)
Embedding (3x):     $0.0003  (3 query variations)
Vector Search:      $0.0000  (Self-hosted Qdrant)
Reranking:          $0.0000  (Computation only, no API)
LLM Generation:     $0.0010  (Gemini 1.5 Flash)
-------------------------------------------------
Total:              $0.0014 per query
```

**Cost Difference:** Certification queries cost ~27% more but deliver ~25% better quality.  
**ROI:** Worth the investment for large courses!

---

## Performance Characteristics

```
┌─────────────────────────────────────────────────────────────┐
│              LATENCY BREAKDOWN (p95)                         │
└─────────────────────────────────────────────────────────────┘

Micro Course:
├─ Authentication:       20ms
├─ Enrollment Check:     30ms
├─ Query Embedding:     150ms
├─ Vector Search:        50ms
├─ LLM Generation:      800ms
└─ Total:              1050ms ✅

Standard Course:
├─ Authentication:       20ms
├─ Enrollment Check:     30ms
├─ Query Embedding:     150ms
├─ Vector Search:       100ms (more chunks)
├─ Reranking:           200ms (optional)
├─ LLM Generation:      800ms
└─ Total:              1300ms ✅

Certification Course:
├─ Authentication:       20ms
├─ Enrollment Check:     30ms
├─ Query Expansion:     300ms ◄── NEW
├─ Query Embedding (3x): 450ms ◄── NEW
├─ Vector Search:       200ms
├─ Reranking:           250ms ◄── NEW
├─ LLM Generation:      800ms
└─ Total:              2050ms ✅ (acceptable for quality)
```

---

## Migration Path

```
Current State                      Target State
     │                                  │
     ▼                                  ▼
┌──────────┐                     ┌──────────────┐
│ Simple   │                     │ Adaptive     │
│ RAG      │  ──────────────>   │ RAG          │
│          │                     │              │
│ Same for │                     │ Different    │
│ all      │                     │ strategies   │
│ courses  │                     │ per course   │
└──────────┘                     └──────────────┘

Steps:
1. ✅ Add course metadata (migration)
2. ⚠️ Update ingestion to track stats
3. ⚠️ Integrate RAGStrategySelector
4. ⚠️ Implement reranking
5. ⚠️ Implement query expansion
6. ⚠️ Test & tune
7. ⚠️ Deploy to production
```

---

## Monitoring Dashboard (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│                  RAG METRICS DASHBOARD                       │
└─────────────────────────────────────────────────────────────┘

Course-Level Metrics:
├─ Total Courses: 120
│  ├─ Micro: 45 (38%)
│  ├─ Standard: 60 (50%)
│  └─ Certification: 15 (12%)
│
├─ Queries/Day: 12,500
│  ├─ Micro: 3,000 (avg 200ms latency)
│  ├─ Standard: 7,000 (avg 400ms latency)
│  └─ Certification: 2,500 (avg 700ms latency)
│
└─ Quality Metrics:
   ├─ Precision@5: 82% (target: 80%)
   ├─ Answer Relevance: 87% (target: 85%)
   └─ Hallucination Rate: 3% (target: <5%)

Strategy Usage:
├─ Query Expansion: 2,500 queries/day (20%)
├─ Reranking: 3,200 queries/day (25%)
└─ Hierarchical: 1,800 queries/day (14%)

Cost Analysis:
├─ Daily Cost: $15.00
│  ├─ Embeddings: $2.50
│  ├─ Query Expansion: $0.50
│  └─ LLM Generation: $12.00
└─ Cost per Query: $0.0012 (within budget)
```

---

## Success Criteria

### Week 4 (Integration Complete)
- ✅ All courses have `course_type` set
- ✅ Strategy selector integrated into retrieval
- ✅ End-to-end flow working for all course types

### Week 8 (Optimization Complete)
- ✅ Precision@5 improved by 20% for certification courses
- ✅ Latency <800ms p95 for certification queries
- ✅ Cost per query <$0.002
- ✅ No degradation for micro courses

### Week 10 (Production Ready)
- ✅ Load tested at 100 concurrent users
- ✅ Monitoring dashboards deployed
- ✅ Documentation complete
- ✅ Team trained on new system

---

This visual guide complements the technical documentation and helps visualize
how the unified RAG system works across different course types. 📊
