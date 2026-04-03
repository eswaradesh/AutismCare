import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronLeft, AlertTriangle, Heart, Frown, Angry, Meh, Smile, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { getLinkedTherapists, shareBehaviorAlert } from '@/lib/therapistApi';
import VoiceInput from '@/components/VoiceInput';
import BottomNav from '@/components/BottomNav';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Users, Share2 } from 'lucide-react';

const emotions = [
  { id: 'happy', icon: Smile, label: 'Happy', color: 'bg-success/20 text-success' },
  { id: 'calm', icon: Meh, label: 'Calm', color: 'bg-info/20 text-info' },
  { id: 'anxious', icon: Frown, label: 'Anxious', color: 'bg-warning/20 text-warning' },
  { id: 'upset', icon: Angry, label: 'Upset', color: 'bg-destructive/20 text-destructive' },
];

const supportiveSuggestions = [
  "Stay calm and speak softly. Your child may need a quiet moment.",
  "Try offering a familiar comfort item or activity they enjoy.",
  "Reduce sensory input - dim lights, lower sounds if possible.",
  "Use simple, clear words and give them time to process.",
  "Physical comfort like a gentle hug may help, if they accept it.",
  "This is temporary. You're doing a wonderful job supporting them.",
];

const Behaviors = () => {
  const { t } = useLanguage();
  const { addBehaviorEntry } = useData();
  const { user, childProfile } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isSuddenMode = searchParams.get('sudden') === 'true';
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [selectedTherapists, setSelectedTherapists] = useState<string[]>([]);
  const [availableTherapists, setAvailableTherapists] = useState<any[]>([]);

  const [selectedEmotion, setSelectedEmotion] = useState('');
  const [intensity, setIntensity] = useState<'low' | 'moderate' | 'high'>('moderate');
  const [notes, setNotes] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (isSuddenMode && user && childProfile) {
      loadAvailableTherapists();
    }
  }, [isSuddenMode, user, childProfile]);

  // Listen for auto-alert events from DataContext
  useEffect(() => {
    const handleAutoAlert = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      toast({
        title: '🔔 Therapist Notified',
        description: `Your therapist(s) have been automatically notified about consecutive high-intensity behaviors.`,
      });
    };
    window.addEventListener('therapist-auto-alert', handleAutoAlert);
    return () => window.removeEventListener('therapist-auto-alert', handleAutoAlert);
  }, [toast]);

  const loadAvailableTherapists = async () => {
    if (!user || !childProfile) return;
    try {
      const therapists = await getLinkedTherapists();
      setAvailableTherapists(therapists
        .filter(t => !t.child_id || t.child_id === childProfile.id)
        .map(t => ({
          id: t.therapist_id,
          name: t.full_name || 'Therapist',
          user_id: t.therapist_id,
        }))
      );
    } catch (err) {
      console.error('Error loading therapists:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const behaviorEntry = await addBehaviorEntry({
        date: format(new Date(), 'yyyy-MM-dd'),
        emotion: selectedEmotion,
        intensity,
        notes,
        isSudden: isSuddenMode,
      });

      // If sudden mode and therapists selected, share alert
      if (isSuddenMode && selectedTherapists.length > 0 && user && childProfile) {
        try {
          await shareBehaviorAlert({
            child_id: childProfile.id!,
            behavior_entry_id: '',
            therapist_ids: selectedTherapists,
            emotion: selectedEmotion,
            intensity,
            notes: notes || null,
          });
          toast({
            title: 'Alert Shared',
            description: `Shared with ${selectedTherapists.length} therapist(s).`,
          });
        } catch (shareErr) {
          console.error('Error sharing alert:', shareErr);
        }
      }

      if (isSuddenMode) {
        setShowSuggestions(true);
      } else {
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setSelectedEmotion('');
          setNotes('');
        }, 2000);
      }
    } catch (err) {
      toast({
        title: 'Save failed',
        description: 'Could not save this entry. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (showSuggestions) {
    return (
      <div className="page-container pb-24">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setShowSuggestions(false)} className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold font-display">{t('supportiveSuggestions')}</h1>
        </div>

        <div className="card-elevated p-5 mb-6 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3 mb-4">
            <Heart className="w-6 h-6 text-primary" />
            <p className="font-medium text-primary">You're doing great. Here are some supportive ideas:</p>
          </div>
        </div>

        <div className="space-y-3">
          {supportiveSuggestions.map((suggestion, i) => (
            <div key={i} className="card-elevated p-4 animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <p className="text-sm leading-relaxed">{suggestion}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-accent/30 rounded-2xl">
          <p className="text-sm text-accent-foreground text-center">
            {t('disclaimer')}
          </p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page-container pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/dashboard" className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold font-display">
            {isSuddenMode ? t('suddenChange') : t('behaviors')}
          </h1>
          {isSuddenMode && (
            <p className="text-sm text-warning">{t('reportChange')}</p>
          )}
        </div>
      </div>

      {isSuddenMode && (
        <div className="card-elevated p-4 mb-6 border-2 border-warning/30 bg-warning/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-sm">Report what you're observing. We'll provide supportive suggestions immediately.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card-elevated p-5">
          <h2 className="font-semibold mb-4">Current emotion</h2>
          <div className="grid grid-cols-4 gap-2">
            {emotions.map(({ id, icon: Icon, label, color }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedEmotion(id)}
                className={cn(
                  'p-3 rounded-xl flex flex-col items-center gap-2 transition-all',
                  selectedEmotion === id ? 'ring-2 ring-primary shadow-soft' : 'bg-muted/30'
                )}
              >
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card-elevated p-5">
          <h2 className="font-semibold mb-4">Intensity</h2>
          <div className="flex gap-2">
            {(['low', 'moderate', 'high'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setIntensity(level)}
                className={cn(
                  'flex-1 py-3 rounded-xl text-sm font-medium transition-all',
                  intensity === level ? 'bg-primary text-primary-foreground' : 'bg-muted/50'
                )}
              >
                {t(level)}
              </button>
            ))}
          </div>
        </div>

        <div className="card-elevated p-5">
          <h2 className="font-semibold mb-4">{t('notes')}</h2>
          <VoiceInput value={notes} onChange={setNotes} placeholder="Describe what you're observing..." />
        </div>

        {isSuddenMode && availableTherapists.length > 0 && (
          <div className="card-elevated p-5 border-2 border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-primary" />
                <h2 className="font-semibold">Share with Therapist</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowShareOptions(!showShareOptions)}
                className="text-sm text-primary"
              >
                {showShareOptions ? 'Hide' : 'Select'}
              </button>
            </div>
            {showShareOptions && (
              <div className="space-y-2">
                {availableTherapists.map((therapist) => (
                  <label
                    key={therapist.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-background/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTherapists.includes(therapist.user_id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTherapists([...selectedTherapists, therapist.user_id]);
                        } else {
                          setSelectedTherapists(selectedTherapists.filter(id => id !== therapist.user_id));
                        }
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{therapist.name}</span>
                  </label>
                ))}
                <p className="text-xs text-muted-foreground mt-2">
                  Selected therapists will be notified of this sudden behavior change.
                </p>
              </div>
            )}
          </div>
        )}

        <button type="submit" disabled={!selectedEmotion} className={cn(
          'w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-2',
          selectedEmotion ? 'btn-primary-gradient' : 'bg-muted text-muted-foreground'
        )}>
          {showSuccess ? <><Check className="w-5 h-5" /> Saved!</> : isSuddenMode ? 'Get Supportive Suggestions' : t('save')}
        </button>
      </form>
      <BottomNav />
    </div>
  );
};

export default Behaviors;
