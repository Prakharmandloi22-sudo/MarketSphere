from typing import Dict, List, Tuple
from app.models.schemas import PricingRequest, PricingResponse, ItemPricingBreakdown

# Base Commission rates per category
CATEGORY_COMMISSIONS: Dict[str, float] = {
    "electronics": 0.08,    # 8%
    "apparel": 0.12,        # 12%
    "home-kitchen": 0.10,   # 10%
    "general": 0.10
}

# Volume discount tiers: (min_qty, discount_percent)
VOLUME_DISCOUNT_TIERS = [
    (10, 0.15),  # 15% off for 10+
    (5, 0.10),   # 10% off for 5+
    (3, 0.05),   # 5% off for 3+
]

# Loyalty tier discounts
LOYALTY_DISCOUNTS = {
    "standard": 0.0,
    "silver": 0.02,
    "gold": 0.05,
    "vip": 0.08
}

def calculate_pricing(request: PricingRequest) -> PricingResponse:
    gross_subtotal = 0.0
    total_volume_discount = 0.0
    applied_rules: List[str] = []

    # 1. Volume & Category evaluation
    item_calculations = []
    for item in request.items:
        line_gross = round(item.base_price * item.quantity, 2)
        gross_subtotal += line_gross

        # Calculate volume discount
        vol_pct = 0.0
        for min_qty, pct in VOLUME_DISCOUNT_TIERS:
            if item.quantity >= min_qty:
                vol_pct = pct
                applied_rules.append(f"Volume discount {int(pct*100)}% applied to {item.sku} (qty: {item.quantity})")
                break

        vol_discount = round(line_gross * vol_pct, 2)
        total_volume_discount += vol_discount

        item_calculations.append({
            "item": item,
            "line_gross": line_gross,
            "vol_discount": vol_discount,
            "after_vol": line_gross - vol_discount
        })

    # 2. Coupon & Loyalty rules
    coupon_rate = 0.0
    if request.coupon_code:
        code = request.coupon_code.strip().upper()
        if code == "PROMO15":
            coupon_rate = 0.15
            applied_rules.append("Coupon PROMO15 applied (15% off)")
        elif code == "VIP20":
            coupon_rate = 0.20
            applied_rules.append("Coupon VIP20 applied (20% off)")

    loyalty_rate = LOYALTY_DISCOUNTS.get((request.buyer_loyalty_tier or "standard").lower(), 0.0)
    if loyalty_rate > 0:
        applied_rules.append(f"Loyalty tier '{request.buyer_loyalty_tier}' discount {int(loyalty_rate*100)}% applied")

    combined_extra_rate = coupon_rate + loyalty_rate

    # 3. Item-level Commission & Net Seller Payouts
    breakdown: List[ItemPricingBreakdown] = []
    total_coupon_discount = 0.0
    total_platform_commission = 0.0
    total_seller_payout = 0.0

    for calc in item_calculations:
        item = calc["item"]
        extra_discount = round(calc["after_vol"] * combined_extra_rate, 2)
        total_coupon_discount += extra_discount
        net_item = round(calc["after_vol"] - extra_discount, 2)

        comm_rate = CATEGORY_COMMISSIONS.get(item.category.lower(), 0.10)
        commission = round(net_item * comm_rate, 2)
        seller_payout = round(net_item - commission, 2)

        total_platform_commission += commission
        total_seller_payout += seller_payout

        breakdown.append(ItemPricingBreakdown(
            sku=item.sku,
            unit_price=item.base_price,
            quantity=item.quantity,
            gross_subtotal=calc["line_gross"],
            volume_discount=calc["vol_discount"],
            coupon_discount=extra_discount,
            net_item_total=net_item,
            platform_commission=commission,
            seller_net_payout=seller_payout
        ))

    net_total = round(gross_subtotal - total_volume_discount - total_coupon_discount, 2)

    return PricingResponse(
        gross_subtotal=round(gross_subtotal, 2),
        total_volume_discount=round(total_volume_discount, 2),
        total_coupon_discount=round(total_coupon_discount, 2),
        net_total=net_total,
        total_platform_commission=round(total_platform_commission, 2),
        total_seller_payout=round(total_seller_payout, 2),
        applied_rules=list(set(applied_rules)),
        breakdown=breakdown
    )
