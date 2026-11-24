import re
import html
import time
from typing import List, Dict, Any, Tuple
from app.models.schemas import RawFeedRecord, NormalizedFeedRecord, FeedProcessingReport

HTML_TAG_REGEX = re.compile(r'<[^>]+>')

CURRENCY_RATES = {
    "USD": 1.0,
    "EUR": 1.08,
    "GBP": 1.27,
    "CAD": 0.74,
}

def clean_html(raw_html: str) -> str:
    if not raw_html:
        return ""
    # Strip HTML tags and unescape entities
    text = HTML_TAG_REGEX.sub(' ', raw_html)
    text = html.unescape(text)
    return ' '.join(text.split())

def parse_price(raw_price: Any, currency: str = "USD") -> Tuple[float, bool, str]:
    try:
        if isinstance(raw_price, str):
            # Remove symbols like $, ,, etc.
            cleaned = re.sub(r'[^\d.]', '', raw_price.strip())
            price = float(cleaned)
        else:
            price = float(raw_price)

        if price <= 0:
            return 0.0, True, "Price must be strictly positive"

        # Currency conversion
        rate = CURRENCY_RATES.get(currency.upper(), 1.0)
        price_usd = round(price * rate, 2)

        # Anomaly checks: suspiciously low price (< $0.50) or suspiciously high (> $100,000)
        if price_usd < 0.50:
            return price_usd, True, f"Suspiciously low price (${price_usd}) - possible mispricing"
        if price_usd > 50000.0:
            return price_usd, True, f"Suspiciously high price (${price_usd}) - anomaly flag"

        return price_usd, False, ""
    except Exception as e:
        return 0.0, True, f"Invalid price format: {str(e)}"

def normalize_feed(records: List[RawFeedRecord]) -> FeedProcessingReport:
    start_time = time.perf_counter()
    normalized: List[NormalizedFeedRecord] = []
    anomalies_count = 0

    for rec in records:
        price_usd, is_anomaly, anomaly_reason = parse_price(rec.price, rec.currency or "USD")
        if is_anomaly:
            anomalies_count += 1

        clean_desc = clean_html(rec.description or "")
        
        # Deduplicate and normalize attributes
        clean_attrs: Dict[str, Any] = {}
        if rec.attributes:
            for k, v in rec.attributes.items():
                norm_key = k.strip().lower().replace(" ", "_")
                clean_attrs[norm_key] = v.strip() if isinstance(v, str) else v

        norm_rec = NormalizedFeedRecord(
            sku=rec.sku.strip().upper(),
            title=rec.title.strip(),
            sanitized_description=clean_desc,
            normalized_price_usd=price_usd,
            category=(rec.category or "general").strip().lower(),
            attributes=clean_attrs,
            anomaly_detected=is_anomaly,
            anomaly_reason=anomaly_reason if is_anomaly else None
        )
        normalized.append(norm_rec)

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return FeedProcessingReport(
        total_received=len(records),
        total_valid=len(records) - anomalies_count,
        total_anomalies=anomalies_count,
        duration_ms=duration_ms,
        records=normalized
    )
