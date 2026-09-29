# MarketWorth

A static, client-side craft fair / vendor market profitability calculator.

## Run locally

```bash
python3 -m http.server 4173
```

Open http://localhost:4173.

## Analytics hooks

Events are pushed to `window.dataLayer` and dispatched as `marketworth:analytics` CustomEvents:

- `calculator_started`
- `calculation_completed`
- `print_summary_clicked`
- `purchase_clicked`

## Checkout

Replace the purchase CTA behavior/link with a real checkout URL when available.
