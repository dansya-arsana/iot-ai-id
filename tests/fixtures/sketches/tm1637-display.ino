// Test fixture for the tm1637-4digit part: our own TM1637 driver on CLK = D2, DIO = D3 (no library).
// Shows 12:34 at brightness 3, then reads the key scan byte and prints it.
const byte CLK = 2, DIO = 3;
const byte GLYPH[10] = {0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F};
void bitDelay() { delayMicroseconds(5); }
void start() { digitalWrite(CLK, HIGH); digitalWrite(DIO, HIGH); bitDelay(); digitalWrite(DIO, LOW); bitDelay(); digitalWrite(CLK, LOW); }
void stop() { digitalWrite(CLK, LOW); digitalWrite(DIO, LOW); bitDelay(); digitalWrite(CLK, HIGH); bitDelay(); digitalWrite(DIO, HIGH); bitDelay(); }
bool writeByte(byte b) {
  for (byte i = 0; i < 8; i++) {
    digitalWrite(CLK, LOW);
    digitalWrite(DIO, (b >> i) & 1);        // LSB first
    bitDelay();
    digitalWrite(CLK, HIGH);
    bitDelay();
  }
  digitalWrite(CLK, LOW);
  pinMode(DIO, INPUT);                       // release DIO: the chip pulls it low on the 9th clock (ACK)
  bitDelay();
  digitalWrite(CLK, HIGH);
  bitDelay();
  bool ack = digitalRead(DIO) == LOW;
  digitalWrite(CLK, LOW);
  pinMode(DIO, OUTPUT);
  digitalWrite(DIO, LOW);
  return ack;
}
byte readByte() {
  pinMode(DIO, INPUT);
  byte v = 0;
  for (byte i = 0; i < 8; i++) {
    digitalWrite(CLK, LOW);
    bitDelay();
    digitalWrite(CLK, HIGH);
    bitDelay();
    if (digitalRead(DIO)) v |= 1 << i;       // LSB first
  }
  digitalWrite(CLK, LOW);
  pinMode(DIO, OUTPUT);
  return v;
}
void show(byte d0, byte d1, byte d2, byte d3, bool colon, byte bright) {
  byte ack = 0;
  start(); ack += writeByte(0x40); stop();                                  // auto increment
  start(); ack += writeByte(0xC0); ack += writeByte(GLYPH[d0]); ack += writeByte(GLYPH[d1] | (colon ? 0x80 : 0));
  ack += writeByte(GLYPH[d2]); ack += writeByte(GLYPH[d3]); stop();
  start(); ack += writeByte(0x88 | bright); stop();                          // display on, brightness
  Serial.print("acks="); Serial.println(ack);
}
void setup() {
  Serial.begin(9600);
  pinMode(CLK, OUTPUT);
  pinMode(DIO, OUTPUT);
  digitalWrite(CLK, HIGH);
  digitalWrite(DIO, HIGH);
  Serial.println("ready");
}
void loop() {
  show(1, 2, 3, 4, true, 3);
  start(); writeByte(0x42);
  byte key = readByte();
  stop();
  Serial.print("key=0x"); Serial.println(key, HEX);
  delay(200);
}
