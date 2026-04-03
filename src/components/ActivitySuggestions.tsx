import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Lightbulb, Calendar, Target, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  createTherapistSuggestion,
  deleteTherapistSuggestion,
  getTherapistSuggestions,
  getParentChildSuggestions,
} from '@/lib/therapistApi';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface ActivitySuggestion {
  id: string;
  therapist_id: string;
  child_id: string;
  parent_id?: string;
  title: string;
  description: string;
  related_pattern: string | null;
  suggested_frequency: string | null;
  status: string;
  created_at: string;
}

interface ActivitySuggestionsProps {
  childId: string;
  readOnly?: boolean;
}

const SOFT_DELETE_MARKER = '__deleted__';

const FREQUENCY_OPTIONS = ['daily', 'weekly', '2-3 times/week', 'as needed'];

const ActivitySuggestions: React.FC<ActivitySuggestionsProps> = ({ childId, readOnly = false }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<ActivitySuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    related_pattern: '',
    suggested_frequency: 'daily',
  });

  useEffect(() => {
    if (childId) loadSuggestions();
  }, [childId, readOnly, user?.id]);

  const loadSuggestions = async () => {
    try {
      if (!user) return;
      // For parent (readOnly) view, use parent-accessible endpoint
      const apiData = readOnly
        ? await getParentChildSuggestions(childId)
        : await getTherapistSuggestions(user.id, childId);
      setSuggestions(
        apiData
          .map((s) => ({
            id: s.id,
            therapist_id: s.therapist_id,
            child_id: s.child_id,
            parent_id: s.parent_id,
            title: s.title || 'Untitled',
            description: s.description || '',
            related_pattern: s.related_pattern || null,
            suggested_frequency: s.suggested_frequency || null,
            status: s.status || 'active',
            created_at: s.created_at,
          }))
          .filter(
            (s: ActivitySuggestion) =>
              s.status !== 'deleted' &&
              s.title !== SOFT_DELETE_MARKER &&
              s.related_pattern !== SOFT_DELETE_MARKER
          )
      );
    } catch (err) {
      console.error('Error loading suggestions:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title.trim()) return;

    setSaving(true);
    try {
      await createTherapistSuggestion(user.id, childId, {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        related_pattern: formData.related_pattern.trim() || null,
        suggested_frequency: formData.suggested_frequency || null,
      });

      toast({ title: 'Suggestion Added', description: 'Activity suggestion has been saved.' });
      setFormData({ title: '', description: '', related_pattern: '', suggested_frequency: 'daily' });
      setShowForm(false);
      loadSuggestions();
    } catch (err) {
      console.error('Error adding suggestion:', err);
      const message =
        err instanceof Error
          ? err.message
          : (err as any)?.message || (err as any)?.details || 'Failed to save suggestion';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;

    try {
      await deleteTherapistSuggestion(user.id, id);

      toast({ title: 'Deleted', description: 'Suggestion removed.' });
      loadSuggestions();
    } catch (err) {
      console.error('Error deleting suggestion:', err);
      const message =
        err instanceof Error
          ? err.message
          : (err as any)?.message || (err as any)?.details || 'Failed to delete suggestion';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        Loading suggestions...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Activity Suggestions</h3>
          {suggestions.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {suggestions.length}
            </span>
          )}
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center transition-all hover:scale-105"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Add Form (therapist only) */}
      {!readOnly && showForm && (
        <form onSubmit={handleAdd} className="card-elevated p-4 space-y-3 border-2 border-primary/20">
          <input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Activity title *"
            className="w-full input-calm text-sm"
            required
          />
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Description and instructions..."
            className="w-full input-calm min-h-[80px] resize-none text-sm"
          />
          <input
            value={formData.related_pattern}
            onChange={(e) => setFormData({ ...formData, related_pattern: e.target.value })}
            placeholder="Related behavior pattern (optional)"
            className="w-full input-calm text-sm"
          />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Suggested Frequency</label>
            <div className="flex gap-2 flex-wrap">
              {FREQUENCY_OPTIONS.map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setFormData({ ...formData, suggested_frequency: freq })}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    formData.suggested_frequency === freq
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {freq}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={saving || !formData.title.trim()}
            className={cn(
              'w-full py-2.5 rounded-lg font-semibold text-sm transition-all',
              saving ? 'bg-muted text-muted-foreground' : 'btn-primary-gradient'
            )}
          >
            {saving ? 'Saving...' : 'Add Suggestion'}
          </button>
        </form>
      )}

      {/* Suggestions List */}
      {suggestions.length === 0 ? (
        <div className="card-elevated p-6 text-center">
          <Lightbulb className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            {readOnly ? 'No activity suggestions yet.' : 'No suggestions yet. Add one above!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="card-elevated p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-sm">{suggestion.title}</h4>
                  </div>
                  {suggestion.description && (
                    <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {suggestion.suggested_frequency && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {suggestion.suggested_frequency}
                      </span>
                    )}
                    {suggestion.related_pattern && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-muted/50 text-muted-foreground">
                        {suggestion.related_pattern}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(suggestion.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
                {!readOnly && suggestion.therapist_id === user?.id && (
                  <button
                    onClick={() => handleDelete(suggestion.id)}
                    className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivitySuggestions;
