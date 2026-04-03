"""
AutismCare ML Module: Activity Suggestion Generator
Generates personalized activity suggestions based on behavior patterns and trends
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
from collections import Counter


@dataclass
class BehaviorPattern:
    """Represents a detected behavior pattern"""
    pattern_name: str
    description: str
    examples: List[str]
    frequency: int
    confidence: float


@dataclass
class ActivitySuggestion:
    """ML-generated activity suggestion"""
    activity_title: str
    description: str
    related_pattern: str
    suggested_frequency: str
    confidence: float
    reasoning: str
    expected_benefit: str


class ActivitySuggestionGenerator:
    """
    ML model to generate personalized activity suggestions
    Based on detected behavior patterns, triggers, and historical effectiveness
    """
    
    # Database of evidence-based activities for autism support
    ACTIVITY_DATABASE = {
        'early_sleep': [
            {
                'title': 'Quiet Wind-Down Routine',
                'description': 'Consistent 30-min routine before bedtime: dim lights, soft music, calming activity',
                'frequency': 'Daily',
                'benefit_score': 0.85
            },
            {
                'title': 'Sensory Deep Pressure',
                'description': 'Weighted blanket or deep pressure massage before sleep',
                'frequency': 'Daily at bedtime',
                'benefit_score': 0.80
            },
            {
                'title': 'Blue Light Reduction',
                'description': 'Avoid screens 1 hour before sleep, use blue light blocking glasses if needed',
                'frequency': 'Daily',
                'benefit_score': 0.75
            }
        ],
        'transition_anxiety': [
            {
                'title': 'Visual Schedule Review',
                'description': 'Review upcoming transitions with visual schedule or social story',
                'frequency': '15 min before transitions',
                'benefit_score': 0.82
            },
            {
                'title': 'Transition Warning System',
                'description': '5-min, 2-min, 1-min verbal/visual warnings before activity change',
                'frequency': 'For all transitions',
                'benefit_score': 0.88
            },
            {
                'title': 'Comfort Object During Transition',
                'description': 'Allow child to hold favorite toy or comfort item during transition',
                'frequency': 'As needed',
                'benefit_score': 0.70
            }
        ],
        'sensory_seeking': [
            {
                'title': 'Structured Sensory Breaks',
                'description': 'Scheduled sensory activities: swinging, jumping, spinning, texture play',
                'frequency': '2-3 times daily',
                'benefit_score': 0.87
            },
            {
                'title': 'Proprioceptive Input Activities',
                'description': 'Heavy work activities: pushing, pulling, weighted activities',
                'frequency': 'Daily',
                'benefit_score': 0.84
            },
            {
                'title': 'Fidget Toy Rotation',
                'description': 'Variety of fidget tools available during demanding tasks',
                'frequency': 'As needed',
                'benefit_score': 0.72
            }
        ],
        'emotional_regulation': [
            {
                'title': 'Emotion Regulation Breathing',
                'description': 'Teach simple breathing exercises: deep breathing, bubble blowing',
                'frequency': 'When starting to dysregulate',
                'benefit_score': 0.79
            },
            {
                'title': 'Calm Corner/Safe Space',
                'description': 'Designated quiet space with preferred items to self-regulate',
                'frequency': 'Available always',
                'benefit_score': 0.81
            },
            {
                'title': 'Preferred Activity Reward',
                'description': 'Use highly preferred activity as reward and regulation tool',
                'frequency': '1-2 times daily',
                'benefit_score': 0.78
            }
        ],
        'social_engagement': [
            {
                'title': 'Joint Attention Activities',
                'description': 'Activities focused on shared attention: turn-taking games, parallel play',
                'frequency': '2-3 times daily',
                'benefit_score': 0.76
            },
            {
                'title': 'Social Story Integration',
                'description': 'Use stories to teach social skills and expected behaviors',
                'frequency': '3-4 times weekly',
                'benefit_score': 0.73
            },
            {
                'title': 'Peer Play Practice',
                'description': 'Structured interactions with peers in controlled settings',
                'frequency': '2 times weekly',
                'benefit_score': 0.74
            }
        ]
    }
    
    def __init__(self):
        self.emotion_to_pattern = {
            'upset': ['emotional_regulation', 'sensory_seeking'],
            'anxious': ['transition_anxiety', 'emotional_regulation'],
            'angry': ['emotional_regulation', 'sensory_seeking'],
            'calm': ['social_engagement'],
            'happy': ['social_engagement']
        }
    
    def detect_behavior_patterns(
        self,
        behavior_entries: List[Dict],
        routine_entries: List[Dict],
        time_window_days: int = 30
    ) -> List[BehaviorPattern]:
        """
        Detect behavior patterns from historical data
        
        Args:
            behavior_entries: List of behavior log entries
            routine_entries: List of routine log entries
            time_window_days: Days of history to analyze
        
        Returns:
            List of detected patterns with confidence scores
        """
        patterns = []
        cutoff_date = datetime.now() - timedelta(days=time_window_days)
        
        # Filter recent entries
        recent_behaviors = [
            b for b in behavior_entries
            if datetime.fromisoformat(b.get('created_at', '1970-01-01')) > cutoff_date
        ]
        recent_routines = [
            r for r in routine_entries
            if datetime.fromisoformat(r.get('created_at', '1970-01-01')) > cutoff_date
        ]
        
        # Pattern 1: Early sleep detection
        early_sleep_count = self._count_pattern(recent_routines, 'sleep', before_time='21:00')
        if early_sleep_count > len(recent_routines) * 0.3:
            patterns.append(BehaviorPattern(
                pattern_name='early_sleep',
                description='Child tends to sleep earlier than typical schedule',
                examples=['Sleeping before 9 PM', 'Routine sleep changes'],
                frequency=early_sleep_count,
                confidence=0.75
            ))
        
        # Pattern 2: Transition anxiety
        transition_anxious = [
            b for b in recent_behaviors
            if b.get('emotion', '').lower() in ['anxious', 'upset']
            and self._near_transition_time(b.get('created_at', ''), recent_routines)
        ]
        if len(transition_anxious) > len(recent_behaviors) * 0.2:
            patterns.append(BehaviorPattern(
                pattern_name='transition_anxiety',
                description='Anxiety or upset before/during activity transitions',
                examples=['Morning rushed time', 'School to home transition'],
                frequency=len(transition_anxious),
                confidence=0.70
            ))
        
        # Pattern 3: Sensory seeking
        high_energy_behaviors = [
            b for b in recent_behaviors
            if any(b.get('notes', '').lower().count(word) > 0
                   for word in ['movement', 'running', 'jumping', 'spinning', 'active'])
        ]
        if len(high_energy_behaviors) > len(recent_behaviors) * 0.25:
            patterns.append(BehaviorPattern(
                pattern_name='sensory_seeking',
                description='Child seeks out sensory input and high-energy activities',
                examples=['Frequent movement', 'Seeking stimulation'],
                frequency=len(high_energy_behaviors),
                confidence=0.68
            ))
        
        # Pattern 4: Emotional regulation challenges
        upset_behaviors = [b for b in recent_behaviors if b.get('emotion', '').lower() in ['upset', 'angry']]
        if len(upset_behaviors) > len(recent_behaviors) * 0.2:
            patterns.append(BehaviorPattern(
                pattern_name='emotional_regulation',
                description='Difficulty with emotional regulation and control',
                examples=['Frequent upset periods', 'Anger outbursts'],
                frequency=len(upset_behaviors),
                confidence=0.72
            ))
        
        # Pattern 5: Social engagement
        calm_behaviors = [b for b in recent_behaviors if b.get('emotion', '').lower() in ['calm', 'happy']]
        if len(calm_behaviors) > len(recent_behaviors) * 0.5:
            patterns.append(BehaviorPattern(
                pattern_name='social_engagement',
                description='Child shows calm, engaged behavior with social opportunities',
                examples=['Happy during interaction', 'Calm play periods'],
                frequency=len(calm_behaviors),
                confidence=0.80
            ))
        
        return sorted(patterns, key=lambda x: x.confidence, reverse=True)
    
    def generate_suggestions(
        self,
        patterns: List[BehaviorPattern],
        top_n: int = 5
    ) -> List[ActivitySuggestion]:
        """
        Generate activity suggestions based on detected patterns
        
        Args:
            patterns: Detected behavior patterns
            top_n: Number of suggestions to return
        
        Returns:
            Ranked list of activity suggestions
        """
        suggestions = []
        
        for pattern in patterns:
            pattern_activities = self.ACTIVITY_DATABASE.get(pattern.pattern_name, [])
            
            for activity in pattern_activities:
                suggestion = ActivitySuggestion(
                    activity_title=activity['title'],
                    description=activity['description'],
                    related_pattern=pattern.pattern_name.replace('_', ' ').title(),
                    suggested_frequency=activity['frequency'],
                    confidence=min(0.99, pattern.confidence * activity['benefit_score']),
                    reasoning=f"Based on detected {pattern.pattern_name.replace('_', ' ')} pattern (detected in {pattern.frequency} instances)",
                    expected_benefit=self._get_benefit_description(pattern.pattern_name, activity['benefit_score'])
                )
                suggestions.append(suggestion)
        
        # Sort by confidence and return top N
        suggestions.sort(key=lambda x: x.confidence, reverse=True)
        return suggestions[:top_n]
    
    def _count_pattern(
        self,
        entries: List[Dict],
        entry_type: str,
        before_time: Optional[str] = None
    ) -> int:
        """Count entries matching a pattern"""
        count = 0
        for entry in entries:
            if entry.get('type') == entry_type:
                if before_time:
                    entry_time = entry.get('created_at', '').split('T')[1] if 'T' in entry.get('created_at', '') else '00:00'
                    if entry_time < before_time:
                        count += 1
                else:
                    count += 1
        return count
    
    def _near_transition_time(self, entry_time: str, routines: List[Dict]) -> bool:
        """Check if entry is near a routine transition time"""
        # Transition times: morning (6-9am), afternoon (2-4pm), evening (5-7pm)
        try:
            time_part = entry_time.split('T')[1] if 'T' in entry_time else '00:00'
            hour = int(time_part.split(':')[0])
            return hour in [6, 7, 8, 9, 14, 15, 16, 17, 18]
        except:
            return False
    
    def _get_benefit_description(self, pattern: str, benefit_score: float) -> str:
        """Generate description of expected benefit"""
        benefit_level = 'high' if benefit_score > 0.8 else 'moderate' if benefit_score > 0.7 else 'potential'
        return f"Research indicates {benefit_level} effectiveness for addressing {pattern.replace('_', ' ')} patterns"
    
    def personalize_suggestions(
        self,
        suggestions: List[ActivitySuggestion],
        child_profile: Dict,
        therapist_notes: List[str]
    ) -> List[ActivitySuggestion]:
        """
        Personalize suggestions based on child profile and therapist feedback
        
        Args:
            suggestions: Base activity suggestions
            child_profile: Child's profile data (sensory preference, communication level, etc.)
            therapist_notes: Any notes from previous interactions
        
        Returns:
            Personalized and re-ranked suggestions
        """
        personalized = []
        
        for suggestion in suggestions:
            # Adjust confidence based on child profile
            relevance_boost = 0.0
            
            sensory_pref = child_profile.get('sensory_preference', '').lower()
            if sensory_pref and (sensory_pref in suggestion.description.lower()):
                relevance_boost += 0.1
            
            # Check against therapist notes
            if therapist_notes:
                for note in therapist_notes:
                    if any(word in suggestion.activity_title.lower() for word in note.lower().split()):
                        relevance_boost += 0.05
            
            # Update confidence
            updated_suggestion = ActivitySuggestion(
                activity_title=suggestion.activity_title,
                description=suggestion.description,
                related_pattern=suggestion.related_pattern,
                suggested_frequency=suggestion.suggested_frequency,
                confidence=min(0.99, suggestion.confidence + relevance_boost),
                reasoning=suggestion.reasoning,
                expected_benefit=suggestion.expected_benefit
            )
            personalized.append(updated_suggestion)
        
        # Re-sort by updated confidence
        personalized.sort(key=lambda x: x.confidence, reverse=True)
        return personalized


# Example usage
if __name__ == "__main__":
    generator = ActivitySuggestionGenerator()
    
    # Sample data
    behaviors = [
        {'emotion': 'anxious', 'created_at': '2025-02-08T08:30:00'},
        {'emotion': 'upset', 'created_at': '2025-02-08T08:45:00'},
        {'emotion': 'calm', 'created_at': '2025-02-08T10:00:00'},
    ]
    
    routines = [
        {'type': 'sleep', 'created_at': '2025-02-07T20:30:00'},
        {'type': 'school', 'created_at': '2025-02-08T08:00:00'},
    ]
    
    # Detect patterns
    patterns = generator.detect_behavior_patterns(behaviors, routines)
    print("Detected Patterns:")
    for p in patterns:
        print(f"  - {p.pattern_name}: {p.confidence:.0%} confidence")
    
    # Generate suggestions
    suggestions = generator.generate_suggestions(patterns, top_n=5)
    print("\nActivity Suggestions:")
    for s in suggestions:
        print(f"  - {s.activity_title}")
        print(f"    Related to: {s.related_pattern}")
        print(f"    Confidence: {s.confidence:.0%}")
