-- Soft-delete support for users (clients). A non-null deletedAt means the client
-- is removed; combined with isActive this lets an admin deactivate or delete a
-- client and force them out (JwtStrategy + login reject inactive/deleted users).
ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "deletedBy" TEXT;
