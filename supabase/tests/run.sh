#!/bin/zsh
# Levanta un Postgres 15 descartable en Docker, aplica todas las migraciones en el orden en que
# se ejecutan en Supabase y corre las pruebas. Uso: ./supabase/tests/run.sh
# Requiere Docker Desktop abierto y psql (brew install libpq).
set -u

ROOT=${0:A:h:h:h}
cd $ROOT

# Mismo orden que en Supabase. Agregar cada migración nueva al final.
MIGRATIONS=(
  supabase/20260914-schema-inicial.sql
  supabase/20260914-rls-policies.sql
  supabase/20260914-seed-events.sql
  supabase/20260914-add-event-image.sql
  supabase/20260914-seed-event-images.sql
  supabase/20260914-expand-categories.sql
  supabase/20260927-identidad-verificada.sql
  supabase/20260927-solicitudes-y-avisos.sql
  supabase/20260927-cancelar-solicitudes.sql
  supabase/20260927-backend-identidad.sql
)

# Las pruebas comparten estado (usuarios y eventos), así que corren en este orden.
TESTS=(
  supabase/tests/20260927-identidad-verificada.sql
  supabase/tests/20260927-solicitudes-y-avisos.sql
  supabase/tests/20260927-cancelar-solicitudes.sql
  supabase/tests/20260927-backend-identidad.sql
)

CONTAINER=plus1-sql-tests
PORT=55432
PSQL=$(command -v psql || echo /opt/homebrew/opt/libpq/bin/psql)
export PGPASSWORD=postgres

docker rm -f $CONTAINER >/dev/null 2>&1
docker run -d --name $CONTAINER -e POSTGRES_PASSWORD=postgres -p $PORT:5432 postgres:15 >/dev/null || exit 1
trap 'docker rm -f $CONTAINER >/dev/null 2>&1' EXIT

for i in {1..60}; do
  $PSQL -h localhost -p $PORT -U postgres -c 'select 1' >/dev/null 2>&1 && break
  sleep 1
done

for f in supabase/tests/_stub-supabase.sql $MIGRATIONS $TESTS; do
  echo ">> $f"
  $PSQL -h localhost -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -t -f $f 2>&1 \
    | grep -vE '^\s*$|wal_level|HINT:  Set wal_level' \
    | sed -E 's/^psql:[^ ]+ NOTICE:  /   /'
  if [[ ${pipestatus[1]} -ne 0 ]]; then
    echo "FALLÓ: $f"
    exit 1
  fi
done

echo "OK: todas las migraciones y pruebas pasaron"
