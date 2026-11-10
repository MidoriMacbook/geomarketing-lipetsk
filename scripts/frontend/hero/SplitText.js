// Adapted from React Bits SplitText, revision recorded in upstream/PROVENANCE.json.
// Эффект управляет существующим элементом: серверный h1 остаётся единственным текстом.
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
    let active = true, split = null, intro = null;
    const finish = () => {
      intro?.kill();
      intro = null;
      split?.revert();
      split = null;
    };
    const start = () => {
      if (!active || (document.fonts && document.fonts.status !== 'loaded')) return;
      const box = el.getBoundingClientRect();
      if (box.bottom <= 0 || box.top >= innerHeight) return;
      // На телефоне используем готовые две строки: позднее дробление/слияние
      // большого заголовка создаёт новый LCP после загрузки React-острова.
      if(matchMedia('(max-width:600px)').matches){
        intro=gsap.fromTo(el.children,{y:12},{y:0,duration:.5,ease:'power3.out',clearProps:'transform'});
        return;
      }
      try {
        // Upstream GSAPSplitText/onSplit + timeline/stagger algorithm; only words.
        split = new GSAPSplitText(el, {
          type: 'words', smartWrap: true, reduceWhiteSpace: false,
          wordsClass: 'hero-word', aria: 'none',
        });
        const next = el.getBoundingClientRect();
        // Эффект появления не должен нарушать естественный перенос строк.
        if (Math.abs(box.height-next.height)>.5 || Math.abs(box.width-next.width)>.5) { finish(); return; }
        el.dataset.heroSplitStarted = 'true';
        intro = gsap.timeline({ onComplete: finish });
        intro.fromTo(split.words, {opacity: .65, y: 16, willChange: 'transform, opacity'}, {
          opacity: 1, y: 0, duration: .5, ease: 'power3.out',
          stagger: gsap.utils.distribute({each: .085, from: 'start'}),
        });
      } catch { finish(); }
    };
    // Ждём шрифты, сохраняя видимость серверного заголовка и возможность анимации
    // при медленном соединении. Проверка видимости предотвращает запоздалый повтор.
    if (!document.fonts || document.fonts.status === 'loaded') start();
    else document.fonts.ready.then(start);
    return () => { active = false; finish(); };
  }, {dependencies:[enabled],revertOnUpdate:true});
  return null;
}
