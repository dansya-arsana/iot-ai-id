// Test fixture: three WS2812 pixels on D6, bit-banged at 800 kHz on a 16 MHz AVR (20 cycles per bit), our own driver.
// A 1 keeps the pin high for 13 cycles (0.81 us), a 0 for 4 + 2 cycles (0.38 us). Interrupts stay off while a frame goes out.
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
  const uint8_t px[3][3] = {{255, 0, 0}, {0, 128, 64}, {17, 34, 51}};  // R, G, B
  noInterrupts();
  for (uint8_t i = 0; i < 3; i++) {
    sendByte(px[i][1]);  // WS2812 wants green first
    sendByte(px[i][0]);
    sendByte(px[i][2]);
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
  delayMicroseconds(80);  // more than 50 us low: latch
  Serial.println("sent");
  delay(100);
}
