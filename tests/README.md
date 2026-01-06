# Testing Instructions

## Overview

This test suite validates:

1. API connection and authentication
2. Response structure from ITAD API
3. Filtering logic (savings, review count, Steam DRM)
4. Discord message formatting
5. Store filtering

## Setup

Ensure your `.env` file has:

```bash
ITAD_API_KEY=your_actual_key
SHOP_IDS=61,35,37,24,29,36,49
MIN_SAVINGS=30
MIN_REVIEW_COUNT=150
```

## Run Tests

```bash
npm run build
npx ts-node test.ts
```

## What Gets Tested

### Test 1: API Connection

Verifies your API key works and ITAD responds.

**Success**: HTTP 200 response with valid JSON

**Failure indicators**:

- 401: Invalid API key
- Network error: Connection issues

### Test 2: Response Structure

Validates all required fields exist in API response.

**Checks**:

- Response is array
- Deal objects have: id, slug, title, type, mature, assets, deal
- Deal.deal has: shop, price, regular, cut, drm, platforms, timestamp, url

**Failure**: Missing fields indicate API changes or malformed response

### Test 3: Filtering Logic

Tests that your filters work correctly.

**Validates**:

- All deals meet minimum savings threshold
- All deals have Steam reviews above minimum count
- All deals have Steam DRM

**Expected**: Some deals filtered out. If zero deals pass, filters may be too strict.

### Test 4: Message Formatting

Validates Discord messages format correctly.

**Checks**:

- Message contains: title, price, discount, store, link
- Message length under 2000 chars (Discord limit)
- Displays sample formatted message

**Review**: Check that sample message looks good for Discord

### Test 5: Store Filtering

Validates only requested stores appear in results.

**Checks**:

- All deals come from stores in SHOP_IDS
- Reports which stores appear in results

**Expected**: Only stores from your SHOP_IDS list

## Understanding Results

### All Tests Pass

```
Total tests: 20
Passed: 20
Failed: 0
All tests passed. Ready for production.
```

You can proceed to Discord testing.

### Some Tests Fail

Review the failed test details. Common issues:

**"No deals passed filters"**

- Filters too strict
- Try lowering MIN_SAVINGS to 20 or MIN_REVIEW_COUNT to 100

**"Missing field: X"**

- API response structure changed
- Check ITAD API documentation

**"Message exceeds Discord limit"**

- Unlikely but possible
- Need to truncate message formatting

**"Deals from unexpected stores"**

- Store filtering not working
- Verify SHOP_IDS format

## Next Steps After Tests Pass

### 1. Test Mode Run

```bash
TEST_MODE=true npm start
```

This shows what would be posted without posting to Discord.

### 2. Discord Test Channel

Create a test channel and post 2-3 deals:

```bash
TEST_MODE=false
DISCORD_CHANNEL_ID=test_channel_id
DEAL_LIMIT=3
npm start
```

### 3. Production

Set real channel ID and full deal limit:

```bash
TEST_MODE=false
DISCORD_CHANNEL_ID=real_channel_id
DEAL_LIMIT=50
```

## Troubleshooting

### No Deals Returned

Your filters may be too strict. Try:

```bash
MIN_SAVINGS=20
MIN_REVIEW_COUNT=50
```

### API Key Invalid

Verify at: https://isthereanydeal.com/apps/

### TypeScript Errors

```bash
npm ci
npm run build
```

### Test Hangs

Check your internet connection. ITAD API may be slow to respond.

## GitHub Actions

Once local tests pass, GitHub Actions should work automatically with your configured secrets and variables.
