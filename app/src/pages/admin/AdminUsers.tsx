import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Search,
  Plus,
  MoreVertical,
  UserCheck,
  UserX,
  Mail,
  Shield,
  User,
  Trash2,
  Edit,
  BookOpen,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Loader2,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  org_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  courses_count: number;
  invitation_status?: string;
}

interface ImportStudent {
  email: string;
  full_name?: string;
  course_name: string;
}

interface ImportResult {
  email: string;
  full_name?: string;
  course_name: string;
  status: string;
  message?: string;
}

function AdminUsersContent() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [importData, setImportData] = useState<ImportStudent[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'student'
  });

  useEffect(() => {
    loadUsers();
  }, [searchQuery, roleFilter]);

  const loadUsers = async () => {
    try {
      const data = await api.getAdminUsers({ search: searchQuery, role: roleFilter });
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      await api.toggleUserStatus(userId);
      setUsers(users.map(u => 
        u.id === userId ? { ...u, is_active: !u.is_active } : u
      ));
      toast.success('User status updated');
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleResendInvitation = async (userId: string) => {
    try {
      const response = await api.resendInvitation(userId);
      // Update the user in the list with new invitation status
      setUsers(users.map(u => 
        u.id === userId ? { ...u, invitation_status: 'pending' } : u
      ));
      toast.success('Invitation regenerated! Token: ' + response.invitation_token.substring(0, 8) + '...');
      // In production, this would trigger an email send
    } catch (error) {
      toast.error('Failed to resend invitation');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await api.deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      toast.success('User deleted');
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const handleAddUser = async () => {
    try {
      const created = await api.createUser(newUser);
      setUsers([created, ...users]);
      setIsAddDialogOpen(false);
      setNewUser({ email: '', password: '', full_name: '', role: 'student' });
      toast.success('User created successfully');
    } catch (error) {
      toast.error('Failed to create user');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      // Parse header
      const header = lines[0].toLowerCase().split(',').map(h => h.trim());
      const emailIdx = header.findIndex(h => h === 'email');
      const nameIdx = header.findIndex(h => h === 'full_name' || h === 'name');
      const courseIdx = header.findIndex(h => h === 'course_name' || h === 'course');

      if (emailIdx === -1 || courseIdx === -1) {
        toast.error('CSV must have "email" and "course_name" columns');
        return;
      }

      // Parse data rows
      const students: ImportStudent[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        if (values[emailIdx]) {
          students.push({
            email: values[emailIdx],
            full_name: nameIdx !== -1 ? values[nameIdx] : undefined,
            course_name: values[courseIdx],
          });
        }
      }

      setImportData(students);
      setImportStep('preview');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const result = await api.bulkImportStudents(importData);
      setImportResults(result.students);
      setImportStep('result');
      loadUsers(); // Refresh user list
      toast.success(`Imported ${result.created} new students, ${result.existing} existing`);
    } catch (error) {
      toast.error('Failed to import students');
    } finally {
      setIsImporting(false);
    }
  };

  const resetImportDialog = () => {
    setImportStep('upload');
    setImportData([]);
    setImportResults([]);
    setIsImportDialogOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = !roleFilter || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

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
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">User Management</h1>
              <p className="text-muted-foreground">{users.length} users in your organization</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4 mb-6"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={roleFilter === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter(null)}
          >
            All
          </Button>
          <Button
            variant={roleFilter === 'admin' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter(roleFilter === 'admin' ? null : 'admin')}
          >
            <Shield className="w-4 h-4 mr-1" />
            Admins
          </Button>
          <Button
            variant={roleFilter === 'student' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter(roleFilter === 'student' ? null : 'student')}
          >
            <User className="w-4 h-4 mr-1" />
            Students
          </Button>
        </div>
      </motion.div>

      {/* Users Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-secondary/30">
                    <th className="text-left p-4 text-sm font-medium">User</th>
                    <th className="text-left p-4 text-sm font-medium">Role</th>
                    <th className="text-left p-4 text-sm font-medium">Courses</th>
                    <th className="text-left p-4 text-sm font-medium">Status</th>
                    <th className="text-left p-4 text-sm font-medium">Joined</th>
                    <th className="text-right p-4 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, i) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b last:border-0 hover:bg-secondary/20 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            user.role === 'admin' ? 'bg-primary/20' : 'bg-secondary'
                          }`}>
                            {user.role === 'admin' ? (
                              <Shield className="w-5 h-5 text-primary" />
                            ) : (
                              <User className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{user.full_name || 'No name'}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                          {user.role}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <BookOpen className="w-4 h-4" />
                          {user.courses_count}
                        </div>
                      </td>
                      <td className="p-4">
                        {user.invitation_status === 'pending' ? (
                          <Badge 
                            variant="outline"
                            className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
                          >
                            <Clock className="w-3 h-3 mr-1" /> Pending Invite
                          </Badge>
                        ) : (
                          <Badge 
                            variant={user.is_active ? 'default' : 'secondary'}
                            className={user.is_active ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' : ''}
                          >
                            {user.is_active ? (
                              <><UserCheck className="w-3 h-3 mr-1" /> Active</>
                            ) : (
                              <><UserX className="w-3 h-3 mr-1" /> Inactive</>
                            )}
                          </Badge>
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            {user.invitation_status === 'pending' && (
                              <DropdownMenuItem onClick={() => handleResendInvitation(user.id)}>
                                <Send className="w-4 h-4 mr-2" />
                                Resend Invitation
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleToggleStatus(user.id)}>
                              {user.is_active ? (
                                <><UserX className="w-4 h-4 mr-2" /> Deactivate</>
                              ) : (
                                <><UserCheck className="w-4 h-4 mr-2" /> Activate</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new student or admin account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                placeholder="John Doe"
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimum 8 characters"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser}>
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={(open) => !open && resetImportDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {importStep === 'upload' && 'Import Students from CSV'}
              {importStep === 'preview' && 'Preview Import Data'}
              {importStep === 'result' && 'Import Results'}
            </DialogTitle>
            <DialogDescription>
              {importStep === 'upload' && 'Upload a CSV file with student emails and course assignments'}
              {importStep === 'preview' && `Review ${importData.length} students before importing`}
              {importStep === 'result' && 'Import completed - review the results below'}
            </DialogDescription>
          </DialogHeader>
          
          {importStep === 'upload' && (
            <div className="space-y-4 py-4">
              <div 
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Upload className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium">Click to upload CSV</p>
                <p className="text-sm text-muted-foreground">or drag and drop</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="font-medium text-sm mb-2">CSV Format Required:</p>
                <code className="text-xs bg-background px-2 py-1 rounded block">
                  email,full_name,course_name<br/>
                  john@email.com,John Doe,Data Structures<br/>
                  jane@email.com,Jane Smith,Machine Learning
                </code>
              </div>
            </div>
          )}

          {importStep === 'preview' && (
            <div className="space-y-4 py-4">
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-secondary sticky top-0">
                    <tr>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Course</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importData.map((student, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{student.email}</td>
                        <td className="p-2">{student.full_name || '-'}</td>
                        <td className="p-2">{student.course_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportStep('upload')}>
                  Back
                </Button>
                <Button onClick={handleImport} disabled={isImporting}>
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${importData.length} Students`
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {importStep === 'result' && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-green-500/10 rounded-lg p-3">
                  <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-green-500">
                    {importResults.filter(r => r.status === 'created').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Created</p>
                </div>
                <div className="bg-amber-500/10 rounded-lg p-3">
                  <AlertCircle className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-amber-500">
                    {importResults.filter(r => r.status === 'existing' || r.status === 'enrolled').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Existing</p>
                </div>
                <div className="bg-red-500/10 rounded-lg p-3">
                  <XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-red-500">
                    {importResults.filter(r => r.status === 'error').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-secondary sticky top-0">
                    <tr>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResults.map((result, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{result.email}</td>
                        <td className="p-2">
                          <Badge variant={
                            result.status === 'created' ? 'default' :
                            result.status === 'error' ? 'destructive' : 'secondary'
                          }>
                            {result.status}
                          </Badge>
                        </td>
                        <td className="p-2 text-muted-foreground">{result.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Clock className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-500">Pending Invitations</p>
                    <p className="text-sm text-muted-foreground">
                      New students are in "pending" status. Send invitation emails from User Management to let them set their passwords.
                    </p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={resetImportDialog}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminUsers() {
  return (
    <AdminLayout>
      <AdminUsersContent />
    </AdminLayout>
  );
}
