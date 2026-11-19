const PptxGenJS=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/pptxgenjs');
const pptx=new PptxGenJS();
pptx.layout='LAYOUT_WIDE';pptx.author='DAVYLAB';pptx.subject='DAVYLAB PPT Studio editable deck';pptx.title='DAVYLAB PPT Studio export smoke';pptx.lang='zh-CN';
const slides=[{type:'cover',title:'DAVYLAB PPT Studio',body:'从想法到专业演示\n开放、可编辑、可交付',notes:'编辑备注',source:''}, {type:'content',title:'验证原生对象',body:'第一个要点\n第二个要点',notes:'',source:'https://example.com'}];
for (const [i,s] of slides.entries()) {
 const slide=pptx.addSlide();slide.background={color:'FFFFFF'};slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:.13,h:7.5,line:{color:'2563EB',transparency:100},fill:{color:'2563EB'}});
 const isCover=s.type==='cover';
 slide.addText('DAVYLAB  /  PRESENTATION',{x:1,y:.57,w:9.5,h:.27,fontFace:'Aptos',fontSize:10,bold:true,color:'2563EB',charSpacing:2,margin:0});
 slide.addText(s.title,{x:1,y:isCover?2.05:1.33,w:11.3,h:isCover?2.15:1.23,fontFace:'Microsoft YaHei',fontSize:isCover?39:30,bold:true,color:'14243D',breakLine:false,margin:0,align:'left',valign:'mid',fit:'shrink',transparency:0});
 if(s.body)slide.addText(s.body,{x:1.03,y:isCover?4.44:3.02,w:11.15,h:isCover?1.4:3.46,fontFace:'Microsoft YaHei',fontSize:isCover?19:18,color:'5B6B86',margin:0,align:'left',valign:'top',breakLine:false,fit:'shrink',paraSpaceAfterPt:10});
 slide.addText('By DAVYLAB',{x:1,y:7.05,w:2.5,h:.22,fontFace:'Aptos',fontSize:8,color:'5B6B86',margin:0});
 slide.addText(String(i+1).padStart(2,'0'),{x:11.75,y:7.05,w:.6,h:.22,fontFace:'Aptos',fontSize:8,color:'5B6B86',margin:0,align:'right'});
 const note=[s.notes,s.source?'资料来源：'+s.source:''].filter(Boolean).join('\n');if(note&&typeof slide.addNotes==='function')slide.addNotes(note);
}
pptx.writeFile({fileName:'/mnt/data/davylab-ppt-p0/ppt-studio/tests/export-smoke.pptx'}).then(()=>console.log('PPTX export completed')).catch(e=>{console.error(e);process.exit(1)});

