#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$ROOT/build/appimage"
APP_DIR="$OUTPUT_DIR/AppDir"
BINARY="$ROOT/build/bin/ai_desktop_app"

# Prerequisites check
for cmd in linuxdeploy appimagetool; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: '$cmd' not found in PATH."
    echo "Install it first, e.g.:"
    echo "  # Arch:  yay -S linuxdeploy-appimage"
    echo "  # Manual: place the AppImages in your PATH"
    exit 1
  fi
done

# GTK plugin is a small script not available as a package — download if missing
GTK_PLUGIN="linuxdeploy-plugin-gtk.sh"
if ! command -v "$GTK_PLUGIN" &>/dev/null; then
  if [ ! -f "$OUTPUT_DIR/$GTK_PLUGIN" ]; then
    echo "Downloading linuxdeploy-plugin-gtk.sh..."
    curl -sLo "$OUTPUT_DIR/$GTK_PLUGIN" \
      https://raw.githubusercontent.com/linuxdeploy/linuxdeploy-plugin-gtk/master/linuxdeploy-plugin-gtk.sh
    chmod +x "$OUTPUT_DIR/$GTK_PLUGIN"
  fi
  export PATH="$OUTPUT_DIR:$PATH"
fi

mkdir -p "$OUTPUT_DIR"

# 1. Build production binary
cd "$ROOT" && wails build

# 2. Setup AppDir
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/usr/bin"
cp "$BINARY" "$APP_DIR/usr/bin/"
# Resize icon to 512x512 (linuxdeploy rejects larger sizes)
convert "$ROOT/build/appicon.png" -resize 512x512 "$APP_DIR/appicon.png"
cat > "$APP_DIR/ai_desktop_app.desktop" <<EOF
[Desktop Entry]
Name=AI Desktop App
Comment=AI agentic desktop assistant
Exec=ai_desktop_app
Icon=appicon
Type=Application
Categories=Utility;
Terminal=false
EOF

# 3. Populate AppDir with linuxdeploy (no strip, no packaging)
export NO_STRIP=1
export DISABLE_COPYRIGHT_FILES_DEPLOYMENT=1

cd "$OUTPUT_DIR"
linuxdeploy \
  --appdir "$APP_DIR" \
  --desktop-file "$APP_DIR/ai_desktop_app.desktop" \
  --icon-file "$APP_DIR/appicon.png" \
  --library /usr/lib/libstdc++.so.6 \
  --plugin gtk

# 4. System strip everything (handles .relr.dyn correctly)
echo "Stripping with system strip..."
while IFS= read -r -d '' f; do strip "$f"; done < <(find "$APP_DIR" -type f -exec file {} + | grep -a ELF | cut -d: -f1 | tr '\n' '\0')

# 5. Pack into AppImage
echo "Packaging AppImage..."
appimagetool "$APP_DIR" "$OUTPUT_DIR/ai_desktop_app-x86_64.AppImage"

echo "Done: $OUTPUT_DIR/ai_desktop_app-x86_64.AppImage"
