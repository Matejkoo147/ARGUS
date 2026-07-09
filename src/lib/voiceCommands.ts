/** User-facing voice command catalog — shown in Voice tab dropdown. */
export interface VoiceCommandHelp {
  phrase: string;
  description: string;
  category: "status" | "security" | "cameras" | "sensors" | "lights" | "ai";
  example?: string;
}

export const ARGUS_VOICE_COMMANDS: VoiceCommandHelp[] = [
  { category: "status", phrase: "status", description: "Full perimeter report — alarm, motion, doors, cameras, health", example: "ARGUS, status" },
  { category: "status", phrase: "what's happening", description: "Same as status", example: "ARGUS, what's happening" },
  { category: "security", phrase: "arm away", description: "Arm full perimeter (nobody home)", example: "ARGUS, arm away" },
  { category: "security", phrase: "arm home", description: "Arm stay-home mode", example: "ARGUS, arm home" },
  { category: "security", phrase: "disarm", description: "Turn off all alarm zones", example: "ARGUS, disarm" },
  { category: "sensors", phrase: "any motion?", description: "List active motion & occupancy sensors", example: "ARGUS, any motion?" },
  { category: "sensors", phrase: "doors open?", description: "Report open doors and windows", example: "ARGUS, are any doors open?" },
  { category: "sensors", phrase: "weather", description: "Outdoor / indoor temperature and humidity", example: "ARGUS, what's the weather?" },
  { category: "sensors", phrase: "air quality / CO₂", description: "Carbon dioxide and environment sensors", example: "ARGUS, what's the CO2 level?" },
  { category: "cameras", phrase: "where is the camera?", description: "Room and IP for each camera", example: "ARGUS, where is the kitchen camera?" },
  { category: "cameras", phrase: "list cameras", description: "Names and locations of all cameras", example: "ARGUS, list cameras" },
  { category: "lights", phrase: "turn on / off …", description: "Toggle a light or switch by name", example: "ARGUS, turn on living room light" },
  { category: "lights", phrase: "lock / unlock …", description: "Control a lock by name", example: "ARGUS, lock front door" },
  { category: "ai", phrase: "open questions", description: "Anything else → Ollama AI (configure in Settings)", example: "ARGUS, explain my sensor layout" },
];

export const VOICE_COMMAND_CATEGORIES: Record<VoiceCommandHelp["category"], string> = {
  status: "Status",
  security: "Security",
  sensors: "Sensors & environment",
  cameras: "Cameras",
  lights: "Lights & locks",
  ai: "AI (Ollama)",
};
