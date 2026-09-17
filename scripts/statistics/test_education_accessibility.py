from build_education_accessibility import summarize

def route(duration=100,source=1,destination=1):
 return dict(duration_s=duration,distance_m=100,source_snap_m=source,destination_snap_m=destination,code='S',name='school',precision='exact')
def test_unmatched_is_not_zero():
 r=summarize([route(source=300)],1);assert r['status']=='unmatched_network';assert r['reachable_in_15min'] is None
def test_snap_exclusions_are_partial_and_not_counted():
 r=summarize([route(),route(destination=300)],2);assert r['status']=='partial';assert r['reachable_in_15min']==1
def test_no_route_and_over_cutoff_differ():
 assert summarize([route(None)],1)['reachable_in_15min'] is None
 r=summarize([route(1200)],1);assert r['reachable_in_15min']==0;assert r['threshold_status']=='over_cutoff'
