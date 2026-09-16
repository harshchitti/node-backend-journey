/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
   pgm.createTable('users', {
    id: 'id', // shorthand for SERIAL PRIMARY KEY
    name: {
      type: 'varchar(100)',
      notNull: true,
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: 'varchar(255)',
      notNull: true,
    },
    role: {
      type: 'varchar(20)',
      notNull: true,
      default: 'student',
      check: "role IN ('student', 'admin')",
    },
    is_verified: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    promoted_by: {
      type: 'integer',
      references: 'users',
      onDelete: 'SET NULL',
    },
    promoted_at: {
      type: 'timestamptz',
    },
   created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
};



/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('users');
};
