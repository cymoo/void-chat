import type {
  AdminDashboardResponse,
  User,
} from "@/api/types";

export interface AdminDashboardRoom {
  id: number;
  name: string;
  description?: string;
  isPrivate: boolean;
  maxUsers: number;
  onlineUsers: number;
  creatorId?: number | null;
}

export interface AdminTabProps {
  dashboard: AdminDashboardResponse;
  currentUser: User;
  canManagePlatformUsers: boolean;
  addToast: (message: string, type: "success" | "error" | "info") => void;
  confirm: (options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    tone?: "default" | "danger";
  }) => Promise<boolean>;
  updateUserInDashboard: (user: User) => void;
  setDashboard: React.Dispatch<React.SetStateAction<AdminDashboardResponse | null>>;
}

export function isMutedUser(user: User): boolean {
  if (user.isMuted) return true;
  if (typeof user.mutedUntil !== "number") return false;
  return user.mutedUntil > Date.now();
}

export function roomCapacityPercent(onlineUsers: number, maxUsers: number): number {
  if (!Number.isFinite(maxUsers) || maxUsers <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((onlineUsers / maxUsers) * 100)));
}
