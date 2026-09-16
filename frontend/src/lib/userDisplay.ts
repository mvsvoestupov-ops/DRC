import type { User } from "@/api/types";

export function formatUserName(user?: Pick<User, "last_name" | "first_name" | "middle_name" | "email"> | null) {
  if (!user) return "";
  const parts = [user.last_name, user.first_name, user.middle_name]
    .map((part) => (part || "").trim())
    .filter(Boolean);
  return parts.join(" ") || user.email || "";
}
