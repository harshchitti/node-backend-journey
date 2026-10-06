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
     pgm.dropConstraint('bookings', 'bookings_status_check');
  pgm.addConstraint('bookings', 'bookings_status_check', {
    check: "status IN ('confirmed', 'cancelled')",
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
      pgm.dropConstraint('bookings', 'bookings_status_check');
  pgm.addConstraint('bookings', 'bookings_status_check', {
    check: "status IN ('pending', 'confirmed', 'cancelled')",
  });
};
