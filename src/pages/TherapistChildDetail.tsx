import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { format, parseISO, subDays } from 'date-fns';
import { 
  ChevronLeft, User, Calendar, TrendingUp, AlertTriangle, 
  FileText, Lightbulb, Clock, Heart, Stethoscope, Trash2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { RoutineEntry, BehaviorEntry } from '@/contexts/DataContext';
import {
  getTherapistChildEntries,
  createTherapistNote,
  deleteTherapistNote,
  getTherapistChildProfile,
  getTherapistNotes,
} from '@/lib/therapistApi';
import { 
  generateBehavioralReport, 
  predictBehaviorTendencies, 
  highlightPatterns
} from '@/lib/analytics';
import { InsightCard } from '@/components/InsightCard';
import ConfidenceBadge from '@/components/ConfidenceBadge';
import ActivitySuggestions from '@/components/ActivitySuggestions';
import BottomNav from '@/components/BottomNav';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ChildData {
  id: string;
  name: string;
  age_years: number;
  age_months: number;
  communication_level: string;
  sensory_preference: string;
}

interface TherapistNote {
  id: string;
  note_text: string;
  note_type: string;
  created_at: string;
}

const TherapistChildDetail = () => {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state || {}) as {
    childName?: string;
    parentName?: string;
    relationshipId?: string;
    childId?: string | null;
  };
  const { user, therapistProfile } = useAuth();
  const { toast } = useToast();
  const [childData, setChildData] = useState<ChildData | null>(null);
  const [parentName, setParentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'patterns' | 'suggestions' | 'notes'>('overview');
  const [notes, setNotes] = useState<TherapistNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [resolvedChildId, setResolvedChildId] = useState<string | null>(null);
  const [childRoutines, setChildRoutines] = useState<RoutineEntry[]>([]);
  const [childBehaviors, setChildBehaviors] = useState<BehaviorEntry[]>([]);
  const [profileAccessBlocked, setProfileAccessBlocked] = useState(false);

  const timeToString = (time: string | null | undefined): string | undefined => {
    if (!time) return undefined;
    if (time.match(/^\d{2}:\d{2}$/)) return time;
    if (time.match(/^\d{2}:\d{2}:\d{2}/)) return time.substring(0, 5);
    return time;
  };

  useEffect(() => {
    if (!childId || !user) return;
    loadChildData();
  }, [childId, user]);

  useEffect(() => {
    if (!childId || !user) return;
    loadNotes();
  }, [childId, user, resolvedChildId]);

  const loadChildEntries = async (targetChildId: string) => {
    try {
      if (!user) return;
      const entries = await getTherapistChildEntries(user.id, targetChildId);

      const mappedRoutines: RoutineEntry[] = (entries.routines || []).map((r) => ({
        id: r.id,
        child_id: r.child_id,
        date: r.date,
        type: r.type,
        startTime: undefined,
        endTime: undefined,
        notes: r.notes || '',
        voiceNote: undefined,
        createdAt: r.created_at,
      }));

      const mappedBehaviors: BehaviorEntry[] = (entries.behaviors || []).map((b) => ({
        id: b.id,
        child_id: b.child_id,
        date: b.date,
        emotion: b.emotion,
        intensity: (b.intensity as 'low' | 'moderate' | 'high') || 'moderate',
        trigger: undefined,
        notes: '',
        isSudden: b.is_sudden || false,
        createdAt: b.created_at,
      }));

      setChildRoutines(mappedRoutines);
      setChildBehaviors(mappedBehaviors);
    } catch (err) {
      console.error('Error loading child entries:', err);
      setChildRoutines([]);
      setChildBehaviors([]);
    }
  };

  const loadChildData = async () => {
    if (!childId || !user) return;

    try {
      const profile = await getTherapistChildProfile(user.id, childId);
      setChildData({
        id: profile.child_id,
        name: profile.child_name,
        age_years: profile.age_years,
        age_months: profile.age_months,
        communication_level: profile.communication_level,
        sensory_preference: profile.sensory_preference,
      });
      setParentName(profile.parent_name || 'Parent');
      setResolvedChildId(profile.child_id);
      setProfileAccessBlocked(false);
      await loadChildEntries(profile.child_id);
    } catch (err) {
      console.error('Error loading child data:', err);
      setProfileAccessBlocked(true);
      if (routeState.childName) {
        setChildData({
          id: childId,
          name: routeState.childName,
          age_years: 0,
          age_months: 0,
          communication_level: 'unknown',
          sensory_preference: 'unknown',
        });
        setParentName(routeState.parentName || 'Parent');
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load child information from backend API',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    if (!childId || !user) return;

    const targetChildId = resolvedChildId || childId;

    try {
      const apiNotes = await getTherapistNotes(user.id, targetChildId);
      setNotes(
        apiNotes.map((n) => ({
          id: n.id,
          note_text: n.note_text,
          note_type: n.note_type,
          created_at: n.created_at,
        }))
      );
    } catch (err) {
      console.error('Error loading notes:', err);
    }
  };

  const handleAddNote = async () => {
    const targetChildId = resolvedChildId || childId;
    if (!targetChildId || !user || !newNote.trim()) return;

    try {
      await createTherapistNote(user.id, targetChildId, {
        note_text: newNote.trim(),
        note_type: 'observational',
      });

      toast({
        title: 'Note Added',
        description: 'Your observational note has been saved.',
      });

      setNewNote('');
      loadNotes();
    } catch (err) {
      console.error('Error adding note:', err);
      toast({
        title: 'Error',
        description: 'Failed to add note',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!user) return;

    try {
      await deleteTherapistNote(user.id, noteId);

      toast({
        title: 'Note Deleted',
        description: 'The note has been removed.',
      });

      loadNotes();
    } catch (err) {
      console.error('Error deleting note:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete note',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!childData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Child not found</p>
          <Link to="/therapist/dashboard" className="text-primary">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Filter entries for this child
  const targetChildId = resolvedChildId || childId;
  const recentChildRoutines = childRoutines.filter(r => r.child_id === targetChildId && r.date && r.date >= format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const recentChildBehaviors = childBehaviors.filter(b => b.child_id === targetChildId && b.date && b.date >= format(subDays(new Date(), 30), 'yyyy-MM-dd'));

  // Generate reports and predictions
  const report = generateBehavioralReport(
    recentChildRoutines,
    recentChildBehaviors,
    format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    format(new Date(), 'yyyy-MM-dd')
  );
  const predictions = predictBehaviorTendencies(recentChildRoutines, recentChildBehaviors);
  const patterns = highlightPatterns(recentChildRoutines, recentChildBehaviors);

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
          <h1 className="text-xl font-bold font-display">{childData.name}</h1>
          <p className="text-sm text-muted-foreground">
            Age: {childData.age_years}y {childData.age_months}m • Parent: {parentName}
          </p>
        </div>
      </div>

      {/* Child Profile Summary */}
      <div className="card-elevated p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Profile Summary</h2>
        </div>
        {profileAccessBlocked && (
          <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            Profile details are restricted by database policies. Apply the latest therapist profile-access migration and refresh.
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Communication</p>
            <p className="text-sm font-medium capitalize">{childData.communication_level}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Sensory Preference</p>
            <p className="text-sm font-medium capitalize">{childData.sensory_preference}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-muted/50 rounded-xl">
        {[
          { id: 'overview', label: 'Overview', icon: FileText },
          { id: 'timeline', label: 'Timeline', icon: Calendar },
          { id: 'patterns', label: 'Patterns', icon: Lightbulb },
          { id: 'suggestions', label: 'Ideas', icon: Lightbulb },
          { id: 'notes', label: 'Notes', icon: Stethoscope },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
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
          {/* Status Indicator */}
          <div className="card-elevated p-4 border-2 border-info/20 bg-info/5">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-info" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Status</p>
                <p className="text-sm text-muted-foreground">
                  {report.deviations.some(d => d.severity === 'notable')
                    ? 'Needs Attention'
                    : 'Stable'}
                </p>
              </div>
              <ConfidenceBadge level={report.overallConfidence} explanation="" />
            </div>
          </div>

          {/* Key Insights */}
          {report.insights.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Key Insights</h3>
              <div className="space-y-3">
                {report.insights.slice(0, 3).map((insight, i) => (
                  <InsightCard key={i} insight={insight} />
                ))}
              </div>
            </div>
          )}

          {/* Behavior Predictions */}
          {predictions && (
            <div className="card-elevated p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-primary" />
                Behavior Tendency Forecast
              </h3>
              <div className="space-y-3">
                {predictions.riskWindows.map((window, i) => (
                  <div key={i} className="p-3 bg-muted/30 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{window.dayOfWeek}</span>
                      <span className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        window.probability === 'high' ? 'bg-destructive/20 text-destructive' :
                        window.probability === 'medium' ? 'bg-warning/20 text-warning' :
                        'bg-info/20 text-info'
                      )}>
                        {window.probability} probability
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{window.explanation}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Confidence: {predictions.confidence} • Based on historical patterns only
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="space-y-4 animate-fade-in">
          <div className="card-elevated p-5">
            <h3 className="font-semibold mb-4">Behavior Timeline</h3>
            <div className="space-y-3">
              {report.dailySummaries.slice(-14).reverse().map((day) => (
                <div key={day.date} className="flex items-center gap-3 pb-3 border-b border-border last:border-0">
                  <span className="text-xs text-muted-foreground w-20">
                    {format(parseISO(day.date), 'MMM d')}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {day.avgIntensity !== null && (
                        <div className={cn(
                          'h-2 flex-1 rounded-full',
                          day.avgIntensity <= 1.5 ? 'bg-success' :
                          day.avgIntensity <= 2.5 ? 'bg-warning' : 'bg-destructive'
                        )} style={{ width: `${(day.avgIntensity / 3) * 100}%` }} />
                      )}
                      {day.dominantEmotion && (
                        <span className="text-xs text-muted-foreground capitalize">
                          {day.dominantEmotion}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {day.routineCount} routines • {day.behaviorCount} behaviors
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'patterns' && (
        <div className="space-y-4 animate-fade-in">
          {patterns.length > 0 ? (
            patterns.map((pattern, i) => (
              <div key={i} className="card-elevated p-5">
                <div className="flex items-start gap-3 mb-2">
                  <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1">{pattern.pattern}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{pattern.description}</p>
                    <p className="text-xs text-muted-foreground italic">{pattern.example}</p>
                  </div>
                  <ConfidenceBadge level={pattern.confidence} explanation="" />
                </div>
              </div>
            ))
          ) : (
            <div className="card-elevated p-6 text-center">
              <p className="text-muted-foreground">
                More data needed to identify patterns. Continue logging for at least 2 weeks.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'suggestions' && (
        <div className="space-y-4 animate-fade-in">
          <ActivitySuggestions
            childId={targetChildId || ''}
            readOnly={false}
          />
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-4 animate-fade-in">
          {/* Add Note */}
          <div className="card-elevated p-5">
            <h3 className="font-semibold mb-4">Add Observational Note</h3>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Enter observational notes (e.g., 'Observed improvement with fixed sleep routine')..."
              className="w-full input-calm min-h-[100px] resize-none mb-3"
            />
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim()}
              className={cn(
                'w-full py-3 rounded-xl font-semibold',
                newNote.trim() ? 'btn-primary-gradient' : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              Add Note
            </button>
            <p className="text-xs text-muted-foreground mt-2">
              Note: These are observational notes only. Do not include diagnoses, prescriptions, or treatment commands.
            </p>
          </div>

          {/* Existing Notes */}
          <div>
            <h3 className="font-semibold mb-3">Your Notes</h3>
            {notes.length === 0 ? (
              <div className="card-elevated p-6 text-center">
                <p className="text-muted-foreground">No notes yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="card-elevated p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm mb-2">{note.note_text}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(note.created_at), 'MMM d, yyyy • h:mm a')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-all"
                        aria-label="Delete note"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-6">
        <DisclaimerBanner compact />
      </div>

      <BottomNav />
    </div>
  );
};

export default TherapistChildDetail;
