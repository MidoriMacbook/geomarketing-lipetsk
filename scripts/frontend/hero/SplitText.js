// Adapted from React Bits SplitText, revision recorded in upstream/PROVENANCE.json.
// External-target effect controller: the server-rendered h1 remains the only text.
import { useRef } from 'react';
import { gsap } from 'gsap';
import { SplitText as GSAPSplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(GSAPSplitText, useGSAP);

export function SplitText({ enabled }) {
  const played = useRef(false);
  useGSAP(() => {
    const el = document.getElementById('page-title');
    if (!enabled || played.current || !el) return;
    played.current = true;
    let active = true, split = null, intro = null, fontTimer = 0;
    const finish = () => {
      intro?.kill();
      intro = null;
      split?.revert();
      split = null;
    };
    const start = () => {
      clearTimeout(fontTimer);
      if (!active || (document.fonts && document.fonts.status !== 'loaded')) return;
      const box = el.getBoundingClientRect();
      if (box.bottom <= 0 || box.top >= innerHeight) return;
      try {
        // Upstream GSAPSplitText/onSplit + timeline/stagger algorithm; only words.
        split = new GSAPSplitText(el, {
          type: 'words', smartWrap: true, reduceWhiteSpace: false,
          wordsClass: 'hero-word', aria: 'none',
        });
        const next = el.getBoundingClientRect();
        // Never trade the existing natural wrapping for an entrance effect.
        if (Math.abs(box.height-next.height)>.5 || Math.abs(box.width-next.width)>.5) { finish(); return; }
        el.dataset.heroSplitStarted = 'true';
        intro = gsap.timeline({ onComplete: finish });
        intro.fromTo(split.words, {opacity: 0.2, y: 16, willChange: 'transform, opacity'}, {
          opacity: 1, y: 0, duration: .62, ease: 'power3.out',
          stagger: gsap.utils.distribute({each: .055, from: 'start'}),
        });
      } catch { finish(); }
    };
    // Upstream font readiness gate; timeout skips animation, never hides text.
    if (!document.fonts || document.fonts.status === 'loaded') start();
    else Promise.race([document.fonts.ready, new Promise(resolve=>{fontTimer=setTimeout(resolve,600);})]).then(start);
    return () => { active = false; clearTimeout(fontTimer); finish(); };
  }, {dependencies:[enabled],revertOnUpdate:true});
  return null;
}
