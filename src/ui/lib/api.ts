// 在开发环境使用 Vite 代理，生产环境使用相对路径
const API_BASE = '';

export interface File {
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

  async getFiles(): Promise<{ files: File[] }> {
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

    const response = await fetch(`${API_BASE}/api/upload`, {
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

  async deleteFile(fileId: string): Promise<{ success: boolean }> {
    return this.request(`/api/file/${fileId}`, {
      method: 'DELETE',
    });
  }

  async getFileInfo(fileId: string): Promise<File & { uploader: { name?: string; avatar?: string } }> {
    return this.request(`/api/file/${fileId}`);
  }
}

export const api = new ApiClient();
