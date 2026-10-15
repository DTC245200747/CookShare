#!/bin/sh
(
set -eu
# Validate identifiers and generated passwords before substituting into bootstrap SQL.
for value in "$MYSQL_DATABASE" "$MYSQL_USER" "$DB_MIGRATION_USER"; do
  case "$value" in ''|*[!a-zA-Z0-9_]*) echo 'Database and user names must be alphanumeric or underscore' >&2; exit 1;; esac
done
for value in "$DB_MIGRATION_PASSWORD" "$MYSQL_EXPORTER_PASSWORD"; do
  case "$value" in ''|*[!a-zA-Z0-9_-]*) echo 'Migration/exporter passwords must use letters, digits, underscore or hyphen' >&2; exit 1;; esac
  [ "${#value}" -ge 20 ] || { echo 'Migration/exporter passwords must be at least 20 characters' >&2; exit 1; }
done
export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"
[ "$MYSQL_USER" != "$DB_MIGRATION_USER" ] || { echo 'Runtime and migration users must differ' >&2; exit 1; }
mysql --protocol=socket -uroot <<SQL
CREATE USER IF NOT EXISTS '$DB_MIGRATION_USER'@'%' IDENTIFIED BY '$DB_MIGRATION_PASSWORD';
GRANT ALL PRIVILEGES ON \`$MYSQL_DATABASE\`.* TO '$DB_MIGRATION_USER'@'%';
REVOKE ALL PRIVILEGES ON \`$MYSQL_DATABASE\`.* FROM '$MYSQL_USER'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`$MYSQL_DATABASE\`.* TO '$MYSQL_USER'@'%';
CREATE USER IF NOT EXISTS 'exporter'@'%' IDENTIFIED BY '$MYSQL_EXPORTER_PASSWORD' WITH MAX_USER_CONNECTIONS 3;
GRANT PROCESS, REPLICATION CLIENT ON *.* TO 'exporter'@'%';
GRANT SELECT ON performance_schema.* TO 'exporter'@'%';
SQL
)
