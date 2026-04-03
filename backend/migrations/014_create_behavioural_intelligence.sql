-- Migration: Create behavioural intelligence tables
-- Run this AFTER existing migrations (014)
-- Adds tables for ML baseline, anomaly tracking, and analysis results

-- =====================================================
-- Table: child_baselines
-- Stores personalized behavioral baselines per child
-- =====================================================

CREATE TABLE IF NOT EXISTS public.child_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Baseline values (mean)
    baseline_sleep DECIMAL(4,2) NOT NULL DEFAULT 8.0,
    baseline_activity DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    baseline_emotion DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    baseline_behaviour DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    
    -- Baseline standard deviations
    baseline_sleep_std DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    baseline_activity_std DECIMAL(5,4) NOT NULL DEFAULT 0.2,
    baseline_emotion_std DECIMAL(5,4) NOT NULL DEFAULT 0.2,
    baseline_behaviour_std DECIMAL(5,4) NOT NULL DEFAULT 0.2,
    
    -- Cluster information
    cluster_label INTEGER,
    cluster_profile TEXT,
    
    -- Metadata
    data_points_used INTEGER NOT NULL DEFAULT 0,
    date_range_start DATE,
    date_range_end DATE,
    confidence DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    is_valid BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one baseline per child
    UNIQUE(child_id)
);

-- Enable RLS
ALTER TABLE public.child_baselines ENABLE ROW LEVEL SECURITY;

-- RLS Policies (access via child_profiles ownership)
CREATE POLICY "Users can view own child baselines"
ON public.child_baselines FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.child_profiles cp 
    WHERE cp.id = child_baselines.child_id 
    AND cp.user_id = auth.uid()
));

CREATE POLICY "System can manage baselines"
ON public.child_baselines FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Index
CREATE INDEX idx_child_baselines_child_id ON public.child_baselines(child_id);

-- =====================================================
-- Table: daily_analysis_results
-- Stores ML analysis outputs per child per day
-- =====================================================

CREATE TABLE IF NOT EXISTS public.daily_analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
    analysis_date DATE NOT NULL,
    
    -- Core metrics
    anomaly_score DECIMAL(4,3) NOT NULL DEFAULT 0.0,
    confidence DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    forecast_trend TEXT CHECK (forecast_trend IN ('likely_increase', 'possible_stability', 'may_reduce')),
    
    -- Processed input features
    sleep_hours DECIMAL(4,2),
    activity_level DECIMAL(5,4),
    emotion_score DECIMAL(5,4),
    behaviour_score DECIMAL(5,4),
    medication_flag BOOLEAN DEFAULT FALSE,
    
    -- Baseline deviation z-scores
    sleep_z DECIMAL(5,2),
    activity_z DECIMAL(5,2),
    emotion_z DECIMAL(5,2),
    behaviour_z DECIMAL(5,2),
    
    -- Explanation
    explanation TEXT,
    contributing_factors JSONB,
    
    -- Alert info
    is_anomaly BOOLEAN DEFAULT FALSE,
    alert_triggered BOOLEAN DEFAULT FALSE,
    alert_severity TEXT CHECK (alert_severity IN ('low', 'medium', 'high') OR alert_severity IS NULL),
    alert_message TEXT,
    consecutive_anomaly_days INTEGER DEFAULT 0,
    
    -- Forecast details
    forecast_1_day JSONB,
    forecast_3_day JSONB,
    forecast_7_day JSONB,
    
    -- Model info
    model_versions JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- One analysis per child per day
    UNIQUE(child_id, analysis_date)
);

-- Enable RLS
ALTER TABLE public.daily_analysis_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own child analysis"
ON public.daily_analysis_results FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.child_profiles cp 
    WHERE cp.id = daily_analysis_results.child_id 
    AND cp.user_id = auth.uid()
));

CREATE POLICY "System can manage analysis results"
ON public.daily_analysis_results FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Indexes
CREATE INDEX idx_daily_analysis_child_id ON public.daily_analysis_results(child_id);
CREATE INDEX idx_daily_analysis_date ON public.daily_analysis_results(analysis_date);
CREATE INDEX idx_daily_analysis_anomaly ON public.daily_analysis_results(is_anomaly) 
    WHERE is_anomaly = TRUE;
CREATE INDEX idx_daily_analysis_alert ON public.daily_analysis_results(alert_triggered) 
    WHERE alert_triggered = TRUE;

-- =====================================================
-- Table: correlation_analyses
-- Stores routine-behavior correlation results
-- =====================================================

CREATE TABLE IF NOT EXISTS public.correlation_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Analysis metadata
    target_column TEXT NOT NULL DEFAULT 'behaviour_score',
    model_type TEXT NOT NULL DEFAULT 'random_forest',
    r_squared DECIMAL(4,3),
    cross_val_score DECIMAL(4,3),
    samples_used INTEGER NOT NULL DEFAULT 0,
    
    -- Results
    top_influencing_factor TEXT,
    summary_explanation TEXT,
    feature_importances JSONB,
    
    -- Confidence
    confidence DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- One per child (latest)
    UNIQUE(child_id)
);

-- Enable RLS
ALTER TABLE public.correlation_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own child correlations"
ON public.correlation_analyses FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.child_profiles cp 
    WHERE cp.id = correlation_analyses.child_id 
    AND cp.user_id = auth.uid()
));

CREATE POLICY "System can manage correlations"
ON public.correlation_analyses FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Index
CREATE INDEX idx_correlation_child_id ON public.correlation_analyses(child_id);

-- =====================================================
-- Table: ml_alerts
-- Stores behavioral alerts triggered by ML
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ml_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Alert details
    alert_type TEXT NOT NULL CHECK (alert_type IN ('threshold_exceeded', 'persistent_pattern')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    message TEXT NOT NULL,
    
    -- Analysis reference
    analysis_id UUID REFERENCES public.daily_analysis_results(id) ON DELETE SET NULL,
    analysis_date DATE NOT NULL,
    
    -- Metrics at time of alert
    anomaly_score DECIMAL(4,3) NOT NULL,
    confidence DECIMAL(5,2) NOT NULL,
    consecutive_days INTEGER NOT NULL DEFAULT 1,
    
    -- Contributing factors
    contributing_factors JSONB,
    recommended_action TEXT,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES auth.users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ml_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own child alerts"
ON public.ml_alerts FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.child_profiles cp 
    WHERE cp.id = ml_alerts.child_id 
    AND cp.user_id = auth.uid()
));

CREATE POLICY "Users can acknowledge own child alerts"
ON public.ml_alerts FOR UPDATE
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.child_profiles cp 
    WHERE cp.id = ml_alerts.child_id 
    AND cp.user_id = auth.uid()
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.child_profiles cp 
    WHERE cp.id = ml_alerts.child_id 
    AND cp.user_id = auth.uid()
));

CREATE POLICY "System can manage alerts"
ON public.ml_alerts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Indexes
CREATE INDEX idx_ml_alerts_child_id ON public.ml_alerts(child_id);
CREATE INDEX idx_ml_alerts_date ON public.ml_alerts(analysis_date);
CREATE INDEX idx_ml_alerts_unread ON public.ml_alerts(is_read) WHERE is_read = FALSE;
CREATE INDEX idx_ml_alerts_severity ON public.ml_alerts(severity);

-- =====================================================
-- Triggers for updated_at
-- =====================================================

CREATE TRIGGER update_child_baselines_updated_at
    BEFORE UPDATE ON public.child_baselines
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_analysis_updated_at
    BEFORE UPDATE ON public.daily_analysis_results
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_correlation_analyses_updated_at
    BEFORE UPDATE ON public.correlation_analyses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Views for easy querying
-- =====================================================

-- Recent alerts view
CREATE OR REPLACE VIEW public.recent_ml_alerts AS
SELECT 
    ma.*,
    cp.name as child_name
FROM public.ml_alerts ma
JOIN public.child_profiles cp ON cp.id = ma.child_id
WHERE ma.created_at > NOW() - INTERVAL '7 days'
ORDER BY ma.created_at DESC;

-- Child analysis summary view
CREATE OR REPLACE VIEW public.child_analysis_summary AS
SELECT 
    cp.id as child_id,
    cp.name as child_name,
    cb.baseline_sleep,
    cb.baseline_behaviour,
    cb.confidence as baseline_confidence,
    dar.analysis_date as last_analysis_date,
    dar.anomaly_score as last_anomaly_score,
    dar.forecast_trend as last_forecast,
    ca.top_influencing_factor,
    (SELECT COUNT(*) FROM public.ml_alerts ma 
     WHERE ma.child_id = cp.id AND ma.is_read = FALSE) as unread_alerts
FROM public.child_profiles cp
LEFT JOIN public.child_baselines cb ON cb.child_id = cp.id
LEFT JOIN LATERAL (
    SELECT * FROM public.daily_analysis_results 
    WHERE child_id = cp.id 
    ORDER BY analysis_date DESC 
    LIMIT 1
) dar ON true
LEFT JOIN public.correlation_analyses ca ON ca.child_id = cp.id;

-- =====================================================
-- Grant access to authenticated role
-- =====================================================

GRANT SELECT ON public.recent_ml_alerts TO authenticated;
GRANT SELECT ON public.child_analysis_summary TO authenticated;
