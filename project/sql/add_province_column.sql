-- locations 테이블에 province 컬럼 추가
-- Supabase SQL 에디터에서 실행하세요

-- 1. province 컬럼 추가 (nullable, 기존 데이터와의 호환성)
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS province TEXT;

-- 2. province 컬럼에 대한 코멘트 추가 (선택사항)
COMMENT ON COLUMN locations.province IS '대분류 (시/도): 서울, 경기, 인천 등';

-- 3. province 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_locations_province ON locations(province);

-- 4. 기존 데이터의 province 자동 채우기 (선택사항)
-- region 값으로부터 province를 추론하여 업데이트
-- 주의: 이 쿼리는 실행 시 기존 데이터를 수정합니다
UPDATE locations
SET province = CASE
  -- 서울
  WHEN region IN ('강남', '서초', '잠실/송파/강동', '영등포/여의도/강서', '건대/성수/왕십리',
                  '종로/중구', '홍대/합정/마포/연남', '용산/이태원/한남', '성북/노원/중랑',
                  '구로/관악/동작', '신촌/연희', '창동/도봉산', '회기/청량리', '강동/고덕',
                  '연신내/구파발', '마곡/김포', '미아/수유/북한산', '목동/양천', '금천/가산')
  THEN '서울'
  
  -- 경기
  WHEN region IN ('수원', '성남/분당', '고양/일산', '용인', '부천', '안양/과천', '안산',
                  '화성/동탄', '평택', '의정부', '파주', '김포', '광명', '광주', '하남',
                  '시흥', '군포/의왕', '오산', '이천', '안성', '양평/여주', '구리/남양주', '포천/동두천')
  THEN '경기'
  
  -- 인천
  WHEN region IN ('부평', '송도/연수', '계양', '남동구', '서구/검단', '중구/동구', '강화/옹진')
  THEN '인천'
  
  -- 부산
  WHEN region IN ('서면', '해운대', '광안리/수영', '센텀시티', '남포동/중앙동', '동래/온천장',
                  '사상/덕천', '기장', '사하/다대포', '연산/토곡')
  THEN '부산'
  
  -- 대구
  WHEN region IN ('동성로/중구', '수성구', '범어/만촌', '동대구/신천', '북구/칠곡', '달서구', '경대/대현')
  THEN '대구'
  
  -- 대전
  WHEN region IN ('둔산', '유성/궁동', '대전역/중앙로', '서구/관저', '동구/대동')
  THEN '대전'
  
  -- 광주
  WHEN region IN ('충장로/동구', '상무지구', '첨단지구', '수완지구', '광주송정역')
  THEN '광주'
  
  -- 울산
  WHEN region IN ('삼산/신정', '성남동/중구', '동구/방어진', '울주/언양')
  THEN '울산'
  
  -- 세종
  WHEN region IN ('조치원', '정부청사/어진동', '나성동/다정동')
  THEN '세종'
  
  -- 강원
  WHEN region IN ('춘천', '원주', '강릉', '속초/양양', '동해/삼척', '평창/정선', '홍천/횡성')
  THEN '강원'
  
  -- 충북
  WHEN region IN ('청주', '충주', '제천', '음성/진천')
  THEN '충북'
  
  -- 충남
  WHEN region IN ('천안', '아산', '서산/당진', '공주/부여', '논산/계룡', '홍성/예산')
  THEN '충남'
  
  -- 전북
  WHEN region IN ('전주', '익산', '군산', '정읍/김제', '남원/순창')
  THEN '전북'
  
  -- 전남
  WHEN region IN ('여수', '순천', '광양', '목포', '나주', '무안/영암')
  THEN '전남'
  
  -- 경북
  WHEN region IN ('포항', '경주', '구미', '안동', '김천', '영주/봉화', '상주/문경')
  THEN '경북'
  
  -- 경남
  WHEN region IN ('창원/마산', '김해', '진주', '양산', '거제', '통영/고성', '밀양/창녕')
  THEN '경남'
  
  -- 제주
  WHEN region IN ('제주시', '서귀포', '애월/한림', '성산/표선', '중문')
  THEN '제주'
  
  ELSE NULL
END
WHERE province IS NULL;

-- 5. 업데이트 결과 확인 (선택사항)
-- SELECT 
--   province,
--   COUNT(*) as count
-- FROM locations
-- GROUP BY province
-- ORDER BY count DESC;
