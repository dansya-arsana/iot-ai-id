// Test fixture: a 64-pixel frame on D6 (our own 800 kHz bit-bang driver, 16 MHz AVR, 20 cycles per bit).
// Pixel i is R=i, G=2i, B=255-i. A strip keeps the first 8, a ring the first 16, a matrix all 64.
void sendByte(uint8_t b) {
  for (int8_t i = 7; i >= 0; i--) {
    if (b & (1 << i)) {
      asm volatile("sbi %0, 6\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n cbi %0, 6\n" ::"I"(_SFR_IO_ADDR(PORTD)));
    } else {
      asm volatile("sbi %0, 6\n nop\n nop\n nop\n nop\n cbi %0, 6\n" ::"I"(_SFR_IO_ADDR(PORTD)));
    }
  }
}

void setPixels() {
  noInterrupts();
  for (uint8_t i = 0; i < 64; i++) {
    sendByte(2 * i);
    sendByte(i);
    sendByte(255 - i);
  }
  interrupts();
}

void setup() {
  Serial.begin(9600);
  pinMode(6, OUTPUT);
  digitalWrite(6, LOW);
  Serial.println("ready");
}

void loop() {
  setPixels();
  delayMicroseconds(80);
  Serial.println("sent");
  delay(100);
}
