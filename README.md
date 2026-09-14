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

### 2. Secrets and config

Copy `.env.example` to `.env` and set secrets only:

```bash
ITAD_API_KEY=your_key_here
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_channel_id
```

Copy `config/example.config.ts` to `bot.config.ts` to change stores, filters, or limits. `bot.config.ts` is gitignored. Missing it uses the example file. Override any key in Actions with `DEALBOT__PATH__TO__KEY` (for example `DEALBOT__FILTERS__MIN_DISCOUNT=40`).

Store names in config (`"steam"`, `"gog"`) resolve to ITAD shop ids. You can also pass a numeric id.

### 3. Store IDs Reference

`SHOP_IDS` in older docs was a comma-separated list of ITAD shop IDs. Config now uses `stores` with names or ids. Default: Steam, GOG, Fanatical, and shop `3`.
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

Defaults live in `config/example.config.ts`. Copy that file to `bot.config.ts` to change them.

| Field | Default | Notes |
|---|---|---|
| `region.country` | `US` | ISO 3166-1 alpha-2 |
| `stores` | `steam`, `gog`, `fanatical`, `3` | Names or ITAD shop ids |
| `filters.minDiscount` / `maxDiscount` | 30 / 85 | Percent off |
| `filters.minRating` | 70 | Steam score after `/games/info/v2`. `0` disables |
| `filters.minReviews` | 100 | Steam review count. `0` disables |
| `filters.drm` | `"Steam"` | `"any"` or `[]` disables |
| `filters.minHoursUntilExpiry` | 48 | `0` still drops already-expired deals |
| `limit` | 50 | Target posts per run |
| `dedupe.ttlDays` | 7 | Remember posted game ids |

Invalid config aborts at startup with a path in the message (`filters.minRating must be 0–100, got "seventy"`).

## API Rate Limits

ITAD API has reasonable rate limits for daily batch processing. The bot fetches pages of up to 200 deals until the target count is met, with a short delay between pages.

## Why ITAD over CheapShark?

- Built-in Steam rating and review count data
- Configurable DRM filtering via `filters.drm`
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

- Lower `filters.minRating` or `filters.minReviews`
- Increase `limit`
- Check `stores`
- Verify `filters.minDiscount` isn't too high

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
