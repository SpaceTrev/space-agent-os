---
name: space-agent-os:deploy-verify
description: >
  HTTP verification of Railway deploys for space-agent-os. Use this skill any time
  you deploy space-paperclip or any service to Railway, and any time you are asked
  to check if Railway is working or verify the deploy. Never report a deploy as
  successful without running through this checklist — the most common failure mode
  is reporting success based on Railway showing a green status indicator when the
  actual HTTP response is wrong.
---

# Deploy Verification Procedure

Railway showing Active does not mean the service is working. Always verify with
real HTTP requests.

## Required checks (run in order)

### 1. Health endpoint

    curl -s -w "
HTTP_STATUS:%{http_code}" https://space-paperclip-production.up.railway.app/health

Expected: HTTP 200. Any other status = service is not healthy.

### 2. Root / UI

    curl -s -o /dev/null -w "%{http_code}" https://space-paperclip-production.up.railway.app/

Expected: HTTP 200. Should return HTML (the React SPA), not a JS source file.

### 3. API auth endpoint

    curl -s -w "
HTTP_STATUS:%{http_code}" https://space-paperclip-production.up.railway.app/api/auth/get-session

### 4. Verify response is real content, not an error page

A 200 is not enough — servers can return 200 for error pages. Check the body:

    curl -s https://space-paperclip-production.up.railway.app/ | head -10

Should start with <!DOCTYPE html> and contain actual HTML markup.

## If any check fails

1. Check Railway build logs:

       railway logs --service space-paperclip | tail -50

2. Check Railway deploy status in the dashboard
3. Look for the actual error (TypeScript compile errors, missing env vars, DB connection failures)
4. Fix the root cause, push, and re-run this entire checklist

## Reporting results

When you complete verification, paste the actual curl output:

    OK /health -> 200 {"status":"ok"}
    OK / -> 200 (HTML, 14KB)
    OK /api/auth/get-session -> 200 {"session":null}

Do not paraphrase. Paste the actual output. This is evidence, not a summary.

## Railway service reference

- Project: space-claw
- Service: space-paperclip
- Production URL: https://space-paperclip-production.up.railway.app
- Health path: /health
- Postgres: auto-wired via DATABASE_URL from Postgres service
