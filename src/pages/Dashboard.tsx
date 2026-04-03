import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Moon, Utensils, Gamepad2, Stethoscope,
  AlertTriangle, Settings, ChevronRight, Heart,
  LogOut, Plus, Shield
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import BottomNav from '@/components/BottomNav';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import MyTherapists from '@/components/MyTherapists';
import MedicationNotifications from '@/components/MedicationNotifications';
import ActivitySuggestions from '@/components/ActivitySuggestions';
import MLInsights from '@/components/MLInsights';
import { cn } from '@/lib/utils';
import { Users, Lightbulb, Target } from 'lucide-react';
import { predictBehaviorTendencies, highlightPatterns } from '@/lib/analytics';

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, childProfile, logout, userRole } = useAuth();
  const { getEntriesForDate, medications, routineEntries, behaviorEntries } = useData();

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayEntries = getEntriesForDate(today);

  // AI-generated activity suggestions based on behavior patterns
  const aiSuggestions = useMemo(() => {
    if (routineEntries.length < 3 && behaviorEntries.length < 3) return [];
    const suggestions: { title: string; description: string; icon: string }[] = [];
    try {
      const prediction = predictBehaviorTendencies(routineEntries, behaviorEntries, 30);
      const patterns = highlightPatterns(routineEntries, behaviorEntries);

      if (prediction.weeklyPattern.trend === 'concerning') {
        suggestions.push({
          title: 'Calming Sensory Break',
          description: 'Behavior intensity has been elevated. Try 10-15 min sensory breaks with deep pressure activities.',
          icon: 'calm',
        });
      }
      if (prediction.weeklyPattern.averageIntensity > 2) {
        suggestions.push({
          title: 'Structured Visual Schedule',
          description: 'Use a picture-based schedule to help with transitions and reduce anxiety during routine changes.',
          icon: 'schedule',
        });
      }
      const therapyPattern = patterns.find(p => p.pattern.includes('therapy') && p.description.includes('calmer'));
      if (therapyPattern) {
        suggestions.push({
          title: 'Maintain Therapy Consistency',
          description: 'Data shows calmer behavior on therapy days. Keeping a consistent schedule is beneficial.',
          icon: 'therapy',
        });
      }
      const sleepPattern = patterns.find(p => p.pattern.includes('sleep'));
      if (sleepPattern) {
        suggestions.push({
          title: 'Sleep Routine Optimization',
          description: sleepPattern.description,
          icon: 'sleep',
        });
      }
      if (suggestions.length === 0 && behaviorEntries.length >= 5) {
        suggestions.push({
          title: 'Outdoor Sensory Play',
          description: 'Regular outdoor play with swings and climbing helps with sensory regulation and mood.',
          icon: 'activity',
        });
        suggestions.push({
          title: 'Music & Rhythm Activities',
          description: 'Musical activities can support emotional regulation and provide a calming routine.',
          icon: 'music',
        });
      }
    } catch (err) {
      console.warn('AI suggestions generation failed:', err);
    }
    return suggestions;
  }, [routineEntries, behaviorEntries]);

  // Today's sudden changes count
  const todaySuddenCount = todayEntries.behaviors.filter(b => b.isSudden).length;

  const quickActions = [
    { icon: Moon, label: t('sleep'), color: 'bg-secondary', path: '/daily-log', type: 'sleep' },
    { icon: Utensils, label: t('food'), color: 'bg-accent', path: '/daily-log', type: 'food' },
    { icon: Gamepad2, label: t('activities'), color: 'bg-info/20', path: '/daily-log', type: 'activity' },
    { icon: Stethoscope, label: t('therapy'), color: 'bg-success/20', path: '/daily-log', type: 'therapy' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="page-container pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold font-display text-lg text-foreground">
              {t('appName')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {childProfile?.name && `${childProfile.name}'s care`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Admin panel link removed */}
          <button
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-primary/10 transition-colors"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </button>
          <button
            onClick={handleLogout}
            className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mb-6">
        <DisclaimerBanner compact />
      </div>

      {/* Medication Notifications Service */}
      <MedicationNotifications />

      {/* ML Insights */}
      <MLInsights />

      {/* Quick Actions */}
      <section className="mb-6">
        <h2 className="section-title">{t('logRoutine')}</h2>
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map(({ icon: Icon, label, color, path }) => (
            <Link
              key={label}
              to={path}
              className="card-elevated p-3 flex flex-col items-center gap-2 hover:scale-[1.02] transition-transform"
            >
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-center text-foreground">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Report Sudden Change - Prominent CTA */}
      <section className="mb-6">
        <Link
          to="/behaviors?sudden=true"
          className="block card-elevated p-4 border-2 border-warning/30 bg-warning/5 hover:bg-warning/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{t('reportChange')}</h3>
              <p className="text-sm text-muted-foreground">
                {todaySuddenCount > 0
                  ? `${todaySuddenCount} sudden change${todaySuddenCount > 1 ? 's' : ''} reported today`
                  : t('suddenChange')}
              </p>
            </div>
            {todaySuddenCount > 0 && (
              <span className="w-6 h-6 rounded-full bg-warning text-warning-foreground text-xs font-bold flex items-center justify-center">
                {todaySuddenCount}
              </span>
            )}
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </Link>
      </section>

      {/* Today's Overview */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title mb-0">{t('today')}</h2>
          <span className="text-sm text-muted-foreground">
            {format(new Date(), 'MMM d, yyyy')}
          </span>
        </div>
        <div className="card-elevated p-4">
          {todayEntries.routines.length > 0 || todayEntries.behaviors.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Routine logs</span>
                <span className="font-medium">{todayEntries.routines.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Behavior notes</span>
                <span className="font-medium">{todayEntries.behaviors.length}</span>
              </div>
              {todayEntries.behaviors.length > 0 && (() => {
                const latest = [...todayEntries.behaviors].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                return (
                  <div className="text-sm bg-muted/30 rounded-lg p-2">
                    <span className="text-muted-foreground">Latest mood: </span>
                    <span className="font-medium capitalize">{latest?.emotion}</span>
                    <span className="text-muted-foreground"> — </span>
                    <span className={cn('font-medium',
                      latest?.intensity === 'low' && 'text-green-600',
                      latest?.intensity === 'moderate' && 'text-yellow-600',
                      latest?.intensity === 'high' && 'text-red-600',
                    )}>{latest?.intensity}</span>
                  </div>
                );
              })()}
              <Link
                to="/summary"
                className="flex items-center justify-center gap-2 text-primary text-sm font-medium pt-2"
              >
                {t('todaysSummary')}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground text-sm mb-3">No entries yet today</p>
              <Link
                to="/daily-log"
                className="inline-flex items-center gap-2 text-primary font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Add first entry
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Medication Reminders Preview */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title mb-0">{t('medications')}</h2>
          <Link to="/medications" className="text-sm text-primary font-medium">
            {t('settings')}
          </Link>
        </div>
        <div className="card-elevated p-4">
          {medications.filter(m => m.enabled).length > 0 ? (
            <div className="space-y-2">
              {medications.filter(m => m.enabled).slice(0, 3).map((med) => (
                <div key={med.id} className="flex items-center justify-between py-2">
                  <span className="font-medium text-sm">{med.name}</span>
                  <span className="text-sm text-muted-foreground">{med.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground text-sm mb-3">No medication reminders set</p>
              <Link
                to="/medications"
                className="inline-flex items-center gap-2 text-primary font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                {t('addMedication')}
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* My Therapists Section */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="section-title mb-0">My Therapists</h2>
        </div>
        <div className="card-elevated p-4">
          <MyTherapists />
        </div>
      </section>

      {/* Activity Suggestions Section */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-primary" />
          <h2 className="section-title mb-0">Activity Suggestions</h2>
        </div>

        {/* AI-generated suggestions */}
        {aiSuggestions.length > 0 && (
          <div className="space-y-2 mb-3">
            {aiSuggestions.slice(0, 3).map((s, i) => (
              <div key={i} className="card-elevated p-4">
                <div className="flex items-start gap-3">
                  <Target className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Therapist suggestions */}
        {childProfile?.id && (
          <div className="card-elevated p-4">
            <ActivitySuggestions childId={childProfile.id} readOnly />
          </div>
        )}

        {aiSuggestions.length === 0 && !childProfile?.id && (
          <div className="card-elevated p-4 text-center">
            <p className="text-sm text-muted-foreground">Keep logging to get personalized activity suggestions.</p>
          </div>
        )}
      </section>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
