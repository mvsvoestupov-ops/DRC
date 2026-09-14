const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  async request<T>(method: string, endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string>),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = errorData.detail || `HTTP error ${response.status}`;
      const error = new Error(detail);
      (error as any).status = response.status;
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('auth:logout'));
      }
      throw error;
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return response.json();
  }

  get = <T>(endpoint: string, options?: RequestInit) =>
    this.request<T>('GET', endpoint, undefined, options);

  post = <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    this.request<T>('POST', endpoint, body, options);

  put = <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    this.request<T>('PUT', endpoint, body, options);

  delete = <T>(endpoint: string, options?: RequestInit) =>
    this.request<T>('DELETE', endpoint, undefined, options);

  // Для отправки данных в формате application/x-www-form-urlencoded
  postForm = <T>(endpoint: string, body: URLSearchParams, options?: RequestInit) =>
    this.request<T>('POST', endpoint, body.toString(), {
      ...options,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...options?.headers,
      },
    });
}

export const apiClient = new ApiClient();
