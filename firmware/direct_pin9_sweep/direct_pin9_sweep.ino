/*
 * Direct Arduino Pin 9 Servo Test (Bypasses PCA9685 Completely)
 * 
 * WIRING FOR THIS TEST:
 *   Servo Yellow/Orange (Signal) -> Arduino Pin 9
 *   Servo Red (Power)           -> Arduino 5V Pin
 *   Servo Black/Brown (GND)      -> Arduino GND Pin
 */
#include <Servo.h>

Servo testServo;

void setup() {
  testServo.attach(9);
}

void loop() {
  testServo.write(0);
  delay(1500);
  testServo.write(90);
  delay(1500);
  testServo.write(180);
  delay(1500);
}
