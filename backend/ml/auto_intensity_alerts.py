"""
AutismCare ML Module: Automatic Intensity Alert Detector
Monitors behavior intensity trends and automatically triggers alerts for sustained high-intensity patterns
"""

import numpy as np
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
from collections import deque


@dataclass
class IntensityReading:
    """A single behavior intensity measurement"""
    entry_id: str
    timestamp: datetime
    intensity: str  # 'low', 'moderate', 'high'
    emotion: str
    is_sudden_change: bool
    
    def to_score(self) -> float:
        """Convert to numeric score for analysis"""
        intensity_map = {'low': 0.2, 'moderate': 0.5, 'high': 0.9}
        return intensity_map.get(self.intensity, 0.5)


@dataclass
class AutoAlert:
    """Automatically triggered intensity alert"""
    child_id: str
    parent_id: str
    therapist_ids: List[str]
    alert_type: str  # 'sustained_high', 'rapid_escalation', 'volatile_pattern'
    severity: str  # 'moderate', 'high', 'critical'
    consecutive_high_count: int
    time_span_minutes: int
    confidence: float
    triggered_at: datetime
    last_entry_id: str
    recommendation: str
    raw_score: float


class AutoIntensityAlertDetector:
    """
    ML model for automatically detecting and alerting about high-intensity behavior patterns
    Uses real-time sliding window analysis to detect concerning trends
    """
    
    def __init__(
        self,
        high_intensity_threshold: str = 'high',
        consecutive_count_threshold: int = 3,
        time_window_minutes: int = 60,
        min_confidence: float = 0.65
    ):
        """
        Initialize detector with threshold parameters
        
        Args:
            high_intensity_threshold: What counts as 'high' ('moderate' or 'high')
            consecutive_count_threshold: How many consecutive highs trigger alert
            time_window_minutes: Time span to consider as "consecutive"
            min_confidence: Minimum confidence to trigger alert
        """
        self.high_threshold = high_intensity_threshold
        self.consecutive_threshold = consecutive_count_threshold
        self.window_minutes = time_window_minutes
        self.min_confidence = min_confidence
        
        # Sliding windows per child (for real-time detection)
        self.active_windows: Dict[str, deque] = {}
    
    def analyze_single_entry(
        self,
        entry: Dict,
        child_id: str,
        parent_id: str,
        therapist_ids: List[str],
        recent_entries: Optional[List[Dict]] = None
    ) -> Optional[AutoAlert]:
        """
        Analyze a single new behavior entry for auto-alert triggers
        
        Args:
            entry: New behavior entry
            child_id: Child ID
            parent_id: Parent ID
            therapist_ids: List of connected therapist IDs
            recent_entries: Optional recent entries for context (last 24 hours)
        
        Returns:
            AutoAlert if conditions met, else None
        """
        try:
            # Parse current entry
            intensity = entry.get('intensity', '').lower()
            emotion = entry.get('emotion', '').lower()
            timestamp = datetime.fromisoformat(entry.get('created_at', datetime.now().isoformat()))
            entry_id = entry.get('id', '')
            is_sudden = entry.get('is_sudden_change', False)
            
            # Initialize window for this child if needed
            if child_id not in self.active_windows:
                self.active_windows[child_id] = deque()
            
            # Create reading
            reading = IntensityReading(
                entry_id=entry_id,
                timestamp=timestamp,
                intensity=intensity,
                emotion=emotion,
                is_sudden_change=is_sudden
            )
            
            # Add to sliding window
            self.active_windows[child_id].append(reading)
            
            # Clean old entries outside window
            cutoff_time = timestamp - timedelta(minutes=self.window_minutes)
            while self.active_windows[child_id] and self.active_windows[child_id][0].timestamp < cutoff_time:
                self.active_windows[child_id].popleft()
            
            # Check window against thresholds
            alert = self._check_window_for_alert(
                child_id, parent_id, therapist_ids, reading
            )
            
            # If no alert from window, check larger trend
            if not alert and recent_entries:
                alert = self._check_trend_escalation(
                    child_id, parent_id, therapist_ids, reading, recent_entries
                )
            
            return alert
            
        except Exception as e:
            print(f"Error analyzing entry: {e}")
            return None
    
    def _check_window_for_alert(
        self,
        child_id: str,
        parent_id: str,
        therapist_ids: List[str],
        current_reading: IntensityReading
    ) -> Optional[AutoAlert]:
        """Check sliding window for alert conditions"""
        window = self.active_windows.get(child_id, deque())
        
        if len(window) == 0:
            return None
        
        # Convert window to scores
        scores = [r.to_score() for r in window]
        
        # Condition 1: Consecutive high-intensity readings
        consecutive_highs = self._count_consecutive_high(window)
        
        if consecutive_highs >= self.consecutive_threshold:
            time_span = self._get_window_timespan(window)
            confidence = self._calculate_confidence(
                alert_type='sustained_high',
                consecutive_count=consecutive_highs,
                time_span_minutes=time_span,
                has_sudden=current_reading.is_sudden_change
            )
            
            if confidence >= self.min_confidence:
                return AutoAlert(
                    child_id=child_id,
                    parent_id=parent_id,
                    therapist_ids=therapist_ids,
                    alert_type='sustained_high',
                    severity=self._determine_severity(consecutive_highs, time_span),
                    consecutive_high_count=consecutive_highs,
                    time_span_minutes=time_span,
                    confidence=confidence,
                    triggered_at=datetime.now(),
                    last_entry_id=current_reading.entry_id,
                    recommendation=self._get_recommendation('sustained_high', consecutive_highs),
                    raw_score=np.mean(scores)
                )
        
        # Condition 2: Rapid intensity escalation
        escalation_score = self._detect_rapid_escalation(scores)
        if escalation_score > 0.7:
            time_span = self._get_window_timespan(window)
            confidence = self._calculate_confidence(
                alert_type='rapid_escalation',
                escalation_score=escalation_score,
                time_span_minutes=time_span
            )
            
            if confidence >= self.min_confidence:
                return AutoAlert(
                    child_id=child_id,
                    parent_id=parent_id,
                    therapist_ids=therapist_ids,
                    alert_type='rapid_escalation',
                    severity='high',
                    consecutive_high_count=consecutive_highs,
                    time_span_minutes=time_span,
                    confidence=confidence,
                    triggered_at=datetime.now(),
                    last_entry_id=current_reading.entry_id,
                    recommendation=self._get_recommendation('rapid_escalation', consecutive_highs),
                    raw_score=escalation_score
                )
        
        # Condition 3: High emotional volatility
        volatility_score = self._detect_emotional_volatility(window)
        if volatility_score > 0.6:
            confidence = self._calculate_confidence(
                alert_type='volatile_pattern',
                volatility_score=volatility_score
            )
            
            if confidence >= self.min_confidence:
                time_span = self._get_window_timespan(window)
                return AutoAlert(
                    child_id=child_id,
                    parent_id=parent_id,
                    therapist_ids=therapist_ids,
                    alert_type='volatile_pattern',
                    severity='moderate',
                    consecutive_high_count=consecutive_highs,
                    time_span_minutes=time_span,
                    confidence=confidence,
                    triggered_at=datetime.now(),
                    last_entry_id=current_reading.entry_id,
                    recommendation=self._get_recommendation('volatile_pattern', consecutive_highs),
                    raw_score=volatility_score
                )
        
        return None
    
    def _check_trend_escalation(
        self,
        child_id: str,
        parent_id: str,
        therapist_ids: List[str],
        current_reading: IntensityReading,
        recent_entries: List[Dict]
    ) -> Optional[AutoAlert]:
        """Check for concerning trends over 24+ hours"""
        # Convert entries to readings
        recent_readings = []
        for entry in recent_entries[-20:]:  # Last 20 entries
            try:
                recent_readings.append(IntensityReading(
                    entry_id=entry.get('id', ''),
                    timestamp=datetime.fromisoformat(entry.get('created_at', '')),
                    intensity=entry.get('intensity', '').lower(),
                    emotion=entry.get('emotion', '').lower(),
                    is_sudden_change=entry.get('is_sudden_change', False)
                ))
            except:
                pass
        
        if len(recent_readings) < 5:
            return None
        
        # Calculate trend
        scores = [r.to_score() for r in recent_readings]
        high_percentage = sum(1 for s in scores if s > 0.7) / len(scores)
        
        # If more than 50% of entries are high-intensity
        if high_percentage > 0.5:
            consecutive = sum(1 for s in scores[-5:] if s > 0.7)
            if consecutive >= 2:
                confidence = min(0.95, 0.6 + high_percentage * 0.3)
                
                if confidence >= self.min_confidence:
                    return AutoAlert(
                        child_id=child_id,
                        parent_id=parent_id,
                        therapist_ids=therapist_ids,
                        alert_type='sustained_high',
                        severity='high',
                        consecutive_high_count=consecutive,
                        time_span_minutes=1440,  # 24 hours
                        confidence=confidence,
                        triggered_at=datetime.now(),
                        last_entry_id=current_reading.entry_id,
                        recommendation="Sustained high-intensity pattern over 24 hours. Reach out to parent for support assessment.",
                        raw_score=high_percentage
                    )
        
        return None
    
    def _count_consecutive_high(self, readings: deque) -> int:
        """Count consecutive high-intensity entries from end"""
        count = 0
        for reading in reversed(readings):
            if reading.intensity == self.high_threshold or (self.high_threshold == 'moderate' and reading.to_score() > 0.5):
                count += 1
            else:
                break
        return count
    
    def _detect_rapid_escalation(self, scores: List[float]) -> float:
        """Detect rapid increase in intensity scores"""
        if len(scores) < 3:
            return 0.0
        
        # Calculate differences
        diffs = np.diff(scores[-5:] if len(scores) > 5 else scores)
        
        # High positive differences = escalation
        positive_diffs = [d for d in diffs if d > 0]
        
        if len(positive_diffs) == 0:
            return 0.0
        
        escalation_rate = np.mean(positive_diffs)
        return min(1.0, escalation_rate * 2)
    
    def _detect_emotional_volatility(self, readings: deque) -> float:
        """Detect rapid emotion changes"""
        if len(readings) < 3:
            return 0.0
        
        emotions = [r.emotion for r in readings]
        changes = sum(1 for i in range(len(emotions)-1) if emotions[i] != emotions[i+1])
        
        volatility = min(1.0, changes / len(emotions))
        return volatility
    
    def _get_window_timespan(self, readings: deque) -> int:
        """Get timespan covered by window in minutes"""
        if len(readings) < 2:
            return 0
        
        first_time = readings[0].timestamp
        last_time = readings[-1].timestamp
        delta = last_time - first_time
        
        return int(delta.total_seconds() / 60)
    
    def _calculate_confidence(
        self,
        alert_type: str,
        **kwargs
    ) -> float:
        """Calculate confidence score for alert"""
        if alert_type == 'sustained_high':
            consecutive = kwargs.get('consecutive_count', 0)
            time_span = kwargs.get('time_span_minutes', 0)
            has_sudden = kwargs.get('has_sudden', False)
            
            # More consecutive = more confident
            confidence = 0.5 + (min(consecutive, 5) / 5) * 0.3
            
            # Shorter timespan = more confidence
            if time_span < 30:
                confidence += 0.1
            elif time_span < 60:
                confidence += 0.05
            
            # Sudden change increases confidence
            if has_sudden:
                confidence += 0.1
            
            return min(0.99, confidence)
        
        elif alert_type == 'rapid_escalation':
            escalation = kwargs.get('escalation_score', 0)
            return min(0.95, 0.5 + escalation * 0.3)
        
        elif alert_type == 'volatile_pattern':
            volatility = kwargs.get('volatility_score', 0)
            return min(0.85, 0.5 + volatility * 0.25)
        
        return 0.5
    
    def _determine_severity(self, consecutive_count: int, time_span_minutes: int) -> str:
        """Determine alert severity"""
        if consecutive_count >= 5 or (time_span_minutes < 30 and consecutive_count >= 4):
            return 'critical'
        elif consecutive_count >= 4 or (time_span_minutes < 60 and consecutive_count >= 3):
            return 'high'
        else:
            return 'moderate'
    
    def _get_recommendation(self, alert_type: str, consecutive_count: int) -> str:
        """Generate recommendation for therapist"""
        if alert_type == 'sustained_high':
            return f"{consecutive_count} consecutive high-intensity behaviors detected. Consider contacting parent to assess triggers and provide support strategies."
        elif alert_type == 'rapid_escalation':
            return "Rapid intensity escalation detected. Urgent contact with parent recommended to identify triggers and intervene."
        elif alert_type == 'volatile_pattern':
            return "Significant emotional volatility detected. Suggest calming strategies and environmental assessment with parent."
        return "Monitor child closely for pattern changes."


# Example usage
if __name__ == "__main__":
    detector = AutoIntensityAlertDetector(
        high_intensity_threshold='high',
        consecutive_count_threshold=3,
        time_window_minutes=60
    )
    
    # Simulate behavior entries
    now = datetime.now()
    entries = [
        {
            'id': f'entry_{i}',
            'intensity': 'high' if i >= 2 else 'moderate',
            'emotion': 'upset' if i >= 2 else 'anxious',
            'created_at': (now - timedelta(minutes=30-i*10)).isoformat(),
            'is_sudden_change': i == 3
        }
        for i in range(5)
    ]
    
    # Check for alerts
    print("Analyzing behavior entries for auto-alerts:\n")
    for i, entry in enumerate(entries):
        alert = detector.analyze_single_entry(
            entry,
            child_id='child_123',
            parent_id='parent_456',
            therapist_ids=['therapist_1', 'therapist_2'],
            recent_entries=entries[:i+1]
        )
        
        if alert:
            print(f"Entry {i}: AUTO-ALERT TRIGGERED!")
            print(f"  Type: {alert.alert_type}")
            print(f"  Severity: {alert.severity}")
            print(f"  Confidence: {alert.confidence:.0%}")
            print(f"  Recommendation: {alert.recommendation}\n")
        else:
            print(f"Entry {i}: No alert\n")
