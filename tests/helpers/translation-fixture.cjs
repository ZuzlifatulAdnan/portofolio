'use strict';
const http=require('node:http');
async function startTranslatorFixture(){
 const state={requests:[],fail:false};
 const server=http.createServer(async(req,res)=>{
  if(req.url!=='/translate'||req.method!=='POST'){res.writeHead(404);res.end();return}
  let raw='';for await(const chunk of req)raw+=chunk;
  const body=JSON.parse(raw);state.requests.push(body);
  res.writeHead(state.fail?503:200,{'Content-Type':'application/json'});
  res.end(JSON.stringify(state.fail?{error:'Simulated provider failure'}:{translatedText:body.q.map(text=>`[${body.target.toUpperCase()}] ${text}`)}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {state,origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>{server.close(resolve);server.closeIdleConnections()})};
}
module.exports={startTranslatorFixture};
