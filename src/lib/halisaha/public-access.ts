/**
 * When Halisaha is ready for all users, set to `false` and redeploy.
 * Also remove any copy that refers to "preview" if you surface it in the UI.
 */
export const HALISAHA_ADMIN_PREVIEW_ONLY = true;
export const HALISAHA_ADMIN_PREVIEW_ONLY_MESSAGE =
  "Halisaha Mode is only available to administrators while it is in preview.";

export function canAccessHalisahaMode(userRole: string | null | undefined) {
  return !HALISAHA_ADMIN_PREVIEW_ONLY || userRole === "admin";
}
