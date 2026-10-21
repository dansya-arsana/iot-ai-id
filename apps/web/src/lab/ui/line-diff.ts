/** Indices (0-based) of lines in `next` that are not part of the longest common subsequence with `prev`. */
export function changedLines(prev:string[],next:string[]):number[]{
 const n=prev.length,m=next.length;
 const dp:number[][]=Array.from({length:n+1},()=>new Array<number>(m+1).fill(0));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=prev[i]===next[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
 const keep=new Set<number>();
 let i=0,j=0;
 while(i<n&&j<m){
  if(prev[i]===next[j]){keep.add(j);i++;j++;}
  else if(dp[i+1][j]>=dp[i][j+1])i++;
  else j++;
 }
 const out:number[]=[];
 for(let k=0;k<m;k++)if(!keep.has(k))out.push(k);
 return out;
}
export const diffText=(prev:string,next:string):number[]=>changedLines(prev.split('\n'),next.split('\n'));
