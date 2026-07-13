import { api, type Row } from './api';
const KEY='rfq-cart-token';
export function cartToken():string{return localStorage.getItem(KEY)??'';}
export async function ensureCart():Promise<string>{const current=cartToken();if(current)return current;const cart=await api<Row>('/quote-cart',{method:'POST',body:JSON.stringify({visitorId:localStorage.getItem('rfq-anonymous-id')??undefined})});localStorage.setItem(KEY,cart.public_token);window.dispatchEvent(new Event('cart-changed'));return cart.public_token;}
export async function getCart():Promise<Row|null>{const token=cartToken();if(!token)return null;try{return await api<Row>('/quote-cart',{headers:{'x-quote-cart-token':token}});}catch{localStorage.removeItem(KEY);return null;}}
export async function addModel(productId:string,modelId:string,quantity:number,itemNote=''):Promise<void>{const token=await ensureCart();await api('/quote-cart/items',{method:'POST',headers:{'x-quote-cart-token':token},body:JSON.stringify({productId,modelId,quantity,itemNote:itemNote||undefined})});window.dispatchEvent(new Event('cart-changed'));}
export async function updateCartItem(itemId:string,quantity:number):Promise<void>{await api(`/quote-cart/items/${itemId}`,{method:'PATCH',headers:{'x-quote-cart-token':cartToken()},body:JSON.stringify({quantity})});window.dispatchEvent(new Event('cart-changed'));}
export async function removeCartItem(itemId:string):Promise<void>{await api(`/quote-cart/items/${itemId}`,{method:'DELETE',headers:{'x-quote-cart-token':cartToken()}});window.dispatchEvent(new Event('cart-changed'));}
export function clearCartToken():void{localStorage.removeItem(KEY);window.dispatchEvent(new Event('cart-changed'));}
