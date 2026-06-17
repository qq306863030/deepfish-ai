import { render } from 'solid-js/web';
import App from './App';

// 渲染前清掉 SSR 注入的占位内容，避免与客户端 render 后的 DOM 短暂并存导致视觉上的"双层模块"
const mount = document.getElementById('app');
if (mount) mount.innerHTML = '';
render(() => <App />, mount!);
