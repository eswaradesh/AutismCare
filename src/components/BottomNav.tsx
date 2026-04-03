import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, AlertTriangle, Pill, FileBarChart, Bell, Settings } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const BottomNav = () => {
  const location = useLocation();
  const { t } = useLanguage();
  const { userRole } = useAuth();

  const navItems = userRole === 'therapist'
    ? [
        { path: '/therapist/dashboard', icon: Home, label: 'Dashboard' },
        { path: '/therapist/alerts', icon: Bell, label: 'Alerts' },
        { path: '/therapist/settings', icon: Settings, label: 'Settings' },
      ]
    : [
        { path: '/dashboard', icon: Home, label: t('dashboard') },
        { path: '/daily-log', icon: ClipboardList, label: t('dailyLog') },
        { path: '/behaviors', icon: AlertTriangle, label: t('behaviors') },
        { path: '/medications', icon: Pill, label: t('medications') },
        { path: '/reports', icon: FileBarChart, label: 'Reports' },
      ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-effect border-t border-border/50 safe-area-inset-bottom z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'nav-item flex-1 max-w-[72px]',
                isActive && 'nav-item-active'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'text-primary')} />
              <span className="text-[10px] font-medium truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
