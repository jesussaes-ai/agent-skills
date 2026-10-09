#!/bin/bash
# Solicitud de aprobación con botones Aprobar / Rechazar / Responder.
# Uso: request-approval.sh --summary "qué quieres hacer y por qué" [--critical]
#        [--confirm-text "BORRAR tabla clientes"] [--project P] [--voice]
# Acciones destructivas o de producción se marcan críticas automáticamente:
# Jesús tendrá que escribir la frase exacta para aprobarlas.
set -e
exec bash "$(dirname "$0")/notify.sh" --approval "$@"
