/*
 * I2C Scanner & Servo Hardware Diagnostic Tool
 */
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver(0x40);

void setup() {
  Serial.begin(115200);
  while (!Serial);
  Serial.println("\n=== I2C Scanner & PCA9685 Diagnostic ===");

  Wire.begin();

  byte count = 0;
  for (byte address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    byte error = Wire.endTransmission();

    if (error == 0) {
      Serial.print("I2C device found at address 0x");
      if (address < 16) Serial.print("0");
      Serial.print(address, HEX);
      Serial.println("  !");
      count++;
    }
  }

  if (count == 0) {
    Serial.println("No I2C devices found! Check A4(SDA) & A5(SCL) wires.");
  } else {
    Serial.print("Found ");
    Serial.print(count);
    Serial.println(" device(s). Initializing PCA9685...");
    pwm.begin();
    pwm.setPWMFreq(50);
    delay(500);

    Serial.println("Sweeping Channel 0 Servo (Base) from 150 to 500 pulse...");
    for (int pulse = 150; pulse <= 500; pulse += 10) {
      pwm.setPWM(0, 0, pulse);
      delay(50);
    }
    delay(500);
    for (int pulse = 500; pulse >= 150; pulse -= 10) {
      pwm.setPWM(0, 0, pulse);
      delay(50);
    }
    pwm.setPWM(0, 0, 325); // Set to 90 degrees
    Serial.println("Diagnostic Sweep Complete!");
  }
}

void loop() {
  delay(1000);
}
