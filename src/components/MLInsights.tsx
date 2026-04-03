
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { mlService } from '@/lib/ml';
import { buildBaseline, calculateConfidence, predictBehaviorTendencies } from '@/lib/analytics';
import { Card } from '@/components/ui/card';
import { Sparkles, Brain, Activity, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO } from 'date-fns';

/** Transform frontend camelCase entries to snake_case for ML backend */
function toSnakeCaseRoutines(entries: any[]): any[] {
    return entries.map(e => ({
        child_id: e.child_id,
        date: e.date,
        type: e.type,
        start_time: e.startTime || e.start_time || null,
        end_time: e.endTime || e.end_time || null,
        notes: e.notes || null,
    }));
}

function toSnakeCaseBehaviors(entries: any[]): any[] {
    return entries.map(e => ({
        child_id: e.child_id,
        date: e.date,
        emotion: e.emotion,
        intensity: e.intensity,
        trigger: e.trigger || null,
        notes: e.notes || null,
        is_sudden: e.isSudden || e.is_sudden || false,
    }));
}

const MLInsights = () => {
    const { childProfile } = useAuth();
    const { routineEntries, behaviorEntries, isLoading: isDataLoading } = useData();

    const [status, setStatus] = useState<'idle' | 'initializing' | 'ready' | 'error' | 'offline' | 'fallback'>('idle');
    const [baseline, setBaseline] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Client-side fallback analytics (always computed when data is available)
    const clientBaseline = useMemo(() => {
        if (routineEntries.length === 0 && behaviorEntries.length === 0) return null;
        const bl = buildBaseline(routineEntries, behaviorEntries, 30);
        const dates = new Set([...routineEntries.map(r => r.date), ...behaviorEntries.map(b => b.date)]);
        const daysOfData = dates.size;
        const confidence = calculateConfidence(bl.dataPoints, daysOfData);
        const prediction = (routineEntries.length > 0 || behaviorEntries.length > 0)
            ? predictBehaviorTendencies(routineEntries, behaviorEntries, 30)
            : null;
        return { ...bl, confidence, daysOfData, prediction };
    }, [routineEntries, behaviorEntries]);

    useEffect(() => {
        if (!childProfile?.id || isDataLoading) return;

        if (routineEntries.length === 0 && behaviorEntries.length === 0) {
            setStatus('idle');
            return;
        }

        const initML = async () => {
            setStatus('initializing');
            try {
                const health = await mlService.healthCheck();
                if (!health) {
                    // ML service offline — use client-side fallback
                    setStatus('fallback');
                    return;
                }

                const initRes = await mlService.initializeChildRaw(
                    childProfile.id!,
                    toSnakeCaseRoutines(routineEntries),
                    toSnakeCaseBehaviors(behaviorEntries)
                );

                if (initRes.status === 'error') {
                    throw new Error(initRes.message);
                }

                if (initRes.baseline) {
                    setBaseline(initRes.baseline);
                }

                setStatus('ready');
            } catch (err: any) {
                console.warn("ML Init — falling back to client analytics:", err.message);
                setStatus('fallback');
            }
        };

        initML();
    }, [childProfile?.id, isDataLoading, routineEntries.length, behaviorEntries.length]);

    // Nothing to show
    if (status === 'idle') return null;
    if ((status === 'fallback' || status === 'offline') && !clientBaseline) return null;

    const showMLBaseline = status === 'ready' && baseline;
    const showFallback = (status === 'fallback' || status === 'offline' || status === 'error') && clientBaseline;

    return (
        <section className="mb-6 space-y-4">
            <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-lg">Behavioral Intelligence</h2>
            </div>

            {status === 'initializing' && (
                <Card className="p-4 border-dashed border-primary/20 bg-primary/5 animate-pulse">
                    <div className="flex items-center gap-3 text-sm text-primary">
                        <Brain className="w-4 h-4 animate-bounce" />
                        Analyzing behavioral patterns...
                    </div>
                </Card>
            )}

            {/* ML-powered baseline */}
            {showMLBaseline && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="p-4 bg-gradient-to-br from-card to-accent/5 border-border/50">
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-primary" />
                                <h3 className="font-medium text-sm">Personalized Baseline</h3>
                            </div>
                            <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full">
                                {baseline.confidence > 0.7 ? 'High Confidence' : 'Building Pattern'}
                            </span>
                        </div>
                        <div className="space-y-3 mt-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Sleep Pattern</span>
                                <span className="font-medium">{baseline.baseline_sleep?.toFixed(1) ?? '—'} hrs</span>
                            </div>
                            <div className="h-2 bg-secondary/30 rounded-full overflow-hidden">
                                <div className="h-full bg-primary/50 rounded-full"
                                    style={{ width: `${((baseline.baseline_sleep || 8) / 12) * 100}%` }} />
                            </div>
                            <div className="flex justify-between text-sm pt-1">
                                <span className="text-muted-foreground">Avg. Calmness</span>
                                <span className="font-medium">{((baseline.baseline_behaviour || 0.5) * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4 bg-gradient-to-br from-card to-secondary/5 border-border/50">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            <h3 className="font-medium text-sm">Pattern Analysis</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Based on {baseline.data_points_used} days of data, typical behavior patterns are established.
                            Any significant deviation will trigger a smart alert.
                        </p>
                    </Card>
                </div>
            )}

            {/* Client-side fallback insights */}
            {showFallback && clientBaseline && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="p-4 bg-gradient-to-br from-card to-accent/5 border-border/50">
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-primary" />
                                <h3 className="font-medium text-sm">Behavioral Baseline</h3>
                            </div>
                            <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full">
                                {clientBaseline.confidence === 'high' ? 'High Confidence' :
                                 clientBaseline.confidence === 'medium' ? 'Medium Confidence' : 'Building'}
                            </span>
                        </div>
                        <div className="space-y-3 mt-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Data Points</span>
                                <span className="font-medium">{clientBaseline.dataPoints} entries</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Days Tracked</span>
                                <span className="font-medium">{clientBaseline.daysOfData} days</span>
                            </div>
                            {clientBaseline.dominantEmotions.length > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Common Mood</span>
                                    <span className="font-medium capitalize">{clientBaseline.dominantEmotions[0]}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Avg. Intensity</span>
                                <span className="font-medium">
                                    {clientBaseline.avgBehaviorIntensity <= 1.5 ? 'Low' :
                                     clientBaseline.avgBehaviorIntensity <= 2.3 ? 'Moderate' : 'High'}
                                </span>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4 bg-gradient-to-br from-card to-secondary/5 border-border/50">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            <h3 className="font-medium text-sm">Weekly Trend</h3>
                        </div>
                        {clientBaseline.prediction ? (
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                    Trend: <span className={cn('font-medium',
                                        clientBaseline.prediction.weeklyPattern.trend === 'improving' && 'text-green-600',
                                        clientBaseline.prediction.weeklyPattern.trend === 'stable' && 'text-blue-600',
                                        clientBaseline.prediction.weeklyPattern.trend === 'concerning' && 'text-orange-600',
                                    )}>
                                        {clientBaseline.prediction.weeklyPattern.trend === 'improving' ? 'Improving' :
                                         clientBaseline.prediction.weeklyPattern.trend === 'stable' ? 'Stable' : 'Needs attention'}
                                    </span>
                                </p>
                                {clientBaseline.prediction.weeklyPattern.calmestDays.length > 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        Calmest on: <span className="font-medium">{clientBaseline.prediction.weeklyPattern.calmestDays.join(', ')}</span>
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Keep logging to build stronger patterns.
                            </p>
                        )}
                    </Card>
                </div>
            )}
        </section>
    );
};

export default MLInsights;
