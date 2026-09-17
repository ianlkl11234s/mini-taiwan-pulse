import csv,io,zipfile,json
from build_a2_statistics import build

def test_party_rows_count_once_and_duplicate_anchors_are_excluded(tmp_path):
 fields=['發生日期','發生時間','發生地點','經度','緯度','當事者順位','死亡受傷人數']
 rows=[['20250101','120000','臺北市中正區','121.5','25.0','1','死亡0;受傷2'],['20250101','120000','臺北市中正區','121.5','25.0','2','死亡0;受傷2'],['20250102','130000','新北市板橋區','121.4','25.0','1','死亡0;受傷1'],['20250102','130000','新北市板橋區','121.4','25.0','1','死亡0;受傷1']]
 buffer=io.StringIO();writer=csv.writer(buffer);writer.writerow(fields);writer.writerows(rows)
 archive=tmp_path/'fixture.zip'
 with zipfile.ZipFile(archive,'w') as z:z.writestr('114A2.csv',buffer.getvalue().encode('utf-8-sig'))
 receipt=build(archive,tmp_path/'out')
 assert receipt['coverage']['accepted_incidents']=={'A2':1}
 assert receipt['unassigned']['ambiguous_groups']==1 and receipt['unassigned']['ambiguous_rows']==2
 observations=json.loads((tmp_path/'out/a2-statistics-values.json').read_text())['observations']
 assert next(r['value'] for r in observations if r['indicator_id']=='a2_injury_count')==2
 assert next(r['value'] for r in observations if r['indicator_id']=='a2_accident_count')==1
 delta=json.loads((tmp_path/'out/manifest-delta.json').read_text())
 for selector in delta['selectors']:
  body=json.loads((tmp_path/'out'/selector['artifact']['path']).read_text())
  assert body['health']['coverage_status']=='PARTIAL'
