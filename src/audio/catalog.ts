import type { SoundId } from "../types";
export type Sound = {
  id: SoundId;
  name: string;
  description: string;
  label: string;
  art: SoundId;
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
];
