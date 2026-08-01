$ErrorActionPreference='Continue'
$ProgressPreference='SilentlyContinue'
$base='http://161.118.247.84:8000/api'
$pass=0; $fail=0
function Login($mail){ (Invoke-RestMethod "$base/identity/auth/login" -Method Post -Body (@{email=$mail;password='SamplePass123!'}|ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 25).data.access_token }
function Call {
  param([string]$Verb,[string]$Route,[string]$Jwt,$Payload=$null,[int]$Secs=30)
  $hdr=@{}; if($Jwt){ $hdr['Authorization']="Bearer $Jwt" }
  $a=@{ Uri=($base+$Route); Method=$Verb; Headers=$hdr; TimeoutSec=$Secs; UseBasicParsing=$true }
  if($null -ne $Payload){ $a['Body']=($Payload|ConvertTo-Json -Depth 8); $a['ContentType']='application/json' }
  try{ $r=Invoke-WebRequest @a; return [pscustomobject]@{code=[int]$r.StatusCode;body=$r.Content} }
  catch{
    $sc=-1; $bd=''
    $resp=$_.Exception.Response
    if($resp){
      $sc=[int]$resp.StatusCode
      # PowerShell 5.1 doi khi da doc het stream -> thu ca 2 cach
      try{
        $st=$resp.GetResponseStream(); $st.Position=0
        $bd=(New-Object IO.StreamReader($st)).ReadToEnd()
      }catch{}
      if(-not $bd){ try{ $bd=$_.ErrorDetails.Message }catch{} }
    }
    if(-not $bd){ $bd=$_.Exception.Message }
    return [pscustomobject]@{code=$sc;body=$bd} }
}
function Check($name,$ok,$detail){
  if($ok){ $script:pass++; Write-Host "  PASS  $name" -ForegroundColor Green }
  else   { $script:fail++; Write-Host "  FAIL  $name -> $detail" -ForegroundColor Red }
}

$AT=Login 'an.nguyen@example.com'   # PLATFORM_ADMIN, owner nhom 1bbb
$UT=Login 'binh.tran@example.com'   # USER, owner nhom 2ccc
$AG='1bbb1111-1111-1111-1111-111111111111'
$UG='2ccc2222-2222-2222-2222-222222222222'

Write-Host "`n===== QUY TAC: PHAI JOIN NHOM MOI QUYEN GOP =====`n"

# Lay campaign CO items cua tung nhom
function PickCampaign($groupId, $jwt) {
  $r = (Call -Verb GET -Route "/donation/campaigns?group_id=$groupId&status=active&limit=50" -Jwt $jwt).body | ConvertFrom-Json
  $c = @($r.data.items | Where-Object { $_.items.Count -gt 0 })[0]
  if (-not $c) { Write-Host "  KHONG co campaign nao co items cho group $groupId" -ForegroundColor Red; exit 1 }
  return [pscustomobject]@{ id = $c.id; itemId = $c.items[0].id; title = $c.title }
}
$acc = PickCampaign $AG $AT
$ucc = PickCampaign $UG $UT
$AC = $acc.id; $ACITEM = $acc.itemId
$UC = $ucc.id; $UCITEM = $ucc.itemId
Write-Host "campaign nhom ADMIN=$AC (item=$ACITEM)"
Write-Host "campaign nhom USER =$UC (item=$UCITEM)`n"

Write-Host "[1] Kiem tra tinh trang thanh vien hien tai"
$g=(Call -Verb GET -Route "/community/groups/$UG" -Jwt $AT).body|ConvertFrom-Json
Write-Host "    admin trong nhom USER : my_status=$($g.data.my_status) my_role=$($g.data.my_role)"
$g2=(Call -Verb GET -Route "/community/groups/$AG" -Jwt $UT).body|ConvertFrom-Json
Write-Host "    user  trong nhom ADMIN: my_status=$($g2.data.my_status) my_role=$($g2.data.my_role)"

# Dam bao user la thanh vien da duyet truoc khi test buoc [2]
if($g2.data.my_status -ne 'approved'){
  Write-Host "    -> dua user vao nhom ADMIN de test" -ForegroundColor Yellow
  $jr0=Call -Verb POST -Route "/community/groups/$AG/join" -Jwt $UT -Payload @{message='setup'}
  $id0=($jr0.body|ConvertFrom-Json).data.id
  if(-not $id0){
    $pend=(Call -Verb GET -Route "/community/groups/$AG/join-requests?status=pending&limit=50" -Jwt $AT).body|ConvertFrom-Json
    $id0=@($pend.data.items | Where-Object { $_.user_id -eq 'b2222222-2222-2222-2222-222222222222' })[0].id
  }
  if($id0){ Call -Verb POST -Route "/community/groups/$AG/join-requests/$id0/approve" -Jwt $AT | Out-Null }
  Start-Sleep -Seconds 2
  $g2=(Call -Verb GET -Route "/community/groups/$AG" -Jwt $UT).body|ConvertFrom-Json
  Write-Host "    my_status sau setup = $($g2.data.my_status)"
}

Write-Host "`n[2] Thanh vien da duyet -> quyen gop DUOC"
$r=Call -Verb POST -Route '/donation/contributions' -Jwt $UT -Payload @{
  campaign_id=$AC; pickup_method='drop_off'
  items=@(@{campaign_item_id=$ACITEM;name='Ao khoac';quantity=1;condition_declared='good';images=@()})
}
Check "user (approved) gop vao nhom ADMIN -> 201" ($r.code -eq 201) "code=$($r.code) $($r.body)"

Write-Host "`n[3] Chu nhom tu quyen gop vao nhom minh -> DUOC"
$r=Call -Verb POST -Route '/donation/contributions' -Jwt $UT -Payload @{
  campaign_id=$UC; pickup_method='drop_off'
  items=@(@{campaign_item_id=$UCITEM;name='Gao';quantity=1;condition_declared='new';images=@()})
}
Check "owner gop vao nhom cua minh -> 201" ($r.code -eq 201) "code=$($r.code) $($r.body)"

Write-Host "`n[4] Tao user moi (chua join nhom nao) -> BI CHAN"
$rnd=Get-Random -Max 999999
$email="qa$rnd@example.com"
$reg=Call -Verb POST -Route '/identity/auth/register' -Jwt $null -Payload @{
  email=$email; password='SamplePass123!'; full_name="QA Tester $rnd"
}
Write-Host "    dang ky: code=$($reg.code)"
if($reg.code -eq 201){
  # Tai khoan moi chua verify email -> khong login duoc. Dung admin de kiem tra
  # bang cach khac: kick admin ra khoi nhom USER roi thu gop.
  Write-Host "    (tai khoan moi chua verify email, chuyen sang cach khac)"
}

Write-Host "`n[5] Kick thanh vien ra khoi nhom roi thu quyen gop lai"
# admin la owner nhom ADMIN. user binh la thanh vien nhom ADMIN.
# Kick binh khoi nhom ADMIN -> binh khong con quyen gop vao campaign nhom ADMIN.
$r=Call -Verb PUT -Route "/community/groups/$AG/members/b2222222-2222-2222-2222-222222222222/status" -Jwt $AT -Payload @{status='left'}
Write-Host "    kick user khoi nhom ADMIN: code=$($r.code)"
Start-Sleep -Seconds 2

$g3=(Call -Verb GET -Route "/community/groups/$AG" -Jwt $UT).body|ConvertFrom-Json
Write-Host "    my_status sau khi kick = $($g3.data.my_status)"

$r=Call -Verb POST -Route '/donation/contributions' -Jwt $UT -Payload @{
  campaign_id=$AC; pickup_method='drop_off'
  items=@(@{campaign_item_id=$ACITEM;name='Ao khoac lan 2';quantity=1;condition_declared='good';images=@()})
}
Check "user (da bi kick) gop vao nhom ADMIN -> 403" ($r.code -eq 403) "code=$($r.code) $($r.body)"
if($r.code -eq 403){
  $msg=($r.body|ConvertFrom-Json).error
  if(-not $msg){ $msg=($r.body|ConvertFrom-Json).detail }
  Write-Host "    thong diep: $msg"
  Check "thong diep ro rang cho nguoi dung" ("$msg" -match 'join') "$msg"
}

Write-Host "`n[6] Admin (PLATFORM_ADMIN) van gop duoc du khong la thanh vien"
$gA=(Call -Verb GET -Route "/community/groups/$UG" -Jwt $AT).body|ConvertFrom-Json
Write-Host "    admin trong nhom USER: my_status=$($gA.data.my_status)"
$r=Call -Verb POST -Route '/donation/contributions' -Jwt $AT -Payload @{
  campaign_id=$UC; pickup_method='drop_off'
  items=@(@{campaign_item_id=$UCITEM;name='Gao admin';quantity=1;condition_declared='new';images=@()})
}
Check "PLATFORM_ADMIN gop vao nhom khong tham gia -> 201" ($r.code -eq 201) "code=$($r.code) $($r.body)"

Write-Host "`n[7] Join lai nhom -> quyen gop DUOC tro lai"
$jr=Call -Verb POST -Route "/community/groups/$AG/join" -Jwt $UT -Payload @{message='Xin vao lai'}
Write-Host "    xin vao lai: code=$($jr.code)"
$JRID=($jr.body|ConvertFrom-Json).data.id

# Con o trang thai pending -> van bi chan
$r=Call -Verb POST -Route '/donation/contributions' -Jwt $UT -Payload @{
  campaign_id=$AC; pickup_method='drop_off'
  items=@(@{campaign_item_id=$ACITEM;name='Thu khi pending';quantity=1;condition_declared='good';images=@()})
}
Check "dang PENDING (chua duyet) -> van 403" ($r.code -eq 403) "code=$($r.code)"

# Duyet roi thu lai
if($JRID){
  $ap=Call -Verb POST -Route "/community/groups/$AG/join-requests/$JRID/approve" -Jwt $AT
  Write-Host "    duyet: code=$($ap.code)"
  Start-Sleep -Seconds 2
  $r=Call -Verb POST -Route '/donation/contributions' -Jwt $UT -Payload @{
    campaign_id=$AC; pickup_method='drop_off'
    items=@(@{campaign_item_id=$ACITEM;name='Sau khi duyet';quantity=1;condition_declared='good';images=@()})
  }
  Check "sau khi DUOC DUYET -> 201" ($r.code -eq 201) "code=$($r.code) $($r.body)"
}

Write-Host "`n===== KET QUA: $pass PASS / $fail FAIL =====" -ForegroundColor $(if($fail -eq 0){'Green'}else{'Red'})
