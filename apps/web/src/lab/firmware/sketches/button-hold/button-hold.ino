// Lesson 3a: the LED follows the button (external pull-down on D2).
int lastState = -1;

void setup() {
  Serial.begin(9600);
  pinMode(2, INPUT);
  pinMode(8, OUTPUT);
  Serial.println("ready");
}

void loop() {
  int state = digitalRead(2);
  digitalWrite(8, state);
  if (state != lastState) {      // print on change only
    Serial.println(state ? "D8 HIGH" : "D8 LOW");
    lastState = state;
  }
}
