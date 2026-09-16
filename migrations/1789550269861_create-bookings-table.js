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
  pgm.createTable('bookings', {
    id: 'id', // SERIAL PRIMARY KEY

    room_id: {
      type: 'integer',
      notNull: true,
      references: 'rooms',
    },

    user_id: {
      type: 'integer',
      notNull: true,
      references: 'users',
    },

    start_time: { type: 'timestamptz', notNull: true },
    end_time: { type: 'timestamptz', notNull: true },

    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'pending',
      check: "status IN ('pending', 'confirmed', 'cancelled')",
    },

    created_by_role: {
      type: 'varchar(20)',
      notNull: true,
      default: 'student',
      check: "created_by_role IN ('student', 'admin')",
    },

    performed_by: {
      type: 'integer',
      references: 'users',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.addConstraint('bookings', 'bookings_time_check', 'CHECK (end_time > start_time)');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('bookings');
};
