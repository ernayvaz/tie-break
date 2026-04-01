export const HALISAHA_ADMIN_PREVIEW_ONLY = false;
export const HALISAHA_ADMIN_PREVIEW_ONLY_MESSAGE =
  "Halisaha Mode is only available to administrators while it is in preview.";
export const HALISAHA_MATCH_NOT_PUBLISHED_MESSAGE =
  "Halisaha Mode is not visible yet. The admin has not published this match.";

export function canAccessHalisahaMode(userRole: string | null | undefined) {
  if (!userRole) {
    return false;
  }
  return !HALISAHA_ADMIN_PREVIEW_ONLY || userRole === "admin";
}
