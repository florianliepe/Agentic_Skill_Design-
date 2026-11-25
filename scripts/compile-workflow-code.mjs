import {build} from 'esbuild';
export async function compileWorkflowCode(entry){const compiled=await build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});return compiled.outputFiles[0].text.replace(/\nexport\s*\{[^}]*\};?/g,'');}
