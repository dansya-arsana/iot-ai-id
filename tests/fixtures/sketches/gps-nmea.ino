// Test fixture: reads NMEA lines from a GPS on hardware Serial and prints the lat/lon fields of every $GPGGA line.
char line[96];
uint8_t n = 0;
void setup() {
  Serial.begin(9600);
  Serial.println("gps ready");
}
void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      line[n] = 0;
      if (n > 6 && line[3] == 'G' && line[4] == 'G' && line[5] == 'A') {
        // fields: 0 id, 1 time, 2 lat, 3 N/S, 4 lon, 5 E/W, 6 quality
        char *p = line; uint8_t f = 0;
        Serial.print("GGA");
        while (*p) {
          if (*p == ',') { f++; Serial.print(' '); }
          else if (f >= 2 && f <= 6) Serial.print(*p);
          p++;
        }
        Serial.println();
      }
      n = 0;
    } else if (c != '\r' && n < sizeof(line) - 1) line[n++] = c;
  }
}
