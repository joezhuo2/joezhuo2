#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
for t in dark light; do (
  rm -rf "frames-$t"
  node banner-capture.js "$t" "frames-$t"
  n=$(node -p "require('./frames-$t/meta.json').n")
  ffmpeg -y -loglevel error -framerate 12 -i "frames-$t/%04d.png" -filter_complex \
    "[0:v]split[a][b];[a]trim=end_frame=$n,setpts=PTS-STARTPTS[main];[b]trim=start_frame=$n,setpts=PTS-STARTPTS,format=rgba,fade=t=out:st=0:d=0.66:alpha=1[tail];[main][tail]overlay=eof_action=pass,scale=800:-1:flags=lanczos,split[x][y];[x]palettegen=stats_mode=full:max_colors=16[p];[y][p]paletteuse=dither=none:diff_mode=rectangle" \
    -loop 0 "../profile/banner-$t.gif") &
done; wait
