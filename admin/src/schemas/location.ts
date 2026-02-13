import { z } from 'zod';

export const locationFormSchema = z.object({
  name: z.string().min(1, '장소명을 입력하세요'),
  region: z.string().min(1, '지역을 선택하세요'),
  sub_region: z.string().nullable().optional(),
  category_main: z.string().nullable().optional(),
  category_sub: z.string().nullable().optional(),
  address: z.string().min(1, '주소를 입력하세요'),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  memo: z.string().default(''),
  short_desc: z.string().nullable().optional(),
  curation_level: z.number().min(1, '큐레이션 레벨을 선택하세요').max(5).nullable().optional(),
  price_level: z.number().min(1).max(4).nullable().optional(),
  features: z.object({
    solo_ok: z.boolean().optional(),
    quiet: z.boolean().optional(),
    wait_short: z.boolean().optional(),
    date_ok: z.boolean().optional(),
    group_ok: z.boolean().optional(),
    parking: z.boolean().optional(),
    pet_friendly: z.boolean().optional(),
    reservation: z.boolean().optional(),
    late_night: z.boolean().optional(),
  }).default({}),
  imageUrl: z.string().default(''),
  naver_place_id: z.string().nullable().optional(),
  kakao_place_id: z.string().nullable().optional(),
  visit_date: z.string().nullable().optional(),
  curator_visited: z.boolean().nullable().optional(),
  tags: z.array(z.string()).default([]),
  event_tags: z.array(z.string()).default([]),
});

export type LocationFormValues = z.infer<typeof locationFormSchema>;
