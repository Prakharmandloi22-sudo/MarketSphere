from typing import List, Dict, Optional
from app.models.schemas import RecommendationRequest, RecommendationResponse, RecommendationItem

# Synthetic Product Catalog Knowledge Graph
PRODUCTS_CATALOG = [
    {
        "sku": "HEADPHONE-BLK-01",
        "title": "Quantum Ultra Wireless Headphones",
        "category": "electronics",
        "price": 199.99,
        "rating": 4.9,
        "popularity_score": 98.5
    },
    {
        "sku": "KEYBOARD-RGB-PRO",
        "title": "Apex Mechanical Gaming Keyboard",
        "category": "electronics",
        "price": 129.50,
        "rating": 4.8,
        "popularity_score": 92.0
    },
    {
        "sku": "WATCH-LTD-01",
        "title": "Apex Chrono Limited Edition Smartwatch",
        "category": "electronics",
        "price": 499.00,
        "rating": 5.0,
        "popularity_score": 95.0
    },
    {
        "sku": "HOODIE-M-GRY",
        "title": "Merino Wool Minimalist Pullover Hoodie",
        "category": "apparel",
        "price": 89.00,
        "rating": 4.7,
        "popularity_score": 88.0
    },
    {
        "sku": "SNEAKER-RUN-WHT",
        "title": "CloudStrider Carbon Running Shoes",
        "category": "apparel",
        "price": 140.00,
        "rating": 4.8,
        "popularity_score": 90.0
    },
    {
        "sku": "CHAIR-ERGO-BLU",
        "title": "Ergonomic Lumbar Mesh Office Chair",
        "category": "home-kitchen",
        "price": 249.00,
        "rating": 4.9,
        "popularity_score": 86.0
    }
]

# Synthetic Collaborative Filtering Co-occurrence (Item-Item Affinity)
CO_OCCURRENCE = {
    "HEADPHONE-BLK-01": [
        ("KEYBOARD-RGB-PRO", 0.92, "Frequently purchased together with Quantum Headphones"),
        ("WATCH-LTD-01", 0.84, "Customers looking for high-end audio also bought Apex Smartwatch")
    ],
    "KEYBOARD-RGB-PRO": [
        ("HEADPHONE-BLK-01", 0.91, "Commonly paired audio & peripheral bundle"),
        ("CHAIR-ERGO-BLU", 0.79, "Gamers & engineers who bought this keyboard upgraded their workstation chair")
    ],
    "HOODIE-M-GRY": [
        ("SNEAKER-RUN-WHT", 0.88, "Trending complementary apparel pairing"),
        ("HEADPHONE-BLK-01", 0.65, "Athletic & commute style bundle")
    ]
}

# Synthetic User Past Browsing / Purchase Affinity History
USER_HISTORY = {
    "user_cust_01": ["HEADPHONE-BLK-01"],
    "user_cust_02": ["HOODIE-M-GRY"]
}

def generate_recommendations(req: RecommendationRequest) -> RecommendationResponse:
    target_sku = (req.current_sku or "").strip().upper()
    user_id = req.user_id

    recs: List[RecommendationItem] = []
    strategy = "trending_cold_start"

    # Strategy 1: Item-Item Collaborative Filtering (if current_sku provided)
    if target_sku and target_sku in CO_OCCURRENCE:
        strategy = "item_collaborative_filtering"
        for aff_sku, score, reason in CO_OCCURRENCE[target_sku]:
            prod = next((p for p in PRODUCTS_CATALOG if p["sku"] == aff_sku), None)
            if prod:
                recs.append(RecommendationItem(
                    sku=prod["sku"],
                    title=prod["title"],
                    category=prod["category"],
                    score=score,
                    reason=reason,
                    strategy=strategy
                ))

    # Strategy 2: User History Collaborative Filtering (if user history exists)
    if len(recs) < req.limit and user_id and user_id in USER_HISTORY:
        strategy = "user_collaborative_filtering"
        past_skus = USER_HISTORY[user_id]
        for p_sku in past_skus:
            if p_sku in CO_OCCURRENCE:
                for aff_sku, score, reason in CO_OCCURRENCE[p_sku]:
                    if aff_sku != target_sku and not any(r.sku == aff_sku for r in recs):
                        prod = next((p for p in PRODUCTS_CATALOG if p["sku"] == aff_sku), None)
                        if prod:
                            recs.append(RecommendationItem(
                                sku=prod["sku"],
                                title=prod["title"],
                                category=prod["category"],
                                score=round(score * 0.95, 2),
                                reason=f"Based on your recent interest in {p_sku}",
                                strategy=strategy
                            ))

    # Strategy 3: Content-Based Matching by Category (if target item or category filter given)
    target_category = req.category
    if not target_category and target_sku:
        curr_prod = next((p for p in PRODUCTS_CATALOG if p["sku"] == target_sku), None)
        if curr_prod:
            target_category = curr_prod["category"]

    if len(recs) < req.limit and target_category:
        for prod in PRODUCTS_CATALOG:
            if prod["sku"] != target_sku and not any(r.sku == prod["sku"] for r in recs):
                if prod["category"].lower() == target_category.lower():
                    recs.append(RecommendationItem(
                        sku=prod["sku"],
                        title=prod["title"],
                        category=prod["category"],
                        score=0.75,
                        reason=f"Top rated choice in {prod['category'].capitalize()}",
                        strategy="content_based"
                    ))

    # Strategy 4: Explainable Cold-Start Fallback (Zero browsing/purchase history)
    if len(recs) < req.limit:
        strategy = "cold_start_fallback"
        # Sort catalog by popularity_score and rating
        sorted_catalog = sorted(PRODUCTS_CATALOG, key=lambda x: (x["popularity_score"], x["rating"]), reverse=True)
        for prod in sorted_catalog:
            if prod["sku"] != target_sku and not any(r.sku == prod["sku"] for r in recs):
                recs.append(RecommendationItem(
                    sku=prod["sku"],
                    title=prod["title"],
                    category=prod["category"],
                    score=round(prod["popularity_score"] / 100.0, 2),
                    reason="Bestseller with verified high customer satisfaction ratings",
                    strategy="cold_start_fallback"
                ))
            if len(recs) >= req.limit:
                break

    return RecommendationResponse(
        user_id=user_id,
        strategy_used=strategy,
        recommendations=recs[:req.limit]
    )
