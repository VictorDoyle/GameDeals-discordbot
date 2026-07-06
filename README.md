# ITAD Game Deals Discord Bot

A Discord bot that posts the best game deals from IsThereAnyDeal.com based on your criteria.

## Features

- ✅ Steam-only deals with DRM filtering
- ✅ Minimum review count filtering (100+)
- ✅ Minimum rating filtering (70%+)
- ✅ Minimum discount percentage (30%+)
- ✅ Multiple store support
- ✅ Historical low detection
- ✅ Deduplication (prevents posting same deals)
- ✅ Free API with generous rate limits

## Setup

### 1. Get ITAD API Key

1. Go to https://isthereanydeal.com/apps/
2. Register your application
3. Copy your API key

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
ITAD_API_KEY=your_key_here
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_channel_id

DEAL_LIMIT=50
MIN_SAVINGS=30
MAX_SAVINGS=85
MIN_REVIEW_COUNT=100
MIN_RATING=70
COUNTRY=US

SHOP_IDS=61,35,6,3
```

### 3. Store IDs Reference

According to [ITAD API documentation](https://docs.isthereanydeal.com/), common store IDs:

- **61** - Steam
- **35** - GOG
- **6** - Fanatical
- **3** - GreenManGaming
- **11** - Humble Store
- **13** - GamersGate
- **25** - Epic Games Store

You can fetch all available stores using the `/service/shops/v1` endpoint.

### 4. Install and Run

```bash
yarn install
yarn build
yarn start
```

## Configuration Options

### MIN_SAVINGS

Minimum discount percentage (default: 30)

### MIN_REVIEW_COUNT

Minimum number of Steam reviews (default: 100)

### MIN_RATING

Minimum Steam rating percentage (default: 70)

### DEAL_LIMIT

Target number of deals to post per run (default: 50). The bot paginates through ITAD results until this count of new, filter-matching deals is collected, or the API is exhausted. Posts fewer on shortfall; never posts duplicates.

### REQUIRED_DRM_NAMES

Comma-separated DRM names a deal must have (default: `Steam`). Leave empty to disable DRM filtering.

### SHOP_IDS

Comma-separated store IDs to check (default: 61,35,6,3)

### COUNTRY

ISO 3166-1 alpha-2 country code for pricing (default: US)

### DEDUPLICATION_DAYS

Days to remember posted deals (default: 7)

## API Rate Limits

ITAD API has reasonable rate limits for daily batch processing. The bot fetches pages of up to 200 deals until the target count is met, with a short delay between pages.

## Why ITAD over CheapShark?

- Built-in Steam rating and review count data
- Configurable DRM filtering via `REQUIRED_DRM_NAMES`
- More reliable historical low tracking
- Better store coverage
- More active development
- Mature game filtering

## Example Output

```
**Hollow Knight**

Price: USD 7.49 (was 14.99)
Discount: 50% OFF
Steam Rating: 97% (153,420 reviews)
Metacritic: 87/100
Store: Steam
🔥 HISTORICAL LOW!
Link: https://itad.link/...
```

## Troubleshooting

### No deals found

- Lower MIN_RATING or MIN_REVIEW_COUNT
- Increase DEAL_LIMIT
- Check different SHOP_IDS
- Verify MIN_SAVINGS isn't too high

### API errors

- Verify ITAD_API_KEY is correct
- Check your app is registered at isthereanydeal.com/apps/my
- Ensure you're not hitting rate limits

## GitHub Actions

Schedule daily deal posts:

```yaml
on:
  schedule:
    - cron: "0 12 * * *"
```

Set secrets in repository settings:

- ITAD_API_KEY
- DISCORD_TOKEN
- DISCORD_CHANNEL_ID
