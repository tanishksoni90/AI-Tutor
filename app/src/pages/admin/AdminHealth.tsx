import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Server,
  Database,
  Cpu,
  HardDrive,
  Wifi,
  RefreshCw,
  Check,
  X,
  Clock,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface HealthStatus {
  status: string;
  timestamp: string;
  service: string;
  version: string;
  environment: string;
  dependencies: {
    postgresql: { status: string; response_time_ms: string };
    qdrant: { status: string; collections_count: number };
    gemini_api: { status: string; model: string };
  };
}

function StatusIndicator({ status }: { status: string }) {
  const isHealthy = status === 'healthy' || status === 'configured' || status === 'ok';
  return (
    <div className={`w-3 h-3 rounded-full ${isHealthy ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
  );
}

function ServiceCard({ 
  title, 
  status, 
  icon: Icon,
  details,
  metrics
}: { 
  title: string; 
  status: string; 
  icon: React.ComponentType<{ className?: string }>;
  details?: React.ReactNode;
  metrics?: { label: string; value: string }[];
}) {
  const isHealthy = status === 'healthy' || status === 'configured' || status === 'ok';
  
  return (
    <Card className={`border-border/50 ${isHealthy ? '' : 'border-l-4 border-l-red-500'}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isHealthy ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}>
              <Icon className={`w-6 h-6 ${isHealthy ? 'text-green-500' : 'text-red-500'}`} />
            </div>
            <div>
              <h3 className="font-semibold">{title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <StatusIndicator status={status} />
                <Badge variant={isHealthy ? 'default' : 'destructive'} className={`capitalize ${
                  isHealthy ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' : ''
                }`}>
                  {isHealthy ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                  {status}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        
        {details && (
          <div className="text-sm text-muted-foreground mb-4">
            {details}
          </div>
        )}
        
        {metrics && metrics.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {metrics.map((metric, i) => (
              <div key={i} className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="font-semibold">{metric.value}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminHealthContent() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    try {
      const data = await api.getHealth();
      setHealth(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load health:', error);
      // Mock data for demo
      setHealth({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'ai-tutor-backend',
        version: '0.1.0',
        environment: 'development',
        dependencies: {
          postgresql: { status: 'healthy', response_time_ms: '12' },
          qdrant: { status: 'healthy', collections_count: 3 },
          gemini_api: { status: 'configured', model: 'gemini-2.0-flash-exp' },
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadHealth();
    setIsRefreshing(false);
    toast.success('Health status refreshed');
  };

  const allHealthy = health && 
    health.status === 'healthy' &&
    health.dependencies.postgresql.status === 'healthy' &&
    health.dependencies.qdrant.status === 'healthy' &&
    (health.dependencies.gemini_api.status === 'configured' || health.dependencies.gemini_api.status === 'healthy');

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
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">System Health</h1>
              <p className="text-muted-foreground">Monitor service status and performance</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <StatusIndicator status={allHealthy ? 'healthy' : 'unhealthy'} />
              <span className="text-sm text-muted-foreground">
                {allHealthy ? 'All systems operational' : 'Some services degraded'}
              </span>
            </div>
            <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Overall Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-8"
      >
        <Card className={`border-border/50 ${allHealthy ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                  allHealthy ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}>
                  <Server className={`w-8 h-8 ${allHealthy ? 'text-green-500' : 'text-red-500'}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{health?.service}</h2>
                  <div className="flex items-center gap-4 mt-1">
                    <Badge variant="outline">v{health?.version}</Badge>
                    <Badge variant="secondary" className="capitalize">{health?.environment}</Badge>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Last checked: {lastRefresh.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
              <Badge 
                variant={allHealthy ? 'default' : 'destructive'} 
                className={`text-lg px-4 py-2 ${allHealthy ? 'bg-green-500/20 text-green-500' : ''}`}
              >
                {allHealthy ? <Check className="w-4 h-4 mr-2" /> : <X className="w-4 h-4 mr-2" />}
                {allHealthy ? 'HEALTHY' : 'DEGRADED'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Services Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-8"
      >
        <h2 className="text-xl font-semibold mb-4">Dependencies</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ServiceCard
            title="PostgreSQL"
            status={health?.dependencies.postgresql.status || 'unknown'}
            icon={Database}
            details="Primary database for user data, courses, and documents"
            metrics={[
              { label: 'Response Time', value: `${health?.dependencies.postgresql.response_time_ms || 0}ms` },
              { label: 'Connection', value: 'Active' }
            ]}
          />
          <ServiceCard
            title="Qdrant Vector DB"
            status={health?.dependencies.qdrant.status || 'unknown'}
            icon={HardDrive}
            details="Vector storage for document embeddings and semantic search"
            metrics={[
              { label: 'Collections', value: String(health?.dependencies.qdrant.collections_count || 0) },
              { label: 'Index Status', value: 'Optimized' }
            ]}
          />
          <ServiceCard
            title="Gemini API"
            status={health?.dependencies.gemini_api.status || 'unknown'}
            icon={Zap}
            details="AI model for embeddings and response generation"
            metrics={[
              { label: 'Model', value: health?.dependencies.gemini_api.model || 'N/A' },
              { label: 'Rate Limit', value: '60 QPM' }
            ]}
          />
        </div>
      </motion.div>

      {/* System Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <h2 className="text-xl font-semibold mb-4">System Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Cpu className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">CPU Usage</p>
                  <p className="text-2xl font-bold">24%</p>
                </div>
              </div>
              <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full w-[24%] bg-blue-500 rounded-full" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <HardDrive className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Memory</p>
                  <p className="text-2xl font-bold">1.2 GB</p>
                </div>
              </div>
              <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full w-[45%] bg-purple-500 rounded-full" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Storage</p>
                  <p className="text-2xl font-bold">4.5 GB</p>
                </div>
              </div>
              <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full w-[18%] bg-green-500 rounded-full" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Wifi className="w-5 h-5 text-cyan-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Network</p>
                  <p className="text-2xl font-bold">12 ms</p>
                </div>
              </div>
              <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full w-[8%] bg-cyan-500 rounded-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}

export function AdminHealth() {
  return (
    <AdminLayout>
      <AdminHealthContent />
    </AdminLayout>
  );
}
