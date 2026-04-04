/**
 * A normalized user read from a source auth provider.
 */
export interface SourceUser {
  /** Display name (derived from username or similar field) */
  name: string;
  /** Email address — used as the unique key across source and destination */
  email: string;
  /** Whether the email has been confirmed */
  emailVerified: boolean;
  /**
   * Raw password hash from the source (e.g. bcrypt).
   * Only present for credential / local-auth users.
   */
  password?: string;
  /**
   * Auth provider identifier.
   * Use "local" for email+password users.
   * Use the provider name (e.g. "google", "github") for OAuth users.
   */
  provider: string;
  /** The role assigned to this user in the source system, if any */
  role?: {
    name: string;
    description?: string;
  };
}

/**
 * A user that has been written to the destination auth provider.
 */
export interface MigratedUser {
  /** Numeric database id — used as the foreign key in account records */
  id: number;
  /** Stable document identifier returned by Strapi's Document Service */
  documentId: string;
}

/**
 * Reads user records from a source auth provider.
 * Implement this interface to add a new migration source.
 */
export interface SourceAdapter {
  /** Returns the total number of users in the source system */
  getUserCount(): Promise<number>;
  /** Returns a page of users from the source system */
  getUsers(options: { limit: number; offset: number }): Promise<SourceUser[]>;
}

/**
 * Writes user records to a destination auth provider.
 * Implement this interface to add a new migration destination.
 */
export interface DestinationAdapter {
  /** Returns true if a user with the given email already exists */
  userExists(email: string): Promise<boolean>;
  /** Creates a user record and returns the persisted identifiers */
  createUser(user: SourceUser): Promise<MigratedUser>;
  /** Creates an account / credential record linked to the migrated user */
  createAccount(user: SourceUser, migratedUser: MigratedUser): Promise<void>;
}

/**
 * Result of a user migration run.
 */
export interface MigrationReport {
  /** Total number of users found in the source system */
  total: number;
  /** Number of users successfully written to the destination */
  migrated: number;
  /** Number of users skipped (e.g. already exist in the destination) */
  skipped: number;
  /** Per-user errors that did not abort the entire run */
  errors: Array<{ email: string; reason: string }>;
}

/**
 * Result of a role migration run.
 */
export interface RoleMigrationReport {
  /** Total number of source roles found */
  total: number;
  /** Number of new roles created in the destination */
  created: number;
  /** Number of roles that already existed and were skipped */
  skipped: number;
  /** Number of users whose role assignment was updated */
  assigned: number;
  /** Per-role / per-user errors that did not abort the run */
  errors: Array<{ name: string; reason: string }>;
}
