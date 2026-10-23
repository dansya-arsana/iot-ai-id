---
name: agri-id
version: 1
summary: Indonesian smallholder farming context for sensor-node design (crops, soil, water, wet and dry season).
---
# Agriculture in Indonesia: design context

Use this when a member describes a farm, greenhouse or fish pond in Indonesia. These are defaults and starting points, not measurements. Say "estimate" and ask for site facts when they matter.

## Climate
- Tropical, two seasons. Wet season is roughly Oct to Mar, dry season Apr to Sep, shifting by region (Java, Sumatra, Sulawesi, NTT differ). Use `site_climate` for numbers instead of guessing.
- Humidity is high (70 to 95 percent RH). Condensation inside enclosures is the main killer: require IP65 or better outdoors, cable glands facing down, a drip loop on every cable, and a vent plug or desiccant.
- Direct sun heats a sealed box to 60 C or more. Prefer a shaded mount or a white enclosure; check part temperature ratings (many sensors stop at 60 to 85 C).
- Lightning is frequent. Keep cable runs short, suggest a surge protector on long RS485 or mains-fed runs, and never run a sensor cable up a metal pole without grounding it.

## Soil and water sensing
- Capacitive soil moisture sensors are the default. Resistive probes corrode in weeks in wet soil: avoid them for anything outdoor.
- Soil moisture readings are relative to the soil type. Always plan a two-point calibration (dry air and a glass of water, or dry and saturated soil) and record it in the checklist.
- Place probes at root depth (10 to 30 cm for vegetables, deeper for trees), away from drip emitters, and use at least two per field when the field is larger than a few hundred square metres.
- Water level in tanks or ponds: ultrasonic sensors fail under condensation and foam; a float switch is a reliable second sensor. pH and EC probes need regular calibration and drift: say so.
- Fish ponds: dissolved oxygen is the critical signal at night and before dawn. Aerator control must fail safe (aerator ON when the controller is silent).

## Crops (typical starting points, confirm with the member or an extension officer)
- Chili and tomato: keep moisture steady, avoid waterlogging, watch leaf wetness for disease.
- Rice (paddy): water depth matters more than soil moisture; ultrasonic or float level sensor per plot.
- Greenhouse: temperature, RH and light; fans or shading as actuators.
- Hydroponics: pH, EC, water temperature, reservoir level.

## Practical constraints
- Many sites have no mains power, no Wi-Fi and weak mobile data. Ask which of solar, battery or mains exists. LoRa to a gateway near the farmhouse is the usual link (see `lora-as923-id`); size power with `power-solar-tropics`.
- Wiring is done by hand by the member or a local electrician. Use the colour code the tool returns, label both ends, and prefer connectors over soldered joints.
- Pumps and valves switch mains or large DC loads: require a relay or driver rated for the load, a flyback diode on DC inductive loads, and a manual override. Never wire mains for the member without a clear safety warning and a qualified-person note.
- Prices are estimates and vary by city and shop. Never present IDR as a quote.
