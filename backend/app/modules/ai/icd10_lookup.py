import json
import logging
import os
import csv
from typing import List, Dict, Optional
from rapidfuzz import process, fuzz

logger = logging.getLogger(__name__)

class ICD10LookupService:
    def __init__(self, data_path: str = "app/data/icd10.csv"):
        self.data_path = data_path
        self.codes = []
        self.descriptions = []
        self.code_map = {}
        self._load_data()

    def _load_data(self):
        try:
            full_path = os.path.join(os.getcwd(), self.data_path)
            if os.path.exists(full_path):
                # Try loading CSV if suffix is .csv
                if full_path.endswith(".csv"):
                    with open(full_path, "r", encoding="utf-8") as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            # CSV format: Slug,Name (e.g. A00,Cholera)
                            code = row.get("Slug") or row.get("code")
                            description = row.get("Name") or row.get("description")
                            if code and description:
                                item = {"code": code, "description": description}
                                self.codes.append(item)
                                self.descriptions.append(description)
                                self.code_map[code.upper()] = item
                    logger.info(f"Loaded {len(self.codes)} ICD-10 codes from CSV.")
                # Fallback to JSON if suffix is .json
                elif full_path.endswith(".json"):
                    with open(full_path, "r") as f:
                        data = json.load(f)
                        self.codes = data
                        for item in data:
                            self.descriptions.append(item["description"])
                            self.code_map[item["code"].upper()] = item
                    logger.info(f"Loaded {len(self.codes)} ICD-10 codes from JSON.")
            else:
                logger.warning(f"ICD-10 data file not found at {full_path}")
                # Try a fallback to JSON if CSV not found (or vice versa)
                alt_path = full_path.replace(".csv", "_cm_2025.json") if full_path.endswith(".csv") else full_path.replace(".json", ".csv")
                if os.path.exists(alt_path):
                    self.data_path = os.path.relpath(alt_path, os.getcwd())
                    self._load_data()
        except Exception as e:
            logger.error(f"Error loading ICD-10 data: {e}")

    def lookup(self, query: str, limit: int = 5) -> List[Dict]:
        """
        Performs fuzzy matching on diagnosis descriptions and exact matching on codes.
        """
        if not query or not self.codes:
            return []

        query_clean = query.strip().upper()
        
        # 1. Check for exact code match
        if query_clean in self.code_map:
            item = self.code_map[query_clean]
            return [{
                "code": item["code"],
                "description": item["description"],
                "confidence": 1.0
            }]

        # 2. Perform fuzzy matching on descriptions
        # Note: rapidfuzz process.extract is fast even for 100k strings
        results = process.extract(
            query, 
            self.descriptions, 
            scorer=fuzz.WRatio, 
            limit=limit
        )

        matches = []
        for description, score, index in results:
            if score > 45:  # Slightly higher threshold due to 100k data size
                item = self.codes[index]
                # Avoid duplicate if it was somehow found
                if not any(m["code"] == item["code"] for m in matches):
                    matches.append({
                        "code": item["code"],
                        "description": item["description"],
                        "confidence": round(score / 100, 2)
                    })
        
        # Sort by confidence
        matches.sort(key=lambda x: x["confidence"], reverse=True)
        return matches[:limit]

icd10_service = ICD10LookupService()
