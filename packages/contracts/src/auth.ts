import { z } from 'zod';

export const UserRoleSchema = z.enum(['admin', 'manager', 'agent', 'viewer']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2),
  slug: z.string().min(2),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const BranchSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string().min(2),
  code: z.string().min(1),
  city: z.string().min(2),
  is_headquarters: z.boolean().default(false),
  active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Branch = z.infer<typeof BranchSchema>;

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(2),
  email: z.string().email(),
  avatar_url: z.string().url().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const OrganizationMemberSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: UserRoleSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>;

export const BranchMemberSchema = z.object({
  id: z.string().uuid(),
  branch_id: z.string().uuid(),
  user_id: z.string().uuid(),
  is_primary: z.boolean().default(false),
  created_at: z.string().datetime(),
});
export type BranchMember = z.infer<typeof BranchMemberSchema>;

export const UserContextSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string(),
  organization_id: z.string().uuid(),
  role: UserRoleSchema,
  branch_ids: z.array(z.string().uuid()),
  primary_branch_id: z.string().uuid().optional(),
});
export type UserContext = z.infer<typeof UserContextSchema>;
