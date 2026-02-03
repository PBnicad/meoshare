import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { Upload, LogOut } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { api, type User } from '../lib/api';
import Landing from './Landing';

interface FileUpload {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  fileId?: string;
  downloadUrl?: string;
  error?: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [userFiles, setUserFiles] = useState<any[]>([]);
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [expiresIn, setExpiresIn] = useState('7');
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 检查用户登录状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await api.getUser();
        setUser(result.user);
        // 如果已登录，加载文件列表
        await loadFiles();
      } catch (_error) {
        // 未登录或会话过期
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const loadFiles = async () => {
    try {
      const result = await api.getFiles();
      setUserFiles(result.files);
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const upload: FileUpload = {
        file,
        progress: 0,
        status: 'uploading',
      };
      setUploads((prev) => [...prev, upload]);
      uploadFile(file, upload);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFile = async (file: File, upload: FileUpload) => {
    try {
      const result = await api.uploadFile(file, parseInt(expiresIn));

      setUploads((prev) =>
        prev.map((u) =>
          u.file === file
            ? { ...u, progress: 100, status: 'success', fileId: result.fileId, downloadUrl: result.downloadUrl }
            : u
        )
      );

      // Refresh file list
      loadFiles();
    } catch (error) {
      setUploads((prev) =>
        prev.map((u) =>
          u.file === file ? { ...u, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' } : u
        )
      );
    }
  };

  const deleteFile = async (fileId: string) => {
    try {
      await api.deleteFile(fileId);
      loadFiles();
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(window.location.origin + url);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
      setUserFiles([]);
      // 退出后重新加载页面，会显示落地页
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      // 即使失败也清除本地状态并跳转
      setUser(null);
      setUserFiles([]);
      window.location.href = '/';
    }
  };

  // 加载中显示
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  // 未登录显示落地页
  if (!user) {
    return <Landing />;
  }

  // 已登录显示上传界面
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">MeoShare</h1>
            <p className="text-sm text-muted-foreground">临时文件分享服务</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              退出
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12">
        {/* Upload Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>上传文件</CardTitle>
            <CardDescription>支持任意文件类型，文件将在指定时间后自动过期</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Expiration Selector */}
            <div className="space-y-2">
              <Label htmlFor="expires">过期时间</Label>
              <Select value={expiresIn} onValueChange={setExpiresIn}>
                <SelectTrigger id="expires" className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 3, 7, 14, 30].map((days) => (
                    <SelectItem key={days} value={days.toString()}>
                      {days} 天
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Upload Area */}
            <div
              className="border-2 border-dashed rounded-lg p-12 text-center transition-colors border-border hover:border-muted-foreground/50 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-12 w-12 mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">点击或拖拽文件到此处上传</p>
              <p className="text-xs text-muted-foreground">支持任意文件类型</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={handleFileSelect}
              />
            </div>

            {/* Upload List */}
            {uploads.length > 0 && (
              <div className="space-y-3">
                {uploads.map((upload, i) => (
                  <div key={i} className="border border-border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{upload.file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(upload.file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    {upload.status === 'uploading' && (
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${upload.progress}%` }}
                        />
                      </div>
                    )}
                    {upload.status === 'success' && upload.downloadUrl && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-green-500">上传成功</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(upload.downloadUrl!)}
                        >
                          复制链接
                        </Button>
                      </div>
                    )}
                    {upload.status === 'error' && (
                      <span className="text-sm text-destructive">{upload.error}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Files Section */}
        {userFiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>我的文件</CardTitle>
              <CardDescription>管理你分享的文件</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {userFiles.map((file) => (
                  <div key={file.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.filename}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(file.size / 1024 / 1024).toFixed(2)} MB · 下载 {file.download_count} 次
                        </p>
                        <p className="text-xs text-muted-foreground">
                          过期时间: {new Date(file.expires_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(`/f/${file.id}`)}
                        >
                          复制链接
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteFile(file.id)}>
                          删除
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
