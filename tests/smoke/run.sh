#!/bin/sh
# Test de bout en bout SIMULÉ : un faux navigateur (jsdom) joue le parcours complet
# (inscription, onglets, messagerie, calibration, série, historique, réglages, déconnexion)
# avec une fausse caméra et un faux MediaPipe qui fournissent un squelette scénarisé.
# Il ne remplace pas un essai sur un vrai téléphone avec la vraie caméra.
# Prérequis : Node 20+ et une connexion internet (pour installer jsdom dans un dossier temporaire).
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HERE/../.."
TMP="$(mktemp -d)"
cp -r "$APP" "$TMP/app"
rm -rf "$TMP/app/tests" "$TMP/app/node_modules"
cp "$HERE/stubs/camera.js" "$HERE/stubs/poseDetector.js" "$TMP/app/src/"
cp "$HERE/smoke.mjs" "$TMP/"
cd "$TMP"
npm init -y >/dev/null
npm install jsdom --no-audit --no-fund >/dev/null
node smoke.mjs
