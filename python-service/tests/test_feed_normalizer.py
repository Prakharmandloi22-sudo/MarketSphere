import pytest
from app.models.schemas import RawFeedRecord
from app.feed.catalog_normalizer import normalize_feed, clean_html, parse_price

def test_clean_html_stripping():
    dirty = "<div><h3>Ultra Sound</h3><p>Noise cancelling <b>headphones</b>.<script>alert('xss')</script></p></div>"
    cleaned = clean_html(dirty)
    assert "<" not in cleaned
    assert ">" not in cleaned
    assert "Noise cancelling headphones" in cleaned

def test_currency_conversion_and_anomaly_detection():
    # 100 EUR should convert to ~108 USD
    price_usd, is_anomaly, reason = parse_price("100.00", "EUR")
    assert price_usd == 108.0
    assert is_anomaly is False

    # Price $0.01 should trigger anomaly
    price_low, is_low_anomaly, low_reason = parse_price("$0.02", "USD")
    assert is_low_anomaly is True
    assert "Suspiciously low" in low_reason

def test_feed_batch_normalization():
    records = [
        RawFeedRecord(
            sku="  feed-sku-01  ",
            title="Clean Title",
            description="<p>Great product with <em>features</em></p>",
            price="$99.50",
            currency="USD",
            category="Electronics",
            attributes={"Color ": " Midnight Blue ", "  Memory": "16GB "}
        ),
        RawFeedRecord(
            sku="FEED-ERR-02",
            title="Faulty Pricing Item",
            price="0.05",
            currency="USD"
        )
    ]

    report = normalize_feed(records)
    assert report.total_received == 2
    assert report.total_valid == 1
    assert report.total_anomalies == 1
    assert report.records[0].sku == "FEED-SKU-01"
    assert report.records[0].attributes == {"color": "Midnight Blue", "memory": "16GB"}
    assert report.records[1].anomaly_detected is True
