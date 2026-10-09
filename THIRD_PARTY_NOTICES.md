# Third-party integrations

The product uses npm packages through pinned releases and package-lock.json. Keep applicable notices with redistributed builds.

| Integration | Version | License | Usage |
|---|---|---|---|
| [Arduino MCP Server](https://github.com/hardware-mcp/arduino-mcp-server) | 0.2.8 | MIT | Separate local stdio runtime process |
| [Wokwi Elements](https://github.com/wokwi/wokwi-elements) | 1.9.2 | MIT | ESP32/OLED web components in frontend |
| [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | 1.32.1 | MIT | Local MCP client transport |
| [OpenViking](https://github.com/volcengine/OpenViking) | 0.4.23 | AGPL-3.0 | Separate, unmodified local HTTP knowledge service |

Arduino MCP Server and Wokwi license texts are retained in docs/licenses. Other dependency licenses remain in installed packages. A future distribution should generate a complete transitive notices bundle from its lockfile.

KiCadAI is an architecture reference only; its code is not embedded. Boardsmith, Arduino-Agent, AI-Agents-in-Physical-Computing, serial-mcp, ESP-IDF MCP, nff-core and KiCad Copilot are not integrated or copied into the product. No license conclusion is implied for deferred repositories. OpenViking licensing is not classified as MIT; proprietary distribution decisions require review of its AGPL terms.

Arduino CLI and its board toolchains run as separate local tools. On Apple Silicon, setup may build the official Arduino ctags helper at tag `5.8-arduino11` (commit `abc8fca7499f44c725122881cd380a88c37abe0e`) under its GPL license. Its source and original binary backup remain under `.runtime`; no helper code is embedded in the product core.

Deployment includes the MIT-licensed Jev harness decision scripts, with its license retained at `deploy/jev/LICENSE`. These scripts are a typed routing layer; they do not execute the product hardware workflow themselves.
