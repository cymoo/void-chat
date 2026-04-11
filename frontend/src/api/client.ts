import type {
  AdminDashboardResponse,
  AuthResponse,
  CreateRoomRequest,
  RoomInfo,
  Room,
  UpdateRoomRequest,
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

function isGenericErrorMessage(
  message: string | undefined,
  status: number,
): boolean {
  if (!message) return true;
  return message === "Request failed" || message === `Server error (${status})`;
}

function toFriendlyErrorMessage(
  url: string,
  status: number,
  message: string | undefined,
): string {
  if (
    url === "/api/auth/login" &&
    (status === 401 ||
      message?.toLowerCase().includes("invalid username or password"))
  ) {
    return "Username or password is incorrect";
  }
  if (
    url === "/api/auth/register" &&
    (message?.toLowerCase().includes("already exists") ||
      (status === 400 && isGenericErrorMessage(message, status)))
  ) {
    return "Username already exists or input is invalid";
  }
  if (
    (url === "/api/upload/image" || url === "/api/upload/file") &&
    status === 413
  ) {
    return "File is too large to upload";
  }
  return message ?? `Server error (${status})`;
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

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Network error — is the server running?");
  }

  if (res.status === 204) return null as T;

  let data: Record<string, unknown> | undefined;
  try {
    data = await res.json();
  } catch {
    // Response body is not valid JSON
  }

  if (!res.ok) {
    const rawMsg =
      (data?.message as string) ??
      (data?.error as string) ??
      `Server error (${res.status})`;
    throw new ApiError(
      res.status,
      toFriendlyErrorMessage(url, res.status, rawMsg),
    );
  }

  if (data === undefined || data === null) {
    throw new ApiError(res.status, "Unexpected response from server");
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

export async function updateRoom(
  roomId: number,
  req: UpdateRoomRequest,
): Promise<Room> {
  return request("PATCH", `/api/rooms/${roomId}`, req);
}

export async function deleteRoom(roomId: number): Promise<void> {
  return request("DELETE", `/api/rooms/${roomId}`);
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
  const data = await request<
    Array<{
      senderId?: number;
      senderUsername?: string;
      userId?: number;
      username?: string;
      unreadCount?: number;
    }>
  >("GET", "/api/dms/unread-senders");
  return data.map((item) => ({
    senderId: item.senderId ?? item.userId ?? 0,
    senderUsername: item.senderUsername ?? item.username ?? "",
    unreadCount: item.unreadCount ?? 0,
  }));
}

// Admin API
export async function getAdminDashboard(): Promise<AdminDashboardResponse> {
  return request("GET", "/api/admin/dashboard");
}

export async function updateAdminUserRole(
  userId: number,
  role: string,
): Promise<User> {
  return request("PATCH", `/api/admin/users/${userId}/role`, { role });
}

// File upload API
async function uploadMultipart(
  url: "/api/upload/image" | "/api/upload/file",
  fieldName: "image" | "file",
  file: File,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append(fieldName, file);

  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });
  } catch {
    throw new ApiError(0, "Network error — is the server running?");
  }

  let data: Record<string, unknown> | undefined;
  try {
    data = await res.json();
  } catch {
    // server may return plain text for large payload (e.g. 413)
  }

  if (!res.ok) {
    const rawMsg =
      (data?.message as string) ??
      (data?.error as string) ??
      `Server error (${res.status})`;
    throw new ApiError(
      res.status,
      toFriendlyErrorMessage(url, res.status, rawMsg),
    );
  }

  if (!data) {
    throw new ApiError(res.status, "Upload failed: abnormal server response");
  }

  const upload = data as Partial<UploadResponse>;
  if (typeof upload.success !== "boolean") {
    throw new ApiError(res.status, "Upload failed: abnormal server response");
  }
  if (!upload.success) {
    throw new ApiError(res.status, upload.error ?? "Upload failed");
  }
  return upload as UploadResponse;
}

export async function uploadImage(file: File): Promise<UploadResponse> {
  return uploadMultipart("/api/upload/image", "image", file);
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  return uploadMultipart("/api/upload/file", "file", file);
}

export { ApiError };
