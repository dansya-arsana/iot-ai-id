---
name: power-solar-tropics
version: 1
summary: Sizing solar plus battery power for field nodes in tropical Indonesia.
---
# Solar and battery power for field nodes

Use `solve_power` for numbers. This skill explains the assumptions and the traps.

## Defaults
- Peak sun hours: 3.5 per day as a conservative Indonesian default (real values are 3.5 to 5, lower in the wet season and under shade). Derate 0.7 for dust, heat, wiring and charge losses.
- Autonomy: at least 2 days without sun for a sensor node; 3 to 5 for pumps or critical controls.
- Panel watts = daily load Wh / (peak sun hours x 0.7). Round up to a stock panel size.

## Load budget
- Average mA is duty-cycle weighted. Sleep current dominates a low-rate node: deep-sleep the MCU, power sensors through a switch pin, and avoid dev boards with always-on LEDs and USB chips (they can draw several mA in sleep, which is hundreds of mWh a day).
- Add peaks: LoRa transmit about 120 mA, Wi-Fi on an ESP32 150 to 300 mA, relay coils 70 to 100 mA each. The regulator and battery must cover the peak, not just the average.

## Chemistry and charging
- The charge controller must match the battery chemistry: single Li-ion 18650 (4.2 V per cell), LiFePO4 (3.65 V per cell) or sealed lead-acid (13.8 V float) are not interchangeable. A wrong controller is an error, not a note.
- Never charge Li-ion below 0 C or leave it above 45 C. In the tropics, heat is the bigger risk: shade the battery, never place it in a sealed black box in the sun.
- Add battery protection (a BMS or protected cells) and a fuse close to the battery.
- Small panels (up to about 10 W) with a PWM or a dedicated Li-ion module such as a TP4056 class charger is ok for tiny nodes; use MPPT for larger systems.

## Practical
- Panel tilt about 10 to 15 degrees facing the equator side (north in southern Indonesia) so rain washes it; clean it every few months.
- Use wire sized for the current and length (voltage drop on thin wire over a long run kills a 5 V sensor), and waterproof connectors.
- State every sizing as an estimate and add a field check: measure the battery voltage over a few days and compare it with the estimate.
