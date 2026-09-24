// Tiny synthesized Halloween sound effects, no audio files needed.

let ctx = null;

function audio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return null;
  }
  if (!ctx) {
    ctx = new AudioContext();
  }
  // browsers start the context suspended until the page was interacted with
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  return ctx;
}

function tone(ac, { type, from, to, start, duration, volume }) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + duration * 0.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/**
 * A ghostly "wooOOoo" followed by a sparkly candy chime.
 */
export function playClaimSound() {
  try {
    const ac = audio();
    if (!ac) {
      return;
    }
    const t = ac.currentTime;
    // the ghost, with a slow wobble
    const ghost = ac.createOscillator();
    const wobble = ac.createOscillator();
    const wobbleDepth = ac.createGain();
    const gain = ac.createGain();
    ghost.type = "sine";
    ghost.frequency.setValueAtTime(330, t);
    ghost.frequency.linearRampToValueAtTime(520, t + 0.5);
    ghost.frequency.linearRampToValueAtTime(300, t + 1.1);
    wobble.frequency.value = 6;
    wobbleDepth.gain.value = 18;
    wobble.connect(wobbleDepth).connect(ghost.frequency);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    ghost.connect(gain).connect(ac.destination);
    ghost.start(t);
    wobble.start(t);
    ghost.stop(t + 1.25);
    wobble.stop(t + 1.25);
    // the candy chime
    [1046, 1318, 1568, 2093].forEach((f, i) =>
      tone(ac, {
        type: "triangle",
        from: f,
        to: f * 1.01,
        start: t + 1.0 + i * 0.09,
        duration: 0.35,
        volume: 0.12,
      })
    );
  } catch (e) {
    console.log("could not play sound", e);
  }
}
