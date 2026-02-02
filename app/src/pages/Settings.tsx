import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Building,
  Shield,
  Bell,
  Moon,
  Sun,
  Monitor,
  Sliders,
  RotateCcw,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore, type Theme } from '@/store/settingsStore';
import { useTheme } from '@/components/ThemeProvider';

function SettingsContent() {
  const { user } = useAuthStore();
  const { 
    enableValidation, 
    defaultTopK, 
    enableNotifications,
    setEnableValidation,
    setDefaultTopK,
    setEnableNotifications,
    resetToDefaults,
  } = useSettingsStore();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    const themeLabel = newTheme === 'system' ? 'System' : newTheme === 'dark' ? 'Dark' : 'Light';
    toast.success(`Theme changed to ${themeLabel}`, {
      description: newTheme === 'system' 
        ? 'Theme will follow your system preferences' 
        : `The app is now in ${themeLabel.toLowerCase()} mode`,
    });
  };

  const handleValidationChange = (checked: boolean) => {
    setEnableValidation(checked);
    toast.success(checked ? 'Answer validation enabled' : 'Answer validation disabled', {
      description: checked 
        ? 'AI responses will be validated to prevent hallucinations'
        : 'AI responses will not be validated (faster but less accurate)',
    });
  };

  const handleTopKChange = (value: number[]) => {
    setDefaultTopK(value[0]);
    // Debounced toast - only show on release
  };

  const handleTopKCommit = () => {
    toast.success(`Sources updated to ${defaultTopK}`, {
      description: `AI will reference up to ${defaultTopK} source documents per answer`,
    });
  };

  const handleNotificationsChange = (checked: boolean) => {
    setEnableNotifications(checked);
    if (checked) {
      // Request browser notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            toast.success('Notifications enabled', {
              description: 'You will receive updates about your courses and learning progress',
            });
          } else {
            toast.warning('Browser notifications blocked', {
              description: 'Please enable notifications in your browser settings',
            });
          }
        });
      } else {
        toast.success('Notifications enabled', {
          description: 'You will receive updates about your courses and learning progress',
        });
      }
    } else {
      toast.info('Notifications disabled', {
        description: 'You will no longer receive notification updates',
      });
    }
  };

  const handleReset = () => {
    resetToDefaults();
    toast.success('Settings reset to defaults', {
      description: 'All preferences have been restored to their default values',
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account preferences and application settings
        </p>
      </motion.div>

      <div className="space-y-6">
        {/* Profile Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>Your personal information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={user?.full_name || ''}
                    readOnly
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      value={user?.email || ''}
                      readOnly
                      className="pl-10 bg-secondary/50"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org">Organization</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="org"
                    value="Career247"
                    readOnly
                    className="pl-10 bg-secondary/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="role"
                    value={user?.role || 'student'}
                    readOnly
                    className="pl-10 bg-secondary/50 capitalize"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Appearance Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  {resolvedTheme === 'dark' ? (
                    <Moon className="w-5 h-5 text-cyan-500" />
                  ) : (
                    <Sun className="w-5 h-5 text-cyan-500" />
                  )}
                </div>
                <div>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>Customize the look and feel</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Label className="text-base">Theme</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Select your preferred theme for the application
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    className="flex flex-col items-center gap-2 h-auto py-4"
                    onClick={() => handleThemeChange('light')}
                  >
                    <Sun className="w-5 h-5" />
                    <span className="text-sm">Light</span>
                    {theme === 'light' && <Check className="w-4 h-4 absolute top-2 right-2" />}
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    className="flex flex-col items-center gap-2 h-auto py-4"
                    onClick={() => handleThemeChange('dark')}
                  >
                    <Moon className="w-5 h-5" />
                    <span className="text-sm">Dark</span>
                    {theme === 'dark' && <Check className="w-4 h-4 absolute top-2 right-2" />}
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    className="flex flex-col items-center gap-2 h-auto py-4"
                    onClick={() => handleThemeChange('system')}
                  >
                    <Monitor className="w-5 h-5" />
                    <span className="text-sm">System</span>
                    {theme === 'system' && <Check className="w-4 h-4 absolute top-2 right-2" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notifications Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-pink-500" />
                </div>
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Manage your notification preferences</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive updates about your courses and learning progress
                  </p>
                </div>
                <Switch
                  checked={enableNotifications}
                  onCheckedChange={handleNotificationsChange}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Preferences Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Sliders className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <CardTitle>AI Tutor Preferences</CardTitle>
                  <CardDescription>Customize your learning experience</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Validation Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Answer Validation</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable self-reflective validation to prevent hallucinations
                  </p>
                </div>
                <Switch
                  checked={enableValidation}
                  onCheckedChange={handleValidationChange}
                />
              </div>

              {/* Top-K Slider */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Default Sources (Top-K)</Label>
                    <p className="text-sm text-muted-foreground">
                      Number of source documents to reference per answer
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-primary">
                    {defaultTopK}
                  </span>
                </div>
                <Slider
                  value={[defaultTopK]}
                  onValueChange={handleTopKChange}
                  onValueCommit={handleTopKCommit}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 source (faster)</span>
                  <span>10 sources (thorough)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Reset Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex justify-end"
        >
          <Button
            variant="outline"
            onClick={handleReset}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

export function Settings() {
  return (
    <DashboardLayout>
      <SettingsContent />
    </DashboardLayout>
  );
}
