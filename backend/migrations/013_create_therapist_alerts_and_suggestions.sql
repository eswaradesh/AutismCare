-- Migration: Create therapist alert review, activity suggestions, and appointments
-- Run this in Supabase SQL Editor

-- Create table for therapist to review behavior alerts
CREATE TABLE public.behavior_alert_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES public.behavior_alerts(id) ON DELETE CASCADE NOT NULL,
    therapist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    parent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    response_note TEXT,
    acknowledged BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (alert_id, therapist_id)
);

-- Create table for therapist activity suggestions
CREATE TABLE public.therapist_activity_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    parent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
    activity_title TEXT NOT NULL,
    description TEXT,
    related_pattern TEXT, -- e.g., "early sleep", "transition anxiety"
    suggested_frequency TEXT, -- e.g., "daily", "when needed"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for appointment bookings
CREATE TABLE public.therapist_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    day_of_week TEXT NOT NULL, -- 'monday', 'tuesday', etc.
    start_time TEXT NOT NULL, -- HH:MM format
    end_time TEXT NOT NULL,
    slot_duration_minutes INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    parent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time TEXT NOT NULL, -- HH:MM format
    duration_minutes INTEGER DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for automatic intensity alerts
CREATE TABLE public.behavior_intensity_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
    therapist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    consecutive_high_count INTEGER NOT NULL,
    last_high_entry_id UUID REFERENCES public.behavior_entries(id),
    alert_sent_at TIMESTAMP WITH TIME ZONE,
    acknowledged BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE public.behavior_alert_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_activity_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_intensity_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for behavior_alert_reviews
CREATE POLICY "Therapists can view their alert reviews"
    ON public.behavior_alert_reviews FOR SELECT
    USING (auth.uid() = therapist_id OR auth.uid() = parent_id);

CREATE POLICY "Therapists can create and update their reviews"
    ON public.behavior_alert_reviews FOR INSERT
    WITH CHECK (auth.uid() = therapist_id);

CREATE POLICY "Therapists can update their own reviews"
    ON public.behavior_alert_reviews FOR UPDATE
    USING (auth.uid() = therapist_id)
    WITH CHECK (auth.uid() = therapist_id);

-- RLS Policies for therapist_activity_suggestions
CREATE POLICY "Therapists and parents can view suggestions"
    ON public.therapist_activity_suggestions FOR SELECT
    USING (auth.uid() = therapist_id OR auth.uid() = parent_id);

CREATE POLICY "Therapists can create suggestions"
    ON public.therapist_activity_suggestions FOR INSERT
    WITH CHECK (auth.uid() = therapist_id);

CREATE POLICY "Therapists can update their suggestions"
    ON public.therapist_activity_suggestions FOR UPDATE
    USING (auth.uid() = therapist_id)
    WITH CHECK (auth.uid() = therapist_id);

-- RLS Policies for therapist_availability
CREATE POLICY "Therapists can manage their availability"
    ON public.therapist_availability FOR ALL
    USING (auth.uid() = therapist_id)
    WITH CHECK (auth.uid() = therapist_id);

CREATE POLICY "Parents can view verified therapist availability"
    ON public.therapist_availability FOR SELECT
    USING (is_active = true);

-- RLS Policies for appointments
CREATE POLICY "Therapists and parents can view appointments"
    ON public.appointments FOR SELECT
    USING (auth.uid() = therapist_id OR auth.uid() = parent_id);

CREATE POLICY "Parents can create appointments"
    ON public.appointments FOR INSERT
    WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Therapists and parents can update appointments"
    ON public.appointments FOR UPDATE
    USING (auth.uid() = therapist_id OR auth.uid() = parent_id);

-- RLS Policies for behavior_intensity_alerts
CREATE POLICY "Therapists can view alerts for their shared children"
    ON public.behavior_intensity_alerts FOR SELECT
    USING (
        auth.uid() = therapist_id OR
        auth.uid() = parent_id
    );

CREATE POLICY "System can create intensity alerts"
    ON public.behavior_intensity_alerts FOR INSERT
    WITH CHECK (true);
