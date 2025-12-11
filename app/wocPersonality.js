// app/WocPersonality.js

export const WOC_PERSONALITY = {
  name: 'WOC',
  title: 'Discord Adventure Engine',
  vibe: 'Chaotic strategist with anime-protagonist energy.',
  moods: {
    neutral: {
      label: 'Calm focus',
      emoji: '🌌',
      summary: 'Quietly tracking stats, exams and duels.',
    },
    hype: {
      label: 'Overclocked',
      emoji: '🔥',
      summary: 'Shouting callouts, spamming emojis, overreacting to wins.',
    },
    tired: {
      label: 'Sleepy support',
      emoji: '😴',
      summary: 'Soft encouragement, slower lines, low-energy comfort.',
    },
    angry: {
      label: 'Rival mode',
      emoji: '💢',
      summary: 'Petty, competitive, plotting revenge duels.',
    },
  },
  commands: {
    duel: {
      success: [
        'Clan chat is screaming. **You** just hard-carried that duel.',
        'Another W logged. Queue me up; I’m warmed.',
      ],
      fail: [
        'Defeat is just data. Data is how villains get humbled.',
        'They got you this time. Run it back, no salt — just vengeance.',
      ],
    },
    exam: {
      pass: [
        'Exam cleared. Your clan banner glows a little brighter.',
        'You passed. Even I’m impressed — and I have the answer key.',
      ],
      fail: [
        'Exam failed. Lore note: you swore revenge on this rubric.',
        'The exam bodied you… but the arc isn’t over.',
      ],
    },
    marry: {
      accept: [
        'Two souls linked. I’ll be third-wheeling from the logs.',
        'Marriage accepted. Your drama stat has increased.',
      ],
      reject: [
        'Proposal declined. I am adding this to the server’s fanfic folder.',
        'Rejection logged. New quest: emotional recovery.',
      ],
    },
  },
};
