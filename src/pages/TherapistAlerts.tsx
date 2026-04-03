import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, AlertTriangle, Check, Clock, MessageSquare, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  acknowledgeTherapistAlert,
  acknowledgeTherapistIntensityAlert,
  getTherapistAlerts,
  getTherapistIntensityAlerts,
} from '@/lib/therapistApi';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';
import { cn } from '@/lib/utils';

interface BehaviorAlert {
  id: string;
  child_id: string;
  child_name: string;
  parent_id: string;
  parent_name: string;
  emotion: string;
  intensity: 'low' | 'moderate' | 'high';
  notes: string;
  alert_type: string;
  created_at: string;
  reviewed: boolean;
  review: {
    id: string;
    response_note: string;
    acknowledged: boolean;
    reviewed_at: string | null;
  } | null;
}

interface IntensityAlert {
  id: string;
  parent_id: string;
  parent_name: string;
  child_id: string;
  child_name: string;
  consecutive_high_count: number;
  alert_sent_at: string;
  acknowledged: boolean;
  created_at: string;
}

const TherapistAlerts = () => {
  const navigate = useNavigate();
  const { user, therapistProfile } = useAuth();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<BehaviorAlert[]>([]);
  const [intensityAlerts, setIntensityAlerts] = useState<IntensityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unreviewed' | 'reviewed'>('unreviewed');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [responseNotes, setResponseNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !therapistProfile) return;
    setLoading(true);
    Promise.all([loadAlerts(), loadIntensityAlerts()]).finally(() => setLoading(false));
  }, [user, therapistProfile, filter]);

  const loadAlerts = async () => {
    if (!user) return;

    try {
      const data = await getTherapistAlerts(user.id);

      let processedAlerts = (data || []).map((alert) => ({
        id: alert.id,
        child_id: alert.child_id,
        child_name: alert.child_name || 'Unknown Child',
        parent_id: alert.parent_id,
        parent_name: alert.parent_name || 'Unknown Parent',
        emotion: alert.emotion,
        intensity: (alert.intensity as 'low' | 'moderate' | 'high') || 'moderate',
        notes: alert.notes || '',
        alert_type: alert.alert_type,
        created_at: alert.created_at,
        reviewed: alert.reviewed,
        review: alert.review,
      }));

      if (filter === 'unreviewed') {
        processedAlerts = processedAlerts.filter(a => !a.reviewed);
      } else if (filter === 'reviewed') {
        processedAlerts = processedAlerts.filter(a => a.reviewed);
      }

      setAlerts(processedAlerts);
    } catch (err) {
      console.error('Error loading alerts:', err);
      toast({
        title: 'Error',
        description: 'Failed to load alerts',
        variant: 'destructive',
      });
    }
  };

  const loadIntensityAlerts = async () => {
    if (!user) return;

    try {
      const data = await getTherapistIntensityAlerts(user.id);

      const processedAlerts: IntensityAlert[] = (data || []).map((alert) => ({
        id: alert.id,
        parent_id: alert.parent_id,
        parent_name: alert.parent_name || 'Unknown Parent',
        child_id: alert.child_id,
        child_name: alert.child_name || 'Unknown Child',
        consecutive_high_count: alert.consecutive_high_count,
        alert_sent_at: alert.alert_sent_at,
        acknowledged: alert.acknowledged || false,
        created_at: alert.created_at,
      }));

      setIntensityAlerts(processedAlerts);
    } catch (err) {
      console.error('Error loading intensity alerts:', err);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string, childId: string) => {
    if (!user) return;

    setSaving(alertId);
    try {
      await acknowledgeTherapistAlert(user.id, alertId, {
        response_note: responseNotes[alertId] || null,
      });

      toast({
        title: 'Alert Acknowledged',
        description: 'You have acknowledged this behavior alert.',
      });

      setResponseNotes({ ...responseNotes, [alertId]: '' });
      loadAlerts();
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      toast({
        title: 'Error',
        description: 'Failed to acknowledge alert',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const handleAcknowledgeIntensityAlert = async (alertId: string) => {
    if (!user) return;

    setSaving(alertId);
    try {
      await acknowledgeTherapistIntensityAlert(user.id, alertId);

      toast({
        title: 'Alert Acknowledged',
        description: 'Intensity alert has been acknowledged.',
      });

      loadIntensityAlerts();
    } catch (err) {
      console.error('Error acknowledging intensity alert:', err);
      toast({
        title: 'Error',
        description: 'Failed to acknowledge alert',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const getIntensityColor = (intensity: string) => {
    return intensity === 'high'
      ? 'bg-destructive/20 text-destructive'
      : intensity === 'moderate'
        ? 'bg-warning/20 text-warning'
        : 'bg-info/20 text-info';
  };

  const unacknowledgedIntensity = intensityAlerts.filter(a => !a.acknowledged);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading alerts...</div>
      </div>
    );
  }

  return (
    <div className="page-container pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/therapist/dashboard')}
          className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold font-display">Behavior Alerts</h1>
          <p className="text-sm text-muted-foreground">Review sudden behavior changes from parents</p>
        </div>
      </div>

      {/* Automatic Intensity Alerts Section */}
      {unacknowledgedIntensity.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-sm">Automatic High-Intensity Alerts ({unacknowledgedIntensity.length})</h2>
          </div>
          <div className="space-y-3">
            {unacknowledgedIntensity.map(alert => (
              <div
                key={alert.id}
                className="card-elevated p-4 border-2 border-amber-400/30 bg-amber-50/10"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <h3 className="font-semibold text-sm">{alert.child_name}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-600">
                        {alert.consecutive_high_count}× High
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{alert.parent_name}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {alert.alert_sent_at && format(parseISO(alert.alert_sent_at), 'MMM d, h:mm a')}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {alert.consecutive_high_count} consecutive high-intensity behavior entries detected. Review recommended.
                </p>
                <button
                  onClick={() => handleAcknowledgeIntensityAlert(alert.id)}
                  disabled={saving === alert.id}
                  className={cn(
                    'w-full py-2 rounded-lg font-semibold text-sm transition-all',
                    saving === alert.id
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-amber-500 text-white hover:bg-amber-600'
                  )}
                >
                  {saving === alert.id ? 'Saving...' : 'Acknowledge'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'unreviewed', 'reviewed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground'
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'unreviewed' && alerts.filter(a => !a.reviewed).length > 0 && (
              <span className="ml-2 inline-block w-5 h-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center">
                {alerts.filter(a => !a.reviewed).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <div className="card-elevated p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">
            {filter === 'unreviewed'
              ? 'No unreviewed alerts'
              : filter === 'reviewed'
                ? 'No reviewed alerts'
                : 'No alerts yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={cn(
                'card-elevated p-4 cursor-pointer transition-all border-2',
                alert.reviewed
                  ? 'border-success/20 bg-success/5'
                  : 'border-destructive/20 bg-destructive/5'
              )}
              onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{alert.child_name}</h3>
                    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', getIntensityColor(alert.intensity))}>
                      {alert.intensity}
                    </span>
                    {alert.reviewed && <Check className="w-4 h-4 text-success" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.parent_name}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(parseISO(alert.created_at), 'MMM d, h:mm a')}
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {alert.emotion}
                </div>
              </div>

              {expandedAlert === alert.id && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm mb-4">{alert.notes}</p>

                  {alert.review ? (
                    <div className="bg-success/10 rounded-lg p-3 mb-4">
                      <p className="text-xs font-semibold text-success mb-1">Reviewed</p>
                      {alert.review.response_note && (
                        <p className="text-sm">{alert.review.response_note}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {alert.review.reviewed_at && format(parseISO(alert.review.reviewed_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <textarea
                        value={responseNotes[alert.id] || ''}
                        onChange={(e) =>
                          setResponseNotes({ ...responseNotes, [alert.id]: e.target.value })
                        }
                        placeholder="Add a response note (optional)..."
                        className="w-full input-calm min-h-[80px] resize-none text-sm"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcknowledgeAlert(alert.id, alert.child_id);
                        }}
                        disabled={saving === alert.id}
                        className={cn(
                          'w-full py-2 rounded-lg font-semibold text-sm transition-all',
                          saving === alert.id
                            ? 'bg-muted text-muted-foreground'
                            : 'btn-primary-gradient'
                        )}
                      >
                        {saving === alert.id ? 'Saving...' : 'Acknowledge Alert'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Acknowledged Intensity Alerts */}
      {intensityAlerts.filter(a => a.acknowledged).length > 0 && (
        <section className="mt-6">
          <h3 className="font-semibold text-sm text-muted-foreground mb-3">
            Past Intensity Alerts ({intensityAlerts.filter(a => a.acknowledged).length})
          </h3>
          <div className="space-y-2">
            {intensityAlerts.filter(a => a.acknowledged).slice(0, 5).map(alert => (
              <div key={alert.id} className="card-elevated p-3 opacity-60">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  <span className="text-sm font-medium">{alert.child_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {alert.consecutive_high_count}× high • {alert.alert_sent_at && format(parseISO(alert.alert_sent_at), 'MMM d')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <BottomNav />
    </div>
  );
};

export default TherapistAlerts;
