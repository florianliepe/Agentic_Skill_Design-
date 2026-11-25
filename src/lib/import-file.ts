'use client';
import Papa from 'papaparse';
export const maxImportRows=2000;
export function checkXlsxArchive(bytes:ArrayBuffer){
 const view=new DataView(bytes);let end=-1;for(let i=view.byteLength-22;i>=Math.max(0,view.byteLength-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw new Error('Invalid XLSX archive.');const count=view.getUint16(end+10,true),offset=view.getUint32(end+16,true);if(count>1000||offset>=bytes.byteLength)throw new Error('Workbook archive limit exceeded.');
 let position=offset,total=0;for(let i=0;i<count;i++){if(position+46>view.byteLength||view.getUint32(position,true)!==0x02014b50)throw new Error('Invalid workbook directory.');const expanded=view.getUint32(position+24,true);if(expanded===0xffffffff)throw new Error('ZIP64 workbooks are not supported.');total+=expanded;if(total>25000000)throw new Error('Workbook expands beyond the 25 MB safety limit.');position+=46+view.getUint16(position+28,true)+view.getUint16(position+30,true)+view.getUint16(position+32,true);}
}
export async function parseImportFile(file:File,sheetName?:string):Promise<{headers:string[];rows:Record<string,string>[];sheets:string[];sheet:string}>{
 if(file.size>5000000)throw new Error('Maximum file size is 5 MB.');const extension=file.name.split('.').pop()?.toLowerCase();let cells:string[][]=[],sheets:string[]=[],sheet='CSV';
 if(extension==='csv'){
  const parsed=Papa.parse<string[]>(await file.text(),{skipEmptyLines:'greedy'});if(parsed.errors.length)throw new Error('CSV could not be parsed: '+parsed.errors[0].message);cells=parsed.data;
 }else if(extension==='xlsx'){
  const bytes=await file.arrayBuffer();checkXlsxArchive(bytes);const [{default:readExcelFile},{unzipSync,strFromU8}]=await Promise.all([import('read-excel-file/browser'),import('fflate')]);
  const xml=unzipSync(new Uint8Array(bytes),{filter:entry=>/^xl\/worksheets\/[^/]+\.xml$/.test(entry.name)});for(const content of Object.values(xml))if(/<f(?:\s|>)/.test(strFromU8(content)))throw new Error('Formula cells are not imported. Export values first.');
  const book=await readExcelFile(bytes);sheets=book.map(s=>s.sheet);const selected=sheetName?book.find(s=>s.sheet===sheetName):book[0];if(!selected)throw new Error('Choose a worksheet.');sheet=selected.sheet;if(selected.data.length>maxImportRows+1||selected.data.some(row=>row.length>100))throw new Error('Maximum 2,000 data rows and 100 columns.');cells=selected.data.map(row=>row.map(v=>v instanceof Date?v.toISOString():v===null?'':String(v)));

 }else throw new Error('Choose a UTF-8 CSV or XLSX workbook.');
 cells=cells.filter(row=>row.some(v=>String(v).trim()));if(cells.length<2)throw new Error('The file needs a header and at least one data row.');const headers=cells[0].map(h=>String(h).replace(/^\uFEFF/,'').trim());if(headers.length>100||headers.some(h=>!h||h.length>200)||new Set(headers).size!==headers.length)throw new Error('Use unique, non-empty column headers (maximum 100).');if(cells.length>maxImportRows+1)throw new Error('Split the file into batches of at most 2,000 rows.');
 const rows=cells.slice(1).map((row,i)=>{if(row.length>headers.length)throw new Error(`Row ${i+2} has more cells than the header.`);return Object.fromEntries(headers.map((h,n)=>[h,String(row[n]??'').trim()]));});if(JSON.stringify(rows).length>3000000)throw new Error('Split the file: maximum 3 MB of extracted text.');return {headers,rows,sheets,sheet};
}
export function splitImportRows(rows:Record<string,string>[]){const parts:Record<string,string>[][]=[];let current:Record<string,string>[]=[],size=2;for(const row of rows){const length=JSON.stringify(row).length+1;if(length>160000)throw new Error('One row exceeds the import chunk limit.');if(size+length>160000||current.length>=250){parts.push(current);current=[];size=2;}current.push(row);size+=length;}if(current.length)parts.push(current);return parts;}
