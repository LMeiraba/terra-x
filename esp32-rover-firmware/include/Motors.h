#pragma once
#include <Arduino.h>

void initMotors();
void setMotors(int leftSpeed, int rightSpeed);
void setCone(bool state);
void setHeadlights(bool state);
