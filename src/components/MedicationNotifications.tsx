import { useEffect, useRef } from 'react';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/hooks/use-toast';

const MedicationNotifications = () => {
  const { medications } = useData();
  const { toast } = useToast();
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkMedications = () => {
      const now = new Date();
      const currentHour = now.getHours().toString().padStart(2, '0');
      const currentMin = now.getMinutes().toString().padStart(2, '0');
      const currentTime = `${currentHour}:${currentMin}`;

      medications
        .filter((med) => med.enabled)
        .forEach((med) => {
          const medTime = med.time; // HH:mm format
          if (!medTime) return;

          // Check if within ±1 minute tolerance
          const [medH, medM] = medTime.split(':').map(Number);
          const [curH, curM] = currentTime.split(':').map(Number);
          const medMinutes = medH * 60 + medM;
          const curMinutes = curH * 60 + curM;
          const diff = Math.abs(medMinutes - curMinutes);

          if (diff > 1) return;

          // Prevent duplicate notifications for same med + same minute
          const key = `${med.id}-${currentTime}`;
          if (firedRef.current.has(key)) return;
          firedRef.current.add(key);

          // Fire notification
          const title = '💊 Medication Reminder';
          const body = `Time to take: ${med.name} (${med.frequency})`;

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
              body,
              icon: '/favicon.ico',
              tag: `med-${med.id}`,
            });
          }

          // Always show in-app toast as well
          toast({
            title,
            description: body,
          });
        });
    };

    // Check every 30 seconds
    const interval = setInterval(checkMedications, 30000);
    // Check immediately on mount
    checkMedications();

    return () => clearInterval(interval);
  }, [medications, toast]);

  // Reset fired notifications every hour to avoid memory buildup
  useEffect(() => {
    const cleanup = setInterval(() => {
      firedRef.current.clear();
    }, 3600000);
    return () => clearInterval(cleanup);
  }, []);

  return null; // This is a service component, renders nothing
};

export default MedicationNotifications;
