/*
 * All-Channel (0 to 5) PCA9685 Continuous Servo Sweeper
 */
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver(0x40);

void setup() {
  Wire.begin();
  delay(200);
  pwm.begin();
  pwm.setPWMFreq(50);
  delay(200);
}

void loop() {
  // Move ALL CHANNELS 0..5 to 0 degrees
  for (uint8_t ch = 0; ch < 6; ch++) {
    pwm.setPWM(ch, 0, 150);
  }
  delay(1500);

  // Move ALL CHANNELS 0..5 to 90 degrees
  for (uint8_t ch = 0; ch < 6; ch++) {
    pwm.setPWM(ch, 0, 375);
  }
  delay(1500);

  // Move ALL CHANNELS 0..5 to 180 degrees
  for (uint8_t ch = 0; ch < 6; ch++) {
    pwm.setPWM(ch, 0, 600);
  }
  delay(1500);
}
