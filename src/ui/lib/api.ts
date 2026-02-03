// 在开发环境使用 Vite 代理，生产环境使用相对路径
const API_BASE = '';

export interface FileRecord {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  expiresAt: string;
  downloadCount: number;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

class ApiClient {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE}${path}`;
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async getUser(): Promise<{ user: User }> {
    return this.request('/api/user');
  }

  async getFiles(): Promise<{ files: FileRecord[] }> {
    return this.request('/api/user/files');
  }

  async uploadFile(file: File, expiresIn: number): Promise<{
    fileId: string;
    filename: string;
    size: number;
    expiresAt: string;
    downloadUrl: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('expiresIn', expiresIn.toString());

    const response = await fetch(`${API_BASE}/api/file/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  }

  async uploadFileWithProgress(
    file: File,
    expiresIn: number,
    onProgress: (progress: number) => void
  ): Promise<{
    fileId: string;
    filename: string;
    size: number;
    expiresAt: string;
    downloadUrl: string;
  }> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('expiresIn', expiresIn.toString());

      const xhr = new XMLHttpRequest();

      // 上传进度
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });

      // 上传完成
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve(result);
          } catch (error) {
            reject(new Error('Failed to parse response'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error || 'Upload failed'));
          } catch {
            reject(new Error('Upload failed'));
          }
        }
      });

      // 上传错误
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      // 上传中止
      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      // 发送请求
      xhr.open('POST', `${API_BASE}/api/file/upload`);
      xhr.withCredentials = true;
      xhr.send(formData);
    });
  }

  async deleteFile(fileId: string): Promise<{ success: boolean }> {
    return this.request(`/api/file/${fileId}`, {
      method: 'DELETE',
    });
  }

  async getFileInfo(fileId: string): Promise<FileRecord & { uploader: { name?: string; avatar?: string } }> {
    return this.request(`/api/file/${fileId}`);
  }
}

export const api = new ApiClient();
