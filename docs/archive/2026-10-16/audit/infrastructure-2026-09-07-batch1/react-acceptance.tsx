import React, {useCallback, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useIntelPollingQuery} from '../../../src/hooks/useIntelPollingQuery';
const empty: number[] = [];
function Probe(){
 const [enabled,setEnabled]=useState(true);
 const [key,setKey]=useState('A');
 const mode=useRef('ready');
 const calls=useRef(0);
 const load=useCallback(async()=>{calls.current++; if(mode.current==='denied')throw {code:'42501'}; if(mode.current==='error')throw Error('test outage'); return {status:'ready' as const,data:[key==='A'?7:9],lastSuccessAt:Date.now()};},[key]);
 const q=useIntelPollingQuery({enabled,queryKey:key,intervalMs:300,emptyData:empty,load});
 return <main><h1>Local React acceptance — synthetic data only</h1><pre role="status">{JSON.stringify({status:q.status,data:q.data,key:q.queryKey,hasSuccess:q.lastSuccessAt!==null,calls:calls.current,enabled})}</pre><button onClick={()=>mode.current='error'}>Outage</button><button onClick={()=>mode.current='ready'}>Recover</button><button onClick={()=>mode.current='denied'}>Deny</button><button onClick={()=>setKey(key==='A'?'B':'A')}>Switch query</button><button onClick={()=>setEnabled(!enabled)}>Toggle polling</button></main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Probe/></React.StrictMode>);
