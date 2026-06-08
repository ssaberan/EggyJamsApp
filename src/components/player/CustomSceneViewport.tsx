import { useEffect, useRef, useState } from 'react';
import type { SceneNodeData, CustomSceneConfig } from '../../stores/graphStore';

type VariableValue = boolean | number | string;

interface CustomSceneViewportProps {
  nodeData: SceneNodeData;
  assetMap: Record<string, string>;
  onComplete: () => void;
  onTransitionToHandle: (handleId: string) => void;
  setVariable: (id: string, value: VariableValue) => void;
  initialVariables: Record<string, VariableValue>;
}

const SANDBOX_SRCDOC = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;background:black;overflow:hidden}
#container{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:white;font-family:system-ui,-apple-system,sans-serif}
</style>
</head><body>
<div id="container"></div>
<script>
(function(){
  var container=document.getElementById('container');
  var cleanupFns=[];

  window.addEventListener('message',function(event){
    var msg=event.data;
    if(!msg||!msg.type)return;

    if(msg.type==='init'){
      var variableMap=msg.variables||{};
      var assetMap=msg.assetMap||{};
      var script=msg.script||'';

      var api={
        onComplete:function(){parent.postMessage({type:'onComplete'},'*')},
        transitionToHandle:function(handleId){parent.postMessage({type:'transitionToHandle',handleId:handleId},'*')},
        getVariable:function(id){return variableMap.hasOwnProperty(id)?variableMap[id]:undefined},
        setVariable:function(id,value){variableMap[id]=value;parent.postMessage({type:'setVariable',id:id,value:value},'*')},
        getAssetUrl:function(id){return assetMap.hasOwnProperty(id)?assetMap[id]:null},
        onCleanup:function(fn){cleanupFns.push(fn)}
      };

      try{
        var fn=new Function('container','api',script);
        fn(container,api);
      }catch(err){
        parent.postMessage({type:'error',message:err.message||String(err)},'*');
      }
    }

    if(msg.type==='cleanup'){
      for(var i=0;i<cleanupFns.length;i++){try{cleanupFns[i]()}catch(e){}}
      cleanupFns=[];
    }
  });

  window.addEventListener('error',function(event){
    parent.postMessage({type:'error',message:event.message||'An error occurred in the custom scene.'},'*');
  });

  parent.postMessage({type:'ready'},'*');
})();
</script>
</body></html>`;

export default function CustomSceneViewport({
  nodeData,
  assetMap,
  onComplete,
  onTransitionToHandle,
  setVariable,
  initialVariables,
}: CustomSceneViewportProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const hasInitedRef = useRef(false);

  const onCompleteRef = useRef(onComplete);
  const onTransitionRef = useRef(onTransitionToHandle);
  const setVariableRef = useRef(setVariable);
  onCompleteRef.current = onComplete;
  onTransitionRef.current = onTransitionToHandle;
  setVariableRef.current = setVariable;

  const config = nodeData.customSceneConfig as CustomSceneConfig | undefined;
  const script = config?.script ?? '';

  const scriptRef = useRef(script);
  const assetMapRef = useRef(assetMap);
  const initialVariablesRef = useRef(initialVariables);
  scriptRef.current = script;
  assetMapRef.current = assetMap;
  initialVariablesRef.current = initialVariables;

  useEffect(() => {
    if (!script) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const msg = event.data;
      if (!msg || typeof msg.type !== 'string') return;

      switch (msg.type) {
        case 'ready':
          if (!hasInitedRef.current) {
            hasInitedRef.current = true;
            iframe.contentWindow?.postMessage({
              type: 'init',
              script: scriptRef.current,
              assetMap: assetMapRef.current,
              variables: initialVariablesRef.current,
            }, '*');
          }
          break;
        case 'onComplete':
          onCompleteRef.current();
          break;
        case 'transitionToHandle':
          onTransitionRef.current(msg.handleId);
          break;
        case 'setVariable':
          setVariableRef.current(msg.id, msg.value);
          break;
        case 'error':
          console.error('[CustomScene] Script error:', msg.message);
          setError(msg.message);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'cleanup' }, '*');
      }
      hasInitedRef.current = false;
    };
  }, [script]);

  if (error) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center gap-4 p-8">
        <div className="max-w-lg text-center space-y-3">
          <p className="text-red-400 text-lg font-semibold">Something went wrong in this scene</p>
          <pre className="text-red-300/70 text-sm bg-red-950/30 rounded-lg p-4 text-left overflow-auto max-h-40 whitespace-pre-wrap">
            {error}
          </pre>
          <button
            onClick={onComplete}
            className="mt-4 px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors cursor-pointer"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center">
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        srcDoc={SANDBOX_SRCDOC}
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  );
}
