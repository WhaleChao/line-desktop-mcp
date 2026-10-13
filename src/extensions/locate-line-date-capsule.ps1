param([Parameter(Mandatory=$true)][string]$InputPath)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$source=$null
try {
 $source=[Drawing.Bitmap]::FromFile($InputPath)
 if(($source.Width -ne 250 -or $source.Height -lt 14 -or $source.Height -gt 50)){throw 'Invalid input dimensions'}
 $sourceWidth=$source.Width
 # A date separator is a single centered, light grey capsule. Text alone or
 # an intersecting long message must not become a clipped date candidate.
 $points=[Collections.Generic.List[int]]::new()
 for($y=0;$y -lt $source.Height;$y++){for($x=0;$x -lt $sourceWidth;$x++){
   $c=$source.GetPixel($x,$y)
  if($c.A -eq 255 -and $c.R -ge 230 -and $c.R -le 253 -and [Math]::Abs($c.R-$c.G) -le 2 -and [Math]::Abs($c.R-$c.B) -le 2){$points.Add($y*$sourceWidth+$x)}
 }}
 $remaining=[Collections.Generic.HashSet[int]]::new()
 foreach($p in $points){[void]$remaining.Add($p)}
 $components=[Collections.Generic.List[object]]::new()
 while($remaining.Count -gt 0){
  $first=$remaining.GetEnumerator();[void]$first.MoveNext();$seed=$first.Current;$first.Dispose()
  $queue=[Collections.Generic.Queue[int]]::new();$queue.Enqueue($seed);[void]$remaining.Remove($seed)
  $left=$sourceWidth;$right=0;$top=$source.Height;$bottom=0;$count=0
  $rowEdges=@{}
  while($queue.Count -gt 0){
   $p=$queue.Dequeue();$x=$p%$sourceWidth;$y=[int][Math]::Floor($p/$sourceWidth);$count++
   $left=[Math]::Min($left,$x);$right=[Math]::Max($right,$x);$top=[Math]::Min($top,$y);$bottom=[Math]::Max($bottom,$y)
   if(!$rowEdges.ContainsKey($y)){$rowEdges[$y]=@{left=$x;right=$x}}
   $rowEdges[$y].left=[Math]::Min($rowEdges[$y].left,$x);$rowEdges[$y].right=[Math]::Max($rowEdges[$y].right,$x)
   foreach($next in @($(if($x -gt 0){$p-1}else{-1}),$(if($x -lt $sourceWidth-1){$p+1}else{-1}),($p-$sourceWidth),($p+$sourceWidth))){
    if($remaining.Remove($next)){$queue.Enqueue($next)}
   }
  }
  $w=$right-$left+1;$h=$bottom-$top+1
  $topWidth=$rowEdges[$top].right-$rowEdges[$top].left+1
  $bottomWidth=$rowEdges[$bottom].right-$rowEdges[$bottom].left+1
  $isDate=$w -ge 24 -and $w -le 200 -and $h -ge 14 -and $h -le 40 -and $left -gt 4 -and $right -lt 245 -and $top -gt 1 -and $bottom -lt $source.Height-2 -and $topWidth -le $w-6 -and $bottomWidth -le $w-6 -and [Math]::Abs(($left+$right+1)/2-125) -le 12 -and $count -ge $w*$h*0.55
  if($isDate){
   $components.Add(@{x=$left;y=$top;width=$w;height=$h})
  }
 }
 if($components.Count -ne 1){@{success=$true;dateCapsule=$false;width=250;height=$source.Height}|ConvertTo-Json -Compress;exit 0}
 $capsule=$components[0]
 @{success=$true;dateCapsule=$true;width=250;height=$source.Height;capsule=$capsule}|ConvertTo-Json -Compress
} catch {@{success=$false;code='LINE_DATE_CAPSULE_FAILED'}|ConvertTo-Json -Compress;exit 1}
finally {if($source){$source.Dispose()}}
