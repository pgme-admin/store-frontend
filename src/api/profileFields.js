import client from './client';

/**
 * The student profile field rules (admin: Settings > Student Profile Fields):
 * what is asked, and what is required. Public; the server caches it.
 * Resolves to null when this server has no rules yet (older backend).
 */
export async function getProfileFields() {
  const { data } = await client.get('/app-settings/profile-fields');
  return Array.isArray(data?.data?.fields) ? data.data : null;
}

/** Saves the signed-in student's profile details. Returns the updated user. */
export async function updateMyProfile(fields) {
  const { data } = await client.put('/users/profile', fields);
  return data?.data?.user || null;
}
