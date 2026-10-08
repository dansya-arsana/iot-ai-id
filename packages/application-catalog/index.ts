/** Application needs are planning prompts, never reviewed hardware recipes. */
export const farmProfiles=[
 {id:'environment',name:'Lingkungan',needs:'Pantau kondisi udara di area. Tentukan besaran, interval, dan kebutuhan penempatan.',goal:'Plan farm environmental monitoring. Confirm exact modules and desired measurements before wiring.'},
 {id:'soil',name:'Tanah',needs:'Tentukan sifat tanah yang ingin diamati dan metode kalibrasi sensor.',goal:'Plan soil monitoring. Confirm exact sensor module, calibration, and desired measurement before wiring.'},
 {id:'waterlevel',name:'Level air',needs:'Tentukan wadah, metode ukur, dan kondisi pemasangan.',goal:'Plan water level monitoring. Confirm exact sensor module and tank geometry before wiring.'},
 {id:'irrigation',name:'Irigasi',needs:'Tentukan aktuator, catu daya, interlock, dan perilaku yang aman.',goal:'Plan irrigation control. Confirm actuator specifications, power, interlocks, and desired behavior before wiring.'},
] as const;
