'use client';
import {useId,useState} from 'react';
type Option={id:string;label:string;detail?:string};
export function SearchPicker({label,value,options,onChange}:{label:string;value:string;options:Option[];onChange:(id:string)=>void}){
  const id=useId(),[query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(0);
  const selected=options.find(o=>o.id===value),terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches=options.filter(o=>terms.every(t=>`${o.id} ${o.label} ${o.detail||''}`.toLowerCase().includes(t)));
  const shown=matches.slice(0,25);
  const choose=(option:Option)=>{onChange(option.id);setOpen(false);setQuery('');setActive(0);};
  return <div className="search-picker" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setOpen(false);}}>
    <input aria-label={label} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open&&shown[active]?`${id}-${active}`:undefined} value={open?query:selected?`${selected.label} (${selected.id})`:''} placeholder={`Search ${label.toLowerCase()}…`} onFocus={()=>{setOpen(true);setQuery('');}} onChange={e=>{setQuery(e.target.value);setOpen(true);setActive(0);}} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);return;}if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setActive(n=>Math.min(n+1,shown.length-1));}if(e.key==='ArrowUp'){e.preventDefault();setActive(n=>Math.max(0,n-1));}if(e.key==='Enter'&&open){e.preventDefault();if(shown[active])choose(shown[active]);}}}/>
    {open&&<div className="picker-menu"><div id={`${id}-list`} role="listbox" aria-label={`${label} results`}>{shown.map((o,i)=><button type="button" role="option" id={`${id}-${i}`} aria-selected={o.id===value} className={i===active?'active':''} key={o.id} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(o)}><strong>{o.label}</strong><small>{o.id} · {o.detail}</small></button>)}</div><small>{matches.length?`${matches.length} matches${matches.length>25?' · type more to narrow results':''}`:'No matching entries. Try a shorter term or canonical ID.'}</small></div>}
  </div>;
}
