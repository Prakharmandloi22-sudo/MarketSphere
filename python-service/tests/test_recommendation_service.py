import pytest
from app.models.schemas import RecommendationRequest
from app.recommendation.recommender import generate_recommendations

def test_item_collaborative_filtering():
    req = RecommendationRequest(
        current_sku="HEADPHONE-BLK-01",
        limit=2
    )
    res = generate_recommendations(req)
    assert res.strategy_used == "item_collaborative_filtering"
    assert len(res.recommendations) >= 1
    # Check that recommendation contains explainability reason
    first_rec = res.recommendations[0]
    assert first_rec.sku == "KEYBOARD-RGB-PRO"
    assert "Frequently purchased together" in first_rec.reason
    assert first_rec.score > 0.8

def test_user_history_collaborative_filtering():
    req = RecommendationRequest(
        user_id="user_cust_02",  # Has past interest in HOODIE-M-GRY
        limit=2
    )
    res = generate_recommendations(req)
    assert res.strategy_used == "user_collaborative_filtering"
    assert any("HOODIE-M-GRY" in r.reason or "pairing" in r.reason for r in res.recommendations)

def test_cold_start_fallback():
    # User has zero browsing history, zero cart, no current SKU
    req = RecommendationRequest(
        user_id="new_anonymous_visitor_999",
        limit=3
    )
    res = generate_recommendations(req)
    assert res.strategy_used == "cold_start_fallback"
    assert len(res.recommendations) == 3
    # Verify explainable metadata is returned
    for r in res.recommendations:
        assert "Bestseller" in r.reason
        assert r.score > 0.8
