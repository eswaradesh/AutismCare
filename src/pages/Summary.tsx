import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, subDays, parseISO, differenceInDays } from 'date-fns';
import { ChevronLeft, Sun, Moon, Heart, TrendingUp, Utensils, Gamepad2, Stethoscope, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import { cn } from '@/lib/utils';

const emotionLabels: Record<string, string> = {
  happy: 'Happy', calm: 'Calm', anxious: 'Anxious', upset: 'Upset',
};

const intensityColors: Record<string, string> = {
  low: 'text-green-600', moderate: 'text-yellow-600', high: 'text-red-600',
};

const Summary = () => {
  const { t } = useLanguage();
  const { childProfile } = useAuth();
  const { routineEntries, behaviorEntries } = useData();

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayRoutines = routineEntries.filter(e => e.date === today);
  const todayBehaviors = behaviorEntries.filter(e => e.date === today);

  const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const weekRoutines = routineEntries.filter(e => e.date >= weekAgo);
  const weekBehaviors = behaviorEntries.filter(e => e.date >= weekAgo);

  const prevWeekStart = format(subDays(new Date(), 14), 'yyyy-MM-dd');
  const prevWeekRoutines = routineEntries.filter(e => e.date >= prevWeekStart && e.date < weekAgo);
  const prevWeekBehaviors = behaviorEntries.filter(e => e.date >= prevWeekStart && e.date < weekAgo);

  // Generate intelligent today's summary
  const todaySummary = useMemo(() => {
    // Sleep quality
    const sleepEntries = todayRoutines.filter(r => r.type === 'sleep');
    let sleepSummary = 'No sleep data logged today';
    if (sleepEntries.length > 0) {
      const lastSleep = sleepEntries[0];
      if (lastSleep.startTime && lastSleep.endTime) {
        const [startH, startM] = lastSleep.startTime.split(':').map(Number);
        const [endH, endM] = lastSleep.endTime.split(':').map(Number);
        let totalMin = (endH * 60 + endM) - (startH * 60 + startM);
        if (totalMin < 0) totalMin += 24 * 60;
        const hrs = Math.floor(totalMin / 60);
        const mins = totalMin % 60;
        sleepSummary = `Slept from ${lastSleep.startTime} to ${lastSleep.endTime} (~${hrs}h${mins > 0 ? ` ${mins}m` : ''})`;
        if (startH <= 21) sleepSummary += ' - Early bedtime';
        else if (startH >= 23) sleepSummary += ' - Late bedtime';
      } else if (lastSleep.notes) {
        sleepSummary = lastSleep.notes;
      }
    }

    // Mood overview
    const emotionCounts: Record<string, number> = {};
    todayBehaviors.forEach(b => {
      emotionCounts[b.emotion] = (emotionCounts[b.emotion] || 0) + 1;
    });
    const sortedEmotions = Object.entries(emotionCounts).sort(([,a],[,b]) => b - a);
    const moodSummary = sortedEmotions.length > 0
      ? sortedEmotions.map(([e, c]) => `${emotionLabels[e] || e}${c > 1 ? ` (${c}x)` : ''}`).join(', ')
      : 'No mood data logged today';

    // Intensity
    const intensityMap = { low: 1, moderate: 2, high: 3 };
    const avgIntensity = todayBehaviors.length > 0
      ? todayBehaviors.reduce((sum, b) => sum + (intensityMap[b.intensity] || 2), 0) / todayBehaviors.length
      : null;

    // Activities
    const activities = todayRoutines.filter(r => r.type === 'activity');
    const food = todayRoutines.filter(r => r.type === 'food');
    const therapy = todayRoutines.filter(r => r.type === 'therapy');

    // Highlights - extract meaningful notes
    const highlights: string[] = [];
    [...todayRoutines, ...todayBehaviors].forEach(entry => {
      if (entry.notes && entry.notes.trim().length > 5) {
        highlights.push(entry.notes.trim());
      }
    });

    return { sleepSummary, moodSummary, avgIntensity, activities, food, therapy, highlights, sleepEntries };
  }, [todayRoutines, todayBehaviors]);

  // Weekly insights
  const weeklyInsights = useMemo(() => {
    const emotionCounts: Record<string, number> = {};
    weekBehaviors.forEach(b => {
      emotionCounts[b.emotion] = (emotionCounts[b.emotion] || 0) + 1;
    });
    const topEmotion = Object.entries(emotionCounts).sort(([,a],[,b]) => b - a)[0];

    const intensityMap = { low: 1, moderate: 2, high: 3 };
    const weekAvg = weekBehaviors.length > 0
      ? weekBehaviors.reduce((sum, b) => sum + (intensityMap[b.intensity] || 2), 0) / weekBehaviors.length
      : null;
    const prevAvg = prevWeekBehaviors.length > 0
      ? prevWeekBehaviors.reduce((sum, b) => sum + (intensityMap[b.intensity] || 2), 0) / prevWeekBehaviors.length
      : null;

    let trend: 'improving' | 'stable' | 'concerning' | null = null;
    if (weekAvg !== null && prevAvg !== null) {
      if (weekAvg < prevAvg - 0.3) trend = 'improving';
      else if (weekAvg > prevAvg + 0.3) trend = 'concerning';
      else trend = 'stable';
    }

    const therapyDays = new Set(weekRoutines.filter(r => r.type === 'therapy').map(r => r.date)).size;
    const suddenCount = weekBehaviors.filter(b => b.isSudden).length;

    const uniqueDays = new Set([...weekRoutines.map(r => r.date), ...weekBehaviors.map(b => b.date)]).size;

    return { topEmotion, weekAvg, prevAvg, trend, therapyDays, suddenCount, uniqueDays };
  }, [weekRoutines, weekBehaviors, prevWeekBehaviors]);

  return (
    <div className="page-container pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/dashboard" className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold font-display">{t('dailySummary')}</h1>
      </div>

      {/* Today's Summary Card */}
      <div className="card-elevated p-5 mb-6 bg-gradient-to-br from-primary/5 to-secondary/10">
        <div className="flex items-center gap-3 mb-4">
          <Sun className="w-6 h-6 text-primary" />
          <h2 className="font-semibold">{t('todaysSummary')}</h2>
          <span className="ml-auto text-sm text-muted-foreground">{format(new Date(), 'MMM d')}</span>
        </div>

        <div className="space-y-4">
          {/* Sleep */}
          <div className="flex items-start gap-3 bg-background/80 rounded-xl p-3">
            <Moon className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Sleep</p>
              <p className="text-sm text-muted-foreground">{todaySummary.sleepSummary}</p>
            </div>
          </div>

          {/* Mood */}
          <div className="flex items-start gap-3 bg-background/80 rounded-xl p-3">
            <Heart className="w-5 h-5 text-pink-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Mood</p>
              <p className="text-sm text-muted-foreground">{todaySummary.moodSummary}</p>
              {todaySummary.avgIntensity !== null && (
                <p className={cn('text-xs mt-1 font-medium',
                  todaySummary.avgIntensity <= 1.5 ? 'text-green-600' :
                  todaySummary.avgIntensity <= 2.3 ? 'text-yellow-600' : 'text-red-600'
                )}>
                  Avg intensity: {todaySummary.avgIntensity <= 1.5 ? 'Low' : todaySummary.avgIntensity <= 2.3 ? 'Moderate' : 'High'}
                </p>
              )}
            </div>
          </div>

          {/* Activities & Therapy */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-background/80 rounded-xl p-3 text-center">
              <Utensils className="w-4 h-4 mx-auto text-orange-500 mb-1" />
              <p className="text-lg font-bold">{todaySummary.food.length}</p>
              <p className="text-xs text-muted-foreground">Meals</p>
            </div>
            <div className="bg-background/80 rounded-xl p-3 text-center">
              <Gamepad2 className="w-4 h-4 mx-auto text-blue-500 mb-1" />
              <p className="text-lg font-bold">{todaySummary.activities.length}</p>
              <p className="text-xs text-muted-foreground">Activities</p>
            </div>
            <div className="bg-background/80 rounded-xl p-3 text-center">
              <Stethoscope className="w-4 h-4 mx-auto text-green-500 mb-1" />
              <p className="text-lg font-bold">{todaySummary.therapy.length}</p>
              <p className="text-xs text-muted-foreground">Therapy</p>
            </div>
          </div>

          {/* Today's Notes/Highlights */}
          {todaySummary.highlights.length > 0 && (
            <div className="bg-background/80 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <p className="text-sm font-medium">Notes & Observations</p>
              </div>
              <div className="space-y-1.5">
                {todaySummary.highlights.slice(0, 5).map((note, i) => (
                  <p key={i} className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-2 py-1.5">
                    {note.length > 100 ? note.slice(0, 100) + '...' : note}
                  </p>
                ))}
              </div>
            </div>
          )}

          {todayRoutines.length === 0 && todayBehaviors.length === 0 && (
            <div className="text-center py-3">
              <p className="text-sm text-muted-foreground">No entries yet today. Start logging to see your summary.</p>
            </div>
          )}
        </div>
      </div>

      {/* Positive Note */}
      <div className="card-elevated p-5 mb-6 border-2 border-success/20 bg-success/5">
        <div className="flex items-start gap-3">
          <Heart className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-success mb-1">{t('positiveNotes')}</h3>
            <p className="text-sm">
              {childProfile?.name ? `${childProfile.name} is` : "Your child is"} making progress every day.
              Your consistent care and attention make a real difference. Keep going!
            </p>
          </div>
        </div>
      </div>

      {/* Weekly Overview */}
      <div className="card-elevated p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-5 h-5 text-info" />
          <h2 className="font-semibold">{t('weeklyOverview')}</h2>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Days with entries</span>
            <span className="font-medium">{weeklyInsights.uniqueDays} / 7</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total routine logs</span>
            <span className="font-medium">{weekRoutines.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Therapy sessions</span>
            <span className="font-medium">{weeklyInsights.therapyDays} days</span>
          </div>
          {weeklyInsights.topEmotion && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Most frequent mood</span>
              <span className="font-medium capitalize">
                {emotionLabels[weeklyInsights.topEmotion[0]] || weeklyInsights.topEmotion[0]} ({weeklyInsights.topEmotion[1]}x)
              </span>
            </div>
          )}
          {weeklyInsights.suddenCount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sudden changes reported</span>
              <span className="font-medium text-warning">{weeklyInsights.suddenCount}</span>
            </div>
          )}
          {weeklyInsights.trend && (
            <div className="flex justify-between text-sm pt-2 border-t border-border">
              <span className="text-muted-foreground">Week-over-week trend</span>
              <span className={cn('font-semibold',
                weeklyInsights.trend === 'improving' && 'text-green-600',
                weeklyInsights.trend === 'stable' && 'text-blue-600',
                weeklyInsights.trend === 'concerning' && 'text-orange-600',
              )}>
                {weeklyInsights.trend === 'improving' ? 'Improving' :
                 weeklyInsights.trend === 'stable' ? 'Stable' : 'Needs attention'}
              </span>
            </div>
          )}
        </div>
      </div>

      <DisclaimerBanner />
      <BottomNav />
    </div>
  );
};

export default Summary;
