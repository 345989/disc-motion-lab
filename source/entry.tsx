import {createRoot} from 'react-dom/client';
import Home from './app/page';
import {Component,ReactNode} from 'react';
if(!Object.hasOwn)Object.defineProperty(Object,'hasOwn',{value:(object:object,key:PropertyKey)=>Object.prototype.hasOwnProperty.call(object,key),configurable:true});
if(!Array.prototype.at)Object.defineProperty(Array.prototype,'at',{value:function(index:number){let n=Math.trunc(index)||0;if(n<0)n+=this.length;return this[n];},configurable:true});
class ErrorBoundary extends Component<{children:ReactNode},{error:string}>{state={error:''};static getDerivedStateFromError(error:Error){return {error:error.message};}render(){if(this.state.error)return <div style={{maxWidth:650,margin:'60px auto',padding:25,fontFamily:'system-ui',lineHeight:2}}><h1>程序未能启动</h1><p>请先将 HTML 保存到本地，再在 Chrome、Edge、Firefox 或 Safari 等浏览器中打开。聊天软件或文件预览器可能不会执行脚本。</p><pre style={{whiteSpace:'pre-wrap'}}>{this.state.error}</pre><button onClick={()=>location.reload()}>重新加载</button></div>;return this.props.children;}}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><Home/></ErrorBoundary>);
