import {cpSync,mkdirSync} from 'node:fs';
for(const dir of ['cmaps','standard_fonts','wasm']){
mkdirSync('public/pdf-assets/'+dir,{recursive:true});
cpSync('node_modules/pdfjs-dist/'+dir,'public/pdf-assets/'+dir,{recursive:true});
}
