import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Sound } from "../audio/catalog";
import type { RelaxationSession } from "../session/useRelaxationSession";
import type { SheepSpeed } from "../types";
import type { useImmersiveControls } from "./useImmersiveControls";
export type Panel = "library" | "volume" | "timer" | "options" | "about" | null;
/** Shared UI data; each component receives only its required fields via Pick. */
export type ControlsProps = {
  session: RelaxationSession;
  count: number;
  showCount: boolean;
  hasStarted: boolean;
  sceneReady: boolean;
  speed: SheepSpeed;
  reduced: boolean;
  panel: Panel;
  timerLabel: string;
  currentSound: Sound;
  immersion: ReturnType<typeof useImmersiveControls>;
  immersiveProps: {
    "data-immersive-ui": boolean;
    inert: boolean;
  };
  sceneOptions: ReactNode;
  setReset: Dispatch<SetStateAction<number>>;
  setShowCount: Dispatch<SetStateAction<boolean>>;
  setSpeed: Dispatch<SetStateAction<SheepSpeed>>;
  setReduced: Dispatch<SetStateAction<boolean>>;
  setSleep: Dispatch<SetStateAction<boolean>>;
  setPanel: Dispatch<SetStateAction<Panel>>;
  closePanel(): void;
  toggleSession(): void;
};
