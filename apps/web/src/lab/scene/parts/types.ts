/**
 * Part registry contract (lab v3). One PartModule per PartKind in parts/<kind>.ts, collected by parts/index.ts.
 * Everything the scene, the HUD, the CircuitSpec validator and the AI builder need to know about a part lives here:
 * how to build it, where its pins are, how it reacts to state, what it is called, how it is placed and how the user may touch it.
 * Units: millimetres, x right, y up, z toward the viewer. Pin anchors are in the part's local space (origin = first leg at the board surface).
 */
import type {Group} from 'three';
import type {PartKind,PartProps,PartState} from '../../contract';

export interface Copy{en:string;id:string}

/** Electrical role of a pin, used by the CircuitSpec validator and by wire hover hints. */
export type PinType='passive'|'anode'|'cathode'|'power'|'ground'|'input'|'output'|'analog-out'|'base'|'collector'|'emitter';
export interface PinDef{
 /** Local 3D anchor where a wire or a breadboard hole meets the pin. */
 at:readonly [number,number,number];
 type:PinType;
 /** Short human label shown on hover. */
 label?:Copy;
}

/** Context passed to build(). Extend, never break. */
export interface PartCtx{reducedMotion:boolean}

/** Footprint on the breadboard (or on the desk for off-board props). */
export interface Footprint{
 /** true: legs go into breadboard holes. false: free-standing prop on the desk. */
 onBoard:boolean;
 /** Hole-column offsets of each pin from the first hole, in pin order. Empty when off-board. */
 holes:readonly number[];
 /** Number of breadboard columns the legs span. 0 when off-board. */
 widthHoles:number;
 /** Body X extent in mm relative to the first pin, when it differs from the leg span (clearance check). */
 bodyX?:readonly [number,number];
 /** Desk footprint in mm for off-board props (width x, depth z). */
 deskMm?:readonly [number,number];
}

/** A hover label pinned to a point of the part, bilingual. */
export interface Callout{id:string;at:readonly [number,number,number];text:Copy}

// ---------- interaction ----------
/** How a direct drag or click on the 3D part changes it. The scene's picking layer maps handles to PartInput events. */
export type DragHandle=
 |'press'       // pointer down = pressed, up = released
 |'rotate'      // drag around the part's vertical axis (knob)
 |'slide-x'     // drag along the desk x axis
 |'slide-z'     // drag along the desk z axis
 |'toggle-slide'// click toggles on/off, drag slides along x (lamp)
 |'drag-xz';    // free drag on the desk plane

export interface DragSpec{
 handle:DragHandle;
 /** PartProps / PartInput key the drag edits, e.g. 'distanceCm'. */
 prop?:string;
 range?:readonly [number,number];
 /** CSS cursor on hover and while dragging. Defaults: grab / grabbing, or pointer for 'press'. */
 cursor?:{hover:string;active:string};
}

/** A control rendered by the generic part popover. `key` is the PartProps key it edits. */
export type ControlSpec=
 |{type:'choice';key:string;label:Copy;options:readonly {value:string;label:Copy}[]}
 |{type:'range';key:string;label:Copy;min:number;max:number;step:number;unit?:string}
 |{type:'toggle';key:string;label:Copy}
 /** A button that does not edit props. 'focus' = "Zoom to it" (scene.focusPart). */
 |{type:'action';action:'focus';label:Copy};

export interface InteractSpec{
 drag?:DragSpec;
 /** Popover opened by clicking the part. Rendered generically by the HUD from this schema. */
 controls?:readonly ControlSpec[];
}

// ---------- the module ----------
export interface PartModule{
 readonly kind:PartKind;
 readonly name:Copy;
 /** Pins in physical order (matches PART_PINS[kind]). Off-board props without pins use {}. */
 readonly pins:Readonly<Record<string,PinDef>>;
 readonly footprint:Footprint;
 readonly callouts:readonly Callout[];
 readonly interact?:InteractSpec;
 /** Build the 3D part for these props. The group is owned by the caller and disposed with disposeObject. */
 build(props:PartProps,ctx:PartCtx):Group;
 /** Push simulator state into the group: LED glow, knob angle, spinning blades. dtMs may be 0 (initial pose). */
 apply(group:Group,state:PartState,dtMs:number):void;
}

export interface PartRegistry{
 get(kind:string):PartModule|undefined;
 has(kind:string):boolean;
 kinds():readonly PartKind[];
}
