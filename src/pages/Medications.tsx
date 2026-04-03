import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2, Bell, Clock, BellRing, BellOff } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import BottomNav from '@/components/BottomNav';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const Medications = () => {
  const { t } = useLanguage();
  const { medications, addMedication, updateMedication, deleteMedication } = useData();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<{ name: string; time: string; frequency: 'daily' | 'twice-daily' | 'as-needed' }>({ name: '', time: '', frequency: 'daily' });
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      setNotifPermission('unsupported');
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      toast({ title: 'Notifications Enabled', description: 'You will receive medication reminders.' });
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.time) {
      try {
        await addMedication({ ...formData, enabled: true });
        setFormData({ name: '', time: '', frequency: 'daily' });
        setShowForm(false);
      } catch (err) {
        toast({
          title: 'Save failed',
          description: 'Could not save this medication. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <div className="page-container pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/dashboard" className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold font-display">{t('medicationReminder')}</h1>
          <p className="text-sm text-muted-foreground">Time-based reminders only</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <DisclaimerBanner compact />

      {/* Notification Permission Banner */}
      {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
        <div className="mt-4 card-elevated p-4 border-2 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <BellRing className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Enable Notifications</p>
              <p className="text-xs text-muted-foreground">Get reminded when it's time for medications</p>
            </div>
            <button
              onClick={requestNotificationPermission}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
            >
              Enable
            </button>
          </div>
        </div>
      )}
      {notifPermission === 'granted' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-success">
          <BellRing className="w-4 h-4" />
          <span>Notifications enabled</span>
        </div>
      )}
      {notifPermission === 'denied' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-destructive">
          <BellOff className="w-4 h-4" />
          <span>Notifications blocked — enable in browser settings</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="card-elevated p-5 mt-6 space-y-4">
          <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t('medicationName')} className="input-calm" required />
          <Input type="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} className="input-calm" required />
          <div className="flex gap-2">
            {(['daily', 'twice-daily', 'as-needed'] as const).map((freq) => (
              <button key={freq} type="button" onClick={() => setFormData({ ...formData, frequency: freq })} className={cn('flex-1 py-2 rounded-xl text-xs font-medium', formData.frequency === freq ? 'bg-primary text-primary-foreground' : 'bg-muted/50')}>
                {freq}
              </button>
            ))}
          </div>
          <button type="submit" className="w-full btn-primary-gradient py-3 rounded-xl font-semibold">{t('save')}</button>
        </form>
      )}

      <div className="mt-6 space-y-3">
        {medications.length === 0 ? (
          <div className="card-elevated p-8 text-center">
            <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">No medication reminders set</p>
          </div>
        ) : (
          medications.map((med) => (
            <div key={med.id} className="card-elevated p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                <Clock className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{med.name}</p>
                <p className="text-sm text-muted-foreground">{med.time} • {med.frequency}</p>
              </div>
              <Switch checked={med.enabled} onCheckedChange={(checked) => updateMedication(med.id, { enabled: checked })} />
              <button onClick={() => deleteMedication(med.id)} className="text-destructive/70 hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default Medications;
