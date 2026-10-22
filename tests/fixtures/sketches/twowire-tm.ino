// Test fixture: a TM1637-style two-wire bus bit-banged on CLK = D2, DIO = D3 (our own code). Sends three frames and counts the ACKs.
const int CLK = 2, DIO = 3;
void bitDelay() { delayMicroseconds(5); }
void start() { digitalWrite(DIO, HIGH); digitalWrite(CLK, HIGH); bitDelay(); digitalWrite(DIO, LOW); bitDelay(); digitalWrite(CLK, LOW); }
void stop() { digitalWrite(CLK, LOW); digitalWrite(DIO, LOW); bitDelay(); digitalWrite(CLK, HIGH); bitDelay(); digitalWrite(DIO, HIGH); bitDelay(); }
bool writeByte(uint8_t b) {
  for (uint8_t i = 0; i < 8; i++) {
    digitalWrite(CLK, LOW);
    digitalWrite(DIO, (b >> i) & 1);   // LSB first
    bitDelay();
    digitalWrite(CLK, HIGH);
    bitDelay();
  }
  digitalWrite(CLK, LOW);
  pinMode(DIO, INPUT);                  // release: the slave pulls DIO low for the ACK
  bitDelay();
  digitalWrite(CLK, HIGH);
  bitDelay();
  bool ack = digitalRead(DIO) == LOW;
  digitalWrite(CLK, LOW);
  pinMode(DIO, OUTPUT);
  digitalWrite(DIO, LOW);
  return ack;
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
  uint8_t acks = 0;
  start(); acks += writeByte(0x40); stop();
  start(); acks += writeByte(0xC0); acks += writeByte(0x3F); acks += writeByte(0x06); acks += writeByte(0x5B); stop();
  start(); acks += writeByte(0x8F); stop();
  Serial.print("acks=");
  Serial.println(acks);
  delay(200);
}
