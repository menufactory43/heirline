#!/bin/sh
# Le serveur de jeu public (port 2700), lancé par launchd (tools/launchd/com.praxeon.heirline.serveur.plist).
# Commande standard : production, code de test lu dans data/code-test.txt, jamais HEIRLINE_DEBUG.
cd "$(dirname "$0")/.." || exit 1
export PATH="$HOME/.local/opt/node-v22.23.4-darwin-arm64/bin:/opt/homebrew/bin:/usr/bin:/bin"
export PORT=2700 NODE_ENV=production
[ -f data/code-test.txt ] && export HEIRLINE_TEST="$(cat data/code-test.txt)"
unset HEIRLINE_DEBUG
exec node node_modules/.bin/tsx server/main.ts
