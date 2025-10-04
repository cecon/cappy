# Mini-LightRAG Examples & Tutorials

## 📚 Table of Contents
1. [Basic Usage Examples](#basic-usage-examples)
2. [Advanced Search Scenarios](#advanced-search-scenarios)
3. [Configuration Examples](#configuration-examples)
4. [Integration Tutorials](#integration-tutorials)
5. [Performance Optimization](#performance-optimization)
6. [Real-World Use Cases](#real-world-use-cases)

---

## 🚀 Basic Usage Examples

### Example 1: Finding Authentication Code

**Scenario**: You need to understand how user authentication works in your project.

```typescript
// Search Query: "user authentication login"

// Expected Results:
1. authService.ts (95% match)
   - login(email: string, password: string)
   - authenticateUser()
   - generateToken()

2. middleware/auth.ts (87% match)
   - verifyToken()
   - requireAuth()
   - checkPermissions()

3. routes/auth.ts (82% match)
   - POST /api/login
   - POST /api/register
   - GET /api/profile
```

**Why this works**: LightRAG understands that "login" and "authentication" are related concepts and finds all relevant code.

### Example 2: Error Handling Patterns

**Scenario**: You want to see how errors are handled throughout your codebase.

```typescript
// Search Query: "error handling try catch"

// Results include:
1. utils/errorHandler.ts
   - try/catch blocks with specific error types
   - Error logging and reporting

2. api/endpoints.ts
   - HTTP error responses
   - Validation error handling

3. database/connection.ts
   - Database connection errors
   - Retry logic for failed queries
```

### Example 3: Configuration Management

**Scenario**: Finding all configuration-related code.

```typescript
// Search Query: "configuration settings environment"

// Finds:
1. config/index.ts
   - Environment variable loading
   - Default configuration values

2. utils/env.ts
   - Environment validation
   - Type-safe config access

3. main.ts
   - Configuration initialization
   - Runtime config changes
```

---

## 🔍 Advanced Search Scenarios

### Scenario 1: Refactoring Discovery

**Goal**: You're refactoring a `UserService` class and need to find all dependencies.

```typescript
// Step 1: Search for the service
Query: "UserService class methods"

// Step 2: Find usage patterns
Query: "UserService dependency injection"

// Step 3: Discover related patterns
Query: "user data access layer"
```

**LightRAG Results**:
```
📁 services/UserService.ts (Original class)
📁 controllers/UserController.ts (Direct usage)
📁 middleware/userValidation.ts (Indirect usage)
📁 tests/user.test.ts (Test coverage)
📁 types/user.types.ts (Type definitions)
```

### Scenario 2: Performance Investigation

**Goal**: Find potential performance bottlenecks in database operations.

```typescript
// Multi-step discovery:

// 1. Find database queries
Query: "database query slow performance"

// 2. Discover async patterns
Query: "async await database operations"

// 3. Find caching mechanisms
Query: "cache redis memory optimization"
```

**Discovered Issues**:
```typescript
// Found in db/queries.ts
❌ await User.findOne({ email }); // N+1 query problem

// Found in cache/user.ts
✅ const cached = await redis.get(`user:${id}`); // Good caching

// Found in api/users.ts
❌ for (const user of users) {
     await loadUserDetails(user.id); // Sequential async calls
   }
```

### Scenario 3: Security Audit

**Goal**: Audit security-related code across the project.

```typescript
// Security-focused searches:

Query: "password hashing bcrypt security"
// Finds: authentication, password storage, security utilities

Query: "input validation sanitization"
// Finds: form validation, API input checks, XSS prevention

Query: "authentication token jwt session"
// Finds: token generation, session management, auth middleware
```

---

## ⚙️ Configuration Examples

### Small Project Configuration

For projects with < 1,000 files:

```json
{
  "cappy.lightrag": {
    "vectorDimension": 256,
    "indexing": {
      "batchSize": 50,
      "maxConcurrency": 2,
      "autoIndexInterval": 180000,
      "includePatterns": [
        "**/*.ts",
        "**/*.js",
        "**/*.md"
      ]
    },
    "search": {
      "maxResults": 15,
      "expandHops": 1,
      "cacheTimeMinutes": 15
    }
  }
}
```

### Large Enterprise Project Configuration

For projects with 10,000+ files:

```json
{
  "cappy.lightrag": {
    "vectorDimension": 384,
    "indexing": {
      "batchSize": 200,
      "maxConcurrency": 1,
      "autoIndexInterval": 600000,
      "skipPatterns": [
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/*.generated.*",
        "**/coverage/**",
        "**/.next/**",
        "**/vendor/**"
      ],
      "includePatterns": [
        "src/**/*.ts",
        "src/**/*.tsx",
        "lib/**/*.ts",
        "docs/**/*.md",
        "config/**/*.json"
      ]
    },
    "search": {
      "maxResults": 25,
      "expandHops": 3,
      "vectorWeight": 0.7,
      "graphWeight": 0.2,
      "freshnessWeight": 0.1,
      "cacheTimeMinutes": 5
    }
  }
}
```

### Performance-Optimized Configuration

For fast machines with lots of RAM:

```json
{
  "cappy.lightrag": {
    "indexing": {
      "batchSize": 100,
      "maxConcurrency": 8,
      "chunkSize": {
        "min": 200,
        "max": 1000
      }
    },
    "performance": {
      "enableOptimizations": true,
      "memoryLimit": "2GB",
      "cacheStrategy": "aggressive"
    }
  }
}
```

---

## 🔌 Integration Tutorials

### Tutorial 1: GitHub Copilot Integration

**Goal**: Use LightRAG to provide context for better Copilot suggestions.

```typescript
// 1. Search for existing patterns
Query: "validation function email format"

// 2. Found pattern in utils/validation.ts:
function validateEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// 3. Use as context for Copilot
// When writing new validation, Copilot will suggest similar patterns

// 4. Create a new validation function
function validatePhone(phone: string): boolean {
  // Copilot suggests based on found patterns
  const regex = /^\+?[\d\s\-\(\)]+$/;
  return regex.test(phone);
}
```

### Tutorial 2: Test-Driven Development

**Goal**: Find test patterns to write better tests.

```typescript
// 1. Search for test patterns
Query: "unit test mock async function"

// 2. Found in tests/userService.test.ts:
describe('UserService', () => {
  let mockUserRepository: jest.Mocked<UserRepository>;
  
  beforeEach(() => {
    mockUserRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    } as jest.Mocked<UserRepository>;
  });

  it('should create user successfully', async () => {
    // Test implementation
  });
});

// 3. Apply pattern to new tests
// LightRAG helps discover testing conventions
```

### Tutorial 3: Documentation Generation

**Goal**: Use LightRAG to find undocumented code and create comprehensive docs.

```typescript
// 1. Search for complex functions without docs
Query: "complex algorithm function no comments"

// 2. Find functions that need documentation
// LightRAG identifies functions with high complexity

// 3. Use found patterns to document consistently
/**
 * Calculates user engagement score based on activity metrics
 * @param userId - The unique identifier for the user
 * @param timeframe - The time period to analyze (days)
 * @returns Promise<number> - Engagement score between 0-100
 * 
 * @example
 * const score = await calculateEngagement('user123', 30);
 * // Returns: 85
 */
```

---

## ⚡ Performance Optimization

### Optimization Strategy 1: Selective Indexing

**Problem**: Large workspace takes too long to index.

**Solution**: Smart file filtering

```json
{
  "cappy.lightrag.indexing": {
    "includePatterns": [
      // Only source code and docs
      "src/**/*.{ts,tsx,js,jsx}",
      "docs/**/*.md",
      "README.md",
      "CHANGELOG.md"
    ],
    "skipPatterns": [
      // Exclude generated files
      "**/*.generated.*",
      "**/*.min.js",
      "**/*.bundle.js",
      "**/dist/**",
      "**/node_modules/**",
      "**/.git/**",
      "**/coverage/**",
      "**/logs/**",
      "**/*.log"
    ]
  }
}
```

**Results**:
- 📉 Index time: 5 minutes → 30 seconds
- 📉 Memory usage: 800MB → 200MB
- 📈 Search relevance: Improved (less noise)

### Optimization Strategy 2: Batch Processing

**Problem**: Indexing blocks the UI for too long.

**Solution**: Optimized batch configuration

```json
{
  "cappy.lightrag.indexing": {
    "batchSize": 150,        // Process 150 files at once
    "maxConcurrency": 3,     // Use 3 worker threads
    "processingDelay": 10,   // 10ms pause between batches
    "progressFeedback": true // Show progress updates
  }
}
```

**Results**:
- ✅ UI remains responsive during indexing
- ✅ Progress feedback keeps user informed
- ✅ Optimal CPU utilization

### Optimization Strategy 3: Smart Caching

**Problem**: Repeated searches are slow.

**Solution**: Multi-level caching strategy

```json
{
  "cappy.lightrag.search": {
    "cacheTimeMinutes": 10,
    "enableQueryCache": true,
    "enableEmbeddingCache": true,
    "cacheStrategy": "LRU",
    "maxCacheSize": "100MB"
  }
}
```

**Cache Performance**:
```
📊 Cache Hit Rates:
- Query Cache: 87% (repeated searches)
- Embedding Cache: 94% (text processing)
- Result Cache: 76% (formatted results)

📊 Performance Improvement:
- Cache Hit: 15ms average response
- Cache Miss: 180ms average response
- Overall: 89% faster searches
```

---

## 🌍 Real-World Use Cases

### Use Case 1: Code Review Preparation

**Scenario**: Senior developer reviewing a large pull request.

```typescript
// 1. Understand the changes
Query: "authentication changes security validation"

// 2. Find related tests
Query: "authentication test coverage unit integration"

// 3. Check for similar patterns
Query: "existing authentication implementation patterns"

// 4. Security considerations
Query: "security vulnerabilities authentication token"
```

**Review Checklist Generated**:
- ✅ Authentication logic follows existing patterns
- ✅ Proper input validation implemented
- ✅ Test coverage includes edge cases
- ❌ Missing rate limiting (found in other auth code)
- ❌ Token expiration not handled consistently

### Use Case 2: Onboarding New Team Members

**Scenario**: New developer needs to understand the codebase architecture.

```typescript
// Learning Path Discovery:

// 1. Application structure
Query: "main application entry point startup"

// 2. Data flow
Query: "request response flow middleware pipeline"

// 3. Business logic
Query: "business logic domain services"

// 4. Testing approach
Query: "testing strategy unit integration patterns"
```

**Generated Learning Path**:
1. 📁 `main.ts` → Application bootstrap
2. 📁 `routes/index.ts` → Request routing
3. 📁 `middleware/` → Request processing pipeline
4. 📁 `services/` → Business logic layer
5. 📁 `models/` → Data structures
6. 📁 `tests/` → Testing patterns

### Use Case 3: Bug Investigation

**Scenario**: Production bug in user authentication system.

```typescript
// Investigation Process:

// 1. Find the failing component
Query: "user login authentication failure error"

// 2. Trace the authentication flow
Query: "authentication middleware token validation"

// 3. Find similar issues
Query: "authentication error handling token expired"

// 4. Locate logging and monitoring
Query: "authentication logging error tracking"
```

**Investigation Results**:
```typescript
// Found root cause in middleware/auth.ts:
if (token.expiry < Date.now()) {
  // BUG: Using Date.now() instead of proper timezone handling
  throw new Error('Token expired');
}

// Found related fix in utils/dateHelper.ts:
function isTokenExpired(token: Token): boolean {
  // Proper implementation with timezone consideration
  return token.expiry < moment().utc().valueOf();
}
```

### Use Case 4: Feature Implementation

**Scenario**: Implementing a new notification system.

```typescript
// Research Phase:

// 1. Find existing notification patterns
Query: "notification system email push messaging"

// 2. Discover template systems
Query: "email template rendering dynamic content"

// 3. Find queue/async patterns
Query: "background job queue async processing"

// 4. Check integration points
Query: "user preferences notification settings"
```

**Implementation Plan Discovered**:
```typescript
// Found existing patterns to follow:

// 1. Service Layer (from emailService.ts)
class NotificationService {
  async send(type: NotificationType, recipient: User, data: any) {
    // Implementation follows existing pattern
  }
}

// 2. Template System (from templateEngine.ts)
const template = await loadTemplate(notification.type);
const rendered = await template.render(notification.data);

// 3. Queue Integration (from jobQueue.ts)
await queue.add('notification', {
  type: 'email',
  recipient: user.id,
  template: 'welcome',
  data: { name: user.name }
});
```

---

## 🎯 Pro Tips & Best Practices

### Tip 1: Query Construction

**Effective Queries**:
```typescript
✅ "user authentication middleware jwt token"
✅ "database connection pooling retry logic"
✅ "error handling async operation timeout"
✅ "validation input sanitization security"

❌ "auth"  (too vague)
❌ "user"  (too common)
❌ "function" (too generic)
❌ "test test test" (repetitive)
```

### Tip 2: Context Utilization

**Use your cursor position**:
```typescript
// When cursor is in a React component:
Query: "similar component pattern props validation"
// → Finds other React components with similar patterns

// When cursor is in a test file:
Query: "test helpers mock utilities"
// → Finds testing utilities and helpers
```

### Tip 3: Iterative Discovery

**Progressive refinement**:
```typescript
// Start broad
Query: "user management"

// Refine based on results
Query: "user profile update validation"

// Get specific
Query: "user profile image upload validation resize"
```

### Tip 4: Performance Monitoring

**Monitor your LightRAG performance**:
```typescript
// Check the status bar regularly:
🟢 $(database) LightRAG (1,247) 89% cache hit
// → Healthy system with good cache performance

🔄 $(sync~spin) LightRAG 45% indexing...
// → Currently indexing, wait for completion

❌ $(error) LightRAG Memory high
// → Consider reducing included files or restarting
```

---

## 📖 Quick Reference

### Common Search Patterns
| Pattern | Query Example | Use Case |
|---------|---------------|----------|
| **Concept Discovery** | `"authentication security"` | Understanding implementations |
| **Pattern Finding** | `"singleton factory pattern"` | Learning design patterns |
| **Error Investigation** | `"error handling database timeout"` | Debugging issues |
| **Feature Research** | `"file upload progress tracking"` | Implementing features |
| **Test Discovery** | `"unit test mock async"` | Writing tests |
| **Configuration** | `"environment variables config"` | Setup and deployment |

### Keyboard Shortcuts
| Action | Shortcut | Command |
|--------|----------|---------|
| **Quick Search** | `Ctrl+Alt+F` | Fast search dialog |
| **Search Selection** | `Ctrl+Shift+S` | Search selected text |
| **Full Search** | `Ctrl+Shift+F` | Complete search interface |
| **Status Info** | Click status bar | View system status |

### File Patterns
| Pattern | Matches | Purpose |
|---------|---------|---------|
| `**/*.{ts,js}` | TypeScript/JavaScript | Source code |
| `**/*.md` | Markdown files | Documentation |
| `src/**` | Source directory | Main code |
| `tests/**/*.test.*` | Test files | Test coverage |
| `**/*.config.*` | Config files | Configuration |

---

## 🚀 Next Steps

1. **Try the examples** in your own workspace
2. **Customize settings** for your project size
3. **Integrate with your workflow** (Copilot, tests, docs)
4. **Monitor performance** via status bar
5. **Share patterns** with your team

---

**Happy Coding with Mini-LightRAG! 🔍✨**