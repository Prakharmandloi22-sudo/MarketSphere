from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from app.models.schemas import (
    PricingRequest, PricingResponse,
    RawFeedRecord, FeedProcessingReport,
    RecommendationRequest, RecommendationResponse
)
from app.pricing.rules_engine import calculate_pricing
from app.feed.catalog_normalizer import normalize_feed
from app.recommendation.recommender import generate_recommendations

app = FastAPI(
    title="MarketSphere Python Pricing, Feed & Recommendation Engine",
    description="Microservice responsible for promotion rules, commission calculation, catalog normalization, and explainable recommendations.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "python-pricing-and-recommendation-engine",
        "version": "1.0.0"
    }

# Assessment 05: Pricing and Promotion Engine
@app.post("/api/pricing/calculate", response_model=PricingResponse)
def calculate_price_endpoint(req: PricingRequest):
    try:
        return calculate_pricing(req)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

# Assessment 05: Catalog Feed Normalization & Anomaly Detection
@app.post("/api/feed/normalize", response_model=FeedProcessingReport)
def normalize_feed_endpoint(records: List[RawFeedRecord]):
    try:
        return normalize_feed(records)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

# Assessment 06: Product Recommendation Engine
@app.post("/api/recommendations", response_model=RecommendationResponse)
def recommendation_endpoint(req: RecommendationRequest):
    try:
        return generate_recommendations(req)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
