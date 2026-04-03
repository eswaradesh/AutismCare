/**
 * AutismCare Analytics Engine
 * 
 * Explainable AI for behavioral analysis:
 * - Builds personalized baselines from historical data
 * - Detects deviations relative to child's own patterns
 * - Correlates routines with behavioral trends
 * - Provides confidence indicators based on data availability
 * 
 * ETHICAL DESIGN:
 * - No population-level comparisons
 * - No diagnostic language
 * - All insights are supportive, not prescriptive
 */

import { RoutineEntry, BehaviorEntry } from '@/contexts/DataContext';
import { format, subDays, differenceInDays, parseISO } from 'date-fns';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface BaselineMetrics {
  avgSleepEntries: number;
  avgFoodEntries: number;
  avgTherapyEntries: number;
  avgActivityEntries: number;
  dominantEmotions: string[];
  avgBehaviorIntensity: number;
  dataPoints: number;
  dateRange: { start: string; end: string };
}

export interface BehaviorDeviation {
  type: 'emotion_shift' | 'intensity_change' | 'routine_gap' | 'pattern_change';
  description: string;
  severity: 'minor' | 'moderate' | 'notable';
  detectedOn: string;
  explanation: string;
}

export interface RoutineBehaviorCorrelation {
  routineType: string;
  behaviorImpact: 'positive' | 'neutral' | 'variable';
  description: string;
  confidence: ConfidenceLevel;
  dataPointsUsed: number;
}

export interface InsightWithConfidence {
  insight: string;
  confidence: ConfidenceLevel;
  explanation: string;
  dataPointsUsed: number;
}

export interface BehavioralReport {
  id: string;
  generatedAt: string;
  dateRange: { start: string; end: string };
  baseline: BaselineMetrics;
  deviations: BehaviorDeviation[];
  correlations: RoutineBehaviorCorrelation[];
  insights: InsightWithConfidence[];
  dailySummaries: DaySummary[];
  overallConfidence: ConfidenceLevel;
  shareToken?: string;
}

export interface DaySummary {
  date: string;
  routineCount: number;
  behaviorCount: number;
  dominantEmotion: string | null;
  avgIntensity: number | null;
  routineTypes: string[];
}

/**
 * Calculate confidence level based on data availability
 */
export function calculateConfidence(dataPoints: number, daysOfData: number): ConfidenceLevel {
  if (dataPoints >= 30 && daysOfData >= 14) return 'high';
  if (dataPoints >= 15 && daysOfData >= 7) return 'medium';
  return 'low';
}

/**
 * Get confidence explanation for transparency
 */
export function getConfidenceExplanation(confidence: ConfidenceLevel, dataPoints: number): string {
  switch (confidence) {
    case 'high':
      return `Based on ${dataPoints} data points over an extended period. This insight is well-supported.`;
    case 'medium':
      return `Based on ${dataPoints} data points. More consistent logging will strengthen this insight.`;
    case 'low':
      return `Based on limited data (${dataPoints} points). Continue logging to build a stronger baseline.`;
  }
}

/**
 * Build behavioral baseline from historical data
 * Only uses this child's own data - no population comparisons
 */
export function buildBaseline(
  routines: RoutineEntry[],
  behaviors: BehaviorEntry[],
  daysBack: number = 30
): BaselineMetrics {
  const cutoffDate = format(subDays(new Date(), daysBack), 'yyyy-MM-dd');
  
  const recentRoutines = routines.filter(r => r.date >= cutoffDate);
  const recentBehaviors = behaviors.filter(b => b.date >= cutoffDate);
  
  const uniqueDates = new Set([
    ...recentRoutines.map(r => r.date),
    ...recentBehaviors.map(b => b.date)
  ]);
  const daysWithData = uniqueDates.size || 1;
  
  // Calculate routine averages
  const sleepCount = recentRoutines.filter(r => r.type === 'sleep').length;
  const foodCount = recentRoutines.filter(r => r.type === 'food').length;
  const therapyCount = recentRoutines.filter(r => r.type === 'therapy').length;
  const activityCount = recentRoutines.filter(r => r.type === 'activity').length;
  
  // Emotion analysis
  const emotionCounts: Record<string, number> = {};
  recentBehaviors.forEach(b => {
    emotionCounts[b.emotion] = (emotionCounts[b.emotion] || 0) + 1;
  });
  const sortedEmotions = Object.entries(emotionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([emotion]) => emotion);
  
  // Intensity average
  const intensityMap = { low: 1, moderate: 2, high: 3 };
  const avgIntensity = recentBehaviors.length > 0
    ? recentBehaviors.reduce((sum, b) => sum + intensityMap[b.intensity], 0) / recentBehaviors.length
    : 0;
  
  const dates = [...uniqueDates].sort();
  
  return {
    avgSleepEntries: sleepCount / daysWithData,
    avgFoodEntries: foodCount / daysWithData,
    avgTherapyEntries: therapyCount / daysWithData,
    avgActivityEntries: activityCount / daysWithData,
    dominantEmotions: sortedEmotions,
    avgBehaviorIntensity: avgIntensity,
    dataPoints: recentRoutines.length + recentBehaviors.length,
    dateRange: {
      start: dates[0] || format(new Date(), 'yyyy-MM-dd'),
      end: dates[dates.length - 1] || format(new Date(), 'yyyy-MM-dd')
    }
  };
}

/**
 * Detect deviations from the child's established baseline
 */
export function detectDeviations(
  baseline: BaselineMetrics,
  recentRoutines: RoutineEntry[],
  recentBehaviors: BehaviorEntry[],
  days: number = 7
): BehaviorDeviation[] {
  const deviations: BehaviorDeviation[] = [];
  const cutoffDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
  
  const periodRoutines = recentRoutines.filter(r => r.date >= cutoffDate);
  const periodBehaviors = recentBehaviors.filter(b => b.date >= cutoffDate);
  
  // Check for emotion shifts
  const recentEmotions = periodBehaviors.map(b => b.emotion);
  const newEmotions = recentEmotions.filter(e => !baseline.dominantEmotions.includes(e));
  
  if (newEmotions.length > 0 && periodBehaviors.length >= 3) {
    const uniqueNew = [...new Set(newEmotions)];
    deviations.push({
      type: 'emotion_shift',
      description: `New emotions observed: ${uniqueNew.join(', ')}`,
      severity: 'moderate',
      detectedOn: format(new Date(), 'yyyy-MM-dd'),
      explanation: `These emotions weren't common in ${baseline.dataPoints} previous entries. This may indicate a change worth noting.`
    });
  }
  
  // Check for intensity changes
  const intensityMap = { low: 1, moderate: 2, high: 3 };
  const recentAvgIntensity = periodBehaviors.length > 0
    ? periodBehaviors.reduce((sum, b) => sum + intensityMap[b.intensity], 0) / periodBehaviors.length
    : baseline.avgBehaviorIntensity;
  
  const intensityDiff = recentAvgIntensity - baseline.avgBehaviorIntensity;
  if (Math.abs(intensityDiff) > 0.5 && periodBehaviors.length >= 3) {
    deviations.push({
      type: 'intensity_change',
      description: intensityDiff > 0 
        ? 'Behavior intensity has increased recently'
        : 'Behavior intensity has decreased recently',
      severity: Math.abs(intensityDiff) > 1 ? 'notable' : 'minor',
      detectedOn: format(new Date(), 'yyyy-MM-dd'),
      explanation: `Average intensity changed from ${baseline.avgBehaviorIntensity.toFixed(1)} to ${recentAvgIntensity.toFixed(1)} based on recent entries.`
    });
  }
  
  // Check for routine gaps
  const uniqueDays = new Set(periodRoutines.map(r => r.date)).size;
  const expectedDays = Math.min(days, 7);
  if (uniqueDays < expectedDays * 0.5 && baseline.dataPoints > 10) {
    deviations.push({
      type: 'routine_gap',
      description: 'Fewer routine entries than usual',
      severity: 'minor',
      detectedOn: format(new Date(), 'yyyy-MM-dd'),
      explanation: `Only ${uniqueDays} days with entries in the last ${days} days. Regular logging helps build stronger insights.`
    });
  }
  
  return deviations;
}

/**
 * Analyze correlations between routines and behaviors
 */
export function analyzeCorrelations(
  routines: RoutineEntry[],
  behaviors: BehaviorEntry[]
): RoutineBehaviorCorrelation[] {
  const correlations: RoutineBehaviorCorrelation[] = [];
  const routineTypes = ['sleep', 'therapy', 'activity', 'food'] as const;
  
  for (const routineType of routineTypes) {
    const routineDays = new Set(routines.filter(r => r.type === routineType).map(r => r.date));
    const behaviorsOnRoutineDays = behaviors.filter(b => routineDays.has(b.date));
    const behaviorsOnNonRoutineDays = behaviors.filter(b => !routineDays.has(b.date));
    
    if (behaviorsOnRoutineDays.length < 2 || behaviorsOnNonRoutineDays.length < 2) continue;

    const intensityMap = { low: 1, moderate: 2, high: 3 };
    const avgWithRoutine = behaviorsOnRoutineDays.reduce((sum, b) => sum + intensityMap[b.intensity], 0) / behaviorsOnRoutineDays.length;
    const avgWithoutRoutine = behaviorsOnNonRoutineDays.reduce((sum, b) => sum + intensityMap[b.intensity], 0) / behaviorsOnNonRoutineDays.length;

    const diff = avgWithRoutine - avgWithoutRoutine;
    const dataPointsUsed = behaviorsOnRoutineDays.length + behaviorsOnNonRoutineDays.length;
    const confidence = calculateConfidence(dataPointsUsed, routineDays.size);

    let impact: 'positive' | 'neutral' | 'variable' = 'neutral';
    let description = '';

    if (Math.abs(diff) < 0.3) {
      impact = 'neutral';
      description = `${routineType} entries don't show a clear pattern with behavior changes.`;
    } else if (diff < -0.3) {
      impact = 'positive';
      description = `Days with ${routineType} logged tend to show calmer behavior patterns.`;
    } else {
      impact = 'variable';
      description = `Days with ${routineType} logged show more variable behavior patterns.`;
    }

    correlations.push({
      routineType,
      behaviorImpact: impact,
      description,
      confidence,
      dataPointsUsed
    });
  }

  // Fallback: if no per-type correlations, compute frequency-based insights
  if (correlations.length === 0 && behaviors.length >= 3) {
    const allRoutineDays = new Set(routines.map(r => r.date));
    const behavTotal = behaviors.length;
    const uniqueBehavDays = new Set(behaviors.map(b => b.date)).size;
    const uniqueRoutineDays = allRoutineDays.size;

    if (uniqueRoutineDays > 0 && uniqueBehavDays > 0) {
      const consistency = uniqueRoutineDays / Math.max(uniqueBehavDays, uniqueRoutineDays);
      correlations.push({
        routineType: 'logging consistency',
        behaviorImpact: 'neutral',
        description: consistency > 0.7
          ? `Routines logged on ${Math.round(consistency * 100)}% of tracked days. Good consistency helps build stronger insights.`
          : `Routine logging covers ${Math.round(consistency * 100)}% of tracked days. More consistent logging may reveal patterns.`,
        confidence: calculateConfidence(behavTotal, uniqueBehavDays),
        dataPointsUsed: behavTotal
      });
    }
  }

  return correlations;
}

/**
 * Generate human-readable insights with confidence levels
 */
export function generateInsights(
  baseline: BaselineMetrics,
  deviations: BehaviorDeviation[],
  correlations: RoutineBehaviorCorrelation[]
): InsightWithConfidence[] {
  const insights: InsightWithConfidence[] = [];
  const overallConfidence = calculateConfidence(
    baseline.dataPoints,
    differenceInDays(parseISO(baseline.dateRange.end), parseISO(baseline.dateRange.start))
  );
  
  // Baseline insight
  if (baseline.dominantEmotions.length > 0) {
    insights.push({
      insight: `Most commonly observed emotions: ${baseline.dominantEmotions.join(', ')}`,
      confidence: overallConfidence,
      explanation: getConfidenceExplanation(overallConfidence, baseline.dataPoints),
      dataPointsUsed: baseline.dataPoints
    });
  }
  
  // Routine consistency insight
  const totalAvgRoutines = baseline.avgSleepEntries + baseline.avgFoodEntries + 
                           baseline.avgTherapyEntries + baseline.avgActivityEntries;
  if (totalAvgRoutines > 2) {
    insights.push({
      insight: 'Good routine tracking consistency helps identify patterns',
      confidence: overallConfidence,
      explanation: `You're logging an average of ${totalAvgRoutines.toFixed(1)} routine entries per day.`,
      dataPointsUsed: baseline.dataPoints
    });
  }
  
  // Correlation-based insights
  const positiveCorrelations = correlations.filter(c => c.behaviorImpact === 'positive');
  if (positiveCorrelations.length > 0) {
    const routineNames = positiveCorrelations.map(c => c.routineType).join(', ');
    const avgDataPoints = positiveCorrelations.reduce((sum, c) => sum + c.dataPointsUsed, 0) / positiveCorrelations.length;
    insights.push({
      insight: `${routineNames} appears to correlate with calmer behavior patterns`,
      confidence: positiveCorrelations[0].confidence,
      explanation: `This pattern was observed across ${Math.round(avgDataPoints)} data points. More consistent logging will strengthen this insight.`,
      dataPointsUsed: Math.round(avgDataPoints)
    });
  }
  
  // Deviation-based insights
  const notableDeviations = deviations.filter(d => d.severity === 'notable');
  if (notableDeviations.length > 0) {
    insights.push({
      insight: 'Recent changes detected from established patterns',
      confidence: overallConfidence,
      explanation: 'Review the deviations section for details on what has changed.',
      dataPointsUsed: baseline.dataPoints
    });
  }
  
  return insights;
}

/**
 * Generate daily summaries for a date range
 */
export function generateDailySummaries(
  routines: RoutineEntry[],
  behaviors: BehaviorEntry[],
  startDate: string,
  endDate: string
): DaySummary[] {
  const summaries: DaySummary[] = [];
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const days = differenceInDays(end, start) + 1;
  
  for (let i = 0; i < days; i++) {
    const date = format(subDays(end, days - 1 - i), 'yyyy-MM-dd');
    const dayRoutines = routines.filter(r => r.date === date);
    const dayBehaviors = behaviors.filter(b => b.date === date);
    
    const intensityMap = { low: 1, moderate: 2, high: 3 };
    const avgIntensity = dayBehaviors.length > 0
      ? dayBehaviors.reduce((sum, b) => sum + intensityMap[b.intensity], 0) / dayBehaviors.length
      : null;
    
    const emotionCounts: Record<string, number> = {};
    dayBehaviors.forEach(b => {
      emotionCounts[b.emotion] = (emotionCounts[b.emotion] || 0) + 1;
    });
    const dominantEmotion = Object.entries(emotionCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || null;
    
    summaries.push({
      date,
      routineCount: dayRoutines.length,
      behaviorCount: dayBehaviors.length,
      dominantEmotion,
      avgIntensity,
      routineTypes: [...new Set(dayRoutines.map(r => r.type))]
    });
  }
  
  return summaries;
}

/**
 * Generate a complete behavioral report
 */
export function generateBehavioralReport(
  routines: RoutineEntry[],
  behaviors: BehaviorEntry[],
  startDate: string,
  endDate: string
): BehavioralReport {
  const baseline = buildBaseline(routines, behaviors, 30);
  const deviations = detectDeviations(baseline, routines, behaviors, 7);
  const correlations = analyzeCorrelations(routines, behaviors);
  const insights = generateInsights(baseline, deviations, correlations);
  const dailySummaries = generateDailySummaries(routines, behaviors, startDate, endDate);
  
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const daysInRange = differenceInDays(end, start) + 1;
  
  return {
    id: `report-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    dateRange: { start: startDate, end: endDate },
    baseline,
    deviations,
    correlations,
    insights,
    dailySummaries,
    overallConfidence: calculateConfidence(baseline.dataPoints, daysInRange)
  };
}

/**
 * Generate a shareable token for therapist access
 */
export function generateShareToken(): string {
  return `share-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Behavior Tendency Prediction Module
 * Uses time-series forecasting to predict short-term behavior tendencies
 * Returns probabilistic forecasts with confidence indicators
 */
export interface BehaviorPrediction {
  timeframe: 'this_week' | 'next_week';
  riskWindows: RiskWindow[];
  triggerPronePeriods: TriggerPeriod[];
  weeklyPattern: WeeklyPattern;
  confidence: ConfidenceLevel;
}

export interface RiskWindow {
  dayOfWeek: string;
  timeRange: string;
  probability: 'low' | 'medium' | 'high';
  explanation: string;
}

export interface TriggerPeriod {
  description: string;
  likelihood: 'likely' | 'may_increase' | 'possible';
  confidence: ConfidenceLevel;
  explanation: string;
}

export interface WeeklyPattern {
  mostActiveDays: string[];
  calmestDays: string[];
  averageIntensity: number;
  trend: 'improving' | 'stable' | 'concerning';
}

export function predictBehaviorTendencies(
  routines: RoutineEntry[],
  behaviors: BehaviorEntry[],
  daysBack: number = 30
): BehaviorPrediction {
  const cutoffDate = format(subDays(new Date(), daysBack), 'yyyy-MM-dd');
  const recentRoutines = routines.filter(r => r.date >= cutoffDate);
  const recentBehaviors = behaviors.filter(b => b.date >= cutoffDate);

  // Analyze day-of-week patterns
  const dayPatterns: Record<string, { intensity: number; count: number }> = {};
  const intensityMap = { low: 1, moderate: 2, high: 3 };

  recentBehaviors.forEach(b => {
    const day = format(parseISO(b.date), 'EEEE');
    if (!dayPatterns[day]) {
      dayPatterns[day] = { intensity: 0, count: 0 };
    }
    dayPatterns[day].intensity += intensityMap[b.intensity];
    dayPatterns[day].count += 1;
  });

  // Calculate average intensity per day
  const dayAverages: Record<string, number> = {};
  Object.entries(dayPatterns).forEach(([day, data]) => {
    dayAverages[day] = data.count > 0 ? data.intensity / data.count : 0;
  });

  // Identify risk windows (days with higher average intensity)
  const sortedDays = Object.entries(dayAverages)
    .sort(([, a], [, b]) => b - a);
  
  const riskWindows: RiskWindow[] = sortedDays.slice(0, 2).map(([day, avg]) => ({
    dayOfWeek: day,
    timeRange: 'Throughout day',
    probability: avg >= 2.5 ? 'high' : avg >= 1.8 ? 'medium' : 'low',
    explanation: `Historical data shows ${avg >= 2.5 ? 'higher' : 'moderate'} intensity patterns on ${day}s.`
  }));

  // Identify trigger-prone periods
  const suddenBehaviors = recentBehaviors.filter(b => b.isSudden);
  const triggerPronePeriods: TriggerPeriod[] = [];

  if (suddenBehaviors.length > 0) {
    const suddenCount = suddenBehaviors.length;
    const totalBehaviors = recentBehaviors.length;
    const suddenRatio = suddenCount / totalBehaviors;

    if (suddenRatio > 0.3) {
      triggerPronePeriods.push({
        description: 'Sudden behavior changes observed',
        likelihood: suddenRatio > 0.5 ? 'likely' : 'may_increase',
        confidence: calculateConfidence(totalBehaviors, 30),
        explanation: `${Math.round(suddenRatio * 100)}% of recent behaviors were marked as sudden changes.`
      });
    }
  }

  // Weekly pattern analysis
  const mostActiveDays = sortedDays.slice(0, 2).map(([day]) => day);
  const calmestDays = sortedDays.slice(-2).map(([day]) => day);
  const overallAvg = recentBehaviors.length > 0
    ? recentBehaviors.reduce((sum, b) => sum + intensityMap[b.intensity], 0) / recentBehaviors.length
    : 0;

  // Determine trend (simplified - compare last week vs previous week)
  const lastWeek = recentBehaviors.filter(b => {
    const date = parseISO(b.date);
    return differenceInDays(new Date(), date) <= 7;
  });
  const prevWeek = recentBehaviors.filter(b => {
    const date = parseISO(b.date);
    return differenceInDays(new Date(), date) > 7 && differenceInDays(new Date(), date) <= 14;
  });

  const lastWeekAvg = lastWeek.length > 0
    ? lastWeek.reduce((sum, b) => sum + intensityMap[b.intensity], 0) / lastWeek.length
    : 0;
  const prevWeekAvg = prevWeek.length > 0
    ? prevWeek.reduce((sum, b) => sum + intensityMap[b.intensity], 0) / prevWeek.length
    : 0;

  let trend: 'improving' | 'stable' | 'concerning' = 'stable';
  if (lastWeek.length > 0 && prevWeek.length > 0) {
    if (lastWeekAvg < prevWeekAvg - 0.3) trend = 'improving';
    else if (lastWeekAvg > prevWeekAvg + 0.3) trend = 'concerning';
  }

  const weeklyPattern: WeeklyPattern = {
    mostActiveDays,
    calmestDays,
    averageIntensity: overallAvg,
    trend
  };

  return {
    timeframe: 'this_week',
    riskWindows,
    triggerPronePeriods,
    weeklyPattern,
    confidence: calculateConfidence(recentBehaviors.length, 30)
  };
}

/**
 * Enhanced Pattern Highlight Feature
 * Performs correlation and association analysis with explainable insights
 */
export interface PatternHighlight {
  pattern: string;
  description: string;
  confidence: ConfidenceLevel;
  dataPoints: number;
  example: string;
}

export function highlightPatterns(
  routines: RoutineEntry[],
  behaviors: BehaviorEntry[]
): PatternHighlight[] {
  const patterns: PatternHighlight[] = [];
  const routineTypes = ['sleep', 'therapy', 'activity', 'food'] as const;

  for (const routineType of routineTypes) {
    const routineDays = new Set(routines.filter(r => r.type === routineType).map(r => r.date));
    const behaviorsOnRoutineDays = behaviors.filter(b => routineDays.has(b.date));
    const behaviorsOnNonRoutineDays = behaviors.filter(b => !routineDays.has(b.date));

    if (behaviorsOnRoutineDays.length < 2 || behaviorsOnNonRoutineDays.length < 2) continue;

    const intensityMap = { low: 1, moderate: 2, high: 3 };
    const avgWithRoutine = behaviorsOnRoutineDays.reduce((sum, b) => sum + intensityMap[b.intensity], 0) / behaviorsOnRoutineDays.length;
    const avgWithoutRoutine = behaviorsOnNonRoutineDays.reduce((sum, b) => sum + intensityMap[b.intensity], 0) / behaviorsOnNonRoutineDays.length;

    const diff = avgWithRoutine - avgWithoutRoutine;
    const dataPointsUsed = behaviorsOnRoutineDays.length + behaviorsOnNonRoutineDays.length;
    const confidence = calculateConfidence(dataPointsUsed, routineDays.size);

    if (Math.abs(diff) >= 0.3) {
      const isPositive = diff < -0.3;
      patterns.push({
        pattern: `${routineType} association`,
        description: isPositive
          ? `On days with ${routineType} logged, behavior was observed to be calmer.`
          : `On days with ${routineType} logged, behavior intensity was observed to be higher.`,
        confidence,
        dataPoints: dataPointsUsed,
        example: `For example, on ${behaviorsOnRoutineDays.length} days with ${routineType} entries, average intensity was ${avgWithRoutine.toFixed(1)} compared to ${avgWithoutRoutine.toFixed(1)} on other days.`
      });
    }
  }

  // Time-based patterns (early sleep, late sleep, etc.)
  const earlySleepDays = routines
    .filter(r => r.type === 'sleep' && r.startTime && parseInt(r.startTime.split(':')[0]) < 21)
    .map(r => r.date);
  const earlySleepBehaviors = behaviors.filter(b => earlySleepDays.includes(b.date));

  if (earlySleepBehaviors.length >= 3) {
    const intensityMap = { low: 1, moderate: 2, high: 3 };
    const avgIntensity = earlySleepBehaviors.reduce((sum, b) => sum + intensityMap[b.intensity], 0) / earlySleepBehaviors.length;

    if (avgIntensity < 1.8) {
      patterns.push({
        pattern: 'Early sleep association',
        description: 'On days with early sleep, behavior was observed to be calmer.',
        confidence: calculateConfidence(earlySleepBehaviors.length, earlySleepDays.length),
        dataPoints: earlySleepBehaviors.length,
        example: `Observed on ${earlySleepBehaviors.length} days with early sleep timing.`
      });
    }
  }

  return patterns;
}
