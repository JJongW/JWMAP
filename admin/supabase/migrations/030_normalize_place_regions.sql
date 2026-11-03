-- 030: 지역 이름 정리 (places.region을 사이트 지역 목록 REGION_HIERARCHY 값으로)
--
-- 같은 동네를 '마포/홍대'·'서울 마포구'·'홍대/합정/마포/연남'처럼 여러 이름으로 써서
-- 지역 칩·지역 찾기가 장소를 나눠 보던 문제를 고친다.
-- - 목록에 이미 있는 값은 건드리지 않는다
-- - 목록에 없는 값만 주소의 구·시로 맞는 지역을 정한다 (이름이 아니라 주소가 근거)
-- - '관악구 설입'처럼 동네 이름이 붙어 있던 값은 sub_region이 비어 있을 때 그 동네 이름을 남긴다
-- - 행마다 지금 값과 같을 때만 바꾼다 (그 사이 운영자가 고친 행은 그대로)
-- - places를 바꾸면 trg_sync_place_to_legacy가 locations / attractions에 같은 값을 넣는다
--
-- 바꾸지 않고 남긴 8곳 (주소가 없거나, 두 지역 중 애매하거나, 목록에 맞는 지역이 없음):
--   '서울' 주소 미확인 2곳, 대전 서구(월평), 강원 영월, 인천 미추홀구, 충남 보령, 경북 칠곡, 담양
--
-- 바뀌는 값 (기존 → 새 값, 장소 수):
--   '마포/홍대' → 홍대/합정/마포/연남 (44)
--   '성수/건대' → 건대/성수/왕십리 (24)
--   '경기 수원시' → 수원 (23)
--   '이태원/용산' → 용산/이태원/한남 (19)
--   '송파/강동' → 잠실/송파/강동 (10)
--   '서울 중구' → 종로/중구 (9)
--   '서울 종로구' → 종로/중구 (9)
--   '서울 강남구' → 강남 (9)
--   '서울 마포구' → 홍대/합정/마포/연남 (8)
--   '서울 동작구' → 구로/관악/동작 (7)
--   '서대문/은평' → 신촌/연희 (4)
--   '서울 성동구' → 건대/성수/왕십리 (4)
--   '수원시' → 수원 (4)
--   '서울 성북구' → 성북/노원/중랑 (4)
--   '용산구 용산' → 용산/이태원/한남 (4)
--   '노원/강북' → 성북/노원/중랑 (4)
--   '관악/동작' → 구로/관악/동작 (4)
--   '관악구 설입' → 구로/관악/동작 (4)
--   '서울 서대문구' → 신촌/연희 (3)
--   '중구 신당' → 종로/중구 (3)
--   '부산진구' → 서면 (3)
--   '용산구 후암동' → 용산/이태원/한남 (3)
--   '서울 동대문구' → 회기/청량리 (3)
--   '서울 중랑구' → 성북/노원/중랑 (3)
--   '서울 영등포구' → 영등포/여의도/강서 (3)
--   '성동구 성수' → 건대/성수/왕십리 (2)
--   '마포구 연희' → 신촌/연희 (2)
--   '고양시' → 고양/일산 (2)
--   '해운대구' → 해운대 (2)
--   '동대문/중랑' → 회기/청량리 (2)
--   '유성구' → 유성/궁동 (2)
--   '제주특별자치도 제주시' → 제주시 (2)
--   '수영구' → 광안리/수영 (2)
--   '서면/전포' → 서면 (2)
--   '경기 용인시' → 용인 (2)
--   '종로구 북촌' → 종로/중구 (2)
--   '용산구 남영' → 용산/이태원/한남 (2)
--   '동대문구 회기' → 회기/청량리 (2)
--   '중구' → 남포동/중앙동 (2)
--   '하남시' → 하남 (2)
--   '경기 의왕시' → 군포/의왕 (1)
--   '중구' → 동성로/중구 (1)
--   '중구 약수' → 종로/중구 (1)
--   '파주시' → 파주 (1)
--   '강남구 압구정로데오' → 강남 (1)
--   '용산구 용산역' → 용산/이태원/한남 (1)
--   '' → 김해 (1)
--   '한식' → 광안리/수영 (1)
--   '경주시' → 경주 (1)
--   '제주특별자치도 서귀포시' → 서귀포 (1)
--   '서울 관악구' → 구로/관악/동작 (1)
--   '강원특별자치도 속초시' → 속초/양양 (1)
--   '용산구 이태원' → 용산/이태원/한남 (1)
--   '부산 기장군' → 기장 (1)
--   '송파구 석촌역' → 잠실/송파/강동 (1)
--   '중구' → 대전역/중앙로 (1)
--   '서울 도봉구' → 창동/도봉산 (1)
--   '경기 화성시' → 화성/동탄 (1)
--   '' → 강릉 (1)
--   '마포구 마포' → 홍대/합정/마포/연남 (1)
--   '종로구 익선' → 종로/중구 (1)
--   '수원 광교' → 수원 (1)
--   '마포구 망원' → 홍대/합정/마포/연남 (1)
--   '동구' → 충장로/동구 (1)
--   '' → 천안 (1)
--   '서귀포시' → 서귀포 (1)
--   '동작구 사당' → 서초 (1)
--   '전주시' → 전주 (1)
--   '노원/강북' → 창동/도봉산 (1)
--   '서울 송파구' → 잠실/송파/강동 (1)
--   '부산 해운대구' → 해운대 (1)
--   '의정부시' → 의정부 (1)
--   '성남시' → 성남/분당 (1)
--   '관악구 봉천' → 구로/관악/동작 (1)
--   '서울 용산구' → 용산/이태원/한남 (1)
--   '서울 광진구' → 건대/성수/왕십리 (1)
--   '서울 서초구' → 서초 (1)
--   '' → 제천 (1)

BEGIN;

-- 라몽림 | 서울 마포구 양화로 13 2층 204호
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '006400bb-0d45-4095-8766-1c5b430ad75f' AND region = $r$서울 마포구$r$;
-- 케이코쇼텐 | 서울 중구 퇴계로24길 12-1 1-2층
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '006d55fb-a4ee-4c60-8d4b-fc47abe6761d' AND region = $r$서울 중구$r$;
-- 익선취향 | 서울 종로구 수표로28길 17-32 1층
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '00a9ab1b-9c51-4184-9e4f-a5a7c52d82c2' AND region = $r$서울 종로구$r$;
-- 카와카츠 합정점 | 서울 마포구 양화로 78-7 1층 (서교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '010c88d1-4364-4288-a44c-ece263b29935' AND region = $r$마포/홍대$r$;
-- 봉덕칼국수 의왕본점 | 경기 의왕시 징계골길 11 1층
UPDATE places SET region = $r$군포/의왕$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '0697f432-46d1-46f8-9b8d-a84a6802f696' AND region = $r$경기 의왕시$r$;
-- 가타쯔무리 | 서울 서대문구 명지대길 72 1층 (남가좌동)
UPDATE places SET region = $r$신촌/연희$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '08bd0335-0aaf-4856-b466-a43fd96a544a' AND region = $r$서대문/은평$r$;
-- 만포막국수 | 서울 중구 동호로14길 2 1층
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '0a172feb-bf46-4b01-a8c2-89ab7f61bf16' AND region = $r$서울 중구$r$;
-- 칸다소바 잠실점 | 서울 송파구 올림픽로 300 롯데월드몰 6층 (신천동)
UPDATE places SET region = $r$잠실/송파/강동$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '0c762708-78fc-4d99-a44c-44768d83f0aa' AND region = $r$송파/강동$r$;
-- 디귿 | 대구 중구 달구벌대로 2125-11 1층 (봉산동)
UPDATE places SET region = $r$동성로/중구$r$, province = $r$대구$r$, updated_at = now()
  WHERE id = '0f8bd340-6804-4a85-abb9-691f25c30e31' AND region = $r$중구$r$;
-- 카와카츠 본점 | 서울 마포구 동교로 126 광남벨라스아파트 1층 102호 (서교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '106755f6-c53e-45a4-b10e-910aaa8ddffa' AND region = $r$마포/홍대$r$;
-- 더유로피언 | 경기 수원시 영통구 센트럴파크로128번길 26 지하층, 1층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '109c6456-dbfb-4741-a5a3-da58e2882309' AND region = $r$경기 수원시$r$;
-- 은준쌀국수 | 서울 성동구 왕십리로5길 9-2 2층
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '11186fbf-ae8c-4740-b93c-80833e9ff0b0' AND region = $r$서울 성동구$r$;
-- 모터시티 이태원점 | 서울 용산구 이태원로 140-1 2층 (이태원동)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '11b9b874-6cd5-488c-81e2-47682ac6495c' AND region = $r$이태원/용산$r$;
-- 잘빠진메밀 익선동점 | 서울 종로구 율곡로8길 73 1층
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '1479efb7-d63e-4c42-b0ab-173d8f5d2552' AND region = $r$서울 종로구$r$;
-- 운멜로 1호점 | 경기 수원시 팔달구 화서문로32번길 4 2층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '15038f03-53b2-4d0c-aad8-51df72ae6a3a' AND region = $r$경기 수원시$r$;
-- 키유스테이크 | 경기 수원시 영통구 중부대로 293-3 본메디타워 1층 104,105호
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '16382379-9477-4748-ad98-847595f0a630' AND region = $r$경기 수원시$r$;
-- 바스버거 성수점 | 서울 성동구 왕십리로8길 16 1층 (성수동1가)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '16697284-a32c-4deb-addb-3b825e2131bf' AND region = $r$성수/건대$r$;
-- 오늘도한잔 | 서울 종로구 대명길 39-5 지하 1층
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '18814ba8-df86-428e-9050-07350c98c150' AND region = $r$서울 종로구$r$;
-- 와일드덕 | 서울 중구 동호로15길 43
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$약수$r$), updated_at = now()
  WHERE id = '18d43fa8-339c-47cb-b7cc-e4780eba497f' AND region = $r$중구 약수$r$;
-- 오밀 | 서울 성동구 아차산로5길 37-1
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$성수$r$), updated_at = now()
  WHERE id = '1aa710fb-727a-4e91-9ded-8ddefff0c861' AND region = $r$성동구 성수$r$;
-- 이치하치 행궁점 | 경기 수원시 팔달구 수원천로 313 1층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '1c51eef2-fe6a-4ea9-b2cf-b94ec8d81bfe' AND region = $r$경기 수원시$r$;
-- 연가정 | 서울 마포구 동교로22길 38 1층 101호 (서교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '1c7496ff-e57d-41fe-9f7e-9671f0294357' AND region = $r$마포/홍대$r$;
-- 한조카츠 | 경기 수원시 팔달구 중부대로239번길 78 1층 (우만동)
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '1e32de49-19bd-4647-aec6-6550699465d4' AND region = $r$수원시$r$;
-- 피자빌스 | 서울 마포구 방울내로 24 1층 (망원동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '1e49e2cf-4f40-4bd5-a5ec-13829f0354a5' AND region = $r$마포/홍대$r$;
-- 오뱅 | 경기 수원시 팔달구 갓매산로26번길 2 1층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '1f1b77f7-a3fe-4bdc-96a4-65fb12fb5445' AND region = $r$경기 수원시$r$;
-- 파이프그라운드 서울숲 | 서울 성동구 왕십리로 83-21 서울숲 디타워 지하1층 B124~B125호 (성수동1가)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '1fe301fc-a3ad-4e20-b2bc-64adc36dae41' AND region = $r$성수/건대$r$;
-- 텀어스 연희 | 서울 서대문구 연희맛로 2-3
UPDATE places SET region = $r$신촌/연희$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$연희$r$), updated_at = now()
  WHERE id = '21c2d972-d786-4b92-957c-b45f7ad11485' AND region = $r$마포구 연희$r$;
-- 사이드에이 | 서울 강남구 봉은사로 507 우림보보카운티 1층
UPDATE places SET region = $r$강남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '23baf1cf-f275-4c1c-9e2c-dc91a8cbb066' AND region = $r$서울 강남구$r$;
-- 정광수의돈까스가게 | 서울 마포구 포은로 128 1층 3호 (망원동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '24123b5a-3e27-4297-baa7-bf8117ca4b98' AND region = $r$마포/홍대$r$;
-- 트라토리아 본점 | 경기 수원시 팔달구 경수대로 438 현대하이엘 110,111호
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '256da3d5-3a45-4707-ba62-f2c3a331253f' AND region = $r$경기 수원시$r$;
-- 츠키젠 | 서울 마포구 독막로8길 23 1층 (합정동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '27081615-91b5-4233-9d73-221d6aafc0b3' AND region = $r$마포/홍대$r$;
-- 라멘다이야 | 서울 광진구 자양번영로6길 67 1층 (자양동)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '275a0a72-b40b-4172-88ba-5b4ec7a74e1d' AND region = $r$성수/건대$r$;
-- 진작다이닝 | 서울 성동구 왕십리로14나길 10 1층
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '287e2b2e-9e4e-4d43-b545-66968f6cb388' AND region = $r$서울 성동구$r$;
-- 토로생선구이 | 서울 성북구 고려대로28길 14-1 1층
UPDATE places SET region = $r$성북/노원/중랑$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '2a957a6a-fd4f-4c15-8e04-b0d108863fbb' AND region = $r$서울 성북구$r$;
-- 다운타우너 한남 | 서울 용산구 대사관로5길 12 1층 (한남동)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '2a958bf9-734e-44c2-b82b-a8669262de5f' AND region = $r$이태원/용산$r$;
-- 잭슨피자 삼각지점 | 서울 용산구 한강대로 187 1층 (한강로1가)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '2aa8466a-d82f-474e-aaed-ccaebc4d73f6' AND region = $r$이태원/용산$r$;
-- 기러기둥지 | 서울 성동구 연무장길 38
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$성수$r$), updated_at = now()
  WHERE id = '2bdba04a-7c69-4f5b-9b0b-66eb2695eefc' AND region = $r$성동구 성수$r$;
-- 오늘의초밥 법조타운점 | 경기 수원시 영통구 광교중앙로266번길 30 그랜드프라자 1층 123호
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '2c8cd1b3-b87c-4a40-a94c-94393b34f114' AND region = $r$경기 수원시$r$;
-- 바그 파주본점 | 경기 파주시 운정로 39 1층 102호 (상지석동)
UPDATE places SET region = $r$파주$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '2cfade1d-241f-4dfa-ac14-60648865b581' AND region = $r$파주시$r$;
-- 돈카츠팔월 | 서울 용산구 한강대로 183
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$용산$r$), updated_at = now()
  WHERE id = '2d706b65-c93b-4a45-9482-8b998e7a61e5' AND region = $r$용산구 용산$r$;
-- 현명식탁 | 서울 서대문구 명물길 32 5층
UPDATE places SET region = $r$신촌/연희$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '2dbe270d-af8c-427e-8d97-4bd0f5263a1f' AND region = $r$서울 서대문구$r$;
-- 마츠도 서울역점 | 서울 용산구 한강대로 373-1 1층 (동자동)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '2fc48177-c8fe-40fb-acc8-15d3d8efae58' AND region = $r$이태원/용산$r$;
-- 토리돈까스 | 서울 성북구 화랑로13길 24 2층 (하월곡동)
UPDATE places SET region = $r$성북/노원/중랑$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '2fefc0c0-c354-46b3-b0f3-a33e1f6e251a' AND region = $r$노원/강북$r$;
-- 심야식당 후라후라 | 경기 수원시 영통구 센트럴타운로 107 월드스퀘어 1층 120호
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '30921662-697d-4fe1-9cea-0938ed5b6e60' AND region = $r$경기 수원시$r$;
-- 쿄라멘 | 서울 마포구 동교로46길 25 지층 (연남동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '33d27d7d-dee2-4555-83fb-d9a398dc759e' AND region = $r$마포/홍대$r$;
-- 이오프 | 서울 중구 다산로42길 18
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$신당$r$), updated_at = now()
  WHERE id = '363b22f1-2871-4ed9-a2e7-44201366674e' AND region = $r$중구 신당$r$;
-- 오레노라멘 송파점 | 서울 송파구 백제고분로45길 17-3 1층 102호 (송파동)
UPDATE places SET region = $r$잠실/송파/강동$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '39de2201-8911-4c85-9dde-5d2c34304df5' AND region = $r$송파/강동$r$;
-- 라멘트럭 상수본점 | 서울 마포구 독막로14길 31 1층 (상수동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '39e9461f-d7f1-4740-bb2f-23889d8c33db' AND region = $r$마포/홍대$r$;
-- 오레노카츠 성수본점 | 서울 성동구 성수일로 47 1층 102호 (성수동1가)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '3a02b9eb-8ca5-4a2b-a80c-694f90589757' AND region = $r$성수/건대$r$;
-- 디핀 | 서울 중구 퇴계로 411
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$신당$r$), updated_at = now()
  WHERE id = '3c25a460-3311-43d5-b155-140cbcec5bd6' AND region = $r$중구 신당$r$;
-- 불난집떡볶이 | 서울 성북구 동소문로 225-9 비동 1층
UPDATE places SET region = $r$성북/노원/중랑$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '3c7a4823-8dfb-4e22-8540-e7d8f66aabdf' AND region = $r$서울 성북구$r$;
-- 계단라멘 일산본점 | 경기 고양시 일산동구 율천로7번길 10 1층 (정발산동)
UPDATE places SET region = $r$고양/일산$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '3f9e4699-015e-4639-818a-fdd74e359790' AND region = $r$고양시$r$;
-- 만돈 | 경기 고양시 일산동구 정발산로 24 웨스턴돔 B동 2층 225호 (장항동)
UPDATE places SET region = $r$고양/일산$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '408605f6-b055-4e33-b1ba-816091be68c6' AND region = $r$고양시$r$;
-- 돈까스전원 | 서울 성동구 왕십리로 330-6 1층 (도선동)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '41579cb4-12e5-4293-afec-5479fd857199' AND region = $r$성수/건대$r$;
-- 구구당 | 서울 강남구 강남대로102길 35 지하1층
UPDATE places SET region = $r$강남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '427b90a3-922e-4c6a-b712-ac0530325549' AND region = $r$서울 강남구$r$;
-- 인생의단맛 | 서울 종로구 성균관로5가길 1
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '42a399cd-3045-4472-922e-3aafe191b0bb' AND region = $r$서울 종로구$r$;
-- 마리오네 | 서울 성동구 광나루로2길 23-1 1층 (성수동2가)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '433b0d35-dced-4b49-b600-beb29c61b7aa' AND region = $r$성수/건대$r$;
-- 카츠 디나인 신대방삼거리 본점 | 서울 동작구 국사봉1길 12-5 1층 (상도동)
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '46a828b5-2a8f-4a90-a5c2-5976810a0c79' AND region = $r$관악/동작$r$;
-- 세상끝의라멘 | 서울 마포구 양화로7길 6-5 와와빌딩 2동 2층 (서교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '46bfd434-7720-4f9e-a721-9feabc4212aa' AND region = $r$마포/홍대$r$;
-- 1987피자 | 서울 서대문구 연세로11길 26 지하1층 (창천동)
UPDATE places SET region = $r$신촌/연희$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '487cd3a2-2b29-4379-b4b3-6bcbea3549d1' AND region = $r$서대문/은평$r$;
-- 파브리키친 | 서울 강남구 언주로152길 14
UPDATE places SET region = $r$강남$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$압구정로데오$r$), updated_at = now()
  WHERE id = '489bbfdf-9ef4-43f0-9394-1ea1a142a0d7' AND region = $r$강남구 압구정로데오$r$;
-- 미미옥 | 서울 용산구 한강대로15길 27
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$용산역$r$), updated_at = now()
  WHERE id = '48b3d08b-9e2d-4d38-8c38-5c3c68ace19d' AND region = $r$용산구 용산역$r$;
-- 아키야라멘 | 서울 마포구 토정로 39-3 1층 (합정동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '491683f7-8b49-4861-9758-052b6197c793' AND region = $r$마포/홍대$r$;
-- 멘즈키 | 부산 부산진구 동성로49번길 34 1층 우측 (전포동)
UPDATE places SET region = $r$서면$r$, province = $r$부산$r$, updated_at = now()
  WHERE id = '491f4497-1ed3-4562-9b55-ee9bdecd18e4' AND region = $r$부산진구$r$;
-- 필동함박 본점 | 서울 중구 필동로 7-1 1층
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '4a5e50b8-c207-4b8b-98cc-3ba0f312f467' AND region = $r$서울 중구$r$;
-- 아나타 | 경남 김해시 가락로23번길 26-1
UPDATE places SET region = $r$김해$r$, province = $r$경남$r$, updated_at = now()
  WHERE id = '4abb7985-4e94-4db6-9018-eae8fc18f636' AND (region IS NULL OR region = '');
-- 꿈앤펀 | 서울 용산구 신흥로20길 7
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$후암동$r$), updated_at = now()
  WHERE id = '4ae64107-1ed6-4cb7-ad84-be43eb3eebfb' AND region = $r$용산구 후암동$r$;
-- 버거리 홍대점 | 서울 마포구 어울마당로 123-1 1층 (동교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '4b7d1b87-c8e6-47d6-8593-e40a4c5c209a' AND region = $r$마포/홍대$r$;
-- 롸카두들 이태원점 | 서울 용산구 녹사평대로40나길 9 1층 (이태원동)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '4d237bd0-047d-43d1-81ac-d17fc340af26' AND region = $r$이태원/용산$r$;
-- 이태리상점 | 부산 해운대구 동백로 29 1층 (우동)
UPDATE places SET region = $r$해운대$r$, province = $r$부산$r$, updated_at = now()
  WHERE id = '4d53f576-b6dd-4b08-b8db-4dfd33be786d' AND region = $r$해운대구$r$;
-- 회기버거 본점 | 서울 동대문구 이문로 46 1층 (휘경동)
UPDATE places SET region = $r$회기/청량리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '4da9a8b9-e022-40a6-90df-c9ae5353784b' AND region = $r$동대문/중랑$r$;
-- 버기즈 어은 | 대전 유성구 어은로52번길 16 1층 (어은동)
UPDATE places SET region = $r$유성/궁동$r$, province = $r$대전$r$, updated_at = now()
  WHERE id = '4df11bb1-199c-448a-90f0-d9578435ec98' AND region = $r$유성구$r$;
-- 수변최고돼지국밥 | 부산 수영구 광안해변로370번길 9-32
UPDATE places SET region = $r$광안리/수영$r$, province = $r$부산$r$, updated_at = now()
  WHERE id = '4f73132c-0a04-42fc-a40e-96b58a492b41' AND region = $r$한식$r$;
-- 도토리키친 본점 | 제주특별자치도 제주시 북성로 59 1층
UPDATE places SET region = $r$제주시$r$, province = $r$제주$r$, updated_at = now()
  WHERE id = '5095b12a-d871-4467-affa-f794b0c967a2' AND region = $r$제주특별자치도 제주시$r$;
-- 미스피츠 | 서울 동작구 동작대로3길 30 1층 (사당동)
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '510f63a5-7099-4c63-8721-36e466bcfdbd' AND region = $r$관악/동작$r$;
-- 뉴오더클럽 | 서울 마포구 동교로34길 3 지하1층 (연남동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '515750bc-8679-4768-af77-df17224e6974' AND region = $r$마포/홍대$r$;
-- 노스트레스버거 | 서울 용산구 신흥로 62 1층 (용산동2가)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '52192cc3-45c8-4c4c-8533-b415f3962569' AND region = $r$이태원/용산$r$;
-- 쿠시카츠쿠마 영통점 | 경기 수원시 영통구 청명남로34번길 12 1층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '522fbd4d-d659-4469-8868-1b58531c0a9c' AND region = $r$경기 수원시$r$;
-- 하쿠 | 경기 수원시 팔달구 신풍로 48 1층 (신풍동)
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '52421470-36ae-4570-a72f-3bd62b471d4d' AND region = $r$수원시$r$;
-- 성천막국수 답십리점 | 서울 동대문구 답십리로48나길 2 1층
UPDATE places SET region = $r$회기/청량리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '5509a694-0b7e-4be2-8605-6a5abf3de54d' AND region = $r$서울 동대문구$r$;
-- 치킨버거클럽 | 부산 부산진구 서전로58번길 121 1층 (전포동)
UPDATE places SET region = $r$서면$r$, province = $r$부산$r$, updated_at = now()
  WHERE id = '5528028a-3116-4a13-8def-f668bd54e76a' AND region = $r$부산진구$r$;
-- 라멘바 시코우 | 서울 마포구 와우산로7길 33 1층 101호 (상수동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '561ff006-c28e-4274-bcea-2b6404094530' AND region = $r$마포/홍대$r$;
-- 료코 | 경북 경주시 첨성로99번길 24 1층 (황남동)
UPDATE places SET region = $r$경주$r$, province = $r$경북$r$, updated_at = now()
  WHERE id = '562dadf4-63eb-4a81-a91a-e38b2754176f' AND region = $r$경주시$r$;
-- 꿀삼겹 본점 | 서울 중랑구 봉우재로 139 1층
UPDATE places SET region = $r$성북/노원/중랑$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '58211a3b-5156-40d1-b892-fe363d723f4b' AND region = $r$서울 중랑구$r$;
-- 라멘무메이 | 서울 마포구 동교로27길 12 1층 103호 (동교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '584d9b4f-d3e6-4a02-8d62-2484fe8cc8e5' AND region = $r$마포/홍대$r$;
-- 촨커 | 서울 동대문구 이문로9길 105
UPDATE places SET region = $r$회기/청량리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '58cc673b-44af-40c5-9e48-64a1651cc35d' AND region = $r$서울 동대문구$r$;
-- 이리에라멘 | 서울 마포구 성지1길 18 1층 (합정동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '59377b07-6a8c-4249-b7d5-d7e3264eda2d' AND region = $r$마포/홍대$r$;
-- 멘야하나비 합정점 | 서울 마포구 잔다리로7안길 14 1층 (서교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '5a66ed1c-1fd3-4fa9-9223-1ffb339de814' AND region = $r$마포/홍대$r$;
-- 톤쇼우 광안점 | 부산 수영구 광안해변로279번길 13 1층 (민락동)
UPDATE places SET region = $r$광안리/수영$r$, province = $r$부산$r$, updated_at = now()
  WHERE id = '5aa85933-052d-4fca-9dec-8a17bed02ed0' AND region = $r$수영구$r$;
-- 노이알트 | 부산 부산진구 전포대로246번길 23
UPDATE places SET region = $r$서면$r$, province = $r$부산$r$, updated_at = now()
  WHERE id = '5b80bc91-2165-40bd-adfc-0de5d4cb55bd' AND region = $r$서면/전포$r$;
-- 북천돈가스 | 서울 용산구 한강대로10길 17 1층 (한강로3가)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '5bb5b5eb-c5a0-4d84-8b2d-f8c8e028af34' AND region = $r$이태원/용산$r$;
-- 다운타우너 잠실 | 서울 송파구 백제고분로45길 3 1층 (송파동)
UPDATE places SET region = $r$잠실/송파/강동$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '5c56ea89-70df-4ee1-acab-5c70d4310e3e' AND region = $r$송파/강동$r$;
-- 담택 본점 | 서울 마포구 동교로12안길 51 1층 (서교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '5db1016c-7221-4eb6-a997-5af0e47a3c3c' AND region = $r$마포/홍대$r$;
-- 제주또시랑 | 제주특별자치도 제주시 연북로 724 1층
UPDATE places SET region = $r$제주시$r$, province = $r$제주$r$, updated_at = now()
  WHERE id = '5e31e912-d6b6-49d8-9c3c-7ccb4cb61929' AND region = $r$제주특별자치도 제주시$r$;
-- 꽃돼지연탄구이 | 제주특별자치도 서귀포시 이어도로 227
UPDATE places SET region = $r$서귀포$r$, province = $r$제주$r$, updated_at = now()
  WHERE id = '5f70db1c-7c04-4e70-bb5e-e6a0c6995221' AND region = $r$제주특별자치도 서귀포시$r$;
-- 래빗홀버거 | 서울 광진구 광나루로 424 1층 (화양동)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '5ffd17fb-dfc1-4f4c-b078-fbe8406cc05a' AND region = $r$성수/건대$r$;
-- 동경산책 서울대입구점 | 서울 관악구 관악로14길 30 2층
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '601b5d2a-ee64-40a1-bc27-d5ad368b554d' AND region = $r$서울 관악구$r$;
-- 메시야 | 서울 용산구 한강대로 358 1층 (동자동)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '6045d584-4ce0-4174-b2ee-43d611a44fbb' AND region = $r$이태원/용산$r$;
-- 묘미식당 | 서울 영등포구 선유로49길 23 아이에스비즈타워 2차 1층 114호
UPDATE places SET region = $r$영등포/여의도/강서$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '614f1dfb-7180-436b-aa2a-e06d4556410c' AND region = $r$서울 영등포구$r$;
-- 나비루 | 서울 동작구 상도로37길 63 지누빌딩 1층
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '622c4463-efda-4ebf-932e-f00d3d5b9297' AND region = $r$서울 동작구$r$;
-- 하쿠텐 | 서울 마포구 동교로 266-12 (연남동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '623d11c0-893d-4941-93cc-b6fbb9c68d56' AND region = $r$마포/홍대$r$;
-- 청초수물회 속초본점 | 강원특별자치도 속초시 엑스포로 12-36
UPDATE places SET region = $r$속초/양양$r$, province = $r$강원$r$, updated_at = now()
  WHERE id = '62a648d9-034c-443a-8c2e-2f4998520667' AND region = $r$강원특별자치도 속초시$r$;
-- 코타티 | 서울 용산구 신흥로12길 7
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$이태원$r$), updated_at = now()
  WHERE id = '63b8d58a-415c-4139-b89d-a0ee55e0d705' AND region = $r$용산구 이태원$r$;
-- 캘프 옥수 | 서울 성동구 한림말3길 10 1층 (옥수동)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '63dd859c-392b-4676-be47-f4e9875a1e62' AND region = $r$성수/건대$r$;
-- 헷츠 | 부산 수영구 수영로575번길 10 1층 103호 (광안동)
UPDATE places SET region = $r$광안리/수영$r$, province = $r$부산$r$, updated_at = now()
  WHERE id = '64510864-3df9-421e-8c4b-6c77d552b593' AND region = $r$수영구$r$;
-- 경양카츠 연남본점 | 서울 마포구 동교로 238-1 1층 (연남동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '6bc9a68b-34db-4e87-b232-db0988e4310b' AND region = $r$마포/홍대$r$;
-- 이세돈가스 고려대점 | 서울 성북구 개운사길 32 1층 (안암동5가)
UPDATE places SET region = $r$성북/노원/중랑$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '6c134246-b25e-42df-8e6c-e86a12e5b823' AND region = $r$노원/강북$r$;
-- 올바릇 식당 기장본점 | 부산 기장군 일광읍 문오성길 61 1,2층
UPDATE places SET region = $r$기장$r$, province = $r$부산$r$, updated_at = now()
  WHERE id = '6c83344c-748a-4bb0-8240-af09bdea31f6' AND region = $r$부산 기장군$r$;
-- 미크 | 서울 송파구 송파대로 458
UPDATE places SET region = $r$잠실/송파/강동$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$석촌역$r$), updated_at = now()
  WHERE id = '6d998c02-d22a-42fd-be36-ef092456e139' AND region = $r$송파구 석촌역$r$;
-- 흥도식당 | 서울 송파구 법원로 114 B동 지하1층 155-1호 (문정동)
UPDATE places SET region = $r$잠실/송파/강동$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '6e04283b-6679-461e-8ee6-eed39ace31ac' AND region = $r$송파/강동$r$;
-- 홀리데이세븐펍 | 대전 중구 목척7길 11 1~3층 (은행동)
UPDATE places SET region = $r$대전역/중앙로$r$, province = $r$대전$r$, updated_at = now()
  WHERE id = '6e0a9282-3290-4191-926a-db180beb54a5' AND region = $r$중구$r$;
-- 올리브1999 | 경기 수원시 영통구 센트럴파크로127번길 80-16 예담하우스 1층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '6e1a62d5-a1b6-4939-bdc5-2416ef488eda' AND region = $r$경기 수원시$r$;
-- 초라멘 | 서울 광진구 능동로13길 80 1층 (화양동)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '6e371a62-37e8-45d9-b372-0af4e341c07d' AND region = $r$성수/건대$r$;
-- 올래철판곱창 | 서울 도봉구 도봉로150다길 28 1층 102호
UPDATE places SET region = $r$창동/도봉산$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '7050c39b-9b8c-416b-ab1d-3c75360f6b43' AND region = $r$서울 도봉구$r$;
-- 마다밀 | 서울 용산구 한강대로7길 30-10
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$용산$r$), updated_at = now()
  WHERE id = '7453a8bc-f297-4c56-b5e0-56144fd7f144' AND region = $r$용산구 용산$r$;
-- 티엘티씨 | 서울 용산구 신흥로 95-21
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$후암동$r$), updated_at = now()
  WHERE id = '74e71be8-a52f-4c7c-9a6d-c9c256c2c687' AND region = $r$용산구 후암동$r$;
-- 포레디 | 경기 수원시 영통구 권선로882번길 107-32 1층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '76a02850-c527-44f9-83aa-d2e4a1d1dbc3' AND region = $r$경기 수원시$r$;
-- 스시라쿠 | 경기 화성시 병점구 영통로 66 반월메디컬프라자 2층 214호
UPDATE places SET region = $r$화성/동탄$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '76c425e8-87a5-4067-9eb2-f2132b0e1233' AND region = $r$경기 화성시$r$;
-- 재재식당 | 서울 용산구 녹사평대로40길 59-1 1층 (이태원동)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '76fd4914-84fe-4bfa-acc8-a4f371c808c6' AND region = $r$이태원/용산$r$;
-- 작은섬 | 서울 동작구 상도로47길 22 1층
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '778cc893-c175-4ca4-a401-c96a167bca00' AND region = $r$서울 동작구$r$;
-- 포가레 연남본점 | 서울 마포구 동교로 227-7 2층
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '79eae9ed-14ae-466e-90ff-60774d3345bf' AND region = $r$서울 마포구$r$;
-- 라이즈호텔 사이드노트클럽 | 서울 마포구 양화로 130 15층
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '7a3a5923-7d3e-4381-8e02-aec6aaf759c1' AND region = $r$서울 마포구$r$;
-- 이츠야 | 서울 마포구 양화로6길 99-9 (서교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '7a3ae485-7cc4-4d77-8993-53cebf65bf6a' AND region = $r$마포/홍대$r$;
-- 삼백돈돈가츠 본점 | 서울 관악구 남부순환로230길 48
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$설입$r$), updated_at = now()
  WHERE id = '7b73675a-d039-4f28-9643-07b71e16c4c1' AND region = $r$관악구 설입$r$;
-- 질리 | 서울 마포구 동교로51길 81
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '7b7875f9-812e-45f9-9288-4a94485e4312' AND region = $r$서울 마포구$r$;
-- 프롬하노이 | 서울 마포구 월드컵로13길 55-5 1층
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '7c675523-3be8-4fe7-a633-514e78275831' AND region = $r$서울 마포구$r$;
-- 다로베 | 서울 성동구 서울숲길 51 1층 (성수동1가)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '7cec0f5a-b2fe-405e-b708-3d2fcbf66f12' AND region = $r$성수/건대$r$;
-- 고기리막국수 | 경기 용인시 수지구 이종무로 157
UPDATE places SET region = $r$용인$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '7d575153-2deb-4951-8ad6-77532d234344' AND region = $r$경기 용인시$r$;
-- 멘타미 | 서울 용산구 한강대로76길 9 1층 (남영동)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '7d70b502-cf43-4c4f-9f4f-c0d74d53a80c' AND region = $r$이태원/용산$r$;
-- 야스마루 쇼쿠도 | 부산 부산진구 중앙대로756번길 24
UPDATE places SET region = $r$서면$r$, province = $r$부산$r$, updated_at = now()
  WHERE id = '7dfef67d-834a-41c8-93af-bfd85eb0daae' AND region = $r$서면/전포$r$;
-- 독립밀방 | 서울 종로구 통일로12길 10-18 1층
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '7e025e53-f978-47f9-95a7-a6ffced2380d' AND region = $r$서울 종로구$r$;
-- 과객 | 강원특별자치도 강릉시 성산면 갈매간길 8-3
UPDATE places SET region = $r$강릉$r$, province = $r$강원$r$, updated_at = now()
  WHERE id = '7f2920d8-d7e1-42ae-83b1-ab4c2a797482' AND (region IS NULL OR region = '');
-- 테네스 | 경기 수원시 팔달구 정조로 896 3층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '80178e36-2806-4985-ab8e-9725f4ed4622' AND region = $r$경기 수원시$r$;
-- 짱카츠 | 서울 마포구 망원로6길 19
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$마포$r$), updated_at = now()
  WHERE id = '8041a540-8b53-4f76-baf0-29d24010dde2' AND region = $r$마포구 마포$r$;
-- 셰프스위트 | 경기 수원시 팔달구 정조로801번길 27 1층 102호
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '81c74926-b0ec-4f2d-85c1-feb87412799f' AND region = $r$경기 수원시$r$;
-- 미쁘동 | 서울 마포구 동교로38길 33-21 2층
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '82008e23-349d-4df5-95af-b5256f6e213d' AND region = $r$서울 마포구$r$;
-- 부자피자 1호점 | 서울 용산구 이태원로55가길 28 1층 (한남동)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '839a99ca-bbd8-4b70-8dfc-4e25e8becd5a' AND region = $r$이태원/용산$r$;
-- 피자네버슬립스 송리단길점 | 서울 송파구 백제고분로45길 6 지하1층 (송파동)
UPDATE places SET region = $r$잠실/송파/강동$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '839b75c4-67f9-451b-9e77-de5d623bc242' AND region = $r$송파/강동$r$;
-- 포크포크 | 서울 광진구 동일로22길 117-16 1층 (화양동)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '84935563-17c7-475a-9a5c-335621cd65ec' AND region = $r$성수/건대$r$;
-- Bored&Hungry | 서울 성동구 성수이로18길 32 1층 (성수동2가)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '85386939-cd85-4d4a-8db8-c715a17bd108' AND region = $r$성수/건대$r$;
-- 언코르크드 | 서울 종로구 율곡로 55
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$북촌$r$), updated_at = now()
  WHERE id = '863a5677-0199-49b0-84e8-3c14542be63e' AND region = $r$종로구 북촌$r$;
-- 상미규카츠 | 서울 성북구 동소문로20길 39 (동선동1가)
UPDATE places SET region = $r$성북/노원/중랑$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '86aeee4b-b52d-4bd4-8a1e-d5c1dcd2083d' AND region = $r$노원/강북$r$;
-- 산으로간고등어 | 경기 용인시 수지구 고기로 126 1층
UPDATE places SET region = $r$용인$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '86f38ab5-3da4-4e06-8ebb-a7a98aa6608a' AND region = $r$경기 용인시$r$;
-- 멘야하나비 서울본점 | 서울 송파구 백제고분로45길 38 1층 103호 (송파동)
UPDATE places SET region = $r$잠실/송파/강동$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '872b0f29-65cd-4090-bf42-7773214a4229' AND region = $r$송파/강동$r$;
-- 카페온화 | 서울 종로구 수표로28길 21-10
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$익선$r$), updated_at = now()
  WHERE id = '89c51679-2ab9-456a-8a3c-96fe12af869c' AND region = $r$종로구 익선$r$;
-- 혼가츠 | 서울 마포구 와우산로21길 36-6 1층 102호 (서교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '8a8b20c8-3027-46ba-b573-394b69e40ed9' AND region = $r$마포/홍대$r$;
-- 하카타분코 | 서울 마포구 독막로19길 43 1층 (상수동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '8ac3fb27-3300-4d7e-9685-2af34e60d8a7' AND region = $r$마포/홍대$r$;
-- 라구식당 | 서울 서대문구 연세로 42-24 1층
UPDATE places SET region = $r$신촌/연희$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '8b774657-921c-42ef-86f0-505eb7569ba4' AND region = $r$서울 서대문구$r$;
-- 윤멘 | 서울 마포구 포은로 27 1층 102호 (합정동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '8d78d8a1-5588-499f-bd32-0849b1a895f6' AND region = $r$마포/홍대$r$;
-- 지로우라멘 | 서울 마포구 와우산로29가길 79 1층 (서교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '8ee884ce-44fd-47c7-aa4b-a9c5ccbaa4e1' AND region = $r$마포/홍대$r$;
-- 폴코 | 경기 수원시 영통구 센트럴파크로127번길 156
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = '8f33fc28-c4df-434d-9c41-ab6c36ddfe70' AND region = $r$수원 광교$r$;
-- 행복은간장밥 고려대점 | 서울 성북구 고려대로24길 56 1층
UPDATE places SET region = $r$성북/노원/중랑$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '8f661ebf-85db-445d-9537-f6fdc4e3792e' AND region = $r$서울 성북구$r$;
-- 파동추야 | 서울 동작구 상도로58길 4 경원빌딩 1층
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '900dc78c-bf55-415f-bb5c-9801d2280dce' AND region = $r$서울 동작구$r$;
-- 최강금돈까스 | 서울 마포구 월드컵로3길 31-30 지하1층 (합정동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '91275163-0da1-422c-aa3c-de06ad44bbac' AND region = $r$마포/홍대$r$;
-- 마시타야 | 서울 마포구 와우산로29라길 26 (서교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '91e53814-f44d-4336-ab4e-cb3d02c46977' AND region = $r$마포/홍대$r$;
-- 보니스피자 용산점 | 서울 용산구 신흥로3길 2 1층 (용산동2가)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '92620383-126d-4272-a55e-a8ca249a93d3' AND region = $r$이태원/용산$r$;
-- 보슬보슬 역삼본점 | 서울 강남구 논현로85길 59 남곡빌딩 1층
UPDATE places SET region = $r$강남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '93b3261a-e65e-4b12-8be0-0fd1c6d7efce' AND region = $r$서울 강남구$r$;
-- 라무라 | 서울 마포구 포은로 21 1층 101호 (합정동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '93d2baea-ed87-4bb7-addf-50e23af83f8e' AND region = $r$마포/홍대$r$;
-- 카츠오도 | 서울 관악구 조원로16가길 51 1층 (신림동)
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '9427a336-a3b8-4f83-9822-8fe0a8597f3e' AND region = $r$관악/동작$r$;
-- 은주정 | 서울 중구 창경궁로8길 32 1층
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '943c0f00-f182-42d0-8394-de233b1015d5' AND region = $r$서울 중구$r$;
-- 산볼 | 서울 마포구 월드컵로19길 90
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$망원$r$), updated_at = now()
  WHERE id = '948427ab-cb79-4919-81a0-46a632b768d5' AND region = $r$마포구 망원$r$;
-- 수퍼슬라이더스 | 서울 광진구 능동로13길 50 1층 1호 (화양동)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '9662864c-fdd5-4d09-866f-1fd02978bd8a' AND region = $r$성수/건대$r$;
-- 해봉정육 본점 | 서울 강남구 테헤란로108길 25 대동빌딩 1층
UPDATE places SET region = $r$강남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '96e62f15-4c32-4b99-93d1-92df27ca1923' AND region = $r$서울 강남구$r$;
-- 하나라멘 | 서울 마포구 동교로38길 27-4 1층 (연남동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '99ef27e2-1928-4391-a681-c54a7a06e7d7' AND region = $r$마포/홍대$r$;
-- 리얼후라이 숭실대점 | 서울 동작구 사당로 6-1 1층
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '9a1f8c22-c679-49ee-910e-34f90ec40a00' AND region = $r$서울 동작구$r$;
-- 에다마메 남영점 | 서울 용산구 한강대로76길 11-40
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$남영$r$), updated_at = now()
  WHERE id = '9b2af19e-9582-4472-9656-c5820c4f02f7' AND region = $r$용산구 남영$r$;
-- 금제 | 서울 관악구 조원로 101 1층 (신림동)
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = '9f7d133f-a76a-408b-8e6e-d672b4509848' AND region = $r$관악/동작$r$;
-- 사루카메 | 서울 마포구 연남로 15 1층 (연남동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'a2395f84-2f70-489e-a4e4-c2d35ea6628e' AND region = $r$마포/홍대$r$;
-- 이츠모라멘 | 서울 마포구 와우산로23길 18-7 2층 202호 (서교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'a2e20790-125f-44b8-9f41-4a527a56e7d4' AND region = $r$마포/홍대$r$;
-- 뉴욕아파트먼트 합정점 | 서울 마포구 월드컵로3길 14 딜라이트스퀘어2차 2층 217~218호 (합정동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'a33aa292-a024-4cb2-aa9c-f4480bbcee31' AND region = $r$마포/홍대$r$;
-- 돈카츠창현 | 서울 관악구 관악로12길 104
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$설입$r$), updated_at = now()
  WHERE id = 'a6547069-574b-496f-8c20-1ef1d2a69869' AND region = $r$관악구 설입$r$;
-- 목하식당 | 광주 동구 동명로25번길 6 1층 MOKHA (동명동)
UPDATE places SET region = $r$충장로/동구$r$, province = $r$광주$r$, updated_at = now()
  WHERE id = 'a76f187c-7d9b-48b4-b871-331fc1e10c36' AND region = $r$동구$r$;
-- 그로또 영통점 | 경기 수원시 영통구 청명북로 2 1층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = 'a8fd9bdb-97a8-4681-8b78-cdea48cfb33f' AND region = $r$경기 수원시$r$;
-- 애성회관 | 서울 중구 남대문로5길 23 대경빌딩 1층
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'aa5b83a6-2c3c-41fa-a9ba-d633ccd62391' AND region = $r$서울 중구$r$;
-- 멘지 | 서울 마포구 와우산로29길 64 2층
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'aa72265a-bc4a-4a8f-bee3-794f1a27e1cb' AND region = $r$마포/홍대$r$;
-- 감요 | 서울 성동구 왕십리로4길 28-8 문주빌딩 2층
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'aab1b1bd-7af1-468c-9041-c1086fbddb15' AND region = $r$서울 성동구$r$;
-- 어거스트힐 강남점 | 서울 강남구 강남대로106길 25 1층
UPDATE places SET region = $r$강남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'aab515b0-1783-476a-bd06-3ba481a2f672' AND region = $r$서울 강남구$r$;
-- 쏭타이치앙마이 | 서울 용산구 한강대로40길 39-5
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$용산$r$), updated_at = now()
  WHERE id = 'ab6f4ca6-a043-4a58-aa2f-34a83dca15cc' AND region = $r$용산구 용산$r$;
-- 뚜쥬루 돌가마점 | 충남 천안시 동남구 풍세로 706
UPDATE places SET region = $r$천안$r$, province = $r$충남$r$, updated_at = now()
  WHERE id = 'ab8e422d-0b0d-4c65-9a96-8e29b3576fe0' AND (region IS NULL OR region = '');
-- 벅벅 이태원점 | 서울 용산구 이태원로20길 24 1층 (이태원동)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'abd75047-867e-4c03-92fd-77f4b4516af7' AND region = $r$이태원/용산$r$;
-- 르프리크 | 서울 성동구 연무장5길 9-16 B103호 (성수동2가)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'ac1aba6a-ca93-4367-ae3a-fedac9c1824a' AND region = $r$성수/건대$r$;
-- 더리얼치즈버거 이태원 | 서울 용산구 녹사평대로40길 55-2 2층 (이태원동)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'ac589da5-ee45-4443-985f-f9a605fdf0c5' AND region = $r$이태원/용산$r$;
-- 대성집 | 서울 종로구 사직로 5 1층
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'acf6d820-b973-438b-bcc3-ff3b1d84b51f' AND region = $r$서울 종로구$r$;
-- 언니네함바그 | 서울 동대문구 회기로25길 59
UPDATE places SET region = $r$회기/청량리$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$회기$r$), updated_at = now()
  WHERE id = 'ad43d345-ad9b-4a7d-83b7-a64916591ea4' AND region = $r$동대문구 회기$r$;
-- 시키카츠 | 서울 동대문구 회기로 110 1층 (회기동)
UPDATE places SET region = $r$회기/청량리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'ad6838f5-ff04-405b-98b9-d88d58f2dc20' AND region = $r$동대문/중랑$r$;
-- 고든램지버거 롯데월드몰 | 서울 송파구 올림픽로 300 지하1층 (신천동)
UPDATE places SET region = $r$잠실/송파/강동$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'ae34d6d9-9797-40cb-b77e-632ae0ad6cea' AND region = $r$송파/강동$r$;
-- 영육일삼 | 제주특별자치도 서귀포시 이어도로 679 1층 (강정동)
UPDATE places SET region = $r$서귀포$r$, province = $r$제주$r$, updated_at = now()
  WHERE id = 'ae9eea33-ffda-4e47-a36c-b3d852b1cc15' AND region = $r$서귀포시$r$;
-- 멘야코노하 성수 | 서울 성동구 왕십리로4길 10-1 1층
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'b1d4c3ee-6129-4712-8149-4ab3ad13ef6d' AND region = $r$서울 성동구$r$;
-- 카라멘야 | 서울 서대문구 연세로7안길 34-1 1층 (창천동)
UPDATE places SET region = $r$신촌/연희$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'b2dd113c-8547-47cb-ac2d-04c83c879254' AND region = $r$서대문/은평$r$;
-- 본지르르 | 서울 서대문구 연희로 189-16
UPDATE places SET region = $r$신촌/연희$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$연희$r$), updated_at = now()
  WHERE id = 'b3258c70-e0c7-4948-aa64-d8f85b8b1195' AND region = $r$마포구 연희$r$;
-- 피자네버슬립스 합정상수점 | 서울 마포구 양화로6길 73 4층 (서교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'b5e778e9-9521-4283-afad-935ae303b698' AND region = $r$마포/홍대$r$;
-- 양자호떡 노량진점 | 서울 동작구 만양로 87-1 1층
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'b60f95db-7426-455c-84da-b12429d08292' AND region = $r$서울 동작구$r$;
-- 더리얼치즈버거 | 서울 마포구 와우산로29길 48-29 1층 (서교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'b689f67a-2fbc-437e-a9d2-9e36e5c0f751' AND region = $r$마포/홍대$r$;
-- 멘야고코로 | 경기 수원시 팔달구 아주로39번길 8 초원빌딩 1층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = 'b7d419a9-23a9-4695-abe4-e0f5901aa22c' AND region = $r$수원시$r$;
-- 어머니대성집 | 서울 동대문구 왕산로11길 4 1층
UPDATE places SET region = $r$회기/청량리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'b8abe6d6-22fd-4a82-9801-7a47a9681784' AND region = $r$서울 동대문구$r$;
-- 노모어피자 서울숲점 | 서울 성동구 서울숲2길 26 1층 (성수동1가)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'b9290da9-c2f6-434f-a922-d7251b3d9a95' AND region = $r$성수/건대$r$;
-- 엘더버거 성수 | 서울 성동구 서울숲2길 40-7 1층 (성수동1가)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'b9abf2a4-930b-4f8c-bdc9-a515f083d268' AND region = $r$성수/건대$r$;
-- 가마마루이 | 서울 서대문구 성산로22길 4 (창천동)
UPDATE places SET region = $r$신촌/연희$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'b9bd3886-4cda-43b0-96a0-69926417b33d' AND region = $r$서대문/은평$r$;
-- 로로카페 | 서울 용산구 원효로97길 25
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$남영$r$), updated_at = now()
  WHERE id = 'b9cc2aac-559e-4ee6-8042-5c5436fa56b0' AND region = $r$용산구 남영$r$;
-- 헬무트 | 서울 서초구 방배천로6길 3-10
UPDATE places SET region = $r$서초$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$사당$r$), updated_at = now()
  WHERE id = 'ba380fbe-eff0-48c8-9b75-01f173871c98' AND region = $r$동작구 사당$r$;
-- 치카이라멘 옥수본점 | 서울 성동구 한림말3길 15-16 1층 (옥수동)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'bb8039c9-4685-4b44-894f-8b2c8ebd0419' AND region = $r$성수/건대$r$;
-- 레펜 | 서울 중구 다산로42가길 36
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$신당$r$), updated_at = now()
  WHERE id = 'bc17b08a-ac83-4afc-894b-4c7a9aaf8f05' AND region = $r$중구 신당$r$;
-- 야키토리리 | 서울 관악구 남부순환로 1870
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$설입$r$), updated_at = now()
  WHERE id = 'bc1c8288-df54-4845-99fb-4864788390d3' AND region = $r$관악구 설입$r$;
-- 매덕스피자 | 서울 용산구 이태원로26길 26 2층 (이태원동)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'bd411f36-902d-41b7-b5d4-19846028fe99' AND region = $r$이태원/용산$r$;
-- 마루스시 | 서울 동작구 상도로37길 79 1층
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'beedf2a3-9704-4976-8075-c19409924823' AND region = $r$서울 동작구$r$;
-- 을지다락 | 서울 중구 수표로10길 19 4층
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'bf11ee8f-0503-470d-b220-4b7243ed6ec6' AND region = $r$서울 중구$r$;
-- 버거인뉴욕 | 부산 해운대구 해운대해변로298번길 9 1층 (중동)
UPDATE places SET region = $r$해운대$r$, province = $r$부산$r$, updated_at = now()
  WHERE id = 'bfee0621-a8d3-42b2-b4f7-369f280f857d' AND region = $r$해운대구$r$;
-- 북덕방 | 서울 관악구 봉천로 544-1
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$설입$r$), updated_at = now()
  WHERE id = 'c06e340d-3082-4648-b24c-4b68d9c2bffe' AND region = $r$관악구 설입$r$;
-- 위드마이호미스 | 경기 수원시 팔달구 화서문로46번길 16 1층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = 'c089728a-051d-4ea0-9178-6dff415db270' AND region = $r$경기 수원시$r$;
-- 아빠가만든전복장 아장아장 | 경기 수원시 영통구 권선로882번길 107-66 1층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = 'c0eb8252-7010-449a-b0ca-332231c74450' AND region = $r$경기 수원시$r$;
-- GTS버거 성수점 | 서울 성동구 뚝섬로17가길 48 성수에이원센터 1층 102호 (성수동2가)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'c3955542-3759-48e8-b978-0097b7ff0396' AND region = $r$성수/건대$r$;
-- 멜드바이기치조지 | 서울 마포구 성지길 55 1층 (합정동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'c4d38db5-91b8-48fa-bcca-3f4eeef2beef' AND region = $r$마포/홍대$r$;
-- 스파카나폴리 | 서울 마포구 양화로6길 28 2층 (합정동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'c50abfa7-8671-4780-9940-87b331295569' AND region = $r$마포/홍대$r$;
-- 텅 | 서울 종로구 율곡로 82
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$북촌$r$), updated_at = now()
  WHERE id = 'c5c79e85-0a1e-4ad6-914d-b7c65ed06f72' AND region = $r$종로구 북촌$r$;
-- 페이퍼플레이트 | 서울 성동구 성수이로14길 15 1층 (성수동2가)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'c66676bb-6aed-4f63-aaf6-504e94e0a608' AND region = $r$성수/건대$r$;
-- 백제정육점 | 서울 종로구 종로35길 34 1층
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'c762f7cd-1ade-4d5b-a29d-847a876edb29' AND region = $r$서울 종로구$r$;
-- 카토카츠 | 서울 광진구 능동로17길 6 1층 (화양동)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'c98d90fb-e74c-4b55-806b-d6b574b22be2' AND region = $r$성수/건대$r$;
-- 옥경이네건생선 | 서울 중구 퇴계로85길 7 신당중앙시장 1층
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'cafaae54-102e-48c3-924a-66b310fcce72' AND region = $r$서울 중구$r$;
-- 돈카츠흑심 전주객사본점 | 전북특별자치도 전주시 완산구 전라감영2길 27-1 1층 (다가동3가)
UPDATE places SET region = $r$전주$r$, province = $r$전북$r$, updated_at = now()
  WHERE id = 'cb31d103-82fc-4293-b45e-5d0a6cf1c305' AND region = $r$전주시$r$;
-- 버거브라더 | 서울 도봉구 마들로 657 1층 101~4호 (방학동)
UPDATE places SET region = $r$창동/도봉산$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'cbc04ce8-19db-49e5-bb0f-8815a3e31d10' AND region = $r$노원/강북$r$;
-- 라프란스 | 경기 수원시 장안구 팔달로316번길 15 1층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = 'cc749511-a10b-493d-ad88-24b6bc2dd422' AND region = $r$경기 수원시$r$;
-- 랫댓 연남점 | 서울 마포구 동교로 243-4 2층 (연남동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'ccca4382-88a4-4ec7-9439-29c1612e4fe6' AND region = $r$마포/홍대$r$;
-- 고엔 | 서울 종로구 창경궁로 255 1층 1호
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'cd019349-83bd-4e8d-81a6-6ff13a5848c5' AND region = $r$서울 종로구$r$;
-- 얌얌카츠 | 서울 강동구 천호옛14길 22 1층 (성내동)
UPDATE places SET region = $r$잠실/송파/강동$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'cdb5588c-ed05-4aad-b6aa-e0da82e751f0' AND region = $r$송파/강동$r$;
-- 이재모피자 본점 | 부산 중구 광복중앙로 31 중앙아파트 상가 2층 (신창동1가)
UPDATE places SET region = $r$남포동/중앙동$r$, province = $r$부산$r$, updated_at = now()
  WHERE id = 'ce216650-7b8f-4376-9824-1e29dc32efd9' AND region = $r$중구$r$;
-- 카츠오모이 홍대점 | 서울 마포구 와우산로 162-14 B101호 (서교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'cf9bca35-6cc4-48c7-8dbb-bc8cf83cd5e9' AND region = $r$마포/홍대$r$;
-- 라멘이자카야쿠잔 | 서울 광진구 면목로 22 1층 (군자동)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'cfd48673-5880-4052-bda9-fafa9e8f0409' AND region = $r$성수/건대$r$;
-- 항아리김치찌개 | 서울 중랑구 중랑역로50길 4 1층
UPDATE places SET region = $r$성북/노원/중랑$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'd16b2b23-23d7-4da4-8efc-13424c1e524a' AND region = $r$서울 중랑구$r$;
-- 헤키 | 서울 마포구 동교로9길 33 1층 (망원동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'd19436b4-8783-4ae0-8486-8bea9dcd1ad5' AND region = $r$마포/홍대$r$;
-- 찬양집 | 서울 종로구 돈화문로11다길 5 1층
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'd19bacc7-b835-44c7-9d16-d4f9f85ca5b9' AND region = $r$서울 종로구$r$;
-- 온수반 충무로점 | 서울 중구 퇴계로34길 16-9 1층
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'd1b5aeee-18ee-4885-b90e-c78040211cb8' AND region = $r$서울 중구$r$;
-- 멘야준 | 서울 마포구 동교로 128 (서교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'd1d9c4c5-957a-4a54-960e-d3cfd9adef37' AND region = $r$마포/홍대$r$;
-- 진지아 | 서울 송파구 백제고분로41길 12-9 1-2층
UPDATE places SET region = $r$잠실/송파/강동$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'd25568f6-bf56-459a-84a3-8545181b0a11' AND region = $r$서울 송파구$r$;
-- 로리스피자팩토리 | 서울 용산구 한강대로 95 용산래미안더센트럴 지하2층 220호 224호 (한강로2가)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'd54bb240-4168-46aa-997b-6857388aeece' AND region = $r$이태원/용산$r$;
-- 코이라멘 방이점 | 서울 송파구 올림픽로34길 16 1층 (방이동)
UPDATE places SET region = $r$잠실/송파/강동$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'd59dd4da-0af0-447e-8d8d-89f891016a99' AND region = $r$송파/강동$r$;
-- 카페 콤포트 | 서울 용산구 두텁바위로60길 45
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$후암동$r$), updated_at = now()
  WHERE id = 'd5b803f1-cbbc-46ac-bc3a-f236600c0ac3' AND region = $r$용산구 후암동$r$;
-- 돈까스광명 | 서울 마포구 포은로 25 1층 (합정동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'd72d94c5-a2b7-46c2-85ab-7ab50fbb3162' AND region = $r$마포/홍대$r$;
-- 류센소 본점 | 부산 해운대구 구남로8번길 62 1층
UPDATE places SET region = $r$해운대$r$, province = $r$부산$r$, updated_at = now()
  WHERE id = 'd7315ef7-4296-4a2b-afdd-0f99b38390af' AND region = $r$부산 해운대구$r$;
-- 밀라노식당 | 서울 마포구 연남로1길 6-9 예나빌딩 1층
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'd82fb212-be78-4cd9-bfe8-49bd3d6989ac' AND region = $r$서울 마포구$r$;
-- 모모키친 | 서울 용산구 한강대로104길 50 JH빌딩 2층 201호 (동자동)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'd8668c10-a355-4660-a527-498ee71adb79' AND region = $r$이태원/용산$r$;
-- 치킨명작 가능동본점 | 경기 의정부시 의정로131번길 20 1층 (가능동)
UPDATE places SET region = $r$의정부$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = 'd917b764-f074-4d20-aa9e-f0bd2359dc0c' AND region = $r$의정부시$r$;
-- 리꼬피자 하남 미사본점 | 경기 하남시 미사강변북로30번길 65 1층 (망월동)
UPDATE places SET region = $r$하남$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = 'da813ddb-a4bf-4e39-aa5a-8647d8736de1' AND region = $r$하남시$r$;
-- 이재모피자 서면점 | 부산 부산진구 전포대로209번길 21 1-3층 (전포동)
UPDATE places SET region = $r$서면$r$, province = $r$부산$r$, updated_at = now()
  WHERE id = 'dab592af-d05b-4fa6-9ad9-c1ebf89b1a2e' AND region = $r$부산진구$r$;
-- 무겐스위치 | 서울 마포구 동교로 242-13 1층 (연남동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'dbd37b04-f3d6-40da-a2ce-7bfe950a27b8' AND region = $r$마포/홍대$r$;
-- 나이스샤워 역삼점 | 서울 강남구 테헤란로10길 25 뜨라네 상가 1층 106호
UPDATE places SET region = $r$강남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'dc5a243d-6f4c-4d6a-97be-5bfc0d378f8b' AND region = $r$서울 강남구$r$;
-- 토모카츠 | 대전 유성구 신성남로111번길 8 1층 (신성동)
UPDATE places SET region = $r$유성/궁동$r$, province = $r$대전$r$, updated_at = now()
  WHERE id = 'ddbde7b3-3c70-440e-b43e-749d40543750' AND region = $r$유성구$r$;
-- 이리부농 | 경기 수원시 권선구 매곡로 6-8
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = 'ddce7249-9d43-4038-b013-ee73a6361776' AND region = $r$경기 수원시$r$;
-- 카산도 | 경기 성남시 분당구 불정로71번길 2 1층 (정자동)
UPDATE places SET region = $r$성남/분당$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = 'de2c9443-28e1-4918-9a9e-00499aa7e830' AND region = $r$성남시$r$;
-- 연대포 | 서울 서대문구 연세로7길 26 1층
UPDATE places SET region = $r$신촌/연희$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'dfd404e8-43f2-4dab-9a43-e63a3b97ff74' AND region = $r$서울 서대문구$r$;
-- 엉클조소시지 | 서울 용산구 한강대로62다길 1
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$용산$r$), updated_at = now()
  WHERE id = 'dff49fa7-246f-4420-a339-e900ea25e434' AND region = $r$용산구 용산$r$;
-- 스패즈 | 서울 관악구 장군봉1길 32
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$봉천$r$), updated_at = now()
  WHERE id = 'e082652a-cb78-4b70-bd65-4d8e89db17d7' AND region = $r$관악구 봉천$r$;
-- 이승학돈까스 본점 | 부산 중구 광복중앙로 12 2층 (광복동3가)
UPDATE places SET region = $r$남포동/중앙동$r$, province = $r$부산$r$, updated_at = now()
  WHERE id = 'e160465b-ef38-4f07-9bf1-96e8d90b022c' AND region = $r$중구$r$;
-- 여의도 월드나이트마켓 | 서울 영등포구 여의동로 330 여의도한강공원 물빛광장
UPDATE places SET region = $r$영등포/여의도/강서$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'e17922ff-d809-477f-9631-b184aa058db4' AND region = $r$서울 영등포구$r$;
-- 도곡여울 | 서울 강남구 논현로30길 36 1층
UPDATE places SET region = $r$강남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'e46b2e59-2536-48b4-99d5-1140e38cd6a6' AND region = $r$서울 강남구$r$;
-- 카츠키 | 경기 하남시 미사강변한강로354번길 24 102호 (망월동)
UPDATE places SET region = $r$하남$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = 'e6540998-f588-4d67-b1ba-47046634a16f' AND region = $r$하남시$r$;
-- 우정양곱창 | 서울 강남구 도산대로30길 23 1층
UPDATE places SET region = $r$강남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'e69f38ac-0ae9-45ce-8c66-0f5f3efafc1c' AND region = $r$서울 강남구$r$;
-- 존앤진피자펍 행궁본점 | 경기 수원시 팔달구 정조로905번길 27 1층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = 'e7dac0bc-a2ad-441d-bf5c-62ed043c5124' AND region = $r$경기 수원시$r$;
-- 주섬주섬 | 서울 마포구 와우산로21길 36-12 지층
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'e8646606-5655-478f-b4e8-0f4e9ddfd1a9' AND region = $r$서울 마포구$r$;
-- 이이네 | 서울 용산구 소월로2길 13 지하1층
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'e8649101-aea6-467a-a932-27f7bb53af49' AND region = $r$서울 용산구$r$;
-- 츠케루 | 서울 마포구 와우산로23길 9 칼리오페 1층 102호 (서교동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'e889740b-9ee1-475a-8857-798a5b7c5f21' AND region = $r$마포/홍대$r$;
-- 백스트리트피자 | 서울 마포구 동교로 245 4층 (연남동)
UPDATE places SET region = $r$홍대/합정/마포/연남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'e90d7ae5-7ab0-4829-afc3-b860124c5768' AND region = $r$마포/홍대$r$;
-- 호파스타 건대본점 | 서울 광진구 군자로3길 23 1층
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'e9ed58db-3872-4601-8ed2-4e48e3ddcec9' AND region = $r$서울 광진구$r$;
-- 이남장 본점 | 서울 중구 삼일대로12길 16 1층
UPDATE places SET region = $r$종로/중구$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'ea2c7842-d185-4b23-bfc6-d224798f2303' AND region = $r$서울 중구$r$;
-- 울타리곱창 | 서울 중랑구 중랑역로 20 1층
UPDATE places SET region = $r$성북/노원/중랑$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'eb3161a1-a772-4729-a365-18e2b3b495ba' AND region = $r$서울 중랑구$r$;
-- 선유실비 | 서울 영등포구 양평로22나길 3 런던파크 1층
UPDATE places SET region = $r$영등포/여의도/강서$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'ecb4da05-6d1d-42ad-84ec-22801d42264a' AND region = $r$서울 영등포구$r$;
-- 우마이도 건대점 | 서울 광진구 능동로 135-2 1층 (화양동)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'eccc147c-3e80-460a-83d2-eef7156dbc72' AND region = $r$성수/건대$r$;
-- 교차점 | 서울 송파구 송파대로 451 덕수빌딩 1층 104호 (석촌동)
UPDATE places SET region = $r$잠실/송파/강동$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'ee3a3dde-bdf5-45f2-bd51-7a1d169a247f' AND region = $r$송파/강동$r$;
-- 금촌샤브칼국수 | 경기 수원시 영통구 태장로 73 정석그린프라자 2층 202호
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = 'eee26018-5a1e-4455-aabf-25df7531106a' AND region = $r$경기 수원시$r$;
-- 안테룸 서울 | 서울 강남구 도산대로 153
UPDATE places SET region = $r$강남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'f117f826-2880-4e37-a774-3a71b06d9206' AND region = $r$서울 강남구$r$;
-- 먹튀 | 경기 수원시 팔달구 권광로180번길 41 1층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = 'f2224712-10c3-473f-afcc-6d8d1d8eacc0' AND region = $r$경기 수원시$r$;
-- 아따 | 서울 용산구 한남대로27가길 8-3 1층 (한남동)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'f38bccea-7b7f-4b53-86f6-ca046166c539' AND region = $r$이태원/용산$r$;
-- 레프트커피 | 서울 동대문구 회기로 164
UPDATE places SET region = $r$회기/청량리$r$, province = $r$서울$r$,
  sub_region = COALESCE(NULLIF(sub_region, ''), $r$회기$r$), updated_at = now()
  WHERE id = 'f4a861e8-3139-4645-be07-017c30250cbd' AND region = $r$동대문구 회기$r$;
-- 도이라멘 | 경기 수원시 영통구 월드컵로150번길 26 101호 (원천동)
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = 'f596b499-8b61-462a-a042-687e22dc2e9c' AND region = $r$수원시$r$;
-- 제스티살룬 성수 | 서울 성동구 서울숲4길 13 1층 (성수동1가)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'f7374467-8480-4083-950c-68419d1fd240' AND region = $r$성수/건대$r$;
-- 토라카츠 | 서울 성북구 장월로1길 90 1층 (상월곡동)
UPDATE places SET region = $r$성북/노원/중랑$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'f80160c0-adc4-4864-b343-5e7622cbf4df' AND region = $r$노원/강북$r$;
-- 롸카두들 내쉬빌 핫치킨 성수점 | 서울 성동구 성수일로4길 25 서울숲코오롱디지털타워 상가 1층 108호 (성수동2가)
UPDATE places SET region = $r$건대/성수/왕십리$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'f87ed18e-a327-4bdb-8f56-f4d4f18b2398' AND region = $r$성수/건대$r$;
-- 한마리정육식당 아주대점 | 경기 수원시 영통구 월드컵로193번길 81-4 1층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = 'f912d34d-3b73-4489-ba61-7fff0b13f389' AND region = $r$경기 수원시$r$;
-- 스바루 | 서울 서초구 방배중앙로21길 7 우승빌딩 1층
UPDATE places SET region = $r$서초$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'f988ae7a-38a0-4584-b8c4-486fa140c662' AND region = $r$서울 서초구$r$;
-- 노체부어 스페니쉬와인바 | 경기 수원시 팔달구 정조로905번길 41 1층
UPDATE places SET region = $r$수원$r$, province = $r$경기$r$, updated_at = now()
  WHERE id = 'fb6745e2-567a-48bc-9914-bc59ab7b4144' AND region = $r$경기 수원시$r$;
-- 훈감동 | 서울 동작구 동작대로9길 4 1층
UPDATE places SET region = $r$구로/관악/동작$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'fbd89603-f801-453f-a26f-3d5d1252c779' AND region = $r$서울 동작구$r$;
-- 뉴오더클럽 한남 | 서울 용산구 이태원로54길 58-14 1층 (한남동)
UPDATE places SET region = $r$용산/이태원/한남$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'fc1cf754-86f6-4d0d-8e54-8dce5d3f2ac3' AND region = $r$이태원/용산$r$;
-- 용초수 | 서울 성북구 고려대로27길 20 2층
UPDATE places SET region = $r$성북/노원/중랑$r$, province = $r$서울$r$, updated_at = now()
  WHERE id = 'fe612100-c071-418e-8637-75a8c1b036af' AND region = $r$서울 성북구$r$;
-- 글루글루 | 충북 제천시 수산면 옥순봉로10길 2
UPDATE places SET region = $r$제천$r$, province = $r$충북$r$, updated_at = now()
  WHERE id = 'fe8590d7-1fbd-4ab7-a8d3-dd29cb8d1464' AND (region IS NULL OR region = '');

COMMIT;
