# 🧠 Cappy: The Smart Context Engine Your LLM Deserves

> **Stop feeding your AI garbage. Start giving it genius.**

[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-blue?logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy)
[![Cursor](https://img.shields.io/badge/Cursor-Compatible-green?logo=cursor)](https://cursor.sh)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 🎯 The Problem: LLMs Are Only As Smart As Their Context

You've been there:
- 🤦 "Why did GitHub Copilot suggest the same broken pattern *again*?"
- 😤 "I *told* it about that authentication bug 10 times!"
- 🔥 "It keeps ignoring our architecture docs!"
- 💸 "We're paying for GPT-5, but it's coding like GPT-3..."

**The truth?** Your LLM is brilliant. Your context delivery is broken.

---

## 💡 The Solution: Hybrid Retrieval That Actually Works

**Cappy** is the missing link between your codebase and your AI. It's not just another RAG system—it's a **context orchestration engine** that:

### ✨ Understands What Your LLM *Really* Needs

```typescript
// Instead of blind keyword matching...
search("authentication") // → 847 irrelevant results

// Cappy delivers intelligent, weighted context:
retrieve("JWT authentication") // → Returns:
  ✅ Your auth guard implementation (40% weight - CODE)
  ✅ Your JWT setup guide (30% weight - DOCS)
  ✅ "Always validate token expiry" rule (20% weight - PREVENTION)
  ✅ Last completed auth task (10% weight - HISTORY)
```

### 🎨 Four Retrieval Strategies, One API

| Strategy | When to Use | Best For |
|----------|-------------|----------|
| **`hybrid`** (default) | Daily coding | Balanced results from all sources |
| **`semantic`** | Fuzzy concepts | "Find anything about error handling" |
| **`keyword`** | Exact matches | "Show me all JWT references" |
| **`graph`** | Relationships | "What depends on this function?" |

### 🔥 Real-Time Intelligence

```typescript
// Automatically learns from your mistakes
await retriever.retrieve("database migration", {
  sources: ['prevention'],  // Only show me what went wrong before
  category: 'database',     // Focus on DB rules
  minScore: 0.8            // High confidence only
});

// Result: "⚠️ Always backup before schema changes (learned from task #47)"
```

---

## 🚀 Get Started in 60 Seconds

### 1. Install Cappy Extension
```bash
# In VS Code / Cursor
Cmd+Shift+P → "Install Extension" → Search "Cappy"
```

### 2. Initialize Your Project
```bash
# Run once to set up context orchestration
Cmd+Shift+P → "Cappy: Initialize Project"
```

### 3. Start Using the Magic
```typescript
import { HybridRetriever } from '@cappy/retriever';

const retriever = new HybridRetriever(graphData);

// Basic usage - just ask!
const results = await retriever.retrieve('How do I authenticate users?');

// Advanced usage - fine-tune the AI's diet
const focused = await retriever.retrieve('API error handling', {
  strategy: 'hybrid',
  maxResults: 20,
  codeWeight: 0.5,      // More code examples
  docWeight: 0.3,       // Some documentation
  preventionWeight: 0.2, // Important: show me past mistakes
  minScore: 0.7,        // High quality only
  category: 'api'       // Filter by topic
});
```

---

## 🎯 Why Cappy Destroys Traditional RAG

### Traditional RAG (Retrieval-Augmented Generation)
```
❌ Dumb keyword matching
❌ No understanding of code relationships  
❌ Forgets past mistakes
❌ One-size-fits-all retrieval
❌ No quality scoring
```