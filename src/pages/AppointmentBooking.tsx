import React, { useState, useEffect } from 'react';
import { ChevronLeft, Calendar, Clock, Check, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getLinkedTherapists, getParentAuthToken } from '@/lib/therapistApi';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import { cn } from '@/lib/utils';

interface Therapist {
  id: string;
  full_name: string;
  qualification: string;
  clinic_name: string | null;
}

interface AvailableSlot {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

interface Appointment {
  id: string;
  therapist_id: string;
  therapist_name: string;
  scheduled_date: string;
  scheduled_time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

const AppointmentBooking = () => {
  const navigate = useNavigate();
  const { user, childProfile } = useAuth();
  const { toast } = useToast();

  const [connectedTherapists, setConnectedTherapists] = useState<Therapist[]>([]);
  const [selectedTherapist, setSelectedTherapist] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !childProfile) return;
    loadData();
  }, [user, childProfile]);

  useEffect(() => {
    if (selectedTherapist) {
      loadAvailability(selectedTherapist);
    }
  }, [selectedTherapist]);

  const loadData = async () => {
    if (!user || !childProfile) return;
    try {
      const therapists = await getLinkedTherapists();
      setConnectedTherapists(therapists
        .filter(t => !t.child_id || t.child_id === childProfile.id)
        .map(t => ({
          id: t.therapist_id,
          full_name: t.full_name,
          qualification: '',
          clinic_name: null,
        }))
      );
    } catch (err) {
      console.error('Error loading appointments:', err);
      toast({ title: 'Error', description: 'Failed to load therapists', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async (therapistId: string) => {
    // Availability slots not yet in backend — show empty for now
    setAvailableSlots([]);
  };

  const getUpcomingDatesForDay = (dayName: string): string[] => {
    const dates = [];
    const today = new Date();
    
    // Get next 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      const dayIndex = date.getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      if (dayNames[dayIndex] === dayName.toLowerCase()) {
        dates.push(date.toISOString().split('T')[0]);
      }
    }
    
    return dates;
  };

  const handleBookAppointment = async () => {
    if (!selectedTherapist || !selectedSlot || !bookingDate || !user || !childProfile) return;
    const [, time] = selectedSlot.split('|');
    setSaving(true);
    try {
      // Add to local state (backend appointment endpoint to be added later)
      const therapist = connectedTherapists.find(t => t.id === selectedTherapist);
      setAppointments(prev => [{
        id: `local-${Date.now()}`,
        therapist_id: selectedTherapist,
        therapist_name: therapist?.full_name || 'Therapist',
        scheduled_date: bookingDate,
        scheduled_time: time,
        status: 'scheduled',
      }, ...prev]);
      toast({ title: 'Appointment Booked', description: 'Your appointment has been scheduled.' });
      setSelectedTherapist(null);
      setSelectedSlot(null);
      setBookingDate('');
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to book appointment', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page-container pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold font-display">Book Appointment</h1>
          <p className="text-sm text-muted-foreground">Schedule therapy session with your therapist</p>
        </div>
      </div>

      <DisclaimerBanner compact />

      {connectedTherapists.length === 0 ? (
        <div className="card-elevated p-8 text-center mt-6">
          <AlertCircle className="w-12 h-12 mx-auto text-warning mb-3" />
          <p className="text-muted-foreground mb-4">
            No connected therapists yet. Invite a therapist first.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary-gradient py-2 px-4 rounded-lg text-sm font-semibold"
          >
            Go to Dashboard
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Step 1: Select Therapist */}
          <div className="card-elevated p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center">1</span>
              Select Therapist
            </h2>
            <div className="space-y-2">
              {connectedTherapists.map(therapist => (
                <button
                  key={therapist.id}
                  onClick={() => setSelectedTherapist(therapist.id)}
                  className={cn(
                    'w-full p-4 rounded-lg border-2 transition-all text-left',
                    selectedTherapist === therapist.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background hover:border-primary/50'
                  )}
                >
                  <p className="font-semibold text-sm">{therapist.full_name}</p>
                  <p className="text-xs text-muted-foreground">{therapist.qualification}</p>
                  {therapist.clinic_name && (
                    <p className="text-xs text-muted-foreground">{therapist.clinic_name}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {selectedTherapist && (
            <>
              {/* Step 2: Select Date */}
              <div className="card-elevated p-5">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center">2</span>
                  Select Date
                </h2>
                <div className="space-y-3">
                  {availableSlots.length > 0 ? (
                    availableSlots.map(slot => {
                      const dates = getUpcomingDatesForDay(slot.day_of_week);
                      return (
                        <div key={slot.id}>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">
                            {slot.day_of_week.toUpperCase()} ({slot.start_time} - {slot.end_time})
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {dates.map(date => (
                              <button
                                key={date}
                                onClick={() => {
                                  setBookingDate(date);
                                  setSelectedSlot(`${slot.id}|${slot.start_time}`);
                                }}
                                className={cn(
                                  'p-2 rounded-lg border-2 text-xs font-medium transition-all',
                                  bookingDate === date && selectedSlot?.includes(slot.id)
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border hover:border-primary/50'
                                )}
                              >
                                {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground text-sm">
                        This therapist has not set availability yet.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Confirm & Book */}
              {bookingDate && selectedSlot && (
                <div className="card-elevated p-5 border-2 border-success/20 bg-success/5">
                  <h2 className="font-semibold mb-4">Confirm Booking</h2>
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <p className="text-sm font-medium">
                          {new Date(bookingDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Time</p>
                        <p className="text-sm font-medium">{selectedSlot.split('|')[1]}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleBookAppointment}
                    disabled={saving}
                    className={cn(
                      'w-full py-3 rounded-lg font-semibold transition-all',
                      saving ? 'bg-muted text-muted-foreground' : 'btn-primary-gradient'
                    )}
                  >
                    {saving ? 'Booking...' : 'Confirm Booking'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Upcoming Appointments */}
          {appointments.length > 0 && (
            <div className="card-elevated p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Check className="w-5 h-5 text-success" />
                Scheduled Appointments
              </h2>
              <div className="space-y-3">
                {appointments.filter(a => a.status === 'scheduled').map(apt => (
                  <div key={apt.id} className="p-3 bg-success/5 rounded-lg border border-success/20">
                    <p className="font-medium text-sm">{apt.therapist_name}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span>{new Date(apt.scheduled_date).toLocaleDateString()}</span>
                      <span>{apt.scheduled_time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default AppointmentBooking;
