import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, AlertTriangle, Pill, FileBarChart, LogOut, Settings, Shield, User } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const Sidebar = () => {
  const location = useLocation();
  const { t } = useLanguage();
  const { userRole, logout } = useAuth();

  const navItems = [
    { path: '/dashboard', icon: Home, label: t('dashboard') },
    { path: '/daily-log', icon: ClipboardList, label: t('dailyLog') },
    { path: '/behaviors', icon: AlertTriangle, label: t('behaviors') },
    { path: '/medications', icon: Pill, label: t('medications') },
    { path: '/reports', icon: FileBarChart, label: 'Reports' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  // Admin role removed per user request

  return (
    <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 bg-card border-r border-border z-50">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary">AuCare</h1>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                'hover:bg-muted text-muted-foreground hover:text-foreground',
                isActive && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-medium'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border mt-auto">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={logout}
        >
          <LogOut className="w-5 h-5" />
          <span>{t('logout')}</span>
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
