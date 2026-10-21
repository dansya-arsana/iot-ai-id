// All scene colours live here. Three.js material colours are data-encoding, so every line is tagged.
import type {LedColor,WireColor} from '../contract';

export const INK=0x18213d; // ds-allow-hex
export const TEAL=0x1aa3a1; // ds-allow-hex
export const TEAL_LIGHT=0x6fe0dc; // ds-allow-hex
export const PCB=0x0f7f8f; // ds-allow-hex
export const PCB_DARK=0x0a5c69; // ds-allow-hex
export const SILKSCREEN='#e9f7f5'; // ds-allow-hex
export const HEADER_BLACK=0x23262e; // ds-allow-hex
export const HOLE=0x07080b; // ds-allow-hex
export const SILVER=0xc9cfd8; // ds-allow-hex
export const SILVER_DARK=0x8d95a3; // ds-allow-hex
export const GOLD=0xe3b84a; // ds-allow-hex
export const CHIP=0x2b2e36; // ds-allow-hex
export const CREAM=0xf2e8d0; // ds-allow-hex
export const CREAM_DARK=0xd9cbab; // ds-allow-hex
export const GROOVE=0xc3b48f; // ds-allow-hex
export const RAIL_RED=0xe5483a; // ds-allow-hex
export const RAIL_BLUE=0x3b6fd6; // ds-allow-hex
export const LED_ON_GREEN=0x3ddc84; // ds-allow-hex
export const LED_L_ORANGE=0xff9a2e; // ds-allow-hex
export const LED_TX_YELLOW=0xffd23c; // ds-allow-hex
export const LED_SMD_OFF=0x4a4f5a; // ds-allow-hex
export const RESISTOR_BODY=0xe8c88f; // ds-allow-hex
export const BUTTON_CAP=0x2f6fe0; // ds-allow-hex
export const POT_BLUE=0x2a5fb8; // ds-allow-hex
export const KNOB=0xf4f1e8; // ds-allow-hex
export const LDR_DISC=0xd8b078; // ds-allow-hex
export const LDR_TRACK=0x7b5a2e; // ds-allow-hex
export const SONAR_PCB=0x1c6fd0; // ds-allow-hex
export const LAMP_BODY=0xf2b13a; // ds-allow-hex
export const LAMP_LIGHT=0xffe7a0; // ds-allow-hex
export const OBSTACLE_BOX=0xf08a4b; // ds-allow-hex
export const CAR_BODY=0xe84a5f; // ds-allow-hex
export const CAR_GLASS=0x9fd6f0; // ds-allow-hex
export const TIRE=0x2a2d36; // ds-allow-hex
export const BUZZER_BLACK=0x1f2128; // ds-allow-hex
export const MOTOR_CAN=0xb4bcc8; // ds-allow-hex
export const MOTOR_CAP=0x3a3f4a; // ds-allow-hex
export const FAN=0xff7a59; // ds-allow-hex
export const SERVO_BLUE=0x2f7fe3; // ds-allow-hex
export const SERVO_HORN=0xf7f7f2; // ds-allow-hex
export const DIODE_BODY=0x30323a; // ds-allow-hex
export const DUPONT=0x2d3038; // ds-allow-hex
export const FLOOR_SKY=0xffffff; // ds-allow-hex
export const FLOOR_GROUND=0xe6d9bd; // ds-allow-hex
export const WHITE=0xffffff; // ds-allow-hex
export const RED_ALERT=0xff3b30; // ds-allow-hex
export const WATERMARK='#18213d'; // ds-allow-hex
export const GRID_LINE=0x18213d; // ds-allow-hex

export const LED_COLOR:Record<LedColor,number>={
 red:0xff3b3b, // ds-allow-hex
 yellow:0xffd02e, // ds-allow-hex
 green:0x35d86b, // ds-allow-hex
 blue:0x3b82ff, // ds-allow-hex
 white:0xfff4e0, // ds-allow-hex
};
export const LED_DIM:Record<LedColor,number>={
 red:0x6e2226, // ds-allow-hex
 yellow:0x7a6320, // ds-allow-hex
 green:0x1f5a35, // ds-allow-hex
 blue:0x20407a, // ds-allow-hex
 white:0x8b867c, // ds-allow-hex
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
