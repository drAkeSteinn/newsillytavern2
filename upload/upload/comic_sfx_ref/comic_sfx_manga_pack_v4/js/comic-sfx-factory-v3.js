/* comic-sfx-factory-v3.js
   No dependencies. It creates inline SVG comic/manga SFX with editable text.
   Place your KOMIKAHB.ttf in your project and load it globally, or rely on your platform's loaded font.
*/
(function(global){
  const XMLNS = 'http://www.w3.org/2000/svg';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const shapes = {
    vertical: [
      'M118 13 C105 30 96 58 90 88 C94 116 94 141 83 166 C94 193 104 224 121 252 C139 223 150 193 153 164 C143 139 144 115 158 88 C151 58 138 28 118 13 Z',
      'M116 15 C103 31 97 60 88 90 C96 114 91 143 82 165 C95 195 103 221 120 254 C137 226 151 195 154 164 C145 139 145 115 160 89 C151 56 136 29 116 15 Z',
      'M119 12 C107 28 98 57 91 87 C96 116 93 140 84 168 C93 192 105 225 122 251 C139 222 149 191 152 164 C144 140 145 114 157 86 C150 59 139 27 119 12 Z'
    ],
    oval: [
      'M119 24 C82 32 64 72 66 118 C68 161 88 210 120 227 C154 209 174 161 172 118 C170 72 154 31 119 24 Z',
      'M117 22 C84 33 62 74 66 119 C69 163 87 211 119 229 C156 208 176 160 171 116 C168 72 153 32 117 22 Z',
      'M121 25 C83 31 65 71 67 117 C69 162 91 211 121 226 C153 210 172 163 173 119 C171 73 155 30 121 25 Z'
    ],
    wail: [
      'M131 9 C121 38 111 61 95 78 C104 112 88 142 97 174 C84 205 94 242 123 308 C147 250 165 208 151 176 C167 139 151 112 160 78 C146 58 143 28 131 9 Z',
      'M130 7 C119 38 113 62 93 77 C106 111 87 142 96 176 C83 206 96 244 123 311 C149 251 164 207 153 175 C167 140 149 111 162 78 C144 57 141 29 130 7 Z',
      'M133 10 C123 39 112 60 96 79 C103 113 90 143 98 173 C86 204 93 241 124 307 C146 252 166 209 150 177 C164 139 152 113 158 76 C148 59 143 30 133 10 Z'
    ],
    tall: [
      'M117 17 C91 49 78 91 78 135 C79 179 93 229 122 275 C153 226 165 180 165 136 C164 91 145 45 117 17 Z',
      'M116 18 C90 48 77 93 79 135 C80 181 91 230 121 277 C154 226 166 179 164 134 C163 91 147 46 116 18 Z',
      'M119 16 C92 50 80 90 78 137 C80 178 94 231 124 274 C152 228 164 180 166 136 C163 92 145 43 119 16 Z'
    ]
  };
  const commonDefs = `
    <defs>
      <filter id="inkWobble" x="-12%" y="-12%" width="124%" height="124%"><feTurbulence type="fractalNoise" baseFrequency="0.018 0.072" numOctaves="1" seed="4" result="noise"><animate attributeName="seed" values="2;5;9;3;7;2" dur="0.22s" repeatCount="indefinite" /></feTurbulence><feDisplacementMap in="SourceGraphic" in2="noise" scale="0.9" /></filter>
      <filter id="textRattle" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.026 0.09" numOctaves="1" seed="6" result="noise"><animate attributeName="seed" values="1;3;8;4;1" dur="0.18s" repeatCount="indefinite" /></feTurbulence><feDisplacementMap in="SourceGraphic" in2="noise" scale="0.45" /></filter>
    </defs>`;
  const style = `
    <style><![CDATA[
      :root { --dur: 880ms; --font: KOMIKAHB, "Komika Hand", "Comic Sans MS", cursive; }
      svg{overflow:visible;background:transparent}.sfx-root{transform-box:fill-box;transform-origin:center;animation:sfx-pop var(--dur) cubic-bezier(.16,.96,.2,1) forwards;pointer-events:none}.ink{filter:url(#inkWobble)}.boil-a,.boil-b,.boil-c{fill:#fffef8;stroke:#0b0b0b;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}.boil-a{stroke-width:3.05;animation:boilA .18s steps(1,end) infinite}.boil-b{stroke-width:2.65;animation:boilB .18s steps(1,end) infinite;opacity:0}.boil-c{stroke-width:2.3;animation:boilC .18s steps(1,end) infinite;opacity:0}.side-mark{fill:none;stroke:#0b0b0b;stroke-width:1.35;stroke-linecap:round;stroke-linejoin:round;opacity:1;vector-effect:non-scaling-stroke;animation:mark-in calc(var(--dur)*.72) ease-out forwards}.mark-1{animation-delay:70ms}.mark-2{animation-delay:115ms}.dot{fill:#0b0b0b;opacity:1;animation:dot-pop calc(var(--dur)*.7) ease-out forwards}.heart{fill:none;stroke:#0b0b0b;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;opacity:1;animation:heart-pop calc(var(--dur)*.78) cubic-bezier(.13,1.06,.32,1) forwards;vector-effect:non-scaling-stroke}.arrow{fill:none;stroke:#0b0b0b;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;opacity:1;animation:arrow-drop calc(var(--dur)*.72) ease-out forwards;animation-delay:120ms}.sfx-text{font-family:var(--font);fill:#0b0b0b;font-weight:700;paint-order:stroke;stroke:#0b0b0b;stroke-width:.25;filter:url(#textRattle)}.ghost-text{font-family:var(--font);fill:#0b0b0b;opacity:.14}.text-pop{transform-box:fill-box;transform-origin:center;animation:text-pop var(--dur) cubic-bezier(.14,.88,.18,1) forwards}.stack-char{font-family:var(--font);fill:#0b0b0b;font-weight:700;text-anchor:middle;dominant-baseline:middle;paint-order:stroke;stroke:#0b0b0b;stroke-width:.2;filter:url(#textRattle)}
      @keyframes sfx-pop{0%{opacity:0;transform:translateY(8px) scale(.06,.1) rotate(-7deg)}10%{opacity:1;transform:translateY(-3px) scale(1.12,.88) rotate(3deg)}20%{transform:translateY(1px) scale(.94,1.08) rotate(-2deg)}31%{transform:translateY(0) scale(1) rotate(.6deg)}68%{opacity:1;transform:translateY(0) scale(1) rotate(.2deg)}82%{opacity:1;transform:translateY(-3px) scale(1.04,.98) rotate(-1deg)}100%{opacity:0;transform:translateY(-10px) scale(.94,1.08) rotate(2.5deg)}}
      @keyframes text-pop{0%{opacity:0;transform:scale(.2) rotate(-6deg)}13%{opacity:1;transform:scale(1.12) rotate(3deg)}26%{transform:scale(.97) rotate(-1.5deg)}42%,78%{opacity:1;transform:scale(1) rotate(0deg)}100%{opacity:0;transform:scale(1.02) rotate(2deg)}}
      @keyframes boilA{0%,32%{opacity:1}33%,100%{opacity:0}}@keyframes boilB{0%,32%{opacity:0}33%,65%{opacity:1}66%,100%{opacity:0}}@keyframes boilC{0%,65%{opacity:0}66%,100%{opacity:1}}@keyframes mark-in{0%{opacity:0;stroke-dasharray:0 50;transform:scale(.8)}18%{opacity:1;stroke-dasharray:18 50;transform:scale(1.02)}72%{opacity:1}100%{opacity:0;stroke-dasharray:18 50;transform:translateY(-4px)}}@keyframes dot-pop{0%{opacity:0;transform:scale(.3)}15%{opacity:1;transform:scale(1.35)}35%{transform:scale(1)}85%{opacity:1}100%{opacity:0;transform:scale(.65) translateY(-4px)}}@keyframes heart-pop{0%{opacity:0;transform:scale(.2) rotate(-8deg)}20%{opacity:1;transform:scale(1.25) rotate(5deg)}42%{transform:scale(1) rotate(-2deg)}85%{opacity:1}100%{opacity:0;transform:scale(.8) translateY(-7px)}}@keyframes arrow-drop{0%{opacity:0;transform:translateY(-5px) scale(.75)}23%{opacity:1;transform:translateY(0) scale(1.08)}80%{opacity:1}100%{opacity:0;transform:translateY(4px) scale(.92)}}
    ]]></style>`;
  function shape(key){ const p=shapes[key]||shapes.vertical; return `<g class="ink"><path class="boil-a" d="${p[0]}"/><path class="boil-b" d="${p[1]}"/><path class="boil-c" d="${p[2]}"/></g>`; }
  function marks(key){
    if(key==='oval') return `<path class="side-mark mark-1" d="M67 86 l-12 -4 M66 101 l-14 0 M70 116 l-11 5"/><path class="side-mark mark-2" d="M172 88 l13 -3 M173 104 l15 1 M169 122 l12 5"/><circle class="dot" cx="148" cy="83" r="3.2" style="animation-delay:100ms"/>`;
    if(key==='wail') return `<path class="side-mark mark-1" d="M96 61 l-15 -2 M93 75 l-18 1 M95 89 l-13 4"/><path class="side-mark mark-2" d="M160 75 l15 -5 M160 91 l17 1 M154 108 l14 6"/><path class="heart" style="animation-delay:170ms" d="M95 232 C84 218 72 232 88 248 C102 235 106 225 95 232 Z"/><path class="heart" style="animation-delay:215ms" d="M143 253 C134 241 122 253 137 268 C150 253 154 244 143 253 Z"/>`;
    return `<path class="side-mark mark-1" d="M81 79 l-9 -2 M82 90 l-12 0 M84 102 l-10 3"/><path class="side-mark mark-2" d="M156 79 l9 -3 M156 93 l12 0 M153 106 l9 4"/>`;
  }
  function arrow(x=121,y=205,s=.75){return `<path class="arrow" d="M${x-15*s} ${y} C${x-8*s} ${y+10*s} ${x-4*s} ${y+16*s} ${x} ${y+24*s} C${x+5*s} ${y+15*s} ${x+9*s} ${y+10*s} ${x+16*s} ${y}"/>`;}
  function horizontalText(text, opt){
    const x=opt.x||121, y=opt.y||122, max=opt.width||90;
    const size = opt.size || Math.max(20, Math.min(38, max / Math.max(2.4, text.length*.58)));
    const rot = opt.rotate || 0;
    return `<g class="text-pop" transform="rotate(${rot} ${x} ${y})"><text class="ghost-text" x="${x+1.4}" y="${y+1.8}" text-anchor="middle" dominant-baseline="middle" font-size="${size}" textLength="${max}" lengthAdjust="spacingAndGlyphs">${esc(text)}</text><text class="sfx-text" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="${size}" textLength="${max}" lengthAdjust="spacingAndGlyphs">${esc(text)}</text></g>`;
  }
  function verticalText(text, opt){
    const chars = Array.from(String(text));
    const x = opt.x || 121;
    const start = opt.y || (chars.length <= 3 ? 70 : 80);
    const spacing = opt.spacing || Math.max(24, Math.min(38, 130 / Math.max(chars.length,3)));
    const size = opt.size || Math.max(24, Math.min(46, 120 / Math.max(chars.length,3)));
    const rots = opt.rotateLetters || [-6,3,-3,5,-4,2];
    let out = '<g class="text-pop">';
    chars.forEach((ch,i)=>{ const yy=start+i*spacing, dx=[-1.5,1.1,-.5,1.8,-1,.9][i%6], r=rots[i%rots.length]; out += `<text class="stack-char" x="${(x+dx).toFixed(1)}" y="${yy.toFixed(1)}" font-size="${size}" transform="rotate(${r} ${(x+dx).toFixed(1)} ${yy.toFixed(1)})">${esc(ch)}</text>`; });
    return out + '</g>';
  }
  function createComicSFX(options={}){
    const text = options.text || 'mhi';
    const preset = options.preset || options.style || 'vertical';
    const duration = options.duration || 880;
    let key='vertical', body='';
    if(preset==='oval' || preset==='movah'){ key='oval'; body = horizontalText(text,{x:124,y:119,width:options.width||108,size:options.fontSize||31,rotate:options.rotate??-2}) + arrow(124,186,.72); }
    else if(preset==='wail' || preset==='big'){ key='wail'; body = verticalText(text,{x:125,y:88,spacing:options.spacing||32,size:options.fontSize||42,rotateLetters:options.rotateLetters||[-86,-84,-88,-83]}); }
    else if(preset==='tall' || preset==='oooh'){ key='tall'; body = verticalText(text,{x:122,y:102,spacing:options.spacing||38,size:options.fontSize||36}) + arrow(122,228,.72); }
    else { key='vertical'; body = (options.vertical ? verticalText(text,{x:121,y:70,spacing:options.spacing||26,size:options.fontSize||28}) : horizontalText(text,{x:121,y:123,width:options.width||74,size:options.fontSize||31,rotate:options.rotate??-3})) + arrow(121,204,.74); }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320" style="--dur:${duration}ms" role="img" aria-label="${esc(text)} comic sound effect">${commonDefs}${style}<g class="sfx-root">${shape(key)}${marks(key)}${body}</g></svg>`;
  }
  function mountComicSFX(target, options){
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if(!el) return null;
    el.innerHTML = createComicSFX(options);
    return el.firstElementChild;
  }
  global.createComicSFX = createComicSFX;
  global.mountComicSFX = mountComicSFX;
})(typeof window !== 'undefined' ? window : globalThis);
