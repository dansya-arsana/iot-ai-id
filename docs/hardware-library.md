# Hardware reference library

The local SQLite database contains 56 curated references: 16 boards and 40 sensors/modules. Arduino, Raspberry Pi, Pico and Espressif entries are searchable by name, aliases, category, family and protocol. Reference specifications and manufacturer links support planning; they do not claim physical verification.

`packages/hardware-library/index.ts` owns the strict reference schema and versioned seed data. It is separate from `packages/hardware-contract`, which defines the canonical electrical manifests used by executable ESP32 recipes. Existing manifest identifiers remain available for draft selection. New boards and modules have no executable manifest and cannot be added through the reference browser.

`Store.seedHardwareLibrary` validates the complete batch before an SQLite transaction. Stable IDs make repeated startup idempotent. Changed records update their payload and version while preserving their creation time. The `hardware_catalog` table survives application restarts independently of OpenViking availability.

`GET /api/hardware` preserves the existing `board` and `components` fields. It also returns `boards`, `catalog` and database metadata. Optional `q`, `kind`, `category`, `family` and `protocol` query parameters filter `catalog`. `GET /api/hardware/:id` returns a reference or a 404 response.

The `/hardware` page and `/hardware/:id` detail routes use the persistent library. The Parts drawer has a separate Pustaka IoT tab with search, filters, specification details and primary source links. Komponen draft preserves the existing component selection flow. Executable support is still restricted to the registered ESP32 room monitor and button LED recipes.

OpenViking receives one short document per record under `hardware-catalog/<id>`. Startup probes the first record before launching three indexing workers. An unavailable backend records an honest unavailable receipt and stops the batch. A stored receipt means knowledge indexing succeeded; it does not mean the device has been tested.

Values identify the referenced board or breakout. Supply ranges for a regulated breakout are not bare-chip voltage limits. Raw soil capacitance is not moisture percentage, SGP30 eCO2 is an estimate from hydrogen response, and SCD41 measures actual CO2. Library versions describe curated data changes, not source verification timestamps.

The Learn page and hardware library share a four-stage assembly guide: inspect breadboard topology, prove the breadboard build, transfer to a soldered prototype, then prepare a future PCB handoff. Solderless breadboard and Adafruit Perma-Proto are passive planning references. Generic isolated-pad perfboard does not inherit Perma-Proto connectivity. The guide stores no progress and provides no physical verification; breadboard holes/rails and PCB layout remain outside V1 validation.
