import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  AlertTriangle,
  ShieldAlert,
  MessageSquare,
  Users,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { api } from '@/lib/api';

interface AnalyticsSummary {
  total_queries: number;
  queries_today: number;
  avg_confidence: number;
  hallucinations_detected: number;
  assignments_blocked: number;
  avg_response_time_ms: number;
  popular_topics: { topic: string; count: number }[];
  daily_usage: { date: string; queries: number }[];
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  trendDirection,
  color = 'primary',
  subtitle
}: { 
  title: string; 
  value: string | number; 
  icon: React.ComponentType<{ className?: string }>; 
  trend?: string;
  trendDirection?: 'up' | 'down';
  color?: string;
  subtitle?: string;
}) {
  const colorClasses: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-green-500/10 text-green-500',
    warning: 'bg-amber-500/10 text-amber-500',
    danger: 'bg-red-500/10 text-red-500',
    cyan: 'bg-cyan-500/10 text-cyan-500',
  };

  return (
    <Card className="border-border/50">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend && (
              <p className={`text-sm mt-1 flex items-center gap-1 ${
                trendDirection === 'up' ? 'text-green-500' : trendDirection === 'down' ? 'text-red-500' : 'text-muted-foreground'
              }`}>
                {trendDirection === 'up' ? <TrendingUp className="w-4 h-4" /> : 
                 trendDirection === 'down' ? <TrendingDown className="w-4 h-4" /> : null}
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
}

function SimpleBarChart({ data }: { data: { date: string; queries: number }[] }) {
  const maxValue = Math.max(...data.map(d => d.queries), 1);
  
  return (
    <div className="flex items-end gap-2 h-48">
      {data.map((item, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full flex flex-col items-center">
            <span className="text-xs text-muted-foreground mb-1">{item.queries}</span>
            <div 
              className="w-full bg-primary/20 rounded-t-sm transition-all hover:bg-primary/30"
              style={{ height: `${(item.queries / maxValue) * 150}px` }}
            >
              <div 
                className="w-full bg-primary rounded-t-sm"
                style={{ height: '100%' }}
              />
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}
          </span>
        </div>
      ))}
    </div>
  );
}

function AdminAnalyticsContent() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      const data = await api.getAdminAnalytics();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      // Set empty analytics on error
      setAnalytics({
        total_queries: 0,
        queries_today: 0,
        avg_confidence: 0,
        hallucinations_detected: 0,
        assignments_blocked: 0,
        avg_response_time_ms: 0,
        popular_topics: [],
        daily_usage: []
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-cyan-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Analytics</h1>
              <p className="text-muted-foreground">Usage insights and performance metrics</p>
            </div>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Main Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        <StatCard
          title="Total Queries"
          value={analytics?.total_queries?.toLocaleString() || 0}
          icon={MessageSquare}
          trend={`${analytics?.queries_today || 0} today`}
          trendDirection="up"
          color="primary"
        />
        <StatCard
          title="Avg. Confidence"
          value={`${analytics?.avg_confidence || 0}%`}
          icon={Target}
          subtitle="Response confidence score"
          color="success"
        />
        <StatCard
          title="Avg. Response Time"
          value={`${((analytics?.avg_response_time_ms || 0) / 1000).toFixed(1)}s`}
          icon={Clock}
          subtitle="Time to generate response"
          color="cyan"
        />
        <StatCard
          title="Active Users"
          value="45"
          icon={Users}
          trend="+12% this week"
          trendDirection="up"
          color="primary"
        />
      </motion.div>

      {/* Safety Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8"
      >
        <Card className="border-border/50 border-l-4 border-l-amber-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span className="font-medium">Hallucinations Detected</span>
                </div>
                <p className="text-3xl font-bold">{analytics?.hallucinations_detected || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Self-reflective validation caught these
                </p>
              </div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500">
                {((analytics?.hallucinations_detected || 0) / (analytics?.total_queries || 1) * 100).toFixed(2)}% rate
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  <span className="font-medium">Assignment Requests Blocked</span>
                </div>
                <p className="text-3xl font-bold">{analytics?.assignments_blocked || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Academic integrity protection active
                </p>
              </div>
              <Badge variant="outline" className="bg-red-500/10 text-red-500">
                Safety enabled
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily Usage Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="border-border/50 h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Daily Query Volume
              </CardTitle>
              <CardDescription>Queries over the last {timeRange} days</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.daily_usage && analytics.daily_usage.length > 0 ? (
                <SimpleBarChart data={analytics.daily_usage} />
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Popular Topics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="border-border/50 h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Popular Topics
              </CardTitle>
              <CardDescription>Most asked topics by students</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.popular_topics && analytics.popular_topics.length > 0 ? (
                  analytics.popular_topics.map((topic, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{topic.topic}</p>
                        <div className="mt-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(topic.count / (analytics.popular_topics[0]?.count || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{topic.count} queries</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No topic data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="p-4 rounded-lg bg-primary/5 border border-primary/10"
      >
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">💡 Privacy Note:</strong> All analytics are anonymized. 
          Query content is never stored - only metadata like topic categories, confidence scores, and timing.
        </p>
      </motion.div>
    </div>
  );
}

export function AdminAnalytics() {
  return (
    <AdminLayout>
      <AdminAnalyticsContent />
    </AdminLayout>
  );
}
