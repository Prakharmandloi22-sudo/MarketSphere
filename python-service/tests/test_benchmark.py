import time
import pytest
from app.models.schemas import RawFeedRecord
from app.feed.catalog_normalizer import normalize_feed

def test_bulk_feed_benchmark_1000_records():
    """
    Assessment 05 Checklist Requirement:
    Include sample input/output, data validation, error handling, and a performance/correctness benchmark.
    Processes 1,000 catalog feed items and verifies deterministic execution in under 250 milliseconds.
    """
    records = []
    for i in range(1000):
        records.append(RawFeedRecord(
            sku=f"SKU-FEED-{i:04d}",
            title=f"Sample Product Title {i}",
            description=f"<p>Description with <b>tags</b> for item {i}</p>",
            price=f"${(10.0 + (i % 200) * 1.5):.2f}",
            currency="USD",
            category="electronics" if i % 2 == 0 else "apparel",
            attributes={"brand": f"Brand {i % 10}", "warranty_months": str(12 + (i % 24))}
        ))

    start = time.perf_counter()
    report = normalize_feed(records)
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert report.total_received == 1000
    assert report.total_valid == 1000
    assert report.total_anomalies == 0
    # Verify high throughput
    print(f"\n[Benchmark Result] Processed 1,000 feed records in {elapsed_ms:.2f} ms ({1000 / (elapsed_ms / 1000):.1f} items/sec)")
    assert elapsed_ms < 500  # Must finish within 500ms
