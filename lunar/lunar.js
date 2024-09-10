function generate(){
    var input=document.getElementById('input').value.toLowerCase();
    var table=document.getElementById('table');
    var len=input.length;
    if(len%9!=0){
        for(var i=9-len%9;i>0;--i){
            input+=" ";
        }
    }
    len=input.length;
    var html="<tr>";
    for(var i=1;i<=len;++i){
        index=input.charCodeAt(i-1)-96;
        if(index<1||index>26){
            index=0;
        }
        html+='<td><img src="pic/'+index+'.jpg"></td>';
        if(i%9==0){
            html+="</tr><tr>";
        }
    }
    table.innerHTML=html.slice(0,-4);
}