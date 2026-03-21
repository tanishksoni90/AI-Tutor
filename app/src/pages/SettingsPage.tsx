import { motion } from 'framer-motion';
import {
  Settings,
  User,
  Palette,
  Sliders,
  Bell,
  Moon,
  Sun,
  Monitor,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore, type Theme } from '@/store/settingsStore';
import { toast } from 'sonner';

function SettingsContent() {
  const { user } = useAuthStore();
  const {
    theme,
    enableValidation,
    defaultTopK,
    enableNotifications,
    setTheme,
    setEnableValidation,
    setDefaultTopK,
    setEnableNotifications,
    resetToDefaults,
  } = useSettingsStore();

  const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-sm text-muted-foreground">Customize your experience</p>
            </div>
          </div>
        </motion.div>

        <div className="space-y-6">
          {/* Profile */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-5 rounded-2xl border border-border/30 bg-secondary/20"
          >
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Profile</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white text-lg font-bold">
                {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <p className="font-medium">{user?.full_name || 'Student'}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <Badge variant="outline" className="mt-1 text-[10px] capitalize">{user?.role}</Badge>
              </div>
            </div>
          </motion.div>

          {/* Appearance */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-5 rounded-2xl border border-border/30 bg-secondary/20"
          >
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Appearance</h2>
            </div>
            <div className="flex gap-2">
              {themes.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex-1 justify-center ${
                    theme === value
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* AI Preferences */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-5 rounded-2xl border border-border/30 bg-secondary/20"
          >
            <div className="flex items-center gap-2 mb-4">
              <Sliders className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">AI Preferences</h2>
            </div>
            <div className="space-y-4">
              {/* Validation Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Source Validation</p>
                  <p className="text-xs text-muted-foreground">Verify AI answers against course material</p>
                </div>
                <button
                  onClick={() => setEnableValidation(!enableValidation)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    enableValidation ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      enableValidation ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Top-K Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">Source Depth</p>
                    <p className="text-xs text-muted-foreground">Number of sources to consider</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{defaultTopK}</Badge>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={defaultTopK}
                  onChange={(e) => setDefaultTopK(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground/50 mt-1">
                  <span>Faster</span>
                  <span>More thorough</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-5 rounded-2xl border border-border/30 bg-secondary/20"
          >
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Notifications</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Push Notifications</p>
                <p className="text-xs text-muted-foreground">Get notified about new course content</p>
              </div>
              <button
                onClick={() => setEnableNotifications(!enableNotifications)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  enableNotifications ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    enableNotifications ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          </motion.div>

          {/* Reset */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex justify-end"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetToDefaults();
                toast.success('Settings reset to defaults');
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-2" />
              Reset to Defaults
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  return (
    <ChatLayout>
      <SettingsContent />
    </ChatLayout>
  );
}
