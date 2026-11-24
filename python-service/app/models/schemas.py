from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any

# Pricing & Promotion Models
class PricingItem(BaseModel):
    sku: str
    base_price: float = Field(gt=0, description="Original unit price")
    quantity: int = Field(gt=0, description="Purchased quantity")
    category: str = Field(default="general")
    seller_id: str = Field(default="default-seller")

class PricingRequest(BaseModel):
    items: List[PricingItem]
    coupon_code: Optional[str] = None
    buyer_loyalty_tier: Optional[str] = "standard"  # standard, silver, gold, vip

class ItemPricingBreakdown(BaseModel):
    sku: str
    unit_price: float
    quantity: int
    gross_subtotal: float
    volume_discount: float
    coupon_discount: float
    net_item_total: float
    platform_commission: float
    seller_net_payout: float

class PricingResponse(BaseModel):
    gross_subtotal: float
    total_volume_discount: float
    total_coupon_discount: float
    net_total: float
    total_platform_commission: float
    total_seller_payout: float
    applied_rules: List[str]
    breakdown: List[ItemPricingBreakdown]

# Feed Models
class RawFeedRecord(BaseModel):
    sku: str
    title: str
    description: Optional[str] = ""
    price: Any
    currency: Optional[str] = "USD"
    category: Optional[str] = "general"
    attributes: Optional[Dict[str, Any]] = None

class NormalizedFeedRecord(BaseModel):
    sku: str
    title: str
    sanitized_description: str
    normalized_price_usd: float
    category: str
    attributes: Dict[str, Any]
    anomaly_detected: bool
    anomaly_reason: Optional[str] = None

class FeedProcessingReport(BaseModel):
    total_received: int
    total_valid: int
    total_anomalies: int
    duration_ms: float
    records: List[NormalizedFeedRecord]

# Recommendation Models
class RecommendationRequest(BaseModel):
    user_id: Optional[str] = None
    current_sku: Optional[str] = None
    category: Optional[str] = None
    limit: int = 5

class RecommendationItem(BaseModel):
    sku: str
    title: str
    category: str
    score: float
    reason: str  # Explainable justification
    strategy: str  # collaborative, content_based, trending_cold_start

class RecommendationResponse(BaseModel):
    user_id: Optional[str]
    strategy_used: str
    recommendations: List[RecommendationItem]
