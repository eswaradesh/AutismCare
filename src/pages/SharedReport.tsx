import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, Eye, AlertCircle, Heart } from 'lucide-react';
import { BehavioralReport } from '@/lib/analytics';
import ConfidenceBadge from '@/components/ConfidenceBadge';
import { InsightCard, CorrelationCard } from '@/components/InsightCard';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import { getSharedReport } from '@/lib/therapistApi';
import { cn } from '@/lib/utils';

interface SharedReportData extends BehavioralReport {
  childName?: string;
  sharedAt: string;
}

const SharedReport = () => {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<SharedReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const fetchReport = async () => {
      try {
        const data = await getSharedReport(token);
        if (!cancelled) {
          setReport(data);
        }
      } catch {
        // Fall back to localStorage if backend call fails
        const stored = localStorage.getItem(`shared-report-${token}`);
        if (!cancelled) {
          if (stored) {
            setReport(JSON.parse(stored));
          } else {
            setError('Report not found or link has expired.');
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchReport();

    return () => { cancelled = true; };
  }, [token]);

  const emotionLabels: Record<string, string> = {
    happy: '😊 Happy',
    calm: '😌 Calm',
    anxious: '😰 Anxious',
    upset: '😠 Upset',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading report...</div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h1 className="text-xl font-bold mb-2">Report Not Available</h1>
        <p className="text-muted-foreground mb-6">{error || 'This report link is invalid.'}</p>
        <Link to="/" className="text-primary font-medium">Go to AutismCare</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Read-Only Banner */}
      <div className="bg-info/10 border-b border-info/20 py-3 px-4">
        <div className="max-w-lg mx-auto flex items-center gap-2 text-sm text-info">
          <Eye className="w-4 h-4" />
          <span>Read-Only Therapist View</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold font-display">AutismCare Report</h1>
            <p className="text-sm text-muted-foreground">
              {report.childName ? `${report.childName}'s` : "Child's"} behavioral insights
            </p>
          </div>
          <ConfidenceBadge level={report.overallConfidence} />
        </div>

        {/* Report Metadata */}
        <div className="card-elevated p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Date Range</p>
              <p className="font-medium">
                {format(parseISO(report.dateRange.start), 'MMM d')} - {format(parseISO(report.dateRange.end), 'MMM d, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Data Points</p>
              <p className="font-medium">{report.baseline.dataPoints}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Generated</p>
              <p className="font-medium">{format(parseISO(report.generatedAt), 'MMM d, yyyy')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Days Tracked</p>
              <p className="font-medium">{report.dailySummaries.filter(d => d.routineCount > 0).length}</p>
            </div>
          </div>
        </div>

        {/* Baseline */}
        <section className="mb-6">
          <h2 className="font-semibold mb-3">Behavioral Baseline</h2>
          <div className="card-elevated p-4">
            {report.baseline.dominantEmotions.length > 0 && (
              <div className="mb-4">
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
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/30 rounded-lg p-2">
                <span className="text-muted-foreground">Avg Sleep Logs:</span>
                <span className="font-medium ml-2">{report.baseline.avgSleepEntries.toFixed(1)}/day</span>
              </div>
              <div className="bg-muted/30 rounded-lg p-2">
                <span className="text-muted-foreground">Avg Therapy:</span>
                <span className="font-medium ml-2">{report.baseline.avgTherapyEntries.toFixed(1)}/day</span>
              </div>
            </div>
          </div>
        </section>

        {/* Insights */}
        {report.insights.length > 0 && (
          <section className="mb-6">
            <h2 className="font-semibold mb-3">Key Insights</h2>
            <div className="space-y-3">
              {report.insights.map((insight, i) => (
                <InsightCard key={i} insight={insight} />
              ))}
            </div>
          </section>
        )}

        {/* Correlations */}
        {report.correlations.length > 0 && (
          <section className="mb-6">
            <h2 className="font-semibold mb-3">Routine-Behavior Patterns</h2>
            <div className="space-y-3">
              {report.correlations.map((correlation, i) => (
                <CorrelationCard key={i} correlation={correlation} />
              ))}
            </div>
          </section>
        )}

        {/* Deviations */}
        {report.deviations.length > 0 && (
          <section className="mb-6">
            <h2 className="font-semibold mb-3">Recent Changes</h2>
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
          </section>
        )}

        {/* Daily Summaries */}
        <section className="mb-6">
          <h2 className="font-semibold mb-3">Daily Log Summary</h2>
          <div className="card-elevated p-4 max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2">Date</th>
                  <th className="text-center">Routines</th>
                  <th className="text-center">Behaviors</th>
                  <th className="text-right">Emotion</th>
                </tr>
              </thead>
              <tbody>
                {report.dailySummaries.slice().reverse().slice(0, 14).map((day) => (
                  <tr key={day.date} className="border-b border-border/50 last:border-0">
                    <td className="py-2">{format(parseISO(day.date), 'MMM d')}</td>
                    <td className="text-center">{day.routineCount}</td>
                    <td className="text-center">{day.behaviorCount}</td>
                    <td className="text-right text-xs">
                      {day.dominantEmotion ? (emotionLabels[day.dominantEmotion] || day.dominantEmotion) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <DisclaimerBanner />

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <p>Powered by AutismCare - Compassionate Care Support</p>
          <p className="mt-1">This is a read-only view shared by the parent.</p>
        </div>
      </div>
    </div>
  );
};

export default SharedReport;
