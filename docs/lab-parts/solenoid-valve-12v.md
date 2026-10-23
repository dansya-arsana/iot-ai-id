# Solenoid valve 12 V (normally closed, 1/2")

Protocol: `gpio` (desk prop, linked load). Emulated through the power solver.

- Device: `apps/web/src/lab/sim/devices/solenoid-valve-12v.ts`
- Part: `apps/web/src/lab/scene/parts/solenoid-valve-12v.ts`
- Test: `tests/lab-part-solenoid-valve-12v.test.ts`
- Catalog record: `packages/catalog/data/solenoid-valve-12v.json`
- Pins: +, - (coil leads, no holes)

Reference (Adafruit 997, https://www.adafruit.com/product/997 and the DigiKey listing https://digikey.cn/en/products/detail/adafruit-industries-llc/997/6827136): 12 V DC, about 320 mA at 12 V (160 mA at 6 V, so 37.5 ohm), works down to about 6 V, 0.02-0.8 MPa, open 0.15 s or less, close 0.3 s or less, one flow direction, 1/2" NPS, water only, 0-75 C, about 76 x 57 x 51 mm.

Model: v = V(+) - V(-). It opens after 0.15 s x 12 V / v (about 0.3 s at 6 V, our scaling) once v >= 6 V, closes 300 ms after v < 3 V (our drop-out [U]), holds its state in between. Below 20 kPa line pressure (input `pressureKpa`) it cannot open: state `open:false, reason:'low-pressure'`. State: volts, open, ma, flowing, reason, flyback.

## Design notes (Pro checks)

- Flyback: every inductive load needs a diode across the coil (`diode`, cathode on +). `flyback` is true only when one is wired the right way round; otherwise add a 1N4007.
- Drive it through the existing `relay-module` (5 V coil; on an ESP32 or Pi node power VCC from 5 V and check the trigger level at 3.3 V) or a logic-level MOSFET. The `irf520-mosfet-module` is not logic-level at 3.3 V gate drive.
- Gravity tanks: it needs about 3 PSI (20 kPa) to seal, and water gives about 10 kPa per metre of head, so that is about 2 m. (The brief says "under 0.2 m"; 0.02 MPa is 2 m, so we use 2 m [U, brief figure disagrees].) Use a direct-acting valve for gravity feed.
- Sized for a 12 V supply with at least 0.5 A free.

## Sources disagree

- Supply band 10.8-13.2 V is OUR +-10 % around 12 V; the listing says 12 V and "down to about 6 V".
- Opening time at low voltage and the 3 V drop-out are our assumptions [U].

Provenance: own work from public datasheet behaviour; no vendor models, photos or logos.
