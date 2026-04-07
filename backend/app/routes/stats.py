from fastapi import APIRouter
from app.models.encounter import Encounter
from app.models.user import Patient, Doctor
from datetime import datetime, timedelta
from typing import Dict
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/")
async def get_clinical_stats():
    try:
        # 1. Total Sessions (All encounters in the registry)
        total_sessions = await Encounter.count()
        
        # 2. Active Tele-Consults (status is 'active' or 'recording')
        active_consults = await Encounter.find({"status": {"$in": ["active", "recording"]}}).count()
        
        # 3. OPD Flow Today (Sum of billing_amount for sessions created today)
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_encounters = await Encounter.find({"created_at": {"$gte": today_start}}).to_list()
        opd_flow = sum(enc.billing_amount or 0 for enc in today_encounters)
        
        # 4. Avg Consult Time (Difference between created_at and updated_at for completed sessions)
        completed_sessions = await Encounter.find({"status": "completed"}).to_list()
        avg_time_minutes = 0.0
        if completed_sessions:
            durations = []
            for s in completed_sessions:
                if s.updated_at and s.created_at:
                    delta = (s.updated_at - s.created_at).total_seconds() / 60.0
                    # Sanity check: consultations shouldn't be negative or unusually long (> 4 hours)
                    if 0.5 < delta < 240:
                        durations.append(delta)
            
            if durations:
                avg_time_minutes = sum(durations) / len(durations)
        
        # Fallback if no data yet (but user wants exact, so we return 0 or actual)
        return {
            "opd_flow_today": f"INR {opd_flow:,.2f}",
            "active_teleconsults": active_consults,
            "avg_consult_time": f"{avg_time_minutes:.1f}m",
            "total_sessions": total_sessions
        }
    except Exception as e:
        logger.error(f"Failed to fetch stats: {e}")
        return {
            "opd_flow_today": "INR 0.00",
            "active_teleconsults": 0,
            "avg_consult_time": "0.0m",
            "total_sessions": 0
        }
