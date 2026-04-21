// ============================================
// TypeScript types matching backend Kotlin models
// ============================================

export interface User {
  id: number;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
  status?: string | null;
  role?: string | null;
  capabilities?: UserCapabilities | null;
  isDisabled?: boolean;
  disabledReason?: string | null;
  mutedUntil?: number | null;
  muteReason?: string | null;
  isMuted?: boolean;
  isBot?: boolean;
  displayName?: string | null;
  isOnline?: boolean;
  createdAt: number;
  lastSeen: number;
}

export interface UserCapabilities {
  canAccessAdminDashboard: boolean;
  canManagePlatformUsers: boolean;
}

export interface Room {
  id: number;
  name: string;
  description?: string | null;
  isPrivate: boolean;
  creatorId?: number | null;
  createdAt: number;
  maxUsers: number;
}

export interface RoomInfo {
  id: number;
  name: string;
  description?: string | null;
  isPrivate: boolean;
  creatorId?: number | null;
  onlineUsers: number;
  maxUsers: number;
}

export interface ReplyInfo {
  id: number;
  username: string;
  content: string;
  messageType: string;
}

// Discriminated union for chat messages
export type ChatMessage =
  | TextMessage
  | ImageMessage
  | FileMessage
  | SystemMessage;

interface BaseMessage {
  id: number;
  timestamp: number;
  replyTo?: ReplyInfo | null;
}

export interface TextMessage extends BaseMessage {
  messageType: "text";
  userId: number;
  username: string;
  avatarUrl?: string | null;
  content: string;
  editedAt?: number | null;
}

export interface ImageMessage extends BaseMessage {
  messageType: "image";
  userId: number;
  username: string;
  avatarUrl?: string | null;
  imageUrl: string;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface FileMessage extends BaseMessage {
  messageType: "file";
  userId: number;
  username: string;
  avatarUrl?: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export interface SystemMessage extends BaseMessage {
  messageType: "system";
  content: string;
}

export interface PrivateMessage {
  id: number;
  senderId: number;
  senderUsername: string;
  senderAvatarUrl?: string | null;
  receiverId: number;
  receiverUsername: string;
  messageType: string;
  content?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
  isRead: boolean;
  timestamp: number;
}

export interface DmInboxEntry {
  userId: number;
  username: string;
  avatarUrl?: string | null;
  latestMessageType: string;
  latestMessagePreview: string;
  latestMessageTimestamp: number;
  latestMessageSenderId: number;
  unreadCount: number;
}

// WebSocket message payloads (client → server)
export interface WsSendPayload {
  type: string;
  username?: string;
  content?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  mimeType?: string;
  messageId?: number;
  targetUserId?: number;
  replyToId?: number;
  beforeId?: number;
  query?: string;
  role?: string;
  isTyping?: boolean;
  avatarUrl?: string;
  bio?: string;
  status?: string;
}

// WebSocket events (server → client)
export interface WsHistoryEvent {
  type: "history";
  messages: ChatMessage[];
  hasMore: boolean;
}

export interface WsUsersEvent {
  type: "users";
  users: User[];
}

export interface WsMessageEvent {
  type: "message";
  message: ChatMessage;
}

export interface WsUserJoinedEvent {
  type: "user_joined";
  user: User;
}

export interface WsUserLeftEvent {
  type: "user_left";
  userId: number;
  username: string;
}

export interface WsErrorEvent {
  type: "error";
  message: string;
}

export interface WsMessageEditedEvent {
  type: "message_edited";
  messageId: number;
  content: string;
  editedAt: number;
}

export interface WsMessageDeletedEvent {
  type: "message_deleted";
  messageId: number;
}

export interface WsPrivateMessageEvent {
  type: "private_message";
  message: PrivateMessage;
}

export interface WsPrivateHistoryEvent {
  type: "private_history";
  messages: PrivateMessage[];
  hasMore: boolean;
}

export interface WsMentionEvent {
  type: "mention";
  messageId: number;
  mentionedBy: string;
  content: string;
}

export interface WsUserUpdatedEvent {
  type: "user_updated";
  user: User;
}

export interface WsKickedEvent {
  type: "kicked";
  reason: string;
}

export interface WsRoleChangedEvent {
  type: "role_changed";
  userId: number;
  role: string;
}

export interface WsSearchResultsEvent {
  type: "search_results";
  messages: ChatMessage[];
  query: string;
}

export interface WsUnreadCountsEvent {
  type: "unread_counts";
  unreadDms: number;
}

export interface WsTypingEvent {
  type: "typing";
  userId: number;
  username: string;
  isTyping: boolean;
}

export type WsEvent =
  | WsHistoryEvent
  | WsUsersEvent
  | WsMessageEvent
  | WsUserJoinedEvent
  | WsUserLeftEvent
  | WsErrorEvent
  | WsMessageEditedEvent
  | WsMessageDeletedEvent
  | WsPrivateMessageEvent
  | WsPrivateHistoryEvent
  | WsMentionEvent
  | WsUserUpdatedEvent
  | WsKickedEvent
  | WsRoleChangedEvent
  | WsSearchResultsEvent
  | WsUnreadCountsEvent
  | WsTypingEvent;

// API request/response types
export interface AuthResponse {
  token: string;
  user: User;
}

export interface AdminDashboardResponse {
  users: User[];
  rooms: RoomInfo[];
  registrationMode: RegistrationMode;
  invites: InviteLink[];
}

export type RegistrationMode = "open" | "invite_only";

export interface RegistrationModeResponse {
  mode: RegistrationMode;
}

export interface InviteLink {
  id: number;
  codePreview: string;
  createdByUserId: number;
  createdByUsername?: string | null;
  maxUses?: number | null;
  usedCount: number;
  expiresAt?: number | null;
  revokedAt?: number | null;
  createdAt: number;
  isActive: boolean;
}

export interface CreateInviteLinkRequest {
  maxUses?: number | null;
  expiresInHours?: number | null;
}

export interface CreateInviteLinkResponse {
  invite: InviteLink;
  code: string;
}

export interface CreateRoomRequest {
  name: string;
  description?: string | null;
  isPrivate?: boolean;
  password?: string | null;
  maxUsers?: number | null;
}

export interface UpdateRoomRequest {
  name: string;
  description?: string | null;
  isPrivate: boolean;
  password?: string | null;
  maxUsers?: number | null;
}

export interface UpdateProfileRequest {
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  status?: string | null;
}

export interface UpdateUserRoleRequest {
  role: string;
}

export interface UpdateUserDisableRequest {
  disabled: boolean;
  reason?: string | null;
}

export interface UpdateUserMuteRequest {
  muted: boolean;
  durationMinutes?: number | null;
  reason?: string | null;
}

export interface UpdateRegistrationModeRequest {
  mode: RegistrationMode;
}

export interface UploadResponse {
  success: boolean;
  url?: string | null;
  thumbnail?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  error?: string | null;
}

// Persona (digital persona) types
export interface InvitePersonaRequest {
  name: string;
  personality?: string | null;
}

export interface InvitePersonaResponse {
  success: boolean;
  displayName?: string | null;
  bio?: string | null;
  error?: string | null;
  userId?: number | null;
}

export interface PersonaConfig {
  userId: number;
  name: string;
  displayName: string;
  bio: string;
  personality?: string | null;
  systemPrompt?: string | null;
  invitedBy: number;
  createdAt: number;
}

export interface UpdatePersonaRequest {
  displayName?: string | null;
  bio?: string | null;
  systemPrompt?: string | null;
  personality?: string | null;
}
