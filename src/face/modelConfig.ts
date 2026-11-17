/** Measured from sheep-natural.glb (6d221f40…). Coordinates are in its bind pose.
 * Central calibration for a future replacement model; never assume mesh names. */
export const FACE_MODEL = {
  head: "Head",
  wool: "Felt wool — source fiber texture",
  features: ["Soft pink cheeks and inner ears", "Warm brown smile and hoof"],
  center: [0, 1.47, .81] as const,
  radii: [.47, .51, .43] as const,
  photoRadii: [.36, .48] as const,
  offset: .012,
  segments: 64,
  rings: 16,
  rimCount: 26,
  rimRadius: .061
} as const;
