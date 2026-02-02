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
  Key,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore, type Theme } from '@/store/settingsStore';
import { useTheme } from '@/components/ThemeProvider';

function AdminSettingsContent() {
  const { user } = useAuthStore();
  const { 
    enableNotifications,
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

  const handleNotificationsChange = (checked: boolean) => {
    setEnableNotifications(checked);
    if (checked) {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            toast.success('Notifications enabled');
          } else {
            toast.warning('Browser notifications blocked');
          }
        });
      } else {
        toast.success('Notifications enabled');
      }
    } else {
      toast.info('Notifications disabled');
    }
  };

  const handleReset = () => {
    resetToDefaults();
    toast.success('Settings reset to defaults');
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
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sliders className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Admin Settings</h1>
            <p className="text-muted-foreground">
              Manage your admin account and preferences
            </p>
          </div>
        </div>
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
                  <CardTitle>Admin Profile</CardTitle>
                  <CardDescription>Your administrator information</CardDescription>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                    <Input
                      id="role"
                      value="Administrator"
                      readOnly
                      className="pl-10 bg-primary/10 text-primary font-medium"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Security Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Key className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>Manage your account security</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-medium">Change Password</p>
                  <p className="text-sm text-muted-foreground">Update your admin password</p>
                </div>
                <Button variant="outline">Change Password</Button>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">Add extra security to your account</p>
                </div>
                <Button variant="outline" disabled>Coming Soon</Button>
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
                  Select your preferred theme for the admin dashboard
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    className="flex flex-col items-center gap-2 h-auto py-4 relative"
                    onClick={() => handleThemeChange('light')}
                  >
                    <Sun className="w-5 h-5" />
                    <span className="text-sm">Light</span>
                    {theme === 'light' && <Check className="w-4 h-4 absolute top-2 right-2" />}
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    className="flex flex-col items-center gap-2 h-auto py-4 relative"
                    onClick={() => handleThemeChange('dark')}
                  >
                    <Moon className="w-5 h-5" />
                    <span className="text-sm">Dark</span>
                    {theme === 'dark' && <Check className="w-4 h-4 absolute top-2 right-2" />}
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    className="flex flex-col items-center gap-2 h-auto py-4 relative"
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
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-pink-500" />
                </div>
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Manage notification preferences</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts about system events and user activity
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

        {/* Reset Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
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

export function AdminSettings() {
  return (
    <AdminLayout>
      <AdminSettingsContent />
    </AdminLayout>
  );
}
