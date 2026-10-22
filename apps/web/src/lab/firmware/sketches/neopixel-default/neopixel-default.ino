// Lesson 21: a 16 LED WS2812 ring on D6, steered by a rotary encoder (CLK D2, DT D3, SW D4).
// Turn the knob: brightness. Push the knob: next animation. No library: the 800 kHz bit-banged driver and the
// quadrature decoder below are ours (MIT-style, free to reuse).
unsigned int frameMs = 30;   // ms between animation frames
byte level = 64;             // start brightness, 16..255 (the knob changes it at run time)

const byte RING_PIN = 6;     // PORTD bit 6, written with sbi/cbi so every bit lasts exactly 20 cycles at 16 MHz
const byte COUNT = 16;
const byte PIN_CLK = 2;
const byte PIN_DT = 3;
const byte PIN_SW = 4;

byte red[COUNT];
byte grn[COUNT];
byte blu[COUNT];
byte mode = 0;               // 0 rainbow, 1 comet, 2 breathing
byte phase = 0;
byte prevState = 3;
int acc = 0;
unsigned long lastFrame = 0;
unsigned long lastPush = 0;
bool swWas = true;

// One byte, MSB first. A 1 bit keeps the wire high about 0.8 us, a 0 bit about 0.4 us.
void sendByte(uint8_t v) {
  for (int8_t i = 7; i >= 0; i--) {
    if (v & (1 << i)) {
      asm volatile("sbi %0, 6\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n cbi %0, 6\n" ::"I"(_SFR_IO_ADDR(PORTD)));
    } else {
      asm volatile("sbi %0, 6\n nop\n nop\n nop\n nop\n cbi %0, 6\n" ::"I"(_SFR_IO_ADDR(PORTD)));
    }
  }
}

void show() {
  noInterrupts();
  for (byte i = 0; i < COUNT; i++) {
    sendByte(grn[i]);        // the LED wants green first, then red, then blue
    sendByte(red[i]);
    sendByte(blu[i]);
  }
  interrupts();
  delayMicroseconds(80);     // 50 us or more of low latches the frame
}

// A colour wheel: 0 red, 85 green, 170 blue, back to red at 256. Each channel is 0..255.
void wheel(byte pos, byte scale, byte i) {
  byte r;
  byte g;
  byte b;
  if (pos < 85) {
    r = 255 - pos * 3; g = pos * 3; b = 0;
  } else if (pos < 170) {
    pos -= 85;
    r = 0; g = 255 - pos * 3; b = pos * 3;
  } else {
    pos -= 170;
    r = pos * 3; g = 0; b = 255 - pos * 3;
  }
  // scale = how much of the full colour to show (255 = all of it), then the knob brightness
  red[i] = ((unsigned int)r * scale / 255) * level / 255;
  grn[i] = ((unsigned int)g * scale / 255) * level / 255;
  blu[i] = ((unsigned int)b * scale / 255) * level / 255;
}

void draw() {
  for (byte i = 0; i < COUNT; i++) {
    if (mode == 0) {
      wheel((byte)(i * 16 + phase), 255, i);               // 16 LEDs share the 256 step wheel
    } else if (mode == 1) {
      byte head = (phase / 4) % COUNT;
      byte d = (head + COUNT - i) % COUNT;                  // how far behind the head this LED is
      wheel((byte)(head * 16), d < 8 ? 255 >> d : 0, i);
    } else {
      byte t = phase < 128 ? phase * 2 : (255 - phase) * 2; // a triangle wave: up, then down
      wheel(phase, t, i);
    }
  }
  phase += mode == 1 ? 1 : 4;
  show();
}

// Quadrature: the two lines make a 2 bit code. Clockwise it walks 3,1,0,2,3; counter-clockwise the other way.
// Four steps in one direction are one detent. Bounces walk back and forth and cancel out.
int readKnob() {
  byte now = (digitalRead(PIN_CLK) << 1) | digitalRead(PIN_DT);
  if (now == prevState) return 0;
  int step = 0;
  if ((prevState == 3 && now == 1) || (prevState == 1 && now == 0) || (prevState == 0 && now == 2) || (prevState == 2 && now == 3)) step = 1;
  else if ((prevState == 3 && now == 2) || (prevState == 2 && now == 0) || (prevState == 0 && now == 1) || (prevState == 1 && now == 3)) step = -1;
  prevState = now;
  acc += step;
  if (acc >= 4) { acc = 0; return 1; }
  if (acc <= -4) { acc = 0; return -1; }
  return 0;
}

void setup() {
  Serial.begin(9600);
  pinMode(RING_PIN, OUTPUT);
  digitalWrite(RING_PIN, LOW);
  pinMode(PIN_CLK, INPUT);
  pinMode(PIN_DT, INPUT);
  pinMode(PIN_SW, INPUT);
  prevState = (digitalRead(PIN_CLK) << 1) | digitalRead(PIN_DT);
  Serial.println("ready");
}

void loop() {
  int turn = readKnob();
  if (turn != 0) {
    int next = (int)level + turn * 16;
    if (next < 16) next = 16;
    if (next > 255) next = 255;
    level = next;
    Serial.print("level=");
    Serial.println(level);
  }
  bool sw = digitalRead(PIN_SW);
  if (!sw && swWas && millis() - lastPush > 150) {   // the knob is pushed: SW falls to GND
    lastPush = millis();
    mode = (mode + 1) % 3;
    Serial.print("mode=");
    Serial.println(mode);
  }
  swWas = sw;
  if (millis() - lastFrame >= frameMs) {
    lastFrame = millis();
    draw();
  }
}
