const CAPTIONS = [
  'Ready for a calm, focused reset.',
  'Let’s begin your daily vision routine.',
  'Smooth eyes, steady focus, relaxed breath.',
  'Now we move gently through a fresh tracking flow.',
  'Small movements, big clarity. Let’s begin.',
  'Stay relaxed, stay attentive, and keep your gaze soft.',
  'A brief reset for focus, balance, and clarity.',
  'We begin with smooth motion and a steady gaze.',
];

export const getRandomIntroCaption = () => CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)];

export const isLegacyIntroCaption = (caption: string) => !CAPTIONS.includes(caption);
