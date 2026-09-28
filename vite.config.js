import { defineConfig } from 'vite';
export default defineConfig({server:{watch:{ignored:['**/.cache/**','**/.venv/**','**/uploads/**','**/database/**','**/docs/screenshots/**']},proxy:{'/api':'http://127.0.0.1:8000'}},build:{outDir:'dist'}});
