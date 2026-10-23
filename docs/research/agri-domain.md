# Pro level: agri-IoT domain pack (Indonesia)

Key: `domain`. Written 2026-10-23 for the Pro reference case, a 4-field farm (mango, melon, banana, flowers) with a Raspberry Pi gateway and LoRa field links. It is meant to be read by the Pro AI prompt (Claude Sonnet 5.5) and by the deterministic design checks (M2 and M6 in `docs/plans/level-ladder-execution.md`).

## 0. How to read this

**Source grades.** Every number has a grade. The checks may hard-block only on grade A or B; grades C and M can only warn.

| Grade | Meaning |
|---|---|
| **A** | Official Indonesian or intergovernmental text (Komdigi/Kominfo, Kementan or BPTP/BSIP, ESDM, FAO), or a formal standard |
| **B** | Peer-reviewed or university research, or government extension material from outside Indonesia (for example DPIRD WA, CGIAR) |
| **C** | Secondary: theses, vendor datasheets, marketplace listings, news |
| **M** | Engineering practice or recalled reference values that were **not re-verified in this session**. Treat these as defaults to confirm. |

**Units.** Volumetric water content is VWC (%). Soil water tension is in kPa (a positive number means suction). EC is in mS/cm (1 mS/cm = 1 dS/m). Light is in lux, or PAR in µmol m⁻² s⁻¹. Prices are IDR.

**Altitude bands used below.** Lowland (*dataran rendah*) is 0–400 m above sea level (*m dpl*). Mid-elevation is 400–700 m. Highland (*dataran tinggi*) is above 700 m.

---

## 1. Crop profiles

### 1.1 Mango (*mangga*): open orchard, lowland

| Variable | Range or threshold | Grade | Note |
|---|---|---|---|
| Altitude | 0–500 m (one Kementan document says 0–300 m) | A/C | Kementan repository; the 0–300 m line was truncated in the source |
| Dry season | 2–8 dry months a year are needed (some sources say 4–8 before and during flowering) | A | Kementan repository |
| Annual rain | 750–2,500 mm | A | Kementan repository |
| Air temperature | 24–27 °C optimum | C | UPN Jatim thesis |
| Soil pH | 5.5–7.5; apply dolomite lime below 5.5 | C | Dinas Pertanian DIY, via detik |
| Water-critical stage | Fruit set through fruit development. A deficit here causes fruit drop and small fruit | B | ICAR study, India |
| Flower induction | A dry spell before flowering helps induce flowers, so do **not** auto-irrigate during induction | A/M | Follows from the dry-month requirement; growers also use paclobutrazol |
| Deficit irrigation | Drip at 50–75% of crop evapotranspiration (ETc) lost only about 8–20% of yield and improved fruit quality | B | Embrapa (Brazil); Egypt KEITT trial |
| Root-zone sensing depth | 30 cm and 60 cm (deep roots) | M | |

**Irrigation:** drip, with 2–4 emitters per tree or a ring, or micro-sprinkler. The schedule is **phase-aware**: off during induction, on from fruit set to harvest.
**Actuators:** one 12 V DC solenoid or motorized ball valve per block, from a shared pump or tank.

### 1.2 Melon: greenhouse or screenhouse, drip fertigation

| Variable | Range or threshold | Grade | Note |
|---|---|---|---|
| Air temperature (day) | 25–30 °C optimum; warn above 35 °C, because pollen viability and fruit set suffer | C | Theses (Undip, Unisba Blitar) |
| Air temperature (minimum) | Do not grow below 18 °C | C | Thesis |
| Greenhouse extremes | Inside temperatures reached 60.2 °C with RH 10.2% at midday in one study. **Ventilation is mandatory.** | C | Thesis |
| Air RH | 70–80% target, 85% upper limit | C | Theses disagree on the exact figure |
| Light | 10–12 hours of sun a day | C | |
| Altitude | 200–900 m optimum (grows in lowland under cover) | C | |
| Nutrient EC (feed) | 2.0–2.5 mS/cm overall. By stage: about 1.2–1.6 for seedlings, 1.8–2.2 vegetative, 2.2–2.8 at fruit fill | C / M | Overall range from a Telkom Univ thesis; the per-stage split is M |
| Nutrient pH | 5.5–6.5 | C | |
| Waterlogging | Very sensitive: no standing water, and high rain makes young fruit drop | C | This is why melon is grown under cover |
| Depletion before irrigation (FAO-56 *p*) | about 0.40 | M | FAO-56 Table 22 value, recalled |
| Crop coefficient (FAO-56) | Kc ini/mid/end ≈ 0.5 / 1.05 / 0.75. Mulch raises real ET above the FAO figure | M / B | Kc recalled; the mulch effect is from the Unibas lysimeter study |

**Irrigation:** drip fertigation from an A/B stock tank (*nutrisi AB mix*). Run 4–8 short pulses a day in substrate or polybags; aim for 10–20% drain (M).
**Actuators:** fertigation pump, zone solenoids, A/B dosing pumps (pro tier), exhaust fan or fans, misting (pad or fog) for heat, and an optional motorized shade net. Mains loads go through contactors (rule ACT-03).

### 1.3 Banana (*pisang*): open field, lowland to mid-elevation

| Variable | Range or threshold | Grade | Note |
|---|---|---|---|
| Altitude | up to about 1,300 m | A | Kementan SOP for banana |
| Temperature | 15–35 °C, optimum 27 °C; growth stops below 13 °C or above 38 °C | A | Kementan SOP |
| Annual rain | 1,500–2,500 mm, evenly spread | A | Kementan SOP; Ditjen Hortikultura guide (2020) |
| Soil pH | 4.5–7.5 (some local sources say 5.5–6.5 is ideal) | A/C | |
| Soil water tension | **Keep 12–25 kPa** in the root zone; yield drops above 25 kPa; trials near 15 kPa gave the best yield | B | DPIRD Western Australia |
| Scheduling | Shallow roots, so irrigate at least daily in dry periods | B | DPIRD WA |
| Crop coefficient | Field values range 0.5–1.2 by stage (Embrapa) or 0.8–1.0 (Ceará). FAO-56 is about 0.5 / 1.1 / 1.0 | B / M | |
| Crop ET | about 5.8 mm/day (Ceará, Pacovan variety) | B | |
| Depletion before irrigation (FAO-56 *p*) | about 0.35 | M | |
| Sensing depth | 20–30 cm, 50–80 cm from the pseudostem | M | |
| Drainage | Waterlogging and poor drainage harm the crop (Kementan); add a "soil saturated for more than 24 h" alert | A/M | |

**Irrigation:** drip with two lateral lines, or micro-sprinkler.
**Actuators:** zone valve, plus a pump if there is no gravity tank.

### 1.4 Cut flowers: chrysanthemum (*krisan*, the default) or rose (*mawar*), highland screenhouse

**Chrysanthemum:**

| Variable | Range or threshold | Grade | Note |
|---|---|---|---|
| Day temperature | 20–26 °C ideal; 17 °C minimum, 30 °C maximum | A | Krisan booklet, BPTP Papua Barat (Balitbangtan) |
| Night temperature | 16–18 °C supports flower-bud initiation | A | Same booklet |
| RH | 90–95% while cuttings root; 70–80% from young plant to mature | A/C | |
| Photoperiod | Short-day plant. During the vegetative phase, add 3–4 h of light as a night break, **22:00–02:00**, to hold off flowering. Stop the lights to trigger bud set. | A/C | Booklet and theses |
| Greenhouse RH measured | 73–86%, depending on roof height | C | Unud study |
| Leaf wetness | Long wet-leaf periods raise fungal disease risk (white rust). Warn when wetness lasts 6 h or more at 17–25 °C. | M | |
| Altitude | Highland, about 700–1,200 m (for example Cianjur or Lembang) | M | |

**Rose (alternative):**

| Variable | Range | Grade |
|---|---|---|
| Altitude | 560–1,200 m; buds are smaller below that | C |
| Temperature | 15–30 °C or 18–26 °C (sources differ) | C |
| RH | 50–60% or 70–80% (sources differ) | C |
| Light | Full sun; shade brings fungal problems | C |
| Soil pH | 6–7 | C |

**Irrigation:** drip on beds, plus misting for rooting cuttings.
**Actuators:** a night-break lamp circuit (LED, roughly 70–100 lux at canopy, M) through a relay or contactor driven by an RTC-timed schedule, a misting pump and solenoid, and a drip zone valve.

### 1.5 Machine-readable crop thresholds

The prompt and the checks import this block. The `grade` fields carry the lowest grade among the cited numbers.

```json
{
  "mango":   {"setting":"open","alt_m":[0,500],"airT_opt":[24,27],"soil_pH":[5.5,7.5],
              "irrigation":"drip","phases":{"induction":{"irrigate":false},"fruit_set_to_harvest":{"irrigate":true,"deficit_pct_ETc":[50,100]}},
              "sense_depth_cm":[30,60],"p_depletion":0.5,"grade":"A/B/C/M"},
  "melon":   {"setting":"greenhouse","airT_opt":[25,30],"airT_warn_hi":35,"airT_min":18,"rh":[70,85],
              "feed_EC":[2.0,2.5],"feed_EC_by_stage":{"seedling":[1.2,1.6],"veg":[1.8,2.2],"fruit":[2.2,2.8]},
              "feed_pH":[5.5,6.5],"irrigation":"drip_fertigation","pulses_per_day":[4,8],"drain_pct":[10,20],
              "p_depletion":0.4,"grade":"C/M"},
  "banana":  {"setting":"open","alt_m":[0,1300],"airT":[15,35],"airT_opt":27,"airT_stop":[13,38],"soil_pH":[4.5,7.5],
              "tension_kPa":[12,25],"irrigate_when_kPa_gt":25,"irrigate_target_kPa":15,"min_irrigations_per_day_dry":1,
              "sense_depth_cm":[20,30],"p_depletion":0.35,"grade":"A/B"},
  "chrysanthemum":{"setting":"screenhouse_highland","airT_day":[20,26],"airT_limits":[17,30],"airT_night_bud":[16,18],
              "rh":{"rooting":[90,95],"growing":[70,80]},"night_break":{"start":"22:00","end":"02:00","hours":[3,4],"phase":"vegetative"},
              "leaf_wet_warn_h":6,"grade":"A/C/M"},
  "rose":    {"setting":"open_or_house_highland","alt_m":[560,1200],"airT":[15,30],"soil_pH":[6,7],"grade":"C"}
}
```

### 1.6 Turning soil sensor readings into decisions

- **Capacitive v1.2 (raw ADC):** calibrate per field. Take readings in dry air (0%) and at field capacity, meaning soil drained 24–48 h after saturation (100%). Store `raw_dry` and `raw_fc` for each node. Report *relative available water* (RAW%). Irrigate when RAW% falls below (1 − p) × 100, so about 60% for melon and about 65% for banana. Never use the raw threshold printed in a tutorial. (Grade B: studies show lab calibration transfers poorly to the field, with RMSE as bad as 0.055–0.19 m³/m³, while soil-specific calibration is good.)
- **RS-485 VWC probes:** report VWC (%) directly. Still do a one-point field check against a gravimetric sample.
- **Tensiometer or Watermark (pro):** the best fit for banana's kPa rule.

---

## 2. Sensors by variable and tier

**Tier meaning.**
- **Hobby:** Arduino-class, unshielded, 3.3–5 V analog or one-wire. Fine for a demo or a single bed.
- **Semi-pro:** RS-485 Modbus probes with IP68 sealing and 5–24 V supply, or sealed I²C probes.
- **Pro:** calibrated or certified instruments, industrial transmitters, data-logger grade.

| Variable | Hobby | Semi-pro | Pro | Accuracy caveats |
|---|---|---|---|---|
| Soil moisture | Capacitive v1.2 (analog, `soil-moisture` in the registry) | RS-485 VWC+T probe, or 3-in-1 VWC/T/EC | TDR/FDR probe (Teros/Decagon class), tensiometer, Watermark | v1.2: some boards have a missing or weak regulator or a wrong timer resistor (check the 555 version), are sensitive to the edge coating, and need per-soil calibration (B). Never use resistive FC-28 forks outdoors: they corrode in weeks (M). |
| Soil EC / salinity | none useful | RS-485 3-in-1 or 7-in-1 probe | Lab soil test or a calibrated EC probe | Probe EC is bulk EC and shifts with moisture and temperature (B, CGIAR) |
| Soil NPK | **Do not offer** | RS-485 "NPK" 7-in-1, *labelled indicative* | Lab soil test (Balai Tanah or BSIP) | CGIAR tests: R² ≤ 0.25 (Guatemala) and weak for N and P (Colombia), strongly moisture-dependent. DFRobot itself says "reference only" (B/C). The UI must say "NPK estimate, not a soil test". |
| Soil / media pH | Analog pH probe for spot checks only | RS-485 soil pH probe (indicative) | Lab or a calibrated portable meter | Analog pH probes drift and need a 2-point buffer calibration (pH 4/7) every 2–4 weeks; they are not for permanent burial (M) |
| Nutrient tank EC / pH (melon) | TDS/EC analog board with K=1 probe; analog pH | DFRobot Gravity EC/pH (isolated) | Industrial RS-485 or 4–20 mA EC/pH transmitter with auto-temperature compensation | EC and pH probes in one tank interfere unless the boards are galvanically isolated (M). Temperature-compensate EC to 25 °C. |
| Air T / RH | DHT22 (`dht22`), BME280 (`bme280`) | SHT31/SHT4x in a sintered probe, or RS-485 T/RH transmitter | Calibrated logger in an aspirated radiation shield | **Always mount in a louvered radiation shield**, never inside the electronics box. DHT22 drifts in sustained RH above 90% and condensing air (M). BME280 RH also suffers in condensing greenhouse air. |
| Light / PAR | BH1750 (lux), LDR (`ldr`) for relative only | Waterproof BH1750/VEML7700 dome, RS-485 lux sensor | PAR quantum sensor (µmol m⁻² s⁻¹), pyranometer | Lux-to-PAR conversion depends on the light source; sunlight is about 1 klux ≈ 18–20 µmol (M). BH1750 saturates at 65 klux; full tropical sun is above 100 klux, so add a filter or use VEML7700. |
| Rain | Rain plate FC-37 (`rain-sensor`), which gives rain yes/no only | Tipping-bucket gauge (0.2–0.5 mm per tip, reed pulse) | WMO-style gauge or an RS-485 weather station | The plate is not a rain amount. Clean the bucket gauge monthly (leaves, insects). |
| Leaf wetness | none | RS-485 leaf-wetness plate | Dielectric leaf-wetness sensor (PHYTOS class) | Mount at canopy height, 45° tilt, facing north or south (M) |
| Tank level | Float switch (`float`), HC-SR04 (`hcsr04`) | JSN-SR04T waterproof ultrasonic | 4–20 mA hydrostatic pressure transmitter | HC-SR04 is not waterproof. Ultrasonic sensors show a false echo in narrow tanks and condensation. The `water-level` registry part is a demo trace sensor only. |
| Soil temperature | DS18B20 waterproof (`ds18b20`) | DS18B20 in a stainless probe, or part of an RS-485 probe | PT100/PT1000 transmitter | One-wire bus: use about 20 m or less of cable with a 4.7 kΩ pull-up (M) |
| Flow (irrigation check) | YF-S201 Hall flow sensor | Brass pulse meter | Electromagnetic flow meter | Hall flow sensors are inaccurate below about 1 L/min (M) |
| Battery / solar | Voltage divider (`voltage-sensor-module`) | INA219/INA226 | Charge controller with a Modbus port | |

**Registry gaps for Pro** (these are not among the 80 lab parts; the Pro registry or BOM must add them): LoRa transceiver (RFM95W or Ra-01H), MAX485 or isolated RS-485 transceiver, RS-485 soil probe, SHT31/SHT4x, BH1750/VEML7700, tipping-bucket rain gauge, leaf-wetness sensor, JSN-SR04T, pH and EC boards, 12 V solenoid valve, solar panel, charge controller, Li-ion or LiFePO4 battery, INA219, enclosure and gland, SPD. Reuse `soil-moisture`, `dht22`, `bme280`, `ds18b20`, `rain-sensor`, `float`, `relay-module`, `dc-pump`, `irf520-mosfet-module`, `ds3231-rtc`, `esp32-devkit`, `voltage-sensor-module` and `microsd-module`.

---

## 3. Field network

### 3.1 Regulation: LoRa and LPWA in Indonesia (grade A, with a status caveat)

These are the technical requirements for LPWA devices that use the non-cellular band, from the Kominfo draft ministerial regulation (RPM) on LPWA technical requirements, consultation version, 2018, read in full in this session:

| Parameter | Limit |
|---|---|
| Frequency | **920–923 MHz** |
| End-node TX power | **≤ 100 mW EIRP (20 dBm)** |
| Gateway TX power | ≤ 200 mW conducted, ≤ 400 mW EIRP |
| Bandwidth | ≤ 200 kHz |
| Duty cycle | Uplink ≤ 1% and downlink ≤ 10%, **or** frequency hopping over at least 6 channels |
| Spurious emission | −36 dBm (ETSI EN 300 220); gateway at 915 MHz −61 dBm, at 925 MHz −57 dBm |
| Test method | ETSI EN 300 220-1 |
| Tamper | No easily accessible control that lets a user operate outside these limits |

**Legal status and certification.**
- The class-license framework was Permenkominfo No. 1/2019 (24 Apr 2019; JDIH Komdigi), now replaced by **Permenkominfo No. 2/2023** on spectrum use under a class license, which covers RLAN and LPWAN (JDIH abstract; grade A for its existence). A class license is tied to *certified* equipment, so imported modules must hold a Komdigi/SDPPI certificate (*sertifikat alat dan perangkat telekomunikasi*).
- No usage fee (BHP frekuensi) is charged for unlicensed operation in 920–923 MHz (Bisnis.com 2019, grade C).
- **TKDN (local content) rules for LPWA could not be verified this session.** Flag this for commercial deployments.
- The Build Sheet should show this verbatim: *"Indicative regulatory summary; confirm the current Komdigi rules and device certification before commercial deployment."*

**LoRaWAN channel plan:** Indonesia uses **AS923-2**, the AS923 plan shifted by −1.8 MHz, with default channels at 921.4 and 921.6 MHz (LoRa Alliance RP002 regional parameters; grade M, verify against the current RP002). In firmware, set `LMIC`/`RadioLib` to AS923-2 or 921.x–922.x MHz. Never use 915 MHz (US915) or 868 MHz. For raw LoRa point-to-point, use a centre frequency of 920.2–922.8 MHz, 125 kHz bandwidth, and 20 dBm or less, including antenna gain.

**Module pitfall:** the **Ai-Thinker RA-02 is an SX1278 (433 MHz family) and cannot legally or efficiently run at 923 MHz.** For 920–923 MHz use the **Ra-01H (SX1276, 803–930 MHz; Ai-Thinker docs, grade C)**, **HopeRF RFM95W-915**, or a board with an SX1276 or SX1262 tuned for 915 MHz (LilyGO, Heltec, RAK). Antennas sold as "915 MHz" are acceptable; check their VSWR at 922 MHz. A Padang thesis notes that 915 MHz-tuned hardware performs suboptimally (grade C).

**Airtime and duty-cycle sanity** (grade M; use a LoRa airtime calculator in code): a 20-byte payload at 125 kHz takes about 60 ms at SF7, about 370 ms at SF10, and about 1.3 s at SF12. A 1% duty cycle allows 36 s per hour, so one SF12 uplink every 5 minutes uses about 0.4%. Rule NET-04 enforces this.

### 3.2 Link choice and realistic distances

| Link | Use it for | Realistic distance | Grade |
|---|---|---|---|
| **LoRa** (point-to-point or LoRaWAN, 922 MHz, 20 dBm) | Open-field nodes away from buildings, on battery and solar | **Open, line of sight, gateway antenna on a 6–10 m mast: 2–5 km** (SF9–SF12). **Through dense banana or mango canopy at node height (about 1 m): 0.3–1 km.** Out of a metal-frame greenhouse with the antenna inside: subtract 10–20 dB, so mount the antenna outside. Hilly highland terrain needs a survey per site. | M (consistent with B/C sources saying "several km in LOS, reduced by terrain and multipath"; a 10 km wooded anecdote is C) |
| **Wi-Fi** (ESP32, 2.4 GHz) | Greenhouse or packhouse nodes on mains power within reach of an access point | 30–80 m outdoors with the PCB antenna; 150–300 m with an external antenna or outdoor CPE. Foliage absorbs heavily. | M |
| **RS-485 (Modbus RTU)** | Several probes in one field to one node (a bus), or a greenhouse sensor string to the controller | **Up to 1,200 m at 9,600 bps** (TIA/EIA-485); 32 unit loads; daisy-chain only (no star); 120 Ω termination at both ends; fail-safe bias | A (standard) |
| 4G / cellular modem | Gateway backhaul when there is no fiber or Wi-Fi | Depends on coverage | — |

**Default topology for the reference farm:** each field has one ESP32 node, with RS-485 probes or local sensors on short cables. The node talks LoRa at 922 MHz to a Raspberry Pi gateway on a mast. The gateway uses Wi-Fi or Ethernet backhaul. If the greenhouse (melon) is within 80 m of the house and has mains power, it may use Wi-Fi instead of LoRa.

---

## 4. Power: solar, battery and charge-controller sizing

**Method (grade M; standard off-grid sizing).**
1. Daily energy E (Wh/day) = Σ (current × voltage × on-hours), including sleep current.
2. Divide by conversion efficiency η (0.80 for regulators or boost converters, 0.85 for a 12 V system).
3. Battery capacity (Wh) = E/η × autonomy days ÷ DoD. Autonomy: 3 days lowland, **5 days in the rainy season or highland**. DoD: 0.8 for LiFePO4, 0.7 for Li-ion.
4. PV peak watts (Wp) = E/η ÷ (PSH_design × derate) × recovery factor.
   - PSH_design: use **3.5 h**, a wet-season worst month (M). The national average of 4.8 kWh/m²/day, about 4.5 west and 5.1 east (ESDM, A), is an *annual* figure, so do not size on it.
   - derate: 0.6 for small panels (heat, dust, tilt, PWM losses), 0.7 with MPPT.
   - recovery factor: 1.3–1.5, so the battery refills after cloudy days.
5. Charge controller current ≥ 1.25 × panel Isc. It must match the battery chemistry and have **temperature cut-off**. Li-ion and LiFePO4 must not charge above about 45 °C or below 0 °C (M), so keep the battery shaded.

### 4.1 Worked example A: sensor-only LoRa node (banana field)

ESP32 bare module plus Ra-01H, a capacitive or RS-485 soil probe, and a DS18B20. Wakes every 10 min; one 18650 cell.

| Item | Value |
|---|---|
| Sleep current (bare module, HT7333 low-Iq LDO, sensors power-gated by a MOSFET) | 0.2 mA × 23.6 h = **4.7 mAh** |
| Active burst (boot, read, LoRa TX at 20 dBm SF10, RS-485 warm-up 3 s): about 150 mA average × 10 s × 144 wakes | = **60 mAh** |
| Total at 3.7 V | 65 mAh ≈ 0.24 Wh/day; ÷ 0.8 = **0.30 Wh/day** |
| Battery (5 days, DoD 0.7) | 0.30 × 5 ÷ 0.7 = 2.1 Wh ≈ 0.58 Ah, so **one 18650 at 2,600 mAh gives about 4× margin** |
| PV | 0.30 ÷ (3.5 × 0.6) × 1.5 = 0.21 W, so **use a 2 W, 6 V panel** (the smallest practical size, and it tolerates shading) |
| Charger | CN3791 (solar MPPT Li-ion charger) or a TP4056 with a diode. Add a 3.0 V low-voltage cut-off. |

**Trap (rule PWR-02):** an ESP32 **DevKit** board draws about 5–15 mA in deep sleep because of the USB-UART chip and its LDO (M). That is 120–360 mAh/day, 2–6× the whole budget above. Use a bare module, a low-power board (FireBeetle, TTGO with sleep fixes), or a 12 V system.

### 4.2 Worked example B: valve and controller node (melon greenhouse, 12 V)

Four 12 V NC solenoid zones at 0.5 A (6 W), each open 4 pulses × 15 min = 1 h/day, run sequentially. Controller averages 0.5 W (ESP32 mostly in light sleep, plus RS-485 and the EC/pH boards).

| Item | Value |
|---|---|
| Valves | 4 × 6 W × 1 h = 24 Wh/day |
| Controller | 0.5 W × 24 h = 12 Wh/day |
| Total | 36 Wh; ÷ 0.85 = **42 Wh/day** |
| Battery (3 days, LiFePO4 DoD 0.8) | 42 × 3 ÷ 0.8 = 158 Wh ÷ 12.8 V = 12.3 Ah, so **12.8 V 15–20 Ah LiFePO4** |
| PV | 42 ÷ (3.5 × 0.7) × 1.3 = 22 W, so **one 50 Wp panel** (margin for shading and an extra zone) |
| Controller | 50 Wp gives Isc ≈ 3 A × 1.25 = 3.8 A, so a **10 A MPPT or PWM with a LiFePO4 profile** |
| Energy cut | **12 V latching solenoids** (50 ms pulse) cut valve energy by more than 95% (M) |

Fans, misting pumps and fertigation pumps above about 100 W run on **mains (PLN) or a genset**, not this solar node (rule PWR-04).

---

## 5. Enclosures, cabling, lightning and grounding

**Enclosure (grade M unless marked).**
- IP65 is the minimum for outdoor electronics. Use IP66/67 where the box faces driving rain or spray irrigation.
- Use UV-stabilized ABS or polycarbonate, light grey or white, with a **sun shield or hood** and mount on the north or shaded side of the post. A dark box in tropical sun reaches 60–70 °C inside.
- Glands **on the bottom face only**, sized to the cable OD (PG7 for 3–6.5 mm, PG9 for 4–8 mm). Give every cable a **drip loop**.
- Fit a **breathable vent** (ePTFE membrane) to stop condensation from pumping in, plus a silica-gel sachet. Conformal-coat the PCBs.
- The T/RH sensor goes **outside** in a louvered radiation shield at 1.5 m height (canopy height for the flowers).
- The battery goes in its own shaded compartment, away from the controller's heat.
- ESP32 is rated −40…85 °C, but electrolytic capacitors and Li cells are what limit lifetime.

**Cables.**
- Outdoor runs: UV-resistant jacket (PUR or UV-PVC); **NYY** for buried power; NYM indoors only.
- RS-485: shielded twisted pair, about 120 Ω, 24 AWG or heavier. Ground the shield at one end only (the controller) and carry signal ground with the bus.
- Bury runs longer than about 10 m in HDPE or PVC conduit at about 50 cm, or run them on a catenary. Rats and soil life attack exposed cable.
- Do not run sensor cable alongside mains or pump cable; keep about 20 cm separation.
- Connectors outdoors: M12 or IP68 screw connectors, or **heat-shrink with adhesive** splices. Never use bare twist-and-tape.

**Lightning and surge.** Indonesia has very high thunderstorm activity; Bogor is widely cited for its thunder days (C, popular claim, not verified this session).
- The gateway mast gets its own **earth electrode**, with a target of ≤ 5 Ω. That figure comes from PUIL 2011 as cited by several university papers (C; verify against the PUIL/SNI text). It is bonded to the building earth so there is one equipotential system.
- Fit a **coax surge arrester** (gas discharge, N-type), grounded, where the antenna feed enters the box.
- Keep the antenna inside the protected zone of an air terminal, using rolling sphere or protective angle per **SNI 03-7015-2004** or IEC 62305 (C/A).
- RS-485 runs longer than about 30 m, or leaving a building: **TVS or GDT surge protectors at both ends**, or an isolated RS-485 transceiver (M).
- PV string more than about 10 m from the controller: **DC SPD** at the controller (M).
- AC equipment in wet areas (greenhouse pumps and fans): **RCBO/ELCB 30 mA** plus an MCB per circuit (PUIL practice, M). Motors go through contactors with overload protection.
- During a storm warning, the firmware should park actuators in a safe state (valves closed, pump off) when the rain gauge or the BMKG forecast shows a thunderstorm (optional, M).

---

## 6. Indicative IDR prices (Indonesian marketplaces, **October 2026, indicative only**)

Rows marked **V** were seen in listings during this session; all others are **E**, estimated typical marketplace ranges that were not re-verified. Prices vary by seller, import batch and exchange rate. The Build Sheet must print: *"Indicative prices, Oct 2026. Verify before purchase."*

| Item | IDR range | Basis |
|---|---|---|
| ESP32 DevKit V1 | 60k–120k | E |
| ESP32-WROOM bare module | 40k–70k | E |
| Arduino Nano (clone) | 35k–60k | E |
| HopeRF RFM95W-915 (SX1276) | 100k–150k (listings about 115k–118k) | V |
| Ai-Thinker Ra-01H (SX1276) | 70k–120k | E |
| LoRa dev board 915/923 (LilyGO/Heltec) | 250k–550k | E |
| Raspberry Pi 4/5 (2–4 GB) | 1.0–1.8 jt | E |
| LoRaWAN 8-channel gateway (SX1302 HAT, or RAK/Dragino indoor) | 1.5–6 jt | E |
| Capacitive soil moisture v1.2 | 10k–25k | E |
| RS-485 soil probe, VWC+T | 300k–700k | E |
| RS-485 soil 3-in-1 NPK | about 2.0 jt | V |
| RS-485 NPK-only industrial | about 850k | V |
| RS-485 soil 7-in-1 (NPK/pH/EC/T/H) | **2.75–4.25 jt** | V |
| MAX485 module / isolated RS-485 module | 5k–15k / 80k–200k | E |
| DHT22 / BME280 | 40k–70k / 40k–90k | E |
| SHT31/SHT4x sintered probe | 80k–250k | E |
| RS-485 T/RH transmitter with shield | 0.4–1.2 jt | E |
| BH1750 / waterproof lux dome | 15k–35k / 150k–400k | E |
| PAR quantum sensor (RS-485) | 2–6 jt | E |
| Rain plate FC-37 / tipping-bucket gauge | 10k–20k / 0.5–2.5 jt | E |
| Leaf-wetness sensor (RS-485) | 0.8–2.5 jt | E |
| JSN-SR04T / float switch / 4–20 mA level transmitter | 60k–120k / 15k–40k / 0.4–1.5 jt | E |
| Analog pH kit / DFRobot Gravity EC | 150k–400k / 0.6–1.0 jt | E |
| Industrial EC/pH transmitter | 1.5–5 jt | E |
| 12 V solenoid valve ½" plastic / 1" brass / motorized ball valve | 50k–120k / 150k–400k / 250k–600k | E |
| Relay module 1-channel / 4-channel / SSR 25 A | 10k–20k / 30k–60k / 50k–120k | E |
| Contactor + MCB + RCBO per AC circuit | 300k–800k | E |
| 12 V DC diaphragm pump, about 60 W | 150k–350k | E |
| Solar panel mono 2 W 6 V / 20 Wp / 50 Wp | 30k–60k / 200k–350k / 400k–700k | E |
| Charge controller PWM 10 A | 50k–100k (a listing at about 70k) | V/E |
| Charge controller, genuine MPPT 10–20 A | 0.4–1.2 jt. *Many cheap "MPPT" units are PWM inside.* | E/C |
| LiFePO4 12.8 V 15–20 Ah | 0.9–1.8 jt | E |
| 18650 genuine 2,600–3,400 mAh / CN3791 / TP4056 | 30k–70k / 25k–50k / 5k–10k | E |
| IP65 ABS box about 200×150×100 / gland PG7–9 / ePTFE vent | 50k–150k / 2k–5k each / 10k–40k | E |
| DC SPD for PV / N-type coax arrester / copper-bonded rod 1.5 m with clamp | 150k–400k / 100k–350k / 100k–250k | E |
| Shielded twisted-pair cable / NYY 2×1.5 | 8k–20k per m / 10k–20k per m | E |

---

## 7. Rules table (for the AI prompt and the design checks)

**Severity:**
- `block`: the spec fails validation and the AI must repair it.
- `warn`: shown in the checklist; the user may accept it.
- `info`: printed on the Build Sheet.

`check` is pseudo-logic over the SystemSpec, meaning site → fields → nodes → CircuitSpec + BOM.

### 7.1 Regulatory and RF (NET)

| ID | Applies to | Check | Severity | Message / fix | Grade |
|---|---|---|---|---|---|
| NET-01 | LoRa radio | `freq_MHz ∈ [920, 923]` and channel edges (freq ± BW/2) stay inside | block | "Indonesia LPWA band is 920–923 MHz. Use AS923-2 or 920.2–922.8 MHz." | A |
| NET-02 | LoRa end node | `tx_dBm + antenna_gain_dBi − cable_loss_dB ≤ 20` (100 mW EIRP) | block | "End-node EIRP ≤ 100 mW. Lower `tx_dBm`." | A |
| NET-03 | LoRa gateway | conducted ≤ 23 dBm (200 mW) and EIRP ≤ 26 dBm (400 mW) | block | | A |
| NET-04 | LoRa node firmware | `airtime_per_hour_s ≤ 36` (1% uplink), unless hopping over at least 6 channels | block | "Increase the interval or lower SF." | A |
| NET-05 | LoRa BOM | module part ∉ {RA-02, SX1278, 433 MHz or 868 MHz variants} | block | "RA-02 is 433 MHz. Use Ra-01H, RFM95W-915 or SX1262 915." | C |
| NET-06 | LoRa BOM | Build Sheet note: equipment must carry Komdigi/SDPPI certification for commercial use; TKDN unverified | info | | A/M |
| NET-07 | LoRa link | estimated distance > 1 km through canopy, or > 5 km LOS | warn | "Raise the gateway antenna (6–10 m mast) or add a relay node, then do a site RSSI survey (target RSSI > −115 dBm, SNR > −7 dB at SF10)." | M |
| NET-08 | Wi-Fi node | distance to AP > 80 m with no external antenna, or the node is in an open field | warn | "Use LoRa or an outdoor CPE." | M |
| NET-09 | RS-485 bus | `length_m ≤ 1200` at ≤ 9,600 bps; units ≤ 32; topology = daisy chain; 120 Ω at both ends; unique Modbus IDs | block | | A |
| NET-10 | RS-485 bus | `length_m > 30` or it leaves a building, and there is no surge protector or isolation at both ends | warn | | M |
| NET-11 | Gateway | antenna mounted outside any metal greenhouse | warn | | M |

### 7.2 Power (PWR)

| ID | Check | Severity | Message / fix | Grade |
|---|---|---|---|---|
| PWR-01 | Each node has `E_Wh_day`, `battery_Wh`, `pv_Wp`, `autonomy_days`. Battery ≥ E/η × autonomy ÷ DoD; PV ≥ E/η ÷ (3.5 × derate) × 1.3 | block | "Resize the battery or panel (method in §4)." | M |
| PWR-02 | Battery node uses `esp32-devkit` or `nodemcu-v3` with deep-sleep sizing below 5 mA | warn | "DevKit sleep current is 5–15 mA. Use a bare module or a low-Iq LDO, or budget 10 mA." | M |
| PWR-03 | Charge controller: chemistry matches the battery, there is temperature cut-off, and `I_ctrl ≥ 1.25 × Isc` | block | | M |
| PWR-04 | AC load > 100 W (fan, misting pump, fertigation pump) on a solar node | warn | "Feed it from PLN or a genset, or size a dedicated PV system." | M |
| PWR-05 | Sensors on a sleeping node are power-gated (MOSFET or a GPIO-switched rail); RS-485 probes get warm-up time ≥ the datasheet figure (often 1–3 s) | warn | | M |
| PWR-06 | Autonomy ≥ 5 days for highland or rainy-season sites, ≥ 3 for lowland | warn | | M |
| PWR-07 | Solar design uses the annual average of 4.8 PSH | warn | "Design for 3.5 PSH (wet-season month)." | A/M |

### 7.3 Sensing (SEN)

| ID | Check | Severity | Message / fix | Grade |
|---|---|---|---|---|
| SEN-01 | Outdoor soil sensor is resistive (FC-28/YL-69) | block | "Corrodes in weeks. Use capacitive v1.2 or RS-485." | M |
| SEN-02 | Capacitive soil sensor present, so the firmware has `raw_dry` and `raw_fc` calibration constants and outputs RAW% | block | | B |
| SEN-03 | NPK reading displayed | block unless labelled | Label must read "NPK estimate, not a soil test; confirm with a lab test" | B |
| SEN-04 | T/RH sensor placed inside the electronics enclosure | block | "Put it in a radiation shield outside the box." | M |
| SEN-05 | Analog pH/EC boards in the same tank, not galvanically isolated | warn | | M |
| SEN-06 | EC reading lacks temperature compensation to 25 °C | warn | | M |
| SEN-07 | BH1750 in full sun with no attenuating dome | warn | "Saturates at 65 klux; use VEML7700 or a filter." | C |
| SEN-08 | `rain-sensor` plate used for rain amount (mm) | block | "The plate is yes/no only; use a tipping bucket for mm." | M |
| SEN-09 | Soil sensor depth: mango 30 and 60 cm; banana 20–30 cm; melon in the root ball of the substrate or polybag; flowers 10–15 cm | warn | | M |
| SEN-10 | HC-SR04 used outdoors or above a water tank | warn | "Use JSN-SR04T or a pressure transmitter." | M |
| SEN-11 | DS18B20 or DHT22 cable > 20 m | warn | | M |

### 7.4 Crop logic (CROP)

These rules read their parameters from the §1.5 JSON.

| ID | Crop | Rule | Severity | Grade |
|---|---|---|---|---|
| CROP-01 | Mango | The irrigation controller has a `phase` state. When `phase = induction`, auto-irrigation is off. From fruit set to harvest, irrigate on soil-moisture threshold (`p_depletion` 0.5, M) | block | A/B |
| CROP-02 | Mango | Alert if soil is dry during fruit set or development | warn | B |
| CROP-03 | Melon | Under cover (greenhouse or screenhouse) and has an air T/RH sensor | block | C |
| CROP-04 | Melon | Ventilation actuator (fan or vent) exists; switch it on above 30 °C; alarm above 35 °C | block | C |
| CROP-05 | Melon | Fertigation feed EC within the stage band (1.8–2.8 by stage; overall 2.0–2.5) and pH 5.5–6.5; alarm out of band; dosing is closed-loop or manual-confirm | block (sensor present) / warn (thresholds) | C |
| CROP-06 | Melon | Tank level sensor present, with pump dry-run protection (no pump when the tank is low) | block | M |
| CROP-07 | Melon | Misting allowed only if RH < 80%, so it never pushes RH above 85% | warn | C |
| CROP-08 | Banana | Irrigation trigger is a tension above 25 kPa, or an equivalent RAW% below 65; target about 15 kPa; at least daily in dry spells | block | B |
| CROP-09 | Banana | Saturation alert: soil above field capacity for more than 24 h | warn | A/M |
| CROP-10 | Chrysanthemum | Lamp relay on an RTC schedule (`ds3231-rtc` or NTP fallback) from 22:00 to 02:00 during the vegetative phase only; a phase switch turns it off for bud set | block | A/C |
| CROP-11 | Chrysanthemum | Air T alarm below 17 °C or above 30 °C; night target 16–18 °C noted | warn | A |
| CROP-12 | Chrysanthemum | Has a leaf-wetness or RH sensor; disease-risk warn when wet for 6 h or more at 17–25 °C, or RH above 90% for 6 h or more | warn | M |
| CROP-13 | Rose | pH 6–7 noted; elevation outside 560–1,200 m gets a warn | info | C |
| CROP-14 | Any | Every actuator has a **fail-safe default** (valve NC; pump off on comms loss for more than N min; a watchdog) | block | M |
| CROP-15 | Any | Every crop threshold printed on the Build Sheet shows its grade, and C/M values say "adjust to local agronomist advice" | info | — |

### 7.5 Actuation and electrical (ACT)

| ID | Check | Severity | Grade |
|---|---|---|---|
| ACT-01 | Solenoid, pump or motor coil on a MOSFET or relay has a flyback diode; MOSFET is logic-level at 3.3 V (IRF520 is **not** fully on at 3.3 V gate, so use IRLZ44N, AO3400 or a relay) | block | M |
| ACT-02 | Hobby relay module contact rating ≥ 2× steady load current; no motors over 0.5 HP on a hobby relay | block | M |
| ACT-03 | AC motor loads (fan, pump) go through a contactor with overload protection, an MCB, and an RCBO 30 mA in wet areas | block | M (PUIL practice) |
| ACT-04 | The 12 V valve supply is separate from the logic rail or decoupled (bulk capacitor ≥ 470 µF plus a buck converter) | warn | M |
| ACT-05 | Valve sequencing: no more zones open at once than the pump flow and PV budget allow | warn | M |

### 7.6 Enclosure and installation (ENC)

| ID | Check | Severity | Grade |
|---|---|---|---|
| ENC-01 | Outdoor enclosure IP rating ≥ IP65 (IP66 where exposed to spray or driving rain) | block | M |
| ENC-02 | Glands on the bottom face, sized to the cable, with a drip loop; ePTFE vent and desiccant | warn | M |
| ENC-03 | Sun shield on the box, light colour; battery charging disabled above 45 °C | warn | M |
| ENC-04 | Gateway mast earth electrode ≤ 5 Ω target, bonded; N-type coax arrester at the entry point | block (gateway) | C (PUIL as cited) |
| ENC-05 | Antenna inside the air-terminal protection zone (SNI 03-7015 / IEC 62305) | warn | C |
| ENC-06 | Outdoor cables UV-rated; buried runs in conduit; sensor cable 20 cm or more from power cable | warn | M |
| ENC-07 | Build Sheet includes a "monthly maintenance" list: clean the rain gauge, recalibrate pH, check glands and desiccant, clean the panel | info | M |

---

## 8. Reference plan: the 4-field farm (one valid answer the AI can be checked against)

**Site assumption:** lowland (mango, banana and melon) with a highland flower plot. If the prompt does not give a location, the AI asks for one or assumes lowland and says so.

| Field | Node | Sensors (semi-pro default; hobby fallback) | Actuators | Link | Power |
|---|---|---|---|---|---|
| A, mango | `node-mango` (ESP32 module + Ra-01H) | 2 RS-485 VWC+T probes at 30 and 60 cm (or 2 capacitive v1.2) | 1 latching 12 V valve (drip ring) | LoRa | 12.8 V 6–10 Ah LiFePO4 + 20 Wp |
| B, melon greenhouse | `node-melon` (ESP32 DevKit allowed, on mains) | SHT31 probe in a shield; BH1750 under a dome; tank EC/pH (Gravity, isolated); JSN-SR04T tank level; substrate VWC | 4 drip zones, fertigation pump (AC through a contactor), exhaust fan (AC), misting solenoid | Wi-Fi if within 80 m of the AP, else LoRa | PLN mains + 12 V PSU; UPS optional |
| C, banana | `node-banana` (ESP32 module + Ra-01H) | 1–2 RS-485 VWC probes at 25 cm (or a tensiometer at pro tier); DS18B20 | 1 zone valve | LoRa | Example A (18650 + 2 W) if sensor-only; with a valve, example B scaled down |
| D, chrysanthemum screenhouse | `node-flower` (ESP32 + Ra-01H) | SHT31 in a shield; leaf-wetness (RS-485); BH1750 | Night-break lamp relay (RTC), misting solenoid, drip valve | LoRa | PLN for the lamps; node on 12 V |
| Gateway | `gw-pi` (Raspberry Pi + SX1302 HAT, or a single-channel SX1276 HAT for a demo) | Shared weather: tipping-bucket rain gauge, T/RH, lux | — | Wi-Fi or Ethernet or 4G backhaul | PLN + UPS; mast earth + coax arrester |

---

## 9. Open items and confidence

1. **Find the final LPWA technical regulation.** The table in §3.1 comes from the 2018 consultation draft (read in full). The framework is now Permenkominfo 2/2023. Confirm the numbers against the signed regulation on JDIH Komdigi; jdih.kominfo.go.id was unreachable from this session. TKDN was not verified.
2. **Confirm the FAO-56 values in the M rows** against Tables 12 and 22 (Kc for melon and banana, *p* values), at https://www.fao.org/3/x0490E/x0490e00.htm.
3. **Melon numbers are thesis-grade (C).** Prefer a BPTP/BSIP or Ditjen Hortikultura melon SOP if one exists. The per-stage EC split is M.
4. **Rose numbers conflict between sources (C).** Chrysanthemum is the safer default for "flowers".
5. **Distances are engineering estimates.** The ITB oil-palm LoRa paper (indexed on LPPM ITB) may give measured canopy numbers; fetch it before quoting km figures as fact.
6. **Most prices are estimates (E).** Refresh them before the Build Sheet ships.

## 10. Sources

**Grade A**
- Kominfo, RPM *Persyaratan Teknis Alat dan/atau Perangkat Telekomunikasi LPWA* (consultation draft, 2018): https://web.komdigi.go.id/resource/ZHJ1cGFsL2tvbWluZm8tUlBNLUxQV0Eta29uc3VsdGFzaS1wdWJsaWsucGRm
- JDIH Komdigi, Permenkominfo No. 1/2019 (24 Apr 2019): https://jdih.komdigi.go.id/produk_hukum/view/id/676/t/peraturan+menteri+komunikasi+dan+informatika+nomor+1+tahun+2019+tanggal+24+april+2019. The Permenkominfo 2/2023 abstract is at jdih.kominfo.go.id/produk_hukum/unduh-abstrak/502.
- Kementan repository, Krisan booklet (BPTP): https://repository.pertanian.go.id/bitstream/handle/123456789/9050/Booklet%20Budidaya%20Bunga%20Krisan.pdf
- Kementan, banana SOP: https://repository.pertanian.go.id/bitstreams/768bd1a8-0416-4b62-84c6-8fc3868a06f1/download
- Ditjen Hortikultura, *Buku Pedoman Budidaya Pisang* (2020): https://hortikultura.pertanian.go.id/wp-content/uploads/2024/10/Buku-Pedoman-Budidaya-Pisang_watermark-2.pdf
- Kementan repository, mango: https://repository.pertanian.go.id/bitstreams/675cd8e7-059d-407a-b3f8-5308470c7e1b/download
- ESDM, *Pemanfaatan Energi Surya di Indonesia*: https://esdm.go.id/id/media-center/arsip-berita/pemanfaatan-energi-surya-di-indonesia
- ESDM EBTKE, *Peluang Besar Kejar Target EBT Melalui Energi Surya*: https://www.esdm.go.id/id/berita-unit/direktorat-jenderal-ebtke/peluang-besar-kejar-target-ebt-melalui-energi-surya
- FAO-56 (reference for the M values): https://www.fao.org/3/x0490E/x0490e00.htm

**Grade B**
- DPIRD WA, *Banana irrigation and soil water management*: https://www.agric.wa.gov.au/bananas/banana-irrigation-and-soil-water-management-oria
- Embrapa, banana Kc: https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/154336/1/OPB275.pdf
- Ceará banana ET study: https://periodicos.ufc.br/revistacienciaagronomica/article/view/83921
- ICAR, mango critical water stages: https://epubs.icar.org.in/index.php/JISCAR/article/download/79587/33352/202120
- Embrapa, Palmer mango deficit irrigation: https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1123274/1/Fruit-yield-and-quality-of-Palmer-mango-2020.pdf
- CGIAR / Alliance Bioversity–CIAT, low-cost soil probe report: https://alliancebioversityciat.org/publications-data/digital-transformation-accelerator-technical-report-probe-low-cost-portable-soil
- WUR, field calibration of low-cost capacitive sensors: https://research.wur.nl/en/publications/field-performance-and-calibration-strategies-for-low-cost-capacit/
- Sensors (2020): https://pmc.ncbi.nlm.nih.gov/articles/PMC7698305
- Melon lysimeter and Kc studies (Unibas): https://iris.unibas.it/handle/11563/16679

**Grade C**
- DFRobot SEN0605 NPK wiki: https://wiki.dfrobot.com/RS485_Soil_Sensor_N_P_K_SKU_SEN0605
- Ai-Thinker Ra-01H documentation: https://docs.ai-thinker.com/en/Ra-01H/
- Melon EC/pH thesis (Telkom Univ): https://repository.telkomuniversity.ac.id/pustaka/files/215572/bab1/perancangan-dan-implementasi-sistem-pengendali-nutrisi-dan-ph-pada-buah-melon-hidroponik-irigasi-tetes-berbasis-iot-dalam-bentuk-buku-karya-ilmiah.pdf
- Melon growing conditions (Unisba Blitar): https://repository.unisbablitar.ac.id/198/3/BAB%20II.pdf
- Rose thesis (Undip): https://eprints2.undip.ac.id/33338/5/Skripsi%20Bab%202.pdf
- Chrysanthemum greenhouse microclimate: https://jurnal.harianregional.com/agrotechno/id-50190
- LoRa 920–923 MHz theses: https://repository.ittelkom-pwt.ac.id/10237/3/ABSTRACT.pdf and https://repository.pnj.ac.id/40638/2/IsiSkripsi.pdf
- Bisnis.com (2019), unlicensed IoT band: https://teknologi.bisnis.com/read/20190211/101/887418/iot-makers-unlicensed-kebagian-frekuensi-gratis
- PUIL 2011 grounding as cited: https://jurnal.unissula.ac.id/index.php/EI/article/download/39855/13276
- Tokopedia listings for RFM95W, 7-in-1, 3-in-1 and NPK probes, and PWM controllers, seen 2026-10-23. Examples: https://www.tokopedia.com/digital-tech-1/rs485-soil-npk-ph-ec-temp-humidity-sensor-tester-7-in-1-soil and https://www.tokopedia.com/focuscamerashop/hoperf-lora-transceiver-module-rfm95-rfm95w-915-mhz
