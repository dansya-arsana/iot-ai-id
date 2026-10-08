#!/usr/bin/env bash
set -euo pipefail
command -v arduino-cli >/dev/null || { echo 'Install Arduino CLI: brew install arduino-cli (macOS), or official Arduino CLI package.'; exit 1; }
arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core install esp32:esp32@3.3.7 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli lib install 'Adafruit BME280 Library@2.3.0' 'Adafruit SSD1306@2.5.16' 'Adafruit GFX Library@1.12.4' 'Adafruit Unified Sensor@1.1.15' 'Adafruit BusIO@1.17.4'
bash "$(dirname "${BASH_SOURCE[0]}")/setup-native-ctags.sh"
