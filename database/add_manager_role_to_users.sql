DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.constraint_column_usage
        WHERE table_name = 'users'
          AND column_name = 'role'
          AND constraint_name = 'users_role_check'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
    END IF;

    ALTER TABLE users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('ADMIN', 'IT', 'HR', 'ACCOUNTING', 'MANAGER'));

    COMMENT ON COLUMN users.role IS 'Vai trò: ADMIN, IT, HR, ACCOUNTING, MANAGER';
END $$;

