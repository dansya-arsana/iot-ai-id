// Test fixture: SPI master at register level (no library). Reads register 0x0F of the slave on CS = D10 and prints it.
void setup() {
  Serial.begin(9600);
  pinMode(10, OUTPUT);
  digitalWrite(10, HIGH);
  pinMode(11, OUTPUT);  // MOSI
  pinMode(13, OUTPUT);  // SCK
  SPCR = (1 << SPE) | (1 << MSTR) | (1 << SPR0);  // master, mode 0, f/16
  Serial.println("ready");
}

uint8_t xfer(uint8_t b) {
  SPDR = b;
  while (!(SPSR & (1 << SPIF))) {}
  return SPDR;
}

void loop() {
  digitalWrite(10, LOW);
  xfer(0x8F);              // read register 0x0F
  uint8_t id = xfer(0x00);
  uint8_t next = xfer(0x00);
  digitalWrite(10, HIGH);
  Serial.print("id=");
  Serial.print(id, HEX);
  Serial.print(" next=");
  Serial.println(next, HEX);
  delay(100);
}
