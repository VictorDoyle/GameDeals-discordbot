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

`SHOP_IDS` is a comma-separated list of ITAD shop IDs. Default: `61,35,6,36` (Steam, GOG, Fanatical, GreenManGaming).
According to [ITAD API documentation](https://docs.isthereanydeal.com/), common store IDs:

- **61** - Steam
- **35** - GOG
- **6** - Fanatical
- **36** - GreenManGaming
- **11** - Humble Store
- **13** - GamersGate
- **25** - Epic Games Store

You can fetch all available stores using the `/service/shops/v1` endpoint/from [GET /service/shops/v1](https://docs.isthereanydeal.com/) but below is a list for quick reference:

| ID | Store |
|---:|---|
| 2 | AllYouPlay |
| 4 | Blizzard |
| 6 | Fanatical |
| 13 | DLGamer |
| 15 | Dreamgame |
| 16 | Epic Game Store |
| 17 | FireFlower |
| 20 | GameBillet |
| 24 | GamersGate |
| 25 | Gamesload |
| 26 | GamesPlanet UK |
| 27 | GamesPlanet DE |
| 28 | GamesPlanet FR |
| 29 | GamesPlanet US |
| 35 | GOG |
| 36 | GreenManGaming |
| 37 | Humble Store |
| 42 | IndieGala Store |
| 47 | MacGameStore |
| 48 | Microsoft Store |
| 49 | Newegg |
| 50 | Nuuvem |
| 52 | EA Store |
| 61 | Steam |
| 62 | Ubisoft Store |
| 64 | WinGameStore |
| 65 | JoyBuggy |
| 70 | Playsum |
| 72 | ZOOM Platform |
| 73 | PlanetPlay |
| 74 | PlayerLand |
| 75 | Fortuna Digital |
| 77 | Muve |
| 78 | Zapagames |

### 4. Install and Run

```bash
yarn install
yarn build
yarn start
```

## Configuration Options

### MIN_SAVINGS

Minimum discount percentage (default: 30)

### MAX_SAVINGS

Maximum discount percentage (default: 85)

### MIN_RATING

Minimum Steam rating percentage (default: 70). Applied after `/games/info/v2` enrichment. Set to `0` to disable. Missing Steam reviews fail this filter when it is enabled.

### MIN_REVIEW_COUNT

Minimum number of Steam reviews (default: 100). Same enrichment path as `MIN_RATING`. Set to `0` to disable.

### MIN_HOURS_UNTIL_EXPIRY

Drop deals that expire sooner than this many hours (default: 48). `0` still rejects already-expired deals, but allows anything still live.

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

Invalid integer env values (for example: `DEAL_LIMIT=foo-bar`) will abort at startup with a message.

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
