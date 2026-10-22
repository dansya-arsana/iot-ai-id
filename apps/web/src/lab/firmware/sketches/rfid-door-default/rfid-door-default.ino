// Lesson 19: RFID door. RC522 on SPI (SS D10, RST D9), servo lock on D6, relay module IN on D4 (active low: LOW closes the contact).
// Our own minimal MFRC522 driver: REQA, anticollision and SELECT over one or two cascade levels, then HLTA. Only SPI.h and Servo.h.
#include <SPI.h>
#include <Servo.h>

unsigned int unlockMs = 3000;    // how long the door stays open after a good card
byte openDeg = 90;               // servo angle of the open position

const byte SS_PIN = 10, RST_PIN = 9, SERVO_PIN = 6, RELAY_PIN = 4;
const byte LOCK_DEG = 0;

enum { CommandReg = 0x01, ComIrqReg = 0x04, DivIrqReg = 0x05, ErrorReg = 0x06, FIFODataReg = 0x09, FIFOLevelReg = 0x0A, BitFramingReg = 0x0D,
       ModeReg = 0x11, TxControlReg = 0x14, TxASKReg = 0x15, CRCResultRegH = 0x21, CRCResultRegL = 0x22, TModeReg = 0x2A, TPrescalerReg = 0x2B,
       TReloadRegH = 0x2C, TReloadRegL = 0x2D, VersionReg = 0x37 };

// The allow-list: two cards the door knows. Anything else is refused.
const byte ALLOWED_COUNT = 2;
const byte ALLOWED_LEN[ALLOWED_COUNT] = {4, 7};
const byte ALLOWED[ALLOWED_COUNT][7] = {
  {0x4B, 0xA2, 0x1F, 0x93, 0, 0, 0},
  {0x04, 0x6A, 0xB1, 0x2C, 0x5F, 0x71, 0x80},
};

Servo lock;
bool isOpen = false;
unsigned long openedAt = 0;

uint8_t rd(uint8_t r) {
  SPI.beginTransaction(SPISettings(4000000, MSBFIRST, SPI_MODE0));
  digitalWrite(SS_PIN, LOW);
  SPI.transfer(0x80 | (r << 1));
  uint8_t v = SPI.transfer(0);
  digitalWrite(SS_PIN, HIGH);
  SPI.endTransaction();
  return v;
}
void wr(uint8_t r, uint8_t v) {
  SPI.beginTransaction(SPISettings(4000000, MSBFIRST, SPI_MODE0));
  digitalWrite(SS_PIN, LOW);
  SPI.transfer(r << 1);
  SPI.transfer(v);
  digitalWrite(SS_PIN, HIGH);
  SPI.endTransaction();
}

void crc(const uint8_t *d, uint8_t n, uint8_t *out) {
  wr(CommandReg, 0x00);
  wr(DivIrqReg, 0x04);
  wr(FIFOLevelReg, 0x80);
  for (uint8_t i = 0; i < n; i++) wr(FIFODataReg, d[i]);
  wr(CommandReg, 0x03);
  for (uint16_t i = 0; i < 5000; i++) if (rd(DivIrqReg) & 0x04) break;
  wr(CommandReg, 0x00);
  out[0] = rd(CRCResultRegL);
  out[1] = rd(CRCResultRegH);
}

// send tx[0..n), lastBits valid bits in the last byte (0 = 8); returns the answer length or -1 on timeout/error
int8_t xcv(const uint8_t *tx, uint8_t n, uint8_t lastBits, uint8_t *rx) {
  wr(CommandReg, 0x00);
  wr(ComIrqReg, 0x7F);
  wr(FIFOLevelReg, 0x80);
  for (uint8_t i = 0; i < n; i++) wr(FIFODataReg, tx[i]);
  wr(BitFramingReg, lastBits);
  wr(CommandReg, 0x0C);
  wr(BitFramingReg, rd(BitFramingReg) | 0x80);
  uint32_t t0 = millis();
  for (;;) {
    uint8_t irq = rd(ComIrqReg);
    if (irq & 0x30) break;
    if (irq & 0x01) return -1;
    if (millis() - t0 > 60) return -1;
  }
  if (rd(ErrorReg) & 0x13) return -1;
  uint8_t lvl = rd(FIFOLevelReg);
  for (uint8_t i = 0; i < lvl; i++) rx[i] = rd(FIFODataReg);
  return lvl;
}

// Reads one card. Returns the UID length (4 or 7), or 0 when no card answered.
uint8_t readCard(uint8_t *uid) {
  uint8_t rx[16], tx[10], len = 0;
  tx[0] = 0x26;
  if (xcv(tx, 1, 7, rx) != 2) return 0;
  for (uint8_t level = 0; level < 2; level++) {
    uint8_t sel = level == 0 ? 0x93 : 0x95;
    tx[0] = sel; tx[1] = 0x20;
    if (xcv(tx, 2, 0, rx) != 5) return 0;
    if ((rx[0] ^ rx[1] ^ rx[2] ^ rx[3]) != rx[4]) return 0;
    tx[0] = sel; tx[1] = 0x70;
    for (uint8_t i = 0; i < 5; i++) tx[2 + i] = rx[i];
    crc(tx, 7, tx + 7);
    uint8_t keep[4] = {rx[0], rx[1], rx[2], rx[3]};
    if (xcv(tx, 9, 0, rx) != 3) return 0;
    uint8_t first = keep[0] == 0x88 ? 1 : 0;
    for (uint8_t i = first; i < 4; i++) uid[len++] = keep[i];
    if (!(rx[0] & 0x04)) break;
  }
  tx[0] = 0x50; tx[1] = 0x00;
  crc(tx, 2, tx + 2);
  xcv(tx, 4, 0, rx);   // HLTA: a halted card stays quiet until it leaves the field, so one tap is one read
  return len;
}

bool allowed(const uint8_t *uid, uint8_t len) {
  for (uint8_t k = 0; k < ALLOWED_COUNT; k++) {
    if (ALLOWED_LEN[k] != len) continue;
    bool same = true;
    for (uint8_t i = 0; i < len; i++) if (ALLOWED[k][i] != uid[i]) same = false;
    if (same) return true;
  }
  return false;
}

void hex2(uint8_t b) { if (b < 16) Serial.print('0'); Serial.print(b, HEX); }

void setup() {
  Serial.begin(9600);
  digitalWrite(RELAY_PIN, HIGH);   // idle level first, so the relay never clicks at start-up
  pinMode(RELAY_PIN, OUTPUT);
  lock.attach(SERVO_PIN);
  lock.write(LOCK_DEG);
  pinMode(SS_PIN, OUTPUT);
  digitalWrite(SS_PIN, HIGH);
  pinMode(RST_PIN, OUTPUT);
  digitalWrite(RST_PIN, LOW);
  delay(2);
  digitalWrite(RST_PIN, HIGH);
  delay(5);
  SPI.begin();
  wr(CommandReg, 0x0F);
  while (rd(CommandReg) & 0x10) delay(1);
  wr(TModeReg, 0x80);
  wr(TPrescalerReg, 0xA9);
  wr(TReloadRegH, 0x03);
  wr(TReloadRegL, 0xE8);
  wr(TxASKReg, 0x40);
  wr(ModeReg, 0x3D);
  wr(TxControlReg, rd(TxControlReg) | 0x03);
  Serial.print("reader ver=");
  hex2(rd(VersionReg));
  Serial.println();
  Serial.println("ready: door locked");
}

void loop() {
  if (isOpen && millis() - openedAt >= unlockMs) {
    isOpen = false;
    lock.write(LOCK_DEG);
    digitalWrite(RELAY_PIN, HIGH);
    Serial.println("door locked");
  }
  uint8_t uid[10];
  uint8_t len = readCard(uid);
  if (len) {
    Serial.print("uid=");
    for (uint8_t i = 0; i < len; i++) hex2(uid[i]);
    if (allowed(uid, len)) {
      Serial.println(" GRANTED");
      isOpen = true;
      openedAt = millis();
      lock.write(openDeg);
      digitalWrite(RELAY_PIN, LOW);
    } else {
      Serial.println(" DENIED");
    }
  }
  delay(50);
}
