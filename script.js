const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const envelope = document.getElementById('envelope');
const singButton = document.getElementById('sing');
const caption = document.getElementById('song-line');
const endingButton = document.getElementById('open-ending');
let songCompleted = false;
let letterClicks = 0;
const letterHint = document.getElementById('letter-hint');
const letterProgress = document.getElementById('letter-progress');
function resetLetter() {
  letterClicks = 0;
  envelope.disabled = false;
  envelope.classList.remove('open', 'seal-loose', 'seal-broken');
  envelope.querySelector('.address').textContent = 'Click me';
  envelope.setAttribute('aria-label', 'Click to loosen the seal, step 1 of 3');
  letterHint.textContent = 'A little surprise inside. Click the letter 3 times.';
  letterProgress.setAttribute('aria-valuenow', '0');
  [...letterProgress.children].forEach(dot => dot.classList.remove('complete'));
}
let context, master, playing = false, sources = [], timers = [];
let confettiTimer;
function clearConfetti() {
  clearTimeout(confettiTimer);
  document.getElementById('confetti')?.remove();
}
function celebrate() {
  clearConfetti();
  const layer = document.createElement('div');
  layer.id = 'confetti';
  layer.setAttribute('aria-hidden', 'true');
  const colors = ['#e8c46e', '#c96c62', '#a9b985', '#dfd4b5', '#88b7b0'];
  for (let i = 0; i < (reducedMotion ? 24 : 100); i++) {
    const piece = document.createElement('i');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[i % colors.length];
    piece.style.setProperty('--drift', `${(Math.random() - .5) * 240}px`);
    piece.style.setProperty('--spin', `${(Math.random() - .5) * 1440}deg`);
    piece.style.animationDelay = `${Math.random() * .8}s`;
    piece.style.animationDuration = `${3 + Math.random() * 2}s`;
    if (reducedMotion) piece.style.top = `${8 + Math.random() * 72}%`;
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  confettiTimer = setTimeout(clearConfetti, 6000);
}
function screen(id) {
  stopSong();
  document.getElementById('invitation').hidden = id !== 'invitation';
  document.getElementById('world').hidden = id !== 'world';
  document.getElementById('ending').hidden = id !== 'ending';
  endingButton.hidden = !songCompleted;
  window.scrollTo(0, 0);
  if (id === 'ending') { document.querySelector('.ending-note').focus({preventScroll:true}); }
  else if (id === 'world') { singButton.focus({preventScroll:true}); }
  else { resetLetter(); envelope.focus({preventScroll:true}); }
}
envelope.addEventListener('click', () => {
  if (envelope.disabled) return;
  letterClicks++;
  letterProgress.setAttribute('aria-valuenow', String(letterClicks));
  [...letterProgress.children].forEach((dot, index) => dot.classList.toggle('complete', index < letterClicks));
  if (letterClicks === 1) {
    envelope.classList.add('seal-loose');
    envelope.querySelector('.address').textContent = 'Again…';
    envelope.setAttribute('aria-label', 'Click to break the seal, step 2 of 3');
    letterHint.textContent = 'The seal is loosening… 2 clicks to go.';
    return;
  }
  if (letterClicks === 2) {
    envelope.classList.add('seal-broken');
    envelope.querySelector('.address').textContent = 'One more!';
    envelope.setAttribute('aria-label', 'Click to open the letter, step 3 of 3');
    letterHint.textContent = 'The seal is broken! One more click to open.';
    return;
  }
  letterHint.textContent = 'Opening your surprise…';
  envelope.disabled = true;
  envelope.classList.add('open');
  setTimeout(() => screen('world'), reducedMotion ? 0 : 650);
});
document.getElementById('replay').addEventListener('click', () => screen('invitation'));
endingButton.addEventListener('click', () => screen('ending'));
document.getElementById('ending-back').addEventListener('click', () => screen('world'));
function stopSong() {
  clearConfetti();
  timers.forEach(clearTimeout); timers = [];
  sources.forEach(source => { try { source.stop(); } catch (_) {} }); sources = [];
  if (master && context) {
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(0, context.currentTime, .02);
  }
  playing = false;
  document.body.classList.remove('singing');
  singButton.textContent = 'SING HAPPY BIRTHDAY \u266b';
  singButton.setAttribute('aria-pressed', 'false');
  caption.textContent = 'A birthday song for Mandy.';
}
// Voice research and limitations are documented in AUDIO-NOTES.md.
// All audio is synthesized locally; no game recordings or network requests.
const voiceProfiles = [
  {name:'Abigail', harmonics:[0,1,.22,.08,.02], volume:.045, attack:.09, sustain:.6, cutoff:1800, vibrato:4.1, depth:32, octave:1, pan:.23},
  {name:'Wilson', harmonics:[0,.32,1,.88,.61,.44,.31,.18,.12], volume:.095, attack:.025, sustain:.75, cutoff:3200, vibrato:5.2, depth:9, octave:1, pan:-.48},
  {name:'Willow', harmonics:[0,1,.045,.13,.02,.025], volume:.11, attack:.045, sustain:.85, cutoff:4200, vibrato:5.6, depth:7, octave:1, pan:-.3},
  {name:'WX-78', harmonics:[0,1,.2,.5,.1,.25,.08,.12], volume:.055, attack:.009, sustain:.7, cutoff:2300, vibrato:15, depth:12, octave:.5, pan:.46},
  {name:'Wolfgang', harmonics:[0,1,.62,.32,.16,.08,.04], volume:.14, attack:.06, sustain:.82, cutoff:1050, vibrato:4.6, depth:8, octave:.25, pan:-.16},
  {name:'Webber', harmonics:[0,1,.75,.12,.48,.2,.32,.12], volume:.045, attack:.012, sustain:.6, cutoff:3300, vibrato:23, depth:17, octave:.5, pan:.65}
];
let breathNoise;
function note(frequency, start, duration, voice, destination, level = 1) {
  const profile = voiceProfiles[voice];
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const vibrato = context.createOscillator();
  const vibratoDepth = context.createGain();
  const modulators = [];
  const real = new Float32Array(profile.harmonics.length);
  oscillator.setPeriodicWave(context.createPeriodicWave(real, new Float32Array(profile.harmonics)));
  // A short scoop and a gentle fall recreate the shaped attacks of character speech.
  oscillator.frequency.setValueAtTime(frequency * (voice === 0 ? .9 : .98), start);
  oscillator.frequency.exponentialRampToValueAtTime(frequency, start + duration * .16);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * .99, start + duration);
  oscillator.detune.value = (voice - 2.5) * 2;
  vibrato.frequency.value = profile.vibrato;
  vibratoDepth.gain.setValueAtTime(0, start);
  vibratoDepth.gain.linearRampToValueAtTime(profile.depth, start + duration * .4);
  vibrato.connect(vibratoDepth);
  vibratoDepth.connect(oscillator.detune);
  filter.type = 'lowpass';
  filter.Q.value = voice === 3 ? 4 : voice === 5 ? 2.8 : .7;
  filter.frequency.setValueAtTime(profile.cutoff * .55, start);
  filter.frequency.linearRampToValueAtTime(profile.cutoff, start + duration * .2);
  filter.frequency.exponentialRampToValueAtTime(profile.cutoff * .55, start + duration);
  const volume = profile.volume * level;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + Math.min(profile.attack, duration * .25));
  gain.gain.exponentialRampToValueAtTime(volume * profile.sustain, start + duration * .7);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(filter);

  if (voice === 1) {
    // A narrow, nasal resonance approximates a Harmon/cup-muted trumpet.
    const mute = context.createBiquadFilter();
    mute.type = 'peaking'; mute.frequency.value = 1450;
    mute.Q.value = 2.3; mute.gain.value = 11;
    filter.connect(mute); mute.connect(gain);
  } else if (voice === 0) {
    // Ghostly vowel formant, rather than the previous invented bell voice.
    const formant = context.createBiquadFilter();
    formant.type = 'bandpass'; formant.Q.value = 1.8;
    formant.frequency.setValueAtTime(700, start);
    formant.frequency.linearRampToValueAtTime(1100, start + duration * .5);
    formant.frequency.linearRampToValueAtTime(650, start + duration);
    filter.connect(formant); formant.connect(gain);
  } else {
    filter.connect(gain);
  }
  if (voice === 3 || voice === 5) {
    // Distinct processed synths: metallic FM for WX, wobbling stepped FM for Webber.
    const fm = context.createOscillator(), fmDepth = context.createGain();
    fm.type = voice === 3 ? 'square' : 'sawtooth';
    fm.frequency.setValueAtTime(frequency * (voice === 3 ? 2 : 1.49), start);
    fmDepth.gain.setValueAtTime(frequency * (voice === 3 ? .7 : 1.15), start);
    fmDepth.gain.exponentialRampToValueAtTime(frequency * .12, start + duration);
    fm.connect(fmDepth); fmDepth.connect(oscillator.frequency);
    modulators.push(fm);
    if (voice === 5) {
      // A brief crooked pitch descent, while preserving the recognizable melody.
      oscillator.detune.setValueAtTime(65, start);
      oscillator.detune.setValueAtTime(-40, start + duration * .18);
      oscillator.detune.setValueAtTime(18, start + duration * .35);
      oscillator.detune.setValueAtTime(0, start + duration * .5);
    }
  }
  if (voice === 2 || voice === 0) {
    // Filtered air gives the flute a breathy edge and Abigail a soft spectral texture.
    if (!breathNoise) {
      breathNoise = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const samples = breathNoise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const air = context.createBufferSource(), airFilter = context.createBiquadFilter();
    const airGain = context.createGain();
    air.buffer = breathNoise; air.loop = true;
    airFilter.type = 'bandpass'; airFilter.frequency.value = voice === 2 ? 3000 : 1100;
    airFilter.Q.value = voice === 2 ? .8 : 2;
    airGain.gain.value = voice === 2 ? .1 : .13;
    air.connect(airFilter); airFilter.connect(airGain); airGain.connect(gain);
    modulators.push(air);
  }
  if (context.createStereoPanner) {
    const pan = context.createStereoPanner(); pan.pan.value = profile.pan;
    gain.connect(pan); pan.connect(destination);
  } else { gain.connect(destination); }
  [oscillator, vibrato, ...modulators].forEach(source => {
    source.start(start); source.stop(start + duration + .03); sources.push(source);
  });
}
singButton.addEventListener('click', async () => {
  if (playing) { stopSong(); return; }
  const AudioClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioClass) { caption.textContent = 'This browser does not support audio. Try Chrome, Edge, or Firefox.'; return; }
  try {
    if (!context) context = new AudioClass();
    await context.resume();
  } catch (_) {
    caption.textContent = 'Audio could not start. Click Sing to try again.';
    return;
  }
  // An async resume can overlap another click.
  if (playing || document.getElementById('world').hidden) return;
  playing = true;
  singButton.textContent = 'STOP SINGING';
  singButton.setAttribute('aria-pressed', 'true');
  document.body.classList.add('singing');
  master = context.createGain(); master.gain.value = .5;
  const compressor = context.createDynamicsCompressor();
  master.connect(compressor); compressor.connect(context.destination);
  // Happy Birthday, 3/4, C major. Short pickup notes keep the familiar phrasing.
  const melody = [
    [67,.5],[67,.5],[69,1],[67,1],[72,1],[71,2],
    [67,.5],[67,.5],[69,1],[67,1],[74,1],[72,2],
    [67,.5],[67,.5],[79,1],[76,1],[72,1],[71,1],[69,1],
    [77,.5],[77,.5],[76,1],[72,1],[74,1],[72,2.5]
  ];
  const beat = .43, start = context.currentTime + .12;
  let cursor = 0;
  const words = [
    ['Happy birthday to you!',0],
    ['Happy birthday to you!',6],
    ['Happy birthday, dear Mandy!',12],
    ['Happy birthday to you!',19]
  ];
  melody.forEach(([midi, length], index) => {
    const at = start + cursor * beat;
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    [0,1,2,3,4,5].forEach(voice => {
      const octave = voiceProfiles[voice].octave;
      // Small gaps between syllables give the melody the game's chattering voice feel.
      const syllables = voice === 0 ? 1 : length >= 1.5 ? 2 : 1;
      const syllableDuration = length * beat / syllables;
      for (let syllable = 0; syllable < syllables; syllable++) {
        note(frequency * octave, at + voice * .012 + syllable * syllableDuration,
          syllableDuration * .8, voice, master);
      }
    });
    const lyric = words.find(([, position]) => position === index);
    if (lyric) timers.push(setTimeout(() => { caption.textContent = lyric[0]; }, (at - context.currentTime) * 1000));
    cursor += length;
  });
  // Gentle alternating root/fifth accompaniment for the little caroling ensemble.
  for (let i = 0; i < cursor; i++) {
    const root = i < 5 ? 48 : i < 11 ? 55 : i < 18 ? 48 : i < 23 ? 53 : 48;
    note(440 * 2 ** (((i % 3 === 0 ? root : root + 7) - 69) / 12), start + i * beat, beat * .7, 4, master, .4);
  }
  timers.push(setTimeout(() => {
    stopSong(); caption.textContent = 'Happy birthday, Mandy! Make a wish.';
    songCompleted = true;
    endingButton.hidden = false;
    celebrate();
  }, (cursor * beat + .4) * 1000));
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopSong(); });
