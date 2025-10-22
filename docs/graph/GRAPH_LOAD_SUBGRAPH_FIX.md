# Graph Load Subgraph Error Fix

## Problem

The GraphPage was failing to load subgraphs with the error:
```
ERROR FROM BACKEND: Load subgraph failed: Cannot read properties of undefined (reading 'SQL')
```

## Root Cause

The error was caused by **method extraction losing `this` context** in two locations:

1. **LoadSubgraphUseCase.ts** (line 33-36)
2. **GraphPanel.ts** (line 150-153)

### The Bug Pattern

```typescript
// ❌ WRONG - extracts method and loses `this` binding
const maybeReload = (graphStore as unknown as { reloadFromDisk?: () => Promise<void> }).reloadFromDisk;
if (typeof maybeReload === 'function') {
    await maybeReload(); // `this` is undefined inside reloadFromDisk!
}
```

When you extract a method reference like this in JavaScript/TypeScript, the method loses its binding to the original object. When `reloadFromDisk()` tried to access `this.SQL`, `this` was `undefined`, causing the error: "Cannot read properties of undefined (reading 'SQL')".

## Solution

Call the method directly on the object to preserve the `this` context:

```typescript
// ✅ CORRECT - calls method on object, preserving `this`
if (typeof (graphStore as unknown as { reloadFromDisk?: () => Promise<void> }).reloadFromDisk === 'function') {
    await (graphStore as unknown as { reloadFromDisk: () => Promise<void> }).reloadFromDisk();
}
```

## Files Changed

1. **src/adapters/primary/vscode/graph/usecases/LoadSubgraphUseCase.ts**
   - Fixed method call to preserve `this` context

2. **src/adapters/primary/vscode/graph/GraphPanel.ts**
   - Fixed method call to preserve `this` context

3. **src/adapters/secondary/graph/sqlite-adapter.ts**
   - Fixed indentation on line 77 (cosmetic)

## Testing

After this fix:
- The graph should load properly at all depth levels (2, 4, 6, 10)
- No more "Cannot read properties of undefined (reading 'SQL')" errors
- The `reloadFromDisk()` method will correctly access `this.SQL` and `this.db`

## Related Learning

This is a common JavaScript/TypeScript gotcha. When you need to pass or store a method reference, you have three options to preserve context:

1. **Call directly on object** (used here): `obj.method()`
2. **Bind the method**: `obj.method.bind(obj)`
3. **Arrow function wrapper**: `() => obj.method()`

## Date

October 19, 2025
