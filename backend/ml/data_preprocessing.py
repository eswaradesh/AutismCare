"""
AutismCare Data Collection & Preprocessing Layer
Handles voice-to-text, multilingual processing, and feature engineering
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass
from datetime import datetime, date
import re
import json
import logging

from config import PipelineConfig, get_config

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class RawDailyInput:
    """Raw daily input data from parent/caregiver"""
    child_id: str
    date: str  # ISO format YYYY-MM-DD
    sleep_start: Optional[str] = None  # Time string HH:MM
    sleep_end: Optional[str] = None
    meals: Optional[List[Dict]] = None  # [{time, type, notes}]
    activities: Optional[List[Dict]] = None  # [{type, duration, notes}]
    emotions: Optional[List[str]] = None  # List of observed emotions
    behaviour_notes: Optional[str] = None  # Free text
    behaviour_intensity: Optional[str] = None  # low/moderate/high
    medication_taken: Optional[bool] = None
    voice_note_text: Optional[str] = None  # Transcribed voice
    language: str = "en"


@dataclass
class ProcessedDailyVector:
    """Processed daily vector ready for ML"""
    child_id: str
    date: str
    sleep_hours: float
    activity_level: float  # Normalized 0-1
    emotion_score: float  # Normalized 0-1 (higher = more positive)
    behaviour_score: float  # Normalized 0-1 (higher = more calm)
    medication_flag: int  # 0 or 1
    raw_notes: Optional[str] = None
    metadata: Optional[Dict] = None


class VoiceToTextProcessor:
    """
    Voice note transcription handler
    Note: Uses external STT service - placeholder for integration
    """
    
    def __init__(self, config: PipelineConfig = None):
        self.config = config or get_config()
        self.supported_languages = self.config.supported_languages
    
    def transcribe(self, audio_url: str, language: str = "en") -> str:
        """
        Transcribe audio to text
        
        In production, integrate with:
        - Azure Speech Services
        - Google Cloud Speech-to-Text
        - AWS Transcribe
        - Whisper (OpenAI)
        
        Args:
            audio_url: URL or path to audio file
            language: ISO language code
            
        Returns:
            Transcribed text
        """
        # Placeholder - in production, call actual STT service
        logger.info(f"Transcribing audio from {audio_url} in language: {language}")
        
        # Example integration point:
        # from azure.cognitiveservices.speech import SpeechConfig, AudioConfig
        # speech_config = SpeechConfig(subscription=key, region=region)
        # speech_config.speech_recognition_language = language
        # ...
        
        return ""  # Return transcribed text
    
    def is_language_supported(self, language: str) -> bool:
        """Check if language is supported for transcription"""
        return language.lower() in self.supported_languages


class MultilingualTextProcessor:
    """
    Process multilingual text inputs
    Normalize and translate to English for consistent processing
    """
    
    def __init__(self, config: PipelineConfig = None):
        self.config = config or get_config()
        
        # Emotion keywords in multiple languages
        self.emotion_keywords = {
            "en": {
                "positive": ["happy", "calm", "relaxed", "peaceful", "content", "joyful", "good"],
                "neutral": ["okay", "normal", "fine", "alright"],
                "negative": ["anxious", "upset", "angry", "frustrated", "sad", "nervous", "worried"]
            },
            "hi": {
                "positive": ["खुश", "शांत", "प्रसन्न", "अच्छा", "संतुष्ट"],
                "neutral": ["ठीक", "सामान्य"],
                "negative": ["चिंतित", "परेशान", "गुस्सा", "दुखी", "घबराया"]
            },
            "ta": {
                "positive": ["மகிழ்ச்சி", "அமைதி", "நிம்மதி"],
                "neutral": ["சரி", "சாதாரண"],
                "negative": ["கவலை", "கோபம்", "வருத்தம்"]
            }
            # Add more languages as needed
        }
        
        # Intensity keywords
        self.intensity_keywords = {
            "en": {
                "low": ["mild", "slight", "little", "minor", "calm"],
                "moderate": ["moderate", "medium", "some", "regular"],
                "high": ["severe", "intense", "extreme", "major", "very", "really"]
            },
            "hi": {
                "low": ["हल्का", "थोड़ा", "कम"],
                "moderate": ["मध्यम", "सामान्य"],
                "high": ["गंभीर", "तीव्र", "बहुत"]
            }
        }
    
    def detect_language(self, text: str) -> str:
        """
        Detect language of input text
        
        In production, use:
        - langdetect
        - Azure Text Analytics
        - Google Cloud Translation API
        """
        # Simple heuristic - check for non-ASCII characters
        if re.search(r'[\u0900-\u097F]', text):  # Devanagari
            return "hi"
        if re.search(r'[\u0B80-\u0BFF]', text):  # Tamil
            return "ta"
        if re.search(r'[\u0C00-\u0C7F]', text):  # Telugu
            return "te"
        if re.search(r'[\u0980-\u09FF]', text):  # Bengali
            return "bn"
        
        return "en"
    
    def extract_emotions_from_text(self, text: str, language: str = None) -> List[str]:
        """Extract emotion keywords from text"""
        if not text:
            return []
        
        text_lower = text.lower()
        if language is None:
            language = self.detect_language(text)
        
        keywords = self.emotion_keywords.get(language, self.emotion_keywords["en"])
        detected_emotions = []
        
        for category, words in keywords.items():
            for word in words:
                if word.lower() in text_lower:
                    detected_emotions.append(category)
                    break
        
        return detected_emotions or ["neutral"]
    
    def extract_intensity_from_text(self, text: str, language: str = None) -> str:
        """Extract intensity level from text"""
        if not text:
            return "moderate"
        
        text_lower = text.lower()
        if language is None:
            language = self.detect_language(text)
        
        keywords = self.intensity_keywords.get(language, self.intensity_keywords["en"])
        
        # Check for high intensity first
        for word in keywords.get("high", []):
            if word.lower() in text_lower:
                return "high"
        
        for word in keywords.get("low", []):
            if word.lower() in text_lower:
                return "low"
        
        return "moderate"
    
    def normalize_text(self, text: str) -> str:
        """Normalize text for consistent processing"""
        if not text:
            return ""
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text.strip())
        
        # Remove special characters but keep letters across scripts
        text = re.sub(r'[^\w\s\u0900-\u0D7F]', '', text)
        
        return text


class FeatureEncoder:
    """
    Encode raw inputs into numeric feature vectors
    """
    
    # Emotion to score mapping (0 = very negative, 1 = very positive)
    EMOTION_SCORES = {
        "angry": 0.1,
        "frustrated": 0.2,
        "upset": 0.2,
        "sad": 0.25,
        "anxious": 0.3,
        "worried": 0.3,
        "nervous": 0.35,
        "neutral": 0.5,
        "okay": 0.5,
        "calm": 0.7,
        "relaxed": 0.75,
        "content": 0.8,
        "happy": 0.9,
        "joyful": 0.95,
        "positive": 0.8,
        "negative": 0.2
    }
    
    # Intensity to score mapping (0 = calm, 1 = intense)
    INTENSITY_SCORES = {
        "low": 0.2,
        "moderate": 0.5,
        "high": 0.8
    }
    
    # Activity types and their typical energy levels
    ACTIVITY_ENERGY = {
        "sleep": 0.0,
        "rest": 0.1,
        "quiet_play": 0.3,
        "reading": 0.2,
        "screen_time": 0.2,
        "therapy": 0.5,
        "arts": 0.4,
        "music": 0.4,
        "outdoor_play": 0.8,
        "sports": 0.9,
        "exercise": 0.85,
        "social": 0.6
    }
    
    def calculate_sleep_hours(
        self, 
        sleep_start: Optional[str], 
        sleep_end: Optional[str]
    ) -> float:
        """Calculate sleep duration in hours"""
        if not sleep_start or not sleep_end:
            return 8.0  # Default assumption
        
        try:
            start = datetime.strptime(sleep_start, "%H:%M")
            end = datetime.strptime(sleep_end, "%H:%M")
            
            # Handle overnight sleep
            if end < start:
                end = end.replace(day=2)
                start = start.replace(day=1)
            
            hours = (end - start).seconds / 3600
            return max(0, min(24, hours))  # Clamp to valid range
        except:
            return 8.0
    
    def calculate_activity_level(self, activities: Optional[List[Dict]]) -> float:
        """
        Calculate normalized activity level from activities
        Returns 0-1 where 1 is highly active
        """
        if not activities:
            return 0.5  # Default moderate
        
        total_energy = 0.0
        total_duration = 0.0
        
        for activity in activities:
            activity_type = activity.get("type", "").lower().replace(" ", "_")
            duration = float(activity.get("duration", 30))  # Minutes
            
            energy = self.ACTIVITY_ENERGY.get(activity_type, 0.5)
            total_energy += energy * duration
            total_duration += duration
        
        if total_duration == 0:
            return 0.5
        
        return min(1.0, total_energy / total_duration)
    
    def calculate_emotion_score(self, emotions: Optional[List[str]]) -> float:
        """
        Calculate aggregate emotion score
        Returns 0-1 where 1 is most positive
        """
        if not emotions:
            return 0.5
        
        scores = []
        for emotion in emotions:
            emotion_lower = emotion.lower()
            score = self.EMOTION_SCORES.get(emotion_lower, 0.5)
            scores.append(score)
        
        return np.mean(scores) if scores else 0.5
    
    def calculate_behaviour_score(
        self, 
        intensity: Optional[str],
        notes: Optional[str] = None
    ) -> float:
        """
        Calculate behaviour calmness score
        Returns 0-1 where 1 is most calm
        """
        if not intensity:
            intensity = "moderate"
        
        intensity_score = self.INTENSITY_SCORES.get(intensity.lower(), 0.5)
        
        # Invert: low intensity = high calmness
        calmness = 1.0 - intensity_score
        
        return calmness


class DataPreprocessor:
    """
    Main preprocessing pipeline
    Converts raw daily inputs into ML-ready feature vectors
    """
    
    def __init__(self, config: PipelineConfig = None):
        self.config = config or get_config()
        self.voice_processor = VoiceToTextProcessor(config)
        self.text_processor = MultilingualTextProcessor(config)
        self.feature_encoder = FeatureEncoder()
    
    def process_single_entry(self, raw_input: RawDailyInput) -> ProcessedDailyVector:
        """
        Process a single daily entry into a feature vector
        """
        # Step 1: Process voice note if present
        combined_notes = raw_input.behaviour_notes or ""
        if raw_input.voice_note_text:
            combined_notes += " " + raw_input.voice_note_text
        
        # Step 2: Normalize text
        combined_notes = self.text_processor.normalize_text(combined_notes)
        
        # Step 3: Extract additional signals from text
        text_emotions = self.text_processor.extract_emotions_from_text(
            combined_notes, raw_input.language
        )
        text_intensity = self.text_processor.extract_intensity_from_text(
            combined_notes, raw_input.language
        )
        
        # Step 4: Combine explicit and extracted data
        all_emotions = list(raw_input.emotions or []) + text_emotions
        final_intensity = raw_input.behaviour_intensity or text_intensity
        
        # Step 5: Encode features
        sleep_hours = self.feature_encoder.calculate_sleep_hours(
            raw_input.sleep_start, raw_input.sleep_end
        )
        
        activity_level = self.feature_encoder.calculate_activity_level(
            raw_input.activities
        )
        
        emotion_score = self.feature_encoder.calculate_emotion_score(all_emotions)
        
        behaviour_score = self.feature_encoder.calculate_behaviour_score(
            final_intensity, combined_notes
        )
        
        medication_flag = 1 if raw_input.medication_taken else 0
        
        # Step 6: Create processed vector
        return ProcessedDailyVector(
            child_id=raw_input.child_id,
            date=raw_input.date,
            sleep_hours=round(sleep_hours, 2),
            activity_level=round(activity_level, 3),
            emotion_score=round(emotion_score, 3),
            behaviour_score=round(behaviour_score, 3),
            medication_flag=medication_flag,
            raw_notes=combined_notes if combined_notes else None,
            metadata={
                "language": raw_input.language,
                "emotions_detected": all_emotions,
                "intensity_level": final_intensity,
                "processed_at": datetime.now().isoformat()
            }
        )
    
    def process_batch(
        self, 
        raw_inputs: List[RawDailyInput]
    ) -> List[ProcessedDailyVector]:
        """Process multiple daily entries"""
        return [self.process_single_entry(inp) for inp in raw_inputs]
    
    def to_dataframe(
        self, 
        vectors: List[ProcessedDailyVector]
    ) -> pd.DataFrame:
        """Convert processed vectors to DataFrame for ML"""
        data = []
        for v in vectors:
            data.append({
                "child_id": v.child_id,
                "date": v.date,
                "sleep_hours": v.sleep_hours,
                "activity_level": v.activity_level,
                "emotion_score": v.emotion_score,
                "behaviour_score": v.behaviour_score,
                "medication_flag": v.medication_flag
            })
        
        df = pd.DataFrame(data)
        if not df.empty:
            df["date"] = pd.to_datetime(df["date"])
            df = df.sort_values(["child_id", "date"])
        
        return df
    
    def from_database_rows(
        self, 
        routine_entries: List[Dict],
        behavior_entries: List[Dict]
    ) -> pd.DataFrame:
        """
        Convert database entries to ML-ready DataFrame
        Joins routine and behavior entries by child_id and date
        """
        # Process routine entries
        routine_df = pd.DataFrame(routine_entries) if routine_entries else pd.DataFrame()
        behavior_df = pd.DataFrame(behavior_entries) if behavior_entries else pd.DataFrame()
        
        if routine_df.empty and behavior_df.empty:
            return pd.DataFrame()
        
        # Aggregate routine data by child and date
        if not routine_df.empty:
            routine_agg = self._aggregate_routines(routine_df)
        else:
            routine_agg = pd.DataFrame()
        
        # Aggregate behavior data by child and date
        if not behavior_df.empty:
            behavior_agg = self._aggregate_behaviors(behavior_df)
        else:
            behavior_agg = pd.DataFrame()
        
        # Merge on child_id and date
        if not routine_agg.empty and not behavior_agg.empty:
            merged = pd.merge(
                routine_agg, behavior_agg,
                on=["child_id", "date"],
                how="outer"
            )
        elif not routine_agg.empty:
            merged = routine_agg
        else:
            merged = behavior_agg
        
        # Fill missing values with defaults
        merged = merged.fillna({
            "sleep_hours": 8.0,
            "activity_level": 0.5,
            "emotion_score": 0.5,
            "behaviour_score": 0.5,
            "medication_flag": 0
        })
        
        return merged.sort_values(["child_id", "date"])
    
    def _aggregate_routines(self, routine_df: pd.DataFrame) -> pd.DataFrame:
        """Aggregate routine entries by child and date"""
        # Calculate sleep hours from sleep-type entries
        sleep_entries = routine_df[routine_df["type"] == "sleep"].copy()
        
        if not sleep_entries.empty and "start_time" in sleep_entries.columns:
            sleep_entries["sleep_hours"] = sleep_entries.apply(
                lambda row: self.feature_encoder.calculate_sleep_hours(
                    str(row.get("start_time", "")),
                    str(row.get("end_time", ""))
                ),
                axis=1
            )
            sleep_agg = sleep_entries.groupby(["child_id", "date"]).agg({
                "sleep_hours": "sum"
            }).reset_index()
        else:
            sleep_agg = pd.DataFrame(columns=["child_id", "date", "sleep_hours"])
        
        # Calculate activity level from activity-type entries
        activity_entries = routine_df[routine_df["type"] == "activity"].copy()
        
        if not activity_entries.empty:
            activity_entries["activity_level"] = 0.6  # Default moderate
            activity_agg = activity_entries.groupby(["child_id", "date"]).agg({
                "activity_level": "mean"
            }).reset_index()
        else:
            activity_agg = pd.DataFrame(columns=["child_id", "date", "activity_level"])
        
        # Merge sleep and activity
        if not sleep_agg.empty and not activity_agg.empty:
            return pd.merge(sleep_agg, activity_agg, on=["child_id", "date"], how="outer")
        elif not sleep_agg.empty:
            return sleep_agg
        else:
            return activity_agg
    
    def _aggregate_behaviors(self, behavior_df: pd.DataFrame) -> pd.DataFrame:
        """Aggregate behavior entries by child and date"""
        result = []
        
        for (child_id, date_val), group in behavior_df.groupby(["child_id", "date"]):
            emotions = group["emotion"].tolist() if "emotion" in group.columns else []
            intensities = group["intensity"].tolist() if "intensity" in group.columns else []
            
            emotion_score = self.feature_encoder.calculate_emotion_score(emotions)
            
            # Average behaviour score from intensities
            behaviour_scores = [
                self.feature_encoder.calculate_behaviour_score(i) 
                for i in intensities
            ]
            behaviour_score = np.mean(behaviour_scores) if behaviour_scores else 0.5
            
            result.append({
                "child_id": child_id,
                "date": date_val,
                "emotion_score": emotion_score,
                "behaviour_score": behaviour_score
            })
        
        return pd.DataFrame(result)


# Example usage
if __name__ == "__main__":
    preprocessor = DataPreprocessor()
    
    # Sample raw input
    raw = RawDailyInput(
        child_id="child_123",
        date="2024-01-15",
        sleep_start="21:00",
        sleep_end="07:00",
        activities=[
            {"type": "outdoor_play", "duration": 45},
            {"type": "therapy", "duration": 60}
        ],
        emotions=["calm", "anxious"],
        behaviour_intensity="moderate",
        medication_taken=True,
        behaviour_notes="Had a good morning but got slightly nervous before therapy",
        language="en"
    )
    
    # Process
    vector = preprocessor.process_single_entry(raw)
    
    print("Processed Vector:")
    print(f"  Sleep Hours: {vector.sleep_hours}")
    print(f"  Activity Level: {vector.activity_level}")
    print(f"  Emotion Score: {vector.emotion_score}")
    print(f"  Behaviour Score: {vector.behaviour_score}")
    print(f"  Medication Flag: {vector.medication_flag}")
    print(f"  Metadata: {vector.metadata}")
