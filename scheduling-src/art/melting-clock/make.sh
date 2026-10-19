#!/bin/sh
# Rebuilds the melting clock loader: the Blender scene, its frames, and the
# WebP files MeltingClock shows (served from public/). Needs Blender and libwebp:
#   brew install --cask blender && brew install webp
set -eu
cd "$(dirname "$0")"

rm -rf frames
blender -b --factory-startup -P build.py -- --render

out=../../public
# 48 frames at 16fps, so 62.5ms each; WebP frame times are whole milliseconds
img2webp -loop 0 -lossy -q 70 -m 6 -d 63 frames/*.png -o frames/melting-clock.webp
# img2webp marks the canvas background opaque white; make it transparent for dark mode
webpmux -set bgcolor 0,0,0,0 frames/melting-clock.webp -o "$out/melting-clock.webp"
# Still frame for people who turn on reduced motion
cwebp -quiet -q 80 -m 6 frames/0043.png -o "$out/melting-clock-still.webp"
ls -l "$out"/*.webp
