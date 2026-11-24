import pytest
from app.models.schemas import PricingRequest, PricingItem
from app.pricing.rules_engine import calculate_pricing

def test_volume_discount_10_units():
    # 10 units at $100.00 each = $1,000.00 gross -> 15% volume discount ($150)
    req = PricingRequest(
        items=[
            PricingItem(sku="SKU-TEST-1", base_price=100.0, quantity=10, category="electronics")
        ]
    )
    res = calculate_pricing(req)
    assert res.gross_subtotal == 1000.0
    assert res.total_volume_discount == 150.0
    assert res.net_total == 850.0
    # Electronics commission is 8% of $850 = $68.00
    assert res.total_platform_commission == 68.0
    assert res.total_seller_payout == 782.0

def test_coupon_and_loyalty_stacking():
    # 1 unit at $200 with coupon PROMO15 (15%) + gold loyalty (5%) = 20% discount ($40)
    req = PricingRequest(
        items=[
            PricingItem(sku="SKU-TEST-2", base_price=200.0, quantity=1, category="apparel")
        ],
        coupon_code="PROMO15",
        buyer_loyalty_tier="gold"
    )
    res = calculate_pricing(req)
    assert res.gross_subtotal == 200.0
    assert res.total_volume_discount == 0.0
    assert res.total_coupon_discount == 40.0
    assert res.net_total == 160.0
    # Apparel commission is 12% of $160 = $19.20
    assert res.total_platform_commission == 19.20
    assert res.total_seller_payout == 140.80

def test_deterministic_pricing_precision():
    req = PricingRequest(
        items=[
            PricingItem(sku="ITEM-A", base_price=19.99, quantity=3, category="electronics"),
            PricingItem(sku="ITEM-B", base_price=49.95, quantity=5, category="home-kitchen")
        ],
        coupon_code="PROMO15"
    )
    res = calculate_pricing(req)
    # Check that net_total == gross_subtotal - discounts
    assert round(res.gross_subtotal - res.total_volume_discount - res.total_coupon_discount, 2) == res.net_total
    # Check that platform commission + seller payout == net_total
    assert round(res.total_platform_commission + res.total_seller_payout, 2) == res.net_total
