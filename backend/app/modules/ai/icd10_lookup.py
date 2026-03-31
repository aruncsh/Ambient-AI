import json
import logging
import os
import csv
from typing import List, Dict, Optional
from functools import lru_cache
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

    def _preprocess_query(self, query: str) -> str:
        """
        Removes clinical noise and filler words that confuse fuzzy matching.
        Prevents matching on generic terms that cause hallucinations (e.g. 'condition').
        """
        if not query: return ""
        
        # 1. Lowercase and strip
        text = query.lower().strip()
        
        # 2. Remove common clinical "filler" phrases
        fillers = [
            r"history of", r"diagnosed with", r"possible", r"early", r"late", 
            r"uncontrolled", r"controlled", r"mild", r"severe", r"acute", 
            r"chronic", r"long-standing", r"type-2", r"type 2", r"type-1", r"type 1",
            r"secondary to", r"due to", r"associated with", r"complicated by",
            r"five years ago", r"ten days ago", r"recently", r"new onset",
            r"primary", r"secondary", r"plus possible", r"early diabetic",
            r"complications", r"evaluation", r"status post", r"s/p", r"and", r"with", r"plus",
            r"under", r"over", r"within", r"between"
        ]
        
        # Generic words that should NEVER be used for standalone matching
        stop_words = {"condition", "interaction", "evaluation", "assessment", "complaint", "symptoms", "observed"}
        
        import re
        for filler in fillers:
            text = re.sub(rf"\b{filler}\b", "", text)
        
        # 3. Strip very short words (less than 3 chars) or stop words
        words = text.split()
        words = [w for w in words if len(w) >= 3 and w not in stop_words]
        
        if not words:
            return ""
            
        text = " ".join(words)
        
        # 4. Clean up whitespace
        text = re.sub(r"\s+", " ", text).strip()
        return text

    @lru_cache(maxsize=1024)
    def lookup(self, query: str, limit: int = 5) -> List[Dict]:
        """
        Performs fuzzy matching on diagnosis descriptions and exact matching on codes.
        Uses query pre-processing and a higher threshold (75) for better precision.
        """
        if not query or not self.codes:
            return []

        # Exact match check BEFORE preprocessing
        query_clean = query.strip().upper()
        if query_clean in self.code_map:
            item = self.code_map[query_clean]
            return [{
                "code": item["code"],
                "description": item["description"],
                "confidence": 1.0
            }]

        # Preprocess for fuzzy matching
        processed_query = self._preprocess_query(query)
        if len(processed_query) < 4: # Too short or contains only stop words
            return []

        # Perform fuzzy matching on descriptions
        results = process.extract(
            processed_query, 
            self.descriptions, 
            scorer=fuzz.WRatio, 
            limit=limit
        )

        matches = []
        for description, score, index in results:
            # INCREASED THRESHOLD: 75% match required for production-grade precision
            if score > 75:  
                item = self.codes[index]
                if not any(m["code"] == item["code"] for m in matches):
                    matches.append({
                        "code": item["code"],
                        "description": item["description"],
                        "confidence": round(score / 100, 2)
                    })
        
        matches.sort(key=lambda x: x["confidence"], reverse=True)
        return matches[:limit]

icd10_service = ICD10LookupService()
