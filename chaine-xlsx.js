/* Chaîne 2026 — dependency-free, genuine XLSX export (Office Open XML, ZIP STORE). */
window.ChaineXlsx=(()=>{
  'use strict';
  const te=new TextEncoder();
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
  const column=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF392F29"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  function sheetXML(rows){
    const max=Math.max(1,...rows.map(r=>r.length));
    let data='';
    rows.forEach((row,i)=>{
      data+=`<row r="${i+1}">`;
      row.forEach((val,j)=>{
        if(val===null||val===undefined||val==='')return;
        const ref=column(j)+(i+1), style=i===0?' s="1"':'';
        if(typeof val==='number'&&Number.isFinite(val)) data+=`<c r="${ref}"${style}><v>${val}</v></c>`;
        else data+=`<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${esc(val)}</t></is></c>`;
      });
      data+='</row>';
    });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${column(max-1)}${Math.max(1,rows.length)}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="16"/><cols>${Array.from({length:max},(_,j)=>`<col min="${j+1}" max="${j+1}" width="${j===0?31:Math.min(46,Math.max(15,...rows.slice(0,100).map(r=>String(r[j]??'').length+3)))}" customWidth="1"/>`).join('')}</cols><sheetData>${data}</sheetData><autoFilter ref="A1:${column(max-1)}${Math.max(1,rows.length)}"/></worksheet>`;
  }
  const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}
  function crc32(buf){let c=0xffffffff;for(let i=0;i<buf.length;i++)c=table[(c^buf[i])&255]^(c>>>8);return(c^0xffffffff)>>>0;}
  function zip(files){let pieces=[],directory=[],offset=0;const u16=(a,v)=>{a.push(v&255,(v>>>8)&255);},u32=(a,v)=>{u16(a,v&65535);u16(a,v>>>16);};
    for(const [name,body] of files){const nameBytes=te.encode(name),raw=te.encode(body),crc=crc32(raw);let head=[];
      u32(head,0x04034b50);u16(head,20);u16(head,0x0800);u16(head,0);u16(head,0);u16(head,0);u32(head,crc);u32(head,raw.length);u32(head,raw.length);u16(head,nameBytes.length);u16(head,0);
      pieces.push(Uint8Array.from(head),nameBytes,raw);
      let entry=[];u32(entry,0x02014b50);u16(entry,20);u16(entry,20);u16(entry,0x0800);u16(entry,0);u16(entry,0);u16(entry,0);u32(entry,crc);u32(entry,raw.length);u32(entry,raw.length);u16(entry,nameBytes.length);u16(entry,0);u16(entry,0);u16(entry,0);u16(entry,0);u32(entry,0);u32(entry,offset);directory.push(Uint8Array.from(entry),nameBytes);offset+=head.length+nameBytes.length+raw.length;
    }
    const dlen=directory.reduce((s,a)=>s+a.length,0), n=files.length;let end=[];u32(end,0x06054b50);u16(end,0);u16(end,0);u16(end,n);u16(end,n);u32(end,dlen);u32(end,offset);u16(end,0);
    return new Blob([...pieces,...directory,Uint8Array.from(end)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function build(sheets){
    const content=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
    const relationships=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${esc(s.name.slice(0,31))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
    const wbRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    return zip([['[Content_Types].xml',content],['_rels/.rels',relationships],['xl/workbook.xml',workbook],['xl/_rels/workbook.xml.rels',wbRels],['xl/styles.xml',styles],...sheets.map((s,i)=>[`xl/worksheets/sheet${i+1}.xml`,sheetXML(s.rows)])]);
  }
  function save(sheets,filename){const blob=build(sheets),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3500);}
  return {build,save};
})();
