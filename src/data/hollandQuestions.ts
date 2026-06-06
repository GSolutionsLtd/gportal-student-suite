// 30-item Holland Code (RIASEC) assessment — 5 statements per type.
export type HollandType = "R" | "I" | "A" | "S" | "E" | "C";

export const HOLLAND_LABELS: Record<HollandType, string> = {
  R: "Realistic",
  I: "Investigative",
  A: "Artistic",
  S: "Social",
  E: "Enterprising",
  C: "Conventional",
};

export const HOLLAND_QUESTIONS: { id: number; type: HollandType; text: string }[] = [
  { id: 1,  type: "R", text: "I enjoy working with tools, machines or technical equipment." },
  { id: 2,  type: "R", text: "I like fixing or building things with my hands." },
  { id: 3,  type: "R", text: "I prefer outdoor or practical work over desk work." },
  { id: 4,  type: "R", text: "I'm comfortable using technology and physical equipment." },
  { id: 5,  type: "R", text: "I enjoy sports, farming or hands-on craftsmanship." },

  { id: 6,  type: "I", text: "I like solving puzzles and figuring out how things work." },
  { id: 7,  type: "I", text: "I enjoy science, mathematics and analytical thinking." },
  { id: 8,  type: "I", text: "I'm curious and love to research and investigate." },
  { id: 9,  type: "I", text: "I enjoy reading and learning new theories." },
  { id: 10, type: "I", text: "I prefer studying problems independently to find answers." },

  { id: 11, type: "A", text: "I enjoy drawing, painting, writing, music or design." },
  { id: 12, type: "A", text: "I like expressing myself creatively." },
  { id: 13, type: "A", text: "I prefer flexible, open-ended tasks over rigid rules." },
  { id: 14, type: "A", text: "I'm imaginative and original in my ideas." },
  { id: 15, type: "A", text: "I enjoy performing or producing artistic work." },

  { id: 16, type: "S", text: "I enjoy helping, teaching or counselling others." },
  { id: 17, type: "S", text: "I'm a good listener and like supporting people." },
  { id: 18, type: "S", text: "I enjoy working in teams or community service." },
  { id: 19, type: "S", text: "I care about people's wellbeing and growth." },
  { id: 20, type: "S", text: "I'd enjoy working in healthcare, education or social work." },

  { id: 21, type: "E", text: "I enjoy persuading and influencing others." },
  { id: 22, type: "E", text: "I'd like to lead a team or start my own business." },
  { id: 23, type: "E", text: "I'm comfortable selling ideas, products or services." },
  { id: 24, type: "E", text: "I take initiative and enjoy competition." },
  { id: 25, type: "E", text: "I like setting goals and driving people to achieve them." },

  { id: 26, type: "C", text: "I like organised, structured and detail-oriented work." },
  { id: 27, type: "C", text: "I enjoy working with numbers, records or spreadsheets." },
  { id: 28, type: "C", text: "I follow rules and procedures carefully." },
  { id: 29, type: "C", text: "I prefer clear instructions and predictable routines." },
  { id: 30, type: "C", text: "I'm dependable and well-organised with paperwork." },
];
