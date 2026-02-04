import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Search,
  Plus,
  MoreVertical,
  Users,
  FileText,
  Sparkles,
  Trash2,
  Edit,
  UserPlus,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface CourseData {
  id: string;
  name: string;
  org_id: string;
  course_type: string;
  total_sessions: number;
  total_chunks: number;
  documents_count: number;
  enrollments_count: number;
  created_at: string;
}

const typeColors: Record<string, string> = {
  micro: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  standard: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
  certification: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
};

const typeBannerColors: Record<string, string> = {
  micro: 'bg-blue-500',
  standard: 'bg-purple-500',
  certification: 'bg-amber-500',
};

function AdminCoursesContent() {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [users, setUsers] = useState<{ id: string; email: string; full_name?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<CourseData | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newCourse, setNewCourse] = useState({
    name: '',
    course_type: 'standard'
  });
  const [editCourse, setEditCourse] = useState({
    name: '',
    course_type: ''
  });

  useEffect(() => {
    loadCourses();
    loadUsers();
  }, []);

  const loadCourses = async () => {
    try {
      const data = await api.getAdminCourses();
      setCourses(data);
    } catch (error) {
      console.error('Failed to load courses:', error);
      setCourses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await api.getAdminUsers({ role: 'student' });
      setUsers(data.map((u: any) => ({ id: u.id, email: u.email, full_name: u.full_name })));
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
    }
  };

  const handleAddCourse = async () => {
    try {
      const created = await api.createCourse(newCourse);
      setCourses([created, ...courses]);
      setIsAddDialogOpen(false);
      setNewCourse({ name: '', course_type: 'standard' });
      toast.success('Course created successfully');
    } catch (error) {
      toast.error('Failed to create course');
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      await api.deleteCourse(courseId);
      setCourses(courses.filter(c => c.id !== courseId));
      toast.success('Course deleted');
    } catch (error) {
      toast.error('Failed to delete course');
    }
  };

  const handleEditCourse = (course: CourseData) => {
    setSelectedCourse(course);
    setEditCourse({ name: course.name, course_type: course.course_type });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedCourse) return;
    try {
      await api.updateCourse(selectedCourse.id, editCourse);
      setCourses(courses.map(c => 
        c.id === selectedCourse.id 
          ? { ...c, name: editCourse.name, course_type: editCourse.course_type }
          : c
      ));
      setIsEditDialogOpen(false);
      setSelectedCourse(null);
      toast.success('Course updated');
    } catch (error) {
      toast.error('Failed to update course');
    }
  };

  const handleManageEnrollments = (course: CourseData) => {
    setSelectedCourse(course);
    setSelectedUserId('');
    setIsEnrollDialogOpen(true);
  };

  const handleEnrollUser = async () => {
    if (!selectedCourse || !selectedUserId) return;
    try {
      await api.enrollUser(selectedUserId, selectedCourse.id);
      // Update enrollment count locally
      setCourses(courses.map(c =>
        c.id === selectedCourse.id
          ? { ...c, enrollments_count: c.enrollments_count + 1 }
          : c
      ));
      setSelectedUserId('');
      toast.success('Student enrolled successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to enroll student');
    }
  };

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !typeFilter || course.course_type === typeFilter;
    return matchesSearch && matchesType;
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
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Course Management</h1>
              <p className="text-muted-foreground">{courses.length} courses in your organization</p>
            </div>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Course
          </Button>
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
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={typeFilter === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter(null)}
          >
            <Filter className="w-4 h-4 mr-1" />
            All
          </Button>
          <Button
            variant={typeFilter === 'micro' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter(typeFilter === 'micro' ? null : 'micro')}
          >
            Micro
          </Button>
          <Button
            variant={typeFilter === 'standard' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter(typeFilter === 'standard' ? null : 'standard')}
          >
            Standard
          </Button>
          <Button
            variant={typeFilter === 'certification' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter(typeFilter === 'certification' ? null : 'certification')}
          >
            Certification
          </Button>
        </div>
      </motion.div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map((course, i) => (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
          >
            <Card className="border-border/50 hover:border-primary/30 transition-all duration-300 overflow-hidden h-full">
              {/* Type Banner */}
              <div className={`h-2 w-full ${typeBannerColors[course.course_type]}`} />
              
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <Badge variant="outline" className={`${typeColors[course.course_type]} capitalize`}>
                    {course.course_type}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditCourse(course)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Course
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleManageEnrollments(course)}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Manage Enrollments
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDeleteCourse(course.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Course
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardTitle className="text-lg mt-2">{course.name}</CardTitle>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm bg-secondary/50 rounded-lg p-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span>{course.enrollments_count} students</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm bg-secondary/50 rounded-lg p-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <span>{course.documents_count} docs</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm bg-secondary/50 rounded-lg p-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <span>{course.total_sessions} sessions</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm bg-secondary/50 rounded-lg p-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span>{course.total_chunks} chunks</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(course.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Add Course Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Course</DialogTitle>
            <DialogDescription>
              Set up a new course for your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Course Name</Label>
              <Input
                id="name"
                placeholder="e.g., Data Structures & Algorithms"
                value={newCourse.name}
                onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Course Type</Label>
              <Select 
                value={newCourse.course_type} 
                onValueChange={(v) => setNewCourse({ ...newCourse, course_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="micro">Micro (5-10 sessions)</SelectItem>
                  <SelectItem value="standard">Standard (10-50 sessions)</SelectItem>
                  <SelectItem value="certification">Certification (50+ sessions)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Course type determines the RAG strategy used for answers
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCourse}>
              Create Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Course Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update course details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Course Name</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Data Structures & Algorithms"
                value={editCourse.name}
                onChange={(e) => setEditCourse({ ...editCourse, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Course Type</Label>
              <Select 
                value={editCourse.course_type} 
                onValueChange={(v) => setEditCourse({ ...editCourse, course_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="micro">Micro (5-10 sessions)</SelectItem>
                  <SelectItem value="standard">Standard (10-50 sessions)</SelectItem>
                  <SelectItem value="certification">Certification (50+ sessions)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Enrollments Dialog */}
      <Dialog open={isEnrollDialogOpen} onOpenChange={setIsEnrollDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Enrollments</DialogTitle>
            <DialogDescription>
              {selectedCourse?.name} - Currently {selectedCourse?.enrollments_count} students enrolled
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="enroll-user">Enroll Student</Label>
              <Select 
                value={selectedUserId} 
                onValueChange={setSelectedUserId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {users.length === 0 ? (
                    <SelectItem value="" disabled>No students available</SelectItem>
                  ) : (
                    users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEnrollDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={handleEnrollUser} disabled={!selectedUserId}>
              Enroll Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminCourses() {
  return (
    <AdminLayout>
      <AdminCoursesContent />
    </AdminLayout>
  );
}
