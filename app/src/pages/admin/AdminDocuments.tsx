import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Search,
  Upload,
  MoreVertical,
  Trash2,
  Eye,
  Filter,
  BookOpen,
  Sparkles,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

interface DocumentData {
  id: string;
  course_id: string;
  course_name: string;
  title: string;
  session_id: string | null;
  content_type: string;
  source_uri: string;
  chunks_count: number;
  created_at: string;
}

interface ChunkData {
  id: string;
  document_id: string;
  course_id: string;
  session_id: string | null;
  chunk_index: number;
  text: string;
  assignment_allowed: boolean;
  slide_number: number | null;
  slide_title: string | null;
  embedding_id: string | null;
  created_at: string;
}

const contentTypeColors: Record<string, string> = {
  slide: 'bg-blue-500/20 text-blue-500',
  pre_read: 'bg-green-500/20 text-green-500',
  post_read: 'bg-purple-500/20 text-purple-500',
  quiz: 'bg-amber-500/20 text-amber-500',
  transcript: 'bg-pink-500/20 text-pink-500',
};

function AdminDocumentsContent() {
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Chunks dialog state
  const [isChunksDialogOpen, setIsChunksDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentData | null>(null);
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);
  
  // Delete confirmation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [uploadForm, setUploadForm] = useState({
    course_id: '',
    title: '',
    content_type: 'slide',
    session_id: '',
  });

  useEffect(() => {
    loadDocuments();
    loadCourses();
  }, []);

  const loadDocuments = async () => {
    try {
      const data = await api.getAdminDocuments();
      setDocuments(data);
    } catch (error) {
      console.error('Failed to load documents:', error);
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const data = await api.getAdminCourses();
      setCourses(data.map((c: any) => ({ id: c.id, name: c.name })));
    } catch (error) {
      console.error('Failed to load courses:', error);
      setCourses([]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-fill title from filename
      const title = file.name.replace('.pdf', '').replace(/-/g, ' ').replace(/_/g, ' ');
      setUploadForm(prev => ({ ...prev, title }));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }
    if (!uploadForm.course_id) {
      toast.error('Please select a course');
      return;
    }
    if (!uploadForm.title) {
      toast.error('Please enter a title');
      return;
    }

    setIsIngesting(true);
    try {
      // Upload file and ingest in one request
      const result = await api.uploadAndIngestDocument(
        selectedFile,
        uploadForm.course_id,
        uploadForm.title,
        uploadForm.content_type as 'slide' | 'pre_read' | 'post_read' | 'quiz' | 'transcript',
        uploadForm.session_id || undefined,
        true  // assignment_allowed
      );
      
      toast.success('Document ingested successfully', {
        description: `Created ${result.chunks_created} chunks with ${result.embeddings_generated} embeddings`
      });
      
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadForm({ course_id: '', title: '', content_type: 'slide', session_id: '' });
      loadDocuments();
    } catch (error: any) {
      toast.error('Failed to ingest document', {
        description: error.message || 'Check the server logs for details'
      });
    } finally {
      setIsIngesting(false);
    }
  };

  const handleViewChunks = async (doc: DocumentData) => {
    setSelectedDocument(doc);
    setIsChunksDialogOpen(true);
    setIsLoadingChunks(true);
    try {
      const data = await api.getDocumentChunks(doc.id);
      setChunks(data);
    } catch (error) {
      toast.error('Failed to load chunks');
      setChunks([]);
    } finally {
      setIsLoadingChunks(false);
    }
  };

  const handleDeleteClick = (doc: DocumentData) => {
    setDocumentToDelete(doc);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;
    
    setIsDeleting(true);
    try {
      const result = await api.deleteDocument(documentToDelete.id);
      setDocuments(documents.filter(d => d.id !== documentToDelete.id));
      toast.success('Document deleted', {
        description: `Removed ${result.deleted_embeddings} embeddings from vector store`
      });
      setIsDeleteDialogOpen(false);
      setDocumentToDelete(null);
    } catch (error) {
      toast.error('Failed to delete document');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.course_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !typeFilter || doc.content_type === typeFilter;
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
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Document Management</h1>
              <p className="text-muted-foreground">{documents.length} documents uploaded</p>
            </div>
          </div>
          <Button onClick={() => setIsUploadDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
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
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={typeFilter === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter(null)}
          >
            <Filter className="w-4 h-4 mr-1" />
            All
          </Button>
          {['slide', 'pre_read', 'post_read', 'quiz', 'transcript'].map(type => (
            <Button
              key={type}
              variant={typeFilter === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter(typeFilter === type ? null : type)}
            >
              {type.replace('_', ' ')}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Documents Table */}
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
                    <th className="text-left p-4 text-sm font-medium">Document</th>
                    <th className="text-left p-4 text-sm font-medium">Course</th>
                    <th className="text-left p-4 text-sm font-medium">Type</th>
                    <th className="text-left p-4 text-sm font-medium">Session</th>
                    <th className="text-left p-4 text-sm font-medium">Chunks</th>
                    <th className="text-left p-4 text-sm font-medium">Uploaded</th>
                    <th className="text-right p-4 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc, i) => (
                    <motion.tr
                      key={doc.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b last:border-0 hover:bg-secondary/20 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{doc.title}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {doc.source_uri}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <BookOpen className="w-4 h-4" />
                          <span className="text-sm">{doc.course_name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={`${contentTypeColors[doc.content_type]} capitalize`}>
                          {doc.content_type.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {doc.session_id || '—'}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <span>{doc.chunks_count}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewChunks(doc)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Chunks
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleDeleteClick(doc)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Document
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

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a PDF document to ingest into the RAG system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* File Upload Area */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                selectedFile ? 'border-primary/50 bg-primary/5' : 'border-border/50 hover:border-primary/30'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pdf"
                className="hidden"
              />
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                  <div className="text-left">
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="font-medium">Click to upload PDF</p>
                  <p className="text-sm text-muted-foreground">or drag and drop</p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="course">Course</Label>
              <Select 
                value={uploadForm.course_id} 
                onValueChange={(v) => setUploadForm({ ...uploadForm, course_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.length === 0 ? (
                    <SelectItem value="" disabled>No courses available</SelectItem>
                  ) : (
                    courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g., Week 3 - Binary Search"
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="content_type">Content Type</Label>
                <Select 
                  value={uploadForm.content_type} 
                  onValueChange={(v) => setUploadForm({ ...uploadForm, content_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slide">Slides</SelectItem>
                    <SelectItem value="pre_read">Pre-read</SelectItem>
                    <SelectItem value="post_read">Post-read</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="transcript">Transcript</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="session">Session ID (Optional)</Label>
                <Input
                  id="session"
                  placeholder="e.g., Week 3"
                  value={uploadForm.session_id}
                  onChange={(e) => setUploadForm({ ...uploadForm, session_id: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={isIngesting}>
              {isIngesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ingesting...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload & Ingest
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Chunks Dialog */}
      <Dialog open={isChunksDialogOpen} onOpenChange={setIsChunksDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Document Chunks</DialogTitle>
            <DialogDescription>
              {selectedDocument?.title} - {chunks.length} chunks
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {isLoadingChunks ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : chunks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No chunks found</p>
            ) : (
              chunks.map((chunk, i) => (
                <Card key={chunk.id} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">#{chunk.chunk_index + 1}</Badge>
                        {chunk.slide_number && (
                          <Badge variant="secondary">Slide {chunk.slide_number}</Badge>
                        )}
                        {chunk.slide_title && (
                          <span className="text-sm font-medium text-muted-foreground">
                            {chunk.slide_title}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {chunk.embedding_id && (
                          <Badge className="bg-green-500/20 text-green-500">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Embedded
                          </Badge>
                        )}
                        {chunk.assignment_allowed && (
                          <Badge className="bg-blue-500/20 text-blue-500">Assignment</Badge>
                        )}
                      </div>
                    </div>
                    <pre className="text-sm whitespace-pre-wrap font-mono bg-secondary/30 p-3 rounded-lg max-h-48 overflow-y-auto">
                      {chunk.text}
                    </pre>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChunksDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{documentToDelete?.title}"? This will also remove all {documentToDelete?.chunks_count} chunks and their embeddings from the vector store. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminDocuments() {
  return (
    <AdminLayout>
      <AdminDocumentsContent />
    </AdminLayout>
  );
}
