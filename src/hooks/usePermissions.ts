import { useAuth } from "./useAuth";
import { hasPermission } from "@/constants/permissions";
import type { Permission } from "@/types";

export function usePermissions() {
  const { session } = useAuth();
  const role = session?.user.role ?? "seller";
  return {
    role,
    can: (p: Permission) => hasPermission(role, p),
  };
}
