"""
AutismCare ML Module: Behavior Alert Analysis & Severity Prediction
Analyzes sudden behavior alerts and predicts severity/priority for therapists
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
import json


@dataclass
class BehaviorAlert:
    """Represents a behavior alert event"""
    alert_id: str
    child_id: str
    emotion: str
    intensity: str  # 'low', 'moderate', 'high'
    notes: str
    created_at: datetime
    is_sudden_change: bool


@dataclass
class AlertPriority:
    """ML-predicted alert priority and explanation"""
    alert_id: str
    priority_score: float  # 0-1, higher = more urgent
    priority_level: str  # 'low', 'medium', 'high', 'critical'
    severity_indicators: List[str]
    recommendation: str
    confidence: float


class BehaviorAlertAnalyzer:
    """
    ML model to analyze behavior alerts and predict priority/severity
    Uses pattern recognition, temporal analysis, and intensity trends
    """
    
    def __init__(self):
        self.emotion_weights = {
            'happy': 0.1,
            'calm': 0.2,
            'anxious': 0.6,
            'upset': 0.8,
            'angry': 0.9,
        }
        
        self.intensity_weights = {
            'low': 0.2,
            'moderate': 0.5,
            'high': 0.9,
        }
    
    def analyze_alert_priority(
        self,
        alert: BehaviorAlert,
        recent_alerts: List[BehaviorAlert],
        baseline_intensity: float = 0.3
    ) -> AlertPriority:
        """
        Analyze a single alert and predict its priority
        
        Args:
            alert: The current alert to analyze
            recent_alerts: Last 7-14 days of alerts for context
            baseline_intensity: Baseline intensity from historical data
        
        Returns:
            AlertPriority with score, level, and recommendations
        """
        
        # 1. Calculate base severity from current alert
        emotion_score = self.emotion_weights.get(alert.emotion.lower(), 0.5)
        intensity_score = self.intensity_weights.get(alert.intensity.lower(), 0.5)
        base_severity = (emotion_score + intensity_score) / 2
        
        # 2. Detect escalation pattern (if intensity is increasing)
        escalation_score = self._detect_escalation(alert, recent_alerts)
        
        # 3. Detect frequency clustering (multiple alerts in short time)
        clustering_score = self._detect_clustering(alert, recent_alerts)
        
        # 4. Detect time-of-day patterns (certain times more concerning)
        time_pattern_score = self._detect_time_pattern(alert, recent_alerts)
        
        # 5. Detect emotional volatility
        volatility_score = self._detect_volatility(recent_alerts)
        
        # Combine scores with weights
        priority_score = (
            base_severity * 0.35 +
            escalation_score * 0.25 +
            clustering_score * 0.20 +
            time_pattern_score * 0.10 +
            volatility_score * 0.10
        )
        
        # Determine severity indicators
        severity_indicators = self._identify_indicators(
            alert, recent_alerts, escalation_score,
            clustering_score, volatility_score
        )
        
        # Determine priority level
        priority_level = self._score_to_level(priority_score)
        
        # Generate recommendation
        recommendation = self._generate_recommendation(
            priority_level, severity_indicators, alert
        )
        
        # Calculate confidence (higher with more context data)
        confidence = min(0.95, 0.6 + len(recent_alerts) * 0.05)
        
        return AlertPriority(
            alert_id=alert.alert_id,
            priority_score=priority_score,
            priority_level=priority_level,
            severity_indicators=severity_indicators,
            recommendation=recommendation,
            confidence=confidence
        )
    
    def _detect_escalation(
        self,
        current_alert: BehaviorAlert,
        recent_alerts: List[BehaviorAlert]
    ) -> float:
        """Detect if behavior is escalating in intensity"""
        if len(recent_alerts) < 2:
            return 0.0
        
        # Get last 5 alerts ordered by time
        recent = sorted(recent_alerts, key=lambda x: x.created_at)[-5:]
        
        # Map intensities to scores
        intensities = [
            self.intensity_weights.get(a.intensity.lower(), 0.5)
            for a in recent
        ]
        
        # Calculate trend
        if len(intensities) >= 2:
            diffs = np.diff(intensities)
            trend = np.mean(diffs) if len(diffs) > 0 else 0
            escalation = max(0, min(1, trend * 0.5 + 0.3))
        else:
            escalation = 0.0
        
        return escalation
    
    def _detect_clustering(
        self,
        current_alert: BehaviorAlert,
        recent_alerts: List[BehaviorAlert]
    ) -> float:
        """Detect if alerts are clustering in time"""
        # Alerts within 24 hours = high concern
        day_ago = current_alert.created_at - timedelta(hours=24)
        alerts_last_24h = [a for a in recent_alerts if a.created_at > day_ago]
        
        clustering = min(0.9, len(alerts_last_24h) * 0.2)
        return clustering
    
    def _detect_time_pattern(
        self,
        current_alert: BehaviorAlert,
        recent_alerts: List[BehaviorAlert]
    ) -> float:
        """Detect concerning time-of-day patterns"""
        current_hour = current_alert.created_at.hour
        
        # High-risk times: night transitions (8-11pm, 5-7am), school transitions (7-9am)
        high_risk_hours = [19, 20, 21, 22, 5, 6, 7, 8, 9]
        
        if current_hour in high_risk_hours:
            return 0.4
        
        # Check if repeated at same time
        same_time_alerts = [
            a for a in recent_alerts
            if a.created_at.hour == current_hour
        ]
        
        if len(same_time_alerts) >= 2:
            return 0.5
        
        return 0.1
    
    def _detect_volatility(self, recent_alerts: List[BehaviorAlert]) -> float:
        """Detect emotional volatility (rapid emotion changes)"""
        if len(recent_alerts) < 3:
            return 0.0
        
        # Get emotions in chronological order
        recent = sorted(recent_alerts, key=lambda x: x.created_at)[-5:]
        emotions = [a.emotion.lower() for a in recent]
        
        # Calculate number of emotion changes
        changes = sum(1 for i in range(len(emotions)-1) if emotions[i] != emotions[i+1])
        
        # High volatility = frequent changes
        volatility = min(0.8, changes * 0.2)
        return volatility
    
    def _identify_indicators(
        self,
        alert: BehaviorAlert,
        recent_alerts: List[BehaviorAlert],
        escalation: float,
        clustering: float,
        volatility: float
    ) -> List[str]:
        """Identify specific indicators contributing to priority"""
        indicators = []
        
        if alert.intensity.lower() == 'high':
            indicators.append("High intensity behavior")
        
        if alert.emotion.lower() in ['angry', 'upset']:
            indicators.append("Negative emotion detected")
        
        if escalation > 0.5:
            indicators.append("Escalating pattern")
        
        if clustering > 0.4:
            indicators.append("Frequent alerts in short time")
        
        if volatility > 0.5:
            indicators.append("Emotional volatility")
        
        if alert.is_sudden_change:
            indicators.append("Sudden unexpected change")
        
        return indicators
    
    def _score_to_level(self, score: float) -> str:
        """Convert score to priority level"""
        if score >= 0.8:
            return "critical"
        elif score >= 0.6:
            return "high"
        elif score >= 0.4:
            return "medium"
        else:
            return "low"
    
    def _generate_recommendation(
        self,
        priority_level: str,
        indicators: List[str],
        alert: BehaviorAlert
    ) -> str:
        """Generate actionable recommendation for therapist"""
        if priority_level == "critical":
            return "Immediate review recommended. Consider reaching out to parent for support details."
        elif priority_level == "high":
            return "Priority review. Correlate with recent routines/triggers and discuss patterns with parent."
        elif priority_level == "medium":
            return "Review and note patterns. May suggest activity or routine adjustments."
        else:
            return "Monitor trend. Log for baseline comparison."
    
    def batch_analyze_alerts(
        self,
        alerts: List[BehaviorAlert],
        baseline_intensity: float = 0.3
    ) -> List[AlertPriority]:
        """Analyze multiple alerts and rank by priority"""
        priorities = []
        
        for i, alert in enumerate(alerts):
            # Use all previous alerts as context
            context = alerts[:i]
            priority = self.analyze_alert_priority(alert, context, baseline_intensity)
            priorities.append(priority)
        
        # Sort by priority score (highest first)
        priorities.sort(key=lambda x: x.priority_score, reverse=True)
        
        return priorities


# Example usage
if __name__ == "__main__":
    analyzer = BehaviorAlertAnalyzer()
    
    # Sample alerts
    alerts = [
        BehaviorAlert(
            alert_id="alert_1",
            child_id="child_123",
            emotion="calm",
            intensity="low",
            notes="Normal behavior",
            created_at=datetime.now() - timedelta(days=2),
            is_sudden_change=False
        ),
        BehaviorAlert(
            alert_id="alert_2",
            child_id="child_123",
            emotion="anxious",
            intensity="moderate",
            notes="Slightly anxious during transition",
            created_at=datetime.now() - timedelta(hours=6),
            is_sudden_change=False
        ),
        BehaviorAlert(
            alert_id="alert_3",
            child_id="child_123",
            emotion="upset",
            intensity="high",
            notes="Sudden outburst, very upset",
            created_at=datetime.now(),
            is_sudden_change=True
        ),
    ]
    
    # Analyze alerts
    priorities = analyzer.batch_analyze_alerts(alerts)
    
    for priority in priorities:
        print(f"\nAlert {priority.alert_id}:")
        print(f"  Priority: {priority.priority_level} (score: {priority.priority_score:.2f})")
        print(f"  Indicators: {', '.join(priority.severity_indicators)}")
        print(f"  Recommendation: {priority.recommendation}")
        print(f"  Confidence: {priority.confidence:.0%}")
