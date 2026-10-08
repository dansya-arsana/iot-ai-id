#!/usr/bin/env bash
# Build the pinned Arduino helper for Apple Silicon when its shipped Intel binary cannot run.
set -euo pipefail
[[ "$(uname -s)" == Darwin && "$(uname -m)" == arm64 ]] || exit 0
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
arduino_data="${ARDUINO_DIRECTORIES_DATA:-$(arduino-cli config dump --format json | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(s).config?.directories?.data??process.env.HOME+"/Library/Arduino15"))')}"
ctags_path="$arduino_data/packages/builtin/tools/ctags/5.8-arduino11/ctags"
[[ -f "$ctags_path" ]] || { echo 'Install Arduino CLI builtin tools first.'; exit 1; }
if "$ctags_path" --version >/dev/null 2>&1; then exit 0; fi
xcrun --find clang >/dev/null
source_dir="$project_root/.runtime/upstream/arduino-ctags"
mkdir -p "$project_root/.runtime/upstream" "$project_root/.runtime/toolchain-backups"
if [[ ! -d "$source_dir/.git" ]]; then git clone --depth 1 --branch 5.8-arduino11 https://github.com/arduino/ctags.git "$source_dir"; fi
[[ "$(git -C "$source_dir" rev-parse HEAD)" == abc8fca7499f44c725122881cd380a88c37abe0e ]] || { echo 'Unexpected Arduino ctags source revision.'; exit 1; }
(
 cd "$source_dir"
 make clean >/dev/null 2>&1 || true
 # Preinclude the SDK header before this old project's __unused__ macro definition.
 CC=clang CFLAGS='-O2 -arch arm64 -include dirent.h' LDFLAGS='-arch arm64' ./configure --disable-etags --disable-external-sort
 make -j4
 file ctags | grep -q arm64
 ./ctags --version
)
backup="$project_root/.runtime/toolchain-backups/ctags-5.8-arduino11-x86_64"
[[ -f "$backup" ]] || cp -p "$ctags_path" "$backup"
cp -p "$source_dir/ctags" "$ctags_path"
shasum -a 256 "$backup" "$ctags_path" > "$project_root/.runtime/toolchain-backups/ctags-hashes.txt"
echo 'Native Arduino ctags installed; original binary remains in .runtime/toolchain-backups.'
