import { writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const JSZip = require('jszip');

// Pre-encode tutorial cutscene demo assets as base64 data URLs
const TUT_BG_DATA_URL = `data:image/jpeg;base64,${readFileSync(new URL('./tut-cutscene-bg.jpg', import.meta.url)).toString('base64')}`;
const TUT_CHAR_DATA_URL = `data:image/png;base64,${readFileSync(new URL('./tut-cutscene-char.png', import.meta.url)).toString('base64')}`;
const TUT_CHAR2_DATA_URL = `data:image/png;base64,${readFileSync(new URL('./tut-dialogue-char2.png', import.meta.url)).toString('base64')}`;
const TUT_AUDIO_DATA_URL = `data:audio/mpeg;base64,${readFileSync(new URL('./file_example_MP3_700KB.mp3', import.meta.url)).toString('base64')}`;

// ────────────────────────────────────────────────────────────────────────────
// Shared tutorial CSS
// ────────────────────────────────────────────────────────────────────────────

const TUTORIAL_CSS = `
.tut{--t-text:#e2e8f0;--t-text-content:#cbd5e1;--t-text-title:#c7d2fe;--t-text-step:#e0e7ff;--t-text-muted:#64748b;--t-text-muted2:#94a3b8;--t-bg:transparent;--t-bg-card:rgba(30,41,59,.7);--t-bg-card2:rgba(30,41,59,.5);--t-bg-code:rgba(15,23,42,.8);--t-bg-code-inline:rgba(99,102,241,.15);--t-border:rgba(255,255,255,.08);--t-border2:rgba(255,255,255,.1);--t-border3:rgba(255,255,255,.2);--t-dot-inactive:rgba(255,255,255,.12);--t-accent:#6366f1;--t-accent-hover:#4f46e5;--t-accent-light:#818cf8;--t-code-text:#a5b4fc;--t-btn-sec-bg:rgba(255,255,255,.08);--t-btn-sec-hover:rgba(255,255,255,.14);--t-highlight-bg:rgba(99,102,241,.1);--t-warn-bg:rgba(234,179,8,.1);--t-warn-text:#fde68a;--t-btn-hub:#94a3b8;--t-btn-hub-hover:#e2e8f0;--t-outline-hover:rgba(255,255,255,.08);--t-track-bar:rgba(30,41,59,.6);display:flex;flex-direction:column;width:100%;height:100%;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,sans-serif;color:var(--t-text);background:var(--t-bg)}
.tut.light{--t-text:#1e293b;--t-text-content:#334155;--t-text-title:#312e81;--t-text-step:#1e1b4b;--t-text-muted:#64748b;--t-text-muted2:#64748b;--t-bg:#f8fafc;--t-bg-card:rgba(226,232,240,.5);--t-bg-card2:rgba(226,232,240,.35);--t-bg-code:rgba(226,232,240,.6);--t-bg-code-inline:rgba(99,102,241,.1);--t-border:rgba(0,0,0,.1);--t-border2:rgba(0,0,0,.12);--t-border3:rgba(0,0,0,.2);--t-dot-inactive:rgba(0,0,0,.1);--t-code-text:#4338ca;--t-btn-sec-bg:rgba(0,0,0,.06);--t-btn-sec-hover:rgba(0,0,0,.1);--t-highlight-bg:rgba(99,102,241,.08);--t-warn-bg:rgba(234,179,8,.1);--t-warn-text:#92400e;--t-btn-hub:#64748b;--t-btn-hub-hover:#1e293b;--t-outline-hover:rgba(0,0,0,.06);--t-track-bar:rgba(226,232,240,.8)}
.tut-header{padding:20px 28px 16px;border-bottom:1px solid var(--t-border)}
.tut-title{font-size:22px;font-weight:700;color:var(--t-text-title);margin:0}
.tut-subtitle{font-size:13px;color:var(--t-text-muted);margin-top:4px}
.tut-progress{display:flex;gap:6px;margin-top:10px}
.tut-dot{width:10px;height:10px;border-radius:50%;background:var(--t-dot-inactive);transition:background .3s}
.tut-dot.active{background:var(--t-accent-light);box-shadow:0 0 6px rgba(129,140,248,.5)}
.tut-dot.done{background:var(--t-accent)}
.tut-body{flex:1;overflow-y:auto;padding:24px 28px 32px}
.tut-step-title{font-size:19px;font-weight:600;color:var(--t-text-step);margin:0 0 16px}
.tut-content{color:var(--t-text-content);line-height:1.75;font-size:15px}
.tut-content p{margin:0 0 12px}
.tut-content code{background:var(--t-bg-code-inline);padding:2px 7px;border-radius:4px;font-family:'Fira Code',monospace;font-size:13px;color:var(--t-code-text)}
.tut-content ul,.tut-content ol{margin:8px 0 12px;padding-left:22px}
.tut-content li{margin:4px 0}
.tut-content strong{color:var(--t-text)}
.tut-content h4{color:var(--t-text-title);font-size:16px;margin:18px 0 8px}
.highlight{background:var(--t-highlight-bg);border-left:3px solid var(--t-accent);padding:12px 16px;border-radius:0 8px 8px 0;margin:14px 0}
.warn{background:var(--t-warn-bg);border-left:3px solid #eab308;padding:12px 16px;border-radius:0 8px 8px 0;margin:14px 0;color:var(--t-warn-text)}
.tut-footer{padding:14px 28px;border-top:1px solid var(--t-border);display:flex;justify-content:space-between;align-items:center}
.tut-btn{padding:9px 18px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s;outline:none}
.tut-btn:active{transform:scale(.97)}
.tut-btn-primary{background:var(--t-accent);color:#fff}.tut-btn-primary:hover{background:var(--t-accent-hover)}
.tut-btn-secondary{background:var(--t-btn-sec-bg);color:var(--t-text)}.tut-btn-secondary:hover{background:var(--t-btn-sec-hover)}
.tut-btn-hub{background:transparent;color:var(--t-btn-hub);font-weight:500}.tut-btn-hub:hover{color:var(--t-btn-hub-hover)}
.demo-box{background:var(--t-bg-card);border:1px solid var(--t-border2);border-radius:10px;padding:16px;margin:14px 0}
.demo-label{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--t-text-muted);margin-bottom:10px}
.demo-btn{padding:6px 14px;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;background:var(--t-accent-hover);color:#fff;margin:4px;transition:background .15s}
.demo-btn:hover{background:var(--t-accent)}
.demo-btn-sm{padding:4px 10px;font-size:12px;border-radius:4px}
.demo-btn-danger{background:#ef4444}.demo-btn-danger:hover{background:#dc2626}
.demo-btn-outline{background:transparent;border:1px solid var(--t-border3);color:var(--t-text)}.demo-btn-outline:hover{background:var(--t-outline-hover)}
.demo-node{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;border:2px solid}
.demo-edge{width:40px;height:2px;background:var(--t-accent);display:inline-block;vertical-align:middle;margin:0 4px}
.demo-grid{display:grid;gap:10px;margin:10px 0}
.demo-card{background:var(--t-bg-card2);border:1px solid var(--t-border);border-radius:8px;padding:12px}
.demo-tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;margin:2px}
.code-block{background:var(--t-bg-code);border:1px solid var(--t-border2);border-radius:8px;padding:14px;font-family:'Fira Code',monospace;font-size:13px;color:var(--t-code-text);overflow-x:auto;white-space:pre;line-height:1.6;margin:10px 0}
.mini-timeline{display:flex;flex-direction:column;gap:6px;margin:10px 0}
.mini-track{display:flex;align-items:center;gap:8px;height:28px}
.mini-track-label{width:80px;font-size:12px;color:var(--t-text-muted2);text-align:right;flex-shrink:0}
.mini-track-bar{flex:1;background:var(--t-track-bar);border-radius:4px;height:100%;position:relative;overflow:hidden}
.mini-clip{position:absolute;height:100%;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(255,255,255,.8)}
`;

// ────────────────────────────────────────────────────────────────────────────
// Framework code that runs inside each custom scene
// ────────────────────────────────────────────────────────────────────────────

const FRAMEWORK_CODE = `
var _theme=api.getVariable('var-theme')||'dark';
_root.className='tut'+(_theme==='light'?' light':'');
document.body.style.background=_theme==='light'?'#f8fafc':'black';
document.getElementById('container').style.background=_theme==='light'?'#f8fafc':'black';
function _render(){
  var s=_steps[_cur];
  var dots='';
  for(var i=0;i<_steps.length;i++){
    var c='tut-dot';
    if(i===_cur)c+=' active';else if(i<_cur)c+=' done';
    dots+='<div class="'+c+'"></div>';
  }
  _root.innerHTML=
    '<div class="tut-header">'+
      '<h1 class="tut-title">'+_title+'</h1>'+
      '<div class="tut-subtitle">Step '+(_cur+1)+' of '+_steps.length+'</div>'+
      '<div class="tut-progress">'+dots+'</div>'+
    '</div>'+
    '<div class="tut-body" id="tut-body">'+
      '<h2 class="tut-step-title">'+s.title+'</h2>'+
      '<div class="tut-content" id="tut-content">'+s.html+'</div>'+
    '</div>'+
    '<div class="tut-footer">'+
      '<button class="tut-btn tut-btn-hub" id="tut-hub">\\u2190 Back to Hub</button>'+
      '<div style="display:flex;gap:8px">'+
        (_cur>0?'<button class="tut-btn tut-btn-secondary" id="tut-prev">\\u2190 Prev</button>':'')+
        (_cur<_steps.length-1?'<button class="tut-btn tut-btn-primary" id="tut-next">Next \\u2192</button>':'<button class="tut-btn tut-btn-primary" id="tut-done">\\u2713 Finish</button>')+
      '</div>'+
    '</div>';
  _root.querySelector('#tut-hub').onclick=function(){api.onComplete()};
  var p=_root.querySelector('#tut-prev');if(p)p.onclick=function(){_cur--;_render()};
  var n=_root.querySelector('#tut-next');if(n)n.onclick=function(){_cur++;_render()};
  var d=_root.querySelector('#tut-done');if(d)d.onclick=function(){api.onComplete()};
  if(s.setup){s.setup(_root.querySelector('#tut-content'))}
}
_render();
api.onCleanup(function(){});
`;

// ────────────────────────────────────────────────────────────────────────────
// Build a complete custom-scene script from title + steps
// ────────────────────────────────────────────────────────────────────────────

function buildScript(title, steps) {
  const stepsDef = steps.map(s => {
    const setup = s.setup ? `function(contentEl){${s.setup}}` : 'null';
    return `{title:${JSON.stringify(s.title)},html:${JSON.stringify(s.html)},setup:${setup}}`;
  }).join(',\n');

  return [
    `var _title=${JSON.stringify(title)};`,
    `var _steps=[${stepsDef}];`,
    `var _cur=0;`,
    `var _css=document.createElement('style');`,
    `_css.textContent=${JSON.stringify(TUTORIAL_CSS)};`,
    `container.appendChild(_css);`,
    `var _root=document.createElement('div');`,
    `container.appendChild(_root);`,
    FRAMEWORK_CODE,
  ].join('\n');
}

// ════════════════════════════════════════════════════════════════════════════
// TUTORIAL 1 — Story Graph, Assets & Variables
// ════════════════════════════════════════════════════════════════════════════

function storyGraphSteps() {
  return [
    {
      title: 'Welcome to the Game Editor',
      html:
        '<p>Welcome! This tutorial will teach you about the three foundational systems in the game editor:</p>' +
        '<ul>' +
        '<li><strong>The Story Graph</strong> — the visual canvas where you build your game\'s flow</li>' +
        '<li><strong>Assets</strong> — images and audio you upload and use in scenes</li>' +
        '<li><strong>Variables</strong> — data that tracks player choices and game state</li>' +
        '</ul>' +
        '<div class="highlight"><strong>Tip:</strong> These three systems work together. The story graph defines the structure, assets provide the visuals and sounds, and variables let you create dynamic, branching experiences.</div>',
    },
    {
      title: 'The Story Graph',
      html:
        '<p>The <strong>story graph</strong> is the heart of the editor. It\'s a visual node-based canvas (similar to tools like Unreal Blueprints) where each <strong>node</strong> represents a scene in your game.</p>' +
        '<p>There are six scene types you can create:</p>' +
        '<div class="demo-grid" style="grid-template-columns:1fr 1fr">' +
        '<div class="demo-card"><span class="demo-tag" style="background:#6366f1;color:#fff">Dialogue</span> Character conversations with branching choices</div>' +
        '<div class="demo-card"><span class="demo-tag" style="background:#10b981;color:#fff">Cutscene</span> Timeline-based cinematic sequences</div>' +
        '<div class="demo-card"><span class="demo-tag" style="background:#ef4444;color:#fff">Point &amp; Click</span> Clickable hotspots on a background image</div>' +
        '<div class="demo-card"><span class="demo-tag" style="background:#f97316;color:#fff">Gameplay</span> Physics-based platformer or top-down gameplay</div>' +
        '<div class="demo-card"><span class="demo-tag" style="background:#8b5cf6;color:#fff">Custom</span> Write JavaScript for unlimited possibilities</div>' +
        '<div class="demo-card"><span class="demo-tag" style="background:#14b8a6;color:#fff">Subgraph</span> Group nodes into reusable sub-flows</div>' +
        '</div>',
    },
    {
      title: 'Creating & Connecting Nodes',
      html:
        '<p>To build your game, you <strong>create nodes</strong> and <strong>connect them with edges</strong>:</p>' +
        '<ol>' +
        '<li>Use the <strong>"Add Scene"</strong> toolbar on the left to create a new scene node</li>' +
        '<li>Choose the scene type (dialogue, cutscene, etc.)</li>' +
        '<li>Drag nodes around the canvas to organize them</li>' +
        '<li>Connect nodes by dragging from an <strong>output handle</strong> (right side) to an <strong>input handle</strong> (left side)</li>' +
        '</ol>' +
        '<p>A node can have <strong>multiple outgoing edges</strong> (one per choice), and <strong>multiple edges can arrive at the same node</strong>. For example, imagine a scene where the character is given 4 choices — 3 of which lead to Node A, and 1 leads to Node B:</p>' +
        '<div id="graph-demo"></div>' +
        '<h4>Setting the Starting Node</h4>' +
        '<p>To control where your game begins, select any non-subgraph node and enable the <strong>"Starting node"</strong> toggle in the properties panel. Only one node can be the starting node at a time — turning it on for one node automatically turns it off for any other.</p>' +
        '<div class="highlight"><strong>Tip:</strong> If no starting node is explicitly set, the game falls back to the first node with <strong>no incoming edges</strong>.</div>' +
        '<p>This is especially useful for:</p>' +
        '<ul>' +
        '<li><strong>Looping games</strong> — your starting node can have incoming edges (e.g. a game that loops back to the beginning)</li>' +
        '<li><strong>Testing</strong> — temporarily set a mid-game node as the start so you can jump straight to the part you\'re working on</li>' +
        '</ul>',
      setup:
        'var demo=contentEl.querySelector("#graph-demo");' +
        'var NW=160,HH=28,BH=20,RH=20,HR=7,PAD=4;' +
        'var colors=["#6366f1","#f59e0b","#10b981","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316"];' +
        'var hcnt=0;' +
        'function visOut(n){return[{id:"default",label:""}].concat(n.choices);}' +
        'function nh(n){return HH+BH+Math.max(visOut(n).length,1)*RH+PAD;}' +
        'function outY(n,i){return n.y+HH+BH+i*RH+RH/2;}' +
        'function inY(n){return n.y+nh(n)/2;}' +
        'function handleIdx(n,hid){' +
        '  var vo=visOut(n);' +
        '  for(var i=0;i<vo.length;i++){if(vo[i].id===hid)return i;}' +
        '  return -1;' +
        '}' +
        'function initNodes(){return[' +
        '  {id:0,name:"Choice Scene",x:30,y:70,color:"#6366f1",choices:[{id:"c1",label:"Choice 1"},{id:"c2",label:"Choice 2"},{id:"c3",label:"Choice 3"},{id:"c4",label:"Choice 4"}]},' +
        '  {id:1,name:"Node A",x:380,y:40,color:"#10b981",choices:[]},' +
        '  {id:2,name:"Node B",x:380,y:220,color:"#f59e0b",choices:[]}' +
        '];}' +
        'function initEdges(){return[' +
        '  {from:0,fromHandle:"c1",to:1},' +
        '  {from:0,fromHandle:"c2",to:1},' +
        '  {from:0,fromHandle:"c3",to:1},' +
        '  {from:0,fromHandle:"c4",to:2}' +
        '];}' +
        'var nodes=initNodes();var edges=initEdges();var nextId=3;' +
        'var drag=null;var linking=null;var linkMx=0,linkMy=0;' +
        'var sel=null;var simMode=false;var simLog=[];var simCur=null;' +
        '' +
        'function findStart(){' +
        '  var incoming={};' +
        '  edges.forEach(function(e){incoming[e.to]=true;});' +
        '  for(var i=0;i<nodes.length;i++){if(!incoming[nodes[i].id])return nodes[i];}' +
        '  return nodes[0]||null;' +
        '}' +
        '' +
        'function render(){' +
        '  if(simMode){renderSim();return;}' +
        '  var nodeSel=sel&&sel.type==="node";' +
        '  var h=\'<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center">\'+' +
        '    \'<button class="demo-btn" id="sg-add">+ Add Node</button>\'+' +
        '    (nodeSel?\'<button class="demo-btn" id="sg-addch">+ Add Choice</button>\':\'\')+' +
        '    \'<button class="demo-btn demo-btn-danger" id="sg-del" style="\'+(sel?\'\':\' opacity:0.4;pointer-events:none\')+\'">Delete</button>\'+' +
        '    \'<button class="demo-btn demo-btn-outline" id="sg-reset">Reset</button>\'+' +
        '    \'<span style="font-size:12px;color:var(--t-text-muted);margin-left:auto" id="sg-hint"></span>\'+' +
        '  \'</div>\';' +
        '  h+=\'<div class="demo-box" style="padding:0;overflow:hidden;position:relative">\'+' +
        '    \'<svg id="sg-svg" width="100%" height="340" style="display:block"></svg>\'+' +
        '  \'</div>\';' +
        '  h+=\'<div style="display:flex;gap:8px;margin-top:10px;align-items:start;flex-wrap:wrap">\'+' +
        '    \'<button class="demo-btn tut-btn-primary" id="sg-sim">\\u25b6 Simulate This Graph</button>\'+' +
        '    \'<span class="highlight" style="flex:1;margin:0;font-size:13px"><strong>Tips:</strong> Drag output handles (right) to input handles (left) to connect. Click a node or edge to select it, then Delete to remove. Use + Add Choice on a selected node.</span>\'+' +
        '  \'</div>\';' +
        '  demo.innerHTML=h;' +
        '  var svg=demo.querySelector("#sg-svg");' +
        '  var svgRect=svg.getBoundingClientRect();' +
        '  var svgW=svgRect.width||560;' +
        '  var hint=demo.querySelector("#sg-hint");' +
        '  if(sel){' +
        '    if(sel.type==="node"){var sn=null;nodes.forEach(function(n){if(n.id===sel.id)sn=n;});hint.textContent=sn?"Selected: "+sn.name:"";}' +
        '    else if(sel.type==="edge"){hint.textContent="Selected: edge #"+(sel.idx+1);}' +
        '  }' +
        '  renderSvg(svg,svgW);' +
        '  demo.querySelector("#sg-add").onclick=function(){' +
        '    var ci=nextId>=3?nextId-1:nextId;' +
        '    var nm="Node "+String.fromCharCode(65+ci);' +
        '    if(ci>=26)nm="Node "+(nextId);' +
        '    var px=60+Math.random()*(svgW-NW-120);' +
        '    var py=20+Math.random()*220;' +
        '    nodes.push({id:nextId,name:nm,x:px,y:py,color:colors[nextId%colors.length],choices:[]});' +
        '    nextId++;sel=null;render();' +
        '  };' +
        '  var achBtn=demo.querySelector("#sg-addch");' +
        '  if(achBtn)achBtn.onclick=function(){' +
        '    if(!sel||sel.type!=="node")return;' +
        '    var nd=null;nodes.forEach(function(n){if(n.id===sel.id)nd=n;});' +
        '    if(!nd)return;' +
        '    hcnt++;nd.choices.push({id:"h"+hcnt,label:"Choice "+(nd.choices.length+1)});' +
        '    render();' +
        '  };' +
        '  demo.querySelector("#sg-del").onclick=function(){' +
        '    if(!sel)return;' +
        '    if(sel.type==="node"){' +
        '      var did=sel.id;' +
        '      nodes=nodes.filter(function(n){return n.id!==did;});' +
        '      edges=edges.filter(function(e){return e.from!==did&&e.to!==did;});' +
        '    }else if(sel.type==="edge"){' +
        '      edges.splice(sel.idx,1);' +
        '    }' +
        '    sel=null;render();' +
        '  };' +
        '  demo.querySelector("#sg-reset").onclick=function(){' +
        '    nodes=initNodes();edges=initEdges();nextId=3;drag=null;linking=null;sel=null;render();' +
        '  };' +
        '  demo.querySelector("#sg-sim").onclick=function(){' +
        '    simMode=true;simLog=[];simCur=null;' +
        '    var start=findStart();' +
        '    if(start){simCur=start.id;simLog.push({type:"node",name:start.name});}' +
        '    else{simLog.push({type:"end"});}' +
        '    render();' +
        '  };' +
        '}' +
        '' +
        'function renderSim(){' +
        '  var h=\'<div style="display:flex;gap:6px;margin-bottom:8px;align-items:center">\'+' +
        '    \'<button class="demo-btn demo-btn-outline" id="sg-back">\\u2190 Back to Editor</button>\'+' +
        '    \'<span style="font-size:14px;font-weight:600;color:var(--t-text-title)">Simulation</span>\'+' +
        '  \'</div>\';' +
        '  h+=\'<div class="demo-box" style="min-height:200px;max-height:340px;overflow-y:auto" id="sg-simbox">\';' +
        '  simLog.forEach(function(entry){' +
        '    if(entry.type==="node"){' +
        '      h+=\'<div style="margin:8px 0;font-weight:700;font-size:15px;color:var(--t-text)">\\u25b6 \'+entry.name+\'</div>\';' +
        '    }else if(entry.type==="choice"){' +
        '      h+=\'<div style="margin:2px 0 8px 16px;font-size:13px;color:var(--t-accent-light)">\\u2192 You chose: \'+entry.label+\'</div>\';' +
        '    }else if(entry.type==="continue"){' +
        '      h+=\'<div style="margin:2px 0 8px 16px;font-size:13px;color:var(--t-text-muted2)">\\u2192 Continue</div>\';' +
        '    }else if(entry.type==="end"){' +
        '      h+=\'<div style="margin:12px 0;font-weight:700;font-size:16px;color:var(--t-accent-light);text-align:center">\\u2014 The End \\u2014</div>\';' +
        '    }' +
        '  });' +
        '  var ended=simLog.length>0&&simLog[simLog.length-1].type==="end";' +
        '  if(!ended&&simCur!==null){' +
        '    var cn=null;nodes.forEach(function(n){if(n.id===simCur)cn=n;});' +
        '    if(cn){' +
        '      if(cn.choices.length>0){' +
        '        h+=\'<div style="margin:8px 0 4px 16px;font-size:13px;color:var(--t-text-muted2)">Choose:</div>\';' +
        '        cn.choices.forEach(function(o){' +
        '          h+=\'<button class="demo-btn" style="margin:3px 8px 3px 16px" data-simch="\'+o.id+\'">\'+o.label+\'</button>\';' +
        '        });' +
        '      }else{' +
        '        var defEdge=null;' +
        '        edges.forEach(function(e){if(e.from===cn.id&&e.fromHandle==="default")defEdge=e;});' +
        '        if(defEdge){' +
        '          h+=\'<button class="demo-btn demo-btn-outline" style="margin:8px 16px" id="sg-simcont">Continue \\u2192</button>\';' +
        '        }else{' +
        '          simLog.push({type:"end"});' +
        '          return renderSim();' +
        '        }' +
        '      }' +
        '    }else{' +
        '      simLog.push({type:"end"});' +
        '      return renderSim();' +
        '    }' +
        '  }' +
        '  h+=\'</div>\';' +
        '  demo.innerHTML=h;' +
        '  var simbox=demo.querySelector("#sg-simbox");' +
        '  if(simbox)simbox.scrollTop=simbox.scrollHeight;' +
        '  demo.querySelector("#sg-back").onclick=function(){simMode=false;render();};' +
        '  demo.querySelectorAll("[data-simch]").forEach(function(btn){' +
        '    btn.onclick=function(){' +
        '      var hid=btn.dataset.simch;' +
        '      var cn=null;nodes.forEach(function(n){if(n.id===simCur)cn=n;});' +
        '      if(!cn)return;' +
        '      var choiceLabel="";cn.choices.forEach(function(o){if(o.id===hid)choiceLabel=o.label;});' +
        '      var edge=null;edges.forEach(function(e){if(e.from===simCur&&e.fromHandle===hid)edge=e;});' +
        '      if(!edge){simLog.push({type:"choice",label:choiceLabel});simLog.push({type:"end"});simCur=null;renderSim();return;}' +
        '      simLog.push({type:"choice",label:choiceLabel});' +
        '      var tgt=null;nodes.forEach(function(n){if(n.id===edge.to)tgt=n;});' +
        '      if(tgt){simCur=tgt.id;simLog.push({type:"node",name:tgt.name});}' +
        '      else{simCur=null;simLog.push({type:"end"});}' +
        '      renderSim();' +
        '    };' +
        '  });' +
        '  var contBtn=demo.querySelector("#sg-simcont");' +
        '  if(contBtn)contBtn.onclick=function(){' +
        '    var defEdge=null;edges.forEach(function(e){if(e.from===simCur&&e.fromHandle==="default")defEdge=e;});' +
        '    if(!defEdge)return;' +
        '    simLog.push({type:"continue"});' +
        '    var tgt=null;nodes.forEach(function(n){if(n.id===defEdge.to)tgt=n;});' +
        '    if(tgt){simCur=tgt.id;simLog.push({type:"node",name:tgt.name});}' +
        '    else{simCur=null;simLog.push({type:"end"});}' +
        '    renderSim();' +
        '  };' +
        '}' +
        '' +
        'function renderSvg(svg,svgW){' +
        '  var defs=\'<defs><marker id="ah" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="var(--t-accent-light)"/></marker>' +
        '  <marker id="ahs" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#818cf8"/></marker></defs>\';' +
        '  var edgeSvg="";' +
        '  edges.forEach(function(e,ei){' +
        '    var sn=null,tn=null;' +
        '    nodes.forEach(function(n){if(n.id===e.from)sn=n;if(n.id===e.to)tn=n;});' +
        '    if(!sn||!tn)return;' +
        '    var hi=handleIdx(sn,e.fromHandle);' +
        '    if(hi<0)return;' +
        '    var sx=sn.x+NW,sy=outY(sn,hi);' +
        '    var tx=tn.x,ty=inY(tn);' +
        '    var dx=Math.abs(tx-sx);var cpx=Math.max(40,dx*0.4);' +
        '    var path="M"+sx+" "+sy+" C"+(sx+cpx)+" "+sy+" "+(tx-cpx)+" "+ty+" "+tx+" "+ty;' +
        '    var isSel=sel&&sel.type==="edge"&&sel.idx===ei;' +
        '    edgeSvg+=\'<path d="\'+path+\'" fill="none" stroke="transparent" stroke-width="12" style="cursor:pointer" data-seledge="\'+ei+\'"/>\';' +
        '    edgeSvg+=\'<path d="\'+path+\'" fill="none" stroke="\'+(isSel?"#818cf8":"var(--t-accent-light)")+\'" stroke-width="\'+(isSel?3:2)+\'" marker-end="url(#\'+(isSel?"ahs":"ah")+\')" opacity="\'+(isSel?1:0.6)+\'" pointer-events="none"/>\';' +
        '  });' +
        '  if(linking){' +
        '    edgeSvg+=\'<line x1="\'+linking.sx+\'" y1="\'+linking.sy+\'" x2="\'+linkMx+\'" y2="\'+linkMy+\'" stroke="var(--t-accent-light)" stroke-width="2" stroke-dasharray="5,4" opacity="0.7"/>\';' +
        '  }' +
        '  var nodeSvg="";' +
        '  nodes.forEach(function(n){' +
        '    var h=nh(n);var vo=visOut(n);' +
        '    var isSel=sel&&sel.type==="node"&&sel.id===n.id;' +
        '    nodeSvg+=\'<g data-nid="\'+n.id+\'">\';' +
        '    if(isSel){' +
        '      nodeSvg+=\'<rect x="\'+(n.x-3)+\'" y="\'+(n.y-3)+\'" width="\'+(NW+6)+\'" height="\'+(h+6)+\'" rx="9" fill="none" stroke="#818cf8" stroke-width="2" stroke-dasharray="4,3"/>\';' +
        '    }' +
        '    nodeSvg+=\'<rect x="\'+n.x+\'" y="\'+n.y+\'" width="\'+NW+\'" height="\'+h+\'" rx="6" fill="var(--t-bg-card)" stroke="\'+n.color+\'" stroke-width="2" data-selbody="\'+n.id+\'" style="cursor:pointer"/>\';' +
        '    nodeSvg+=\'<rect x="\'+n.x+\'" y="\'+n.y+\'" width="\'+NW+\'" height="\'+HH+\'" rx="6" fill="\'+n.color+\'" style="cursor:grab" data-drag="\'+n.id+\'"/>\';' +
        '    nodeSvg+=\'<rect x="\'+(n.x)+\'" y="\'+(n.y+HH-6)+\'" width="\'+NW+\'" height="6" fill="\'+n.color+\'" data-drag="\'+n.id+\'" style="cursor:grab"/>\';' +
        '    nodeSvg+=\'<text x="\'+(n.x+NW/2)+\'" y="\'+(n.y+HH/2+5)+\'" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" pointer-events="none">\'+n.name+\'</text>\';' +
        '    nodeSvg+=\'<circle cx="\'+n.x+\'" cy="\'+(inY(n))+\'" r="\'+HR+\'" fill="#94a3b8" stroke="#64748b" stroke-width="1.5" data-handle="in" data-nid="\'+n.id+\'" style="cursor:crosshair"/>\';' +
        '    nodeSvg+=\'<text x="\'+(n.x)+\'" y="\'+(inY(n)+3)+\'" text-anchor="middle" font-size="6" font-weight="700" fill="#1e293b" pointer-events="none">in</text>\';' +
        '    vo.forEach(function(o,i){' +
        '      var oy=outY(n,i);' +
        '      var isDefault=o.id==="default";' +
        '      if(o.label){' +
        '        nodeSvg+=\'<text x="\'+(n.x+NW-HR-6)+\'" y="\'+(oy+3)+\'" text-anchor="end" font-size="10" fill="var(--t-text-muted2)" pointer-events="none">\'+o.label+\'</text>\';' +
        '      }' +
        '      if(isDefault){' +
        '        nodeSvg+=\'<circle cx="\'+(n.x+NW)+\'" cy="\'+oy+\'" r="\'+HR+\'" fill="#94a3b8" stroke="#64748b" stroke-width="1.5" data-handle="out" data-nid="\'+n.id+\'" data-hid="default" style="cursor:crosshair"/>\';' +
        '        nodeSvg+=\'<text x="\'+(n.x+NW)+\'" y="\'+(oy+3)+\'" text-anchor="middle" font-size="6" font-weight="700" fill="#1e293b" pointer-events="none">out</text>\';' +
        '      }else{' +
        '        nodeSvg+=\'<circle cx="\'+(n.x+NW)+\'" cy="\'+oy+\'" r="\'+HR+\'" fill="\'+n.color+\'" stroke="\'+n.color+\'" stroke-width="1.5" opacity="0.7" data-handle="out" data-nid="\'+n.id+\'" data-hid="\'+o.id+\'" style="cursor:crosshair"/>\';' +
        '        nodeSvg+=\'<text x="\'+(n.x+NW)+\'" y="\'+(oy+3)+\'" text-anchor="middle" font-size="6" font-weight="700" fill="#fff" pointer-events="none">out</text>\';' +
        '      }' +
        '    });' +
        '    nodeSvg+=\'</g>\';' +
        '  });' +
        '  svg.innerHTML=defs+edgeSvg+nodeSvg;' +
        '' +
        '  svg.querySelectorAll("[data-seledge]").forEach(function(el){' +
        '    el.onmousedown=function(ev){ev.stopPropagation();};' +
        '    el.onclick=function(ev){ev.stopPropagation();sel={type:"edge",idx:parseInt(el.dataset.seledge)};render();};' +
        '  });' +
        '  svg.querySelectorAll("[data-selbody]").forEach(function(el){' +
        '    el.onclick=function(ev){' +
        '      if(ev.target.dataset.handle||ev.target.dataset.drag)return;' +
        '      ev.stopPropagation();sel={type:"node",id:parseInt(el.dataset.selbody)};render();' +
        '    };' +
        '  });' +
        '  svg.onclick=function(ev){' +
        '    if(ev.target===svg){sel=null;render();}' +
        '  };' +
        '' +
        '  svg.querySelectorAll("[data-handle=\'out\']").forEach(function(el){' +
        '    el.addEventListener("mousedown",function(ev){' +
        '      ev.stopPropagation();ev.preventDefault();' +
        '      var nid=parseInt(el.dataset.nid);var hid=el.dataset.hid;' +
        '      var nd=null;nodes.forEach(function(n){if(n.id===nid)nd=n;});' +
        '      if(!nd)return;' +
        '      var hi=handleIdx(nd,hid);' +
        '      if(hi<0)return;' +
        '      var sx=nd.x+NW,sy=outY(nd,hi);' +
        '      linking={nid:nid,hid:hid,sx:sx,sy:sy};' +
        '      var sr=svg.getBoundingClientRect();' +
        '      linkMx=ev.clientX-sr.left;linkMy=ev.clientY-sr.top;' +
        '      renderSvg(svg,svgW);' +
        '    });' +
        '  });' +
        '  svg.querySelectorAll("[data-drag]").forEach(function(el){' +
        '    el.addEventListener("mousedown",function(ev){' +
        '      if(linking)return;' +
        '      ev.stopPropagation();ev.preventDefault();' +
        '      var nid=parseInt(el.dataset.drag);' +
        '      var nd=null;nodes.forEach(function(n){if(n.id===nid)nd=n;});' +
        '      if(!nd)return;' +
        '      var sr=svg.getBoundingClientRect();' +
        '      drag={node:nd,ox:ev.clientX-sr.left-nd.x,oy:ev.clientY-sr.top-nd.y};' +
        '    });' +
        '  });' +
        '  function onMove(ev){' +
        '    var sr=svg.getBoundingClientRect();' +
        '    if(linking){' +
        '      linkMx=ev.clientX-sr.left;linkMy=ev.clientY-sr.top;' +
        '      renderSvg(svg,svgW);return;' +
        '    }' +
        '    if(!drag)return;' +
        '    drag.node.x=Math.max(0,Math.min(svgW-NW,ev.clientX-sr.left-drag.ox));' +
        '    drag.node.y=Math.max(0,Math.min(300,ev.clientY-sr.top-drag.oy));' +
        '    renderSvg(svg,svgW);' +
        '  }' +
        '  function onUp(ev){' +
        '    if(linking){' +
        '      var tgt=ev.target;' +
        '      if(tgt&&tgt.dataset&&tgt.dataset.handle==="in"){' +
        '        var tid=parseInt(tgt.dataset.nid);' +
        '        if(tid!==linking.nid){' +
        '          edges.push({from:linking.nid,fromHandle:linking.hid,to:tid});' +
        '        }' +
        '      }' +
        '      linking=null;render();return;' +
        '    }' +
        '    if(drag){drag=null;}' +
        '  }' +
        '  svg.onmousemove=onMove;' +
        '  svg.onmouseup=onUp;' +
        '  svg.onmouseleave=function(){if(linking){linking=null;renderSvg(svg,svgW);}if(drag)drag=null;};' +
        '}' +
        'render();',
    },
    {
      title: 'Managing Assets',
      html:
        '<p>Assets are the media files that bring your game to life. The editor supports:</p>' +
        '<ul>' +
        '<li><strong>Images</strong> — PNG, JPG, GIF, WebP (up to 10 MB each)</li>' +
        '<li><strong>Audio</strong> — MP3, WAV, OGG (up to 10 MB each)</li>' +
        '</ul>' +
        '<p>To upload assets, open the <strong>Assets Panel</strong> on the left sidebar. You can drag and drop files or use the upload button.</p>' +
        '<h4>Asset Categories</h4>' +
        '<div class="demo-grid" style="grid-template-columns:1fr 1fr">' +
        '<div class="demo-card"><strong>Background</strong> — scene backgrounds</div>' +
        '<div class="demo-card"><strong>Character</strong> — character sprites</div>' +
        '<div class="demo-card"><strong>BGM</strong> — background music</div>' +
        '<div class="demo-card"><strong>SFX</strong> — sound effects</div>' +
        '</div>' +
        '<p>Each asset gets a unique <strong>ID</strong>. You reference this ID when assigning backgrounds, character sprites, or audio to scenes. Click an asset in the panel to copy its ID.</p>',
    },
    {
      title: 'Variables',
      html:
        '<p>Variables store data that persists across scenes — perfect for tracking player progress, inventory, or branching paths.</p>' +
        '<h4>Variable Types</h4>' +
        '<div class="demo-grid" style="grid-template-columns:1fr 1fr 1fr">' +
        '<div class="demo-card" style="text-align:center"><span class="demo-tag" style="background:#3b82f6;color:#fff">boolean</span><br><code>true</code> / <code>false</code></div>' +
        '<div class="demo-card" style="text-align:center"><span class="demo-tag" style="background:#10b981;color:#fff">number</span><br><code>0</code>, <code>42</code>, <code>-1</code></div>' +
        '<div class="demo-card" style="text-align:center"><span class="demo-tag" style="background:#f59e0b;color:#000">string</span><br><code>"hello"</code></div>' +
        '</div>' +
        '<h4>Operations</h4>' +
        '<p>You can modify variables using: <code>=</code> (set), <code>+=</code> (add), <code>-=</code> (subtract).</p>' +
        '<h4>Conditions</h4>' +
        '<p>Use conditions to show/hide choice options or enable/disable hotspots: <code>==</code>, <code>!=</code>, <code>&gt;</code>, <code>&lt;</code>, <code>&gt;=</code></p>' +
        '<div id="var-demo"></div>',
      setup:
        'var demo=contentEl.querySelector("#var-demo");' +
        'var vars=[{name:"hasKey",type:"boolean",val:false},{name:"score",type:"number",val:0}];' +
        'function rnd(){' +
        '  var h=\'<div class="demo-box"><div class="demo-label">Try it: Variable Editor</div>\';' +
        '  vars.forEach(function(v,i){' +
        '    h+=\'<div style="display:flex;align-items:center;gap:8px;margin:6px 0">\'+' +
        '      \'<code style="min-width:80px">\'+v.name+\'</code>\'+' +
        '      \'<span class="demo-tag" style="background:#334155">\'+v.type+\'</span>\'+' +
        '      \'<strong style="color:#818cf8;min-width:50px">\'+String(v.val)+\'</strong>\'+' +
        '      \'<button class="demo-btn demo-btn-sm" data-tog="\'+i+\'">Toggle</button>\'+' +
        '      \'<button class="demo-btn demo-btn-sm demo-btn-danger" data-del="\'+i+\'">Remove</button>\'+' +
        '    \'</div>\';' +
        '  });' +
        '  h+=\'<button class="demo-btn" id="add-var" style="margin-top:8px">+ Add Variable</button></div>\';' +
        '  demo.innerHTML=h;' +
        '  demo.querySelector("#add-var").onclick=function(){' +
        '    var n="var_"+vars.length;' +
        '    vars.push({name:n,type:"number",val:0});rnd();' +
        '  };' +
        '  demo.querySelectorAll("[data-tog]").forEach(function(b){' +
        '    b.onclick=function(){' +
        '      var idx=parseInt(b.dataset.tog);var v=vars[idx];' +
        '      if(v.type==="boolean")v.val=!v.val;' +
        '      else if(v.type==="number")v.val=v.val+1;' +
        '      else v.val=v.val+"!";' +
        '      rnd();' +
        '    };' +
        '  });' +
        '  demo.querySelectorAll("[data-del]").forEach(function(b){' +
        '    b.onclick=function(){vars.splice(parseInt(b.dataset.del),1);rnd();};' +
        '  });' +
        '}rnd();',
    },
  ];
}

// ════════════════════════════════════════════════════════════════════════════
// TUTORIAL 2 — The Dialogue Node
// ════════════════════════════════════════════════════════════════════════════

function dialogueSteps() {
  return [
    {
      title: 'What Are Dialogue Nodes?',
      html:
        '<p><strong>Dialogue nodes</strong> are how you create character conversations in your game. They\'re the most common scene type — perfect for storytelling, character interactions, and branching narratives.</p>' +
        '<p>A dialogue node contains a sequence of <strong>blocks</strong> that execute one after another:</p>' +
        '<div class="demo-grid" style="grid-template-columns:1fr 1fr 1fr">' +
        '<div class="demo-card" style="text-align:center"><span class="demo-tag" style="background:#6366f1;color:#fff">Text Block</span><br>Character says a line</div>' +
        '<div class="demo-card" style="text-align:center"><span class="demo-tag" style="background:#f59e0b;color:#000">Choice Block</span><br>Player picks an option</div>' +
        '<div class="demo-card" style="text-align:center"><span class="demo-tag" style="background:#10b981;color:#fff">Logic Block</span><br>Set/modify variables</div>' +
        '</div>' +
        '<p>You can add blocks at the end using the toolbar buttons, or <strong>insert blocks between existing ones</strong> by hovering between two blocks — an insert button will appear, letting you place a new text, choice, or logic block at that exact position.</p>',
    },
    {
      title: 'Text Blocks',
      html:
        '<p>A <strong>text block</strong> displays a character\'s dialogue line along with <strong>character sprites</strong> on screen. Each text block lets you configure:</p>' +
        '<ul>' +
        '<li><strong>Character name</strong> — who is speaking</li>' +
        '<li><strong>Dialogue text</strong> — what they say</li>' +
        '<li><strong>On-screen characters</strong> — up to 4 character images positioned on the left or right side of the screen</li>' +
        '</ul>' +
        '<div class="demo-box"><div class="demo-label">Preview</div>' +
        '<div style="position:relative;width:100%;padding-bottom:56.25%;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:8px;overflow:hidden;margin-top:8px">' +
        '<img src="' + TUT_CHAR_DATA_URL + '" style="position:absolute;left:5%;bottom:4.5rem;max-height:70%;object-fit:contain;opacity:1" />' +
        '<img src="' + TUT_CHAR2_DATA_URL + '" style="position:absolute;right:5%;bottom:4.5rem;max-height:70%;object-fit:contain;opacity:1" />' +
        '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.7);padding:12px 16px">' +
        '<div style="color:#818cf8;font-weight:600;font-size:13px;margin-bottom:4px">Elara</div>' +
        '<div style="color:#e2e8f0;font-size:14px">We should investigate the ruins together. What do you think, Wizard?</div>' +
        '</div>' +
        '</div></div>' +
        '<p>The player clicks or presses <strong>Space/Enter</strong> to advance to the next block.</p>',
    },
    {
      title: 'Character Sprites',
      html:
        '<p>Each text block has an <strong>On-Screen Characters</strong> section where you add character sprites. You can place up to <strong>4 characters</strong> at these positions:</p>' +
        '<div class="demo-box"><div class="demo-label">Character Positions</div>' +
        '<div style="position:relative;width:100%;padding-bottom:30%;background:rgba(0,0,0,.3);border-radius:8px;margin-top:8px;overflow:hidden">' +
        '<div style="position:absolute;left:5%;bottom:10%;text-align:center"><div style="width:48px;height:72px;border:2px dashed rgba(99,102,241,.5);border-radius:6px;margin:0 auto 4px"></div><span style="font-size:11px;color:#818cf8">Left</span></div>' +
        '<div style="position:absolute;left:22%;bottom:10%;text-align:center"><div style="width:48px;height:72px;border:2px dashed rgba(245,158,11,.5);border-radius:6px;margin:0 auto 4px"></div><span style="font-size:11px;color:#f59e0b">Inner Left</span></div>' +
        '<div style="position:absolute;right:22%;bottom:10%;text-align:center"><div style="width:48px;height:72px;border:2px dashed rgba(245,158,11,.5);border-radius:6px;margin:0 auto 4px"></div><span style="font-size:11px;color:#f59e0b">Inner Right</span></div>' +
        '<div style="position:absolute;right:5%;bottom:10%;text-align:center"><div style="width:48px;height:72px;border:2px dashed rgba(99,102,241,.5);border-radius:6px;margin:0 auto 4px"></div><span style="font-size:11px;color:#818cf8">Right</span></div>' +
        '<div style="position:absolute;bottom:0;left:0;right:0;height:20%;background:rgba(0,0,0,.5);border-radius:0 0 8px 8px"></div>' +
        '</div></div>' +
        '<p>To add a character to a text block, click <strong>Add Character</strong> in the block editor. For each character slot you choose:</p>' +
        '<ul>' +
        '<li><strong>Position</strong> — where on screen the sprite appears (Left, Inner Left, Right, Inner Right)</li>' +
        '<li><strong>Sprite</strong> — the character image from your project assets</li>' +
        '<li><strong>Enter Animation</strong> — how the character appears when this block starts: <code>none</code>, <code>fade</code>, <code>slide</code>, or <code>fade &amp; slide</code></li>' +
        '<li><strong>Exit Animation</strong> — how the character leaves when moving to the next block: <code>none</code>, <code>fade</code>, <code>slide</code>, or <code>fade &amp; slide</code></li>' +
        '</ul>' +
        '<p>Different text blocks can show <strong>different character configurations</strong>. For example, a character might appear in block 1, then a second character joins in block 2 — creating the effect of someone entering the scene mid-conversation. Use enter/exit animations to make these transitions feel cinematic.</p>' +
        '<div class="highlight">Characters are configured <strong>per text block</strong>, so you have full control over who is visible at each line of dialogue and how they animate in and out.</div>',
    },
    {
      title: 'Choice Blocks',
      html:
        '<p><strong>Choice blocks</strong> present the player with options to choose from. Each option can:</p>' +
        '<ul>' +
        '<li>Connect to a <strong>different node</strong> via its own output edge</li>' +
        '<li>Have a <strong>condition</strong> that determines if it\'s visible</li>' +
        '</ul>' +
        '<div class="demo-box"><div class="demo-label">Example Choices</div>' +
        '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">' +
        '<div style="background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:6px;padding:10px 14px;cursor:pointer;font-size:14px">1. Open the door</div>' +
        '<div style="background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:6px;padding:10px 14px;cursor:pointer;font-size:14px">2. Look around the room</div>' +
        '<div style="background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.15);border-radius:6px;padding:10px 14px;font-size:14px;opacity:.5">3. Use the key <span style="color:#64748b">(requires: hasKey == true)</span></div>' +
        '</div></div>' +
        '<p>In this example, the third choice is only visible if the player has the key. This is achieved by adding the "hasKey == true" condition to the choice block.</p>' +
        '<p>In the editor, each choice option creates a separate <strong>output handle</strong> on the node. Connect each handle to the appropriate next scene.</p>' +
        '<h4>Show Over Dialogue</h4>' +
        '<p>Choice blocks have a <strong>Show over dialogue</strong> toggle. When enabled, the choices overlay on top of the previous text block\'s dialogue box instead of replacing it — useful when you want the player to read the dialogue while deciding.</p>',
    },
    {
      title: 'Logic Blocks',
      html:
        '<p><strong>Logic blocks</strong> are invisible to the player — they execute variable operations silently as part of the dialogue flow.</p>' +
        '<p>Use them to:</p>' +
        '<ul>' +
        '<li>Set a flag: <code>hasKey = true</code></li>' +
        '<li>Track score: <code>score += 10</code></li>' +
        '<li>Count events: <code>visitCount += 1</code></li>' +
        '</ul>' +
        '<div class="highlight">Logic blocks execute <strong>automatically</strong> and immediately advance to the next block. The player never sees them.</div>' +
        '<h4>Block Order Matters</h4>' +
        '<p>Blocks execute top to bottom. A common pattern:</p>' +
        '<div class="demo-box"><div class="demo-label">Block Sequence</div>' +
        '<ol style="margin:8px 0;padding-left:20px;font-size:14px">' +
        '<li><span class="demo-tag" style="background:#6366f1;color:#fff">Text</span> "You found the key!"</li>' +
        '<li><span class="demo-tag" style="background:#10b981;color:#fff">Logic</span> hasKey = true</li>' +
        '<li><span class="demo-tag" style="background:#6366f1;color:#fff">Text</span> "I should try the locked door."</li>' +
        '</ol></div>',
    },
    {
      title: 'Try It: Dialogue Builder',
      html:
        '<p>Build your own dialogue sequence below! Add blocks, configure their content, reorder them, then press <strong>Preview</strong> to play through your creation:</p>' +
        '<div id="dialogue-demo"></div>',
      setup:
        'var demo=contentEl.querySelector("#dialogue-demo");' +
        'var blocks=[{type:"text",char:"Guide",text:"Hello! Welcome to the game."}];' +
        'var mode="edit",pIdx=0,pVars={};' +
        'var iSt="background:rgba(30,41,59,.8);border:1px solid rgba(255,255,255,.15);border-radius:4px;color:#e2e8f0;font-size:12px;padding:3px 6px;outline:none;";' +
        'var selSt="background:rgba(30,41,59,.8);border:1px solid rgba(255,255,255,.15);border-radius:4px;color:#94a3b8;font-size:12px;padding:3px 4px;outline:none;";' +
        'function esc(s){return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");}' +
        'function rnd(){if(mode==="edit")renderEdit();else renderPreview();}' +
        'function renderEdit(){' +
        'var h=\'<div class="demo-box"><div class="demo-label">Dialogue Builder</div>\';' +
        'h+=\'<div style="display:flex;gap:6px;margin-bottom:10px">\';' +
        'h+=\'<button class="demo-btn demo-btn-sm" data-add="text"><span class="demo-tag" style="background:#6366f1;color:#fff">+</span> Text</button>\';' +
        'h+=\'<button class="demo-btn demo-btn-sm" data-add="choice"><span class="demo-tag" style="background:#f59e0b;color:#000">+</span> Choice</button>\';' +
        'h+=\'<button class="demo-btn demo-btn-sm" data-add="logic"><span class="demo-tag" style="background:#10b981;color:#fff">+</span> Logic</button>\';' +
        'h+=\'</div>\';' +
        'if(!blocks.length){h+=\'<div style="text-align:center;color:#64748b;padding:20px;font-size:13px">No blocks yet. Add some using the buttons above.</div>\';}' +
        'blocks.forEach(function(b,i){' +
        'var tc=b.type==="text"?"#6366f1":b.type==="choice"?"#f59e0b":"#10b981";' +
        'var fc=b.type==="choice"?"#000":"#fff";' +
        'h+=\'<div style="display:flex;align-items:flex-start;gap:6px;margin:6px 0;padding:8px;background:rgba(15,23,42,.4);border-radius:6px;border:1px solid rgba(255,255,255,.06)">\';' +
        'h+=\'<div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:56px">\';' +
        'h+=\'<span class="demo-tag" style="background:\'+tc+\';color:\'+fc+\'">\'+b.type+\'</span>\';' +
        'h+=\'<div style="display:flex;gap:2px">\';' +
        'if(i>0)h+=\'<button data-mv="\'+i+\'" data-dir="-1" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:0 2px" title="Move up">\\u25B2</button>\';' +
        'if(i<blocks.length-1)h+=\'<button data-mv="\'+i+\'" data-dir="1" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:0 2px" title="Move down">\\u25BC</button>\';' +
        'h+=\'</div></div>\';' +
        'h+=\'<div style="flex:1;display:flex;flex-direction:column;gap:4px">\';' +
        'if(b.type==="text"){' +
        'h+=\'<input data-bi="\'+i+\'" data-f="char" value="\'+esc(b.char)+\'" placeholder="Speaker" style="\'+iSt+\'width:120px" />\';' +
        'h+=\'<input data-bi="\'+i+\'" data-f="text" value="\'+esc(b.text)+\'" placeholder="Dialogue text..." style="\'+iSt+\'width:100%" />\';' +
        '}else if(b.type==="choice"){' +
        'b.options.forEach(function(o,oi){' +
        'h+=\'<div style="display:flex;gap:4px;align-items:center">\';' +
        'h+=\'<span style="color:#64748b;font-size:11px;min-width:14px">\'+(oi+1)+\'.</span>\';' +
        'h+=\'<input data-bi="\'+i+\'" data-oi="\'+oi+\'" value="\'+esc(o)+\'" placeholder="Option" style="\'+iSt+\'flex:1" />\';' +
        'if(b.options.length>1)h+=\'<button data-bi="\'+i+\'" data-delopt="\'+oi+\'" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:13px">\\u00D7</button>\';' +
        'h+=\'</div>\';' +
        '});' +
        'h+=\'<button class="demo-btn demo-btn-sm demo-btn-outline" data-bi="\'+i+\'" data-addopt="1" style="font-size:11px;padding:2px 8px;align-self:flex-start">+ Option</button>\';' +
        '}else{' +
        'h+=\'<div style="display:flex;gap:4px;align-items:center">\';' +
        'h+=\'<input data-bi="\'+i+\'" data-f="varName" value="\'+esc(b.varName)+\'" placeholder="variable" style="\'+iSt+\'width:80px" />\';' +
        'h+=\'<select data-bi="\'+i+\'" data-f="op" style="\'+selSt+\'">\';' +
        '["=","+=","-="].forEach(function(op){h+=\'<option value="\'+op+\'"\' +(b.op===op?" selected":"")+\'>\'+op+\'</option>\';});' +
        'h+=\'</select>\';' +
        'h+=\'<input data-bi="\'+i+\'" data-f="val" value="\'+esc(b.val)+\'" placeholder="value" style="\'+iSt+\'width:60px" />\';' +
        'h+=\'</div>\';' +
        '}' +
        'h+=\'</div>\';' +
        'h+=\'<button data-del="\'+i+\'" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:2px 4px;line-height:1" title="Delete block">\\u00D7</button>\';' +
        'h+=\'</div>\';' +
        '});' +
        'if(blocks.length){h+=\'<div style="margin-top:12px;text-align:center"><button class="demo-btn" id="dlg-preview">\\u25B6 Preview Dialogue</button></div>\';}' +
        'h+=\'</div>\';' +
        'demo.innerHTML=h;' +
        'demo.querySelectorAll("[data-add]").forEach(function(btn){btn.onclick=function(){var t=btn.dataset.add;if(t==="text")blocks.push({type:"text",char:"Character",text:""});else if(t==="choice")blocks.push({type:"choice",options:["Option 1","Option 2"]});else blocks.push({type:"logic",varName:"score",op:"+=",val:"10"});rnd();};});' +
        'demo.querySelectorAll("[data-del]").forEach(function(btn){btn.onclick=function(){blocks.splice(parseInt(btn.dataset.del),1);rnd();};});' +
        'demo.querySelectorAll("[data-mv]").forEach(function(btn){btn.onclick=function(){var idx=parseInt(btn.dataset.mv),dir=parseInt(btn.dataset.dir),ni=idx+dir;if(ni<0||ni>=blocks.length)return;var tmp=blocks[idx];blocks[idx]=blocks[ni];blocks[ni]=tmp;rnd();};});' +
        'demo.querySelectorAll("input[data-bi][data-f]").forEach(function(el){el.oninput=function(){var bi=parseInt(el.dataset.bi);if(blocks[bi])blocks[bi][el.dataset.f]=el.value;};});' +
        'demo.querySelectorAll("select[data-bi][data-f]").forEach(function(el){el.onchange=function(){var bi=parseInt(el.dataset.bi);if(blocks[bi])blocks[bi][el.dataset.f]=el.value;};});' +
        'demo.querySelectorAll("input[data-bi][data-oi]").forEach(function(el){el.oninput=function(){var bi=parseInt(el.dataset.bi),oi=parseInt(el.dataset.oi);if(blocks[bi]&&blocks[bi].options)blocks[bi].options[oi]=el.value;};});' +
        'demo.querySelectorAll("[data-addopt]").forEach(function(btn){btn.onclick=function(){var bi=parseInt(btn.dataset.bi);if(blocks[bi])blocks[bi].options.push("Option "+(blocks[bi].options.length+1));rnd();};});' +
        'demo.querySelectorAll("[data-delopt]").forEach(function(btn){btn.onclick=function(){var bi=parseInt(btn.dataset.bi),oi=parseInt(btn.dataset.delopt);if(blocks[bi]&&blocks[bi].options.length>1)blocks[bi].options.splice(oi,1);rnd();};});' +
        'var pb=demo.querySelector("#dlg-preview");if(pb)pb.onclick=function(){mode="preview";pIdx=0;pVars={};rnd();};' +
        '}' +
        'function renderPreview(){' +
        'if(pIdx>=blocks.length){' +
        'var h=\'<div class="demo-box"><div style="text-align:center;color:#10b981;font-weight:600;padding:12px">\\u2713 Dialogue complete!</div>\';' +
        'var vk=Object.keys(pVars);if(vk.length){h+=\'<div style="margin-top:8px;font-size:12px;color:#94a3b8;text-align:center">Variables: \';vk.forEach(function(k){h+=\'<code>\'+k+\' = \'+pVars[k]+\'</code> \';});h+=\'</div>\';}' +
        'h+=\'<div style="text-align:center;margin-top:10px"><button class="demo-btn demo-btn-outline" id="dlg-back">\\u2190 Back to Editor</button></div></div>\';' +
        'demo.innerHTML=h;demo.querySelector("#dlg-back").onclick=function(){mode="edit";rnd();};return;}' +
        'var b=blocks[pIdx];' +
        'var h=\'<div class="demo-box"><div class="demo-label">Preview \\u2014 Block \'+(pIdx+1)+\'/\'+blocks.length+\' \\u2014 \'+b.type+\'</div>\';' +
        'if(b.type==="text"){' +
        'h+=\'<div style="background:rgba(0,0,0,.4);border-radius:8px;padding:16px;margin-top:8px;cursor:pointer" id="dlg-adv">\';' +
        'h+=\'<div style="color:#818cf8;font-weight:600;font-size:14px;margin-bottom:6px">\'+esc(b.char)+\'</div>\';' +
        'h+=\'<div style="color:#e2e8f0;font-size:15px">\'+esc(b.text)+\'</div>\';' +
        'h+=\'<div style="text-align:right;color:#64748b;font-size:12px;margin-top:8px">Click to advance \\u25B6</div></div>\';' +
        '}else if(b.type==="logic"){' +
        'h+=\'<div style="margin-top:8px;color:#10b981"><strong>\\u26A1 Logic:</strong> \'+esc(b.varName)+\' \'+b.op+\' \'+esc(b.val)+\'</div>\';' +
        'h+=\'<div style="color:#64748b;font-size:12px;margin-top:4px">(Auto-advancing...)</div>\';' +
        '}else if(b.type==="choice"){' +
        'h+=\'<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">\';' +
        'b.options.forEach(function(o,oi){h+=\'<div class="demo-btn demo-btn-outline" data-choice="\'+oi+\'">\'+esc(o)+\'</div>\';});' +
        'h+=\'</div>\';' +
        '}' +
        'h+=\'<div style="margin-top:10px"><button class="demo-btn demo-btn-sm demo-btn-outline" id="dlg-back">\\u2190 Back to Editor</button></div></div>\';' +
        'demo.innerHTML=h;' +
        'var adv=demo.querySelector("#dlg-adv");if(adv)adv.onclick=function(){pIdx++;rnd();};' +
        'if(b.type==="logic"){var cv=parseFloat(pVars[b.varName])||0;var nv=parseFloat(b.val)||0;if(b.op==="=")pVars[b.varName]=b.val;else if(b.op==="+=")pVars[b.varName]=cv+nv;else pVars[b.varName]=cv-nv;setTimeout(function(){pIdx++;rnd();},800);}' +
        'demo.querySelectorAll("[data-choice]").forEach(function(btn){btn.onclick=function(){pIdx++;rnd();};});' +
        'demo.querySelector("#dlg-back").onclick=function(){mode="edit";rnd();};' +
        '}' +
        'rnd();',
    },
  ];
}

// ════════════════════════════════════════════════════════════════════════════
// TUTORIAL 3 — The Cutscene Node
// ════════════════════════════════════════════════════════════════════════════

function cutsceneSteps() {
  return [
    {
      title: 'What Are Cutscene Nodes?',
      html:
        '<p><strong>Cutscene nodes</strong> let you create cinematic sequences — animated scenes with backgrounds, characters, camera moves, music, and text overlays.</p>' +
        '<p>Think of them as a <strong>timeline-based animation editor</strong>, similar to video editing software. You place clips on tracks and define keyframes for smooth animations.</p>' +
        '<div class="highlight">Cutscenes play automatically from start to finish. The player watches (and can optionally skip). When the cutscene ends, the game advances to the next connected node.</div>',
    },
    {
      title: 'Timeline & Tracks',
      html:
        '<p>The cutscene editor is organized around a <strong>timeline</strong> with multiple <strong>tracks</strong>:</p>' +
        '<div class="mini-timeline">' +
        '<div class="mini-track"><span class="mini-track-label">Background</span><div class="mini-track-bar"><div class="mini-clip" style="left:0;width:100%;background:rgba(99,102,241,.3)">bg.png</div></div></div>' +
        '<div class="mini-track"><span class="mini-track-label">Characters</span><div class="mini-track-bar"><div class="mini-clip" style="left:10%;width:60%;background:rgba(245,158,11,.3)">hero.png</div></div></div>' +
        '<div class="mini-track"><span class="mini-track-label">Audio</span><div class="mini-track-bar"><div class="mini-clip" style="left:0;width:80%;background:rgba(16,185,129,.3)">music.mp3</div></div></div>' +
        '<div class="mini-track"><span class="mini-track-label">Text</span><div class="mini-track-bar"><div class="mini-clip" style="left:20%;width:40%;background:rgba(139,92,246,.3)">"Once upon a time..."</div></div></div>' +
        '</div>' +
        '<p>Each track type serves a specific purpose. You can have multiple clips per track.</p>' +
        '<div class="highlight"><strong>Note:</strong> The <strong>camera</strong> is not a timeline track. It has its own dedicated panel, accessed via a button in the editor toolbar. See the "Camera, Audio &amp; Settings" step for details.</div>',
    },
    {
      title: 'Clips & Assets',
      html:
        '<p><strong>Clips</strong> are the building blocks of a cutscene. Each clip sits on a track and has a start/end time.</p>' +
        '<h4>Track Types</h4>' +
        '<ul>' +
        '<li><strong>Background</strong> — full-screen background images</li>' +
        '<li><strong>Character</strong> — character sprites that can be animated (moved, scaled, rotated, faded)</li>' +
        '<li><strong>Audio</strong> — background music (BGM) and sound effects (SFX) with volume keyframes</li>' +
        '<li><strong>Text</strong> — text overlays with optional typewriter effect, custom font/color</li>' +
        '</ul>' +
        '<p>To add a clip, <strong>double-click on a track</strong> at the desired time position. Try the interactive timeline below! Double-click a track to add clips, drag them to reposition, and drag clip edges to resize. Drag the <strong>playhead</strong> or click on the timeline to scrub through time. Press <strong>Play</strong> to watch the preview update in real time as the background, character, audio, and text clips become active.</p>' +
        '<div id="clip-demo"></div>',
      setup:
        'var demo=contentEl.querySelector("#clip-demo");' +
        'var DUR=10;var tNames=["Background","Characters","Audio","Text"];' +
        'var tClr=["rgba(99,102,241,.4)","rgba(245,158,11,.4)","rgba(16,185,129,.4)","rgba(139,92,246,.4)"];' +
        'var bgDataUrl="' + TUT_BG_DATA_URL + '";' +
        'var charDataUrl="' + TUT_CHAR_DATA_URL + '";' +
        'var audioDataUrl="' + TUT_AUDIO_DATA_URL + '";' +
        'var clips=[{track:0,name:"Sunset Forest",start:0,dur:10,imgUrl:bgDataUrl},{track:1,name:"Wizard",start:1,dur:6,imgUrl:charDataUrl},{track:2,name:"Adventure Theme",start:0,dur:8,audioUrl:audioDataUrl},{track:3,name:"Once upon a time...",start:2,dur:4,text:"Once upon a time..."}];' +
        'var sel=-1,playing=false,ct=0,raf=null,lastF=null;' +
        'var dragMode=null,dragClip=-1,dragStart=null,phDrag=false;' +
        'var audioEl=new Audio(audioDataUrl);audioEl.preload="auto";' +
        'var iSt="background:rgba(30,41,59,.8);border:1px solid rgba(255,255,255,.15);border-radius:4px;color:#e2e8f0;font-size:12px;padding:3px 6px;outline:none;";' +
        'function esc(s){return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");}' +
        // Build persistent shell: stage (never re-rendered) + timeline container (re-rendered by rnd)
        'demo.innerHTML=' +
        '\'<div class="demo-box"><div class="demo-label">Timeline Clip Editor</div>\'+' +
        '\'<div id="tl-stage" style="position:relative;width:100%;padding-bottom:56.25%;background:#0f172a;border-radius:8px;overflow:hidden;margin-bottom:12px">\'+' +
        '\'<img id="tl-stage-bg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .3s" />\'+' +
        '\'<img id="tl-stage-char" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-height:70%;opacity:0;transition:opacity .3s" />\'+' +
        '\'<div id="tl-stage-text" style="position:absolute;bottom:0;left:0;right:0;padding:16px 20px;background:linear-gradient(transparent,rgba(0,0,0,.7));color:#fff;font-size:16px;text-align:center;opacity:0;transition:opacity .3s"></div>\'+' +
        '\'</div>\'+' +
        '\'<div id="tl-timeline"></div></div>\';' +
        'demo.querySelector("#tl-stage-bg").src=bgDataUrl;' +
        'demo.querySelector("#tl-stage-char").src=charDataUrl;' +
        // Drag handlers
        'function onMM(e){' +
        'if(phDrag){var tr=demo.querySelector("#tl-tracks");if(tr){var r=tr.getBoundingClientRect();ct=Math.max(0,Math.min(DUR,(e.clientX-r.left)/r.width*DUR));var ph=demo.querySelector("#tl-ph");var te=demo.querySelector("#tl-time");if(ph)ph.style.left=(ct/DUR*100)+"%";if(te)te.textContent=ct.toFixed(1)+"s";updatePreview(ct);}return;}' +
        'if(!dragMode||dragClip<0)return;' +
        'var tr=demo.querySelector("#tl-tracks");if(!tr)return;' +
        'var r=tr.getBoundingClientRect();var mx=(e.clientX-r.left)/r.width*DUR;var c=clips[dragClip];if(!c)return;var dx=mx-dragStart.mx;' +
        'if(dragMode==="move"){c.start=Math.max(0,Math.min(DUR-c.dur,Math.round((dragStart.os+dx)*10)/10));}' +
        'else if(dragMode==="resizeL"){var end=dragStart.os+dragStart.od;c.start=Math.max(0,Math.min(end-0.2,Math.round((dragStart.os+dx)*10)/10));c.dur=Math.round((end-c.start)*10)/10;}' +
        'else{c.dur=Math.max(0.2,Math.min(DUR-c.start,Math.round((dragStart.od+dx)*10)/10));}' +
        'var el=tr.querySelector(\'[data-clip="\'+dragClip+\'"]\');if(el){el.style.left=(c.start/DUR*100)+"%";el.style.width=(c.dur/DUR*100)+"%";}}' +
        'function onMU(){if(phDrag){phDrag=false;rnd();return;}if(dragMode){dragMode=null;dragClip=-1;rnd();}}' +
        'document.addEventListener("mousemove",onMM);document.addEventListener("mouseup",onMU);' +
        // Preview update: show/hide layers and control audio based on current time
        'function updatePreview(t){' +
        'var bgEl=demo.querySelector("#tl-stage-bg");' +
        'var charEl=demo.querySelector("#tl-stage-char");' +
        'var textEl=demo.querySelector("#tl-stage-text");' +
        'if(!bgEl)return;' +
        'var bgActive=false,charActive=false,textContent=null,audioActive=false,activeAudioClip=null;' +
        'for(var i=0;i<clips.length;i++){var c=clips[i];var active=t>=c.start&&t<c.start+c.dur;' +
        'if(active){' +
        'if(c.track===0&&c.imgUrl)bgActive=true;' +
        'if(c.track===1&&c.imgUrl)charActive=true;' +
        'if(c.track===2&&c.audioUrl){audioActive=true;activeAudioClip=c;}' +
        'if(c.track===3&&c.text)textContent=c.text;' +
        '}}' +
        'bgEl.style.opacity=bgActive?"1":"0";' +
        'charEl.style.opacity=charActive?"1":"0";' +
        'textEl.style.opacity=textContent?"1":"0";' +
        'if(textContent)textEl.textContent=textContent;' +
        'if(audioActive&&playing&&activeAudioClip){' +
        'if(audioEl.paused){audioEl.currentTime=t-activeAudioClip.start;audioEl.play().catch(function(){});}}' +
        'else{if(!audioEl.paused)audioEl.pause();}}' +
        // Timeline render (only rebuilds the timeline portion, not the stage)
        'function rnd(){' +
        'var tl=demo.querySelector("#tl-timeline");' +
        'var h=\'<div style="display:flex;gap:8px">\';' +
        'h+=\'<div style="width:80px;flex-shrink:0;display:flex;flex-direction:column">\';' +
        'tNames.forEach(function(n){h+=\'<div style="height:32px;margin:2px 0;display:flex;align-items:center;justify-content:flex-end;padding-right:4px"><span style="font-size:12px;color:#94a3b8">\'+n+\'</span></div>\';});' +
        'h+=\'</div>\';' +
        'h+=\'<div id="tl-tracks" style="flex:1;position:relative">\';' +
        'tNames.forEach(function(n,ti){' +
        'h+=\'<div data-track="\'+ti+\'" style="height:32px;margin:2px 0;background:rgba(30,41,59,.6);border-radius:4px;position:relative">\';' +
        'clips.forEach(function(c,ci){if(c.track!==ti)return;' +
        'var l=(c.start/DUR*100),w=(c.dur/DUR*100),isSel=ci===sel;' +
        'var ol=isSel?";outline:2px solid #818cf8;outline-offset:-2px;z-index:5":"";' +
        'h+=\'<div data-clip="\'+ci+\'" style="position:absolute;left:\'+l+\'%;width:\'+w+\'%;height:100%;background:\'+tClr[ti]+\';border-radius:4px;cursor:move;display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(255,255,255,.8);overflow:hidden;white-space:nowrap;user-select:none\'+ol+\'">\';' +
        'if(isSel){h+=\'<div data-edge="left" data-clip="\'+ci+\'" style="position:absolute;left:0;top:0;width:6px;height:100%;cursor:ew-resize;z-index:6;background:rgba(129,140,248,.3);border-radius:4px 0 0 4px"></div>\';' +
        'h+=\'<div data-edge="right" data-clip="\'+ci+\'" style="position:absolute;right:0;top:0;width:6px;height:100%;cursor:ew-resize;z-index:6;background:rgba(129,140,248,.3);border-radius:0 4px 4px 0"></div>\';}' +
        'h+=\'<span style="pointer-events:none">\'+esc(c.name)+\'</span></div>\';' +
        '});h+=\'</div>\';});' +
        'h+=\'<div id="tl-ph" style="position:absolute;top:-6px;left:\'+(ct/DUR*100)+\'%;height:calc(100% + 6px);width:14px;transform:translateX(-50%);z-index:10;cursor:grab"><div style="position:absolute;left:50%;top:6px;width:2px;height:calc(100% - 6px);background:#818cf8;border-radius:1px;pointer-events:none;transform:translateX(-50%)"></div><div style="position:absolute;left:50%;top:0;width:10px;height:10px;border-radius:50%;background:#818cf8;pointer-events:none;transform:translateX(-50%)"></div></div>\';' +
        'h+=\'</div></div>\';' +
        'h+=\'<div style="display:flex;gap:8px;margin-top:4px"><div style="width:80px;flex-shrink:0"></div><div style="flex:1;display:flex;justify-content:space-between;font-size:10px;color:#64748b">\';' +
        'for(var t=0;t<=DUR;t+=2)h+=\'<span>\'+t+\'s</span>\';' +
        'h+=\'</div></div>\';' +
        'h+=\'<div style="display:flex;gap:8px;margin-top:8px;align-items:center">\';' +
        'h+=\'<button class="demo-btn demo-btn-sm" id="tl-play">\'+(playing?"\\u23F9 Stop":"\\u25B6 Play")+\'</button>\';' +
        'h+=\'<span id="tl-time" style="font-size:12px;font-family:monospace;color:#e2e8f0">\'+ct.toFixed(1)+\'s</span>\';' +
        'if(sel>=0)h+=\'<button class="demo-btn demo-btn-sm demo-btn-danger" id="tl-del" style="margin-left:auto">Delete Clip</button>\';' +
        'h+=\'</div>\';' +
        'if(sel>=0&&clips[sel]){var c=clips[sel];' +
        'h+=\'<div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">\';' +
        'h+=\'<span style="font-size:12px;color:#64748b">Name:</span><input id="tl-name" value="\'+esc(c.name)+\'" style="\'+iSt+\'width:100px" />\';' +
        'h+=\'<span style="font-size:12px;color:#64748b;margin-left:6px">Start:</span><span style="font-size:12px;font-family:monospace;color:#e2e8f0">\'+c.start.toFixed(1)+\'s</span>\';' +
        'h+=\'<span style="font-size:12px;color:#64748b;margin-left:6px">Duration:</span><span style="font-size:12px;font-family:monospace;color:#e2e8f0">\'+c.dur.toFixed(1)+\'s</span>\';' +
        'h+=\'</div>\';' +
        '}else{h+=\'<div style="margin-top:8px;font-size:12px;color:#64748b">Double-click a track to add a clip. Click a clip to select, drag to move, drag edges to resize.</div>\';}' +
        'tl.innerHTML=h;' +
        'demo.querySelector("#tl-play").onclick=function(){playing=!playing;if(playing){lastF=null;tick();}else{ct=0;audioEl.pause();rnd();}};' +
        'var db=demo.querySelector("#tl-del");if(db)db.onclick=function(){clips.splice(sel,1);sel=-1;rnd();};' +
        'var ni=demo.querySelector("#tl-name");if(ni)ni.oninput=function(){if(clips[sel])clips[sel].name=ni.value;};' +
        'var tr=demo.querySelector("#tl-tracks");' +
        'tr.ondblclick=function(e){var td=e.target;while(td&&!td.dataset.track&&td!==tr)td=td.parentElement;if(!td||!td.dataset.track)return;if(e.target.closest&&e.target.closest("[data-clip]"))return;var ti=parseInt(td.dataset.track);var r=td.getBoundingClientRect();var mx=(e.clientX-r.left)/r.width;var st=Math.max(0,Math.min(DUR-1,Math.round(mx*DUR*10)/10));var nc={track:ti,name:tNames[ti]+" "+(clips.length+1),start:st,dur:2};var ref=null;for(var i=0;i<clips.length;i++){if(clips[i].track===ti){ref=clips[i];break;}}if(ref){if(ref.imgUrl)nc.imgUrl=ref.imgUrl;if(ref.audioUrl)nc.audioUrl=ref.audioUrl;if(ref.text)nc.text=ref.text;}else{if(ti===0)nc.imgUrl=bgDataUrl;else if(ti===1)nc.imgUrl=charDataUrl;else if(ti===2)nc.audioUrl=audioDataUrl;else nc.text="New text";}clips.push(nc);sel=clips.length-1;rnd();};' +
        'tr.onmousedown=function(e){var phEl=demo.querySelector("#tl-ph");if(phEl&&(e.target===phEl||phEl.contains(e.target))){phDrag=true;e.preventDefault();return;}var edgeEl=null,clipEl=null,t=e.target;while(t&&t!==tr){if(t.dataset.edge)edgeEl=t;if(t.dataset.clip!==undefined)clipEl=t;t=t.parentElement;}if(!clipEl)return;var ci=parseInt(clipEl.dataset.clip);sel=ci;var r=tr.getBoundingClientRect();var mx=(e.clientX-r.left)/r.width*DUR;if(edgeEl){dragMode=edgeEl.dataset.edge==="left"?"resizeL":"resizeR";}else{dragMode="move";}dragClip=ci;dragStart={mx:mx,os:clips[ci].start,od:clips[ci].dur};rnd();e.preventDefault();};' +
        'updatePreview(ct);}' +
        // Playback tick: advance time, update playhead, and refresh preview each frame
        'function tick(){if(!playing){lastF=null;return;}var now=performance.now();if(lastF!==null){var dt=(now-lastF)/1000;ct+=dt;if(ct>DUR){ct=0;audioEl.pause();}}lastF=now;' +
        'var ph=demo.querySelector("#tl-ph");var te=demo.querySelector("#tl-time");if(ph)ph.style.left=(ct/DUR*100)+"%";if(te)te.textContent=ct.toFixed(1)+"s";' +
        'updatePreview(ct);raf=requestAnimationFrame(tick);}' +
        'rnd();' +
        'api.onCleanup(function(){playing=false;if(raf)cancelAnimationFrame(raf);audioEl.pause();audioEl.src="";document.removeEventListener("mousemove",onMM);document.removeEventListener("mouseup",onMU);});',
    },
    {
      title: 'Keyframes & Animation',
      html:
        '<p><strong>Keyframes</strong> define how a clip\'s properties change over time. The editor smoothly interpolates between keyframes to create animations.</p>' +
        '<h4>Animatable Properties (Character Clips)</h4>' +
        '<div class="demo-grid" style="grid-template-columns:1fr 1fr 1fr">' +
        '<div class="demo-card" style="text-align:center"><strong>Position</strong><br>x, y</div>' +
        '<div class="demo-card" style="text-align:center"><strong>Transform</strong><br>rotation, scaleX, scaleY</div>' +
        '<div class="demo-card" style="text-align:center"><strong>Opacity</strong><br>0 (invisible) to 1</div>' +
        '</div>' +
        '<h4>Interpolation Modes</h4>' +
        '<ul>' +
        '<li><code>linear</code> — constant speed</li>' +
        '<li><code>ease-in</code> — starts slow, speeds up</li>' +
        '<li><code>ease-out</code> — starts fast, slows down</li>' +
        '<li><code>ease-in-out</code> — smooth start and end</li>' +
        '<li><code>instant</code> — jumps immediately</li>' +
        '</ul>' +
        '<h4>Adding Keyframes</h4>' +
        '<p>To animate a property, position the <strong>playhead</strong> at the desired time, then click <strong>+ Add</strong> next to the property. Set the value for each keyframe — the editor interpolates between them during playback.</p>' +
        '<p>Try it out below! Click <strong>+ Add</strong> twice to create two rotation keyframes, then press <strong>Play</strong> to watch the animation. The <strong>Play</strong> button works at any time — try it with zero or one keyframe to see the difference! You can also delete keyframes with the <strong>×</strong> button. After adding keyframes you can edit each keyframe\'s time, value, and interpolation mode to see how they affect the result — play around with it! This preview assumes a 5-second track, so keyframe times cannot exceed 5s.</p>' +
        '<div id="anim-demo"></div>',
      setup:
        'var demo=contentEl.querySelector("#anim-demo");' +
        'var keyframes=[];var playing=false;var currentTime=0;var raf=null;var DURATION=5;var lastFrame=null;' +
        'var inputSt="background:rgba(30,41,59,.8);border:1px solid rgba(255,255,255,.15);border-radius:3px;color:#e2e8f0;font-family:monospace;font-size:10px;padding:1px 3px;text-align:right;outline:none;";' +
        'var selectSt="background:rgba(30,41,59,.8);border:1px solid rgba(255,255,255,.15);border-radius:3px;color:#94a3b8;font-size:10px;padding:1px 2px;outline:none;";' +
        'demo.innerHTML=\'<div class="demo-box"><div class="demo-label">Keyframe Animation Preview</div>\'+' +
        '\'<div style="display:flex;align-items:center;justify-content:center;height:120px;background:rgba(15,23,42,.6);border-radius:8px;margin:8px 0">\'+' +
        '\'<div id="anim-shape" style="width:60px;height:60px;background:rgba(99,102,241,.25);border:2px solid #818cf8;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#818cf8">\\u25B2</div>\'+' +
        '\'</div>\'+' +
        '\'<div style="margin:10px 0">\'+' +
        '\'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">\'+' +
        '\'<span style="font-size:11px;color:#94a3b8;width:56px">Rotation</span>\'+' +
        '\'<span id="kf-val" style="font-size:11px;font-family:monospace;color:#e2e8f0;width:48px;text-align:right">0.0\\u00B0</span>\'+' +
        '\'<button id="kf-add" class="demo-btn demo-btn-sm" style="margin-left:auto;font-size:11px;padding:3px 10px">+ Add</button>\'+' +
        '\'</div>\'+' +
        '\'<div id="kf-list" style="margin-left:8px;border-left:2px solid rgba(255,255,255,.1);padding-left:8px"></div>\'+' +
        '\'</div>\'+' +
        '\'<div style="position:relative;margin:12px 0">\'+' +
        '\'<div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b;margin-bottom:4px"><span>0s</span><span>5s</span></div>\'+' +
        '\'<div id="kf-track" style="position:relative;height:20px;background:rgba(30,41,59,.8);border-radius:4px">\'+' +
        '\'<div id="kf-playhead" style="position:absolute;top:-2px;left:0;width:2px;height:24px;background:#818cf8;border-radius:1px"></div>\'+' +
        '\'</div>\'+' +
        '\'<div id="kf-time" style="text-align:center;font-size:11px;color:#94a3b8;margin-top:4px">0.00s</div>\'+' +
        '\'</div>\'+' +
        '\'<div style="text-align:center">\'+' +
        '\'<button id="anim-toggle" class="demo-btn">\\u25B6 Play</button>\'+' +
        '\'</div></div>\';' +
        'var shape=demo.querySelector("#anim-shape");' +
        'var valDisplay=demo.querySelector("#kf-val");' +
        'var addBtn=demo.querySelector("#kf-add");' +
        'var kfList=demo.querySelector("#kf-list");' +
        'var playhead=demo.querySelector("#kf-playhead");' +
        'var timeDisplay=demo.querySelector("#kf-time");' +
        'var toggleBtn=demo.querySelector("#anim-toggle");' +
        'var track=demo.querySelector("#kf-track");' +
        'var interpOpts=["linear","ease-in","ease-out","ease-in-out","instant"];' +
        'function renderKf(){' +
        'var h="";for(var i=0;i<keyframes.length;i++){var kf=keyframes[i];' +
        'h+=\'<div style="display:flex;align-items:center;gap:4px;margin:3px 0;font-size:11px">\'+' +
        '\'<span style="color:#fbbf24">\\u25C6</span>\'+' +
        '\'<input type="number" data-ki="\'+i+\'" data-f="t" value="\'+kf.time+\'" step="0.1" min="0" max="5" style="\'+inputSt+\'width:40px" />\'+' +
        '\'<span style="color:#64748b;font-size:10px">s</span>\'+' +
        '\'<input type="number" data-ki="\'+i+\'" data-f="v" value="\'+kf.value+\'" step="1" style="\'+inputSt+\'width:48px" />\'+' +
        '\'<span style="color:#64748b;font-size:10px">\\u00B0</span>\'+' +
        '\'<select data-ki="\'+i+\'" data-f="i" style="\'+selectSt+\'">\';' +
        'for(var j=0;j<interpOpts.length;j++){' +
        'h+=\'<option value="\'+interpOpts[j]+\'"\'+' +
        '(kf.interp===interpOpts[j]?\' selected\':\'\')+\'>\'+interpOpts[j]+\'</option>\';}' +
        'h+=\'</select>\'+' +
        '\'<button data-del="\'+i+\'" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:13px;padding:0 2px;line-height:1" title="Delete keyframe">\\u00D7</button>\'+' +
        '\'</div>\';}' +
        'kfList.innerHTML=h;}' +
        'kfList.addEventListener("click",function(e){' +
        'var del=e.target.getAttribute("data-del");if(del===null)return;' +
        'keyframes.splice(parseInt(del),1);renderKf();renderMarkers();updateDisplay();});' +
        'kfList.addEventListener("input",function(e){' +
        'var el=e.target;var ki=parseInt(el.getAttribute("data-ki"));var f=el.getAttribute("data-f");' +
        'if(isNaN(ki)||!f)return;var kf=keyframes[ki];if(!kf)return;' +
        'if(f==="t"){kf.time=Math.max(0,Math.min(DURATION,parseFloat(el.value)||0));}' +
        'else if(f==="v"){kf.value=parseFloat(el.value)||0;}' +
        'renderMarkers();updateDisplay();});' +
        'kfList.addEventListener("change",function(e){' +
        'var el=e.target;var ki=parseInt(el.getAttribute("data-ki"));var f=el.getAttribute("data-f");' +
        'if(isNaN(ki)||!f)return;var kf=keyframes[ki];if(!kf)return;' +
        'if(f==="i"){kf.interp=el.value;}' +
        'else if(f==="t"){kf.time=Math.max(0,Math.min(DURATION,parseFloat(el.value)||0));}' +
        'else if(f==="v"){kf.value=parseFloat(el.value)||0;}' +
        'renderMarkers();updateDisplay();});' +
        'function renderMarkers(){' +
        'var old=track.querySelectorAll(".kf-mk");for(var i=0;i<old.length;i++)old[i].remove();' +
        'for(var i=0;i<keyframes.length;i++){var m=document.createElement("div");m.className="kf-mk";' +
        'm.style.cssText="position:absolute;top:50%;left:"+(keyframes[i].time/DURATION*100)+"%;transform:translate(-50%,-50%) rotate(45deg);width:8px;height:8px;background:#818cf8;border-radius:1px";' +
        'track.appendChild(m);}}' +
        'function getEasing(mode){' +
        'if(mode==="ease-in")return function(k){return k*k;};' +
        'if(mode==="ease-out")return function(k){return k*(2-k);};' +
        'if(mode==="ease-in-out")return function(k){return k<0.5?2*k*k:-1+(4-2*k)*k;};' +
        'if(mode==="instant")return function(){return 1;};' +
        'return function(k){return k;};}' +
        'function interpolate(t){' +
        'if(keyframes.length<2)return keyframes.length?keyframes[0].value:0;' +
        'var sorted=keyframes.slice().sort(function(a,b){return a.time-b.time;});' +
        'if(t<=sorted[0].time)return sorted[0].value;' +
        'var last=sorted[sorted.length-1];if(t>=last.time)return last.value;' +
        'for(var i=0;i<sorted.length-1;i++){var a=sorted[i],b=sorted[i+1];' +
        'if(t>=a.time&&t<b.time){var p=(t-a.time)/(b.time-a.time);var ep=getEasing(b.interp)(p);return a.value+(b.value-a.value)*ep;}}' +
        'return last.value;}' +
        'function updateDisplay(){' +
        'var val=interpolate(currentTime);' +
        'shape.style.transform="rotate("+val+"deg)";' +
        'valDisplay.textContent=val.toFixed(1)+"\\u00B0";' +
        'playhead.style.left=(currentTime/DURATION*100)+"%";' +
        'timeDisplay.textContent=currentTime.toFixed(2)+"s";}' +
        'addBtn.onclick=function(){' +
        'if(keyframes.length===0){keyframes.push({time:0,value:0,interp:"linear"});}' +
        'else if(keyframes.length===1){keyframes.push({time:3,value:90,interp:"linear"});}' +
        'else{keyframes.push({time:Math.min(DURATION,keyframes.length*1.5),value:0,interp:"linear"});}' +
        'renderKf();renderMarkers();};' +
        'toggleBtn.onclick=function(){' +
        'playing=!playing;toggleBtn.textContent=playing?"\\u23F8 Pause":"\\u25B6 Play";' +
        'if(playing)tick();};' +
        'function tick(){if(!playing){lastFrame=null;return;}' +
        'var now=performance.now();if(lastFrame!==null){var dt=(now-lastFrame)/1000;currentTime+=dt;if(currentTime>DURATION)currentTime=0;}' +
        'lastFrame=now;updateDisplay();raf=requestAnimationFrame(tick);}' +
        'updateDisplay();' +
        'api.onCleanup(function(){playing=false;if(raf)cancelAnimationFrame(raf);});',
    },
    {
      title: 'Camera, Audio & Settings',
      html:
        '<p>Two powerful features complete the cutscene toolkit:</p>' +
        '<h4>Camera (Separate Panel)</h4>' +
        '<p>The camera is controlled via a <strong>dedicated panel</strong>, not through the timeline tracks. Open it by clicking the camera button in the editor toolbar. The camera has <strong>global keyframes</strong> for <code>x</code>, <code>y</code> (position) and <code>zoom</code> (1 = normal, 2 = zoomed in). Unlike clip animations, camera keyframes apply to the entire cutscene, not to individual clips.</p>' +
        '<h4>Audio Volume</h4>' +
        '<p>Audio clips support <strong>volume keyframes</strong>, letting you fade music in/out over time. Set the audio type to either <code>BGM</code> (background music) or <code>SFX</code> (sound effect).</p>' +
        '<h4>Cutscene Settings</h4>' +
        '<ul>' +
        '<li><strong>Duration</strong> — total length in seconds</li>' +
        '<li><strong>Skip enabled</strong> — whether the player can skip the cutscene</li>' +
        '<li><strong>Loop in editor</strong> — loop playback while editing</li>' +
        '</ul>' +
        '<div class="highlight">When the cutscene finishes playing (or is skipped), the game automatically follows the node\'s default output edge to the next scene.</div>',
    },
  ];
}

// ════════════════════════════════════════════════════════════════════════════
// TUTORIAL 4 — The Point-and-Click Node
// ════════════════════════════════════════════════════════════════════════════

function pointAndClickSteps() {
  return [
    {
      title: 'What Are Point-and-Click Nodes?',
      html:
        '<p><strong>Point-and-click nodes</strong> build interactive scenes: the player sees a background image and clicks <strong>hotspots</strong> — regions that can show messages, run actions, offer choices, or transition to other nodes.</p>' +
        '<p>These are perfect for:</p>' +
        '<ul>' +
        '<li>Exploration and investigation scenes</li>' +
        '<li>Puzzle rooms</li>' +
        '<li>Inventory-based interactions</li>' +
        '<li>Navigation menus (like this tutorial\'s hub!)</li>' +
        '</ul>' +
        '<div class="highlight">The player stays on the scene until they click a hotspot with a <strong>transition</strong> action that sends them to another node.</div>',
    },
    {
      title: 'Backgrounds & Hotspots',
      html:
        '<p>A point-and-click scene has two main components:</p>' +
        '<ol>' +
        '<li><strong>Background image</strong> — the scene\'s visual backdrop (set via asset ID). You can also control the <strong>background size</strong> (<code>cover</code>, <code>contain</code>, or <code>fill</code>) and <strong>background position</strong> (<code>start</code>, <code>center</code>, or <code>end</code>) in the scene settings.</li>' +
        '<li><strong>Hotspots</strong> — invisible rectangular click areas overlaid on the background</li>' +
        '</ol>' +
        '<h4>Hotspot Properties</h4>' +
        '<p>Each hotspot is defined by:</p>' +
        '<ul>' +
        '<li><strong>Name</strong> — shown as a tooltip on hover</li>' +
        '<li><strong>Position</strong> — <code>x</code>, <code>y</code> as percentages (0–100)</li>' +
        '<li><strong>Size</strong> — <code>width</code>, <code>height</code> as percentages</li>' +
        '<li><strong>Message Position</strong> — whether messages and choices appear at the <code>top</code> or <code>bottom</code> of the screen</li>' +
        '</ul>' +
        '<p>In the editor, you switch to <strong>Draw Hotspot</strong> mode and drag on the canvas to create hotspots. Switch back to <strong>Select</strong> mode to click, move, and resize them. Try it below!</p>' +
        '<div id="hotspot-demo"></div>',
      setup:
        'var demo=contentEl.querySelector("#hotspot-demo");' +
        'var spots=[{name:"Door",x:10,y:20,w:25,h:50},{name:"Window",x:60,y:10,w:30,h:35}];' +
        'var sel=-1,hsMode="select";' +
        'var drawing=false,drawStart=null,drawCur=null;' +
        'var dragging=false,dragStart=null;' +
        'var resizing=false,resizeCorner=-1;' +
        'var iSt="background:rgba(30,41,59,.8);border:1px solid rgba(255,255,255,.15);border-radius:4px;color:#e2e8f0;font-size:12px;padding:3px 6px;outline:none;";' +
        'function esc(s){return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");}' +
        'function onMM(e){' +
        'if(!drawing&&!dragging&&!resizing)return;' +
        'var cv=demo.querySelector("#hs-canvas");if(!cv)return;' +
        'var r=cv.getBoundingClientRect();' +
        'var mx=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));' +
        'var my=Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100));' +
        'if(drawing){drawCur={x:mx,y:my};var rb=document.getElementById("hs-rb");if(rb){var x1=Math.min(drawStart.x,mx),y1=Math.min(drawStart.y,my);rb.style.left=x1+"%";rb.style.top=y1+"%";rb.style.width=Math.abs(mx-drawStart.x)+"%";rb.style.height=Math.abs(my-drawStart.y)+"%";}}' +
        'else if(dragging&&spots[sel]){var dx=mx-dragStart.mx,dy=my-dragStart.my;spots[sel].x=Math.max(0,Math.min(100-spots[sel].w,dragStart.ox+dx));spots[sel].y=Math.max(0,Math.min(100-spots[sel].h,dragStart.oy+dy));var el=cv.querySelector("[data-hs=\\""+sel+"\\"]");if(el){el.style.left=spots[sel].x+"%";el.style.top=spots[sel].y+"%";}}' +
        'else if(resizing&&spots[sel]&&dragStart){var s=dragStart.snap;var rx=s.x+s.w,by=s.y+s.h;if(resizeCorner===0){spots[sel].x=Math.min(rx-3,mx);spots[sel].y=Math.min(by-3,my);spots[sel].w=rx-spots[sel].x;spots[sel].h=by-spots[sel].y;}else if(resizeCorner===1){spots[sel].y=Math.min(by-3,my);spots[sel].w=Math.max(3,mx-s.x);spots[sel].h=by-spots[sel].y;}else if(resizeCorner===2){spots[sel].x=Math.min(rx-3,mx);spots[sel].w=rx-spots[sel].x;spots[sel].h=Math.max(3,my-s.y);}else{spots[sel].w=Math.max(3,mx-s.x);spots[sel].h=Math.max(3,my-s.y);}' +
        'rnd();}' +
        '}' +
        'function onMU(e){' +
        'if(drawing){drawing=false;var rb=document.getElementById("hs-rb");if(rb)rb.remove();' +
        'var x1=Math.min(drawStart.x,drawCur.x),y1=Math.min(drawStart.y,drawCur.y);var w=Math.abs(drawCur.x-drawStart.x),h=Math.abs(drawCur.y-drawStart.y);' +
        'if(w>2&&h>2){spots.push({name:"Hotspot "+(spots.length+1),x:Math.round(x1),y:Math.round(y1),w:Math.round(w),h:Math.round(h)});sel=spots.length-1;hsMode="select";}rnd();}' +
        'else if(dragging){dragging=false;rnd();}' +
        'else if(resizing){resizing=false;rnd();}' +
        '}' +
        'document.addEventListener("mousemove",onMM);document.addEventListener("mouseup",onMU);' +
        'function rnd(){' +
        'var h=\'<div class="demo-box"><div class="demo-label">Hotspot Drawing Canvas</div>\';' +
        'h+=\'<div style="display:flex;gap:6px;margin-bottom:8px">\';' +
        'h+=\'<button class="demo-btn demo-btn-sm\'+(hsMode==="select"?\'\':\' demo-btn-outline\')+\'" id="hs-m-sel">\\u{1F5B1} Select</button>\';' +
        'h+=\'<button class="demo-btn demo-btn-sm\'+(hsMode==="draw"?\'\':\' demo-btn-outline\')+\'" id="hs-m-draw">\\u270F Draw Hotspot</button>\';' +
        'if(sel>=0)h+=\'<button class="demo-btn demo-btn-sm demo-btn-danger" id="hs-del" style="margin-left:auto">Delete</button>\';' +
        'h+=\'</div>\';' +
        'h+=\'<div id="hs-canvas" style="position:relative;width:100%;height:200px;background:linear-gradient(135deg,#1e293b,#0f172a);border-radius:6px;overflow:hidden;cursor:\'+(hsMode==="draw"?"crosshair":"default")+\';user-select:none">\';' +
        'spots.forEach(function(s,i){' +
        'var isSel=i===sel;' +
        'var bdr=isSel?"border:2px solid #818cf8":"border:2px dashed rgba(255,255,255,.3)";' +
        'var bg=isSel?"background:rgba(129,140,248,.15)":"background:rgba(255,255,255,.05)";' +
        'h+=\'<div data-hs="\'+i+\'" style="position:absolute;left:\'+s.x+\'%;top:\'+s.y+\'%;width:\'+s.w+\'%;height:\'+s.h+\'%;\'+bdr+\';\'+bg+\';border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#94a3b8;cursor:\'+(hsMode==="select"?"move":"crosshair")+\'">\'+s.name+\'</div>\';' +
        'if(isSel&&hsMode==="select"){var cx=[s.x,s.x+s.w,s.x,s.x+s.w],cy=[s.y,s.y,s.y+s.h,s.y+s.h],curs=["nwse-resize","nesw-resize","nesw-resize","nwse-resize"];for(var ci=0;ci<4;ci++){h+=\'<div data-resize="\'+ci+\'" style="position:absolute;left:\'+cx[ci]+\'%;top:\'+cy[ci]+\'%;width:8px;height:8px;background:#818cf8;border-radius:2px;transform:translate(-50%,-50%);cursor:\'+curs[ci]+\';z-index:10"></div>\';}}' +
        '});' +
        'h+=\'</div>\';' +
        'if(sel>=0&&spots[sel]){var s=spots[sel];' +
        'h+=\'<div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">\';' +
        'h+=\'<span style="font-size:12px;color:#64748b">Name:</span>\';' +
        'h+=\'<input id="hs-name" value="\'+esc(s.name)+\'" style="\'+iSt+\'width:120px" />\';' +
        'h+=\'<span style="font-size:12px;color:#64748b;margin-left:8px">Pos:</span>\';' +
        'h+=\'<span style="font-size:12px;font-family:monospace;color:#e2e8f0">\'+Math.round(s.x)+\'%, \'+Math.round(s.y)+\'%</span>\';' +
        'h+=\'<span style="font-size:12px;color:#64748b;margin-left:8px">Size:</span>\';' +
        'h+=\'<span style="font-size:12px;font-family:monospace;color:#e2e8f0">\'+Math.round(s.w)+\'% \\u00D7 \'+Math.round(s.h)+\'%</span>\';' +
        'h+=\'</div>\';' +
        '}else{h+=\'<div style="margin-top:8px;font-size:12px;color:#64748b">\'+(hsMode==="draw"?"Click and drag on the canvas to draw a hotspot":"Click a hotspot to select it, then drag to move or use corner handles to resize")+\'</div>\';}' +
        'h+=\'</div>\';' +
        'demo.innerHTML=h;' +
        'demo.querySelector("#hs-m-sel").onclick=function(){hsMode="select";rnd();};' +
        'demo.querySelector("#hs-m-draw").onclick=function(){hsMode="draw";sel=-1;rnd();};' +
        'var delBtn=demo.querySelector("#hs-del");if(delBtn)delBtn.onclick=function(){spots.splice(sel,1);sel=-1;rnd();};' +
        'var ni=demo.querySelector("#hs-name");if(ni)ni.oninput=function(){if(spots[sel])spots[sel].name=ni.value;};' +
        'var cv=demo.querySelector("#hs-canvas");' +
        'cv.onmousedown=function(e){' +
        'var r=cv.getBoundingClientRect();var mx=(e.clientX-r.left)/r.width*100;var my=(e.clientY-r.top)/r.height*100;' +
        'var rh=e.target.dataset.resize;if(rh!==undefined&&hsMode==="select"){resizing=true;resizeCorner=parseInt(rh);dragStart={mx:mx,my:my,snap:{x:spots[sel].x,y:spots[sel].y,w:spots[sel].w,h:spots[sel].h}};e.preventDefault();return;}' +
        'var hi=e.target.dataset.hs;if(hi!==undefined&&hsMode==="select"){sel=parseInt(hi);dragging=true;dragStart={mx:mx,my:my,ox:spots[sel].x,oy:spots[sel].y};rnd();e.preventDefault();return;}' +
        'if(hsMode==="draw"){drawing=true;drawStart={x:mx,y:my};drawCur={x:mx,y:my};var rb=document.createElement("div");rb.id="hs-rb";rb.style.cssText="position:absolute;border:2px dashed #818cf8;background:rgba(129,140,248,.1);border-radius:4px;pointer-events:none";cv.appendChild(rb);e.preventDefault();}' +
        'else{sel=-1;rnd();}' +
        '};' +
        '}' +
        'rnd();' +
        'api.onCleanup(function(){document.removeEventListener("mousemove",onMM);document.removeEventListener("mouseup",onMU);});',
    },
    {
      title: 'Hotspot Actions',
      html:
        '<p>Each hotspot has a list of <strong>actions</strong> that execute when clicked. Actions run in sequence:</p>' +
        '<div class="demo-grid" style="grid-template-columns:1fr">' +
        '<div class="demo-card"><span class="demo-tag" style="background:#6366f1;color:#fff">transition</span> Navigate to another node. The edge is matched by the hotspot\'s ID as the <code>sourceHandle</code>. This is a <strong>terminal action</strong>.</div>' +
        '<div class="demo-card"><span class="demo-tag" style="background:#10b981;color:#fff">setVariable</span> Modify a variable using <code>=</code>, <code>+=</code>, or <code>-=</code>. Example: <code>score += 10</code></div>' +
        '<div class="demo-card"><span class="demo-tag" style="background:#f59e0b;color:#000">showMessage</span> Display a toast message to the player. Dismiss mode: <code>onLeave</code> (clears when leaving scene) or <code>onInteraction</code> (player must click to dismiss).</div>' +
        '<div class="demo-card"><span class="demo-tag" style="background:#3b82f6;color:#fff">showChoice</span> Present branching choices to the player. Each choice option creates its own output handle on the node, just like dialogue choice blocks. This is a <strong>terminal action</strong>.</div>' +
        '</div>' +
        '<div class="warn"><strong>Note:</strong> <code>transition</code> and <code>showChoice</code> are terminal actions — they navigate away from the scene. Place them last if combined with other actions, and only use one terminal action per hotspot.</div>' +
        '<p>Try building an action list below! Add actions, configure them, reorder with the arrows, then press <strong>Test Click</strong> to simulate what happens when a player clicks the hotspot:</p>' +
        '<div id="action-demo"></div>',
      setup:
        'var demo=contentEl.querySelector("#action-demo");' +
        'var actions=[{type:"setVariable",varName:"gold",op:"+=",val:"50"},{type:"showMessage",msg:"You found 50 gold!"}];' +
        'var testVars={};var testLog=[];var testing=false;' +
        'var iSt="background:rgba(30,41,59,.8);border:1px solid rgba(255,255,255,.15);border-radius:4px;color:#e2e8f0;font-size:12px;padding:3px 6px;outline:none;";' +
        'var selSt="background:rgba(30,41,59,.8);border:1px solid rgba(255,255,255,.15);border-radius:4px;color:#94a3b8;font-size:12px;padding:3px 4px;outline:none;";' +
        'function esc(s){return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");}' +
        'function rnd(){' +
        'var h=\'<div class="demo-box"><div class="demo-label">Hotspot Action Builder</div>\';' +
        'h+=\'<div style="display:flex;gap:6px;margin-bottom:10px;align-items:center">\';' +
        'h+=\'<span style="font-size:12px;color:#94a3b8">Add:</span>\';' +
        'h+=\'<button class="demo-btn demo-btn-sm" data-add="showMessage"><span class="demo-tag" style="background:#f59e0b;color:#000">+</span> showMessage</button>\';' +
        'h+=\'<button class="demo-btn demo-btn-sm" data-add="setVariable"><span class="demo-tag" style="background:#10b981;color:#fff">+</span> setVariable</button>\';' +
        'h+=\'<button class="demo-btn demo-btn-sm" data-add="showChoice"><span class="demo-tag" style="background:#3b82f6;color:#fff">+</span> showChoice</button>\';' +
        'h+=\'<button class="demo-btn demo-btn-sm" data-add="transition"><span class="demo-tag" style="background:#6366f1;color:#fff">+</span> transition</button>\';' +
        'h+=\'</div>\';' +
        'if(!actions.length){h+=\'<div style="text-align:center;color:#64748b;padding:16px;font-size:13px">No actions. Add some above.</div>\';}' +
        'actions.forEach(function(a,i){' +
        'var tc=a.type==="showMessage"?"#f59e0b":a.type==="setVariable"?"#10b981":a.type==="showChoice"?"#3b82f6":"#6366f1";' +
        'var fc=a.type==="showMessage"?"#000":"#fff";' +
        'h+=\'<div style="display:flex;align-items:center;gap:6px;margin:5px 0;padding:6px 8px;background:rgba(15,23,42,.4);border-radius:6px;border:1px solid rgba(255,255,255,.06)">\';' +
        'h+=\'<span style="color:#64748b;font-size:12px;min-width:16px">\' +(i+1)+\'.</span>\';' +
        'h+=\'<span class="demo-tag" style="background:\'+tc+\';color:\'+fc+\';font-size:11px">\'+a.type+\'</span>\';' +
        'if(a.type==="showMessage"){' +
        'h+=\'<input data-ai="\'+i+\'" data-f="msg" value="\'+esc(a.msg)+\'" placeholder="Message text..." style="\'+iSt+\'flex:1" />\';' +
        '}else if(a.type==="setVariable"){' +
        'h+=\'<input data-ai="\'+i+\'" data-f="varName" value="\'+esc(a.varName)+\'" placeholder="var" style="\'+iSt+\'width:70px" />\';' +
        'h+=\'<select data-ai="\'+i+\'" data-f="op" style="\'+selSt+\'">\';' +
        '["=","+=","-="].forEach(function(op){h+=\'<option value="\'+op+\'"\' +(a.op===op?" selected":"")+\'>\'+op+\'</option>\';});' +
        'h+=\'</select>\';' +
        'h+=\'<input data-ai="\'+i+\'" data-f="val" value="\'+esc(a.val)+\'" placeholder="value" style="\'+iSt+\'width:50px" />\';' +
        '}else if(a.type==="showChoice"){' +
        'h+=\'<span style="font-size:12px;color:#94a3b8;font-style:italic">\\u2630 Player chooses from options</span>\';' +
        '}else{h+=\'<span style="font-size:12px;color:#94a3b8;font-style:italic">\\u2192 Next Scene</span>\';}' +
        'h+=\'<div style="display:flex;gap:2px;margin-left:auto">\';' +
        'if(i>0)h+=\'<button data-mv="\'+i+\'" data-dir="-1" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:12px;padding:0 2px">\\u25B2</button>\';' +
        'if(i<actions.length-1)h+=\'<button data-mv="\'+i+\'" data-dir="1" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:12px;padding:0 2px">\\u25BC</button>\';' +
        'h+=\'<button data-del="\'+i+\'" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:0 2px">\\u00D7</button>\';' +
        'h+=\'</div></div>\';' +
        '});' +
        'if(actions.length){h+=\'<div style="margin-top:12px;text-align:center"><button class="demo-btn" id="act-test">\\u25B6 Test Click</button></div>\';}' +
        'if(testLog.length){' +
        'h+=\'<div style="margin-top:10px;padding:10px;background:rgba(15,23,42,.6);border-radius:6px;border:1px solid rgba(255,255,255,.08)">\';' +
        'h+=\'<div style="font-size:11px;color:#64748b;margin-bottom:6px">SIMULATION RESULT</div>\';' +
        'testLog.forEach(function(l){h+=\'<div style="font-size:13px;margin:4px 0;color:\'+l.color+\'">\'+l.text+\'</div>\';});' +
        'var vk=Object.keys(testVars);if(vk.length){h+=\'<div style="margin-top:6px;font-size:12px;color:#94a3b8">Variables: \';vk.forEach(function(k){h+=\'<code>\'+k+\' = \'+testVars[k]+\'</code> \';});h+=\'</div>\';}' +
        'h+=\'</div>\';}' +
        'h+=\'</div>\';' +
        'demo.innerHTML=h;' +
        'demo.querySelectorAll("[data-add]").forEach(function(btn){btn.onclick=function(){var t=btn.dataset.add;if(t==="showMessage")actions.push({type:"showMessage",msg:"Hello!"});else if(t==="setVariable")actions.push({type:"setVariable",varName:"score",op:"+=",val:"10"});else if(t==="showChoice")actions.push({type:"showChoice"});else actions.push({type:"transition"});testLog=[];rnd();};});' +
        'demo.querySelectorAll("[data-del]").forEach(function(btn){btn.onclick=function(){actions.splice(parseInt(btn.dataset.del),1);testLog=[];rnd();};});' +
        'demo.querySelectorAll("[data-mv]").forEach(function(btn){btn.onclick=function(){var idx=parseInt(btn.dataset.mv),dir=parseInt(btn.dataset.dir),ni=idx+dir;if(ni<0||ni>=actions.length)return;var tmp=actions[idx];actions[idx]=actions[ni];actions[ni]=tmp;testLog=[];rnd();};});' +
        'demo.querySelectorAll("input[data-ai][data-f]").forEach(function(el){el.oninput=function(){var ai=parseInt(el.dataset.ai);if(actions[ai])actions[ai][el.dataset.f]=el.value;};});' +
        'demo.querySelectorAll("select[data-ai][data-f]").forEach(function(el){el.onchange=function(){var ai=parseInt(el.dataset.ai);if(actions[ai])actions[ai][el.dataset.f]=el.value;};});' +
        'var tb=demo.querySelector("#act-test");if(tb)tb.onclick=function(){testVars={};testLog=[];var stopped=false;actions.forEach(function(a,i){if(stopped)return;if(a.type==="showMessage"){testLog.push({text:"\\u{1F4AC} "+a.msg,color:"#fde68a"});}else if(a.type==="setVariable"){var cv=parseFloat(testVars[a.varName])||0;var nv=parseFloat(a.val)||0;if(a.op==="=")testVars[a.varName]=a.val;else if(a.op==="+=")testVars[a.varName]=cv+nv;else testVars[a.varName]=cv-nv;testLog.push({text:"\\u2699 "+a.varName+" "+a.op+" "+a.val,color:"#a7f3d0"});}else if(a.type==="showChoice"){testLog.push({text:"\\u2630 Presenting choices to player...",color:"#93c5fd"});stopped=true;}else{testLog.push({text:"\\u27A1 Navigating to next scene...",color:"#c7d2fe"});stopped=true;}});rnd();};' +
        '}rnd();',
    },
    {
      title: 'Conditions',
      html:
        '<p>Hotspots can have <strong>conditions</strong> that control whether they\'re active. If the condition is not met, clicking the hotspot shows "It seems to be locked..."</p>' +
        '<h4>Condition Format</h4>' +
        '<div class="code-block">variableId  comparison  value\nhasKey      ==          true\nscore       >=          100</div>' +
        '<h4>Comparisons</h4>' +
        '<div class="demo-grid" style="grid-template-columns:1fr 1fr 1fr">' +
        '<div class="demo-card" style="text-align:center"><code>==</code> equal</div>' +
        '<div class="demo-card" style="text-align:center"><code>!=</code> not equal</div>' +
        '<div class="demo-card" style="text-align:center"><code>&gt;</code> greater than</div>' +
        '<div class="demo-card" style="text-align:center"><code>&lt;</code> less than</div>' +
        '<div class="demo-card" style="text-align:center"><code>&gt;=</code> greater or equal</div>' +
        '<div class="demo-card" style="text-align:center">&nbsp;</div>' +
        '</div>' +
        '<div class="highlight">Conditions are evaluated at click time using the current variable values. This lets you gate access to areas based on player progress.</div>',
    },
    {
      title: 'Scene Timer',
      html:
        '<p>Point-and-click scenes can have an optional <strong>timer</strong> that adds urgency — useful for timed puzzles or other time-limited interactions.</p>' +
        '<h4>Timer Settings</h4>' +
        '<ul>' +
        '<li><strong>Duration</strong> — time in seconds</li>' +
        '<li><strong>Show countdown</strong> — display a visible timer overlay</li>' +
        '<li><strong>Actions</strong> — what happens when time runs out (same action types as hotspots)</li>' +
        '<li><strong>Condition</strong> — optional condition to control if the timer starts</li>' +
        '</ul>' +
        '<p>When the timer expires, its actions execute automatically. For example, you could use a <code>transition</code> action to send the player to a "time\'s up" node, or a <code>setVariable</code> action to track that time ran out.</p>' +
        '<div class="demo-box"><div class="demo-label">Example Timer Setup</div>' +
        '<div style="display:flex;align-items:center;gap:12px;margin-top:8px">' +
        '<div style="font-family:monospace;font-size:24px;color:#ef4444;background:rgba(239,68,68,.1);padding:8px 16px;border-radius:8px;border:1px solid rgba(239,68,68,.3)">2:00</div>' +
        '<div style="font-size:13px;color:#94a3b8">When time runs out:<br><span class="demo-tag" style="background:#f59e0b;color:#000">showMessage</span> "Time\'s up!"<br><span class="demo-tag" style="background:#6366f1;color:#fff">transition</span> \\u2192 Game Over node</div>' +
        '</div></div>',
    },
  ];
}

// ════════════════════════════════════════════════════════════════════════════
// TUTORIAL 5 — The Gameplay Node
// ════════════════════════════════════════════════════════════════════════════

function gameplaySteps() {
  return [
    {
      title: 'What Are Gameplay Nodes?',
      html:
        '<p><strong>Gameplay nodes</strong> add physics-based interactive gameplay to your game. The player controls a character sprite that can move around the scene, jump, and interact with objects.</p>' +
        '<p>There are two view modes:</p>' +
        '<div class="demo-grid" style="grid-template-columns:1fr 1fr">' +
        '<div class="demo-card" style="text-align:center"><span class="demo-tag" style="background:#ef4444;color:#fff">Side View</span><br>Platformer-style movement with gravity. Move left/right, jump with Space/Up/W.</div>' +
        '<div class="demo-card" style="text-align:center"><span class="demo-tag" style="background:#3b82f6;color:#fff">Top-Down</span><br>Free movement in all directions. RPG-style overhead view.</div>' +
        '</div>',
    },
    {
      title: 'View Modes',
      html:
        '<p>The <strong>view mode</strong> determines the physics and controls:</p>' +
        '<h4>Side View</h4>' +
        '<ul>' +
        '<li>Gravity pulls the character down</li>' +
        '<li>Arrow keys / A,D for left/right movement</li>' +
        '<li>Space, Up arrow, or W to jump</li>' +
        '<li>Configurable: <code>gravity</code> (default 120), <code>jumpStrength</code> (default 55), <code>characterSpeed</code> (default 30)</li>' +
        '</ul>' +
        '<h4>Top-Down</h4>' +
        '<ul>' +
        '<li>No gravity — free 2D movement</li>' +
        '<li>Arrow keys / WASD for 4-directional movement</li>' +
        '<li>Separate horizontal and vertical sprites</li>' +
        '<li>Configurable: <code>characterSpeed</code> (default 30)</li>' +
        '</ul>' +
        '<div id="mode-demo"></div>',
      setup:
        'var demo=contentEl.querySelector("#mode-demo");' +
        'var MS=30,GR=120,JI=-55,PW=5,PH=8,GY=100;' +
        'var mode="side",px=10,py=GY-PH,vx=0,vy=0,grounded=true,lastT=0,raf=null;' +
        'var obs={x:35,y:89,w:25,h:4};' +
        'var keys=new Set();' +
        'function onKD(e){keys.add(e.code);if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code)>=0)e.preventDefault();}' +
        'function onKU(e){keys.delete(e.code);}' +
        'function onBlur(){keys.clear();}' +
        'document.addEventListener("keydown",onKD);document.addEventListener("keyup",onKU);window.addEventListener("blur",onBlur);' +
        'demo.innerHTML=\'<div class="demo-box">\'+' +
        '  \'<div class="demo-label" id="gp-label">Mini Demo: Side View (arrow keys + space to jump)</div>\'+' +
        '  \'<div style="position:relative;height:400px;background:linear-gradient(180deg,rgba(30,41,59,.8),rgba(15,23,42,.9));border-radius:6px;overflow:hidden" id="gp-stage">\'+' +
        '  \'<div id="gp-player" style="position:absolute;border-radius:3px;background:#818cf8;box-shadow:0 0 8px rgba(129,140,248,.4)"></div>\'+' +
        '  \'<div id="gp-obs" style="position:absolute;background:rgba(99,102,241,.25);border:1px solid rgba(99,102,241,.5);border-radius:2px"></div>\'+' +
        '  \'</div>\'+' +
        '  \'<div style="margin-top:8px;display:flex;gap:6px">\'+' +
        '  \'<button class="demo-btn demo-btn-sm" id="m-side">Side View</button>\'+' +
        '  \'<button class="demo-btn demo-btn-sm demo-btn-outline" id="m-top">Top-Down</button>\'+' +
        '  \'</div>\'+' +
        '\'</div>\';' +
        'var playerEl=demo.querySelector("#gp-player");' +
        'var obsEl=demo.querySelector("#gp-obs");' +
        'var label=demo.querySelector("#gp-label");' +
        'var stage=demo.querySelector("#gp-stage");' +
        'var sideBtn=demo.querySelector("#m-side");' +
        'var topBtn=demo.querySelector("#m-top");' +
        'function posObs(){' +
        '  obsEl.style.left=obs.x+"%";obsEl.style.top=obs.y+"%";' +
        '  obsEl.style.width=obs.w+"%";obsEl.style.height=obs.h+"%";' +
        '}' +
        'function setMode(m){' +
        '  mode=m;vx=0;vy=0;grounded=true;lastT=0;' +
        '  if(m==="side"){' +
        '    px=10;py=GY-PH;obs={x:35,y:89,w:25,h:4};' +
        '    label.textContent="Mini Demo: Side View (arrow keys + space to jump)";' +
        '    sideBtn.className="demo-btn demo-btn-sm";topBtn.className="demo-btn demo-btn-sm demo-btn-outline";' +
        '  }else{' +
        '    px=10;py=10;obs={x:35,y:35,w:20,h:15};' +
        '    label.textContent="Mini Demo: Top-Down (arrow keys / WASD)";' +
        '    topBtn.className="demo-btn demo-btn-sm";sideBtn.className="demo-btn demo-btn-sm demo-btn-outline";' +
        '  }' +
        '  posObs();' +
        '}' +
        'sideBtn.onclick=function(){setMode("side");};' +
        'topBtn.onclick=function(){setMode("top");};' +
        'function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}' +
        'function tick(ts){' +
        '  if(!lastT)lastT=ts;' +
        '  var dt=Math.min((ts-lastT)/1000,0.05);lastT=ts;' +
        '  var stageRect=stage.getBoundingClientRect();' +
        '  var ar=stageRect.height/stageRect.width;' +
        '  var mx=0,my=0;' +
        '  if(keys.has("ArrowLeft")||keys.has("KeyA"))mx-=1;' +
        '  if(keys.has("ArrowRight")||keys.has("KeyD"))mx+=1;' +
        '  if(mode==="side"){' +
        '    if((keys.has("Space")||keys.has("ArrowUp")||keys.has("KeyW"))&&grounded){vy=JI;grounded=false;}' +
        '  }else{' +
        '    if(keys.has("ArrowUp")||keys.has("KeyW"))my-=1;' +
        '    if(keys.has("ArrowDown")||keys.has("KeyS"))my+=1;' +
        '  }' +
        '  vx=mx*MS*ar;' +
        '  if(mode==="side"){vy+=GR*dt;}else{vy=my*MS;}' +
        '  var nx=px+vx*dt;' +
        '  var ny=py+vy*dt;' +
        '  if(nx<0)nx=0;if(nx>100-PW)nx=100-PW;' +
        '  if(ny<0)ny=0;if(ny>100-PH)ny=100-PH;' +
        '  var pr={x:nx,y:ny,w:PW,h:PH};' +
        '  var ob={x:obs.x,y:obs.y,w:obs.w,h:obs.h};' +
        '  if(overlap(pr,ob)){' +
        '    var oL=pr.x+pr.w-ob.x;' +
        '    var oR=ob.x+ob.w-pr.x;' +
        '    var oT=pr.y+pr.h-ob.y;' +
        '    var oB=ob.y+ob.h-pr.y;' +
        '    var mn=Math.min(oL,oR,oT,oB);' +
        '    if(mode==="side"){' +
        '      if(mn===oT&&vy>=0){ny=ob.y-PH;vy=0;grounded=true;}' +
        '      else if(mn===oB&&vy<0){ny=ob.y+ob.h;vy=0;}' +
        '      else if(mn===oL){nx=ob.x-PW;}' +
        '      else if(mn===oR){nx=ob.x+ob.w;}' +
        '    }else{' +
        '      if(mn===oT){ny=ob.y-PH;}' +
        '      else if(mn===oB){ny=ob.y+ob.h;}' +
        '      else if(mn===oL){nx=ob.x-PW;}' +
        '      else if(mn===oR){nx=ob.x+ob.w;}' +
        '    }' +
        '  }' +
        '  if(mode==="side"){' +
        '    if(ny+PH>=GY){ny=GY-PH;vy=0;grounded=true;}' +
        '    else{' +
        '      var feet={x:nx,y:ny+PH,w:PW,h:0.5};' +
        '      if(!overlap(feet,ob))grounded=false;' +
        '    }' +
        '  }' +
        '  px=nx;py=ny;' +
        '  playerEl.style.left=px+"%";playerEl.style.top=py+"%";' +
        '  playerEl.style.width=PW+"%";playerEl.style.height=PH+"%";' +
        '  raf=requestAnimationFrame(tick);' +
        '}' +
        'setMode("side");raf=requestAnimationFrame(tick);' +
        'api.onCleanup(function(){' +
        '  document.removeEventListener("keydown",onKD);document.removeEventListener("keyup",onKU);' +
        '  window.removeEventListener("blur",onBlur);' +
        '  if(raf)cancelAnimationFrame(raf);' +
        '});',
    },
    {
      title: 'Character Setup',
      html:
        '<p>Configure your playable character in the <strong>Gameplay Settings</strong> panel:</p>' +
        '<h4>Background</h4>' +
        '<ul>' +
        '<li><strong>Background image</strong> — the scene\'s visual backdrop</li>' +
        '<li><strong>Background size</strong> — how the image fills the scene: <code>cover</code> (fills area, may crop), <code>contain</code> (fits entirely, may letterbox), or <code>fill</code> (stretches to fit)</li>' +
        '<li><strong>Background position</strong> — alignment when using cover or contain: <code>start</code>, <code>center</code>, or <code>end</code></li>' +
        '<li><strong>Background music</strong> — looping audio that plays while this scene is active</li>' +
        '</ul>' +
        '<h4>Character Sprites</h4>' +
        '<ul>' +
        '<li><strong>Side view</strong>: Separate sprites for idle, walking, jumping up, and falling down</li>' +
        '<li><strong>Top-down</strong>: Separate sprites for idle and walking in horizontal and vertical directions</li>' +
        '<li><strong>Front face</strong> direction — which way the sprite faces by default</li>' +
        '</ul>' +
        '<h4>Character Properties</h4>' +
        '<ul>' +
        '<li><strong>Start position</strong> — where the character spawns, specified as <code>x</code> and <code>y</code> percentages (0–100). For example, <code>x: 50, y: 90</code> places the character near the bottom center. The default is <code>(50, 90)</code>.</li>' +
        '<li><strong>Scale</strong> — character size (default 100%)</li>' +
        '<li><strong>Speed</strong> — movement speed as % of viewport per second (default 30)</li>' +
        '<li><strong>Reset on enter</strong> — whether to reset position when re-entering the scene</li>' +
        '</ul>' +
        '<h4>Camera</h4>' +
        '<ul>' +
        '<li><strong>Track character with camera</strong> — when enabled, the camera follows the character as it moves. This is useful for scenes larger than the visible viewport.</li>' +
        '<li><strong>Camera size</strong> — controls the zoom level (1–100%). A smaller value means a more zoomed-in view centered on the character.</li>' +
        '</ul>' +
        '<h4>Physics (Side View Only)</h4>' +
        '<ul>' +
        '<li><strong>Gravity</strong> — downward acceleration (default 120)</li>' +
        '<li><strong>Jump strength</strong> — initial upward velocity on jump (default 55)</li>' +
        '</ul>',
    },
    {
      title: 'Obstacles',
      html:
        '<p><strong>Obstacles</strong> are invisible rectangular collision zones. The character cannot pass through them — they act as walls, floors, and platforms.</p>' +
        '<p>Each obstacle is defined by position and size (all as percentages):</p>' +
        '<div class="code-block">{ x: 20, y: 70, width: 60, height: 10 }</div>' +
        '<p>In the editor, the toolbar has three modes: <strong>Select</strong>, <strong>Draw Obstacle</strong>, and <strong>Draw Hotspot</strong>. Switch to <strong>Draw Obstacle</strong> mode and drag on the canvas to create obstacles. Switch back to <strong>Select</strong> to move and resize them.</p>' +
        '<div class="highlight"><strong>Key concept:</strong> The character is automatically <strong>clamped to the screen boundaries</strong> on all four edges — it can never fall off screen. Obstacles provide <strong>additional</strong> collision surfaces inside the scene for things like platforms, internal walls, and barriers.</div>' +
        '<p>Try it below! Draw obstacles and then use <strong>arrow keys + space</strong> to move the character and see how it collides with them in real time:</p>' +
        '<div id="obs-demo"></div>',
      setup:
        'var demo=contentEl.querySelector("#obs-demo");' +
        'var MS=30,GR=120,JI=-55,PW=5,PH=8,GY=100;' +
        'var px=10,py=GY-PH,vx=0,vy=0,grounded=true,lastT=0,raf=null;' +
        'var obstacles=[{x:20,y:80,w:25,h:4},{x:55,y:65,w:20,h:4}];' +
        'var sel=-1,obsMode="select";' +
        'var drawing=false,drawStart=null,drawCur=null;' +
        'var mdrag=false,mstart=null;' +
        'var mresize=false,mresizeC=-1;' +
        'var keys=new Set();' +
        'function onKD(e){keys.add(e.code);if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code)>=0)e.preventDefault();}' +
        'function onKU(e){keys.delete(e.code);}' +
        'function onBlur(){keys.clear();}' +
        'document.addEventListener("keydown",onKD);document.addEventListener("keyup",onKU);window.addEventListener("blur",onBlur);' +
        'function olap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}' +
        'function onOMM(e){' +
        'if(!drawing&&!mdrag&&!mresize)return;' +
        'var st=demo.querySelector("#obs-stage");if(!st)return;' +
        'var r=st.getBoundingClientRect();' +
        'var mx=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));' +
        'var my=Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100));' +
        'if(drawing){drawCur={x:mx,y:my};var rb=document.getElementById("obs-rb");if(rb){rb.style.left=Math.min(drawStart.x,mx)+"%";rb.style.top=Math.min(drawStart.y,my)+"%";rb.style.width=Math.abs(mx-drawStart.x)+"%";rb.style.height=Math.abs(my-drawStart.y)+"%";}}' +
        'else if(mdrag&&obstacles[sel]){var dx=mx-mstart.mx,dy=my-mstart.my;obstacles[sel].x=Math.max(0,Math.min(100-obstacles[sel].w,mstart.ox+dx));obstacles[sel].y=Math.max(0,Math.min(100-obstacles[sel].h,mstart.oy+dy));var el=st.querySelector("[data-obs=\\""+sel+"\\"]");if(el){el.style.left=obstacles[sel].x+"%";el.style.top=obstacles[sel].y+"%";}}' +
        'else if(mresize&&obstacles[sel]&&mstart){var s=mstart.snap;var rx=s.x+s.w,by=s.y+s.h;if(mresizeC===0){obstacles[sel].x=Math.min(rx-3,mx);obstacles[sel].y=Math.min(by-3,my);obstacles[sel].w=rx-obstacles[sel].x;obstacles[sel].h=by-obstacles[sel].y;}else if(mresizeC===1){obstacles[sel].y=Math.min(by-3,my);obstacles[sel].w=Math.max(3,mx-s.x);obstacles[sel].h=by-obstacles[sel].y;}else if(mresizeC===2){obstacles[sel].x=Math.min(rx-3,mx);obstacles[sel].w=rx-obstacles[sel].x;obstacles[sel].h=Math.max(3,my-s.y);}else{obstacles[sel].w=Math.max(3,mx-s.x);obstacles[sel].h=Math.max(3,my-s.y);}rnd();}}' +
        'function onOMU(){' +
        'if(drawing){drawing=false;var rb=document.getElementById("obs-rb");if(rb)rb.remove();var x1=Math.min(drawStart.x,drawCur.x),y1=Math.min(drawStart.y,drawCur.y);var w=Math.abs(drawCur.x-drawStart.x),h=Math.abs(drawCur.y-drawStart.y);if(w>2&&h>2){obstacles.push({x:Math.round(x1),y:Math.round(y1),w:Math.round(w),h:Math.round(h)});sel=obstacles.length-1;obsMode="select";}rnd();}' +
        'else if(mdrag){mdrag=false;rnd();}' +
        'else if(mresize){mresize=false;rnd();}}' +
        'document.addEventListener("mousemove",onOMM);document.addEventListener("mouseup",onOMU);' +
        'function rnd(){' +
        'var h=\'<div class="demo-box"><div class="demo-label">Draw Obstacles (arrow keys + space to move character)</div>\';' +
        'h+=\'<div style="display:flex;gap:6px;margin-bottom:8px">\';' +
        'h+=\'<button class="demo-btn demo-btn-sm\'+(obsMode==="select"?\'\':\' demo-btn-outline\')+\'" id="obs-m-sel">\\u{1F5B1} Select</button>\';' +
        'h+=\'<button class="demo-btn demo-btn-sm\'+(obsMode==="draw"?\'\':\' demo-btn-outline\')+\'" id="obs-m-draw">\\u270F Draw Obstacle</button>\';' +
        'if(sel>=0)h+=\'<button class="demo-btn demo-btn-sm demo-btn-danger" id="obs-del" style="margin-left:auto">Delete</button>\';' +
        'h+=\'</div>\';' +
        'h+=\'<div id="obs-stage" style="position:relative;height:300px;background:linear-gradient(180deg,rgba(30,41,59,.8),rgba(15,23,42,.9));border-radius:6px;overflow:hidden;cursor:\'+(obsMode==="draw"?"crosshair":"default")+\';user-select:none">\';' +
        'h+=\'<div id="obs-player" style="position:absolute;left:\'+px+\'%;top:\'+py+\'%;width:\'+PW+\'%;height:\'+PH+\'%;border-radius:3px;background:#818cf8;box-shadow:0 0 8px rgba(129,140,248,.4);z-index:5;pointer-events:none"></div>\';' +
        'obstacles.forEach(function(o,i){' +
        'var isSel=i===sel;' +
        'var ol=isSel?";outline:2px solid #818cf8;outline-offset:-2px":"";' +
        'h+=\'<div data-obs="\'+i+\'" style="position:absolute;left:\'+o.x+\'%;top:\'+o.y+\'%;width:\'+o.w+\'%;height:\'+o.h+\'%;background:rgba(99,102,241,.25);border:1px solid rgba(99,102,241,.5);border-radius:2px;cursor:\'+(obsMode==="select"?"move":"crosshair")+ol+\'"></div>\';' +
        '});' +
        'if(sel>=0&&obstacles[sel]&&obsMode==="select"){var o=obstacles[sel];var cx=[o.x,o.x+o.w,o.x,o.x+o.w],cy=[o.y,o.y,o.y+o.h,o.y+o.h],curs=["nwse-resize","nesw-resize","nesw-resize","nwse-resize"];for(var ci=0;ci<4;ci++){h+=\'<div data-resize="\'+ci+\'" style="position:absolute;left:\'+cx[ci]+\'%;top:\'+cy[ci]+\'%;width:8px;height:8px;background:#818cf8;border-radius:2px;transform:translate(-50%,-50%);cursor:\'+curs[ci]+\';z-index:10"></div>\';}}' +
        'h+=\'</div>\';' +
        'if(sel>=0&&obstacles[sel]){var o=obstacles[sel];h+=\'<div style="margin-top:8px;font-size:12px;color:#94a3b8">Selected obstacle at (\'+Math.round(o.x)+\'%, \'+Math.round(o.y)+\'%) size \'+Math.round(o.w)+\'% \\u00D7 \'+Math.round(o.h)+\'%</div>\';}' +
        'else{h+=\'<div style="margin-top:8px;font-size:12px;color:#64748b">\'+(obsMode==="draw"?"Click and drag to draw an obstacle":"Click an obstacle to select. Use arrow keys + space to move the character.")+\'</div>\';}' +
        'h+=\'</div>\';' +
        'demo.innerHTML=h;' +
        'demo.querySelector("#obs-m-sel").onclick=function(){obsMode="select";rnd();};' +
        'demo.querySelector("#obs-m-draw").onclick=function(){obsMode="draw";sel=-1;rnd();};' +
        'var db=demo.querySelector("#obs-del");if(db)db.onclick=function(){obstacles.splice(sel,1);sel=-1;rnd();};' +
        'var st=demo.querySelector("#obs-stage");' +
        'st.onmousedown=function(e){var r=st.getBoundingClientRect();var mx=(e.clientX-r.left)/r.width*100;var my=(e.clientY-r.top)/r.height*100;' +
        'var rh=e.target.dataset.resize;if(rh!==undefined&&obsMode==="select"){mresize=true;mresizeC=parseInt(rh);mstart={mx:mx,my:my,snap:{x:obstacles[sel].x,y:obstacles[sel].y,w:obstacles[sel].w,h:obstacles[sel].h}};e.preventDefault();return;}' +
        'var oi=e.target.dataset.obs;if(oi!==undefined&&obsMode==="select"){sel=parseInt(oi);mdrag=true;mstart={mx:mx,my:my,ox:obstacles[sel].x,oy:obstacles[sel].y};rnd();e.preventDefault();return;}' +
        'if(obsMode==="draw"){drawing=true;drawStart={x:mx,y:my};drawCur={x:mx,y:my};var rb=document.createElement("div");rb.id="obs-rb";rb.style.cssText="position:absolute;border:2px dashed rgba(99,102,241,.8);background:rgba(99,102,241,.1);border-radius:2px;pointer-events:none";st.appendChild(rb);e.preventDefault();}' +
        'else{sel=-1;rnd();}};' +
        '}' +
        'function tick(ts){' +
        'if(!lastT)lastT=ts;var dt=Math.min((ts-lastT)/1000,0.05);lastT=ts;' +
        'var st=demo.querySelector("#obs-stage");if(!st){raf=requestAnimationFrame(tick);return;}' +
        'var sr=st.getBoundingClientRect();var ar=sr.height/sr.width;' +
        'var mx=0;if(keys.has("ArrowLeft")||keys.has("KeyA"))mx-=1;if(keys.has("ArrowRight")||keys.has("KeyD"))mx+=1;' +
        'if((keys.has("Space")||keys.has("ArrowUp")||keys.has("KeyW"))&&grounded){vy=JI;grounded=false;}' +
        'vx=mx*MS*ar;vy+=GR*dt;' +
        'var nx=px+vx*dt,ny=py+vy*dt;' +
        'if(nx<0)nx=0;if(nx>100-PW)nx=100-PW;if(ny<0)ny=0;if(ny>100-PH)ny=100-PH;' +
        'var pr={x:nx,y:ny,w:PW,h:PH};' +
        'obstacles.forEach(function(ob){if(olap(pr,ob)){' +
        'var oL=pr.x+pr.w-ob.x,oR=ob.x+ob.w-pr.x,oT=pr.y+pr.h-ob.y,oB=ob.y+ob.h-pr.y;' +
        'var mn=Math.min(oL,oR,oT,oB);' +
        'if(mn===oT&&vy>=0){ny=ob.y-PH;vy=0;grounded=true;}else if(mn===oB&&vy<0){ny=ob.y+ob.h;vy=0;}else if(mn===oL){nx=ob.x-PW;}else if(mn===oR){nx=ob.x+ob.w;}' +
        'pr={x:nx,y:ny,w:PW,h:PH};}});' +
        'if(ny+PH>=GY){ny=GY-PH;vy=0;grounded=true;}else{var onAny=false;obstacles.forEach(function(ob){if(olap({x:nx,y:ny+PH,w:PW,h:0.5},ob))onAny=true;});if(!onAny)grounded=false;}' +
        'px=nx;py=ny;' +
        'var pl=st.querySelector("#obs-player");if(pl){pl.style.left=px+"%";pl.style.top=py+"%";pl.style.width=PW+"%";pl.style.height=PH+"%";}' +
        'raf=requestAnimationFrame(tick);}' +
        'rnd();raf=requestAnimationFrame(tick);' +
        'api.onCleanup(function(){document.removeEventListener("keydown",onKD);document.removeEventListener("keyup",onKU);window.removeEventListener("blur",onBlur);document.removeEventListener("mousemove",onOMM);document.removeEventListener("mouseup",onOMU);if(raf)cancelAnimationFrame(raf);});',
    },
    {
      title: 'Gameplay Hotspots',
      html:
        '<p><strong>Gameplay hotspots</strong> are like point-and-click hotspots but with physics-aware activation. To create hotspots, switch to <strong>Draw Hotspot</strong> mode in the toolbar and drag on the canvas — just like drawing obstacles.</p>' +
        '<h4>Activation Types</h4>' +
        '<div class="demo-grid" style="grid-template-columns:1fr 1fr">' +
        '<div class="demo-card"><span class="demo-tag" style="background:#ef4444;color:#fff">collision</span> Triggers automatically when the character overlaps the hotspot area</div>' +
        '<div class="demo-card"><span class="demo-tag" style="background:#3b82f6;color:#fff">interaction_button</span> Shows an indicator; player presses a button to interact</div>' +
        '</div>' +
        '<h4>Other Properties</h4>' +
        '<ul>' +
        '<li><strong>Show indicator</strong> — display a visual marker at the hotspot location</li>' +
        '<li><strong>Message position</strong> — whether messages and choices appear at the <code>top</code> or <code>bottom</code> of the screen</li>' +
        '<li><strong>Actions</strong> — same as point-and-click: <code>transition</code>, <code>setVariable</code>, <code>showMessage</code>, and <code>showChoice</code></li>' +
        '<li><strong>Conditions</strong> — optional variable-based activation gates</li>' +
        '</ul>' +
        '<p>Gameplay scenes also support an optional <strong>timer</strong>, identical to the point-and-click timer.</p>' +
        '<div class="highlight">Use collision hotspots for level exits, hazards, and checkpoints. Use interaction hotspots for NPCs, treasure chests, and interactive objects.</div>',
    },
  ];
}

// ════════════════════════════════════════════════════════════════════════════
// TUTORIAL 6 — The Custom Node
// ════════════════════════════════════════════════════════════════════════════

function customNodeSteps() {
  return [
    {
      title: 'What Are Custom Nodes?',
      html:
        '<p><strong>Custom nodes</strong> are the most powerful scene type. They let you write <strong>JavaScript code</strong> that has full control over what the player sees and does.</p>' +
        '<p>Custom nodes are perfect for:</p>' +
        '<ul>' +
        '<li>Mini-games (puzzles, card games, arcade games)</li>' +
        '<li>Complex UI interactions</li>' +
        '<li>Procedural content</li>' +
        '<li>Anything the built-in node types can\'t handle</li>' +
        '</ul>' +
        '<div class="highlight">Custom nodes give you full creative freedom — if you can build it with HTML, CSS, and JavaScript, you can put it in your game.</div>',
    },
    {
      title: 'Container & API',
      html:
        '<p>Your script receives two arguments:</p>' +
        '<h4><code>container</code></h4>' +
        '<p>A DOM <code>&lt;div&gt;</code> element that fills the screen. You can add any HTML elements to it — buttons, text, canvas, images, etc. The container is styled with white text on a black background by default.</p>' +
        '<h4><code>api</code></h4>' +
        '<p>An object with methods to interact with the game engine:</p>' +
        '<div class="code-block">function(container, api) {\n  // Your code runs here\n  // container = DOM element\n  // api = game engine interface\n}</div>' +
        '<div class="warn"><strong>Important:</strong> Your script runs <strong>once</strong> when the scene loads. Use event listeners for interactivity. Clean up with <code>api.onCleanup()</code>.</div>',
    },
    {
      title: 'API Reference',
      html:
        '<p>The <code>api</code> object provides these methods:</p>' +
        '<div class="demo-grid" style="grid-template-columns:1fr">' +
        '<div class="demo-card"><code>api.onComplete()</code><br>Exit the scene via the <strong>default</strong> output edge. Use for linear progression.</div>' +
        '<div class="demo-card"><code>api.transitionToHandle(handleId)</code><br>Exit via a <strong>named</strong> handle. The handleId must match the <code>sourceHandle</code> on an outgoing edge. Use for branching paths.</div>' +
        '<div class="demo-card"><code>api.getVariable(id)</code><br>Get a variable\'s current value by its ID. Returns <code>undefined</code> if not found.</div>' +
        '<div class="demo-card"><code>api.setVariable(id, value)</code><br>Set a variable\'s value. Value must match the variable\'s type (boolean, number, or string).</div>' +
        '<div class="demo-card"><code>api.getAssetUrl(assetId)</code><br>Get the URL for an uploaded asset. Returns <code>null</code> if not found. Use in <code>&lt;img&gt;</code> src or CSS backgrounds.</div>' +
        '<div class="demo-card"><code>api.onCleanup(fn)</code><br>Register a function to run when leaving the scene. Use to remove event listeners, clear timers, cancel animations.</div>' +
        '</div>',
    },
    {
      title: 'Writing a Script',
      html:
        '<p>Here\'s the anatomy of a well-structured custom scene script:</p>' +
        '<div class="code-block">// 1. Add styles\nvar style = document.createElement(\'style\');\nstyle.textContent = \'.my-btn { padding: 12px; ... }\';\ncontainer.appendChild(style);\n\n// 2. Create UI elements\nvar root = document.createElement(\'div\');\nroot.innerHTML = \'&lt;h1&gt;My Scene&lt;/h1&gt;\';\ncontainer.appendChild(root);\n\n// 3. Add interactivity\nvar btn = document.createElement(\'button\');\nbtn.textContent = \'Continue\';\nbtn.onclick = function() {\n  api.onComplete(); // Exit scene\n};\nroot.appendChild(btn);\n\n// 4. Register cleanup\napi.onCleanup(function() {\n  // Clean up listeners, timers, etc.\n});</div>' +
        '<div class="highlight"><strong>Key pattern:</strong> Create elements → attach event handlers → register cleanup. The script runs once; use events for ongoing interactivity.</div>',
    },
    {
      title: 'Tips & Best Practices',
      html:
        '<p>Make the most of custom nodes with these tips:</p>' +
        '<h4>Error Handling</h4>' +
        '<p>If your script throws an error, the player sees an error screen with a "Continue" button. Use <code>try/catch</code> for risky operations.</p>' +
        '<h4>Cleanup Is Essential</h4>' +
        '<p>Always register cleanup functions for:</p>' +
        '<ul>' +
        '<li><code>setTimeout</code> / <code>setInterval</code> timers</li>' +
        '<li><code>requestAnimationFrame</code> loops</li>' +
        '<li>Global event listeners (<code>keydown</code>, <code>mousemove</code>, etc.)</li>' +
        '</ul>' +
        '<h4>Styling</h4>' +
        '<p>The container is a full-screen <code>div</code> on a black background. Use CSS to style your content — inject a <code>&lt;style&gt;</code> element or use inline styles.</p>' +
        '<h4>Asset Usage</h4>' +
        '<div class="code-block">var url = api.getAssetUrl(\'your-asset-id\');\nif (url) {\n  var img = document.createElement(\'img\');\n  img.src = url;\n  container.appendChild(img);\n}</div>' +
        '<h4>Default Script</h4>' +
        '<p>When you create a new custom node, it comes with a <strong>chess game</strong> as the default script — a complete example showing DOM manipulation, game logic, event handling, and the API in action.</p>',
    },
  ];
}

// ════════════════════════════════════════════════════════════════════════════
// TUTORIAL 7 — The Subgraph Node
// ════════════════════════════════════════════════════════════════════════════

function subgraphSteps() {
  return [
    {
      title: 'What Are Subgraph Nodes?',
      html:
        '<p><strong>Subgraph nodes</strong> let you organize your story graph by grouping related nodes into a <strong>nested container</strong>. Think of them as folders for your game\'s scenes.</p>' +
        '<p>Subgraphs are essential for:</p>' +
        '<ul>' +
        '<li>Keeping large games organized</li>' +
        '<li>Grouping scenes that belong to a chapter, quest, or area</li>' +
        '<li>Reducing visual clutter in the main graph</li>' +
        '<li>Reusable story segments</li>' +
        '</ul>' +
        '<div class="highlight">Subgraphs are purely an organizational tool — they don\'t change how your game plays. At runtime, the engine <strong>flattens</strong> all subgraphs into a single-level graph.</div>',
    },
    {
      title: 'Creating Subgraphs',
      html:
        '<p>To create a subgraph:</p>' +
        '<ol>' +
        '<li>Add a new node and select the <strong>Subgraph</strong> type</li>' +
        '<li>Double-click the subgraph node to <strong>enter</strong> it</li>' +
        '<li>Inside, you\'ll see an empty canvas — add nodes here just like the main graph</li>' +
        '<li>Use the <strong>breadcrumb bar</strong> at the top to navigate back to the parent level</li>' +
        '</ol>' +
        '<div id="sg-demo"></div>',
      setup:
        'var demo=contentEl.querySelector("#sg-demo");' +
        'var inside=false;' +
        'function rnd(){' +
        '  var h=\'<div class="demo-box"><div class="demo-label">Interactive: Subgraph Navigation</div>\';' +
        '  if(!inside){' +
        '    h+=\'<div style="margin:8px 0;font-size:13px;color:#94a3b8">\\u{1F4C1} Main Graph</div>\';' +
        '    h+=\'<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">\';' +
        '    h+=\'<span class="demo-node" style="border-color:#6366f1;color:#c7d2fe">Intro</span>\';' +
        '    h+=\'<span class="demo-edge"></span>\';' +
        '    h+=\'<div style="border:2px solid #64748b;border-radius:10px;padding:10px 16px;cursor:pointer;background:rgba(100,116,139,.1)" id="sg-enter">\';' +
        '    h+=\'<div style="font-size:11px;color:#64748b;margin-bottom:4px">SUBGRAPH</div>\';' +
        '    h+=\'<div style="color:#e2e8f0;font-weight:600">Chapter 1</div>\';' +
        '    h+=\'<div style="font-size:11px;color:#94a3b8;margin-top:2px">3 nodes inside</div>\';' +
        '    h+=\'</div>\';' +
        '    h+=\'<span class="demo-edge"></span>\';' +
        '    h+=\'<span class="demo-node" style="border-color:#6366f1;color:#c7d2fe">Ending</span>\';' +
        '    h+=\'</div>\';' +
        '    h+=\'<div style="margin-top:8px;font-size:12px;color:#64748b">Double-click the subgraph to enter it \\u2191</div>\';' +
        '  }else{' +
        '    h+=\'<div style="margin:8px 0;font-size:13px;display:flex;gap:4px">\';' +
        '    h+=\'<span style="color:#64748b;cursor:pointer" id="sg-exit">Main Graph</span>\';' +
        '    h+=\'<span style="color:#64748b"> / </span>\';' +
        '    h+=\'<span style="color:#e2e8f0;font-weight:600">Chapter 1</span>\';' +
        '    h+=\'</div>\';' +
        '    h+=\'<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">\';' +
        '    h+=\'<span class="demo-node" style="border-color:#10b981;color:#a7f3d0">Scene A</span>\';' +
        '    h+=\'<span class="demo-edge"></span>\';' +
        '    h+=\'<span class="demo-node" style="border-color:#f59e0b;color:#fde68a">Scene B</span>\';' +
        '    h+=\'<span class="demo-edge"></span>\';' +
        '    h+=\'<span class="demo-node" style="border-color:#ef4444;color:#fca5a5">Scene C</span>\';' +
        '    h+=\'</div>\';' +
        '    h+=\'<div style="margin-top:8px;font-size:12px;color:#64748b">Click "Main Graph" in the breadcrumb to go back \\u2191</div>\';' +
        '  }' +
        '  h+=\'</div>\';' +
        '  demo.innerHTML=h;' +
        '  var enter=demo.querySelector("#sg-enter");' +
        '  if(enter)enter.ondblclick=function(){inside=true;rnd();};' +
        '  var exit=demo.querySelector("#sg-exit");' +
        '  if(exit)exit.onclick=function(){inside=false;rnd();};' +
        '}rnd();',
    },
    {
      title: 'Moving Nodes Into Subgraphs',
      html:
        '<p>You can move existing nodes into a subgraph — no need to recreate them:</p>' +
        '<ol>' +
        '<li>Right-click a node in the main graph</li>' +
        '<li>Select <strong>"Move to Subgraph"</strong> and choose the target subgraph</li>' +
        '<li>The node (and its internal data) transfers into the subgraph</li>' +
        '</ol>' +
        '<div class="highlight"><strong>Good news:</strong> When you move a node, existing edges are automatically <strong>rewired</strong>, not removed. Outgoing edges become exit handles on the subgraph, and incoming edges are redirected to target the subgraph entry point. Your connections remain functionally intact.</div>' +
        '<p>You can also:</p>' +
        '<ul>' +
        '<li>Create new nodes directly inside a subgraph</li>' +
        '<li>Connect nodes within the subgraph normally</li>' +
        '<li>Nest subgraphs inside other subgraphs for deeper organization</li>' +
        '</ul>',
    },
    {
      title: 'Connections & Exit Handles',
      html:
        '<p>Subgraphs have special rules for how edges connect to the outside world:</p>' +
        '<h4>Entering a Subgraph</h4>' +
        '<p>When an edge points TO a subgraph node, the game enters at the subgraph\'s <strong>root node</strong> — the node inside with no incoming edges (just like the main graph\'s start node).</p>' +
        '<h4>Exiting a Subgraph</h4>' +
        '<p>Nodes inside a subgraph can "exit" back to the parent graph. When a node inside has an outgoing edge that goes nowhere internally, it creates an <strong>exit handle</strong> on the subgraph node.</p>' +
        '<div class="code-block">Exit handle format: "exit:internalNodeId:handleId"</div>' +
        '<p>These exit handles appear as output ports on the subgraph node in the parent graph. You connect them to the next node outside the subgraph.</p>' +
        '<h4>How Flattening Works</h4>' +
        '<div class="demo-grid" style="grid-template-columns:1fr">' +
        '<div class="demo-card"><strong>At edit time:</strong> Subgraphs are nested containers with internal nodes/edges<br><strong>At runtime:</strong> The engine flattens everything into a single graph — edges to subgraphs are redirected to internal root nodes, exit handles become direct edges out</div>' +
        '</div>',
    },
    {
      title: 'Best Practices',
      html:
        '<p>Make the most of subgraphs with these tips:</p>' +
        '<h4>When to Use Subgraphs</h4>' +
        '<ul>' +
        '<li><strong>Chapters</strong> — group all scenes in a chapter together</li>' +
        '<li><strong>Side quests</strong> — isolate optional content</li>' +
        '<li><strong>Reusable sequences</strong> — create a pattern you can reference multiple times</li>' +
        '<li><strong>Large games</strong> — any project with 10+ nodes benefits from organization</li>' +
        '</ul>' +
        '<h4>Naming Convention</h4>' +
        '<p>Give subgraphs clear, descriptive names like "Chapter 1: The Forest", "Shop Menu", or "Boss Fight Sequence".</p>' +
        '<h4>Root Node</h4>' +
        '<p>Each subgraph needs exactly one root node (no incoming edges inside the subgraph). This is where execution starts when entering the subgraph.</p>' +
        '<div class="highlight"><strong>Remember:</strong> Subgraphs are just for organization. They don\'t add any gameplay features — everything inside works exactly the same as in the main graph.</div>',
    },
  ];
}

// ════════════════════════════════════════════════════════════════════════════
// Build game data
// ════════════════════════════════════════════════════════════════════════════

const tutorials = [
  { id: 'tut-storygraph', label: 'Story Graph, Assets & Variables',  hsId: 'hs-storygraph',      title: 'Story Graph, Assets & Variables', steps: storyGraphSteps },
  { id: 'tut-dialogue',   label: 'The Dialogue Node',               hsId: 'hs-dialogue',         title: 'The Dialogue Node',               steps: dialogueSteps },
  { id: 'tut-cutscene',   label: 'The Cutscene Node',               hsId: 'hs-cutscene',         title: 'The Cutscene Node',               steps: cutsceneSteps },
  { id: 'tut-pnc',        label: 'The Point-and-Click Node',        hsId: 'hs-pointandclick',    title: 'The Point-and-Click Node',        steps: pointAndClickSteps },
  { id: 'tut-gameplay',   label: 'The Gameplay Node',               hsId: 'hs-gameplay',         title: 'The Gameplay Node',               steps: gameplaySteps },
  { id: 'tut-custom',     label: 'The Custom Node',                 hsId: 'hs-custom',           title: 'The Custom Node',                 steps: customNodeSteps },
  { id: 'tut-subgraph',   label: 'The Subgraph Node',               hsId: 'hs-subgraph',         title: 'The Subgraph Node',               steps: subgraphSteps },
];

// ── Hub script (custom node with visible buttons) ──

const HUB_SCRIPT = (() => {
  const items = tutorials.map(t =>
    `{label:${JSON.stringify(t.label)},handle:${JSON.stringify(t.hsId)}}`
  ).join(',');

  return `
var _hubTheme=api.getVariable('var-theme')||'dark';
document.body.style.background=_hubTheme==='light'?'#f8fafc':'black';
document.getElementById('container').style.background=_hubTheme==='light'?'#f8fafc':'black';
var css=document.createElement('style');
css.textContent='` +
`.hub{--h-title:#c7d2fe;--h-sub:#94a3b8;--h-item-bg:rgba(30,41,59,.6);--h-item-border:rgba(255,255,255,.1);--h-item-text:#e2e8f0;--h-item-hover-bg:rgba(99,102,241,.15);--h-item-hover-border:rgba(99,102,241,.4);--h-num-bg:rgba(99,102,241,.2);--h-num-text:#818cf8;--h-toggle-bg:rgba(255,255,255,.1);--h-toggle-text:#e2e8f0;--h-toggle-hover:rgba(255,255,255,.18);display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;font-family:system-ui,-apple-system,sans-serif;gap:24px;padding:24px;box-sizing:border-box}` +
`.hub.light{--h-title:#312e81;--h-sub:#64748b;--h-item-bg:rgba(226,232,240,.5);--h-item-border:rgba(0,0,0,.1);--h-item-text:#1e293b;--h-item-hover-bg:rgba(99,102,241,.1);--h-item-hover-border:rgba(99,102,241,.4);--h-num-bg:rgba(99,102,241,.15);--h-num-text:#6366f1;--h-toggle-bg:rgba(0,0,0,.06);--h-toggle-text:#1e293b;--h-toggle-hover:rgba(0,0,0,.1)}` +
`.hub-title{font-size:28px;font-weight:700;color:var(--h-title);text-align:center;margin:0}` +
`.hub-sub{font-size:15px;color:var(--h-sub);text-align:center;margin:0;max-width:480px}` +
`.hub-menu{display:flex;flex-direction:column;gap:10px;width:100%;max-width:420px}` +
`.hub-item{display:flex;align-items:center;gap:12px;padding:14px 20px;border-radius:10px;border:1px solid var(--h-item-border);background:var(--h-item-bg);cursor:pointer;transition:all .15s;color:var(--h-item-text);font-size:15px;font-weight:500;text-align:left}` +
`.hub-item:hover{background:var(--h-item-hover-bg);border-color:var(--h-item-hover-border);transform:translateX(4px)}` +
`.hub-num{width:28px;height:28px;border-radius:50%;background:var(--h-num-bg);color:var(--h-num-text);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0}` +
`.hub-toggle{position:fixed;top:16px;left:16px;width:40px;height:40px;border:none;border-radius:10px;background:var(--h-toggle-bg);color:var(--h-toggle-text);font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;backdrop-filter:blur(8px);z-index:50}` +
`.hub-toggle:hover{background:var(--h-toggle-hover);transform:scale(1.05)}` +
`';
container.appendChild(css);
var items=[${items}];
var root=document.createElement('div');
root.className='hub'+(_hubTheme==='light'?' light':'');
var toggle=document.createElement('button');
toggle.className='hub-toggle';
toggle.innerHTML=_hubTheme==='dark'?'\\u2600\\uFE0F':'\\u{1F319}';
toggle.title=_hubTheme==='dark'?'Switch to light mode':'Switch to dark mode';
toggle.onclick=function(){
  _hubTheme=_hubTheme==='dark'?'light':'dark';
  api.setVariable('var-theme',_hubTheme);
  root.className='hub'+(_hubTheme==='light'?' light':'');
  document.body.style.background=_hubTheme==='light'?'#f8fafc':'black';
  document.getElementById('container').style.background=_hubTheme==='light'?'#f8fafc':'black';
  toggle.innerHTML=_hubTheme==='dark'?'\\u2600\\uFE0F':'\\u{1F319}';
  toggle.title=_hubTheme==='dark'?'Switch to light mode':'Switch to dark mode';
};
root.appendChild(toggle);
var t=document.createElement('h1');t.className='hub-title';t.textContent='Game Editor Tutorial';
root.appendChild(t);
var sub=document.createElement('p');sub.className='hub-sub';sub.textContent='Choose a topic below to learn about the different features of the game editor.';
root.appendChild(sub);
var menu=document.createElement('div');menu.className='hub-menu';
items.forEach(function(item,i){
  var btn=document.createElement('div');btn.className='hub-item';
  btn.innerHTML='<div class="hub-num">'+(i+1)+'</div><span>'+item.label+'</span>';
  btn.onclick=function(){api.transitionToHandle(item.handle)};
  menu.appendChild(btn);
});
root.appendChild(menu);
container.appendChild(root);
`;
})();

// ── Nodes ──

const hubNode = {
  id: 'hub',
  type: 'scene',
  position: { x: 300, y: 300 },
  data: {
    label: 'Tutorial Hub',
    sceneType: 'custom',
    summary: 'Choose a topic to learn about the game editor.',
    customSceneConfig: {
      script: HUB_SCRIPT,
      language: 'javascript',
      outputHandles: tutorials.map(t => ({ id: t.hsId, label: t.label })),
    },
  },
};

const tutorialNodes = tutorials.map((t, i) => ({
  id: t.id,
  type: 'scene',
  position: { x: 700, y: i * 150 },
  data: {
    label: t.label,
    sceneType: 'custom',
    summary: `Interactive tutorial: ${t.label}`,
    customSceneConfig: {
      script: buildScript(t.title, t.steps()),
      language: 'javascript',
    },
  },
}));

const nodes = [hubNode, ...tutorialNodes];

// ── Edges ──

const edges = [
  // hub -> each tutorial (via hotspot handle)
  ...tutorials.map(t => ({
    id: `e-hub-${t.id}`,
    source: 'hub',
    target: t.id,
    sourceHandle: t.hsId,
  })),
  // each tutorial -> hub (default exit)
  ...tutorials.map(t => ({
    id: `e-${t.id}-hub`,
    source: t.id,
    target: 'hub',
  })),
];

// ── Game data ──

const variables = [
  { id: 'var-theme', name: 'theme', type: 'string', initialValue: 'dark' },
];

const gameData = { nodes, edges, variables, assetMap: {}, startNodeId: 'hub' };

// ════════════════════════════════════════════════════════════════════════════
// Generate ZIP
// ════════════════════════════════════════════════════════════════════════════

const jsonStr = JSON.stringify(gameData);

const html = [
  '<!DOCTYPE html>',
  '<html>',
  '<head>',
  '<meta charset="utf-8">',
  '<title>Game Editor Tutorial</title>',
  `<script>window.GAME_DATA = ${jsonStr};<\/script>`,
  '</head>',
  '<body></body>',
  '</html>',
].join('\n');

const zip = new JSZip();
zip.file('index.html', html);

const buffer = await zip.generateAsync({ type: 'nodebuffer' });
writeFileSync('tutorial-game.zip', buffer);

console.log(`Generated tutorial-game.zip (${(buffer.length / 1024).toFixed(1)} KB)`);
console.log(`  ${nodes.length} nodes, ${edges.length} edges`);
