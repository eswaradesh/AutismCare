import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Trash2, Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getTherapistAvailability, addTherapistAvailability, deleteTherapistAvailability } from '@/lib/therapistApi';

interface Availability {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
}

interface TherapistAvailabilityProps {
  therapistId: string;
  readOnly?: boolean;
}

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const TherapistAvailability = ({
  therapistId,
  readOnly = false,
}: TherapistAvailabilityProps) => {
  const { toast } = useToast();
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    day_of_week: 'monday',
    start_time: '09:00',
    end_time: '10:00',
    slot_duration_minutes: 30,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadAvailabilities();
  }, [therapistId]);

  const loadAvailabilities = async () => {
    try {
      const data = await getTherapistAvailability(therapistId);
      setAvailabilities(data || []);
    } catch (err) {
      console.error('Error loading availabilities:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAvailability = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate times
    if (formData.start_time >= formData.end_time) {
      toast({
        title: 'Invalid Time',
        description: 'End time must be after start time',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await addTherapistAvailability(therapistId, {
        day_of_week: formData.day_of_week,
        start_time: formData.start_time,
        end_time: formData.end_time,
        slot_duration_minutes: formData.slot_duration_minutes,
        is_active: true,
      });

      toast({
        title: 'Availability Added',
        description: 'Your availability has been updated.',
      });

      setFormData({
        day_of_week: 'monday',
        start_time: '09:00',
        end_time: '10:00',
        slot_duration_minutes: 30,
      });
      setShowForm(false);
      loadAvailabilities();
    } catch (err) {
      console.error('Error adding availability:', err);
      toast({
        title: 'Error',
        description: 'Failed to add availability',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAvailability = async (availabilityId: string) => {
    if (!confirm('Remove this time slot?')) return;

    setDeleting(availabilityId);
    try {
      await deleteTherapistAvailability(availabilityId);

      toast({
        title: 'Slot Removed',
      });

      loadAvailabilities();
    } catch (err) {
      console.error('Error deleting availability:', err);
      toast({
        title: 'Error',
        description: 'Failed to remove slot',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Availability Schedule</h3>
      </div>

      {!readOnly && (
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full py-2 px-4 rounded-lg border-2 border-dashed border-primary/30 text-primary text-sm font-semibold hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Time Slot
        </button>
      )}

      {showForm && !readOnly && (
        <div className="card-elevated p-5 border-2 border-primary/20 bg-primary/5">
          <form onSubmit={handleAddAvailability} className="space-y-3">
            {/* Day of Week */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Day
              </label>
              <select
                value={formData.day_of_week}
                onChange={(e) =>
                  setFormData({ ...formData, day_of_week: e.target.value })
                }
                className="w-full input-calm text-sm"
              >
                {DAYS_OF_WEEK.map(day => (
                  <option key={day} value={day}>
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Start
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) =>
                    setFormData({ ...formData, start_time: e.target.value })
                  }
                  className="w-full input-calm text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  End
                </label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) =>
                    setFormData({ ...formData, end_time: e.target.value })
                  }
                  className="w-full input-calm text-sm"
                  required
                />
              </div>
            </div>

            {/* Slot Duration */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Slot Duration (minutes)
              </label>
              <select
                value={formData.slot_duration_minutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    slot_duration_minutes: parseInt(e.target.value),
                  })
                }
                className="w-full input-calm text-sm"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className={cn(
                  'flex-1 py-2 rounded-lg font-semibold text-sm transition-all',
                  saving
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'btn-primary-gradient'
                )}
              >
                {saving ? 'Saving...' : 'Add Slot'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Availability List */}
      {availabilities.length > 0 ? (
        <div className="space-y-2">
          {availabilities.map(avail => (
            <div key={avail.id} className="card-elevated p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-info" />
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {avail.day_of_week.charAt(0).toUpperCase() +
                      avail.day_of_week.slice(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {avail.start_time} - {avail.end_time} ({avail.slot_duration_minutes}min slots)
                  </p>
                </div>
              </div>
              {!readOnly && (
                <button
                  onClick={() => handleDeleteAvailability(avail.id)}
                  disabled={deleting === avail.id}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card-elevated p-4 text-center">
          <Calendar className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            {readOnly
              ? 'No availability set yet'
              : 'No time slots set. Add your availability to accept bookings!'}
          </p>
        </div>
      )}
    </div>
  );
};

export default TherapistAvailability;
