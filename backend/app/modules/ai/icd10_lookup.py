import json
import logging
import os
from typing import List, Dict, Optional
from rapidfuzz import process, fuzz

logger = logging.getLogger(__name__)

class ICD10LookupService:
    def __init__(self, data_path: str = "app/data/icd10_cm_2025.json"):
        self.data_path = data_path
        self.codes = []
        self.descriptions = []
        self._load_data()

    def _load_data(self):
        try:
            full_path = os.path.join(os.getcwd(), self.data_path)
            if os.path.exists(full_path):
                with open(full_path, "r") as f:
                    data = json.load(f)
                    self.codes = data
                    self.descriptions = [item["description"] for item in data]
            else:
                logger.warning(f"ICD-10 data file not found at {full_path}")
        except Exception as e:
            logger.error(f"Error loading ICD-10 data: {e}")

    def lookup(self, query: str, limit: int = 5) -> List[Dict]:
        """
        Performs fuzzy matching on diagnosis descriptions.
        """
        if not query or not self.descriptions:
            return []

        results = process.extract(
            query, 
            self.descriptions, 
            scorer=fuzz.WRatio, 
            limit=limit
        )

        matches = []
        for description, score, index in results:
            if score > 40:  # Confidence threshold
                item = self.codes[index]
                matches.append({
                    "code": item["code"],
                    "description": item["description"],
                    "confidence": round(score / 100, 2)
                })
        
        return matches

icd10_service = ICD10LookupService()
