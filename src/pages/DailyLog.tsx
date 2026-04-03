import React, { useState } from 'react';
import { format } from 'date-fns';
import { Moon, Utensils, Gamepad2, Stethoscope, Clock, ChevronLeft, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Input } from '@/components/ui/input';
import VoiceInput from '@/components/VoiceInput';
import BottomNav from '@/components/BottomNav';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

type RoutineType = 'sleep' | 'food' | 'activity' | 'therapy';

const DailyLog = () => {
  const { t } = useLanguage();
  const { addRoutineEntry, getEntriesForDate } = useData();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedType, setSelectedType] = useState<RoutineType>('sleep');
  const [showSuccess, setShowSuccess] = useState(false);

  const [formData, setFormData] = useState({
    startTime: '',
    endTime: '',
    notes: '',
  });

  const todayEntries = getEntriesForDate(selectedDate);

  const routineTypes: { type: RoutineType; icon: typeof Moon; label: string; color: string }[] = [
    { type: 'sleep', icon: Moon, label: t('sleep'), color: 'bg-secondary text-secondary-foreground' },
    { type: 'food', icon: Utensils, label: t('food'), color: 'bg-accent text-accent-foreground' },
    { type: 'activity', icon: Gamepad2, label: t('activities'), color: 'bg-info/20 text-info' },
    { type: 'therapy', icon: Stethoscope, label: t('therapy'), color: 'bg-success/20 text-success' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addRoutineEntry({
        date: selectedDate,
        type: selectedType,
        startTime: formData.startTime,
        endTime: formData.endTime,
        notes: formData.notes,
      });

      setFormData({ startTime: '', endTime: '', notes: '' });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      toast({
        title: 'Save failed',
        description: 'Could not save this entry. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="page-container pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/dashboard"
          className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold font-display">{t('dailyLog')}</h1>
          <p className="text-sm text-muted-foreground">{t('logRoutine')}</p>
        </div>
      </div>

      {/* Date Selector */}
      <div className="mb-6">
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="input-calm"
        />
      </div>

      {/* Type Selector */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {routineTypes.map(({ type, icon: Icon, label, color }) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={cn(
              'p-3 rounded-xl flex flex-col items-center gap-2 transition-all duration-200',
              selectedType === type
                ? 'ring-2 ring-primary shadow-soft'
                : 'bg-muted/30 hover:bg-muted/50'
            )}
          >
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card-elevated p-5">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">{t('time')}</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Start</label>
              <Input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="input-calm"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">End</label>
              <Input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="input-calm"
              />
            </div>
          </div>
        </div>

        <div className="card-elevated p-5">
          <h2 className="font-semibold mb-4">{t('notes')}</h2>
          <VoiceInput
            value={formData.notes}
            onChange={(value) => setFormData({ ...formData, notes: value })}
            placeholder={`Add notes about ${selectedType}...`}
          />
        </div>

        <button
          type="submit"
          className="w-full btn-primary-gradient py-4 rounded-2xl font-semibold flex items-center justify-center gap-2"
        >
          {showSuccess ? (
            <>
              <Check className="w-5 h-5" />
              Saved!
            </>
          ) : (
            t('save')
          )}
        </button>
      </form>

      {/* Today's Entries */}
      {todayEntries.routines.length > 0 && (
        <section className="mt-8">
          <h2 className="section-title">Today's Entries</h2>
          <div className="space-y-2">
            {todayEntries.routines.map((entry) => {
              const typeConfig = routineTypes.find((r) => r.type === entry.type);
              const Icon = typeConfig?.icon || Moon;
              return (
                <div key={entry.id} className="card-elevated p-4 flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', typeConfig?.color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{typeConfig?.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.startTime} {entry.endTime && `- ${entry.endTime}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-8">
        <DisclaimerBanner compact />
      </div>

      <BottomNav />
    </div>
  );
};

export default DailyLog;
