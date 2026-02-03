import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Users,
  BookOpen,
  FileText,
  Activity,
  TrendingUp,
  ArrowRight,
  Plus,
  Upload,
  UserPlus,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { api } from '@/lib/api';

interface DashboardStats {
  total_users: number;
  total_admins: number;
  total_students: number;
  total_courses: number;
  total_documents: number;
  total_chunks: number;
  total_queries: number;
  queries_today: number;
  active_users_today: number;
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  color = 'primary',
  href
}: { 
  title: string; 
  value: string | number; 
  icon: React.ComponentType<{ className?: string }>; 
  trend?: string;
  color?: 'primary' | 'success' | 'warning' | 'accent' | 'cyan';
  href?: string;
}) {
  const colorClasses: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-green-500/10 text-green-500',
    warning: 'bg-amber-500/10 text-amber-500',
    accent: 'bg-accent/10 text-accent',
    cyan: 'bg-cyan-500/10 text-cyan-500',
  };

  const content = (
    <Card className="border-border/50 hover:border-primary/30 transition-all duration-300 h-full">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {trend && (
              <p className="text-sm text-green-500 mt-1 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {trend}
              </p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link to={href}>
        <motion.div whileHover={{ y: -2 }}>
          {content}
        </motion.div>
      </Link>
    );
  }

  return content;
}

function QuickAction({ 
  title, 
  description, 
  icon: Icon, 
  href,
  color = 'primary'
}: { 
  title: string; 
  description: string; 
  icon: React.ComponentType<{ className?: string }>; 
  href: string;
  color?: string;
}) {
  const colorClasses: Record<string, string> = {
    primary: 'bg-primary/10 group-hover:bg-primary/20 text-primary',
    accent: 'bg-accent/10 group-hover:bg-accent/20 text-accent',
    cyan: 'bg-cyan-500/10 group-hover:bg-cyan-500/20 text-cyan-500',
    green: 'bg-green-500/10 group-hover:bg-green-500/20 text-green-500',
  };

  return (
    <Link to={href}>
      <motion.div whileHover={{ y: -2 }}>
        <Card className="border-border/50 hover:border-primary/30 transition-all duration-300 cursor-pointer group h-full">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${colorClasses[color]}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold group-hover:text-primary transition-colors">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}

function AdminOverviewContent() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.getAdminStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
      // Set empty stats on error
      setStats({
        total_users: 0,
        total_admins: 0,
        total_students: 0,
        total_courses: 0,
        total_documents: 0,
        total_chunks: 0,
        total_queries: 0,
        queries_today: 0,
        active_users_today: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2">Admin Overview</h1>
        <p className="text-muted-foreground">
          Monitor and manage your AI Tutor platform
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        <StatCard
          title="Total Users"
          value={stats?.total_users || 0}
          icon={Users}
          trend={`${stats?.active_users_today || 0} active today`}
          color="primary"
          href="/admin/users"
        />
        <StatCard
          title="Total Courses"
          value={stats?.total_courses || 0}
          icon={BookOpen}
          color="success"
          href="/admin/courses"
        />
        <StatCard
          title="Documents"
          value={stats?.total_documents || 0}
          icon={FileText}
          color="accent"
          href="/admin/documents"
        />
        <StatCard
          title="Queries Today"
          value={stats?.queries_today || 0}
          icon={Activity}
          trend={`${stats?.total_queries || 0} total`}
          color="warning"
          href="/admin/analytics"
        />
      </motion.div>

      {/* Secondary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
      >
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total_students || 0}</p>
                <p className="text-sm text-muted-foreground">Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total_admins || 0}</p>
                <p className="text-sm text-muted-foreground">Administrators</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total_chunks?.toLocaleString() || 0}</p>
                <p className="text-sm text-muted-foreground">Content Chunks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mb-8"
      >
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickAction
            title="Add User"
            description="Create a new student or admin"
            icon={UserPlus}
            href="/admin/users?action=add"
            color="primary"
          />
          <QuickAction
            title="Create Course"
            description="Set up a new course"
            icon={Plus}
            href="/admin/courses?action=add"
            color="green"
          />
          <QuickAction
            title="Upload Document"
            description="Ingest new materials"
            icon={Upload}
            href="/admin/documents?action=upload"
            color="accent"
          />
          <QuickAction
            title="View Analytics"
            description="See usage insights"
            icon={BarChart3}
            href="/admin/analytics"
            color="cyan"
          />
        </div>
      </motion.div>

      {/* Recent Activity Placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest actions across your platform</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/analytics">
                  View All
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: 'New user registered', user: 'john.doe@example.com', time: '5 minutes ago', type: 'user' },
                { action: 'Document uploaded', user: 'admin@career247.com', time: '15 minutes ago', type: 'document' },
                { action: 'Course created', user: 'admin@career247.com', time: '1 hour ago', type: 'course' },
                { action: 'User enrolled', user: 'jane.smith@example.com', time: '2 hours ago', type: 'enrollment' },
              ].map((activity, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'user' ? 'bg-blue-500' :
                    activity.type === 'document' ? 'bg-green-500' :
                    activity.type === 'course' ? 'bg-purple-500' : 'bg-amber-500'
                  }`} />
                  <div className="flex-1">
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-sm text-muted-foreground">{activity.user}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{activity.time}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export function AdminOverview() {
  return (
    <AdminLayout>
      <AdminOverviewContent />
    </AdminLayout>
  );
}
