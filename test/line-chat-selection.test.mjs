import test from 'node:test';
import assert from 'node:assert/strict';
import {readPlainIdentity} from '../src/extensions/line-plain-send.mjs';
import {readLocalLineChatCandidates,validateCandidateScope} from '../src/extensions/line-local-reader.mjs';
import {LINE_TOOL_DESCRIPTORS,createLineExtensions} from '../src/extensions/line-extensions.mjs';
const chatRef='chat:'+'a'.repeat(24), ownSenderRef='sender:'+'b'.repeat(24);
const args={chatName:'Jerry',chatType:'direct',expectedChatRef:chatRef,expectedOwnSenderRef:ownSenderRef};
const identity={chatRef,ownSenderRef,chatIdentity:{kind:'direct',knownNameUnique:true,globalNameUnique:false}};

test('selected existing chat uses paired identity lookup and retains send-context requirement',async()=>{
 let scope;
 const result=await readPlainIdentity(args,{readIdentity:()=>assert.fail('must not use name-only lookup'),readBoundIdentity:async s=>{scope=s;return identity;}});
 assert.equal(scope.expectedChatRef,chatRef);
 assert.equal(scope.expectedOwnSenderRef,ownSenderRef);
 assert.equal(scope.messageLimit,1);
 assert.equal(scope.requireUniqueName,undefined);
 assert.deepEqual(result,{chatRef,kind:'direct',ownSenderRef,requiresSendContext:true});
});
test('changed chat, account or unresolved existing identity cannot reach opening',async()=>{
 for(const [change,code] of [[{chatRef:'chat:'+'c'.repeat(24)},'CHAT_IDENTITY_CHANGED'],
   [{ownSenderRef:'sender:'+'d'.repeat(24)},'CHAT_ACCOUNT_CHANGED'],
   [{chatIdentity:{kind:'direct',knownNameUnique:false,globalNameUnique:false}},'LINE_CHAT_IDENTITY_UNVERIFIED']])
   await assert.rejects(readPlainIdentity(args,{readBoundIdentity:async()=>({...identity,...change})}),{code});
});
test('partial or malformed selection refuses before accessing the reader',async()=>{
 for(const selected of [{chatName:'Jerry',expectedChatRef:chatRef},
   {...args,expectedOwnSenderRef:'raw-mid'},{...args,chatType:'auto'}])
   await assert.rejects(readPlainIdentity(selected,{readIdentity:()=>assert.fail(),readBoundIdentity:()=>assert.fail()}),{code:'LINE_INVALID_ARGUMENT'});
});
test('name-only path preserves global uniqueness rather than choosing a candidate',async()=>{
 let scope;
 const result=await readPlainIdentity({chatName:'Jerry'},{readIdentity:async s=>{scope=s;return {chatRef,chatIdentity:{kind:'direct'}};}});
 assert.equal(scope.requireUniqueName,true);
 assert.equal(scope.chatType,'auto');
 assert.deepEqual(result,{chatRef,kind:'direct'});
});
test('candidate protocol exposes only named identity metadata',async()=>{
 const scope=validateCandidateScope({chatName:'Jerry'});
 const output={ok:true,chatName:'Jerry',ownSenderRef,candidates:[{chatRef,chatName:'Jerry',chatType:'direct',existingChat:true}],hasMore:false,
   scope:{kind:'local_chat_candidates',requested:{limit:20,chatName:'Jerry',mode:'chatCandidates'}},messages:['private'],rawMid:'private'};
 const result=await readLocalLineChatCandidates({chatName:'Jerry'},{runProcess:async s=>{assert.deepEqual(s,scope);return {code:0,stdout:JSON.stringify(output)};}});
 assert.equal(result.candidates.length,1);
 assert.equal(result.messages,undefined);assert.equal(result.rawMid,undefined);
 for(const changed of [{chatName:'Other'}, {candidates:[{...output.candidates[0],chatName:'Other'}]},
   {candidates:[{...output.candidates[0],rawMid:'private'}]}, {ownSenderRef:'private'},
   {candidates:[output.candidates[0],output.candidates[0]]}])
   await assert.rejects(readLocalLineChatCandidates({chatName:'Jerry'},{runProcess:async()=>({code:0,stdout:JSON.stringify({...output,...changed})})}),{code:'LOCAL_READER_SCOPE_MISMATCH'});
});
test('candidate request cannot carry message or media scope flags',()=>{
 for(const extra of [{dateFrom:'2026-10-12'},{mediaMode:'preview'},{query:'other'},{limit:21},{limit:true}])
   assert.throws(()=>validateCandidateScope({chatName:'Jerry',...extra}),{code:'LINE_INVALID_ARGUMENT'});
});
test('public handlers forward selection refs and keep candidates read-only',async()=>{
 const descriptor=LINE_TOOL_DESCRIPTORS.find(t=>t.name==='list_line_chat_candidates');
 assert.equal(descriptor.annotations.readOnlyHint,true);
 const open=LINE_TOOL_DESCRIPTORS.find(t=>t.name==='open_line_chat');
 assert.ok(open.inputSchema.properties.expectedChatRef);
 let seen;
 const handlers=createLineExtensions({}, {ui:{openChat:async a=>{seen=a;return {success:true};}},candidateReader:async()=>({candidates:[]})});
 const opened=await handlers.call('open_line_chat',args);
 assert.equal(opened.isError,undefined);
 assert.deepEqual(seen,args);
 const candidates=await handlers.call('list_line_chat_candidates',{chatName:'Jerry'});
 assert.deepEqual(JSON.parse(candidates.content[0].text),{candidates:[]});
 const invalid=await handlers.call('open_line_chat',{chatName:'Jerry',expectedChatRef:chatRef});
 assert.equal(JSON.parse(invalid.content[0].text).code,'LINE_INVALID_ARGUMENT');
});
