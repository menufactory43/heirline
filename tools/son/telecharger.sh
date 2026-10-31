#!/bin/sh
# Télécharge les sources du son (toutes CC0) dans son/sources/ (ignoré par git) : bash tools/son/telecharger.sh
# Ensuite : ~/.venvs/famcrawl-audio/bin/python tools/son/construire.py (voir docs/sons.md).
set -e
cd "$(dirname "$0")/../.."
S=son/sources
mkdir -p $S/kenney $S/oga
UA="Mozilla/5.0"
# Kenney (kenney.nl, CC0) : le lien signé se demande avec le cookie de la page
for p in sci-fi-sounds impact-sounds interface-sounds digital-audio rpg-audio ui-audio music-jingles; do
  [ -d $S/kenney/$p ] && continue
  cj=$(mktemp)
  curl -s -c $cj -b $cj -A "$UA" "https://kenney.nl/assets/$p" -o /dev/null
  id=$(printf "assets/$p" | xxd -p | tr -d '\n')
  url=$(curl -s -c $cj -b $cj -A "$UA" -H "Referer: https://kenney.nl/assets/$p" "https://kenney.nl/download-link/$id" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p' | sed 's#\\/#/#g')
  curl -sL -b $cj -A "$UA" "$url" -o $S/kenney/$p.zip
  mkdir -p $S/kenney/$p && unzip -q -o $S/kenney/$p.zip -d $S/kenney/$p && rm $S/kenney/$p.zip
  rm -f $cj
done
# OpenGameArt (opengameart.org, CC0)
oga() { [ -f "$S/oga/$2" ] || curl -sL -A "$UA" -o "$S/oga/$2" "https://opengameart.org/sites/default/files/$1"; }
oga "Alexander%20Ehlers%20-%20Free%20Music%20Pack.zip" ehlers.zip
oga "ogg.zip" dark-sci-fi.zip
oga "exploration_theme.ogg" exploration_theme.ogg
oga "Juhani%20Junkala%20-%20Epic%20Boss%20Battle%20%5BSeamlessly%20Looping%5D.wav" boss_junkala.wav
oga "Heavy_ConceptB.wav" victory_cynic.wav
oga "defeat.mp3" defeat.mp3
[ -d $S/oga/ehlers ] || (mkdir -p $S/oga/ehlers && unzip -q -j -o $S/oga/ehlers.zip -d $S/oga/ehlers)
[ -d $S/oga/dark ] || (mkdir -p $S/oga/dark && unzip -q -j -o $S/oga/dark-sci-fi.zip -d $S/oga/dark)
echo "sources prêtes dans $S"
