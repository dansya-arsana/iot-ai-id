import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';

export type Lang='en'|'id';
const STORAGE_KEY='iot-lang';
type LangContext={lang:Lang;setLang:(lang:Lang)=>void;tr:(en:string,id:string)=>string};
const Context=createContext<LangContext|null>(null);

function initialLang():Lang{try{return localStorage.getItem(STORAGE_KEY)==='id'?'id':'en';}catch{return 'en';}}

/** English is the default; Indonesian is the opt-in alternative, remembered per browser. */
export function LangProvider({children}:{children:ReactNode}){
 const[lang,setLang]=useState<Lang>(initialLang);
 useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,lang);}catch{/* storage unavailable */}document.documentElement.lang=lang;},[lang]);
 const tr=useCallback((en:string,id:string)=>lang==='id'?id:en,[lang]);
 const value=useMemo(()=>({lang,setLang,tr}),[lang,tr]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLang(){
 const value=useContext(Context);
 if(!value)throw new Error('useLang must be used inside LangProvider');
 return value;
}
