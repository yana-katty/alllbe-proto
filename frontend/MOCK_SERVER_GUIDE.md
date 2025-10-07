# Mock tRPC Server Guide

## Overview

Phase 1 MVP includes a complete Mock tRPC Server using MSW (Mock Service Worker) for frontend development without requiring the backend server.

## Quick Start

```bash
cd frontend
npm run dev
```

Visit http://localhost:3000/api-test to test the mock API.

## Architecture

```
Browser Request → MSW Service Worker → Mock Handlers → Mock Response
     ↓
tRPC Client (/trpc/*)
     ↓
MSW intercepts (lib/mock-trpc-server.ts)
     ↓
Returns mock data from lib/constants.ts
```

## Available Mock Endpoints

### Health Check
- **Endpoint**: `GET /trpc/health.check`
- **Response**: `{ status: 'ok', timestamp: ISO8601 }`

### Experience APIs
- **Endpoint**: `GET /trpc/experience.getById`
- **Params**: `{ id: string }`
- **Response**: Single experience object or 404

- **Endpoint**: `GET /trpc/experience.list`
- **Params**: `{ limit?: number, offset?: number }`
- **Response**: `{ experiences: Experience[], total: number }`

- **Endpoint**: `GET /trpc/experience.listByBrand`
- **Params**: `{ brandId: string, limit?: number }`
- **Response**: `{ experiences: Experience[] }`

### Booking APIs
- **Endpoint**: `POST /trpc/booking.create`
- **Body**: `{ experienceId: string, userId: string, ... }`
- **Response**: Created booking object

- **Endpoint**: `GET /trpc/booking.listByUser`
- **Params**: `{ userId: string }`
- **Response**: Array of bookings

## How It Works

### 1. MSW Setup (app/providers.tsx)

```typescript
const USE_MOCK_SERVER = true; // Phase 1 MVP

if (USE_MOCK_SERVER && typeof window !== 'undefined') {
    import('../lib/mock-trpc-server').then(({ startMockServer }) => {
        startMockServer();
    });
}
```

### 2. Mock Handlers (lib/mock-trpc-server.ts)

```typescript
export function startMockServer() {
    const worker = setupWorker(
        http.get('/trpc/health.check', () => {
            return HttpResponse.json({
                result: {
                    data: {
                        json: { status: 'ok', timestamp: new Date().toISOString() }
                    }
                }
            });
        }),
        // ... more handlers
    );

    worker.start();
}
```

### 3. tRPC Client (app/providers.tsx)

```typescript
const trpcClient = trpc.createClient({
    links: [
        httpBatchLink({
            // Use relative URL for MSW interception
            url: USE_MOCK_SERVER 
                ? '/trpc' 
                : 'http://localhost:4000/trpc',
        }),
    ],
});
```

## Testing the Mock Server

### Interactive Test Page

Visit http://localhost:3000/api-test and click "Run API Tests" to execute all endpoints.

### Console Logs

Open DevTools Console to see colored MSW logs:

```
[MSW] Mocking enabled.
[MSW] Mock tRPC server started 🚀
[MSW] Available endpoints:
  - GET /trpc/experience.getById
  - GET /trpc/experience.list
  - POST /trpc/booking.create
  ...

[MSW] 15:48:14 GET /trpc/health.check (200 OK)
[MSW] 15:48:15 GET /trpc/experience.list (200 OK)
```

### Using in Pages

All pages automatically use the mock server when `USE_MOCK_SERVER = true`:

```typescript
// Example: pages use tRPC queries normally
const { data: experiences } = trpc.experience.list.useQuery({ limit: 10 });
```

MSW intercepts the request and returns mock data.

## Switching to Real Backend

### Step 1: Set Flag to False

```typescript
// app/providers.tsx
const USE_MOCK_SERVER = false; // Use real backend
```

### Step 2: Start Backend Server

```bash
cd backend
npm run dev  # Starts on port 4000
```

### Step 3: Restart Frontend

```bash
cd frontend
npm run dev
```

Now tRPC will connect to `http://localhost:4000/trpc` instead of the mock server.

## Adding New Mock Endpoints

### 1. Add Handler to mock-trpc-server.ts

```typescript
http.get('/trpc/myNewEndpoint', () => {
    return HttpResponse.json({
        result: {
            data: {
                json: {
                    // Your mock data here
                }
            }
        }
    });
});
```

### 2. Add Test to /api-test Page

```typescript
const testMyNewEndpoint = async () => {
    const result = await trpc.myNewEndpoint.useQuery();
    console.log('Result:', result);
};
```

### 3. Update Mock Data (if needed)

Add mock data to `lib/constants.ts` for consistency across the app.

## Troubleshooting

### Mock Server Not Starting

**Issue**: MSW not intercepting requests

**Solution**: 
1. Check browser console for MSW logs
2. Ensure `USE_MOCK_SERVER = true`
3. Clear cache and reload: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

### 404 Not Found

**Issue**: Endpoint returns 404

**Solution**: 
1. Check endpoint path in mock-trpc-server.ts
2. Verify tRPC query matches the handler path
3. Console will show which handler was matched

### Response Structure Mismatch

**Issue**: tRPC expecting different response format

**Solution**: All mock responses must follow tRPC format:
```typescript
{
    result: {
        data: {
            json: {
                // Actual data here
            }
        }
    }
}
```

### Requests Going to Real Backend

**Issue**: Seeing `ERR_CONNECTION_REFUSED` to localhost:4000

**Solution**: 
1. Verify `USE_MOCK_SERVER = true`
2. Check tRPC URL is `/trpc` (relative) not `http://localhost:4000/trpc`
3. MSW only intercepts same-origin requests

## Benefits

✅ **No Backend Required**: Frontend development without waiting for backend
✅ **Fast Iteration**: Instant responses, no network latency
✅ **Type Safety**: Uses same AppRouter types as backend
✅ **Visual Feedback**: Console logs show all intercepted requests
✅ **Easy Testing**: /api-test page for quick API validation
✅ **Realistic Data**: Mock data matches production schema

## Files

- `lib/mock-trpc-server.ts` - MSW setup and handlers
- `lib/constants.ts` - Mock data (MOCK_EXPERIENCES)
- `app/providers.tsx` - MSW initialization
- `app/api-test/page.tsx` - Interactive test page
- `public/mockServiceWorker.js` - MSW service worker script

## Next Steps (Phase 2)

When ready for backend integration:

1. Set `USE_MOCK_SERVER = false`
2. Start backend tRPC server
3. All UI already wired up with tRPC queries
4. Seamless transition from mock to real data

---

**Status**: ✅ Mock Server Fully Operational
**Test Page**: http://localhost:3000/api-test
**All Endpoints**: Working with mock data
