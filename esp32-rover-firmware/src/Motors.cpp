#include "Motors.h"
#include "Config.h"

// ESP32 Hardware PWM Channels
#define PWM_CHAN_LA 0
#define PWM_CHAN_LB 1
#define PWM_CHAN_RA 2
#define PWM_CHAN_RB 3
#define PWM_FREQ 5000
#define PWM_RES 8 // 8-bit resolution (0-255)

void initMotors() {
  ledcSetup(PWM_CHAN_LA, PWM_FREQ, PWM_RES);
  ledcSetup(PWM_CHAN_LB, PWM_FREQ, PWM_RES);
  ledcSetup(PWM_CHAN_RA, PWM_FREQ, PWM_RES);
  ledcSetup(PWM_CHAN_RB, PWM_FREQ, PWM_RES);

  ledcAttachPin(MOTOR_LEFT_A, PWM_CHAN_LA);
  ledcAttachPin(MOTOR_LEFT_B, PWM_CHAN_LB);
  ledcAttachPin(MOTOR_RIGHT_A, PWM_CHAN_RA);
  ledcAttachPin(MOTOR_RIGHT_B, PWM_CHAN_RB);
  
  setMotors(0, 0);
}

void setMotors(int leftSpeed, int rightSpeed) {
  // Constrain inputs from the dashboard (-100 to 100)
  leftSpeed = constrain(leftSpeed, -100, 100);
  rightSpeed = constrain(rightSpeed, -100, 100);

  // Map percentage (0-100) to actual ESP32 PWM voltage range (0-255)
  int pwmLeft = map(abs(leftSpeed), 0, 100, 0, 255);
  int pwmRight = map(abs(rightSpeed), 0, 100, 0, 255);

  // Left Motor (4WD Left Side)
  if (leftSpeed > 0) {
    ledcWrite(PWM_CHAN_LA, pwmLeft);
    ledcWrite(PWM_CHAN_LB, 0);
  } else if (leftSpeed < 0) {
    ledcWrite(PWM_CHAN_LA, 0);
    ledcWrite(PWM_CHAN_LB, pwmLeft);
  } else {
    ledcWrite(PWM_CHAN_LA, 0);
    ledcWrite(PWM_CHAN_LB, 0);
  }

  // Right Motor (4WD Right Side)
  if (rightSpeed > 0) {
    ledcWrite(PWM_CHAN_RA, pwmRight);
    ledcWrite(PWM_CHAN_RB, 0);
  } else if (rightSpeed < 0) {
    ledcWrite(PWM_CHAN_RA, 0);
    ledcWrite(PWM_CHAN_RB, pwmRight);
  } else {
    ledcWrite(PWM_CHAN_RA, 0);
    ledcWrite(PWM_CHAN_RB, 0);
  }
}
