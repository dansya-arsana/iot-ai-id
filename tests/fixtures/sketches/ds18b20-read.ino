// Test fixture: minimal 1-Wire master (our own bit-banging, no OneWire library) on D2. Reads the ROM, converts, polls with read slots,
// reads the scratchpad, checks both CRCs and prints the temperature.
#define DQ_BIT 2
static inline void low() { DDRD |= _BV(DQ_BIT); }
static inline void rel() { DDRD &= ~_BV(DQ_BIT); }
static inline uint8_t sample() { return (PIND >> DQ_BIT) & 1; }

uint8_t resetPulse() {
  noInterrupts();
  low(); delayMicroseconds(480); rel(); delayMicroseconds(70);
  uint8_t present = !sample();
  interrupts();
  delayMicroseconds(410);
  return present;
}
void writeBit(uint8_t b) {
  noInterrupts();
  if (b) { low(); delayMicroseconds(6); rel(); delayMicroseconds(64); }
  else { low(); delayMicroseconds(60); rel(); delayMicroseconds(10); }
  interrupts();
}
uint8_t readBit() {
  noInterrupts();
  low(); delayMicroseconds(3); rel(); delayMicroseconds(10);
  uint8_t b = sample();
  delayMicroseconds(53);
  interrupts();
  return b;
}
void writeByte(uint8_t v) { for (uint8_t i = 0; i < 8; i++) { writeBit(v & 1); v >>= 1; } }
uint8_t readByte() { uint8_t v = 0; for (uint8_t i = 0; i < 8; i++) v |= readBit() << i; return v; }
uint8_t crc8(const uint8_t *d, uint8_t n) {
  uint8_t crc = 0;
  while (n--) { uint8_t b = *d++; for (uint8_t i = 0; i < 8; i++) { uint8_t mix = (crc ^ b) & 1; crc >>= 1; if (mix) crc ^= 0x8C; b >>= 1; } }
  return crc;
}

uint16_t readEvery = 1000;   // non-zero global so the sketch carries a tunable
void setup() {
  Serial.begin(9600);
  PORTD &= ~_BV(DQ_BIT);   // DQ output latch low; the line is only ever pulled by switching DDR
  Serial.println("ready");
}
void loop() {
  if (!resetPulse()) { Serial.println("no presence"); delay(500); return; }
  writeByte(0x33);
  uint8_t rom[8];
  for (uint8_t i = 0; i < 8; i++) rom[i] = readByte();
  Serial.print("rom=");
  for (uint8_t i = 0; i < 8; i++) { if (rom[i] < 16) Serial.print('0'); Serial.print(rom[i], HEX); }
  Serial.println(crc8(rom, 7) == rom[7] ? " crc ok" : " crc BAD");
  resetPulse(); writeByte(0xCC); writeByte(0x44);
  uint16_t polls = 0;
  while (!readBit()) { polls++; delay(10); if (polls > 200) break; }
  resetPulse(); writeByte(0xCC); writeByte(0xBE);
  uint8_t sp[9];
  for (uint8_t i = 0; i < 9; i++) sp[i] = readByte();
  int16_t raw = (int16_t)((sp[1] << 8) | sp[0]);
  Serial.print(crc8(sp, 8) == sp[8] ? "sp ok " : "sp BAD ");
  Serial.print("raw="); Serial.print(raw);
  Serial.print(" mC="); Serial.print((int32_t)raw * 625 / 10);
  Serial.print(" polls="); Serial.println(polls > 0 ? 1 : 0);
  delay(readEvery);
}
