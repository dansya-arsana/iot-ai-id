// Lesson 8a: play a C major scale on the buzzer (D5).
unsigned int noteMs = 300;   // ms per note
const unsigned int notes[] = {262, 294, 330, 349, 392, 440, 494, 523};

void setup() {
  Serial.begin(9600);
  pinMode(5, OUTPUT);
  Serial.println("ready");
}

void loop() {
  for (byte i = 0; i < 8; i++) {
    Serial.print("note ");
    Serial.println(notes[i]);
    tone(5, notes[i], noteMs * 9 / 10);
    delay(noteMs);
  }
  delay(600);   // rest before repeating
}
