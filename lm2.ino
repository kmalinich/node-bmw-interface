#include <stdio.h>

// https://www.youtube.com/watch?v=uWYrsLwbGic


const unsigned int NoData_num = 5000; // Number of empty readings before showing "No WBO"

byte inByte1 = 0; // six bytes of data packet from WBO controller
byte inByte2 = 0;
byte inByte3 = 0;
byte inByte4 = 0;
byte inByte5 = 0;
byte inByte6 = 0;


boolean IsNoData    = 0; // flag bit, if is packet empty
byte B              = 0; // Number of packets from WBO controller
byte F              = 0; // Status variable from WBO controller
byte FPrev          = 7; // Previous F value
unsigned int L      = 0; // Lambda value
unsigned int LPrev  = 0; // Previous lambda value
unsigned int NoData = 0; // number of empty packets in a row
word AF             = 0; // stoichiometric ratio



// Update status string on screen
void update_F() {
	SetCursor(0, 0);

	switch (F) {
		case 0:  // Lambda valid and Aux data valid, normal operation.
			SendString("AFR        " );
			break;

		case 1: // Lambda value contains O2 level in 1/10%
			SendString("%O2        " );
			break;

		case 2: // Free air Calib in progress, Lambda data not valid
			SendString("Calibration");
			break;

		case 3: // Need Free air Calibration Request, Lambda data not valid
			SendString("Need cali  ");
			break;

		case 4: // Warming up, Lambda value is temp in 1/10% of operating temp.
			SendString("Warmup     ");
			break;

		case 5: // Heater Calibration, Lambda value contains calibration countdown.
			SendString("HCali       ");
			break;

		case 6: // Error code in Lambda value
			SendString("Error      ");
			break;

		case 7: // Reserved
			break;
	} // switch (F)
}

// Update AFR data on screen
void update_L() {
	switch (F) {
		case 0:  // Lambda valid and Aux data valid, normal operation.
			dtostrf((0.5 + (L * 0.001)) * (AF / 10), 3, 1, value);
			SetCursor(0, 4);
			SendString(value);
			break;

		case 1: // Lambda value contains O2 level in 1/10%
			dtostrf(L / 10.0, 3, 1, value);
			SetCursor(0, 4);
			SendString(value);
			break;

		case 2: // Free air Calib in progress, Lambda data not valid
			break;

		case 3: // Need Free air Calibration Request, Lambda data not valid
			break;

		case 4: // Warming up, Lambda value is temp in 1/10% of operating temp.
			dtostrf(L / 10.0, 3, 0, value);
			SetCursor(0, 7);
			SendString(value);
			break;

		case 5: // Heater Calibration, Lambda value contains calibration countdown.
			dtostrf(L, 3, 0, value);
			SetCursor(0, 6);
			SendString(value);
			break;

		case 6: // Error code in Lambda value
			dtostrf(L, 1, 0, value);
			SetCursor(0, 6);
			SendString(value);
			break;

		case 7: // Reserved
			break;
	} // switch (F)
}



void setup() {
	Serial.begin(19200);
}

void loop() {
	if (Serial.available() > 6) { // check if incoming byte number higher than 6
		inByte1 = Serial.read();  // reads first byte from serial

		if (bitRead(inByte1, 7) && bitRead(inByte1, 5) && bitRead(inByte1, 1) ) { // Check bits to ensure that it is first byte of header
			inByte2 = Serial.read(); // read second byte of header

			inByte3 = Serial.read(); // reading first byte of mixture data
			inByte4 = Serial.read(); // reading second byte of mixture data

			inByte5 = Serial.read(); // reading first byte of lambda value
			inByte6 = Serial.read(); // reading second byte of lambda value

			// Check bits to ensure that it is second byte of header
			if (bitRead(inByte2, 7)) {
				bitWrite(B, 0, bitRead(inByte2, 0));
				bitWrite(B, 1, bitRead(inByte2, 1));
				bitWrite(B, 2, bitRead(inByte2, 2));
				bitWrite(B, 3, bitRead(inByte2, 3));
				bitWrite(B, 4, bitRead(inByte2, 4));
				bitWrite(B, 5, bitRead(inByte2, 5));
				bitWrite(B, 6, bitRead(inByte2, 6));
				bitWrite(B, 7, bitRead(inByte1, 0));  // Reading number of packets data

				if (B > 1) { // Checks that number of packets higher than one
					bitWrite(F, 0, bitRead(inByte3, 2));
					bitWrite(F, 1, bitRead(inByte3, 3));
					bitWrite(F, 2, bitRead(inByte3, 4));  // Reading status of WBO

					bitWrite(AF, 0, bitRead(inByte4, 0));
					bitWrite(AF, 1, bitRead(inByte4, 1));
					bitWrite(AF, 2, bitRead(inByte4, 2));
					bitWrite(AF, 3, bitRead(inByte4, 3));
					bitWrite(AF, 4, bitRead(inByte4, 4));
					bitWrite(AF, 5, bitRead(inByte4, 5));
					bitWrite(AF, 6, bitRead(inByte4, 6));
					bitWrite(AF, 7, bitRead(inByte3, 0));  // Reading stoichiometric value for mixture

					bitWrite(L, 0, bitRead(inByte6, 0));
					bitWrite(L, 1, bitRead(inByte6, 1));
					bitWrite(L, 2, bitRead(inByte6, 2));
					bitWrite(L, 3, bitRead(inByte6, 3));
					bitWrite(L, 4, bitRead(inByte6, 4));
					bitWrite(L, 5, bitRead(inByte6, 5));
					bitWrite(L, 6, bitRead(inByte6, 6));
					bitWrite(L, 7, bitRead(inByte5, 0));
					bitWrite(L, 8, bitRead(inByte5, 1));
					bitWrite(L, 9, bitRead(inByte5, 2));
					bitWrite(L, 10, bitRead(inByte5, 3));
					bitWrite(L, 11, bitRead(inByte5, 4));
					bitWrite(L, 12, bitRead(inByte5, 5)); // Reading lambda value

					if (F != FPrev) update_F(); // Checks if status changed since last iteration, if it so update status string on screen
					if (L != LPrev) update_L(); // Checks if air/fuel ratio changes since last iteration, if it so, update corresponding data on screen

					FPrev  = F;
					LPrev  = L; // Save current values of F and L for next iteration
					NoData = 0; // Reset empty data packet counter to zero

					Serial.flush(); // Reset Serial buffer
				} // if (B>1)

			}  // if (bitRead(inByte2,7))

		} // if (bitRead(inByte1,7) && bitRead(inByte1,5) && bitRead(inByte1,1) )

		IsNoData = 0;
	} // if (Serial.available() > 6)
	else {
		NoData++;
	}

	// if number of empty packets exceed limit output "NO WBO"  on screen
	if (NoData > NoData_num) {
		if (!IsNoData) {
			FPrev = 8;

			SetCursor(0, 0);
			SendString("            ");
			SetCursor(0, 0);
			SendString("No WBO");

			IsNoData = 1;
		}
	}
}
