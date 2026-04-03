"""
AutismCare ML Module: Appointment Scheduling Optimizer
Optimizes appointment scheduling based on availability, child behavior patterns, and therapist preferences
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime, time, timedelta


@dataclass
class TherapistSlot:
    """Available appointment slot"""
    therapist_id: str
    day_of_week: str
    start_time: str
    end_time: str
    duration_minutes: int
    availability_id: str


@dataclass
class AppointmentPreference:
    """Parent's preferences for scheduling"""
    preferred_days: List[str]
    preferred_time_of_day: str  # 'morning', 'afternoon', 'evening'
    min_notice_days: int
    max_appointments_per_week: int
    avoid_times: List[str]


@dataclass
class ChildBehaviorProfile:
    """Child's behavior patterns affecting scheduling"""
    optimal_times: List[str]  # Times when child is most regulated
    difficult_times: List[str]  # Times of high dysregulation
    transition_sensitivity: float  # 0-1, how sensitive to schedule changes
    morning_readiness: float  # 0-1, alertness/readiness in morning
    afternoon_energy: float  # 0-1, energy level in afternoon


@dataclass
class ScheduledAppointment:
    """ML-optimized appointment"""
    therapist_id: str
    scheduled_date: str
    scheduled_time: str
    duration_minutes: int
    confidence_score: float
    optimization_factors: Dict[str, float]
    reasoning: str


class AppointmentSchedulingOptimizer:
    """
    ML model to optimize appointment scheduling
    Considers therapist availability, child behavior patterns, and parent preferences
    """
    
    def __init__(self):
        self.optimal_session_minutes = 30
        self.days_of_week = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    
    def detect_child_behavior_profile(
        self,
        behavior_entries: List[Dict]
    ) -> ChildBehaviorProfile:
        """
        Detect optimal and difficult times for appointments based on behavior
        
        Args:
            behavior_entries: List of behavior log entries
        
        Returns:
            Profile of child's behavior patterns by time of day
        """
        # Categorize behaviors by hour
        morning_behaviors = []  # 6-12
        afternoon_behaviors = []  # 12-18
        evening_behaviors = []  # 18-23
        
        for entry in behavior_entries:
            try:
                time_str = entry.get('created_at', '').split('T')[1]
                hour = int(time_str.split(':')[0])
                emotion = entry.get('emotion', '').lower()
                intensity = entry.get('intensity', '').lower()
                
                # Score: higher is better (calmer, more regulated)
                emotion_score = self._emotion_to_score(emotion)
                intensity_score = 1.0 - self._intensity_to_score(intensity)
                behavior_score = (emotion_score + intensity_score) / 2
                
                if 6 <= hour < 12:
                    morning_behaviors.append(behavior_score)
                elif 12 <= hour < 18:
                    afternoon_behaviors.append(behavior_score)
                else:
                    evening_behaviors.append(behavior_score)
            except:
                pass
        
        # Calculate averages
        morning_avg = np.mean(morning_behaviors) if morning_behaviors else 0.5
        afternoon_avg = np.mean(afternoon_behaviors) if afternoon_behaviors else 0.5
        evening_avg = np.mean(evening_behaviors) if evening_behaviors else 0.5
        
        # Determine optimal times (highest scores)
        optimal_times = []
        if morning_avg >= afternoon_avg and morning_avg >= evening_avg:
            optimal_times.extend(['9:00am', '10:00am', '10:30am'])
        if afternoon_avg >= morning_avg and afternoon_avg >= evening_avg:
            optimal_times.extend(['2:00pm', '3:00pm', '3:30pm'])
        if evening_avg >= morning_avg and evening_avg >= afternoon_avg:
            optimal_times.extend(['5:00pm', '5:30pm', '6:00pm'])
        
        # Difficult times (lowest scores)
        difficult_times = []
        if morning_avg <= 0.4:
            difficult_times.extend(['6:30am', '7:00am', '8:00am'])
        if afternoon_avg <= 0.4:
            difficult_times.extend(['1:00pm', '2:00pm'])
        if evening_avg <= 0.4:
            difficult_times.extend(['7:00pm', '8:00pm', '9:00pm'])
        
        return ChildBehaviorProfile(
            optimal_times=optimal_times if optimal_times else ['10:00am', '3:00pm'],
            difficult_times=difficult_times if difficult_times else [],
            transition_sensitivity=0.7,  # Default medium sensitivity
            morning_readiness=morning_avg,
            afternoon_energy=afternoon_avg
        )
    
    def find_optimal_slots(
        self,
        available_slots: List[TherapistSlot],
        parent_preference: AppointmentPreference,
        child_profile: ChildBehaviorProfile,
        desired_date: datetime
    ) -> List[ScheduledAppointment]:
        """
        Find optimal appointment slots considering all factors
        
        Args:
            available_slots: Therapist availability slots
            parent_preference: Parent's preferences
            child_profile: Child's behavior patterns
            desired_date: Preferred date for appointment
        
        Returns:
            Ranked list of optimal appointment options
        """
        candidates = []
        
        for slot in available_slots:
            # Check if slot matches parent preferences
            slot_match_score = self._calculate_slot_match(
                slot, parent_preference, desired_date
            )
            
            if slot_match_score < 0.3:  # Below minimum threshold
                continue
            
            # Check if time is optimal for child
            time_quality_score = self._calculate_time_quality(
                slot.start_time, child_profile
            )
            
            # Check if date/time matches parent preferences
            date_score = self._calculate_date_compatibility(
                slot, desired_date, parent_preference
            )
            
            # Combine scores
            confidence = (
                slot_match_score * 0.3 +
                time_quality_score * 0.4 +
                date_score * 0.3
            )
            
            optimization_factors = {
                'slot_match': slot_match_score,
                'time_quality': time_quality_score,
                'date_compatibility': date_score
            }
            
            reasoning = self._generate_reasoning(
                slot, optimization_factors, child_profile, parent_preference
            )
            
            appointment = ScheduledAppointment(
                therapist_id=slot.therapist_id,
                scheduled_date=desired_date.strftime('%Y-%m-%d'),
                scheduled_time=slot.start_time,
                duration_minutes=slot.duration_minutes,
                confidence_score=confidence,
                optimization_factors=optimization_factors,
                reasoning=reasoning
            )
            candidates.append(appointment)
        
        # Sort by confidence and return top options
        candidates.sort(key=lambda x: x.confidence_score, reverse=True)
        return candidates[:3]  # Return top 3 options
    
    def _calculate_slot_match(
        self,
        slot: TherapistSlot,
        preference: AppointmentPreference,
        desired_date: datetime
    ) -> float:
        """Calculate how well slot matches parent preferences"""
        score = 0.5  # Base score
        
        # Check day of week preference
        day_name = self.days_of_week[desired_date.weekday()]
        if day_name in preference.preferred_days:
            score += 0.25
        
        # Check time of day preference
        time_quality = self._get_time_of_day_category(slot.start_time)
        if time_quality == preference.preferred_time_of_day:
            score += 0.25
        
        # Check avoid times
        if slot.start_time not in preference.avoid_times:
            score += 0.10
        
        return min(1.0, score)
    
    def _calculate_time_quality(
        self,
        slot_time: str,
        child_profile: ChildBehaviorProfile
    ) -> float:
        """Calculate suitability of time for child"""
        # Check if in optimal times
        if slot_time in child_profile.optimal_times:
            return 0.9
        
        # Check if in difficult times
        if slot_time in child_profile.difficult_times:
            return 0.3
        
        # Neutral/moderate time
        return 0.6
    
    def _calculate_date_compatibility(
        self,
        slot: TherapistSlot,
        desired_date: datetime,
        preference: AppointmentPreference
    ) -> float:
        """Calculate how compatible the date is"""
        # Check if we have enough notice
        days_notice = (desired_date - datetime.now()).days
        if days_notice >= preference.min_notice_days:
            notice_score = 0.8
        else:
            notice_score = 0.4
        
        # Check if day of week matches
        day_name = self.days_of_week[desired_date.weekday()]
        day_score = 1.0 if day_name in preference.preferred_days else 0.6
        
        return (notice_score + day_score) / 2
    
    def _get_time_of_day_category(self, time_str: str) -> str:
        """Categorize time into morning/afternoon/evening"""
        try:
            hour = int(time_str.split(':')[0])
            if 6 <= hour < 12:
                return 'morning'
            elif 12 <= hour < 17:
                return 'afternoon'
            else:
                return 'evening'
        except:
            return 'afternoon'
    
    def _emotion_to_score(self, emotion: str) -> float:
        """Convert emotion to behavior quality score (0-1)"""
        emotion_scores = {
            'happy': 0.9,
            'calm': 0.85,
            'content': 0.8,
            'anxious': 0.4,
            'upset': 0.2,
            'angry': 0.1
        }
        return emotion_scores.get(emotion, 0.5)
    
    def _intensity_to_score(self, intensity: str) -> float:
        """Convert intensity to difficulty score (0-1)"""
        intensity_scores = {
            'low': 0.2,
            'moderate': 0.5,
            'high': 0.9
        }
        return intensity_scores.get(intensity, 0.5)
    
    def _generate_reasoning(
        self,
        slot: TherapistSlot,
        factors: Dict[str, float],
        child_profile: ChildBehaviorProfile,
        parent_preference: AppointmentPreference
    ) -> str:
        """Generate explanation for why this slot is recommended"""
        reasons = []
        
        if factors['slot_match'] > 0.6:
            reasons.append("Matches your preferred day/time")
        
        if factors['time_quality'] > 0.7:
            reasons.append("Optimal time based on child's typical behavior")
        
        if factors['date_compatibility'] > 0.7:
            reasons.append("Appropriate scheduling notice")
        
        return "; ".join(reasons) if reasons else "Available appointment"
    
    def avoid_clustering(
        self,
        existing_appointments: List[Dict],
        new_appointment_date: datetime,
        max_per_week: int
    ) -> bool:
        """Check if scheduling another appointment would exceed frequency limits"""
        week_start = new_appointment_date - timedelta(days=new_appointment_date.weekday())
        week_end = week_start + timedelta(days=6)
        
        appointments_this_week = [
            a for a in existing_appointments
            if week_start <= datetime.fromisoformat(a['scheduled_date']) <= week_end
        ]
        
        return len(appointments_this_week) < max_per_week


# Example usage
if __name__ == "__main__":
    optimizer = AppointmentSchedulingOptimizer()
    
    # Sample available slots
    slots = [
        TherapistSlot(
            therapist_id="therapist_1",
            day_of_week="monday",
            start_time="09:00",
            end_time="09:30",
            duration_minutes=30,
            availability_id="avail_1"
        ),
        TherapistSlot(
            therapist_id="therapist_1",
            day_of_week="tuesday",
            start_time="15:00",
            end_time="15:30",
            duration_minutes=30,
            availability_id="avail_2"
        ),
    ]
    
    # Sample behavior entries
    behaviors = [
        {'emotion': 'calm', 'intensity': 'low', 'created_at': '2025-02-08T10:00:00'},
        {'emotion': 'upset', 'intensity': 'high', 'created_at': '2025-02-08T08:00:00'},
    ]
    
    # Detect child profile
    profile = optimizer.detect_child_behavior_profile(behaviors)
    print(f"Optimal times for appointments: {profile.optimal_times}")
    
    # Get preferences
    pref = AppointmentPreference(
        preferred_days=['tuesday', 'wednesday', 'thursday'],
        preferred_time_of_day='afternoon',
        min_notice_days=2,
        max_appointments_per_week=2,
        avoid_times=['8:00am', '9:00am']
    )
    
    # Find optimal slots
    appointments = optimizer.find_optimal_slots(
        slots, pref, profile, datetime.now() + timedelta(days=3)
    )
    
    print("\nOptimal appointment options:")
    for apt in appointments:
        print(f"  {apt.scheduled_date} at {apt.scheduled_time}")
        print(f"    Confidence: {apt.confidence_score:.0%}")
        print(f"    Reason: {apt.reasoning}")
