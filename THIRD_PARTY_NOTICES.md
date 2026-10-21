# Third-party integrations

The product uses npm packages through pinned releases and package-lock.json. Keep applicable notices with redistributed builds.

| Integration | Version | License | Usage |
|---|---|---|---|
| [Arduino MCP Server](https://github.com/hardware-mcp/arduino-mcp-server) | 0.2.8 | MIT | Separate local stdio runtime process |
| [Wokwi Elements](https://github.com/wokwi/wokwi-elements) | 1.9.2 | MIT | ESP32/OLED web components in frontend |
| [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | 1.32.1 | MIT | Local MCP client transport |
| [three.js](https://github.com/mrdoob/three.js) | 0.186.1 | MIT | 3D board scene in the lazy-loaded /lab chunk |
| [avr8js](https://github.com/wokwi/avr8js) | 0.21.1 | MIT | ATmega328P emulation in the /lab chunk |
| [OpenViking](https://github.com/volcengine/OpenViking) | 0.4.23 | AGPL-3.0 | Separate, unmodified local HTTP knowledge service |

Arduino MCP Server and Wokwi license texts are retained in docs/licenses. Other dependency licenses remain in installed packages. A future distribution should generate a complete transitive notices bundle from its lockfile.

KiCadAI is an architecture reference only; its code is not embedded. Boardsmith, Arduino-Agent, AI-Agents-in-Physical-Computing, serial-mcp, ESP-IDF MCP, nff-core and KiCad Copilot are not integrated or copied into the product. No license conclusion is implied for deferred repositories. OpenViking licensing is not classified as MIT; proprietary distribution decisions require review of its AGPL terms.

Arduino CLI and its board toolchains run as separate local tools. On Apple Silicon, setup may build the official Arduino ctags helper at tag `5.8-arduino11` (commit `abc8fca7499f44c725122881cd380a88c37abe0e`) under its GPL license. Its source and original binary backup remain under `.runtime`; no helper code is embedded in the product core.

Deployment includes the MIT-licensed Jev harness decision scripts, with its license retained at `deploy/jev/LICENSE`. These scripts are a typed routing layer; they do not execute the product hardware workflow themselves.

Arduino lab firmware (`apps/web/src/lab/firmware/generated.ts`): the precompiled images contain object code from ArduinoCore-avr (LGPL-2.1, https://github.com/arduino/ArduinoCore-avr) and the Arduino Servo library (LGPL-2.1, https://github.com/arduino-libraries/Servo). They are shipped as data. The sketch sources are in `apps/web/src/lab/firmware/sketches/` and the build script is `scripts/build-lab-firmware.ts`, so anyone can rebuild them (see docs/lab-firmware.md). arduino-cli and avr-gcc are build-time tools only and are not part of the web bundle. The /lab lessons are our own work; the public Learn Arduino site was studied for look and flow only and none of its code, models, text or images is used.
