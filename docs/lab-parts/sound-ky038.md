# Sound sensor KY-038

Protocol: `adc`.

- Device (simulation): `apps/web/src/lab/sim/devices/sound-ky038.ts`
- Part (3D): `apps/web/src/lab/scene/parts/sound-ky038.ts`
- Test: `tests/lab-part-sound-ky038.test.ts`
- Pins (physical order): AO, GND, VCC, DO
- Supply: 3.3 to 5.5 V (rated in the device; below 2.7 V the module is dead)

## Model

AO is the audio wave on a bias of half the supply (silence about 512), amplitude = loudness x 2.2 V, clipped inside the rails. The tone is sine at `toneHz` (default 700 Hz) and is a pure function of simulated time. DO is the LM393 output: HIGH while the instantaneous AO is above the trimmer level, so a tone gives a pulse train at the tone frequency; its edges are scheduled at the exact comparator crossings each slice. The Clap toggle starts a burst that holds full scale for 2 ms and then decays with a 60 ms constant, then releases itself. A sketch measures loudness as the peak-to-peak over a short window (about 50 ms).

## Provenance

Own work from public datasheet behaviour (LM393 comparator module family). The 3D body is modelled from nominal dimensions in millimetres with the lab palette; no vendor model, photo, logo or marking was copied. No third-party code.

## Honest limits

- Boards differ in DO polarity; this model uses HIGH on sound.
- The microphone is a single sine tone, not noise or speech.
- AO is polled once per simulation slice, so very high tones are sampled sparsely (like a slow ADC would see them).
