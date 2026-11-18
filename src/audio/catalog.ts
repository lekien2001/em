import type { RecordingId, SoundId, SynthSoundId } from "../types";

export type Recording = {
  url: string;
  start: number;
  end: number;
  overlap: number;
  gain: number;
};

const storage = "https://raw.githubusercontent.com/lekien2001/storage/14888842e25dc27a61494dab79b44b99b5c553d8/";
const recordings: Record<RecordingId, Recording> = {
  "rain-window": { url: `${storage}gingerleegalaxy_1-rainy-window-sleep-sounds-12-asmr-247407.mp3`, start: .25, end: 119.4, overlap: 1.5, gain: 1 },
  "mouth-asmr": { url: `${storage}wet-mouth-sounds-asmr-2-by-babydolldaydreams-royalty-free-music-614592.mp3`, start: 0, end: 52.5, overlap: .45, gain: 1.4 },
  "lego-asmr": { url: `${storage}wingsoarstudio-looking-through-lego-box-fast-2-sound-effect-620454.mp3`, start: .7, end: 19.55, overlap: .16, gain: .7 },
};

export function isRecording(id: SoundId): id is RecordingId {
  return Object.hasOwn(recordings, id);
}

export function getRecording(id: RecordingId): Recording {
  return recordings[id];
}
export type Sound = {
  id: SoundId;
  name: string;
  description: string;
  label: string;
  art: SynthSoundId;
};
export const sounds: Sound[] = [
  {
    id: "rain",
    name: "Mưa đêm dịu êm",
    description: "Từng hạt mưa, từng điều nhẹ đi.",
    label: "Mưa nhẹ",
    art: "rain",
  },
  {
    id: "stream",
    name: "Bên dòng suối nhỏ",
    description: "Để những nghĩ suy trôi theo dòng nước.",
    label: "Tiếng suối",
    art: "stream",
  },
  {
    id: "brown",
    name: "Một khoảng bình yên",
    description: "Âm trầm ấm, ôm lấy sự tĩnh lặng.",
    label: "Brown noise",
    art: "brown",
  },
  { id: "rain-window", label: "Mưa bên cửa sổ", name: "Mưa bên cửa sổ", description: "Tiếng mưa rơi ngoài cửa sổ.", art: "rain" },
  { id: "mouth-asmr", label: "Âm miệng ASMR", name: "Âm miệng ASMR", description: "Những âm miệng ASMR nhẹ.", art: "brown" },
  { id: "lego-asmr", label: "Lục hộp LEGO", name: "Lục hộp LEGO", description: "Tiếng các mảnh LEGO lách cách.", art: "stream" },
];
