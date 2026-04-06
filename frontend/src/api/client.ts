import type {
  AuthResponse,
  CreateRoomRequest,
  RoomInfo,
  Room,
  UpdateProfileRequest,
  UploadResponse,
  User,
} from "./types";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  return localStorage.getItem("authToken");
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null as T;

  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(res.status, data.message ?? data.error ?? "Request failed");
  }
  return data as T;
}

// Auth API
export async function login(
  username: string,
  password: string,
): Promise<AuthResponse> {
  return request("POST", "/api/auth/login", { username, password });
}

export async function register(
  username: string,
  password: string,
): Promise<AuthResponse> {
  return request("POST", "/api/auth/register", { username, password });
}

export async function logout(): Promise<void> {
  return request("POST", "/api/auth/logout");
}

export async function getMe(): Promise<User> {
  return request("GET", "/api/auth/me");
}

// Room API
export async function getRooms(): Promise<RoomInfo[]> {
  return request("GET", "/api/rooms");
}

export async function createRoom(req: CreateRoomRequest): Promise<Room> {
  return request("POST", "/api/rooms", req);
}

// User API
export async function getUser(userId: number): Promise<User> {
  return request("GET", `/api/users/${userId}`);
}

export async function updateProfile(req: UpdateProfileRequest): Promise<User> {
  return request("PATCH", "/api/users/me", req);
}

export async function getUnreadDmSenders(): Promise<
  Array<{ senderId: number; senderUsername: string; unreadCount: number }>
> {
  return request("GET", "/api/dms/unread-senders");
}

// File upload API
export async function uploadImage(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("image", file);

  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch("/api/upload/image", {
    method: "POST",
    headers,
    body: formData,
  });
  return res.json();
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch("/api/upload/file", {
    method: "POST",
    headers,
    body: formData,
  });
  return res.json();
}

export { ApiError };
