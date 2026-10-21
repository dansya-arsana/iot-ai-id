// All scene colours live here. Three.js material colours are data-encoding, so every line is tagged.
import type {LedColor,WireColor} from '../contract';

export const STAGE_BG=0xf6f4ef; // ds-allow-hex  (= --lab-stage)
export const STAGE_BG_CSS='#f6f4ef'; // ds-allow-hex
export const INK=0x0a0a0a; // ds-allow-hex
export const LIVE=0x3fcf6e; // ds-allow-hex
export const PWM=0xe2a20b; // ds-allow-hex
export const TEAL=LIVE; // legacy alias: the accent is live green
export const TEAL_LIGHT=0x9be8b4; // ds-allow-hex
export const PCB=0x1a2420; // ds-allow-hex
export const PCB_DARK=0x121916; // ds-allow-hex
export const SILKSCREEN='#ece8dc'; // ds-allow-hex
export const COPPER='#22302a'; // ds-allow-hex
export const HEADER_BLACK=0x1e2024; // ds-allow-hex
export const HEADER_TOP=0x2c2f35; // ds-allow-hex
export const HOLE=0x0c0d0f; // ds-allow-hex
export const SILVER=0xb7bec9; // ds-allow-hex
export const SILVER_DARK=0x7f8794; // ds-allow-hex
export const GOLD=0xc9a24a; // ds-allow-hex
export const CHIP=0x17181b; // ds-allow-hex
export const CHIP_PRINT='#b9bcc2'; // ds-allow-hex
export const CREAM=0xf3f0e8; // ds-allow-hex
export const CREAM_DARK=0xd8d3c6; // ds-allow-hex
export const GROOVE=0xb9b3a4; // ds-allow-hex
export const BB_HOLE='#5a544a'; // ds-allow-hex
export const RAIL_RED=0xd04a3c; // ds-allow-hex
export const RAIL_BLUE=0x3a6fd0; // ds-allow-hex
export const LED_ON_GREEN=0x3fcf6e; // ds-allow-hex
export const LED_L_ORANGE=0xf0902a; // ds-allow-hex
export const LED_TX_YELLOW=0xe6c35a; // ds-allow-hex
export const LED_SMD_OFF=0x3a3e45; // ds-allow-hex
export const RESISTOR_BODY=0xd9bd8a; // ds-allow-hex
export const BUTTON_CAP=0x2f63c8; // ds-allow-hex
export const POT_BLUE=0x2a58a8; // ds-allow-hex
export const KNOB=0xeeebe2; // ds-allow-hex
export const LDR_DISC=0xcaa46e; // ds-allow-hex
export const LDR_TRACK=0x7b5a2e; // ds-allow-hex
export const SONAR_PCB=0x1c62bd; // ds-allow-hex
export const LAMP_BODY=0xe0a436; // ds-allow-hex
export const LAMP_LIGHT=0xffe7a0; // ds-allow-hex
export const OBSTACLE_BOX=0xd9803f; // ds-allow-hex
export const CAR_BODY=0xd2455a; // ds-allow-hex
export const CAR_GLASS=0x27313a; // ds-allow-hex
export const TIRE=0x1f2126; // ds-allow-hex
export const BUZZER_BLACK=0x17181b; // ds-allow-hex
export const MOTOR_CAN=0xb0b8c4; // ds-allow-hex
export const MOTOR_CAP=0x32363f; // ds-allow-hex
export const FAN=0xe86f4f; // ds-allow-hex
export const SERVO_BLUE=0x2a72cf; // ds-allow-hex
export const SERVO_HORN=0xeeeee8; // ds-allow-hex
export const DIODE_BODY=0x2a2c33; // ds-allow-hex
export const DUPONT=0x25282e; // ds-allow-hex
export const FLOOR_SKY=0xfff6e8; // ds-allow-hex
export const FLOOR_GROUND=0xcdb894; // ds-allow-hex
export const SHADOW=0x3c2d14; // ds-allow-hex
export const FILL=0xdfe9ff; // ds-allow-hex
export const WHITE=0xffffff; // ds-allow-hex
export const RED_ALERT=0xe04a3f; // ds-allow-hex

export const LED_COLOR:Record<LedColor,number>={
 red:0xff3b3b, // ds-allow-hex
 yellow:0xffd02e, // ds-allow-hex
 green:0x35d86b, // ds-allow-hex
 blue:0x3b82ff, // ds-allow-hex
 white:0xfff4e0, // ds-allow-hex
};
export const LED_DIM:Record<LedColor,number>={
 red:0xd2615c, // ds-allow-hex
 yellow:0xe6c35a, // ds-allow-hex
 green:0x5fbf7f, // ds-allow-hex
 blue:0x6b8fd8, // ds-allow-hex
 white:0xdedad0, // ds-allow-hex
};
export const WIRE_COLOR:Record<WireColor,number>={
 red:0xe5342f, // ds-allow-hex
 black:0x2b2f3a, // ds-allow-hex
 orange:0xff8a1f, // ds-allow-hex
 yellow:0xffd21f, // ds-allow-hex
 green:0x2fbf5b, // ds-allow-hex
 blue:0x2f7be5, // ds-allow-hex
 purple:0x8a4fd6, // ds-allow-hex
 white:0xf2f2ee, // ds-allow-hex
};
/** Resistor bands 0-9, then gold (10) and silver (11). */
export const BAND:number[]=[
 0x111111, // ds-allow-hex
 0x7a4a21, // ds-allow-hex
 0xe03a2e, // ds-allow-hex
 0xff8a1f, // ds-allow-hex
 0xffd21f, // ds-allow-hex
 0x2fbf5b, // ds-allow-hex
 0x2f7be5, // ds-allow-hex
 0x8a4fd6, // ds-allow-hex
 0x8a8f99, // ds-allow-hex
 0xf4f4f0, // ds-allow-hex
 0xd9a93a, // ds-allow-hex
 0xc0c4cc, // ds-allow-hex
];
