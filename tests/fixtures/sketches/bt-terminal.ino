// Test fixture: HC-05 on a hand-written 9600 baud software UART (RX = D10 from the module TXD, TX = D11 to the module RXD). No SoftwareSerial library.
const uint8_t RXP = 10, TXP = 11;
void sendByte(uint8_t b) {
  noInterrupts();
  digitalWrite(TXP, LOW); delayMicroseconds(100);
  for (uint8_t i = 0; i < 8; i++) { digitalWrite(TXP, (b >> i) & 1); delayMicroseconds(100); }
  digitalWrite(TXP, HIGH); delayMicroseconds(100);
  interrupts();
}
void say(const char *s) { while (*s) sendByte(*s++); }
int readByte(unsigned long timeoutMs) {
  unsigned long t0 = millis();
  while (digitalRead(RXP) == HIGH) { if (millis() - t0 > timeoutMs) return -1; }
  noInterrupts();
  delayMicroseconds(150);
  uint8_t v = 0;
  for (uint8_t i = 0; i < 8; i++) { v |= (digitalRead(RXP) ? 1 : 0) << i; delayMicroseconds(100); }
  interrupts();
  return v;
}
void setup() {
  Serial.begin(9600);
  pinMode(RXP, INPUT);
  pinMode(TXP, OUTPUT);
  digitalWrite(TXP, HIGH);
  say("hello phone\r\n");
  Serial.println("bt ready");
}
char line[32];
uint8_t n = 0;
void loop() {
  int c = readByte(50);
  if (c < 0) return;
  if (c == '\n') {
    line[n] = 0; n = 0;
    Serial.print("got="); Serial.println(line);
    say("ack:"); say(line); say("\r\n");
  } else if (c != '\r' && n < sizeof(line) - 1) line[n++] = c;
}
