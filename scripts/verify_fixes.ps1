# Verify 7 bug backend sau khi deploy.
# Chay:  powershell -ExecutionPolicy Bypass -File verify_fixes.ps1
$ErrorActionPreference='Continue'
$ProgressPreference='SilentlyContinue'
$base='http://161.118.247.84:8000/api'
$pass=0; $fail=0

function Login($mail){
  (Invoke-RestMethod "$base/identity/auth/login" -Method Post -Body (@{email=$mail;password='SamplePass123!'}|ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 20).data.access_token
}
function Call {
  param([string]$Verb,[string]$Route,[string]$Jwt,$Payload=$null,[int]$Secs=30)
  $hdr=@{}; if($Jwt){ $hdr['Authorization']="Bearer $Jwt" }
  $a=@{ Uri=($base+$Route); Method=$Verb; Headers=$hdr; TimeoutSec=$Secs; UseBasicParsing=$true }
  if($null -ne $Payload){ $a['Body']=($Payload|ConvertTo-Json -Depth 8); $a['ContentType']='application/json' }
  try{ $r=Invoke-WebRequest @a; return [pscustomobject]@{code=[int]$r.StatusCode;body=$r.Content} }
  catch{ $sc=-1;$bd=$_.Exception.Message
    if($_.Exception.Response){ $sc=[int]$_.Exception.Response.StatusCode
      try{$bd=(New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd()}catch{} }
    return [pscustomobject]@{code=$sc;body=$bd} }
}
function Check($bug,$name,$ok,$detail){
  if($ok){ $script:pass++; Write-Host ("  PASS  [{0}] {1}" -f $bug,$name) -ForegroundColor Green }
  else   { $script:fail++; Write-Host ("  FAIL  [{0}] {1} -> {2}" -f $bug,$name,$detail) -ForegroundColor Red }
}

$AT=Login 'an.nguyen@example.com'
$UT=Login 'binh.tran@example.com'
$AG='1bbb1111-1111-1111-1111-111111111111'   # nhom cua admin
$UG='2ccc2222-2222-2222-2222-222222222222'   # nhom cua binh
$AC='3ddd3333-3333-3333-3333-333333333333'   # campaign cua nhom admin
Write-Host "`n===== VERIFY BACKEND FIXES =====`n"

# ---------- BUG-1 ----------
Write-Host "BUG-1: next_code() sinh ma trung -> 500"
$r=Call -Verb POST -Route '/donation/campaigns' -Jwt $AT -Payload @{
  group_id=$AG; title="Verify campaign $(Get-Random -Max 99999)"
  description='verify'; items=@(@{name='Ao am';target_quantity=10;unit='cai'})
}
Check 'BUG-1' 'POST /campaigns tao duoc' ($r.code -eq 201) "code=$($r.code) $($r.body)"
$NEWC=$null
if($r.code -eq 201){
  $cj=($r.body|ConvertFrom-Json).data
  $NEWC=$cj.id
  Check 'BUG-1' "ma sinh dung dinh dang 5 chu so ($($cj.code))" ($cj.code -match '^CP-\d{4}-\d{5}$') $cj.code
  Check 'BUG-2' 'POST /campaigns tra ve nested items' ($cj.items.Count -eq 1) "items=$($cj.items.Count)"
}
$r2=Call -Verb POST -Route '/donation/campaigns' -Jwt $AT -Payload @{
  group_id=$AG; title="Verify campaign 2 $(Get-Random -Max 99999)"; items=@(@{name='Chan';target_quantity=5})
}
Check 'BUG-1' 'tao lien tiep khong trung ma' ($r2.code -eq 201) "code=$($r2.code)"

# ---------- BUG-2 ----------
Write-Host "`nBUG-2: list() khong tra nested items"
$r=Call -Verb GET -Route '/donation/campaigns?status=active&limit=50&offset=0' -Jwt $UT
$lj=($r.body|ConvertFrom-Json).data.items
$withItems=@($lj | Where-Object { $_.items.Count -gt 0 }).Count
Check 'BUG-2' "GET /campaigns co items ($withItems/$($lj.Count) dot)" ($withItems -gt 0) "khong dot nao co items"

$r=Call -Verb GET -Route "/donation/contributions?campaign_id=$AC&limit=100&offset=0" -Jwt $AT
$cl=($r.body|ConvertFrom-Json).data.items
$ctrWith=@($cl | Where-Object { $_.items.Count -gt 0 }).Count
Check 'BUG-2' "GET /contributions co items ($ctrWith/$($cl.Count))" ($cl.Count -eq 0 -or $ctrWith -gt 0) "khong contribution nao co items"

# ---------- BUG-1/2: contribution ----------
Write-Host "`nBUG-1+2: tao contribution"
$d=Call -Verb GET -Route "/donation/campaigns/$AC" -Jwt $UT
$IID=($d.body|ConvertFrom-Json).data.items[0].id
$r=Call -Verb POST -Route '/donation/contributions' -Jwt $UT -Payload @{
  campaign_id=$AC; pickup_method='drop_off'
  items=@(@{campaign_item_id=$IID;name='Ao khoac verify';quantity=2;condition_declared='good';images=@()})
}
Check 'BUG-1' 'POST /contributions tao duoc' ($r.code -eq 201) "code=$($r.code) $($r.body)"
$NEWCTR=$null
if($r.code -eq 201){
  $ctrj=($r.body|ConvertFrom-Json).data
  $NEWCTR=$ctrj.id
  Check 'BUG-1' "ma CTR dung dinh dang ($($ctrj.code))" ($ctrj.code -match '^CTR-\d{4}-\d{5}$') $ctrj.code
  Check 'BUG-2' 'POST /contributions tra nested items' ($ctrj.items.Count -eq 1) "items=$($ctrj.items.Count)"
}

# ---------- BUG-7 ----------
Write-Host "`nBUG-7: GET /contributions khong loc quyen"
$r=Call -Verb GET -Route '/donation/contributions?limit=100&offset=0' -Jwt $UT
$all=($r.body|ConvertFrom-Json).data.items
$others=@($all | Where-Object { $_.donor_id -ne 'b2222222-2222-2222-2222-222222222222' })
Check 'BUG-7' "user thuong chi thay dong gop cua minh ($($all.Count) ban ghi)" ($others.Count -eq 0) "van thay $($others.Count) cua nguoi khac"

$r=Call -Verb GET -Route '/donation/contributions?donor_id=a1111111-1111-1111-1111-111111111111&limit=100' -Jwt $UT
$leak=@(($r.body|ConvertFrom-Json).data.items | Where-Object { $_.donor_id -ne 'b2222222-2222-2222-2222-222222222222' })
Check 'BUG-7' 'ep donor_id nguoi khac bi chan' ($leak.Count -eq 0) "lo $($leak.Count) ban ghi"

$r=Call -Verb GET -Route '/donation/contributions?limit=100&offset=0' -Jwt $AT
Check 'BUG-7' 'admin van xem duoc tat ca' ($r.code -eq 200) "code=$($r.code)"

if($NEWCTR){
  $r=Call -Verb GET -Route "/donation/contributions/$NEWCTR" -Jwt $UT
  Check 'BUG-7' 'chinh chu xem duoc contribution cua minh' ($r.code -eq 200) "code=$($r.code)"
}

# ---------- BUG-4 + BUG-5 ----------
Write-Host "`nBUG-4+5: posts"
$r=Call -Verb POST -Route "/community/groups/$AG/posts" -Jwt $UT -Payload @{content='Verify post';type='normal';image_urls=@()}
$POSTID=($r.body|ConvertFrom-Json).data.id
Check 'setup' 'tao post' ($r.code -eq 201) "code=$($r.code)"

$r=Call -Verb POST -Route "/community/posts/$POSTID/reactions" -Jwt $UT
$k1=($r.body|ConvertFrom-Json).data
Check 'BUG-5' "like tra like_count kieu so ($($k1.like_count))" ($null -ne $k1.like_count -and $k1.like_count -is [int]) "body=$($r.body)"
Check 'BUG-5' 'like lan 1 changed=true' ($k1.changed -eq $true) "changed=$($k1.changed)"

$r=Call -Verb POST -Route "/community/posts/$POSTID/reactions" -Jwt $UT
$k2=($r.body|ConvertFrom-Json).data
Check 'BUG-5' 'like lan 2 changed=false' ($k2.changed -eq $false) "changed=$($k2.changed)"
Check 'BUG-5' 'like lan 2 khong tang so dem' ($k2.like_count -eq $k1.like_count) "$($k1.like_count) -> $($k2.like_count)"

$r=Call -Verb DELETE -Route "/community/posts/$POSTID/reactions" -Jwt $UT
$u1=($r.body|ConvertFrom-Json).data
Check 'BUG-5' 'unlike tra liked=false' ($u1.liked -eq $false) "liked=$($u1.liked)"

$r=Call -Verb DELETE -Route "/community/posts/$POSTID" -Jwt $UT
Check 'BUG-4' 'DELETE /posts/{id} (tac gia tu xoa)' ($r.code -eq 204) "code=$($r.code)"

$r=Call -Verb POST -Route "/community/groups/$AG/posts" -Jwt $UT -Payload @{content='Post cho mod xoa';type='normal';image_urls=@()}
$P2=($r.body|ConvertFrom-Json).data.id
$r=Call -Verb DELETE -Route "/community/posts/$P2" -Jwt $AT
Check 'BUG-4' 'DELETE boi moderator' ($r.code -eq 204) "code=$($r.code)"

# ---------- BUG-6 ----------
Write-Host "`nBUG-6: notifications unread_only"
$r=Call -Verb GET -Route '/communication/notifications?unread_only=true&limit=50&offset=0' -Jwt $AT
$snake=($r.body|ConvertFrom-Json)
$readInSnake=@($snake | Where-Object { $_.is_read -eq $true }).Count
Check 'BUG-6' "unread_only (snake) duoc ap dung ($($snake.Count) ban ghi)" ($readInSnake -eq 0) "lot $readInSnake ban ghi da doc"

$r=Call -Verb GET -Route '/communication/notifications?unreadOnly=true&limit=50&offset=0' -Jwt $AT
$camel=($r.body|ConvertFrom-Json)
Check 'BUG-6' 'unreadOnly (camel) van hoat dong' (@($camel | Where-Object { $_.is_read -eq $true }).Count -eq 0) 'lot ban ghi da doc'

# ---------- BUG-3 ----------
Write-Host "`nBUG-3: tao hoi thoai"
$r=Call -Verb POST -Route '/communication/conversations' -Jwt $UT -Payload @{groupId=$AG}
Check 'BUG-3' 'POST /conversations tao duoc' ($r.code -eq 201) "code=$($r.code) $($r.body)"
if($r.code -eq 201){
  $c1=($r.body|ConvertFrom-Json)
  $r=Call -Verb POST -Route '/communication/conversations' -Jwt $UT -Payload @{groupId=$AG}
  $c2=($r.body|ConvertFrom-Json)
  Check 'BUG-3' 'goi lai idempotent (cung id)' ($c1.id -eq $c2.id) "$($c1.id) vs $($c2.id)"
  $r=Call -Verb POST -Route "/communication/conversations/$($c1.id)/messages" -Jwt $UT -Payload @{content='Tin nhan verify';type='text';asGroup=$false}
  Check 'BUG-3' 'gui tin nhan trong hoi thoai moi' ($r.code -eq 200) "code=$($r.code)"
}

# ---------- Regression ----------
Write-Host "`nREGRESSION: cac API cu"
Check 'reg' 'GET /campaigns' ((Call -Verb GET -Route '/donation/campaigns?limit=10' -Jwt $UT).code -eq 200) ''
Check 'reg' 'GET /categories' ((Call -Verb GET -Route '/donation/categories' -Jwt $UT).code -eq 200) ''
Check 'reg' 'GET /groups' ((Call -Verb GET -Route '/community/groups?limit=10' -Jwt $UT).code -eq 200) ''
Check 'reg' 'GET /profile/me' ((Call -Verb GET -Route '/identity/profile/me' -Jwt $UT).code -eq 200) ''
Check 'reg' 'GET progress' ((Call -Verb GET -Route "/donation/campaigns/$AC/progress" -Jwt $UT).code -eq 200) ''
Check 'reg' 'PUT /campaigns (mod)' ((Call -Verb PUT -Route "/donation/campaigns/$AC" -Jwt $AT -Payload @{description='regression ok'}).code -eq 200) ''
Check 'reg' 'PUT /campaigns user thuong bi chan' ((Call -Verb PUT -Route "/donation/campaigns/$AC" -Jwt $UT -Payload @{description='hack'}).code -eq 403) ''
Check 'reg' 'GET /accounts admin' ((Call -Verb GET -Route '/identity/accounts?page=1&limit=5' -Jwt $AT).code -eq 200) ''
Check 'reg' 'GET /accounts user bi chan' ((Call -Verb GET -Route '/identity/accounts?page=1&limit=5' -Jwt $UT).code -eq 403) ''

# cleanup
if($NEWC){ Call -Verb PUT -Route "/donation/campaigns/$NEWC/close" -Jwt $AT -Payload @{reason='verify done'} | Out-Null }

Write-Host "`n===== KET QUA: $pass PASS / $fail FAIL =====" -ForegroundColor $(if($fail -eq 0){'Green'}else{'Red'})
