# Golden experiment: failure and recovery

Use classic ESP32 DevKit, BME280 at 0x76, and SSD1306 I2C at 0x3C. With power off: both VCC pins to 3V3, grounds common, SDA to GPIO21 and SCL to GPIO22. Inspect the exact breakout pin labels.

Create a project using the homepage prompt. Inspect Plan, Wire, Code and Contract. Connect USB, select Local board, authorize the detected node and run. Save the experiment ID and firmware/contract hashes. Acceptance requires all six named checks and physical provenance.

Power off before disconnecting shared SDA. Reconnect power and run. Compilation can still pass; no I2C addresses and invalid readings must fail the circuit verification. AI diagnosis may recommend inspecting GPIO21/SDA, shared bus, power and ground. It must not claim a unique wire fault from insufficient observations.

Power off, restore SDA, reconnect power. Confirm the repair in the UI and re-test. A fresh experiment ID/nonce must produce physical VERIFIED with a parent failure reference. The failed experiment remains immutable and replayable.

Required evidence: successful compiler response, successful ESP32 upload, fresh bound firmware handshake, BME280/OLED addresses, finite bounded temperature/humidity, OLED initialization/ACK, failure observations, diagnosis and fresh recovery verification. Binary hashes and raw serial/tool responses remain inspectable in stored experiment artifacts.

The OLED's visible pixels need human observation; ACK is not a visual measurement. Simulation reproduces the state machine only and is always SIMULATED_VERIFIED. A video of a simulation cannot count as physical completion.

Physical telemetry carries a monotonically increasing `cycle` number. Verification uses only the newest observed valid cycle. Missing checks in that cycle fail; earlier samples cannot fill gaps. Conflicting duplicates fail the check. Capture ending mid-cycle may need a fresh re-test, never a fallback to older successful evidence.
