/** Shape returned from Supabase `users` table (JWT strategy). */
export type JwtUser = Record<string, unknown> & {
  id: string;
  email?: string;
  name?: string | null;
  role?: string;
};
