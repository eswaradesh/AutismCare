import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format, subDays, parseISO } from 'date-fns';
import { jsPDF } from 'jspdf';
import {
  ChevronLeft, Calendar, Download, Share2, TrendingUp,
  BarChart3, Lightbulb, FileText, ExternalLink, Copy, Check
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { createSharedReport } from '@/lib/therapistApi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import ConfidenceBadge from '@/components/ConfidenceBadge';
import { InsightCard, CorrelationCard } from '@/components/InsightCard';
import { generateBehavioralReport, generateShareToken, BehavioralReport, highlightPatterns, predictBehaviorTendencies } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const Reports = () => {
  const { t } = useLanguage();
  const { user, childProfile } = useAuth();
  const { routineEntries, behaviorEntries, isLoading } = useData();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 14), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'correlations' | 'daily'>('overview');
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate report based on date range
  const report = useMemo(() => {
    return generateBehavioralReport(routineEntries, behaviorEntries, dateRange.start, dateRange.end);
  }, [routineEntries, behaviorEntries, dateRange]);

  // Extra pattern analysis for fallback display
  // Pattern highlights, deduplicated against correlations
  const patternHighlights = useMemo(() => {
    const allPatterns = highlightPatterns(routineEntries, behaviorEntries);
    const correlationTypes = new Set(report.correlations.map(c => c.routineType));
    return allPatterns.filter(p => !correlationTypes.has(p.pattern.replace(' association', '')));
  }, [routineEntries, behaviorEntries, report.correlations]);

  const behaviorPrediction = useMemo(() => {
    if (routineEntries.length === 0 && behaviorEntries.length === 0) return null;
    return predictBehaviorTendencies(routineEntries, behaviorEntries, 30);
  }, [routineEntries, behaviorEntries]);

  const handleExport = () => {
    const childName = childProfile?.name || 'Child';
    const doc = new jsPDF();
    let y = 20;

    const addText = (text: string, fontSize: number, isBold = false, color: [number, number, number] = [0, 0, 0]) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, 170);
      if (y + lines.length * (fontSize * 0.5) > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, 20, y);
      y += lines.length * (fontSize * 0.5) + 2;
    };

    const addSectionGap = () => { y += 6; };

    // Title
    addText('AuCare Behavioral Report', 20, true, [59, 130, 246]);
    addSectionGap();

    // Child name and date range
    addText(`Child: ${childName}`, 12, true);
    addText(`Date Range: ${dateRange.start} to ${dateRange.end}`, 11);
    addText(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, 10, false, [100, 100, 100]);
    addSectionGap();

    // Summary section
    addText('Summary', 14, true, [59, 130, 246]);
    y += 2;
    const daysWithEntries = report.dailySummaries.filter(d => d.routineCount > 0 || d.behaviorCount > 0).length;
    addText(`Total Data Points: ${report.baseline.dataPoints}`, 11);
    addText(`Days with Entries: ${daysWithEntries}`, 11);
    addText(`Avg Sleep Entries/Day: ${report.baseline.avgSleepEntries.toFixed(1)}`, 11);
    addText(`Avg Food Entries/Day: ${report.baseline.avgFoodEntries.toFixed(1)}`, 11);
    addText(`Avg Activity Entries/Day: ${report.baseline.avgActivityEntries.toFixed(1)}`, 11);
    addText(`Avg Therapy Entries/Day: ${report.baseline.avgTherapyEntries.toFixed(1)}`, 11);
    if (report.baseline.dominantEmotions.length > 0) {
      addText(`Dominant Emotions: ${report.baseline.dominantEmotions.join(', ')}`, 11);
    }
    addSectionGap();

    // Baseline Metrics
    addText('Baseline Metrics', 14, true, [59, 130, 246]);
    y += 2;
    addText(`Overall Confidence: ${report.overallConfidence}`, 11);
    addText(`Data Points: ${report.baseline.dataPoints}`, 11);
    addSectionGap();

    // Behavioral Deviations
    if (report.deviations.length > 0) {
      addText('Behavioral Deviations', 14, true, [59, 130, 246]);
      y += 2;
      report.deviations.forEach((deviation, i) => {
        addText(`${i + 1}. ${deviation.description}`, 11, true);
        addText(`   ${deviation.explanation}`, 10, false, [80, 80, 80]);
        if (deviation.severity === 'notable') {
          addText('   Severity: Notable', 10, false, [200, 120, 0]);
        }
        y += 2;
      });
      addSectionGap();
    }

    // Correlations
    if (report.correlations.length > 0) {
      addText('Detected Patterns', 14, true, [59, 130, 246]);
      y += 2;
      report.correlations.forEach((correlation, i) => {
        addText(`${i + 1}. ${correlation.description}`, 11);
        addText(`   Confidence: ${correlation.confidence}`, 10, false, [80, 80, 80]);
        y += 2;
      });
      addSectionGap();
    }

    // Insights
    if (report.insights.length > 0) {
      addText('Key Insights', 14, true, [59, 130, 246]);
      y += 2;
      report.insights.forEach((insight, i) => {
        addText(`${i + 1}. ${insight.insight}`, 11);
        y += 2;
      });
      addSectionGap();
    }

    // Disclaimer
    addSectionGap();
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, 190, y);
    y += 6;
    addText('Disclaimer', 12, true, [150, 50, 50]);
    addText(
      'This report is generated from parent-logged data and is intended to support — not replace — ' +
      'professional clinical assessment. All patterns are based on the child\'s own historical data, ' +
      'not external comparisons. Please consult with qualified healthcare professionals for diagnosis and treatment.',
      9, false, [120, 120, 120]
    );

    doc.save(`aucare-report-${dateRange.start}-to-${dateRange.end}.pdf`);

    toast({
      title: 'PDF Report Exported',
      description: 'Your behavioral report has been downloaded as a PDF.',
    });
  };

  const handleShare = async () => {
    if (!user || !childProfile) return;
    const token = generateShareToken();
    try {
      await createSharedReport({
        child_id: childProfile.id || null,
        share_token: token,
        report_type: 'behavioral',
        date_range_start: dateRange.start,
        date_range_end: dateRange.end,
        report_data: {
          ...report,
          childName: childProfile?.name,
          sharedAt: new Date().toISOString(),
        },
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // Also save to localStorage for fallback offline viewing
      localStorage.setItem(`shared-report-${token}`, JSON.stringify({
        ...report,
        childName: childProfile?.name,
        sharedAt: new Date().toISOString(),
      }));

      const link = `${window.location.origin}/shared-report/${token}`;
      setShareLink(link);
      toast({
        title: 'Report Shared',
        description: 'Share this link with your therapist for read-only access.',
      });
    } catch (err) {
      console.error('Error sharing report:', err);
      toast({
        title: 'Error',
        description: 'Failed to generate share link. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Link Copied',
        description: 'Share this link with your therapist for read-only access.',
      });
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'trends', label: 'Trends', icon: TrendingUp },
    { id: 'correlations', label: 'Patterns', icon: Lightbulb },
    { id: 'daily', label: 'Daily', icon: FileText },
  ] as const;

  const emotionLabels: Record<string, string> = {
    happy: '😊 Happy',
    calm: '😌 Calm',
    anxious: '😰 Anxious',
    upset: '😠 Upset',
  };

  return (
    <div className="page-container pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/dashboard" className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold font-display">Behavioral Reports</h1>
          <p className="text-sm text-muted-foreground">
            {childProfile?.name ? `${childProfile.name}'s` : "Your child's"} insights
          </p>
        </div>
        <ConfidenceBadge 
          level={report.overallConfidence} 
          explanation={`Based on ${report.baseline.dataPoints} data points`}
        />
      </div>

      {isLoading && (
        <div className="card-elevated p-5 mb-6">
          <p className="text-sm text-muted-foreground">Loading your entries…</p>
        </div>
      )}

      {/* Date Range Selector */}
      <div className="card-elevated p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Date Range</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">From</label>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="input-calm text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">To</label>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="input-calm text-sm"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-6">
        <Button onClick={handleExport} variant="outline" className="flex-1">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
        <Button onClick={handleShare} variant="outline" className="flex-1">
          <Share2 className="w-4 h-4 mr-2" />
          Share with Therapist
        </Button>
      </div>

      {!isLoading && report.baseline.dataPoints === 0 && (
        <div className="card-elevated p-5 mb-6 border-2 border-warning/20 bg-warning/5">
          <p className="text-sm font-medium mb-2">No data found in this date range</p>
          <p className="text-sm text-muted-foreground">
            Start logging routines and behaviors in the app and they will appear here.
          </p>
        </div>
      )}

      {/* Share Link Display */}
      {shareLink && (
        <div className="card-elevated p-4 mb-6 border-2 border-primary/20 bg-primary/5">
          <p className="text-sm font-medium mb-2">Shareable Link (Read-Only)</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-background p-2 rounded-lg truncate">
              {shareLink}
            </code>
            <Button size="sm" variant="ghost" onClick={handleCopyLink}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Therapists can view this report but cannot edit or access other data.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-muted/50 rounded-xl">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5',
              activeTab === id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4 animate-fade-in">
          {/* Baseline Summary */}
          <div className="card-elevated p-5">
            <h3 className="font-semibold mb-4">Behavioral Baseline</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-primary">{report.baseline.dataPoints}</p>
                <p className="text-xs text-muted-foreground">Total Data Points</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-secondary-foreground">
                  {report.dailySummaries.filter(d => d.routineCount > 0 || d.behaviorCount > 0).length}
                </p>
                <p className="text-xs text-muted-foreground">Days with Entries</p>
              </div>
            </div>
            
            {report.baseline.dominantEmotions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-2">Most observed emotions:</p>
                <div className="flex flex-wrap gap-2">
                  {report.baseline.dominantEmotions.map((emotion) => (
                    <span key={emotion} className="px-3 py-1 bg-secondary rounded-full text-sm">
                      {emotionLabels[emotion] || emotion}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Insights */}
          {report.insights.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Key Insights</h3>
              <div className="space-y-3">
                {report.insights.map((insight, i) => (
                  <InsightCard key={i} insight={insight} />
                ))}
              </div>
            </div>
          )}

          {/* Deviations */}
          {report.deviations.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Recent Changes Detected</h3>
              <div className="space-y-2">
                {report.deviations.map((deviation, i) => (
                  <div key={i} className={cn(
                    'card-elevated p-4',
                    deviation.severity === 'notable' && 'border-warning/30 bg-warning/5'
                  )}>
                    <p className="font-medium text-sm">{deviation.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{deviation.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.baseline.dataPoints < 10 && (
            <div className="card-elevated p-4 border-2 border-info/20 bg-info/5">
              <p className="text-sm">
                <strong>Building your baseline:</strong> Continue logging daily routines and behaviors. 
                More data means more accurate and personalized insights.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-4 animate-fade-in">
          {/* Weekly trend indicator */}
          {behaviorPrediction && (
            <div className={cn(
              'card-elevated p-4 border-2',
              behaviorPrediction.weeklyPattern.trend === 'improving' && 'border-success/30 bg-success/5',
              behaviorPrediction.weeklyPattern.trend === 'stable' && 'border-info/30 bg-info/5',
              behaviorPrediction.weeklyPattern.trend === 'concerning' && 'border-warning/30 bg-warning/5',
            )}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Weekly Trend</span>
                <span className={cn('text-sm font-semibold',
                  behaviorPrediction.weeklyPattern.trend === 'improving' && 'text-success',
                  behaviorPrediction.weeklyPattern.trend === 'stable' && 'text-info',
                  behaviorPrediction.weeklyPattern.trend === 'concerning' && 'text-warning',
                )}>
                  {behaviorPrediction.weeklyPattern.trend === 'improving' ? 'Improving' :
                   behaviorPrediction.weeklyPattern.trend === 'stable' ? 'Stable' : 'Needs Attention'}
                </span>
              </div>
              {behaviorPrediction.weeklyPattern.calmestDays.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Calmest on: {behaviorPrediction.weeklyPattern.calmestDays.join(', ')}
                </p>
              )}
            </div>
          )}

          <div className="card-elevated p-5">
            <h3 className="font-semibold mb-4">Behavior Intensity Trend</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {report.dailySummaries.map((day) => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16">
                    {format(parseISO(day.date), 'MMM d')}
                  </span>
                  <div className="flex-1 h-6 bg-muted/30 rounded-full overflow-hidden">
                    {day.avgIntensity !== null ? (
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          day.avgIntensity <= 1.5 ? 'bg-success' :
                          day.avgIntensity <= 2.5 ? 'bg-warning' : 'bg-destructive'
                        )}
                        style={{ width: `${(day.avgIntensity / 3) * 100}%` }}
                      />
                    ) : (
                      <div className="h-full rounded-full bg-muted/50 border border-dashed border-muted-foreground/20"
                        style={{ width: '15%' }} />
                    )}
                  </div>
                  <span className="text-xs font-medium w-20 text-right">
                    {day.avgIntensity !== null
                      ? (day.dominantEmotion ? emotionLabels[day.dominantEmotion] || day.dominantEmotion : '-')
                      : <span className="text-muted-foreground/50">No data</span>
                    }
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Based on {childProfile?.name || "your child"}'s own historical patterns, not external comparisons.
            </p>
          </div>

          {/* Routine Frequency */}
          <div className="card-elevated p-5">
            <h3 className="font-semibold mb-4">Routine Logging Frequency</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-secondary/50 rounded-xl">
                <p className="text-lg font-bold">{report.baseline.avgSleepEntries.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Sleep/day</p>
              </div>
              <div className="text-center p-3 bg-accent/50 rounded-xl">
                <p className="text-lg font-bold">{report.baseline.avgFoodEntries.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Food/day</p>
              </div>
              <div className="text-center p-3 bg-info/10 rounded-xl">
                <p className="text-lg font-bold">{report.baseline.avgActivityEntries.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Activities/day</p>
              </div>
              <div className="text-center p-3 bg-success/10 rounded-xl">
                <p className="text-lg font-bold">{report.baseline.avgTherapyEntries.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Therapy/day</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'correlations' && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-sm text-muted-foreground">
            Patterns between routines and behaviors, based on {childProfile?.name || "your child"}'s own data.
          </p>

          {/* Correlation cards */}
          {report.correlations.length > 0 && (
            report.correlations.map((correlation, i) => (
              <CorrelationCard key={i} correlation={correlation} />
            ))
          )}

          {/* Pattern highlights (always shown if available) */}
          {patternHighlights.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 text-sm">Detected Patterns</h3>
              <div className="space-y-3">
                {patternHighlights.map((ph, i) => (
                  <div key={i} className="card-elevated p-4">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium text-sm capitalize">{ph.pattern}</p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full',
                        ph.confidence === 'high' ? 'bg-success/20 text-success' :
                        ph.confidence === 'medium' ? 'bg-info/20 text-info' : 'bg-muted text-muted-foreground'
                      )}>
                        {ph.confidence} confidence
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{ph.description}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">{ph.example}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Behavior predictions */}
          {behaviorPrediction && behaviorPrediction.riskWindows.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 text-sm">Day-of-Week Patterns</h3>
              <div className="space-y-2">
                {behaviorPrediction.riskWindows.map((rw, i) => (
                  <div key={i} className="card-elevated p-3 flex items-center justify-between">
                    <span className="text-sm font-medium">{rw.dayOfWeek}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                      rw.probability === 'high' ? 'bg-destructive/20 text-destructive' :
                      rw.probability === 'medium' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'
                    )}>
                      {rw.probability} intensity
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state only when nothing at all */}
          {report.correlations.length === 0 && patternHighlights.length === 0 && (
            <div className="card-elevated p-6 text-center">
              <p className="text-muted-foreground">
                {report.baseline.dataPoints > 0
                  ? 'Continue logging to build stronger patterns. Patterns emerge as more data is collected.'
                  : 'Start logging routines and behaviors to discover patterns.'}
              </p>
            </div>
          )}

          <DisclaimerBanner />
        </div>
      )}

      {activeTab === 'daily' && (
        <div className="space-y-3 animate-fade-in">
          {report.dailySummaries.length > 0 ? (
            report.dailySummaries.slice().reverse().map((day) => (
              <div key={day.date} className="card-elevated p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{format(parseISO(day.date), 'EEEE, MMM d')}</span>
                  {day.dominantEmotion && (
                    <span className="text-sm">{emotionLabels[day.dominantEmotion] || day.dominantEmotion}</span>
                  )}
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>{day.routineCount} routines</span>
                  <span>{day.behaviorCount} behaviors</span>
                  {day.routineTypes.length > 0 && (
                    <span className="capitalize">{day.routineTypes.join(', ')}</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="card-elevated p-6 text-center">
              <p className="text-muted-foreground">No entries in this date range.</p>
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default Reports;
