#pragma once
#include <Arduino.h>

void initRadar();
void updateRadar();
int getSweepAngle();
long getSweepDistance();
void setCameraPan(int angle);
